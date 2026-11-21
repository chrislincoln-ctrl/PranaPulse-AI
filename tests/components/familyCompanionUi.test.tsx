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

    // 1. Switch to Aarav's personal schedule tab and verify School steps + WhatsApp links
    fireEvent.click(screen.getByRole('tab', { name: /Aarav \(School\)/i }));
    expect(screen.getByText(/School Departure & Fitted Mask Check/i)).toBeInTheDocument();
    const waLinks = screen.getAllByRole('link', { name: /Share on WhatsApp/i });
    expect(waLinks.length).toBeGreaterThanOrEqual(1);
    expect(waLinks[0]?.getAttribute('href')).toMatch(/^https:\/\/wa\.me\/\?text=/);

    // 2. Switch to Meera's personal schedule tab and confirm distinct Senior asthma schedule
    fireEvent.click(screen.getByRole('tab', { name: /Meera \(Senior\)/i }));
    expect(screen.getByText(/Strict Morning Indoor Seal & Inhaler Readiness/i)).toBeInTheDocument();

    // 3. Expand first member's daily habit editor & trigger Telegram pairing link
    const toggleButtons = screen.getAllByRole('button', {
      name: /Customize daily habits & Telegram/i,
    });
    fireEvent.click(toggleButtons[0]!);
    expect(screen.getByLabelText(/Leaves home/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Connect Telegram/i }));
    await waitFor(() => {
      expect(screen.getByRole('link', { name: /Open Telegram to pair/i })).toHaveAttribute(
        'href',
        'https://t.me/PranaPulseBot?start=abc123def4',
      );
    });

    // 4. Open floating bottom-right Family Companion Chat launcher and send a query
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
