import { AlertTriangle } from 'lucide-react';
import { memo, type ReactElement } from 'react';
import { A11Y_CONSTANTS } from '../config/constants.js';
import type { TelemetrySnapshot } from '../domain/localBaseline.js';
import type { LocaleDictionary } from '../i18n/translations.js';

export interface SevereAlertBannerProps {
  readonly telemetry: TelemetrySnapshot;
  readonly t: LocaleDictionary;
}

/**
 * Assertive severe-AQI and station-disagreement alert hoisted above the active
 * workbench panel so urgent air-quality warnings remain visible across every section.
 */
export const SevereAlertBanner = memo(function SevereAlertBanner({
  telemetry,
  t,
}: SevereAlertBannerProps): ReactElement | null {
  const safeAqi = telemetry.stationCrossCheck.effectiveSafetyAqi;
  const isSevere = safeAqi >= A11Y_CONSTANTS.SEVERE_AQI_ALERT_THRESHOLD;
  const hasDisagreement = telemetry.stationCrossCheck.disagreementDetected;
  if (!isSevere && !hasDisagreement) {
    return null;
  }
  const cityLabel = t.cityNames[telemetry.city] ?? telemetry.city;

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="mb-4 flex items-start gap-3 rounded border border-bad bg-bad-soft px-4 py-2.5 text-sm text-ink"
    >
      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-bad" aria-hidden="true" />
      <div>
        {isSevere && (
          <p className="font-semibold text-bad">
            {t.severeBannerPrefix} CPCB NAQI {safeAqi} ({cityLabel})
          </p>
        )}
        {hasDisagreement && <p className="text-ink-2">{t.disagreementBannerText}</p>}
      </div>
    </div>
  );
});
