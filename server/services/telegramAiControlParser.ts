import { GoogleGenAI } from '@google/genai';
import { APP_META, UPSTREAM_ENDPOINTS } from '../../src/config/constants.js';
import type { FamilyMemberInput, FamilyRole } from '../../src/domain/types.js';
import { sanitizeUserText } from '../../src/utils/inputSanitizer.js';
import type { PlanRequestPayload } from '../../src/validators/schemas.js';
import type { ServerEnv } from '../env.js';
import {
  AI_CONTROL_GEMINI_SCHEMA,
  sanitizeAiControlPayload,
  type AiParsedSiteControls,
} from './aiControlValidator.js';
import { withTimeout } from './cacheAndLimiter.js';
import type { ProfileHabitPatch } from './companionDbMapper.js';
import { verifyCustomOption } from './customOptionVerifier.js';
import { getActiveMember, type SyncedWorkspaceRecord } from './householdWorkspaceStore.js';
import { resolveRosterMembershipIntent } from './memberMatcher.js';
import { extractSiteControlPatch } from './naturalSiteControlExtractor.js';
import { searchUrbanLocations } from './telemetryClients.js';

interface GroqJsonPayload {
  readonly choices?: readonly { readonly message?: { readonly content?: string | null } }[];
}

export interface ResolvedFreeformControls {
  readonly targetMember: FamilyMemberInput;
  readonly memberSwitched: boolean;
  readonly addMemberName?: string | undefined;
  readonly removeMember: FamilyMemberInput | null;
  readonly prePatch: ProfileHabitPatch;
  readonly householdPatch: Partial<PlanRequestPayload>;
  readonly aiCityUpdate: {
    readonly city: string;
    readonly lat: number;
    readonly lon: number;
  } | null;
}

const AI_PARSER_TIMEOUT_MS = 4_500;
const MAX_PARSE_INPUT_CHARS = 450;
const ZERO_TEMP = 0;

function buildControlExtractionPrompt(message: string, ws: SyncedWorkspaceRecord): string {
  const active = getActiveMember(ws);
  const roster = ws.payload.members
    .map((m) => `${m.id}: "${m.label}" (role=${m.role}, mask=${m.mask})`)
    .join('; ');
  const safeMsg = sanitizeUserText(message, MAX_PARSE_INPUT_CHARS);
  return [
    'You are PranaPulse AI site-control intent parser. Extract EVERY explicit website setting update from <user_message> as strict JSON.',
    `Household roster: [${roster}]. Currently active member: ${active.id} ("${active.label}"). Current city: ${ws.payload.city}.`,
    'Rules (CRITICAL):',
    '- Users often combine MULTIPLE updates in one message (e.g. mask + commute mode + outdoor hours + role + participating homes + shared transit shift + room area + purifier CADR + timings). Extract ALL of them.',
    '- Return ONLY fields EXPLICITLY stated or requested in <user_message>. Set every unmentioned field to null or omit it. NEVER copy unchanged defaults.',
    '- switchToMemberId: ONLY set to an existing roster id (e.g. "m2") if the user introduces themselves as or asks to switch to that family member (phonetic matches like Mira->Meera allowed). Do NOT set when adding/removing a member.',
    '- addMemberName: ONLY set to the new person name (e.g. "Chris") if the user asks to add/create a new family member. Put that new member attributes (role, mask, dailyOutdoorHours, commuteMode, timings) in the member fields below.',
    '- removeMemberId: ONLY set to an existing roster id if the user explicitly asks to remove/delete that family member.',
    '- label: ONLY set if the user explicitly asks to rename their existing profile.',
    '- role: strictly one of "child" (school student/child/infant/pregnant), "senior-respiratory" (senior/elderly/asthma patient/COPD/heart patient), "commuter" (college/college-going/university student/adult commuter/office worker/runner/delivery), "caregiver" (homemaker/WFH/home caregiver).',
    '- archetype: strictly one of "school-student", "office-commuter", "senior-homebound", "outdoor-active", "home-caregiver".',
    '- mask: strictly one of "none", "cloth", "surgical", "n95-ffp2".',
    '- dailyOutdoorHours: number 0..24 when user mentions hours spent outside/outdoors per day (forgive voice-dictation typos like "outdoor ass/ours he stays is a 6" -> 6, "staying 10 hours approx outside" -> 10).',
    '- leaveHomeTime / returnHomeTime: 24-hour "HH:MM" strings (e.g. "10:20", "23:41").',
    '- commuteMode: strictly one of "metro", "electric-bus", "ev-car", "petrol-car", "two-wheeler", "cycling", "walking".',
    '- areaM2 (4..500), cadrM3Hr (0..2500), tightness ("leaky"|"standard"|"weather-sealed"), cookingFuel ("induction"|"lpg-vented"|"lpg-unvented"|"solid-biomass").',
    '- commuteDistanceKm (1..150), householdsParticipating (1..5000, e.g. "participating homes approx 200" -> 200), transitShiftShare (0..1 fraction, e.g. "shared transit shift around 60%" -> 0.6), haltLeafBurning (boolean), language ("en"|"hi"|"ta").',
    '- cityQuery: ONLY set if the user explicitly states they are currently in or want to switch city to a real geographic place name.',
    `<user_message>${safeMsg}</user_message>`,
  ].join('\n');
}

function parseJsonObject(rawText: string | undefined | null): Record<string, unknown> | null {
  if (!rawText) {
    return null;
  }
  const cleaned = rawText
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/```$/i, '')
    .trim();
  try {
    const parsed: unknown = JSON.parse(cleaned);
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

async function tryGeminiControlParse(
  prompt: string,
  env: ServerEnv,
): Promise<Record<string, unknown> | null> {
  if (!env.GEMINI_API_KEY) {
    return null;
  }
  const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
  const models = [...new Set<string>([...APP_META.GEMINI_FALLBACK_MODELS, env.GEMINI_MODEL])];
  for (const model of models) {
    try {
      const resp = await withTimeout(
        ai.models.generateContent({
          model,
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            responseSchema: AI_CONTROL_GEMINI_SCHEMA,
            temperature: ZERO_TEMP,
          },
        }),
        AI_PARSER_TIMEOUT_MS,
      );
      const parsed = parseJsonObject(resp.text);
      if (parsed) {
        return parsed;
      }
    } catch {
      // Try next Gemini model in cascade.
    }
  }
  return null;
}

async function invokeGroqJsonOnce(
  apiKey: string,
  model: string,
  prompt: string,
): Promise<Record<string, unknown> | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, AI_PARSER_TIMEOUT_MS);
  try {
    const resp = await fetch(UPSTREAM_ENDPOINTS.GROQ_CHAT_COMPLETIONS, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        temperature: ZERO_TEMP,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: 'Return ONLY a single valid JSON object matching the schema.',
          },
          { role: 'user', content: prompt },
        ],
      }),
      signal: controller.signal,
    });
    if (!resp.ok) {
      return null;
    }
    const json = (await resp.json()) as GroqJsonPayload;
    return parseJsonObject(json.choices?.[0]?.message?.content);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function tryGroqControlParse(
  prompt: string,
  env: ServerEnv,
): Promise<Record<string, unknown> | null> {
  if (!env.GROQ_API_KEY) {
    return null;
  }
  const models = [...new Set<string>([env.GROQ_MODEL, ...APP_META.GROQ_FALLBACK_MODELS])];
  for (const model of models) {
    const parsed = await invokeGroqJsonOnce(env.GROQ_API_KEY, model, prompt);
    if (parsed) {
      return parsed;
    }
  }
  return null;
}

/** Uses Gemini structured JSON (with Groq JSON fallback) to extract multi-intent website controls. */
export async function parseTelegramSiteControlsWithAi(
  message: string,
  workspace: SyncedWorkspaceRecord,
  env: ServerEnv,
): Promise<AiParsedSiteControls | null> {
  if (!env.GEMINI_API_KEY && !env.GROQ_API_KEY) {
    return null;
  }
  const prompt = buildControlExtractionPrompt(message, workspace);
  const raw =
    (await tryGeminiControlParse(prompt, env)) ?? (await tryGroqControlParse(prompt, env));
  return raw ? sanitizeAiControlPayload(raw, workspace) : null;
}

async function resolveVerifiedCustomRole(
  candidate: string | undefined,
  workspace: SyncedWorkspaceRecord,
  env: ServerEnv,
): Promise<FamilyRole | undefined> {
  if (!candidate) {
    return undefined;
  }
  const verified = await verifyCustomOption(
    { category: 'role', customText: candidate, language: workspace.payload.language },
    env,
  );
  return verified.isValid ? (verified.mappedValue as FamilyRole) : undefined;
}

async function resolveAiCityQuery(
  cityQuery: string | undefined,
  currentCity: string,
): Promise<{ readonly city: string; readonly lat: number; readonly lon: number } | null> {
  if (!cityQuery || cityQuery.toLowerCase() === currentCity.toLowerCase()) {
    return null;
  }
  const top = (await searchUrbanLocations(cityQuery))[0];
  return top ? { city: top.name, lat: top.lat, lon: top.lon } : null;
}

function mergeControlPatches(
  detSite: ReturnType<typeof extractSiteControlPatch>,
  aiControls: AiParsedSiteControls | null,
  verifiedRole: FamilyRole | undefined,
): Pick<ResolvedFreeformControls, 'prePatch' | 'householdPatch'> {
  return {
    prePatch: {
      ...(aiControls?.memberPatch ?? {}),
      ...detSite.memberPatch,
      ...(verifiedRole ? { role: verifiedRole } : {}),
    },
    householdPatch: { ...(aiControls?.householdPatch ?? {}), ...detSite.householdPatch },
  };
}

/** Combines Gemini/Groq multi-intent AI parsing with deterministic regex extraction for full-site control. */
export async function resolveFullSiteControls(
  promptText: string,
  workspace: SyncedWorkspaceRecord,
  env: ServerEnv,
): Promise<ResolvedFreeformControls> {
  const detSite = extractSiteControlPatch(promptText);
  const aiControls = await parseTelegramSiteControlsWithAi(promptText, workspace, env);
  const roster = resolveRosterMembershipIntent({
    promptText,
    members: workspace.payload.members,
    activeMember: getActiveMember(workspace),
    aiAddName: aiControls?.addMemberName,
    aiRemoveId: aiControls?.removeMemberId,
    aiSwitchId: aiControls?.switchToMemberId,
  });
  const hasRole = Boolean(detSite.memberPatch.role ?? aiControls?.memberPatch.role);
  const verifiedRole = hasRole
    ? undefined
    : await resolveVerifiedCustomRole(detSite.customRoleCandidate, workspace, env);
  const { prePatch, householdPatch } = mergeControlPatches(detSite, aiControls, verifiedRole);
  const aiCityUpdate = await resolveAiCityQuery(aiControls?.cityQuery, workspace.payload.city);
  return { ...roster, prePatch, householdPatch, aiCityUpdate };
}
