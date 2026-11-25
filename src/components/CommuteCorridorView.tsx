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

function CommuteControls(p: {
  readonly input: PlanRequestPayload;
  readonly onUpdateInput: (patch: Partial<PlanRequestPayload>) => void;
  readonly t: LocaleDictionary;
}): ReactElement {
  return (
    <div className="mb-5 space-y-4">
      <RangeField
        id="commute-km"
        label={p.t.commuteDistanceLabel}
        valueText={`${String(p.input.commuteDistanceKm)} ${p.t.unitKm}`}
        min={SLIDER_LIMITS.COMMUTE_KM_MIN}
        max={SLIDER_LIMITS.COMMUTE_KM_MAX}
        step={SLIDER_LIMITS.COMMUTE_KM_STEP}
        value={p.input.commuteDistanceKm}
        onChangeValue={(commuteDistanceKm) => {
          p.onUpdateInput({ commuteDistanceKm });
        }}
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <SelectField
          id="commute-mode-select"
          label={p.t.commuteModeLabel}
          value={p.input.commuteMode}
          options={MODE_KEYS.map((mk) => ({ value: mk, label: p.t.commuteModes[mk] }))}
          onChangeValue={(commuteMode) => {
            p.onUpdateInput({ commuteMode });
          }}
        />
        <SelectField
          id="commute-mask-select"
          label={p.t.commuteMaskLabel}
          value={p.input.mask}
          options={MASK_KEYS.map((mk) => ({ value: mk, label: p.t.maskOptions[mk] }))}
          onChangeValue={(mask) => {
            p.onUpdateInput({ mask });
          }}
        />
      </div>
    </div>
  );
}

function ParetoStatusBadge({
  opt,
  t,
}: {
  readonly opt: CommuteOptionEvaluation;
  readonly t: LocaleDictionary;
}): ReactElement | null {
  if (opt.paradoxWarning) {
    return (
      <span className="inline-flex items-center gap-1 text-bad">
        <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span>{t.paradoxWarningLabel}</span>
      </span>
    );
  }
  if (opt.isParetoOptimal) {
    return (
      <span className="inline-flex items-center gap-1 text-ok">
        <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span>{t.paretoOptimalLabel}</span>
      </span>
    );
  }
  return null;
}

function computeDosePct(personalInhaledUg: number, maxDoseUg: number): number {
  const rawPct = Math.round(
    (personalInhaledUg / Math.max(1, maxDoseUg)) * PRECISION_DISPLAY.PERCENT_MULTIPLIER,
  );
  return Math.max(
    POLLUTANT_SAFE_CEILINGS.MIN_BAR_PCT,
    Math.min(PRECISION_DISPLAY.PERCENT_MULTIPLIER, rawPct),
  );
}

function ParetoMatrixRow(p: {
  readonly opt: CommuteOptionEvaluation;
  readonly maxDoseUg: number;
  readonly isSelected: boolean;
  readonly t: LocaleDictionary;
}): ReactElement {
  const { opt, maxDoseUg, isSelected, t } = p;
  const dosePct = computeDosePct(opt.personalInhaledUg, maxDoseUg);
  const rowCls = isSelected
    ? 'border-l-2 border-accent bg-accent-soft/25 transition-colors'
    : 'transition-colors hover:bg-paper-3/60';
  return (
    <tr className={rowCls}>
      <td className="py-2.5 pr-3 align-top font-medium text-ink sm:align-middle">
        <div>{t.commuteModes[opt.mode]}</div>
        <div className="measured mt-0.5 text-[11px] font-normal text-muted sm:hidden">
          {opt.durationMinutes} {t.unitMin} ·{' '}
          <span className="text-cool">{opt.communityCo2Grams} g CO2</span>
        </div>
      </td>
      <td className="measured hidden py-2.5 pr-3 text-ink-2 sm:table-cell">
        {opt.durationMinutes} {t.unitMin}
      </td>
      <td className="py-2.5 pr-1 align-top sm:pr-3 sm:align-middle">
        <div className="measured text-ink">{opt.personalInhaledUg} ug</div>
        <div className="pollutant-track mt-1">
          <div
            className={`pollutant-fill ${resolveDoseBarTone(opt)}`}
            style={{ width: `${String(dosePct)}%` }}
          />
        </div>
        <div className="mt-1 text-[11px] sm:hidden">
          <ParetoStatusBadge opt={opt} t={t} />
        </div>
      </td>
      <td className="measured hidden py-2.5 pr-3 text-cool sm:table-cell">
        {opt.communityCo2Grams} g
      </td>
      <td className="hidden py-2.5 text-xs sm:table-cell">
        <ParetoStatusBadge opt={opt} t={t} />
      </td>
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
    <div className="w-full overflow-x-auto pb-1">
      <table className="w-full border-collapse text-left text-xs sm:text-sm">
        <caption className="mb-2 text-left text-xs text-ink-2">{t.paretoHeading}</caption>
        <thead>
          <tr className="border-b border-rule text-xs text-muted">
            <th scope="col" className="py-2 pr-3 font-medium">
              {t.commuteModeLabel}
            </th>
            <th scope="col" className="hidden py-2 pr-3 font-medium sm:table-cell">
              {t.tableTimeHeader}
            </th>
            <th scope="col" className="py-2 pr-1 font-medium sm:pr-3">
              {t.tableDoseHeader}
            </th>
            <th scope="col" className="hidden py-2 pr-3 font-medium sm:table-cell">
              {t.tableCo2Header}
            </th>
            <th scope="col" className="hidden py-2 font-medium sm:table-cell">
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
export const CommuteCorridorView = memo(function CommuteCorridorView(
  p: CommuteCorridorViewProps,
): ReactElement {
  return (
    <div className="grid grid-cols-1 gap-6 sm:gap-8 lg:grid-cols-12">
      <section
        aria-labelledby="commute-heading"
        className="surface-hairline min-w-0 p-4 sm:p-6 lg:col-span-6"
      >
        <h2 id="commute-heading" className="text-ink">
          {p.t.commuteSectionHeading}
        </h2>
        <div className="mt-4">
          <CommuteControls input={p.input} onUpdateInput={p.onUpdateInput} t={p.t} />
          <ParetoMatrixTable
            commuteOptions={p.commuteOptions}
            selectedMode={p.input.commuteMode}
            t={p.t}
          />
        </div>
      </section>
      <div className="min-w-0 lg:col-span-6">
        <CorridorNetworkFigure
          key={p.input.city}
          city={p.input.city}
          commuteMode={p.input.commuteMode}
          language={p.input.language}
          corridor={p.corridor}
          onUpdateDistanceKm={(commuteDistanceKm) => {
            p.onUpdateInput({ commuteDistanceKm });
          }}
          t={p.t}
        />
      </div>
    </div>
  );
});
