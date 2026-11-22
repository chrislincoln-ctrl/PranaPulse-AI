import { FAMILY_RISK_WEIGHTS } from '../config/physicsConstants.js';
import { MEMBER_SCHEDULE_STRINGS, type MemberStepVars } from '../i18n/memberScheduleCopy.js';
import { TRANSLATIONS } from '../i18n/translations.js';
import type { DeterministicBriefContext } from './fallbackPlanBuilder.js';
import type { FamilyMemberInput, MemberRoutineArchetype, RoutineStepItem } from './types.js';
import type { AiPlanOutput } from '../validators/schemas.js';

type MutableMemberSchedule = NonNullable<AiPlanOutput['memberSchedules']>[number];

const HIGH_AQI_LIMIT = FAMILY_RISK_WEIGHTS.HIGH_RISK_CPCB_THRESHOLD;
const DEFAULT_BREAKUP_HOUR = 13;

const ARCHETYPE_DEFAULT_TIMES: Readonly<
  Record<MemberRoutineArchetype, { readonly leave: string; readonly ret: string }>
> = {
  'school-student': { leave: '07:30', ret: '14:30' },
  'office-commuter': { leave: '08:45', ret: '19:00' },
  'senior-homebound': { leave: '13:30', ret: '14:00' },
  'outdoor-active': { leave: '13:30', ret: '15:00' },
  'home-caregiver': { leave: '11:30', ret: '13:00' },
};

/** Infers the most fitting routine archetype when a legacy member omits `archetype`. */
export function resolveMemberArchetype(member: FamilyMemberInput): MemberRoutineArchetype {
  if (member.archetype) {
    return member.archetype;
  }
  if (member.role === 'child') {
    return 'school-student';
  }
  if (member.role === 'senior-respiratory') {
    return 'senior-homebound';
  }
  if (member.role === 'commuter') {
    return 'office-commuter';
  }
  return 'home-caregiver';
}

/** Formats an hour-of-day array into a readable ventilation window range (e.g. "13:00 - 15:59"). */
export function formatHourRange(hours: readonly number[]): string {
  if (hours.length === 0) {
    return '13:00 - 15:00';
  }
  const first = hours[0] ?? DEFAULT_BREAKUP_HOUR;
  const last = hours[hours.length - 1] ?? first;
  return `${String(first).padStart(2, '0')}:00 - ${String(last).padStart(2, '0')}:59`;
}

/** Formats a concise, mobile-friendly Telegram / WhatsApp daily brief for a single family member. */
export function buildMemberShareBriefText(
  member: FamilyMemberInput,
  steps: readonly RoutineStepItem[],
  ctx: DeterministicBriefContext,
): string {
  const pack = MEMBER_SCHEDULE_STRINGS[ctx.request.language];
  const lines = [
    `${pack.briefHeader}: ${member.label}`,
    `${ctx.request.city} | CPCB NAQI ${String(ctx.effectiveAqi)} (${ctx.aqi.cpcbCategory}) | PBL ${String(ctx.inversion.currentPblMeters)}m`,
    ...steps.map(
      (step) => `- ${step.timeWindow}: ${step.actionTitle} (${step.estimatedImpactLabel})`,
    ),
    pack.briefReplyHint,
  ];
  return lines.join('\n');
}

function buildStepVars(
  member: FamilyMemberInput,
  archetype: MemberRoutineArchetype,
  ctx: DeterministicBriefContext,
  cleanWindow: string,
): MemberStepVars {
  const t = TRANSLATIONS[ctx.request.language];
  const defaults = ARCHETYPE_DEFAULT_TIMES[archetype];
  const commuteMode = member.commuteMode ?? ctx.bestCommute.mode;
  return {
    archetype,
    leave: member.leaveHomeTime ?? defaults.leave,
    ret: member.returnHomeTime ?? defaults.ret,
    cleanWindow,
    maskLabel: t.maskOptions[member.mask],
    commuteLabel: t.commuteModes[commuteMode],
    fuelLabel: t.fuelOptions[ctx.request.cookingFuel],
    effectiveAqi: ctx.effectiveAqi,
    pblMeters: ctx.inversion.currentPblMeters,
    corridorSavedPct: ctx.corridor.exposureSavedPct,
    indoorCadr: ctx.indoor.requiredCadr48Ach,
    purgeMinutes: ctx.indoor.purge90Minutes,
    indoorMitigatedPm25: ctx.indoor.dailyMeanMitigatedPm25,
    indoorReductionPct: ctx.indoor.exposureReductionPct,
    isHighRisk: ctx.effectiveAqi >= HIGH_AQI_LIMIT,
    healthNotes: member.healthNotes,
    dailyHabitsNote: member.dailyHabitsNote,
  };
}

/** Builds individualized 4-step schedules and share briefs for every member in the household roster. */
export function buildPerMemberSchedules(ctx: DeterministicBriefContext): MutableMemberSchedule[] {
  const pack = MEMBER_SCHEDULE_STRINGS[ctx.request.language];
  const cleanWindow = formatHourRange(ctx.inversion.bestWindowHours);

  return ctx.request.members.map((member) => {
    const archetype = resolveMemberArchetype(member);
    const stepVars = buildStepVars(member, archetype, ctx, cleanWindow);
    const dailyRoutine = [...pack.buildSteps(stepVars)];
    return {
      memberId: member.id,
      memberLabel: member.label,
      archetype,
      summaryHeadline: `${member.label} (${pack.archetypeTitles[archetype]}) | ${ctx.request.city} NAQI ${String(ctx.effectiveAqi)}`,
      dailyRoutine,
      shareBriefText: buildMemberShareBriefText(member, dailyRoutine, ctx),
    };
  });
}
