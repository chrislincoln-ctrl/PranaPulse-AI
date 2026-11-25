import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolveDynamicIndoorGuidance } from '../../src/config/indoorGuidanceResolver.js';
import { DEFAULT_WORKSPACE_INPUT } from '../../src/config/uiConstants.js';
import { buildDeterministicChatChunks } from '../../src/domain/fallbackPlanBuilder.js';
import { buildInitialWorkspaceBundle } from '../../src/domain/localBaseline.js';
import { TRANSLATIONS } from '../../src/i18n/translations.js';
import { loadServerEnv } from '../../server/env.js';
import { sanitizeAiControlPayload } from '../../server/services/aiControlValidator.js';
import { buildStructuredPrompt } from '../../server/services/geminiSchema.js';
import {
  detectMentionedMemberId,
  enrichDerivedOutdoorHours,
  extractHabitUpdates,
  extractLocationMention,
  hasHabitPatch,
  normalizeClockTime,
  shouldPersistLocationMention,
} from '../../server/services/habitExtractor.js';
import {
  clearHouseholdWorkspaceStore,
  syncWorkspaceFromWeb,
} from '../../server/services/householdWorkspaceStore.js';
import {
  extractSiteControlPatch,
  summarizeHouseholdChanges,
} from '../../server/services/naturalSiteControlExtractor.js';
import { routeTelegramCommand } from '../../server/services/telegramCommandRouter.js';

const TEST_ENV = loadServerEnv({ NODE_ENV: 'test' });

describe('Exhaustive parser, validator, schema, indoor guidance & router branch coverage', () => {
  afterEach(() => {
    clearHouseholdWorkspaceStore();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('validates every field and boundary condition in sanitizeAiControlPayload', async () => {
    const ws = await syncWorkspaceFromWeb(
      { workspaceKey: 'valws1', payload: DEFAULT_WORKSPACE_INPUT },
      TEST_ENV,
    );
    const full = sanitizeAiControlPayload(
      {
        switchToMemberId: 'm1',
        addMemberName: 'Riya',
        removeMemberId: 'm2',
        cityQuery: 'Kolkata',
        label: 'Aarav Jr',
        role: 'commuter',
        archetype: 'office-commuter',
        mask: 'n95-ffp2',
        dailyOutdoorHours: 3.3,
        leaveHomeTime: '8:30 am',
        returnHomeTime: '6:15 pm',
        commuteMode: 'metro',
        healthNotes: 'Mild wheezing in smog',
        areaM2: 30,
        cadrM3Hr: 420,
        tightness: 'weather-sealed',
        cookingFuel: 'induction',
        commuteDistanceKm: 15,
        householdsParticipating: 200,
        transitShiftShare: 65,
        haltLeafBurning: true,
        language: 'hi',
      },
      ws,
    );
    expect(full.switchToMemberId).toBe('m1');
    expect(full.addMemberName).toBe('Riya');
    expect(full.removeMemberId).toBe('m2');
    expect(full.cityQuery).toBe('Kolkata');
    expect(full.memberPatch.dailyOutdoorHours).toBe(3.5);
    expect(full.memberPatch.leaveHomeTime).toBe('08:30');
    expect(full.memberPatch.returnHomeTime).toBe('18:15');
    expect(full.householdPatch.transitShiftShare).toBe(0.65);
    expect(full.householdPatch.haltLeafBurning).toBe(true);
    expect(full.householdPatch.language).toBe('hi');

    // Invalid types, negative values, unknown enums, fractional share <= 1
    const invalid = sanitizeAiControlPayload(
      {
        switchToMemberId: 'unknown',
        addMemberName: 42,
        removeMemberId: null,
        cityQuery: '   ',
        role: 'astronaut',
        dailyOutdoorHours: -4,
        leaveHomeTime: 'not-a-time',
        returnHomeTime: 123,
        areaM2: Number.NaN,
        transitShiftShare: 0.4,
        haltLeafBurning: 'yes',
      },
      ws,
    );
    expect(invalid.switchToMemberId).toBeUndefined();
    expect(invalid.memberPatch.role).toBeUndefined();
    expect(invalid.memberPatch.dailyOutdoorHours).toBeUndefined();
    expect(invalid.householdPatch.transitShiftShare).toBe(0.4);
    expect(invalid.householdPatch.haltLeafBurning).toBeUndefined();
  });

  it('exercises naturalSiteControlExtractor across all indoor, community, role, language & summary branches', () => {
    const patch1 = extractSiteControlPatch(
      'My room size is 28 sqm with no air purifier, leaky windows, unvented lpg, commute distance is 18 km, 250 households, transit shift 70%, ban leaf burning, switch language to hindi, spend 4 hours outside, rename me to Kabir',
    );
    expect(patch1.householdPatch.areaM2).toBe(28);
    expect(patch1.householdPatch.cadrM3Hr).toBe(0);
    expect(patch1.householdPatch.tightness).toBe('leaky');
    expect(patch1.householdPatch.cookingFuel).toBe('lpg-unvented');
    expect(patch1.householdPatch.commuteDistanceKm).toBe(18);
    expect(patch1.householdPatch.householdsParticipating).toBe(250);
    expect(patch1.householdPatch.transitShiftShare).toBe(0.7);
    expect(patch1.householdPatch.haltLeafBurning).toBe(true);
    expect(patch1.householdPatch.language).toBe('hi');
    expect(patch1.memberPatch.dailyOutdoorHours).toBe(4);
    expect(patch1.memberPatch.label).toBe('Kabir');
    expect(summarizeHouseholdChanges(patch1.householdPatch).length).toBeGreaterThanOrEqual(8);

    const patch2 = extractSiteControlPatch(
      'Set CADR 360 m3/h, weather-sealed windows, vented lpg, allow leaf burning, switch to tamil',
    );
    expect(patch2.householdPatch.cadrM3Hr).toBe(360);
    expect(patch2.householdPatch.tightness).toBe('weather-sealed');
    expect(patch2.householdPatch.cookingFuel).toBe('lpg-vented');
    expect(patch2.householdPatch.haltLeafBurning).toBe(false);
    expect(patch2.householdPatch.language).toBe('ta');
    expect(summarizeHouseholdChanges(patch2.householdPatch).join(',')).toContain('allowed');

    const patch3 = extractSiteControlPatch(
      'Standard apartment windows with biomass wood stove, my profile is marathon swimmer',
    );
    expect(patch3.householdPatch.tightness).toBe('standard');
    expect(patch3.householdPatch.cookingFuel).toBe('solid-biomass');
    expect(patch3.memberPatch.role).toBe('commuter');

    const patch4 = extractSiteControlPatch(
      'My vulnerability profile is traffic police officer. Use induction stove.',
    );
    expect(patch4.customRoleCandidate).toContain('traffic police');
    expect(patch4.householdPatch.cookingFuel).toBe('induction');
  });

  it('exercises habitExtractor clock normalization, commute modes, masks, stopwords, member matching & ranges', () => {
    expect(normalizeClockTime('12', '00', 'am')).toBe('00:00');
    expect(normalizeClockTime('12', '30', 'pm')).toBe('12:30');
    expect(normalizeClockTime('25', '00', undefined)).toBeUndefined();
    expect(normalizeClockTime('10', '75', undefined)).toBeUndefined();
    expect(normalizeClockTime(undefined, '00', undefined)).toBeUndefined();

    expect(extractHabitUpdates('Take metro with n95 mask').commuteMode).toBe('metro');
    expect(extractHabitUpdates('School bus with surgical mask').commuteMode).toBe('electric-bus');
    expect(extractHabitUpdates('Electric car with cloth mask').commuteMode).toBe('ev-car');
    expect(extractHabitUpdates('Driving by car without mask').commuteMode).toBe('petrol-car');
    expect(extractHabitUpdates('Ride scooter daily').commuteMode).toBe('two-wheeler');
    expect(extractHabitUpdates('Cycling to park from 7am to 9am').commuteMode).toBe('cycling');
    expect(extractHabitUpdates('Walking in park with asthma inhaler').commuteMode).toBe('walking');
    expect(extractHabitUpdates('Wearing a mask today').mask).toBeUndefined();
    expect(extractHabitUpdates('Leave home at 10 and return home at 4').returnHomeTime).toBe(
      '16:00',
    );

    expect(extractLocationMention('I am at home today')).toBeNull();
    expect(extractLocationMention('I am in Salt Lake today')).toBe('Salt Lake');
    expect(shouldPersistLocationMention('Currently living in Kolkata')).toBe(true);
    expect(
      detectMentionedMemberId('Update member 2 schedule', DEFAULT_WORKSPACE_INPUT.members),
    ).toBe('m2');
    expect(detectMentionedMemberId('For Aarav tomorrow', DEFAULT_WORKSPACE_INPUT.members)).toBe(
      'm1',
    );
    expect(detectMentionedMemberId('Nobody matched', DEFAULT_WORKSPACE_INPUT.members)).toBeNull();
    expect(hasHabitPatch({})).toBe(false);
    expect(enrichDerivedOutdoorHours({ dailyOutdoorHours: 5 })).toEqual({ dailyOutdoorHours: 5 });
    expect(enrichDerivedOutdoorHours({ mask: 'cloth' })).toEqual({ mask: 'cloth' });
  });

  it('builds structured Gemini prompts across EN/HI/TA and dynamic indoor/chat templates across all states', () => {
    const bundle = buildInitialWorkspaceBundle(DEFAULT_WORKSPACE_INPUT);
    const bestCommute = bundle.commuteOptions[0]!;
    for (const lang of ['en', 'hi', 'ta'] as const) {
      const prompt = buildStructuredPrompt({
        request: {
          ...DEFAULT_WORKSPACE_INPUT,
          language: lang,
          members: [
            {
              ...DEFAULT_WORKSPACE_INPUT.members[0]!,
              leaveHomeTime: '08:00',
              healthNotes: 'asthma',
            },
            { ...DEFAULT_WORKSPACE_INPUT.members[1]!, leaveHomeTime: undefined },
          ],
        },
        aqi: bundle.telemetry.assessment,
        effectiveAqi: 260,
        inversion: bundle.telemetry.inversion,
        indoor: bundle.indoor,
        bestCommute,
        corridor: bundle.corridor,
        rwa: bundle.rwa,
      });
      expect(prompt).toContain(`language code "${lang}"`);

      for (const tightness of ['leaky', 'standard', 'weather-sealed'] as const) {
        for (const cookingFuel of [
          'induction',
          'lpg-vented',
          'lpg-unvented',
          'solid-biomass',
        ] as const) {
          const g = resolveDynamicIndoorGuidance(
            { ...DEFAULT_WORKSPACE_INPUT, language: lang, tightness, cookingFuel, cadrM3Hr: 0 },
            bundle.indoor,
            TRANSLATIONS[lang],
          );
          expect(g.diyActionChecklist.length).toBeGreaterThan(0);
          const gHigh = resolveDynamicIndoorGuidance(
            { ...DEFAULT_WORKSPACE_INPUT, language: lang, tightness, cookingFuel, cadrM3Hr: 600 },
            bundle.indoor,
            TRANSLATIONS[lang],
          );
          expect(gHigh.diySpecSummary.length).toBeGreaterThan(0);
        }
      }

      const chunksOpen = buildDeterministicChatChunks({
        query: 'air',
        city: 'Kolkata',
        language: lang,
        cpcbNaqi: 120,
        pm25UgM3: 48,
        inversionSeverity: 'neutral',
        openWindowsNow: true,
      });
      expect(chunksOpen.length).toBeGreaterThan(0);
    }
  });

  it('routes every Telegram slash command and inline callback branch cleanly', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response('{}', { status: 500 }))),
    );
    const ws = await syncWorkspaceFromWeb(
      { workspaceKey: 'routerws1', payload: DEFAULT_WORKSPACE_INPUT },
      TEST_ENV,
    );

    const commands = [
      'cmd:switchuser',
      '/air',
      '/schedule',
      '/family',
      '/indoor',
      '/commute',
      '/gear',
      '/rwa',
      '/gps',
      '/distance 14',
      '/distance invalid',
      '/route Salt Lake to Park Street',
      '/route invalid',
      'member:m2',
      'mask:cloth',
      'lang:ta',
      '/lang hi',
      'brief:toggle',
      '/brief on',
      '/brief off',
      '/room 24',
      '/cadr 320',
      '/fuel lpg',
      '/addmember Tara | caregiver | cloth',
      '/rwa 140 55',
    ];
    for (const cmd of commands) {
      const reply = await routeTelegramCommand(cmd, ws, TEST_ENV);
      expect(reply?.text.length).toBeGreaterThan(5);
    }
  });
});
