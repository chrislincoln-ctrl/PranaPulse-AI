import type { SupabaseClient, User } from '@supabase/supabase-js';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  extractSavedPreferences,
  getSupabaseClient,
  isSupabaseConfigured,
  supabaseResetPassword,
  supabaseSavePreferences,
  supabaseSignIn,
  supabaseSignUp,
  type AuthActionResult,
  type SavedWorkspacePreferences,
} from '../services/supabaseClient.js';
import type { PlanRequestPayload } from '../validators/schemas.js';

export type CloudSyncStatus = 'idle' | 'saving' | 'saved' | 'error';

export interface SupabaseAuthController {
  readonly isConfigured: boolean;
  readonly isInitializing: boolean;
  readonly user: User | null;
  readonly busy: boolean;
  readonly errorMessage: string | null;
  readonly noticeMessage: string | null;
  readonly syncStatus: CloudSyncStatus;
  readonly lastSavedAt: string | null;
  readonly clearMessages: () => void;
  readonly signIn: (email: string, password: string) => Promise<boolean>;
  readonly signUp: (email: string, password: string, fullName: string) => Promise<boolean>;
  readonly resetPassword: (email: string) => Promise<boolean>;
  readonly signOut: () => Promise<void>;
  readonly savePreferences: (input: PlanRequestPayload) => Promise<boolean>;
}

const NOT_CONFIGURED_ERROR =
  'Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env and rebuild.';

type AuthTaskRunner = (
  task: (client: SupabaseClient) => Promise<AuthActionResult>,
) => Promise<boolean>;

function useSessionSubscription(
  onUserChange: (nextUser: User | null) => void,
  onReady: () => void,
): void {
  const onUserRef = useRef(onUserChange);
  const onReadyRef = useRef(onReady);
  onUserRef.current = onUserChange;
  onReadyRef.current = onReady;

  useEffect(() => {
    const client = getSupabaseClient();
    if (!client) {
      onReadyRef.current();
      return undefined;
    }
    let active = true;
    void client.auth
      .getSession()
      .then(({ data }) => {
        if (active) {
          onUserRef.current(data.session?.user ?? null);
          onReadyRef.current();
        }
      })
      .catch(() => {
        if (active) {
          onReadyRef.current();
        }
      });

    const { data } = client.auth.onAuthStateChange((_event, session) => {
      if (active) {
        onUserRef.current(session?.user ?? null);
      }
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);
}

function useAuthTaskRunner(
  setBusy: React.Dispatch<React.SetStateAction<boolean>>,
  setErrorMessage: React.Dispatch<React.SetStateAction<string | null>>,
  setNoticeMessage: React.Dispatch<React.SetStateAction<string | null>>,
  setLastSavedAt: React.Dispatch<React.SetStateAction<string | null>>,
): AuthTaskRunner {
  return useCallback(
    async (task: (client: SupabaseClient) => Promise<AuthActionResult>): Promise<boolean> => {
      const client = getSupabaseClient();
      if (!client) {
        setErrorMessage(NOT_CONFIGURED_ERROR);
        return false;
      }
      setBusy(true);
      setErrorMessage(null);
      setNoticeMessage(null);
      try {
        const result = await task(client);
        setErrorMessage(result.error ?? null);
        setNoticeMessage(result.notice ?? null);
        if (result.savedAt) {
          setLastSavedAt(result.savedAt);
        }
        return result.ok;
      } catch {
        setErrorMessage('Could not reach Supabase Auth. Check your network connection.');
        return false;
      } finally {
        setBusy(false);
      }
    },
    [setBusy, setErrorMessage, setLastSavedAt, setNoticeMessage],
  );
}

function useAuthActions(
  runAuthTask: AuthTaskRunner,
  setSyncStatus: React.Dispatch<React.SetStateAction<CloudSyncStatus>>,
) {
  const signIn = useCallback(
    (email: string, password: string) => runAuthTask((c) => supabaseSignIn(c, email, password)),
    [runAuthTask],
  );

  const signUp = useCallback(
    (email: string, password: string, fullName: string) =>
      runAuthTask((c) => supabaseSignUp(c, email, password, fullName)),
    [runAuthTask],
  );

  const resetPassword = useCallback(
    (email: string) => runAuthTask((c) => supabaseResetPassword(c, email)),
    [runAuthTask],
  );

  const signOut = useCallback(async (): Promise<void> => {
    await runAuthTask(async (client) => {
      const { error } = await client.auth.signOut();
      return error ? { ok: false, error: error.message } : { ok: true, notice: 'Signed out.' };
    });
  }, [runAuthTask]);

  const savePreferences = useCallback(
    async (input: PlanRequestPayload): Promise<boolean> => {
      setSyncStatus('saving');
      const ok = await runAuthTask((c) => supabaseSavePreferences(c, input));
      setSyncStatus(ok ? 'saved' : 'error');
      return ok;
    },
    [runAuthTask, setSyncStatus],
  );

  return { signIn, signUp, resetPassword, signOut, savePreferences };
}

/**
 * Manages Supabase email authentication state and optional cloud sync for PranaPulse workspace settings.
 */
export function useSupabaseAuth(
  onRestorePreferences?: (prefs: SavedWorkspacePreferences) => void,
): SupabaseAuthController {
  const isConfigured = isSupabaseConfigured();
  const [isInitializing, setIsInitializing] = useState(isConfigured);
  const [user, setUser] = useState<User | null>(null);
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<CloudSyncStatus>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const restoredUserIdRef = useRef<string | null>(null);
  const restoreCallbackRef = useRef(onRestorePreferences);
  restoreCallbackRef.current = onRestorePreferences;

  const handleUserChange = useCallback((nextUser: User | null): void => {
    setUser(nextUser);
    const saved = extractSavedPreferences(nextUser);
    setLastSavedAt(saved?.savedAt ?? null);
    if (!nextUser) {
      restoredUserIdRef.current = null;
      setSyncStatus('idle');
      return;
    }
    if (saved && restoredUserIdRef.current !== nextUser.id) {
      restoredUserIdRef.current = nextUser.id;
      restoreCallbackRef.current?.(saved);
    }
  }, []);

  useSessionSubscription(handleUserChange, () => {
    setIsInitializing(false);
  });

  const runAuthTask = useAuthTaskRunner(setBusy, setErrorMessage, setNoticeMessage, setLastSavedAt);
  const actions = useAuthActions(runAuthTask, setSyncStatus);
  const clearMessages = useCallback((): void => {
    setErrorMessage(null);
    setNoticeMessage(null);
  }, []);

  return {
    isConfigured,
    isInitializing,
    user,
    busy,
    errorMessage,
    noticeMessage,
    syncStatus,
    lastSavedAt,
    clearMessages,
    ...actions,
  };
}
