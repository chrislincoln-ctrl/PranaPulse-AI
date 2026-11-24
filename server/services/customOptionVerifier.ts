import { GoogleGenAI, Type, type Schema } from '@google/genai';
import { APP_META, VALIDATION_BOUNDS } from '../../src/config/constants.js';
import { formatCustomDisplayLabel, sanitizeUserText } from '../../src/utils/inputSanitizer.js';
import type { SupportedLanguage } from '../../src/validators/schemas.js';
import type { ServerEnv } from '../env.js';

export type CustomCategory = 'role' | 'tightness' | 'cookingFuel';

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

const ALLOWED_TARGETS: Record<CustomCategory, readonly string[]> = {
  role: ['child', 'senior-respiratory', 'commuter', 'caregiver'],
  tightness: ['leaky', 'standard', 'weather-sealed'],
  cookingFuel: ['induction', 'lpg-vented', 'lpg-unvented', 'solid-biomass'],
};

const DEFAULT_TARGET: Record<CustomCategory, string> = {
  role: 'senior-respiratory',
  tightness: 'standard',
  cookingFuel: 'lpg-unvented',
};

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

const REJECTION_MESSAGES: Record<SupportedLanguage, Record<CustomCategory, string>> = {
  en: {
    role: 'This entry does not satisfy the required condition for a valid health or vulnerability profile. Please enter a genuine profile (e.g., pregnant woman, infant, bronchitis patient, outdoor athlete).',
    tightness:
      'This entry does not satisfy the required condition for window or building sealing. Please enter a genuine envelope type (e.g., double-glazed UPVC, wooden shutters, AC sealed room).',
    cookingFuel:
      'This entry does not satisfy the required condition for a cooking fuel or stove. Please enter a genuine fuel or appliance (e.g., biogas, piped PNG, kerosene stove, microwave).',
  },
  hi: {
    role: 'यह प्रविष्टि वैध स्वास्थ्य या संवेदनशीलता प्रोफ़ाइल की आवश्यक शर्त को पूरा नहीं करती है। कृपया सही विवरण दर्ज करें (जैसे गर्भवती महिला, शिशु, ब्रोंकाइटिस रोगी, धावक)।',
    tightness:
      'यह प्रविष्टि खिड़की या भवन सीलिंग की आवश्यक शर्त को पूरा नहीं करती है। कृपया सही खिड़की/कमरा प्रकार लिखें (जैसे डबल-ग्लेज़्ड UPVC, लकड़ी की खिड़की)।',
    cookingFuel:
      'यह प्रविष्टि खाना पकाने के ईंधन या चूल्हे की आवश्यक शर्त को पूरा नहीं करती है। कृपया सही ईंधन लिखें (जैसे बायोगैस, PNG गैस, केरोसिन स्टोव, माइक्रोवेव)।',
  },
  ta: {
    role: 'இந்த உள்ளீடு சரியான உடல்நலம் அல்லது பாதிப்பு நிலைக்கான நிபந்தனையை பூர்த்தி செய்யவில்லை. சரியான விவரத்தை உள்ளிடவும் (எ.கா. கர்ப்பிணி, குழந்தை, மூச்சுக்குழாய் நோயாளி).',
    tightness:
      'இந்த உள்ளீடு ஜன்னல் அல்லது கட்டிட அடைப்புக்கான நிபந்தனையை பூர்த்தி செய்யவில்லை. சரியான ஜன்னல் வகையை உள்ளிடவும் (எ.கா. UPVC கண்ணாடி ஜன்னல், மர ஜன்னல்).',
    cookingFuel:
      'இந்த உள்ளீடு சமையல் எரிபொருள் அல்லது அடுப்புக்கான நிபந்தனையை பூர்த்தி செய்யவில்லை. சரியான எரிபொருளை உள்ளிடவும் (எ.கா. உயிரிவாயு, மண்ணெண்ணெய் அடுப்பு, மைக்ரோவேவ்).',
  },
};

const APPROVAL_PREFIX: Record<SupportedLanguage, string> = {
  en: 'Verified custom profile applied:',
  hi: 'सत्यापित कस्टम विकल्प लागू:',
  ta: 'சரிபார்க்கப்பட்ட தனிப்பயன் விருப்பம்:',
};

const KEYWORD_MATCHERS: Record<CustomCategory, readonly { re: RegExp; target: string }[]> = {
  role: [
    {
      re: /pregnant|infant|baby|toddler|newborn|kid|teen|school|गर्भवती|शिशु|बच्चा|கர்ப்பிணி|குழந்தை/i,
      target: 'child',
    },
    {
      re: /asthma|copd|bronchitis|heart|cardiac|lung|elder|senior|patient|smoker|allergy|sinus|diabetic|अस्थमा|हृदय|बुजुर्ग|रोगी|ஆஸ்துமா|இதய|நோயாளி/i,
      target: 'senior-respiratory',
    },
    {
      re: /college|university|undergrad|grad|student|runner|athlete|cyclist|delivery|driver|police|guard|worker|jogger|commuter|धावक|पुलिस|मजदूर|ஓட்டப்பந்தய|தொழிலாளி/i,
      target: 'commuter',
    },
    {
      re: /adult|office|remote|wfh|homemaker|parent|teacher|वयस्क|गृहिणी|शिक्षक|பெரியவர்|ஆசிரியர்/i,
      target: 'caregiver',
    },
  ],
  tightness: [
    {
      re: /upvc|double|glazed|airtight|weather|ac\b|insulated|tape|sealed|डबल|सीलबंद|கண்ணாடி/i,
      target: 'weather-sealed',
    },
    {
      re: /open|broken|jali|mesh|bamboo|curtain|old|wooden|draft|gap|crack|टूटी|जाली|खुली|பழைய|மர/i,
      target: 'leaky',
    },
    {
      re: /window|door|apartment|flat|slider|aluminum|glass|room|खिड़की|फ्लैट|ஜன்னல்|அறை/i,
      target: 'standard',
    },
  ],
  cookingFuel: [
    {
      re: /microwave|oven|air\s*fryer|kettle|electric|heater|infrared|solar|माइक्रोवेव|इलेक्ट्रिक|सोलर|மின்சார|மைக்ரோவேவ்/i,
      target: 'induction',
    },
    {
      re: /png|piped|chimney|hood|exhaust|biogas|बायोगैस|पाइप|चिमनी|உயிரிவாயு/i,
      target: 'lpg-vented',
    },
    {
      re: /kerosene|stove|cylinder|gas|butane|केरोसिन|गैस|स्टोव|மண்ணெண்ணெய்|கேஸ்/i,
      target: 'lpg-unvented',
    },
    {
      re: /coal|charcoal|wood|dung|angithi|tandoor|pellet|sawdust|कोयला|लकड़ी|अंगीठी|उपले|நிலக்கரி|விறகு/i,
      target: 'solid-biomass',
    },
  ],
};

function sanitizeCustomEntry(raw: string): string {
  return sanitizeUserText(raw, VALIDATION_BOUNDS.MAX_CITY_QUERY_LEN);
}

export function verifyCustomDeterministically(req: CustomVerifyRequest): CustomVerifyResponse {
  const cleaned = sanitizeCustomEntry(req.customText);
  const displayLabel = formatCustomDisplayLabel(cleaned);
  for (const rule of KEYWORD_MATCHERS[req.category]) {
    if (rule.re.test(cleaned)) {
      return {
        isValid: true,
        mappedValue: rule.target,
        displayLabel,
        explanation: `${APPROVAL_PREFIX[req.language]} "${displayLabel}" (${rule.target}).`,
      };
    }
  }
  return {
    isValid: false,
    mappedValue: DEFAULT_TARGET[req.category],
    explanation: REJECTION_MESSAGES[req.language][req.category],
  };
}

function buildVerificationPrompt(req: CustomVerifyRequest): string {
  const allowed = ALLOWED_TARGETS[req.category].join(', ');
  return [
    'You are PranaPulse AI, a strict public-health and building-physics validator.',
    `Evaluate whether <user_entry> is a genuine, realistic entry for category "${req.category}".`,
    '- Category "role": must be a genuine human health condition, age group, occupation, or physical activity profile relevant to air pollution.',
    '- Category "tightness": must be a genuine window, door, room, or building envelope sealing description.',
    '- Category "cookingFuel": must be a genuine cooking fuel, stove, or kitchen heating appliance.',
    `If genuine, set isValid=true, set mappedValue strictly from [${allowed}], set displayLabel to a clean, correctly spelled 1-4 word Title-Case label (e.g. "Kerosene", "Pregnant Mother"), and write a concise 1-sentence explanation in language "${req.language}".`,
    `If gibberish, unrelated, random words, or invalid, set isValid=false, set mappedValue="${DEFAULT_TARGET[req.category]}", set displayLabel="", and write a polite 1-sentence rejection in language "${req.language}" stating that the entry does not satisfy the required condition.`,
    `<user_entry>${sanitizeCustomEntry(req.customText)}</user_entry>`,
  ].join('\n');
}

function resolveVerifiedDisplayLabel(parsedLabel: unknown, fallbackText: string): string {
  const normalized = typeof parsedLabel === 'string' ? formatCustomDisplayLabel(parsedLabel) : '';
  return normalized || formatCustomDisplayLabel(fallbackText);
}

function parseModelVerifyResponse(
  rawText: string | undefined,
  req: CustomVerifyRequest,
): CustomVerifyResponse | null {
  const parsed = rawText ? (JSON.parse(rawText) as Partial<CustomVerifyResponse>) : null;
  if (!parsed || typeof parsed.isValid !== 'boolean' || typeof parsed.explanation !== 'string') {
    return null;
  }
  const allowedSet = new Set(ALLOWED_TARGETS[req.category]);
  const mapped =
    typeof parsed.mappedValue === 'string' && allowedSet.has(parsed.mappedValue)
      ? parsed.mappedValue
      : DEFAULT_TARGET[req.category];
  return {
    isValid: parsed.isValid,
    mappedValue: mapped,
    explanation: parsed.explanation,
    ...(parsed.isValid
      ? { displayLabel: resolveVerifiedDisplayLabel(parsed.displayLabel, req.customText) }
      : {}),
  };
}

async function tryVerifyWithModel(
  ai: GoogleGenAI,
  model: string,
  req: CustomVerifyRequest,
): Promise<CustomVerifyResponse | null> {
  try {
    const response = await ai.models.generateContent({
      model,
      contents: buildVerificationPrompt(req),
      config: {
        responseMimeType: 'application/json',
        responseSchema: VERIFY_RESPONSE_SCHEMA,
        temperature: VALIDATION_BOUNDS.GEMINI_TEMPERATURE,
      },
    });
    return parseModelVerifyResponse(response.text, req);
  } catch {
    return null;
  }
}

/**
 * Verifies a user-supplied custom dropdown option using Gemini structured outputs
 * with deterministic keyword fallback when offline.
 */
export async function verifyCustomOption(
  req: CustomVerifyRequest,
  env: ServerEnv,
): Promise<CustomVerifyResponse> {
  const cleaned = sanitizeCustomEntry(req.customText);
  if (cleaned.length < 2) {
    return {
      isValid: false,
      mappedValue: DEFAULT_TARGET[req.category],
      explanation: REJECTION_MESSAGES[req.language][req.category],
    };
  }
  if (!env.GEMINI_API_KEY) {
    return verifyCustomDeterministically(req);
  }

  const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
  const models = [
    ...new Set(['gemini-3.5-flash-lite', env.GEMINI_MODEL, ...APP_META.GEMINI_FALLBACK_MODELS]),
  ];
  for (const model of models) {
    const candidate = await tryVerifyWithModel(ai, model, req);
    if (candidate) {
      return candidate;
    }
  }
  return verifyCustomDeterministically(req);
}
