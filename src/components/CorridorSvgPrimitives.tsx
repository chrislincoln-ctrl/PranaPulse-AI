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
const EDGE_BADGE_W = 46;
const EDGE_BADGE_H = 18;
const EDGE_BADGE_TEXT_DY = 4;
const EDGE_DIRECT_SHIFT_Y = 14;
const EDGE_CLEAN_SHIFT_Y = 18;
const CHAR_WIDTH_PX = 7.4;
const PILL_PAD_X = 24;
const MIN_PILL_W = 96;
const MAX_PILL_W = 228;
const MAX_LABEL_CHARS = 28;
const VIEWBOX_EDGE_PAD = 6;

function resolveEdgeTextTone(isClean: boolean, isDirect: boolean): string {
  if (isClean) {
    return 'var(--color-accent)';
  }
  return isDirect ? 'var(--color-bad)' : 'var(--color-muted)';
}

export function EdgeDoseLabel(p: {
  readonly fromPos: CorridorNodeLayout;
  readonly toPos: CorridorNodeLayout;
  readonly doseUg: number | undefined;
  readonly isClean: boolean;
  readonly isDirect: boolean;
}): ReactElement | null {
  if (p.doseUg === undefined) {
    return null;
  }
  const textVal = `${String(p.doseUg)}ug`;
  const midX = (p.fromPos.x + p.toPos.x) / HALF;
  const midY = (p.fromPos.y + p.toPos.y) / HALF;
  const centerY = p.isClean ? midY + EDGE_CLEAN_SHIFT_Y : midY - EDGE_DIRECT_SHIFT_Y;
  const strokeTone = p.isClean ? 'var(--color-accent)' : 'var(--color-bad)';
  const textTone = resolveEdgeTextTone(p.isClean, p.isDirect);

  return (
    <g>
      <rect
        x={midX - EDGE_BADGE_W / HALF}
        y={centerY - EDGE_BADGE_H / HALF}
        width={EDGE_BADGE_W}
        height={EDGE_BADGE_H}
        rx={CORRIDOR_GRAPH_BOUNDS.PILL_RX}
        fill="var(--color-paper-2)"
        stroke={p.isClean || p.isDirect ? strokeTone : 'var(--color-rule)'}
        strokeWidth="1"
      />
      <text
        x={midX}
        y={centerY + EDGE_BADGE_TEXT_DY}
        textAnchor="middle"
        fill={textTone}
        fontSize="10.5"
        fontWeight="600"
        className="measured"
      >
        {textVal}
      </text>
    </g>
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

function formatPillLabel(raw: string): string {
  const trimmed = raw.trim();
  return trimmed.length > MAX_LABEL_CHARS ? `${trimmed.slice(0, MAX_LABEL_CHARS - 1)}…` : trimmed;
}

export function NodeBadgePill(p: {
  readonly node: CorridorNodeLayout;
  readonly isClean: boolean;
  readonly label: string;
}): ReactElement {
  const displayLabel = formatPillLabel(p.label);
  const pillWidth = Math.max(
    MIN_PILL_W,
    Math.min(MAX_PILL_W, Math.round(displayLabel.length * CHAR_WIDTH_PX + PILL_PAD_X)),
  );
  const dy =
    p.node.labelPosition === 'above'
      ? CORRIDOR_GRAPH_BOUNDS.LABEL_ABOVE_DY
      : CORRIDOR_GRAPH_BOUNDS.LABEL_BELOW_DY;
  const labelY = p.node.y + dy;
  const rawPillX = p.node.x - pillWidth / HALF;
  const maxPillX = CORRIDOR_GRAPH_BOUNDS.WIDTH - pillWidth - VIEWBOX_EDGE_PAD;
  const pillX = Math.max(VIEWBOX_EDGE_PAD, Math.min(maxPillX, rawPillX));
  const pillY = labelY - CORRIDOR_GRAPH_BOUNDS.PILL_OFFSET_Y;

  return (
    <>
      <rect
        x={pillX}
        y={pillY}
        width={pillWidth}
        height={CORRIDOR_GRAPH_BOUNDS.PILL_HEIGHT}
        rx={CORRIDOR_GRAPH_BOUNDS.PILL_RX}
        fill="var(--color-paper-2)"
        stroke={p.isClean ? 'var(--color-accent)' : 'var(--color-rule)'}
        strokeWidth="1"
      />
      <text
        x={pillX + pillWidth / HALF}
        y={labelY}
        textAnchor="middle"
        fill="var(--color-ink)"
        fontSize="11.5"
        fontWeight={p.isClean ? '600' : '500'}
      >
        {displayLabel}
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
