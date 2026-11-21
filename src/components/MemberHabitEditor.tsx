import { ChevronDown, ChevronUp } from 'lucide-react';
import { memo, useState, type ReactElement } from 'react';
import { resolveMemberArchetype } from '../domain/memberScheduleBuilder.js';
import type {
  CommuteModeId,
  FamilyMemberInput,
  MemberRoutineArchetype,
} from '../domain/types.js';
import type { LocaleDictionary } from '../i18n/translations.js';
import type { SupportedLanguage } from '../validators/schemas.js';
import { SelectField } from './FormFields.js';
import { TelegramPairingControl } from './TelegramPairingControl.js';

export interface MemberHabitEditorProps {
  readonly member: FamilyMemberInput;
  readonly city: string;
  readonly lat: number;
  readonly lon: number;
  readonly language: SupportedLanguage;
  readonly onChange: (patch: Partial<FamilyMemberInput>) => void;
  readonly t: LocaleDictionary;
}

const ARCHETYPE_KEYS: readonly MemberRoutineArchetype[] = [
  'school-student',
  'senior-homebound',
  'office-commuter',
  'outdoor-active',
  'home-caregiver',
];

const COMMUTE_KEYS: readonly CommuteModeId[] = [
  'metro',
  'electric-bus',
  'ev-car',
  'petrol-car',
  'two-wheeler',
  'cycling',
  'walking',
];

const MAX_HEALTH_NOTE_LEN = 160;
const MAX_HABIT_NOTE_LEN = 200;

function HabitTimeInputs({
  member,
  onChange,
  t,
}: {
  readonly member: FamilyMemberInput;
  readonly onChange: (patch: Partial<FamilyMemberInput>) => void;
  readonly t: LocaleDictionary;
}): ReactElement {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div>
        <label htmlFor={`leave-${member.id}`} className="mb-1 block text-xs text-muted">
          {t.memberLeaveTimeLabel}
        </label>
        <input
          id={`leave-${member.id}`}
          type="time"
          value={member.leaveHomeTime ?? ''}
          onChange={(e) => {
            onChange({ leaveHomeTime: e.target.value || undefined });
          }}
          className="field-control measured text-sm"
        />
      </div>
      <div>
        <label htmlFor={`return-${member.id}`} className="mb-1 block text-xs text-muted">
          {t.memberReturnTimeLabel}
        </label>
        <input
          id={`return-${member.id}`}
          type="time"
          value={member.returnHomeTime ?? ''}
          onChange={(e) => {
            onChange({ returnHomeTime: e.target.value || undefined });
          }}
          className="field-control measured text-sm"
        />
      </div>
    </div>
  );
}

function HabitNotesInputs({
  member,
  onChange,
  t,
}: {
  readonly member: FamilyMemberInput;
  readonly onChange: (patch: Partial<FamilyMemberInput>) => void;
  readonly t: LocaleDictionary;
}): ReactElement {
  return (
    <div className="grid grid-cols-1 gap-3">
      <div>
        <label htmlFor={`health-${member.id}`} className="mb-1 block text-xs text-muted">
          {t.memberHealthNotesLabel}
        </label>
        <input
          id={`health-${member.id}`}
          type="text"
          maxLength={MAX_HEALTH_NOTE_LEN}
          value={member.healthNotes ?? ''}
          onChange={(e) => {
            onChange({ healthNotes: e.target.value || undefined });
          }}
          className="field-control text-sm"
        />
      </div>
      <div>
        <label htmlFor={`habits-${member.id}`} className="mb-1 block text-xs text-muted">
          {t.memberHabitsNoteLabel}
        </label>
        <input
          id={`habits-${member.id}`}
          type="text"
          maxLength={MAX_HABIT_NOTE_LEN}
          value={member.dailyHabitsNote ?? ''}
          onChange={(e) => {
            onChange({ dailyHabitsNote: e.target.value || undefined });
          }}
          className="field-control text-sm"
        />
      </div>
    </div>
  );
}

function HabitEditorDrawer(props: MemberHabitEditorProps): ReactElement {
  const { member, onChange, t } = props;
  const archetype = resolveMemberArchetype(member);
  return (
    <div className="surface-recessed mt-2 space-y-3 p-3.5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <SelectField
          id={`arch-${member.id}`}
          label={t.memberArchetypeLabel}
          labelClassName="mb-1 block text-xs text-muted"
          value={archetype}
          options={ARCHETYPE_KEYS.map((ak) => ({ value: ak, label: t.archetypeOptions[ak] }))}
          onChangeValue={(nextArch) => {
            onChange({ archetype: nextArch });
          }}
        />
        <SelectField
          id={`commute-${member.id}`}
          label={t.memberCommuteLabel}
          labelClassName="mb-1 block text-xs text-muted"
          value={member.commuteMode ?? 'metro'}
          options={COMMUTE_KEYS.map((ck) => ({ value: ck, label: t.commuteModes[ck] }))}
          onChangeValue={(nextMode) => {
            onChange({ commuteMode: nextMode });
          }}
        />
      </div>
      <HabitTimeInputs member={member} onChange={onChange} t={t} />
      <HabitNotesInputs member={member} onChange={onChange} t={t} />
      <TelegramPairingControl {...props} />
    </div>
  );
}

/** Expandable per-member daily habit, commute timing, health note, and 1-tap Telegram pairing panel. */
export const MemberHabitEditor = memo(function MemberHabitEditor(
  props: MemberHabitEditorProps,
): ReactElement {
  const { member, t } = props;
  const [open, setOpen] = useState(false);
  const archetype = resolveMemberArchetype(member);
  const timingSummary = member.leaveHomeTime
    ? `${member.leaveHomeTime} - ${member.returnHomeTime ?? ''}`.trim()
    : t.archetypeOptions[archetype];

  return (
    <div className="mt-3">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => {
          setOpen((prev) => !prev);
        }}
        className="flex w-full items-center justify-between gap-2 rounded border border-rule bg-paper-2 px-3 py-2 text-left text-xs text-ink-2 transition-colors hover:border-accent hover:text-ink"
      >
        <span className="font-medium">{t.memberHabitsToggle}</span>
        <span className="flex items-center gap-2">
          <span className="measured rounded bg-paper-3 px-2 py-0.5 text-[11px] text-accent">
            {timingSummary}
          </span>
          {open ? (
            <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
          )}
        </span>
      </button>
      {open && <HabitEditorDrawer {...props} />}
    </div>
  );
});
