import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { memo, type ReactElement } from 'react';
import {
  POLLUTANT_SAFE_CEILINGS,
  PRECISION_DISPLAY,
  SLIDER_LIMITS,
} from '../config/uiConstants.js';
import type {
  CommuteModeId,
  CommuteOptionEvaluation,
  CorridorRouteComparison,
  MaskTypeId,
} from '../domain/types.js';
import type { LocaleDictionary } from '../i18n/translations.js';
import type { PlanRequestPayload } from '../validators/schemas.js';
import { CorridorNetworkFigure } from './CorridorNetworkFigure.js';
import { RangeField, SelectField } from './FormFields.js';

export interface CommuteCorridorViewProps {
  readonly input: PlanRequestPayload;
  readonly commuteOptions: readonly CommuteOptionEvaluation[];
  readonly corridor: CorridorRouteComparison;
  readonly onUpdateInput: (patch: Partial<PlanRequestPayload>) => void;
  readonly t: LocaleDictionary;
}

const MODE_KEYS: readonly CommuteModeId[] = [
  'metro',
  'electric-bus',
  'ev-car',
  'petrol-car',
  'two-wheeler',
  'cycling',
  'walking',
];
const MASK_KEYS: readonly MaskTypeId[] = ['none', 'cloth', 'surgical', 'n95-ffp2'];

function resolveDoseBarTone(opt: CommuteOptionEvaluation): string {
  if (opt.paradoxWarning) {
    return 'bg-bad';
  }
  if (opt.isParetoOptimal) {
    return 'bg-ok';
  }
  return 'bg-accent';
}

function CommuteControls({
  input,
  onUpdateInput,
  t,
}: {
  readonly input: PlanRequestPayload;
  readonly onUpdateInput: (patch: Partial<PlanRequestPayload>) => void;
  readonly t: LocaleDictionary;
}): ReactElement {
  return (
    <div className="mb-5 space-y-4">
      <RangeField
        id="commute-km"
        label={t.commuteDistanceLabel}
        valueText={`${String(input.commuteDistanceKm)} ${t.unitKm}`}
        min={SLIDER_LIMITS.COMMUTE_KM_MIN}
        max={SLIDER_LIMITS.COMMUTE_KM_MAX}
        step={SLIDER_LIMITS.COMMUTE_KM_STEP}
        value={input.commuteDistanceKm}
        onChangeValue={(commuteDistanceKm) => {
          onUpdateInput({ commuteDistanceKm });
        }}
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <SelectField
          id="commute-mode-select"
          label={t.commuteModeLabel}
          value={input.commuteMode}
          options={MODE_KEYS.map((mk) => ({ value: mk, label: t.commuteModes[mk] }))}
          onChangeValue={(commuteMode) => {
            onUpdateInput({ commuteMode });
          }}
        />
        <SelectField
          id="commute-mask-select"
          label={t.commuteMaskLabel}
          value={input.mask}
          options={MASK_KEYS.map((mk) => ({ value: mk, label: t.maskOptions[mk] }))}
          onChangeValue={(mask) => {
            onUpdateInput({ mask });
          }}
        />
      </div>
    </div>
  );
}

function ParetoStatusCell({
  opt,
  t,
}: {
  readonly opt: CommuteOptionEvaluation;
  readonly t: LocaleDictionary;
}): ReactElement {
  return (
    <td className="py-2.5 text-xs">
      {opt.paradoxWarning && (
        <span className="inline-flex items-center gap-1 text-bad">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>{t.paradoxWarningLabel}</span>
        </span>
      )}
      {!opt.paradoxWarning && opt.isParetoOptimal && (
        <span className="inline-flex items-center gap-1 text-ok">
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>{t.paretoOptimalLabel}</span>
        </span>
      )}
    </td>
  );
}

function ParetoMatrixRow({
  opt,
  maxDoseUg,
  isSelected,
  t,
}: {
  readonly opt: CommuteOptionEvaluation;
  readonly maxDoseUg: number;
  readonly isSelected: boolean;
  readonly t: LocaleDictionary;
}): ReactElement {
  const rawPct = Math.round(
    (opt.personalInhaledUg / Math.max(1, maxDoseUg)) * PRECISION_DISPLAY.PERCENT_MULTIPLIER,
  );
  const dosePct = Math.max(
    POLLUTANT_SAFE_CEILINGS.MIN_BAR_PCT,
    Math.min(PRECISION_DISPLAY.PERCENT_MULTIPLIER, rawPct),
  );

  return (
    <tr
      className={
        isSelected
          ? 'border-l-2 border-accent bg-accent-soft/25 transition-colors'
          : 'transition-colors hover:bg-paper-3/60'
      }
    >
      <td className="py-2.5 pr-3 font-medium text-ink">{t.commuteModes[opt.mode]}</td>
      <td className="measured py-2.5 pr-3 text-ink-2">
        {opt.durationMinutes} {t.unitMin}
      </td>
      <td className="py-2.5 pr-3">
        <div className="measured text-ink">{opt.personalInhaledUg} ug</div>
        <div className="pollutant-track mt-1">
          <div
            className={`pollutant-fill ${resolveDoseBarTone(opt)}`}
            style={{ width: `${String(dosePct)}%` }}
          />
        </div>
      </td>
      <td className="measured py-2.5 pr-3 text-cool">{opt.communityCo2Grams} g</td>
      <ParetoStatusCell opt={opt} t={t} />
    </tr>
  );
}

function ParetoMatrixTable({
  commuteOptions,
  selectedMode,
  t,
}: {
  readonly commuteOptions: readonly CommuteOptionEvaluation[];
  readonly selectedMode: CommuteModeId;
  readonly t: LocaleDictionary;
}): ReactElement {
  const maxDoseUg = Math.max(1, ...commuteOptions.map((item) => item.personalInhaledUg));

  return (
    <div className="-mx-1 overflow-x-auto px-1 pb-1">
      <table className="w-full min-w-[460px] border-collapse text-left text-xs sm:text-sm">
        <caption className="mb-2 text-left text-xs text-ink-2">{t.paretoHeading}</caption>
        <thead>
          <tr className="border-b border-rule text-xs text-muted">
            <th scope="col" className="py-2 pr-3 font-medium">
              {t.commuteModeLabel}
            </th>
            <th scope="col" className="py-2 pr-3 font-medium">
              {t.tableTimeHeader}
            </th>
            <th scope="col" className="py-2 pr-3 font-medium">
              {t.tableDoseHeader}
            </th>
            <th scope="col" className="py-2 pr-3 font-medium">
              {t.tableCo2Header}
            </th>
            <th scope="col" className="py-2 font-medium">
              {t.tableStatusHeader}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-rule">
          {commuteOptions.map((opt) => (
            <ParetoMatrixRow
              key={opt.mode}
              opt={opt}
              maxDoseUg={maxDoseUg}
              isSelected={opt.mode === selectedMode}
              t={t}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Interactive pulmonary inhaled-dose Pareto matrix and Dijkstra clean-corridor network visualizer.
 */
export const CommuteCorridorView = memo(function CommuteCorridorView({
  input,
  commuteOptions,
  corridor,
  onUpdateInput,
  t,
}: CommuteCorridorViewProps): ReactElement {
  return (
    <div className="grid grid-cols-1 gap-6 sm:gap-8 lg:grid-cols-12">
      <section
        aria-labelledby="commute-heading"
        className="surface-hairline min-w-0 p-4 sm:p-6 lg:col-span-6"
      >
        <h2 id="commute-heading" className="text-ink">
          {t.commuteSectionHeading}
        </h2>
        <div className="mt-4">
          <CommuteControls input={input} onUpdateInput={onUpdateInput} t={t} />
          <ParetoMatrixTable
            commuteOptions={commuteOptions}
            selectedMode={input.commuteMode}
            t={t}
          />
        </div>
      </section>
      <div className="min-w-0 lg:col-span-6">
        <CorridorNetworkFigure
          key={input.city}
          city={input.city}
          commuteMode={input.commuteMode}
          language={input.language}
          corridor={corridor}
          onUpdateDistanceKm={(commuteDistanceKm) => {
            onUpdateInput({ commuteDistanceKm });
          }}
          t={t}
        />
      </div>
    </div>
  );
});
