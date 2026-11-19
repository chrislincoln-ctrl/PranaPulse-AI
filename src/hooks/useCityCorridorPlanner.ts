import {
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type RefObject,
  type SetStateAction,
} from 'react';
import { buildClientGoogleMapsUrl, resolveCityCorridorPreset } from '../config/cityCorridors.js';
import { resolveDirectionalCorridor } from '../config/cityDirectionalWaypoints.js';
import type { CommuteModeId, CorridorNodeId } from '../domain/types.js';
import type { LocaleDictionary } from '../i18n/translations.js';
import type { SupportedLanguage } from '../validators/schemas.js';

export interface CorridorPlanFeedback {
  readonly isValid: boolean;
  readonly estimatedDistanceKm: number;
  readonly routeSummary: string;
  readonly googleMapsUrl: string;
  readonly nodeLabels: Record<CorridorNodeId, string>;
}

interface CorridorLookupInput {
  readonly city: string;
  readonly commuteMode: CommuteModeId;
  readonly language: SupportedLanguage;
  readonly fromArea: string;
  readonly toArea: string;
}

async function fetchCorridorPlan(
  payload: CorridorLookupInput,
  signal?: AbortSignal,
): Promise<CorridorPlanFeedback | null> {
  try {
    const res = await fetch('/api/corridor-plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      ...(signal ? { signal } : {}),
    });
    return res.ok ? ((await res.json()) as CorridorPlanFeedback) : null;
  } catch {
    return null;
  }
}

function resolveActiveCorridorNodes(
  params: Pick<CorridorLookupInput, 'city' | 'commuteMode' | 'fromArea' | 'toArea'> & {
    readonly customNodes: Record<CorridorNodeId, string> | null;
    readonly t: LocaleDictionary;
  },
): {
  readonly activeNodes: Record<CorridorNodeId, string>;
  readonly intermediateMetroStops: readonly string[];
} {
  const preset = resolveCityCorridorPreset(params.city, params.t.corridorNodes);
  const fromVal = params.fromArea || preset.defaultFrom;
  const toVal = params.toArea || preset.defaultTo;
  const directional = resolveDirectionalCorridor({
    city: params.city,
    fromArea: fromVal,
    toArea: toVal,
    commuteMode: params.commuteMode,
  });
  const activeNodes: Record<CorridorNodeId, string> = params.customNodes ??
    directional?.nodes ?? { ...preset.nodes, 'home-sector': fromVal, 'civic-hub': toVal };
  return { activeNodes, intermediateMetroStops: directional?.intermediateMetroStops ?? [] };
}

function buildDerivedCorridorView(
  params: Pick<CorridorLookupInput, 'city' | 'commuteMode' | 'fromArea' | 'toArea'> & {
    readonly customNodes: Record<CorridorNodeId, string> | null;
    readonly feedback: CorridorPlanFeedback | null;
    readonly t: LocaleDictionary;
  },
) {
  const { activeNodes, intermediateMetroStops } = resolveActiveCorridorNodes(params);
  const googleMapsUrl =
    params.feedback?.googleMapsUrl ??
    buildClientGoogleMapsUrl({
      city: params.city,
      fromArea: params.fromArea || activeNodes['home-sector'],
      toArea: params.toArea || activeNodes['civic-hub'],
      greenWaypoint: activeNodes['green-parkway'],
      commuteMode: params.commuteMode,
    });
  return { activeNodes, intermediateMetroStops, googleMapsUrl };
}

async function executeCorridorPlan(
  req: CorridorLookupInput,
  signal: AbortSignal,
  setLoading: (v: boolean) => void,
  applyPlan: (d: CorridorPlanFeedback) => void,
): Promise<void> {
  setLoading(true);
  try {
    const data = await fetchCorridorPlan(req, signal);
    if (data && !signal.aborted) {
      applyPlan(data);
    }
  } finally {
    if (!signal.aborted) {
      setLoading(false);
    }
  }
}

interface CorridorPlannerState {
  readonly fromArea: string;
  readonly toArea: string;
  readonly customNodes: Record<CorridorNodeId, string> | null;
  readonly feedback: CorridorPlanFeedback | null;
  readonly loading: boolean;
}

function useCorridorResetEffects(
  city: string,
  commuteMode: CommuteModeId,
  t: LocaleDictionary,
  refs: {
    readonly abortBox: RefObject<{ ctrl: AbortController | null }>;
    readonly setState: Dispatch<SetStateAction<CorridorPlannerState>>;
  },
): void {
  const { abortBox, setState } = refs;

  useEffect(() => {
    const box = abortBox.current;
    box.ctrl?.abort();
    const next = resolveCityCorridorPreset(city, t.corridorNodes);
    setState({
      fromArea: next.defaultFrom,
      toArea: next.defaultTo,
      customNodes: null,
      feedback: null,
      loading: false,
    });
    return () => {
      box.ctrl?.abort();
    };
  }, [abortBox, city, setState, t]);

  useEffect(() => {
    abortBox.current.ctrl?.abort();
    setState((prev) => ({ ...prev, feedback: null, loading: false }));
  }, [abortBox, commuteMode, setState]);
}

function startCorridorPlan(opts: {
  readonly req: CorridorLookupInput;
  readonly abortBox: RefObject<{ ctrl: AbortController | null }>;
  readonly setState: Dispatch<SetStateAction<CorridorPlannerState>>;
  readonly onUpdateDistanceKm: (km: number) => void;
}): void {
  const { abortBox, setState, onUpdateDistanceKm, req } = opts;
  abortBox.current.ctrl?.abort();
  const ctrl = new AbortController();
  abortBox.current.ctrl = ctrl;
  void executeCorridorPlan(
    req,
    ctrl.signal,
    (loading) => {
      setState((prev) => ({ ...prev, loading }));
    },
    (data) => {
      setState((prev) => ({
        ...prev,
        feedback: data,
        customNodes: data.isValid ? data.nodeLabels : prev.customNodes,
      }));
      if (data.isValid) {
        onUpdateDistanceKm(data.estimatedDistanceKm);
      }
    },
  );
}

/**
 * Manages origin/destination route state, live corridor verification requests,
 * and Google Maps clean-route deep-link generation synchronized with the active city and mode.
 */
export function useCityCorridorPlanner(params: {
  readonly city: string;
  readonly commuteMode: CommuteModeId;
  readonly language: SupportedLanguage;
  readonly onUpdateDistanceKm: (km: number) => void;
  readonly t: LocaleDictionary;
}) {
  const initial = resolveCityCorridorPreset(params.city, params.t.corridorNodes);
  const [state, setState] = useState<CorridorPlannerState>({
    fromArea: initial.defaultFrom,
    toArea: initial.defaultTo,
    customNodes: null,
    feedback: null,
    loading: false,
  });
  const abortBox = useRef<{ ctrl: AbortController | null }>({ ctrl: null });

  useCorridorResetEffects(params.city, params.commuteMode, params.t, { abortBox, setState });

  const bindArea = (field: 'fromArea' | 'toArea') => (val: string) => {
    abortBox.current.ctrl?.abort();
    setState((prev) => ({
      ...prev,
      [field]: val,
      customNodes: null,
      feedback: null,
      loading: false,
    }));
  };

  return {
    ...buildDerivedCorridorView({ ...params, ...state }),
    fromArea: state.fromArea,
    toArea: state.toArea,
    feedback: state.feedback,
    loading: state.loading,
    setFromArea: bindArea('fromArea'),
    setToArea: bindArea('toArea'),
    runCorridorPlan: () => {
      startCorridorPlan({
        req: { ...params, fromArea: state.fromArea, toArea: state.toArea },
        abortBox,
        setState,
        onUpdateDistanceKm: params.onUpdateDistanceKm,
      });
    },
  };
}
