import { COMMUTE_PHYSICS } from '../../src/config/physicsConstants.js';
import { computePlanPhysics } from '../../src/domain/localBaseline.js';
import type { MaskTypeId } from '../../src/domain/types.js';
import type { ServerEnv } from '../env.js';
import { planCityCorridor } from './corridorPlanner.js';
import { getActiveMember, type SyncedWorkspaceRecord } from './householdWorkspaceStore.js';
import {
  buildWhatsAppUrl,
  MASK_LABELS,
  type TelegramReplyPayload,
} from './telegramCardBuilders.js';
import { DEFAULT_TELEGRAM_BUTTONS, type TelegramInlineButton } from './telegramClient.js';
import { getUrbanTelemetryBundle } from './telemetryClients.js';

const MAX_COMMUTE_ROWS = 5;
const MASK_KEYS: readonly MaskTypeId[] = ['n95-ffp2', 'surgical', 'cloth', 'none'];

/** Builds the Commute & Route comparison card mirroring Tab 4 of the website. */
export async function buildCommuteCard(
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
  const ranked = physics.commuteOptions.slice(0, MAX_COMMUTE_ROWS).map((opt, idx) => {
    const tag = opt.isParetoOptimal ? ' [Best]' : '';
    return `${String(idx + 1)}. ${opt.mode}${tag}: ${String(opt.durationMinutes)} min | ${String(opt.personalInhaledUg)} ug PM2.5 | ${String(opt.communityCo2Grams)}g CO2`;
  });
  const text = [
    `Commute & Route (${ws.payload.city}, ${String(ws.payload.commuteDistanceKm)} km, ${MASK_LABELS[ws.payload.mask]})`,
    ...ranked,
    '',
    'Commands: /distance 12  |  /route Salt Lake to Park Street',
  ].join('\n');
  return { text, buttons: DEFAULT_TELEGRAM_BUTTONS };
}

/** Computes a live origin-to-destination corridor recommendation for `/route <from> to <to>`. */
export async function buildCorridorCard(
  ws: SyncedWorkspaceRecord,
  fromArea: string,
  toArea: string,
  env: ServerEnv,
): Promise<TelegramReplyPayload> {
  const active = getActiveMember(ws);
  const mode = active.commuteMode ?? ws.payload.commuteMode;
  const plan = await planCityCorridor(
    { city: ws.payload.city, fromArea, toArea, commuteMode: mode, language: ws.payload.language },
    env,
  );
  const text = [
    `Corridor Plan (${ws.payload.city}): ${fromArea} -> ${toArea}`,
    `- Distance: ${String(plan.estimatedDistanceKm)} km | Mode: ${mode}`,
    `- Summary: ${plan.routeSummary}`,
  ].join('\n');
  const mapRow: readonly TelegramInlineButton[] = plan.googleMapsUrl
    ? [{ text: 'Open Route in Google Maps', url: plan.googleMapsUrl }]
    : [];
  const buttons =
    mapRow.length > 0 ? [mapRow, ...DEFAULT_TELEGRAM_BUTTONS] : DEFAULT_TELEGRAM_BUTTONS;
  return { text, buttons };
}

/** Builds the Masks & Purifiers gear comparison card with 1-tap inline mask switcher buttons. */
export async function buildGearCard(
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
  const physics = computePlanPhysics(ws.payload, telemetry);
  const pm25 = Math.round(telemetry.currentPollutants.pm25UgM3);
  const maskRows = MASK_KEYS.map((mk) => {
    const eff = Math.round(COMMUTE_PHYSICS.MASK_FILTRATION[mk] * 100);
    const activeMark = mk === member.mask ? ' [Selected]' : '';
    return `- ${MASK_LABELS[mk]}${activeMark}: blocks ~${String(eff)}% PM2.5`;
  });
  const maskBtns: readonly TelegramInlineButton[] = MASK_KEYS.map((mk) => ({
    text: `${mk === member.mask ? '* ' : ''}${MASK_LABELS[mk]}`,
    callback_data: `mask:${mk}`,
  }));
  const text = [
    `Masks & Purifiers (${ws.payload.city} | PM2.5 ${String(pm25)} ug/m3)`,
    ...maskRows,
    `- Purifier Target for ${String(ws.payload.areaM2)} m2: ${String(physics.indoor.requiredCadr48Ach)} m3/hr HEPA (or DIY MERV-13 Corsi-Rosenthal box)`,
    `Tap below to update ${member.label}'s mask (syncs to website):`,
  ].join('\n');
  return {
    text,
    buttons: [maskBtns.slice(0, 2), maskBtns.slice(2), ...DEFAULT_TELEGRAM_BUTTONS],
  };
}

/** Builds the RWA Community Simulator & Notice card with 1-tap WhatsApp forward button. */
export async function buildRwaCard(
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
  const aqi = telemetry.stationCrossCheck.effectiveSafetyAqi;
  const notice = [
    `PranaPulse AI: ${ws.payload.city} RWA Notice`,
    `CPCB NAQI: ${String(aqi)} (${telemetry.assessment.cpcbCategory})`,
    telemetry.inversion.openWindowsNow
      ? 'Brief midday cross-ventilation window open'
      : 'Keep windows sealed (trapping active)',
    `Participating homes: ${String(ws.payload.householdsParticipating)} | Daily CO2 avoided: ${String(physics.rwa.dailyCo2SavedKg)} kg | Daily PM2.5 avoided: ${String(physics.rwa.dailyPm25AvoidedG)} g`,
  ].join('\n');
  const text = `${notice}\n\nAdjust anytime: /rwa 150 60 (homes & transit shift %)`;
  const buttons: (readonly TelegramInlineButton[])[] = [
    [{ text: 'Share RWA Notice on WhatsApp', url: buildWhatsAppUrl(notice) }],
    ...DEFAULT_TELEGRAM_BUTTONS,
  ];
  return { text, buttons };
}

/** Builds the Controls, GPS & Synced Web Dashboard hub card. */
export function buildControlsCard(
  ws: SyncedWorkspaceRecord,
  webBaseUrl: string,
): TelegramReplyPayload {
  const member = getActiveMember(ws);
  const syncedUrl = `${webBaseUrl}/?ws=${encodeURIComponent(ws.workspaceKey)}`;
  const text = [
    `PranaPulse Telegram Operating Hub`,
    `- Active City: ${ws.payload.city} (${ws.payload.lat.toFixed(2)}, ${ws.payload.lon.toFixed(2)})`,
    `- Active Member: ${member.label} (${member.leaveHomeTime ?? '--'} to ${member.returnHomeTime ?? '--'})`,
    `- Language: ${ws.payload.language.toUpperCase()} | Daily 06:30 Brief: ${ws.telegramOptIn ? 'ON' : 'OFF'}`,
    '',
    'Everything you change here syncs live with your website:',
    '- /city Kolkata   (change city)',
    '- /room 25  |  /cadr 400  |  /fuel induction',
    '- /distance 12  |  /route Salt Lake to Park Street',
    '- /rwa 150 60  |  /addmember Priya | child',
    '- Or chat naturally (e.g. "I will be leaving home at 10:20 and returning home at 11:41 pm")',
  ].join('\n');
  const buttons: (readonly TelegramInlineButton[])[] = [
    [{ text: 'Share Live GPS Location', callback_data: 'gps:ask' }],
    [
      { text: `${ws.payload.language === 'en' ? '* ' : ''}EN`, callback_data: 'lang:en' },
      { text: `${ws.payload.language === 'hi' ? '* ' : ''}HI`, callback_data: 'lang:hi' },
      { text: `${ws.payload.language === 'ta' ? '* ' : ''}TA`, callback_data: 'lang:ta' },
    ],
    [
      {
        text: `Daily 06:30 Brief: ${ws.telegramOptIn ? 'ON' : 'OFF'}`,
        callback_data: 'brief:toggle',
      },
      { text: 'Open Synced Website', url: syncedUrl },
    ],
    ...DEFAULT_TELEGRAM_BUTTONS,
  ];
  return { text, buttons };
}
