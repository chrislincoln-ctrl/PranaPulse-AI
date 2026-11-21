import { VALIDATION_BOUNDS } from '../../src/config/constants.js';
import type { FamilyMemberInput, MaskTypeId } from '../../src/domain/types.js';
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
  buildWindowIndoorCard,
  prefixActiveUser,
  type TelegramReplyPayload,
} from './telegramCardBuilders.js';
import { buildTelegramMenuForMember } from './telegramClient.js';
import { buildGearCard, buildRwaCard } from './telegramExtraCards.js';
import { ROLE_ALIASES } from './telegramMemberCommands.js';
import { searchUrbanLocations } from './telemetryClients.js';

export { handleMemberSwitch, handleRoleCommand } from './telegramMemberCommands.js';

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

function clampNumber(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(val)));
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
  return { ...card, text: `${card.text}\n\nSynced: ${active.label}'s mask updated to ${mask}.` };
}

export async function handleCityCommand(
  query: string,
  ws: SyncedWorkspaceRecord,
  env: ServerEnv,
): Promise<TelegramReplyPayload> {
  const active = getActiveMember(ws);
  const clean = sanitizeUserText(query, VALIDATION_BOUNDS.MAX_CITY_QUERY_LEN);
  const top = clean ? (await searchUrbanLocations(clean))[0] : undefined;
  if (!top) {
    return {
      text: prefixActiveUser(
        ws,
        `Could not find "${clean}". Try /city Kolkata or share a live GPS pin.`,
      ),
      buttons: buildTelegramMenuForMember(active.label),
    };
  }
  const updated = await updateWorkspaceFromTelegram(
    ws,
    { payload: { ...ws.payload, city: top.name, lat: top.lat, lon: top.lon } },
    env,
  );
  const card = await buildLiveAirCard(updated, env);
  return { ...card, text: `${card.text}\n\nSynced: City updated to ${top.name}.` };
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
  return { ...card, text: `${card.text}\n\nSynced: Indoor settings updated on website.` };
}

export async function handleRoomOrCadr(
  kind: 'room' | 'cadr' | 'indoor',
  rest: string,
  ws: SyncedWorkspaceRecord,
  env: ServerEnv,
): Promise<TelegramReplyPayload> {
  const [n0, n1] = rest
    .split(/[\s,]+/)
    .map((n) => Number.parseFloat(n))
    .filter((n) => Number.isFinite(n));
  if (kind === 'room' && n0 !== undefined) {
    return await applyIndoorPatch(
      {
        areaM2: clampNumber(
          n0,
          VALIDATION_BOUNDS.MIN_ROOM_AREA_M2,
          VALIDATION_BOUNDS.MAX_ROOM_AREA_M2,
        ),
      },
      ws,
      env,
    );
  }
  if (kind === 'cadr' && n0 !== undefined) {
    return await applyIndoorPatch(
      { cadrM3Hr: clampNumber(n0, 0, VALIDATION_BOUNDS.MAX_CADR_M3_HR) },
      ws,
      env,
    );
  }
  const areaM2 =
    n0 !== undefined
      ? clampNumber(n0, VALIDATION_BOUNDS.MIN_ROOM_AREA_M2, VALIDATION_BOUNDS.MAX_ROOM_AREA_M2)
      : ws.payload.areaM2;
  const cadrM3Hr =
    n1 !== undefined ? clampNumber(n1, 0, VALIDATION_BOUNDS.MAX_CADR_M3_HR) : ws.payload.cadrM3Hr;
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
  const active = getActiveMember(ws);
  if (ws.payload.members.length >= VALIDATION_BOUNDS.MAX_FAMILY_MEMBERS) {
    return {
      text: prefixActiveUser(
        ws,
        `Family roster already has the maximum ${String(VALIDATION_BOUNDS.MAX_FAMILY_MEMBERS)} members.`,
      ),
      buttons: buildTelegramMenuForMember(active.label),
    };
  }
  const [rawName, rawRole, rawMask] = rawArgs.split('|').map((s) => s.trim());
  const label = sanitizeUserText(rawName ?? '', VALIDATION_BOUNDS.MAX_CITY_QUERY_LEN);
  if (!label) {
    return {
      text: prefixActiveUser(ws, 'Usage: /addmember Priya | child | n95'),
      buttons: buildTelegramMenuForMember(active.label),
    };
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
  return { ...card, text: `${card.text}\n\nSynced: Added ${label} to Family Care Roster.` };
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
  return { ...card, text: `${card.text}\n\nSynced: RWA simulator updated on website.` };
}
