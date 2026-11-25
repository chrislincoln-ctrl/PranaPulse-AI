/**
 * Coordinate-projected directional urban transit waypoints ensuring intermediate
 * metro stations, green parkways, and arterial flyovers strictly follow real-world
 * travel order (Origin [t=0] -> Waypoint 1 [t1] -> Waypoint 2 [t2] -> Destination [t=1]).
 */

import type { CorridorNodeId } from '../domain/types.js';

export interface GeoLocality {
  readonly keywords: readonly string[];
  readonly label: string;
  readonly lat: number;
  readonly lon: number;
}

export interface CityWaypointPool {
  readonly defaultOrigin: GeoLocality;
  readonly defaultDest: GeoLocality;
  readonly localities: readonly GeoLocality[];
  readonly greenWaypoints: readonly GeoLocality[];
  readonly metroWaypoints: readonly GeoLocality[];
  readonly arterialWaypoints: readonly GeoLocality[];
  readonly flyoverWaypoints: readonly GeoLocality[];
}

export interface DirectionalCorridorResult {
  readonly matchedBoth: boolean;
  readonly fromLabel: string;
  readonly toLabel: string;
  readonly distanceKm: number;
  readonly nodes: Record<CorridorNodeId, string>;
  readonly intermediateMetroStops: readonly string[];
  readonly routeSummary: string;
}

function pt(label: string, lat: number, lon: number, kw = ''): GeoLocality {
  return { label, lat, lon, keywords: kw ? kw.split('|') : [] };
}

const KOLKATA_POOL: CityWaypointPool = {
  defaultOrigin: pt('Garia', 22.466, 88.392),
  defaultDest: pt('Esplanade / BBD Bagh', 22.568, 88.351),
  localities: [
    pt('Garia', 22.466, 88.392, 'garia|kavi subhash|new garia|khudiram'),
    pt('Tollygunge', 22.499, 88.345, 'tollygunge|uttam kumar'),
    pt('Jadavpur', 22.495, 88.371, 'jadavpur'),
    pt('Kalighat', 22.52, 88.346, 'kalighat|rashbehari'),
    pt('Gariahat / Ballygunge', 22.519, 88.365, 'ballygunge|gariahat'),
    pt('Rabindra Sadan', 22.541, 88.347, 'rabindra sadan|nandan'),
    pt('Maidan', 22.55, 88.349, 'maidan'),
    pt('Park Street', 22.553, 88.352, 'park street|park st'),
    pt('Esplanade / BBD Bagh', 22.568, 88.351, 'esplanade|bbd bagh|dalhousie|dharmatala'),
    pt('Salt Lake Sector V', 22.577, 88.431, 'salt lake|bidhannagar|sector v|new town'),
    pt('Sealdah', 22.567, 88.371, 'sealdah'),
    pt('Howrah Hub', 22.583, 88.342, 'howrah'),
    pt('Dum Dum / Shyambazar', 22.622, 88.392, 'dum dum|shyambazar|dakshineswar'),
  ],
  greenWaypoints: [
    pt('Rabindra Sarobar Parkway', 22.511, 88.355),
    pt('Maidan Green Parkway', 22.546, 88.348),
    pt('Victoria Memorial Buffer', 22.544, 88.342),
    pt('Central Park Greenway', 22.582, 88.415),
    pt('Tala Park Green Buffer', 22.608, 88.378),
  ],
  metroWaypoints: [
    pt('Tollygunge Metro', 22.499, 88.345),
    pt('Kalighat Metro', 22.52, 88.346),
    pt('Rabindra Sadan Metro', 22.541, 88.347),
    pt('Park Street Metro', 22.553, 88.352),
    pt('Esplanade Metro', 22.565, 88.352),
    pt('Sealdah Green Line Metro', 22.567, 88.371),
    pt('Shyambazar Metro', 22.601, 88.373),
  ],
  arterialWaypoints: [
    pt('Jadavpur 8B Crossing', 22.495, 88.371),
    pt('Gariahat Crossing', 22.519, 88.365),
    pt('Park Circus 7-Point', 22.543, 88.366),
    pt('Moulali / SN Banerjee Rd', 22.562, 88.364),
    pt('Ultadanga HUDCO Crossing', 22.591, 88.393),
  ],
  flyoverWaypoints: [
    pt('Dhakuria Bridge Corridor', 22.508, 88.367),
    pt('AJC Bose Road Flyover', 22.542, 88.354),
    pt('Maa Flyover Corridor', 22.543, 88.382),
    pt('Chingrighata Flyover', 22.561, 88.404),
  ],
};

const DELHI_POOL: CityWaypointPool = {
  defaultOrigin: pt('Dwarka / RK Puram', 28.57, 77.12),
  defaultDest: pt('Connaught Place', 28.631, 77.219),
  localities: [
    pt('Dwarka / RK Puram', 28.57, 77.12, 'dwarka|rk puram|vasant kunj'),
    pt('Hauz Khas / Saket', 28.54, 77.2, 'hauz khas|saket|malviya'),
    pt('AIIMS / INA', 28.567, 77.21, 'aiims|ina|south ex'),
    pt('Connaught Place', 28.631, 77.219, 'connaught place|cp|rajiv chowk'),
    pt('Noida / Mayur Vihar', 28.59, 77.31, 'noida|mayur vihar|akshardham'),
    pt('Rohini / North Delhi', 28.71, 77.15, 'rohini|pitampura|civil lines'),
    pt('Karol Bagh / Rajouri', 28.65, 77.16, 'karol bagh|rajouri'),
  ],
  greenWaypoints: [
    pt('Sanjay Van Green Belt', 28.552, 77.175),
    pt('Lodhi Garden Parkway', 28.593, 77.219),
    pt('Central Ridge Parkway', 28.622, 77.19),
  ],
  metroWaypoints: [
    pt('Hauz Khas Metro', 28.543, 77.206),
    pt('INA / Jor Bagh Metro', 28.581, 77.214),
    pt('Central Secretariat Metro', 28.614, 77.212),
    pt('Rajiv Chowk Metro', 28.632, 77.219),
  ],
  arterialWaypoints: [
    pt('Dhaula Kuan Crossing', 28.592, 77.162),
    pt('AIIMS Ring Junction', 28.567, 77.21),
    pt('ITO Crossing', 28.628, 77.241),
  ],
  flyoverWaypoints: [
    pt('Rao Tula Ram Flyover', 28.568, 77.16),
    pt('AIIMS Ring Flyover', 28.569, 77.212),
    pt('Barapullah Elevated Rd', 28.585, 77.245),
  ],
};

function matchLocality(
  query: string,
  pool: readonly GeoLocality[],
  fallback: GeoLocality,
): { readonly loc: GeoLocality; readonly matched: boolean } {
  const lower = query.toLowerCase().trim();
  for (const loc of pool) {
    if (loc.keywords.some((k) => lower.includes(k))) {
      return { loc, matched: true };
    }
  }
  return {
    loc: pt(query.trim() || fallback.label, fallback.lat, fallback.lon),
    matched: false,
  };
}

function projectOntoSegment(
  cand: GeoLocality,
  origin: GeoLocality,
  dest: GeoLocality,
): { readonly t: number; readonly perpDist: number } {
  const dx = dest.lon - origin.lon;
  const dy = dest.lat - origin.lat;
  const lenSq = dx * dx + dy * dy;
  if (lenSq < 1e-8) {
    return { t: 0.5, perpDist: 0 };
  }
  const t = ((cand.lon - origin.lon) * dx + (cand.lat - origin.lat) * dy) / lenSq;
  const perpDist = Math.hypot(cand.lon - (origin.lon + t * dx), cand.lat - (origin.lat + t * dy));
  return { t, perpDist };
}

function isExcludedCandidate(label: string, excludeLabels: ReadonlySet<string>): boolean {
  const lower = label.toLowerCase();
  for (const ex of excludeLabels) {
    if (lower === ex || (ex.length >= 5 && lower.includes(ex))) {
      return true;
    }
  }
  return false;
}

function pickDirectionalWaypoint(
  candidates: readonly GeoLocality[],
  origin: GeoLocality,
  dest: GeoLocality,
  targetT: number,
  excludeLabels: ReadonlySet<string>,
): string {
  let best = candidates[0]?.label ?? 'Central Parkway';
  let bestScore = Number.POSITIVE_INFINITY;

  for (const cand of candidates) {
    if (isExcludedCandidate(cand.label, excludeLabels)) {
      continue;
    }
    const { t, perpDist } = projectOntoSegment(cand, origin, dest);
    const outOfOrderPenalty = t <= 0.04 || t >= 0.96 ? 10 : 0;
    const score = Math.abs(t - targetT) + perpDist * 4 + outOfOrderPenalty;
    if (score < bestScore) {
      bestScore = score;
      best = cand.label;
    }
  }
  return best;
}

function estimateRoadDistanceKm(origin: GeoLocality, dest: GeoLocality): number {
  const dLatKm = (dest.lat - origin.lat) * 111.32;
  const dLonKm = (dest.lon - origin.lon) * 111.32 * Math.cos((origin.lat * Math.PI) / 180);
  return Math.max(2, Math.min(40, Math.round(Math.hypot(dLatKm, dLonKm) * 1.28)));
}

function selectCityPool(city: string): CityWaypointPool | null {
  const lower = city.toLowerCase();
  if (lower.includes('kolkata') || lower.includes('calcutta')) {
    return KOLKATA_POOL;
  }
  return lower.includes('delhi') ? DELHI_POOL : null;
}

function buildExcludeTokens(labels: readonly string[]): Set<string> {
  const out = new Set<string>();
  for (const raw of labels) {
    const lower = raw.toLowerCase().trim();
    if (lower) {
      out.add(lower);
    }
    for (const part of lower.split(/[/,]/)) {
      const token = part.trim();
      if (token.length >= 4) {
        out.add(token);
      }
    }
  }
  return out;
}

function buildDirectionalNodes(
  pool: CityWaypointPool,
  origin: GeoLocality,
  dest: GeoLocality,
  fromLabel: string,
  toLabel: string,
): Record<CorridorNodeId, string> {
  const exclude = buildExcludeTokens([fromLabel, toLabel, origin.label, dest.label]);
  const greenParkway = pickDirectionalWaypoint(pool.greenWaypoints, origin, dest, 0.42, exclude);
  exclude.add(greenParkway.toLowerCase());
  const metroConcourse = pickDirectionalWaypoint(pool.metroWaypoints, origin, dest, 0.52, exclude);
  exclude.add(metroConcourse.toLowerCase());
  const arterialJunction = pickDirectionalWaypoint(
    pool.arterialWaypoints,
    origin,
    dest,
    0.35,
    exclude,
  );
  exclude.add(arterialJunction.toLowerCase());
  const ringFlyover = pickDirectionalWaypoint(pool.flyoverWaypoints, origin, dest, 0.72, exclude);

  return {
    'home-sector': fromLabel,
    'arterial-junction': arterialJunction,
    'ring-flyover': ringFlyover,
    'green-parkway': greenParkway,
    'metro-concourse': metroConcourse,
    'civic-hub': toLabel,
  };
}

function listIntermediateMetroStops(
  pool: CityWaypointPool,
  origin: GeoLocality,
  dest: GeoLocality,
  excludeLabels: ReadonlySet<string>,
): readonly string[] {
  return pool.metroWaypoints
    .filter((cand) => !isExcludedCandidate(cand.label, excludeLabels))
    .map((cand) => ({ cand, proj: projectOntoSegment(cand, origin, dest) }))
    .filter((item) => item.proj.t > 0.08 && item.proj.t < 0.92 && item.proj.perpDist < 0.04)
    .sort((a, b) => a.proj.t - b.proj.t)
    .slice(0, 4)
    .map((item) => item.cand.label);
}

/**
 * Resolves direction-ordered intermediate waypoints and ordered metro station icons
 * between Origin and Destination in sequential travel order.
 */
export function resolveDirectionalCorridor(params: {
  readonly city: string;
  readonly fromArea: string;
  readonly toArea: string;
  readonly commuteMode?: string;
}): DirectionalCorridorResult | null {
  const pool = selectCityPool(params.city);
  if (!pool) {
    return null;
  }
  const originMatch = matchLocality(params.fromArea, pool.localities, pool.defaultOrigin);
  const destMatch = matchLocality(params.toArea, pool.localities, pool.defaultDest);

  const fromLabel = params.fromArea.trim() || pool.defaultOrigin.label;
  const toLabel = params.toArea.trim() || pool.defaultDest.label;
  const nodes = buildDirectionalNodes(pool, originMatch.loc, destMatch.loc, fromLabel, toLabel);
  const distanceKm = estimateRoadDistanceKm(originMatch.loc, destMatch.loc);
  const exclude = buildExcludeTokens([
    fromLabel,
    toLabel,
    originMatch.loc.label,
    destMatch.loc.label,
  ]);
  const intermediateMetroStops = listIntermediateMetroStops(
    pool,
    originMatch.loc,
    destMatch.loc,
    exclude,
  );
  const isMetro = !params.commuteMode || params.commuteMode === 'metro';
  const stopHint =
    intermediateMetroStops.length > 0 ? ` [${String(intermediateMetroStops.length)} M stops]` : '';

  const routeSummary = isMetro
    ? `Metro corridor from ${fromLabel} to ${toLabel} (${String(distanceKm)} km${stopHint}) bypasses higher-PM2.5 arterial traffic at ${nodes['arterial-junction']} & ${nodes['ring-flyover']}. Verify stations via Google Maps.`
    : `Cleanest surface road route from ${fromLabel} to ${toLabel} (${String(distanceKm)} km) follows ${nodes['green-parkway']}, avoiding high-exhaust ${nodes['arterial-junction']} & ${nodes['ring-flyover']}.`;

  return {
    matchedBoth: originMatch.matched && destMatch.matched,
    fromLabel,
    toLabel,
    distanceKm,
    nodes,
    intermediateMetroStops,
    routeSummary,
  };
}
