import { AlertTriangle, CheckCircle2, Sprout } from 'lucide-react';
import { type ReactElement } from 'react';
import type {
  DynamicIndoorGuidance,
  DynamicPlantRecommendation,
} from '../config/indoorGuidanceResolver.js';
import type { LocaleDictionary } from '../i18n/translations.js';

export interface IndoorGuidancePanelsProps {
  readonly guidance: DynamicIndoorGuidance;
  readonly t: LocaleDictionary;
}

/**
 * Right-column 2x2 botanical photo gallery rendered below the 24-hour indoor vs outdoor
 * PM2.5 trajectory chart, matching winter-hardy plants to window sealing and cooking fuel.
 */
export function WinterPlantsShowcase({
  plants,
  t,
}: {
  readonly plants: readonly DynamicPlantRecommendation[];
  readonly t: LocaleDictionary;
}): ReactElement {
  return (
    <section aria-labelledby="winter-plants-heading" className="surface-hairline mt-6 p-5">
      <div className="flex items-center gap-2 font-medium text-ok">
        <Sprout className="h-4 w-4 text-ok" aria-hidden="true" />
        <h3 id="winter-plants-heading" className="text-sm font-semibold text-ink">
          {t.winterPlantsHeading}
        </h3>
      </div>
      <p className="mt-1 text-xs text-ink-2">{t.winterPlantsSubtitle}</p>
      <ul className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {plants.map((plant) => (
          <li
            key={plant.id}
            className={`surface-recessed flex items-start gap-3 p-3 ${
              plant.isPrimaryMatch ? 'border-ok' : ''
            }`}
          >
            <img
              src={plant.imageUrl}
              alt={plant.imageAlt}
              loading="lazy"
              className="h-20 w-20 shrink-0 rounded border border-rule object-cover"
            />
            <div className="min-w-0 flex-1 text-xs">
              <div
                className={`text-[11px] font-semibold ${
                  plant.isPrimaryMatch ? 'text-ok' : 'text-muted'
                }`}
              >
                {plant.badge}
              </div>
              <div className="mt-0.5 font-semibold text-ink">{plant.title}</div>
              <p className="mt-1 text-ink-2">{plant.text}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Left-column dynamic Corsi-Rosenthal DIY sizing and envelope & combustion physics verification alerts.
 */
export function IndoorGuidancePanels({ guidance, t }: IndoorGuidancePanelsProps): ReactElement {
  return (
    <>
      <div className="mt-6 border-t border-rule pt-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 font-medium text-ink">
            <CheckCircle2 className="h-4 w-4 text-ok" aria-hidden="true" />
            <span>{t.crGuideTitle}</span>
          </div>
          <span className="measured rounded border border-rule bg-paper-2 px-2 py-0.5 text-xs font-semibold text-accent">
            {String(guidance.crBoxesNeeded)}x DIY Box · Target{' '}
            {String(guidance.effectiveTargetCadr)} m3/h
          </span>
        </div>
        <p className="mt-1.5 text-sm text-ink-2">{guidance.diySpecSummary}</p>
        <ul className="mt-2 space-y-1.5 text-xs text-ink-2">
          {guidance.diyActionChecklist.map((step) => (
            <li key={step} className="surface-recessed border-l-2 border-accent p-2">
              {step}
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-4 border-t border-rule pt-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 font-medium text-bad">
            <AlertTriangle className="h-4 w-4 text-bad" aria-hidden="true" />
            <span>{t.mythAlertHeading}</span>
          </div>
          <span className="measured text-xs font-medium text-ink-2">
            {String(guidance.infiltrationAch)} ACH · {String(guidance.cookingEmissionUgHr)} ug/h
          </span>
        </div>
        <ul className="mt-2 space-y-2 text-xs text-ink-2">
          {guidance.physicsAlerts.map((alert) => (
            <li key={alert} className="surface-recessed p-2">
              {alert}
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
