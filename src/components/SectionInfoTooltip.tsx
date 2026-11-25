import { Info } from 'lucide-react';
import { memo, useCallback, useEffect, useId, useRef, useState, type ReactElement } from 'react';
import { createPortal } from 'react-dom';
import type { WorkbenchTabId } from '../config/uiConstants.js';
import type { SectionGuideInfo } from '../i18n/authAndUiCopy.js';
import { TRANSLATIONS, type LocaleDictionary } from '../i18n/translations.js';

export type { SectionGuideInfo };

export const SECTION_JUDGE_GUIDES = TRANSLATIONS.en.sectionGuides;

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
  t = TRANSLATIONS.en,
}: {
  readonly tabId: WorkbenchTabId;
  readonly t?: LocaleDictionary;
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
      <TooltipCardPortal id={tipId} guide={t.sectionGuides[tabId]} coords={coords} />
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
  t = TRANSLATIONS.en,
}: {
  readonly tabId: WorkbenchTabId;
  readonly sectionLabel: string;
  readonly t?: LocaleDictionary;
}): ReactElement {
  const tipId = useId();
  const { anchorRef, coords, open, close } = useAnchorTooltip<HTMLButtonElement>();
  const isOpen = coords !== null;
  const ariaLabel = t.ui.sectionInfoAriaTemplate.replace('{section}', sectionLabel);

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        aria-label={ariaLabel}
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
      <TooltipCardPortal id={tipId} guide={t.sectionGuides[tabId]} coords={coords} />
    </>
  );
});
