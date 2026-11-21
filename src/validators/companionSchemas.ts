import { z } from 'zod';
import { SECURITY_LIMITS, VALIDATION_BOUNDS } from '../config/constants.js';
import { sanitizeUserText } from '../utils/inputSanitizer.js';
import { familyMemberSchema, latSchema, lonSchema, supportedLanguageSchema } from './schemas.js';

const sanitizedCityField = z
  .string()
  .min(1)
  .max(VALIDATION_BOUNDS.MAX_CITY_QUERY_LEN)
  .transform((val) => sanitizeUserText(val, VALIDATION_BOUNDS.MAX_CITY_QUERY_LEN));

export const companionChatRequestSchema = z.object({
  member: familyMemberSchema,
  message: z
    .string()
    .trim()
    .min(1)
    .max(SECURITY_LIMITS.MAX_CHAT_QUERY_CHARS)
    .transform((val) => sanitizeUserText(val, SECURITY_LIMITS.MAX_CHAT_QUERY_CHARS)),
  city: sanitizedCityField,
  lat: latSchema,
  lon: lonSchema,
  gpsLat: latSchema.optional(),
  gpsLon: lonSchema.optional(),
  language: supportedLanguageSchema.default('en'),
  areaM2: z.coerce
    .number()
    .min(VALIDATION_BOUNDS.MIN_ROOM_AREA_M2)
    .max(VALIDATION_BOUNDS.MAX_ROOM_AREA_M2)
    .optional(),
  cadrM3Hr: z.coerce.number().min(0).max(VALIDATION_BOUNDS.MAX_CADR_M3_HR).optional(),
});

export type CompanionChatRequest = z.infer<typeof companionChatRequestSchema>;

export const telegramLinkRequestSchema = z.object({
  member: familyMemberSchema,
  city: sanitizedCityField,
  lat: latSchema,
  lon: lonSchema,
  language: supportedLanguageSchema.default('en'),
  userId: z.string().max(VALIDATION_BOUNDS.MAX_CITY_QUERY_LEN).optional(),
});

export type TelegramLinkRequest = z.infer<typeof telegramLinkRequestSchema>;
