import { describe, expect, it } from 'vitest';
import { MASK_CATALOG, PURIFIER_CATALOG } from '../../src/config/gearCatalog.js';
import { resolveDynamicIndoorGuidance } from '../../src/config/indoorGuidanceResolver.js';
import { DEFAULT_WORKSPACE_INPUT } from '../../src/config/uiConstants.js';
import {
  buildDeterministicChatChunks,
  buildDeterministicFallbackPlan,
} from '../../src/domain/fallbackPlanBuilder.js';
import { buildInitialWorkspaceBundle } from '../../src/domain/localBaseline.js';
import {
  GEAR_CATALOG_COPY,
  resolveLocalizedMask,
  resolveLocalizedPurifier,
} from '../../src/i18n/gearCatalogCopy.js';
import { MEMBER_SCHEDULE_STRINGS } from '../../src/i18n/memberScheduleCopy.js';
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

  it('localizes dynamic indoor guidance, winter plants, and full mask/purifier catalogs for HI and TA', () => {
    const baseBundle = buildInitialWorkspaceBundle(DEFAULT_WORKSPACE_INPUT);

    for (const lang of ['hi', 'ta'] as const) {
      const t = TRANSLATIONS[lang];
      const guidance = resolveDynamicIndoorGuidance(
        { ...DEFAULT_WORKSPACE_INPUT, language: lang },
        baseBundle.indoor,
        t,
      );
      const serialized = JSON.stringify(guidance);
      expect(serialized).not.toContain('Window seal');
      expect(serialized).not.toContain('Matched to ');
      expect(serialized).not.toContain('Envelope leakage alert');
      expect(serialized).not.toContain('Supplementary Bedroom');
      expect(serialized).not.toContain('—');

      const gearPack = GEAR_CATALOG_COPY[lang];
      for (const mask of MASK_CATALOG) {
        const locMask = resolveLocalizedMask(mask, lang);
        expect(locMask.bestFor.trim().length).toBeGreaterThan(0);
        expect(locMask.fitStyle.trim().length).toBeGreaterThan(0);
      }
      for (const purifier of PURIFIER_CATALOG) {
        const locPurifier = resolveLocalizedPurifier(purifier, lang);
        expect(locPurifier.bestFor.trim().length).toBeGreaterThan(0);
        expect(locPurifier.filterGrade.trim().length).toBeGreaterThan(0);
      }
      expect(gearPack.formatMaskFiltration('N95', 95)).toContain('95%');
      expect(gearPack.formatMaskNote('N95', 95)).toContain('95%');
      expect(gearPack.formatMaskBannerLead('N95').before1.length).toBeGreaterThan(0);
      expect(gearPack.formatPurifierCadrMeta(380, 32)).toContain('380');
      expect(gearPack.formatPurifierHeaderStat(380, 310)).toContain('380');
      expect(gearPack.formatPurifierCadrNote(400, 300, 280)).toContain('+100');
      expect(gearPack.formatPurifierCadrNote(200, 300, 280)).toContain('100');
      expect(
        gearPack.formatPurifierIntro({
          chosenCadr: 300,
          areaM2: 24,
          reqCadr: 280,
          topName: 'Coway',
          topCadr: 350,
        }),
      ).toContain('Coway');
    }

    const archetypes = [
      'school-student',
      'office-commuter',
      'senior-homebound',
      'outdoor-active',
      'home-caregiver',
    ] as const;
    for (const lang of locales) {
      const pack = MEMBER_SCHEDULE_STRINGS[lang];
      const gearPack = GEAR_CATALOG_COPY[lang];
      expect(gearPack.formatPurifierCadrNote(250, 300, 280)).toContain('50');
      for (const archetype of archetypes) {
        const steps = pack.buildSteps({
          archetype,
          leave: '08:00',
          ret: '18:00',
          cleanWindow: '13:00-15:00',
          commuteLabel: 'Metro',
          maskLabel: 'N95',
          fuelLabel: 'LPG',
          pblMeters: 310,
          effectiveAqi: 245,
          indoorCadr: 350,
          indoorMitigatedPm25: 28,
          indoorReductionPct: 72,
          purgeMinutes: 25,
          corridorSavedPct: 38,
          isHighRisk: true,
          healthNotes: 'mild asthma',
          dailyHabitsNote: 'evening walk',
        });
        expect(steps).toHaveLength(4);
      }
    }
  });
});
