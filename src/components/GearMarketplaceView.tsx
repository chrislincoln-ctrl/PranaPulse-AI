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
  return (
    <GearProductCardShell
      key={item.id}
      name={item.name}
      priceRangeInr={item.priceRangeInr}
      borderClass="border-accent"
      metaRow={
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-ok">
          <ShieldCheck className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>
            {item.certification} · {String(item.filtrationPct)}% PM2.5 filtration
          </span>
        </div>
      }
      recommendationNote={`Recommended for your selected "${maskLabel}" tier in Commute & Route (${String(item.filtrationPct)}% particulate reduction).`}
      boldSpec={item.fitStyle}
      bestFor={item.bestFor}
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
  const isSized =
    item.cadrM3Hr >= Math.max(chosenCadr, requiredCadr) || item.maxRoomAreaM2 >= roomAreaM2;
  const badgeCls = isSized ? 'text-ok' : 'text-accent';
  return (
    <GearProductCardShell
      key={item.id}
      name={item.name}
      priceRangeInr={item.priceRangeInr}
      borderClass={isSized ? 'border-ok' : ''}
      metaRow={
        <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="measured font-semibold text-cool">
            {String(item.cadrM3Hr)} m3/h CADR (up to {String(item.maxRoomAreaM2)} m2)
          </span>
          <span className={`inline-flex items-center gap-1 font-medium ${badgeCls}`}>
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>{isSized ? t.cadrMatchBadge : t.cadrSmallBadge}</span>
          </span>
        </div>
      }
      recommendationNote={buildPurifierCadrNote(item, chosenCadr, requiredCadr)}
      boldSpec={item.filterGrade}
      bestFor={item.bestFor}
      amazonUrl={buildAmazonInUrl(item.searchQuery)}
      flipkartUrl={buildFlipkartUrl(item.searchQuery)}
      thirdUrl={buildAmazonInUrl(item.filterQuery)}
      thirdLabel={t.buyFilterLabel}
      t={t}
    />
  );
}

function PurifierCatalogSection(p: {
  readonly areaM2: number;
  readonly chosenCadr: number;
  readonly reqCadr: number;
  readonly t: LocaleDictionary;
}): ReactElement {
  const matched = getPurifiersForChosenCadr(p.chosenCadr, p.reqCadr);
  const top = matched[0];
  const topName = top?.name ?? 'True HEPA Purifier';
  const topCadr = String(top?.cadrM3Hr ?? p.reqCadr);

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
          Chosen: {String(p.chosenCadr)} m3/h · Room 4.8 ACH: {String(p.reqCadr)} m3/h
        </span>
      </div>
      <div className="surface-recessed mt-3 border-l-2 border-ok p-3 text-xs text-ink-2">
        For your chosen purifier CADR of{' '}
        <strong className="measured text-ink">{String(p.chosenCadr)} m3/h</strong> (and{' '}
        <strong className="measured text-ink">{String(p.areaM2)} m2</strong> room requiring{' '}
        <strong className="measured text-ink">{String(p.reqCadr)} m3/h</strong>), you can go for{' '}
        <strong className="text-ink">{topName}</strong> ({topCadr} m3/h) or the CADR-matched models
        below:
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
  const maskLabel = t.maskOptions[input.mask];
  const filteredMasks = getMasksForTier(input.mask);
  const defaultMaskQuery = filteredMasks[0]?.searchQuery ?? '3M N95 Respirator Mask';

  return (
    <div className="grid grid-cols-1 gap-6 sm:gap-8 lg:grid-cols-12">
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
          You selected <strong className="text-ink">{maskLabel}</strong> in Commute &amp; Route.
          Showing only recommendations for <strong className="text-ink">{maskLabel}</strong> below:
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
      <PurifierCatalogSection
        areaM2={input.areaM2}
        chosenCadr={input.cadrM3Hr}
        reqCadr={indoor.requiredCadr48Ach}
        t={t}
      />
    </div>
  );
});
