import { Type, type Schema } from '@google/genai';
import type { DeterministicBriefContext } from './fallbackPlan.js';

export const PLAN_RESPONSE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    headline: { type: Type.STRING },
    dailyRoutine: {
      type: Type.ARRAY,
      minItems: '4',
      maxItems: '6',
      items: {
        type: Type.OBJECT,
        properties: {
          timeWindow: { type: Type.STRING },
          actionTitle: { type: Type.STRING },
          reasonSummary: { type: Type.STRING },
          estimatedImpactLabel: { type: Type.STRING },
          exposureTag: {
            type: Type.STRING,
            enum: ['indoor', 'commute', 'outdoor', 'ventilation'],
          },
        },
        required: [
          'timeWindow',
          'actionTitle',
          'reasonSummary',
          'estimatedImpactLabel',
          'exposureTag',
        ],
      },
    },
    indoorHacks: {
      type: Type.ARRAY,
      minItems: '3',
      maxItems: '4',
      items: {
        type: Type.OBJECT,
        properties: {
          tier: { type: Type.STRING, enum: ['zero-cost', 'diy-budget', 'filtration'] },
          title: { type: Type.STRING },
          howTo: { type: Type.STRING },
          estimatedCostInr: { type: Type.NUMBER },
        },
        required: ['tier', 'title', 'howTo', 'estimatedCostInr'],
      },
    },
    sustainableSwaps: {
      type: Type.ARRAY,
      minItems: '2',
      maxItems: '4',
      items: {
        type: Type.OBJECT,
        properties: {
          fromHabit: { type: Type.STRING },
          toAlternative: { type: Type.STRING },
          quantifiedBenefit: { type: Type.STRING },
        },
        required: ['fromHabit', 'toAlternative', 'quantifiedBenefit'],
      },
    },
    sourceAttributionNote: { type: Type.STRING },
  },
  required: [
    'headline',
    'dailyRoutine',
    'indoorHacks',
    'sustainableSwaps',
    'sourceAttributionNote',
  ],
};

function resolveLanguageRule(lang: DeterministicBriefContext['request']['language']): string {
  if (lang === 'hi') {
    return 'Write EVERY string value (headline, timeWindow, actionTitle, reasonSummary, estimatedImpactLabel, indoorHacks title/howTo, sustainableSwaps fromHabit/toAlternative/quantifiedBenefit, sourceAttributionNote) 100% in Hindi (Devanagari script). Do not output English sentences.';
  }
  if (lang === 'ta') {
    return 'Write EVERY string value (headline, timeWindow, actionTitle, reasonSummary, estimatedImpactLabel, indoorHacks title/howTo, sustainableSwaps fromHabit/toAlternative/quantifiedBenefit, sourceAttributionNote) 100% in Tamil script. Do not output English sentences.';
  }
  return 'Write all string values clearly in English.';
}

/**
 * Formats verified atmospheric physics values and sanitized preferences inside XML boundaries.
 */
export function buildStructuredPrompt(ctx: DeterministicBriefContext): string {
  const familyRoles = ctx.request.members.map((m) => `${m.role}(${m.mask})`).join(', ');
  return [
    'You are PranaPulse AI, a public-health urban air quality planner.',
    `Respond STRICTLY in language code "${ctx.request.language}". ${resolveLanguageRule(ctx.request.language)}`,
    'Return 4 dailyRoutine steps, 3 indoorHacks items (zero-cost, diy-budget, filtration), and 2 sustainableSwaps items.',
    'Follow the verified numbers inside <verified_physics_telemetry> exactly. When quoting any AQI/NAQI score, use effectiveSafetyAQI or cpcbNAQI.',
    '<verified_physics_telemetry>',
    `city=${ctx.request.city}; effectiveSafetyAQI=${String(ctx.effectiveAqi)}; cpcbNAQI=${String(ctx.aqi.cpcbNaqi)} (${ctx.aqi.cpcbCategory}); usEPA=${String(ctx.aqi.usEpaAqi)}`,
    `pblMeters=${String(ctx.inversion.currentPblMeters)}; inversion=${ctx.inversion.currentSeverity}; openWindowsNow=${String(ctx.inversion.openWindowsNow)}`,
    `bestWindowHours=${ctx.inversion.bestWindowHours.join(',')}; avoidHours=${ctx.inversion.avoidOutdoorHours.join(',')}`,
    `indoorRequiredCADR=${String(ctx.indoor.requiredCadr48Ach)}; purge90Minutes=${String(ctx.indoor.purge90Minutes)}; indoorReductionPct=${String(ctx.indoor.exposureReductionPct)}%`,
    `recommendedCommute=${ctx.bestCommute.mode} (${String(ctx.bestCommute.personalInhaledUg)}ug, ${String(ctx.bestCommute.communityCo2Grams)}g CO2); corridorSaved=${String(ctx.corridor.exposureSavedPct)}%`,
    `rwaCollectiveDailyCo2SavedKg=${String(ctx.rwa.dailyCo2SavedKg)}; rwaPm25AvoidedG=${String(ctx.rwa.dailyPm25AvoidedG)}`,
    '</verified_physics_telemetry>',
    '<user_preferences>',
    `familyMembers=${familyRoles}; fuel=${ctx.request.cookingFuel}; tightness=${ctx.request.tightness}; commute=${ctx.request.commuteMode} ${String(ctx.request.commuteDistanceKm)}km`,
    '</user_preferences>',
  ].join('\n');
}
