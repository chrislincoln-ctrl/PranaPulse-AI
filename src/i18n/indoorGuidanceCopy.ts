/**
 * Complete EN / HI / TA localized text builders for Indoor CADR DIY checklists,
 * envelope & cooking physics alerts, and winter-hardy supplementary plant cards.
 */

import type {
  BuildingTightness,
  CookingFuelType,
  IndoorClearanceSummary,
} from '../domain/types.js';
import type { PlanRequestPayload, SupportedLanguage } from '../validators/schemas.js';

export interface LocalizedPlantCard {
  readonly id: string;
  readonly title: string;
  readonly badge: string;
  readonly text: string;
  readonly imageUrl: string;
  readonly imageAlt: string;
  readonly isPrimaryMatch: boolean;
}

export interface IndoorGuidanceCopyVars {
  readonly input: PlanRequestPayload;
  readonly indoor: IndoorClearanceSummary;
  readonly sealAch: number;
  readonly fuelUg: number;
  readonly envelopeSurcharge: number;
  readonly fuelSurcharge: number;
  readonly effectiveTargetCadr: number;
  readonly crBoxesNeeded: number;
  readonly tightnessLabel: string;
  readonly fuelLabel: string;
}

interface IndoorGuidanceLocalePack {
  readonly sealPlants: Readonly<Record<BuildingTightness, LocalizedPlantCard>>;
  readonly fuelPlants: Readonly<Record<CookingFuelType, LocalizedPlantCard>>;
  readonly secondaryPlants: readonly LocalizedPlantCard[];
  readonly diySealStep: (tightness: BuildingTightness, envelopeSurcharge: number) => string;
  readonly diyFuelStep: (fuel: CookingFuelType, fuelLabel: string, fuelSurcharge: number) => string;
  readonly diySummary: (v: IndoorGuidanceCopyVars) => string;
  readonly sealAlert: (v: IndoorGuidanceCopyVars) => string;
  readonly fuelAlert: (v: IndoorGuidanceCopyVars) => string;
}

function formatDiySummary(
  v: IndoorGuidanceCopyVars,
  deficitTmpl: string,
  surplusTmpl: string,
): string {
  const deficit = Math.max(0, v.effectiveTargetCadr - v.input.cadrM3Hr);
  const template = deficit > 0 ? deficitTmpl : surplusTmpl;
  const pairs: readonly (readonly [string, string])[] = [
    ['{area}', String(v.input.areaM2)],
    ['{vol}', String(v.indoor.roomVolumeM3)],
    ['{seal}', v.tightnessLabel],
    ['{ach}', String(v.sealAch)],
    ['{envSur}', String(v.envelopeSurcharge)],
    ['{fuel}', v.fuelLabel],
    ['{fuelUg}', String(v.fuelUg)],
    ['{fuelSur}', String(v.fuelSurcharge)],
    ['{target}', String(v.effectiveTargetCadr)],
    ['{cadr}', String(v.input.cadrM3Hr)],
    ['{deficit}', String(deficit)],
    ['{margin}', String(v.input.cadrM3Hr - v.effectiveTargetCadr)],
    ['{boxes}', String(v.crBoxesNeeded)],
    ['{plural}', v.crBoxesNeeded > 1 ? 's' : ''],
  ];
  return pairs.reduce((acc, [key, val]) => acc.replaceAll(key, val), template);
}

const en: IndoorGuidanceLocalePack = {
  sealPlants: {
    leaky: {
      id: 'seal-leaky-plant',
      title: 'Tulsi (Holy Basil) & Rubber Plant',
      badge: 'Matched to Leaky Windows (1.20 ACH Sill Dust Trap)',
      text: 'Place directly along leaky windowsills; broad waxy leaves intercept coarse outdoor PM10 and settled smog dust entering window gaps (wipe leaves with a damp cloth every 48h).',
      imageUrl: '/plants/tulsi-rubber.jpg',
      imageAlt: 'Tulsi (Holy Basil) windowsill plant',
      isPrimaryMatch: true,
    },
    standard: {
      id: 'seal-standard-plant',
      title: 'Areca Palm (Dypsis lutescens) & Boston Fern',
      badge: 'Matched to Standard Windows (0.55 ACH Airway Humidity)',
      text: 'Natural winter transpiration maintains 40-50% indoor relative humidity so respiratory airways stay hydrated against 0.55 ACH infiltrating dry smog.',
      imageUrl: '/plants/areca-palm.jpg',
      imageAlt: 'Areca Palm indoor plant',
      isPrimaryMatch: true,
    },
    'weather-sealed': {
      id: 'seal-weather-plant',
      title: 'Snake Plant (Sansevieria) & ZZ Plant',
      badge: 'Matched to Weather-Sealed Envelope (0.25 ACH Nighttime O2)',
      text: 'Weather-sealed rooms (0.25 ACH) trap overnight human CO2; CAM photosynthesis absorbs CO2 and releases oxygen at night while windows remain tightly shut.',
      imageUrl: '/plants/snake-plant.jpg',
      imageAlt: 'Snake Plant (Sansevieria trifasciata)',
      isPrimaryMatch: true,
    },
  },
  fuelPlants: {
    'solid-biomass': {
      id: 'fuel-biomass-plant',
      title: 'Peace Lily (Spathiphyllum) & Bamboo Palm',
      badge: 'Matched to Solid Biomass / Wood (9,500 ug/h VOC Scrubber)',
      text: 'Highest stomatal absorption of biomass combustion benzene, formaldehyde, trichloroethylene, and smoke VOCs near kitchen pass-throughs.',
      imageUrl: '/plants/peace-lily.jpg',
      imageAlt: 'Peace Lily indoor plant',
      isPrimaryMatch: true,
    },
    'lpg-unvented': {
      id: 'fuel-lpg-unvented-plant',
      title: 'Spider Plant (Chlorophytum) & Peace Lily',
      badge: 'Matched to Unvented LPG (1,900 ug/h NO2 & Aldehyde Uptake)',
      text: 'Absorbs unvented gas-burner formaldehydes, NO2 co-pollutants, benzene, and xylene in low winter sunlight.',
      imageUrl: '/plants/spider-plant.jpg',
      imageAlt: 'Spider Plant indoor foliage',
      isPrimaryMatch: true,
    },
    'lpg-vented': {
      id: 'fuel-lpg-vented-plant',
      title: 'Golden Pothos (Money Plant) & Spider Plant',
      badge: 'Matched to Vented LPG (650 ug/h Frying Aldehyde Buffer)',
      text: 'Hardy kitchen-counter bio-buffers that capture residual frying aldehydes and trace gas combustion VOCs escaping the chimney hood.',
      imageUrl: '/plants/golden-pothos.jpg',
      imageAlt: 'Golden Pothos (Money Plant)',
      isPrimaryMatch: true,
    },
    induction: {
      id: 'fuel-induction-plant',
      title: 'Areca Palm & Dwarf Date Palm',
      badge: 'Matched to Induction / Electric (150 ug/h Bio-Comfort)',
      text: 'With zero combustion NO2/CO from induction cooking, deploy palm foliage in living and sleeping zones to humidify dry winter air and trap settled lint.',
      imageUrl: '/plants/areca-palm.jpg',
      imageAlt: 'Areca Palm indoor humidifier plant',
      isPrimaryMatch: true,
    },
  },
  secondaryPlants: [
    {
      id: 'sec-cam-snake',
      title: 'Snake Plant (Sansevieria) & Aloe Vera',
      badge: 'Supplementary Bedroom CAM O2 Buffer',
      text: 'Releases oxygen overnight via CAM metabolism and traps coarse dust on upright waxy blades when wiped weekly.',
      imageUrl: '/plants/snake-plant.jpg',
      imageAlt: 'Snake Plant bedroom oxygen plant',
      isPrimaryMatch: false,
    },
    {
      id: 'sec-voc-ivy',
      title: 'English Ivy (Hedera helix) & Aglaonema',
      badge: 'Supplementary Hallway Formaldehyde Buffer',
      text: 'Low-light winter foliage that provides ~1% supplementary bio-deposition for indoor volatile organic compounds.',
      imageUrl: '/plants/english-ivy.jpg',
      imageAlt: 'English Ivy low-light indoor plant',
      isPrimaryMatch: false,
    },
  ],
  diySealStep: (tightness, surcharge) => {
    const map: Readonly<Record<BuildingTightness, string>> = {
      leaky: `Window seal fix (Leaky 1.20 ACH): Apply 3M EPDM foam weather-stripping tape (~INR 250) around window sashes to eliminate +${String(surcharge)} m3/h infiltration load.`,
      standard: `Window seal upgrade (Standard 0.55 ACH): Add rubber door sweeps and latch seals (~INR 180) to save +${String(surcharge)} m3/h CADR loss.`,
      'weather-sealed':
        'Window seal optimal (Weather-sealed 0.25 ACH): Keep perimeter gaskets closed during nocturnal inversions; open only during afternoon breakup hours.',
    };
    return map[tightness];
  },
  diyFuelStep: (fuel, fuelLabel, surcharge) => {
    if (fuel === 'solid-biomass' || fuel === 'lpg-unvented') {
      return `Combustion pre-filter (${fuelLabel}): Sandwich 1 activated-carbon mesh sheet (~INR 350) inside the MERV-13 box intake to adsorb cooking NO2, CO precursors, and VOCs (+${String(surcharge)} m3/h load).`;
    }
    if (fuel === 'lpg-vented') {
      return 'Kitchen exhaust discipline (Vented LPG): Run chimney hood on high during frying + run HEPA/MERV-13 box for 20 min after meals.';
    }
    return 'Zero-combustion advantage (Induction): Standard 4x MERV-13 pleated filters + 50 cm box fan (~INR 2,500) needed without extra carbon NO2 scrubbing.';
  },
  diySummary: (v) =>
    formatDiySummary(
      v,
      'For {area} m2 ({vol} m3) with {seal} ({ach} ACH, +{envSur} m3/h) and {fuel} ({fuelUg} ug/h, +{fuelSur} m3/h), effective target is {target} m3/h CADR (current deficit: {deficit} m3/h -> build {boxes}x MERV-13 Corsi-Rosenthal box unit{plural}).',
      'Your {cadr} m3/h CADR meets the {target} m3/h effective target for {area} m2 ({seal} + {fuel}) with a +{margin} m3/h safety margin.',
    ),
  sealAlert: (v) => {
    const map: Readonly<Record<BuildingTightness, string>> = {
      leaky: `Envelope leakage alert (1.20 ACH - Leaky windows): 78% of outdoor PM2.5 penetrates unsealed gaps continuously, adding +${String(v.envelopeSurcharge)} m3/h filtration load. Sealing gaps cuts infiltration by 79% (down to 0.25 ACH).`,
      standard: `Moderate window infiltration (0.55 ACH - Standard windows): Frame micro-gaps add +${String(v.envelopeSurcharge)} m3/h CADR demand during winter inversions; lock window latches and seal balcony thresholds.`,
      'weather-sealed': `Weather-sealed envelope verified (0.25 ACH): Low outdoor infiltration lets your ${String(v.input.cadrM3Hr)} m3/h purifier hold mitigated indoor PM2.5 at ${String(v.indoor.dailyMeanMitigatedPm25)} ug/m3 (-${String(v.indoor.exposureReductionPct)}% 24h cut).`,
    };
    return map[v.input.tightness];
  },
  fuelAlert: (v) => {
    const basePm = String(v.indoor.dailyMeanBaselinePm25);
    const map: Readonly<Record<CookingFuelType, string>> = {
      'solid-biomass': `Severe indoor combustion alert (9,500 ug/h - Biomass/wood): Unfiltered cooking smoke drives baseline indoor PM2.5 to ${basePm} ug/m3 during 07:00-08:00 & 19:00-20:00 meals. Vent outdoors and transition to induction/LPG.`,
      'lpg-unvented': `Unvented LPG combustion alert (1,900 ug/h PM2.5 + NO2): Gas burners without a chimney spike baseline indoor PM2.5 (${basePm} ug/m3) and emit airway-irritating NO2; use an exhaust fan or induction.`,
      'lpg-vented': `Vented LPG active (650 ug/h residual aerosol): Hood captures primary plume, leaving ${basePm} ug/m3 baseline indoor PM2.5; run purifier on turbo during meal hours.`,
      induction: `Zero-combustion cooking verified (150 ug/h - Induction): Eliminates indoor NO2/CO gas plumes, keeping baseline indoor PM2.5 down at ${basePm} ug/m3.`,
    };
    return map[v.input.cookingFuel];
  },
};

const hi: IndoorGuidanceLocalePack = {
  sealPlants: {
    leaky: {
      id: 'seal-leaky-plant',
      title: 'तुलसी और रबर प्लांट',
      badge: 'खुली दरारों हेतु उपयुक्त (1.20 ACH खिड़की धूल अवरोधक)',
      text: 'खिड़की की मुंडेर के पास रखें; चौड़ी मोमी पत्तियां दरारों से आने वाली मोटी PM10 और जमी हुई धूल को रोकती हैं (हर 48 घंटे में गीले कपड़े से पत्तियां पोंछें)।',
      imageUrl: '/plants/tulsi-rubber.jpg',
      imageAlt: 'खिड़की पर रखा तुलसी का पौधा',
      isPrimaryMatch: true,
    },
    standard: {
      id: 'seal-standard-plant',
      title: 'एरेका पाम और बोस्टन फ़र्न',
      badge: 'मानक खिड़कियों हेतु उपयुक्त (0.55 ACH श्वसन नमी)',
      text: 'सर्दियों में प्राकृतिक नमी 40-50% बनाए रखता है ताकि 0.55 ACH से आने वाली शुष्क धुंध के बीच श्वसन मार्ग सूखे न रहें।',
      imageUrl: '/plants/areca-palm.jpg',
      imageAlt: 'एरेका पाम इनडोर पौधा',
      isPrimaryMatch: true,
    },
    'weather-sealed': {
      id: 'seal-weather-plant',
      title: 'स्नेक प्लांट और ZZ प्लांट',
      badge: 'सीलबंद कमरे हेतु उपयुक्त (0.25 ACH रात्रि ऑक्सीजन)',
      text: 'पूरी तरह बंद कमरों (0.25 ACH) में रात में CO2 जमा होता है; CAM प्रकाश संश्लेषण रात में CO2 सोखकर ऑक्सीजन छोड़ता है।',
      imageUrl: '/plants/snake-plant.jpg',
      imageAlt: 'स्नेक प्लांट इनडोर पौधा',
      isPrimaryMatch: true,
    },
  },
  fuelPlants: {
    'solid-biomass': {
      id: 'fuel-biomass-plant',
      title: 'पीस लिली और बैंबू पाम',
      badge: 'चूल्हा / बायोमास हेतु उपयुक्त (9,500 ug/h VOC अवशोषक)',
      text: 'रसोई के पास लकड़ी व बायोमास के धुएं से निकलने वाले बेंजीन, फॉर्मल्डिहाइड और VOC गैसों को अवशोषित करने में सहायक।',
      imageUrl: '/plants/peace-lily.jpg',
      imageAlt: 'पीस लिली इनडोर पौधा',
      isPrimaryMatch: true,
    },
    'lpg-unvented': {
      id: 'fuel-lpg-unvented-plant',
      title: 'स्पाइडर प्लांट और पीस लिली',
      badge: 'बिना चिमनी LPG हेतु उपयुक्त (1,900 ug/h NO2 व VOC सहायता)',
      text: 'सर्दियों की कम धूप में भी बिना चिमनी वाले गैस चूल्हे के फॉर्मल्डिहाइड, NO2 सह-प्रदूषक और बेंजीन को कम करने में मददगार।',
      imageUrl: '/plants/spider-plant.jpg',
      imageAlt: 'स्पाइडर प्लांट इनडोर पौधा',
      isPrimaryMatch: true,
    },
    'lpg-vented': {
      id: 'fuel-lpg-vented-plant',
      title: 'मनी प्लांट (गोल्डन पोथोस) और स्पाइडर प्लांट',
      badge: 'चिमनी सहित LPG हेतु उपयुक्त (650 ug/h रसोई बफ़र)',
      text: 'मजबूत रसोई-काउंटर पौधे जो चिमनी से बचे हुए तलने के एल्डिहाइड और सूक्ष्म गैस VOC कणों को सोखते हैं।',
      imageUrl: '/plants/golden-pothos.jpg',
      imageAlt: 'मनी प्लांट इनडोर पौधा',
      isPrimaryMatch: true,
    },
    induction: {
      id: 'fuel-induction-plant',
      title: 'एरेका पाम और ड्वार्फ़ डेट पाम',
      badge: 'इंडक्शन इलेक्ट्रिक हेतु उपयुक्त (150 ug/h प्राकृतिक आराम)',
      text: 'इंडक्शन से NO2/CO उत्सर्जन शून्य होने पर लिविंग व बेडरूम में पाम पौधे शुष्क सर्दी की हवा को संतुलित रखते हैं।',
      imageUrl: '/plants/areca-palm.jpg',
      imageAlt: 'एरेका पाम प्राकृतिक नमी पौधा',
      isPrimaryMatch: true,
    },
  },
  secondaryPlants: [
    {
      id: 'sec-cam-snake',
      title: 'स्नेक प्लांट और एलोवेरा',
      badge: 'अतिरिक्त बेडरूम रात्रि ऑक्सीजन सहायक',
      text: 'रात में CAM प्रक्रिया से ऑक्सीजन छोड़ता है और साप्ताहिक सफाई पर सीधी पत्तियों पर मोटी धूल रोकता है।',
      imageUrl: '/plants/snake-plant.jpg',
      imageAlt: 'बेडरूम के लिए स्नेक प्लांट',
      isPrimaryMatch: false,
    },
    {
      id: 'sec-voc-ivy',
      title: 'इंग्लिश आइवी और एग्लोनीमा',
      badge: 'अतिरिक्त हॉलवे फॉर्मल्डिहाइड सहायक',
      text: 'कम रोशनी में भी चलने वाले पौधे जो इनडोर वाष्पशील कार्बनिक गैसों के लिए ~1% अतिरिक्त बायो-सहायता देते हैं।',
      imageUrl: '/plants/english-ivy.jpg',
      imageAlt: 'कम रोशनी वाला इंग्लिश आइवी पौधा',
      isPrimaryMatch: false,
    },
  ],
  diySealStep: (tightness, surcharge) => {
    const map: Readonly<Record<BuildingTightness, string>> = {
      leaky: `खिड़की सील सुधार (खुली दरारें 1.20 ACH): +${String(surcharge)} m3/h बाहरी धुएं का भार खत्म करने के लिए खिड़कियों पर EPDM फ़ोम वेदर-स्ट्रिपिंग टेप (~₹250) लगाएं।`,
      standard: `खिड़की सील उन्नयन (मानक 0.55 ACH): +${String(surcharge)} m3/h CADR नुकसान बचाने के लिए दरवाजों के नीचे रबर स्वीप और लैच सील (~₹180) लगाएं।`,
      'weather-sealed':
        'उत्तम खिड़की सील (सीलबंद 0.25 ACH): रात के इनवर्जन में सभी गास्केट बंद रखें और केवल दोपहर धूप के समय हवा बदलें।',
    };
    return map[tightness];
  },
  diyFuelStep: (fuel, fuelLabel, surcharge) => {
    if (fuel === 'solid-biomass' || fuel === 'lpg-unvented') {
      return `दहन प्री-फ़िल्टर (${fuelLabel}): रसोई के NO2, CO और VOC गैसों (+${String(surcharge)} m3/h भार) को सोखने के लिए MERV-13 बॉक्स में 1 एक्टिवेटेड-कार्बन शीट (~₹350) लगाएं।`;
    }
    if (fuel === 'lpg-vented') {
      return 'रसोई एग्जॉस्ट अनुशासन (चिमनी LPG): तलने-भूनने के समय चिमनी तेज़ चलाएं और भोजन के बाद 20 मिनट HEPA/MERV-13 बॉक्स चालू रखें।';
    }
    return 'शून्य-दहन लाभ (इंडक्शन): अतिरिक्त कार्बन NO2 फ़िल्टर के बिना केवल 4x MERV-13 फ़िल्टर + 50 सेमी बॉक्स पंखा (~₹2,500) पर्याप्त है।';
  },
  diySummary: (v) =>
    formatDiySummary(
      v,
      '{area} m2 ({vol} m3) कमरे, {seal} ({ach} ACH, +{envSur} m3/h) और {fuel} ({fuelUg} ug/h, +{fuelSur} m3/h) के लिए प्रभावी लक्ष्य {target} m3/h CADR है (वर्तमान कमी: {deficit} m3/h -> {boxes}x MERV-13 Corsi-Rosenthal बॉक्स बनाएं)।',
      'आपका {cadr} m3/h CADR आपके {area} m2 कमरे ({seal} + {fuel}) के {target} m3/h प्रभावी लक्ष्य को +{margin} m3/h सुरक्षा मार्जिन के साथ पूरा करता है।',
    ),
  sealAlert: (v) => {
    const map: Readonly<Record<BuildingTightness, string>> = {
      leaky: `खिड़की रिसाव चेतावनी (1.20 ACH - खुली दरारें): बाहरी PM2.5 का 78% लगातार अंदर घुसता है, जिससे +${String(v.envelopeSurcharge)} m3/h अतिरिक्त भार पड़ता है। दरारें बंद करने से रिसाव 79% घटकर 0.25 ACH रह जाता है।`,
      standard: `मध्यम खिड़की रिसाव (0.55 ACH - मानक कमरा): सर्दियों के इनवर्जन में फ्रेम की सूक्ष्म दरारें +${String(v.envelopeSurcharge)} m3/h CADR मांग बढ़ाती हैं; खिड़की लॉक और बालकनी सील बंद रखें।`,
      'weather-sealed': `सीलबंद कमरा सत्यापित (0.25 ACH): कम बाहरी रिसाव के कारण आपका ${String(v.input.cadrM3Hr)} m3/h प्यूरिफायर इनडोर PM2.5 को ${String(v.indoor.dailyMeanMitigatedPm25)} ug/m3 (-${String(v.indoor.exposureReductionPct)}% 24 घंटे कमी) पर रखता है।`,
    };
    return map[v.input.tightness];
  },
  fuelAlert: (v) => {
    const basePm = String(v.indoor.dailyMeanBaselinePm25);
    const map: Readonly<Record<CookingFuelType, string>> = {
      'solid-biomass': `गंभीर इनडोर दहन चेतावनी (9,500 ug/h - चूल्हा/लकड़ी): बिना चिमनी धुआं सुबह 07:00-08:00 और शाम 19:00-20:00 के समय इनडोर PM2.5 को ${basePm} ug/m3 तक पहुंचा देता है। बाहर हवा निकालें और इंडक्शन/LPG अपनाएं।`,
      'lpg-unvented': `बिना चिमनी LPG चेतावनी (1,900 ug/h PM2.5 + NO2): चिमनी रहित गैस चूल्हा इनडोर PM2.5 (${basePm} ug/m3) और श्वसन में जलन करने वाली NO2 बढ़ाता है; एग्जॉस्ट पंखा या इंडक्शन उपयोग करें।`,
      'lpg-vented': `चिमनी सहित LPG सक्रिय (650 ug/h शेष धुआं): चिमनी मुख्य धुआं खींचती है और ${basePm} ug/m3 बेसलाइन PM2.5 बचता है; भोजन समय प्यूरिफायर तेज़ चलाएं।`,
      induction: `शून्य-दहन रसोई सत्यापित (150 ug/h - इंडक्शन): रसोई से NO2/CO गैस खत्म होती है और बेसलाइन इनडोर PM2.5 केवल ${basePm} ug/m3 रहता है।`,
    };
    return map[v.input.cookingFuel];
  },
};

const ta: IndoorGuidanceLocalePack = {
  sealPlants: {
    leaky: {
      id: 'seal-leaky-plant',
      title: 'துளசி & ரப்பர் செடி',
      badge: 'சாதாரண இடைவெளிக்கு உகந்தது (1.20 ACH ஜன்னல் தூசி தடுப்பு)',
      text: 'ஜன்னல் ஓரங்களில் வைக்கவும்; அகன்ற இலைகள் இடைவெளிகள் வழியே வரும் PM10 மற்றும் புகைத் தூசியைப் பிடிக்கும் (48 மணிக்கு ஒருமுறை ஈரத் துணியால் துடைக்கவும்).',
      imageUrl: '/plants/tulsi-rubber.jpg',
      imageAlt: 'ஜன்னல் ஓர துளசி செடி',
      isPrimaryMatch: true,
    },
    standard: {
      id: 'seal-standard-plant',
      title: 'அரிகா பனை & பாஸ்டன் ஃபெர்ன்',
      badge: 'அடைத்த அறைக்கு உகந்தது (0.55 ACH சுவாச ஈரப்பதம்)',
      text: 'குளிர்கால வறண்ட புகையில் சுவாசப் பாதை வறண்டு போகாமல் இருக்க 40-50% இயற்கை ஈரப்பதத்தை அறையில் பராமரிக்கிறது.',
      imageUrl: '/plants/areca-palm.jpg',
      imageAlt: 'அரிகா பனை உள்ளக தாவரம்',
      isPrimaryMatch: true,
    },
    'weather-sealed': {
      id: 'seal-weather-plant',
      title: 'பாம்பு செடி (Sansevieria) & ZZ செடி',
      badge: 'நன்கு மூடிய அறைக்கு உகந்தது (0.25 ACH இரவு ஆக்ஸிஜன்)',
      text: 'நன்கு மூடிய அறைகளில் (0.25 ACH) இரவு நேர CO2 தேங்கும்; CAM ஒளிச்சேர்க்கை இரவிலும் CO2 உறிஞ்சி ஆக்ஸிஜனை வெளியிடுகிறது.',
      imageUrl: '/plants/snake-plant.jpg',
      imageAlt: 'பாம்பு செடி உள்ளக தாவரம்',
      isPrimaryMatch: true,
    },
  },
  fuelPlants: {
    'solid-biomass': {
      id: 'fuel-biomass-plant',
      title: 'பீஸ் லில்லி & மூங்கில் பனை',
      badge: 'விறகு / உயிரி எரிபொருளுக்கு உகந்தது (9,500 ug/h VOC உதவி)',
      text: 'சமையலறை அருகே உயிரி எரிபொருள் புகையிலிருந்து வரும் பென்சீன், ஃபார்மால்டிஹைடு மற்றும் VOC வாயுக்களை உறிஞ்ச உதவுகிறது.',
      imageUrl: '/plants/peace-lily.jpg',
      imageAlt: 'பீஸ் லில்லி உள்ளக தாவரம்',
      isPrimaryMatch: true,
    },
    'lpg-unvented': {
      id: 'fuel-lpg-unvented-plant',
      title: 'ஸ்பைடர் செடி & பீஸ் லில்லி',
      badge: 'புகைபோக்கி இல்லாத LPG-க்கு உகந்தது (1,900 ug/h NO2 & VOC)',
      text: 'குறைந்த குளிர்கால வெயிலிலும் புகைபோக்கி இல்லாத எரிவாயு அடுப்பின் ஃபார்மால்டிஹைடு, NO2 மற்றும் பென்சீனை உறிஞ்சுகிறது.',
      imageUrl: '/plants/spider-plant.jpg',
      imageAlt: 'ஸ்பைடர் செடி உள்ளக தாவரம்',
      isPrimaryMatch: true,
    },
    'lpg-vented': {
      id: 'fuel-lpg-vented-plant',
      title: 'மணி பிளாண்ட் & ஸ்பைடர் செடி',
      badge: 'புகைபோக்கி உள்ள LPG-க்கு உகந்தது (650 ug/h சமையல் உதவி)',
      text: 'புகைபோக்கியைத் தாண்டி எஞ்சும் வறுவல் ஆல்டிஹைடு மற்றும் சிறிய VOC வாயுக்களை சமையலறை மேடையில் கட்டுப்படுத்துகிறது.',
      imageUrl: '/plants/golden-pothos.jpg',
      imageAlt: 'மணி பிளாண்ட் உள்ளக தாவரம்',
      isPrimaryMatch: true,
    },
    induction: {
      id: 'fuel-induction-plant',
      title: 'அரிகா பனை & குள்ளப் பேரீச்சை',
      badge: 'மின் தூண்டல் அடுப்பிற்கு உகந்தது (150 ug/h இயற்கை ஈரப்பதம்)',
      text: 'மின் தூண்டல் சமையலில் NO2/CO புகை இல்லாததால், அறைகளில் பனை தாவரங்கள் வறண்ட குளிர்காலக் காற்றை ஈரப்பதமாக வைத்திருக்க உதவும்.',
      imageUrl: '/plants/areca-palm.jpg',
      imageAlt: 'அரிகா பனை ஈரப்பத செடி',
      isPrimaryMatch: true,
    },
  },
  secondaryPlants: [
    {
      id: 'sec-cam-snake',
      title: 'பாம்பு செடி & கற்றாழை',
      badge: 'கூடுதல் படுக்கையறை இரவு ஆக்ஸிஜன் உதவி',
      text: 'இரவு நேரத்தில் ஆக்ஸிஜனை வெளியிட்டு, வாராந்திர துடைப்பின் மூலம் இலைகளில் பெருந்தூசியைத் தடுத்து நிறுத்துகிறது.',
      imageUrl: '/plants/snake-plant.jpg',
      imageAlt: 'படுக்கையறை பாம்பு செடி',
      isPrimaryMatch: false,
    },
    {
      id: 'sec-voc-ivy',
      title: 'இங்கிலீஷ் ஐவி & அக்லோனிமா',
      badge: 'கூடுதல் நடைபாதை VOC தடுப்பு',
      text: 'குறைந்த வெளிச்சத்திலும் வளரும் இலைகள் உள்ளக VOC வாயுக்களுக்கு ~1% கூடுதல் இயற்கை உதவியை அளிக்கின்றன.',
      imageUrl: '/plants/english-ivy.jpg',
      imageAlt: 'குறைந்த வெளிச்ச இங்கிலீஷ் ஐவி செடி',
      isPrimaryMatch: false,
    },
  ],
  diySealStep: (tightness, surcharge) => {
    const map: Readonly<Record<BuildingTightness, string>> = {
      leaky: `ஜன்னல் அடைப்பு தீர்வு (1.20 ACH): +${String(surcharge)} m3/h வெளிப்புற ஊடுருவல் சுமையைத் தடுக்க ஜன்னல் ஓரங்களில் EPDM ஃபோம் சீல் டேப் (~₹250) ஒட்டவும்.`,
      standard: `ஜன்னல் அடைப்பு மேம்பாடு (0.55 ACH): +${String(surcharge)} m3/h CADR இழப்பைத் தவிர்க்க கதவு கீழ் ரப்பர் சீல் மற்றும் தாழ்ப்பாள் சீல் (~₹180) சேர்க்கவும்.`,
      'weather-sealed':
        'சிறந்த ஜன்னல் அடைப்பு (0.25 ACH): இரவு வெப்பத் தலைகீழ் நேரத்தில் சீல்களை மூடி வைத்து, மதிய வெயில் நேரத்தில் மட்டும் காற்றோட்டம் செய்யவும்.',
    };
    return map[tightness];
  },
  diyFuelStep: (fuel, fuelLabel, surcharge) => {
    if (fuel === 'solid-biomass' || fuel === 'lpg-unvented') {
      return `எரிபொருள் முன்-வடிகட்டி (${fuelLabel}): சமையல் NO2, CO மற்றும் VOC வாயுக்களை (+${String(surcharge)} m3/h சுமை) உறிஞ்ச MERV-13 பெட்டியில் 1 ஆக்டிவேட்டட் கார்பன் தாள் (~₹350) சேர்க்கவும்.`;
    }
    if (fuel === 'lpg-vented') {
      return 'சமையலறை புகைபோக்கி நடைமுறை (புகைபோக்கி LPG): சமைக்கும்போது புகைபோக்கியை அதிக வேகத்தில் இயக்கி, உணவுக்குப் பின் 20 நிமிடம் HEPA/MERV-13 பெட்டியை இயக்கவும்.';
    }
    return 'புகையற்ற நன்மை (மின் தூண்டல்): கூடுதல் கார்பன் NO2 வடிகட்டி இன்றி 4x MERV-13 வடிகட்டிகள் + 50 செமீ பெட்டி விசிறி (~₹2,500) போதுமானது.';
  },
  diySummary: (v) =>
    formatDiySummary(
      v,
      '{area} m2 ({vol} m3) அறை, {seal} ({ach} ACH, +{envSur} m3/h) மற்றும் {fuel} ({fuelUg} ug/h, +{fuelSur} m3/h) ஆகியவற்றிற்கு பயனுள்ள இலக்கு {target} m3/h CADR (தற்போதைய குறைபாடு: {deficit} m3/h -> {boxes}x MERV-13 Corsi-Rosenthal பெட்டி உருவாக்கவும்).',
      'உங்கள் {cadr} m3/h CADR அளவு {area} m2 அறையின் ({seal} + {fuel}) {target} m3/h இலக்கை +{margin} m3/h பாதுகாப்பு கூடுதலுடன் பூர்த்தி செய்கிறது.',
    ),
  sealAlert: (v) => {
    const map: Readonly<Record<BuildingTightness, string>> = {
      leaky: `அறை கசிவு எச்சரிக்கை (1.20 ACH - சாதாரண இடைவெளி): வெளிப்புற PM2.5-ல் 78% தொடர்ந்து உள்ளே புகுந்து +${String(v.envelopeSurcharge)} m3/h சுமையைச் சேர்க்கிறது. இடைவெளிகளை அடைத்தால் கசிவு 79% குறைந்து 0.25 ACH ஆகும்.`,
      standard: `மிதமான ஜன்னல் ஊடுருவல் (0.55 ACH - அடைத்த அறை): குளிர்கால மூட்டத்தில் ஜன்னல் நுண் இடைவெளிகள் +${String(v.envelopeSurcharge)} m3/h CADR தேவையைக் கூட்டுகின்றன; ஜன்னல் மற்றும் பால்கனி சீல்களை நன்கு பூட்டவும்.`,
      'weather-sealed': `நன்கு மூடிய அறை சரிபார்க்கப்பட்டது (0.25 ACH): குறைந்த வெளிப்புற ஊடுருவலால் உங்கள் ${String(v.input.cadrM3Hr)} m3/h வடிகட்டி உள்ளக PM2.5-ஐ ${String(v.indoor.dailyMeanMitigatedPm25)} ug/m3 (-${String(v.indoor.exposureReductionPct)}% 24மணி குறைப்பு) அளவில் வைத்திருக்கிறது.`,
    };
    return map[v.input.tightness];
  },
  fuelAlert: (v) => {
    const basePm = String(v.indoor.dailyMeanBaselinePm25);
    const map: Readonly<Record<CookingFuelType, string>> = {
      'solid-biomass': `கடுமையான உள்ளக புகை எச்சரிக்கை (9,500 ug/h - விறகு/உயிரி): சமையல் புகை காலை 07:00-08:00 மற்றும் மாலை 19:00-20:00 நேரத்தில் உள்ளக PM2.5-ஐ ${basePm} ug/m3 ஆக உயர்த்துகிறது. புகையை வெளியேற்றி மின் அடுப்பு/LPG-க்கு மாறவும்.`,
      'lpg-unvented': `புகைபோக்கி இல்லாத LPG எச்சரிக்கை (1,900 ug/h PM2.5 + NO2): புகைபோக்கி இல்லாத அடுப்பு உள்ளக PM2.5 (${basePm} ug/m3) மற்றும் சுவாச எரிச்சல் NO2-ஐ உயர்த்துகிறது; வெளியேற்ற விசிறி அல்லது மின் அடுப்பைப் பயன்படுத்தவும்.`,
      'lpg-vented': `புகைபோக்கி உள்ள LPG செயலில் (650 ug/h எஞ்சிய புகை): புகைபோக்கி முதன்மை புகையை நீக்கி ${basePm} ug/m3 அடிப்படை PM2.5 அளவில் வைக்கிறது; சமையல் நேரத்தில் வடிகட்டியை வேகமாக இயக்கவும்.`,
      induction: `புகையற்ற சமையல் சரிபார்க்கப்பட்டது (150 ug/h - மின் தூண்டல்): உள்ளக NO2/CO வாயுக்கள் தவிர்க்கப்பட்டு அடிப்படை உள்ளக PM2.5 ${basePm} ug/m3 ஆகக் குறைந்துள்ளது.`,
    };
    return map[v.input.cookingFuel];
  },
};

export const INDOOR_GUIDANCE_COPY: Readonly<Record<SupportedLanguage, IndoorGuidanceLocalePack>> = {
  en,
  hi,
  ta,
};
