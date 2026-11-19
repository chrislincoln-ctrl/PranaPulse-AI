/**
 * Fully localized EN / HI / TA deterministic fallback plan and chat builders.
 * Ensures zero untranslated English sentences appear when Hindi or Tamil is active.
 */

import { VALIDATION_BOUNDS } from '../config/constants.js';
import type { DeterministicBriefContext } from '../domain/fallbackPlanBuilder.js';
import type { AiPlanOutput, ChatRequestPayload } from '../validators/schemas.js';
import { TRANSLATIONS, type LocaleDictionary } from './translations.js';

const CORSI_BUDGET_INR = 1_800;
const HEPA_BUDGET_INR = 9_500;
const WET_SEAL_BUDGET_INR = 120;
const ACH_DECIMAL_TENTHS = 8;

function formatWindowList(hours: readonly number[]): string {
  return hours.map((hr) => `${String(hr).padStart(2, '0')}:00`).join(', ');
}

function resolvePlanVars(ctx: DeterministicBriefContext, t: LocaleDictionary) {
  return {
    cityLabel: t.cityNames[ctx.request.city] ?? ctx.request.city,
    cleanWindows: formatWindowList(ctx.inversion.bestWindowHours),
    avoidWindows: formatWindowList(ctx.inversion.avoidOutdoorHours),
    corridorPath: ctx.corridor.lowestExposurePath.map((id) => t.corridorNodes[id]).join(' -> '),
    bestMode: t.commuteModes[ctx.bestCommute.mode],
    reqMode: t.commuteModes[ctx.request.commuteMode],
    maskLabel: t.maskOptions[ctx.request.mask],
    targetAch: `${String(VALIDATION_BOUNDS.MIN_ROUTINE_ITEMS)}.${String(ACH_DECIMAL_TENTHS)}`,
  };
}

function buildEnPlan(ctx: DeterministicBriefContext): AiPlanOutput {
  const v = resolvePlanVars(ctx, TRANSLATIONS.en);
  const windowMsg = ctx.inversion.openWindowsNow ? 'safe right now' : 'wait for solar breakup';

  return {
    headline: `Smog Defense Routine: ${ctx.request.city} (CPCB NAQI ${String(ctx.effectiveAqi)}, ${String(ctx.aqi.who24hMultiple)}x WHO 24h limit)`,
    dailyRoutine: [
      {
        timeWindow: '06:30 - 10:30',
        actionTitle: 'Morning Seal & Clean Stove Window',
        reasonSummary: `Shallow mixing (${String(ctx.inversion.currentPblMeters)} m PBL) traps morning pollutants near (${v.avoidWindows}). Keep exterior doors sealed and cook with exhaust/induction.`,
        estimatedImpactLabel: `Cuts indoor peak exposure by ${String(ctx.indoor.exposureReductionPct)}%`,
        exposureTag: 'indoor',
      },
      {
        timeWindow: `Best window (${v.cleanWindows})`,
        actionTitle: 'Solar-Breakup Cross-Ventilation',
        reasonSummary: `Solar heating lifts boundary layer ceiling (${windowMsg}). Cross-ventilate briefly for 20 minutes.`,
        estimatedImpactLabel: 'Purges stale CO2 without raising PM2.5',
        exposureTag: 'ventilation',
      },
      {
        timeWindow: 'Commute Hours',
        actionTitle: `Low-Dose Clean Corridor Commute (${ctx.bestCommute.mode} + ${ctx.request.mask})`,
        reasonSummary: `Cleanest corridor (${ctx.corridor.lowestExposurePath.join(' -> ')}) avoids high-exhaust arterial canyons.`,
        estimatedImpactLabel: `Saves ${String(ctx.corridor.exposureSavedUg)} ug (${String(ctx.corridor.exposureSavedPct)}% lower dose)`,
        exposureTag: 'commute',
      },
      {
        timeWindow: '18:30 - 22:30',
        actionTitle: 'Evening Inversion Air Purge',
        reasonSummary: `Nighttime thermal inversion re-traps surface emissions. Target ${String(ctx.indoor.requiredCadr48Ach)} m3/hr CADR for 90% purge in ${String(ctx.indoor.purge90Minutes)} min.`,
        estimatedImpactLabel: `Indoor mean ${String(ctx.indoor.dailyMeanMitigatedPm25)} vs ${String(ctx.indoor.dailyMeanBaselinePm25)} ug/m3 baseline`,
        exposureTag: 'outdoor',
      },
    ],
    indoorHacks: [
      {
        tier: 'zero-cost',
        title: 'Seal Door Sweeps with Damp Rolled Towels',
        howTo: `Close balcony/window gaps during inversion peaks (${v.avoidWindows}) to lower outdoor PM2.5 infiltration factor.`,
        estimatedCostInr: 0,
      },
      {
        tier: 'zero-cost',
        title: 'Moist Floor Mopping Instead of Dry Sweeping',
        howTo:
          'Wipe hard surfaces with damp microfibre cloth so settled winter dust does not resuspend indoors.',
        estimatedCostInr: WET_SEAL_BUDGET_INR,
      },
      {
        tier: 'diy-budget',
        title: 'DIY Corsi-Rosenthal MERV-13 Box-Fan Purifier (~380 m3/hr CADR)',
        howTo:
          'Tape a 20-inch box fan onto 4 MERV-13 pleats; avoid ozone ionizers and houseplants which fail on PM2.5 smog.',
        estimatedCostInr: CORSI_BUDGET_INR,
      },
      {
        tier: 'filtration',
        title: `Sized True HEPA Purifier (${String(ctx.indoor.requiredCadr48Ach)} m3/hr CADR target)`,
        howTo: `Targets ${v.targetAch} air changes/hr for your ${String(ctx.indoor.roomVolumeM3)} m3 room.`,
        estimatedCostInr: HEPA_BUDGET_INR,
      },
    ],
    sustainableSwaps: [
      {
        fromHabit: `${ctx.request.commuteMode} solo road travel`,
        toAlternative: `${ctx.bestCommute.mode} + fitted N95 on clean corridor`,
        quantifiedBenefit: `${String(ctx.bestCommute.personalInhaledUg)} ug lung dose & ${String(ctx.bestCommute.communityCo2Grams)} g CO2e per trip`,
      },
      {
        fromHabit: 'Individual household waste burning & peak gas spikes',
        toAlternative: `Neighborhood zero-burn pledge across ${String(ctx.rwa.householdsParticipating)} homes`,
        quantifiedBenefit: `Saves ${String(ctx.rwa.dailyCo2SavedKg)} kg CO2e & ${String(ctx.rwa.dailyPm25AvoidedG)} g PM2.5 daily`,
      },
    ],
    sourceAttributionNote:
      'Deterministic physics engine + Open-Meteo telemetry; computed deterministically (fallback mode).',
  };
}

function buildHiPlan(ctx: DeterministicBriefContext): AiPlanOutput {
  const v = resolvePlanVars(ctx, TRANSLATIONS.hi);
  const windowMsg = ctx.inversion.openWindowsNow
    ? 'अभी खिड़की खोलना सुरक्षित है'
    : 'दोपहर धूप निकलने की प्रतीक्षा करें';

  return {
    headline: `स्मॉग सुरक्षा दिनचर्या: ${v.cityLabel} (CPCB NAQI ${String(ctx.effectiveAqi)}, WHO सीमा का ${String(ctx.aqi.who24hMultiple)} गुना)`,
    dailyRoutine: [
      {
        timeWindow: 'सुबह 06:30 - 10:30',
        actionTitle: 'सुबह घर सील और स्वच्छ रसोई सावधानी',
        reasonSummary: `कम मिश्रण ऊंचाई (${String(ctx.inversion.currentPblMeters)} मी PBL) सुबह (${v.avoidWindows}) धुंध को सतह पर रोकती है। बाहरी दरवाजे बंद रखें और चिमनी या इंडक्शन का उपयोग करें।`,
        estimatedImpactLabel: `इनडोर प्रदूषण में ${String(ctx.indoor.exposureReductionPct)}% की कमी`,
        exposureTag: 'indoor',
      },
      {
        timeWindow: `सर्वोत्तम समय (${v.cleanWindows})`,
        actionTitle: 'दोपहर धूप के समय सुरक्षित वेंटिलेशन',
        reasonSummary: `सौर ताप से मिश्रण परत ऊपर उठती है (${windowMsg})। केवल 20 मिनट के लिए हवा आर-पार होने दें।`,
        estimatedImpactLabel: 'PM2.5 बढ़ाए बिना CO2 बाहर निकालता है',
        exposureTag: 'ventilation',
      },
      {
        timeWindow: 'यात्रा समय (सुबह व शाम)',
        actionTitle: `कम-प्रदूषण सुरक्षित मार्ग यात्रा (${v.bestMode} + ${v.maskLabel})`,
        reasonSummary: `स्वच्छ मार्ग (${v.corridorPath}) भारी ट्रैफ़िक वाले मुख्य चौराहों के धुएं से बचाता है।`,
        estimatedImpactLabel: `${String(ctx.corridor.exposureSavedUg)} ug बचत (${String(ctx.corridor.exposureSavedPct)}% कम श्वसन खुराक)`,
        exposureTag: 'commute',
      },
      {
        timeWindow: 'शाम 18:30 - 22:30',
        actionTitle: 'शाम इनवर्जन एयर प्यूरिफिकेशन',
        reasonSummary: `रात का थर्मल इनवर्जन फिर से प्रदूषण को फंसाता है। ${String(ctx.indoor.purge90Minutes)} मिनट में 90% सफाई हेतु ${String(ctx.indoor.requiredCadr48Ach)} m3/h CADR चलाएं।`,
        estimatedImpactLabel: `इनडोर औसत ${String(ctx.indoor.dailyMeanMitigatedPm25)} बनाम ${String(ctx.indoor.dailyMeanBaselinePm25)} ug/m3`,
        exposureTag: 'outdoor',
      },
    ],
    indoorHacks: [
      {
        tier: 'zero-cost',
        title: 'दरवाजों के नीचे गीले तौलिये से दरारें बंद करें',
        howTo: `इनवर्जन पीक (${v.avoidWindows}) के दौरान बालकनी और खिड़कियों की दरारें बंद रखें ताकि बाहरी PM2.5 अंदर न आए।`,
        estimatedCostInr: 0,
      },
      {
        tier: 'zero-cost',
        title: 'सूखी झाड़ू के बजाय गीले कपड़े से पोछा लगाएं',
        howTo: 'फर्श और सतहों को गीले माइक्रोफ़ाइबर कपड़े से साफ करें ताकि जमी हुई धूल हवा में दोबारा न उड़े।',
        estimatedCostInr: WET_SEAL_BUDGET_INR,
      },
      {
        tier: 'diy-budget',
        title: 'DIY Corsi-Rosenthal MERV-13 बॉक्स-फैन प्यूरिफायर (~380 m3/h CADR)',
        howTo:
          'चार MERV-13 फ़िल्टर और 50 सेमी बॉक्स पंखे को जोड़ें; ओज़ोन आयोनाइज़र से बचें जो फेफड़ों को नुकसान पहुंचाते हैं।',
        estimatedCostInr: CORSI_BUDGET_INR,
      },
      {
        tier: 'filtration',
        title: `सही आकार का HEPA प्यूरिफायर (${String(ctx.indoor.requiredCadr48Ach)} m3/h CADR लक्ष्य)`,
        howTo: `आपके ${String(ctx.indoor.roomVolumeM3)} m3 कमरे के लिए प्रति घंटे ${v.targetAch} वायु परिवर्तन (ACH) सुनिश्चित करता है।`,
        estimatedCostInr: HEPA_BUDGET_INR,
      },
    ],
    sustainableSwaps: [
      {
        fromHabit: `${v.reqMode} से अकेले सड़क यात्रा`,
        toAlternative: `स्वच्छ मार्ग पर ${v.bestMode} + फिटेड N95 मास्क`,
        quantifiedBenefit: `प्रति यात्रा ${String(ctx.bestCommute.personalInhaledUg)} ug श्वसन खुराक व ${String(ctx.bestCommute.communityCo2Grams)} ग्राम CO2e`,
      },
      {
        fromHabit: 'खुले में पत्ते व कचरा जलाना',
        toAlternative: `${String(ctx.rwa.householdsParticipating)} घरों में शून्य-दहन RWA संकल्प`,
        quantifiedBenefit: `दैनिक ${String(ctx.rwa.dailyCo2SavedKg)} किग्रा CO2e और ${String(ctx.rwa.dailyPm25AvoidedG)} ग्राम PM2.5 की बचत`,
      },
    ],
    sourceAttributionNote: 'भौतिकी मॉडल और लाइव Open-Meteo डेटा पर आधारित सत्यापित गणना।',
  };
}

function buildTaPlan(ctx: DeterministicBriefContext): AiPlanOutput {
  const v = resolvePlanVars(ctx, TRANSLATIONS.ta);
  const windowMsg = ctx.inversion.openWindowsNow
    ? 'இப்போது திறப்பது பாதுகாப்பானது'
    : 'மதிய வெயில் நேரத்திற்காக காத்திருக்கவும்';

  return {
    headline: `புகைமூட்ட பாதுகாப்பு அட்டவணை: ${v.cityLabel} (CPCB NAQI ${String(ctx.effectiveAqi)}, WHO வரம்பை விட ${String(ctx.aqi.who24hMultiple)} மடங்கு)`,
    dailyRoutine: [
      {
        timeWindow: 'காலை 06:30 - 10:30',
        actionTitle: 'காலை வீடு பாதுகாப்பு மற்றும் சமையல் கவனம்',
        reasonSummary: `குறைந்த கலப்பு உயரம் (${String(ctx.inversion.currentPblMeters)} மீ PBL) காலை (${v.avoidWindows}) மாசுகளைத் தக்கவைக்கிறது. ஜன்னல்களை மூடி புகைபோக்கி/மின் அடுப்பைப் பயன்படுத்தவும்.`,
        estimatedImpactLabel: `வீட்டு மாசு அளவை ${String(ctx.indoor.exposureReductionPct)}% குறைக்கிறது`,
        exposureTag: 'indoor',
      },
      {
        timeWindow: `சிறந்த நேரம் (${v.cleanWindows})`,
        actionTitle: 'மதிய வெயில் நேர பாதுகாப்பான காற்றோட்டம்',
        reasonSummary: `சூரிய வெப்பத்தால் காற்று அடுக்கு உயர்கிறது (${windowMsg}). 20 நிமிடங்கள் மட்டும் ஜன்னல்களைத் திறந்து காற்றோட்டம் செய்யவும்.`,
        estimatedImpactLabel: 'PM2.5 உயராமல் CO2 வாயுவை வெளியேற்றுகிறது',
        exposureTag: 'ventilation',
      },
      {
        timeWindow: 'பயண நேரம் (காலை & மாலை)',
        actionTitle: `குறைந்த மாசு பாதுகாப்பான பயண வழி (${v.bestMode} + ${v.maskLabel})`,
        reasonSummary: `பசுமை வழித்தடம் (${v.corridorPath}) அதிக போக்குவரத்து புகையைத் தவிர்க்க உதவுகிறது.`,
        estimatedImpactLabel: `${String(ctx.corridor.exposureSavedUg)} ug சேமிப்பு (${String(ctx.corridor.exposureSavedPct)}% குறைந்த பாதிப்பு)`,
        exposureTag: 'commute',
      },
      {
        timeWindow: 'மாலை 18:30 - 22:30',
        actionTitle: 'மாலை காற்று சுத்திகரிப்பு நேரம்',
        reasonSummary: `இரவு வெப்பத் தலைகீழ் மாற்றம் புகையை மீண்டும் தேக்குகிறது. ${String(ctx.indoor.purge90Minutes)} நிமிடத்தில் 90% சுத்தம் செய்ய ${String(ctx.indoor.requiredCadr48Ach)} m3/h CADR இயக்கவும்.`,
        estimatedImpactLabel: `உள் சராசரி ${String(ctx.indoor.dailyMeanMitigatedPm25)} vs ${String(ctx.indoor.dailyMeanBaselinePm25)} ug/m3`,
        exposureTag: 'outdoor',
      },
    ],
    indoorHacks: [
      {
        tier: 'zero-cost',
        title: 'கதவு இடைவெளிகளை ஈரமான துணியால் அடைக்கவும்',
        howTo: `அதிக மாசு நேரங்களில் (${v.avoidWindows}) பால்கனி மற்றும் ஜன்னல் இடைவெளிகளை மூடி வெளிப்புற PM2.5 உட்புகுதலைத் தடுக்கவும்.`,
        estimatedCostInr: 0,
      },
      {
        tier: 'zero-cost',
        title: 'உலர் பெருக்கலுக்குப் பதிலாக ஈரத் துடைப்பு',
        howTo: 'தரையில் படிந்துள்ள தூசி மீண்டும் காற்றில் கலக்காமல் இருக்க ஈரமான துணியால் துடைக்கவும்.',
        estimatedCostInr: WET_SEAL_BUDGET_INR,
      },
      {
        tier: 'diy-budget',
        title: 'DIY Corsi-Rosenthal MERV-13 பெட்டி வடிகட்டி (~380 m3/h CADR)',
        howTo: 'நான்கு MERV-13 வடிகட்டிகளை 50 செமீ மின்விசிறியுடன் இணைக்கவும்; ஓசோன் அயனிசர்களைத் தவிர்க்கவும்.',
        estimatedCostInr: CORSI_BUDGET_INR,
      },
      {
        tier: 'filtration',
        title: `சரியான அளவு HEPA வடிகட்டி (${String(ctx.indoor.requiredCadr48Ach)} m3/h CADR இலக்கு)`,
        howTo: `உங்கள் ${String(ctx.indoor.roomVolumeM3)} m3 அறைக்கு மணிக்கு ${v.targetAch} காற்று மாற்றங்களை (ACH) வழங்குகிறது.`,
        estimatedCostInr: HEPA_BUDGET_INR,
      },
    ],
    sustainableSwaps: [
      {
        fromHabit: `${v.reqMode} மூலம் தனிநபர் சாலைப் பயணம்`,
        toAlternative: `பசுமை வழியில் ${v.bestMode} + N95 முகக்கவசம்`,
        quantifiedBenefit: `பயணத்திற்கு ${String(ctx.bestCommute.personalInhaledUg)} ug நுரையீரல் அளவு & ${String(ctx.bestCommute.communityCo2Grams)} கிராம் CO2e`,
      },
      {
        fromHabit: 'திறந்தவெளியில் இலை மற்றும் குப்பைகளை எரித்தல்',
        toAlternative: `${String(ctx.rwa.householdsParticipating)} வீடுகளில் புகை இல்லா RWA உறுதிமொழி`,
        quantifiedBenefit: `தினமும் ${String(ctx.rwa.dailyCo2SavedKg)} கிலோ CO2e & ${String(ctx.rwa.dailyPm25AvoidedG)} கிராம் PM2.5 தவிர்ப்பு`,
      },
    ],
    sourceAttributionNote: 'அறிவியல் கணக்கீடு மற்றும் Open-Meteo தரவு அடிப்படையில் உருவாக்கப்பட்டது.',
  };
}

export function buildLocalizedFallbackPlan(ctx: DeterministicBriefContext): AiPlanOutput {
  if (ctx.request.language === 'hi') {
    return buildHiPlan(ctx);
  }
  if (ctx.request.language === 'ta') {
    return buildTaPlan(ctx);
  }
  return buildEnPlan(ctx);
}

export function buildLocalizedChatReply(input: ChatRequestPayload): string {
  if (input.language === 'hi') {
    const t = TRANSLATIONS.hi;
    const cityLabel = t.cityNames[input.city] ?? input.city;
    const severityLabel = t.inversionSeverities[input.inversionSeverity];
    const windowAdvice = input.openWindowsNow
      ? 'अभी मिश्रण परत अनुकूल है, इसलिए 20 मिनट के लिए खिड़कियां खोलकर हवा बदल सकते हैं।'
      : 'अभी खिड़कियां बंद रखें और दोपहर में धूप निकलने पर ही वेंटिलेशन करें।';
    return (
      `${cityLabel} में वर्तमान CPCB NAQI ${String(input.cpcbNaqi)} और PM2.5 स्तर ${String(input.pm25UgM3)} ug/m3 (${severityLabel}) है। ` +
      `${windowAdvice} आपके प्रश्न ("${input.query}") के लिए बाहर जाते समय फिटेड N95/FFP2 मास्क पहनें, ` +
      'रसोई में इंडक्शन या चिमनी का प्रयोग करें, और कमरे में HEPA या MERV-13 फ़िल्टर चलाएं।'
    );
  }

  if (input.language === 'ta') {
    const t = TRANSLATIONS.ta;
    const cityLabel = t.cityNames[input.city] ?? input.city;
    const severityLabel = t.inversionSeverities[input.inversionSeverity];
    const windowAdvice = input.openWindowsNow
      ? 'தற்போது காற்று பரவல் சாதகமாக உள்ளதால் 20 நிமிடங்கள் ஜன்னல்களைத் திறக்கலாம்.'
      : 'இப்போது ஜன்னல்களை மூடி வைக்கவும்; மதிய வெயில் நேரத்தில் மட்டும் காற்றோட்டம் செய்யவும்.';
    return (
      `${cityLabel} நகரில் தற்போதைய CPCB NAQI ${String(input.cpcbNaqi)} மற்றும் PM2.5 அளவு ${String(input.pm25UgM3)} ug/m3 (${severityLabel}) ஆகும். ` +
      `${windowAdvice} உங்கள் கேள்விக்கு ("${input.query}"), வெளியே செல்லும்போது N95/FFP2 முகக்கவசம் அணியுங்கள், ` +
      'சமையலுக்கு புகைபோக்கி/மின் அடுப்பைப் பயன்படுத்துங்கள், மற்றும் HEPA அல்லது MERV-13 வடிகட்டியை இயக்குங்கள்.'
    );
  }

  const windowAdvice = input.openWindowsNow
    ? 'Boundary layer mixing is favorable right now for a short 20-minute cross-ventilation.'
    : 'Keep windows sealed for now until afternoon thermal breakup lifts the inversion layer.';

  return (
    `In ${input.city}, current CPCB NAQI is ${String(input.cpcbNaqi)} with ${String(input.pm25UgM3)} ug/m3 PM2.5 ` +
    `under ${input.inversionSeverity} conditions. ${windowAdvice} ` +
    `For your question ("${input.query}"), prioritize a fitted N95/FFP2 respirator over unmasked outdoor exertion, ` +
    `switch indoor cooking to vented LPG/induction, and run HEPA or MERV-13 DIY filtration (avoiding ozone ionizers).`
  );
}
