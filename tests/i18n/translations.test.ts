import { describe, expect, it } from 'vitest';
import { DEFAULT_WORKSPACE_INPUT } from '../../src/config/uiConstants.js';
import {
  buildDeterministicChatChunks,
  buildDeterministicFallbackPlan,
} from '../../src/domain/fallbackPlanBuilder.js';
import { buildInitialWorkspaceBundle } from '../../src/domain/localBaseline.js';
import { TRANSLATIONS } from '../../src/i18n/translations.js';
import type { SupportedLanguage } from '../../src/validators/schemas.js';

function collectShape(obj: Record<string, unknown>, prefix = ''): string[] {
  const paths: string[] = [];
  for (const key of Object.keys(obj).sort()) {
    const full = prefix ? `${prefix}.${key}` : key;
    const val = obj[key];
    if (Array.isArray(val)) {
      paths.push(`${full}[${String(val.length)}]`);
    } else if (typeof val === 'object' && val !== null) {
      paths.push(...collectShape(val as Record<string, unknown>, full));
    } else {
      paths.push(full);
    }
  }
  return paths;
}

function collectLeafStrings(obj: unknown): string[] {
  if (typeof obj === 'string') {
    return [obj];
  }
  if (Array.isArray(obj)) {
    return obj.flatMap(collectLeafStrings);
  }
  if (typeof obj === 'object' && obj !== null) {
    return Object.values(obj).flatMap(collectLeafStrings);
  }
  return [];
}

describe('Multilingual localization parity (EN / HI / TA)', () => {
  const locales: readonly SupportedLanguage[] = ['en', 'hi', 'ta'];

  it('maintains 100% recursive key and array-length parity across all locales', () => {
    const enShape = collectShape(TRANSLATIONS.en as unknown as Record<string, unknown>);
    const hiShape = collectShape(TRANSLATIONS.hi as unknown as Record<string, unknown>);
    const taShape = collectShape(TRANSLATIONS.ta as unknown as Record<string, unknown>);

    expect(hiShape).toEqual(enShape);
    expect(taShape).toEqual(enShape);
  });

  it('ensures every localized string is non-empty and free of em-dash/ellipsis copy tells', () => {
    for (const locale of locales) {
      const strings = collectLeafStrings(TRANSLATIONS[locale]);
      expect(strings.length).toBeGreaterThan(95);
      for (const s of strings) {
        expect(s.trim().length).toBeGreaterThan(0);
        expect(s).not.toContain('—');
        expect(s).not.toContain('...');
      }
    }
  });

  it('generates 100% localized Hindi and Tamil deterministic plans and chat replies without English prose leaks', () => {
    const baseBundle = buildInitialWorkspaceBundle(DEFAULT_WORKSPACE_INPUT);
    const bestCommute = baseBundle.commuteOptions[0]!;

    for (const lang of ['hi', 'ta'] as const) {
      const plan = buildDeterministicFallbackPlan({
        request: { ...DEFAULT_WORKSPACE_INPUT, language: lang },
        aqi: baseBundle.telemetry.assessment,
        effectiveAqi: baseBundle.telemetry.stationCrossCheck.effectiveSafetyAqi,
        inversion: baseBundle.telemetry.inversion,
        indoor: baseBundle.indoor,
        bestCommute,
        corridor: baseBundle.corridor,
        rwa: baseBundle.rwa,
      });

      const serialized = JSON.stringify(plan);
      expect(serialized).not.toContain('Shallow mixing');
      expect(serialized).not.toContain('Best window');
      expect(serialized).not.toContain('Commute Hours');
      expect(serialized).not.toContain('Seal Door Sweeps');
      expect(serialized).not.toContain('solo road travel');

      const chat = buildDeterministicChatChunks({
        query: 'स्कूल यात्रा',
        city: 'New Delhi',
        language: lang,
        cpcbNaqi: 240,
        pm25UgM3: 145,
        inversionSeverity: 'severe-inversion',
        openWindowsNow: false,
      }).join('');
      expect(chat).not.toContain('Keep windows sealed for now');
      expect(chat).toContain('ug/m3');
    }
  });
});
