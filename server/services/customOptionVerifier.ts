import { GoogleGenAI, Type, type Schema } from '@google/genai';
import { CACHE_TTL_MS, VALIDATION_BOUNDS } from '../../src/config/constants.js';
import { formatCustomDisplayLabel, sanitizeUserText } from '../../src/utils/inputSanitizer.js';
import type { SupportedLanguage } from '../../src/validators/schemas.js';
import type { ServerEnv } from '../env.js';
import { BoundedTtlCache } from './cacheAndLimiter.js';
import {
  ALLOWED_CUSTOM_TARGETS,
  CUSTOM_APPROVAL_PREFIX,
  CUSTOM_KEYWORD_MATCHERS,
  CUSTOM_REJECTION_MESSAGES,
  DEFAULT_CUSTOM_TARGET,
  type CustomCategory,
} from './customVerifyRules.js';
import { requestGroqCustomVerifyText } from './groqCustomVerifier.js';

export type { CustomCategory };

export interface CustomVerifyRequest {
  readonly category: CustomCategory;
  readonly customText: string;
  readonly language: SupportedLanguage;
}

export interface CustomVerifyResponse {
  readonly isValid: boolean;
  readonly mappedValue: string;
  readonly explanation: string;
  readonly displayLabel?: string;
}

const VERIFY_GEMINI_MODEL = 'gemini-3.5-flash-lite';
const VERIFY_GEMINI_TIMEOUT_MS = 4_500;
const VERIFY_MAX_OUTPUT_TOKENS = 160;
const VERIFY_CACHE_CAPACITY = 200;

const verifyCache = new BoundedTtlCache<CustomVerifyResponse>(
  CACHE_TTL_MS.PLAN_MS,
  VERIFY_CACHE_CAPACITY,
);

const VERIFY_RESPONSE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    isValid: { type: Type.BOOLEAN },
    mappedValue: { type: Type.STRING },
    displayLabel: { type: Type.STRING },
    explanation: { type: Type.STRING },
  },
  required: ['isValid', 'mappedValue', 'displayLabel', 'explanation'],
};

function sanitizeCustomEntry(raw: string): string {
  return sanitizeUserText(raw, VALIDATION_BOUNDS.MAX_CITY_QUERY_LEN);
}

export function verifyCustomDeterministically(req: CustomVerifyRequest): CustomVerifyResponse {
  const cleaned = sanitizeCustomEntry(req.customText);
  const displayLabel = formatCustomDisplayLabel(cleaned);
  for (const rule of CUSTOM_KEYWORD_MATCHERS[req.category]) {
    if (rule.re.test(cleaned)) {
      return {
        isValid: true,
        mappedValue: rule.target,
        displayLabel,
        explanation: `${CUSTOM_APPROVAL_PREFIX[req.language]} "${displayLabel}" (${rule.target}).`,
      };
    }
  }
  return {
    isValid: false,
    mappedValue: DEFAULT_CUSTOM_TARGET[req.category],
    explanation: CUSTOM_REJECTION_MESSAGES[req.language][req.category],
  };
}

function buildVerificationPrompt(req: CustomVerifyRequest): string {
  const allowed = ALLOWED_CUSTOM_TARGETS[req.category].join(', ');
  return [
    'You are PranaPulse AI, a strict public-health and building-physics validator.',
    `Evaluate whether <user_entry> is a genuine, realistic entry for category "${req.category}". Minor spelling typos (like "kersosene" for "Kerosene") are valid.`,
    '- Category "role": genuine human health condition, age group, occupation, or physical activity profile relevant to air pollution (e.g., pregnant mother, asthma patient, college student, outdoor runner).',
    '- Category "tightness": genuine window, door, room, or building envelope sealing description.',
    '- Category "cookingFuel": genuine cooking fuel, stove, or kitchen heating appliance (e.g., kerosene, biogas, microwave, tandoor).',
    `If genuine, set isValid=true, map mappedValue to the CLOSEST physics equivalent strictly from [${allowed}], set displayLabel to a clean, correctly spelled 1-4 word Title-Case label (e.g. "Kerosene", "Pregnant Mother"), and write a concise 1-sentence explanation in language "${req.language}".`,
    `If gibberish, unrelated, random words, or invalid, set isValid=false, set mappedValue="${DEFAULT_CUSTOM_TARGET[req.category]}", set displayLabel="", and write a polite 1-sentence rejection in language "${req.language}" stating that the entry does not satisfy the required condition.`,
    `<user_entry>${sanitizeCustomEntry(req.customText)}</user_entry>`,
  ].join('\n');
}

function resolveVerifiedDisplayLabel(parsedLabel: unknown, fallbackText: string): string {
  const normalized = typeof parsedLabel === 'string' ? formatCustomDisplayLabel(parsedLabel) : '';
  return normalized || formatCustomDisplayLabel(fallbackText);
}

function resolveMappedTarget(category: CustomCategory, rawMapped: unknown): string {
  const allowedSet = new Set(ALLOWED_CUSTOM_TARGETS[category]);
  return typeof rawMapped === 'string' && allowedSet.has(rawMapped)
    ? rawMapped
    : DEFAULT_CUSTOM_TARGET[category];
}

function parseModelVerifyResponse(
  rawText: string | undefined,
  req: CustomVerifyRequest,
): CustomVerifyResponse | null {
  try {
    const parsed = rawText ? (JSON.parse(rawText) as Partial<CustomVerifyResponse>) : null;
    if (!parsed || typeof parsed.isValid !== 'boolean' || typeof parsed.explanation !== 'string') {
      return null;
    }
    const mappedValue = resolveMappedTarget(req.category, parsed.mappedValue);
    if (!parsed.isValid) {
      return { isValid: false, mappedValue, explanation: parsed.explanation };
    }
    return {
      isValid: true,
      mappedValue,
      explanation: parsed.explanation,
      displayLabel: resolveVerifiedDisplayLabel(parsed.displayLabel, req.customText),
    };
  } catch {
    return null;
  }
}

async function tryGeminiVerifyWithTimeout(
  prompt: string,
  req: CustomVerifyRequest,
  apiKey: string,
): Promise<CustomVerifyResponse> {
  const ai = new GoogleGenAI({ apiKey });
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      reject(new Error('Gemini verify timeout'));
    }, VERIFY_GEMINI_TIMEOUT_MS);
  });
  try {
    const response = await Promise.race([
      ai.models.generateContent({
        model: VERIFY_GEMINI_MODEL,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: VERIFY_RESPONSE_SCHEMA,
          temperature: VALIDATION_BOUNDS.GEMINI_TEMPERATURE,
          maxOutputTokens: VERIFY_MAX_OUTPUT_TOKENS,
        },
      }),
      timeoutPromise,
    ]);
    const parsed = parseModelVerifyResponse(response.text, req);
    if (!parsed) {
      throw new Error('Invalid Gemini verify JSON');
    }
    return parsed;
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

async function tryGroqVerify(
  prompt: string,
  req: CustomVerifyRequest,
  env: ServerEnv,
): Promise<CustomVerifyResponse> {
  const raw = await requestGroqCustomVerifyText(prompt, env);
  const parsed = parseModelVerifyResponse(raw ?? undefined, req);
  if (!parsed) {
    throw new Error('Invalid Groq verify JSON');
  }
  return parsed;
}

async function raceLiveAiVerifiers(
  req: CustomVerifyRequest,
  env: ServerEnv,
): Promise<CustomVerifyResponse | null> {
  const prompt = buildVerificationPrompt(req);
  const candidates: Promise<CustomVerifyResponse>[] = [];
  if (env.GROQ_API_KEY) {
    candidates.push(tryGroqVerify(prompt, req, env));
  }
  if (env.GEMINI_API_KEY) {
    candidates.push(tryGeminiVerifyWithTimeout(prompt, req, env.GEMINI_API_KEY));
  }
  if (candidates.length === 0) {
    return null;
  }
  try {
    return await Promise.any(candidates);
  } catch {
    return null;
  }
}

/**
 * Verifies a user-supplied custom dropdown option by racing timeout-bounded Gemini & Groq
 * structured JSON verifiers (~300ms-1.2s) with TTL caching and instant deterministic fallback.
 */
export async function verifyCustomOption(
  req: CustomVerifyRequest,
  env: ServerEnv,
): Promise<CustomVerifyResponse> {
  const cleaned = sanitizeCustomEntry(req.customText);
  if (cleaned.length < 2) {
    return {
      isValid: false,
      mappedValue: DEFAULT_CUSTOM_TARGET[req.category],
      explanation: CUSTOM_REJECTION_MESSAGES[req.language][req.category],
    };
  }
  const cacheKey = `${req.category}|${req.language}|${cleaned.toLowerCase()}`;
  const cached = verifyCache.get(cacheKey);
  if (cached) {
    return cached;
  }
  const live = await raceLiveAiVerifiers(req, env);
  const result = live ?? verifyCustomDeterministically(req);
  verifyCache.set(cacheKey, result);
  return result;
}
