import type * as GenAiModule from '@google/genai';
import { afterEach, describe, expect, it, vi } from 'vitest';

const generateContent = vi.fn();

vi.mock('@google/genai', async (importOriginal) => {
  const actual = await importOriginal<typeof GenAiModule>();
  return {
    ...actual,
    GoogleGenAI: vi.fn(() => ({ models: { generateContent } })),
  };
});

const { loadServerEnv } = await import('../../server/env.js');
const { planCityCorridor } = await import('../../server/services/corridorPlanner.js');
const { verifyCustomOption, verifyCustomDeterministically } =
  await import('../../server/services/customOptionVerifier.js');

const GEMINI_ENV = loadServerEnv({ NODE_ENV: 'test', GEMINI_API_KEY: 'gemini-test-key' });

describe('Gemini-backed corridor planning and custom option verification', () => {
  afterEach(() => {
    generateContent.mockReset();
  });

  it('uses Gemini corridor JSON when valid, cascades past failures, and falls back when all models fail', async () => {
    generateContent
      .mockRejectedValueOnce(new Error('model unavailable'))
      .mockResolvedValueOnce({ text: '{"isValid":"maybe"}' })
      .mockResolvedValueOnce({
        text: JSON.stringify({
          isValid: true,
          estimatedDistanceKm: 99,
          arterialJunction: 'MI Road Junction',
          ringFlyover: 'Tonk Road Flyover',
          greenParkway: 'Central Park',
          metroConcourse: 'Sindhi Camp Metro',
          routeSummary: 'Central Park parkway corridor.',
        }),
      });

    const planned = await planCityCorridor(
      {
        city: 'Jaipur',
        fromArea: 'Malviya Nagar',
        toArea: 'Vaishali Nagar',
        commuteMode: 'electric-bus',
        language: 'en',
      },
      GEMINI_ENV,
    );
    expect(planned.isValid).toBe(true);
    expect(planned.nodeLabels['green-parkway']).toBe('Central Park');
    expect(planned.estimatedDistanceKm).toBeLessThanOrEqual(40);

    generateContent.mockResolvedValue({ text: undefined });
    const fallback = await planCityCorridor(
      {
        city: 'Jaipur',
        fromArea: 'Mansarovar',
        toArea: 'Civil Lines',
        commuteMode: 'metro',
        language: 'ta',
      },
      GEMINI_ENV,
    );
    expect(fallback.isValid).toBe(true);
    expect(fallback.googleMapsUrl).toContain('google.com/maps');

    generateContent.mockResolvedValueOnce({
      text: JSON.stringify({
        isValid: true,
        estimatedDistanceKm: 'NaN',
        arterialJunction: 42,
        ringFlyover: '',
        greenParkway: null,
        metroConcourse: 'Metro',
        routeSummary: 'Summary',
      }),
    });
    const sparse = await planCityCorridor(
      {
        city: 'Jaipur',
        fromArea: 'Sodala',
        toArea: 'Raja Park',
        commuteMode: 'cycling',
        language: 'hi',
      },
      GEMINI_ENV,
    );
    expect(sparse.estimatedDistanceKm).toBe(11);
  });

  it('verifies custom options via Gemini for valid, rejected, malformed, and unmapped responses', async () => {
    generateContent.mockResolvedValueOnce({
      text: JSON.stringify({
        isValid: true,
        mappedValue: 'commuter',
        displayLabel: 'outdoor runner',
        explanation: 'Runners inhale higher doses.',
      }),
    });
    const ok = await verifyCustomOption(
      { category: 'role', customText: 'outdoor runner', language: 'en' },
      GEMINI_ENV,
    );
    expect(ok.isValid).toBe(true);
    expect(ok.mappedValue).toBe('commuter');
    expect(ok.displayLabel).toBe('Outdoor Runner');

    generateContent.mockResolvedValueOnce({
      text: JSON.stringify({
        isValid: false,
        mappedValue: 'not-allowed',
        displayLabel: '',
        explanation: 'Not a valid cooking fuel.',
      }),
    });
    const rejected = await verifyCustomOption(
      { category: 'cookingFuel', customText: 'moon rocks', language: 'hi' },
      GEMINI_ENV,
    );
    expect(rejected.isValid).toBe(false);
    expect(rejected.explanation).toBe('Not a valid cooking fuel.');

    generateContent.mockResolvedValueOnce({
      text: JSON.stringify({
        isValid: true,
        mappedValue: 'leaky',
        displayLabel: 42,
        explanation: 'Old windows leak.',
      }),
    });
    const fallbackLabel = await verifyCustomOption(
      { category: 'tightness', customText: 'old wooden frames', language: 'ta' },
      GEMINI_ENV,
    );
    expect(fallbackLabel.displayLabel).toBe('Old Wooden Frames');

    generateContent.mockResolvedValueOnce({ text: 'not-json' });
    const malformed = await verifyCustomOption(
      { category: 'cookingFuel', customText: 'kerosene lamp stove', language: 'en' },
      GEMINI_ENV,
    );
    expect(malformed).toEqual(
      verifyCustomDeterministically({
        category: 'cookingFuel',
        customText: 'kerosene lamp stove',
        language: 'en',
      }),
    );
  });
});
