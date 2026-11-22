import { z } from 'zod';
import { SECURITY_LIMITS, VALIDATION_BOUNDS } from '../config/constants.js';
import { sanitizeUserText } from '../utils/inputSanitizer.js';
import {
  commuteModeSchema,
  familyMemberSchema,
  latSchema,
  lonSchema,
  planRequestSchema,
  supportedLanguageSchema,
} from './schemas.js';

const MIN_WORKSPACE_KEY_LEN = 4;
const MAX_WORKSPACE_KEY_LEN = 32;
const MAX_MEMBER_ID_LEN = 24;
const MAX_CUSTOM_TEXT_LEN = 120;
const MAX_ACCURACY_METERS = 100_000;

export const workspaceKeySchema = z
  .string()
  .trim()
  .min(MIN_WORKSPACE_KEY_LEN)
  .max(MAX_WORKSPACE_KEY_LEN)
  .regex(/^[a-zA-Z0-9_-]+$/);

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
  workspaceKey: workspaceKeySchema.optional(),
});

export type CompanionChatRequest = z.infer<typeof companionChatRequestSchema>;

export const workspaceSyncPostSchema = z.object({
  workspaceKey: workspaceKeySchema,
  payload: planRequestSchema,
  activeMemberId: z.string().trim().min(1).max(MAX_MEMBER_ID_LEN).optional(),
  userId: z.string().max(VALIDATION_BOUNDS.MAX_CITY_QUERY_LEN).optional(),
});

export type WorkspaceSyncPostRequest = z.infer<typeof workspaceSyncPostSchema>;

const legacyTelegramLinkSchema = z.object({
  member: familyMemberSchema,
  city: sanitizedCityField,
  lat: latSchema,
  lon: lonSchema,
  language: supportedLanguageSchema.default('en'),
  workspaceKey: workspaceKeySchema.optional(),
  userId: z.string().max(VALIDATION_BOUNDS.MAX_CITY_QUERY_LEN).optional(),
});

const workspaceTelegramLinkSchema = workspaceSyncPostSchema.extend({
  workspaceKey: workspaceKeySchema.optional(),
});

export const telegramLinkRequestSchema = z.union([
  workspaceTelegramLinkSchema,
  legacyTelegramLinkSchema,
]);

export type TelegramLinkRequest = z.infer<typeof telegramLinkRequestSchema>;

export const customVerifyRequestSchema = z.object({
  category: z.enum(['role', 'tightness', 'cookingFuel']),
  customText: z
    .string()
    .trim()
    .min(1)
    .max(MAX_CUSTOM_TEXT_LEN)
    .transform((val) => sanitizeUserText(val, MAX_CUSTOM_TEXT_LEN)),
  language: supportedLanguageSchema.default('en'),
});

export const corridorPlanRequestSchema = z.object({
  city: sanitizedCityField,
  fromArea: sanitizedCityField,
  toArea: sanitizedCityField,
  commuteMode: commuteModeSchema.default('metro'),
  language: supportedLanguageSchema.default('en'),
});

export const locateQuerySchema = z.object({
  lat: latSchema.optional(),
  lon: lonSchema.optional(),
  accuracy: z.coerce.number().positive().max(MAX_ACCURACY_METERS).optional(),
});
