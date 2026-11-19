import { ExternalLink, Navigation } from 'lucide-react';
import { type ReactElement } from 'react';
import { VALIDATION_BOUNDS } from '../config/constants.js';
import type { CorridorPlanFeedback } from '../hooks/useCityCorridorPlanner.js';
import type { LocaleDictionary } from '../i18n/translations.js';
import { VerificationBanner } from './CustomVerifiedSelect.js';

export {
  useCityCorridorPlanner,
  type CorridorPlanFeedback,
} from '../hooks/useCityCorridorPlanner.js';

export interface RouteOriginDestPlannerProps {
  readonly fromArea: string;
  readonly toArea: string;
  readonly loading: boolean;
  readonly feedback: CorridorPlanFeedback | null;
  readonly googleMapsUrl: string;
  readonly setFromArea: (val: string) => void;
  readonly setToArea: (val: string) => void;
  readonly runCorridorPlan: () => void;
  readonly t: LocaleDictionary;
}

function AreaTextInput(props: {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly onChange: (val: string) => void;
}): ReactElement {
  return (
    <div>
      <label htmlFor={props.id} className="mb-1 block text-xs text-muted">
        {props.label}
      </label>
      <input
        id={props.id}
        type="text"
        value={props.value}
        maxLength={VALIDATION_BOUNDS.MAX_CITY_QUERY_LEN}
        onChange={(e) => {
          props.onChange(e.target.value);
        }}
        className="field-control text-sm"
      />
    </div>
  );
}

function RouteActionBar(props: {
  readonly canPlan: boolean;
  readonly loading: boolean;
  readonly googleMapsUrl: string;
  readonly onPlanRoute: () => void;
  readonly t: LocaleDictionary;
}): ReactElement {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={props.onPlanRoute}
        disabled={!props.canPlan}
        className="btn-primary touch-target inline-flex items-center gap-2 text-xs"
      >
        <Navigation className="h-3.5 w-3.5" aria-hidden="true" />
        <span>{props.loading ? props.t.planningRouteButton : props.t.planRouteButton}</span>
      </button>
      <a
        href={props.googleMapsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="btn-secondary touch-target inline-flex items-center gap-1.5 text-xs no-underline"
      >
        <ExternalLink className="h-3.5 w-3.5 text-cool" aria-hidden="true" />
        <span>{props.t.openGoogleMapsButton}</span>
      </a>
    </div>
  );
}

/**
 * Origin and Destination area selector paired with live AI connectivity verification
 * and direct Google Maps clean-corridor navigation.
 */
export function RouteOriginDestPlanner(p: RouteOriginDestPlannerProps): ReactElement {
  const canPlan = !p.loading && Boolean(p.fromArea.trim()) && Boolean(p.toArea.trim());

  return (
    <div className="surface-recessed mb-4 p-3.5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <AreaTextInput
          id="corridor-from-input"
          label={p.t.originAreaLabel}
          value={p.fromArea}
          onChange={p.setFromArea}
        />
        <AreaTextInput
          id="corridor-to-input"
          label={p.t.destinationAreaLabel}
          value={p.toArea}
          onChange={p.setToArea}
        />
      </div>
      <RouteActionBar
        canPlan={canPlan}
        loading={p.loading}
        googleMapsUrl={p.googleMapsUrl}
        onPlanRoute={p.runCorridorPlan}
        t={p.t}
      />
      {p.feedback && (
        <VerificationBanner isValid={p.feedback.isValid} message={p.feedback.routeSummary} />
      )}
    </div>
  );
}
