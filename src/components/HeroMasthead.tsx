import { Crosshair, Layers, ShieldCheck, Wind } from 'lucide-react';
import { type ReactElement } from 'react';
import { AQI_SPECTRUM_BANDS } from '../config/uiConstants.js';
import type { TelemetrySnapshot } from '../domain/localBaseline.js';
import type { CpcbCategory } from '../domain/types.js';
import type { LocaleDictionary } from '../i18n/translations.js';

export interface HeroMastheadProps {
  readonly telemetry: TelemetrySnapshot;
  readonly gpsCity: string | null;
  readonly t: LocaleDictionary;
}

function resolveBandDotTone(category: CpcbCategory): string {
  const match = AQI_SPECTRUM_BANDS.find((band) => band.key === category);
  return match?.tone ?? 'bg-band-moderate';
}

function splitHeadlineAccent(headline: string): {
  readonly leading: string;
  readonly accent: string;
} {
  const words = headline.trim().split(/\s+/);
  if (words.length <= 1) {
    return { leading: '', accent: headline };
  }
  const accent = words[words.length - 1] ?? '';
  return { leading: words.slice(0, -1).join(' '), accent };
}

function CornerReticles(): ReactElement {
  return (
    <>
      <span className="hero-corner hero-corner-tl" aria-hidden="true" />
      <span className="hero-corner hero-corner-tr" aria-hidden="true" />
      <span className="hero-corner hero-corner-bl" aria-hidden="true" />
      <span className="hero-corner hero-corner-br" aria-hidden="true" />
    </>
  );
}

function LiveTelemetryHudBadge({
  telemetry,
  t,
}: {
  readonly telemetry: TelemetrySnapshot;
  readonly t: LocaleDictionary;
}): ReactElement {
  const { assessment, isSimulatedFallback } = telemetry;
  const dotTone = resolveBandDotTone(assessment.cpcbCategory);
  const categoryLabel = t.cpcbCategories[assessment.cpcbCategory];

  return (
    <div className="hero-hud-badge">
      <span className="relative flex h-2 w-2 shrink-0" aria-hidden="true">
        <span className={`hud-pulse-ring ${dotTone}`} />
        <span className={`relative inline-flex h-2 w-2 rounded-full ${dotTone}`} />
      </span>
      <span className="measured text-[11px] font-semibold tracking-wider text-ink uppercase">
        {isSimulatedFallback ? 'Baseline Telemetry' : 'Live Telemetry'}
      </span>
      <span className="h-3 w-px bg-rule-2" aria-hidden="true" />
      <span className="measured text-[11px] font-medium text-ink-2">
        {categoryLabel} · {assessment.dominantCpcbPollutant.toUpperCase()}
      </span>
    </div>
  );
}

function CapabilityPills(): ReactElement {
  return (
    <div className="mt-3.5 flex flex-wrap gap-1.5" aria-hidden="true">
      <span className="hero-cap-chip measured">
        <Layers className="h-3 w-3 text-cool" />
        <span>PBL Inversion</span>
      </span>
      <span className="hero-cap-chip measured">
        <Wind className="h-3 w-3 text-accent" />
        <span>CADR Mass-Balance</span>
      </span>
      <span className="hero-cap-chip measured">
        <ShieldCheck className="h-3 w-3 text-ok" />
        <span>Pulmonary Dose</span>
      </span>
    </div>
  );
}

/**
 * 21st.dev-inspired atmospheric HUD masthead pairing Space Grotesk Variable display typography,
 * a diagonal light-leak gradient focal word, animated dot-grid backdrop, pulsing live AQI badge,
 * and monospace coordinate readout.
 */
export function HeroMasthead({ telemetry, gpsCity, t }: HeroMastheadProps): ReactElement {
  const cityLabel = t.cityNames[telemetry.city] ?? telemetry.city;
  const locationPrefix = gpsCity ? 'GPS' : cityLabel;
  const { leading, accent } = splitHeadlineAccent(t.heroHeadline);

  return (
    <div className="hero-masthead">
      <CornerReticles />
      <div className="relative z-10">
        <LiveTelemetryHudBadge telemetry={telemetry} t={t} />
        <h1 id="hero-heading" className="hero-headline mt-3 text-ink">
          {leading && <span>{leading} </span>}
          <span className="hero-light-leak">{accent}</span>
        </h1>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="hero-coord-chip measured">
            <Crosshair className="h-3 w-3 shrink-0 text-accent" aria-hidden="true" />
            <span>
              {locationPrefix} ({telemetry.lat}, {telemetry.lon}):
            </span>
          </span>
        </div>
        <p className="mt-2 max-w-[46ch] text-sm leading-relaxed text-ink-2 sm:text-[15px]">
          {t.heroLede}
        </p>
        <CapabilityPills />
      </div>
    </div>
  );
}
