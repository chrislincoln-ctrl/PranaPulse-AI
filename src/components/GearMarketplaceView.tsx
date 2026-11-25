import { CheckCircle2, ShieldCheck, ShoppingBag } from 'lucide-react';
import { memo, type ReactElement } from 'react';
import {
  buildAmazonInUrl,
  buildFlipkartUrl,
  buildTata1mgUrl,
  getMasksForTier,
  getPurifiersForChosenCadr,
  type MaskCatalogItem,
  type PurifierCatalogItem,
} from '../config/gearCatalog.js';
import type { IndoorClearanceSummary } from '../domain/types.js';
import {
  GEAR_CATALOG_COPY,
  resolveLocalizedMask,
  resolveLocalizedPurifier,
} from '../i18n/gearCatalogCopy.js';
import type { LocaleDictionary } from '../i18n/translations.js';
import type { PlanRequestPayload } from '../validators/schemas.js';
import {
  buildPurifierCadrNote,
  CustomShopFinder,
  GearProductCardShell,
} from './GearProductPrimitives.js';

export interface GearMarketplaceViewProps {
  readonly input: PlanRequestPayload;
  readonly indoor: IndoorClearanceSummary;
  readonly t: LocaleDictionary;
}

function renderMaskCard(
  item: MaskCatalogItem,
  maskLabel: string,
  t: LocaleDictionary,
): ReactElement {
  const copy = GEAR_CATALOG_COPY[t.locale];
  const loc = resolveLocalizedMask(item, t.locale);

  return (
    <GearProductCardShell
      key={item.id}
      name={item.name}
      priceRangeInr={loc.priceRangeInr}
      borderClass="border-accent"
      metaRow={
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-ok">
          <ShieldCheck className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>{copy.formatMaskFiltration(loc.certification, item.filtrationPct)}</span>
        </div>
      }
      recommendationNote={copy.formatMaskNote(maskLabel, item.filtrationPct)}
      boldSpec={loc.fitStyle}
      bestFor={loc.bestFor}
      amazonUrl={buildAmazonInUrl(item.searchQuery)}
      flipkartUrl={buildFlipkartUrl(item.searchQuery)}
      thirdUrl={buildTata1mgUrl(item.searchQuery)}
      thirdLabel={t.buy1mgLabel}
      t={t}
    />
  );
}

function renderPurifierCard(params: {
  readonly item: PurifierCatalogItem;
  readonly chosenCadr: number;
  readonly roomAreaM2: number;
  readonly requiredCadr: number;
  readonly t: LocaleDictionary;
}): ReactElement {
  const { item, chosenCadr, roomAreaM2, requiredCadr, t } = params;
  const copy = GEAR_CATALOG_COPY[t.locale];
  const loc = resolveLocalizedPurifier(item, t.locale);
  const isSized =
    item.cadrM3Hr >= Math.max(chosenCadr, requiredCadr) || item.maxRoomAreaM2 >= roomAreaM2;

  return (
    <GearProductCardShell
      key={item.id}
      name={item.name}
      priceRangeInr={loc.priceRangeInr}
      borderClass={isSized ? 'border-ok' : ''}
      metaRow={
        <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="measured font-semibold text-cool">
            {copy.formatPurifierCadrMeta(item.cadrM3Hr, item.maxRoomAreaM2)}
          </span>
          <span
            className={`inline-flex items-center gap-1 font-medium ${isSized ? 'text-ok' : 'text-accent'}`}
          >
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>{isSized ? t.cadrMatchBadge : t.cadrSmallBadge}</span>
          </span>
        </div>
      }
      recommendationNote={buildPurifierCadrNote(item, chosenCadr, requiredCadr, t)}
      boldSpec={loc.filterGrade}
      bestFor={loc.bestFor}
      amazonUrl={buildAmazonInUrl(item.searchQuery)}
      flipkartUrl={buildFlipkartUrl(item.searchQuery)}
      thirdUrl={buildAmazonInUrl(item.filterQuery)}
      thirdLabel={t.buyFilterLabel}
      t={t}
    />
  );
}

function MaskCatalogSection({
  input,
  t,
}: {
  readonly input: PlanRequestPayload;
  readonly t: LocaleDictionary;
}): ReactElement {
  const copy = GEAR_CATALOG_COPY[t.locale];
  const maskLabel = t.maskOptions[input.mask];
  const filteredMasks = getMasksForTier(input.mask);
  const defaultMaskQuery = filteredMasks[0]?.searchQuery ?? '3M N95 Respirator Mask';
  const banner = copy.formatMaskBannerLead(maskLabel);

  return (
    <section
      aria-labelledby="gear-masks-heading"
      className="surface-hairline min-w-0 p-4 sm:p-6 lg:col-span-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ShoppingBag className="h-5 w-5 text-accent" aria-hidden="true" />
          <h2 id="gear-masks-heading" className="text-ink">
            {t.gearMasksHeading}
          </h2>
        </div>
        <span className="rounded border border-rule bg-paper-2 px-2 py-0.5 text-xs font-semibold text-accent">
          {maskLabel}
        </span>
      </div>
      <div className="surface-recessed mt-3 border-l-2 border-accent p-3 text-xs text-ink-2">
        {banner.before1}
        <strong className="text-ink">{maskLabel}</strong>
        {banner.middle}
        <strong className="text-ink">{maskLabel}</strong>
        {banner.after}
      </div>
      <CustomShopFinder
        id="custom-mask-shop-input"
        label={t.gearMaskCustomLabel}
        defaultQuery={defaultMaskQuery}
        include1mg
        t={t}
      />
      <ul className="mt-4 space-y-3">
        {filteredMasks.map((item) => renderMaskCard(item, maskLabel, t))}
      </ul>
    </section>
  );
}

function PurifierCatalogSection(p: {
  readonly areaM2: number;
  readonly chosenCadr: number;
  readonly reqCadr: number;
  readonly t: LocaleDictionary;
}): ReactElement {
  const copy = GEAR_CATALOG_COPY[p.t.locale];
  const matched = getPurifiersForChosenCadr(p.chosenCadr, p.reqCadr);
  const top = matched[0];
  const topName = top?.name ?? 'True HEPA Purifier';
  const topCadr = top?.cadrM3Hr ?? p.reqCadr;

  return (
    <section
      aria-labelledby="gear-purifiers-heading"
      className="surface-hairline min-w-0 p-4 sm:p-6 lg:col-span-6"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="gear-purifiers-heading" className="text-ink">
          {p.t.gearPurifiersHeading}
        </h2>
        <span className="measured text-xs font-semibold text-accent">
          {copy.formatPurifierHeaderStat(p.chosenCadr, p.reqCadr)}
        </span>
      </div>
      <div className="surface-recessed mt-3 border-l-2 border-ok p-3 text-xs text-ink-2">
        {copy.formatPurifierIntro({
          chosenCadr: p.chosenCadr,
          areaM2: p.areaM2,
          reqCadr: p.reqCadr,
          topName,
          topCadr,
        })}
      </div>
      <CustomShopFinder
        id="custom-purifier-shop-input"
        label={p.t.gearPurifierCustomLabel}
        defaultQuery={top?.searchQuery ?? `True HEPA Air Purifier ${String(p.chosenCadr)} CADR`}
        include1mg={false}
        t={p.t}
      />
      <ul className="mt-4 space-y-3">
        {matched.map((item) =>
          renderPurifierCard({ ...p, item, roomAreaM2: p.areaM2, requiredCadr: p.reqCadr }),
        )}
      </ul>
    </section>
  );
}

/**
 * Mask and True HEPA Air Purifier marketplace view filtered strictly to the user's
 * selected mask tier and chosen purifier CADR with direct 1-click purchase links.
 */
export const GearMarketplaceView = memo(function GearMarketplaceView({
  input,
  indoor,
  t,
}: GearMarketplaceViewProps): ReactElement {
  return (
    <div className="grid grid-cols-1 gap-6 sm:gap-8 lg:grid-cols-12">
      <MaskCatalogSection input={input} t={t} />
      <PurifierCatalogSection
        areaM2={input.areaM2}
        chosenCadr={input.cadrM3Hr}
        reqCadr={indoor.requiredCadr48Ach}
        t={t}
      />
    </div>
  );
});
