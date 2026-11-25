import type { SupabaseClient, User } from '@supabase/supabase-js';
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_WORKSPACE_INPUT } from '../../src/config/uiConstants.js';
import { useCityCorridorPlanner } from '../../src/hooks/useCityCorridorPlanner.js';
import { useCompanionChat } from '../../src/hooks/useCompanionChat.js';
import { useGeolocationAction } from '../../src/hooks/useGeolocationAction.js';
import { useSupabaseAuth } from '../../src/hooks/useSupabaseAuth.js';
import {
  isCustomOptionId,
  resetVerifiedCustomOptions,
  useVerifiedCustomOptions,
} from '../../src/hooks/useVerifiedCustomOptions.js';
import { useWorkspaceSync } from '../../src/hooks/useWorkspaceSync.js';
import { TRANSLATIONS } from '../../src/i18n/translations.js';
import * as supaService from '../../src/services/supabaseClient.js';
import { readStreamLines } from '../../src/utils/sseStreamReader.js';

function makeMockUser(meta: Record<string, unknown> = {}): User {
  return {
    id: 'user-123',
    email: 'ananya@example.com',
    app_metadata: {},
    user_metadata: meta,
    aud: 'authenticated',
    created_at: '2026-11-01T00:00:00.000Z',
  };
}

function makeMockSupabaseClient(overrides: Partial<SupabaseClient['auth']> = {}): SupabaseClient {
  const user = makeMockUser({
    full_name: 'Ananya Sen',
    pranapulsePrefs: supaService.buildCloudPreferencesPayload(DEFAULT_WORKSPACE_INPUT),
  });
  const auth = {
    getSession: vi.fn(() => Promise.resolve({ data: { session: { user } }, error: null })),
    onAuthStateChange: vi.fn((cb: (event: string, session: { user: User } | null) => void) => {
      void Promise.resolve().then(() => {
        cb('SIGNED_IN', { user });
      });
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    }),
    signInWithPassword: vi.fn(() => Promise.resolve({ error: null })),
    signInWithOAuth: vi.fn(() => Promise.resolve({ error: null })),
    signUp: vi.fn(() =>
      Promise.resolve({ data: { user: { identities: [{}] }, session: {} }, error: null }),
    ),
    resetPasswordForEmail: vi.fn(() => Promise.resolve({ error: null })),
    signOut: vi.fn(() => Promise.resolve({ error: null })),
    updateUser: vi.fn(() => Promise.resolve({ error: null })),
    ...overrides,
  };
  return { auth } as unknown as SupabaseClient;
}

describe('Client Supabase services, hooks & SSE stream reader coverage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    resetVerifiedCustomOptions();
    window.localStorage.clear();
    window.history.replaceState({}, '', '/');
  });

  it('exercises all supabaseClient helper actions for success, error, duplicate signup, and metadata parsing', async () => {
    const userWithName = makeMockUser({ full_name: 'Meera Devi' });
    expect(supaService.getUserDisplayName(userWithName)).toBe('Meera Devi');
    expect(supaService.getUserDisplayName(makeMockUser({}))).toBe('ananya');
    expect(supaService.getUserDisplayName({ ...makeMockUser({}), email: '' })).toBe('Account');

    const prefs = supaService.buildCloudPreferencesPayload(DEFAULT_WORKSPACE_INPUT);
    expect(
      supaService.extractSavedPreferences(makeMockUser({ pranapulsePrefs: prefs }))?.city,
    ).toBe(DEFAULT_WORKSPACE_INPUT.city);
    expect(
      supaService.extractSavedPreferences(makeMockUser({ pranapulsePrefs: { bad: 1 } })),
    ).toBeNull();
    expect(supaService.extractSavedPreferences(null)).toBeNull();

    const client = makeMockSupabaseClient();
    expect((await supaService.supabaseSignIn(client, 'a@b.com', 'pass1234')).ok).toBe(true);
    expect((await supaService.supabaseSignInWithGoogle(client)).ok).toBe(true);
    expect((await supaService.supabaseSignUp(client, 'a@b.com', 'pass1234', 'Ananya')).ok).toBe(
      true,
    );
    expect((await supaService.supabaseResetPassword(client, 'a@b.com')).ok).toBe(true);
    const saved = await supaService.supabaseSavePreferences(client, DEFAULT_WORKSPACE_INPUT);
    expect(saved.ok).toBe(true);
    expect(saved.savedAt).toBeDefined();

    const dupClient = makeMockSupabaseClient({
      signUp: vi.fn(() =>
        Promise.resolve({ data: { user: { identities: [] }, session: null }, error: null }),
      ) as unknown as SupabaseClient['auth']['signUp'],
    });
    expect((await supaService.supabaseSignUp(dupClient, 'a@b.com', 'pass1234', '')).ok).toBe(false);

    const confirmClient = makeMockSupabaseClient({
      signUp: vi.fn(() =>
        Promise.resolve({ data: { user: { identities: [{}] }, session: null }, error: null }),
      ) as unknown as SupabaseClient['auth']['signUp'],
    });
    expect(
      (await supaService.supabaseSignUp(confirmClient, 'a@b.com', 'pass1234', '')).notice,
    ).toContain('verification link');

    const errClient = makeMockSupabaseClient({
      signInWithPassword: vi.fn(() =>
        Promise.resolve({ error: { message: 'bad creds' } }),
      ) as unknown as SupabaseClient['auth']['signInWithPassword'],
      signInWithOAuth: vi.fn(() =>
        Promise.resolve({ error: { message: 'oauth err' } }),
      ) as unknown as SupabaseClient['auth']['signInWithOAuth'],
      signUp: vi.fn(() =>
        Promise.resolve({ data: { user: null, session: null }, error: { message: 'signup err' } }),
      ) as unknown as SupabaseClient['auth']['signUp'],
      resetPasswordForEmail: vi.fn(() =>
        Promise.resolve({ error: { message: 'reset err' } }),
      ) as unknown as SupabaseClient['auth']['resetPasswordForEmail'],
      updateUser: vi.fn(() =>
        Promise.resolve({ error: { message: 'update err' } }),
      ) as unknown as SupabaseClient['auth']['updateUser'],
    });
    expect((await supaService.supabaseSignIn(errClient, 'a@b.com', 'x')).ok).toBe(false);
    expect((await supaService.supabaseSignInWithGoogle(errClient)).ok).toBe(false);
    expect((await supaService.supabaseSignUp(errClient, 'a@b.com', 'x', '')).ok).toBe(false);
    expect((await supaService.supabaseResetPassword(errClient, 'a@b.com')).ok).toBe(false);
    expect((await supaService.supabaseSavePreferences(errClient, DEFAULT_WORKSPACE_INPUT)).ok).toBe(
      false,
    );
  });

  it('exercises useSupabaseAuth session subscription, restore callback, auth actions, and error handling', async () => {
    const mockClient = makeMockSupabaseClient();
    vi.spyOn(supaService, 'isSupabaseConfigured').mockReturnValue(true);
    vi.spyOn(supaService, 'getSupabaseClient').mockReturnValue(mockClient);
    const onRestore = vi.fn();

    const { result } = renderHook(() => useSupabaseAuth(onRestore));
    await waitFor(() => {
      expect(result.current.isInitializing).toBe(false);
      expect(result.current.user?.id).toBe('user-123');
    });
    expect(onRestore).toHaveBeenCalledTimes(1);

    await act(async () => {
      expect(await result.current.signIn('a@b.com', 'secret123')).toBe(true);
      expect(await result.current.signInWithGoogle()).toBe(true);
      expect(await result.current.signUp('a@b.com', 'secret123', 'Ananya')).toBe(true);
      expect(await result.current.resetPassword('a@b.com')).toBe(true);
      expect(await result.current.savePreferences(DEFAULT_WORKSPACE_INPUT)).toBe(true);
      await result.current.signOut();
      result.current.clearMessages();
    });
    expect(result.current.errorMessage).toBeNull();
    expect(result.current.noticeMessage).toBeNull();

    vi.spyOn(supaService, 'getSupabaseClient').mockReturnValue(null);
    await act(async () => {
      expect(await result.current.signIn('a@b.com', 'x')).toBe(false);
    });
    expect(result.current.errorMessage).toContain('not configured');
  });

  it('exercises useCityCorridorPlanner origin/destination editing, live plan success, invalid response, and error', async () => {
    const onUpdateKm = vi.fn();
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              isValid: true,
              estimatedDistanceKm: 14,
              routeSummary: 'Parkway corridor ready.',
              googleMapsUrl: 'https://www.google.com/maps/dir/?api=1',
              nodeLabels: {
                'home-sector': 'Garia',
                'arterial-junction': 'Jadavpur',
                'ring-flyover': 'AJC Flyover',
                'green-parkway': 'Rabindra Sarobar',
                'metro-concourse': 'Rabindra Sarobar Metro',
                'civic-hub': 'Park Street',
              },
            }),
            { status: 200 },
          ),
        )
        .mockResolvedValueOnce(new Response('fail', { status: 500 })),
    );

    const { result } = renderHook(() =>
      useCityCorridorPlanner({
        city: 'Kolkata',
        commuteMode: 'metro',
        language: 'en',
        onUpdateDistanceKm: onUpdateKm,
        t: TRANSLATIONS.en,
      }),
    );

    act(() => {
      result.current.setFromArea('Garia');
      result.current.setToArea('Park Street');
    });
    act(() => {
      result.current.runCorridorPlan();
    });

    await waitFor(() => {
      expect(result.current.feedback?.isValid).toBe(true);
    });
    expect(onUpdateKm).toHaveBeenCalledWith(14);

    act(() => {
      result.current.runCorridorPlan();
    });
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
  });

  it('exercises useGeolocationAction watchPosition refinement, error fallback to getCurrentPosition, and IP fallback', async () => {
    const selectCity = vi.fn();
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({ city: 'Garia, Kolkata', lat: 22.47, lon: 88.39, precision: 'gps' }),
            { status: 200 },
          ),
        ),
      ),
    );

    const clearWatch = vi.fn();
    const watchPosition = vi.fn((onOk: PositionCallback) => {
      queueMicrotask(() => {
        onOk({
          coords: { latitude: 22.47, longitude: 88.39, accuracy: 45 },
        } as GeolocationPosition);
      });
      return 7;
    });
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: { watchPosition, clearWatch, getCurrentPosition: vi.fn() },
    });

    const { result } = renderHook(() => useGeolocationAction(selectCity));
    act(() => {
      result.current.requestGeolocation();
    });
    await waitFor(() => {
      expect(selectCity).toHaveBeenCalledWith('Garia, Kolkata', 22.47, 88.39);
    });
    expect(clearWatch).toHaveBeenCalledWith(7);

    // Watch fails with non-permission error -> falls back to getCurrentPosition -> falls back to server IP
    const getCurrentPosition = vi.fn((_ok: PositionCallback, onErr: PositionErrorCallback) => {
      onErr({ code: 2, message: 'unavailable' } as GeolocationPositionError);
    });
    const watchFail = vi.fn((_ok: PositionCallback, onErr: PositionErrorCallback) => {
      onErr({ code: 2, message: 'timeout' } as GeolocationPositionError);
      return 8;
    });
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: { watchPosition: watchFail, clearWatch, getCurrentPosition },
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({ city: 'Kolkata', lat: 22.57, lon: 88.36, precision: 'ip' }),
            { status: 200 },
          ),
        ),
      ),
    );

    act(() => {
      result.current.requestGeolocation();
    });
    await waitFor(() => {
      expect(result.current.gpsStatus).toBe('ip-fallback');
    });
    act(() => {
      result.current.resetGpsStatus();
    });
    expect(result.current.gpsStatus).toBe('idle');
  });

  it('exercises useWorkspaceSync polling, URL workspace key parsing, immediate/debounced pushes, and SSE reader', async () => {
    const prevNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      window.history.replaceState({}, '', '/?ws=MyRoom_99');
      const onApply = vi.fn();
      vi.stubGlobal(
        'fetch',
        vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
          const url = input instanceof Request ? input.url : String(input);
          if (url.includes('/api/companion/workspace-sync') && init?.method === 'POST') {
            return Promise.resolve(
              new Response(
                JSON.stringify({
                  ok: true,
                  telegramLinked: true,
                  updatedAt: '2026-11-26T01:00:00Z',
                }),
                { status: 200 },
              ),
            );
          }
          return Promise.resolve(
            new Response(
              JSON.stringify({
                found: true,
                changed: true,
                telegramLinked: true,
                lastModifiedBy: 'telegram',
                updatedAt: '2026-11-26T00:59:00Z',
                payload: DEFAULT_WORKSPACE_INPUT,
              }),
              { status: 200 },
            ),
          );
        }),
      );

      const { result, unmount } = renderHook(() => useWorkspaceSync(onApply));
      expect(result.current.workspaceKey).toBe('myroom_99');
      await waitFor(() => {
        expect(onApply).toHaveBeenCalledWith(DEFAULT_WORKSPACE_INPUT, true);
        expect(result.current.telegramLinked).toBe(true);
        expect(result.current.syncedFromTelegram).toBe(true);
      });
      act(() => {
        result.current.pushWorkspace(DEFAULT_WORKSPACE_INPUT, true);
        result.current.pushWorkspace(DEFAULT_WORKSPACE_INPUT, false);
      });
      unmount();
    } finally {
      process.env.NODE_ENV = prevNodeEnv;
    }

    // Exercise useVerifiedCustomOptions edge cases
    const { result: customHook } = renderHook(() => useVerifiedCustomOptions('role', 'member:m1'));
    expect(isCustomOptionId('custom:runner')).toBe(true);
    expect(customHook.current.selectCustomById('custom:missing')).toBeNull();
    act(() => {
      customHook.current.saveAndSelectCustom({
        label: 'Outdoor Runner',
        mappedValue: 'commuter',
        explanation: 'Mapped to commuter.',
      });
      customHook.current.clearActiveCustom();
      customHook.current.clearActiveCustom();
    });

    // Exercise readStreamLines including trailing buffered line without trailing newline
    const lines: string[] = [];
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      start(ctrl) {
        ctrl.enqueue(encoder.encode('data: {"chunk":"Hi "}\n'));
        ctrl.enqueue(encoder.encode('data: {"done":true}'));
        ctrl.close();
      },
    });
    await readStreamLines(stream, (line: string) => {
      lines.push(line);
    });
    expect(lines).toEqual(['data: {"chunk":"Hi "}', 'data: {"done":true}']);
  });

  it('exercises useCompanionChat GPS attachment, question sending, habit patches, and failure resilience', async () => {
    const onPatch = vi.fn();
    const getCurrentPosition = vi.fn((ok: PositionCallback) => {
      ok({ coords: { latitude: 22.57, longitude: 88.36 } } as GeolocationPosition);
    });
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: { getCurrentPosition },
    });
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              reply: 'Keep N95 sealed.',
              resolvedCity: 'Kolkata',
              aqi: 215,
              pm25UgM3: 94,
              pblMeters: 310,
              windKmh: 7,
              rhPercent: 62,
              habitPatch: { leaveHomeTime: '08:30', mask: 'n95-ffp2' },
            }),
            { status: 200 },
          ),
        )
        .mockResolvedValueOnce(new Response('fail', { status: 500 })),
    );

    const { result } = renderHook(() => useCompanionChat(DEFAULT_WORKSPACE_INPUT, onPatch));
    act(() => {
      result.current.toggleGps();
    });
    expect(result.current.gpsPoint).toEqual({ lat: 22.57, lon: 88.36 });

    act(() => {
      result.current.sendQuestion('   ');
      result.current.sendQuestion('Should I walk today?');
    });
    await waitFor(() => {
      expect(result.current.turns).toHaveLength(1);
    });
    expect(onPatch).toHaveBeenCalledWith('m1', { leaveHomeTime: '08:30', mask: 'n95-ffp2' });

    act(() => {
      result.current.toggleGps();
    });
    expect(result.current.gpsPoint).toBeNull();

    act(() => {
      result.current.sendQuestion('Second check');
    });
    await waitFor(() => {
      expect(result.current.isSending).toBe(false);
    });
  });
});
