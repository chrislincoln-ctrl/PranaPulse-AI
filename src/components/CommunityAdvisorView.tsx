import { Building2 } from 'lucide-react';
import { memo, useState, type ReactElement } from 'react';
import {
  PRECISION_DISPLAY,
  RADIAL_GAUGE_GEOMETRY,
  SLIDER_LIMITS,
  UI_TIMINGS,
} from '../config/uiConstants.js';
import type { TelemetrySnapshot } from '../domain/localBaseline.js';
import type { RwaCollectiveImpact } from '../domain/types.js';
import type { LocaleDictionary } from '../i18n/translations.js';
import type { PlanRequestPayload } from '../validators/schemas.js';
import { RangeField } from './FormFields.js';
import { RadialGaugeSvg } from './RadialGaugeSvg.js';
import { RwaBulletinCard } from './RwaBulletinCard.js';

export interface CommunityAdvisorViewProps {
  readonly input: PlanRequestPayload;
  readonly telemetry: TelemetrySnapshot;
  readonly rwa: RwaCollectiveImpact;
  readonly groqConfigured?: boolean | undefined;
  readonly onUpdateInput: (patch: Partial<PlanRequestPayload>) => void;
  readonly t: LocaleDictionary;
}

function formatBulletinText(
  input: PlanRequestPayload,
  telemetry: TelemetrySnapshot,
  rwa: RwaCollectiveImpact,
  t: LocaleDictionary,
): string {
  const safeAqi = telemetry.stationCrossCheck.effectiveSafetyAqi;
  const ventAdvice = telemetry.inversion.openWindowsNow ? t.openWindowsYes : t.openWindowsNo;
  const cityLabel = t.cityNames[telemetry.city] ?? telemetry.city;
  return [
    `${t.appTitle}: ${cityLabel} ${t.ui.rwaNoticeSuffix}`,
    `CPCB NAQI: ${String(safeAqi)} (${t.cpcbCategories[telemetry.assessment.cpcbCategory]})`,
    ventAdvice,
    `${t.householdsLabel}: ${String(rwa.householdsParticipating)} | ${t.co2SavedDailyLabel}: ${String(rwa.dailyCo2SavedKg)} kg | ${t.pm25AvoidedDailyLabel}: ${String(rwa.dailyPm25AvoidedG)} g`,
    `${t.ui.rwaLanguagePrefix}: ${t.languageNames[input.language]}`,
  ].join('\n');
}

function HaltBurningToggle({
  checked,
  label,
  onChange,
}: {
  readonly checked: boolean;
  readonly label: string;
  readonly onChange: (nextChecked: boolean) => void;
}): ReactElement {
  return (
    <label
      htmlFor="halt-burning-check"
      className="touch-target flex items-center gap-3 text-sm text-ink"
    >
      <input
        id="halt-burning-check"
        type="checkbox"
        checked={checked}
        onChange={(e) => {
          onChange(e.target.checked);
        }}
        className="h-5 w-5 accent-accent"
      />
      <span>{label}</span>
    </label>
  );
}

function RwaControlsBlock({
  input,
  onUpdateInput,
  t,
}: {
  readonly input: PlanRequestPayload;
  readonly onUpdateInput: (patch: Partial<PlanRequestPayload>) => void;
  readonly t: LocaleDictionary;
}): ReactElement {
  const shiftPct = Math.round(input.transitShiftShare * PRECISION_DISPLAY.PERCENT_MULTIPLIER);
  return (
    <div className="mt-4 space-y-4">
      <RangeField
        id="households-slider"
        label={t.householdsLabel}
        valueText={String(input.householdsParticipating)}
        min={SLIDER_LIMITS.HOUSEHOLDS_MIN}
        max={SLIDER_LIMITS.HOUSEHOLDS_MAX}
        step={SLIDER_LIMITS.HOUSEHOLDS_STEP}
        value={input.householdsParticipating}
        onChangeValue={(householdsParticipating) => {
          onUpdateInput({ householdsParticipating });
        }}
      />
      <RangeField
        id="transit-shift-slider"
        label={t.transitShiftLabel}
        valueText={`${String(shiftPct)}%`}
        min={SLIDER_LIMITS.TRANSIT_SHIFT_MIN_PCT}
        max={SLIDER_LIMITS.TRANSIT_SHIFT_MAX_PCT}
        step={SLIDER_LIMITS.TRANSIT_SHIFT_STEP_PCT}
        value={shiftPct}
        onChangeValue={(pct) => {
          onUpdateInput({ transitShiftShare: pct / PRECISION_DISPLAY.PERCENT_MULTIPLIER });
        }}
      />
      <HaltBurningToggle
        checked={input.haltLeafBurning}
        label={t.haltLeafBurningLabel}
        onChange={(haltLeafBurning) => {
          onUpdateInput({ haltLeafBurning });
        }}
      />
    </div>
  );
}

function RwaMetricsStrip({
  rwa,
  transitShiftShare,
  t,
}: {
  readonly rwa: RwaCollectiveImpact;
  readonly transitShiftShare: number;
  readonly t: LocaleDictionary;
}): ReactElement {
  const shiftPct = Math.round(transitShiftShare * PRECISION_DISPLAY.PERCENT_MULTIPLIER);
  const homePct = Math.round(
    (rwa.householdsParticipating / SLIDER_LIMITS.HOUSEHOLDS_MAX) *
      PRECISION_DISPLAY.PERCENT_MULTIPLIER,
  );
  return (
    <div className="panels mt-6">
      <div className="panel flex items-center justify-between gap-2">
        <div>
          <div className="text-xs text-ink-2">{t.co2SavedDailyLabel}</div>
          <div className="measured mt-1 text-xl font-semibold text-ok">
            {rwa.dailyCo2SavedKg} kg
          </div>
        </div>
        <RadialGaugeSvg
          outerPercent={shiftPct}
          outerColor="var(--color-ok)"
          innerPercent={homePct}
          innerColor="var(--color-accent)"
          centerText={`${String(shiftPct)}%`}
          size={RADIAL_GAUGE_GEOMETRY.COMPACT_SIZE_PX}
        />
      </div>
      <div className="panel">
        <div className="text-xs text-ink-2">{t.pm25AvoidedDailyLabel}</div>
        <div className="measured mt-1 text-xl font-semibold text-accent">
          {rwa.dailyPm25AvoidedG} g
        </div>
      </div>
    </div>
  );
}

/**
 * Neighborhood RWA collective impact simulator and clipboard/WhatsApp/print bulletin generator.
 */
export const CommunityAdvisorView = memo(function CommunityAdvisorView({
  input,
  telemetry,
  rwa,
  onUpdateInput,
  t,
}: CommunityAdvisorViewProps): ReactElement {
  const [copied, setCopied] = useState(false);
  const bulletinText = formatBulletinText(input, telemetry, rwa, t);

  return (
    <div className="grid grid-cols-1 gap-6 sm:gap-8 lg:grid-cols-12">
      <section
        aria-labelledby="rwa-heading"
        className="surface-hairline min-w-0 p-4 sm:p-6 lg:col-span-6"
      >
        <div className="flex items-center gap-2.5">
          <span
            aria-hidden="true"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-cool/40 bg-cool-soft text-cool"
          >
            <Building2 className="h-4 w-4" />
          </span>
          <h2 id="rwa-heading" className="text-ink">
            {t.rwaSectionHeading}
          </h2>
        </div>
        <RwaControlsBlock input={input} onUpdateInput={onUpdateInput} t={t} />
        <RwaMetricsStrip rwa={rwa} transitShiftShare={input.transitShiftShare} t={t} />
      </section>
      <RwaBulletinCard
        bulletinPreview={bulletinText}
        copied={copied}
        onCopy={() => {
          void navigator.clipboard.writeText(bulletinText).then(() => {
            setCopied(true);
            setTimeout(() => {
              setCopied(false);
            }, UI_TIMINGS.COPY_RESET_MS);
          });
        }}
        t={t}
      />
    </div>
  );
});
