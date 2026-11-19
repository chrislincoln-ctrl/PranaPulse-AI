import { createHash } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { HTTP_STATUS, SECURITY_LIMITS, VALIDATION_BOUNDS } from '../../src/config/constants.js';

interface CacheEntry<T> {
  readonly expiresAt: number;
  readonly value: T;
}

const HEADER_SECONDS_DIVISOR = 1_000;

/**
 * Computes a deterministic SHA-256 hex digest from serializable request/telemetry inputs.
 *
 * @param payload - Arbitrary structured object to hash.
 * @returns Hexadecimal SHA-256 cache key.
 */
export function createSha256Key(payload: unknown): string {
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

/**
 * Bounded LRU-evicting in-memory TTL cache preventing stale upstream hits and unbounded RAM growth.
 */
export class BoundedTtlCache<T> {
  private readonly store = new Map<string, CacheEntry<T>>();

  public constructor(
    private readonly ttlMs: number,
    private readonly maxEntries: number = VALIDATION_BOUNDS.MAX_CACHE_ENTRIES,
  ) {}

  public get(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) {
      return undefined;
    }
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    // Refresh insertion order for simple LRU eviction.
    this.store.delete(key);
    this.store.set(key, entry);
    return entry.value;
  }

  public set(key: string, value: T): void {
    if (this.store.size >= this.maxEntries && !this.store.has(key)) {
      const oldestKey = this.store.keys().next().value;
      if (oldestKey !== undefined) {
        this.store.delete(oldestKey);
      }
    }
    this.store.set(key, {
      expiresAt: Date.now() + this.ttlMs,
      value,
    });
  }

  public clear(): void {
    this.store.clear();
  }
}

interface RateBucket {
  timestamps: number[];
}

/**
 * Sliding-window per-IP rate limiter for Express 5 API routes.
 */
export class SlidingWindowRateLimiter {
  private readonly buckets = new Map<string, RateBucket>();

  public constructor(
    private readonly maxRequests: number,
    private readonly windowMs: number = SECURITY_LIMITS.RATE_WINDOW_MS,
  ) {}

  public middleware = (req: Request, res: Response, next: NextFunction): void => {
    const clientIp = this.extractClientIp(req);
    const now = Date.now();
    const cutoff = now - this.windowMs;

    const bucket = this.buckets.get(clientIp) ?? { timestamps: [] };
    bucket.timestamps = bucket.timestamps.filter((ts) => ts > cutoff);

    res.setHeader('X-RateLimit-Limit', String(this.maxRequests));
    if (bucket.timestamps.length >= this.maxRequests) {
      const oldest = bucket.timestamps[0] ?? now;
      const retrySec = Math.max(
        1,
        Math.ceil((oldest + this.windowMs - now) / HEADER_SECONDS_DIVISOR),
      );
      res.setHeader('X-RateLimit-Remaining', '0');
      res.setHeader('Retry-After', String(retrySec));
      res.status(HTTP_STATUS.TOO_MANY_REQUESTS).json({
        error: 'Rate limit exceeded. Please wait briefly before retrying.',
      });
      return;
    }

    bucket.timestamps.push(now);
    this.buckets.set(clientIp, bucket);
    res.setHeader('X-RateLimit-Remaining', String(this.maxRequests - bucket.timestamps.length));
    next();
  };

  public clear(): void {
    this.buckets.clear();
  }

  private extractClientIp(req: Request): string {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string' && forwarded.length > 0) {
      return forwarded.split(',')[0]?.trim() ?? 'unknown';
    }
    return req.ip ?? req.socket.remoteAddress ?? 'unknown';
  }
}

/**
 * Fetches JSON with a strict AbortController timeout to avoid serverless hangs.
 *
 * @param url - Fully constructed target URL.
 * @param timeoutMs - Abort budget in milliseconds.
 * @returns Parsed JSON body.
 */
export async function fetchJsonWithTimeout<T>(
  url: string,
  timeoutMs: number = SECURITY_LIMITS.UPSTREAM_TIMEOUT_MS,
  headers?: Readonly<Record<string, string>>,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      ...(headers ? { headers } : {}),
    });
    if (!response.ok) {
      throw new Error(`Upstream HTTP ${String(response.status)}`);
    }
    return (await response.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

/** Races a promise against a strict wall-clock timeout and cleans up its timer reliably. */
export async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => {
          reject(new Error('Upstream request timeout'));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timer !== undefined) {
      clearTimeout(timer);
    }
  }
}
