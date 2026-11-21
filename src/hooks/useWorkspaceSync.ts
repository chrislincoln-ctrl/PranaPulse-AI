import { useCallback, useEffect, useRef, useState } from 'react';
import type { PlanRequestPayload } from '../validators/schemas.js';

const STORAGE_KEY = 'pranapulse_workspace_key';
const POLL_INTERVAL_MS = 4_000;
const PUSH_DEBOUNCE_MS = 500;
const SYNC_NOTICE_MS = 6_000;
const RADIX_36 = 36;
const KEY_SLICE_LEN = 12;
const WS_QUERY_RE = /^[a-zA-Z0-9_-]{4,24}$/;

interface WorkspaceSyncGetResponse {
  readonly found?: boolean;
  readonly changed?: boolean;
  readonly telegramLinked?: boolean;
  readonly lastModifiedBy?: 'web' | 'telegram';
  readonly updatedAt?: string;
  readonly payload?: PlanRequestPayload;
}

interface WorkspaceSyncPostResponse {
  readonly ok?: boolean;
  readonly telegramLinked?: boolean;
  readonly updatedAt?: string;
}

function isTestEnv(): boolean {
  return typeof process !== 'undefined' && process.env.NODE_ENV === 'test';
}

function generateLocalWorkspaceKey(): string {
  const rand =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID().replace(/-/g, '').slice(0, KEY_SLICE_LEN)
      : `${Date.now().toString(RADIX_36)}${Math.random().toString(RADIX_36).slice(2)}`.slice(
          0,
          KEY_SLICE_LEN,
        );
  return `w${rand}`.toLowerCase();
}

function readValidKey(raw: string | null): string | null {
  const trimmed = raw?.trim() ?? '';
  return WS_QUERY_RE.test(trimmed) ? trimmed.toLowerCase() : null;
}

function resolveInitialWorkspaceKey(): string {
  if (typeof window === 'undefined') {
    return 'whome001';
  }
  try {
    const fromUrl = readValidKey(new URLSearchParams(window.location.search).get('ws'));
    if (fromUrl) {
      localStorage.setItem(STORAGE_KEY, fromUrl);
      return fromUrl;
    }
    const existing = readValidKey(localStorage.getItem(STORAGE_KEY));
    if (existing) {
      return existing;
    }
    const created = generateLocalWorkspaceKey();
    localStorage.setItem(STORAGE_KEY, created);
    return created;
  } catch {
    return generateLocalWorkspaceKey();
  }
}

async function fetchRemoteWorkspace(
  workspaceKey: string,
  since: string | null,
): Promise<WorkspaceSyncGetResponse | null> {
  const query = new URLSearchParams({ workspaceKey });
  if (since) {
    query.set('since', since);
  }
  const res = await fetch(`/api/companion/workspace-sync?${query.toString()}`);
  return res.ok ? ((await res.json()) as WorkspaceSyncGetResponse) : null;
}

async function postWorkspaceSnapshot(
  workspaceKey: string,
  payload: PlanRequestPayload,
): Promise<WorkspaceSyncPostResponse | null> {
  const res = await fetch('/api/companion/workspace-sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ workspaceKey, payload }),
  });
  return res.ok ? ((await res.json()) as WorkspaceSyncPostResponse) : null;
}

function useSyncPollingLoop(workspaceKey: string, pollOnce: () => void): void {
  useEffect(() => {
    if (isTestEnv()) {
      return undefined;
    }
    pollOnce();
    const timer = setInterval(() => {
      if (typeof document === 'undefined' || document.visibilityState === 'visible') {
        pollOnce();
      }
    }, POLL_INTERVAL_MS);
    const onFocus = (): void => {
      pollOnce();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, [pollOnce, workspaceKey]);
}

function useWorkspacePush(
  workspaceKey: string,
  lastUpdatedAtRef: React.RefObject<string | null>,
  setTelegramLinked: React.Dispatch<React.SetStateAction<boolean>>,
) {
  const pushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const executePush = useCallback(
    (payload: PlanRequestPayload): void => {
      if (isTestEnv()) {
        return;
      }
      void postWorkspaceSnapshot(workspaceKey, payload)
        .then((res) => {
          if (res?.updatedAt) {
            lastUpdatedAtRef.current = res.updatedAt;
          }
          if (res && typeof res.telegramLinked === 'boolean') {
            setTelegramLinked(res.telegramLinked);
          }
        })
        .catch(() => undefined);
    },
    [lastUpdatedAtRef, setTelegramLinked, workspaceKey],
  );

  useEffect(() => {
    return () => {
      if (pushTimerRef.current) {
        clearTimeout(pushTimerRef.current);
      }
    };
  }, []);

  return useCallback(
    (payload: PlanRequestPayload, immediate = false): void => {
      if (pushTimerRef.current) {
        clearTimeout(pushTimerRef.current);
      }
      if (immediate) {
        executePush(payload);
        return;
      }
      pushTimerRef.current = setTimeout(() => {
        executePush(payload);
      }, PUSH_DEBOUNCE_MS);
    },
    [executePush],
  );
}

/**
 * Synchronizes the full household workspace bidirectionally between the web console and Telegram,
 * pushing GPS/city/roster edits out and polling live Telegram updates back into the website.
 */
export function useWorkspaceSync(
  onApplyRemotePayload: (payload: PlanRequestPayload, fromTelegram: boolean) => void,
) {
  const [workspaceKey] = useState<string>(resolveInitialWorkspaceKey);
  const [telegramLinked, setTelegramLinked] = useState(false);
  const [syncedFromTelegram, setSyncedFromTelegram] = useState(false);
  const lastUpdatedAtRef = useRef<string | null>(null);
  const noticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onApplyRef = useRef(onApplyRemotePayload);
  onApplyRef.current = onApplyRemotePayload;

  const flashNotice = useCallback((): void => {
    setSyncedFromTelegram(true);
    if (noticeTimerRef.current) {
      clearTimeout(noticeTimerRef.current);
    }
    noticeTimerRef.current = setTimeout(() => {
      setSyncedFromTelegram(false);
    }, SYNC_NOTICE_MS);
  }, []);

  const pollOnce = useCallback((): void => {
    void fetchRemoteWorkspace(workspaceKey, lastUpdatedAtRef.current)
      .then((data) => {
        if (!data?.found) {
          return;
        }
        setTelegramLinked(Boolean(data.telegramLinked));
        if (data.updatedAt) {
          lastUpdatedAtRef.current = data.updatedAt;
        }
        if (data.changed && data.payload) {
          const fromTg = data.lastModifiedBy === 'telegram';
          onApplyRef.current(data.payload, fromTg);
          if (fromTg) {
            flashNotice();
          }
        }
      })
      .catch(() => undefined);
  }, [flashNotice, workspaceKey]);

  useSyncPollingLoop(workspaceKey, pollOnce);
  const pushWorkspace = useWorkspacePush(workspaceKey, lastUpdatedAtRef, setTelegramLinked);

  useEffect(() => {
    return () => {
      if (noticeTimerRef.current) {
        clearTimeout(noticeTimerRef.current);
      }
    };
  }, []);

  return { workspaceKey, telegramLinked, syncedFromTelegram, pushWorkspace };
}
