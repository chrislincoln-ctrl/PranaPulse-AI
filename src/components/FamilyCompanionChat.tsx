import { CheckCircle2, MapPin, MessageCircle, Send, Share2 } from 'lucide-react';
import { memo, type ReactElement, type SyntheticEvent } from 'react';
import { SECURITY_LIMITS } from '../config/constants.js';
import { resolveMemberArchetype } from '../domain/memberScheduleBuilder.js';
import type { FamilyMemberInput, MemberDailySchedule } from '../domain/types.js';
import {
  useCompanionChat,
  type CompanionChatTurn,
  type CompanionGpsPoint,
} from '../hooks/useCompanionChat.js';
import type { LocaleDictionary } from '../i18n/translations.js';
import type { PlanRequestPayload } from '../validators/schemas.js';

export interface FamilyCompanionChatProps {
  readonly input: PlanRequestPayload;
  readonly memberSchedules?: readonly MemberDailySchedule[];
  readonly onApplyMemberPatch: (memberId: string, patch: Partial<FamilyMemberInput>) => void;
  readonly t: LocaleDictionary;
}

function CompanionTurnList({
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
    <ul className="mt-4 max-h-80 space-y-3 overflow-y-auto pr-1">
      {turns.map((turn) => (
        <li key={turn.id} className="space-y-2">
          <div className="ml-auto max-w-[90%] rounded-lg border border-rule bg-paper-3 px-3.5 py-2 text-sm text-ink">
            <div className="text-[11px] font-semibold text-accent">{turn.memberLabel}</div>
            <div>{turn.question}</div>
          </div>
          <div className="surface-recessed max-w-[95%] space-y-1.5 p-3.5 text-sm text-ink">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="measured text-[11px] font-semibold text-accent">
                {turn.metricsLabel}
              </span>
              {turn.scheduleUpdated && (
                <span className="inline-flex items-center gap-1 rounded bg-paper-2 px-2 py-0.5 text-[11px] font-semibold text-ok">
                  <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                  <span>{updatedBadge}</span>
                </span>
              )}
            </div>
            <p className="text-sm leading-relaxed text-ink-2">{turn.reply}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

function ChatActionButtons({
  shareBriefText,
  gpsPoint,
  onToggleGps,
  t,
}: {
  readonly shareBriefText: string | undefined;
  readonly gpsPoint: CompanionGpsPoint | null;
  readonly onToggleGps: () => void;
  readonly t: LocaleDictionary;
}): ReactElement {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {shareBriefText && (
        <a
          href={`https://wa.me/?text=${encodeURIComponent(shareBriefText)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-secondary touch-target inline-flex items-center gap-1.5 px-3 text-xs font-semibold text-ok"
        >
          <Share2 className="h-3.5 w-3.5" aria-hidden="true" />
          <span>{t.shareWhatsAppButton}</span>
        </a>
      )}
      <button
        type="button"
        onClick={onToggleGps}
        className={`btn-secondary touch-target inline-flex items-center gap-1.5 px-3 text-xs ${
          gpsPoint ? 'border-accent text-accent' : ''
        }`}
      >
        <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
        <span>{gpsPoint ? t.companionChatGpsAttached : t.companionChatUseGps}</span>
      </button>
    </div>
  );
}

function ChatMemberControls(p: {
  readonly members: readonly FamilyMemberInput[];
  readonly selectedId: string;
  readonly gpsPoint: CompanionGpsPoint | null;
  readonly shareBriefText: string | undefined;
  readonly onSelectId: (id: string) => void;
  readonly onToggleGps: () => void;
  readonly t: LocaleDictionary;
}): ReactElement {
  return (
    <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-[190px]">
        <label htmlFor="companion-member-select" className="mb-1 block text-xs text-muted">
          {p.t.companionChatMemberLabel}
        </label>
        <select
          id="companion-member-select"
          value={p.selectedId}
          onChange={(e) => {
            p.onSelectId(e.target.value);
          }}
          className="field-control text-sm"
        >
          {p.members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label} · {p.t.archetypeOptions[resolveMemberArchetype(m)]}
            </option>
          ))}
        </select>
      </div>
      <ChatActionButtons
        shareBriefText={p.shareBriefText}
        gpsPoint={p.gpsPoint}
        onToggleGps={p.onToggleGps}
        t={p.t}
      />
    </div>
  );
}

function CompanionChatForm(p: {
  readonly draft: string;
  readonly isSending: boolean;
  readonly onChangeDraft: (next: string) => void;
  readonly onSubmit: (e: SyntheticEvent<HTMLFormElement>) => void;
  readonly t: LocaleDictionary;
}): ReactElement {
  return (
    <form onSubmit={p.onSubmit} className="mt-4 flex flex-col gap-2 sm:flex-row">
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
        className="field-control flex-1 text-sm"
      />
      <button
        type="submit"
        disabled={p.isSending || p.draft.trim().length === 0}
        className="btn-primary touch-target inline-flex items-center justify-center gap-2 px-4 text-sm"
      >
        <Send className="h-4 w-4" aria-hidden="true" />
        <span>{p.isSending ? p.t.companionChatSending : p.t.companionChatSend}</span>
      </button>
    </form>
  );
}

function CompanionChips({
  chips,
  disabled,
  onPick,
}: {
  readonly chips: readonly string[];
  readonly disabled: boolean;
  readonly onPick: (chip: string) => void;
}): ReactElement {
  return (
    <div className="mt-3 flex flex-wrap gap-1.5">
      {chips.map((c) => (
        <button
          key={c}
          type="button"
          disabled={disabled}
          onClick={() => {
            onPick(c);
          }}
          className="rounded-full border border-rule bg-paper-2 px-3 py-1 text-xs text-ink-2 transition-colors hover:border-accent hover:text-ink"
        >
          {c}
        </button>
      ))}
    </div>
  );
}

/** Interactive per-member Family Companion Chatbot with live telemetry and WhatsApp brief sharing. */
export const FamilyCompanionChat = memo(function FamilyCompanionChat({
  input,
  memberSchedules = [],
  onApplyMemberPatch,
  t,
}: FamilyCompanionChatProps): ReactElement {
  const state = useCompanionChat(input, onApplyMemberPatch);
  const activeBrief = memberSchedules.find(
    (s) => s.memberId === state.activeMember?.id,
  )?.shareBriefText;
  return (
    <section aria-labelledby="companion-chat-title" className="surface-hairline p-4 sm:p-6">
      <div className="flex items-start gap-2.5">
        <MessageCircle className="mt-1 h-5 w-5 shrink-0 text-accent" aria-hidden="true" />
        <div>
          <h3 id="companion-chat-title" className="text-ink">
            {t.companionChatHeading}
          </h3>
          <p className="mt-1 text-xs text-ink-2">{t.companionChatSubheading}</p>
        </div>
      </div>
      <ChatMemberControls
        members={input.members}
        selectedId={state.activeMember?.id ?? ''}
        gpsPoint={state.gpsPoint}
        shareBriefText={activeBrief}
        onSelectId={state.setSelectedMemberId}
        onToggleGps={state.toggleGps}
        t={t}
      />
      <CompanionChips
        chips={t.companionChatChips}
        disabled={state.isSending}
        onPick={state.sendQuestion}
      />
      <CompanionTurnList turns={state.turns} updatedBadge={t.companionChatUpdatedBadge} />
      <CompanionChatForm
        draft={state.draft}
        isSending={state.isSending}
        onChangeDraft={state.setDraft}
        onSubmit={(e) => {
          e.preventDefault();
          state.sendQuestion(state.draft);
        }}
        t={t}
      />
    </section>
  );
});
