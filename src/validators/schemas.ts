import { z } from 'zod';
import { SECURITY_LIMITS, VALIDATION_BOUNDS } from '../config/constants.js';
import { STATION_CROSS_CHECK } from '../config/physicsConstants.js';
import { quantizeCoord, sanitizeUserText } from '../utils/inputSanitizer.js';

export { quantizeCoord, sanitizeUserText };

/** Supported UI and advisory output languages. */
export const supportedLanguageSchema = z.enum(['en', 'hi', 'ta']);
export type SupportedLanguage = z.infer<typeof supportedLanguageSchema>;

const latSchema = z.coerce
  .number()
  .min(SECURITY_LIMITS.MIN_LATITUDE)
  .max(SECURITY_LIMITS.MAX_LATITUDE)
  .transform(quantizeCoord);

const lonSchema = z.coerce
  .number()
  .min(SECURITY_LIMITS.MIN_LONGITUDE)
  .max(SECURITY_LIMITS.MAX_LONGITUDE)
  .transform(quantizeCoord);

export const telemetryQuerySchema = z.object({
  lat: latSchema,
  lon: lonSchema,
  city: z
    .string()
    .optional()
    .transform((val) =>
      val ? sanitizeUserText(val, VALIDATION_BOUNDS.MAX_CITY_QUERY_LEN) : undefined,
    ),
});

export const geocodeQuerySchema = z.object({
  q: z
    .string()
    .trim()
    .min(VALIDATION_BOUNDS.MIN_CITY_QUERY_LEN)
    .max(VALIDATION_BOUNDS.MAX_CITY_QUERY_LEN)
    .transform((val) => sanitizeUserText(val, VALIDATION_BOUNDS.MAX_CITY_QUERY_LEN)),
});

export const familyMemberSchema = z.object({
  id: z.string().min(1).max(VALIDATION_BOUNDS.GEOCODE_RETURN_LIMIT),
  label: z
    .string()
    .min(1)
    .max(VALIDATION_BOUNDS.MAX_CITY_QUERY_LEN)
    .transform((val) => sanitizeUserText(val, VALIDATION_BOUNDS.MAX_CITY_QUERY_LEN)),
  role: z.enum(['child', 'senior-respiratory', 'commuter', 'caregiver']),
  mask: z.enum(['none', 'cloth', 'surgical', 'n95-ffp2']),
  dailyOutdoorHours: z.coerce.number().min(0).max(VALIDATION_BOUNDS.MAX_DAILY_HOURS),
});

export const planRequestSchema = z.object({
  city: z
    .string()
    .min(1)
    .max(VALIDATION_BOUNDS.MAX_CITY_QUERY_LEN)
    .transform((val) => sanitizeUserText(val, VALIDATION_BOUNDS.MAX_CITY_QUERY_LEN)),
  lat: latSchema,
  lon: lonSchema,
  areaM2: z.coerce
    .number()
    .min(VALIDATION_BOUNDS.MIN_ROOM_AREA_M2)
    .max(VALIDATION_BOUNDS.MAX_ROOM_AREA_M2),
  cadrM3Hr: z.coerce.number().min(0).max(VALIDATION_BOUNDS.MAX_CADR_M3_HR),
  tightness: z.enum(['leaky', 'standard', 'weather-sealed']),
  cookingFuel: z.enum(['induction', 'lpg-vented', 'lpg-unvented', 'solid-biomass']),
  commuteDistanceKm: z.coerce.number().min(0).max(VALIDATION_BOUNDS.MAX_COMMUTE_KM),
  commuteMode: z.enum([
    'metro',
    'electric-bus',
    'ev-car',
    'petrol-car',
    'two-wheeler',
    'cycling',
    'walking',
  ]),
  mask: z.enum(['none', 'cloth', 'surgical', 'n95-ffp2']),
  language: supportedLanguageSchema.default('en'),
  householdsParticipating: z.coerce
    .number()
    .int()
    .min(VALIDATION_BOUNDS.MIN_HOUSEHOLDS)
    .max(VALIDATION_BOUNDS.MAX_HOUSEHOLDS),
  transitShiftShare: z.coerce.number().min(0).max(1),
  haltLeafBurning: z.boolean(),
  members: z
    .array(familyMemberSchema)
    .min(VALIDATION_BOUNDS.MIN_FAMILY_MEMBERS)
    .max(VALIDATION_BOUNDS.MAX_FAMILY_MEMBERS),
});

export type PlanRequestPayload = z.infer<typeof planRequestSchema>;

export const chatRequestSchema = z.object({
  query: z
    .string()
    .trim()
    .min(1)
    .max(SECURITY_LIMITS.MAX_CHAT_QUERY_CHARS)
    .transform((val) => sanitizeUserText(val, SECURITY_LIMITS.MAX_CHAT_QUERY_CHARS)),
  city: z
    .string()
    .min(1)
    .max(VALIDATION_BOUNDS.MAX_CITY_QUERY_LEN)
    .transform((val) => sanitizeUserText(val, VALIDATION_BOUNDS.MAX_CITY_QUERY_LEN)),
  language: supportedLanguageSchema.default('en'),
  cpcbNaqi: z.coerce
    .number()
    .min(0)
    .max(STATION_CROSS_CHECK.MAX_AQI_SCALE * 2),
  pm25UgM3: z.coerce
    .number()
    .min(0)
    .max(VALIDATION_BOUNDS.MAX_COMMUTE_KM * VALIDATION_BOUNDS.GEOCODE_RETURN_LIMIT),
  inversionSeverity: z.enum(['neutral', 'moderate-trapping', 'severe-inversion']),
  openWindowsNow: z.boolean(),
  preferredProvider: z.enum(['auto', 'groq']).optional(),
});

export type ChatRequestPayload = z.infer<typeof chatRequestSchema>;

export const aiPlanOutputSchema = z.object({
  headline: z.string().min(1),
  dailyRoutine: z
    .array(
      z.object({
        timeWindow: z.string().min(1),
        actionTitle: z.string().min(1),
        reasonSummary: z.string().min(1),
        estimatedImpactLabel: z.string().min(1),
        exposureTag: z.enum(['indoor', 'commute', 'outdoor', 'ventilation']),
      }),
    )
    .min(VALIDATION_BOUNDS.MIN_ROUTINE_ITEMS)
    .max(VALIDATION_BOUNDS.MAX_ROUTINE_ITEMS),
  indoorHacks: z
    .array(
      z.object({
        tier: z.enum(['zero-cost', 'diy-budget', 'filtration']),
        title: z.string().min(1),
        howTo: z.string().min(1),
        estimatedCostInr: z.coerce.number().min(0),
      }),
    )
    .min(VALIDATION_BOUNDS.MIN_HACK_ITEMS)
    .max(VALIDATION_BOUNDS.MAX_HACK_ITEMS),
  sustainableSwaps: z
    .array(
      z.object({
        fromHabit: z.string().min(1),
        toAlternative: z.string().min(1),
        quantifiedBenefit: z.string().min(1),
      }),
    )
    .min(VALIDATION_BOUNDS.MIN_SWAP_ITEMS)
    .max(VALIDATION_BOUNDS.MAX_SWAP_ITEMS),
  sourceAttributionNote: z.string().min(1),
});

export type AiPlanOutput = z.infer<typeof aiPlanOutputSchema>;
