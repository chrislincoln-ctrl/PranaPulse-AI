import { CORRIDOR_GRAPH } from '../config/physicsConstants.js';
import {
  computeScaledEdgeMetrics,
  isEdgeAllowedForMode,
  resolveModeScaleFactors,
  type CorridorRoutingOptions,
} from './corridorModeScaler.js';
import { assertFiniteNonNegative, roundOne } from './mathHelpers.js';
import type { CorridorNodeId, CorridorRouteComparison, CorridorSegment } from './types.js';

export type { CorridorRoutingOptions } from './corridorModeScaler.js';

interface GraphEdgeInternal {
  readonly to: CorridorNodeId;
  readonly distanceKm: number;
  readonly exposureUg: number;
  readonly minutes: number;
}

type AdjacencyMap = ReadonlyMap<CorridorNodeId, readonly GraphEdgeInternal[]>;

function buildAdjacency(ambientPm25UgM3: number, options?: CorridorRoutingOptions): AdjacencyMap {
  const safePm25 = assertFiniteNonNegative(ambientPm25UgM3, 'ambientPm25UgM3');
  const factors = resolveModeScaleFactors(options);
  const map = new Map<CorridorNodeId, GraphEdgeInternal[]>();

  for (const node of CORRIDOR_GRAPH.NODES) {
    map.set(node, []);
  }

  for (const edge of CORRIDOR_GRAPH.EDGES) {
    if (!isEdgeAllowedForMode(edge.from, edge.to, options?.commuteMode)) {
      continue;
    }
    const metrics = computeScaledEdgeMetrics(edge, safePm25, factors);
    map.get(edge.from)?.push({ to: edge.to, ...metrics });
    map.get(edge.to)?.push({ to: edge.from, ...metrics });
  }

  return map;
}

function pickClosestUnvisited(
  unvisited: ReadonlySet<CorridorNodeId>,
  distances: ReadonlyMap<CorridorNodeId, number>,
): CorridorNodeId | undefined {
  let bestNode: CorridorNodeId | undefined;
  let bestCost = Number.POSITIVE_INFINITY;

  for (const node of unvisited) {
    const cost = distances.get(node) ?? Number.POSITIVE_INFINITY;
    if (cost < bestCost) {
      bestCost = cost;
      bestNode = node;
    }
  }
  return bestNode;
}

function traceNodePath(
  origin: CorridorNodeId,
  destination: CorridorNodeId,
  previous: ReadonlyMap<CorridorNodeId, CorridorNodeId>,
): readonly CorridorNodeId[] {
  const path: CorridorNodeId[] = [];
  let cursor: CorridorNodeId | undefined = destination;

  while (cursor !== undefined) {
    path.unshift(cursor);
    cursor = cursor === origin ? undefined : previous.get(cursor);
  }
  return path[0] === origin ? path : [];
}

function buildSegmentsFromPath(
  path: readonly CorridorNodeId[],
  adjacency: AdjacencyMap,
): { segments: readonly CorridorSegment[]; minutes: number } {
  const segments: CorridorSegment[] = [];
  let minutes = 0;

  for (let i = 0; i < path.length - 1; i += 1) {
    const from = path[i];
    const to = path[i + 1];
    if (!from || !to) {
      continue;
    }
    const edge = adjacency.get(from)?.find((candidate) => candidate.to === to);
    if (!edge) {
      continue;
    }
    minutes += edge.minutes;
    segments.push({
      from,
      to,
      distanceKm: edge.distanceKm,
      exposureUg: edge.exposureUg,
      minutes: edge.minutes,
    });
  }
  return { segments, minutes };
}

function relaxNeighbors(params: {
  current: CorridorNodeId;
  adjacency: AdjacencyMap;
  distances: Map<CorridorNodeId, number>;
  previous: Map<CorridorNodeId, CorridorNodeId>;
  weightKey: 'exposureUg' | 'distanceKm';
}): void {
  const baseCost = params.distances.get(params.current) ?? Number.POSITIVE_INFINITY;
  for (const neighbor of params.adjacency.get(params.current) ?? []) {
    const candidate = baseCost + neighbor[params.weightKey];
    const existing = params.distances.get(neighbor.to) ?? Number.POSITIVE_INFINITY;
    if (candidate < existing) {
      params.distances.set(neighbor.to, candidate);
      params.previous.set(neighbor.to, params.current);
    }
  }
}

function runShortestCostPath(
  origin: CorridorNodeId,
  destination: CorridorNodeId,
  adjacency: AdjacencyMap,
  weightKey: 'exposureUg' | 'distanceKm',
): {
  totalCost: number;
  path: readonly CorridorNodeId[];
  segments: readonly CorridorSegment[];
  minutes: number;
} {
  const distances = new Map<CorridorNodeId, number>();
  const previous = new Map<CorridorNodeId, CorridorNodeId>();
  const unvisited = new Set<CorridorNodeId>(CORRIDOR_GRAPH.NODES);

  for (const node of CORRIDOR_GRAPH.NODES) {
    distances.set(node, node === origin ? 0 : Number.POSITIVE_INFINITY);
  }

  while (unvisited.size > 0) {
    const current = pickClosestUnvisited(unvisited, distances);
    if (!current || current === destination) {
      break;
    }
    unvisited.delete(current);
    relaxNeighbors({ current, adjacency, distances, previous, weightKey });
  }

  const path = traceNodePath(origin, destination, previous);
  const { segments, minutes } = buildSegmentsFromPath(path, adjacency);
  const totalCost = roundOne(segments.reduce((acc, seg) => acc + seg.exposureUg, 0));
  return { totalCost, path, segments, minutes };
}

/**
 * Runs deterministic Dijkstra optimization comparing the lowest cumulative PM2.5-dose corridor
 * against the shortest-distance arterial road route, synced to travel mode, respirator, and distance.
 */
export function findLowestExposureCorridor(
  origin: CorridorNodeId,
  destination: CorridorNodeId,
  ambientPm25UgM3: number,
  options?: CorridorRoutingOptions,
): CorridorRouteComparison {
  const adjacency = buildAdjacency(ambientPm25UgM3, options);
  if (origin === destination) {
    return {
      lowestExposurePath: [origin],
      lowestExposureUg: 0,
      lowestExposureMinutes: 0,
      directRoadPath: [origin],
      directRoadExposureUg: 0,
      exposureSavedUg: 0,
      exposureSavedPct: 0,
      segments: [],
    };
  }

  const cleanest = runShortestCostPath(origin, destination, adjacency, 'exposureUg');
  const direct = runShortestCostPath(origin, destination, adjacency, 'distanceKm');
  const exposureSavedUg = Math.max(0, roundOne(direct.totalCost - cleanest.totalCost));
  const exposureSavedPct =
    direct.totalCost > 0 ? roundOne((exposureSavedUg / direct.totalCost) * 100) : 0;

  return {
    lowestExposurePath: cleanest.path,
    lowestExposureUg: cleanest.totalCost,
    lowestExposureMinutes: cleanest.minutes,
    directRoadPath: direct.path,
    directRoadExposureUg: direct.totalCost,
    exposureSavedUg,
    exposureSavedPct,
    segments: cleanest.segments,
    directSegments: direct.segments,
  };
}
