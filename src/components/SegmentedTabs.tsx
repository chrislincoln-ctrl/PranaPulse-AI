import { memo, useCallback, useEffect, useRef, type KeyboardEvent, type ReactElement } from 'react';
import { WORKBENCH_TABS, type WorkbenchTabId } from '../config/uiConstants.js';
import type { LocaleDictionary } from '../i18n/translations.js';
import { TabInfoIcon } from './SectionInfoTooltip.js';

export interface SegmentedTabsProps {
  readonly activeTab: WorkbenchTabId;
  readonly onSelectTab: (tab: WorkbenchTabId) => void;
  readonly t: LocaleDictionary;
}

const TAB_LABEL_KEYS: Record<
  WorkbenchTabId,
  keyof Pick<
    LocaleDictionary,
    'tabDashboard' | 'tabRoutine' | 'tabIndoor' | 'tabCommute' | 'tabGear' | 'tabCommunity'
  >
> = {
  dashboard: 'tabDashboard',
  routine: 'tabRoutine',
  indoor: 'tabIndoor',
  commute: 'tabCommute',
  gear: 'tabGear',
  community: 'tabCommunity',
};

export function getWorkbenchTabLabel(tabId: WorkbenchTabId, t: LocaleDictionary): string {
  return t[TAB_LABEL_KEYS[tabId]];
}

function nextTabIndex(currentIndex: number, key: string, total: number): number | null {
  if (key === 'ArrowRight' || key === 'ArrowDown') {
    return (currentIndex + 1) % total;
  }
  if (key === 'ArrowLeft' || key === 'ArrowUp') {
    return (currentIndex - 1 + total) % total;
  }
  if (key === 'Home') {
    return 0;
  }
  if (key === 'End') {
    return total - 1;
  }
  return null;
}

function TabButton({
  tabId,
  label,
  selected,
  assignRef,
  onSelect,
  onKeyDown,
}: {
  readonly tabId: WorkbenchTabId;
  readonly label: string;
  readonly selected: boolean;
  readonly assignRef: (el: HTMLButtonElement | null) => void;
  readonly onSelect: () => void;
  readonly onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void;
}): ReactElement {
  return (
    <button
      ref={assignRef}
      type="button"
      role="tab"
      id={`tab-${tabId}`}
      aria-selected={selected}
      aria-controls={`panel-${tabId}`}
      tabIndex={selected ? 0 : -1}
      onClick={onSelect}
      onKeyDown={onKeyDown}
      className="segmented-tab touch-target inline-flex items-center gap-1.5 text-sm"
    >
      <span>{label}</span>
      <TabInfoIcon tabId={tabId} />
    </button>
  );
}

/**
 * Accessible horizontal segmented workbench selector adapted from the 21st.dev
 * Segmented Control pattern with full WAI-ARIA roving tabindex keyboard navigation.
 */
export const SegmentedTabs = memo(function SegmentedTabs({
  activeTab,
  onSelectTab,
  t,
}: SegmentedTabsProps): ReactElement {
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    const activeIndex = WORKBENCH_TABS.indexOf(activeTab);
    const activeBtn = activeIndex >= 0 ? buttonRefs.current[activeIndex] : null;
    if (activeBtn && typeof activeBtn.scrollIntoView === 'function') {
      activeBtn.scrollIntoView({ inline: 'center', block: 'nearest' });
    }
  }, [activeTab]);

  const handleKeyDown = useCallback(
    (index: number, event: KeyboardEvent<HTMLButtonElement>): void => {
      const targetIndex = nextTabIndex(index, event.key, WORKBENCH_TABS.length);
      const targetTab = targetIndex !== null ? WORKBENCH_TABS[targetIndex] : undefined;
      if (targetIndex === null || !targetTab) {
        return;
      }
      event.preventDefault();
      onSelectTab(targetTab);
      buttonRefs.current[targetIndex]?.focus();
    },
    [onSelectTab],
  );

  return (
    <div role="tablist" aria-label={t.heroHeadline} className="segmented-rail">
      {WORKBENCH_TABS.map((tabId, index) => (
        <TabButton
          key={tabId}
          tabId={tabId}
          label={getWorkbenchTabLabel(tabId, t)}
          selected={activeTab === tabId}
          assignRef={(el) => {
            buttonRefs.current[index] = el;
          }}
          onSelect={() => {
            onSelectTab(tabId);
          }}
          onKeyDown={(e) => {
            handleKeyDown(index, e);
          }}
        />
      ))}
    </div>
  );
});
