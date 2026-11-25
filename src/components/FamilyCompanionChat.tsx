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
import { FloatingTelegramButton } from './FloatingTelegramButton.js';

export interface FamilyCompanionChatProps {
  readonly input: PlanRequestPayload;
  readonly memberSchedules?: readonly MemberDailySchedule[];
  readonly workspaceKey?: string | undefined;
  readonly telegramLinked?: boolean | undefined;
  readonly syncedFromTelegram?: boolean | undefined;
  readonly defaultOpen?: boolean;
  readonly onApplyMemberPatch: (memberId: string, patch: Partial<FamilyMemberInput>) => void;
  readonly t: LocaleDictionary;
}

function CompanionDrawerHeader(p: {
  readonly heading: string;
  readonly subheading: string;
  readonly closeAriaLabel: string;
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
        aria-label={p.closeAriaLabel}
        className="btn-secondary inline-flex h-11 w-11 min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-full p-0 text-muted hover:text-ink"
      >
        <X className="h-4 w-4" aria-hidden="true" />
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
      className="fixed inset-x-3 bottom-32 z-[90] max-h-[calc(100dvh-9.5rem)] overflow-y-auto rounded-xl border border-rule-2 bg-paper-2 p-4 shadow-2xl sm:inset-x-auto sm:right-6 sm:bottom-40 sm:w-[440px] print:hidden"
    >
      <CompanionDrawerHeader
        heading={p.t.companionChatHeading}
        subheading={p.t.companionChatSubheading}
        closeAriaLabel={p.t.ui.closeCompanionChatAria}
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

interface FloatingActionDockProps {
  readonly input: PlanRequestPayload;
  readonly workspaceKey: string;
  readonly activeMemberId: string | undefined;
  readonly telegramLinked: boolean;
  readonly syncedFromTelegram: boolean;
  readonly isOpen: boolean;
  readonly onToggleOpen: () => void;
  readonly t: LocaleDictionary;
}

function FloatingActionDock(p: FloatingActionDockProps): ReactElement {
  const LauncherIcon = p.isOpen ? X : MessageCircle;
  return (
    <div className="fixed right-4 bottom-4 z-[90] flex flex-col items-end gap-2.5 sm:right-6 sm:bottom-6 print:hidden">
      <FloatingTelegramButton
        input={p.input}
        workspaceKey={p.workspaceKey}
        activeMemberId={p.activeMemberId}
        telegramLinked={p.telegramLinked}
        syncedFromTelegram={p.syncedFromTelegram}
        t={p.t}
      />
      <button
        type="button"
        aria-label={p.t.companionChatHeading}
        aria-expanded={p.isOpen}
        {...(p.isOpen ? { 'aria-controls': 'family-companion-drawer' } : {})}
        onClick={p.onToggleOpen}
        className="btn-primary touch-target inline-flex items-center gap-2 rounded-full px-4 py-3 text-xs font-semibold shadow-xl"
      >
        <LauncherIcon className="h-4 w-4" aria-hidden="true" />
        <span className="hidden sm:inline">{p.t.companionChatHeading}</span>
      </button>
    </div>
  );
}

/**
 * Floating bottom-right Telegram 1-click launcher stacked directly above the Family Companion Chat
 * launcher, persistent across all 6 console pages.
 */
export const FamilyCompanionChat = memo(function FamilyCompanionChat(
  props: FamilyCompanionChatProps,
): ReactElement {
  const { input, onApplyMemberPatch, t } = props;
  const [isOpen, setIsOpen] = useState(Boolean(props.defaultOpen));
  const state = useCompanionChat(input, onApplyMemberPatch);
  const schedules = props.memberSchedules ?? [];
  const activeBrief = schedules.find((s) => s.memberId === state.activeMember?.id)?.shareBriefText;

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
      <FloatingActionDock
        input={input}
        workspaceKey={props.workspaceKey ?? 'whome001'}
        activeMemberId={state.activeMember?.id}
        telegramLinked={Boolean(props.telegramLinked)}
        syncedFromTelegram={Boolean(props.syncedFromTelegram)}
        isOpen={isOpen}
        onToggleOpen={() => {
          setIsOpen((prev) => !prev);
        }}
        t={t}
      />
    </>
  );
});
