/**
 * City-specific real-world urban corridor nodes, default origin/destination areas,
 * and Google Maps clean-corridor deep-link builders shared by client and server.
 */

import type { CommuteModeId, CorridorNodeId } from '../domain/types.js';

export interface CityCorridorPreset {
  readonly defaultFrom: string;
  readonly defaultTo: string;
  readonly nodes: Record<CorridorNodeId, string>;
}

const DEFAULT_DELHI_PRESET: CityCorridorPreset = {
  defaultFrom: 'Dwarka',
  defaultTo: 'Connaught Place',
  nodes: {
    'home-sector': 'Dwarka',
    'arterial-junction': 'ITO Crossing',
    'ring-flyover': 'AIIMS Ring Flyover',
    'green-parkway': 'Lodhi Garden',
    'metro-concourse': 'Rajiv Chowk Metro',
    'civic-hub': 'Connaught Place',
  },
};

const KOLKATA_PRESET: CityCorridorPreset = {
  defaultFrom: 'Garia',
  defaultTo: 'Esplanade',
  nodes: {
    'home-sector': 'Garia',
    'arterial-junction': 'Jadavpur 8B Crossing',
    'ring-flyover': 'AJC Bose Road Flyover',
    'green-parkway': 'Rabindra Sarobar Lake',
    'metro-concourse': 'Park Street Metro',
    'civic-hub': 'Esplanade',
  },
};

const CITY_CORRIDOR_MAP: Record<string, CityCorridorPreset> = {
  'new delhi': DEFAULT_DELHI_PRESET,
  delhi: DEFAULT_DELHI_PRESET,
  kolkata: KOLKATA_PRESET,
  calcutta: KOLKATA_PRESET,
  lucknow: {
    defaultFrom: 'Gomti Nagar',
    defaultTo: 'Hazratganj',
    nodes: {
      'home-sector': 'Gomti Nagar',
      'arterial-junction': 'Polytechnic Chauraha',
      'ring-flyover': 'Shaheed Path Flyover',
      'green-parkway': 'Janeshwar Mishra Park',
      'metro-concourse': 'Hazratganj Metro',
      'civic-hub': 'Hazratganj',
    },
  },
  patna: {
    defaultFrom: 'Kankarbagh',
    defaultTo: 'Gandhi Maidan',
    nodes: {
      'home-sector': 'Kankarbagh',
      'arterial-junction': 'Dak Bungalow Crossing',
      'ring-flyover': 'Bailey Road Flyover',
      'green-parkway': 'Eco Park',
      'metro-concourse': 'Patna Junction',
      'civic-hub': 'Gandhi Maidan',
    },
  },
  mumbai: {
    defaultFrom: 'Andheri West',
    defaultTo: 'Nariman Point',
    nodes: {
      'home-sector': 'Andheri West',
      'arterial-junction': 'Dadar TT Junction',
      'ring-flyover': 'Western Express Hwy',
      'green-parkway': 'Carter Road Promenade',
      'metro-concourse': 'BKC Metro',
      'civic-hub': 'Nariman Point',
    },
  },
  chennai: {
    defaultFrom: 'Anna Nagar',
    defaultTo: 'T. Nagar',
    nodes: {
      'home-sector': 'Anna Nagar',
      'arterial-junction': 'Kathipara Junction',
      'ring-flyover': 'Anna Salai Flyover',
      'green-parkway': 'Guindy National Park',
      'metro-concourse': 'Alandur Metro',
      'civic-hub': 'T. Nagar',
    },
  },
  bengaluru: {
    defaultFrom: 'Indiranagar',
    defaultTo: 'MG Road',
    nodes: {
      'home-sector': 'Indiranagar',
      'arterial-junction': 'Silk Board Junction',
      'ring-flyover': 'Outer Ring Flyover',
      'green-parkway': 'Cubbon Park',
      'metro-concourse': 'Majestic Metro',
      'civic-hub': 'MG Road',
    },
  },
  london: {
    defaultFrom: 'Ealing',
    defaultTo: 'Canary Wharf',
    nodes: {
      'home-sector': 'Ealing',
      'arterial-junction': 'Marylebone Road',
      'ring-flyover': 'A40 Westway Flyover',
      'green-parkway': 'Hyde Park',
      'metro-concourse': 'Paddington Station',
      'civic-hub': 'Canary Wharf',
    },
  },
};

export function resolveCityCorridorPreset(
  city: string,
  fallbackNodes?: Record<CorridorNodeId, string>,
): CityCorridorPreset {
  const lower = city.toLowerCase();
  for (const [key, preset] of Object.entries(CITY_CORRIDOR_MAP)) {
    if (lower.includes(key)) {
      return preset;
    }
  }
  const nodes = fallbackNodes ?? DEFAULT_DELHI_PRESET.nodes;
  return {
    defaultFrom: `${city} (${nodes['home-sector']})`,
    defaultTo: `${city} (${nodes['civic-hub']})`,
    nodes,
  };
}

function extractPrimaryPlace(rawPlace: string): string {
  const beforeSlash = rawPlace.split('/')[0]?.trim() ?? rawPlace.trim();
  const beforeParen = beforeSlash.split('(')[0]?.trim() ?? beforeSlash;
  return beforeParen || rawPlace.trim();
}

function formatMapsPlace(rawPlace: string, city: string): string {
  const cleanPlace = extractPrimaryPlace(rawPlace);
  const cleanCity = city.trim();
  if (!cleanCity || cleanCity.toLowerCase() === 'local area monitor') {
    return cleanPlace;
  }
  const lowerPlace = cleanPlace.toLowerCase();
  const remainingParts = cleanCity
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0 && !lowerPlace.includes(part.toLowerCase()));
  return remainingParts.length > 0 ? `${cleanPlace}, ${remainingParts.join(', ')}` : cleanPlace;
}

export function buildClientGoogleMapsUrl(params: {
  readonly city: string;
  readonly fromArea: string;
  readonly toArea: string;
  readonly greenWaypoint: string;
  readonly commuteMode: CommuteModeId;
}): string {
  let travelmode = 'driving';
  if (params.commuteMode === 'metro' || params.commuteMode === 'electric-bus') {
    travelmode = 'transit';
  } else if (params.commuteMode === 'cycling') {
    travelmode = 'bicycling';
  } else if (params.commuteMode === 'walking') {
    travelmode = 'walking';
  }
  const origin = encodeURIComponent(formatMapsPlace(params.fromArea, params.city));
  const dest = encodeURIComponent(formatMapsPlace(params.toArea, params.city));
  if (travelmode === 'transit') {
    return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${dest}&travelmode=transit`;
  }
  const waypoint = encodeURIComponent(formatMapsPlace(params.greenWaypoint, params.city));
  return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${dest}&waypoints=${waypoint}&travelmode=${travelmode}`;
}
