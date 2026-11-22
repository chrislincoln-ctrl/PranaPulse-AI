import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FamilyCompanionChat } from '../../src/components/FamilyCompanionChat.js';
import { FamilyRoutineView } from '../../src/components/FamilyRoutineView.js';
import { DEFAULT_WORKSPACE_INPUT } from '../../src/config/uiConstants.js';
import { buildInitialWorkspaceBundle } from '../../src/domain/localBaseline.js';
import { TRANSLATIONS } from '../../src/i18n/translations.js';

describe('Per-member Family Routine UI, WhatsApp share & Companion Chat', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('switches per-member schedule tabs, renders 1-click WhatsApp share, expands habit drawer & updates via chat', async () => {
    const bundle = buildInitialWorkspaceBundle(DEFAULT_WORKSPACE_INPUT);
    const onUpdateInput = vi.fn();

    vi.stubGlobal(
      'fetch',
      vi.fn((urlArg: RequestInfo | URL) => {
        let url = '';
        if (typeof urlArg === 'string') {
          url = urlArg;
        } else if (urlArg instanceof URL) {
          url = urlArg.href;
        } else {
          url = urlArg.url;
        }
        if (url.includes('/api/companion/chat')) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                reply: 'Meera (Salt Lake): Live CPCB NAQI 248. Stay indoors with HEPA running.',
                resolvedCity: 'Salt Lake',
                aqi: 248,
                pm25UgM3: 138,
                pblMeters: 310,
                windKmh: 8,
                rhPercent: 72,
                habitPatch: { leaveHomeTime: '13:30', healthNotes: 'Mild asthma today' },
              }),
              { status: 200, headers: { 'Content-Type': 'application/json' } },
            ),
          );
        }
        return Promise.resolve(
          new Response(
            JSON.stringify({
              linkCode: 'abc123def4',
              deepLinkUrl: 'https://t.me/PranaPulseBot?start=abc123def4',
              telegramConfigured: true,
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
        );
      }),
    );

    render(
      <>
        <FamilyRoutineView
          input={DEFAULT_WORKSPACE_INPUT}
          advisories={bundle.memberAdvisories}
          aiPlan={bundle.aiPlan}
          aiIsFallback={true}
          isLoadingPlan={false}
          onUpdateInput={onUpdateInput}
          onRefreshPlan={vi.fn()}
          t={TRANSLATIONS.en}
        />
        <FamilyCompanionChat
          input={DEFAULT_WORKSPACE_INPUT}
          memberSchedules={bundle.aiPlan.memberSchedules ?? []}
          onApplyMemberPatch={(memberId, patch) => {
            onUpdateInput({
              members: DEFAULT_WORKSPACE_INPUT.members.map((m) =>
                m.id === memberId ? { ...m, ...patch } : m,
              ),
            });
          }}
          t={TRANSLATIONS.en}
        />
      </>,
    );

    // 1. Verify "All Household" tab is removed, Aarav is selected by default, and School steps + WhatsApp links render
    expect(screen.queryByRole('tab', { name: /All Household/i })).not.toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Aarav \(School\)/i })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByText(/School Departure & Fitted Mask Check/i)).toBeInTheDocument();
    const waLinks = screen.getAllByRole('link', { name: /Share on WhatsApp/i });
    expect(waLinks.length).toBeGreaterThanOrEqual(1);
    expect(waLinks[0]?.getAttribute('href')).toMatch(/^https:\/\/wa\.me\/\?text=/);

    // 2. Switch to Meera's personal schedule tab and confirm distinct Senior asthma schedule
    fireEvent.click(screen.getByRole('tab', { name: /Meera \(Senior\)/i }));
    expect(screen.getByText(/Strict Morning Indoor Seal & Inhaler Readiness/i)).toBeInTheDocument();

    // 3. Expand first member's daily habit editor & verify NO Telegram buttons inside the roster
    const toggleButtons = screen.getAllByRole('button', {
      name: /Customize daily habits/i,
    });
    fireEvent.click(toggleButtons[0]!);
    expect(screen.getByLabelText(/Leaves home/i)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Open Telegram to pair/i })).not.toBeInTheDocument();

    // 4. Click the single floating 1-click Telegram button above Companion Chat and verify direct redirect
    const fakePopup = { closed: false, opener: window, location: { href: '' }, close: vi.fn() };
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(fakePopup as unknown as Window);
    const tgButton = screen.getByRole('button', { name: /Connect Telegram/i });
    fireEvent.click(tgButton);
    await waitFor(() => {
      expect(openSpy).toHaveBeenCalled();
      expect(fakePopup.location.href).toBe('https://t.me/PranaPulseBot?start=abc123def4');
    });

    // 5. Open floating bottom-right Family Companion Chat launcher and send a query
    fireEvent.click(screen.getByRole('button', { name: /Family Daily Companion Chat/i }));
    const chatInput = screen.getByLabelText(/Ask e\.g\./i);
    fireEvent.change(chatInput, { target: { value: 'Near Salt Lake, mild asthma today' } });
    fireEvent.click(screen.getByRole('button', { name: /Ask Companion/i }));

    await waitFor(() => {
      expect(screen.getByText(/Live CPCB NAQI 248/i)).toBeInTheDocument();
      expect(screen.getByText(/Applied to daily schedule/i)).toBeInTheDocument();
      expect(onUpdateInput).toHaveBeenCalled();
    });
  });
});
