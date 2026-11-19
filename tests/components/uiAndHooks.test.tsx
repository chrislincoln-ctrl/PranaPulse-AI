import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import axe from 'axe-core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/App.js';
import { ScheduleLedger } from '../../src/components/ScheduleLedger.js';
import { buildInitialWorkspaceBundle } from '../../src/domain/localBaseline.js';
import { TRANSLATIONS } from '../../src/i18n/translations.js';

function urlOf(input: RequestInfo | URL): string {
  if (typeof input === 'string') {
    return input;
  }
  if (input instanceof URL) {
    return input.toString();
  }
  return input.url;
}

function encodeSseChunks(chunks: readonly string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ chunk })}\n\n`));
      }
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ done: true, isFallback: false })}\n\n`),
      );
      controller.close();
    },
  });
}

function setupMockFetch(
  options: { severeOverrideAqi?: number; geminiConfigured?: boolean; locateCity?: string } = {},
) {
  const baseBundle = buildInitialWorkspaceBundle();
  const effectiveAqi =
    options.severeOverrideAqi ?? baseBundle.telemetry.stationCrossCheck.effectiveSafetyAqi;

  const customBundle = {
    ...baseBundle,
    telemetry: {
      ...baseBundle.telemetry,
      stationName: options.severeOverrideAqi ? 'Anand Vihar DPCC' : null,
      stationCrossCheck: {
        ...baseBundle.telemetry.stationCrossCheck,
        stationAvailable: Boolean(options.severeOverrideAqi),
        stationAqi: options.severeOverrideAqi ?? null,
        disagreementDetected: Boolean(options.severeOverrideAqi),
        effectiveSafetyAqi: effectiveAqi,
      },
    },
    aiMeta: {
      isFallback: !options.geminiConfigured,
      modelUsed: options.geminiConfigured ? 'gemini-3.8-flash' : 'deterministic-physics',
      cached: false,
    },
  };

  return vi.fn((input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = urlOf(input);
    if (url.includes('/api/locate') && options.locateCity) {
      return Promise.resolve(
        new Response(
          JSON.stringify({ city: options.locateCity, lat: 22.47, lon: 88.39, precision: 'gps' }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );
    }
    if (url.includes('/api/health')) {
      return Promise.resolve(
        new Response(
          JSON.stringify({
            status: 'ok',
            capabilities: { geminiConfigured: Boolean(options.geminiConfigured) },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );
    }
    if (url.includes('/api/geocode')) {
      return Promise.resolve(
        new Response(
          JSON.stringify({
            locations: [
              { name: 'Patna', region: 'Bihar', countryCode: 'IN', lat: 25.59, lon: 85.14 },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );
    }
    if (url.includes('/api/assistant/stream')) {
      const rawBody = typeof init?.body === 'string' ? init.body : '{}';
      const bodyObj = JSON.parse(rawBody) as { query?: string };
      return Promise.resolve(
        new Response(
          encodeSseChunks([
            `Verified telemetry for ${bodyObj.query ?? 'your query'}: `,
            'keep windows sealed until solar breakup.',
          ]),
          { status: 200, headers: { 'Content-Type': 'text/event-stream' } },
        ),
      );
    }
    if (url.includes('/api/plan') && typeof init?.body === 'string') {
      const reqBody = JSON.parse(init.body) as { city?: string; lat?: number; lon?: number };
      return Promise.resolve(
        new Response(
          JSON.stringify({
            ...customBundle,
            telemetry: {
              ...customBundle.telemetry,
              city: reqBody.city ?? customBundle.telemetry.city,
              lat: reqBody.lat ?? customBundle.telemetry.lat,
              lon: reqBody.lon ?? customBundle.telemetry.lon,
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );
    }
    return Promise.resolve(
      new Response(JSON.stringify(customBundle), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
  });
}

describe('Phase 4 full Console UI, hooks & accessibility verification', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    document.documentElement.lang = 'en';
    delete document.documentElement.dataset.mode;
  });

  it('renders severe alert + station disagreement, toggles Light/Dark modes, switches locales HI/TA, and searches cities', async () => {
    vi.stubGlobal('fetch', setupMockFetch({ severeOverrideAqi: 385, geminiConfigured: true }));

    render(<App />);

    expect(document.documentElement.dataset.mode).toBe('light');
    const themeBtn = screen.getByRole('button', { name: /Dark mode/i });
    fireEvent.click(themeBtn);
    expect(document.documentElement.dataset.mode).toBe('dark');
    fireEvent.click(screen.getByRole('button', { name: /Light mode/i }));
    expect(document.documentElement.dataset.mode).toBe('light');

    await waitFor(() => {
      expect(screen.getByText(/Live Gemini telemetry active/i)).toBeInTheDocument();
      expect(screen.getByRole('alert')).toHaveTextContent(/CPCB NAQI 385/i);
      expect(screen.getByRole('alert')).toHaveTextContent(
        /Station monitor reads significantly higher/i,
      );
    });

    const searchInput = screen.getByRole('combobox', { name: /Search city or locality/i });
    fireEvent.focus(searchInput);
    fireEvent.change(searchInput, { target: { value: 'Patna' } });

    const patnaOption = await screen.findByRole('option', { name: /Patna \(Bihar\)/i });
    fireEvent.click(patnaOption);

    const langSelect = screen.getByLabelText(/Language/i);
    fireEvent.change(langSelect, { target: { value: 'hi' } });
    expect(document.documentElement.lang).toBe('hi');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/सर्दियों की धुंध टेलीमेट्री/);

    fireEvent.click(screen.getByRole('tab', { name: 'पारिवारिक दिनचर्या' }));
    expect(screen.getByDisplayValue('आरव (स्कूल)')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(/CPCB NAQI \d+ \(पटना\)/i);

    fireEvent.change(langSelect, { target: { value: 'ta' } });
    expect(document.documentElement.lang).toBe('ta');
    expect(screen.getByDisplayValue('ஆரவ் (பள்ளி)')).toBeInTheDocument();
  });

  it('supports keyboard-navigable SegmentedTabs, sequential stepper, and renders all 6 sections with zero axe violations', async () => {
    vi.stubGlobal('fetch', setupMockFetch({ geminiConfigured: false }));
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    vi.spyOn(window, 'print').mockImplementation(() => undefined);

    const { container } = render(<App />);

    // 0. Starts on dedicated Dashboard tab; step forward via bottom Next button
    expect(screen.getByRole('tab', { name: /Dashboard/i })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    fireEvent.click(screen.getByRole('button', { name: /Next: Family Routine/i }));

    // 1. Routine tab interactions: add member & switch fuel
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/Family Routine/i);
    fireEvent.click(await screen.findByRole('button', { name: /Add member/i }));
    expect(screen.getByDisplayValue('Member 4')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Cooking fuel/i), { target: { value: 'induction' } });

    let axeRes = await axe.run(container, { rules: { 'color-contrast': { enabled: false } } });
    expect(axeRes.violations).toHaveLength(0);

    // Keyboard navigate tabs: ArrowRight -> Indoor & CADR
    const routineTab = screen.getByRole('tab', { name: /Family Routine/i });
    routineTab.focus();
    fireEvent.keyDown(routineTab, { key: 'ArrowRight' });

    const indoorHeading = await screen.findByRole('heading', {
      name: /Indoor mass-balance & CADR calculator/i,
    });
    expect(indoorHeading).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Indoor & CADR/i })).toHaveAttribute(
      'aria-selected',
      'true',
    );

    fireEvent.change(screen.getByLabelText(/Room area/i), { target: { value: '40' } });
    expect(screen.getByText('40 m2')).toBeInTheDocument();

    axeRes = await axe.run(container, { rules: { 'color-contrast': { enabled: false } } });
    expect(axeRes.violations).toHaveLength(0);

    // ArrowRight -> Commute & Route
    const indoorTab = screen.getByRole('tab', { name: /Indoor & CADR/i });
    indoorTab.focus();
    fireEvent.keyDown(indoorTab, { key: 'ArrowRight' });

    expect(
      await screen.findByRole('img', { name: /Dijkstra clean-corridor network/i }),
    ).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Respirator/i), { target: { value: 'none' } });
    expect(screen.getAllByText(/High ventilation dose risk/i).length).toBeGreaterThan(0);

    axeRes = await axe.run(container, { rules: { 'color-contrast': { enabled: false } } });
    expect(axeRes.violations).toHaveLength(0);

    // ArrowRight -> Masks & Purifiers
    const commuteTab = screen.getByRole('tab', { name: /Commute & Route/i });
    commuteTab.focus();
    fireEvent.keyDown(commuteTab, { key: 'ArrowRight' });

    expect(
      await screen.findByRole('heading', { name: /Verified N95 & respirator buying guide/i }),
    ).toBeInTheDocument();
    axeRes = await axe.run(container, { rules: { 'color-contrast': { enabled: false } } });
    expect(axeRes.violations).toHaveLength(0);

    // End key -> RWA & Advisor
    const gearTab = screen.getByRole('tab', { name: /Masks & Purifiers/i });
    gearTab.focus();
    fireEvent.keyDown(gearTab, { key: 'End' });

    expect(
      await screen.findByRole('heading', { name: /RWA neighborhood collective simulator/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /RWA & Advisor/i })).toHaveAttribute(
      'aria-selected',
      'true',
    );

    fireEvent.change(screen.getByLabelText(/Participating homes/i), { target: { value: '300' } });
    fireEvent.click(screen.getByRole('button', { name: /Copy RWA bulletin/i }));
    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith(expect.stringContaining('CPCB NAQI'));
    });

    const advisorInput = screen.getByPlaceholderText(/Ask about school commute/i);
    fireEvent.change(advisorInput, { target: { value: 'Safe for COPD walking?' } });
    fireEvent.click(screen.getByRole('button', { name: /Ask advisor/i }));
    await waitFor(() => {
      expect(screen.getByText(/keep windows sealed until solar breakup/i)).toBeInTheDocument();
    });

    axeRes = await axe.run(container, { rules: { 'color-contrast': { enabled: false } } });
    expect(axeRes.violations).toHaveLength(0);

    // Change city button returns directly to Dashboard
    fireEvent.click(screen.getByRole('button', { name: /Change city/i }));
    expect(screen.getByRole('tab', { name: /Dashboard/i })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  it('handles GPS location denials gracefully and recovers cleanly when granted', async () => {
    vi.stubGlobal('fetch', setupMockFetch());

    const getCurrentPosition = vi.fn((_ok, err: PositionErrorCallback) => {
      err({
        code: 1,
        message: 'denied',
        PERMISSION_DENIED: 1,
        POSITION_UNAVAILABLE: 2,
        TIMEOUT: 3,
      });
    });
    Object.defineProperty(navigator, 'geolocation', {
      value: { getCurrentPosition },
      configurable: true,
    });

    render(<App />);
    await waitFor(() => {
      expect(screen.getByText(/Deterministic physics engine active/i)).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /Use GPS/i }));
    await waitFor(() => {
      expect(screen.getByText(/Location access denied or unavailable/i)).toBeInTheDocument();
    });
  });

  it('populates resolved GPS neighborhood directly inside the search city box instead of header station text', async () => {
    vi.stubGlobal('fetch', setupMockFetch({ locateCity: 'Garia, Kolkata' }));
    const getCurrentPosition = vi.fn((ok: PositionCallback) => {
      ok({
        coords: {
          latitude: 22.466,
          longitude: 88.392,
          accuracy: 20,
          altitude: null,
          altitudeAccuracy: null,
          heading: null,
          speed: null,
          toJSON: () => ({}),
        },
        timestamp: Date.now(),
        toJSON: () => ({}),
      });
    });
    Object.defineProperty(navigator, 'geolocation', {
      value: { getCurrentPosition },
      configurable: true,
    });

    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: /Use GPS/i }));

    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: /Search city or locality/i })).toHaveValue(
        'Garia, Kolkata',
      );
      expect(screen.getByText(/GPS \(22\.47, 88\.39\):/i)).toBeInTheDocument();
    });
  });

  it('renders subtle Amazon & Flipkart buy links only for paid indoor air fixes', () => {
    const base = buildInitialWorkspaceBundle();
    render(
      <ScheduleLedger
        aiPlan={{
          ...base.aiPlan,
          indoorHacks: [
            {
              tier: 'zero-cost',
              title: 'Cross-Ventilation Window Timing Strategy',
              howTo: 'Open windows briefly during verified clear hours.',
              estimatedCostInr: 0,
            },
            {
              tier: 'diy-budget',
              title: 'Door Sweep and Threshold Weatherstripping',
              howTo: 'Install dense foam strips beneath exterior doors.',
              estimatedCostInr: 350,
            },
            {
              tier: 'filtration',
              title: 'High-Efficiency CADR Air Purifier Deployment',
              howTo: 'Run a certified mechanical HEPA filtration system.',
              estimatedCostInr: 8999,
            },
          ],
        }}
        aiIsFallback={false}
        isLoadingPlan={false}
        onRefreshPlan={vi.fn()}
        t={TRANSLATIONS.en}
      />,
    );

    expect(
      screen.queryByRole('link', { name: /Cross-Ventilation Window Timing Strategy/i }),
    ).not.toBeInTheDocument();

    const sweepAmazon = screen.getByRole('link', {
      name: /Buy Door Sweep and Threshold Weatherstripping on Amazon\.in/i,
    });
    expect(sweepAmazon).toHaveAttribute(
      'href',
      expect.stringContaining('amazon.in/s?k=door%20sweep%20weatherstripping'),
    );
    expect(sweepAmazon).toHaveAttribute('target', '_blank');

    const purifierFlipkart = screen.getByRole('link', {
      name: /Buy High-Efficiency CADR Air Purifier Deployment on Flipkart/i,
    });
    expect(purifierFlipkart).toHaveAttribute(
      'href',
      expect.stringContaining('flipkart.com/search?q=True%20HEPA%20H13%20air%20purifier'),
    );
  });
});
