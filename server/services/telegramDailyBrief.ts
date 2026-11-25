import type { ServerEnv } from '../env.js';
import {
  getActiveMember,
  listOptedInWorkspaces,
  markWorkspaceBriefSent,
} from './householdWorkspaceStore.js';
import { buildLiveScheduleBrief, prefixActiveUser } from './telegramCardBuilders.js';
import { buildTelegramMenuForMember, sendTelegramMessage } from './telegramClient.js';

async function sendSingleBrief(
  ws: Awaited<ReturnType<typeof listOptedInWorkspaces>>[number],
  env: ServerEnv,
): Promise<boolean> {
  if (!ws.telegramChatId) {
    return false;
  }
  try {
    const active = getActiveMember(ws);
    const brief = prefixActiveUser(ws, await buildLiveScheduleBrief(ws, env));
    const ok = env.TELEGRAM_BOT_TOKEN
      ? await sendTelegramMessage(
          env.TELEGRAM_BOT_TOKEN,
          ws.telegramChatId,
          brief,
          buildTelegramMenuForMember(active.label),
        )
      : true;
    if (ok) {
      await markWorkspaceBriefSent(ws, env);
    }
    return ok;
  } catch {
    return false;
  }
}

/** Sends individualized daily air briefs across all opted-in Telegram workspaces with per-household error isolation. */
export async function runDailyBriefFanout(
  env: ServerEnv,
): Promise<{ readonly sentCount: number; readonly skippedCount: number }> {
  const workspaces = await listOptedInWorkspaces(env);
  let sentCount = 0;
  let skippedCount = 0;
  for (const ws of workspaces) {
    if (await sendSingleBrief(ws, env)) {
      sentCount += 1;
    } else {
      skippedCount += 1;
    }
  }
  return { sentCount, skippedCount };
}
