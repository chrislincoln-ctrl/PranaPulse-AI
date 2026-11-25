import type { User } from '@supabase/supabase-js';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AccountProfileSection } from '../../src/components/AccountProfileSection.js';
import { FloatingTelegramButton } from '../../src/components/FloatingTelegramButton.js';
import { RangeField, SelectField } from '../../src/components/FormFields.js';
import { RouteOriginDestPlanner } from '../../src/components/RouteOriginDestPlanner.js';
import { SevereAlertBanner } from '../../src/components/SevereAlertBanner.js';
import Globe from '../../src/components/ui/globe.js';
import { generateParticles } from '../../src/components/ui/globeClock.js';
import {
  buildFrozenDelayStyle,
  buildParticleCssStyle,
} from '../../src/components/ui/globeStyles.js';
import {
  drawLandingSmokeFrame,
  queryLandingSmokeUniforms,
  resizeLandingSmokeCanvas,
} from '../../src/components/ui/landingSmokeRenderer.js';
import { SmokeCanvas } from '../../src/components/ui/smoke-canvas.js';
import { DEFAULT_WORKSPACE_INPUT } from '../../src/config/uiConstants.js';
import {
  buildInitialWorkspaceBundle,
  recomputeBundlePhysics,
} from '../../src/domain/localBaseline.js';
import {
  buildLocalizedChatReply,
  buildLocalizedFallbackPlan,
} from '../../src/i18n/fallbackTemplates.js';
import { TRANSLATIONS } from '../../src/i18n/translations.js';
import {
  buildChartAreaPolygon,
  buildChartPolyline,
  resolveSeriesMax,
} from '../../src/utils/chartHelpers.js';
import { loadServerEnv } from '../../server/env.js';
import { fetchFirePlume } from '../../server/services/firmsClient.js';
import { reverseGeocodeCoords } from '../../server/services/reverseGeocoder.js';
import { runDailyBriefFanout } from '../../server/services/telegramDailyBrief.js';
import {
  extractRequestGeoContext,
  fetchWaqiStation,
  resolveAutoLocation,
} from '../../server/services/waqiFirmsClient.js';
import {
  cacheWorkspace,
  clearMemoryChatConflict,
  findMemoryWorkspaceByChat,
  findMemoryWorkspaceByCode,
  memoryWorkspaces,
} from '../../server/services/workspaceMemoryCache.js';
import {
  workspaceKeyToUuid,
  type SyncedWorkspaceRecord,
} from '../../server/services/workspaceSyncCodec.js';

function makeWs(
  key: string,
  chatId: string | null = null,
  code: string | null = null,
): SyncedWorkspaceRecord {
  return {
    id: workspaceKeyToUuid(key),
    workspaceKey: key,
    userId: null,
    activeMemberId: 'm1',
    payload: DEFAULT_WORKSPACE_INPUT,
    telegramChatId: chatId,
    telegramLinkCode: code,
    telegramOptIn: Boolean(chatId),
    briefTimeLocal: '06:30',
    lastBriefSentAt: null,
    lastModifiedBy: 'web',
    updatedAt: '2026-11-26T00:00:00.000Z',
  };
}

describe('UI controls, geolocation fallbacks, cache eviction & frozen visual states', () => {
  afterEach(() => {
    memoryWorkspaces.clear();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    window.history.replaceState({}, '', '/');
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
  });

  it('exercises FloatingTelegramButton synced badge, failed link hint, and popup fallback', async () => {
    const close = vi.fn();
    vi.spyOn(window, 'open').mockReturnValue({ closed: false, close } as unknown as Window);
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(new Response('err', { status: 500 }))
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ deepLinkUrl: 'https://t.me/testbot?start=abc' }), {
            status: 200,
          }),
        ),
    );

    render(
      <FloatingTelegramButton
        input={DEFAULT_WORKSPACE_INPUT}
        workspaceKey="wtest1"
        activeMemberId="m1"
        telegramLinked
        syncedFromTelegram
        t={TRANSLATIONS.en}
      />,
    );
    expect(screen.getByRole('status')).toHaveTextContent(
      TRANSLATIONS.en.ui.syncedFromTelegramBadge,
    );

    const btn = screen.getByRole('button', { name: TRANSLATIONS.en.memberConnectTelegramButton });
    fireEvent.click(btn);
    await waitFor(() => {
      expect(screen.getByText(TRANSLATIONS.en.memberTelegramPendingHint)).toBeInTheDocument();
    });
    expect(close).toHaveBeenCalled();

    // Second click succeeds with direct window.open fallback
    const directOpen = vi
      .spyOn(window, 'open')
      .mockReturnValueOnce(null)
      .mockReturnValueOnce({ closed: false } as unknown as Window);
    fireEvent.click(btn);
    await waitFor(() => {
      expect(directOpen).toHaveBeenCalledWith(
        'https://t.me/testbot?start=abc',
        '_blank',
        'noopener,noreferrer',
      );
    });
  });

  it('exercises RangeField DirectNumberInput keyboard/blur clamping and SelectField addons', () => {
    const onRange = vi.fn();
    const onSelect = vi.fn();
    render(
      <>
        <RangeField
          id="cadr-test"
          label="CADR"
          valueText="250 m3/h"
          min={0}
          max={800}
          step={10}
          value={250}
          onChangeValue={onRange}
        />
        <SelectField
          id="sel-test"
          label="Mode"
          value="a"
          options={[
            { value: 'a', label: 'Alpha' },
            { value: 'b', label: 'Beta' },
          ]}
          onChangeValue={onSelect}
          labelAddon={<span>Hint</span>}
        />
      </>,
    );

    const numInput = screen.getByRole('spinbutton', { name: '250 m3/h' });
    fireEvent.change(numInput, { target: { value: '400' } });
    expect(onRange).toHaveBeenLastCalledWith(400);
    fireEvent.change(numInput, { target: { value: '9999' } });
    fireEvent.keyDown(numInput, { key: 'Enter' });
    expect(onRange).toHaveBeenLastCalledWith(800);
    fireEvent.change(numInput, { target: { value: '-50' } });
    fireEvent.blur(numInput);
    expect(onRange).toHaveBeenLastCalledWith(0);

    const slider = screen.getByRole('slider', { name: 'CADR' });
    fireEvent.change(slider, { target: { value: '300' } });
    expect(onRange).toHaveBeenLastCalledWith(300);

    fireEvent.change(screen.getByLabelText('Mode'), { target: { value: 'b' } });
    expect(onSelect).toHaveBeenCalledWith('b');
  });

  it('exercises reverseGeocodeCoords across accuracy tiers, Nominatim errors, and BigDataCloud fallbacks', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({ address: { suburb: 'Ballygunge', city: 'Greater Kolkata' } }),
            { status: 200 },
          ),
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ address: { town: 'Howrah', city: 'Howrah' } }), {
            status: 200,
          }),
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ address: { suburb: 'Garia', city: 'Kolkata' } }), {
            status: 200,
          }),
        )
        .mockRejectedValueOnce(new Error('nominatim down'))
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ locality: 'Indiranagar', city: 'Bengaluru' }), {
            status: 200,
          }),
        )
        .mockResolvedValueOnce(new Response(JSON.stringify({ address: {} }), { status: 200 }))
        .mockRejectedValueOnce(new Error('bdc down')),
    );

    expect(await reverseGeocodeCoords(22.53, 88.36, 40)).toBe('Ballygunge, Kolkata');
    expect(await reverseGeocodeCoords(22.58, 88.31, 600)).toBe('Howrah');
    expect(await reverseGeocodeCoords(22.47, 88.39, 2500)).toBe('Kolkata');
    expect(await reverseGeocodeCoords(12.97, 77.64, undefined)).toBe('Indiranagar, Bengaluru');
    expect(await reverseGeocodeCoords(0, 0, 50)).toBeNull();
  });

  it('exercises FIRMS zero-hotspot/error branches, WAQI invalid/here fallbacks, and memory cache FIFO eviction', async () => {
    // South India baseline + zero-hotspot live CSV + invalid header
    expect((await fetchFirePlume(12.97, 77.59, undefined)).hotspots500km).toBe(6);

    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(new Response('latitude,longitude\n', { status: 200 }))
        .mockResolvedValueOnce(new Response('invalid-header\n', { status: 200 }))
        .mockResolvedValueOnce(new Response('err', { status: 500 })),
    );
    const zeroPlume = await fetchFirePlume(28.61, 77.21, 'k');
    expect(zeroPlume.hotspots500km).toBe(0);
    expect(zeroPlume.isSeasonalBaseline).toBe(false);

    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(new Response(JSON.stringify({ status: 'error' }), { status: 200 }))
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ status: 'ok', data: { aqi: '-' } }), { status: 200 }),
        )
        .mockRejectedValueOnce(new Error('geojs down'))
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              status: 'ok',
              data: { city: { name: 'Salt Lake, India', geo: [22.58, 88.41] } },
            }),
            { status: 200 },
          ),
        ),
    );
    expect(await fetchWaqiStation(28, 77, 't')).toEqual({ aqi: null, name: null });
    expect(await fetchWaqiStation(28, 77, 't')).toEqual({ aqi: null, name: null });
    const waqiHere = await resolveAutoLocation({ clientIp: '127.0.0.1', token: 't' });
    expect(waqiHere?.city).toBe('Salt Lake');

    const badHdr = extractRequestGeoContext({
      'x-vercel-ip-city': '%E0%A4%A',
      'x-vercel-ip-latitude': '22.5',
      'x-vercel-ip-longitude': '88.3',
    });
    expect(badHdr.vercelGeo?.city).toBe('%E0%A4%A');

    // Memory cache eviction (> 500 items) + conflict clear + lookups
    for (let i = 0; i <= 502; i += 1) {
      cacheWorkspace(
        makeWs(`wskey${String(i)}`, i === 500 ? 'chat9' : null, i === 501 ? 'CODE9' : null),
      );
    }
    expect(memoryWorkspaces.size).toBe(500);
    expect(findMemoryWorkspaceByChat('chat9')?.workspaceKey).toBe('wskey500');
    expect(findMemoryWorkspaceByCode('code9')?.workspaceKey).toBe('wskey501');
    clearMemoryChatConflict('chat9', 'wskey501');
    expect(findMemoryWorkspaceByChat('chat9')).toBeNull();
  });

  it('exercises frozen ?introT dev mode and document.hidden pause/resume on Globe & SmokeCanvas', () => {
    window.history.replaceState({}, '', '/?introT=1.4');
    const heroRef = createRef<HTMLDivElement>();
    const { unmount: unmountGlobe } = render(<Globe />);
    const { unmount: unmountSmoke } = render(
      <SmokeCanvas activeSection={1} scrollProgress={0.2} heroTextRef={heroRef} />,
    );
    act(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, value: true });
      document.dispatchEvent(new Event('visibilitychange'));
      Object.defineProperty(document, 'hidden', { configurable: true, value: false });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    unmountSmoke();
    unmountGlobe();
  });

  it('exercises landingSmokeRenderer branches, globeStyles helpers, RouteOriginDestPlanner & daily brief fanout', async () => {
    const pt = generateParticles(1)[0]!;
    expect(buildParticleCssStyle(pt, '#fff', 1.2)['--p-color']).toBe('#fff');
    expect(buildParticleCssStyle(pt, '#000', null)['--p-color']).toBe('#000');
    expect(buildFrozenDelayStyle(1.2)).toEqual({ animationDelay: '-1.200s' });
    expect(buildFrozenDelayStyle(null)).toBeUndefined();

    const drawArrays = vi.fn();
    const gl = {
      COLOR_BUFFER_BIT: 16384,
      TRIANGLES: 4,
      isContextLost: vi.fn(() => false),
      getUniformLocation: vi.fn(() => ({})),
      clear: vi.fn(),
      viewport: vi.fn(),
      uniform1f: vi.fn(),
      uniform2f: vi.fn(),
      uniform3f: vi.fn(),
      uniform4f: vi.fn(),
      drawArrays,
    } as unknown as WebGLRenderingContext;
    const pipe = {
      gl,
      program: {} as WebGLProgram,
      vs: {} as WebGLShader,
      fs: {} as WebGLShader,
      buffer: null,
      aPos: 0,
      uniforms: queryLandingSmokeUniforms(gl, {}),
    };
    const canvas = document.createElement('canvas');
    const refs = {
      heroTextRef: createRef<HTMLDivElement>(),
      targetIntensityRef: { current: 0.72 },
      fromIntensityRef: { current: 1.0 },
      currentIntensityRef: { current: 1.0 },
      transitionStartRef: { current: performance.now() - 200 },
      textRectRef: { current: [0, 0, 100, 100, 1] as [number, number, number, number, number] },
      triggerRedrawRef: { current: null },
    };
    const baseState = {
      disposed: false,
      rafId: null,
      resStepIdx: 0,
      isDark: false,
      reducedMotion: false,
      devIntroT: null as number | null,
      introStartMs: -1 as number | null,
      elapsedDriftSec: 2,
      lastFrameMs: 0,
      frameCount: 0,
      frameTimeSum: 0,
    };

    resizeLandingSmokeCanvas(pipe, canvas, baseState, refs);
    drawLandingSmokeFrame(pipe, canvas, baseState, refs);
    refs.transitionStartRef.current = performance.now() - 5000;
    drawLandingSmokeFrame(pipe, canvas, { ...baseState, isDark: true, introStartMs: null }, refs);
    drawLandingSmokeFrame(pipe, canvas, { ...baseState, reducedMotion: true }, refs);
    drawLandingSmokeFrame(pipe, canvas, { ...baseState, devIntroT: 1.4 }, refs);
    drawLandingSmokeFrame(pipe, canvas, { ...baseState, disposed: true }, refs);
    expect(drawArrays).toHaveBeenCalledTimes(4);

    // RouteOriginDestPlanner loading, valid & invalid feedback banners
    const onRun = vi.fn();
    const onFrom = vi.fn();
    const onTo = vi.fn();
    const { rerender } = render(
      <RouteOriginDestPlanner
        fromArea="Garia"
        toArea="Park Street"
        loading
        feedback={null}
        googleMapsUrl="https://www.google.com/maps/dir/?api=1"
        setFromArea={onFrom}
        setToArea={onTo}
        runCorridorPlan={onRun}
        t={TRANSLATIONS.en}
      />,
    );
    fireEvent.change(screen.getByDisplayValue('Garia'), { target: { value: 'Salt Lake' } });
    fireEvent.change(screen.getByDisplayValue('Park Street'), { target: { value: 'Esplanade' } });
    expect(onFrom).toHaveBeenCalledWith('Salt Lake');
    expect(onTo).toHaveBeenCalledWith('Esplanade');

    rerender(
      <RouteOriginDestPlanner
        fromArea="Garia"
        toArea="Park Street"
        loading={false}
        feedback={{
          isValid: false,
          estimatedDistanceKm: 10,
          routeSummary: 'Invalid route',
          googleMapsUrl: 'https://www.google.com/maps/dir/?api=1',
          nodeLabels: {
            'home-sector': 'Garia',
            'arterial-junction': 'A',
            'ring-flyover': 'B',
            'green-parkway': 'C',
            'metro-concourse': 'D',
            'civic-hub': 'Park Street',
          },
        }}
        googleMapsUrl="https://www.google.com/maps/dir/?api=1"
        setFromArea={onFrom}
        setToArea={onTo}
        runCorridorPlan={onRun}
        t={TRANSLATIONS.en}
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Invalid route');

    // Valid feedback branch + runCorridorPlan button click
    rerender(
      <RouteOriginDestPlanner
        fromArea="Garia"
        toArea="Park Street"
        loading={false}
        feedback={{
          isValid: true,
          estimatedDistanceKm: 11.4,
          routeSummary: 'Verified clean corridor via Rabindra Sarobar',
          googleMapsUrl: 'https://www.google.com/maps/dir/?api=1',
          nodeLabels: {
            'home-sector': 'Garia',
            'arterial-junction': 'A',
            'ring-flyover': 'B',
            'green-parkway': 'C',
            'metro-concourse': 'D',
            'civic-hub': 'Park Street',
          },
        }}
        googleMapsUrl="https://www.google.com/maps/dir/?api=1"
        setFromArea={onFrom}
        setToArea={onTo}
        runCorridorPlan={onRun}
        t={TRANSLATIONS.en}
      />,
    );
    expect(screen.getByText(/Verified clean corridor/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: TRANSLATIONS.en.planRouteButton }));
    expect(onRun).toHaveBeenCalledTimes(1);

    // Daily brief fanout without token (dry-run true) & with failing Telegram fetch
    cacheWorkspace(makeWs('briefws1', 'chat-100', 'code-100'));
    const envNoToken = loadServerEnv({ NODE_ENV: 'test' });
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response('{}', { status: 500 }))),
    );
    const dryRes = await runDailyBriefFanout(envNoToken);
    expect(dryRes.sentCount).toBeGreaterThanOrEqual(1);

    const envWithToken = loadServerEnv({ NODE_ENV: 'test', TELEGRAM_BOT_TOKEN: 'bad-tok' });
    const failRes = await runDailyBriefFanout(envWithToken);
    expect(failRes.skippedCount).toBeGreaterThanOrEqual(1);
  });

  it('exercises chartHelpers, SevereAlertBanner, AccountProfileSection & localized fallback branches', () => {
    expect(buildChartAreaPolygon([], (n: number) => n, 100)).toBe('');
    expect(buildChartPolyline([42], (n) => n, 100)).toContain(',');
    expect(resolveSeriesMax([5, 120, 20], (n) => n, 50)).toBe(120);

    const baseBundle = buildInitialWorkspaceBundle({
      ...DEFAULT_WORKSPACE_INPUT,
      city: 'Custom Town',
      lat: 10.5,
      lon: 76.2,
    });
    const baseTel = baseBundle.telemetry;
    const { rerender, container } = render(
      <SevereAlertBanner
        telemetry={{
          ...baseTel,
          stationCrossCheck: {
            ...baseTel.stationCrossCheck,
            effectiveSafetyAqi: 90,
            disagreementDetected: false,
          },
        }}
        t={TRANSLATIONS.en}
      />,
    );
    expect(container.firstChild).toBeNull();

    rerender(
      <SevereAlertBanner
        telemetry={{
          ...baseTel,
          stationCrossCheck: {
            ...baseTel.stationCrossCheck,
            effectiveSafetyAqi: 420,
            disagreementDetected: true,
          },
        }}
        t={TRANSLATIONS.hi}
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('420');
    expect(screen.getByRole('alert')).toHaveTextContent(TRANSLATIONS.hi.disagreementBannerText);

    const signOut = vi.fn(() => Promise.resolve());
    const fakeUser = {
      id: 'u-1',
      email: undefined,
      user_metadata: { full_name: 'Aarav' },
    } as unknown as User;
    const baseAuth = {
      isConfigured: true,
      isInitializing: false,
      busy: false,
      user: fakeUser,
      errorMessage: null,
      noticeMessage: null,
      syncStatus: 'idle' as const,
      lastSavedAt: null as string | null,
      clearMessages: vi.fn(),
      signIn: vi.fn(),
      signInWithGoogle: vi.fn(),
      signUp: vi.fn(),
      resetPassword: vi.fn(),
      signOut,
      savePreferences: vi.fn(),
    };
    const customInput = { ...DEFAULT_WORKSPACE_INPUT, city: 'Custom Town' };
    const { rerender: rerenderAcct } = render(
      <AccountProfileSection
        user={fakeUser}
        auth={baseAuth}
        workspaceInput={customInput}
        t={TRANSLATIONS.en}
      />,
    );
    expect(screen.getByText(TRANSLATIONS.en.auth.notSyncedYet)).toBeInTheDocument();

    rerenderAcct(
      <AccountProfileSection
        user={{ ...fakeUser, email: 'aarav@example.com' }}
        auth={{ ...baseAuth, lastSavedAt: 'invalid-date' }}
        workspaceInput={customInput}
        t={TRANSLATIONS.en}
      />,
    );
    expect(screen.getByText(TRANSLATIONS.en.auth.syncedLabel)).toBeInTheDocument();

    rerenderAcct(
      <AccountProfileSection
        user={{ ...fakeUser, email: 'aarav@example.com' }}
        auth={{ ...baseAuth, lastSavedAt: '2026-11-26T10:30:00.000Z' }}
        workspaceInput={customInput}
        t={TRANSLATIONS.en}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: TRANSLATIONS.en.auth.signOutButton }));
    expect(signOut).toHaveBeenCalledTimes(1);

    for (const language of ['en', 'hi', 'ta'] as const) {
      const req = { ...DEFAULT_WORKSPACE_INPUT, city: 'Custom Town', language };
      const closedBundle = recomputeBundlePhysics(req, {
        ...baseTel,
        inversion: { ...baseTel.inversion, openWindowsNow: false },
      });
      const openBundle = recomputeBundlePhysics(req, {
        ...baseTel,
        inversion: { ...baseTel.inversion, openWindowsNow: true },
      });
      expect(closedBundle.aiPlan.dailyRoutine.length).toBeGreaterThanOrEqual(4);
      expect(openBundle.aiPlan.dailyRoutine.length).toBeGreaterThanOrEqual(4);
      const replyOpen = buildLocalizedChatReply({
        query: 'Should I run outside?',
        city: 'Custom Town',
        language,
        cpcbNaqi: 180,
        pm25UgM3: 85,
        inversionSeverity: 'moderate-trapping',
        openWindowsNow: true,
      });
      const replyClosed = buildLocalizedChatReply({
        query: 'Should I open windows?',
        city: 'Custom Town',
        language,
        cpcbNaqi: 380,
        pm25UgM3: 240,
        inversionSeverity: 'severe-inversion',
        openWindowsNow: false,
      });
      expect(replyOpen.length).toBeGreaterThan(20);
      expect(replyClosed.length).toBeGreaterThan(20);
      expect(replyOpen).not.toBe(replyClosed);
    }
    expect(typeof buildLocalizedFallbackPlan).toBe('function');
  });
});
