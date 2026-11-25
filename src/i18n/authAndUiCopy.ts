/**
 * Complete EN / HI / TA copy for Auth modal, Header controls, Section Info tooltips,
 * Dashboard dispersion cells, Routine controls, Commute extras, RWA, and Floating overlays.
 */

import type { WorkbenchTabId } from '../config/uiConstants.js';
import type { SupportedLanguage } from '../validators/schemas.js';

export interface SectionGuideInfo {
  readonly badge: string;
  readonly title: string;
  readonly summary: string;
}

export interface AuthLocalePack {
  readonly headerSignIn: string;
  readonly headerSignInAria: string;
  readonly headerAccountAriaPrefix: string;
  readonly modalBadge: string;
  readonly titleSignedIn: string;
  readonly titleSignUp: string;
  readonly titleReset: string;
  readonly titleSignIn: string;
  readonly closeDialogAria: string;
  readonly modeAriaLabel: string;
  readonly modeSignIn: string;
  readonly modeSignUp: string;
  readonly modeReset: string;
  readonly submitConnecting: string;
  readonly submitSignUp: string;
  readonly submitReset: string;
  readonly submitSignIn: string;
  readonly nameLabel: string;
  readonly namePlaceholder: string;
  readonly emailLabel: string;
  readonly emailPlaceholder: string;
  readonly passwordLabel: string;
  readonly passwordSignupPlaceholder: string;
  readonly passwordSigninPlaceholder: string;
  readonly showPasswordAria: string;
  readonly hidePasswordAria: string;
  readonly googleButton: string;
  readonly dividerOr: string;
  readonly continueGuestButton: string;
  readonly guestFooterNote: string;
  readonly missingConfigPrefix: string;
  readonly missingConfigAnd: string;
  readonly missingConfigSuffix: string;
  readonly snapshotHeading: string;
  readonly monitoredCityLabel: string;
  readonly roomCadrLabel: string;
  readonly commuteMaskLabel: string;
  readonly lastCloudSaveLabel: string;
  readonly notSyncedYet: string;
  readonly syncedLabel: string;
  readonly signedInFallback: string;
  readonly statusActive: string;
  readonly signOutButton: string;
}

export interface UiChromeLocalePack {
  readonly returnToLandingSuffix: string;
  readonly baselineTelemetryBadge: string;
  readonly liveTelemetryBadge: string;
  readonly capPblInversion: string;
  readonly capCadrMassBalance: string;
  readonly capPulmonaryDose: string;
  readonly safestAiringWindowLabel: string;
  readonly surfaceDispersionLabel: string;
  readonly dominantPollutantLabel: string;
  readonly seasonalBaselineSub: string;
  readonly liveSensorCrossCheckSub: string;
  readonly sectionInfoAriaTemplate: string;
  readonly habitLiveSyncedNote: string;
  readonly habitEditButton: string;
  readonly habitDoneButton: string;
  readonly habitHealthNoteChip: string;
  readonly whatsappBriefPreviewButton: string;
  readonly buyPrefix: string;
  readonly buyOnAmazonTemplate: string;
  readonly buyOnFlipkartTemplate: string;
  readonly verifiedMetroStopsLabel: string;
  readonly rwaNoticeSuffix: string;
  readonly rwaLanguagePrefix: string;
  readonly syncedFromTelegramBadge: string;
  readonly telegramSyncedButton: string;
  readonly closeCompanionChatAria: string;
  readonly indoorBaseSurchargeTemplate: string;
  readonly indoorOptimalSealTemplate: string;
  readonly indoorInfiltrationTemplate: string;
  readonly indoorCookingLoadTemplate: string;
  readonly indoorDiyBadgeTemplate: string;
  readonly srTableHour: string;
  readonly srTableOutdoorPm25: string;
  readonly srTableUnfilteredIndoor: string;
  readonly srTableMitigatedIndoor: string;
  readonly srTableWindKmh: string;
  readonly srTableFrom: string;
  readonly srTableTo: string;
  readonly srTableExposureUg: string;
  readonly srTableMinutes: string;
  readonly corridorMetroFallback: string;
  readonly corridorSurfaceFallback: string;
  readonly corridorInvalidFallback: string;
}

export const AUTH_COPY: Readonly<Record<SupportedLanguage, AuthLocalePack>> = {
  en: {
    headerSignIn: 'Sign in',
    headerSignInAria: 'Sign in to PranaPulse AI',
    headerAccountAriaPrefix: 'Open cloud account settings for',
    modalBadge: 'Supabase Auth · Cloud Sync',
    titleSignedIn: 'Cloud account & sync',
    titleSignUp: 'Create your telemetry account',
    titleReset: 'Reset account password',
    titleSignIn: 'Sign in to PranaPulse AI',
    closeDialogAria: 'Close sign-in dialog',
    modeAriaLabel: 'Authentication mode',
    modeSignIn: 'Sign in',
    modeSignUp: 'Create account',
    modeReset: 'Reset',
    submitConnecting: 'Connecting to Supabase',
    submitSignUp: 'Create cloud account',
    submitReset: 'Send password reset link',
    submitSignIn: 'Sign in to workspace',
    nameLabel: 'Display name (optional)',
    namePlaceholder: 'e.g. Aarav Sharma',
    emailLabel: 'Email address',
    emailPlaceholder: 'you@example.com',
    passwordLabel: 'Password',
    passwordSignupPlaceholder: 'At least 6 characters',
    passwordSigninPlaceholder: 'Enter your password',
    showPasswordAria: 'Show password',
    hidePasswordAria: 'Hide password',
    googleButton: 'Sign in with Google',
    dividerOr: 'or',
    continueGuestButton: 'Continue as Guest (Open Console)',
    guestFooterNote:
      'Guest telemetry stays available without an account. Sign in to sync your monitored city, room CADR, and commute mask profile across devices.',
    missingConfigPrefix: 'Supabase keys are missing. Add',
    missingConfigAnd: 'and',
    missingConfigSuffix: 'in .env and rebuild to enable sign-in.',
    snapshotHeading: 'Synced workspace snapshot',
    monitoredCityLabel: 'Monitored city',
    roomCadrLabel: 'Room & CADR',
    commuteMaskLabel: 'Commute & mask',
    lastCloudSaveLabel: 'Last cloud save',
    notSyncedYet: 'Not synced yet',
    syncedLabel: 'Synced',
    signedInFallback: 'Signed in',
    statusActive: 'Active',
    signOutButton: 'Sign out',
  },
  hi: {
    headerSignIn: 'साइन इन',
    headerSignInAria: 'PranaPulse AI में साइन इन करें',
    headerAccountAriaPrefix: 'क्लाउड खाता सेटिंग्स खोलें:',
    modalBadge: 'Supabase Auth · क्लाउड सिंक',
    titleSignedIn: 'क्लाउड खाता और सिंक',
    titleSignUp: 'अपना टेलीमेट्री खाता बनाएं',
    titleReset: 'खाते का पासवर्ड रीसेट करें',
    titleSignIn: 'PranaPulse AI में साइन इन करें',
    closeDialogAria: 'साइन-इन संवाद बंद करें',
    modeAriaLabel: 'प्रमाणीकरण मोड',
    modeSignIn: 'साइन इन',
    modeSignUp: 'खाता बनाएं',
    modeReset: 'रीसेट',
    submitConnecting: 'Supabase से जुड़ रहा है',
    submitSignUp: 'क्लाउड खाता बनाएं',
    submitReset: 'पासवर्ड रीसेट लिंक भेजें',
    submitSignIn: 'कार्यक्षेत्र में साइन इन करें',
    nameLabel: 'प्रदर्शित नाम (वैकल्पिक)',
    namePlaceholder: 'जैसे आरव शर्मा',
    emailLabel: 'ईमेल पता',
    emailPlaceholder: 'you@example.com',
    passwordLabel: 'पासवर्ड',
    passwordSignupPlaceholder: 'कम से कम 6 अक्षर',
    passwordSigninPlaceholder: 'अपना पासवर्ड दर्ज करें',
    showPasswordAria: 'पासवर्ड दिखाएं',
    hidePasswordAria: 'पासवर्ड छिपाएं',
    googleButton: 'Google से साइन इन करें',
    dividerOr: 'या',
    continueGuestButton: 'अतिथि के रूप में जारी रखें (कंसोल खोलें)',
    guestFooterNote:
      'बिना खाते के भी अतिथि टेलीमेट्री उपलब्ध रहती है। अपने शहर, कमरे के CADR और मास्क प्रोफ़ाइल को सभी डिवाइस पर सिंक करने के लिए साइन इन करें।',
    missingConfigPrefix: 'Supabase कुंजियां अनुपलब्ध हैं। साइन-इन सक्षम करने के लिए',
    missingConfigAnd: 'और',
    missingConfigSuffix: 'को .env में जोड़कर रीबिल्ड करें।',
    snapshotHeading: 'सिंक किया गया कार्यक्षेत्र सारांश',
    monitoredCityLabel: 'निगरानी शहर',
    roomCadrLabel: 'कमरा और CADR',
    commuteMaskLabel: 'यात्रा और मास्क',
    lastCloudSaveLabel: 'अंतिम क्लाउड सेव',
    notSyncedYet: 'अभी सिंक नहीं हुआ',
    syncedLabel: 'सिंक किया गया',
    signedInFallback: 'साइन इन हैं',
    statusActive: 'सक्रिय',
    signOutButton: 'साइन आउट',
  },
  ta: {
    headerSignIn: 'உள்நுழை',
    headerSignInAria: 'PranaPulse AI-ல் உள்நுழைக',
    headerAccountAriaPrefix: 'மேகக் கணக்கு அமைப்புகளைத் திற:',
    modalBadge: 'Supabase Auth · மேக ஒத்திசைவு',
    titleSignedIn: 'மேகக் கணக்கு & ஒத்திசைவு',
    titleSignUp: 'உங்கள் டெலிமெட்ரி கணக்கை உருவாக்குங்கள்',
    titleReset: 'கணக்கு கடவுச்சொல்லை மீட்டமைக்கவும்',
    titleSignIn: 'PranaPulse AI-ல் உள்நுழையவும்',
    closeDialogAria: 'உள்நுழைவு சாளரத்தை மூடு',
    modeAriaLabel: 'அங்கீகார முறை',
    modeSignIn: 'உள்நுழை',
    modeSignUp: 'கணக்கு உருவாக்கு',
    modeReset: 'மீட்டமை',
    submitConnecting: 'Supabase உடன் இணைகிறது',
    submitSignUp: 'மேகக் கணக்கு உருவாக்கு',
    submitReset: 'கடவுச்சொல் மீட்டமைப்பு இணைப்பை அனுப்பு',
    submitSignIn: 'பணிமனையில் உள்நுழைக',
    nameLabel: 'காட்சிப் பெயர் (விருப்பம்)',
    namePlaceholder: 'எ.கா. ஆரவ் சர்மா',
    emailLabel: 'மின்னஞ்சல் முகவரி',
    emailPlaceholder: 'you@example.com',
    passwordLabel: 'கடவுச்சொல்',
    passwordSignupPlaceholder: 'குறைந்தது 6 எழுத்துகள்',
    passwordSigninPlaceholder: 'உங்கள் கடவுச்சொல்லை உள்ளிடவும்',
    showPasswordAria: 'கடவுச்சொல்லைக் காட்டு',
    hidePasswordAria: 'கடவுச்சொல்லை மறை',
    googleButton: 'Google மூலம் உள்நுழைக',
    dividerOr: 'அல்லது',
    continueGuestButton: 'விருந்தினராகத் தொடரவும் (கன்சோல் திற)',
    guestFooterNote:
      'கணக்கு இல்லாமலேயே விருந்தினர் டெலிமெட்ரி கிடைக்கும். உங்கள் நகரம், அறை CADR மற்றும் முகக்கவச அமைப்புகளை சாதனங்களில் ஒத்திசைக்க உள்நுழையவும்.',
    missingConfigPrefix: 'Supabase விசைகள் இல்லை. உள்நுழைவை இயக்க',
    missingConfigAnd: 'மற்றும்',
    missingConfigSuffix: 'ஆகியவற்றை .env-ல் சேர்த்து மீண்டும் கட்டமைக்கவும்.',
    snapshotHeading: 'ஒத்திசைக்கப்பட்ட பணிமனை சுருக்கம்',
    monitoredCityLabel: 'கண்காணிப்பு நகரம்',
    roomCadrLabel: 'அறை & CADR',
    commuteMaskLabel: 'பயணம் & முகக்கவசம்',
    lastCloudSaveLabel: 'கடைசி மேக சேமிப்பு',
    notSyncedYet: 'இன்னும் ஒத்திசைக்கப்படவில்லை',
    syncedLabel: 'ஒத்திசைக்கப்பட்டது',
    signedInFallback: 'உள்நுழைந்துள்ளீர்',
    statusActive: 'செயலில்',
    signOutButton: 'வெளியேறு',
  },
};

export const SECTION_GUIDES_COPY: Readonly<
  Record<SupportedLanguage, Readonly<Record<WorkbenchTabId, SectionGuideInfo>>>
> = {
  en: {
    dashboard: {
      badge: 'Section 1 · Telemetry',
      title: 'Live Atmospheric & Smog Dashboard',
      summary:
        'Cross-checks live ground air monitors (OpenAQ v3 & WAQI), 24h boundary-layer inversion forecasts (Open-Meteo), and 500km NASA FIRMS fire plumes to show CPCB NAQI, US-EPA AQI, and safe window-airing hours for any GPS location.',
    },
    routine: {
      badge: 'Section 2 · Household',
      title: 'Family Routine & Personalized Care',
      summary:
        'Computes per-member inhaled PM2.5 dose (ug/day) for children, seniors, and commuters, builds individualized 4-step daily schedules, and syncs edits live with Telegram and 1-tap WhatsApp briefs.',
    },
    indoor: {
      badge: 'Section 3 · Physics',
      title: 'Indoor Mass-Balance & CADR Clearance',
      summary:
        'Models 24h indoor vs. outdoor PM2.5 infiltration from room area, window tightness, cooking fuel, and HEPA purifier CADR (4.8 ACH target) to compute exact 90% purge time and exposure reduction.',
    },
    commute: {
      badge: 'Section 4 · Mobility',
      title: 'Low-Exposure Commute & Corridor Router',
      summary:
        'Compares 7 transit modes on inhaled PM2.5 dose vs. CO2 emissions to find Pareto-optimal commutes, and plans lower-exposure origin-to-destination city routes with direct Google Maps links.',
    },
    gear: {
      badge: 'Section 5 · Protection',
      title: 'Masks, HEPA Purifiers & DIY Alternatives',
      summary:
        'Compares mask filtration efficiency (N95/FFP2, surgical, cloth), calculates exact HEPA CADR or DIY MERV-13 Corsi-Rosenthal box sizing for your room, and surfaces matched buying options.',
    },
    community: {
      badge: 'Section 6 · Collective',
      title: 'RWA Neighborhood Impact & Notice',
      summary:
        'Simulates daily CO2 and PM2.5 avoided when housing-society homes adopt shared transit and halt open leaf burning, and builds a ready-to-share multilingual WhatsApp RWA notice.',
    },
  },
  hi: {
    dashboard: {
      badge: 'अनुभाग 1 · टेलीमेट्री',
      title: 'लाइव वायुमंडलीय और स्मॉग डैशबोर्ड',
      summary:
        'किसी भी GPS स्थान हेतु CPCB NAQI, US-EPA AQI और सुरक्षित वेंटिलेशन घंटे दिखाने के लिए लाइव जमीनी मॉनिटर (OpenAQ v3 व WAQI), 24-घंटे बाउंड्री लेयर पूर्वानुमान (Open-Meteo) और 500 किमी NASA FIRMS अग्नि धुएं की क्रॉस-जांच करता है।',
    },
    routine: {
      badge: 'अनुभाग 2 · परिवार',
      title: 'पारिवारिक दिनचर्या और व्यक्तिगत देखभाल',
      summary:
        'बच्चों, वरिष्ठों और यात्रियों के लिए दैनिक श्वसन PM2.5 खुराक (ug/दिन) की गणना करता है, हर सदस्य हेतु 4-चरणीय योजना बनाता है और Telegram व 1-टैप WhatsApp बुलेटिन से लाइव सिंक करता है।',
    },
    indoor: {
      badge: 'अनुभाग 3 · भौतिकी',
      title: 'इनडोर मास-बैलेंस और CADR शुद्धिकरण',
      summary:
        'कमरे के क्षेत्रफल, खिड़की सीलिंग, रसोई ईंधन और HEPA प्यूरिफायर CADR (4.8 ACH लक्ष्य) के आधार पर 24-घंटे इनडोर बनाम बाहरी PM2.5 मॉडल कर सटीक 90% सफाई समय व प्रदूषण कमी निकालता है।',
    },
    commute: {
      badge: 'अनुभाग 4 · यात्रा',
      title: 'कम-प्रदूषण यात्रा और मार्ग योजनाकार',
      summary:
        'श्वसन PM2.5 खुराक बनाम CO2 उत्सर्जन पर 7 यात्रा साधनों की तुलना कर सर्वोत्तम विकल्प खोजता है और सीधे Google Maps लिंक के साथ कम-प्रदूषण मार्ग बनाता है।',
    },
    gear: {
      badge: 'अनुभाग 5 · सुरक्षा उपकरण',
      title: 'मास्क, HEPA प्यूरिफायर और DIY विकल्प',
      summary:
        'मास्क फ़िल्ट्रेशन क्षमता (N95/FFP2, सर्जिकल, कपड़ा) की तुलना करता है, कमरे के लिए सटीक HEPA CADR या DIY MERV-13 बॉक्स आकार निकालता है और उपयुक्त खरीद विकल्प दिखाता है।',
    },
    community: {
      badge: 'अनुभाग 6 · समुदाय',
      title: 'RWA सोसाइटी सामूहिक प्रभाव और सूचना',
      summary:
        'जब सोसाइटी के घर साझा परिवहन अपनाते हैं और खुले में पत्ते जलाना रोकते हैं, तब दैनिक CO2 व PM2.5 बचत का अनुकरण कर साझा करने योग्य बहुभाषी WhatsApp RWA सूचना तैयार करता है।',
    },
  },
  ta: {
    dashboard: {
      badge: 'பிரிவு 1 · டெலிமெட்ரி',
      title: 'நேரலை வளிமண்டல & புகைமூட்ட டாஷ்போர்டு',
      summary:
        'எந்த GPS இடத்திற்கும் CPCB NAQI, US-EPA AQI மற்றும் பாதுகாப்பான காற்றோட்ட நேரத்தைக் காட்ட தரை உணரிகள் (OpenAQ v3 & WAQI), 24-மணி எல்லை அடுக்கு கணிப்பு (Open-Meteo) மற்றும் 500 கிமீ NASA FIRMS தீப்புள்ளி தரவுகளை சரிபார்க்கிறது.',
    },
    routine: {
      badge: 'பிரிவு 2 · குடும்பம்',
      title: 'குடும்ப அட்டவணை & தனிப்பயன் பராமரிப்பு',
      summary:
        'குழந்தைகள், மூத்தோர் மற்றும் பயணிகளுக்கான தினசரி PM2.5 சுவாச அளவை (ug/நாள்) கணக்கிட்டு, 4-படி தனிப்பயன் அட்டவணை உருவாக்கி Telegram மற்றும் 1-தட்டல் WhatsApp-உடன் நேரலையில் ஒத்திசைக்கிறது.',
    },
    indoor: {
      badge: 'பிரிவு 3 · இயற்பியல்',
      title: 'உள்ளக நிறை-சமநிலை & CADR சுத்திகரிப்பு',
      summary:
        'அறை பரப்பளவு, ஜன்னல் அடைப்பு, சமையல் எரிபொருள் மற்றும் HEPA CADR (4.8 ACH இலக்கு) மூலம் 24-மணி உள்-வெளி PM2.5 அளவையும் 90% புகை நீக்க நேரத்தையும் கணக்கிடுகிறது.',
    },
    commute: {
      badge: 'பிரிவு 4 · பயணம்',
      title: 'குறைந்த மாசு பயணம் & வழித்தட வழிகாட்டி',
      summary:
        'PM2.5 சுவாச அளவு மற்றும் CO2 உமிழ்வில் 7 பயண முறைகளை ஒப்பிட்டு சிறந்த தேர்வைக் காட்டி, நேரடி Google Maps இணைப்புடன் குறைந்த மாசு நகர வழித்தடங்களைத் திட்டமிடுகிறது.',
    },
    gear: {
      badge: 'பிரிவு 5 · பாதுகாப்பு',
      title: 'முகக்கவசம், HEPA வடிகட்டி & DIY தீர்வுகள்',
      summary:
        'முகக்கவச வடிகட்டல் திறனை (N95/FFP2, மருத்துவ, துணி) ஒப்பிட்டு, உங்கள் அறைக்கான HEPA CADR அல்லது DIY MERV-13 பெட்டி அளவைக் கணக்கிட்டு பொருத்தமான தயாரிப்புகளைக் காட்டுகிறது.',
    },
    community: {
      badge: 'பிரிவு 6 · சமூகம்',
      title: 'RWA குடியிருப்பு கூட்டு தாக்கம் & அறிவிப்பு',
      summary:
        'குடியிருப்பு வீடுகள் பொதுப் போக்குவரத்தைத் தேர்ந்தெடுத்து இலை எரிப்பை நிறுத்தும்போது தவிர்க்கப்படும் தினசரி CO2 மற்றும் PM2.5 அளவைக் கணக்கிட்டு பகிரத் தயாரான பன்மொழி WhatsApp RWA அறிவிப்பை உருவாக்குகிறது.',
    },
  },
};

export const UI_CHROME_COPY: Readonly<Record<SupportedLanguage, UiChromeLocalePack>> = {
  en: {
    returnToLandingSuffix: 'Return to landing page',
    baselineTelemetryBadge: 'Baseline Telemetry',
    liveTelemetryBadge: 'Live Telemetry',
    capPblInversion: 'PBL Inversion',
    capCadrMassBalance: 'CADR Mass-Balance',
    capPulmonaryDose: 'Pulmonary Dose',
    safestAiringWindowLabel: 'Safest Airing Window',
    surfaceDispersionLabel: 'Surface Dispersion',
    dominantPollutantLabel: 'Dominant Pollutant',
    seasonalBaselineSub: 'Seasonal baseline',
    liveSensorCrossCheckSub: 'Live sensor cross-check',
    sectionInfoAriaTemplate: 'What {section} does',
    habitLiveSyncedNote: 'Live-synced with personalized daily schedule & Telegram',
    habitEditButton: 'Edit',
    habitDoneButton: 'Done',
    habitHealthNoteChip: 'Health note',
    whatsappBriefPreviewButton: 'WhatsApp Brief',
    buyPrefix: 'Buy:',
    buyOnAmazonTemplate: 'Buy {title} on Amazon.in',
    buyOnFlipkartTemplate: 'Buy {title} on Flipkart',
    verifiedMetroStopsLabel: 'Verified intermediate stops (hover icons):',
    rwaNoticeSuffix: 'RWA Notice',
    rwaLanguagePrefix: 'Lang',
    syncedFromTelegramBadge: 'Synced from Telegram',
    telegramSyncedButton: 'Telegram Synced',
    closeCompanionChatAria: 'Close companion chat',
    indoorBaseSurchargeTemplate: 'Base {base} + {surcharge} seal/fuel',
    indoorOptimalSealTemplate: 'Optimal seal & induction ({ach} ACH)',
    indoorInfiltrationTemplate: 'Infiltration: {ach} ACH',
    indoorCookingLoadTemplate: 'Cooking load: {load} ug/h',
    indoorDiyBadgeTemplate: '{count}x DIY Box · Target {cadr} m3/h',
    srTableHour: 'Hour',
    srTableOutdoorPm25: 'Outdoor PM2.5',
    srTableUnfilteredIndoor: 'Unfiltered Indoor PM2.5',
    srTableMitigatedIndoor: 'Mitigated Indoor PM2.5',
    srTableWindKmh: 'Wind km/h',
    srTableFrom: 'From',
    srTableTo: 'To',
    srTableExposureUg: 'Exposure ug',
    srTableMinutes: 'Minutes',
    corridorMetroFallback:
      'Metro corridor from {from} to {to} bypasses higher-PM2.5 arterial traffic at {jct} & {fly}. Verify stations via Google Maps.',
    corridorSurfaceFallback:
      'Cleanest surface road route from {from} to {to} follows {green}, avoiding high-exhaust {jct} & {fly}.',
    corridorInvalidFallback:
      'The entered origin or destination does not match a valid connected locality in this city. Please enter two genuine areas.',
  },
  hi: {
    returnToLandingSuffix: 'मुख्य पृष्ठ पर लौटें',
    baselineTelemetryBadge: 'बेसलाइन टेलीमेट्री',
    liveTelemetryBadge: 'लाइव टेलीमेट्री',
    capPblInversion: 'PBL इनवर्जन',
    capCadrMassBalance: 'CADR मास-बैलेंस',
    capPulmonaryDose: 'श्वसन खुराक',
    safestAiringWindowLabel: 'सबसे सुरक्षित वेंटिलेशन समय',
    surfaceDispersionLabel: 'सतही वायु फैलाव',
    dominantPollutantLabel: 'प्रमुख प्रदूषक',
    seasonalBaselineSub: 'मौसमी बेसलाइन अनुमान',
    liveSensorCrossCheckSub: 'लाइव सेंसर क्रॉस-जांच',
    sectionInfoAriaTemplate: '{section} क्या करता है',
    habitLiveSyncedNote: 'व्यक्तिगत दैनिक समय-सारणी और Telegram के साथ लाइव सिंक',
    habitEditButton: 'बदलें',
    habitDoneButton: 'पूर्ण',
    habitHealthNoteChip: 'स्वास्थ्य नोट',
    whatsappBriefPreviewButton: 'WhatsApp सारांश',
    buyPrefix: 'खरीदें:',
    buyOnAmazonTemplate: 'Amazon.in पर {title} खरीदें',
    buyOnFlipkartTemplate: 'Flipkart पर {title} खरीदें',
    verifiedMetroStopsLabel: 'सत्यापित मध्यवर्ती स्टेशन (आइकन पर होवर करें):',
    rwaNoticeSuffix: 'RWA सूचना',
    rwaLanguagePrefix: 'भाषा',
    syncedFromTelegramBadge: 'Telegram से सिंक हुआ',
    telegramSyncedButton: 'Telegram जुड़ा है',
    closeCompanionChatAria: 'साथी चैट बंद करें',
    indoorBaseSurchargeTemplate: 'आधार {base} + {surcharge} सील/ईंधन',
    indoorOptimalSealTemplate: 'उत्तम सील और इंडक्शन ({ach} ACH)',
    indoorInfiltrationTemplate: 'हवा रिसाव: {ach} ACH',
    indoorCookingLoadTemplate: 'रसोई धुआं भार: {load} ug/h',
    indoorDiyBadgeTemplate: '{count}x DIY बॉक्स · लक्ष्य {cadr} m3/h',
    srTableHour: 'घंटा',
    srTableOutdoorPm25: 'बाहरी PM2.5',
    srTableUnfilteredIndoor: 'बिना फ़िल्टर इनडोर PM2.5',
    srTableMitigatedIndoor: 'फ़िल्टर्ड इनडोर PM2.5',
    srTableWindKmh: 'हवा किमी/घं',
    srTableFrom: 'प्रारंभ',
    srTableTo: 'गंतव्य',
    srTableExposureUg: 'प्रदूषण खुराक ug',
    srTableMinutes: 'मिनट',
    corridorMetroFallback:
      '{from} से {to} तक मेट्रो मार्ग {jct} और {fly} के अधिक PM2.5 ट्रैफ़िक से बचाता है। Google Maps पर स्टेशन जांचें।',
    corridorSurfaceFallback:
      '{from} से {to} तक सबसे स्वच्छ सड़क मार्ग {green} से होकर जाता है और भारी धुएं वाले {jct} व {fly} से बचाता है।',
    corridorInvalidFallback:
      'दर्ज किया गया प्रारंभ या गंतव्य इस शहर के किसी मान्य जुड़े क्षेत्र से मेल नहीं खाता। कृपया दो सही क्षेत्र दर्ज करें।',
  },
  ta: {
    returnToLandingSuffix: 'முகப்புப் பக்கத்திற்குத் திரும்பு',
    baselineTelemetryBadge: 'அடிப்படை டெலிமெட்ரி',
    liveTelemetryBadge: 'நேரலை டெலிமெட்ரி',
    capPblInversion: 'PBL வெப்ப மூடி',
    capCadrMassBalance: 'CADR நிறை-சமநிலை',
    capPulmonaryDose: 'நுரையீரல் அளவு',
    safestAiringWindowLabel: 'பாதுகாப்பான காற்றோட்ட நேரம்',
    surfaceDispersionLabel: 'மேற்பரப்பு காற்று பரவல்',
    dominantPollutantLabel: 'முதன்மை மாசு',
    seasonalBaselineSub: 'பருவகால அடிப்படை',
    liveSensorCrossCheckSub: 'நேரலை உணரி சரிபார்ப்பு',
    sectionInfoAriaTemplate: '{section} என்ன செய்கிறது',
    habitLiveSyncedNote: 'தனிப்பயன் தினசரி அட்டவணை & Telegram-உடன் நேரலை ஒத்திசைவு',
    habitEditButton: 'திருத்து',
    habitDoneButton: 'முடிந்தது',
    habitHealthNoteChip: 'உடல்நல குறிப்பு',
    whatsappBriefPreviewButton: 'WhatsApp அறிக்கை',
    buyPrefix: 'வாங்க:',
    buyOnAmazonTemplate: 'Amazon.in-ல் {title} வாங்க',
    buyOnFlipkartTemplate: 'Flipkart-ல் {title} வாங்க',
    verifiedMetroStopsLabel: 'சரிபார்க்கப்பட்ட இடைநிலை நிறுத்தங்கள் (ஐகான்களைப் பார்க்கவும்):',
    rwaNoticeSuffix: 'RWA அறிவிப்பு',
    rwaLanguagePrefix: 'மொழி',
    syncedFromTelegramBadge: 'Telegram-லிருந்து ஒத்திசைக்கப்பட்டது',
    telegramSyncedButton: 'Telegram இணைந்தது',
    closeCompanionChatAria: 'துணை உரையாடலை மூடு',
    indoorBaseSurchargeTemplate: 'அடிப்படை {base} + {surcharge} அடைப்பு/எரிபொருள்',
    indoorOptimalSealTemplate: 'சிறந்த அடைப்பு & மின் அடுப்பு ({ach} ACH)',
    indoorInfiltrationTemplate: 'காற்று ஊடுருவல்: {ach} ACH',
    indoorCookingLoadTemplate: 'சமையல் புகை: {load} ug/h',
    indoorDiyBadgeTemplate: '{count}x DIY பெட்டி · இலக்கு {cadr} m3/h',
    srTableHour: 'மணி',
    srTableOutdoorPm25: 'வெளி PM2.5',
    srTableUnfilteredIndoor: 'வடிகட்டாத உள் PM2.5',
    srTableMitigatedIndoor: 'வடிகட்டிய உள் PM2.5',
    srTableWindKmh: 'காற்று கிமீ/மணி',
    srTableFrom: 'இருந்து',
    srTableTo: 'வரை',
    srTableExposureUg: 'மாசு அளவு ug',
    srTableMinutes: 'நிமிடங்கள்',
    corridorMetroFallback:
      '{from} முதல் {to} வரையிலான மெட்ரோ வழி {jct} மற்றும் {fly} பகுதியின் அதிக PM2.5 போக்குவரத்தைத் தவிர்க்கிறது. Google Maps-ல் நிலையங்களைச் சரிபார்க்கவும்.',
    corridorSurfaceFallback:
      '{from} முதல் {to} வரையிலான தூய சாலை வழி {green} வழியாகச் சென்று அதிக புகையுள்ள {jct} மற்றும் {fly} பகுதிகளைத் தவிர்க்கிறது.',
    corridorInvalidFallback:
      'உள்ளிட்ட புறப்படும் அல்லது சேரும் பகுதி இந்த நகரத்தின் சரியான இடங்களுடன் பொருந்தவில்லை. இரண்டு சரியான பகுதிகளை உள்ளிடவும்.',
  },
};
