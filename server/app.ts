import fs from 'node:fs';
import path from 'node:path';
import compression from 'compression';
import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import helmet from 'helmet';
import { APP_META, HTTP_STATUS, SECURITY_LIMITS } from '../src/config/constants.js';
import { loadServerEnv, type ServerEnv } from './env.js';
import { createAirQualityRouter, type RateLimiterPair } from './routes/airQualityRoutes.js';

interface AppErrorLike {
  status?: number;
  statusCode?: number;
  type?: string;
}

const DIST_INDEX = path.resolve(process.cwd(), 'dist', 'index.html');
const DIST_DIR = path.resolve(process.cwd(), 'dist');

function resolveSupabaseOrigin(rawUrl?: string): string | null {
  if (!rawUrl) {
    return null;
  }
  try {
    const parsed = new URL(rawUrl);
    return parsed.protocol === 'https:' ? parsed.origin : null;
  } catch {
    return null;
  }
}

function buildHelmetMiddleware(env: ServerEnv): ReturnType<typeof helmet> {
  const supabaseOrigin = resolveSupabaseOrigin(env.VITE_SUPABASE_URL);
  const connectSrc = supabaseOrigin ? ["'self'", supabaseOrigin] : ["'self'"];

  return helmet({
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'"],
        imgSrc: ["'self'", 'data:'],
        fontSrc: ["'self'", 'data:'],
        connectSrc,
        frameAncestors: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
      },
    },
    frameguard: { action: 'deny' },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    hsts: { maxAge: 63_072_000, includeSubDomains: true, preload: true },
  });
}

function registerHealthRoute(app: Express, env: ServerEnv): void {
  app.get('/api/health', (_req: Request, res: Response) => {
    res.status(HTTP_STATUS.OK).json({
      status: 'ok',
      service: APP_META.NAME,
      version: APP_META.VERSION,
      uptimeSeconds: Math.floor(process.uptime()),
      capabilities: {
        openMeteoLive: true,
        geminiConfigured: Boolean(env.GEMINI_API_KEY),
        groqConfigured: Boolean(env.GROQ_API_KEY),
        waqiConfigured: Boolean(env.WAQI_API_TOKEN),
        firmsConfigured: Boolean(env.NASA_FIRMS_MAP_KEY),
        supabaseConfigured: Boolean(resolveSupabaseOrigin(env.VITE_SUPABASE_URL)),
      },
    });
  });
}

function registerStaticServing(app: Express, env: ServerEnv): void {
  if (env.NODE_ENV !== 'production' || !fs.existsSync(DIST_INDEX)) {
    return;
  }

  app.use(
    express.static(DIST_DIR, {
      etag: true,
      maxAge: 0,
      setHeaders: (res) => {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      },
    }),
  );
  app.get('/{*splat}', (_req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.sendFile(DIST_INDEX, { dotfiles: 'allow' });
  });
}

function resolveErrorStatus(err: unknown): number {
  if (typeof err === 'object' && err !== null) {
    const candidate = err as AppErrorLike;
    if (candidate.type === 'entity.too.large') {
      return HTTP_STATUS.PAYLOAD_TOO_LARGE;
    }
    if (candidate.type === 'entity.parse.failed') {
      return HTTP_STATUS.BAD_REQUEST;
    }
    if (typeof candidate.status === 'number') {
      return candidate.status;
    }
    if (typeof candidate.statusCode === 'number') {
      return candidate.statusCode;
    }
  }
  return HTTP_STATUS.INTERNAL_ERROR;
}

function registerErrorHandlers(app: Express): void {
  app.use((_req: Request, res: Response) => {
    res.status(HTTP_STATUS.BAD_REQUEST).json({
      error: 'Unsupported route or method.',
    });
  });

  // Express error middleware requires a 4-parameter signature; sanitize output for CWE-209.
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const status = resolveErrorStatus(err);
    const message =
      status === HTTP_STATUS.PAYLOAD_TOO_LARGE
        ? 'Request payload exceeds 16 KB security budget.'
        : 'Malformed or invalid request payload.';
    const safeMessage = status >= HTTP_STATUS.INTERNAL_ERROR ? 'Internal server error.' : message;
    res.status(status).json({ error: safeMessage });
  });
}

/**
 * Constructs a configured Express 5 application instance for both Vercel Serverless
 * execution and standalone HTTP runtime.
 *
 * @param customEnv - Optional pre-validated server configuration for isolated tests.
 * @returns Hardened Express 5 application instance.
 */
export function createApp(customEnv?: ServerEnv): Express {
  const env = customEnv ?? loadServerEnv();
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(buildHelmetMiddleware(env));
  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(self)');
    next();
  });
  app.use(
    compression({
      filter: (req, res) =>
        req.path === '/api/assistant/stream' ? false : compression.filter(req, res),
    }),
  );
  app.use(express.json({ limit: SECURITY_LIMITS.JSON_BODY_LIMIT }));

  registerHealthRoute(app, env);
  const { router } = createAirQualityRouter(env);
  app.use('/api', router);
  registerStaticServing(app, env);
  registerErrorHandlers(app);

  return app;
}

export type { RateLimiterPair };
