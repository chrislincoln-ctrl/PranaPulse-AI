import { memo, type ReactElement } from 'react';
import {
  resolveDynamicIndoorGuidance,
  type DynamicIndoorGuidance,
} from '../config/indoorGuidanceResolver.js';
import {
  CHART_GEOMETRY,
  PRECISION_DISPLAY,
  RADIAL_GAUGE_GEOMETRY,
  SLIDER_LIMITS,
} from '../config/uiConstants.js';
import type { IndoorClearanceSummary } from '../domain/types.js';
import type { LocaleDictionary } from '../i18n/translations.js';
import {
  buildChartAreaPolygon,
  buildChartPolyline,
  resolveSeriesMax,
} from '../utils/chartHelpers.js';
import type { PlanRequestPayload } from '../validators/schemas.js';
import { ChartGridAndTicks } from './ChartGridAndTicks.js';
import { HousingEnvelopeSelects, RangeField } from './FormFields.js';
import { IndoorGuidancePanels, WinterPlantsShowcase } from './IndoorGuidancePanels.js';
import { RadialGaugeSvg } from './RadialGaugeSvg.js';
import { SrDataTable } from './SrDataTable.js';

export interface IndoorCadrViewProps {
  readonly input: PlanRequestPayload;
  readonly indoor: IndoorClearanceSummary;
  readonly onUpdateInput: (patch: Partial<PlanRequestPayload>) => void;
  readonly t: LocaleDictionary;
}

function buildIndoorMetricCells(
  indoor: IndoorClearanceSummary,
  guidance: DynamicIndoorGuidance,
  t: LocaleDictionary,
) {
  const surcharge = guidance.envelopeCadrSurcharge + guidance.fuelCadrSurcharge;
  return [
    {
      label: t.targetCadrLabel,
      value: `${String(guidance.effectiveTargetCadr)} m3/h`,
      sub:
        surcharge > 0
          ? `Base ${String(indoor.requiredCadr48Ach)} + ${String(surcharge)} seal/fuel`
          : `Optimal seal & induction (${String(guidance.infiltrationAch)} ACH)`,
      tone: 'text-accent',
    },
    {
      label: t.achievedAchLabel,
      value: `${String(indoor.achievedAch)} ACH`,
      sub: `Infiltration: ${String(guidance.infiltrationAch)} ACH`,
      tone: 'text-cool',
    },
    {
      label: t.purgeTimeLabel,
      value: `${String(indoor.purge90Minutes)} ${t.unitMin}`,
      sub: `Cooking load: ${String(guidance.cookingEmissionUgHr)} ug/h`,
      tone: 'text-ink',
    },
  ];
}

function IndoorMetricsGrid({
  indoor,
  guidance,
  t,
}: {
  readonly indoor: IndoorClearanceSummary;
  readonly guidance: DynamicIndoorGuidance;
  readonly t: LocaleDictionary;
}): ReactElement {
  const achPct =
    (indoor.achievedAch / RADIAL_GAUGE_GEOMETRY.MAX_ACH_SCALE) *
    PRECISION_DISPLAY.PERCENT_MULTIPLIER;
  const cells = buildIndoorMetricCells(indoor, guidance, t);

  return (
    <div className="panels mb-6">
      {cells.map((cell) => (
        <div key={cell.label} className="panel">
          <div className="text-xs text-ink-2">{cell.label}</div>
          <div className={`measured mt-1 text-xl font-semibold ${cell.tone}`}>{cell.value}</div>
          <div className="measured mt-0.5 text-[11px] text-muted">{cell.sub}</div>
        </div>
      ))}
      <div className="panel flex items-center justify-between gap-2">
        <div>
          <div className="text-xs text-ink-2">{t.dailyReductionLabel}</div>
          <div className="measured mt-1 text-xl font-semibold text-ok">
            -{indoor.exposureReductionPct}%
          </div>
          <div className="measured mt-0.5 text-[11px] text-muted">
            {String(indoor.dailyMeanBaselinePm25)} → {String(indoor.dailyMeanMitigatedPm25)} ug/m3
          </div>
        </div>
        <RadialGaugeSvg
          outerPercent={indoor.exposureReductionPct}
          outerColor="var(--color-ok)"
          innerPercent={achPct}
          innerColor="var(--color-cool)"
          centerText={`${String(Math.round(indoor.exposureReductionPct))}%`}
          size={RADIAL_GAUGE_GEOMETRY.COMPACT_SIZE_PX}
        />
      </div>
    </div>
  );
}

function IndoorPlotLines({ indoor }: { readonly indoor: IndoorClearanceSummary }): ReactElement {
  const maxVal = resolveSeriesMax(
    indoor.hourly,
    (p) => Math.max(p.outdoorPm25, p.indoorBaselinePm25),
    CHART_GEOMETRY.MIN_PM25_AXIS,
  );
  const outdoorPts = buildChartPolyline(indoor.hourly, (p) => p.outdoorPm25, maxVal);
  const basePts = buildChartPolyline(indoor.hourly, (p) => p.indoorBaselinePm25, maxVal);
  const mitigatedPts = buildChartPolyline(indoor.hourly, (p) => p.indoorMitigatedPm25, maxVal);
  const mitigatedArea = buildChartAreaPolygon(indoor.hourly, (p) => p.indoorMitigatedPm25, maxVal);
  const labelY = CHART_GEOMETRY.PAD_TOP - CHART_GEOMETRY.AXIS_LABEL_OFFSET;
  const sw = CHART_GEOMETRY.STROKE_WIDTH;

  return (
    <>
      <defs>
        <linearGradient id="indoor-ok-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--color-ok)" stopOpacity="0.22" />
          <stop offset="100%" stopColor="var(--color-ok)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <ChartGridAndTicks />
      <polygon points={mitigatedArea} fill="url(#indoor-ok-grad)" />
      <polyline
        fill="none"
        stroke="var(--color-muted)"
        strokeWidth="1"
        strokeDasharray="4 4"
        points={outdoorPts}
      />
      <polyline fill="none" stroke="var(--color-bad)" strokeWidth={sw} points={basePts} />
      <polyline fill="none" stroke="var(--color-ok)" strokeWidth={sw} points={mitigatedPts} />
      <text x={CHART_GEOMETRY.PAD_LEFT} y={labelY} fill="var(--color-muted)" fontSize="12">
        {String(Math.round(maxVal))} ug/m3
      </text>
    </>
  );
}

function IndoorTrajectorySvg({
  indoor,
  t,
}: {
  readonly indoor: IndoorClearanceSummary;
  readonly t: LocaleDictionary;
}): ReactElement {
  return (
    <figure className="surface-hairline p-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-sm">
        <figcaption className="font-medium text-ink">{t.indoorChartTitle}</figcaption>
        <div className="flex flex-wrap gap-3 text-xs text-ink-2">
          <span className="text-muted">{t.indoorChartLegendOutdoor}</span>
          <span className="text-bad">{t.indoorChartLegendBaseline}</span>
          <span className="text-ok">{t.indoorChartLegendMitigated}</span>
        </div>
      </div>
      <svg
        viewBox={`0 0 ${String(CHART_GEOMETRY.WIDTH)} ${String(CHART_GEOMETRY.HEIGHT)}`}
        role="img"
        aria-label={t.indoorChartTitle}
        className="atmos-chart"
      >
        <IndoorPlotLines indoor={indoor} />
      </svg>
      <SrDataTable
        caption={t.indoorChartTitle}
        headers={['Hour', 'Outdoor PM2.5', 'Unfiltered Indoor PM2.5', 'Mitigated Indoor PM2.5']}
        rows={indoor.hourly.map((pt) => [
          `${String(pt.hourIndex).padStart(2, '0')}:00`,
          pt.outdoorPm25,
          pt.indoorBaselinePm25,
          pt.indoorMitigatedPm25,
        ])}
      />
    </figure>
  );
}

function IndoorSlidersAndSelects({
  input,
  onUpdateInput,
  t,
}: {
  readonly input: PlanRequestPayload;
  readonly onUpdateInput: (patch: Partial<PlanRequestPayload>) => void;
  readonly t: LocaleDictionary;
}): ReactElement {
  return (
    <div className="mt-4 space-y-4">
      <RangeField
        id="room-area-range"
        label={t.roomAreaLabel}
        valueText={`${String(input.areaM2)} m2`}
        min={SLIDER_LIMITS.ROOM_AREA_MIN}
        max={SLIDER_LIMITS.ROOM_AREA_MAX}
        step={SLIDER_LIMITS.ROOM_AREA_STEP}
        value={input.areaM2}
        onChangeValue={(areaM2) => {
          onUpdateInput({ areaM2 });
        }}
      />
      <RangeField
        id="cadr-range"
        label={t.cadrLabel}
        valueText={`${String(input.cadrM3Hr)} m3/h`}
        min={SLIDER_LIMITS.CADR_MIN}
        max={SLIDER_LIMITS.CADR_MAX}
        step={SLIDER_LIMITS.CADR_STEP}
        value={input.cadrM3Hr}
        onChangeValue={(cadrM3Hr) => {
          onUpdateInput({ cadrM3Hr });
        }}
      />
      <HousingEnvelopeSelects idPrefix="indoor" input={input} onUpdateInput={onUpdateInput} t={t} />
    </div>
  );
}

/**
 * Interactive indoor mass-balance simulator exposing CADR sizing, Corsi-Rosenthal
 * DIY specs, 21st.dev concentric filtration gauge, and ozone/houseplant anti-myth guardrails.
 */
export const IndoorCadrView = memo(function IndoorCadrView({
  input,
  indoor,
  onUpdateInput,
  t,
}: IndoorCadrViewProps): ReactElement {
  const guidance = resolveDynamicIndoorGuidance(input, indoor, t);

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
      <section aria-labelledby="indoor-calc-heading" className="surface-hairline p-6 lg:col-span-5">
        <h2 id="indoor-calc-heading" className="text-ink">
          {t.indoorSectionHeading}
        </h2>
        <IndoorSlidersAndSelects input={input} onUpdateInput={onUpdateInput} t={t} />
        <IndoorGuidancePanels guidance={guidance} t={t} />
      </section>
      <div className="min-w-0 lg:col-span-7">
        <IndoorMetricsGrid indoor={indoor} guidance={guidance} t={t} />
        <IndoorTrajectorySvg indoor={indoor} t={t} />
        <WinterPlantsShowcase plants={guidance.winterPlants} t={t} />
      </div>
    </div>
  );
});
