import { AlertTriangle, CheckCircle2, Loader2, Sparkles } from 'lucide-react';
import type { ReactElement } from 'react';
import { VALIDATION_BOUNDS } from '../config/constants.js';
import {
  OTHER_SENTINEL,
  resolveCustomSelectValue,
  useCustomVerifyController,
  type VerifyApiResult,
} from '../hooks/useCustomVerifyController.js';
import type {
  CustomVerifyCategory,
  VerifiedCustomOption,
} from '../hooks/useVerifiedCustomOptions.js';
import type { LocaleDictionary } from '../i18n/translations.js';
import type { SupportedLanguage } from '../validators/schemas.js';
import { SelectField, type SelectOptionItem } from './FormFields.js';

export type { CustomVerifyCategory };

export interface CustomVerifiedSelectProps<T extends string> {
  readonly id: string;
  readonly label: string;
  readonly category: CustomVerifyCategory;
  readonly scopeKey?: string;
  readonly value: T;
  readonly options: readonly SelectOptionItem<T>[];
  readonly language: SupportedLanguage;
  readonly onChangeValue: (nextValue: T) => void;
  readonly t: LocaleDictionary;
  readonly labelClassName?: string;
}

export function VerificationBanner({
  isValid,
  message,
}: {
  readonly isValid: boolean;
  readonly message: string;
}): ReactElement {
  const tone = isValid ? 'border-ok bg-paper-2 text-ok' : 'border-bad bg-bad-soft text-bad';
  return (
    <div
      role={isValid ? 'status' : 'alert'}
      className={`mt-2 flex items-start gap-1.5 rounded border p-2 text-xs ${tone}`}
    >
      {isValid ? (
        <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      ) : (
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      )}
      <span>{message}</span>
    </div>
  );
}

function VerifiedNotePill({
  expanded,
  explanation,
  onToggle,
}: {
  readonly expanded: boolean;
  readonly explanation: string;
  readonly onToggle: () => void;
}): ReactElement {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={expanded}
      title={explanation}
      className="inline-flex shrink-0 items-center gap-1 rounded border border-ok/40 bg-paper-2 px-1.5 py-0 text-[11px] leading-4 font-medium text-ok transition-colors hover:border-ok"
    >
      <CheckCircle2 className="h-3 w-3 shrink-0" aria-hidden="true" />
      <span>AI</span>
    </button>
  );
}

function CustomEntryDrawer(props: {
  readonly id: string;
  readonly customText: string;
  readonly verifying: boolean;
  readonly feedback: VerifyApiResult | null;
  readonly onChangeText: (val: string) => void;
  readonly onVerify: () => void;
  readonly t: LocaleDictionary;
}): ReactElement {
  const { id, customText, verifying, feedback, onChangeText, onVerify, t } = props;
  return (
    <div className="mt-2">
      <div className="flex flex-col gap-1.5">
        <input
          id={`${id}-custom-input`}
          type="text"
          value={customText}
          maxLength={VALIDATION_BOUNDS.MAX_CITY_QUERY_LEN}
          placeholder={t.customInputPlaceholder}
          aria-label={t.customInputPlaceholder}
          onChange={(e) => {
            onChangeText(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              onVerify();
            }
          }}
          className="field-control w-full text-xs"
        />
        <button
          type="button"
          onClick={onVerify}
          disabled={verifying || customText.trim().length === 0}
          data-loading={verifying ? 'true' : undefined}
          className="btn-secondary touch-target inline-flex w-full items-center justify-center gap-1.5 px-3 text-xs"
        >
          {verifying ? (
            <Loader2 className="h-3.5 w-3.5 icon-spin keep-motion text-accent" aria-hidden="true" />
          ) : (
            <Sparkles className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
          )}
          <span>{verifying ? t.verifyingCustomButton : t.verifyCustomButton}</span>
        </button>
      </div>
      {feedback && <VerificationBanner isValid={feedback.isValid} message={feedback.explanation} />}
    </div>
  );
}

function buildVerifiedAddon(
  matchedActive: VerifiedCustomOption | null,
  showNote: boolean,
  onToggle: () => void,
): ReactElement | undefined {
  if (!matchedActive) {
    return undefined;
  }
  return (
    <VerifiedNotePill
      expanded={showNote}
      explanation={matchedActive.explanation}
      onToggle={onToggle}
    />
  );
}

function buildExtendedOptions<T extends string>(
  options: readonly SelectOptionItem<T>[],
  customOptions: readonly VerifiedCustomOption[],
  otherLabel: string,
): readonly SelectOptionItem<string>[] {
  return [
    ...options,
    ...customOptions.map((item) => ({ value: item.id, label: item.label })),
    { value: OTHER_SENTINEL, label: otherLabel },
  ];
}

function resolveMatchedActive(
  isOtherOpen: boolean,
  activeCustom: VerifiedCustomOption | null,
  value: string,
): VerifiedCustomOption | null {
  if (isOtherOpen || activeCustom?.mappedValue !== value) {
    return null;
  }
  return activeCustom;
}

/**
 * Select dropdown with an "Other (Add your own)" option that verifies user-entered
 * preferences with Gemini, adds verified entries into the dropdown, and minimizes automatically.
 */
export function CustomVerifiedSelect<T extends string>({
  id,
  label,
  category,
  scopeKey,
  value,
  options,
  language,
  onChangeValue,
  t,
  labelClassName = 'mb-1 block text-sm text-ink-2',
}: CustomVerifiedSelectProps<T>): ReactElement {
  const ctrl = useCustomVerifyController({
    category,
    scopeKey: scopeKey ?? category,
    language,
    onChangeValue: (nextVal) => {
      onChangeValue(nextVal as T);
    },
  });
  const matchedActive = resolveMatchedActive(ctrl.isOtherOpen, ctrl.activeCustom, value);
  const extendedOptions = buildExtendedOptions(options, ctrl.customOptions, t.otherOptionLabel);

  return (
    <div>
      <SelectField
        id={id}
        label={label}
        labelClassName={labelClassName}
        labelAddon={buildVerifiedAddon(matchedActive, ctrl.showNote, ctrl.toggleNote)}
        value={resolveCustomSelectValue(ctrl.isOtherOpen, matchedActive, value)}
        options={extendedOptions}
        onChangeValue={ctrl.selectOption}
      />
      {matchedActive && ctrl.showNote && (
        <VerificationBanner isValid message={matchedActive.explanation} />
      )}
      {ctrl.isOtherOpen && (
        <CustomEntryDrawer
          id={id}
          customText={ctrl.customText}
          verifying={ctrl.verifying}
          feedback={ctrl.feedback}
          onChangeText={ctrl.setCustomText}
          onVerify={ctrl.runVerify}
          t={t}
        />
      )}
    </div>
  );
}
