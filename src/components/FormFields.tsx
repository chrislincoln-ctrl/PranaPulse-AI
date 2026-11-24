import { useState, type ReactElement, type ReactNode } from 'react';
import type { BuildingTightness, CookingFuelType } from '../domain/types.js';
import type { LocaleDictionary } from '../i18n/translations.js';
import type { PlanRequestPayload } from '../validators/schemas.js';
import { CustomVerifiedSelect } from './CustomVerifiedSelect.js';

export interface RangeFieldProps {
  readonly id: string;
  readonly label: string;
  readonly valueText: string;
  readonly min: number;
  readonly max: number;
  readonly step: number;
  readonly value: number;
  readonly onChangeValue: (nextValue: number) => void;
}

function clampInputNumber(raw: number, min: number, max: number): number {
  if (!Number.isFinite(raw)) {
    return min;
  }
  return Math.max(min, Math.min(max, raw));
}

function DirectNumberInput(
  props: RangeFieldProps & {
    readonly draft: string | null;
    readonly setDraft: (val: string | null) => void;
  },
): ReactElement {
  const { id, valueText, min, max, value, draft, setDraft, onChangeValue } = props;
  const commit = (raw: string): void => {
    setDraft(null);
    const parsed = Number(raw);
    if (raw.trim() && Number.isFinite(parsed)) {
      onChangeValue(clampInputNumber(parsed, min, max));
    }
  };

  return (
    <input
      id={`${id}-number`}
      type="number"
      min={min}
      max={max}
      step={1}
      value={draft ?? String(value)}
      aria-label={`Direct value (${valueText})`}
      onChange={(e) => {
        const raw = e.target.value;
        setDraft(raw);
        const parsed = Number(raw);
        if (raw.trim() && Number.isFinite(parsed) && parsed >= min && parsed <= max) {
          onChangeValue(parsed);
        }
      }}
      onBlur={(e) => {
        commit(e.target.value);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          commit((e.target as HTMLInputElement).value);
        }
      }}
      className="measured w-20 rounded border border-rule-2 bg-paper-3 px-2 py-1 text-right text-xs text-ink"
    />
  );
}

/**
 * Accessible labeled slider control paired with a direct numeric input box and tabular unit readout.
 */
export function RangeField(props: RangeFieldProps): ReactElement {
  const { id, label, valueText, min, max, step, value, onChangeValue } = props;
  const [draft, setDraft] = useState<string | null>(null);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-ink-2">
        <label htmlFor={id}>{label}</label>
        <div className="flex items-center gap-2">
          <DirectNumberInput {...props} draft={draft} setDraft={setDraft} />
          <span className="measured text-xs font-medium text-ink">{valueText}</span>
        </div>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => {
          setDraft(null);
          onChangeValue(Number(e.target.value));
        }}
        className="touch-target mt-1 w-full accent-accent"
      />
    </div>
  );
}

export interface SelectOptionItem<T extends string> {
  readonly value: T;
  readonly label: string;
}

export interface SelectFieldProps<T extends string> {
  readonly id: string;
  readonly label: string;
  readonly value: T;
  readonly options: readonly SelectOptionItem<T>[];
  readonly onChangeValue: (nextValue: T) => void;
  readonly labelClassName?: string;
  readonly labelAddon?: ReactNode;
}

/**
 * Accessible labeled select dropdown sized to WCAG 2.2 AA touch minimums.
 */
export function SelectField<T extends string>({
  id,
  label,
  value,
  options,
  onChangeValue,
  labelClassName = 'mb-1 block text-sm text-ink-2',
  labelAddon,
}: SelectFieldProps<T>): ReactElement {
  return (
    <div>
      {labelAddon ? (
        <div className="mb-1 flex items-center justify-between gap-2">
          <label htmlFor={id} className={labelClassName.replace(/\bmb-1\b/g, '').trim()}>
            {label}
          </label>
          {labelAddon}
        </div>
      ) : (
        <label htmlFor={id} className={labelClassName}>
          {label}
        </label>
      )}
      <select
        id={id}
        value={value}
        onChange={(e) => {
          onChangeValue(e.target.value as T);
        }}
        className="field-control text-sm"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

const TIGHTNESS_KEYS: readonly BuildingTightness[] = ['leaky', 'standard', 'weather-sealed'];
const FUEL_KEYS: readonly CookingFuelType[] = [
  'induction',
  'lpg-vented',
  'lpg-unvented',
  'solid-biomass',
];

/**
 * Shared 2-column window-sealing tightness and cooking-fuel selector pair with "Other (Add your own)" AI verification.
 */
export function HousingEnvelopeSelects({
  idPrefix,
  input,
  onUpdateInput,
  t,
}: {
  readonly idPrefix: string;
  readonly input: PlanRequestPayload;
  readonly onUpdateInput: (patch: Partial<PlanRequestPayload>) => void;
  readonly t: LocaleDictionary;
}): ReactElement {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <CustomVerifiedSelect
        id={`${idPrefix}-tightness-select`}
        label={t.tightnessLabel}
        category="tightness"
        scopeKey="tightness"
        value={input.tightness}
        language={input.language}
        options={TIGHTNESS_KEYS.map((k) => ({ value: k, label: t.tightnessOptions[k] }))}
        onChangeValue={(tightness) => {
          onUpdateInput({ tightness });
        }}
        t={t}
      />
      <CustomVerifiedSelect
        id={`${idPrefix}-fuel-select`}
        label={t.fuelLabel}
        category="cookingFuel"
        scopeKey="cookingFuel"
        value={input.cookingFuel}
        language={input.language}
        options={FUEL_KEYS.map((k) => ({ value: k, label: t.fuelOptions[k] }))}
        onChangeValue={(cookingFuel) => {
          onUpdateInput({ cookingFuel });
        }}
        t={t}
      />
    </div>
  );
}
