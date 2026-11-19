import { useCallback, useState } from 'react';
import { UI_TIMINGS } from '../config/uiConstants.js';

export type GpsStatus = 'idle' | 'loading' | 'unavailable' | 'ip-fallback';

interface ServerLocationPayload {
  readonly city: string;
  readonly lat: number;
  readonly lon: number;
  readonly precision?: 'gps' | 'ip';
}

interface BrowserCoordsFix {
  readonly lat: number;
  readonly lon: number;
  readonly accuracy?: number | undefined;
}

const GEO_PERMISSION_DENIED_CODE = 1;
const PINPOINT_ACCURACY_METERS = 100;
const WATCH_REFINE_WINDOW_MS = 2_500;

function hasValidLocationFields(obj: Record<string, unknown>): obj is {
  city: string;
  lat: number;
  lon: number;
  precision?: unknown;
} {
  return typeof obj.city === 'string' && typeof obj.lat === 'number' && typeof obj.lon === 'number';
}

function parseServerLocation(raw: unknown): ServerLocationPayload | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  const obj = raw as Record<string, unknown>;
  if (!hasValidLocationFields(obj)) {
    return null;
  }
  const precision = obj.precision === 'gps' || obj.precision === 'ip' ? obj.precision : undefined;
  return { city: obj.city, lat: obj.lat, lon: obj.lon, ...(precision ? { precision } : {}) };
}

function buildLocateQuery(coords?: BrowserCoordsFix): string {
  if (!coords) {
    return '';
  }
  const base = `?lat=${String(coords.lat)}&lon=${String(coords.lon)}`;
  if (
    typeof coords.accuracy === 'number' &&
    Number.isFinite(coords.accuracy) &&
    coords.accuracy > 0
  ) {
    return `${base}&accuracy=${String(Math.round(coords.accuracy))}`;
  }
  return base;
}

async function fetchServerLocation(
  coords?: BrowserCoordsFix,
): Promise<ServerLocationPayload | null> {
  try {
    const res = await fetch(`/api/locate${buildLocateQuery(coords)}`);
    return res.ok ? parseServerLocation(await res.json()) : null;
  } catch {
    return null;
  }
}

function extractFix(pos: GeolocationPosition): BrowserCoordsFix {
  const accuracy = pos.coords.accuracy;
  return {
    lat: pos.coords.latitude,
    lon: pos.coords.longitude,
    ...(typeof accuracy === 'number' && Number.isFinite(accuracy) ? { accuracy } : {}),
  };
}

function queryWithGetCurrentPosition(
  onFix: (fix: BrowserCoordsFix) => void,
  onUnavailable: () => void,
): void {
  const onSuccess: PositionCallback = (pos) => {
    onFix(extractFix(pos));
  };
  const onHighAccuracyFail: PositionErrorCallback = (err) => {
    if (err.code === GEO_PERMISSION_DENIED_CODE) {
      onUnavailable();
      return;
    }
    navigator.geolocation.getCurrentPosition(onSuccess, onUnavailable, {
      enableHighAccuracy: false,
      timeout: UI_TIMINGS.GEOLOCATION_TIMEOUT_MS,
      maximumAge: UI_TIMINGS.GEOLOCATION_MAX_AGE_MS,
    });
  };
  navigator.geolocation.getCurrentPosition(onSuccess, onHighAccuracyFail, {
    enableHighAccuracy: true,
    timeout: UI_TIMINGS.GEOLOCATION_HIGH_ACCURACY_TIMEOUT_MS,
    maximumAge: 0,
  });
}

function isSharperFix(next: BrowserCoordsFix, prev: BrowserCoordsFix | null): boolean {
  return !prev || (next.accuracy ?? Infinity) < (prev.accuracy ?? Infinity);
}

interface WatchSession {
  bestFix: BrowserCoordsFix | null;
  settled: boolean;
  refineTimer: ReturnType<typeof setTimeout> | null;
  watchId: number;
}

function stopWatchSession(session: WatchSession): void {
  session.settled = true;
  if (session.refineTimer !== null) {
    clearTimeout(session.refineTimer);
  }
  navigator.geolocation.clearWatch(session.watchId);
}

function queryWithWatchRefinement(
  onFix: (fix: BrowserCoordsFix) => void,
  onUnavailable: () => void,
): void {
  const session: WatchSession = { bestFix: null, settled: false, refineTimer: null, watchId: 0 };
  const finish = (fix: BrowserCoordsFix | null): void => {
    if (session.settled) {
      return;
    }
    stopWatchSession(session);
    if (fix) {
      onFix(fix);
    } else {
      onUnavailable();
    }
  };
  const onReading: PositionCallback = (pos) => {
    const fix = extractFix(pos);
    if (isSharperFix(fix, session.bestFix)) {
      session.bestFix = fix;
    }
    if ((fix.accuracy ?? Infinity) <= PINPOINT_ACCURACY_METERS) {
      finish(fix);
      return;
    }
    session.refineTimer ??= setTimeout(() => {
      finish(session.bestFix);
    }, WATCH_REFINE_WINDOW_MS);
  };
  const onWatchError: PositionErrorCallback = (err) => {
    if (session.bestFix || err.code === GEO_PERMISSION_DENIED_CODE) {
      finish(session.bestFix);
    } else {
      stopWatchSession(session);
      queryWithGetCurrentPosition(onFix, onUnavailable);
    }
  };
  session.watchId = navigator.geolocation.watchPosition(onReading, onWatchError, {
    enableHighAccuracy: true,
    timeout: UI_TIMINGS.GEOLOCATION_HIGH_ACCURACY_TIMEOUT_MS,
    maximumAge: 0,
  });
}

/**
 * Resolves high-accuracy device GPS coordinates + accuracy-aware locality label, refining
 * initial coarse readings via `watchPosition` and gracefully falling back to server IP geolocation.
 */
export function useGeolocationAction(
  selectCityFromGps: (city: string, lat: number, lon: number) => void,
) {
  const [gpsStatus, setGpsStatus] = useState<GpsStatus>('idle');

  const fallbackToServerLocation = useCallback((): void => {
    void fetchServerLocation().then((loc) => {
      if (!loc) {
        setGpsStatus('unavailable');
        return;
      }
      setGpsStatus(loc.precision === 'ip' ? 'ip-fallback' : 'idle');
      selectCityFromGps(loc.city, loc.lat, loc.lon);
    });
  }, [selectCityFromGps]);

  const handleBrowserFix = useCallback(
    (fix: BrowserCoordsFix): void => {
      void fetchServerLocation(fix).then((loc) => {
        setGpsStatus(loc?.precision === 'ip' ? 'ip-fallback' : 'idle');
        selectCityFromGps(loc?.city ?? 'Local Area Monitor', fix.lat, fix.lon);
      });
    },
    [selectCityFromGps],
  );

  const requestGeolocation = useCallback((): void => {
    setGpsStatus('loading');
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      fallbackToServerLocation();
      return;
    }
    if (typeof navigator.geolocation.watchPosition === 'function') {
      queryWithWatchRefinement(handleBrowserFix, fallbackToServerLocation);
      return;
    }
    queryWithGetCurrentPosition(handleBrowserFix, fallbackToServerLocation);
  }, [fallbackToServerLocation, handleBrowserFix]);

  const resetGpsStatus = useCallback((): void => {
    setGpsStatus('idle');
  }, []);

  return { gpsStatus, requestGeolocation, resetGpsStatus };
}
