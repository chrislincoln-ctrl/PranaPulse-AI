/**
 * Fully localized EN / HI / TA step generators for individualized per-member daily routines.
 * Kept in src/i18n/ so localized phrasing stays cleanly separated from domain physics logic.
 */
import type { MemberRoutineArchetype, RoutineStepItem } from '../domain/types.js';
import type { SupportedLanguage } from '../validators/schemas.js';

export interface MemberStepVars {
  readonly archetype: MemberRoutineArchetype;
  readonly leave: string;
  readonly ret: string;
  readonly cleanWindow: string;
  readonly maskLabel: string;
  readonly commuteLabel: string;
  readonly fuelLabel: string;
  readonly effectiveAqi: number;
  readonly pblMeters: number;
  readonly corridorSavedPct: number;
  readonly indoorCadr: number;
  readonly purgeMinutes: number;
  readonly indoorMitigatedPm25: number;
  readonly indoorReductionPct: number;
  readonly isHighRisk: boolean;
  readonly healthNotes: string | undefined;
  readonly dailyHabitsNote: string | undefined;
}

export interface MemberScheduleLocalePack {
  readonly archetypeTitles: Readonly<Record<MemberRoutineArchetype, string>>;
  readonly briefHeader: string;
  readonly briefReplyHint: string;
  readonly buildSteps: (v: MemberStepVars) => readonly RoutineStepItem[];
}

function withNote(base: string, note: string | undefined, prefix: string): string {
  return note ? `${base} ${prefix}: ${note}.` : base;
}

function buildEnSteps(v: MemberStepVars): readonly RoutineStepItem[] {
  if (v.archetype === 'school-student') {
    const sportsRule = v.isHighRisk
      ? 'Keep recess and PT indoors while NAQI exceeds 200.'
      : 'Limit vigorous outdoor running during morning trapping.';
    return [
      {
        timeWindow: `${v.leave} Departure`,
        actionTitle: 'School Departure & Fitted Mask Check',
        reasonSummary: withNote(
          `Wear ${v.maskLabel} before leaving via ${v.commuteLabel}; PBL is ${String(v.pblMeters)} m.`,
          v.dailyHabitsNote,
          'Habit',
        ),
        estimatedImpactLabel: 'Cuts school-run peak inhalation',
        exposureTag: 'commute',
      },
      {
        timeWindow: '10:30 - 13:00',
        actionTitle: 'Classroom Air & Indoor Recess',
        reasonSummary: withNote(sportsRule, v.healthNotes, 'Health note'),
        estimatedImpactLabel: 'Protects developing airways',
        exposureTag: 'indoor',
      },
      {
        timeWindow: `${v.ret} Return`,
        actionTitle: 'School Return & Post-Commute Washup',
        reasonSummary: `Return aligns near solar breakup (${v.cleanWindow}); wash face and hands immediately after ${v.commuteLabel}.`,
        estimatedImpactLabel: `Corridor saves ${String(v.corridorSavedPct)}% dose`,
        exposureTag: 'commute',
      },
      {
        timeWindow: '18:30 - 21:30',
        actionTitle: 'Study Room HEPA Purge Before Sleep',
        reasonSummary: `Seal study/bedroom before evening inversion; run ${String(v.indoorCadr)} m3/hr CADR (${String(v.purgeMinutes)} min purge).`,
        estimatedImpactLabel: `Indoor mean ~${String(v.indoorMitigatedPm25)} ug/m3`,
        exposureTag: 'indoor',
      },
    ];
  }
  if (v.archetype === 'senior-homebound') {
    const terraceAdvice = v.isHighRisk
      ? `NAQI ${String(v.effectiveAqi)} is elevated for senior lungs; stay indoors around ${v.leave} and vent briefly only if symptom-free.`
      : `Short 15-minute airing around ${v.leave} (${v.cleanWindow}) with ${v.maskLabel} on balcony.`;
    return [
      {
        timeWindow: '06:00 - 10:30',
        actionTitle: 'Strict Morning Indoor Seal & Inhaler Readiness',
        reasonSummary: withNote(
          `Skip early walks under ${String(v.pblMeters)} m inversion lid; keep doors sealed and bedroom HEPA running.`,
          v.healthNotes,
          'Health note',
        ),
        estimatedImpactLabel: 'Avoids peak nocturnal smog',
        exposureTag: 'indoor',
      },
      {
        timeWindow: '10:30 - 13:00',
        actionTitle: 'Clean Indoor Cooking & Moist Dust Control',
        reasonSummary: `Avoid dry sweeping and unvented stove smoke (${v.fuelLabel}); keep indoor humidity comfortable.`,
        estimatedImpactLabel: `${String(v.indoorReductionPct)}% lower indoor load`,
        exposureTag: 'indoor',
      },
      {
        timeWindow: v.cleanWindow,
        actionTitle: 'Optional Short Solar-Breakup Airing',
        reasonSummary: withNote(terraceAdvice, v.dailyHabitsNote, 'Habit'),
        estimatedImpactLabel: 'Lowest diurnal PM2.5 window',
        exposureTag: 'ventilation',
      },
      {
        timeWindow: '17:30 - 22:00',
        actionTitle: 'Pre-Inversion Bedroom Seal & Overnight Filtration',
        reasonSummary: `Close balcony gaps before dusk; maintain ${String(v.indoorCadr)} m3/hr filtration overnight.`,
        estimatedImpactLabel: `Nighttime indoor ~${String(v.indoorMitigatedPm25)} ug/m3`,
        exposureTag: 'indoor',
      },
    ];
  }
  if (v.archetype === 'office-commuter') {
    return [
      {
        timeWindow: `${v.leave} Commute`,
        actionTitle: 'Low-Exposure Morning Transit Corridor',
        reasonSummary: withNote(
          `Prefer ${v.commuteLabel} with ${v.maskLabel}; avoid idling roadside junctions during morning trapping.`,
          v.dailyHabitsNote,
          'Habit',
        ),
        estimatedImpactLabel: `Saves ${String(v.corridorSavedPct)}% commute dose`,
        exposureTag: 'commute',
      },
      {
        timeWindow: v.cleanWindow,
        actionTitle: 'Midday Indoor Recovery & Window Check',
        reasonSummary: `Best mixing interval (${v.cleanWindow}) for short outdoor lunch errands with ${v.maskLabel}.`,
        estimatedImpactLabel: 'Lower midday PM2.5',
        exposureTag: 'outdoor',
      },
      {
        timeWindow: `${v.ret} Return`,
        actionTitle: 'Evening Inversion Return Commute Shield',
        reasonSummary: withNote(
          `Evening boundary layer collapses near ${v.ret}; keep ${v.maskLabel} sealed until indoors.`,
          v.healthNotes,
          'Health note',
        ),
        estimatedImpactLabel: 'Blocks rush-hour diesel spikes',
        exposureTag: 'commute',
      },
      {
        timeWindow: '20:00 - 22:30',
        actionTitle: 'Home Entry Change & Room Air Purge',
        reasonSummary: `Change outer clothes after transit and run purifier for ${String(v.purgeMinutes)} min.`,
        estimatedImpactLabel: `Targets ${String(v.indoorMitigatedPm25)} ug/m3 indoors`,
        exposureTag: 'indoor',
      },
    ];
  }
  const isActive = v.archetype === 'outdoor-active';
  return [
    {
      timeWindow: '06:00 - 10:30',
      actionTitle: isActive
        ? 'Skip Early Morning Outdoor Exertion'
        : 'Morning Seal & Exhaust-Vented Breakfast',
      reasonSummary: withNote(
        isActive
          ? `Avoid early outdoor cardio under ${String(v.pblMeters)} m inversion; train indoors instead.`
          : `Keep windows sealed during morning trapping and vent kitchen exhaust (${v.fuelLabel}).`,
        v.healthNotes,
        'Health note',
      ),
      estimatedImpactLabel: 'Prevents high-ventilation dose',
      exposureTag: 'indoor',
    },
    {
      timeWindow: v.cleanWindow,
      actionTitle: isActive
        ? 'Shift Activity Into Solar Breakup Window'
        : 'Midday Cross-Ventilation Window',
      reasonSummary: `Use ${v.cleanWindow} solar breakup for ${isActive ? 'lighter outdoor movement' : '20-min cross-ventilation'}.`,
      estimatedImpactLabel: 'Lowest daily smog load',
      exposureTag: isActive ? 'outdoor' : 'ventilation',
    },
    {
      timeWindow: `${v.leave} Outing`,
      actionTitle: isActive
        ? 'Post-Outing Airway Rinse & Recovery'
        : 'Masked Low-Traffic Local Errands',
      reasonSummary: withNote(
        `Use ${v.commuteLabel} + ${v.maskLabel} for local trips; avoid high-exhaust arterial roads.`,
        v.dailyHabitsNote,
        'Habit',
      ),
      estimatedImpactLabel: `Cuts trip load by ${String(v.corridorSavedPct)}%`,
      exposureTag: 'commute',
    },
    {
      timeWindow: '18:30 - 22:00',
      actionTitle: isActive
        ? 'Evening Indoor Filtration & Recovery'
        : 'Evening Inversion Family Room Purge',
      reasonSummary: `Seal home before evening trapping; run ${String(v.indoorCadr)} m3/hr filtration.`,
      estimatedImpactLabel: `Indoor mean ~${String(v.indoorMitigatedPm25)} ug/m3`,
      exposureTag: 'indoor',
    },
  ];
}

function buildHiSteps(v: MemberStepVars): readonly RoutineStepItem[] {
  if (v.archetype === 'school-student') {
    const sportsRule = v.isHighRisk
      ? 'NAQI 200 से अधिक होने पर स्कूल खेल व पीटी अंदर ही रखें।'
      : 'सुबह की धुंध में तेज़ बाहरी दौड़ सीमित रखें।';
    return [
      {
        timeWindow: `${v.leave} प्रस्थान`,
        actionTitle: 'स्कूल प्रस्थान और फिटेड मास्क जांच',
        reasonSummary: withNote(
          `${v.commuteLabel} से निकलने से पहले ${v.maskLabel} पहनें; PBL ${String(v.pblMeters)} मी है।`,
          v.dailyHabitsNote,
          'दिनचर्या',
        ),
        estimatedImpactLabel: 'स्कूल यात्रा प्रदूषण में कमी',
        exposureTag: 'commute',
      },
      {
        timeWindow: '10:30 - 13:00',
        actionTitle: 'कक्षा वायु सुरक्षा और इनडोर अवकाश',
        reasonSummary: withNote(sportsRule, v.healthNotes, 'स्वास्थ्य नोट'),
        estimatedImpactLabel: 'बच्चों के फेफड़ों की सुरक्षा',
        exposureTag: 'indoor',
      },
      {
        timeWindow: `${v.ret} वापसी`,
        actionTitle: 'स्कूल वापसी और हाथ-मुंह सफाई',
        reasonSummary: `वापसी दोपहर स्वच्छ समय (${v.cleanWindow}) के करीब है; ${v.commuteLabel} के बाद हाथ-मुंह धोएं।`,
        estimatedImpactLabel: `मार्ग से ${String(v.corridorSavedPct)}% कम खुराक`,
        exposureTag: 'commute',
      },
      {
        timeWindow: '18:30 - 21:30',
        actionTitle: 'अध्ययन कक्ष HEPA एयर प्यूरिफिकेशन',
        reasonSummary: `शाम इनवर्जन से पहले खिड़की बंद करें; ${String(v.indoorCadr)} m3/h CADR (${String(v.purgeMinutes)} मि) चलाएं।`,
        estimatedImpactLabel: `इनडोर औसत ~${String(v.indoorMitigatedPm25)} ug/m3`,
        exposureTag: 'indoor',
      },
    ];
  }
  if (v.archetype === 'senior-homebound') {
    const terraceAdvice = v.isHighRisk
      ? `NAQI ${String(v.effectiveAqi)} वरिष्ठ फेफड़ों हेतु अधिक है; ${v.leave} के समय भी घर में रहें।`
      : `${v.leave} (${v.cleanWindow}) के पास ${v.maskLabel} के साथ केवल 15 मिनट ताज़ी हवा लें।`;
    return [
      {
        timeWindow: '06:00 - 10:30',
        actionTitle: 'सुबह घर सील और इनहेलर तैयारी',
        reasonSummary: withNote(
          `${String(v.pblMeters)} मी इनवर्जन में सुबह की सैर टालें; बेडरूम HEPA चालू रखें।`,
          v.healthNotes,
          'स्वास्थ्य नोट',
        ),
        estimatedImpactLabel: 'सुबह के तीव्र स्मॉग से बचाव',
        exposureTag: 'indoor',
      },
      {
        timeWindow: '10:30 - 13:00',
        actionTitle: 'स्वच्छ रसोई और गीला पोछा',
        reasonSummary: `सूखी झाड़ू व रसोई धुएं (${v.fuelLabel}) से बचें; कमरे की नमी संतुलित रखें।`,
        estimatedImpactLabel: `${String(v.indoorReductionPct)}% कम इनडोर प्रदूषण`,
        exposureTag: 'indoor',
      },
      {
        timeWindow: v.cleanWindow,
        actionTitle: 'दोपहर धूप में सीमित वेंटिलेशन',
        reasonSummary: withNote(terraceAdvice, v.dailyHabitsNote, 'दिनचर्या'),
        estimatedImpactLabel: 'दिन का सबसे स्वच्छ समय',
        exposureTag: 'ventilation',
      },
      {
        timeWindow: '17:30 - 22:00',
        actionTitle: 'रात इनवर्जन से पहले बेडरूम सील',
        reasonSummary: `शाम ढलने से पहले दरवाजे बंद करें; रात भर ${String(v.indoorCadr)} m3/h फ़िल्ट्रेशन रखें।`,
        estimatedImpactLabel: `रात्रि इनडोर ~${String(v.indoorMitigatedPm25)} ug/m3`,
        exposureTag: 'indoor',
      },
    ];
  }
  if (v.archetype === 'office-commuter') {
    return [
      {
        timeWindow: `${v.leave} यात्रा`,
        actionTitle: 'सुबह कम-प्रदूषण यात्रा मार्ग',
        reasonSummary: withNote(
          `${v.commuteLabel} व ${v.maskLabel} चुनें; भारी ट्रैफ़िक चौराहों से बचें।`,
          v.dailyHabitsNote,
          'दिनचर्या',
        ),
        estimatedImpactLabel: `${String(v.corridorSavedPct)}% कम यात्रा खुराक`,
        exposureTag: 'commute',
      },
      {
        timeWindow: v.cleanWindow,
        actionTitle: 'दोपहर इनडोर विश्राम और हवा जांच',
        reasonSummary: `छोटे बाहरी कामों हेतु दोपहर (${v.cleanWindow}) में ${v.maskLabel} के साथ निकलें।`,
        estimatedImpactLabel: 'दोपहर कम PM2.5 स्तर',
        exposureTag: 'outdoor',
      },
      {
        timeWindow: `${v.ret} वापसी`,
        actionTitle: 'शाम इनवर्जन वापसी मास्क सुरक्षा',
        reasonSummary: withNote(
          `${v.ret} के पास शाम का इनवर्जन बढ़ता है; घर पहुंचने तक ${v.maskLabel} लगाए रखें।`,
          v.healthNotes,
          'स्वास्थ्य नोट',
        ),
        estimatedImpactLabel: 'शाम के धुएं से सुरक्षा',
        exposureTag: 'commute',
      },
      {
        timeWindow: '20:00 - 22:30',
        actionTitle: 'घर वापसी सफाई और एयर प्यूरिफायर',
        reasonSummary: `बाहरी कपड़े बदलें और ${String(v.purgeMinutes)} मिनट प्यूरिफायर चलाएं।`,
        estimatedImpactLabel: `इनडोर लक्ष्य ~${String(v.indoorMitigatedPm25)} ug/m3`,
        exposureTag: 'indoor',
      },
    ];
  }
  const isActive = v.archetype === 'outdoor-active';
  return [
    {
      timeWindow: '06:00 - 10:30',
      actionTitle: isActive ? 'सुबह बाहरी दौड़/व्यायाम टालें' : 'सुबह घर सील और चिमनी रसोई',
      reasonSummary: withNote(
        isActive
          ? `${String(v.pblMeters)} मी इनवर्जन में बाहरी कार्डियो टालें और घर में व्यायाम करें।`
          : `सुबह खिड़कियां बंद रखें और रसोई में चिमनी (${v.fuelLabel}) चलाएं।`,
        v.healthNotes,
        'स्वास्थ्य नोट',
      ),
      estimatedImpactLabel: 'उच्च श्वसन प्रदूषण से बचाव',
      exposureTag: 'indoor',
    },
    {
      timeWindow: v.cleanWindow,
      actionTitle: isActive ? 'दोपहर स्वच्छ समय में हल्की गतिविधि' : 'दोपहर सुरक्षित क्रॉस-वेंटिलेशन',
      reasonSummary: `दोपहर (${v.cleanWindow}) में ${isActive ? 'हल्की बाहरी गतिविधि' : '20 मिनट वेंटिलेशन'} करें।`,
      estimatedImpactLabel: 'सबसे कम दैनिक स्मॉग',
      exposureTag: isActive ? 'outdoor' : 'ventilation',
    },
    {
      timeWindow: `${v.leave} बाहरी कार्य`,
      actionTitle: isActive ? 'वापसी पर श्वसन आराम और जलपान' : 'मास्क के साथ कम-ट्रैफ़िक काम',
      reasonSummary: withNote(
        `स्थानीय यात्रा में ${v.commuteLabel} + ${v.maskLabel} का उपयोग करें।`,
        v.dailyHabitsNote,
        'दिनचर्या',
      ),
      estimatedImpactLabel: `${String(v.corridorSavedPct)}% कम खुराक`,
      exposureTag: 'commute',
    },
    {
      timeWindow: '18:30 - 22:00',
      actionTitle: isActive ? 'शाम इनडोर फ़िल्ट्रेशन और आराम' : 'शाम पारिवारिक कक्ष एयर प्यूरिफिकेशन',
      reasonSummary: `शाम को घर बंद रखें और ${String(v.indoorCadr)} m3/h फ़िल्ट्रेशन चलाएं।`,
      estimatedImpactLabel: `इनडोर औसत ~${String(v.indoorMitigatedPm25)} ug/m3`,
      exposureTag: 'indoor',
    },
  ];
}

function buildTaSteps(v: MemberStepVars): readonly RoutineStepItem[] {
  if (v.archetype === 'school-student') {
    const sportsRule = v.isHighRisk
      ? 'NAQI 200-ஐ விட அதிகமாக உள்ளதால் விளையாட்டுகளை உள்ளேயே வைக்கவும்.'
      : 'காலை நேர வெளிப்புற ஓட்டத்தைக் குறைக்கவும்.';
    return [
      {
        timeWindow: `${v.leave} புறப்பாடு`,
        actionTitle: 'பள்ளிப் புறப்பாடு & முகக்கவச சரிபார்ப்பு',
        reasonSummary: withNote(
          `${v.commuteLabel} பயணத்திற்கு முன் ${v.maskLabel} அணியவும்; PBL ${String(v.pblMeters)} மீ.`,
          v.dailyHabitsNote,
          'வழக்கம்',
        ),
        estimatedImpactLabel: 'பள்ளிப் பயண மாசு குறைப்பு',
        exposureTag: 'commute',
      },
      {
        timeWindow: '10:30 - 13:00',
        actionTitle: 'வகுப்பறை காற்று & உள் இடைவேளை',
        reasonSummary: withNote(sportsRule, v.healthNotes, 'உடல்நல குறிப்பு'),
        estimatedImpactLabel: 'சிறுவர் நுரையீரல் பாதுகாப்பு',
        exposureTag: 'indoor',
      },
      {
        timeWindow: `${v.ret} திரும்பல்`,
        actionTitle: 'பள்ளி திரும்பல் & முக சுத்தம்',
        reasonSummary: `திரும்பும் நேரம் (${v.cleanWindow}) காற்றோட்டத்திற்கு உகந்தது; ${v.commuteLabel} முடிந்ததும் முகம் கழுவவும்.`,
        estimatedImpactLabel: `${String(v.corridorSavedPct)}% குறைந்த மாசு`,
        exposureTag: 'commute',
      },
      {
        timeWindow: '18:30 - 21:30',
        actionTitle: 'படிப்பு அறை HEPA காற்று சுத்தம்',
        reasonSummary: `மாலை ஜன்னல்களை மூடி ${String(v.indoorCadr)} m3/h CADR (${String(v.purgeMinutes)} நிமிடம்) இயக்கவும்.`,
        estimatedImpactLabel: `உள் சராசரி ~${String(v.indoorMitigatedPm25)} ug/m3`,
        exposureTag: 'indoor',
      },
    ];
  }
  if (v.archetype === 'senior-homebound') {
    const terraceAdvice = v.isHighRisk
      ? `NAQI ${String(v.effectiveAqi)} அதிகம்; ${v.leave} நேரத்திலும் உள்ளேயே பாதுகாப்பாக இருக்கவும்.`
      : `${v.leave} (${v.cleanWindow}) நேரத்தில் ${v.maskLabel} உடன் 15 நிமிடம் மட்டும் காற்றோட்டம் செய்யவும்.`;
    return [
      {
        timeWindow: '06:00 - 10:30',
        actionTitle: 'காலை வீடு அடைப்பு & இன்ஹேலர் தயார்நிலை',
        reasonSummary: withNote(
          `${String(v.pblMeters)} மீ காலை மூட்டத்தில் நடைப்பயிற்சியைத் தவிர்த்து HEPA வடிகட்டியை இயக்கவும்.`,
          v.healthNotes,
          'உடல்நல குறிப்பு',
        ),
        estimatedImpactLabel: 'காலை உச்ச மாசு தவிர்ப்பு',
        exposureTag: 'indoor',
      },
      {
        timeWindow: '10:30 - 13:00',
        actionTitle: 'தூய சமையல் & ஈரத் துடைப்பு',
        reasonSummary: `உலர் பெருக்கலைத் தவிர்த்து புகைபோக்கி (${v.fuelLabel}) பயன்படுத்தவும்.`,
        estimatedImpactLabel: `${String(v.indoorReductionPct)}% குறைந்த உள் மாசு`,
        exposureTag: 'indoor',
      },
      {
        timeWindow: v.cleanWindow,
        actionTitle: 'மதிய வெயில் நேர குறுகிய காற்றோட்டம்',
        reasonSummary: withNote(terraceAdvice, v.dailyHabitsNote, 'வழக்கம்'),
        estimatedImpactLabel: 'நாளின் குறைந்த PM2.5 நேரம்',
        exposureTag: 'ventilation',
      },
      {
        timeWindow: '17:30 - 22:00',
        actionTitle: 'மாலை படுக்கையறை அடைப்பு & வடிகட்டி',
        reasonSummary: `மாலையில் இடைவெளிகளை மூடி இரவு முழுவதும் ${String(v.indoorCadr)} m3/h வடிகட்டி இயக்கவும்.`,
        estimatedImpactLabel: `இரவு உள் ~${String(v.indoorMitigatedPm25)} ug/m3`,
        exposureTag: 'indoor',
      },
    ];
  }
  if (v.archetype === 'office-commuter') {
    return [
      {
        timeWindow: `${v.leave} பயணம்`,
        actionTitle: 'காலை குறைந்த மாசு பயண வழி',
        reasonSummary: withNote(
          `${v.commuteLabel} மற்றும் ${v.maskLabel} பயன்படுத்தவும்; நெரிசல் சாலைகளைத் தவிர்க்கவும்.`,
          v.dailyHabitsNote,
          'வழக்கம்',
        ),
        estimatedImpactLabel: `${String(v.corridorSavedPct)}% குறைந்த பயண மாசு`,
        exposureTag: 'commute',
      },
      {
        timeWindow: v.cleanWindow,
        actionTitle: 'மதிய உள் ஓய்வு & காற்று சரிபார்ப்பு',
        reasonSummary: `மதிய (${v.cleanWindow}) குறுகிய வெளிப் பணிகளுக்கு ${v.maskLabel} அணியவும்.`,
        estimatedImpactLabel: 'மதிய குறைந்த PM2.5',
        exposureTag: 'outdoor',
      },
      {
        timeWindow: `${v.ret} திரும்பல்`,
        actionTitle: 'மாலை திரும்பல் முகக்கவச பாதுகாப்பு',
        reasonSummary: withNote(
          `${v.ret} நேரத்தில் மாலை புகை அதிகரிக்கிறது; வீடு சேரும் வரை ${v.maskLabel} அணியவும்.`,
          v.healthNotes,
          'உடல்நல குறிப்பு',
        ),
        estimatedImpactLabel: 'மாலை வாகனப் புகை தடுப்பு',
        exposureTag: 'commute',
      },
      {
        timeWindow: '20:00 - 22:30',
        actionTitle: 'வீடு திரும்பிய பின் காற்று சுத்தம்',
        reasonSummary: `வெளி ஆடைகளை மாற்றி ${String(v.purgeMinutes)} நிமிடம் காற்று சுத்திகரிப்பான் இயக்கவும்.`,
        estimatedImpactLabel: `உள் இலக்கு ~${String(v.indoorMitigatedPm25)} ug/m3`,
        exposureTag: 'indoor',
      },
    ];
  }
  const isActive = v.archetype === 'outdoor-active';
  return [
    {
      timeWindow: '06:00 - 10:30',
      actionTitle: isActive
        ? 'காலை வெளிப்புற உடற்பயிற்சியைத் தவிர்க்கவும்'
        : 'காலை ஜன்னல் அடைப்பு & புகைபோக்கி சமையல்',
      reasonSummary: withNote(
        isActive
          ? `${String(v.pblMeters)} மீ காலை மூட்டத்தில் வெளிப்புற பயிற்சியைத் தவிர்த்து உள்ளே செய்யவும்.`
          : `காலை ஜன்னல்களை மூடி சமையலறை புகைபோக்கி (${v.fuelLabel}) பயன்படுத்தவும்.`,
        v.healthNotes,
        'உடல்நல குறிப்பு',
      ),
      estimatedImpactLabel: 'அதிக சுவாச மாசு தடுப்பு',
      exposureTag: 'indoor',
    },
    {
      timeWindow: v.cleanWindow,
      actionTitle: isActive ? 'மதிய தூய நேரத்தில் மட்டும் நடைப்பயிற்சி' : 'மதிய பாதுகாப்பான காற்றோட்டம்',
      reasonSummary: `மதிய (${v.cleanWindow}) நேரத்தில் ${isActive ? 'மிதமான நடைப்பயிற்சி' : '20 நிமிட காற்றோட்டம்'} செய்யவும்.`,
      estimatedImpactLabel: 'நாளின் குறைந்த புகை நேரம்',
      exposureTag: isActive ? 'outdoor' : 'ventilation',
    },
    {
      timeWindow: `${v.leave} வெளிப் பணி`,
      actionTitle: isActive ? 'திரும்பிய பின் ஓய்வு & நீரேற்றம்' : 'முகக்கவசத்துடன் உள்ளூர் பணிகள்',
      reasonSummary: withNote(
        `உள்ளூர் பயணங்களுக்கு ${v.commuteLabel} + ${v.maskLabel} பயன்படுத்தவும்.`,
        v.dailyHabitsNote,
        'வழக்கம்',
      ),
      estimatedImpactLabel: `${String(v.corridorSavedPct)}% குறைந்த மாசு`,
      exposureTag: 'commute',
    },
    {
      timeWindow: '18:30 - 22:00',
      actionTitle: isActive ? 'மாலை உள் காற்று வடிகட்டல்' : 'மாலை குடும்ப அறை காற்று சுத்தம்',
      reasonSummary: `மாலையில் வீட்டை மூடி ${String(v.indoorCadr)} m3/h வடிகட்டி இயக்கவும்.`,
      estimatedImpactLabel: `உள் சராசரி ~${String(v.indoorMitigatedPm25)} ug/m3`,
      exposureTag: 'indoor',
    },
  ];
}

export const MEMBER_SCHEDULE_STRINGS: Readonly<
  Record<SupportedLanguage, MemberScheduleLocalePack>
> = {
  en: {
    archetypeTitles: {
      'school-student': 'School Student Routine',
      'office-commuter': 'Office Commuter Routine',
      'senior-homebound': 'Senior Respiratory Routine',
      'outdoor-active': 'Outdoor & Fitness Routine',
      'home-caregiver': 'Home & Caregiver Routine',
    },
    briefHeader: 'PranaPulse Daily Air Brief',
    briefReplyHint: 'Reply with your location or GPS pin anytime for live local air & weather.',
    buildSteps: buildEnSteps,
  },
  hi: {
    archetypeTitles: {
      'school-student': 'स्कूल छात्र दिनचर्या',
      'office-commuter': 'ऑफ़िस यात्रा दिनचर्या',
      'senior-homebound': 'वरिष्ठ श्वसन सुरक्षा दिनचर्या',
      'outdoor-active': 'बाहरी व्यायाम दिनचर्या',
      'home-caregiver': 'गृह देखभाल दिनचर्या',
    },
    briefHeader: 'PranaPulse दैनिक वायु बुलेटिन',
    briefReplyHint: 'बाहर होने पर अपना स्थान या GPS पिन भेजकर तुरंत हवा और मौसम जानें।',
    buildSteps: buildHiSteps,
  },
  ta: {
    archetypeTitles: {
      'school-student': 'பள்ளி மாணவர் அட்டவணை',
      'office-commuter': 'அலுவலகப் பயண அட்டவணை',
      'senior-homebound': 'மூத்தோர் சுவாசப் பாதுகாப்பு',
      'outdoor-active': 'வெளிப்புற உடற்பயிற்சி அட்டவணை',
      'home-caregiver': 'இல்லப் பராமரிப்பு அட்டவணை',
    },
    briefHeader: 'PranaPulse தினசரி காற்று அறிக்கை',
    briefReplyHint: 'வெளியே இருக்கும்போது உங்கள் இடத்தை அல்லது GPS-ஐ அனுப்பி உடனடி தகவல் பெறுங்கள்.',
    buildSteps: buildTaSteps,
  },
};
