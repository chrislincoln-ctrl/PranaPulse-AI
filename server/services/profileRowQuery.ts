import type { ServerEnv } from '../env.js';
import { createAdminSupabaseClient, type DbMemberRow } from './companionDbMapper.js';

export type DbErrorLike = { readonly code?: string; readonly message?: string } | null;

const PROFILES_TABLE = 'family_member_profiles';

/** Queries the latest matching row from `family_member_profiles` by column equality. */
export async function fetchLatestProfileRow(
  column: 'id' | 'telegram_chat_id' | 'telegram_link_code',
  value: string,
  env: ServerEnv,
): Promise<{ readonly row: DbMemberRow | null; readonly error: DbErrorLike }> {
  const db = createAdminSupabaseClient(env);
  if (!db) {
    return { row: null, error: null };
  }
  const res = await db
    .from(PROFILES_TABLE)
    .select('*')
    .eq(column, value)
    .order('updated_at', { ascending: false })
    .limit(1);
  const row = (Array.isArray(res.data) ? (res.data as DbMemberRow[]) : [])[0] ?? null;
  return { row, error: res.error };
}
