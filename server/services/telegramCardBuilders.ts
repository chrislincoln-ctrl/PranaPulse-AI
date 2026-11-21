import { computePlanPhysics } from '../../src/domain/localBaseline.js';
import type { MaskTypeId } from '../../src/domain/types.js';
import type { ServerEnv } from '../env.js';
import { buildMemberScheduleSnapshot } from './familyCompanionAgent.js';
import { getActiveMember, type SyncedWorkspaceRecord } from './householdWorkspaceStore.js';
import { DEFAULT_TELEGRAM_BUTTONS, type TelegramInlineButton } from './telegramClient.js';
import { getUrbanTelemetryBundle } from './telemetryClients.js';

export interface TelegramReplyPayload {
  readonly text: string;
  readonly buttons: readonly (readonly TelegramInlineButton[])[];
  readonly requestGpsKeyboard?: boolean;
}

const DEFAULT_CLEAN_HOUR = 13;
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

function formatWindowRange(hours: readonly number[]): string {
  if (hours.length === 0) {
    return '13:00 - 15:00';
  }
  const first = hours[0] ?? DEFAULT_CLEAN_HOUR;
  const last = hours[hours.length - 1] ?? first;
  return `${String(first).padStart(2, '0')}:00 - ${String(last).padStart(2, '0')}:59`;
}

/** Builds the active member's individualized live daily schedule brief (used by `/schedule` and daily cron). */
export async function buildLiveScheduleBrief(
  ws: SyncedWorkspaceRecord,
  env: ServerEnv,
): Promise<string> {
  const member = getActiveMember(ws);
  const telemetry = await getUrbanTelemetryBundle({
    lat: ws.payload.lat,
    lon: ws.payload.lon,
    cityLabel: ws.payload.city,
    env,
  });
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
  const member = getActiveMember(ws);
  const telemetry = await getUrbanTelemetryBundle({
    lat: ws.payload.lat,
    lon: ws.payload.lon,
    cityLabel: ws.payload.city,
    env,
  });
  const cur = telemetry.hourlySeries[0];
  const p = telemetry.currentPollutants;
  const aqi = telemetry.stationCrossCheck.effectiveSafetyAqi;
  const lines = [
    `Live Air & Dashboard: ${ws.payload.city} (${member.label})`,
    `- CPCB NAQI: ${String(aqi)} (${telemetry.assessment.cpcbCategory}) | US-EPA: ${String(telemetry.assessment.usEpaAqi)}`,
    `- PM2.5: ${String(Math.round(p.pm25UgM3))} ug/m3 | PM10: ${String(Math.round(p.pm10UgM3))} ug/m3`,
    `- NO2: ${String(Math.round(p.no2UgM3))} ug/m3 | O3: ${String(Math.round(p.o3UgM3))} ug/m3`,
    `- Mixing Ceiling (PBL): ${String(telemetry.inversion.currentPblMeters)}m (${telemetry.inversion.currentSeverity})`,
    `- Weather: Wind ${String(Math.round(cur?.windKmh ?? 0))} km/h | Humidity ${String(Math.round(cur?.rhPercent ?? 0))}%`,
    `- Ambient Load: ${String(telemetry.assessment.cigaretteEquivPerDay)} cig/day | Mask: ${MASK_LABELS[member.mask]}`,
    `Tip: Send /city <name> or tap Controls & GPS to change location.`,
  ];
  return { text: lines.join('\n'), buttons: DEFAULT_TELEGRAM_BUTTONS };
}

/** Builds the active member's daily schedule card with a 1-tap WhatsApp forward button. */
export async function buildScheduleCard(
  ws: SyncedWorkspaceRecord,
  env: ServerEnv,
): Promise<TelegramReplyPayload> {
  const brief = await buildLiveScheduleBrief(ws, env);
  const buttons: (readonly TelegramInlineButton[])[] = [
    [{ text: 'Forward Brief to WhatsApp', url: buildWhatsAppUrl(brief) }],
    ...DEFAULT_TELEGRAM_BUTTONS,
  ];
  return { text: brief, buttons };
}

/** Builds the Family Care Roster card listing every member with 1-tap active-member switch buttons. */
export async function buildFamilyRosterCard(
  ws: SyncedWorkspaceRecord,
  env: ServerEnv,
): Promise<TelegramReplyPayload> {
  const telemetry = await getUrbanTelemetryBundle({
    lat: ws.payload.lat,
    lon: ws.payload.lon,
    cityLabel: ws.payload.city,
    env,
  });
  const physics = computePlanPhysics(ws.payload, telemetry);
  const advMap = new Map(physics.memberAdvisories.map((a) => [a.id, a]));
  const rows = ws.payload.members.map((m, i) => {
    const activeTag = m.id === ws.activeMemberId ? ' [Active]' : '';
    const timing = m.leaveHomeTime ? `${m.leaveHomeTime}-${m.returnHomeTime ?? ''}` : 'Flexible';
    const dose = advMap.get(m.id)?.estimatedDailyInhaledUg ?? 0;
    return `${String(i + 1)}. ${m.label}${activeTag}\n   ${timing} | ${MASK_LABELS[m.mask]} | ~${String(dose)} ug/day`;
  });
  const memberBtns: TelegramInlineButton[] = ws.payload.members
    .slice(0, MAX_MEMBER_BTNS)
    .map((m, i) => ({
      text: `${m.id === ws.activeMemberId ? '* ' : ''}${String(i + 1)}. ${m.label.split(' ')[0] ?? m.label}`,
      callback_data: `member:${m.id}`,
    }));
  const btnRows: (readonly TelegramInlineButton[])[] = [];
  for (let idx = 0; idx < memberBtns.length; idx += 2) {
    btnRows.push(memberBtns.slice(idx, idx + 2));
  }
  const text = [
    `Family Care Roster (${ws.payload.city})`,
    ...rows,
    '',
    'Tap a member below to switch, type new timings (e.g. "leaving home at 10:20 and returning home at 11:41 pm"), or send /addmember Name | child.',
  ].join('\n');
  return { text, buttons: [...btnRows, ...DEFAULT_TELEGRAM_BUTTONS] };
}

/** Builds the Indoor & CADR / Window Safety card mirroring Tab 3 of the website. */
export async function buildWindowIndoorCard(
  ws: SyncedWorkspaceRecord,
  env: ServerEnv,
): Promise<TelegramReplyPayload> {
  const telemetry = await getUrbanTelemetryBundle({
    lat: ws.payload.lat,
    lon: ws.payload.lon,
    cityLabel: ws.payload.city,
    env,
  });
  const physics = computePlanPhysics(ws.payload, telemetry);
  const openNow = telemetry.inversion.openWindowsNow;
  const cleanWin = formatWindowRange(telemetry.inversion.bestWindowHours);
  const lines = [
    `Indoor & Windows: ${ws.payload.city}`,
    `- Open Windows Now: ${openNow ? 'YES (20-min cross-ventilation safe)' : 'NO (Keep windows & balcony sealed)'}`,
    `- Safest Airing Window: ${cleanWin} | PBL: ${String(telemetry.inversion.currentPblMeters)}m`,
    `- Room: ${String(ws.payload.areaM2)} m2 | Your Purifier: ${String(ws.payload.cadrM3Hr)} m3/hr | Fuel: ${ws.payload.cookingFuel}`,
    `- Required CADR (4.8 ACH): ${String(physics.indoor.requiredCadr48Ach)} m3/hr (~${String(physics.indoor.purge90Minutes)} min 90% purge)`,
    `- Mitigated Indoor PM2.5: ${String(physics.indoor.dailyMeanMitigatedPm25)} ug/m3 (${String(physics.indoor.exposureReductionPct)}% reduction)`,
    'Update anytime: /room 25  |  /cadr 400  |  /fuel induction',
  ];
  return { text: lines.join('\n'), buttons: DEFAULT_TELEGRAM_BUTTONS };
}
