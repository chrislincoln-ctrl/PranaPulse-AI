import { ArrowRight, Flame, Shield, Wind } from 'lucide-react';
import { memo, type ReactElement } from 'react';
import type { useAirQualityWorkspace } from '../hooks/useAirQualityWorkspace.js';
import type { SupabaseAuthController } from '../hooks/useSupabaseAuth.js';
import type { LocaleDictionary } from '../i18n/translations.js';
import { LandingHeroSection } from './LandingHeroSection.js';
import { LandingPillarsGrid } from './LandingPillarsGrid.js';

export interface LandingPageViewProps {
  readonly workspace: ReturnType<typeof useAirQualityWorkspace>;
  readonly auth: SupabaseAuthController;
  readonly onEnterConsole: () => void;
  readonly t: LocaleDictionary;
}

function LiveCityStrip({
  city,
  aqi,
  pblMeters,
  onEnterConsole,
}: {
  readonly city: string;
  readonly aqi: number;
  readonly pblMeters: number;
  readonly onEnterConsole: () => void;
}): ReactElement {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-accent/30 bg-accent/5 p-4 sm:p-5">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/15 text-accent-ink">
          <Flame className="h-5 w-5" aria-hidden="true" />
        </div>
        <div>
          <p className="text-xs uppercase tracking-wider text-muted">
            Live Station Telemetry
          </p>
          <p className="text-sm font-bold text-ink sm:text-base">
            {city}: CPCB NAQI <span className="text-warn">{aqi.toString()}</span> • PBL{' '}
            <span className="font-mono">{pblMeters.toString()} m</span>
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={onEnterConsole}
        className="btn-secondary touch-target inline-flex items-center gap-2 text-xs font-semibold"
      >
        <span>Open Station Deep-Dive</span>
        <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </div>
  );
}

function LandingBottomCtaBanner({
  title,
  ctaLabel,
  onEnterConsole,
}: {
  readonly title: string;
  readonly ctaLabel: string;
  readonly onEnterConsole: () => void;
}): ReactElement {
  return (
    <section
      aria-label="Action Call"
      className="card flex flex-col items-center justify-between gap-4 border border-rule bg-paper-3 p-6 text-center sm:flex-row sm:text-left"
    >
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-cool/10 text-cool">
          <Wind className="h-5 w-5" aria-hidden="true" />
        </div>
        <div>
          <h3 className="text-base font-bold text-ink">{title}</h3>
          <p className="text-xs text-muted">
            Physics-grounded CADR, route, and family risk management.
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={onEnterConsole}
        className="btn-primary touch-target inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold"
      >
        <Shield className="h-4 w-4" aria-hidden="true" />
        <span>{ctaLabel}</span>
      </button>
    </section>
  );
}

export const LandingPageView = memo(function LandingPageView({
  workspace,
  auth,
  onEnterConsole,
  t,
}: LandingPageViewProps): ReactElement {
  const telemetry = workspace.bundle.telemetry;

  return (
    <main id="main-content" className="container flex-1 space-y-8 pb-16">
      <LandingHeroSection
        auth={auth}
        onEnterConsole={onEnterConsole}
        t={t}
      />

      <LiveCityStrip
        city={telemetry.city}
        aqi={telemetry.assessment.cpcbNaqi}
        pblMeters={telemetry.inversion.currentPblMeters}
        onEnterConsole={onEnterConsole}
      />

      <LandingPillarsGrid t={t} />

      <LandingBottomCtaBanner
        title={t.landingBottomBannerTitle}
        ctaLabel={t.landingBottomBannerCta}
        onEnterConsole={onEnterConsole}
      />
    </main>
  );
});
