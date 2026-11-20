import { Activity, Eye, Layers, Wind } from 'lucide-react';
import { memo, type ReactElement } from 'react';
import {
  SMOG_SIMULATION_PARAMS,
  type InversionSimulationMode,
} from '../config/uiConstants.js';
import type { LocaleDictionary } from '../i18n/translations.js';

export interface SmogSimulationControlProps {
  readonly mode: InversionSimulationMode;
  readonly onToggleMode: (mode: InversionSimulationMode) => void;
  readonly t: LocaleDictionary;
}

interface HudMetricItemProps {
  readonly icon: typeof Layers;
  readonly label: string;
  readonly value: string;
  readonly alert?: boolean;
}

function HudMetricItem({
  icon: Icon,
  label,
  value,
  alert = false,
}: HudMetricItemProps): ReactElement {
  return (
    <div className="flex items-center gap-2 rounded border border-rule bg-paper-2/80 px-2.5 py-1.5 backdrop-blur-xs">
      <Icon
        className={`h-4 w-4 shrink-0 ${alert ? 'text-warn' : 'text-cool'}`}
        aria-hidden="true"
      />
      <div className="text-left text-xs">
        <span className="block text-muted">{label}</span>
        <span className="font-mono font-semibold text-ink">{value}</span>
      </div>
    </div>
  );
}

function ModeToggleButtons({
  mode,
  onToggleMode,
  t,
}: SmogSimulationControlProps): ReactElement {
  return (
    <div
      role="group"
      aria-label="Atmospheric Simulation Mode"
      className="inline-flex flex-wrap gap-2"
    >
      <button
        type="button"
        onClick={() => {
          onToggleMode('severe');
        }}
        aria-pressed={mode === 'severe'}
        className={`touch-target rounded px-3 py-2 text-xs font-semibold tracking-wide transition-colors ${
          mode === 'severe'
            ? 'bg-warn text-paper shadow-sm'
            : 'border border-rule bg-paper text-ink-2 hover:bg-paper-2'
        }`}
      >
        <span className="inline-flex items-center gap-1.5">
          <Activity className="h-3.5 w-3.5" aria-hidden="true" />
          {t.landingSimulateSevere}
        </span>
      </button>

      <button
        type="button"
        onClick={() => {
          onToggleMode('clean');
        }}
        aria-pressed={mode === 'clean'}
        className={`touch-target rounded px-3 py-2 text-xs font-semibold tracking-wide transition-colors ${
          mode === 'clean'
            ? 'bg-cool text-paper shadow-sm'
            : 'border border-rule bg-paper text-ink-2 hover:bg-paper-2'
        }`}
      >
        <span className="inline-flex items-center gap-1.5">
          <Wind className="h-3.5 w-3.5" aria-hidden="true" />
          {t.landingSimulateClean}
        </span>
      </button>
    </div>
  );
}

export const SmogSimulationControl = memo(function SmogSimulationControl({
  mode,
  onToggleMode,
  t,
}: SmogSimulationControlProps): ReactElement {
  const isSevere = mode === 'severe';

  const pblValue = isSevere
    ? `${SMOG_SIMULATION_PARAMS.SEVERE_PBL_METERS.toString()} m (Trapping)`
    : `${SMOG_SIMULATION_PARAMS.CLEAN_PBL_METERS.toString()} m (Mixed)`;

  const pm25Value = isSevere
    ? `${SMOG_SIMULATION_PARAMS.SEVERE_PM25.toString()} µg/m³ (AQI ${SMOG_SIMULATION_PARAMS.SEVERE_AQI.toString()})`
    : `${SMOG_SIMULATION_PARAMS.CLEAN_PM25.toString()} µg/m³ (AQI ${SMOG_SIMULATION_PARAMS.CLEAN_AQI.toString()})`;

  const visValue = isSevere
    ? `< ${SMOG_SIMULATION_PARAMS.SEVERE_VISIBILITY_METERS.toString()} m (Dense Smog)`
    : `> ${SMOG_SIMULATION_PARAMS.CLEAN_VISIBILITY_METERS.toString()} m (Clear)`;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <ModeToggleButtons
          mode={mode}
          onToggleMode={onToggleMode}
          t={t}
        />
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <HudMetricItem
          icon={Layers}
          label={t.landingInversionCeilingLabel}
          value={pblValue}
          alert={isSevere}
        />
        <HudMetricItem
          icon={Activity}
          label={t.landingEstimatedPm25Label}
          value={pm25Value}
          alert={isSevere}
        />
        <HudMetricItem
          icon={Eye}
          label={t.landingVisibilityLabel}
          value={visValue}
          alert={isSevere}
        />
      </div>

      <p className="text-xs text-muted">
        {isSevere ? t.landingSevereInversionDesc : t.landingCleanAirDesc}
      </p>
    </div>
  );
});
