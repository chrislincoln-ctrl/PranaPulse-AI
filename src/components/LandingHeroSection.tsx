import { Sparkles } from 'lucide-react';
import { memo, useState, type ReactElement } from 'react';
import type { InversionSimulationMode } from '../config/uiConstants.js';
import type { SupabaseAuthController } from '../hooks/useSupabaseAuth.js';
import type { LocaleDictionary } from '../i18n/translations.js';
import { LandingAccessGatewayCard } from './LandingAccessGatewayCard.js';
import { SmogAtmosphereCanvas } from './SmogAtmosphereCanvas.js';
import { SmogSimulationControl } from './SmogSimulationControl.js';
import { SmogSkylineFigure } from './SmogSkylineFigure.js';

export interface LandingHeroSectionProps {
  readonly auth: SupabaseAuthController;
  readonly onEnterConsole: () => void;
  readonly t: LocaleDictionary;
}

function SimulationViewport({
  mode,
}: {
  readonly mode: InversionSimulationMode;
}): ReactElement {
  return (
    <div className="relative h-60 w-full overflow-hidden rounded-xl border border-rule bg-slate-950 shadow-inner sm:h-72">
      <SmogAtmosphereCanvas mode={mode} />
      <SmogSkylineFigure mode={mode} />
    </div>
  );
}

function HeroHeader({ t }: { readonly t: LocaleDictionary }): ReactElement {
  return (
    <div className="space-y-2">
      <div className="inline-flex items-center gap-1.5 rounded-full border border-rule bg-paper-2 px-3 py-1 text-xs font-medium text-ink-2">
        <Sparkles className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
        <span>Winter Smog Telemetry &amp; Exposure Engine</span>
      </div>
      <h1 className="text-2xl font-black tracking-tight text-ink sm:text-3xl lg:text-4xl">
        {t.landingHeroHeadline}
      </h1>
      <p className="max-w-2xl text-sm leading-relaxed text-muted sm:text-base">
        {t.landingHeroLede}
      </p>
    </div>
  );
}

export const LandingHeroSection = memo(function LandingHeroSection({
  auth,
  onEnterConsole,
  t,
}: LandingHeroSectionProps): ReactElement {
  const [simMode, setSimMode] = useState<InversionSimulationMode>('severe');

  return (
    <section aria-label="Hero Overview" className="space-y-6 pt-4 pb-8 sm:pt-6">
      <HeroHeader t={t} />

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12 lg:gap-8">
        <div className="space-y-4 lg:col-span-7">
          <SimulationViewport mode={simMode} />
          <SmogSimulationControl
            mode={simMode}
            onToggleMode={setSimMode}
            t={t}
          />
        </div>

        <div className="lg:col-span-5">
          <LandingAccessGatewayCard
            auth={auth}
            onEnterConsole={onEnterConsole}
            t={t}
          />
        </div>
      </div>
    </section>
  );
});
