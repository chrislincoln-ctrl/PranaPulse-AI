import { useCallback, useEffect, useRef, useState } from 'react';
import { UI_TIMINGS } from '../config/uiConstants.js';
import type { PlanBundleResponse } from '../domain/localBaseline.js';
import type { PlanRequestPayload } from '../validators/schemas.js';

interface HealthPayload {
  readonly capabilities?: {
    readonly geminiConfigured?: boolean;
    readonly groqConfigured?: boolean;
    readonly telegramConfigured?: boolean;
  };
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

/** Fetches server health capabilities (Gemini, Groq, Telegram) once on mount. */
export function useHealthCapability() {
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

/** Coordinates debounced and immediate `/api/plan` server fetches with abort cancellation. */
export function usePlanSynchronizer(
  setBundle: React.Dispatch<React.SetStateAction<PlanBundleResponse>>,
) {
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
      setIsLoadingPlan(true);
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
