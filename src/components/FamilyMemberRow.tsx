import { Trash2, UserRound } from 'lucide-react';
import { memo, type ReactElement } from 'react';
import { VALIDATION_BOUNDS } from '../config/constants.js';
import { DEFAULT_WORKSPACE_INPUT, SLIDER_LIMITS } from '../config/uiConstants.js';
import type {
  FamilyMemberAdvisory,
  FamilyMemberInput,
  FamilyRole,
  MaskTypeId,
} from '../domain/types.js';
import type { LocaleDictionary } from '../i18n/translations.js';
import type { SupportedLanguage } from '../validators/schemas.js';
import { CustomVerifiedSelect } from './CustomVerifiedSelect.js';
import { SelectField } from './FormFields.js';
import { MemberHabitEditor } from './MemberHabitEditor.js';

export interface FamilyMemberRowProps {
  readonly member: FamilyMemberInput;
  readonly memberNumber: number;
  readonly advisory: FamilyMemberAdvisory | undefined;
  readonly language: SupportedLanguage;
  readonly city?: string | undefined;
  readonly lat?: number | undefined;
  readonly lon?: number | undefined;
  readonly canRemove: boolean;
  readonly onChange: (patch: Partial<FamilyMemberInput>) => void;
  readonly onRemove: () => void;
  readonly t: LocaleDictionary;
}

const ROLE_KEYS: readonly FamilyRole[] = ['child', 'senior-respiratory', 'commuter', 'caregiver'];
const MASK_KEYS: readonly MaskTypeId[] = ['none', 'cloth', 'surgical', 'n95-ffp2'];

function statusTone(status: FamilyMemberAdvisory['outdoorStatus']): string {
  if (status === 'stay-indoors' || status === 'limit-short') {
    return 'text-bad';
  }
  if (status === 'caution-masked') {
    return 'text-accent';
  }
  return 'text-ok';
}

function MemberNameInput({
  member,
  label,
  onChangeName,
}: {
  readonly member: FamilyMemberInput;
  readonly label: string;
  readonly onChangeName: (nextName: string) => void;
}): ReactElement {
  return (
    <div className="min-w-0 sm:col-span-5">
      <label htmlFor={`name-${member.id}`} className="mb-1 block text-xs text-muted">
        {label}
      </label>
      <input
        id={`name-${member.id}`}
        type="text"
        value={member.label}
        maxLength={VALIDATION_BOUNDS.MAX_CITY_QUERY_LEN}
        onChange={(e) => {
          onChangeName(e.target.value);
        }}
        className="field-control text-sm"
      />
    </div>
  );
}

function MemberIdentityRow(props: FamilyMemberRowProps): ReactElement {
  const { member, language, canRemove, onChange, onRemove, t } = props;
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-12 sm:items-start">
      <MemberNameInput
        member={member}
        label={t.memberNameLabel}
        onChangeName={(label) => {
          onChange({ label });
        }}
      />
      <div className="min-w-0 sm:col-span-5">
        <CustomVerifiedSelect
          id={`role-${member.id}`}
          label={t.memberRoleLabel}
          labelClassName="mb-1 block text-xs text-muted"
          category="role"
          scopeKey={`role:${member.id}`}
          value={member.role}
          language={language}
          options={ROLE_KEYS.map((rk) => ({ value: rk, label: t.roleOptions[rk] }))}
          onChangeValue={(role) => {
            onChange({ role });
          }}
          t={t}
        />
      </div>
      <div className="flex sm:col-span-2 sm:justify-end sm:pt-5">
        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            aria-label={`${t.removeMemberButton} ${member.label}`}
            className="btn-secondary touch-target inline-flex items-center justify-center px-3"
          >
            <Trash2 className="h-4 w-4 text-bad" aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  );
}

function MemberDoseBadge({
  advisory,
  t,
}: {
  readonly advisory: FamilyMemberAdvisory | undefined;
  readonly t: LocaleDictionary;
}): ReactElement | null {
  if (!advisory) {
    return null;
  }
  return (
    <div className="surface-recessed px-3 py-2 text-xs">
      <div className={`font-semibold ${statusTone(advisory.outdoorStatus)}`}>
        {t.outdoorStatuses[advisory.outdoorStatus]}
      </div>
      <div className="mt-0.5 flex items-center justify-between gap-2 text-ink-2">
        <span>{t.memberDoseLabel}:</span>
        <span className="measured font-medium text-ink">{advisory.estimatedDailyInhaledUg} ug</span>
      </div>
    </div>
  );
}

function MemberExposureRow(props: FamilyMemberRowProps): ReactElement {
  const { member, advisory, onChange, t } = props;
  return (
    <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-12 sm:items-end">
      <div className="min-w-0 sm:col-span-4">
        <SelectField
          id={`mask-${member.id}`}
          label={t.memberMaskLabel}
          labelClassName="mb-1 block text-xs text-muted"
          value={member.mask}
          options={MASK_KEYS.map((mk) => ({ value: mk, label: t.maskOptions[mk] }))}
          onChangeValue={(mask) => {
            onChange({ mask });
          }}
        />
      </div>
      <div className="min-w-0 sm:col-span-3">
        <label htmlFor={`hrs-${member.id}`} className="mb-1 block text-xs text-muted">
          {t.memberHoursLabel}
        </label>
        <input
          id={`hrs-${member.id}`}
          type="number"
          min={0}
          max={SLIDER_LIMITS.MEMBER_OUTDOOR_MAX_HR}
          step={SLIDER_LIMITS.MEMBER_OUTDOOR_STEP_HR}
          value={member.dailyOutdoorHours}
          onChange={(e) => {
            onChange({ dailyOutdoorHours: Number(e.target.value) || 0 });
          }}
          className="field-control measured text-sm"
        />
      </div>
      <div className="min-w-0 sm:col-span-5">
        <MemberDoseBadge advisory={advisory} t={t} />
      </div>
    </div>
  );
}

function MemberBadgeHeader({
  memberNumber,
  prefix,
}: {
  readonly memberNumber: number;
  readonly prefix: string;
}): ReactElement {
  return (
    <div className="mb-2.5 flex items-center gap-2">
      <span
        aria-hidden="true"
        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-rule-2 bg-paper-3 text-accent"
      >
        <UserRound className="h-3.5 w-3.5" />
      </span>
      <span className="measured text-xs font-semibold text-ink">
        {prefix} {String(memberNumber)}
      </span>
    </div>
  );
}

/**
 * Editable 2-row household member card displaying personalized pulmonary dose and protective status
 * with "Other (Add your own)" AI vulnerability profile verification.
 */
export const FamilyMemberRow = memo(function FamilyMemberRow(
  props: FamilyMemberRowProps,
): ReactElement {
  return (
    <li className="surface-recessed p-4 transition-colors hover:border-rule-2">
      <MemberBadgeHeader memberNumber={props.memberNumber} prefix={props.t.newMemberPrefix} />
      <MemberIdentityRow {...props} />
      <MemberExposureRow {...props} />
      <MemberHabitEditor
        member={props.member}
        city={props.city ?? DEFAULT_WORKSPACE_INPUT.city}
        lat={props.lat ?? DEFAULT_WORKSPACE_INPUT.lat}
        lon={props.lon ?? DEFAULT_WORKSPACE_INPUT.lon}
        language={props.language}
        onChange={props.onChange}
        t={props.t}
      />
    </li>
  );
});
