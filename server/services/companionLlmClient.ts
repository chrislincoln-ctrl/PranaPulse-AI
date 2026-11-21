import { GoogleGenAI } from '@google/genai';
import {
  APP_META,
  SECURITY_LIMITS,
  UPSTREAM_ENDPOINTS,
  VALIDATION_BOUNDS,
} from '../../src/config/constants.js';
import { resolveMemberArchetype } from '../../src/domain/memberScheduleBuilder.js';
import type { FamilyMemberInput, MemberDailySchedule } from '../../src/domain/types.js';
import type { SupportedLanguage } from '../../src/validators/schemas.js';
import type { ServerEnv } from '../env.js';
import { withTimeout } from './cacheAndLimiter.js';
import type { ProfileHabitPatch } from './companionDbMapper.js';
import { hasHabitPatch } from './habitExtractor.js';
import type { TelemetryBundle } from './telemetryClients.js';

export interface CompanionReplyContext {
  readonly member: FamilyMemberInput;
  readonly message: string;
  readonly language: SupportedLanguage;
  readonly city: string;
  readonly telemetry: TelemetryBundle;
  readonly habitPatch: ProfileHabitPatch;
  readonly updatedSchedule: MemberDailySchedule;
}

interface GroqChatPayload {
  readonly choices?: readonly { readonly message?: { readonly content?: string | null } }[];
}

const INDOOR_NIGHT_RE =
  /\b(inside|indoors|in my home|at home|bedroom|room|closed|sealed|night|tonight|sleeping|sleep|bed)\b/i;
const SYMPTOM_RE =
  /\b(asthma|wheez\w*|inhaler|cough\w*|breathless\w*|throat|headache|eyes|symptom|chest)\b/i;
const WINDOW_RE = /\b(window\w*|ventilat\w*|balcony|terrace|open|air out)\b/i;

const DEFAULT_CLEAN_HOUR = 13;

function formatCleanHours(hours: readonly number[]): string {
  if (hours.length === 0) {
    return '13:00 - 15:00';
  }
  const first = hours[0] ?? DEFAULT_CLEAN_HOUR;
  const last = hours[hours.length - 1] ?? first;
  return `${String(first).padStart(2, '0')}:00 - ${String(last).padStart(2, '0')}:59`;
}

function buildIndoorNightReply(ctx: CompanionReplyContext): string {
  const { member, city, telemetry } = ctx;
  const aqi = telemetry.stationCrossCheck.effectiveSafetyAqi;
  const pm25 = Math.round(telemetry.currentPollutants.pm25UgM3);
  const pbl = telemetry.inversion.currentPblMeters;
  const cleanWin = formatCleanHours(telemetry.inversion.bestWindowHours);
  return (
    `You're doing the right thing staying indoors with doors and windows closed in ${city}, ${member.label}. ` +
    `Right now the boundary layer ceiling is only ${String(pbl)}m (CPCB NAQI ${String(aqi)}, outdoor PM2.5 ${String(pm25)} ug/m3), ` +
    `which traps surface pollutants outside overnight. Keep the room sealed, run your HEPA purifier on quiet/medium mode if available, ` +
    `and wait until tomorrow's solar breakup window (${cleanWin}) before airing out the house.`
  );
}

function buildSymptomReply(ctx: CompanionReplyContext): string {
  const { member, city, telemetry } = ctx;
  const aqi = telemetry.stationCrossCheck.effectiveSafetyAqi;
  const pm25 = Math.round(telemetry.currentPollutants.pm25UgM3);
  const pbl = telemetry.inversion.currentPblMeters;
  return (
    `Please take it easy indoors in ${city}, ${member.label}. Outdoor CPCB NAQI is ${String(aqi)} ` +
    `with ${String(pm25)} ug/m3 PM2.5 under a ${String(pbl)}m mixing layer. Keep windows shut, run indoor HEPA filtration, ` +
    `avoid any outdoor exertion or smoky kitchen fumes, and keep your reliever inhaler or prescribed medication handy.`
  );
}

function buildWindowReply(ctx: CompanionReplyContext): string {
  const { member, city, telemetry } = ctx;
  const aqi = telemetry.stationCrossCheck.effectiveSafetyAqi;
  const pbl = telemetry.inversion.currentPblMeters;
  const cleanWin = formatCleanHours(telemetry.inversion.bestWindowHours);
  if (telemetry.inversion.openWindowsNow) {
    return (
      `Yes, ${member.label} — in ${city} (NAQI ${String(aqi)}, PBL ${String(pbl)}m), atmospheric dispersion is open right now. ` +
      `You can cross-ventilate for about 15-20 minutes to clear indoor CO2, then close windows again before evening trapping.`
    );
  }
  return (
    `Hold off on opening windows right now in ${city}, ${member.label}. The mixing layer is shallow (${String(pbl)}m, NAQI ${String(aqi)}), ` +
    `so outdoor smog will infiltrate indoors. The safest ventilation window is ${cleanWin} when solar heating lifts the boundary layer.`
  );
}

function buildGeneralReply(ctx: CompanionReplyContext): string {
  const { member, city, telemetry } = ctx;
  const aqi = telemetry.stationCrossCheck.effectiveSafetyAqi;
  const cur = telemetry.hourlySeries[0];
  const pm25 = Math.round(telemetry.currentPollutants.pm25UgM3);
  const pbl = telemetry.inversion.currentPblMeters;
  const wind = Math.round(cur?.windKmh ?? 0);
  const rh = Math.round(cur?.rhPercent ?? 0);
  const cleanWin = formatCleanHours(telemetry.inversion.bestWindowHours);
  const maskTip =
    member.role === 'senior-respiratory'
      ? 'Keep outdoor time brief and carry your inhaler.'
      : `Use your ${member.mask} mask if stepping out into traffic.`;

  return (
    `For ${member.label} in ${city}: live CPCB NAQI is ${String(aqi)} (${telemetry.assessment.cpcbCategory}) ` +
    `with PM2.5 at ${String(pm25)} ug/m3, PBL ceiling ${String(pbl)}m, wind ${String(wind)} km/h, and humidity ${String(rh)}%. ` +
    `${maskTip} Best low-exposure window today is ${cleanWin}.`
  );
}

/** Builds a context-sensitive conversational reply when live LLM APIs are offline or in tests. */
export function buildContextAwareCompanionReply(ctx: CompanionReplyContext): string {
  const { member, message, habitPatch } = ctx;
  const updateSuffix = hasHabitPatch(habitPatch)
    ? ` I have also updated ${member.label}'s daily schedule with your latest routine details.`
    : '';
  let body = buildGeneralReply(ctx);
  if (SYMPTOM_RE.test(message)) {
    body = buildSymptomReply(ctx);
  } else if (INDOOR_NIGHT_RE.test(message)) {
    body = buildIndoorNightReply(ctx);
  } else if (WINDOW_RE.test(message)) {
    body = buildWindowReply(ctx);
  }
  return `${body}${updateSuffix}`;
}

function buildCompanionPrompt(ctx: CompanionReplyContext): string {
  const { member, message, language, city, telemetry, habitPatch, updatedSchedule } = ctx;
  const cur = telemetry.hourlySeries[0];
  const aqi = telemetry.stationCrossCheck.effectiveSafetyAqi;
  const cleanWin = formatCleanHours(telemetry.inversion.bestWindowHours);
  const stepsText = updatedSchedule.dailyRoutine
    .map((s) => `${s.timeWindow}: ${s.actionTitle}`)
    .join(' | ');

  return [
    `You are PranaPulse Family Companion chatting directly with ${member.label} (role=${member.role}, archetype=${resolveMemberArchetype(member)}, mask=${member.mask}).`,
    `Member health notes: ${member.healthNotes ?? 'none'}. Member daily habits: ${member.dailyHabitsNote ?? 'none'}.`,
    `Verified live telemetry for ${city}: CPCB_NAQI=${String(aqi)} (${telemetry.assessment.cpcbCategory}), PM2.5=${String(Math.round(telemetry.currentPollutants.pm25UgM3))} ug/m3, PBL_height=${String(telemetry.inversion.currentPblMeters)}m, inversion=${telemetry.inversion.currentSeverity}, wind=${String(Math.round(cur?.windKmh ?? 0))} km/h, humidity=${String(Math.round(cur?.rhPercent ?? 0))}%, openWindowsNow=${String(telemetry.inversion.openWindowsNow)}, bestVentilationWindow=${cleanWin}.`,
    `Member's personalized schedule today: ${stepsText}.`,
    `Schedule updated from this message: ${String(hasHabitPatch(habitPatch))}.`,
    `User message from ${member.label}: "${message}"`,
    `Instructions: Respond warmly and conversationally in language "${language}" (60-110 words). Directly acknowledge their exact situation (e.g. if they are indoors at night with doors/windows closed, affirm that and give indoor comfort/purifier/sleep advice rather than telling them to wear a mask in transit!). Weave in 2-3 relevant live numbers from the verified telemetry above. Do not use markdown headings or bullet lists.`,
  ].join('\n');
}

async function tryGeminiCascade(prompt: string, env: ServerEnv): Promise<string | null> {
  if (!env.GEMINI_API_KEY) {
    return null;
  }
  const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
  const models = [...new Set<string>([...APP_META.GEMINI_FALLBACK_MODELS, env.GEMINI_MODEL])];
  for (const model of models) {
    try {
      const response = await withTimeout(
        ai.models.generateContent({
          model,
          contents: prompt,
          config: { temperature: VALIDATION_BOUNDS.GEMINI_TEMPERATURE },
        }),
        SECURITY_LIMITS.UPSTREAM_TIMEOUT_MS,
      );
      const text = response.text?.trim();
      if (text && text.length > 0) {
        return text;
      }
    } catch {
      // Try next Gemini model in cascade.
    }
  }
  return null;
}

async function invokeGroqModelOnce(
  apiKey: string,
  model: string,
  prompt: string,
): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, SECURITY_LIMITS.UPSTREAM_TIMEOUT_MS);
  try {
    const resp = await fetch(UPSTREAM_ENDPOINTS.GROQ_CHAT_COMPLETIONS, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        temperature: VALIDATION_BOUNDS.GEMINI_TEMPERATURE,
        messages: [
          {
            role: 'system',
            content:
              'You are PranaPulse Family Companion, a warm, scientifically grounded household air-quality and health companion.',
          },
          { role: 'user', content: prompt },
        ],
      }),
      signal: controller.signal,
    });
    if (!resp.ok) {
      return null;
    }
    const json = (await resp.json()) as GroqChatPayload;
    return json.choices?.[0]?.message?.content?.trim() ?? null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function tryGroqCascade(prompt: string, env: ServerEnv): Promise<string | null> {
  if (!env.GROQ_API_KEY) {
    return null;
  }
  const models = [...new Set<string>([env.GROQ_MODEL, ...APP_META.GROQ_FALLBACK_MODELS])];
  for (const model of models) {
    const text = await invokeGroqModelOnce(env.GROQ_API_KEY, model, prompt);
    if (text && text.length > 0) {
      return text;
    }
  }
  return null;
}

/** Generates a conversational companion reply using Gemini cascade -> Groq cascade -> context-aware fallback. */
export async function generateCompanionReply(
  ctx: CompanionReplyContext,
  env: ServerEnv,
): Promise<{ readonly reply: string; readonly aiEnhanced: boolean }> {
  const prompt = buildCompanionPrompt(ctx);
  const geminiText = await tryGeminiCascade(prompt, env);
  if (geminiText) {
    return { reply: geminiText, aiEnhanced: true };
  }
  const groqText = await tryGroqCascade(prompt, env);
  if (groqText) {
    return { reply: groqText, aiEnhanced: true };
  }
  return { reply: buildContextAwareCompanionReply(ctx), aiEnhanced: false };
}
