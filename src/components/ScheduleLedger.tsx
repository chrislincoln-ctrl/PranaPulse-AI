import { ArrowRight, ExternalLink, RefreshCw, ShieldAlert, ShieldCheck } from 'lucide-react';
import { memo, useState, type ReactElement } from 'react';
import { buildAmazonInUrl, buildFlipkartUrl } from '../config/gearCatalog.js';
import type { RoutineStepItem } from '../domain/types.js';
import type { LocaleDictionary } from '../i18n/translations.js';
import type { AiPlanOutput } from '../validators/schemas.js';
import { MemberScheduleBar } from './MemberScheduleBar.js';

export interface ScheduleLedgerProps {
  readonly aiPlan: AiPlanOutput;
  readonly aiIsFallback: boolean;
  readonly isLoadingPlan: boolean;
  readonly onRefreshPlan: () => void;
  readonly t: LocaleDictionary;
}

const STEP_PAD_LEN = 2;

type IndoorHackItem = AiPlanOutput['indoorHacks'][number];

const HACK_QUERY_RULES: readonly { readonly pattern: RegExp; readonly query: string }[] = [
  {
    pattern: /weatherstrip|door\s*sweep|draft|seal|gasket|दरार|तौलिय/i,
    query: 'door sweep weatherstripping dust seal strip',
  },
  {
    pattern: /microfib|mop|cloth|पोछा|माइक्रोफ़ाइबर/i,
    query: 'microfiber floor mop cloth dust cleaning',
  },
  {
    pattern: /corsi|merv|box\s*fan|बॉक्स-फैन/i,
    query: 'MERV 13 pleated air filter box fan',
  },
  {
    pattern: /exhaust|chimney|hood|चिमनी/i,
    query: 'kitchen exhaust fan ventilation',
  },
  {
    pattern: /induction|cooktop|इंडक्शन/i,
    query: 'induction cooktop',
  },
  {
    pattern: /purifier|hepa|cadr|filtration|प्यूरिफायर/i,
    query: 'True HEPA H13 air purifier',
  },
];

function resolveHackSearchQuery(hack: IndoorHackItem): string {
  const haystack = `${hack.title} ${hack.howTo}`;
  for (const rule of HACK_QUERY_RULES) {
    if (rule.pattern.test(haystack)) {
      return rule.query;
    }
  }
  if (hack.tier === 'filtration') {
    return 'True HEPA H13 air purifier';
  }
  const cleaned = hack.title
    .replace(/\b(strategy|deployment|setup|upgrade|protocol|plan)\b/gi, '')
    .trim();
  return cleaned.length > 0 ? cleaned : hack.title;
}

function HackBuyLinks({ hack }: { readonly hack: IndoorHackItem }): ReactElement | null {
  if (hack.estimatedCostInr <= 0) {
    return null;
  }
  const query = resolveHackSearchQuery(hack);
  const linkClass =
    'inline-flex items-center gap-0.5 text-ink-2 underline decoration-rule-2 underline-offset-2 transition-colors hover:text-accent hover:decoration-accent';

  return (
    <div className="mt-2 flex items-center justify-end gap-2 text-[11px] text-muted">
      <span>Buy:</span>
      <a
        href={buildAmazonInUrl(query)}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Buy ${hack.title} on Amazon.in`}
        className={linkClass}
      >
        <span>Amazon</span>
        <ExternalLink className="h-3 w-3 shrink-0" aria-hidden="true" />
      </a>
      <span aria-hidden="true">·</span>
      <a
        href={buildFlipkartUrl(query)}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Buy ${hack.title} on Flipkart`}
        className={linkClass}
      >
        <span>Flipkart</span>
        <ExternalLink className="h-3 w-3 shrink-0" aria-hidden="true" />
      </a>
    </div>
  );
}

function RoutineStepsList({ steps }: { readonly steps: readonly RoutineStepItem[] }): ReactElement {
  return (
    <ol className="mt-4 space-y-3">
      {steps.map((step, idx) => (
        <li key={`${step.timeWindow}-${step.actionTitle}`} className="surface-recessed p-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="measured inline-flex h-6 w-6 items-center justify-center rounded border border-rule-2 bg-paper-2 text-xs font-bold text-accent">
                {String(idx + 1).padStart(STEP_PAD_LEN, '0')}
              </span>
              <span className="measured text-xs font-semibold text-accent">{step.timeWindow}</span>
            </div>
            <span className="measured rounded border border-rule bg-paper-2 px-2 py-0.5 text-xs font-medium text-ok">
              {step.estimatedImpactLabel}
            </span>
          </div>
          <div className="mt-2 font-semibold text-ink">{step.actionTitle}</div>
          <p className="mt-1 text-sm text-ink-2">{step.reasonSummary}</p>
        </li>
      ))}
    </ol>
  );
}

function HacksAndSwapsGrid({
  aiPlan,
  t,
}: {
  readonly aiPlan: AiPlanOutput;
  readonly t: LocaleDictionary;
}): ReactElement {
  return (
    <div className="mt-6 grid grid-cols-1 gap-6 border-t border-rule pt-4 md:grid-cols-2">
      <div>
        <h4 className="text-sm font-semibold text-ink">{t.hacksHeading}</h4>
        <ul className="mt-2.5 space-y-2.5 text-sm">
          {aiPlan.indoorHacks.map((hack) => (
            <li key={hack.title} className="surface-recessed p-3">
              <div className="flex items-start justify-between gap-2 font-medium text-ink">
                <span>{hack.title}</span>
                <span className="measured shrink-0 rounded border border-rule bg-paper-2 px-2 py-0.5 text-xs font-semibold text-accent">
                  INR {hack.estimatedCostInr}
                </span>
              </div>
              <p className="mt-1.5 text-xs text-ink-2">{hack.howTo}</p>
              <HackBuyLinks hack={hack} />
            </li>
          ))}
        </ul>
      </div>
      <div>
        <h4 className="text-sm font-semibold text-ink">{t.swapsHeading}</h4>
        <ul className="mt-2.5 space-y-2.5 text-sm">
          {aiPlan.sustainableSwaps.map((swap) => (
            <li key={swap.toAlternative} className="surface-recessed p-3">
              <div className="text-xs text-muted">{swap.fromHabit}</div>
              <div className="mt-1 flex items-center gap-1.5 font-medium text-ink">
                <ArrowRight className="h-3.5 w-3.5 shrink-0 text-accent" aria-hidden="true" />
                <span>{swap.toAlternative}</span>
              </div>
              <p className="mt-1.5 text-xs font-medium text-ok">{swap.quantifiedBenefit}</p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function ScheduleHeaderBar({
  aiIsFallback,
  isLoadingPlan,
  onRefreshPlan,
  t,
}: {
  readonly aiIsFallback: boolean;
  readonly isLoadingPlan: boolean;
  readonly onRefreshPlan: () => void;
  readonly t: LocaleDictionary;
}): ReactElement {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-rule pb-4">
      <div>
        <h3 className="text-ink">{t.routineHeading}</h3>
        <p className="mt-1 inline-flex items-center gap-2 text-xs text-ink-2">
          {aiIsFallback ? (
            <ShieldAlert className="h-4 w-4 text-accent" aria-hidden="true" />
          ) : (
            <ShieldCheck className="h-4 w-4 text-ok" aria-hidden="true" />
          )}
          <span>{aiIsFallback ? t.aiSourceFallback : t.aiSourceGemini}</span>
        </p>
      </div>
      <button
        type="button"
        onClick={onRefreshPlan}
        disabled={isLoadingPlan}
        data-loading={isLoadingPlan ? 'true' : undefined}
        className="btn-primary touch-target inline-flex items-center gap-2 text-sm"
      >
        <RefreshCw
          className={`h-4 w-4 ${isLoadingPlan ? 'icon-spin keep-motion' : ''}`}
          aria-hidden="true"
        />
        <span>{isLoadingPlan ? t.generatingPlan : t.refreshPlan}</span>
      </button>
    </div>
  );
}

/**
 * Displays grounded daily routine schedule, per-member routine tabs, indoor cost tiers,
 * and sustainable swaps.
 */
export const ScheduleLedger = memo(function ScheduleLedger({
  aiPlan,
  aiIsFallback,
  isLoadingPlan,
  onRefreshPlan,
  t,
}: ScheduleLedgerProps): ReactElement {
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const memberSchedules = aiPlan.memberSchedules ?? [];
  const activeSchedule = memberSchedules.find((s) => s.memberId === selectedMemberId) ?? null;

  return (
    <div className="surface-hairline p-4 sm:p-6">
      <ScheduleHeaderBar
        aiIsFallback={aiIsFallback}
        isLoadingPlan={isLoadingPlan}
        onRefreshPlan={onRefreshPlan}
        t={t}
      />
      <MemberScheduleBar
        memberSchedules={memberSchedules}
        selectedMemberId={activeSchedule ? activeSchedule.memberId : null}
        onSelectMemberId={setSelectedMemberId}
        activeSchedule={activeSchedule}
        t={t}
      />
      {!activeSchedule && <p className="mt-4 font-medium text-ink">{aiPlan.headline}</p>}
      <RoutineStepsList
        steps={activeSchedule ? activeSchedule.dailyRoutine : aiPlan.dailyRoutine}
      />
      <HacksAndSwapsGrid aiPlan={aiPlan} t={t} />
    </div>
  );
});
