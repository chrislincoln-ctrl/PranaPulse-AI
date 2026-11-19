import { type ReactElement } from 'react';
import {
  AQI_SPECTRUM_BANDS,
  POLLUTANT_SAFE_CEILINGS,
  PRECISION_DISPLAY,
} from '../config/uiConstants.js';
import { evaluatePollutantCategories } from '../domain/aqiStandards.js';
import type { CpcbCategory, PollutantKey, PollutantReadingInput } from '../domain/types.js';
import type { LocaleDictionary } from '../i18n/translations.js';

function computeBarPercent(value: number, ceiling: number): number {
  const raw = Math.round((value / ceiling) * PRECISION_DISPLAY.PERCENT_MULTIPLIER);
  return Math.max(
    POLLUTANT_SAFE_CEILINGS.MIN_BAR_PCT,
    Math.min(PRECISION_DISPLAY.PERCENT_MULTIPLIER, raw),
  );
}

function resolveBandTone(category: CpcbCategory): string {
  const match = AQI_SPECTRUM_BANDS.find((band) => band.key === category);
  return match?.tone ?? 'bg-band-moderate';
}

function SpectrumBandCell({
  tone,
  border,
  label,
  isCurrent,
}: {
  readonly tone: string;
  readonly border: string;
  readonly label: string;
  readonly isCurrent: boolean;
}): ReactElement {
  return (
    <div
      className={`min-w-0 rounded border px-2 py-1.5 ${
        isCurrent ? `${border} bg-paper-3` : 'border-rule bg-paper-2'
      }`}
    >
      <div className={`h-2 w-full rounded-full ${tone}`} />
      <div className="mt-1 flex items-center justify-center gap-1.5 text-xs">
        {isCurrent && <span className={`inline-block h-1.5 w-1.5 rounded-full ${tone}`} />}
        <span className={isCurrent ? 'font-semibold text-ink' : 'font-medium text-ink-2'}>
          {label}
        </span>
      </div>
    </div>
  );
}

function AqiSpectrumBar({
  activeCategory,
  caption,
  t,
}: {
  readonly activeCategory: CpcbCategory;
  readonly caption: string;
  readonly t: LocaleDictionary;
}): ReactElement {
  return (
    <div className="mb-3 border-b border-rule pb-2.5">
      <div className="mb-1.5 flex items-center justify-between text-xs">
        <span className="font-medium text-ink-2">{caption}</span>
        <span className="measured font-semibold text-ink">{t.cpcbCategories[activeCategory]}</span>
      </div>
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
        {AQI_SPECTRUM_BANDS.map((band) => (
          <SpectrumBandCell
            key={band.key}
            tone={band.tone}
            border={band.border}
            label={t.cpcbCategories[band.key]}
            isCurrent={band.key === activeCategory}
          />
        ))}
      </div>
    </div>
  );
}

function buildPollutantRows(pollutants: PollutantReadingInput): readonly {
  key: PollutantKey;
  label: string;
  val: number;
  max: number;
}[] {
  return [
    { key: 'pm25', label: 'PM2.5', val: pollutants.pm25UgM3, max: POLLUTANT_SAFE_CEILINGS.PM25 },
    { key: 'pm10', label: 'PM10', val: pollutants.pm10UgM3, max: POLLUTANT_SAFE_CEILINGS.PM10 },
    { key: 'no2', label: 'NO2', val: pollutants.no2UgM3, max: POLLUTANT_SAFE_CEILINGS.NO2 },
    { key: 'o3', label: 'O3', val: pollutants.o3UgM3, max: POLLUTANT_SAFE_CEILINGS.O3 },
    { key: 'so2', label: 'SO2', val: pollutants.so2UgM3, max: POLLUTANT_SAFE_CEILINGS.SO2 },
    { key: 'co', label: 'CO', val: pollutants.coUgM3, max: POLLUTANT_SAFE_CEILINGS.CO },
  ];
}

/**
 * 21st.dev Analytics Bento card uniting the 6 named CPCB NAQI severity bands
 * (without confusing raw index ranges) and live 6-pollutant progress bars where each
 * pollutant is colored and tagged by its own regulatory CPCB breakpoint threshold.
 */
export function PollutantBreakdownCard({
  pollutants,
  activeCategory,
  t,
}: {
  readonly pollutants: PollutantReadingInput;
  readonly activeCategory: CpcbCategory;
  readonly t: LocaleDictionary;
}): ReactElement {
  const categories = evaluatePollutantCategories(pollutants);
  const items = buildPollutantRows(pollutants);

  return (
    <div className="surface-hairline mt-3 p-3">
      <AqiSpectrumBar activeCategory={activeCategory} caption={t.aqiScaleCaption} t={t} />
      <div className="mb-1.5 text-xs font-medium text-ink-2">{t.pollutantBreakdownHeading}</div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 sm:grid-cols-3">
        {items.map((item) => {
          const info = categories[item.key];
          const tone = resolveBandTone(info.category);
          return (
            <div key={item.label} className="min-w-0">
              <div className="flex items-baseline justify-between gap-1 text-xs">
                <span className="font-medium text-ink">{item.label}</span>
                <span className="measured text-ink-2">{Math.round(item.val)}</span>
              </div>
              <div className="pollutant-track mt-1">
                <div
                  className={`pollutant-fill ${tone}`}
                  style={{ width: `${String(computeBarPercent(item.val, item.max))}%` }}
                />
              </div>
              <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-ink-2">
                <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${tone}`} />
                <span className="truncate">{t.cpcbCategories[info.category]}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
