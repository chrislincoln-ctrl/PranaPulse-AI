import { useEffect, useState } from 'react';
import { UI_TIMINGS } from '../config/uiConstants.js';

export interface GeocodedOption {
  readonly name: string;
  readonly region: string;
  readonly countryCode: string;
  readonly lat: number;
  readonly lon: number;
}

/**
 * Queries `/api/geocode` with debouncing and AbortController cleanup when the user types >= 2 chars.
 */
export function useDebouncedGeocode(query: string): readonly GeocodedOption[] {
  const [results, setResults] = useState<readonly GeocodedOption[]>([]);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < UI_TIMINGS.MIN_SEARCH_CHARS) {
      setResults([]);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      void fetch(`/api/geocode?q=${encodeURIComponent(trimmed)}`, { signal: controller.signal })
        .then((res) => (res.ok ? (res.json() as Promise<{ locations?: GeocodedOption[] }>) : null))
        .then((data) => {
          if (!controller.signal.aborted && data?.locations) {
            setResults(data.locations);
          }
        })
        .catch(() => undefined);
    }, UI_TIMINGS.GEOCODE_DEBOUNCE_MS);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [query]);

  return results;
}

/**
 * Manages combobox query, dropdown visibility, debounced lookup, and GPS label sync.
 */
export function useCitySearchState(
  gpsCity: string | null,
  onSelectCity: (city: string, lat: number, lon: number) => void,
) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const options = useDebouncedGeocode(query);

  useEffect(() => {
    if (gpsCity) {
      setQuery(gpsCity);
      setOpen(false);
    }
  }, [gpsCity]);

  const pickCity = (city: string, lat: number, lon: number): void => {
    onSelectCity(city, lat, lon);
    setQuery('');
    setOpen(false);
  };

  return {
    query,
    options,
    showList: open && options.length > 0,
    onQueryChange: (nextQuery: string): void => {
      setQuery(nextQuery);
      setOpen(true);
    },
    onFocusInput: (): void => {
      setOpen(true);
    },
    pickCity,
  };
}
