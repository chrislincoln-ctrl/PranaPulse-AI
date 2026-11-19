import { useCallback, useState } from 'react';
import { UI_TIMINGS } from '../config/uiConstants.js';

export type GpsStatus = 'idle' | 'loading' | 'unavailable' | 'ip-fallback';

interface ServerLocationPayload {
  readonly city: string;
  readonly lat: number;
  readonly lon: number;
  readonly precision?: 'gps' | 'ip';
}

const GEO_PERMISSION_DENIED_CODE = 1;

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

async function fetchServerLocation(coords?: {
  readonly lat: number;
  readonly lon: number;
}): Promise<ServerLocationPayload | null> {
  const query = coords ? `?lat=${String(coords.lat)}&lon=${String(coords.lon)}` : '';
  try {
    const res = await fetch(`/api/locate${query}`);
    return res.ok ? parseServerLocation(await res.json()) : null;
  } catch {
    return null;
  }
}

function queryBrowserCoords(
  onCoords: (lat: number, lon: number) => void,
  onUnavailable: () => void,
): void {
  const onSuccess: PositionCallback = (pos) => {
    onCoords(pos.coords.latitude, pos.coords.longitude);
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

/**
 * Resolves high-accuracy device GPS coordinates + neighborhood name first, gracefully
 * retrying coarse Wi-Fi geolocation and finally server IP estimation when permission is blocked.
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

  const handleBrowserCoords = useCallback(
    (lat: number, lon: number): void => {
      void fetchServerLocation({ lat, lon }).then((loc) => {
        setGpsStatus('idle');
        selectCityFromGps(loc?.city ?? 'Local Area Monitor', lat, lon);
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
    queryBrowserCoords(handleBrowserCoords, fallbackToServerLocation);
  }, [fallbackToServerLocation, handleBrowserCoords]);

  const resetGpsStatus = useCallback((): void => {
    setGpsStatus('idle');
  }, []);

  return { gpsStatus, requestGeolocation, resetGpsStatus };
}
