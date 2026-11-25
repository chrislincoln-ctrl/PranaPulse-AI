import { Route } from 'lucide-react';
import { memo, type ReactElement } from 'react';
import type { CommuteModeId, CorridorRouteComparison } from '../domain/types.js';
import type { LocaleDictionary } from '../i18n/translations.js';
import type { SupportedLanguage } from '../validators/schemas.js';
import { CorridorSvgCanvas } from './CorridorSvgCanvas.js';
import { RouteOriginDestPlanner, useCityCorridorPlanner } from './RouteOriginDestPlanner.js';
import { SrDataTable } from './SrDataTable.js';

export interface CorridorNetworkFigureProps {
  readonly city: string;
  readonly commuteMode: CommuteModeId;
  readonly language: SupportedLanguage;
  readonly corridor: CorridorRouteComparison;
  readonly onUpdateDistanceKm: (km: number) => void;
  readonly t: LocaleDictionary;
}

function CorridorSummaryBar({
  corridor,
  commuteMode,
  stops,
  t,
}: {
  readonly corridor: CorridorRouteComparison;
  readonly commuteMode: CommuteModeId;
  readonly stops: readonly string[];
  readonly t: LocaleDictionary;
}): ReactElement {
  return (
    <>
      <div className="mb-2 flex flex-wrap gap-4 text-xs text-ink-2">
        <span className="font-medium text-accent">
          {t.corridorCleanLabel}: {corridor.lowestExposureUg} ug ({corridor.lowestExposureMinutes}{' '}
          {t.unitMin})
        </span>
        <span className="font-medium text-bad">
          {t.corridorDirectLabel}: {corridor.directRoadExposureUg} ug
        </span>
      </div>
      {commuteMode === 'metro' && stops.length > 0 && (
        <div className="mb-2 flex items-start gap-2 text-[11px] text-ink-2">
          <span className="shrink-0 rounded bg-accent-soft px-1.5 py-0.5 font-bold text-accent">
            M
          </span>
          <span>
            {t.ui.verifiedMetroStopsLabel} <strong className="text-ink">{stops.join(' · ')}</strong>
          </span>
        </div>
      )}
    </>
  );
}

/**
 * Interactive SVG Dijkstra clean-corridor network graph dynamically synced to the active city,
 * commute mode (surface parkway vs metro rail with station icons), respirator, and distance.
 */
export const CorridorNetworkFigure = memo(function CorridorNetworkFigure(
  props: CorridorNetworkFigureProps,
): ReactElement {
  const { corridor, commuteMode, t } = props;
  const p = useCityCorridorPlanner(props);

  return (
    <figure className="surface-hairline min-w-0 p-4 sm:p-6">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <figcaption className="flex items-center gap-2 font-semibold text-ink">
          <Route className="h-4 w-4 text-accent" aria-hidden="true" />
          <span>{t.corridorHeading}</span>
        </figcaption>
        <span className="measured text-sm font-semibold text-ok">
          -{corridor.exposureSavedUg} ug (-{corridor.exposureSavedPct}%)
        </span>
      </div>
      <RouteOriginDestPlanner {...p} t={t} />
      <CorridorSummaryBar
        corridor={corridor}
        commuteMode={commuteMode}
        stops={p.intermediateMetroStops}
        t={t}
      />
      <div className="-mx-1 overflow-x-auto px-1 pb-1">
        <CorridorSvgCanvas
          corridor={corridor}
          commuteMode={commuteMode}
          activeNodes={p.activeNodes}
          intermediateMetroStops={p.intermediateMetroStops}
          heading={t.corridorHeading}
        />
      </div>
      <SrDataTable
        caption={t.corridorHeading}
        headers={[t.ui.srTableFrom, t.ui.srTableTo, t.ui.srTableExposureUg, t.ui.srTableMinutes]}
        rows={corridor.segments.map((seg) => [
          p.activeNodes[seg.from],
          p.activeNodes[seg.to],
          seg.exposureUg,
          seg.minutes,
        ])}
      />
    </figure>
  );
});
