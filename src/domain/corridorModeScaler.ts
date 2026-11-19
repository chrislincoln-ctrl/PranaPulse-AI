import { COMMUTE_PHYSICS, CORRIDOR_GRAPH, UNIT_CONVERSIONS } from '../config/physicsConstants.js';
import { roundOne } from './mathHelpers.js';
import type { CommuteModeId, CorridorNodeId, MaskTypeId } from './types.js';

export interface CorridorRoutingOptions {
  readonly commuteMode?: CommuteModeId;
  readonly mask?: MaskTypeId;
  readonly distanceKm?: number;
}

export interface ResolvedScaleFactors {
  readonly commuteMode?: CommuteModeId;
  readonly ventilationM3Hr: number;
  readonly maskResidual: number;
  readonly distanceScale: number;
  readonly speedKmh: number | null;
  readonly modeExposureMultiplier: number;
}

const BASELINE_GRAPH_CORRIDOR_KM = 8.8;
const MIN_DISTANCE_SCALE = 0.2;
const METRO_TUNNEL_NODE: CorridorNodeId = 'metro-concourse';

export function isEdgeAllowedForMode(
  from: CorridorNodeId,
  to: CorridorNodeId,
  commuteMode?: CommuteModeId,
): boolean {
  if (!commuteMode || commuteMode === 'metro') {
    return true;
  }
  return from !== METRO_TUNNEL_NODE && to !== METRO_TUNNEL_NODE;
}

export function resolveModeScaleFactors(options?: CorridorRoutingOptions): ResolvedScaleFactors {
  if (!options?.commuteMode) {
    return {
      ventilationM3Hr: CORRIDOR_GRAPH.DEFAULT_VENTILATION_M3_HR,
      maskResidual: 1,
      distanceScale: 1,
      speedKmh: null,
      modeExposureMultiplier: 1,
    };
  }
  const modeSpec = COMMUTE_PHYSICS.MODES[options.commuteMode];
  const filtration = options.mask ? COMMUTE_PHYSICS.MASK_FILTRATION[options.mask] : 0;
  const distKm = options.distanceKm ?? BASELINE_GRAPH_CORRIDOR_KM;
  return {
    commuteMode: options.commuteMode,
    ventilationM3Hr: modeSpec.ventilationM3Hr,
    maskResidual: 1 - filtration,
    distanceScale: Math.max(MIN_DISTANCE_SCALE, distKm / BASELINE_GRAPH_CORRIDOR_KM),
    speedKmh: modeSpec.speedKmh,
    modeExposureMultiplier: modeSpec.exposureMultiplier,
  };
}

function resolveEdgeModeMultiplier(isMetroEdge: boolean, factors: ResolvedScaleFactors): number {
  if (!factors.commuteMode) {
    return 1;
  }
  if (isMetroEdge) {
    return COMMUTE_PHYSICS.MODES.metro.exposureMultiplier;
  }
  return factors.commuteMode === 'metro' ? 1 : factors.modeExposureMultiplier;
}

export function computeScaledEdgeMetrics(
  edge: (typeof CORRIDOR_GRAPH.EDGES)[number],
  safePm25: number,
  factors: ResolvedScaleFactors,
): { readonly distanceKm: number; readonly exposureUg: number; readonly minutes: number } {
  const isMetroEdge = edge.from === METRO_TUNNEL_NODE || edge.to === METRO_TUNNEL_NODE;
  const distanceKm = roundOne(edge.distanceKm * factors.distanceScale);
  const useRoadRefSpeed = factors.commuteMode === 'metro' && !isMetroEdge;
  const edgeSpeed = useRoadRefSpeed
    ? COMMUTE_PHYSICS.MODES['electric-bus'].speedKmh
    : factors.speedKmh;
  const minutes = edgeSpeed
    ? Math.max(1, Math.round((distanceKm / edgeSpeed) * UNIT_CONVERSIONS.MINUTES_PER_HOUR))
    : edge.minutes;
  const durationHours = minutes / UNIT_CONVERSIONS.MINUTES_PER_HOUR;
  const modeFactor = resolveEdgeModeMultiplier(isMetroEdge, factors);
  const exposureUg = roundOne(
    safePm25 *
      edge.pollutionFactor *
      modeFactor *
      durationHours *
      factors.ventilationM3Hr *
      factors.maskResidual,
  );
  return { distanceKm, exposureUg, minutes };
}

