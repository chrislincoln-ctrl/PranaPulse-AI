import { useCallback, useEffect, useState } from 'react';
import { DEFAULT_WORKSPACE_INPUT, SUPPORTED_LANGUAGES } from '../config/uiConstants.js';
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
import { useHealthCapability, usePlanSynchronizer } from './usePlanSynchronizer.js';
import { useWorkspaceSync } from './useWorkspaceSync.js';

export type { GpsStatus };

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
    const isDefault = SUPPORTED_LANGUAGES.some(
      (code) => TRANSLATIONS[code].defaultMemberLabels[member.id] === member.label,
    );
    return isDefault ? { ...member, label: targetName } : member;
  });
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

function applyRemoteState(
  prev: PlanRequestPayload,
  remote: PlanRequestPayload,
  setBundle: React.Dispatch<React.SetStateAction<PlanBundleResponse>>,
  sync: ReturnType<typeof usePlanSynchronizer>,
): PlanRequestPayload {
  const locChanged =
    prev.city !== remote.city || prev.lat !== remote.lat || prev.lon !== remote.lon;
  if (locChanged) {
    setBundle(buildInitialWorkspaceBundle(remote));
    sync.cancelPending();
    sync.executePlanSync(remote);
  } else {
    setBundle((cur) => recomputeBundlePhysics(remote, cur.telemetry));
    sync.schedulePlanSync(remote);
  }
  return remote;
}

function runUpdatedPlanSync(
  next: PlanRequestPayload,
  languageChanged: boolean,
  sync: ReturnType<typeof usePlanSynchronizer>,
): void {
  if (languageChanged) {
    sync.cancelPending();
    sync.executePlanSync(next);
  } else {
    sync.schedulePlanSync(next);
  }
}

function useWorkspaceActions(
  setInput: React.Dispatch<React.SetStateAction<PlanRequestPayload>>,
  setBundle: React.Dispatch<React.SetStateAction<PlanBundleResponse>>,
  sync: ReturnType<typeof usePlanSynchronizer>,
  pushWorkspace: (payload: PlanRequestPayload, immediate?: boolean) => void,
) {
  const [gpsCity, setGpsCity] = useState<string | null>(null);

  const applyCityChoice = useCallback(
    (city: string, lat: number, lon: number, fromGps = false): void => {
      setGpsCity(fromGps ? city : null);
      setInput((prev) => {
        const next: PlanRequestPayload = {
          ...prev,
          city,
          lat: quantizeCoord(lat),
          lon: quantizeCoord(lon),
        };
        setBundle(buildInitialWorkspaceBundle(next));
        sync.cancelPending();
        sync.executePlanSync(next);
        pushWorkspace(next, true);
        return next;
      });
    },
    [pushWorkspace, setBundle, setInput, sync],
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
        runUpdatedPlanSync(next, languageChanged, sync);
        pushWorkspace(next, false);
        return next;
      });
    },
    [pushWorkspace, setBundle, setInput, sync],
  );

  return { gpsCity, applyCityChoice, updateInput };
}

function useCityAndGpsHandlers(
  applyCityChoice: (city: string, lat: number, lon: number, fromGps?: boolean) => void,
) {
  const selectCityFromGps = useCallback(
    (city: string, lat: number, lon: number) => {
      applyCityChoice(city, lat, lon, true);
    },
    [applyCityChoice],
  );
  const { gpsStatus, requestGeolocation, resetGpsStatus } = useGeolocationAction(selectCityFromGps);
  const selectCity = useCallback(
    (city: string, lat: number, lon: number) => {
      resetGpsStatus();
      applyCityChoice(city, lat, lon, false);
    },
    [applyCityChoice, resetGpsStatus],
  );
  return { gpsStatus, requestGeolocation, selectCity };
}

/**
 * Manages atmospheric telemetry, interactive household physics controls, and synchronized
 * grounded Gemini + Telegram schedule refreshes with instant 60 FPS deterministic reactivity.
 */
export function useAirQualityWorkspace() {
  const [input, setInput] = useState<PlanRequestPayload>(DEFAULT_WORKSPACE_INPUT);
  const [bundle, setBundle] = useState<PlanBundleResponse>(() =>
    buildInitialWorkspaceBundle(DEFAULT_WORKSPACE_INPUT),
  );
  const caps = useHealthCapability();
  const sync = usePlanSynchronizer(setBundle);
  const applyRemote = useCallback(
    (remote: PlanRequestPayload) => {
      setInput((prev) => applyRemoteState(prev, remote, setBundle, sync));
    },
    [sync],
  );
  const remoteSync = useWorkspaceSync(applyRemote);
  useWorkspaceEffects(input.language, sync.executePlanSync, sync.cancelPending);
  const { gpsCity, applyCityChoice, updateInput } = useWorkspaceActions(
    setInput,
    setBundle,
    sync,
    remoteSync.pushWorkspace,
  );
  const { gpsStatus, requestGeolocation, selectCity } = useCityAndGpsHandlers(applyCityChoice);
  const refreshPlanNow = useCallback(() => {
    sync.executePlanSync(input);
  }, [input, sync]);

  return {
    input,
    bundle,
    ...caps,
    gpsStatus,
    gpsCity,
    updateInput,
    selectCity,
    requestGeolocation,
    refreshPlanNow,
    workspaceKey: remoteSync.workspaceKey,
    telegramLinked: remoteSync.telegramLinked,
    syncedFromTelegram: remoteSync.syncedFromTelegram,
    isLoadingPlan: sync.isLoadingPlan,
  };
}
