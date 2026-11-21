import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import { z } from 'zod';
import { planRequestSchema, type PlanRequestPayload } from '../validators/schemas.js';

const cloudPrefsSchema = planRequestSchema
  .pick({
    city: true,
    lat: true,
    lon: true,
    areaM2: true,
    cadrM3Hr: true,
    tightness: true,
    cookingFuel: true,
    commuteDistanceKm: true,
    commuteMode: true,
    mask: true,
    language: true,
  })
  .extend({
    members: planRequestSchema.shape.members.optional(),
    savedAt: z.string().optional(),
  });

/** Subset of workspace preferences persisted in Supabase user metadata. */
export type SavedWorkspacePreferences = z.infer<typeof cloudPrefsSchema>;

interface SupabaseRuntimeConfig {
  readonly url: string;
  readonly anonKey: string;
}

let cachedClient: SupabaseClient | null | undefined;

function readSupabaseConfig(): SupabaseRuntimeConfig | null {
  const envMap = import.meta.env as Record<string, unknown>;
  const rawUrl = envMap.VITE_SUPABASE_URL;
  const rawKey = envMap.VITE_SUPABASE_ANON_KEY;
  const url = typeof rawUrl === 'string' ? rawUrl.trim() : '';
  const anonKey = typeof rawKey === 'string' ? rawKey.trim() : '';
  if (url.length === 0 || anonKey.length === 0) {
    return null;
  }
  return { url, anonKey };
}

/**
 * Checks whether Supabase public client credentials are present in Vite env.
 */
export function isSupabaseConfigured(): boolean {
  return readSupabaseConfig() !== null;
}

/**
 * Lazily initializes and returns the singleton browser Supabase client, or `null`
 * when Supabase credentials have not been configured.
 */
export function getSupabaseClient(): SupabaseClient | null {
  if (cachedClient !== undefined) {
    return cachedClient;
  }
  const config = readSupabaseConfig();
  if (!config) {
    cachedClient = null;
    return null;
  }
  cachedClient = createClient(config.url, config.anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
  return cachedClient;
}

function readMetadataRecord(user: User | null): Record<string, unknown> | null {
  return user ? user.user_metadata : null;
}

/**
 * Extracts a clean display name from Supabase user metadata or email address.
 */
export function getUserDisplayName(user: User): string {
  const meta = readMetadataRecord(user);
  const fullName = typeof meta?.full_name === 'string' ? meta.full_name.trim() : '';
  if (fullName.length > 0) {
    return fullName;
  }
  const [handle = ''] = (user.email ?? '').split('@');
  const trimmedHandle = handle.trim();
  return trimmedHandle.length > 0 ? trimmedHandle : 'Account';
}

/**
 * Builds a validated workspace snapshot suitable for Supabase `user_metadata` storage.
 */
export function buildCloudPreferencesPayload(input: PlanRequestPayload): SavedWorkspacePreferences {
  return {
    city: input.city,
    lat: input.lat,
    lon: input.lon,
    areaM2: input.areaM2,
    cadrM3Hr: input.cadrM3Hr,
    tightness: input.tightness,
    cookingFuel: input.cookingFuel,
    commuteDistanceKm: input.commuteDistanceKm,
    commuteMode: input.commuteMode,
    mask: input.mask,
    language: input.language,
    members: input.members,
    savedAt: new Date().toISOString(),
  };
}

/**
 * Safely parses previously synced PranaPulse workspace preferences from a Supabase user.
 */
export function extractSavedPreferences(user: User | null): SavedWorkspacePreferences | null {
  const meta = readMetadataRecord(user);
  if (!meta || !('pranapulsePrefs' in meta)) {
    return null;
  }
  const parsed = cloudPrefsSchema.safeParse(meta.pranapulsePrefs);
  return parsed.success ? parsed.data : null;
}

/** Normalized result returned by Supabase authentication and profile actions. */
export interface AuthActionResult {
  readonly ok: boolean;
  readonly error?: string;
  readonly notice?: string;
  readonly savedAt?: string;
}

/** Signs in an existing Supabase user with email and password. */
export async function supabaseSignIn(
  client: SupabaseClient,
  email: string,
  password: string,
): Promise<AuthActionResult> {
  const { error } = await client.auth.signInWithPassword({ email: email.trim(), password });
  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true, notice: 'Signed in. Cloud workspace sync is ready.' };
}

/** Initiates Supabase OAuth sign-in with Google, redirecting back to current origin. */
export async function supabaseSignInWithGoogle(
  client: SupabaseClient,
): Promise<AuthActionResult> {
  const { error } = await client.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin,
    },
  });
  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true, notice: 'Redirecting to Google sign-in...' };
}

/** Registers a new Supabase email account and reports confirmation requirements cleanly. */
export async function supabaseSignUp(
  client: SupabaseClient,
  email: string,
  password: string,
  fullName: string,
): Promise<AuthActionResult> {
  const trimmedName = fullName.trim();
  const options: { emailRedirectTo: string; data?: Record<string, string> } = {
    emailRedirectTo: window.location.origin,
  };
  if (trimmedName.length > 0) {
    options.data = { full_name: trimmedName };
  }
  const { data, error } = await client.auth.signUp({ email: email.trim(), password, options });
  if (error) {
    return { ok: false, error: error.message };
  }
  if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
    return {
      ok: false,
      error:
        'An account with this email already exists. Try signing in or resetting your password.',
    };
  }
  if (!data.session) {
    return {
      ok: true,
      notice:
        'Account created. Check your email inbox for the Supabase verification link, then sign in.',
    };
  }
  return { ok: true, notice: 'Account created and signed in.' };
}

/** Dispatches a Supabase password recovery email redirecting back to this app origin. */
export async function supabaseResetPassword(
  client: SupabaseClient,
  email: string,
): Promise<AuthActionResult> {
  const { error } = await client.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: window.location.origin,
  });
  if (error) {
    return { ok: false, error: error.message };
  }
  return {
    ok: true,
    notice: 'Password reset link sent. Check your inbox to choose a new password.',
  };
}

/** Saves the current workspace settings into the signed-in user's Supabase metadata. */
export async function supabaseSavePreferences(
  client: SupabaseClient,
  input: PlanRequestPayload,
): Promise<AuthActionResult> {
  const payload = buildCloudPreferencesPayload(input);
  const { error } = await client.auth.updateUser({
    data: { pranapulsePrefs: payload },
  });
  if (error) {
    return { ok: false, error: error.message };
  }
  const result: AuthActionResult = {
    ok: true,
    notice: 'Workspace settings saved to your Supabase profile.',
  };
  return payload.savedAt ? { ...result, savedAt: payload.savedAt } : result;
}
