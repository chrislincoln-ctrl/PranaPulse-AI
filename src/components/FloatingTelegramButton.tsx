import { CheckCircle2, Loader2, Send } from 'lucide-react';
import { memo, useCallback, useState, type ReactElement } from 'react';
import type { LocaleDictionary } from '../i18n/translations.js';
import type { PlanRequestPayload } from '../validators/schemas.js';

export interface FloatingTelegramButtonProps {
  readonly input: PlanRequestPayload;
  readonly workspaceKey: string;
  readonly activeMemberId?: string | undefined;
  readonly telegramLinked?: boolean | undefined;
  readonly syncedFromTelegram?: boolean | undefined;
  readonly t: LocaleDictionary;
}

interface TelegramLinkResponse {
  readonly linkCode?: string;
  readonly deepLinkUrl?: string | null;
  readonly telegramConfigured?: boolean;
}

async function requestOneClickTelegramLink(
  workspaceKey: string,
  payload: PlanRequestPayload,
  activeMemberId: string | undefined,
): Promise<TelegramLinkResponse | null> {
  const res = await fetch('/api/companion/telegram-link', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      workspaceKey,
      payload,
      ...(activeMemberId ? { activeMemberId } : {}),
    }),
  });
  return res.ok ? ((await res.json()) as TelegramLinkResponse) : null;
}

function openPendingWindow(): Window | null {
  if (typeof window === 'undefined' || typeof window.open !== 'function') {
    return null;
  }
  try {
    return window.open('about:blank', '_blank');
  } catch {
    return null;
  }
}

function navigateToTelegram(deepLinkUrl: string, popup: Window | null): void {
  if (popup && !popup.closed) {
    try {
      popup.opener = null;
      popup.location.href = deepLinkUrl;
      return;
    } catch {
      // Fall through to direct open / navigation fallback.
    }
  }
  if (typeof window !== 'undefined' && typeof window.open === 'function') {
    if (window.open(deepLinkUrl, '_blank', 'noopener,noreferrer')) {
      return;
    }
  }
  if (typeof window !== 'undefined') {
    window.location.assign(deepLinkUrl);
  }
}

function useOneClickTelegramConnect(
  workspaceKey: string,
  input: PlanRequestPayload,
  activeMemberId: string | undefined,
  pendingHint: string,
) {
  const [isConnecting, setIsConnecting] = useState(false);
  const [pendingNote, setPendingNote] = useState<string | null>(null);

  const handleConnect = useCallback((): void => {
    if (isConnecting) {
      return;
    }
    setPendingNote(null);
    setIsConnecting(true);
    const popup = openPendingWindow();
    void requestOneClickTelegramLink(workspaceKey, input, activeMemberId)
      .then((data) => {
        if (data?.deepLinkUrl) {
          navigateToTelegram(data.deepLinkUrl, popup);
          return;
        }
        popup?.close();
        setPendingNote(pendingHint);
      })
      .catch(() => {
        popup?.close();
        setPendingNote(pendingHint);
      })
      .finally(() => {
        setIsConnecting(false);
      });
  }, [activeMemberId, input, isConnecting, pendingHint, workspaceKey]);

  return { isConnecting, pendingNote, handleConnect };
}

function TelegramStatusNotices({
  syncedFromTelegram,
  pendingNote,
}: {
  readonly syncedFromTelegram: boolean;
  readonly pendingNote: string | null;
}): ReactElement | null {
  if (!syncedFromTelegram && !pendingNote) {
    return null;
  }
  return (
    <>
      {syncedFromTelegram && (
        <div
          role="status"
          aria-live="polite"
          className="inline-flex items-center gap-1.5 rounded-full border border-ok bg-paper-2 px-3 py-1 text-[11px] font-semibold text-ok shadow-lg"
        >
          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Synced from Telegram</span>
        </div>
      )}
      {pendingNote && (
        <p className="max-w-xs rounded-lg border border-rule-2 bg-paper-2 px-3 py-1.5 text-[11px] text-muted shadow-lg">
          {pendingNote}
        </p>
      )}
    </>
  );
}

/**
 * Compact 1-click floating Telegram launcher mounted right above the Family Companion Chat button.
 * Syncs the live household workspace (including GPS city & all members) and redirects straight to Telegram.
 */
export const FloatingTelegramButton = memo(function FloatingTelegramButton(
  props: FloatingTelegramButtonProps,
): ReactElement {
  const { input, workspaceKey, activeMemberId, t } = props;
  const linked = Boolean(props.telegramLinked);
  const { isConnecting, pendingNote, handleConnect } = useOneClickTelegramConnect(
    workspaceKey,
    input,
    activeMemberId,
    t.memberTelegramPendingHint,
  );
  const ButtonIcon = isConnecting ? Loader2 : Send;
  const label = linked ? 'Telegram Synced' : t.memberConnectTelegramButton;
  const showDot = linked && !isConnecting;

  return (
    <div className="flex flex-col items-end gap-1.5">
      <TelegramStatusNotices
        syncedFromTelegram={Boolean(props.syncedFromTelegram)}
        pendingNote={pendingNote}
      />
      <button
        type="button"
        onClick={handleConnect}
        disabled={isConnecting}
        data-loading={isConnecting ? 'true' : undefined}
        aria-label={t.memberConnectTelegramButton}
        title={`${t.memberConnectTelegramButton} (${input.city})`}
        className="btn-secondary touch-target inline-flex items-center gap-2 rounded-full border-accent/60 bg-paper-2 px-3.5 py-2.5 text-xs font-semibold text-ink shadow-xl hover:border-accent"
      >
        <span className="relative inline-flex items-center justify-center">
          <ButtonIcon
            className={`h-4 w-4 text-accent ${isConnecting ? 'icon-spin keep-motion' : ''}`}
            aria-hidden="true"
          />
          {showDot && (
            <span
              aria-hidden="true"
              className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-ok"
            />
          )}
        </span>
        <span className="hidden sm:inline">{label}</span>
      </button>
    </div>
  );
});
