import { computePlanPhysics } from '../../src/domain/localBaseline.js';
import { formatHourRange } from '../../src/domain/memberScheduleBuilder.js';
import type { MaskTypeId } from '../../src/domain/types.js';
import type { ServerEnv } from '../env.js';
import { buildMemberScheduleSnapshot } from './familyCompanionAgent.js';
import { getActiveMember, type SyncedWorkspaceRecord } from './householdWorkspaceStore.js';
import { ROLE_DISPLAY_NAMES } from './naturalSiteControlExtractor.js';
import { buildTelegramMenuForMember, type TelegramInlineButton } from './telegramClient.js';
import { getUrbanTelemetryBundle, type TelemetryBundle } from './telemetryClients.js';

export interface TelegramReplyPayload {
  readonly text: string;
  readonly buttons: readonly (readonly TelegramInlineButton[])[];
  readonly requestGpsKeyboard?: boolean;
}

const MAX_MEMBER_BTNS = 6;

export const MASK_LABELS: Readonly<Record<MaskTypeId, string>> = {
  'n95-ffp2': 'N95 / FFP2',
  surgical: 'Surgical',
  cloth: 'Cloth',
  none: 'No Mask',
};

export function buildWhatsAppUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

/** Prefixes every Telegram reply with the active household member & city so identity is always clear. */
export function prefixActiveUser(ws: SyncedWorkspaceRecord, body: string): string {
  const active = getActiveMember(ws);
  return `[Active User: ${active.label} | ${ws.payload.city}]\n${body}`;
}

/** Loads live atmospheric telemetry & deterministic physics snapshot for a synced Telegram workspace. */
export async function loadWorkspacePhysics(
  ws: SyncedWorkspaceRecord,
  env: ServerEnv,
): Promise<{
  readonly active: ReturnType<typeof getActiveMember>;
  readonly telemetry: TelemetryBundle;
  readonly physics: ReturnType<typeof computePlanPhysics>;
}> {
  const active = getActiveMember(ws);
  const telemetry = await getUrbanTelemetryBundle({
    lat: ws.payload.lat,
    lon: ws.payload.lon,
    cityLabel: ws.payload.city,
    env,
  });
  return { active, telemetry, physics: computePlanPhysics(ws.payload, telemetry) };
}

function buildMemberPickerRows(
  ws: SyncedWorkspaceRecord,
  compactName: boolean,
): (readonly TelegramInlineButton[])[] {
  const buttons: TelegramInlineButton[] = ws.payload.members
    .slice(0, MAX_MEMBER_BTNS)
    .map((m, i) => {
      const display = compactName ? (m.label.split(' ')[0] ?? m.label) : m.label;
      return {
        text: `${m.id === ws.activeMemberId ? '* ' : ''}${String(i + 1)}. ${display}`,
        callback_data: `member:${m.id}`,
      };
    });
  const rows: (readonly TelegramInlineButton[])[] = [];
  for (let idx = 0; idx < buttons.length; idx += 2) {
    rows.push(buttons.slice(idx, idx + 2));
  }
  return rows;
}

/** Builds a 1-tap "Who is chatting?" member selector card used on /start and "Change User". */
export function buildWhoAreYouCard(
  ws: SyncedWorkspaceRecord,
  introLine?: string,
): TelegramReplyPayload {
  const active = getActiveMember(ws);
  const rows = ws.payload.members.map((m, i) => {
    const tag = m.id === ws.activeMemberId ? ' [Current]' : '';
    const roleLabel = ROLE_DISPLAY_NAMES[m.role];
    const timing = m.leaveHomeTime ? ` | ${m.leaveHomeTime}-${m.returnHomeTime ?? ''}` : '';
    return `${String(i + 1)}. ${m.label}${tag} - ${roleLabel}${timing}`;
  });
  const header = introLine ?? `Who is chatting right now? (Current: ${active.label})`;
  const text = [
    header,
    `Location synced: ${ws.payload.city}`,
    '',
    'Tap your name below so all replies & website changes apply to your profile:',
    ...rows,
    '',
    'Your selection stays active until you tap "Change User" below any reply.',
  ].join('\n');
  return {
    text,
    buttons: [
      ...buildMemberPickerRows(ws, false),
      [
        { text: 'Live Air', callback_data: 'cmd:air' },
        { text: 'Controls & GPS', callback_data: 'cmd:controls' },
      ],
    ],
  };
}

/** Builds the active member's individualized live daily schedule brief (used by `/schedule` and daily cron). */
export async function buildLiveScheduleBrief(
  ws: SyncedWorkspaceRecord,
  env: ServerEnv,
): Promise<string> {
  const { active: member, telemetry } = await loadWorkspacePhysics(ws, env);
  const schedule = buildMemberScheduleSnapshot({
    member,
    city: ws.payload.city,
    lat: ws.payload.lat,
    lon: ws.payload.lon,
    language: ws.payload.language,
    areaM2: ws.payload.areaM2,
    cadrM3Hr: ws.payload.cadrM3Hr,
    telemetry,
  });
  return schedule.shareBriefText;
}

/** Builds the Dashboard Live Air & Atmospheric Telemetry card for Telegram. */
export async function buildLiveAirCard(
  ws: SyncedWorkspaceRecord,
  env: ServerEnv,
): Promise<TelegramReplyPayload> {
  const { active: member, telemetry } = await loadWorkspacePhysics(ws, env);
  const cur = telemetry.hourlySeries[0];
  const p = telemetry.currentPollutants;
  const aqi = telemetry.stationCrossCheck.effectiveSafetyAqi;
  const lines = [
    `Live Air & Dashboard: ${ws.payload.city}`,
    `- CPCB NAQI: ${String(aqi)} (${telemetry.assessment.cpcbCategory}) | US-EPA: ${String(telemetry.assessment.usEpaAqi)}`,
    `- PM2.5: ${String(Math.round(p.pm25UgM3))} ug/m3 | PM10: ${String(Math.round(p.pm10UgM3))} ug/m3`,
    `- NO2: ${String(Math.round(p.no2UgM3))} ug/m3 | O3: ${String(Math.round(p.o3UgM3))} ug/m3`,
    `- Mixing Ceiling (PBL): ${String(telemetry.inversion.currentPblMeters)}m (${telemetry.inversion.currentSeverity})`,
    `- Weather: Wind ${String(Math.round(cur?.windKmh ?? 0))} km/h | Humidity ${String(Math.round(cur?.rhPercent ?? 0))}%`,
    `- Ambient Load: ${String(telemetry.assessment.cigaretteEquivPerDay)} cig/day | Mask: ${MASK_LABELS[member.mask]}`,
    `Tip: Send /city <name> or tap Controls & GPS to change location.`,
  ];
  return {
    text: prefixActiveUser(ws, lines.join('\n')),
    buttons: buildTelegramMenuForMember(member.label),
  };
}

/** Builds the active member's daily schedule card with a 1-tap WhatsApp forward button. */
export async function buildScheduleCard(
  ws: SyncedWorkspaceRecord,
  env: ServerEnv,
): Promise<TelegramReplyPayload> {
  const member = getActiveMember(ws);
  const brief = await buildLiveScheduleBrief(ws, env);
  const buttons: (readonly TelegramInlineButton[])[] = [
    [{ text: 'Forward Brief to WhatsApp', url: buildWhatsAppUrl(brief) }],
    ...buildTelegramMenuForMember(member.label),
  ];
  return { text: prefixActiveUser(ws, brief), buttons };
}

/** Builds the Family Care Roster card listing every member with 1-tap active-member switch buttons. */
export async function buildFamilyRosterCard(
  ws: SyncedWorkspaceRecord,
  env: ServerEnv,
): Promise<TelegramReplyPayload> {
  const { active, physics } = await loadWorkspacePhysics(ws, env);
  const advMap = new Map(physics.memberAdvisories.map((a) => [a.id, a]));
  const rows = ws.payload.members.map((m, i) => {
    const activeTag = m.id === ws.activeMemberId ? ' [Active]' : '';
    const timing = m.leaveHomeTime ? `${m.leaveHomeTime}-${m.returnHomeTime ?? ''}` : 'Flexible';
    const dose = advMap.get(m.id)?.estimatedDailyInhaledUg ?? 0;
    return `${String(i + 1)}. ${m.label}${activeTag} (${ROLE_DISPLAY_NAMES[m.role]})\n   ${timing} | ${MASK_LABELS[m.mask]} | ~${String(dose)} ug/day`;
  });
  const body = [
    `Family Care Roster (${ws.payload.city})`,
    ...rows,
    '',
    'Tap a member below to switch, type any change (e.g. "I am a college student" or "leaving at 10:20, returning at 11:41 pm"), or send /addmember Name | child.',
  ].join('\n');
  return {
    text: prefixActiveUser(ws, body),
    buttons: [...buildMemberPickerRows(ws, true), ...buildTelegramMenuForMember(active.label)],
  };
}

/** Builds the Indoor & CADR / Window Safety card mirroring Tab 3 of the website. */
export async function buildWindowIndoorCard(
  ws: SyncedWorkspaceRecord,
  env: ServerEnv,
): Promise<TelegramReplyPayload> {
  const { active: member, telemetry, physics } = await loadWorkspacePhysics(ws, env);
  const openNow = telemetry.inversion.openWindowsNow;
  const cleanWin = formatHourRange(telemetry.inversion.bestWindowHours);
  const lines = [
    `Indoor & Windows: ${ws.payload.city}`,
    `- Open Windows Now: ${openNow ? 'YES (20-min cross-ventilation safe)' : 'NO (Keep windows & balcony sealed)'}`,
    `- Safest Airing Window: ${cleanWin} | PBL: ${String(telemetry.inversion.currentPblMeters)}m`,
    `- Room: ${String(ws.payload.areaM2)} m2 | Purifier: ${String(ws.payload.cadrM3Hr)} m3/hr | Windows: ${ws.payload.tightness} | Fuel: ${ws.payload.cookingFuel}`,
    `- Required CADR (4.8 ACH): ${String(physics.indoor.requiredCadr48Ach)} m3/hr (~${String(physics.indoor.purge90Minutes)} min 90% purge)`,
    `- Mitigated Indoor PM2.5: ${String(physics.indoor.dailyMeanMitigatedPm25)} ug/m3 (${String(physics.indoor.exposureReductionPct)}% reduction)`,
    'Update anytime: /room 25  |  /cadr 400  |  /fuel induction',
  ];
  return {
    text: prefixActiveUser(ws, lines.join('\n')),
    buttons: buildTelegramMenuForMember(member.label),
  };
}
