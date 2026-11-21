import { memo, useMemo, type ReactElement } from 'react';
import { ScrollGlobe } from './ui/landing-page.js';
import type { useAirQualityWorkspace } from '../hooks/useAirQualityWorkspace.js';
import type { SupabaseAuthController } from '../hooks/useSupabaseAuth.js';
import type { LocaleDictionary } from '../i18n/translations.js';

export interface LandingPageViewProps {
  readonly workspace: ReturnType<typeof useAirQualityWorkspace>;
  readonly auth: SupabaseAuthController;
  readonly onEnterConsole: () => void;
  readonly t: LocaleDictionary;
}

function getHeroSection(onEnterConsole: () => void, t: LocaleDictionary) {
  return {
    id: 'hero',
    badge: 'Winter Smog AI',
    title: 'PranaPulse',
    subtitle: t.landingHeroHeadline,
    description: t.landingHeroLede,
    align: 'left' as const,
    actions: [
      {
        label: t.landingAuthGuestCta,
        variant: 'primary' as const,
        onClick: onEnterConsole,
      },
      {
        label: 'Explore Science',
        variant: 'secondary' as const,
        onClick: () => {
          window.scrollTo({ top: window.innerHeight, behavior: 'smooth' });
        },
      },
    ],
  };
}

function getTelemetrySection(city: string, aqi: number, pblMeters: number) {
  return {
    id: 'telemetry',
    badge: 'Inversion Physics',
    title: `${city} Trapping`,
    subtitle: `Current PBL: ${pblMeters.toString()}m | CPCB NAQI: ${aqi.toString()}`,
    description:
      'Ground cooling collapses the boundary layer under 300 meters, trapping particulates near the surface. Real-time telemetry tracks nocturnal inversions and surface thermal plumes.',
    align: 'center' as const,
    features: [
      {
        title: 'Planetary Boundary Layer Tracking',
        description: 'Continuous vertical mixing layer height and nocturnal thermal lid estimation.',
      },
      {
        title: 'Thermal Plume Detection',
        description: '500km regional satellite thermal anomaly and biomass emission surveillance.',
      },
    ],
  };
}

function getPillarsSection(t: LocaleDictionary) {
  return {
    id: 'pillars',
    badge: 'Exposure Defense',
    title: t.landingPillarsHeading,
    subtitle: 'Mass-Balance CADR & Route Modeling',
    description: t.landingPillarsSubheading,
    align: 'left' as const,
    features: [
      { title: t.landingPillarPblTitle, description: t.landingPillarPblDesc },
      { title: t.landingPillarCadrTitle, description: t.landingPillarCadrDesc },
      { title: t.landingPillarCommuteTitle, description: t.landingPillarCommuteDesc },
      { title: t.landingPillarFamilyTitle, description: t.landingPillarFamilyDesc },
    ],
  };
}

function getGatewaySection(onEnterConsole: () => void, t: LocaleDictionary) {
  return {
    id: 'console-gateway',
    badge: 'Clean Air Mission',
    title: t.landingBottomBannerTitle,
    subtitle: 'Real-Time Telemetry & Filtration Modeling',
    description:
      'Enter the workbench console to inspect verified OpenAQ and satellite telemetry, calculate exact room air changes, optimize commute routes, and build science-backed family schedules.',
    align: 'center' as const,
    actions: [
      {
        label: t.landingBottomBannerCta,
        variant: 'primary' as const,
        onClick: onEnterConsole,
      },
      {
        label: 'Return to Top',
        variant: 'secondary' as const,
        onClick: () => {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        },
      },
    ],
  };
}

/**
 * Premium scroll-driven atmospheric intelligence landing page powered by ScrollGlobe
 * with custom winter smog revolving orb and direct workbench console actions.
 */
export const LandingPageView = memo(function LandingPageView({
  workspace,
  onEnterConsole,
  t,
}: LandingPageViewProps): ReactElement {
  const telemetry = workspace.bundle.telemetry;
  const sections = useMemo(
    () => [
      getHeroSection(onEnterConsole, t),
      getTelemetrySection(
        telemetry.city,
        telemetry.assessment.cpcbNaqi,
        telemetry.inversion.currentPblMeters,
      ),
      getPillarsSection(t),
      getGatewaySection(onEnterConsole, t),
    ],
    [
      onEnterConsole,
      t,
      telemetry.city,
      telemetry.assessment.cpcbNaqi,
      telemetry.inversion.currentPblMeters,
    ],
  );

  return (
    <main id="main-content" className="relative w-full">
      <ScrollGlobe sections={sections} className="bg-paper" />
    </main>
  );
});
