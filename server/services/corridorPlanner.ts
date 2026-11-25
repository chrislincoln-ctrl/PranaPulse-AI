import { GoogleGenAI, Type, type Schema } from '@google/genai';
import {
  buildClientGoogleMapsUrl,
  resolveCityCorridorPreset,
} from '../../src/config/cityCorridors.js';
import { resolveDirectionalCorridor } from '../../src/config/cityDirectionalWaypoints.js';
import { APP_META, VALIDATION_BOUNDS } from '../../src/config/constants.js';
import { SLIDER_LIMITS } from '../../src/config/uiConstants.js';
import type { CommuteModeId, CorridorNodeId } from '../../src/domain/types.js';
import { UI_CHROME_COPY } from '../../src/i18n/authAndUiCopy.js';
import { sanitizeUserText } from '../../src/utils/inputSanitizer.js';
import type { SupportedLanguage } from '../../src/validators/schemas.js';
import type { ServerEnv } from '../env.js';

export interface CorridorPlanRequest {
  readonly city: string;
  readonly fromArea: string;
  readonly toArea: string;
  readonly commuteMode: CommuteModeId;
  readonly language: SupportedLanguage;
}

export interface CorridorPlanResponse {
  readonly isValid: boolean;
  readonly estimatedDistanceKm: number;
  readonly routeSummary: string;
  readonly googleMapsUrl: string;
  readonly nodeLabels: Record<CorridorNodeId, string>;
}

const DEFAULT_DISTANCE_KM = 11;
const MIN_AREA_NAME_LEN = 2;
const SHORT_LABEL_MAX = 24;

const CORRIDOR_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    isValid: { type: Type.BOOLEAN },
    estimatedDistanceKm: { type: Type.NUMBER },
    arterialJunction: { type: Type.STRING },
    ringFlyover: { type: Type.STRING },
    greenParkway: { type: Type.STRING },
    metroConcourse: { type: Type.STRING },
    routeSummary: { type: Type.STRING },
  },
  required: [
    'isValid',
    'estimatedDistanceKm',
    'arterialJunction',
    'ringFlyover',
    'greenParkway',
    'metroConcourse',
    'routeSummary',
  ],
};

function clampKm(km: number): number {
  if (!Number.isFinite(km)) {
    return DEFAULT_DISTANCE_KM;
  }
  return Math.max(
    SLIDER_LIMITS.COMMUTE_KM_MIN,
    Math.min(SLIDER_LIMITS.COMMUTE_KM_MAX, Math.round(km)),
  );
}

function trimNodeLabel(raw: unknown, fallback: string): string {
  const str = typeof raw === 'string' ? raw : '';
  const cleaned = sanitizeUserText(str, VALIDATION_BOUNDS.MAX_CITY_QUERY_LEN);
  return (cleaned || fallback).slice(0, SHORT_LABEL_MAX);
}

function isPlausibleAreaName(text: string): boolean {
  if (text.length < MIN_AREA_NAME_LEN) {
    return false;
  }
  if (/^\d+$/.test(text) || /pizza|asdf|qwerty|test123/i.test(text)) {
    return false;
  }
  return /\p{L}/u.test(text);
}

function buildDirectionalOrPresetNodes(req: CorridorPlanRequest) {
  const directional = resolveDirectionalCorridor({
    city: req.city,
    fromArea: req.fromArea,
    toArea: req.toArea,
    commuteMode: req.commuteMode,
  });
  if (directional) {
    return {
      nodes: directional.nodes,
      distanceKm: directional.distanceKm,
      summary: directional.routeSummary,
    };
  }
  const preset = resolveCityCorridorPreset(req.city).nodes;
  const fromClean = trimNodeLabel(req.fromArea, preset['home-sector']);
  const toClean = trimNodeLabel(req.toArea, preset['civic-hub']);
  const nodes: Record<CorridorNodeId, string> = {
    ...preset,
    'home-sector': fromClean,
    'civic-hub': toClean,
  };
  const ui = UI_CHROME_COPY[req.language];
  const tmpl = req.commuteMode === 'metro' ? ui.corridorMetroFallback : ui.corridorSurfaceFallback;
  const modeSummary = tmpl
    .replace('{from}', fromClean)
    .replace('{to}', toClean)
    .replace('{green}', nodes['green-parkway'])
    .replace('{jct}', nodes['arterial-junction'])
    .replace('{fly}', nodes['ring-flyover']);
  return {
    nodes,
    distanceKm: DEFAULT_DISTANCE_KM,
    summary: modeSummary,
  };
}

function buildFallbackResponse(req: CorridorPlanRequest, isValid: boolean): CorridorPlanResponse {
  const resolved = buildDirectionalOrPresetNodes(req);
  const fullFrom =
    sanitizeUserText(req.fromArea, VALIDATION_BOUNDS.MAX_CITY_QUERY_LEN) ||
    resolved.nodes['home-sector'];
  const fullTo =
    sanitizeUserText(req.toArea, VALIDATION_BOUNDS.MAX_CITY_QUERY_LEN) ||
    resolved.nodes['civic-hub'];
  const googleMapsUrl = buildClientGoogleMapsUrl({
    city: req.city,
    fromArea: fullFrom,
    toArea: fullTo,
    greenWaypoint: resolved.nodes['green-parkway'],
    commuteMode: req.commuteMode,
  });
  const routeSummary = isValid
    ? resolved.summary
    : UI_CHROME_COPY[req.language].corridorInvalidFallback;

  return {
    isValid,
    estimatedDistanceKm: resolved.distanceKm,
    routeSummary,
    googleMapsUrl,
    nodeLabels: resolved.nodes,
  };
}

function buildCorridorPrompt(req: CorridorPlanRequest): string {
  return [
    'You are PranaPulse AI, an urban transit and low-pollution route planner.',
    `City="${req.city}", From="${req.fromArea}", To="${req.toArea}", Mode="${req.commuteMode}".`,
    `Verify if From and To are real, connected, commutable localities/landmarks within or near "${req.city}".`,
    `If NOT valid or NOT connected for daily urban travel, set isValid=false and explain why in 1 sentence in language "${req.language}".`,
    `If valid and connected, set isValid=true, estimate one-way distance in km (1..40), and provide 4 short real landmark names (<=22 chars) in "${req.city}" that lie strictly BETWEEN From and To in sequential direction-of-travel order (From -> greenParkway -> metroConcourse -> To, and From -> arterialJunction -> ringFlyover -> To; never place a station beyond To before To), plus a 1-sentence routeSummary in language "${req.language}".`,
  ].join('\n');
}

function parseCorridorModelJson(
  rawText: string,
  req: CorridorPlanRequest,
): CorridorPlanResponse | null {
  const parsed = JSON.parse(rawText) as Record<string, unknown>;
  if (typeof parsed.isValid !== 'boolean' || typeof parsed.routeSummary !== 'string') {
    return null;
  }
  const preset = resolveCityCorridorPreset(req.city).nodes;
  const fromClean = trimNodeLabel(req.fromArea, preset['home-sector']);
  const toClean = trimNodeLabel(req.toArea, preset['civic-hub']);
  const fullFrom =
    sanitizeUserText(req.fromArea, VALIDATION_BOUNDS.MAX_CITY_QUERY_LEN) || fromClean;
  const fullTo = sanitizeUserText(req.toArea, VALIDATION_BOUNDS.MAX_CITY_QUERY_LEN) || toClean;
  const green = trimNodeLabel(parsed.greenParkway, preset['green-parkway']);
  return {
    isValid: parsed.isValid,
    estimatedDistanceKm: clampKm(Number(parsed.estimatedDistanceKm)),
    routeSummary: parsed.routeSummary,
    googleMapsUrl: buildClientGoogleMapsUrl({
      city: req.city,
      fromArea: fullFrom,
      toArea: fullTo,
      greenWaypoint: green,
      commuteMode: req.commuteMode,
    }),
    nodeLabels: {
      'home-sector': fromClean,
      'arterial-junction': trimNodeLabel(parsed.arterialJunction, preset['arterial-junction']),
      'ring-flyover': trimNodeLabel(parsed.ringFlyover, preset['ring-flyover']),
      'green-parkway': green,
      'metro-concourse': trimNodeLabel(parsed.metroConcourse, preset['metro-concourse']),
      'civic-hub': toClean,
    },
  };
}

async function tryCorridorModel(
  ai: GoogleGenAI,
  modelName: string,
  req: CorridorPlanRequest,
): Promise<CorridorPlanResponse | null> {
  try {
    const resp = await ai.models.generateContent({
      model: modelName,
      contents: buildCorridorPrompt(req),
      config: {
        responseMimeType: 'application/json',
        responseSchema: CORRIDOR_SCHEMA,
        temperature: VALIDATION_BOUNDS.GEMINI_TEMPERATURE,
      },
    });
    return resp.text ? parseCorridorModelJson(resp.text, req) : null;
  } catch {
    return null;
  }
}

function isCorridorInputPlausible(req: CorridorPlanRequest): boolean {
  const fromClean = sanitizeUserText(req.fromArea, VALIDATION_BOUNDS.MAX_CITY_QUERY_LEN);
  const toClean = sanitizeUserText(req.toArea, VALIDATION_BOUNDS.MAX_CITY_QUERY_LEN);
  return (
    isPlausibleAreaName(fromClean) &&
    isPlausibleAreaName(toClean) &&
    fromClean.toLowerCase() !== toClean.toLowerCase()
  );
}

/**
 * Verifies origin/destination connectivity and computes city-specific clean corridor waypoints
 * plus a live Google Maps directions link.
 */
export async function planCityCorridor(
  req: CorridorPlanRequest,
  env: ServerEnv,
): Promise<CorridorPlanResponse> {
  if (!isCorridorInputPlausible(req)) {
    return buildFallbackResponse(req, false);
  }
  const directional = resolveDirectionalCorridor({
    city: req.city,
    fromArea: req.fromArea,
    toArea: req.toArea,
    commuteMode: req.commuteMode,
  });
  if (directional?.matchedBoth || !env.GEMINI_API_KEY) {
    return buildFallbackResponse(req, true);
  }

  const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
  const cascade = ['gemini-3.5-flash-lite', env.GEMINI_MODEL, ...APP_META.GEMINI_FALLBACK_MODELS];
  for (const modelName of new Set(cascade)) {
    const candidate = await tryCorridorModel(ai, modelName, req);
    if (candidate) {
      return candidate;
    }
  }
  return buildFallbackResponse(req, true);
}
