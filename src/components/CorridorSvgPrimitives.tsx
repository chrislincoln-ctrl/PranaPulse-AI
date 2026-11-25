import { type ReactElement } from 'react';
import {
  CORRIDOR_GRAPH_BOUNDS,
  CORRIDOR_NODE_POSITIONS,
  type CorridorNodeLayout,
} from '../config/uiConstants.js';

const NODE_POS_MAP = new Map(CORRIDOR_NODE_POSITIONS.map((n) => [n.id, n]));
const HALF = 2;
const METRO_DOT_RADIUS = 10;
const METRO_DOT_DY = 3.5;
const HALF_TRACK_T = 0.5;

export function EdgeDoseLabel(p: {
  readonly fromPos: CorridorNodeLayout;
  readonly toPos: CorridorNodeLayout;
  readonly doseUg: number | undefined;
  readonly isClean: boolean;
}): ReactElement | null {
  if (p.doseUg === undefined) {
    return null;
  }
  const textVal = `${String(p.doseUg)}ug`;
  const midY = (p.fromPos.y + p.toPos.y) / HALF;
  const labelY = p.isClean
    ? midY + CORRIDOR_GRAPH_BOUNDS.PILL_OFFSET_Y
    : midY - CORRIDOR_GRAPH_BOUNDS.PILL_RX;
  return (
    <text
      x={(p.fromPos.x + p.toPos.x) / HALF}
      y={labelY}
      textAnchor="middle"
      fill={p.isClean ? 'var(--color-accent)' : 'var(--color-muted)'}
      fontSize="11"
      fontWeight="600"
      className="measured"
    >
      {textVal}
    </text>
  );
}

function interpolateTrackPoint(p: {
  readonly idx: number;
  readonly count: number;
  readonly origin: CorridorNodeLayout;
  readonly mid: CorridorNodeLayout;
  readonly dest: CorridorNodeLayout;
}): { readonly cx: number; readonly cy: number } {
  const ratio = (p.idx + 1) / (p.count + 1);
  const onFirst = ratio <= HALF_TRACK_T;
  const t = onFirst ? ratio * HALF : (ratio - HALF_TRACK_T) * HALF;
  const p0 = onFirst ? p.origin : p.mid;
  const p1 = onFirst ? p.mid : p.dest;
  return { cx: p0.x + (p1.x - p0.x) * t, cy: p0.y + (p1.y - p0.y) * t };
}

export function NodeBadgePill(p: {
  readonly node: CorridorNodeLayout;
  readonly isClean: boolean;
  readonly label: string;
}): ReactElement {
  const dy =
    p.node.labelPosition === 'above'
      ? CORRIDOR_GRAPH_BOUNDS.LABEL_ABOVE_DY
      : CORRIDOR_GRAPH_BOUNDS.LABEL_BELOW_DY;
  const labelY = p.node.y + dy;
  const pillX = p.node.x - CORRIDOR_GRAPH_BOUNDS.PILL_WIDTH / HALF;
  const pillY = labelY - CORRIDOR_GRAPH_BOUNDS.PILL_OFFSET_Y;

  return (
    <>
      <rect
        x={pillX}
        y={pillY}
        width={CORRIDOR_GRAPH_BOUNDS.PILL_WIDTH}
        height={CORRIDOR_GRAPH_BOUNDS.PILL_HEIGHT}
        rx={CORRIDOR_GRAPH_BOUNDS.PILL_RX}
        fill="var(--color-paper-2)"
        stroke={p.isClean ? 'var(--color-accent)' : 'var(--color-rule)'}
        strokeWidth="1"
      />
      <text
        x={p.node.x}
        y={labelY}
        textAnchor="middle"
        fill="var(--color-ink)"
        fontSize="12"
        fontWeight={p.isClean ? '600' : '500'}
      >
        {p.label}
      </text>
    </>
  );
}

export function MetroStationIconDots({
  stops,
}: {
  readonly stops: readonly string[];
}): ReactElement | null {
  const origin = NODE_POS_MAP.get('home-sector');
  const mid = NODE_POS_MAP.get('metro-concourse');
  const dest = NODE_POS_MAP.get('civic-hub');
  if (stops.length === 0 || !origin || !mid || !dest) {
    return null;
  }
  return (
    <>
      {stops.map((stopName, idx) => {
        const { cx, cy } = interpolateTrackPoint({ idx, count: stops.length, origin, mid, dest });
        return (
          <g key={stopName}>
            <title>{stopName}</title>
            <circle
              cx={cx}
              cy={cy}
              r={METRO_DOT_RADIUS}
              fill="var(--color-paper-2)"
              stroke="var(--color-accent)"
              strokeWidth={CORRIDOR_GRAPH_BOUNDS.STROKE_BASE}
            />
            <text
              x={cx}
              y={cy + METRO_DOT_DY}
              textAnchor="middle"
              fill="var(--color-accent)"
              fontSize="9"
              fontWeight="700"
            >
              M
            </text>
          </g>
        );
      })}
    </>
  );
}
