import { Router, type Request, type Response } from 'express';
import { HTTP_STATUS, SECURITY_LIMITS } from '../../src/config/constants.js';
import { computePlanPhysics } from '../../src/domain/localBaseline.js';
import {
  corridorPlanRequestSchema,
  customVerifyRequestSchema,
  locateQuerySchema,
} from '../../src/validators/companionSchemas.js';
import {
  chatRequestSchema,
  geocodeQuerySchema,
  planRequestSchema,
  telemetryQuerySchema,
  type PlanRequestPayload,
} from '../../src/validators/schemas.js';
import type { ServerEnv } from '../env.js';
import { SlidingWindowRateLimiter } from '../services/cacheAndLimiter.js';
import { planCityCorridor } from '../services/corridorPlanner.js';
import { verifyCustomOption } from '../services/customOptionVerifier.js';
import { generateGroundedPlan, streamGroundedAdvice } from '../services/geminiAdvisor.js';
import { getUrbanTelemetryBundle, searchUrbanLocations } from '../services/telemetryClients.js';
import { extractRequestGeoContext, resolveAutoLocation } from '../services/waqiFirmsClient.js';

export interface RateLimiterPair {
  readonly telemetry: SlidingWindowRateLimiter;
  readonly ai: SlidingWindowRateLimiter;
  readonly chat: SlidingWindowRateLimiter;
}

function sendValidationError(res: Response, message: string): void {
  res.status(HTTP_STATUS.BAD_REQUEST).json({ error: message });
}

function writeSseEvent(res: Response, payload: Record<string, unknown>): void {
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

function parseCoordQuery(query: Request['query']): {
  readonly lat?: number | undefined;
  readonly lon?: number | undefined;
  readonly accuracy?: number | undefined;
} {
  const parsed = locateQuerySchema.safeParse(query);
  if (!parsed.success || parsed.data.lat === undefined || parsed.data.lon === undefined) {
    return {};
  }
  return {
    lat: parsed.data.lat,
    lon: parsed.data.lon,
    ...(parsed.data.accuracy !== undefined ? { accuracy: parsed.data.accuracy } : {}),
  };
}

function registerGeocodeAndTelemetry(
  router: Router,
  env: ServerEnv,
  limiter: SlidingWindowRateLimiter,
): void {
  router.get('/geocode', limiter.middleware, async (req: Request, res: Response) => {
    const parsed = geocodeQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      sendValidationError(res, 'Provide a valid city or locality search query.');
      return;
    }
    const locations = await searchUrbanLocations(parsed.data.q);
    res.status(HTTP_STATUS.OK).json({ locations });
  });

  router.get('/locate', limiter.middleware, async (req: Request, res: Response) => {
    const coords = parseCoordQuery(req.query);
    const geoCtx = extractRequestGeoContext(req.headers, req.socket.remoteAddress);
    const located = await resolveAutoLocation({ ...coords, ...geoCtx, token: env.WAQI_API_TOKEN });
    if (!located) {
      res.status(HTTP_STATUS.INTERNAL_ERROR).json({ error: 'Unable to resolve current location.' });
      return;
    }
    res.status(HTTP_STATUS.OK).json(located);
  });

  router.get('/telemetry', limiter.middleware, async (req: Request, res: Response) => {
    const parsed = telemetryQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      sendValidationError(res, 'Coordinates lat (-90..90) and lon (-180..180) are required.');
      return;
    }
    const bundle = await getUrbanTelemetryBundle({
      lat: parsed.data.lat,
      lon: parsed.data.lon,
      cityLabel: parsed.data.city,
      env,
    });
    res.status(HTTP_STATUS.OK).json(bundle);
  });
}

async function buildPlanPayload(
  input: PlanRequestPayload,
  env: ServerEnv,
): Promise<Record<string, unknown> | null> {
  const telemetry = await getUrbanTelemetryBundle({
    lat: input.lat,
    lon: input.lon,
    cityLabel: input.city,
    env,
  });

  const physics = computePlanPhysics(input, telemetry);
  const bestCommute = physics.commuteOptions[0];
  if (!bestCommute) {
    return null;
  }

  const aiResult = await generateGroundedPlan(
    {
      request: input,
      aqi: telemetry.assessment,
      effectiveAqi: physics.effectiveAqi,
      inversion: telemetry.inversion,
      indoor: physics.indoor,
      bestCommute,
      corridor: physics.corridor,
      rwa: physics.rwa,
    },
    env,
  );

  return {
    telemetry,
    indoor: physics.indoor,
    commuteOptions: physics.commuteOptions,
    corridor: physics.corridor,
    rwa: physics.rwa,
    memberAdvisories: physics.memberAdvisories,
    aiPlan: aiResult.plan,
    aiMeta: {
      isFallback: aiResult.isFallback,
      modelUsed: aiResult.modelUsed,
      cached: aiResult.cached,
    },
  };
}

function registerPlanRoute(
  router: Router,
  env: ServerEnv,
  limiter: SlidingWindowRateLimiter,
): void {
  router.post('/plan', limiter.middleware, async (req: Request, res: Response) => {
    const parsed = planRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      sendValidationError(res, 'Invalid household or exposure simulation payload.');
      return;
    }

    const payload = await buildPlanPayload(parsed.data, env);
    if (!payload) {
      res.status(HTTP_STATUS.INTERNAL_ERROR).json({ error: 'Unable to compute commute options.' });
      return;
    }
    res.status(HTTP_STATUS.OK).json(payload);
  });

  router.post('/verify-custom', limiter.middleware, async (req: Request, res: Response) => {
    const parsed = customVerifyRequestSchema.safeParse(req.body);
    if (!parsed.success || parsed.data.customText.length === 0) {
      sendValidationError(res, 'Provide a valid category and custom text to verify.');
      return;
    }
    const result = await verifyCustomOption(parsed.data, env);
    res.status(HTTP_STATUS.OK).json(result);
  });

  router.post('/corridor-plan', limiter.middleware, async (req: Request, res: Response) => {
    const parsed = corridorPlanRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      sendValidationError(res, 'Provide city, starting area (fromArea), and destination (toArea).');
      return;
    }
    const result = await planCityCorridor(parsed.data, env);
    res.status(HTTP_STATUS.OK).json(result);
  });
}

function registerAssistantStreamRoute(
  router: Router,
  env: ServerEnv,
  limiter: SlidingWindowRateLimiter,
): void {
  router.post('/assistant/stream', limiter.middleware, async (req: Request, res: Response) => {
    const parsed = chatRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      sendValidationError(res, 'Chat query must be 1-500 characters with valid telemetry context.');
      return;
    }

    res.status(HTTP_STATUS.OK);
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    let isFallback = true;
    let provider: 'gemini' | 'groq' | 'deterministic' = 'deterministic';
    try {
      const result = await streamGroundedAdvice(parsed.data, env, (chunk) => {
        writeSseEvent(res, { chunk });
      });
      isFallback = result.isFallback;
      provider = result.provider;
    } catch {
      isFallback = true;
      provider = 'deterministic';
    }
    writeSseEvent(res, { done: true, isFallback, provider });
    res.end();
  });
}

/**
 * Creates the hardened API router and its route-scoped sliding-window rate limiters.
 *
 * @param env - Validated server runtime configuration.
 * @returns Express Router plus limiter instances exposed cleanly for unit-test cleanup.
 */
export function createAirQualityRouter(env: ServerEnv): {
  readonly router: Router;
  readonly limiters: RateLimiterPair;
} {
  const router = Router();
  const limiters: RateLimiterPair = {
    telemetry: new SlidingWindowRateLimiter(SECURITY_LIMITS.TELEMETRY_RATE_LIMIT_PER_MIN),
    ai: new SlidingWindowRateLimiter(SECURITY_LIMITS.AI_RATE_LIMIT_PER_MIN),
    chat: new SlidingWindowRateLimiter(SECURITY_LIMITS.CHAT_RATE_LIMIT_PER_MIN),
  };

  registerGeocodeAndTelemetry(router, env, limiters.telemetry);
  registerPlanRoute(router, env, limiters.ai);
  registerAssistantStreamRoute(router, env, limiters.chat);

  return { router, limiters };
}
