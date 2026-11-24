import { UPSTREAM_ENDPOINTS, VALIDATION_BOUNDS } from '../../src/config/constants.js';
import type { ServerEnv } from '../env.js';

const VERIFY_GROQ_TIMEOUT_MS = 4_500;
const VERIFY_MAX_TOKENS = 160;
const GROQ_VERIFY_SYSTEM =
  'Return strictly valid JSON with keys: isValid (boolean), mappedValue (string), displayLabel (string), explanation (string). No markdown.';

interface GroqJsonPayload {
  readonly choices?: readonly { readonly message?: { readonly content?: string | null } }[];
}

function extractGroqContent(payload: GroqJsonPayload): string | null {
  const text = payload.choices?.[0]?.message?.content;
  return typeof text === 'string' && text.trim().length > 0 ? text : null;
}

/**
 * Low-latency Groq JSON verifier (~300ms via qwen/qwen3.8-27b) used alongside Gemini
 * so custom "Other" dropdown verification never stalls or hits Vercel 30s timeouts.
 */
export async function requestGroqCustomVerifyText(
  prompt: string,
  env: ServerEnv,
): Promise<string | null> {
  if (!env.GROQ_API_KEY) {
    return null;
  }
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, VERIFY_GROQ_TIMEOUT_MS);

  try {
    const res = await fetch(UPSTREAM_ENDPOINTS.GROQ_CHAT_COMPLETIONS, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.GROQ_API_KEY}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: env.GROQ_MODEL,
        temperature: VALIDATION_BOUNDS.GEMINI_TEMPERATURE,
        max_tokens: VERIFY_MAX_TOKENS,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: GROQ_VERIFY_SYSTEM },
          { role: 'user', content: prompt },
        ],
      }),
    });
    return res.ok ? extractGroqContent((await res.json()) as GroqJsonPayload) : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
