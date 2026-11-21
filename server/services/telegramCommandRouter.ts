import { VALIDATION_BOUNDS } from '../../src/config/constants.js';
import type { SupportedLanguage } from '../../src/validators/schemas.js';
import type { ServerEnv } from '../env.js';
import {
  updateWorkspaceFromTelegram,
  type SyncedWorkspaceRecord,
} from './householdWorkspaceStore.js';
import {
  buildFamilyRosterCard,
  buildLiveAirCard,
  buildScheduleCard,
  buildWindowIndoorCard,
  type TelegramReplyPayload,
} from './telegramCardBuilders.js';
import { DEFAULT_TELEGRAM_BUTTONS } from './telegramClient.js';
import {
  buildCommuteCard,
  buildControlsCard,
  buildCorridorCard,
  buildGearCard,
  buildRwaCard,
} from './telegramExtraCards.js';
import {
  handleAddMemberCommand,
  handleCityCommand,
  handleFuelCommand,
  handleMaskUpdate,
  handleMemberSwitch,
  handleRoomOrCadr,
  handleRwaCommand,
} from './telegramWorkspaceCommands.js';

export const DEFAULT_WEB_APP_URL = 'https://pranapulseai.vercel.app';

type SimpleHandler = (ws: SyncedWorkspaceRecord, env: ServerEnv) => Promise<TelegramReplyPayload>;
type ArgHandler = (
  rest: string,
  ws: SyncedWorkspaceRecord,
  env: ServerEnv,
) => Promise<TelegramReplyPayload>;

const GPS_PROMPT_REPLY: TelegramReplyPayload = {
  text: 'Tap "Share My Live GPS Location" below (or send a location pin) to switch your city and sync live with the website.',
  buttons: DEFAULT_TELEGRAM_BUTTONS,
  requestGpsKeyboard: true,
};

const SIMPLE_HANDLERS: Readonly<Record<string, SimpleHandler>> = {
  'cmd:air': buildLiveAirCard,
  '/air': buildLiveAirCard,
  air: buildLiveAirCard,
  'cmd:schedule': buildScheduleCard,
  '/schedule': buildScheduleCard,
  schedule: buildScheduleCard,
  '/brief': buildScheduleCard,
  'cmd:family': buildFamilyRosterCard,
  '/family': buildFamilyRosterCard,
  'cmd:windows': buildWindowIndoorCard,
  '/windows': buildWindowIndoorCard,
  windows: buildWindowIndoorCard,
  '/indoor': buildWindowIndoorCard,
  'cmd:commute': buildCommuteCard,
  '/commute': buildCommuteCard,
  'cmd:gear': buildGearCard,
  '/gear': buildGearCard,
  '/masks': buildGearCard,
  'cmd:rwa': buildRwaCard,
  '/rwa': buildRwaCard,
  'cmd:controls': (ws) => Promise.resolve(buildControlsCard(ws, DEFAULT_WEB_APP_URL)),
  '/controls': (ws) => Promise.resolve(buildControlsCard(ws, DEFAULT_WEB_APP_URL)),
  '/settings': (ws) => Promise.resolve(buildControlsCard(ws, DEFAULT_WEB_APP_URL)),
  '/menu': (ws) => Promise.resolve(buildControlsCard(ws, DEFAULT_WEB_APP_URL)),
  '/help': (ws) => Promise.resolve(buildControlsCard(ws, DEFAULT_WEB_APP_URL)),
  'gps:ask': () => Promise.resolve(GPS_PROMPT_REPLY),
  '/gps': () => Promise.resolve(GPS_PROMPT_REPLY),
};

async function handleDistanceCommand(
  rest: string,
  ws: SyncedWorkspaceRecord,
  env: ServerEnv,
): Promise<TelegramReplyPayload> {
  const km = Number.parseFloat(rest);
  if (!Number.isFinite(km) || km <= 0) {
    return await buildCommuteCard(ws, env);
  }
  const clamped = Math.max(1, Math.min(VALIDATION_BOUNDS.MAX_COMMUTE_KM, Math.round(km)));
  const updated = await updateWorkspaceFromTelegram(
    ws,
    { payload: { ...ws.payload, commuteDistanceKm: clamped } },
    env,
  );
  const card = await buildCommuteCard(updated, env);
  return {
    ...card,
    text: `Commute distance set to ${String(clamped)} km (synced).\n\n${card.text}`,
  };
}

async function handleRouteCommand(
  rest: string,
  ws: SyncedWorkspaceRecord,
  env: ServerEnv,
): Promise<TelegramReplyPayload> {
  const [fromRaw, toRaw] = rest.split(/\s+to\s+/i);
  if (!fromRaw?.trim() || !toRaw?.trim()) {
    return { text: 'Usage: /route Salt Lake to Park Street', buttons: DEFAULT_TELEGRAM_BUTTONS };
  }
  return await buildCorridorCard(ws, fromRaw.trim(), toRaw.trim(), env);
}

const ARG_HANDLERS: Readonly<Record<string, ArgHandler>> = {
  '/city': handleCityCommand,
  '/member': handleMemberSwitch,
  '/mask': handleMaskUpdate,
  '/addmember': handleAddMemberCommand,
  '/room': (r, ws, env) => handleRoomOrCadr('room', r, ws, env),
  '/cadr': (r, ws, env) => handleRoomOrCadr('cadr', r, ws, env),
  '/indoor': (r, ws, env) => handleRoomOrCadr('indoor', r, ws, env),
  '/fuel': handleFuelCommand,
  '/distance': handleDistanceCommand,
  '/route': handleRouteCommand,
  '/rwa': handleRwaCommand,
};

function resolveBriefToggle(lower: string, current: boolean): boolean | null {
  if (lower === 'brief:toggle') {
    return !current;
  }
  if (lower === '/brief on') {
    return true;
  }
  return lower === '/brief off' ? false : null;
}

async function handleLanguageSwitch(
  rawCode: string,
  ws: SyncedWorkspaceRecord,
  env: ServerEnv,
): Promise<TelegramReplyPayload> {
  const code = rawCode.trim().toLowerCase();
  const lang: SupportedLanguage = code === 'hi' || code === 'ta' ? code : 'en';
  const updated = await updateWorkspaceFromTelegram(
    ws,
    { payload: { ...ws.payload, language: lang } },
    env,
  );
  return buildControlsCard(updated, DEFAULT_WEB_APP_URL);
}

async function handlePreferenceCallbacks(
  lower: string,
  ws: SyncedWorkspaceRecord,
  env: ServerEnv,
): Promise<TelegramReplyPayload | null> {
  if (lower.startsWith('member:')) {
    return await handleMemberSwitch(lower.slice('member:'.length), ws, env);
  }
  if (lower.startsWith('mask:')) {
    return await handleMaskUpdate(lower.slice('mask:'.length), ws, env);
  }
  if (lower.startsWith('lang:') || lower.startsWith('/lang ')) {
    return await handleLanguageSwitch(lower.replace(/^(?:lang:|\/lang\s+)/, ''), ws, env);
  }
  const nextBrief = resolveBriefToggle(lower, ws.telegramOptIn);
  if (nextBrief !== null) {
    const updated = await updateWorkspaceFromTelegram(ws, { telegramOptIn: nextBrief }, env);
    return buildControlsCard(updated, DEFAULT_WEB_APP_URL);
  }
  return null;
}

/** Routes slash commands and inline keyboard callbacks across all 6 PranaPulse website modules. */
export async function routeTelegramCommand(
  rawText: string,
  ws: SyncedWorkspaceRecord,
  env: ServerEnv,
): Promise<TelegramReplyPayload | null> {
  const trimmed = rawText.trim();
  const lower = trimmed.toLowerCase();
  const simple = SIMPLE_HANDLERS[lower];
  if (simple) {
    return await simple(ws, env);
  }
  const pref = await handlePreferenceCallbacks(lower, ws, env);
  if (pref) {
    return pref;
  }
  const spaceIdx = trimmed.indexOf(' ');
  const cmd = (spaceIdx === -1 ? trimmed : trimmed.slice(0, spaceIdx)).toLowerCase();
  const rest = spaceIdx === -1 ? '' : trimmed.slice(spaceIdx + 1).trim();
  const argHandler = ARG_HANDLERS[cmd];
  return argHandler ? await argHandler(rest, ws, env) : null;
}
