import { type ReactElement } from 'react';
import { CORRIDOR_GRAPH } from '../config/physicsConstants.js';
import {
  CORRIDOR_GRAPH_BOUNDS,
  CORRIDOR_NODE_POSITIONS,
  type CorridorNodeLayout,
} from '../config/uiConstants.js';
import type { CommuteModeId, CorridorNodeId, CorridorRouteComparison } from '../domain/types.js';
import { EdgeDoseLabel, MetroStationIconDots, NodeBadgePill } from './CorridorSvgPrimitives.js';

const NODE_POS_MAP = new Map(CORRIDOR_NODE_POSITIONS.map((n) => [n.id, n]));
const HOTSPOT_LEG_UG_THRESHOLD = 10;
const METRO_COMPACT_NODE_R = 14;
const METRO_COMPACT_DY = 4;
const ARROW_GAP_PX = 5;
const ENDPOINT_CLEARANCE = CORRIDOR_GRAPH_BOUNDS.NODE_RADIUS + ARROW_GAP_PX;

function isNodeVisible(nodeId: CorridorNodeId, mode: CommuteModeId): boolean {
  return mode === 'metro' ? nodeId !== 'green-parkway' : nodeId !== 'metro-concourse';
}

function pathHasEdge(path: readonly CorridorNodeId[], from: string, to: string): boolean {
  for (let i = 0; i < path.length - 1; i += 1) {
    if (path[i] === from && path[i + 1] === to) {
      return true;
    }
  }
  return false;
}

function resolveEdgeStyle(corridor: CorridorRouteComparison, from: string, to: string) {
  const isClean = pathHasEdge(corridor.lowestExposurePath, from, to);
  const isDirect = pathHasEdge(corridor.directRoadPath, from, to);
  let strokeColor = 'var(--color-rule-2)';
  let markerEnd: string | undefined;
  if (isClean) {
    strokeColor = 'var(--color-accent)';
    markerEnd = 'url(#corridor-arrow-clean)';
  } else if (isDirect) {
    strokeColor = 'var(--color-bad)';
    markerEnd = 'url(#corridor-arrow-direct)';
  }
  const strokeWidth =
    isClean || isDirect
      ? CORRIDOR_GRAPH_BOUNDS.STROKE_HIGHLIGHT
      : CORRIDOR_GRAPH_BOUNDS.STROKE_BASE;
  return { strokeColor, strokeWidth, isDashed: isDirect && !isClean, isClean, isDirect, markerEnd };
}

function trimEdgeLine(fromPos: CorridorNodeLayout, toPos: CorridorNodeLayout) {
  const dx = toPos.x - fromPos.x;
  const dy = toPos.y - fromPos.y;
  const dist = Math.hypot(dx, dy);
  if (dist <= ENDPOINT_CLEARANCE * 2) {
    return { x1: fromPos.x, y1: fromPos.y, x2: toPos.x, y2: toPos.y };
  }
  const ux = dx / dist;
  const uy = dy / dist;
  return {
    x1: fromPos.x + ux * CORRIDOR_GRAPH_BOUNDS.NODE_RADIUS,
    y1: fromPos.y + uy * CORRIDOR_GRAPH_BOUNDS.NODE_RADIUS,
    x2: toPos.x - ux * ENDPOINT_CLEARANCE,
    y2: toPos.y - uy * ENDPOINT_CLEARANCE,
  };
}

const ARROW_MARKERS = [
  { id: 'corridor-arrow-clean', fill: 'var(--color-accent)' },
  { id: 'corridor-arrow-direct', fill: 'var(--color-bad)' },
] as const;

function CorridorArrowDefs(): ReactElement {
  return (
    <defs>
      {ARROW_MARKERS.map((m) => (
        <marker
          key={m.id}
          id={m.id}
          viewBox="0 0 10 10"
          refX="7"
          refY="5"
          markerWidth="4.5"
          markerHeight="4.5"
          orient="auto-start-reverse"
        >
          <path d="M 0 1 L 10 5 L 0 9 z" fill={m.fill} />
        </marker>
      ))}
    </defs>
  );
}

function NodeBadgeContent(p: {
  readonly node: CorridorNodeLayout;
  readonly isClean: boolean;
  readonly label: string;
  readonly iconOnly: boolean;
}): ReactElement {
  if (p.iconOnly) {
    return (
      <text
        x={p.node.x}
        y={p.node.y + METRO_COMPACT_DY}
        textAnchor="middle"
        fill="var(--color-accent)"
        fontSize="12"
        fontWeight="700"
      >
        M
      </text>
    );
  }
  return <NodeBadgePill node={p.node} isClean={p.isClean} label={p.label} />;
}

function CorridorNodeGroup(p: {
  readonly node: CorridorNodeLayout;
  readonly isClean: boolean;
  readonly label: string;
  readonly iconOnly: boolean;
}): ReactElement {
  return (
    <g>
      <title>{p.label}</title>
      <circle
        cx={p.node.x}
        cy={p.node.y}
        r={p.iconOnly ? METRO_COMPACT_NODE_R : CORRIDOR_GRAPH_BOUNDS.NODE_RADIUS}
        fill={p.isClean ? 'var(--color-accent-soft)' : 'var(--color-paper-3)'}
        stroke={p.isClean ? 'var(--color-accent)' : 'var(--color-rule-2)'}
        strokeWidth={CORRIDOR_GRAPH_BOUNDS.STROKE_BASE}
      />
      <NodeBadgeContent {...p} />
    </g>
  );
}

function CorridorEdgesLayer(p: {
  readonly corridor: CorridorRouteComparison;
  readonly commuteMode: CommuteModeId;
}): ReactElement {
  const allSegs = [...(p.corridor.directSegments ?? []), ...p.corridor.segments];
  const segDoseMap = new Map(allSegs.map((s) => [`${s.from}-${s.to}`, s.exposureUg]));
  return (
    <>
      {CORRIDOR_GRAPH.EDGES.filter(
        (e) => isNodeVisible(e.from, p.commuteMode) && isNodeVisible(e.to, p.commuteMode),
      ).map((edge) => {
        const fromPos = NODE_POS_MAP.get(edge.from);
        const toPos = NODE_POS_MAP.get(edge.to);
        if (!fromPos || !toPos) {
          return null;
        }
        const style = resolveEdgeStyle(p.corridor, edge.from, edge.to);
        const pts = trimEdgeLine(fromPos, toPos);
        const key = `${edge.from}-${edge.to}`;
        return (
          <g key={key}>
            <line
              x1={pts.x1}
              y1={pts.y1}
              x2={pts.x2}
              y2={pts.y2}
              stroke={style.strokeColor}
              strokeWidth={style.strokeWidth}
              strokeDasharray={style.isDashed ? '6 4' : undefined}
              markerEnd={style.markerEnd}
            />
            <EdgeDoseLabel
              fromPos={fromPos}
              toPos={toPos}
              doseUg={segDoseMap.get(key)}
              isClean={style.isClean}
              isDirect={style.isDirect}
            />
          </g>
        );
      })}
    </>
  );
}

/** SVG canvas rendering mode-filtered clean corridor nodes, directional arrows, arterial doses, and Metro [M] stops. */
export function CorridorSvgCanvas(p: {
  readonly corridor: CorridorRouteComparison;
  readonly commuteMode: CommuteModeId;
  readonly activeNodes: Record<CorridorNodeId, string>;
  readonly intermediateMetroStops: readonly string[];
  readonly heading: string;
}): ReactElement {
  const maxSegUg = Math.max(0, ...p.corridor.segments.map((s) => s.exposureUg));
  const hideMetroMidLabel = p.commuteMode === 'metro' && maxSegUg < HOTSPOT_LEG_UG_THRESHOLD;
  return (
    <svg
      viewBox={`0 0 ${String(CORRIDOR_GRAPH_BOUNDS.WIDTH)} ${String(CORRIDOR_GRAPH_BOUNDS.HEIGHT)}`}
      role="img"
      aria-label={p.heading}
      className="atmos-chart min-w-[460px] sm:min-w-0"
    >
      <CorridorArrowDefs />
      <CorridorEdgesLayer corridor={p.corridor} commuteMode={p.commuteMode} />
      {p.commuteMode === 'metro' && <MetroStationIconDots stops={p.intermediateMetroStops} />}
      {CORRIDOR_NODE_POSITIONS.filter((n) => isNodeVisible(n.id, p.commuteMode)).map((node) => (
        <CorridorNodeGroup
          key={node.id}
          node={node}
          isClean={p.corridor.lowestExposurePath.includes(node.id)}
          label={p.activeNodes[node.id]}
          iconOnly={hideMetroMidLabel && node.id === 'metro-concourse'}
        />
      ))}
    </svg>
  );
}
