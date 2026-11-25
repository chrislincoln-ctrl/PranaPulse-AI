/**
 * Complete EN / HI / TA copy for the 4-section PranaPulse AI landing page.
 * Strictly avoids em-dashes and three-dot ellipses to preserve i18n copy hygiene.
 */

import type { SupportedLanguage } from '../validators/schemas.js';

export interface LandingFeatureCopy {
  readonly title: string;
  readonly tag: string;
  readonly description: string;
}

export interface LandingLocalePack {
  readonly heroBadge: string;
  readonly heroDescription: string;
  readonly heroLivePrefix: string;
  readonly heroHighlights: readonly [string, string, string];
  readonly heroSecondaryCta: string;
  readonly telemetryBadge: string;
  readonly telemetryTitle: string;
  readonly telemetryDescription: string;
  readonly telemetryFeatures: readonly [
    LandingFeatureCopy,
    LandingFeatureCopy,
    LandingFeatureCopy,
    LandingFeatureCopy,
  ];
  readonly uspBadge: string;
  readonly uspTitle: string;
  readonly uspSubtitle: string;
  readonly uspDescription: string;
  readonly uspFeatures: readonly [
    LandingFeatureCopy,
    LandingFeatureCopy,
    LandingFeatureCopy,
    LandingFeatureCopy,
  ];
  readonly gatewayBadge: string;
  readonly gatewayDescription: string;
  readonly gatewayHighlights: readonly [string, string, string];
  readonly gatewaySecondaryCta: string;
  readonly navGoToPrefix: string;
}

const en: LandingLocalePack = {
  heroBadge: 'Winter Smog Intelligence',
  heroDescription:
    'Hyper-local CPCB & US-EPA air intelligence fused with indoor CADR physics, low-exposure commute routing, Family Daily Companion Chat, 1-tap WhatsApp briefs, and full 2-way Telegram control.',
  heroLivePrefix: 'Live',
  heroHighlights: [
    'Full Site Control via Telegram',
    'Family Daily Companion Chat',
    '1-Tap WhatsApp Briefs',
  ],
  heroSecondaryCta: 'See Verified APIs & USPs',
  telemetryBadge: 'Verified Real-Time APIs',
  telemetryTitle: 'Trusted Live Telemetry',
  telemetryDescription:
    'Zero guesswork or static mock data. Every reading cross-checks ground air monitors, atmospheric weather grids, and orbital fire satellites in real time, automatically applying conservative safety ceilings when local monitors spike.',
  telemetryFeatures: [
    {
      title: 'OpenAQ v3 & WAQI Ground Monitors',
      tag: 'openaq.org · aqicn.org',
      description:
        'Verified CPCB NAQI, US-EPA AQI, and 6-pollutant readings (PM2.5, PM10, NO2, O3, SO2, CO) with automatic station-vs-satellite cross-checks.',
    },
    {
      title: 'Open-Meteo Inversion & Dispersion',
      tag: 'open-meteo.com',
      description:
        '24-hour Planetary Boundary Layer (PBL) height, wind velocity, relative humidity, and exact safe midday window-airing intervals.',
    },
    {
      title: 'NASA FIRMS Satellite Plumes',
      tag: 'firms.modaps.eosdis.nasa.gov',
      description:
        'Live 500km orbital VIIRS/MODIS thermal anomaly & biomass-burning hotspot tracking feeding early winter-smog transport alerts.',
    },
    {
      title: 'OpenStreetMap GPS & Grounded AI',
      tag: 'openstreetmap.org · Gemini · Groq',
      description:
        'Street-level Nominatim GPS pinpointing paired with physics-grounded AI reasoning (all numbers anchored strictly to live sensors).',
    },
  ],
  uspBadge: 'What Makes PranaPulse Different',
  uspTitle: 'One Brain, Every Channel',
  uspSubtitle: 'Telegram Remote Control · Companion Chat · WhatsApp · Physics',
  uspDescription:
    'Most AQI apps stop at a passive number. PranaPulse turns live atmospheric science into 2-way daily protection across Web, Telegram, and WhatsApp, synced in real time.',
  uspFeatures: [
    {
      title: 'Operate the Entire Website via Telegram',
      tag: 'Two-Way Live Sync',
      description:
        'Control all 6 modules without opening a browser: check live air, drop GPS pins, edit room CADR, masks, commutes, RWA notices, or text schedule changes ("leaving at 10:20, returning at 11:41 pm") that auto-update the website and send 06:30 IST daily briefs.',
    },
    {
      title: 'Family Daily Companion Chat',
      tag: 'Always-On Floating AI',
      description:
        'Available in the bottom-right corner on every page: pick any family member (school child, senior with asthma, commuter), attach live GPS, ask naturally, and apply habit updates directly to their schedule.',
    },
    {
      title: '1-Tap WhatsApp Briefs & RWA Notices',
      tag: 'Instant Sharing',
      description:
        'Deliver personalized per-member morning defense plans and housing-society RWA collective impact bulletins directly into WhatsApp chats in English, हिन्दी, or தமிழ்.',
    },
    {
      title: 'Deterministic Exposure & CADR Physics',
      tag: 'Science-Backed',
      description:
        'Per-member inhaled PM2.5 dose budgets (ug/day & cigarette equivalents), 4.8 ACH HEPA & DIY Corsi-Rosenthal sizing, Pareto low-exposure commute routing, and matched mask/purifier buying links.',
    },
  ],
  gatewayBadge: '6-Module Interactive Workbench',
  gatewayDescription:
    'Launch the interactive workbench to detect your live GPS air quality, customize every family member daily habits, chat with the Family Daily Companion, pair Telegram in 1 click, and share WhatsApp briefs.',
  gatewayHighlights: [
    '4 Live Telemetry & Satellite APIs',
    '2-Way Web ↔ Telegram Sync',
    'English · हिन्दी · தமிழ் · WCAG 2.2 AA',
  ],
  gatewaySecondaryCta: 'Return to Top',
  navGoToPrefix: 'Go to',
};

const hi: LandingLocalePack = {
  heroBadge: 'सर्दियों की धुंध इंटेलिजेंस',
  heroDescription:
    'हाइपर-लोकल CPCB व US-EPA वायु विश्लेषण, इनडोर CADR भौतिकी, कम-प्रदूषण यात्रा मार्ग, पारिवारिक दैनिक साथी चैट, 1-टैप WhatsApp बुलेटिन और पूर्ण 2-वे Telegram नियंत्रण।',
  heroLivePrefix: 'लाइव',
  heroHighlights: [
    'Telegram से पूरी वेबसाइट का नियंत्रण',
    'पारिवारिक दैनिक साथी चैट',
    '1-टैप WhatsApp सारांश',
  ],
  heroSecondaryCta: 'सत्यापित APIs और विशेषताएं देखें',
  telemetryBadge: 'सत्यापित रियल-टाइम APIs',
  telemetryTitle: 'विश्वसनीय लाइव टेलीमेट्री',
  telemetryDescription:
    'कोई अनुमान या स्थिर नकली डेटा नहीं। हर रीडिंग जमीनी वायु मॉनिटर, वायुमंडलीय मौसम ग्रिड और उपग्रह अग्नि डेटा की रियल-टाइम जांच करती है और स्थानीय प्रदूषण बढ़ने पर स्वतः सुरक्षा सीमा लागू करती है।',
  telemetryFeatures: [
    {
      title: 'OpenAQ v3 और WAQI जमीनी मॉनिटर',
      tag: 'openaq.org · aqicn.org',
      description:
        'सत्यापित CPCB NAQI, US-EPA AQI और 6 प्रमुख प्रदूषक (PM2.5, PM10, NO2, O3, SO2, CO) जिनकी स्टेशन और सैटेलाइट से स्वतः क्रॉस-जांच होती है।',
    },
    {
      title: 'Open-Meteo इनवर्जन और वायु फैलाव',
      tag: 'open-meteo.com',
      description:
        '24-घंटे की प्लैनेटरी बाउंड्री लेयर (PBL) ऊंचाई, हवा की गति, सापेक्ष आर्द्रता और दोपहर में खिड़कियां खोलने का सटीक सुरक्षित समय।',
    },
    {
      title: 'NASA FIRMS सैटेलाइट धुआं ट्रैकिंग',
      tag: 'firms.modaps.eosdis.nasa.gov',
      description:
        '500 किमी दायरे में लाइव VIIRS/MODIS थर्मल और पराली दहन हॉटस्पॉट की निगरानी जो सर्दियों की धुंध की पूर्व चेतावनी देती है।',
    },
    {
      title: 'OpenStreetMap GPS और सत्यापित AI',
      tag: 'openstreetmap.org · Gemini · Groq',
      description:
        'सड़क-स्तरीय Nominatim GPS लोकेशन और भौतिकी-आधारित AI मार्गदर्शन जहां हर आंकड़ा सीधे लाइव सेंसर से जुड़ा होता है।',
    },
  ],
  uspBadge: 'PranaPulse को क्या खास बनाता है',
  uspTitle: 'एक इंजन, हर चैनल पर सुरक्षा',
  uspSubtitle: 'Telegram रिमोट कंट्रोल · साथी चैट · WhatsApp · विज्ञान',
  uspDescription:
    'अधिकांश AQI ऐप केवल एक संख्या दिखाकर रुक जाते हैं। PranaPulse लाइव वायु विज्ञान को वेब, Telegram और WhatsApp पर रियल-टाइम 2-वे पारिवारिक सुरक्षा में बदलता है।',
  uspFeatures: [
    {
      title: 'Telegram से पूरी वेबसाइट संचालित करें',
      tag: '2-वे लाइव सिंक',
      description:
        'ब्राउज़र खोले बिना सभी 6 मॉड्यूल चलाएं: लाइव हवा जांचें, GPS पिन भेजें, कमरा CADR, मास्क, यात्रा, RWA सूचना बदलें, या समय अपडेट लिखें जो वेबसाइट को तुरंत अपडेट कर सुबह 06:30 बुलेटिन भेजता है।',
    },
    {
      title: 'पारिवारिक दैनिक साथी चैट',
      tag: 'हमेशा उपलब्ध फ्लोटिंग AI',
      description:
        'हर पेज के नीचे-दाएं कोने में उपलब्ध: कोई भी सदस्य चुनें (स्कूल बच्चा, अस्थमा वरिष्ठ, यात्री), लाइव GPS जोड़ें, स्वाभाविक रूप से पूछें और सीधे समय-सारणी अपडेट करें।',
    },
    {
      title: '1-टैप WhatsApp बुलेटिन और RWA सूचना',
      tag: 'तुरंत साझाकरण',
      description:
        'हर सदस्य की व्यक्तिगत सुबह की सुरक्षा योजना और हाउसिंग सोसाइटी RWA सामूहिक प्रभाव नोटिस सीधे WhatsApp चैट में हिन्दी, English या தமிழ் में भेजें।',
    },
    {
      title: 'सटीक श्वसन खुराक और CADR भौतिकी',
      tag: 'विज्ञान-समर्थित',
      description:
        'प्रति सदस्य PM2.5 श्वसन खुराक (ug/दिन व सिगरेट समतुल्य), 4.8 ACH HEPA और DIY Corsi-Rosenthal आकार, Pareto कम-प्रदूषण यात्रा मार्ग और सटीक मास्क/प्यूरिफायर खरीद लिंक।',
    },
  ],
  gatewayBadge: '6-मॉड्यूल इंटरैक्टिव कार्यक्षेत्र',
  gatewayDescription:
    'अपनी लाइव GPS वायु गुणवत्ता जांचने, हर सदस्य की दैनिक आदतें सेट करने, पारिवारिक साथी से चैट करने, 1 क्लिक में Telegram जोड़ने और WhatsApp बुलेटिन साझा करने के लिए कंसोल शुरू करें।',
  gatewayHighlights: [
    '4 लाइव टेलीमेट्री और सैटेलाइट APIs',
    '2-वे वेब ↔ Telegram सिंक',
    'English · हिन्दी · தமிழ் · WCAG 2.2 AA',
  ],
  gatewaySecondaryCta: 'शीर्ष पर लौटें',
  navGoToPrefix: 'अनुभाग पर जाएं:',
};

const ta: LandingLocalePack = {
  heroBadge: 'குளிர்காலப் புகைபனி நுண்ணறிவு',
  heroDescription:
    'துல்லியமான CPCB மற்றும் US-EPA காற்று தரவு, உள்ளக CADR இயற்பியல், குறைந்த-மாசு பயண வழித்தடம், குடும்ப தினசரி துணை உரையாடல், 1-தட்டல் WhatsApp அறிக்கைகள் மற்றும் முழு 2-வழி Telegram கட்டுப்பாடு.',
  heroLivePrefix: 'நேரலை',
  heroHighlights: [
    'Telegram வழியாக முழு தளக் கட்டுப்பாடு',
    'குடும்ப தினசரி துணை உரையாடல்',
    '1-தட்டல் WhatsApp அறிக்கைகள்',
  ],
  heroSecondaryCta: 'சரிபார்க்கப்பட்ட APIs & சிறப்பம்சங்கள்',
  telemetryBadge: 'சரிபார்க்கப்பட்ட நிகழ்நேர APIs',
  telemetryTitle: 'நம்பகமான நேரலை டெலிமெட்ரி',
  telemetryDescription:
    'ஊகமோ நிலையான மாதிரி தரவோ இல்லை. ஒவ்வொரு அளவீடும் தரை காற்று உணரிகள், வானிலை அடுக்குகள் மற்றும் செயற்கைக்கோள் தீப்புள்ளி தரவுகளை நிகழ்நேரத்தில் சரிபார்த்து உடனடி பாதுகாப்பு வரம்புகளைப் பயன்படுத்துகிறது.',
  telemetryFeatures: [
    {
      title: 'OpenAQ v3 & WAQI தரை கண்காணிப்பிகள்',
      tag: 'openaq.org · aqicn.org',
      description:
        'சரிபார்க்கப்பட்ட CPCB NAQI, US-EPA AQI மற்றும் 6 மாசு அளவீடுகள் (PM2.5, PM10, NO2, O3, SO2, CO) தானியங்கி நிலைய-செயற்கைக்கோள் சரிபார்ப்புடன்.',
    },
    {
      title: 'Open-Meteo வெப்பத் தலைகீழ் & காற்று பரவல்',
      tag: 'open-meteo.com',
      description:
        '24-மணி நேர வளிமண்டல எல்லை அடுக்கு (PBL) உயரம், காற்றின் வேகம், ஈரப்பதம் மற்றும் மதியம் ஜன்னல் திறக்க பாதுகாப்பான நேர இடைவெளிகள்.',
    },
    {
      title: 'NASA FIRMS செயற்கைக்கோள் புகை மண்டலம்',
      tag: 'firms.modaps.eosdis.nasa.gov',
      description:
        '500 கிமீ சுற்றளவில் VIIRS/MODIS வெப்பப் புள்ளிகள் மற்றும் பயிர் எரிப்பு புகையை நிகழ்நேரத்தில் கண்காணித்து முன்கூட்டியே எச்சரிக்கை வழங்குகிறது.',
    },
    {
      title: 'OpenStreetMap GPS & அறிவியல் AI',
      tag: 'openstreetmap.org · Gemini · Groq',
      description:
        'தெரு-நிலை Nominatim GPS இருப்பிடத் துல்லியத்துடன் நேரலை உணரி எண்களை மட்டுமே அடிப்படையாகக் கொண்ட அறிவியல் AI வழிகாட்டல்.',
    },
  ],
  uspBadge: 'PranaPulse ஏன் தனித்துவமானது',
  uspTitle: 'ஒரே அறிவியல் மையம், அனைத்து தளங்களிலும்',
  uspSubtitle: 'Telegram கட்டுப்பாடு · துணை உரையாடல் · WhatsApp · இயற்பியல்',
  uspDescription:
    'பெரும்பாலான AQI செயலிகள் ஒரு எண்ணோடு நின்றுவிடுகின்றன. PranaPulse நிகழ்நேர வளிமண்டல அறிவியலை வலைத்தளம், Telegram மற்றும் WhatsApp முழுவதும் 2-வழி தினசரி பாதுகாப்பாக மாற்றுகிறது.',
  uspFeatures: [
    {
      title: 'Telegram வழியாக முழு வலைத்தளத்தையும் இயக்குங்கள்',
      tag: 'இருவழி நேரலை ஒத்திசைவு',
      description:
        'உலாவி திறக்காமலேயே 6 பிரிவுகளையும் கட்டுப்படுத்துங்கள்: நேரலை காற்று பார்க்கவும், GPS அனுப்பவும், CADR, முகக்கவசம், பயணம், RWA அறிவிப்பு மற்றும் நேர மாற்றங்களை உரையாடலாக அனுப்பி காலை 06:30 அறிக்கை பெறுங்கள்.',
    },
    {
      title: 'குடும்ப தினசரி துணை உரையாடல்',
      tag: 'எப்போதும் தயாரான மிதக்கும் AI',
      description:
        'ஒவ்வொரு பக்கத்தின் கீழ்-வலது மூலையிலும் உள்ளது: எந்த குடும்ப உறுப்பினரையும் தேர்ந்தெடுத்து, நேரலை GPS இணைத்து, இயல்பாகக் கேட்டு அட்டவணையை உடனே புதுப்பிக்கவும்.',
    },
    {
      title: '1-தட்டல் WhatsApp அறிக்கைகள் & RWA அறிவிப்புகள்',
      tag: 'உடனடிப் பகிர்வு',
      description:
        'ஒவ்வொரு உறுப்பினருக்குமான காலை பாதுகாப்பு திட்டம் மற்றும் குடியிருப்பு RWA கூட்டு தாக்க அறிவிப்புகளை தமிழ், English அல்லது हिन्दी மொழியில் நேரடியாக WhatsApp-ல் பகிரவும்.',
    },
    {
      title: 'துல்லியமான சுவாச அளவு & CADR இயற்பியல்',
      tag: 'அறிவியல் ஆதாரம்',
      description:
        'நபர் வாரியான PM2.5 சுவாச அளவு (ug/நாள் & சிகரெட் சமம்), 4.8 ACH HEPA மற்றும் DIY Corsi-Rosenthal அளவு, குறைந்த-மாசு பயண வழித்தடம் மற்றும் பொருத்தமான முகக்கவசம்/வடிகட்டி இணைப்புகள்.',
    },
  ],
  gatewayBadge: '6-பிரிவு ஊடாடும் பணிமனை',
  gatewayDescription:
    'நேரலை GPS காற்றுத் தரத்தை அறிய, ஒவ்வொரு குடும்ப உறுப்பினரின் வழக்கத்தை அமைக்க, துணை AI-உடன் உரையாட, 1 கிளிக்கில் Telegram இணைக்க மற்றும் WhatsApp அறிக்கை பகிர பணிமனையைத் தொடங்குங்கள்.',
  gatewayHighlights: [
    '4 நேரலை டெலிமெட்ரி & செயற்கைக்கோள் APIs',
    '2-வழி வலைத்தளம் ↔ Telegram ஒத்திசைவு',
    'English · हिन्दी · தமிழ் · WCAG 2.2 AA',
  ],
  gatewaySecondaryCta: 'மேலே செல்லவும்',
  navGoToPrefix: 'பிரிவுக்குச் செல்:',
};

export const LANDING_COPY: Readonly<Record<SupportedLanguage, LandingLocalePack>> = {
  en,
  hi,
  ta,
};
