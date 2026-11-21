import { useCallback, useEffect, useRef, useState } from 'react';
import { DEFAULT_WORKSPACE_INPUT, SUPPORTED_LANGUAGES, UI_TIMINGS } from '../config/uiConstants.js';
import {
  buildInitialWorkspaceBundle,
  recomputeBundlePhysics,
  type PlanBundleResponse,
} from '../domain/localBaseline.js';
import type { FamilyMemberInput } from '../domain/types.js';
import { TRANSLATIONS } from '../i18n/translations.js';
import { quantizeCoord } from '../utils/inputSanitizer.js';
import type { PlanRequestPayload, SupportedLanguage } from '../validators/schemas.js';
import { useGeolocationAction, type GpsStatus } from './useGeolocationAction.js';

export type { GpsStatus };

interface HealthPayload {
  readonly capabilities?: {
    readonly geminiConfigured?: boolean;
    readonly groqConfigured?: boolean;
    readonly telegramConfigured?: boolean;
  };
}

function localizeDefaultMembers(
  members: readonly FamilyMemberInput[],
  targetLang: SupportedLanguage,
): FamilyMemberInput[] {
  const targetDefaults = TRANSLATIONS[targetLang].defaultMemberLabels;
  return members.map((member) => {
    const targetName = targetDefaults[member.id];
    if (!targetName) {
      return member;
    }
    const isDefaultInAnyLocale = SUPPORTED_LANGUAGES.some(
      (code) => TRANSLATIONS[code].defaultMemberLabels[member.id] === member.label,
    );
    return isDefaultInAnyLocale ? { ...member, label: targetName } : member;
  });
}

function isPlanBundle(value: unknown): value is PlanBundleResponse {
  const obj = typeof value === 'object' ? (value as Record<string, unknown> | null) : null;
  return Boolean(obj && 'telemetry' in obj && 'indoor' in obj && 'aiPlan' in obj);
}

async function fetchPlanBundle(
  payload: PlanRequestPayload,
  signal: AbortSignal,
): Promise<PlanBundleResponse | null> {
  const res = await fetch('/api/plan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal,
  });
  const data: unknown = res.ok ? await res.json() : null;
  return isPlanBundle(data) ? data : null;
}

function useHealthCapability(): {
  readonly liveGeminiConfigured: boolean;
  readonly groqConfigured: boolean;
  readonly telegramConfigured: boolean;
} {
  const [caps, setCaps] = useState({
    liveGeminiConfigured: false,
    groqConfigured: false,
    telegramConfigured: false,
  });

  useEffect(() => {
    void fetch('/api/health')
      .then((res) => (res.ok ? (res.json() as Promise<HealthPayload>) : null))
      .then((data) => {
        setCaps({
          liveGeminiConfigured: Boolean(data?.capabilities?.geminiConfigured),
          groqConfigured: Boolean(data?.capabilities?.groqConfigured),
          telegramConfigured: Boolean(data?.capabilities?.telegramConfigured),
        });
      })
      .catch(() => undefined);
  }, []);

  return caps;
}

function usePlanSynchronizer(setBundle: React.Dispatch<React.SetStateAction<PlanBundleResponse>>) {
  const [isLoadingPlan, setIsLoadingPlan] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const executePlanSync = useCallback(
    (nextInput: PlanRequestPayload): void => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setIsLoadingPlan(true);

      void fetchPlanBundle(nextInput, controller.signal)
        .then((serverBundle) => {
          if (serverBundle && !controller.signal.aborted) {
            setBundle(serverBundle);
          }
        })
        .catch(() => undefined)
        .finally(() => {
          if (!controller.signal.aborted) {
            setIsLoadingPlan(false);
          }
        });
    },
    [setBundle],
  );

  const schedulePlanSync = useCallback(
    (nextInput: PlanRequestPayload): void => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      debounceRef.current = setTimeout(() => {
        executePlanSync(nextInput);
      }, UI_TIMINGS.PLAN_DEBOUNCE_MS);
    },
    [executePlanSync],
  );

  const cancelPending = useCallback((): void => {
    abortRef.current?.abort();
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
  }, []);

  return { isLoadingPlan, executePlanSync, schedulePlanSync, cancelPending };
}

function useWorkspaceEffects(
  language: PlanRequestPayload['language'],
  executePlanSync: (nextInput: PlanRequestPayload) => void,
  cancelPending: () => void,
): void {
  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  useEffect(() => {
    executePlanSync(DEFAULT_WORKSPACE_INPUT);
    return cancelPending;
  }, [cancelPending, executePlanSync]);
}

function applyPatchToInput(
  prev: PlanRequestPayload,
  patch: Partial<PlanRequestPayload>,
): { readonly next: PlanRequestPayload; readonly languageChanged: boolean } {
  const languageChanged = patch.language !== undefined && patch.language !== prev.language;
  const nextMembers =
    languageChanged && patch.language
      ? localizeDefaultMembers(patch.members ?? prev.members, patch.language)
      : (patch.members ?? prev.members);
  return { next: { ...prev, ...patch, members: nextMembers }, languageChanged };
}

function useWorkspaceActions(
  input: PlanRequestPayload,
  setInput: React.Dispatch<React.SetStateAction<PlanRequestPayload>>,
  setBundle: React.Dispatch<React.SetStateAction<PlanBundleResponse>>,
  sync: ReturnType<typeof usePlanSynchronizer>,
) {
  const [gpsCity, setGpsCity] = useState<string | null>(null);

  const applyCityChoice = useCallback(
    (city: string, lat: number, lon: number, fromGps = false): void => {
      const next: PlanRequestPayload = {
        ...input,
        city,
        lat: quantizeCoord(lat),
        lon: quantizeCoord(lon),
      };
      setGpsCity(fromGps ? city : null);
      setInput(next);
      setBundle(buildInitialWorkspaceBundle(next));
      sync.cancelPending();
      sync.executePlanSync(next);
    },
    [input, setBundle, setInput, sync],
  );

  const updateInput = useCallback(
    (patch: Partial<PlanRequestPayload>): void => {
      setInput((prev) => {
        const { next, languageChanged } = applyPatchToInput(prev, patch);
        setBundle((cur) =>
          recomputeBundlePhysics(
            next,
            cur.telemetry,
            languageChanged ? undefined : { aiPlan: cur.aiPlan, aiMeta: cur.aiMeta },
          ),
        );
        if (languageChanged) {
          sync.cancelPending();
          sync.executePlanSync(next);
        } else {
          sync.schedulePlanSync(next);
        }
        return next;
      });
    },
    [setBundle, setInput, sync],
  );

  return { gpsCity, applyCityChoice, updateInput };
}

/**
 * Manages atmospheric telemetry, interactive household physics controls, and synchronized
 * grounded Gemini schedule refreshes with instant 60 FPS deterministic reactivity.
 */
export function useAirQualityWorkspace() {
  const [input, setInput] = useState<PlanRequestPayload>(DEFAULT_WORKSPACE_INPUT);
  const [bundle, setBundle] = useState<PlanBundleResponse>(() =>
    buildInitialWorkspaceBundle(DEFAULT_WORKSPACE_INPUT),
  );
  const { liveGeminiConfigured, groqConfigured, telegramConfigured } = useHealthCapability();
  const sync = usePlanSynchronizer(setBundle);

  useWorkspaceEffects(input.language, sync.executePlanSync, sync.cancelPending);
  const { gpsCity, applyCityChoice, updateInput } = useWorkspaceActions(
    input,
    setInput,
    setBundle,
    sync,
  );
  const selectCityFromGps = useCallback(
    (city: string, lat: number, lon: number): void => {
      applyCityChoice(city, lat, lon, true);
    },
    [applyCityChoice],
  );
  const { gpsStatus, requestGeolocation, resetGpsStatus } = useGeolocationAction(selectCityFromGps);

  const selectCity = useCallback(
    (city: string, lat: number, lon: number): void => {
      resetGpsStatus();
      applyCityChoice(city, lat, lon, false);
    },
    [applyCityChoice, resetGpsStatus],
  );

  return {
    input,
    bundle,
    liveGeminiConfigured,
    groqConfigured,
    telegramConfigured,
    isLoadingPlan: sync.isLoadingPlan,
    gpsStatus,
    gpsCity,
    updateInput,
    selectCity,
    requestGeolocation,
    refreshPlanNow: () => {
      sync.executePlanSync(input);
    },
  };
}
