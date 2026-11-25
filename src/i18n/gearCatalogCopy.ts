/**
 * Complete EN / HI / TA localization for the Masks & HEPA Purifiers marketplace catalog
 * and dynamic CADR / mask-tier recommendation cards.
 */

import type { MaskCatalogItem, PurifierCatalogItem } from '../config/gearCatalog.js';
import type { SupportedLanguage } from '../validators/schemas.js';

export interface MaskCatalogTranslation {
  readonly certification: string;
  readonly fitStyle: string;
  readonly bestFor: string;
  readonly priceRangeInr: string;
}

export interface PurifierCatalogTranslation {
  readonly filterGrade: string;
  readonly bestFor: string;
  readonly priceRangeInr: string;
}

export interface GearCopyLocalePack {
  readonly masks: Readonly<Record<string, MaskCatalogTranslation>>;
  readonly purifiers: Readonly<Record<string, PurifierCatalogTranslation>>;
  readonly formatMaskFiltration: (cert: string, pct: number) => string;
  readonly formatMaskNote: (maskLabel: string, pct: number) => string;
  readonly formatMaskBannerLead: (maskLabel: string) => {
    readonly before1: string;
    readonly middle: string;
    readonly after: string;
  };
  readonly formatPurifierCadrMeta: (cadr: number, maxArea: number) => string;
  readonly formatPurifierHeaderStat: (chosenCadr: number, reqCadr: number) => string;
  readonly formatPurifierCadrNote: (
    itemCadr: number,
    chosenCadr: number,
    requiredCadr: number,
  ) => string;
  readonly formatPurifierIntro: (p: {
    readonly chosenCadr: number;
    readonly areaM2: number;
    readonly reqCadr: number;
    readonly topName: string;
    readonly topCadr: number;
  }) => string;
}

const hi: GearCopyLocalePack = {
  masks: {
    '3m-aura-9205': {
      certification: 'NIOSH N95 प्रमाणित',
      fitStyle: '3-पैनल फ़्लैट-फ़ोल्ड हेडबैंड + नोज़ फ़ोम सील',
      bestFor: 'गंभीर सर्दी स्मॉग (AQI > 200), दोपहिया और सड़क यात्रा हेतु सर्वोत्तम',
      priceRangeInr: '₹145 - ₹240 / मास्क',
    },
    'venus-v4400': {
      certification: 'BIS IS 9473 FFP2 S / NIOSH N95',
      fitStyle: 'डबल इलास्टिक हेड-स्ट्रैप (कानों पर शून्य दबाव)',
      bestFor: 'दैनिक पारिवारिक उपयोग, ऑफ़िस/मेट्रो यात्रियों के लिए किफ़ायती विकल्प',
      priceRangeInr: '₹380 - ₹550 / 10 का पैक',
    },
    'kids-pediatric-n95': {
      certification: 'FFP2 / KN95 बच्चों का छोटा फिट',
      fitStyle: 'बच्चों के चेहरे के अनुरूप 3D आकार (5-14 वर्ष) बिना हवा रिसाव',
      bestFor: 'सर्दियों की धुंध में स्कूल बस यात्रा और सुबह की असेंबली हेतु',
      priceRangeInr: '₹299 - ₹599 / 10 का पैक',
    },
    'honeywell-senior-ffp2': {
      certification: 'EN149 FFP2 / BIS प्रमाणित',
      fitStyle: 'आसान श्वास प्रवाह हेतु उच्च-आयतन ब्रीदिंग चैंबर',
      bestFor: 'वरिष्ठ नागरिकों, अस्थमा/COPD रोगियों और हल्की सैर के लिए',
      priceRangeInr: '₹350 - ₹650 / 5 का पैक',
    },
    'astm-surgical-3ply': {
      certification: 'BFE/PFE >= 98% मेल्टब्लोन परत',
      fitStyle: 'मुड़ने योग्य एल्युमिनियम नोज़ वायर के साथ प्लीटेड ईयर-लूप',
      bestFor: 'दैनिक मेट्रो/बस यात्रा और 3-परत कण सुरक्षा हेतु',
      priceRangeInr: '₹240 - ₹350 / 50 का बॉक्स',
    },
    'magnum-medline-surgical': {
      certification: 'ISO 13485 और CE प्रमाणित 3-प्लाई',
      fitStyle: 'मुलायम अल्ट्रासोनिक ईयर-लूप और पूर्ण नोज़ क्लिप',
      bestFor: 'आसान सांस के साथ लंबे ऑफ़िस और यात्रा समय के लिए',
      priceRangeInr: '₹299 - ₹450 / 50 का पैक',
    },
    'savlon-dettol-surgical': {
      certification: 'BIS IS 16289 क्लास-2 मेडिकल सर्जिकल',
      fitStyle: 'संवेदनशील त्वचा हेतु कोमल भीतरी परत + समायोज्य नोज़ ब्रिज',
      bestFor: 'संवेदनशील त्वचा वाले यात्रियों के लिए प्रमाणित 3-प्लाई सुरक्षा',
      priceRangeInr: '₹160 - ₹260 / 25 का पैक',
    },
    'wildcraft-cloth-w95': {
      certification: '6-परत धोने योग्य कॉटन + मेल्टब्लोन परत',
      fitStyle: 'एर्गोनोमिक चिन-रैप कॉटन बुनाई व समायोज्य ईयर टॉगल',
      bestFor: 'मध्यम AQI दैनिक कार्यों हेतु 30 हल्की धुलाई तक पुनः प्रयोज्य',
      priceRangeInr: '₹299 - ₹499 / 3 का पैक',
    },
    'cambridge-filter-cloth': {
      certification: 'मल्टी-प्लाई कॉटन + 5-परत PM2.5 कार्बन फ़िल्टर',
      fitStyle: 'बदलने योग्य फ़िल्टर पॉकेट के साथ संरचित नोज़-ब्रिज कॉटन मास्क',
      bestFor: 'कपड़े के आराम के साथ बदलने योग्य PM2.5 फ़िल्टर सुरक्षा',
      priceRangeInr: '₹249 - ₹450 / मास्क + 4 फ़िल्टर',
    },
    'jockey-cotton-3ply': {
      certification: '100% कॉम्ब्ड कॉटन 3-परत धूल-रोधी बुनाई',
      fitStyle: 'पूरे दिन आरामदायक उपयोग के लिए मुलायम लचीले कॉटन लूप',
      bestFor: 'मोटी धूल (PM10) और हल्के प्रदूषण वाले दिनों (< 100 AQI) हेतु',
      priceRangeInr: '₹320 - ₹520 / 4 का पैक',
    },
    'starter-breathable-mask': {
      certification: 'डुअल-वाल्व कम-प्रतिरोध PM2.5 मेश',
      fitStyle: 'घुटन से बचने के लिए आसान श्वास वाल्व डिज़ाइन',
      bestFor: 'धुंध अलर्ट के दौरान "बिना मास्क" से सुरक्षित शुरुआत के लिए',
      priceRangeInr: '₹199 - ₹349',
    },
  },
  purifiers: {
    'philips-compact-190': {
      filterGrade: '2-स्टेज NanoProtect True HEPA H13 (0 ओज़ोन)',
      bestFor: 'छोटे बेडरूम, बच्चों के कमरे और स्टडी रूम (100-230 m3/h CADR)',
      priceRangeInr: '₹7,499 - ₹9,499',
    },
    'coway-airmega-150': {
      filterGrade: 'True Green HEPA H13 + कार्बन फ़िल्टर (0 ओज़ोन)',
      bestFor: '22 m2 तक के बेडरूम व स्टडी रूम (8,500 घंटे फ़िल्टर आयु)',
      priceRangeInr: '₹12,400 - ₹14,900',
    },
    'philips-ac1711': {
      filterGrade: '3-परत NanoProtect HEPA H13 + एक्टिव कार्बन',
      bestFor: '26 m2 तक के मास्टर बेडरूम व अपार्टमेंट (शांत स्लीप मोड)',
      priceRangeInr: '₹12,999 - ₹16,999',
    },
    'diy-corsi-rosenthal': {
      filterGrade: '4x MERV-13 प्लीटेड फ़िल्टर + हाई-CFM बॉक्स पंखा',
      bestFor: 'कम बजट में कक्षा, हॉस्टल या बेडरूम हेतु उच्च-CADR शुद्धिकरण',
      priceRangeInr: '₹1,800 - ₹2,600 (DIY निर्माण)',
    },
    'xiaomi-purifier-4': {
      filterGrade: '360-डिग्री True HEPA + एक्टिवेटेड कार्बन',
      bestFor: '24-32 m2 लिविंग रूम जहां 4.8+ ACH तेज़ सफाई आवश्यक हो',
      priceRangeInr: '₹9,999 - ₹13,999',
    },
    'coway-airmega-250': {
      filterGrade: 'डुअल-सक्शन True HEPA H13 + गंध-रोधी कार्बन',
      bestFor: 'गंभीर AQI > 350 में बड़े लिविंग/डाइनिंग हॉल (30-45 m2) हेतु',
      priceRangeInr: '₹24,900 - ₹32,500',
    },
  },
  formatMaskFiltration: (cert, pct) => `${cert} · ${String(pct)}% PM2.5 फ़िल्ट्रेशन`,
  formatMaskNote: (maskLabel, pct) =>
    `यात्रा व मार्ग में आपके चुने गए "${maskLabel}" स्तर के लिए अनुशंसित (${String(pct)}% कण कमी)।`,
  formatMaskBannerLead: () => ({
    before1: 'आपने यात्रा व मार्ग में ',
    middle: ' चुना है। नीचे केवल ',
    after: ' के लिए अनुशंसित विकल्प दिखाए गए हैं:',
  }),
  formatPurifierCadrMeta: (cadr, maxArea) =>
    `${String(cadr)} m3/h CADR (${String(maxArea)} m2 तक के कमरे हेतु)`,
  formatPurifierHeaderStat: (chosenCadr, reqCadr) =>
    `चुना गया: ${String(chosenCadr)} m3/h · कमरा 4.8 ACH: ${String(reqCadr)} m3/h`,
  formatPurifierCadrNote: (itemCadr, chosenCadr, requiredCadr) => {
    const delta = itemCadr - chosenCadr;
    const deltaText =
      delta >= 0
        ? `आपके चुने गए ${String(chosenCadr)} m3/h CADR से +${String(delta)} m3/h अधिक`
        : `आपके चुने गए ${String(chosenCadr)} m3/h CADR से ${String(Math.abs(delta))} m3/h कम`;
    return `आपके ${String(chosenCadr)} m3/h CADR (कमरे का 4.8 ACH लक्ष्य: ${String(requiredCadr)} m3/h) हेतु आप यह ${String(itemCadr)} m3/h प्यूरिफायर चुन सकते हैं (${deltaText})।`;
  },
  formatPurifierIntro: (p) =>
    `आपके चुने गए ${String(p.chosenCadr)} m3/h CADR (और ${String(p.areaM2)} m2 कमरे की ${String(p.reqCadr)} m3/h आवश्यकता) के लिए आप ${p.topName} (${String(p.topCadr)} m3/h) या नीचे दिए गए CADR-मिलान मॉडल चुन सकते हैं:`,
};

const ta: GearCopyLocalePack = {
  masks: {
    '3m-aura-9205': {
      certification: 'NIOSH N95 சான்றளிக்கப்பட்டது',
      fitStyle: '3-பலகை தலைப்பட்டை + மூக்கு ஃபோம் இறுக்க சீல்',
      bestFor: 'கடுமையான குளிர்காலப் புகைமூட்டம் (AQI > 200) மற்றும் இருசக்கர பயணத்திற்குச் சிறந்தது',
      priceRangeInr: '₹145 - ₹240 / கவசம்',
    },
    'venus-v4400': {
      certification: 'BIS IS 9473 FFP2 S / NIOSH N95',
      fitStyle: 'இரட்டை தலைப்பட்டை (காது வலி இல்லை)',
      bestFor: 'தினசரி குடும்ப பயன்பாடு, அலுவலக மற்றும் மெட்ரோ பயணிகளுக்குச் சிக்கனமானது',
      priceRangeInr: '₹380 - ₹550 / 10 தொகுப்பு',
    },
    'kids-pediatric-n95': {
      certification: 'FFP2 / KN95 சிறுவர் சிறிய வடிவம்',
      fitStyle: 'கன்னக் கசிவைத் தடுக்கும் 3D சிறுவர் முக வடிவம் (5-14 வயது)',
      bestFor: 'புகைமூட்ட நாட்களில் பள்ளி பேருந்து பயணம் மற்றும் காலை வழிபாட்டிற்கு',
      priceRangeInr: '₹299 - ₹599 / 10 தொகுப்பு',
    },
    'honeywell-senior-ffp2': {
      certification: 'EN149 FFP2 / BIS சான்றளிக்கப்பட்டது',
      fitStyle: 'எளிதான காற்றோட்டத்திற்கு அகலமான சுவாச அறை',
      bestFor: 'மூத்த குடிமக்கள், ஆஸ்துமா/COPD நோயாளிகள் மற்றும் மென்மையான நடைக்கு',
      priceRangeInr: '₹350 - ₹650 / 5 தொகுப்பு',
    },
    'astm-surgical-3ply': {
      certification: 'BFE/PFE >= 98% மெல்ட்ப்ளோன் அடுக்கு',
      fitStyle: 'வளைக்கக்கூடிய அலுமினிய மூக்கு கம்பியுடன் 3-அடுக்கு காது வளையம்',
      bestFor: 'தினசரி மெட்ரோ/பேருந்து பயணம் மற்றும் மருத்துவ துகள் தடுப்பு',
      priceRangeInr: '₹240 - ₹350 / 50 பெட்டி',
    },
    'magnum-medline-surgical': {
      certification: 'ISO 13485 & CE சான்றளிக்கப்பட்ட 3-அடுக்கு',
      fitStyle: 'மென்மையான காது வளையம் மற்றும் முழு மூக்கு கிளிப்',
      bestFor: 'நீண்ட அலுவலக மற்றும் பயண நேரத்திற்கு எளிதான சுவாசத்துடன்',
      priceRangeInr: '₹299 - ₹450 / 50 தொகுப்பு',
    },
    'savlon-dettol-surgical': {
      certification: 'BIS IS 16289 வகுப்பு-2 மருத்துவ கவசம்',
      fitStyle: 'மென்மையான சருமத்திற்கு ஏற்ற உள் அடுக்கு + மூக்கு சரிசெய்தல்',
      bestFor: 'உணர்திறன் சருமம் கொண்ட பயணிகளுக்கு சான்றளிக்கப்பட்ட 3-அடுக்கு பாதுகாப்பு',
      priceRangeInr: '₹160 - ₹260 / 25 தொகுப்பு',
    },
    'wildcraft-cloth-w95': {
      certification: '6-அடுக்கு துவைக்கக்கூடிய பருத்தி + மெல்ட்ப்ளோன் அடுக்கு',
      fitStyle: 'சரிசெய்யக்கூடிய காது பட்டைகளுடன் முழு முக பருத்தி வடிவம்',
      bestFor: 'மிதமான AQI நகரப் பணிகளுக்கு 30 மென்மையான துவைப்பு வரை மறுபயன்பாடு',
      priceRangeInr: '₹299 - ₹499 / 3 தொகுப்பு',
    },
    'cambridge-filter-cloth': {
      certification: 'பல-அடுக்கு பருத்தி + 5-அடுக்கு PM2.5 கார்பன் வடிகட்டி',
      fitStyle: 'மாற்றக்கூடிய வடிகட்டி பையுடன் கூடிய பருத்தி முகக்கவசம்',
      bestFor: 'பருத்தி வசதியுடன் மாற்றக்கூடிய PM2.5 வடிகட்டி பாதுகாப்பு',
      priceRangeInr: '₹249 - ₹450 / கவசம் + 4 வடிகட்டி',
    },
    'jockey-cotton-3ply': {
      certification: '100% தூய பருத்தி 3-அடுக்கு தூசித் தடுப்பு',
      fitStyle: 'நாள் முழுவதும் வசதியான மென்மையான பருத்தி வளையங்கள்',
      bestFor: 'பெருந்தூசி (PM10) மற்றும் குறைந்த மாசு நாட்களுக்கு (< 100 AQI)',
      priceRangeInr: '₹320 - ₹520 / 4 தொகுப்பு',
    },
    'starter-breathable-mask': {
      certification: 'இரட்டை வால்வு எளிதான சுவாச PM2.5 வலை',
      fitStyle: 'புழுக்கம் இல்லாத எளிதான சுவாச வால்வு வடிவமைப்பு',
      bestFor: 'புகைமூட்ட எச்சரிக்கையில் "முகக்கவசம் இல்லை" நிலையிலிருந்து எளிதாக மாற',
      priceRangeInr: '₹199 - ₹349',
    },
  },
  purifiers: {
    'philips-compact-190': {
      filterGrade: '2-நிலை NanoProtect True HEPA H13 (0 ஓசோன்)',
      bestFor: 'சிறிய படுக்கையறை, குழந்தைகள் அறை மற்றும் படிப்பு அறை (100-230 m3/h CADR)',
      priceRangeInr: '₹7,499 - ₹9,499',
    },
    'coway-airmega-150': {
      filterGrade: 'True Green HEPA H13 + கார்பன் வடிகட்டி (0 ஓசோன்)',
      bestFor: '22 m2 வரையிலான படுக்கையறை & படிப்பு அறை (8,500 மணி வடிகட்டி ஆயுள்)',
      priceRangeInr: '₹12,400 - ₹14,900',
    },
    'philips-ac1711': {
      filterGrade: '3-அடுக்கு NanoProtect HEPA H13 + ஆக்டிவ் கார்பன்',
      bestFor: '26 m2 வரையிலான பெரிய படுக்கையறை & அடுக்குமாடி வீடு (அமைதியான இரவு முறை)',
      priceRangeInr: '₹12,999 - ₹16,999',
    },
    'diy-corsi-rosenthal': {
      filterGrade: '4x MERV-13 வடிகட்டிகள் + அதிக காற்றோட்ட பெட்டி விசிறி',
      bestFor: 'குறைந்த செலவில் வகுப்பறை, விடுதி அல்லது படுக்கையறைக்கான அதிக CADR சுத்தம்',
      priceRangeInr: '₹1,800 - ₹2,600 (DIY அமைப்பு)',
    },
    'xiaomi-purifier-4': {
      filterGrade: '360-டிகிரி True HEPA + ஆக்டிவேட்டட் கார்பன்',
      bestFor: '4.8+ ACH விரைவு சுத்தம் தேவைப்படும் 24-32 m2 வரவேற்பறைகளுக்கு',
      priceRangeInr: '₹9,999 - ₹13,999',
    },
    'coway-airmega-250': {
      filterGrade: 'இரட்டை உறிஞ்சல் True HEPA H13 + நாற்றம் நீக்கும் கார்பன்',
      bestFor: 'கடுமையான AQI > 350 நேரத்தில் பெரிய ஹால்களுக்கு (30-45 m2)',
      priceRangeInr: '₹24,900 - ₹32,500',
    },
  },
  formatMaskFiltration: (cert, pct) => `${cert} · ${String(pct)}% PM2.5 வடிகட்டல்`,
  formatMaskNote: (maskLabel, pct) =>
    `பயணம் & வழித்தடத்தில் நீங்கள் தேர்ந்தெடுத்த "${maskLabel}" நிலைக்குப் பரிந்துரைக்கப்படுகிறது (${String(pct)}% துகள் குறைப்பு).`,
  formatMaskBannerLead: () => ({
    before1: 'பயணம் & வழித்தடத்தில் ',
    middle: ' தேர்ந்தெடுத்துள்ளீர்கள். கீழே ',
    after: ' நிலைக்கான பரிந்துரைகள் மட்டுமே காட்டப்படுகின்றன:',
  }),
  formatPurifierCadrMeta: (cadr, maxArea) =>
    `${String(cadr)} m3/h CADR (${String(maxArea)} m2 அறை வரை)`,
  formatPurifierHeaderStat: (chosenCadr, reqCadr) =>
    `தேர்வு: ${String(chosenCadr)} m3/h · அறை 4.8 ACH: ${String(reqCadr)} m3/h`,
  formatPurifierCadrNote: (itemCadr, chosenCadr, requiredCadr) => {
    const delta = itemCadr - chosenCadr;
    const deltaText =
      delta >= 0
        ? `உங்கள் ${String(chosenCadr)} m3/h தேர்வை விட +${String(delta)} m3/h அதிகம்`
        : `உங்கள் ${String(chosenCadr)} m3/h தேர்வை விட ${String(Math.abs(delta))} m3/h குறைவு`;
    return `உங்கள் ${String(chosenCadr)} m3/h CADR தேர்விற்கு (அறை 4.8 ACH இலக்கு: ${String(requiredCadr)} m3/h), இந்த ${String(itemCadr)} m3/h காற்று வடிகட்டியைத் தேர்ந்தெடுக்கலாம் (${deltaText}).`;
  },
  formatPurifierIntro: (p) =>
    `உங்கள் ${String(p.chosenCadr)} m3/h CADR தேர்வுக்கும் (${String(p.areaM2)} m2 அறைக்குத் தேவையான ${String(p.reqCadr)} m3/h), ${p.topName} (${String(p.topCadr)} m3/h) அல்லது கீழே உள்ள CADR-பொருந்திய மாடல்களைத் தேர்ந்தெடுக்கலாம்:`,
};

const en: GearCopyLocalePack = {
  masks: {},
  purifiers: {},
  formatMaskFiltration: (cert, pct) => `${cert} · ${String(pct)}% PM2.5 filtration`,
  formatMaskNote: (maskLabel, pct) =>
    `Recommended for your selected "${maskLabel}" tier in Commute & Route (${String(pct)}% particulate reduction).`,
  formatMaskBannerLead: () => ({
    before1: 'You selected ',
    middle: ' in Commute & Route. Showing only recommendations for ',
    after: ' below:',
  }),
  formatPurifierCadrMeta: (cadr, maxArea) =>
    `${String(cadr)} m3/h CADR (up to ${String(maxArea)} m2)`,
  formatPurifierHeaderStat: (chosenCadr, reqCadr) =>
    `Chosen: ${String(chosenCadr)} m3/h · Room 4.8 ACH: ${String(reqCadr)} m3/h`,
  formatPurifierCadrNote: (itemCadr, chosenCadr, requiredCadr) => {
    const delta = itemCadr - chosenCadr;
    const deltaText =
      delta >= 0
        ? `+${String(delta)} m3/h above your ${String(chosenCadr)} m3/h chosen CADR`
        : `${String(Math.abs(delta))} m3/h below your ${String(chosenCadr)} m3/h chosen CADR`;
    return `For your ${String(chosenCadr)} m3/h chosen CADR (room 4.8 ACH target: ${String(requiredCadr)} m3/h), you can go for this ${String(itemCadr)} m3/h purifier (${deltaText}).`;
  },
  formatPurifierIntro: (p) =>
    `For your chosen purifier CADR of ${String(p.chosenCadr)} m3/h (and ${String(p.areaM2)} m2 room requiring ${String(p.reqCadr)} m3/h), you can go for ${p.topName} (${String(p.topCadr)} m3/h) or the CADR-matched models below:`,
};

export const GEAR_CATALOG_COPY: Readonly<Record<SupportedLanguage, GearCopyLocalePack>> = {
  en,
  hi,
  ta,
};

export function resolveLocalizedMask(
  item: MaskCatalogItem,
  locale: SupportedLanguage,
): MaskCatalogTranslation {
  const loc = GEAR_CATALOG_COPY[locale].masks[item.id];
  return {
    certification: loc?.certification ?? item.certification,
    fitStyle: loc?.fitStyle ?? item.fitStyle,
    bestFor: loc?.bestFor ?? item.bestFor,
    priceRangeInr: loc?.priceRangeInr ?? item.priceRangeInr,
  };
}

export function resolveLocalizedPurifier(
  item: PurifierCatalogItem,
  locale: SupportedLanguage,
): PurifierCatalogTranslation {
  const loc = GEAR_CATALOG_COPY[locale].purifiers[item.id];
  return {
    filterGrade: loc?.filterGrade ?? item.filterGrade,
    bestFor: loc?.bestFor ?? item.bestFor,
    priceRangeInr: loc?.priceRangeInr ?? item.priceRangeInr,
  };
}
