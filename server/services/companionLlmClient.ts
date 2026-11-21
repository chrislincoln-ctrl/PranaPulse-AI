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

function firstNameOf(label: string): string {
  const head = label.split('(')[0]?.trim();
  return head && head.length > 0 ? head : label;
}

function buildIndoorNightReply(ctx: CompanionReplyContext): string {
  const { member, city, telemetry } = ctx;
  const name = firstNameOf(member.label);
  const aqi = telemetry.stationCrossCheck.effectiveSafetyAqi;
  const pbl = telemetry.inversion.currentPblMeters;
  const cleanWin = formatCleanHours(telemetry.inversion.bestWindowHours);
  return (
    `Hi ${name}! You're doing the right thing staying indoors with windows closed in ${city} while the ${String(pbl)}m inversion traps NAQI ${String(aqi)} outside. ` +
    `Keep your HEPA purifier on low and wait until ${cleanWin} before airing out.`
  );
}

function buildSymptomReply(ctx: CompanionReplyContext): string {
  const { member, city, telemetry } = ctx;
  const name = firstNameOf(member.label);
  const aqi = telemetry.stationCrossCheck.effectiveSafetyAqi;
  const pm25 = Math.round(telemetry.currentPollutants.pm25UgM3);
  return (
    `Hi ${name}, please rest indoors in ${city} right now (NAQI ${String(aqi)}, PM2.5 ${String(pm25)} ug/m3). ` +
    `Keep windows sealed, run your HEPA purifier, and keep your reliever inhaler nearby.`
  );
}

function buildWindowReply(ctx: CompanionReplyContext): string {
  const { member, city, telemetry } = ctx;
  const name = firstNameOf(member.label);
  const aqi = telemetry.stationCrossCheck.effectiveSafetyAqi;
  const pbl = telemetry.inversion.currentPblMeters;
  const cleanWin = formatCleanHours(telemetry.inversion.bestWindowHours);
  if (telemetry.inversion.openWindowsNow) {
    return (
      `Hi ${name}! Dispersion is open in ${city} right now (NAQI ${String(aqi)}, PBL ${String(pbl)}m). ` +
      `You can cross-ventilate for 15-20 minutes, then close up before evening.`
    );
  }
  return (
    `Hi ${name}, hold off on opening windows in ${city} right now (shallow ${String(pbl)}m mixing layer, NAQI ${String(aqi)}). ` +
    `The cleanest ventilation window today is ${cleanWin}.`
  );
}

function buildGeneralReply(ctx: CompanionReplyContext): string {
  const { member, city, telemetry } = ctx;
  const name = firstNameOf(member.label);
  const aqi = telemetry.stationCrossCheck.effectiveSafetyAqi;
  const pm25 = Math.round(telemetry.currentPollutants.pm25UgM3);
  const cleanWin = formatCleanHours(telemetry.inversion.bestWindowHours);
  const maskTip =
    member.role === 'senior-respiratory'
      ? 'Keep the outing brief and carry your inhaler.'
      : `Wear your ${member.mask} mask outdoors.`;

  return (
    `Hi ${name}! In ${city}, NAQI is ${String(aqi)} (${telemetry.assessment.cpcbCategory}, PM2.5 ${String(pm25)} ug/m3) and the best window to head out is ${cleanWin}. ` +
    maskTip
  );
}

/** Builds a context-sensitive conversational reply when live LLM APIs are offline or in tests. */
export function buildContextAwareCompanionReply(ctx: CompanionReplyContext): string {
  const { member, message, habitPatch } = ctx;
  const updateSuffix = hasHabitPatch(habitPatch)
    ? ` Schedule updated for ${firstNameOf(member.label)}.`
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
  const name = firstNameOf(member.label);
  const cur = telemetry.hourlySeries[0];
  const aqi = telemetry.stationCrossCheck.effectiveSafetyAqi;
  const cleanWin = formatCleanHours(telemetry.inversion.bestWindowHours);
  const stepsText = updatedSchedule.dailyRoutine
    .map((s) => `${s.timeWindow}: ${s.actionTitle}`)
    .join(' | ');

  return [
    `You are PranaPulse Family Companion chatting with ${name} (${member.label}, role=${member.role}, archetype=${resolveMemberArchetype(member)}, mask=${member.mask}).`,
    `Health notes: ${member.healthNotes ?? 'none'}. Daily habits: ${member.dailyHabitsNote ?? 'none'}.`,
    `Live telemetry for ${city}: CPCB_NAQI=${String(aqi)} (${telemetry.assessment.cpcbCategory}), PM2.5=${String(Math.round(telemetry.currentPollutants.pm25UgM3))} ug/m3, PBL=${String(telemetry.inversion.currentPblMeters)}m, inversion=${telemetry.inversion.currentSeverity}, wind=${String(Math.round(cur?.windKmh ?? 0))} km/h, humidity=${String(Math.round(cur?.rhPercent ?? 0))}%, openWindowsNow=${String(telemetry.inversion.openWindowsNow)}, bestWindow=${cleanWin}.`,
    `Schedule today: ${stepsText}. Schedule updated: ${String(hasHabitPatch(habitPatch))}.`,
    `User message: "${message}"`,
    `Instructions: Reply in language "${language}" in 2 short, crisp sentences (STRICTLY 25-40 words maximum). Start with a brief warm greeting ("Hi ${name}!"), directly answer their question to the point with 1-2 key live numbers (like NAQI ${String(aqi)} or best window ${cleanWin}), and give one clear next step. No fluff, no long paragraphs, no bullet lists.`,
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
