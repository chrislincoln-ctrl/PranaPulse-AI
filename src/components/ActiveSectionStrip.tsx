import { Activity, MapPin } from 'lucide-react';
import { memo, type ReactElement } from 'react';
import type { WorkbenchTabId } from '../config/uiConstants.js';
import type { TelemetrySnapshot } from '../domain/localBaseline.js';
import type { LocaleDictionary } from '../i18n/translations.js';
import { SectionInfoButton } from './SectionInfoTooltip.js';
import { getWorkbenchTabLabel } from './SegmentedTabs.js';
import { getAqiToneClass } from './TelemetryHero.js';

export interface ActiveSectionStripProps {
  readonly activeTab: WorkbenchTabId;
  readonly telemetry: TelemetrySnapshot;
  readonly onOpenDashboard: () => void;
  readonly t: LocaleDictionary;
}

/**
 * Slim single-row section header rendered on non-Dashboard tabs. Preserves
 * WCAG 2.2 AA heading hierarchy (single H1 above module H2 cards) while keeping
 * active city, live CPCB NAQI, and a 1-tap jump back to Dashboard visible.
 */
export const ActiveSectionStrip = memo(function ActiveSectionStrip({
  activeTab,
  telemetry,
  onOpenDashboard,
  t,
}: ActiveSectionStripProps): ReactElement {
  const safeAqi = telemetry.stationCrossCheck.effectiveSafetyAqi;
  const cityLabel = t.cityNames[telemetry.city] ?? telemetry.city;
  const categoryLabel = t.cpcbCategories[telemetry.assessment.cpcbCategory];

  return (
    <div
      className={`surface-hairline mb-5 flex flex-wrap items-center justify-between gap-2.5 px-4 py-3 sm:px-5 ${activeTab === 'community' ? 'print:hidden' : ''}`}
    >
      <div className="flex items-center gap-2.5">
        <span aria-hidden="true" className="h-6 w-1 rounded-full bg-accent" />
        <h1 className="text-xl font-bold tracking-tight text-ink sm:text-2xl">
          {getWorkbenchTabLabel(activeTab, t)}
        </h1>
        <span className="print:hidden">
          <SectionInfoButton
            tabId={activeTab}
            sectionLabel={getWorkbenchTabLabel(activeTab, t)}
            t={t}
          />
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="status-pill text-ink-2">
          <Activity className="h-3.5 w-3.5 shrink-0 text-cool" aria-hidden="true" />
          <span className="font-medium text-ink">{cityLabel}</span>
          <span aria-hidden="true">·</span>
          <span className={`measured font-semibold ${getAqiToneClass(safeAqi)}`}>
            {t.metricCpcbLabel} {String(safeAqi)}
          </span>
          <span className="hidden text-muted sm:inline">({categoryLabel})</span>
        </span>
        <button
          type="button"
          onClick={onOpenDashboard}
          className="btn-secondary touch-target inline-flex items-center gap-1.5 px-3 text-xs print:hidden"
        >
          <MapPin className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
          <span>{t.switchCityButton}</span>
        </button>
      </div>
    </div>
  );
});
