import { VALIDATION_BOUNDS } from '../../src/config/constants.js';
import type {
  BuildingTightness,
  CookingFuelType,
  FamilyRole,
  MemberRoutineArchetype,
} from '../../src/domain/types.js';
import { sanitizeUserText } from '../../src/utils/inputSanitizer.js';
import type { PlanRequestPayload, SupportedLanguage } from '../../src/validators/schemas.js';
import type { ProfileHabitPatch } from './companionDbMapper.js';
import { RENAME_MEMBER_RE } from './memberMatcher.js';

export interface SiteControlPatch {
  readonly memberPatch: ProfileHabitPatch;
  readonly householdPatch: Partial<PlanRequestPayload>;
  readonly customRoleCandidate?: string | undefined;
}

const HALF_HOUR_STEP = 2;
const MAX_LABEL_LEN = 40;
const MAX_CUSTOM_ROLE_LEN = 36;
const MAX_CONTROL_INPUT_LEN = 500;

const ROLE_RULES: readonly {
  readonly re: RegExp;
  readonly role: FamilyRole;
  readonly archetype: MemberRoutineArchetype;
}[] = [
  {
    re: /\b(?:college(?:[- ]going)?|university|undergrad\w*|grad(?:uate)?|engineering|medical|law|mba|b\.?tech|b\.?sc|b\.?a\.?)\s+student\b|\bin\s+college\b|\bcollege(?:[- ]going|\s+goer)\b/i,
    role: 'commuter',
    archetype: 'office-commuter',
  },
  {
    re: /\b(?:school\s+(?:student|kid|child|boy|girl)|pregnant|expecting\s+mother|infant|toddler|newborn|teen(?:ager)?|(?:i(?:'m|\s+am)\s+(?:a\s+)?|(?:profile|role)\s*(?:to|is|as|:)?\s*)child)\b/i,
    role: 'child',
    archetype: 'school-student',
  },
  {
    re: /\b(?:senior(?:\s+citizen)?|elder(?:ly)?|grandparent|grandfather|grandmother|retired|copd(?:\s+patient)?|asthma\s+patient|respiratory\s+(?:patient|profile)|lung\s+patient|heart\s+patient|(?:vulnerability|health|member)?\s*(?:profile|role)\s*(?:to|is|as|:)?\s*(?:senior|copd|asthma|respiratory))\b/i,
    role: 'senior-respiratory',
    archetype: 'senior-homebound',
  },
  {
    re: /\b(?:runner|jogger|athlete|marathon\w*|cyclist|outdoor\s+active|fitness\s+enthusiast)\b/i,
    role: 'commuter',
    archetype: 'outdoor-active',
  },
  {
    re: /\b(?:office\s+(?:worker|commuter|goer)|adult\s+(?:outdoor\s+)?commuter|working\s+professional|daily\s+commuter|commuter|delivery\s+(?:rider|driver|partner)|field\s+worker|outdoor\s+worker)\b/i,
    role: 'commuter',
    archetype: 'office-commuter',
  },
  {
    re: /\b(?:homemaker|housewife|home\s+caregiver|caregiver|work(?:ing)?\s+from\s+home|wfh|remote\s+worker|stay[- ]at[- ]home)\b/i,
    role: 'caregiver',
    archetype: 'home-caregiver',
  },
];

const EXPLICIT_ROLE_RE =
  /(?:vulnerability\s+profile|health\s+profile|my\s+profile|my\s+role)\s*(?:to|is|as|:)\s*([A-Za-z][A-Za-z0-9\s/-]{2,36}?)(?=[.,!?]|$|\s+and\b)/i;
const OUTDOOR_HRS_RE =
  /(?:outdoor\s+(?:hours?|hrs?|time|\S+\s+(?:he|she|they|i)\s+(?:stays?|spends?))[^0-9]{0,18}(\d+(?:\.\d+)?)|(?:spend\w*|stay\w*|outside|outdoors)\s+(?:for\s+)?(?:approx\.?\s+|about\s+|around\s+|roughly\s+)?(\d+(?:\.\d+)?)\s*(?:hrs?|hours?)(?:\s*(?:approx\.?|approximately|about|around|a\s+day|per\s+day|daily))*\s*(?:outside|outdoors)?)/i;
const HOURS_BEFORE_OUTSIDE_RE =
  /\b(\d+(?:\.\d+)?)\s*(?:hrs?|hours?)(?:\s*(?:approx\.?|approximately|about|around|a\s+day|per\s+day|daily))*\s*(?:outside|outdoors)\b/i;
const OUTDOOR_WORD_RE = /\b(?:outdoor|outdoors|outside)\b/i;
const ROOM_AREA_RE =
  /\b(\d+(?:\.\d+)?)\s*(?:sqm|sq\.?\s*m|m2|m²|square\s+meters?)\b|\broom\s+(?:area|size)(?:\s+(?:is|to|of)|:)?\s+(\d+(?:\.\d+)?)\b/i;
const CADR_RE = /(?:purifier\s+)?cadr\s*(?:is|to|of|:)?\s*(\d+)|\b(\d+)\s*(?:m3\/h|m3\/hr|cmh)\b/i;
const NO_PURIFIER_RE = /\bno\s+(?:air\s+)?purifier\b/i;
const DISTANCE_RE =
  /(?:commute|travel|trip|office|college|school)\s+(?:distance\s+)?(?:is\s+|of\s+|to\s+)?(\d+(?:\.\d+)?)\s*km\b|\bdistance\s*(?:is|to|of|:)?\s*(\d+(?:\.\d+)?)\s*km\b/i;
const RWA_HOMES_RE =
  /(?:participating\s+(?:homes|households|flats|ones)|rwa\s+homes?)[^0-9]{0,40}(\d+)\b|\b(\d+)\s*(?:participating\s+)?(?:homes|households|flats|apartments)\b/i;
const TRANSIT_SHIFT_RE =
  /(?:shared\s+)?(?:transit|carpool)\s+shift[^0-9]{0,24}(\d{1,3})\s*(?:%|percent)?/i;
const LANG_RE =
  /(?:switch|change|set|reply|speak|talk)\s+(?:language\s+)?(?:to|in)\s+(hindi|tamil|english)\b/i;

const LANG_MAP: Readonly<Record<string, SupportedLanguage>> = {
  hindi: 'hi',
  tamil: 'ta',
  english: 'en',
};

export { ROLE_DISPLAY_NAMES } from './memberMatcher.js';

function clampInt(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(val)));
}

function parseMatchedFloat(match: RegExpExecArray | null): number | null {
  const raw = match?.[1] ?? match?.[2];
  if (!raw) {
    return null;
  }
  const n = Number.parseFloat(raw);
  return Number.isFinite(n) ? n : null;
}

function extractTightness(lower: string): BuildingTightness | undefined {
  if (
    /\b(?:weather[- ]?sealed|upvc|double[- ]?glazed|airtight\s+windows?|ac[- ]?sealed)\b/.test(
      lower,
    )
  ) {
    return 'weather-sealed';
  }
  if (/\b(?:leaky\s+windows?|drafty\s+(?:room|windows?)|old\s+wooden\s+windows?)\b/.test(lower)) {
    return 'leaky';
  }
  return /\bstandard\s+(?:windows?|apartment|sealing)\b/.test(lower) ? 'standard' : undefined;
}

function extractCookingFuel(lower: string): CookingFuelType | undefined {
  if (/\b(?:induction(?:\s+stove)?|electric\s+(?:stove|cooking))\b/.test(lower)) {
    return 'induction';
  }
  if (/\b(?:vented\s+lpg|lpg\s+with\s+(?:chimney|exhaust)|piped\s+png|png\s+gas)\b/.test(lower)) {
    return 'lpg-vented';
  }
  if (/\b(?:unvented\s+(?:lpg|gas)|lpg\s+without\s+chimney)\b/.test(lower)) {
    return 'lpg-unvented';
  }
  return /\b(?:biomass|wood\s+stove|chulha|coal\s+stove|solid\s+fuel)\b/.test(lower)
    ? 'solid-biomass'
    : undefined;
}

function extractLeafBurningFlag(lower: string): boolean | undefined {
  if (/\b(?:halt|stop|ban)\s+(?:open\s+)?(?:leaf|biomass)\s+burning\b/.test(lower)) {
    return true;
  }
  return /\b(?:allow|resume|disable\s+halt)\s+(?:open\s+)?(?:leaf|biomass)\s+burning\b/.test(lower)
    ? false
    : undefined;
}

function extractIndoorPatch(lower: string): Partial<PlanRequestPayload> {
  const area = parseMatchedFloat(ROOM_AREA_RE.exec(lower));
  const cadr = NO_PURIFIER_RE.test(lower) ? 0 : parseMatchedFloat(CADR_RE.exec(lower));
  const tightness = extractTightness(lower);
  const cookingFuel = extractCookingFuel(lower);
  return {
    ...(area !== null
      ? {
          areaM2: clampInt(
            area,
            VALIDATION_BOUNDS.MIN_ROOM_AREA_M2,
            VALIDATION_BOUNDS.MAX_ROOM_AREA_M2,
          ),
        }
      : {}),
    ...(cadr !== null ? { cadrM3Hr: clampInt(cadr, 0, VALIDATION_BOUNDS.MAX_CADR_M3_HR) } : {}),
    ...(tightness ? { tightness } : {}),
    ...(cookingFuel ? { cookingFuel } : {}),
  };
}

function parseLanguageChange(lower: string): SupportedLanguage | undefined {
  const langKey = LANG_RE.exec(lower)?.[1]?.toLowerCase() ?? '';
  return Object.hasOwn(LANG_MAP, langKey) ? LANG_MAP[langKey] : undefined;
}

function extractCommunityPatch(lower: string): Partial<PlanRequestPayload> {
  const km = parseMatchedFloat(DISTANCE_RE.exec(lower));
  const homes = parseMatchedFloat(RWA_HOMES_RE.exec(lower));
  const shift = parseMatchedFloat(TRANSIT_SHIFT_RE.exec(lower));
  const haltLeafBurning = extractLeafBurningFlag(lower);
  const language = parseLanguageChange(lower);
  return {
    ...(km !== null
      ? { commuteDistanceKm: clampInt(km, 1, VALIDATION_BOUNDS.MAX_COMMUTE_KM) }
      : {}),
    ...(homes !== null
      ? {
          householdsParticipating: clampInt(
            homes,
            VALIDATION_BOUNDS.MIN_HOUSEHOLDS,
            VALIDATION_BOUNDS.MAX_HOUSEHOLDS,
          ),
        }
      : {}),
    ...(shift !== null ? { transitShiftShare: clampInt(shift, 0, 100) / 100 } : {}),
    ...(haltLeafBurning !== undefined ? { haltLeafBurning } : {}),
    ...(language ? { language } : {}),
  };
}

function parseOutdoorHours(message: string): number | undefined {
  if (!OUTDOOR_WORD_RE.test(message)) {
    return undefined;
  }
  const hrs =
    parseMatchedFloat(HOURS_BEFORE_OUTSIDE_RE.exec(message)) ??
    parseMatchedFloat(OUTDOOR_HRS_RE.exec(message));
  if (hrs === null) {
    return undefined;
  }
  const snapped = Math.round(hrs * HALF_HOUR_STEP) / HALF_HOUR_STEP;
  return Math.max(0, Math.min(VALIDATION_BOUNDS.MAX_DAILY_HOURS, snapped));
}

function extractCustomRoleCandidate(message: string, hasMatchedRole: boolean): string | undefined {
  if (hasMatchedRole) {
    return undefined;
  }
  const match = EXPLICIT_ROLE_RE.exec(message);
  return match?.[1] ? sanitizeUserText(match[1], MAX_CUSTOM_ROLE_LEN) : undefined;
}

function extractMemberPatch(message: string): {
  readonly memberPatch: ProfileHabitPatch;
  readonly customRoleCandidate?: string | undefined;
} {
  const matchedRule = ROLE_RULES.find((r) => r.re.test(message));
  const customRoleCandidate = extractCustomRoleCandidate(message, Boolean(matchedRule));
  const renameMatch = RENAME_MEMBER_RE.exec(message);
  const label = renameMatch?.[1] ? sanitizeUserText(renameMatch[1], MAX_LABEL_LEN) : undefined;
  const dailyOutdoorHours = parseOutdoorHours(message);
  return {
    memberPatch: {
      ...(label ? { label } : {}),
      ...(matchedRule ? { role: matchedRule.role, archetype: matchedRule.archetype } : {}),
      ...(dailyOutdoorHours !== undefined ? { dailyOutdoorHours } : {}),
    },
    ...(customRoleCandidate ? { customRoleCandidate } : {}),
  };
}

/** Extracts full-site member & household configuration changes from natural Telegram chat. */
export function extractSiteControlPatch(message: string): SiteControlPatch {
  const safeMessage = sanitizeUserText(message, MAX_CONTROL_INPUT_LEN);
  const lower = safeMessage.toLowerCase();
  const { memberPatch, customRoleCandidate } = extractMemberPatch(safeMessage);
  const householdPatch: Partial<PlanRequestPayload> = {
    ...extractIndoorPatch(lower),
    ...extractCommunityPatch(lower),
  };
  return { memberPatch, householdPatch, ...(customRoleCandidate ? { customRoleCandidate } : {}) };
}

function keepStrings(items: readonly (string | false | undefined)[]): string[] {
  return items.filter((v): v is string => typeof v === 'string');
}

function summarizeIndoorNotes(p: Partial<PlanRequestPayload>): string[] {
  return keepStrings([
    p.areaM2 !== undefined && `Room ${String(p.areaM2)} m2`,
    p.cadrM3Hr !== undefined && `CADR ${String(p.cadrM3Hr)}`,
    p.tightness && `Windows ${p.tightness}`,
    p.cookingFuel && `Fuel ${p.cookingFuel}`,
  ]);
}

function summarizeCommunityNotes(p: Partial<PlanRequestPayload>): string[] {
  return keepStrings([
    p.commuteDistanceKm !== undefined && `Commute ${String(p.commuteDistanceKm)} km`,
    p.householdsParticipating !== undefined && `RWA ${String(p.householdsParticipating)} homes`,
    p.transitShiftShare !== undefined &&
      `Transit ${String(Math.round(p.transitShiftShare * 100))}%`,
    p.haltLeafBurning !== undefined && `Leaf burning ${p.haltLeafBurning ? 'halted' : 'allowed'}`,
    p.language && `Lang ${p.language.toUpperCase()}`,
  ]);
}

/** Formats human-readable household change labels for Telegram's website-sync footer. */
export function summarizeHouseholdChanges(patch: Partial<PlanRequestPayload>): string[] {
  return [...summarizeIndoorNotes(patch), ...summarizeCommunityNotes(patch)];
}
