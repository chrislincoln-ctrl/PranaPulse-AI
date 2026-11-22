import { GoogleGenAI, type GenerateContentConfig } from '@google/genai';
import {
  APP_META,
  SECURITY_LIMITS,
  UPSTREAM_ENDPOINTS,
  VALIDATION_BOUNDS,
} from '../../src/config/constants.js';
import { formatHourRange, resolveMemberArchetype } from '../../src/domain/memberScheduleBuilder.js';
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

function firstNameOf(label: string): string {
  const head = label.split('(')[0]?.trim();
  return head && head.length > 0 ? head : label;
}

function extractReplyFacts(ctx: CompanionReplyContext) {
  const { member, city, telemetry } = ctx;
  return {
    name: firstNameOf(member.label),
    city,
    aqi: telemetry.stationCrossCheck.effectiveSafetyAqi,
    pm25: Math.round(telemetry.currentPollutants.pm25UgM3),
    pbl: telemetry.inversion.currentPblMeters,
    cleanWin: formatHourRange(telemetry.inversion.bestWindowHours),
    category: telemetry.assessment.cpcbCategory,
    openNow: telemetry.inversion.openWindowsNow,
  };
}

function buildIndoorNightReply(ctx: CompanionReplyContext): string {
  const f = extractReplyFacts(ctx);
  return (
    `Hi ${f.name}! You're doing the right thing staying indoors with windows closed in ${f.city} while the ${String(f.pbl)}m inversion traps NAQI ${String(f.aqi)} outside. ` +
    `Keep your HEPA purifier on low and wait until ${f.cleanWin} before airing out.`
  );
}

function buildSymptomReply(ctx: CompanionReplyContext): string {
  const f = extractReplyFacts(ctx);
  return (
    `Hi ${f.name}, please rest indoors in ${f.city} right now (NAQI ${String(f.aqi)}, PM2.5 ${String(f.pm25)} ug/m3). ` +
    `Keep windows sealed, run your HEPA purifier, and keep your reliever inhaler nearby.`
  );
}

function buildWindowReply(ctx: CompanionReplyContext): string {
  const f = extractReplyFacts(ctx);
  if (f.openNow) {
    return (
      `Hi ${f.name}! Dispersion is open in ${f.city} right now (NAQI ${String(f.aqi)}, PBL ${String(f.pbl)}m). ` +
      `You can cross-ventilate for 15-20 minutes, then close up before evening.`
    );
  }
  return (
    `Hi ${f.name}, hold off on opening windows in ${f.city} right now (shallow ${String(f.pbl)}m mixing layer, NAQI ${String(f.aqi)}). ` +
    `The cleanest ventilation window today is ${f.cleanWin}.`
  );
}

function buildGeneralReply(ctx: CompanionReplyContext): string {
  const f = extractReplyFacts(ctx);
  const maskTip =
    ctx.member.role === 'senior-respiratory'
      ? 'Keep the outing brief and carry your inhaler.'
      : `Wear your ${ctx.member.mask} mask outdoors.`;
  return (
    `Hi ${f.name}! In ${f.city}, NAQI is ${String(f.aqi)} (${f.category}, PM2.5 ${String(f.pm25)} ug/m3) and the best window to head out is ${f.cleanWin}. ` +
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
  const cleanWin = formatHourRange(telemetry.inversion.bestWindowHours);
  const stepsText = updatedSchedule.dailyRoutine
    .map((s) => `${s.timeWindow}: ${s.actionTitle}`)
    .join(' | ');

  return [
    `You are PranaPulse Family Companion chatting with ${name} (${member.label}, role=${member.role}, archetype=${resolveMemberArchetype(member)}, mask=${member.mask}).`,
    `Health notes: ${member.healthNotes ?? 'none'}. Daily habits: ${member.dailyHabitsNote ?? 'none'}.`,
    `Live telemetry for ${city}: CPCB_NAQI=${String(aqi)} (${telemetry.assessment.cpcbCategory}), PM2.5=${String(Math.round(telemetry.currentPollutants.pm25UgM3))} ug/m3, PBL=${String(telemetry.inversion.currentPblMeters)}m, inversion=${telemetry.inversion.currentSeverity}, wind=${String(Math.round(cur?.windKmh ?? 0))} km/h, humidity=${String(Math.round(cur?.rhPercent ?? 0))}%, openWindowsNow=${String(telemetry.inversion.openWindowsNow)}, bestWindow=${cleanWin}.`,
    `Schedule today: ${stepsText}. Schedule updated: ${String(hasHabitPatch(habitPatch))}.`,
    `User message: "${message}"`,
    `Instructions: Reply in language "${language}" in 2 short, warm sentences (STRICTLY 25-40 words maximum). Start with a brief greeting ("Hi ${name}!"), directly answer their exact message using 1-2 relevant telemetry facts for their topic (do NOT mention window opening hours unless they ask about windows or timing), and give one clear tip. No bullet lists.`,
  ].join('\n');
}

/** Runs a Gemini model fallback cascade with per-attempt timeout and returns the first non-empty text. */
export async function runGeminiTextCascade(params: {
  readonly prompt: string;
  readonly env: ServerEnv;
  readonly config: GenerateContentConfig;
  readonly timeoutMs?: number;
}): Promise<string | null> {
  const { prompt, env, config, timeoutMs = SECURITY_LIMITS.UPSTREAM_TIMEOUT_MS } = params;
  if (!env.GEMINI_API_KEY) {
    return null;
  }
  const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
  const models = [...new Set<string>([...APP_META.GEMINI_FALLBACK_MODELS, env.GEMINI_MODEL])];
  for (const model of models) {
    try {
      const response = await withTimeout(
        ai.models.generateContent({ model, contents: prompt, config }),
        timeoutMs,
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

interface GroqCascadeParams {
  readonly systemPrompt: string;
  readonly userPrompt: string;
  readonly env: ServerEnv;
  readonly temperature: number;
  readonly jsonMode?: boolean;
  readonly timeoutMs?: number;
}

function buildGroqBody(model: string, params: GroqCascadeParams): string {
  return JSON.stringify({
    model,
    temperature: params.temperature,
    ...(params.jsonMode ? { response_format: { type: 'json_object' } } : {}),
    messages: [
      { role: 'system', content: params.systemPrompt },
      { role: 'user', content: params.userPrompt },
    ],
  });
}

function extractGroqContent(json: GroqChatPayload): string | null {
  return json.choices?.[0]?.message?.content?.trim() ?? null;
}

async function fetchGroqOnce(
  apiKey: string,
  model: string,
  params: GroqCascadeParams,
): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, params.timeoutMs ?? SECURITY_LIMITS.UPSTREAM_TIMEOUT_MS);
  try {
    const resp = await fetch(UPSTREAM_ENDPOINTS.GROQ_CHAT_COMPLETIONS, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: buildGroqBody(model, params),
      signal: controller.signal,
    });
    return resp.ok ? extractGroqContent((await resp.json()) as GroqChatPayload) : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Invokes Groq Chat Completions across the configured fallback cascade with strict timeout. */
export async function runGroqTextCascade(params: GroqCascadeParams): Promise<string | null> {
  if (!params.env.GROQ_API_KEY) {
    return null;
  }
  const models = [...new Set<string>([params.env.GROQ_MODEL, ...APP_META.GROQ_FALLBACK_MODELS])];
  for (const model of models) {
    const text = await fetchGroqOnce(params.env.GROQ_API_KEY, model, params);
    if (text) {
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
  const geminiText = await runGeminiTextCascade({
    prompt,
    env,
    config: { temperature: VALIDATION_BOUNDS.GEMINI_TEMPERATURE },
  });
  if (geminiText) {
    return { reply: geminiText, aiEnhanced: true };
  }
  const groqText = await runGroqTextCascade({
    systemPrompt:
      'You are PranaPulse Family Companion, a warm, scientifically grounded household air-quality and health companion.',
    userPrompt: prompt,
    env,
    temperature: VALIDATION_BOUNDS.GEMINI_TEMPERATURE,
  });
  if (groqText) {
    return { reply: groqText, aiEnhanced: true };
  }
  return { reply: buildContextAwareCompanionReply(ctx), aiEnhanced: false };
}
