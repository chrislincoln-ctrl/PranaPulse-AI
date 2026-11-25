import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_WORKSPACE_INPUT } from '../../src/config/uiConstants.js';
import { loadServerEnv, type ServerEnv } from '../../server/env.js';
import * as dbMapper from '../../server/services/companionDbMapper.js';
import {
  clearCompanionStore,
  createTelegramLinkCode,
  findMemberByTelegramChatId,
  listTelegramOptedInMembers,
  markDailyBriefSent,
  recordCompanionCheckin,
  redeemTelegramLinkCode,
  updateMemberHabitsByProfileId,
  upsertMemberProfile,
} from '../../server/services/familyCompanionStore.js';
import { fetchLatestProfileRow } from '../../server/services/profileRowQuery.js';
import {
  checkCompanionDbHealth,
  checkCompanionDbReady,
  clearHouseholdWorkspaceStore,
  listOptedInWorkspaces,
  lookupWorkspaceByKey,
  markWorkspaceBriefSent,
  persistWorkspaceRecord,
  queryDbWorkspace,
} from '../../server/services/workspacePersistence.js';
import {
  listOptedInWorkspacesFromStorage,
  probeStorageBucketReady,
  readWorkspaceFromStorageByChat,
  readWorkspaceFromStorageByCode,
  readWorkspaceFromStorageByKey,
  resetStorageFallbackCache,
  writeWorkspaceToStorage,
} from '../../server/services/workspaceStorageFallback.js';
import {
  decodeWorkspaceLinkCode,
  deserializeDbRowToWorkspace,
  encodeWorkspaceLinkCode,
  getActiveMember,
  sanitizeWorkspaceKey,
  serializeWorkspaceToDbRow,
  workspaceKeyToUuid,
  type SyncedWorkspaceRecord,
} from '../../server/services/workspaceSyncCodec.js';

const MOCK_ENV: ServerEnv = loadServerEnv({
  NODE_ENV: 'test',
  VITE_SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-test-key',
});

const MEM_ENV: ServerEnv = loadServerEnv({ NODE_ENV: 'test' });

function makeWorkspace(overrides: Partial<SyncedWorkspaceRecord> = {}): SyncedWorkspaceRecord {
  const key = overrides.workspaceKey ?? 'whome42';
  return {
    id: workspaceKeyToUuid(key),
    workspaceKey: key,
    userId: null,
    activeMemberId: 'm1',
    payload: DEFAULT_WORKSPACE_INPUT,
    telegramChatId: '998877',
    telegramLinkCode: 'p_whome42_m1_2861_7721',
    telegramOptIn: true,
    briefTimeLocal: '06:30',
    lastBriefSentAt: null,
    lastModifiedBy: 'web',
    updatedAt: '2026-11-26T00:00:00.000Z',
    ...overrides,
  };
}

interface FakeStorageState {
  bucketExists: boolean;
  bucketPublic: boolean;
  createErr?: { message: string } | null;
  objects: Map<string, string>;
  listError?: boolean;
}

function createMockSupabase(opts: {
  pgRows?: dbMapper.DbMemberRow[];
  pgError?: { code?: string; message: string } | null;
  upsertError?: { code?: string; message: string } | null;
  storage?: FakeStorageState;
}) {
  const storageState: FakeStorageState = opts.storage ?? {
    bucketExists: true,
    bucketPublic: false,
    objects: new Map<string, string>(),
  };
  const pgRows = opts.pgRows ?? [];

  const from = vi.fn(() => {
    const chain = {
      select: vi.fn(() => chain),
      eq: vi.fn(() => chain),
      neq: vi.fn(() => chain),
      not: vi.fn(() =>
        Promise.resolve({ data: opts.pgError ? null : pgRows, error: opts.pgError ?? null }),
      ),
      order: vi.fn(() => chain),
      limit: vi.fn(() =>
        Promise.resolve({ data: opts.pgError ? null : pgRows, error: opts.pgError ?? null }),
      ),
      update: vi.fn(() => ({
        eq: vi.fn(() => ({ neq: vi.fn(() => Promise.resolve({ error: null })) })),
      })),
      upsert: vi.fn((row: dbMapper.DbMemberRow) => ({
        select: vi.fn(() => ({
          limit: vi.fn(() =>
            Promise.resolve({
              data: opts.upsertError ? null : [row],
              error: opts.upsertError ?? null,
            }),
          ),
        })),
      })),
      insert: vi.fn(() => Promise.resolve({ error: null })),
    };
    return chain;
  });

  const storage = {
    getBucket: vi.fn(() =>
      storageState.bucketExists
        ? Promise.resolve({ data: { public: storageState.bucketPublic }, error: null })
        : Promise.resolve({ data: null, error: { message: 'Not found' } }),
    ),
    createBucket: vi.fn(() => {
      if (!storageState.createErr) {
        storageState.bucketExists = true;
      }
      return Promise.resolve({ data: null, error: storageState.createErr ?? null });
    }),
    from: vi.fn(() => ({
      upload: vi.fn((p: string, body: Buffer) => {
        storageState.objects.set(p, body.toString('utf8'));
        return Promise.resolve({ error: null });
      }),
      download: vi.fn((p: string) => {
        const text = storageState.objects.get(p);
        if (text === undefined) {
          return Promise.resolve({ data: null, error: { message: 'missing' } });
        }
        return Promise.resolve({ data: { text: () => Promise.resolve(text) }, error: null });
      }),
      list: vi.fn((prefix: string) => {
        if (storageState.listError) {
          return Promise.resolve({ data: null, error: { message: 'list fail' } });
        }
        const entries = [...storageState.objects.keys()]
          .filter((k) => k.startsWith(`${prefix}/`))
          .map((k) => ({ name: k.slice(prefix.length + 1) }));
        return Promise.resolve({ data: entries, error: null });
      }),
    })),
  };

  return { from, storage } as unknown as NonNullable<
    ReturnType<typeof dbMapper.createAdminSupabaseClient>
  >;
}

describe('Workspace codec, storage fallback, persistence tiers & companion DB store', () => {
  afterEach(() => {
    clearCompanionStore();
    clearHouseholdWorkspaceStore();
    resetStorageFallbackCache();
    vi.restoreAllMocks();
  });

  it('encodes/decodes workspace link codes, sanitizes keys, and round-trips DB rows (anchor + legacy)', () => {
    expect(sanitizeWorkspaceKey('a!', 'Fallback_Key1')).toBe('fallbackkey1');
    const code = encodeWorkspaceLinkCode({
      workspaceKey: 'home99',
      memberKey: 'm2',
      lat: -33.86,
      lon: 151.21,
    });
    expect(decodeWorkspaceLinkCode(code)).toEqual({
      workspaceKey: 'home99',
      memberKey: 'm2',
      lat: -33.86,
      lon: 151.21,
    });
    expect(decodeWorkspaceLinkCode('')).toBeNull();
    expect(decodeWorkspaceLinkCode('m3_deadbeef')).toEqual({ workspaceKey: null, memberKey: 'm3' });
    expect(decodeWorkspaceLinkCode('p_ab__99999_notnum')).toEqual({
      workspaceKey: null,
      memberKey: 'm1',
    });

    const ws = makeWorkspace({ activeMemberId: 'missing' });
    expect(getActiveMember(ws).id).toBe(DEFAULT_WORKSPACE_INPUT.members[0]?.id);
    const row = serializeWorkspaceToDbRow(ws);
    const decoded = deserializeDbRowToWorkspace(row);
    expect(decoded.workspaceKey).toBe('whome42');
    expect(decoded.payload.city).toBe(DEFAULT_WORKSPACE_INPUT.city);

    const legacyRow: dbMapper.DbMemberRow = {
      ...row,
      member_key: 'm2',
      daily_habits_note: 'plain legacy note',
      leave_home_time: '08:00',
      return_home_time: '18:30',
      health_notes: 'asthma',
    };
    const legacyWs = deserializeDbRowToWorkspace(legacyRow);
    expect(legacyWs.workspaceKey).toBe('tg998877');
    expect(legacyWs.payload.members[0]?.id).toBe('m2');
  });

  it('writes, resolves by key/chat/code, clears previous chat conflict, and lists opted-in Storage workspaces', async () => {
    const storageState: FakeStorageState = {
      bucketExists: false,
      bucketPublic: false,
      objects: new Map<string, string>(),
    };
    const mockDb = createMockSupabase({ storage: storageState });
    vi.spyOn(dbMapper, 'createAdminSupabaseClient').mockReturnValue(mockDb);

    expect(await probeStorageBucketReady(MOCK_ENV)).toBe(true);
    const ws1 = makeWorkspace({
      workspaceKey: 'wsalpha',
      telegramChatId: '555',
      telegramLinkCode: 'CODE1',
    });
    expect(await writeWorkspaceToStorage(ws1, MOCK_ENV, true)).toBe(true);

    const ws2 = makeWorkspace({
      workspaceKey: 'wsbeta',
      telegramChatId: '555',
      telegramLinkCode: 'CODE2',
    });
    expect(await writeWorkspaceToStorage(ws2, MOCK_ENV, true)).toBe(true);

    const oldWs = await readWorkspaceFromStorageByKey('wsalpha', MOCK_ENV);
    expect(oldWs?.telegramChatId).toBeNull();
    expect((await readWorkspaceFromStorageByChat('555', MOCK_ENV))?.workspaceKey).toBe('wsbeta');
    expect((await readWorkspaceFromStorageByCode('code2', MOCK_ENV))?.workspaceKey).toBe('wsbeta');
    expect(await readWorkspaceFromStorageByKey('../bad', MOCK_ENV)).toBeNull();

    const opted = await listOptedInWorkspacesFromStorage(MOCK_ENV);
    expect(opted.map((w) => w.workspaceKey)).toEqual(['wsbeta']);

    resetStorageFallbackCache();
    storageState.bucketPublic = true;
    expect(await probeStorageBucketReady(MOCK_ENV)).toBe(false);
    expect(await readWorkspaceFromStorageByKey('wsbeta', MEM_ENV)).toBeNull();
  });

  it('persists across Postgres Tier 1, falls back to Storage Tier 2 on missing table, and probes health', async () => {
    const ws = makeWorkspace({ workspaceKey: 'wspg01' });
    const pgRow = serializeWorkspaceToDbRow(ws);
    const pgDb = createMockSupabase({ pgRows: [pgRow] });
    vi.spyOn(dbMapper, 'createAdminSupabaseClient').mockReturnValue(pgDb);

    expect(await checkCompanionDbHealth(MOCK_ENV)).toEqual({ ready: true, backend: 'postgres' });
    expect(await checkCompanionDbReady(MOCK_ENV)).toBe(true);
    const saved = await persistWorkspaceRecord(ws, MOCK_ENV, true);
    expect(saved.workspaceKey).toBe('wspg01');
    expect((await lookupWorkspaceByKey('wspg01', MOCK_ENV))?.workspaceKey).toBe('wspg01');
    expect((await listOptedInWorkspaces(MOCK_ENV)).length).toBe(1);
    await markWorkspaceBriefSent(ws, MOCK_ENV);

    clearHouseholdWorkspaceStore();
    const missingTableDb = createMockSupabase({
      pgError: { code: '42P01', message: 'relation family_member_profiles does not exist' },
      upsertError: { code: 'PGRST205', message: 'Could not find the table' },
    });
    vi.spyOn(dbMapper, 'createAdminSupabaseClient').mockReturnValue(missingTableDb);

    expect(await checkCompanionDbHealth(MOCK_ENV)).toEqual({
      ready: true,
      backend: 'supabase-storage',
    });
    await persistWorkspaceRecord(ws, MOCK_ENV, false);
    const viaChat = await queryDbWorkspace('telegram_chat_id', '998877', MOCK_ENV);
    expect(viaChat?.workspaceKey).toBe('wspg01');
    const viaCode = await queryDbWorkspace(
      'telegram_link_code',
      ws.telegramLinkCode ?? '',
      MOCK_ENV,
    );
    expect(viaCode?.workspaceKey).toBe('wspg01');
    const storageList = await listOptedInWorkspaces(MOCK_ENV);
    expect(storageList.length).toBe(1);

    clearHouseholdWorkspaceStore();
    vi.spyOn(dbMapper, 'createAdminSupabaseClient').mockReturnValue(null);
    expect(await checkCompanionDbHealth(MEM_ENV)).toEqual({ ready: false, backend: 'memory' });
    expect((await fetchLatestProfileRow('id', 'x', MEM_ENV)).row).toBeNull();
  });

  it('exercises familyCompanionStore profile upserts, link redemption, habit updates, checkins, and DB paths', async () => {
    const member = DEFAULT_WORKSPACE_INPUT.members[0]!;
    const upserted = await upsertMemberProfile(
      { member, city: 'Kolkata', lat: 22.57, lon: 88.36, language: 'en' },
      MEM_ENV,
    );
    const { linkCode } = await createTelegramLinkCode(
      { member, city: 'Kolkata', lat: 22.57, lon: 88.36, language: 'en' },
      MEM_ENV,
    );
    const redeemed = await redeemTelegramLinkCode(linkCode, 'tg-777', MEM_ENV);
    expect(redeemed.telegramChatId).toBe('tg-777');
    expect((await findMemberByTelegramChatId('tg-777', MEM_ENV))?.id).toBe(redeemed.id);

    const patched = await updateMemberHabitsByProfileId(
      redeemed.id,
      { leaveHomeTime: '09:00', returnHomeTime: '17:00', dailyOutdoorHours: 3, city: 'Pune' },
      MEM_ENV,
    );
    expect(patched?.city).toBe('Pune');
    expect(await updateMemberHabitsByProfileId('nonexistent', { city: 'Goa' }, MEM_ENV)).toBeNull();
    expect((await listTelegramOptedInMembers(MEM_ENV)).length).toBe(1);

    await recordCompanionCheckin(
      {
        memberProfileId: redeemed.id,
        channel: 'telegram',
        direction: 'inbound',
        messageText: 'Left home at 9',
        detectedCity: 'Pune',
        aqiSnapshot: 180,
      },
      MEM_ENV,
    );
    await markDailyBriefSent(upserted.id, MEM_ENV);

    const dbRow = dbMapper.toDbMemberPayload(redeemed);
    const dbMock = createMockSupabase({ pgRows: [dbRow] });
    vi.spyOn(dbMapper, 'createAdminSupabaseClient').mockReturnValue(dbMock);

    clearCompanionStore();
    expect((await findMemberByTelegramChatId('tg-777', MOCK_ENV))?.label).toBe(member.label);
    expect((await listTelegramOptedInMembers(MOCK_ENV)).length).toBe(1);
    const fallbackRedeemed = await redeemTelegramLinkCode('', 'tg-888', MOCK_ENV);
    expect(fallbackRedeemed.telegramChatId).toBe('tg-888');
    await recordCompanionCheckin(
      {
        memberProfileId: fallbackRedeemed.id,
        channel: 'web',
        direction: 'outbound',
        messageText: 'Wear N95',
      },
      MOCK_ENV,
    );
  });
});
