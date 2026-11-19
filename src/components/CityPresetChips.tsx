import { type ReactElement } from 'react';
import { CITY_PRESETS } from '../config/constants.js';
import type { LocaleDictionary } from '../i18n/translations.js';

const PRESET_COUNT = 6;

/**
 * Curated winter-smog and clean-benchmark city preset selector strip.
 */
export function CityPresetChips({
  activeCity,
  onSelectCity,
  t,
}: {
  readonly activeCity: string;
  readonly onSelectCity: (city: string, lat: number, lon: number) => void;
  readonly t: LocaleDictionary;
}): ReactElement {
  return (
    <div className="mt-3 flex flex-wrap gap-2" aria-label={t.quickCitiesHeading}>
      {CITY_PRESETS.slice(0, PRESET_COUNT).map((preset) => {
        const isCurrent = preset.name.toLowerCase() === activeCity.toLowerCase();
        const displayCity = t.cityNames[preset.name] ?? preset.name;
        return (
          <button
            key={preset.id}
            type="button"
            onClick={() => {
              onSelectCity(preset.name, preset.lat, preset.lon);
            }}
            aria-pressed={isCurrent}
            className={
              isCurrent ? 'btn-primary touch-target text-sm' : 'btn-secondary touch-target text-sm'
            }
          >
            {displayCity}
          </button>
        );
      })}
    </div>
  );
}
