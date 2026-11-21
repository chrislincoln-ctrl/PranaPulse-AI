import { ExternalLink, Loader2, Send } from 'lucide-react';
import { memo, useState, type ReactElement } from 'react';
import type { FamilyMemberInput } from '../domain/types.js';
import type { LocaleDictionary } from '../i18n/translations.js';
import type { SupportedLanguage } from '../validators/schemas.js';

export interface TelegramPairingControlProps {
  readonly member: FamilyMemberInput;
  readonly city: string;
  readonly lat: number;
  readonly lon: number;
  readonly language: SupportedLanguage;
  readonly onChange: (patch: Partial<FamilyMemberInput>) => void;
  readonly t: LocaleDictionary;
}

interface TelegramLinkPayload {
  readonly linkCode?: string;
  readonly deepLinkUrl?: string | null;
  readonly telegramConfigured?: boolean;
}

async function requestTelegramLink(
  props: TelegramPairingControlProps,
): Promise<TelegramLinkPayload | null> {
  const res = await fetch('/api/companion/telegram-link', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      member: props.member,
      city: props.city,
      lat: props.lat,
      lon: props.lon,
      language: props.language,
    }),
  });
  return res.ok ? ((await res.json()) as TelegramLinkPayload) : null;
}

function TelegramLinkFeedback({
  linkState,
  t,
}: {
  readonly linkState: TelegramLinkPayload | null;
  readonly t: LocaleDictionary;
}): ReactElement | null {
  if (!linkState) {
    return null;
  }
  return (
    <div className="space-y-1.5">
      {linkState.deepLinkUrl && (
        <a
          href={linkState.deepLinkUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded border border-accent bg-paper-2 px-3 py-1.5 text-xs font-semibold text-accent hover:bg-paper-3"
        >
          <span>{t.memberOpenTelegramLink}</span>
          <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
        </a>
      )}
      {!linkState.telegramConfigured && (
        <p className="text-xs text-muted">
          {t.memberTelegramPendingHint} {linkState.linkCode ? `(Code: ${linkState.linkCode})` : ''}
        </p>
      )}
    </div>
  );
}

/** 1-tap Telegram pairing link generator and daily 06:30 brief opt-in toggle for one family member. */
export const TelegramPairingControl = memo(function TelegramPairingControl(
  props: TelegramPairingControlProps,
): ReactElement {
  const { member, onChange, t } = props;
  const [linkState, setLinkState] = useState<TelegramLinkPayload | null>(null);
  const [isLinking, setIsLinking] = useState(false);
  const ConnectIcon = isLinking ? Loader2 : Send;

  const handleCreateLink = (): void => {
    setIsLinking(true);
    void requestTelegramLink(props)
      .then((data) => {
        if (data) {
          setLinkState(data);
        }
      })
      .catch(() => undefined)
      .finally(() => {
        setIsLinking(false);
      });
  };

  return (
    <div className="space-y-2.5 border-t border-rule pt-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label htmlFor={`tg-opt-${member.id}`} className="flex items-center gap-2 text-xs text-ink">
          <input
            id={`tg-opt-${member.id}`}
            type="checkbox"
            checked={member.telegramDailyBrief ?? true}
            onChange={(e) => {
              onChange({ telegramDailyBrief: e.target.checked });
            }}
            className="h-4 w-4 accent-[var(--accent)]"
          />
          <span>{t.memberTelegramBriefLabel}</span>
        </label>
        <button
          type="button"
          onClick={handleCreateLink}
          disabled={isLinking}
          data-loading={isLinking ? 'true' : undefined}
          className="btn-secondary touch-target inline-flex items-center gap-1.5 px-3 py-1.5 text-xs"
        >
          <ConnectIcon className={`h-3.5 w-3.5 text-accent ${isLinking ? 'icon-spin keep-motion' : ''}`} aria-hidden="true" />
          <span>{t.memberConnectTelegramButton}</span>
        </button>
      </div>
      <TelegramLinkFeedback linkState={linkState} t={t} />
    </div>
  );
});
