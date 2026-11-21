import { Check, Copy, Megaphone, Printer, Share2 } from 'lucide-react';
import { type ReactElement } from 'react';
import type { LocaleDictionary } from '../i18n/translations.js';

export interface RwaBulletinCardProps {
  readonly bulletinPreview: string;
  readonly copied: boolean;
  readonly onCopy: () => void;
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
