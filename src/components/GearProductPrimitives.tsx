import { ExternalLink } from 'lucide-react';
import { useEffect, useState, type ReactElement, type ReactNode } from 'react';
import { VALIDATION_BOUNDS } from '../config/constants.js';
import {
  buildAmazonInUrl,
  buildFlipkartUrl,
  buildTata1mgUrl,
  type PurifierCatalogItem,
} from '../config/gearCatalog.js';
import type { LocaleDictionary } from '../i18n/translations.js';

export interface CardShellProps {
  readonly name: string;
  readonly priceRangeInr: string;
  readonly borderClass: string;
  readonly metaRow: ReactNode;
  readonly recommendationNote: string;
  readonly boldSpec: string;
  readonly bestFor: string;
  readonly amazonUrl: string;
  readonly flipkartUrl: string;
  readonly thirdUrl: string;
  readonly thirdLabel: string;
  readonly t: LocaleDictionary;
}

export function buildPurifierCadrNote(
  item: PurifierCatalogItem,
  chosenCadr: number,
  requiredCadr: number,
): string {
  const delta = item.cadrM3Hr - chosenCadr;
  const deltaText =
    delta >= 0
      ? `+${String(delta)} m3/h above your ${String(chosenCadr)} m3/h chosen CADR`
      : `${String(Math.abs(delta))} m3/h below your ${String(chosenCadr)} m3/h chosen CADR`;
  return `For your ${String(chosenCadr)} m3/h chosen CADR (room 4.8 ACH target: ${String(requiredCadr)} m3/h), you can go for this ${String(item.cadrM3Hr)} m3/h purifier (${deltaText}).`;
}

export function ShopLinkChip(props: {
  readonly href: string;
  readonly label: string;
  readonly primary?: boolean;
}): ReactElement {
  const cls = props.primary ? 'btn-primary' : 'btn-secondary';
  return (
    <a
      href={props.href}
      target="_blank"
      rel="noopener noreferrer"
      className={`${cls} touch-target inline-flex items-center gap-1.5 text-xs no-underline`}
    >
      <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
      <span>{props.label}</span>
    </a>
  );
}

export function CustomShopFinder(props: {
  readonly id: string;
  readonly label: string;
  readonly defaultQuery: string;
  readonly include1mg: boolean;
  readonly t: LocaleDictionary;
}): ReactElement {
  const [query, setQuery] = useState(props.defaultQuery);
  useEffect(() => {
    setQuery(props.defaultQuery);
  }, [props.defaultQuery]);
  const activeQuery = query.trim() || props.defaultQuery;

  return (
    <div className="surface-recessed mt-3 p-3.5">
      <label htmlFor={props.id} className="mb-1.5 block text-xs font-medium text-ink-2">
        {props.label}
      </label>
      <input
        id={props.id}
        type="search"
        value={query}
        maxLength={VALIDATION_BOUNDS.MAX_CITY_QUERY_LEN}
        onChange={(e) => {
          setQuery(e.target.value);
        }}
        className="field-control text-sm"
      />
      <div className="mt-2.5 flex flex-wrap gap-2">
        <ShopLinkChip href={buildAmazonInUrl(activeQuery)} label={props.t.buyAmazonLabel} primary />
        <ShopLinkChip href={buildFlipkartUrl(activeQuery)} label={props.t.buyFlipkartLabel} />
        {props.include1mg && (
          <ShopLinkChip href={buildTata1mgUrl(activeQuery)} label={props.t.buy1mgLabel} />
        )}
      </div>
    </div>
  );
}

export function GearProductCardShell(p: CardShellProps): ReactElement {
  return (
    <li className={`surface-recessed p-4 ${p.borderClass}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="font-semibold text-ink">{p.name}</div>
        <span className="measured rounded border border-rule bg-paper-2 px-2 py-0.5 text-xs font-semibold text-accent">
          {p.priceRangeInr}
        </span>
      </div>
      {p.metaRow}
      <p className="mt-1.5 rounded border border-rule bg-paper-2 px-2.5 py-1.5 text-xs font-medium text-ink">
        {p.recommendationNote}
      </p>
      <p className="mt-1.5 text-xs text-ink-2">
        <strong className="text-ink">{p.boldSpec}.</strong> {p.bestFor}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <ShopLinkChip href={p.amazonUrl} label={p.t.buyAmazonLabel} primary />
        <ShopLinkChip href={p.flipkartUrl} label={p.t.buyFlipkartLabel} />
        <ShopLinkChip href={p.thirdUrl} label={p.thirdLabel} />
      </div>
    </li>
  );
}
