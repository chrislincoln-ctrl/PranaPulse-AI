import { describe, expect, it } from 'vitest';
import { DEFAULT_WORKSPACE_INPUT } from '../../src/config/uiConstants.js';
import { buildDeterministicFallbackPlan } from '../../src/domain/fallbackPlanBuilder.js';
import { buildInitialWorkspaceBundle } from '../../src/domain/localBaseline.js';
import {
  buildPerMemberSchedules,
  resolveMemberArchetype,
} from '../../src/domain/memberScheduleBuilder.js';
import {
  extractHabitUpdates,
  extractLocationMention,
  hasHabitPatch,
} from '../../server/services/habitExtractor.js';

describe('Per-member daily schedule engine & habit extraction', () => {
  it('generates genuinely distinct schedules for Aarav (school), Meera (senior asthma), and Rohan (commuter)', () => {
    const bundle = buildInitialWorkspaceBundle(DEFAULT_WORKSPACE_INPUT);
    const schedules = bundle.aiPlan.memberSchedules ?? [];

    expect(schedules).toHaveLength(3);
    const [aarav, meera, rohan] = schedules;
    expect(aarav?.archetype).toBe('school-student');
    expect(meera?.archetype).toBe('senior-homebound');
    expect(rohan?.archetype).toBe('office-commuter');

    expect(aarav?.dailyRoutine[0]?.timeWindow).toContain('07:30');
    expect(aarav?.dailyRoutine[2]?.timeWindow).toContain('14:30');
    expect(aarav?.dailyRoutine[0]?.actionTitle).toContain('School');

    expect(meera?.dailyRoutine[0]?.actionTitle).toContain('Inhaler');
    expect(meera?.dailyRoutine[0]?.reasonSummary).toMatch(/asthma/i);

    expect(rohan?.dailyRoutine[0]?.timeWindow).toContain('08:45');
    expect(rohan?.dailyRoutine[2]?.timeWindow).toContain('19:00');
    expect(rohan?.dailyRoutine[0]?.reasonSummary).toContain('Metro');

    expect(aarav?.shareBriefText).not.toEqual(meera?.shareBriefText);
    expect(meera?.shareBriefText).toContain('Meera');
  });

  it('infers archetypes cleanly for legacy members without archetype and reacts to custom times', () => {
    expect(
      resolveMemberArchetype({
        id: 'legacy1',
        label: 'Child',
        role: 'child',
        mask: 'n95-ffp2',
        dailyOutdoorHours: 2,
      }),
    ).toBe('school-student');

    expect(
      resolveMemberArchetype({
        id: 'legacy2',
        label: 'Elder',
        role: 'senior-respiratory',
        mask: 'n95-ffp2',
        dailyOutdoorHours: 0.5,
      }),
    ).toBe('senior-homebound');

    const customInput = {
      ...DEFAULT_WORKSPACE_INPUT,
      members: [
        {
          ...DEFAULT_WORKSPACE_INPUT.members[0]!,
          leaveHomeTime: '08:15',
          returnHomeTime: '15:45',
          healthNotes: 'Mild seasonal wheezing',
        },
      ],
    };
    const bundle = buildInitialWorkspaceBundle(customInput);
    const [sched] = buildPerMemberSchedules({
      request: customInput,
      aqi: bundle.telemetry.assessment,
      effectiveAqi: bundle.telemetry.stationCrossCheck.effectiveSafetyAqi,
      inversion: bundle.telemetry.inversion,
      indoor: bundle.indoor,
      bestCommute: bundle.commuteOptions[0]!,
      corridor: bundle.corridor,
      rwa: bundle.rwa,
    });

    expect(sched?.dailyRoutine[0]?.timeWindow).toContain('08:15');
    expect(sched?.dailyRoutine[2]?.timeWindow).toContain('15:45');
    expect(sched?.dailyRoutine[1]?.reasonSummary).toContain('Mild seasonal wheezing');
  });

  it('produces localized Hindi and Tamil per-member schedules inside deterministic plans', () => {
    const base = buildInitialWorkspaceBundle(DEFAULT_WORKSPACE_INPUT);
    for (const lang of ['hi', 'ta'] as const) {
      const plan = buildDeterministicFallbackPlan({
        request: { ...DEFAULT_WORKSPACE_INPUT, language: lang },
        aqi: base.telemetry.assessment,
        effectiveAqi: base.telemetry.stationCrossCheck.effectiveSafetyAqi,
        inversion: base.telemetry.inversion,
        indoor: base.indoor,
        bestCommute: base.commuteOptions[0]!,
        corridor: base.corridor,
        rwa: base.rwa,
      });

      expect(plan.memberSchedules).toHaveLength(3);
      const serialized = JSON.stringify(plan.memberSchedules);
      expect(serialized).not.toContain('School Departure');
      expect(serialized).not.toContain('Strict Morning Indoor Seal');
      if (lang === 'hi') {
        expect(serialized).toContain('स्कूल');
      } else {
        expect(serialized).toContain('பள்ளி');
      }
    }
  });

  it('extracts natural-language location mentions and habit updates accurately', () => {
    expect(extractLocationMention('I am outside near Salt Lake right now, how is the air?')).toBe(
      'Salt Lake',
    );
    expect(extractLocationMention('I am at home today')).toBeNull();

    const patch = extractHabitUpdates(
      'My school timing is 7:45am to 2:30pm via school bus, mild asthma today',
    );
    expect(hasHabitPatch(patch)).toBe(true);
    expect(patch.leaveHomeTime).toBe('07:45');
    expect(patch.returnHomeTime).toBe('14:30');
    expect(patch.commuteMode).toBe('electric-bus');
    expect(patch.healthNotes).toContain('asthma');
  });
});
