import { MapPin, Search } from 'lucide-react';
import { memo, useId, type ReactElement } from 'react';
import type { GpsStatus } from '../hooks/useAirQualityWorkspace.js';
import { useCitySearchState, type GeocodedOption } from '../hooks/useDebouncedGeocode.js';
import type { LocaleDictionary } from '../i18n/translations.js';
import { CityPresetChips } from './CityPresetChips.js';

export type { GeocodedOption };

export interface CitySearchControlProps {
  readonly activeCity: string;
  readonly gpsStatus: GpsStatus;
  readonly gpsCity: string | null;
  readonly onSelectCity: (city: string, lat: number, lon: number) => void;
  readonly onRequestGps: () => void;
  readonly t: LocaleDictionary;
}

function SearchResultsList({
  listId,
  options,
  onPick,
}: {
  readonly listId: string;
  readonly options: readonly GeocodedOption[];
  readonly onPick: (opt: GeocodedOption) => void;
}): ReactElement {
  return (
    <div
      id={listId}
      role="listbox"
      className="surface-recessed absolute z-50 mt-1 max-h-56 w-full overflow-y-auto p-1"
    >
      {options.map((opt) => (
        <button
          key={`${opt.name}-${String(opt.lat)}-${String(opt.lon)}`}
          type="button"
          role="option"
          aria-selected={false}
          onClick={() => {
            onPick(opt);
          }}
          className="touch-target flex w-full items-center justify-between rounded px-3 py-2 text-left text-sm text-ink hover:bg-paper-2"
        >
          <span>
            {opt.name} ({opt.region})
          </span>
          <span className="measured text-xs text-muted">{opt.countryCode}</span>
        </button>
      ))}
    </div>
  );
}

function GpsLookupButton({
  gpsStatus,
  onRequestGps,
  t,
}: {
  readonly gpsStatus: GpsStatus;
  readonly onRequestGps: () => void;
  readonly t: LocaleDictionary;
}): ReactElement {
  return (
    <button
      type="button"
      onClick={onRequestGps}
      disabled={gpsStatus === 'loading'}
      className="btn-secondary touch-target inline-flex items-center justify-center gap-2 text-sm"
    >
      <MapPin className="h-4 w-4 text-accent" aria-hidden="true" />
      <span>{gpsStatus === 'loading' ? t.gpsLoading : t.useGpsButton}</span>
    </button>
  );
}

function CityComboboxField({
  inputId,
  listId,
  query,
  showList,
  onQueryChange,
  onFocusInput,
  t,
}: {
  readonly inputId: string;
  readonly listId: string;
  readonly query: string;
  readonly showList: boolean;
  readonly onQueryChange: (nextQuery: string) => void;
  readonly onFocusInput: () => void;
  readonly t: LocaleDictionary;
}): ReactElement {
  return (
    <div className="min-w-0 flex-1">
      <label htmlFor={inputId} className="mb-1 block text-sm text-ink-2">
        {t.citySearchLabel}
      </label>
      <div className="relative">
        <Search
          className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted"
          aria-hidden="true"
        />
        <input
          id={inputId}
          type="search"
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          value={query}
          placeholder={t.citySearchPlaceholder}
          onFocus={onFocusInput}
          onChange={(e) => {
            onQueryChange(e.target.value);
          }}
          className="field-control pl-9 text-sm"
        />
      </div>
    </div>
  );
}

function SearchInputRow(props: {
  readonly inputId: string;
  readonly listId: string;
  readonly query: string;
  readonly showList: boolean;
  readonly gpsStatus: GpsStatus;
  readonly onQueryChange: (nextQuery: string) => void;
  readonly onFocusInput: () => void;
  readonly onRequestGps: () => void;
  readonly t: LocaleDictionary;
}): ReactElement {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
      <CityComboboxField {...props} />
      <GpsLookupButton gpsStatus={props.gpsStatus} onRequestGps={props.onRequestGps} t={props.t} />
    </div>
  );
}

function SearchDropdownZone({
  showList,
  gpsStatus,
  listId,
  options,
  onPick,
  t,
}: {
  readonly showList: boolean;
  readonly gpsStatus: GpsStatus;
  readonly listId: string;
  readonly options: readonly GeocodedOption[];
  readonly onPick: (opt: GeocodedOption) => void;
  readonly t: LocaleDictionary;
}): ReactElement {
  return (
    <>
      {gpsStatus === 'unavailable' && (
        <p role="status" className="mt-2 text-sm text-bad">
          {t.gpsUnavailable}
        </p>
      )}
      {gpsStatus === 'ip-fallback' && (
        <p role="status" className="mt-2 text-xs text-accent">
          {t.gpsIpFallbackNote}
        </p>
      )}
      {showList && <SearchResultsList listId={listId} options={options} onPick={onPick} />}
    </>
  );
}

function SearchControlsWrapper({
  activeCity,
  gpsStatus,
  gpsCity,
  onSelectCity,
  onRequestGps,
  t,
}: CitySearchControlProps): ReactElement {
  const inputId = useId();
  const listId = useId();
  const search = useCitySearchState(gpsCity, onSelectCity);

  return (
    <div className="relative mt-4">
      <SearchInputRow
        inputId={inputId}
        listId={listId}
        query={search.query}
        showList={search.showList}
        gpsStatus={gpsStatus}
        onQueryChange={search.onQueryChange}
        onFocusInput={search.onFocusInput}
        onRequestGps={onRequestGps}
        t={t}
      />
      <SearchDropdownZone
        showList={search.showList}
        gpsStatus={gpsStatus}
        listId={listId}
        options={search.options}
        onPick={(opt) => {
          search.pickCity(opt.name, opt.lat, opt.lon);
        }}
        t={t}
      />
      <CityPresetChips activeCity={activeCity} onSelectCity={search.pickCity} t={t} />
    </div>
  );
}

/**
 * Location search combobox with debounced Open-Meteo geocoding, privacy-quantized GPS lookup,
 * and instant winter-smog metro presets.
 */
export const CitySearchControl = memo(function CitySearchControl(
  props: CitySearchControlProps,
): ReactElement {
  return <SearchControlsWrapper {...props} />;
});
