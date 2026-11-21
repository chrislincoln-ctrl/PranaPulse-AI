import { VALIDATION_BOUNDS } from '../../src/config/constants.js';
import type { FamilyMemberInput, FamilyRole, MaskTypeId } from '../../src/domain/types.js';
import { sanitizeUserText } from '../../src/utils/inputSanitizer.js';
import type { PlanRequestPayload } from '../../src/validators/schemas.js';
import type { ServerEnv } from '../env.js';
import {
  getActiveMember,
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
import { buildGearCard, buildRwaCard } from './telegramExtraCards.js';
import { searchUrbanLocations } from './telemetryClients.js';

type CookingFuelOption = PlanRequestPayload['cookingFuel'];

const MASK_ALIASES: Readonly<Record<string, MaskTypeId>> = {
  n95: 'n95-ffp2',
  'n95-ffp2': 'n95-ffp2',
  ffp2: 'n95-ffp2',
  kn95: 'n95-ffp2',
  surgical: 'surgical',
  cloth: 'cloth',
  none: 'none',
};

const FUEL_ALIASES: Readonly<Record<string, CookingFuelOption>> = {
  induction: 'induction',
  lpg: 'lpg-vented',
  'lpg-vented': 'lpg-vented',
  'lpg-unvented': 'lpg-unvented',
  unvented: 'lpg-unvented',
  biomass: 'solid-biomass',
  'solid-biomass': 'solid-biomass',
};

const ROLE_ALIASES: Readonly<Record<string, FamilyRole>> = {
  child: 'child',
  school: 'child',
  senior: 'senior-respiratory',
  'senior-respiratory': 'senior-respiratory',
  elder: 'senior-respiratory',
  commuter: 'commuter',
  office: 'commuter',
  caregiver: 'caregiver',
  home: 'caregiver',
};

function clampNumber(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(val)));
}

export async function handleMemberSwitch(
  arg: string,
  ws: SyncedWorkspaceRecord,
  env: ServerEnv,
): Promise<TelegramReplyPayload> {
  const clean = arg.trim().toLowerCase();
  const numIdx = Number.parseInt(clean, VALIDATION_BOUNDS.DECIMAL_BASE) - 1;
  const target =
    ws.payload.members.find((m) => m.id.toLowerCase() === clean) ??
    ws.payload.members[numIdx] ??
    ws.payload.members.find((m) => m.label.toLowerCase().includes(clean));
  if (!target) {
    return await buildFamilyRosterCard(ws, env);
  }
  const updated = await updateWorkspaceFromTelegram(ws, { activeMemberId: target.id }, env);
  const card = await buildScheduleCard(updated, env);
  return { ...card, text: `Active member switched to ${target.label} (synced).\n\n${card.text}` };
}

export async function handleMaskUpdate(
  rawMask: string,
  ws: SyncedWorkspaceRecord,
  env: ServerEnv,
): Promise<TelegramReplyPayload> {
  const mask = MASK_ALIASES[rawMask.trim().toLowerCase()];
  if (!mask) {
    return await buildGearCard(ws, env);
  }
  const active = getActiveMember(ws);
  const members = ws.payload.members.map((m) => (m.id === active.id ? { ...m, mask } : m));
  const updated = await updateWorkspaceFromTelegram(
    ws,
    { payload: { ...ws.payload, mask, members } },
    env,
  );
  const card = await buildGearCard(updated, env);
  return { ...card, text: `Updated ${active.label}'s mask to ${mask} (synced).\n\n${card.text}` };
}

export async function handleCityCommand(
  query: string,
  ws: SyncedWorkspaceRecord,
  env: ServerEnv,
): Promise<TelegramReplyPayload> {
  const clean = sanitizeUserText(query, VALIDATION_BOUNDS.MAX_CITY_QUERY_LEN);
  const top = clean ? (await searchUrbanLocations(clean))[0] : undefined;
  if (!top) {
    return {
      text: `Could not find "${clean}". Try /city Kolkata or share a live GPS pin.`,
      buttons: DEFAULT_TELEGRAM_BUTTONS,
    };
  }
  const updated = await updateWorkspaceFromTelegram(
    ws,
    { payload: { ...ws.payload, city: top.name, lat: top.lat, lon: top.lon } },
    env,
  );
  const card = await buildLiveAirCard(updated, env);
  return { ...card, text: `City updated to ${top.name} (synced to website).\n\n${card.text}` };
}

async function applyIndoorPatch(
  patch: Partial<PlanRequestPayload>,
  ws: SyncedWorkspaceRecord,
  env: ServerEnv,
): Promise<TelegramReplyPayload> {
  const updated = await updateWorkspaceFromTelegram(
    ws,
    { payload: { ...ws.payload, ...patch } },
    env,
  );
  const card = await buildWindowIndoorCard(updated, env);
  return { ...card, text: `Indoor settings synced to website.\n\n${card.text}` };
}

export async function handleRoomOrCadr(
  kind: 'room' | 'cadr' | 'indoor',
  rest: string,
  ws: SyncedWorkspaceRecord,
  env: ServerEnv,
): Promise<TelegramReplyPayload> {
  const nums = rest
    .split(/[\s,]+/)
    .map((n) => Number.parseFloat(n))
    .filter((n) => Number.isFinite(n));
  if (kind === 'room' && nums[0] !== undefined) {
    const areaM2 = clampNumber(
      nums[0],
      VALIDATION_BOUNDS.MIN_ROOM_AREA_M2,
      VALIDATION_BOUNDS.MAX_ROOM_AREA_M2,
    );
    return await applyIndoorPatch({ areaM2 }, ws, env);
  }
  if (kind === 'cadr' && nums[0] !== undefined) {
    return await applyIndoorPatch(
      { cadrM3Hr: clampNumber(nums[0], 0, VALIDATION_BOUNDS.MAX_CADR_M3_HR) },
      ws,
      env,
    );
  }
  const areaM2 =
    nums[0] !== undefined
      ? clampNumber(nums[0], VALIDATION_BOUNDS.MIN_ROOM_AREA_M2, VALIDATION_BOUNDS.MAX_ROOM_AREA_M2)
      : ws.payload.areaM2;
  const cadrM3Hr =
    nums[1] !== undefined
      ? clampNumber(nums[1], 0, VALIDATION_BOUNDS.MAX_CADR_M3_HR)
      : ws.payload.cadrM3Hr;
  return await applyIndoorPatch({ areaM2, cadrM3Hr }, ws, env);
}

export async function handleFuelCommand(
  rest: string,
  ws: SyncedWorkspaceRecord,
  env: ServerEnv,
): Promise<TelegramReplyPayload> {
  const fuel = FUEL_ALIASES[rest.trim().toLowerCase()];
  return fuel
    ? await applyIndoorPatch({ cookingFuel: fuel }, ws, env)
    : await buildWindowIndoorCard(ws, env);
}

export async function handleAddMemberCommand(
  rawArgs: string,
  ws: SyncedWorkspaceRecord,
  env: ServerEnv,
): Promise<TelegramReplyPayload> {
  if (ws.payload.members.length >= VALIDATION_BOUNDS.MAX_FAMILY_MEMBERS) {
    return {
      text: `Family roster already has the maximum ${String(VALIDATION_BOUNDS.MAX_FAMILY_MEMBERS)} members.`,
      buttons: DEFAULT_TELEGRAM_BUTTONS,
    };
  }
  const [rawName, rawRole, rawMask] = rawArgs.split('|').map((s) => s.trim());
  const label = sanitizeUserText(rawName ?? '', VALIDATION_BOUNDS.MAX_CITY_QUERY_LEN);
  if (!label) {
    return { text: 'Usage: /addmember Priya | child | n95', buttons: DEFAULT_TELEGRAM_BUTTONS };
  }
  const newMember: FamilyMemberInput = {
    id: `m${String(ws.payload.members.length + 1)}`,
    label,
    role: ROLE_ALIASES[(rawRole ?? '').toLowerCase()] ?? 'caregiver',
    mask: MASK_ALIASES[(rawMask ?? '').toLowerCase()] ?? 'n95-ffp2',
    dailyOutdoorHours: 1,
  };
  const updated = await updateWorkspaceFromTelegram(
    ws,
    {
      activeMemberId: newMember.id,
      payload: { ...ws.payload, members: [...ws.payload.members, newMember] },
    },
    env,
  );
  const card = await buildFamilyRosterCard(updated, env);
  return { ...card, text: `Added ${label} to Family Care Roster (synced).\n\n${card.text}` };
}

export async function handleRwaCommand(
  rest: string,
  ws: SyncedWorkspaceRecord,
  env: ServerEnv,
): Promise<TelegramReplyPayload> {
  const [hRaw, sRaw] = rest.split(/[\s,]+/).map((n) => Number.parseFloat(n));
  const householdsParticipating =
    hRaw !== undefined && Number.isFinite(hRaw)
      ? clampNumber(hRaw, VALIDATION_BOUNDS.MIN_HOUSEHOLDS, VALIDATION_BOUNDS.MAX_HOUSEHOLDS)
      : ws.payload.householdsParticipating;
  const transitShiftShare =
    sRaw !== undefined && Number.isFinite(sRaw)
      ? clampNumber(sRaw, 0, 100) / 100
      : ws.payload.transitShiftShare;
  const updated = await updateWorkspaceFromTelegram(
    ws,
    { payload: { ...ws.payload, householdsParticipating, transitShiftShare } },
    env,
  );
  const card = await buildRwaCard(updated, env);
  return { ...card, text: `RWA simulator updated (synced to website).\n\n${card.text}` };
}
