import { Router, type Request, type Response } from 'express';
import { HTTP_STATUS, SECURITY_LIMITS } from '../../src/config/constants.js';
import {
  companionChatRequestSchema,
  telegramLinkRequestSchema,
} from '../../src/validators/companionSchemas.js';
import type { ServerEnv } from '../env.js';
import { SlidingWindowRateLimiter } from '../services/cacheAndLimiter.js';
import { handleCompanionCheckin } from '../services/familyCompanionAgent.js';
import {
  createTelegramLinkCode,
  listTelegramOptedInMembers,
  markDailyBriefSent,
  recordCompanionCheckin,
  updateMemberHabitsByProfileId,
  upsertMemberProfile,
} from '../services/familyCompanionStore.js';
import { hasHabitPatch } from '../services/habitExtractor.js';
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

async function handleCompanionChat(req: Request, res: Response, env: ServerEnv): Promise<void> {
  const parsed = companionChatRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(HTTP_STATUS.BAD_REQUEST).json({
      error: 'Provide a valid family member, message, and city coordinates.',
    });
    return;
  }
  const payload = parsed.data;
  const profile = await upsertMemberProfile(
    {
      member: payload.member,
      city: payload.city,
      lat: payload.lat,
      lon: payload.lon,
      language: payload.language,
    },
    env,
  );
  const result = await handleCompanionCheckin({ ...payload, channel: 'web' }, env);
  if (hasHabitPatch(result.habitPatch)) {
    await updateMemberHabitsByProfileId(profile.id, result.habitPatch, env);
  }
  await recordCompanionCheckin(
    {
      memberProfileId: profile.id,
      channel: 'web',
      direction: 'inbound',
      messageText: payload.message,
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
    res.status(HTTP_STATUS.BAD_REQUEST).json({
      error: 'Provide a valid family member and city to create a Telegram link.',
    });
    return;
  }
  const { linkCode } = await createTelegramLinkCode(parsed.data, env);
  const botUsername = env.TELEGRAM_BOT_USERNAME ?? null;
  const telegramConfigured = Boolean(env.TELEGRAM_BOT_TOKEN && botUsername);
  const deepLinkUrl = botUsername ? buildTelegramDeepLink(botUsername, linkCode) : null;
  res.status(HTTP_STATUS.OK).json({ linkCode, deepLinkUrl, telegramConfigured, botUsername });
}

function registerWebCompanionRoutes(
  router: Router,
  env: ServerEnv,
  limiter: SlidingWindowRateLimiter,
): void {
  router.post('/companion/chat', limiter.middleware, async (req: Request, res: Response) => {
    await handleCompanionChat(req, res, env);
  });
  router.post('/companion/telegram-link', limiter.middleware, async (req: Request, res: Response) => {
    await handleTelegramLink(req, res, env);
  });
}

async function runDailyBriefFanout(
  env: ServerEnv,
): Promise<{ readonly sentCount: number; readonly skippedCount: number }> {
  const members = await listTelegramOptedInMembers(env);
  let sentCount = 0;
  let skippedCount = 0;
  for (const member of members) {
    if (!member.telegramChatId) {
      skippedCount += 1;
      continue;
    }
    const brief = await buildLiveScheduleBrief(member, env);
    const delivered = env.TELEGRAM_BOT_TOKEN
      ? await sendTelegramMessage(
          env.TELEGRAM_BOT_TOKEN,
          member.telegramChatId,
          brief,
          DEFAULT_TELEGRAM_BUTTONS,
        )
      : true;
    if (delivered) {
      await markDailyBriefSent(member.id, env);
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
    const update = (typeof req.body === 'object' && req.body !== null
      ? req.body
      : {}) as TelegramWebhookUpdate;
    const outcome = await processTelegramUpdate(update, env);
    res.status(HTTP_STATUS.OK).json({ ok: true, ...outcome });
  });

  router.get('/telegram/daily-brief', async (req: Request, res: Response) => {
    if (!verifyBearerSecret(req.header('authorization'), env.CRON_SECRET)) {
      res.status(HTTP_STATUS.UNAUTHORIZED).json({ error: 'Unauthorized daily brief trigger.' });
      return;
    }
    const counts = await runDailyBriefFanout(env);
    res.status(HTTP_STATUS.OK).json({ ok: true, ...counts });
  });
}

/** Creates the Express router handling in-app companion chat, Telegram pairing, webhooks, and cron briefs. */
export function createCompanionRouter(env: ServerEnv): Router {
  const router = Router();
  const limiter = new SlidingWindowRateLimiter(SECURITY_LIMITS.CHAT_RATE_LIMIT_PER_MIN);
  registerWebCompanionRoutes(router, env, limiter);
  registerTelegramRoutes(router, env);
  return router;
}
