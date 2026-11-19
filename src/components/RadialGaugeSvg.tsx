import { memo, type ReactElement } from 'react';
import { PRECISION_DISPLAY, RADIAL_GAUGE_GEOMETRY } from '../config/uiConstants.js';

export interface RadialGaugeSvgProps {
  readonly outerPercent: number;
  readonly outerColor: string;
  readonly innerPercent?: number | undefined;
  readonly innerColor?: string | undefined;
  readonly centerText: string;
  readonly size?: number | undefined;
}

function clampPct(value: number): number {
  return Math.max(0, Math.min(PRECISION_DISPLAY.PERCENT_MULTIPLIER, value));
}

function RadialTicks(): ReactElement {
  const {
    CENTER,
    TICK_COUNT,
    FULL_CIRCLE_DEG,
    START_ANGLE_DEG,
    DEG_TO_RAD,
    TICK_INNER_R,
    TICK_OUTER_R,
  } = RADIAL_GAUGE_GEOMETRY;

  return (
    <>
      {Array.from({ length: TICK_COUNT }, (_, idx) => {
        const angleDeg = START_ANGLE_DEG + (idx / TICK_COUNT) * FULL_CIRCLE_DEG;
        const rad = angleDeg * DEG_TO_RAD;
        const x1 = CENTER + TICK_INNER_R * Math.cos(rad);
        const y1 = CENTER + TICK_INNER_R * Math.sin(rad);
        const x2 = CENTER + TICK_OUTER_R * Math.cos(rad);
        const y2 = CENTER + TICK_OUTER_R * Math.sin(rad);
        return (
          <line
            key={idx}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke="var(--color-rule-2)"
            strokeWidth="1.25"
          />
        );
      })}
    </>
  );
}

function GaugeArcPair({
  radius,
  strokeWidth,
  circumference,
  percent,
  color,
}: {
  readonly radius: number;
  readonly strokeWidth: number;
  readonly circumference: number;
  readonly percent: number;
  readonly color: string;
}): ReactElement {
  const center = RADIAL_GAUGE_GEOMETRY.CENTER;
  const dash = (clampPct(percent) / PRECISION_DISPLAY.PERCENT_MULTIPLIER) * circumference;

  return (
    <>
      <circle
        cx={center}
        cy={center}
        r={radius}
        fill="none"
        stroke="var(--color-paper-3)"
        strokeWidth={strokeWidth}
      />
      <circle
        cx={center}
        cy={center}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={`${String(dash)} ${String(circumference)}`}
        transform={`rotate(-90 ${String(center)} ${String(center)})`}
      />
    </>
  );
}

/**
 * Concentric multi-ring SVG radial telemetry gauge adapted from 21st.dev `designali-in/gauge-1` (id: 3719).
 */
export const RadialGaugeSvg = memo(function RadialGaugeSvg({
  outerPercent,
  outerColor,
  innerPercent,
  innerColor = 'var(--color-cool)',
  centerText,
  size = RADIAL_GAUGE_GEOMETRY.DEFAULT_SIZE_PX,
}: RadialGaugeSvgProps): ReactElement {
  const g = RADIAL_GAUGE_GEOMETRY;

  return (
    <svg
      viewBox={`0 0 ${String(g.VIEWBOX_SIZE)} ${String(g.VIEWBOX_SIZE)}`}
      width={size}
      height={size}
      aria-hidden="true"
      className="shrink-0"
    >
      <RadialTicks />
      <GaugeArcPair
        radius={g.OUTER_RADIUS}
        strokeWidth={g.STROKE_OUTER}
        circumference={g.CIRCUMFERENCE_OUTER}
        percent={outerPercent}
        color={outerColor}
      />
      {innerPercent !== undefined && (
        <GaugeArcPair
          radius={g.INNER_RADIUS}
          strokeWidth={g.STROKE_INNER}
          circumference={g.CIRCUMFERENCE_INNER}
          percent={innerPercent}
          color={innerColor}
        />
      )}
      <text
        x={g.CENTER}
        y={g.CENTER + 1}
        textAnchor="middle"
        dominantBaseline="middle"
        fill="var(--color-ink)"
        fontSize="16"
        fontWeight="700"
        className="measured"
      >
        {centerText}
      </text>
    </svg>
  );
});
