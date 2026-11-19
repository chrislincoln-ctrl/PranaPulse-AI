import { type ReactElement } from 'react';
import { CHART_GEOMETRY, CHART_GRID_RATIOS, CHART_HOUR_TICKS } from '../config/uiConstants.js';

const LAST_HOUR_INDEX = 23;

/**
 * Shared SVG horizontal hairline grid and 24-hour X-axis tick labels for atmospheric charts.
 */
export function ChartGridAndTicks(): ReactElement {
  const plotW = CHART_GEOMETRY.WIDTH - CHART_GEOMETRY.PAD_LEFT - CHART_GEOMETRY.PAD_RIGHT;
  const plotH = CHART_GEOMETRY.HEIGHT - CHART_GEOMETRY.PAD_TOP - CHART_GEOMETRY.PAD_BOTTOM;
  const baseLineY = CHART_GEOMETRY.PAD_TOP + plotH;

  return (
    <>
      {CHART_GRID_RATIOS.map((ratio) => {
        const y = Math.round(CHART_GEOMETRY.PAD_TOP + ratio * plotH);
        return (
          <line
            key={ratio}
            x1={CHART_GEOMETRY.PAD_LEFT}
            y1={y}
            x2={CHART_GEOMETRY.WIDTH - CHART_GEOMETRY.PAD_RIGHT}
            y2={y}
            stroke="var(--color-rule)"
            strokeWidth={CHART_GEOMETRY.THIN_STROKE}
          />
        );
      })}
      <line
        x1={CHART_GEOMETRY.PAD_LEFT}
        y1={baseLineY}
        x2={CHART_GEOMETRY.WIDTH - CHART_GEOMETRY.PAD_RIGHT}
        y2={baseLineY}
        stroke="var(--color-rule-2)"
        strokeWidth={CHART_GEOMETRY.THIN_STROKE}
      />
      {CHART_HOUR_TICKS.map((hr) => {
        const x = Math.round(CHART_GEOMETRY.PAD_LEFT + (hr / LAST_HOUR_INDEX) * plotW);
        return (
          <text
            key={hr}
            x={x}
            y={baseLineY + CHART_GEOMETRY.TICK_TEXT_DY}
            textAnchor="middle"
            fill="var(--color-muted)"
            fontSize="11"
          >
            {`${String(hr).padStart(2, '0')}:00`}
          </text>
        );
      })}
    </>
  );
}
