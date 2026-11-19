import { Router, type Request, type Response } from 'express';
import { HTTP_STATUS, SECURITY_LIMITS } from '../../src/config/constants.js';
import { computePlanPhysics } from '../../src/domain/localBaseline.js';
import {
  chatRequestSchema,
  geocodeQuerySchema,
  planRequestSchema,
  telemetryQuerySchema,
  type PlanRequestPayload,
} from '../../src/validators/schemas.js';
import type { ServerEnv } from '../env.js';
import { SlidingWindowRateLimiter } from '../services/cacheAndLimiter.js';
import { planCityCorridor, type CorridorPlanRequest } from '../services/corridorPlanner.js';
import {
  verifyCustomOption,
  type CustomCategory,
  type CustomVerifyRequest,
} from '../services/customOptionVerifier.js';
import { generateGroundedPlan, streamGroundedAdvice } from '../services/geminiAdvisor.js';
import { getUrbanTelemetryBundle, searchUrbanLocations } from '../services/telemetryClients.js';
import { resolveAutoLocation } from '../services/waqiFirmsClient.js';

export interface RateLimiterPair {
  readonly telemetry: SlidingWindowRateLimiter;
  readonly ai: SlidingWindowRateLimiter;
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
} {
  const lat = Number(query.lat);
  const lon = Number(query.lon);
  if (Number.isFinite(lat) && Number.isFinite(lon)) {
    return { lat, lon };
  }
  return {};
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
    const located = await resolveAutoLocation({ ...coords, token: env.WAQI_API_TOKEN });
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

function isCustomCategory(val: unknown): val is CustomCategory {
  return val === 'role' || val === 'tightness' || val === 'cookingFuel';
}

function readStr(val: unknown): string {
  return typeof val === 'string' ? val.trim() : '';
}

function resolveLang(val: unknown): CorridorPlanRequest['language'] {
  return val === 'hi' || val === 'ta' ? val : 'en';
}

function parseVerifyRequest(body: unknown): CustomVerifyRequest | null {
  const obj = (typeof body === 'object' && body !== null ? body : {}) as Record<string, unknown>;
  const customText = readStr(obj.customText);
  if (!isCustomCategory(obj.category) || customText.length === 0) {
    return null;
  }
  return { category: obj.category, customText, language: resolveLang(obj.language) };
}

function parseCorridorPlanBody(body: unknown): CorridorPlanRequest | null {
  const obj = (typeof body === 'object' && body !== null ? body : {}) as Record<string, unknown>;
  const city = readStr(obj.city);
  const fromArea = readStr(obj.fromArea);
  const toArea = readStr(obj.toArea);
  if (!city || !fromArea || !toArea) {
    return null;
  }
  const commuteMode = (readStr(obj.commuteMode) || 'metro') as CorridorPlanRequest['commuteMode'];
  return { city, fromArea, toArea, commuteMode, language: resolveLang(obj.language) };
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
    const verifyReq = parseVerifyRequest(req.body);
    if (!verifyReq) {
      sendValidationError(res, 'Provide a valid category and custom text to verify.');
      return;
    }
    const result = await verifyCustomOption(verifyReq, env);
    res.status(HTTP_STATUS.OK).json(result);
  });

  router.post('/corridor-plan', limiter.middleware, async (req: Request, res: Response) => {
    const planReq = parseCorridorPlanBody(req.body);
    if (!planReq) {
      sendValidationError(res, 'Provide city, starting area (fromArea), and destination (toArea).');
      return;
    }
    const result = await planCityCorridor(planReq, env);
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
    res.setHeader('Connection', 'keep-alive');

    const result = await streamGroundedAdvice(parsed.data, env, (chunk) => {
      writeSseEvent(res, { chunk });
    });

    writeSseEvent(res, { done: true, isFallback: result.isFallback });
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
  };

  registerGeocodeAndTelemetry(router, env, limiters.telemetry);
  registerPlanRoute(router, env, limiters.ai);
  registerAssistantStreamRoute(router, env, limiters.ai);

  return { router, limiters };
}
