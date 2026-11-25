import { memo, useMemo, type ReactElement } from 'react';
import type { TelemetrySnapshot } from '../domain/localBaseline.js';
import type { useAirQualityWorkspace } from '../hooks/useAirQualityWorkspace.js';
import type { SupabaseAuthController } from '../hooks/useSupabaseAuth.js';
import type { LocaleDictionary } from '../i18n/translations.js';
import { ScrollGlobe } from './ui/landing-page.js';

export interface LandingPageViewProps {
  readonly workspace: ReturnType<typeof useAirQualityWorkspace>;
  readonly auth: SupabaseAuthController;
  readonly onEnterConsole: () => void;
  readonly t: LocaleDictionary;
}

function getHeroSection(
  telemetry: TelemetrySnapshot,
  onEnterConsole: () => void,
  t: LocaleDictionary,
) {
  const safeAqi = telemetry.stationCrossCheck.effectiveSafetyAqi;
  const pm25 = Math.round(telemetry.currentPollutants.pm25UgM3);
  const pbl = telemetry.inversion.currentPblMeters;
  const cityLabel = t.cityNames[telemetry.city] ?? telemetry.city;
  const copy = t.landing;

  return {
    id: 'hero',
    badge: copy.heroBadge,
    navLabel: `${copy.navGoToPrefix} ${copy.heroBadge}`,
    title: 'PranaPulse',
    subtitle: t.landingHeroHeadline,
    description: copy.heroDescription,
    align: 'left' as const,
    highlights: [
      `${copy.heroLivePrefix} ${cityLabel}: NAQI ${String(safeAqi)} · PM2.5 ${String(pm25)} ug/m3 · PBL ${String(pbl)}m`,
      ...copy.heroHighlights,
    ],
    actions: [
      {
        label: t.landingAuthGuestCta,
        variant: 'primary' as const,
        onClick: onEnterConsole,
      },
      {
        label: copy.heroSecondaryCta,
        variant: 'secondary' as const,
        onClick: () => {
          window.scrollTo({ top: window.innerHeight, behavior: 'smooth' });
        },
      },
    ],
  };
}

function getVerifiedDataSection(telemetry: TelemetrySnapshot, t: LocaleDictionary) {
  const safeAqi = telemetry.stationCrossCheck.effectiveSafetyAqi;
  const cat = t.cpcbCategories[telemetry.assessment.cpcbCategory];
  const epa = telemetry.assessment.usEpaAqi;
  const pbl = telemetry.inversion.currentPblMeters;
  const cityLabel = t.cityNames[telemetry.city] ?? telemetry.city;
  const copy = t.landing;

  return {
    id: 'telemetry',
    badge: copy.telemetryBadge,
    navLabel: `${copy.navGoToPrefix} ${copy.telemetryBadge}`,
    title: copy.telemetryTitle,
    subtitle: `${cityLabel} · CPCB NAQI ${String(safeAqi)} (${cat}) · US-EPA ${String(epa)} · PBL ${String(pbl)}m`,
    description: copy.telemetryDescription,
    align: 'center' as const,
    features: [...copy.telemetryFeatures],
  };
}

function getUspChannelsSection(t: LocaleDictionary) {
  const copy = t.landing;
  return {
    id: 'pillars',
    badge: copy.uspBadge,
    navLabel: `${copy.navGoToPrefix} ${copy.uspBadge}`,
    title: copy.uspTitle,
    subtitle: copy.uspSubtitle,
    description: copy.uspDescription,
    align: 'left' as const,
    features: [...copy.uspFeatures],
  };
}

function getGatewaySection(onEnterConsole: () => void, t: LocaleDictionary) {
  const copy = t.landing;
  const modulesSubtitle = [
    t.tabDashboard,
    t.tabRoutine,
    t.tabIndoor,
    t.tabCommute,
    t.tabGear,
    t.tabCommunity,
  ].join(' · ');

  return {
    id: 'console-gateway',
    badge: copy.gatewayBadge,
    navLabel: `${copy.navGoToPrefix} ${copy.gatewayBadge}`,
    title: t.landingBottomBannerTitle,
    subtitle: modulesSubtitle,
    description: copy.gatewayDescription,
    align: 'center' as const,
    highlights: [...copy.gatewayHighlights],
    actions: [
      {
        label: t.landingBottomBannerCta,
        variant: 'primary' as const,
        onClick: onEnterConsole,
      },
      {
        label: copy.gatewaySecondaryCta,
        variant: 'secondary' as const,
        onClick: () => {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        },
      },
    ],
  };
}

/**
 * Scroll-driven atmospheric intelligence landing page showcasing live verified APIs,
 * full Telegram remote control, Family Daily Companion Chat, WhatsApp briefs, and physics defense.
 */
export const LandingPageView = memo(function LandingPageView({
  workspace,
  onEnterConsole,
  t,
}: LandingPageViewProps): ReactElement {
  const telemetry = workspace.bundle.telemetry;
  const sections = useMemo(
    () => [
      getHeroSection(telemetry, onEnterConsole, t),
      getVerifiedDataSection(telemetry, t),
      getUspChannelsSection(t),
      getGatewaySection(onEnterConsole, t),
    ],
    [onEnterConsole, t, telemetry],
  );

  return (
    <main id="main-content" className="relative z-10 w-full">
      <ScrollGlobe sections={sections} className="bg-paper" />
    </main>
  );
});
