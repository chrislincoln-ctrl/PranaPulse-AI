import { AlertTriangle, CheckCircle2, Sparkles } from 'lucide-react';
import { useState, type ReactElement } from 'react';
import { VALIDATION_BOUNDS } from '../config/constants.js';
import type { LocaleDictionary } from '../i18n/translations.js';
import type { SupportedLanguage } from '../validators/schemas.js';
import { SelectField, type SelectOptionItem } from './FormFields.js';

export type CustomVerifyCategory = 'role' | 'tightness' | 'cookingFuel';

interface VerifyApiResult {
  readonly isValid: boolean;
  readonly mappedValue: string;
  readonly explanation: string;
}

export interface CustomVerifiedSelectProps<T extends string> {
  readonly id: string;
  readonly label: string;
  readonly category: CustomVerifyCategory;
  readonly value: T;
  readonly options: readonly SelectOptionItem<T>[];
  readonly language: SupportedLanguage;
  readonly onChangeValue: (nextValue: T) => void;
  readonly t: LocaleDictionary;
  readonly labelClassName?: string;
}

const OTHER_SENTINEL = '__other__';

async function requestCustomVerification(params: {
  readonly category: CustomVerifyCategory;
  readonly customText: string;
  readonly language: SupportedLanguage;
}): Promise<VerifyApiResult | null> {
  try {
    const res = await fetch('/api/verify-custom', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    return res.ok ? ((await res.json()) as VerifyApiResult) : null;
  } catch {
    return null;
  }
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
          className="btn-secondary touch-target inline-flex w-full items-center justify-center gap-1.5 px-3 text-xs"
        >
          <Sparkles className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
          <span>{verifying ? t.verifyingCustomButton : t.verifyCustomButton}</span>
        </button>
      </div>
      {feedback && <VerificationBanner isValid={feedback.isValid} message={feedback.explanation} />}
    </div>
  );
}

function useCustomVerifyController(
  category: CustomVerifyCategory,
  language: SupportedLanguage,
  onChangeValue: (nextValue: string) => void,
) {
  const [isOtherOpen, setIsOtherOpen] = useState(false);
  const [customText, setCustomText] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [feedback, setFeedback] = useState<VerifyApiResult | null>(null);

  const runVerify = (): void => {
    const trimmed = customText.trim();
    if (!trimmed) {
      return;
    }
    setVerifying(true);
    void requestCustomVerification({ category, customText: trimmed, language })
      .then((res) => {
        if (res) {
          setFeedback(res);
          if (res.isValid) {
            onChangeValue(res.mappedValue);
          }
        }
      })
      .finally(() => {
        setVerifying(false);
      });
  };

  const selectOption = (picked: string): void => {
    setFeedback(null);
    if (picked === OTHER_SENTINEL) {
      setIsOtherOpen(true);
    } else {
      setIsOtherOpen(false);
      onChangeValue(picked);
    }
  };

  return { isOtherOpen, customText, verifying, feedback, setCustomText, runVerify, selectOption };
}

/**
 * Select dropdown with an "Other (Add your own)" option that verifies user-entered
 * preferences against the attached Gemini API key and rejects invalid entries.
 */
export function CustomVerifiedSelect<T extends string>({
  id,
  label,
  category,
  value,
  options,
  language,
  onChangeValue,
  t,
  labelClassName = 'mb-1 block text-sm text-ink-2',
}: CustomVerifiedSelectProps<T>): ReactElement {
  const ctrl = useCustomVerifyController(category, language, (nextVal) => {
    onChangeValue(nextVal as T);
  });
  const extendedOptions: readonly SelectOptionItem<string>[] = [
    ...options,
    { value: OTHER_SENTINEL, label: t.otherOptionLabel },
  ];

  return (
    <div>
      <SelectField
        id={id}
        label={label}
        labelClassName={labelClassName}
        value={ctrl.isOtherOpen ? OTHER_SENTINEL : value}
        options={extendedOptions}
        onChangeValue={ctrl.selectOption}
      />
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
