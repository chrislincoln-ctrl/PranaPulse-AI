import { Check, CheckCircle2, Copy, Megaphone, Printer, Share2 } from 'lucide-react';
import { type ReactElement } from 'react';
import type { RwaCollectiveImpact } from '../domain/types.js';
import type { LocaleDictionary } from '../i18n/translations.js';

export interface RwaBulletinCardProps {
  readonly bulletinPreview: string;
  readonly copied: boolean;
  readonly onCopy: () => void;
  readonly t: LocaleDictionary;
}

export interface RwaPrintableSheetProps {
  readonly cityLabel: string;
  readonly safeAqi: number;
  readonly categoryLabel: string;
  readonly ventAdvice: string;
  readonly rwa: RwaCollectiveImpact;
  readonly transitShiftPct: number;
  readonly haltLeafBurning: boolean;
  readonly bulletinPreview: string;
  readonly t: LocaleDictionary;
}

function handlePrint(): void {
  window.print();
}

function RwaBulletinActions({
  waHref,
  copied,
  onCopy,
  t,
}: {
  readonly waHref: string;
  readonly copied: boolean;
  readonly onCopy: () => void;
  readonly t: LocaleDictionary;
}): ReactElement {
  const CopyIcon = copied ? Check : Copy;
  return (
    <div className="mt-4 flex flex-wrap gap-2">
      <button
        type="button"
        onClick={onCopy}
        className="btn-primary touch-target inline-flex items-center gap-2 text-sm"
      >
        <CopyIcon className="h-4 w-4" aria-hidden="true" />
        <span>{copied ? t.copiedBulletinButton : t.copyBulletinButton}</span>
      </button>
      <a
        href={waHref}
        target="_blank"
        rel="noopener noreferrer"
        className="btn-secondary touch-target inline-flex items-center gap-2 text-sm font-semibold text-ok"
      >
        <Share2 className="h-4 w-4" aria-hidden="true" />
        <span>{t.shareWhatsAppButton}</span>
      </a>
      <button
        type="button"
        onClick={handlePrint}
        className="btn-secondary touch-target inline-flex items-center gap-2 text-sm"
      >
        <Printer className="h-4 w-4" aria-hidden="true" />
        <span>{t.printBulletinButton}</span>
      </button>
    </div>
  );
}

function PrintSheetHeader(p: RwaPrintableSheetProps & { readonly dateText: string }): ReactElement {
  return (
    <div className="flex items-start justify-between gap-4 border-b-2 border-rule pb-4">
      <div>
        <p className="measured text-xs font-semibold tracking-wider text-accent uppercase">
          {p.t.rwaSectionHeading}
        </p>
        <h2 className="mt-1 text-2xl font-bold text-ink">
          {p.cityLabel} · {p.t.ui.rwaNoticeSuffix}
        </h2>
        <p className="measured mt-1 text-xs text-muted">{p.dateText}</p>
      </div>
      <div className="rounded-lg border border-rule-2 px-4 py-2 text-right">
        <div className="text-[11px] font-medium text-muted">{p.t.metricCpcbLabel}</div>
        <div className="measured text-2xl font-bold text-accent">{String(p.safeAqi)}</div>
        <div className="text-xs font-semibold text-ink-2">{p.categoryLabel}</div>
      </div>
    </div>
  );
}

/**
 * Clean single-page notice-board layout rendered exclusively during print / Save as PDF,
 * free of interactive sliders, navigation chrome, or smoky background layers.
 */
export function RwaPrintableNoticeSheet(p: RwaPrintableSheetProps): ReactElement {
  const dateText = new Date().toLocaleDateString(p.t.locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  const metrics = [
    { label: p.t.householdsLabel, val: String(p.rwa.householdsParticipating) },
    { label: p.t.transitShiftLabel, val: `${String(p.transitShiftPct)}%` },
    { label: p.t.co2SavedDailyLabel, val: `${String(p.rwa.dailyCo2SavedKg)} kg` },
    { label: p.t.pm25AvoidedDailyLabel, val: `${String(p.rwa.dailyPm25AvoidedG)} g` },
  ];

  return (
    <article className="hidden space-y-5 rounded-xl border-2 border-rule-2 bg-paper-2 p-6 text-ink print:block">
      <PrintSheetHeader {...p} dateText={dateText} />
      <div className="rounded-lg border border-rule border-l-4 border-l-accent bg-paper-3 p-4">
        <p className="text-sm font-semibold text-ink">{p.ventAdvice}</p>
        {p.haltLeafBurning && (
          <p className="mt-1.5 inline-flex items-center gap-1.5 text-xs font-medium text-ok">
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>{p.t.haltLeafBurningLabel}</span>
          </p>
        )}
      </div>
      <div className="grid grid-cols-4 gap-3">
        {metrics.map((m) => (
          <div key={m.label} className="rounded-lg border border-rule p-3">
            <div className="text-[11px] text-muted">{m.label}</div>
            <div className="measured mt-1 text-lg font-bold text-ink">{m.val}</div>
          </div>
        ))}
      </div>
      <div className="rounded-lg border border-rule p-4">
        <pre className="measured text-xs leading-relaxed break-words whitespace-pre-wrap text-ink">
          {p.bulletinPreview}
        </pre>
      </div>
    </article>
  );
}

/** RWA neighborhood notice preview card with Copy, WhatsApp Share, and Print actions. */
export function RwaBulletinCard({
  bulletinPreview,
  copied,
  onCopy,
  t,
}: RwaBulletinCardProps): ReactElement {
  const waHref = `https://wa.me/?text=${encodeURIComponent(bulletinPreview)}`;
  return (
    <section
      aria-label={t.copyBulletinButton}
      className="surface-hairline flex min-w-0 flex-col justify-between p-4 sm:p-6 lg:col-span-6"
    >
      <div>
        <div className="flex items-center gap-2.5">
          <span
            aria-hidden="true"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-accent/40 bg-accent-soft text-accent"
          >
            <Megaphone className="h-4 w-4" />
          </span>
          <h3 className="text-ink">{t.copyBulletinButton}</h3>
        </div>
        <pre className="surface-recessed measured mt-4 overflow-x-auto border-l-2 border-accent p-4 text-xs break-words whitespace-pre-wrap text-ink-2">
          {bulletinPreview}
        </pre>
      </div>
      <RwaBulletinActions waHref={waHref} copied={copied} onCopy={onCopy} t={t} />
    </section>
  );
}
