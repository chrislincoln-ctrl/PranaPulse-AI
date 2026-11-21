import { MessageCircle, X } from 'lucide-react';
import { memo, useState, type ReactElement } from 'react';
import type { FamilyMemberInput, MemberDailySchedule } from '../domain/types.js';
import { useCompanionChat } from '../hooks/useCompanionChat.js';
import type { LocaleDictionary } from '../i18n/translations.js';
import type { PlanRequestPayload } from '../validators/schemas.js';
import {
  ChatMemberControls,
  CompanionChatForm,
  CompanionChipsRow,
  CompanionTurnList,
} from './CompanionDrawerContent.js';

export interface FamilyCompanionChatProps {
  readonly input: PlanRequestPayload;
  readonly memberSchedules?: readonly MemberDailySchedule[];
  readonly defaultOpen?: boolean;
  readonly onApplyMemberPatch: (memberId: string, patch: Partial<FamilyMemberInput>) => void;
  readonly t: LocaleDictionary;
}

function CompanionDrawerHeader(p: {
  readonly heading: string;
  readonly subheading: string;
  readonly onClose: () => void;
}): ReactElement {
  return (
    <div className="flex items-start justify-between gap-2 border-b border-rule pb-2.5">
      <div>
        <h3 id="companion-chat-title" className="text-sm font-semibold text-ink">
          {p.heading}
        </h3>
        <p className="mt-0.5 text-[11px] text-ink-2">{p.subheading}</p>
      </div>
      <button
        type="button"
        onClick={p.onClose}
        aria-label="Close companion chat"
        className="btn-secondary inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full p-0 text-muted hover:text-ink"
      >
        <X className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </div>
  );
}

function CompanionFloatingDrawer(p: {
  readonly members: readonly FamilyMemberInput[];
  readonly activeBrief: string | undefined;
  readonly state: ReturnType<typeof useCompanionChat>;
  readonly onClose: () => void;
  readonly t: LocaleDictionary;
}): ReactElement {
  return (
    <section
      id="family-companion-drawer"
      aria-labelledby="companion-chat-title"
      className="fixed right-4 bottom-20 z-50 w-[calc(100vw-2rem)] max-w-md rounded-xl border border-rule-2 bg-paper-2 p-4 shadow-2xl sm:right-6 sm:w-[440px]"
    >
      <CompanionDrawerHeader
        heading={p.t.companionChatHeading}
        subheading={p.t.companionChatSubheading}
        onClose={p.onClose}
      />
      <ChatMemberControls
        members={p.members}
        selectedId={p.state.activeMember?.id ?? ''}
        gpsPoint={p.state.gpsPoint}
        isLocatingGps={p.state.isLocatingGps}
        shareBriefText={p.activeBrief}
        onSelectId={p.state.setSelectedMemberId}
        onToggleGps={p.state.toggleGps}
        t={p.t}
      />
      <CompanionChipsRow
        chips={p.t.companionChatChips}
        disabled={p.state.isSending}
        onPick={p.state.sendQuestion}
      />
      <CompanionTurnList turns={p.state.turns} updatedBadge={p.t.companionChatUpdatedBadge} />
      <CompanionChatForm
        draft={p.state.draft}
        isSending={p.state.isSending}
        onChangeDraft={p.state.setDraft}
        onSubmit={(e) => {
          e.preventDefault();
          p.state.sendQuestion(p.state.draft);
        }}
        t={p.t}
      />
    </section>
  );
}

/** Floating bottom-right Family Companion Chat launcher & popover available across all console tabs. */
export const FamilyCompanionChat = memo(function FamilyCompanionChat({
  input,
  memberSchedules = [],
  defaultOpen = false,
  onApplyMemberPatch,
  t,
}: FamilyCompanionChatProps): ReactElement {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const state = useCompanionChat(input, onApplyMemberPatch);
  const activeBrief = memberSchedules.find(
    (s) => s.memberId === state.activeMember?.id,
  )?.shareBriefText;
  const LauncherIcon = isOpen ? X : MessageCircle;
  return (
    <>
      {isOpen && (
        <CompanionFloatingDrawer
          members={input.members}
          activeBrief={activeBrief}
          state={state}
          onClose={() => {
            setIsOpen(false);
          }}
          t={t}
        />
      )}
      <button
        type="button"
        aria-label={t.companionChatHeading}
        aria-expanded={isOpen}
        {...(isOpen ? { 'aria-controls': 'family-companion-drawer' } : {})}
        onClick={() => {
          setIsOpen((prev) => !prev);
        }}
        className="btn-primary touch-target fixed right-4 bottom-4 z-50 inline-flex items-center gap-2 rounded-full px-4 py-3 text-xs font-semibold shadow-xl sm:right-6 sm:bottom-6"
      >
        <LauncherIcon className="h-4 w-4" aria-hidden="true" />
        <span className="hidden sm:inline">{t.companionChatHeading}</span>
      </button>
    </>
  );
});
