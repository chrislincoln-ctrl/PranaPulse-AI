import { CheckCircle2, Loader2, MapPin, Send, Share2 } from 'lucide-react';
import { type ReactElement, type SyntheticEvent } from 'react';
import { SECURITY_LIMITS } from '../config/constants.js';
import { resolveMemberArchetype } from '../domain/memberScheduleBuilder.js';
import type { FamilyMemberInput } from '../domain/types.js';
import type { CompanionChatTurn, CompanionGpsPoint } from '../hooks/useCompanionChat.js';
import type { LocaleDictionary } from '../i18n/translations.js';

export function CompanionTurnList({
  turns,
  updatedBadge,
}: {
  readonly turns: readonly CompanionChatTurn[];
  readonly updatedBadge: string;
}): ReactElement | null {
  if (turns.length === 0) {
    return null;
  }
  return (
    <ul className="mt-3 max-h-64 space-y-2.5 overflow-y-auto pr-1">
      {turns.map((turn) => (
        <li key={turn.id} className="space-y-1.5">
          <div className="ml-auto max-w-[90%] rounded-lg border border-rule bg-paper-3 px-3 py-2 text-xs text-ink">
            <div className="text-[11px] font-semibold text-accent">{turn.memberLabel}</div>
            <div>{turn.question}</div>
          </div>
          <div className="surface-recessed max-w-[96%] space-y-1 p-3 text-xs text-ink">
            <div className="flex flex-wrap items-center justify-between gap-1.5">
              <span className="measured text-[10px] font-semibold text-accent">
                {turn.metricsLabel}
              </span>
              {turn.scheduleUpdated && (
                <span className="inline-flex items-center gap-1 rounded bg-paper-2 px-1.5 py-0.5 text-[10px] font-semibold text-ok">
                  <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                  <span>{updatedBadge}</span>
                </span>
              )}
            </div>
            <p className="text-xs leading-relaxed text-ink-2">{turn.reply}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

function MemberSelectField(p: {
  readonly members: readonly FamilyMemberInput[];
  readonly selectedId: string;
  readonly onSelectId: (id: string) => void;
  readonly t: LocaleDictionary;
}): ReactElement {
  return (
    <div className="min-w-0 w-full sm:flex-1 sm:min-w-[175px]">
      <label htmlFor="companion-member-select" className="mb-1 block text-[11px] text-muted">
        {p.t.companionChatMemberLabel}
      </label>
      <select
        id="companion-member-select"
        value={p.selectedId}
        onChange={(e) => {
          p.onSelectId(e.target.value);
        }}
        className="field-control py-1.5 text-xs"
      >
        {p.members.map((m) => (
          <option key={m.id} value={m.id}>
            {m.label} · {p.t.archetypeOptions[resolveMemberArchetype(m)]}
          </option>
        ))}
      </select>
    </div>
  );
}

function resolveGpsButtonLabel(
  isLocating: boolean | undefined,
  gpsPoint: CompanionGpsPoint | null,
  t: LocaleDictionary,
): string {
  if (isLocating) {
    return t.gpsLoading;
  }
  return gpsPoint ? t.companionChatGpsAttached : t.companionChatUseGps;
}

export function ChatMemberControls(p: {
  readonly members: readonly FamilyMemberInput[];
  readonly selectedId: string;
  readonly gpsPoint: CompanionGpsPoint | null;
  readonly isLocatingGps?: boolean | undefined;
  readonly shareBriefText: string | undefined;
  readonly onSelectId: (id: string) => void;
  readonly onToggleGps: () => void;
  readonly t: LocaleDictionary;
}): ReactElement {
  const GpsIcon = p.isLocatingGps ? Loader2 : MapPin;
  return (
    <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
      <MemberSelectField
        members={p.members}
        selectedId={p.selectedId}
        onSelectId={p.onSelectId}
        t={p.t}
      />
      <div className="flex flex-wrap items-center gap-1.5">
        {p.shareBriefText && (
          <a
            href={`https://wa.me/?text=${encodeURIComponent(p.shareBriefText)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-ok"
          >
            <Share2 className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{p.t.shareWhatsAppButton}</span>
          </a>
        )}
        <button
          type="button"
          onClick={p.onToggleGps}
          disabled={p.isLocatingGps}
          data-loading={p.isLocatingGps ? 'true' : undefined}
          className={`btn-secondary inline-flex items-center gap-1 px-2.5 py-1.5 text-xs ${p.gpsPoint ? 'border-accent text-accent' : ''}`}
        >
          <GpsIcon
            className={`h-3.5 w-3.5 ${p.isLocatingGps ? 'icon-spin keep-motion text-accent' : ''}`}
            aria-hidden="true"
          />
          <span>{resolveGpsButtonLabel(p.isLocatingGps, p.gpsPoint, p.t)}</span>
        </button>
      </div>
    </div>
  );
}

export function CompanionChipsRow(p: {
  readonly chips: readonly string[];
  readonly disabled: boolean;
  readonly onPick: (chip: string) => void;
}): ReactElement {
  return (
    <div className="mt-2.5 flex flex-wrap gap-1">
      {p.chips.map((c) => (
        <button
          key={c}
          type="button"
          disabled={p.disabled}
          onClick={() => {
            p.onPick(c);
          }}
          className="rounded-full border border-rule bg-paper-3 px-2.5 py-1 text-left text-[11px] text-ink-2 hover:border-accent hover:text-ink"
        >
          {c}
        </button>
      ))}
    </div>
  );
}

export function CompanionChatForm(p: {
  readonly draft: string;
  readonly isSending: boolean;
  readonly onChangeDraft: (next: string) => void;
  readonly onSubmit: (e: SyntheticEvent<HTMLFormElement>) => void;
  readonly t: LocaleDictionary;
}): ReactElement {
  return (
    <form onSubmit={p.onSubmit} className="mt-3 flex gap-2">
      <label htmlFor="companion-chat-input" className="sr-only">
        {p.t.companionChatPlaceholder}
      </label>
      <input
        id="companion-chat-input"
        type="text"
        value={p.draft}
        maxLength={SECURITY_LIMITS.MAX_CHAT_QUERY_CHARS}
        placeholder={p.t.companionChatPlaceholder}
        onChange={(e) => {
          p.onChangeDraft(e.target.value);
        }}
        className="field-control flex-1 py-2 text-xs"
      />
      <button
        type="submit"
        disabled={p.isSending || p.draft.trim().length === 0}
        data-loading={p.isSending ? 'true' : undefined}
        className="btn-primary touch-target inline-flex shrink-0 items-center justify-center gap-1.5 px-3 text-xs"
      >
        {p.isSending ? (
          <Loader2 className="h-3.5 w-3.5 icon-spin keep-motion" aria-hidden="true" />
        ) : (
          <Send className="h-3.5 w-3.5" aria-hidden="true" />
        )}
        <span>{p.isSending ? p.t.companionChatSending : p.t.companionChatSend}</span>
      </button>
    </form>
  );
}
