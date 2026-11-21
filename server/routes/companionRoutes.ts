import { Router, type Request, type Response } from 'express';
import { HTTP_STATUS, SECURITY_LIMITS } from '../../src/config/constants.js';
import { DEFAULT_WORKSPACE_INPUT } from '../../src/config/uiConstants.js';
import {
  companionChatRequestSchema,
  telegramLinkRequestSchema,
  workspaceKeySchema,
  workspaceSyncPostSchema,
  type TelegramLinkRequest,
} from '../../src/validators/companionSchemas.js';
import type { ServerEnv } from '../env.js';
import { SlidingWindowRateLimiter } from '../services/cacheAndLimiter.js';
import { handleCompanionCheckin } from '../services/familyCompanionAgent.js';
import {
  recordCompanionCheckin,
  updateMemberHabitsByProfileId,
  upsertMemberProfile,
} from '../services/familyCompanionStore.js';
import { hasHabitPatch } from '../services/habitExtractor.js';
import {
  createWorkspaceTelegramLink,
  getWorkspaceByKey,
  listOptedInWorkspaces,
  markWorkspaceBriefSent,
  syncWorkspaceFromWeb,
  type WebWorkspaceSyncInput,
} from '../services/householdWorkspaceStore.js';
import {
  buildTelegramDeepLink,
  DEFAULT_TELEGRAM_BUTTONS,
  sendTelegramMessage,
  verifyBearerSecret,
  verifyTelegramWebhookSecret,
  type TelegramWebhookUpdate,
} from '../services/telegramClient.js';
import {
  buildLiveScheduleBrief,
  processTelegramUpdate,
} from '../services/telegramWebhookHandler.js';

function normalizeTelegramLinkInput(parsed: TelegramLinkRequest): WebWorkspaceSyncInput {
  if ('payload' in parsed) {
    return {
      workspaceKey: parsed.workspaceKey,
      payload: parsed.payload,
      activeMemberId: parsed.activeMemberId,
      userId: parsed.userId,
    };
  }
  const rest = DEFAULT_WORKSPACE_INPUT.members.filter((m) => m.id !== parsed.member.id);
  return {
    workspaceKey: parsed.workspaceKey,
    activeMemberId: parsed.member.id,
    userId: parsed.userId,
    payload: {
      ...DEFAULT_WORKSPACE_INPUT,
      city: parsed.city,
      lat: parsed.lat,
      lon: parsed.lon,
      language: parsed.language,
      mask: parsed.member.mask,
      commuteMode: parsed.member.commuteMode ?? DEFAULT_WORKSPACE_INPUT.commuteMode,
      members: [parsed.member, ...rest],
    },
  };
}

async function handleCompanionChat(req: Request, res: Response, env: ServerEnv): Promise<void> {
  const parsed = companionChatRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res
      .status(HTTP_STATUS.BAD_REQUEST)
      .json({ error: 'Provide a valid family member, message, and city coordinates.' });
    return;
  }
  const p = parsed.data;
  const profile = await upsertMemberProfile(
    { member: p.member, city: p.city, lat: p.lat, lon: p.lon, language: p.language },
    env,
  );
  const result = await handleCompanionCheckin({ ...p, channel: 'web' }, env);
  if (hasHabitPatch(result.habitPatch)) {
    await updateMemberHabitsByProfileId(profile.id, result.habitPatch, env);
  }
  await recordCompanionCheckin(
    {
      memberProfileId: profile.id,
      channel: 'web',
      direction: 'inbound',
      messageText: p.message,
      detectedCity: result.resolvedCity,
      detectedLat: result.resolvedLat,
      detectedLon: result.resolvedLon,
      extractedHabitNote: result.habitPatch.dailyHabitsNote ?? result.habitPatch.healthNotes,
      aqiSnapshot: result.aqi,
    },
    env,
  );
  res.status(HTTP_STATUS.OK).json(result);
}

async function handleTelegramLink(req: Request, res: Response, env: ServerEnv): Promise<void> {
  const parsed = telegramLinkRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res
      .status(HTTP_STATUS.BAD_REQUEST)
      .json({ error: 'Provide a valid family member and city to create a Telegram link.' });
    return;
  }
  const { workspace, linkCode } = await createWorkspaceTelegramLink(
    normalizeTelegramLinkInput(parsed.data),
    env,
  );
  const botUsername = env.TELEGRAM_BOT_USERNAME ?? null;
  const telegramConfigured = Boolean(env.TELEGRAM_BOT_TOKEN && botUsername);
  const deepLinkUrl = botUsername ? buildTelegramDeepLink(botUsername, linkCode) : null;
  res.status(HTTP_STATUS.OK).json({
    linkCode,
    deepLinkUrl,
    telegramConfigured,
    botUsername,
    workspaceKey: workspace.workspaceKey,
  });
}

async function handleWorkspaceSyncGet(req: Request, res: Response, env: ServerEnv): Promise<void> {
  const keyCheck = workspaceKeySchema.safeParse(req.query.workspaceKey);
  if (!keyCheck.success) {
    res.status(HTTP_STATUS.BAD_REQUEST).json({ error: 'Provide a valid workspaceKey parameter.' });
    return;
  }
  const since = typeof req.query.since === 'string' ? req.query.since.trim() : '';
  const ws = await getWorkspaceByKey(keyCheck.data, env);
  if (!ws) {
    res.status(HTTP_STATUS.OK).json({ found: false, changed: false });
    return;
  }
  if (since && ws.updatedAt <= since) {
    res.status(HTTP_STATUS.OK).json({
      found: true,
      changed: false,
      telegramLinked: Boolean(ws.telegramChatId),
      updatedAt: ws.updatedAt,
    });
    return;
  }
  res.status(HTTP_STATUS.OK).json({
    found: true,
    changed: true,
    workspaceKey: ws.workspaceKey,
    activeMemberId: ws.activeMemberId,
    telegramLinked: Boolean(ws.telegramChatId),
    lastModifiedBy: ws.lastModifiedBy,
    updatedAt: ws.updatedAt,
    payload: ws.payload,
  });
}

async function handleWorkspaceSyncPost(req: Request, res: Response, env: ServerEnv): Promise<void> {
  const parsed = workspaceSyncPostSchema.safeParse(req.body);
  if (!parsed.success) {
    res
      .status(HTTP_STATUS.BAD_REQUEST)
      .json({ error: 'Invalid workspace synchronization payload.' });
    return;
  }
  const ws = await syncWorkspaceFromWeb(parsed.data, env);
  res.status(HTTP_STATUS.OK).json({
    ok: true,
    workspaceKey: ws.workspaceKey,
    telegramLinked: Boolean(ws.telegramChatId),
    updatedAt: ws.updatedAt,
  });
}

async function runDailyBriefFanout(
  env: ServerEnv,
): Promise<{ readonly sentCount: number; readonly skippedCount: number }> {
  const workspaces = await listOptedInWorkspaces(env);
  let sentCount = 0;
  let skippedCount = 0;
  for (const ws of workspaces) {
    if (!ws.telegramChatId) {
      skippedCount += 1;
      continue;
    }
    const brief = await buildLiveScheduleBrief(ws, env);
    const ok = env.TELEGRAM_BOT_TOKEN
      ? await sendTelegramMessage(
          env.TELEGRAM_BOT_TOKEN,
          ws.telegramChatId,
          brief,
          DEFAULT_TELEGRAM_BUTTONS,
        )
      : true;
    if (ok) {
      await markWorkspaceBriefSent(ws, env);
      sentCount += 1;
    } else {
      skippedCount += 1;
    }
  }
  return { sentCount, skippedCount };
}

function registerTelegramRoutes(router: Router, env: ServerEnv): void {
  router.post('/telegram/webhook', async (req: Request, res: Response) => {
    const headerToken = req.header('x-telegram-bot-api-secret-token');
    if (!verifyTelegramWebhookSecret(headerToken, env.TELEGRAM_WEBHOOK_SECRET)) {
      res.status(HTTP_STATUS.FORBIDDEN).json({ error: 'Invalid Telegram webhook secret.' });
      return;
    }
    const update = (
      typeof req.body === 'object' && req.body !== null ? req.body : {}
    ) as TelegramWebhookUpdate;
    const outcome = await processTelegramUpdate(update, env);
    res.status(HTTP_STATUS.OK).json({ ok: true, ...outcome });
  });

  router.get('/telegram/daily-brief', async (req: Request, res: Response) => {
    if (!verifyBearerSecret(req.header('authorization'), env.CRON_SECRET)) {
      res.status(HTTP_STATUS.UNAUTHORIZED).json({ error: 'Unauthorized daily brief trigger.' });
      return;
    }
    res.status(HTTP_STATUS.OK).json({ ok: true, ...(await runDailyBriefFanout(env)) });
  });
}

/** Creates the Express router handling companion chat, Telegram pairing, workspace sync, and cron briefs. */
export function createCompanionRouter(env: ServerEnv): Router {
  const router = Router();
  const limiter = new SlidingWindowRateLimiter(SECURITY_LIMITS.CHAT_RATE_LIMIT_PER_MIN);
  const syncLimiter = new SlidingWindowRateLimiter(SECURITY_LIMITS.TELEMETRY_RATE_LIMIT_PER_MIN);
  router.post('/companion/chat', limiter.middleware, (req, res) =>
    handleCompanionChat(req, res, env),
  );
  router.post('/companion/telegram-link', limiter.middleware, (req, res) =>
    handleTelegramLink(req, res, env),
  );
  router.get('/companion/workspace-sync', syncLimiter.middleware, (req, res) =>
    handleWorkspaceSyncGet(req, res, env),
  );
  router.post('/companion/workspace-sync', syncLimiter.middleware, (req, res) =>
    handleWorkspaceSyncPost(req, res, env),
  );
  registerTelegramRoutes(router, env);
  return router;
}
