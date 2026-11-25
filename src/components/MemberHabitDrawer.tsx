import { Sparkles } from 'lucide-react';
import { type ReactElement } from 'react';
import { resolveMemberArchetype } from '../domain/memberScheduleBuilder.js';
import type { CommuteModeId, FamilyMemberInput, MemberRoutineArchetype } from '../domain/types.js';
import type { LocaleDictionary } from '../i18n/translations.js';
import { deriveOutdoorHoursFromTimes } from '../utils/inputSanitizer.js';
import { SelectField } from './FormFields.js';

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
            const leaveHomeTime = e.target.value || undefined;
            const hrs = deriveOutdoorHoursFromTimes(leaveHomeTime, member.returnHomeTime);
            onChange({ leaveHomeTime, ...(hrs !== undefined ? { dailyOutdoorHours: hrs } : {}) });
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
            const returnHomeTime = e.target.value || undefined;
            const hrs = deriveOutdoorHoursFromTimes(member.leaveHomeTime, returnHomeTime);
            onChange({ returnHomeTime, ...(hrs !== undefined ? { dailyOutdoorHours: hrs } : {}) });
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

/** Expanded per-member routine preset, commute mode, leave/return time, and health note editor. */
export function HabitEditorDrawer({
  member,
  onChange,
  t,
}: {
  readonly member: FamilyMemberInput;
  readonly onChange: (patch: Partial<FamilyMemberInput>) => void;
  readonly t: LocaleDictionary;
}): ReactElement {
  const archetype = resolveMemberArchetype(member);
  return (
    <div className="surface-recessed mt-2.5 space-y-3 border-l-2 border-accent p-4">
      <div className="flex items-center gap-1.5 text-[11px] font-medium text-ok">
        <Sparkles className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span>{t.ui.habitLiveSyncedNote}</span>
      </div>
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
    </div>
  );
}
