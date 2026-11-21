import { ChevronDown, ChevronUp, Clock, HeartPulse, SlidersHorizontal } from 'lucide-react';
import { memo, useState, type ReactElement } from 'react';
import { resolveMemberArchetype } from '../domain/memberScheduleBuilder.js';
import type { FamilyMemberInput } from '../domain/types.js';
import type { LocaleDictionary } from '../i18n/translations.js';
import type { SupportedLanguage } from '../validators/schemas.js';
import { HabitEditorDrawer } from './MemberHabitDrawer.js';

export interface MemberHabitEditorProps {
  readonly member: FamilyMemberInput;
  readonly city: string;
  readonly lat: number;
  readonly lon: number;
  readonly language: SupportedLanguage;
  readonly onChange: (patch: Partial<FamilyMemberInput>) => void;
  readonly t: LocaleDictionary;
}

function HabitTriggerBadges({
  timingSummary,
  open,
}: {
  readonly timingSummary: string;
  readonly open: boolean;
}): ReactElement {
  const ArrowIcon = open ? ChevronUp : ChevronDown;
  return (
    <span className="flex shrink-0 items-center gap-2">
      <span className="measured inline-flex items-center gap-1.5 rounded-full border border-accent/40 bg-paper-3 px-2.5 py-1 text-[11px] font-semibold text-accent">
        <Clock className="h-3 w-3 shrink-0" aria-hidden="true" />
        <span>{timingSummary}</span>
      </span>
      <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2.5 py-1 text-[11px] font-semibold text-accent-ink">
        <span>{open ? 'Done' : 'Edit'}</span>
        <ArrowIcon className="h-3.5 w-3.5" aria-hidden="true" />
      </span>
    </span>
  );
}

function HabitTriggerMeta({
  title,
  archetypeLabel,
  commuteLabel,
  hasHealthNote,
}: {
  readonly title: string;
  readonly archetypeLabel: string;
  readonly commuteLabel: string | null;
  readonly hasHealthNote: boolean;
}): ReactElement {
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      <span
        aria-hidden="true"
        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-accent/45 bg-accent-soft text-accent transition-transform group-hover:scale-105"
      >
        <SlidersHorizontal className="h-4 w-4" />
      </span>
      <span className="min-w-0">
        <span className="block text-xs font-semibold text-ink sm:text-[13px]">{title}</span>
        <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-ink-2">
          <span>{archetypeLabel}</span>
          {commuteLabel && (
            <>
              <span aria-hidden="true">·</span>
              <span>{commuteLabel}</span>
            </>
          )}
          {hasHealthNote && (
            <span className="inline-flex items-center gap-1 text-bad">
              <HeartPulse className="h-3 w-3 shrink-0" aria-hidden="true" />
              <span>Health note</span>
            </span>
          )}
        </span>
      </span>
    </span>
  );
}

/** High-visibility expandable per-member daily habit, commute timing, and respiratory note editor. */
export const MemberHabitEditor = memo(function MemberHabitEditor(
  props: MemberHabitEditorProps,
): ReactElement {
  const { member, onChange, t } = props;
  const [open, setOpen] = useState(false);
  const archetype = resolveMemberArchetype(member);
  const archetypeLabel = t.archetypeOptions[archetype];
  const commuteLabel = member.commuteMode ? t.commuteModes[member.commuteMode] : null;
  const timingSummary = member.leaveHomeTime
    ? `${member.leaveHomeTime} - ${member.returnHomeTime ?? ''}`.trim()
    : archetypeLabel;

  return (
    <div className="mt-3.5">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => {
          setOpen((prev) => !prev);
        }}
        className="habit-trigger-card group flex w-full flex-wrap items-center justify-between gap-2.5 rounded-lg px-3.5 py-2.5 text-left"
      >
        <HabitTriggerMeta
          title={t.memberHabitsToggle}
          archetypeLabel={archetypeLabel}
          commuteLabel={commuteLabel}
          hasHealthNote={Boolean(member.healthNotes)}
        />
        <HabitTriggerBadges timingSummary={timingSummary} open={open} />
      </button>
      {open && <HabitEditorDrawer member={member} onChange={onChange} t={t} />}
    </div>
  );
});
