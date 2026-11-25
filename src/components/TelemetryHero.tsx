import { Activity, Clock, Droplets, Flame, ShieldCheck, Wind } from 'lucide-react';
import { memo, type ReactElement } from 'react';
import { PRECISION_DISPLAY, RADIAL_GAUGE_GEOMETRY } from '../config/uiConstants.js';
import type { TelemetrySnapshot } from '../domain/localBaseline.js';
import type { GpsStatus } from '../hooks/useAirQualityWorkspace.js';
import type { LocaleDictionary } from '../i18n/translations.js';
import { CitySearchControl } from './CitySearchControl.js';
import { HeroMasthead } from './HeroMasthead.js';
import { InversionChartSvg } from './InversionChartSvg.js';
import { PollutantBreakdownCard } from './PollutantBreakdownCard.js';
import { RadialGaugeSvg } from './RadialGaugeSvg.js';

export interface TelemetryHeroProps {
  readonly telemetry: TelemetrySnapshot;
  readonly gpsStatus: GpsStatus;
  readonly gpsCity: string | null;
  readonly onSelectCity: (city: string, lat: number, lon: number) => void;
  readonly onRequestGps: () => void;
  readonly t: LocaleDictionary;
}

export function getAqiToneClass(aqi: number): string {
  if (aqi >= PRECISION_DISPLAY.AQI_POOR_THRESHOLD) {
    return 'text-bad';
  }
  if (aqi >= PRECISION_DISPLAY.AQI_CAUTION_THRESHOLD) {
    return 'text-accent';
  }
  return 'text-ok';
}

function getAqiStrokeVar(aqi: number): string {
  if (aqi >= PRECISION_DISPLAY.AQI_POOR_THRESHOLD) {
    return 'var(--color-bad)';
  }
  if (aqi >= PRECISION_DISPLAY.AQI_CAUTION_THRESHOLD) {
    return 'var(--color-accent)';
  }
  return 'var(--color-ok)';
}

function resolvePlumeNote(telemetry: TelemetrySnapshot, t: LocaleDictionary): string {
  const baseNote = telemetry.firePlume.isSeasonalBaseline
    ? t.fireBaselineModelNote
    : t.fireHotspotsUnit;
  if (telemetry.stationName) {
    return `${baseNote} · ${t.stationCrossCheckLabel} ${telemetry.stationName}`;
  }
  return baseNote;
}

function PrimaryAqiPanels({
  telemetry,
  t,
}: {
  readonly telemetry: TelemetrySnapshot;
  readonly t: LocaleDictionary;
}): ReactElement {
  const { assessment, stationCrossCheck } = telemetry;
  const safeAqi = stationCrossCheck.effectiveSafetyAqi;
  const cpcbPct =
    (safeAqi / RADIAL_GAUGE_GEOMETRY.MAX_AQI_SCALE) * PRECISION_DISPLAY.PERCENT_MULTIPLIER;
  const epaPct =
    (assessment.usEpaAqi / RADIAL_GAUGE_GEOMETRY.MAX_AQI_SCALE) *
    PRECISION_DISPLAY.PERCENT_MULTIPLIER;

  return (
    <>
      <div className="panel flex flex-wrap items-center justify-between gap-2 sm:flex-nowrap">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-xs text-ink-2">
            <Activity className="h-3.5 w-3.5 text-cool" aria-hidden="true" />
            <span>{t.metricCpcbLabel}</span>
          </div>
          <div className={`measured mt-1 text-2xl font-semibold ${getAqiToneClass(safeAqi)}`}>
            {safeAqi}
          </div>
          <div className="mt-0.5 text-xs text-ink-2">
            {t.cpcbCategories[assessment.cpcbCategory]} ({assessment.dominantCpcbPollutant})
          </div>
        </div>
        <RadialGaugeSvg
          outerPercent={cpcbPct}
          outerColor={getAqiStrokeVar(safeAqi)}
          innerPercent={epaPct}
          innerColor="var(--color-cool)"
          centerText={String(safeAqi)}
          size={RADIAL_GAUGE_GEOMETRY.COMPACT_SIZE_PX}
        />
      </div>

      <div className="panel">
        <div className="text-xs text-ink-2">{t.metricUsEpaLabel}</div>
        <div className="measured mt-1 text-2xl font-semibold text-ink">{assessment.usEpaAqi}</div>
        <div className="mt-0.5 text-xs text-ink-2">
          <span className="measured">{assessment.who24hMultiple}</span>
          {t.whoMultipleUnit} / <span className="measured">{assessment.cigaretteEquivPerDay}</span>{' '}
          {t.cigarettesUnit}
        </div>
      </div>
    </>
  );
}

function AtmosphericStatusPanels({
  telemetry,
  t,
}: {
  readonly telemetry: TelemetrySnapshot;
  readonly t: LocaleDictionary;
}): ReactElement {
  const { inversion, firePlume } = telemetry;
  return (
    <>
      <div className="panel">
        <div className="flex items-center gap-1.5 text-xs text-ink-2">
          <Wind className="h-3.5 w-3.5 text-cool" aria-hidden="true" />
          <span>{t.metricPblLabel}</span>
        </div>
        <div className="measured mt-1 text-2xl font-semibold text-cool">
          {inversion.currentPblMeters} m
        </div>
        <div className="mt-0.5 text-xs text-ink-2">
          {inversion.openWindowsNow ? t.openWindowsYes : t.openWindowsNo}
        </div>
      </div>

      <div className="panel">
        <div className="flex items-center gap-1.5 text-xs text-ink-2">
          <Flame className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
          <span>{t.metricPlumeLabel}</span>
        </div>
        <div className="measured mt-1 text-2xl font-semibold text-ink">
          {firePlume.hotspots500km}
        </div>
        <div className="mt-0.5 text-xs text-ink-2">{resolvePlumeNote(telemetry, t)}</div>
      </div>
    </>
  );
}

const DEFAULT_WINDOW_HOUR = 13;

function formatBestWindowLabel(hours: readonly number[]): string {
  const first = hours[0] ?? DEFAULT_WINDOW_HOUR;
  const last = hours[hours.length - 1] ?? first;
  return hours.length === 0
    ? '13:00 - 15:00'
    : `${String(first).padStart(2, '0')}:00 - ${String(last).padStart(2, '0')}:59`;
}

function DispersionBriefCell({
  icon,
  label,
  value,
  valueTone,
  sub,
}: {
  readonly icon: ReactElement;
  readonly label: string;
  readonly value: string;
  readonly valueTone: string;
  readonly sub: string;
}): ReactElement {
  return (
    <div className="surface-recessed flex items-start gap-2.5 p-3">
      {icon}
      <div className="min-w-0">
        <div className="text-[11px] font-medium text-muted">{label}</div>
        <div className={`measured mt-0.5 text-sm font-semibold ${valueTone}`}>{value}</div>
        <div className="mt-0.5 text-[11px] text-ink-2">{sub}</div>
      </div>
    </div>
  );
}

function AtmosphericDispersionBrief({
  telemetry,
  t,
}: {
  readonly telemetry: TelemetrySnapshot;
  readonly t: LocaleDictionary;
}): ReactElement {
  const cur = telemetry.hourlySeries[0];
  const wind = Math.round(cur?.windKmh ?? 0);
  const rh = Math.round(cur?.rhPercent ?? 0);
  const windowLabel = formatBestWindowLabel(telemetry.inversion.bestWindowHours);
  const severityLabel = t.inversionSeverities[telemetry.inversion.currentSeverity];
  return (
    <div className="surface-hairline mt-4 grid grid-cols-1 gap-3 p-4 sm:grid-cols-3">
      <DispersionBriefCell
        icon={<Clock className="mt-0.5 h-4 w-4 shrink-0 text-ok" aria-hidden="true" />}
        label={t.ui.safestAiringWindowLabel}
        value={windowLabel}
        valueTone="text-ok"
        sub={telemetry.inversion.openWindowsNow ? t.openWindowsYes : t.openWindowsNo}
      />
      <DispersionBriefCell
        icon={<Droplets className="mt-0.5 h-4 w-4 shrink-0 text-cool" aria-hidden="true" />}
        label={t.ui.surfaceDispersionLabel}
        value={`${String(wind)} km/h · ${String(rh)}% RH`}
        valueTone="text-ink"
        sub={severityLabel}
      />
      <DispersionBriefCell
        icon={<ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden="true" />}
        label={t.ui.dominantPollutantLabel}
        value={telemetry.assessment.dominantCpcbPollutant}
        valueTone="text-accent uppercase"
        sub={
          telemetry.isSimulatedFallback ? t.ui.seasonalBaselineSub : t.ui.liveSensorCrossCheckSub
        }
      />
    </div>
  );
}

/**
 * Console atmospheric telemetry hero fitting cleanly above 1280x800 fold with severe-AQI
 * assertive alerts, 21st.dev concentric multi-ring radial gauge, 6-band CPCB spectrum, and 24h chart.
 */
export const TelemetryHero = memo(function TelemetryHero({
  telemetry,
  gpsStatus,
  gpsCity,
  onSelectCity,
  onRequestGps,
  t,
}: TelemetryHeroProps): ReactElement {
  return (
    <section aria-labelledby="hero-heading" className="hero-corridor">
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        <div className="min-w-0 lg:col-span-5">
          <HeroMasthead telemetry={telemetry} gpsCity={gpsCity} t={t} />
          <CitySearchControl
            activeCity={telemetry.city}
            gpsStatus={gpsStatus}
            gpsCity={gpsCity}
            onSelectCity={onSelectCity}
            onRequestGps={onRequestGps}
            t={t}
          />
          <PollutantBreakdownCard
            pollutants={telemetry.currentPollutants}
            activeCategory={telemetry.assessment.cpcbCategory}
            t={t}
          />
        </div>
        <div className="min-w-0 lg:col-span-7">
          <div className="panels mb-4">
            <PrimaryAqiPanels telemetry={telemetry} t={t} />
            <AtmosphericStatusPanels telemetry={telemetry} t={t} />
          </div>
          <InversionChartSvg
            hourlySeries={telemetry.hourlySeries}
            bestWindowHours={telemetry.inversion.bestWindowHours}
            t={t}
          />
          <AtmosphericDispersionBrief telemetry={telemetry} t={t} />
        </div>
      </div>
    </section>
  );
});
