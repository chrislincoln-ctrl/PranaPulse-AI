import { z } from 'zod';
import { APP_META, SECURITY_LIMITS } from '../src/config/constants.js';

const optionalTrimmedString = z
  .string()
  .optional()
  .transform((value) => {
    const trimmed = value?.trim();
    return trimmed && trimmed.length > 0 ? trimmed : undefined;
  });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce
    .number()
    .int()
    .min(SECURITY_LIMITS.MIN_PORT)
    .max(SECURITY_LIMITS.MAX_PORT)
    .default(SECURITY_LIMITS.DEFAULT_PORT),
  GEMINI_API_KEY: optionalTrimmedString,
  GEMINI_MODEL: optionalTrimmedString.transform((value) => value ?? APP_META.DEFAULT_GEMINI_MODEL),
  WAQI_API_TOKEN: optionalTrimmedString,
  NASA_FIRMS_MAP_KEY: optionalTrimmedString,
  VITE_SUPABASE_URL: optionalTrimmedString,
  ALLOWED_ORIGINS: optionalTrimmedString.transform((value) =>
    value
      ? value
          .split(',')
          .map((origin) => origin.trim())
          .filter((origin) => origin.length > 0)
      : [],
  ),
});

/** Validated server runtime configuration. */
export type ServerEnv = z.infer<typeof envSchema>;

/**
 * Parses and validates runtime environment variables without leaking secrets.
 *
 * @param rawEnv - Environment key-value map (defaults to `process.env`).
 * @returns Strictly typed runtime configuration.
 */
export function loadServerEnv(rawEnv: NodeJS.ProcessEnv = process.env): ServerEnv {
  return envSchema.parse(rawEnv);
}
