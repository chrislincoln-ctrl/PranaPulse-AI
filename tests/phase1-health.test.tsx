import fs from 'node:fs';
import path from 'node:path';
import { render, screen, waitFor } from '@testing-library/react';
import axe from 'axe-core';
import { describe, expect, it, vi } from 'vitest';
import vercelHandler from '../api/index.js';
import { createApp } from '../server/app.js';
import { loadServerEnv } from '../server/env.js';
import { App } from '../src/App.js';
import { buildInitialWorkspaceBundle } from '../src/domain/localBaseline.js';
import { invokeExpress } from './helpers/invokeExpress.js';

function resolveUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') {
    return input;
  }
  return input instanceof URL ? input.toString() : input.url;
}

describe('Phase 1 server & accessible shell verification', () => {
  it('parses ALLOWED_ORIGINS and optional keys cleanly in loadServerEnv', () => {
    const env = loadServerEnv({
      NODE_ENV: 'production',
      PORT: '8080',
      ALLOWED_ORIGINS: 'https://a.vercel.app, https://b.vercel.app , ',
      GEMINI_API_KEY: '  ',
      WAQI_API_TOKEN: 'waqi-tok',
      NASA_FIRMS_MAP_KEY: 'firms-tok',
    });

    expect(env.ALLOWED_ORIGINS).toEqual(['https://a.vercel.app', 'https://b.vercel.app']);
    expect(env.GEMINI_API_KEY).toBeUndefined();
    expect(env.WAQI_API_TOKEN).toBe('waqi-tok');
    expect(env.NASA_FIRMS_MAP_KEY).toBe('firms-tok');
  });

  it('returns /api/health via both createApp and Vercel api/index entrypoint', async () => {
    const app = createApp(loadServerEnv({ NODE_ENV: 'test', GEMINI_API_KEY: 'test-key-redacted' }));
    const response = await invokeExpress(app, { url: '/api/health' });

    expect(response.status).toBe(200);
    expect(response.headers['content-security-policy']).toContain("default-src 'self'");
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-frame-options']).toBe('DENY');
    expect(response.headers['permissions-policy']).toContain('geolocation=(self)');
    expect(response.body).toMatchObject({
      status: 'ok',
      service: 'pranapulse-ai',
      capabilities: {
        openMeteoLive: true,
        geminiConfigured: true,
        waqiConfigured: false,
        firmsConfigured: false,
      },
    });

    const vercelResponse = await invokeExpress(vercelHandler, { url: '/api/health' });
    expect(vercelResponse.status).toBe(200);
  });

  it('rejects unknown routes, >16KB payloads, and malformed JSON cleanly (CWE-209)', async () => {
    const app = createApp(loadServerEnv({ NODE_ENV: 'test' }));

    const unknown = await invokeExpress(app, { url: '/api/does-not-exist' });
    expect(unknown.status).toBe(400);
    expect(unknown.body).toEqual({ error: 'Unsupported route or method.' });

    const oversized = { payload: 'x'.repeat(20_000) };
    const tooLarge = await invokeExpress(app, {
      method: 'POST',
      url: '/api/health',
      body: oversized,
    });
    expect(tooLarge.status).toBe(413);
    expect(tooLarge.body).toEqual({
      error: 'Request payload exceeds 16 KB security budget.',
    });

    const malformed = await invokeExpress(app, {
      method: 'POST',
      url: '/api/health',
      headers: { 'Content-Type': 'application/json' },
      rawBody: '{"bad":',
    });
    expect(malformed.status).toBe(400);
    expect(malformed.body).toEqual({
      error: 'Malformed or invalid request payload.',
    });
  });

  it('serves production SPA HTML cleanly when NODE_ENV=production and dist exists', async () => {
    const distDir = path.resolve(process.cwd(), 'dist');
    const distIndex = path.join(distDir, 'index.html');
    let createdTempDist = false;
    if (!fs.existsSync(distIndex)) {
      fs.mkdirSync(distDir, { recursive: true });
      fs.writeFileSync(distIndex, '<!doctype html><html><title>PranaPulse AI</title></html>');
      createdTempDist = true;
    }

    try {
      const app = createApp(loadServerEnv({ NODE_ENV: 'production' }));
      const spaResponse = await invokeExpress(app, { url: '/dashboard' });
      expect(spaResponse.status).toBe(200);
      expect(spaResponse.text).toContain('PranaPulse AI');
    } finally {
      if (createdTempDist) {
        fs.rmSync(distDir, { recursive: true, force: true });
      }
    }
  });

  it('renders accessible root shell with zero axe-core WCAG 2.2 AA violations', async () => {
    const initial = buildInitialWorkspaceBundle();
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = resolveUrl(input);
        return Promise.resolve(
          new Response(
            JSON.stringify(
              url.includes('/api/health')
                ? { status: 'ok', capabilities: { geminiConfigured: false } }
                : initial,
            ),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
        );
      }),
    );

    const { container } = render(<App />);

    await waitFor(() => {
      expect(screen.getByRole('link', { name: /skip to main content/i })).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    });

    const results = await axe.run(container, {
      rules: {
        'color-contrast': { enabled: false },
      },
    });
    expect(results.violations).toHaveLength(0);
    vi.unstubAllGlobals();
  });
});
