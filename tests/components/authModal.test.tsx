import type { User } from '@supabase/supabase-js';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import axe from 'axe-core';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../../server/app.js';
import { loadServerEnv } from '../../server/env.js';
import { AuthModal } from '../../src/components/AuthModal.js';
import { HeaderAuthButton } from '../../src/components/HeaderAuthButton.js';
import { DEFAULT_WORKSPACE_INPUT } from '../../src/config/uiConstants.js';
import type { SupabaseAuthController } from '../../src/hooks/useSupabaseAuth.js';
import {
  buildCloudPreferencesPayload,
  extractSavedPreferences,
  getUserDisplayName,
} from '../../src/services/supabaseClient.js';
import { invokeExpress } from '../helpers/invokeExpress.js';

function makeMockUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-123',
    app_metadata: {},
    user_metadata: { full_name: 'Aarav Sharma' },
    aud: 'authenticated',
    created_at: '2026-11-19T00:00:00.000Z',
    email: 'aarav@example.com',
    ...overrides,
  };
}

function makeMockAuth(overrides: Partial<SupabaseAuthController> = {}): SupabaseAuthController {
  return {
    isConfigured: true,
    isInitializing: false,
    user: null,
    busy: false,
    errorMessage: null,
    noticeMessage: null,
    syncStatus: 'idle',
    lastSavedAt: null,
    clearMessages: vi.fn(),
    signIn: vi.fn().mockResolvedValue(true),
    signUp: vi.fn().mockResolvedValue(true),
    resetPassword: vi.fn().mockResolvedValue(true),
    signOut: vi.fn().mockResolvedValue(undefined),
    savePreferences: vi.fn().mockResolvedValue(true),
    ...overrides,
  };
}

describe('Supabase Auth UI, Cloud Preferences & Server CSP', () => {
  it('renders HeaderAuthButton for guest and signed-in users cleanly', () => {
    const onOpen = vi.fn();
    const { rerender } = render(
      <HeaderAuthButton user={null} isInitializing={false} onOpenModal={onOpen} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /sign in to pranapulse ai/i }));
    expect(onOpen).toHaveBeenCalledTimes(1);

    rerender(
      <HeaderAuthButton user={makeMockUser()} isInitializing={false} onOpenModal={onOpen} />,
    );
    expect(screen.getByText('Aarav Sharma')).toBeInTheDocument();
    expect(getUserDisplayName(makeMockUser({ user_metadata: {} }))).toBe('aarav');
  });

  it('handles Sign in, Create account, Reset tabs, Escape close, and passes axe-core WCAG 2.2 AA', async () => {
    const auth = makeMockAuth();
    const onClose = vi.fn();
    const { container } = render(
      <AuthModal
        isOpen={true}
        auth={auth}
        workspaceInput={DEFAULT_WORKSPACE_INPUT}
        onClose={onClose}
      />,
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    const a11yResults = await axe.run(container, {
      rules: { 'color-contrast': { enabled: false } },
    });
    expect(a11yResults.violations).toHaveLength(0);

    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: 'aarav@example.com' },
    });
    fireEvent.change(screen.getByLabelText(/^password$/i), {
      target: { value: 'secret123' },
    });
    fireEvent.click(screen.getByRole('button', { name: /sign in to workspace/i }));
    await waitFor(() => {
      expect(auth.signIn).toHaveBeenCalledWith('aarav@example.com', 'secret123');
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getByRole('tab', { name: /create account/i }));
    fireEvent.change(screen.getByLabelText(/display name/i), {
      target: { value: 'Aarav Sharma' },
    });
    fireEvent.change(screen.getByLabelText(/^password$/i), {
      target: { value: 'newpass123' },
    });
    fireEvent.click(screen.getByRole('button', { name: /create cloud account/i }));
    await waitFor(() => {
      expect(auth.signUp).toHaveBeenCalledWith('aarav@example.com', 'newpass123', 'Aarav Sharma');
    });

    fireEvent.click(screen.getByRole('tab', { name: /reset/i }));
    fireEvent.click(screen.getByRole('button', { name: /send password reset link/i }));
    await waitFor(() => {
      expect(auth.resetPassword).toHaveBeenCalledWith('aarav@example.com');
    });

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('renders signed-in cloud profile with save/sign-out actions and zero axe violations', async () => {
    const user = makeMockUser();
    const auth = makeMockAuth({
      user,
      noticeMessage: 'Workspace settings saved to your Supabase profile.',
      syncStatus: 'saved',
      lastSavedAt: '2026-11-19T07:30:00.000Z',
    });

    const { container } = render(
      <AuthModal
        isOpen={true}
        auth={auth}
        workspaceInput={DEFAULT_WORKSPACE_INPUT}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText('Aarav Sharma')).toBeInTheDocument();
    expect(screen.getByText(DEFAULT_WORKSPACE_INPUT.city)).toBeInTheDocument();

    const a11yResults = await axe.run(container, {
      rules: { 'color-contrast': { enabled: false } },
    });
    expect(a11yResults.violations).toHaveLength(0);

    expect(
      screen.queryByRole('button', { name: /save workspace to cloud/i }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /sign out/i }));
    expect(auth.signOut).toHaveBeenCalledTimes(1);
  });

  it('validates cloud workspace preferences round-trip and rejects corrupt metadata', () => {
    const payload = buildCloudPreferencesPayload(DEFAULT_WORKSPACE_INPUT);
    const validUser = makeMockUser({
      user_metadata: { pranapulsePrefs: payload },
    });
    const parsed = extractSavedPreferences(validUser);
    expect(parsed?.city).toBe(DEFAULT_WORKSPACE_INPUT.city);
    expect(parsed?.cadrM3Hr).toBe(DEFAULT_WORKSPACE_INPUT.cadrM3Hr);

    const corruptUser = makeMockUser({
      user_metadata: { pranapulsePrefs: { city: '', lat: 999 } },
    });
    expect(extractSavedPreferences(corruptUser)).toBeNull();
  });

  it('allows only validated HTTPS Supabase origin in Helmet CSP connect-src', async () => {
    const strictApp = createApp(loadServerEnv({ NODE_ENV: 'test' }));
    const strictRes = await invokeExpress(strictApp, { url: '/api/health' });
    expect(strictRes.headers['content-security-policy']).toContain("connect-src 'self';");
    expect(strictRes.body).toMatchObject({ capabilities: { supabaseConfigured: false } });

    const supabaseApp = createApp(
      loadServerEnv({
        NODE_ENV: 'test',
        VITE_SUPABASE_URL: 'https://example.supabase.co/auth/v1',
      }),
    );
    const supabaseRes = await invokeExpress(supabaseApp, { url: '/api/health' });
    expect(supabaseRes.headers['content-security-policy']).toContain(
      "connect-src 'self' https://example.supabase.co;",
    );
    expect(supabaseRes.body).toMatchObject({ capabilities: { supabaseConfigured: true } });

    const insecureApp = createApp(
      loadServerEnv({
        NODE_ENV: 'test',
        VITE_SUPABASE_URL: 'http://insecure.supabase.co',
      }),
    );
    const insecureRes = await invokeExpress(insecureApp, { url: '/api/health' });
    expect(insecureRes.headers['content-security-policy']).toContain("connect-src 'self';");
    expect(insecureRes.body).toMatchObject({ capabilities: { supabaseConfigured: false } });
  });
});
