import { memo, type ReactElement } from 'react';
import { CHART_GEOMETRY } from '../config/uiConstants.js';
import type { HourlyAtmosPoint } from '../domain/types.js';
import type { LocaleDictionary } from '../i18n/translations.js';
import {
  buildChartAreaPolygon,
  buildChartPolyline,
  resolveSeriesMax,
} from '../utils/chartHelpers.js';
import { ChartGridAndTicks } from './ChartGridAndTicks.js';
import { SrDataTable } from './SrDataTable.js';

export interface InversionChartSvgProps {
  readonly hourlySeries: readonly HourlyAtmosPoint[];
  readonly bestWindowHours: readonly number[];
  readonly t: LocaleDictionary;
}

function ChartHeader({ t }: { readonly t: LocaleDictionary }): ReactElement {
  return (
    <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-sm">
      <figcaption className="font-medium text-ink">{t.chartTitle}</figcaption>
      <div className="flex flex-wrap items-center gap-4 text-xs text-ink-2">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2 w-4 bg-accent" aria-hidden="true" />
          {t.chartLegendPm25}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2 w-4 bg-cool" aria-hidden="true" />
          {t.chartLegendPbl}
        </span>
      </div>
    </div>
  );
}

function BreakupWindowBands({
  hourlySeries,
  bestWindowHours,
  slotW,
  plotH,
}: {
  readonly hourlySeries: readonly HourlyAtmosPoint[];
  readonly bestWindowHours: readonly number[];
  readonly slotW: number;
  readonly plotH: number;
}): ReactElement {
  const bestSet = new Set(bestWindowHours);
  return (
    <>
      {hourlySeries.map((pt, idx) =>
        bestSet.has(pt.hourOfDay) ? (
          <rect
            key={pt.hourIso}
            x={CHART_GEOMETRY.PAD_LEFT + idx * slotW}
            y={CHART_GEOMETRY.PAD_TOP}
            width={slotW}
            height={plotH}
            fill="var(--color-ok-soft)"
            opacity="0.65"
          />
        ) : null,
      )}
    </>
  );
}

function ChartAxisLabels({
  maxPm25,
  maxPbl,
}: {
  readonly maxPm25: number;
  readonly maxPbl: number;
}): ReactElement {
  const y = CHART_GEOMETRY.PAD_TOP - CHART_GEOMETRY.AXIS_LABEL_OFFSET;
  return (
    <>
      <text x={CHART_GEOMETRY.PAD_LEFT} y={y} fill="var(--color-muted)" fontSize="12">
        {String(Math.round(maxPm25))} ug/m3
      </text>
      <text
        x={CHART_GEOMETRY.WIDTH - CHART_GEOMETRY.PAD_RIGHT}
        y={y}
        textAnchor="end"
        fill="var(--color-cool)"
        fontSize="12"
      >
        {String(Math.round(maxPbl))} m PBL
      </text>
    </>
  );
}

function computeInversionLayout(hourlySeries: readonly HourlyAtmosPoint[]) {
  const maxPm25 = resolveSeriesMax(hourlySeries, (p) => p.pm25UgM3, CHART_GEOMETRY.MIN_PM25_AXIS);
  const maxPbl = resolveSeriesMax(hourlySeries, (p) => p.pblMeters, CHART_GEOMETRY.MIN_PBL_AXIS);
  const plotW = CHART_GEOMETRY.WIDTH - CHART_GEOMETRY.PAD_LEFT - CHART_GEOMETRY.PAD_RIGHT;
  const plotH = CHART_GEOMETRY.HEIGHT - CHART_GEOMETRY.PAD_TOP - CHART_GEOMETRY.PAD_BOTTOM;
  const slotW = hourlySeries.length > 0 ? plotW / hourlySeries.length : plotW;
  const pmPoints = buildChartPolyline(hourlySeries, (p) => p.pm25UgM3, maxPm25);
  const pmArea = buildChartAreaPolygon(hourlySeries, (p) => p.pm25UgM3, maxPm25);
  const pblPoints = buildChartPolyline(hourlySeries, (p) => p.pblMeters, maxPbl);
  return { maxPm25, maxPbl, plotH, slotW, pmPoints, pmArea, pblPoints };
}

function InversionSvgPlot({
  hourlySeries,
  bestWindowHours,
  ariaLabel,
}: {
  readonly hourlySeries: readonly HourlyAtmosPoint[];
  readonly bestWindowHours: readonly number[];
  readonly ariaLabel: string;
}): ReactElement {
  const layout = computeInversionLayout(hourlySeries);

  return (
    <svg
      viewBox={`0 0 ${String(CHART_GEOMETRY.WIDTH)} ${String(CHART_GEOMETRY.HEIGHT)}`}
      role="img"
      aria-label={ariaLabel}
      className="atmos-chart"
    >
      <defs>
        <linearGradient id="pm25-area-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--color-accent)" stopOpacity="0.2" />
          <stop offset="100%" stopColor="var(--color-accent)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <BreakupWindowBands
        hourlySeries={hourlySeries}
        bestWindowHours={bestWindowHours}
        slotW={layout.slotW}
        plotH={layout.plotH}
      />
      <ChartGridAndTicks />
      <polygon points={layout.pmArea} fill="url(#pm25-area-grad)" />
      <polyline
        fill="none"
        stroke="var(--color-cool)"
        strokeWidth={CHART_GEOMETRY.STROKE_WIDTH}
        strokeDasharray="6 4"
        points={layout.pblPoints}
      />
      <polyline
        fill="none"
        stroke="var(--color-accent)"
        strokeWidth={CHART_GEOMETRY.STROKE_WIDTH}
        points={layout.pmPoints}
      />
      <ChartAxisLabels maxPm25={layout.maxPm25} maxPbl={layout.maxPbl} />
    </svg>
  );
}

/**
 * Dual-series atmospheric chart comparing surface PM2.5 against Planetary Boundary Layer mixing height,
 * paired with a full `.sr-only` data table for screen readers.
 */
export const InversionChartSvg = memo(function InversionChartSvg({
  hourlySeries,
  bestWindowHours,
  t,
}: InversionChartSvgProps): ReactElement {
  return (
    <figure className="surface-hairline p-4">
      <ChartHeader t={t} />
      <InversionSvgPlot
        hourlySeries={hourlySeries}
        bestWindowHours={bestWindowHours}
        ariaLabel={t.chartTitle}
      />
      <SrDataTable
        caption={t.chartTableCaption}
        headers={[t.ui.srTableHour, 'PM2.5 ug/m3', 'PBL m', t.ui.srTableWindKmh]}
        rows={hourlySeries.map((pt) => [
          `${String(pt.hourOfDay).padStart(2, '0')}:00`,
          pt.pm25UgM3,
          Math.round(pt.pblMeters),
          pt.windKmh,
        ])}
      />
    </figure>
  );
});
