/**
 * Curated respirator (N95 / FFP2 / Surgical / Cloth) and True-HEPA air purifier
 * buying catalog filtered dynamically by the user's selected mask tier and chosen CADR.
 */

import type { MaskTypeId } from '../domain/types.js';

export interface MaskCatalogItem {
  readonly id: string;
  readonly maskTier: MaskTypeId;
  readonly name: string;
  readonly certification: string;
  readonly filtrationPct: number;
  readonly fitStyle: string;
  readonly bestFor: string;
  readonly priceRangeInr: string;
  readonly searchQuery: string;
}

export interface PurifierCatalogItem {
  readonly id: string;
  readonly name: string;
  readonly filterGrade: string;
  readonly cadrM3Hr: number;
  readonly maxRoomAreaM2: number;
  readonly priceRangeInr: string;
  readonly bestFor: string;
  readonly searchQuery: string;
  readonly filterQuery: string;
}

export const MASK_CATALOG: readonly MaskCatalogItem[] = [
  {
    id: '3m-aura-9205',
    maskTier: 'n95-ffp2',
    name: '3M Aura 9205+ / 8210 Particulate Respirator',
    certification: 'NIOSH N95 Certified',
    filtrationPct: 95,
    fitStyle: '3-panel flat-fold headband + nose foam seal',
    bestFor: 'Severe winter smog (AQI > 200), two-wheeler & road commuting',
    priceRangeInr: 'INR 145 - 240 / mask',
    searchQuery: '3M Aura 9205 N95 Particulate Respirator Mask',
  },
  {
    id: 'venus-v4400',
    maskTier: 'n95-ffp2',
    name: 'Venus V-4400 / Magnum BIS FFP2 Respirator (Pack of 10)',
    certification: 'BIS IS 9473 FFP2 S / NIOSH N95',
    filtrationPct: 95,
    fitStyle: 'Fold-flat dual elastic head-straps (zero ear fatigue)',
    bestFor: 'Daily family use, office/metro commuters & high value',
    priceRangeInr: 'INR 380 - 550 / pack of 10',
    searchQuery: 'Venus V-4400 N95 FFP2 Headband Respirator Mask',
  },
  {
    id: 'kids-pediatric-n95',
    maskTier: 'n95-ffp2',
    name: 'Pediatric Small-Fit Kids N95 / FFP2 (Care View / Venus Junior)',
    certification: 'FFP2 / KN95 Pediatric Small Contour',
    filtrationPct: 95,
    fitStyle: '3D child facial contour (ages 5-14) preventing cheek leaks',
    bestFor: 'School bus commutes & morning assembly during winter smog',
    priceRangeInr: 'INR 299 - 599 / pack of 10',
    searchQuery: 'Kids N95 FFP2 Mask for Children School Pollution',
  },
  {
    id: 'honeywell-senior-ffp2',
    maskTier: 'n95-ffp2',
    name: 'Honeywell / Savlon FFP2 Low-Breathing-Resistance Respirator',
    certification: 'EN149 FFP2 / BIS Certified',
    filtrationPct: 94,
    fitStyle: 'High-volume breathing chamber for easier airflow',
    bestFor: 'Seniors, asthma/COPD patients & light morning walks',
    priceRangeInr: 'INR 350 - 650 / pack of 5',
    searchQuery: 'Honeywell FFP2 N95 Pollution Mask India',
  },
  {
    id: 'astm-surgical-3ply',
    maskTier: 'surgical',
    name: 'ASTM Level-3 Meltblown 3-Ply Surgical Mask (Box of 50)',
    certification: 'BFE/PFE >= 98% Meltblown Core',
    filtrationPct: 65,
    fitStyle: 'Pleated ear-loop with malleable aluminum nose wire',
    bestFor: 'Daily metro/bus transit & clinical 3-ply droplet/particulate barrier',
    priceRangeInr: 'INR 240 - 350 / box of 50',
    searchQuery: '3 Ply Meltblown Certified Surgical Face Mask Box 50',
  },
  {
    id: 'magnum-medline-surgical',
    maskTier: 'surgical',
    name: '3M / Magnum Medline Fluid-Resistant 3-Ply Surgical Mask (Pack of 50)',
    certification: 'ISO 13485 & CE Certified Meltblown 3-Ply',
    filtrationPct: 68,
    fitStyle: 'Ultrasonic welded soft ear-loops with full-width nose clip',
    bestFor: 'Extended office & commute wear with low breathing resistance',
    priceRangeInr: 'INR 299 - 450 / pack of 50',
    searchQuery: 'Magnum Medline 3 Ply Surgical Mask Meltblown Pack 50',
  },
  {
    id: 'savlon-dettol-surgical',
    maskTier: 'surgical',
    name: 'Savlon / Tata 1mg BIS-Certified Medical 3-Ply Surgical Mask (Pack of 25)',
    certification: 'BIS IS 16289 Class-2 Medical Surgical',
    filtrationPct: 65,
    fitStyle: 'Hypoallergenic inner spunbond layer + adjustable nose bridge',
    bestFor: 'Sensitive skin commuters seeking verified meltblown surgical filtration',
    priceRangeInr: 'INR 160 - 260 / pack of 25',
    searchQuery: 'Tata 1mg BIS Certified 3 Ply Surgical Mask',
  },
  {
    id: 'wildcraft-cloth-w95',
    maskTier: 'cloth',
    name: 'Wildcraft HypaShield / Supermask W95 Reusable Cotton Mask (Pack of 3)',
    certification: '6-Layer Washable Cotton + Embedded Meltblown Core',
    filtrationPct: 45,
    fitStyle: 'Ergonomic chin-wrap cotton weave with adjustable ear toggles',
    bestFor: 'Reusable up to 30 gentle washes for moderate AQI urban errands',
    priceRangeInr: 'INR 299 - 499 / pack of 3',
    searchQuery: 'Wildcraft Hypashield W95 Reusable Cotton Mask Pack of 3',
  },
  {
    id: 'cambridge-filter-cloth',
    maskTier: 'cloth',
    name: 'Organic Cotton Cloth Mask with Replaceable PM2.5 Carbon Filter Pocket',
    certification: 'Multi-Ply Combed Cotton + 5-Layer PM2.5 Activated Carbon Insert',
    filtrationPct: 55,
    fitStyle: 'Structured nose-bridge cotton shell with replaceable filter slot',
    bestFor: 'Cloth-mask comfort upgraded with replaceable PM2.5 filter pads',
    priceRangeInr: 'INR 249 - 450 / mask + 4 filters',
    searchQuery: 'Cotton Face Mask with PM2.5 Activated Carbon Filter Pocket',
  },
  {
    id: 'jockey-cotton-3ply',
    maskTier: 'cloth',
    name: 'Jockey / Van Heusen Breathable 3-Ply Combed Cotton Cloth Mask (Pack of 4)',
    certification: '100% Combed Cotton Anti-Dust 3-Ply Weave',
    filtrationPct: 35,
    fitStyle: 'Soft stretchable cotton loops for all-day low-resistance wear',
    bestFor: 'Coarse dust (PM10) & mild pollution days (< 100 AQI)',
    priceRangeInr: 'INR 320 - 520 / pack of 4',
    searchQuery: 'Jockey 3 Ply Cotton Reusable Face Mask',
  },
  {
    id: 'starter-breathable-mask',
    maskTier: 'none',
    name: 'Ultra-Light Breathable Activated-Carbon Comfort Mask (Starter Option)',
    certification: 'Dual-Valve Low-Resistance PM2.5 Mesh',
    filtrationPct: 70,
    fitStyle: 'Zero-fog exhalation valve for commuters who dislike stuffy masks',
    bestFor: 'Easy transition when upgrading from "No mask" during smog advisories',
    priceRangeInr: 'INR 199 - 349',
    searchQuery: 'Breathable Pollution Mask with Valve Activated Carbon',
  },
] as const;

export const PURIFIER_CATALOG: readonly PurifierCatalogItem[] = [
  {
    id: 'philips-compact-190',
    name: 'Philips AC0820 / Honeywell Air Touch V1 Compact HEPA Purifier',
    filterGrade: '2-Stage NanoProtect True HEPA H13 (0 Ozone)',
    cadrM3Hr: 190,
    maxRoomAreaM2: 16,
    priceRangeInr: 'INR 7,499 - 9,499',
    bestFor: 'Compact bedrooms, kids rooms & study spaces (100-230 m3/h CADR)',
    searchQuery: 'Philips AC0820 Compact HEPA Air Purifier',
    filterQuery: 'Philips FY0194 NanoProtect HEPA Filter',
  },
  {
    id: 'coway-airmega-150',
    name: 'Coway AirMega 150 (AP-1019C) Anti-Smog Purifier',
    filterGrade: 'True Green HEPA H13 + Urethane Carbon (0 Ozone)',
    cadrM3Hr: 303,
    maxRoomAreaM2: 22,
    priceRangeInr: 'INR 12,400 - 14,900',
    bestFor: 'Bedrooms & study rooms up to 22 m2 (8,500-hr filter life)',
    searchQuery: 'Coway AirMega 150 AP-1019C Air Purifier',
    filterQuery: 'Coway AirMega 150 Replacement HEPA Filter',
  },
  {
    id: 'philips-ac1711',
    name: 'Philips AC1711 / AC2958 Smart HEPA Purifier',
    filterGrade: '3-Layer NanoProtect HEPA H13 + Active Carbon',
    cadrM3Hr: 330,
    maxRoomAreaM2: 26,
    priceRangeInr: 'INR 12,999 - 16,999',
    bestFor: 'Master bedrooms & apartments up to 26 m2 (ultra-quiet sleep mode)',
    searchQuery: 'Philips AC1711 Air Purifier HEPA',
    filterQuery: 'Philips NanoProtect HEPA Replacement Filter FY1700',
  },
  {
    id: 'diy-corsi-rosenthal',
    name: 'DIY Corsi-Rosenthal MERV-13 Pleated Filter + 50cm Box Fan Kit',
    filterGrade: '4x MERV-13 Pleated HVAC Filters + High-CFM Box Fan',
    cadrM3Hr: 380,
    maxRoomAreaM2: 30,
    priceRangeInr: 'INR 1,800 - 2,600 (DIY build)',
    bestFor: 'Ultra-low-cost high-CADR classroom, hostel, or bedroom filtration',
    searchQuery: 'MERV 13 Pleated Air Filter Box Fan Purifier India',
    filterQuery: 'MERV 13 Pleated Air Filter 20x20',
  },
  {
    id: 'xiaomi-purifier-4',
    name: 'Xiaomi Smart Air Purifier 4 / 4 Lite True HEPA',
    filterGrade: '360-Degree True HEPA + High-Iodine Activated Carbon',
    cadrM3Hr: 400,
    maxRoomAreaM2: 32,
    priceRangeInr: 'INR 9,999 - 13,999',
    bestFor: 'Living rooms & 24-32 m2 spaces requiring 4.8+ ACH fast purge',
    searchQuery: 'Xiaomi Smart Air Purifier 4 HEPA',
    filterQuery: 'Xiaomi Smart Air Purifier 4 Replacement Filter',
  },
  {
    id: 'coway-airmega-250',
    name: 'Coway AirMega 250 / Sharp FP-J80M Heavy-Duty Hall Purifier',
    filterGrade: 'Dual-Suction True HEPA H13 + Deodorization Carbon',
    cadrM3Hr: 520,
    maxRoomAreaM2: 45,
    priceRangeInr: 'INR 24,900 - 32,500',
    bestFor: 'Large living/dining halls (30-45 m2) during severe AQI > 350',
    searchQuery: 'Coway AirMega 250 Air Purifier',
    filterQuery: 'Coway AirMega 250 Replacement HEPA Filter',
  },
] as const;

export function getMasksForTier(selectedMask: MaskTypeId): readonly MaskCatalogItem[] {
  return MASK_CATALOG.filter((item) => item.maskTier === selectedMask);
}

export function getPurifiersForChosenCadr(
  chosenCadrM3Hr: number,
  requiredCadrM3Hr: number,
): readonly PurifierCatalogItem[] {
  const referenceCadr = chosenCadrM3Hr > 0 ? chosenCadrM3Hr : requiredCadrM3Hr;
  return [...PURIFIER_CATALOG]
    .sort((a, b) => Math.abs(a.cadrM3Hr - referenceCadr) - Math.abs(b.cadrM3Hr - referenceCadr))
    .slice(0, 4);
}

export function buildAmazonInUrl(query: string): string {
  return `https://www.amazon.in/s?k=${encodeURIComponent(query.trim())}`;
}

export function buildFlipkartUrl(query: string): string {
  return `https://www.flipkart.com/search?q=${encodeURIComponent(query.trim())}`;
}

export function buildTata1mgUrl(query: string): string {
  return `https://www.1mg.com/search/all?name=${encodeURIComponent(query.trim())}`;
}
