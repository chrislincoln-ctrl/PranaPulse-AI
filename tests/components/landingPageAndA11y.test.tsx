import { act, fireEvent, render, screen } from '@testing-library/react';
import axe from 'axe-core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LandingPageView } from '../../src/components/LandingPageView.js';
import { DEFAULT_WORKSPACE_INPUT } from '../../src/config/uiConstants.js';
import { buildInitialWorkspaceBundle } from '../../src/domain/localBaseline.js';
import type { useAirQualityWorkspace } from '../../src/hooks/useAirQualityWorkspace.js';
import type { SupabaseAuthController } from '../../src/hooks/useSupabaseAuth.js';
import { TRANSLATIONS } from '../../src/i18n/translations.js';
import { deriveOutdoorHoursFromTimes } from '../../src/utils/inputSanitizer.js';

function createMockWorkspace(): ReturnType<typeof useAirQualityWorkspace> {
  return {
    input: DEFAULT_WORKSPACE_INPUT,
    bundle: buildInitialWorkspaceBundle(DEFAULT_WORKSPACE_INPUT),
    liveGeminiConfigured: true,
    groqConfigured: true,
    telegramConfigured: true,
    gpsStatus: 'idle',
    gpsCity: null,
    updateInput: vi.fn(),
    selectCity: vi.fn(),
    requestGeolocation: vi.fn(),
    refreshPlanNow: vi.fn(),
    workspaceKey: 'wtest001',
    telegramLinked: false,
    syncedFromTelegram: false,
    isLoadingPlan: false,
  };
}

function createMockAuth(): SupabaseAuthController {
  return {
    isConfigured: false,
    isInitializing: false,
    user: null,
    busy: false,
    errorMessage: null,
    noticeMessage: null,
    syncStatus: 'idle',
    lastSavedAt: null,
    clearMessages: vi.fn(),
    signIn: vi.fn(() => Promise.resolve(false)),
    signInWithGoogle: vi.fn(() => Promise.resolve(false)),
    signUp: vi.fn(() => Promise.resolve(false)),
    resetPassword: vi.fn(() => Promise.resolve(false)),
    signOut: vi.fn(() => Promise.resolve()),
    savePreferences: vi.fn(() => Promise.resolve(false)),
  };
}

describe('Landing Page showcase, WCAG 2.2 AA accessibility & outdoor duration derivation', () => {
  afterEach(() => {
    delete document.documentElement.dataset.mode;
    vi.restoreAllMocks();
  });

  it('renders all 4 landing sections with verified APIs, USPs, CTA triggers & zero axe violations in Light/Dark modes', async () => {
    const onEnterConsole = vi.fn();
    document.documentElement.dataset.mode = 'light';

    const { container } = render(
      <LandingPageView
        workspace={createMockWorkspace()}
        auth={createMockAuth()}
        onEnterConsole={onEnterConsole}
        t={TRANSLATIONS.en}
      />,
    );

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/PranaPulse/i);
    expect(screen.getByText(/OpenAQ v3 & WAQI Ground Monitors/i)).toBeInTheDocument();
    expect(screen.getByText(/Open-Meteo Inversion & Dispersion/i)).toBeInTheDocument();
    expect(screen.getByText(/NASA FIRMS Satellite Plumes/i)).toBeInTheDocument();
    expect(screen.getByText(/Operate the Entire Website via Telegram/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Family Daily Companion Chat/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/1-Tap WhatsApp Briefs & RWA Notices/i)).toBeInTheDocument();

    const ctaButton = screen.getByRole('button', { name: TRANSLATIONS.en.landingAuthGuestCta });
    fireEvent.click(ctaButton);
    expect(onEnterConsole).toHaveBeenCalledTimes(1);

    const lightAxe = await axe.run(container, { rules: { 'color-contrast': { enabled: false } } });
    expect(lightAxe.violations).toHaveLength(0);

    await act(async () => {
      document.documentElement.dataset.mode = 'dark';
      await Promise.resolve();
    });
    const darkAxe = await axe.run(container, { rules: { 'color-contrast': { enabled: false } } });
    expect(darkAxe.violations).toHaveLength(0);
  });

  it('fully translates Landing Page sections into Hindi and Tamil without English section leaks', () => {
    for (const lang of ['hi', 'ta'] as const) {
      const { unmount } = render(
        <LandingPageView
          workspace={createMockWorkspace()}
          auth={createMockAuth()}
          onEnterConsole={vi.fn()}
          t={TRANSLATIONS[lang]}
        />,
      );
      expect(screen.queryByText(/Winter Smog Intelligence/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/Trusted Live Telemetry/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/One Brain, Every Channel/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/Return to Top/i)).not.toBeInTheDocument();
      expect(screen.getByText(TRANSLATIONS[lang].landing.telemetryTitle)).toBeInTheDocument();
      expect(screen.getByText(TRANSLATIONS[lang].landing.uspTitle)).toBeInTheDocument();
      unmount();
    }
  });

  it('accurately derives daily outdoor hours from 24h leave/return windows including overnight wrap & bounds', () => {
    expect(deriveOutdoorHoursFromTimes('10:00', '19:00')).toBe(9);
    expect(deriveOutdoorHoursFromTimes('10:20', '23:41')).toBe(13.5);
    expect(deriveOutdoorHoursFromTimes('22:00', '06:00')).toBe(8);
    expect(deriveOutdoorHoursFromTimes('10:00', '10:15')).toBe(0.5);
    expect(deriveOutdoorHoursFromTimes('10:00', '10:00')).toBeUndefined();
    expect(deriveOutdoorHoursFromTimes('invalid', '19:00')).toBeUndefined();
    expect(deriveOutdoorHoursFromTimes(undefined, '19:00')).toBeUndefined();
  });
});
