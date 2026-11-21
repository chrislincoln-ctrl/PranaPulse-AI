import { ChevronLeft, ChevronRight } from 'lucide-react';
import { memo, type ReactElement } from 'react';
import { WORKBENCH_TABS, type WorkbenchTabId } from '../config/uiConstants.js';
import type { LocaleDictionary } from '../i18n/translations.js';
import { getWorkbenchTabLabel } from './SegmentedTabs.js';

export interface SectionStepperFooterProps {
  readonly activeTab: WorkbenchTabId;
  readonly onSelectTab: (tab: WorkbenchTabId) => void;
  readonly t: LocaleDictionary;
}

function StepperButton({
  direction,
  prefix,
  targetLabel,
  onClick,
}: {
  readonly direction: 'prev' | 'next';
  readonly prefix: string;
  readonly targetLabel: string;
  readonly onClick: () => void;
}): ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      className="btn-secondary touch-target inline-flex items-center gap-1.5 px-3 text-xs sm:gap-2 sm:px-4 sm:text-sm"
    >
      {direction === 'prev' && <ChevronLeft className="h-4 w-4 text-ink-2" aria-hidden="true" />}
      <span>
        {prefix}: {targetLabel}
      </span>
      {direction === 'next' && <ChevronRight className="h-4 w-4 text-accent" aria-hidden="true" />}
    </button>
  );
}

/**
 * Sequential Previous / Next section footer at the bottom of each workbench tab
 * so mobile and desktop users can step smoothly from Dashboard through every module.
 */
export const SectionStepperFooter = memo(function SectionStepperFooter({
  activeTab,
  onSelectTab,
  t,
}: SectionStepperFooterProps): ReactElement {
  const currentIndex = WORKBENCH_TABS.indexOf(activeTab);
  const prevTab = currentIndex > 0 ? WORKBENCH_TABS[currentIndex - 1] : undefined;
  const nextTab =
    currentIndex >= 0 && currentIndex < WORKBENCH_TABS.length - 1
      ? WORKBENCH_TABS[currentIndex + 1]
      : undefined;

  return (
    <nav
      aria-label={`${t.previousSectionLabel} / ${t.nextSectionLabel}`}
      className="section-stepper mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-rule pt-5"
    >
      <div>
        {prevTab ? (
          <StepperButton
            direction="prev"
            prefix={t.previousSectionLabel}
            targetLabel={getWorkbenchTabLabel(prevTab, t)}
            onClick={() => {
              onSelectTab(prevTab);
            }}
          />
        ) : (
          <span aria-hidden="true" />
        )}
      </div>
      <span className="measured text-xs text-muted">
        {String(currentIndex + 1)} / {String(WORKBENCH_TABS.length)}
      </span>
      <div>
        {nextTab ? (
          <StepperButton
            direction="next"
            prefix={t.nextSectionLabel}
            targetLabel={getWorkbenchTabLabel(nextTab, t)}
            onClick={() => {
              onSelectTab(nextTab);
            }}
          />
        ) : (
          <span aria-hidden="true" />
        )}
      </div>
    </nav>
  );
});
