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
  return {
    id: 'hero',
    badge: 'Winter Smog Intelligence',
    title: 'PranaPulse',
    subtitle: t.landingHeroHeadline,
    description:
      'Hyper-local CPCB & US-EPA air intelligence fused with indoor CADR physics, low-exposure commute routing, Family Daily Companion Chat, 1-tap WhatsApp briefs, and full 2-way Telegram control.',
    align: 'left' as const,
    highlights: [
      `Live ${telemetry.city}: NAQI ${String(safeAqi)} · PM2.5 ${String(pm25)} ug/m3 · PBL ${String(pbl)}m`,
      'Full Site Control via Telegram',
      'Family Daily Companion Chat',
      '1-Tap WhatsApp Briefs',
    ],
    actions: [
      {
        label: t.landingAuthGuestCta,
        variant: 'primary' as const,
        onClick: onEnterConsole,
      },
      {
        label: 'See Verified APIs & USPs',
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
  return {
    id: 'telemetry',
    badge: 'Verified Real-Time APIs',
    title: 'Trusted Live Telemetry',
    subtitle: `${telemetry.city} · CPCB NAQI ${String(safeAqi)} (${cat}) · US-EPA ${String(epa)} · PBL ${String(pbl)}m`,
    description:
      'Zero guesswork or static mock data. Every reading cross-checks ground air monitors, atmospheric weather grids, and orbital fire satellites in real time — automatically applying conservative safety ceilings when local monitors spike.',
    align: 'center' as const,
    features: [
      {
        title: 'OpenAQ v3 & WAQI Ground Monitors',
        tag: 'openaq.org · aqicn.org',
        description:
          'Verified CPCB NAQI, US-EPA AQI, and 6-pollutant readings (PM2.5, PM10, NO2, O3, SO2, CO) with automatic station-vs-satellite cross-checks.',
      },
      {
        title: 'Open-Meteo Inversion & Dispersion',
        tag: 'open-meteo.com',
        description:
          '24-hour Planetary Boundary Layer (PBL) height, wind velocity, relative humidity, and exact safe midday window-airing intervals.',
      },
      {
        title: 'NASA FIRMS Satellite Plumes',
        tag: 'firms.modaps.eosdis.nasa.gov',
        description:
          'Live 500km orbital VIIRS/MODIS thermal anomaly & biomass-burning hotspot tracking feeding early winter-smog transport alerts.',
      },
      {
        title: 'OpenStreetMap GPS & Grounded AI',
        tag: 'openstreetmap.org · Gemini · Groq',
        description:
          'Street-level Nominatim GPS pinpointing paired with physics-grounded AI reasoning (all numbers anchored strictly to live sensors).',
      },
    ],
  };
}

function getUspChannelsSection() {
  return {
    id: 'pillars',
    badge: 'What Makes PranaPulse Different',
    title: 'One Brain, Every Channel',
    subtitle: 'Telegram Remote Control · Companion Chat · WhatsApp · Physics',
    description:
      'Most AQI apps stop at a passive number. PranaPulse turns live atmospheric science into 2-way daily protection across Web, Telegram, and WhatsApp — synced in real time.',
    align: 'left' as const,
    features: [
      {
        title: 'Operate the Entire Website via Telegram',
        tag: 'Two-Way Live Sync',
        description:
          'Control all 6 modules without opening a browser — check live air, drop GPS pins, edit room CADR, masks, commutes, RWA notices, or text schedule changes ("leaving at 10:20, returning at 11:41 pm") that auto-update the website + send 06:30 IST daily briefs.',
      },
      {
        title: 'Family Daily Companion Chat',
        tag: 'Always-On Floating AI',
        description:
          'Available in the bottom-right corner on every page — pick any family member (school child, senior with asthma, commuter), attach live GPS, ask naturally, and apply habit updates directly to their schedule.',
      },
      {
        title: '1-Tap WhatsApp Briefs & RWA Notices',
        tag: 'Instant Sharing',
        description:
          'Deliver personalized per-member morning defense plans and housing-society RWA collective impact bulletins directly into WhatsApp chats in English, हिन्दी, or தமிழ்.',
      },
      {
        title: 'Deterministic Exposure & CADR Physics',
        tag: 'Science-Backed',
        description:
          'Per-member inhaled PM2.5 dose budgets (ug/day & cigarette equivalents), 4.8 ACH HEPA & DIY Corsi-Rosenthal sizing, Pareto low-exposure commute routing, and matched mask/purifier buying links.',
      },
    ],
  };
}

function getGatewaySection(onEnterConsole: () => void, t: LocaleDictionary) {
  return {
    id: 'console-gateway',
    badge: '6-Module Interactive Workbench',
    title: t.landingBottomBannerTitle,
    subtitle: 'Dashboard · Family Routine · Indoor CADR · Commute · Gear · RWA',
    description:
      'Launch the interactive workbench to detect your live GPS air quality, customize every family member’s daily habits, chat with the Family Daily Companion, pair Telegram in 1 click, and share WhatsApp briefs.',
    align: 'center' as const,
    highlights: [
      '4 Live Telemetry & Satellite APIs',
      '2-Way Web ↔ Telegram Sync',
      'English · हिन्दी · தமிழ் · WCAG 2.2 AA',
    ],
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
      getUspChannelsSection(),
      getGatewaySection(onEnterConsole, t),
    ],
    [onEnterConsole, t, telemetry],
  );

  return (
    <main id="main-content" className="relative w-full">
      <ScrollGlobe sections={sections} className="bg-paper" />
    </main>
  );
});
