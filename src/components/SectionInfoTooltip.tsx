import { Info } from 'lucide-react';
import { memo, useCallback, useEffect, useId, useRef, useState, type ReactElement } from 'react';
import { createPortal } from 'react-dom';
import type { WorkbenchTabId } from '../config/uiConstants.js';

export interface SectionGuideInfo {
  readonly badge: string;
  readonly title: string;
  readonly summary: string;
}

export const SECTION_JUDGE_GUIDES: Readonly<Record<WorkbenchTabId, SectionGuideInfo>> = {
  dashboard: {
    badge: 'Section 1 · Telemetry',
    title: 'Live Atmospheric & Smog Dashboard',
    summary:
      'Cross-checks live ground air monitors (OpenAQ v3 & WAQI), 24h boundary-layer inversion forecasts (Open-Meteo), and 500km NASA FIRMS fire plumes to show CPCB NAQI, US-EPA AQI, and safe window-airing hours for any GPS location.',
  },
  routine: {
    badge: 'Section 2 · Household',
    title: 'Family Routine & Personalized Care',
    summary:
      'Computes per-member inhaled PM2.5 dose (ug/day) for children, seniors, and commuters, builds individualized 4-step daily schedules, and syncs edits live with Telegram and 1-tap WhatsApp briefs.',
  },
  indoor: {
    badge: 'Section 3 · Physics',
    title: 'Indoor Mass-Balance & CADR Clearance',
    summary:
      'Models 24h indoor vs. outdoor PM2.5 infiltration from room area, window tightness, cooking fuel, and HEPA purifier CADR (4.8 ACH target) to compute exact 90% purge time and exposure reduction.',
  },
  commute: {
    badge: 'Section 4 · Mobility',
    title: 'Low-Exposure Commute & Corridor Router',
    summary:
      'Compares 7 transit modes on inhaled PM2.5 dose vs. CO2 emissions to find Pareto-optimal commutes, and plans lower-exposure origin-to-destination city routes with direct Google Maps links.',
  },
  gear: {
    badge: 'Section 5 · Protection',
    title: 'Masks, HEPA Purifiers & DIY Alternatives',
    summary:
      'Compares mask filtration efficiency (N95/FFP2, surgical, cloth), calculates exact HEPA CADR or DIY MERV-13 Corsi-Rosenthal box sizing for your room, and surfaces matched buying options.',
  },
  community: {
    badge: 'Section 6 · Collective',
    title: 'RWA Neighborhood Impact & Notice',
    summary:
      'Simulates daily CO2 and PM2.5 avoided when housing-society homes adopt shared transit and halt open leaf burning, and builds a ready-to-share multilingual WhatsApp RWA notice.',
  },
};

const TOOLTIP_WIDTH_PX = 288;
const VIEWPORT_MARGIN_PX = 12;
const VERTICAL_OFFSET_PX = 10;
const HALF_DIVISOR = 2;

interface PopoverCoords {
  readonly top: number;
  readonly left: number;
}

function computePopoverCoords(rect: DOMRect): PopoverCoords {
  const vw = typeof window !== 'undefined' ? window.innerWidth : TOOLTIP_WIDTH_PX;
  const centered = rect.left + rect.width / HALF_DIVISOR - TOOLTIP_WIDTH_PX / HALF_DIVISOR;
  const maxLeft = Math.max(VIEWPORT_MARGIN_PX, vw - TOOLTIP_WIDTH_PX - VIEWPORT_MARGIN_PX);
  return {
    top: rect.bottom + VERTICAL_OFFSET_PX,
    left: Math.max(VIEWPORT_MARGIN_PX, Math.min(centered, maxLeft)),
  };
}

function TooltipCardPortal({
  id,
  guide,
  coords,
}: {
  readonly id: string;
  readonly guide: SectionGuideInfo;
  readonly coords: PopoverCoords | null;
}): ReactElement | null {
  if (!coords || typeof document === 'undefined') {
    return null;
  }
  return createPortal(
    <div
      id={id}
      role="tooltip"
      style={{ top: `${String(coords.top)}px`, left: `${String(coords.left)}px` }}
      className="pointer-events-none fixed z-[600] w-72 rounded-xl border border-accent/55 bg-paper-2/95 p-3.5 text-left shadow-2xl backdrop-blur-lg"
    >
      <div className="measured text-[10px] font-semibold tracking-wider text-accent uppercase">
        {guide.badge}
      </div>
      <div className="mt-1 text-xs font-bold text-ink">{guide.title}</div>
      <p className="mt-1 text-[11px] leading-relaxed text-ink-2">{guide.summary}</p>
    </div>,
    document.body,
  );
}

function useAnchorTooltip<T extends HTMLElement>() {
  const anchorRef = useRef<T | null>(null);
  const [coords, setCoords] = useState<PopoverCoords | null>(null);

  const open = useCallback((): void => {
    const el = anchorRef.current;
    if (el) {
      setCoords(computePopoverCoords(el.getBoundingClientRect()));
    }
  }, []);

  const close = useCallback((): void => {
    setCoords(null);
  }, []);

  useEffect(() => {
    if (!coords) {
      return undefined;
    }
    const dismiss = (): void => {
      setCoords(null);
    };
    window.addEventListener('scroll', dismiss, true);
    window.addEventListener('resize', dismiss);
    return () => {
      window.removeEventListener('scroll', dismiss, true);
      window.removeEventListener('resize', dismiss);
    };
  }, [coords]);

  return { anchorRef, coords, open, close };
}

/**
 * Non-interactive hoverable info icon safe to place inside a WAI-ARIA `role="tab"` button
 * without triggering nested-interactive accessibility violations.
 */
export const TabInfoIcon = memo(function TabInfoIcon({
  tabId,
}: {
  readonly tabId: WorkbenchTabId;
}): ReactElement {
  const tipId = useId();
  const { anchorRef, coords, open, close } = useAnchorTooltip<HTMLSpanElement>();
  return (
    <>
      <span
        ref={anchorRef}
        aria-hidden="true"
        onMouseEnter={open}
        onMouseLeave={close}
        className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-rule-2/80 bg-paper-3/70 text-ink-2 transition-colors hover:border-accent hover:bg-accent-soft hover:text-accent"
      >
        <Info className="h-3 w-3" />
      </span>
      <TooltipCardPortal id={tipId} guide={SECTION_JUDGE_GUIDES[tabId]} coords={coords} />
    </>
  );
});

/**
 * Interactive hover, focus, and tap info trigger placed next to each section heading
 * so judges and users can inspect what every module computes on desktop or mobile.
 */
export const SectionInfoButton = memo(function SectionInfoButton({
  tabId,
  sectionLabel,
}: {
  readonly tabId: WorkbenchTabId;
  readonly sectionLabel: string;
}): ReactElement {
  const tipId = useId();
  const { anchorRef, coords, open, close } = useAnchorTooltip<HTMLButtonElement>();
  const isOpen = coords !== null;

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        aria-label={`What ${sectionLabel} does`}
        aria-describedby={isOpen ? tipId : undefined}
        onMouseEnter={open}
        onMouseLeave={close}
        onFocus={open}
        onBlur={close}
        onClick={() => {
          if (isOpen) {
            close();
          } else {
            open();
          }
        }}
        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-accent/40 bg-paper-2/85 text-ink-2 transition-colors hover:border-accent hover:bg-accent-soft hover:text-accent focus-visible:outline-2 focus-visible:outline-accent"
      >
        <Info className="h-4 w-4" aria-hidden="true" />
      </button>
      <TooltipCardPortal id={tipId} guide={SECTION_JUDGE_GUIDES[tabId]} coords={coords} />
    </>
  );
});
