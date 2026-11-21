/**
 * Complete EN / HI / TA localization dictionary for PranaPulse AI.
 * All three locales share the exact same strict TypeScript interface.
 */

import type {
  BuildingTightness,
  CommuteModeId,
  CookingFuelType,
  CorridorNodeId,
  CpcbCategory,
  FamilyMemberAdvisory,
  FamilyRole,
  InversionSeverity,
  MaskTypeId,
  MemberRoutineArchetype,
} from '../domain/types.js';
import type { SupportedLanguage } from '../validators/schemas.js';

export interface LocaleDictionary {
  readonly skipLink: string;
  readonly appTitle: string;
  readonly themeLightLabel: string;
  readonly themeDarkLabel: string;
  readonly statusLiveGemini: string;
  readonly statusDeterministicMode: string;
  readonly heroHeadline: string;
  readonly heroLede: string;
  readonly pollutantBreakdownHeading: string;
  readonly aqiScaleCaption: string;
  readonly citySearchLabel: string;
  readonly citySearchPlaceholder: string;
  readonly useGpsButton: string;
  readonly gpsLoading: string;
  readonly gpsUnavailable: string;
  readonly gpsIpFallbackNote: string;
  readonly severeBannerPrefix: string;
  readonly disagreementBannerText: string;
  readonly stationCrossCheckLabel: string;
  readonly metricCpcbLabel: string;
  readonly metricUsEpaLabel: string;
  readonly metricPblLabel: string;
  readonly metricPlumeLabel: string;
  readonly openWindowsYes: string;
  readonly openWindowsNo: string;
  readonly cigarettesUnit: string;
  readonly whoMultipleUnit: string;
  readonly fireHotspotsUnit: string;
  readonly fireBaselineModelNote: string;
  readonly simulatedFallbackNote: string;
  readonly chartTitle: string;
  readonly chartLegendPm25: string;
  readonly chartLegendPbl: string;
  readonly chartTableCaption: string;
  readonly tabDashboard: string;
  readonly tabRoutine: string;
  readonly tabIndoor: string;
  readonly tabCommute: string;
  readonly tabGear: string;
  readonly tabCommunity: string;
  readonly switchCityButton: string;
  readonly previousSectionLabel: string;
  readonly nextSectionLabel: string;
  readonly gearMasksHeading: string;
  readonly gearPurifiersHeading: string;
  readonly gearMaskCustomLabel: string;
  readonly gearPurifierCustomLabel: string;
  readonly buyAmazonLabel: string;
  readonly buyFlipkartLabel: string;
  readonly buy1mgLabel: string;
  readonly buyFilterLabel: string;
  readonly cadrMatchBadge: string;
  readonly cadrSmallBadge: string;
  readonly refreshPlan: string;
  readonly generatingPlan: string;
  readonly familySectionHeading: string;
  readonly housingSectionHeading: string;
  readonly tightnessLabel: string;
  readonly fuelLabel: string;
  readonly addMemberButton: string;
  readonly removeMemberButton: string;
  readonly newMemberPrefix: string;
  readonly memberNameLabel: string;
  readonly memberRoleLabel: string;
  readonly memberMaskLabel: string;
  readonly memberHoursLabel: string;
  readonly memberStatusLabel: string;
  readonly memberDoseLabel: string;
  readonly routineHeading: string;
  readonly hacksHeading: string;
  readonly swapsHeading: string;
  readonly aiSourceGemini: string;
  readonly aiSourceFallback: string;
  readonly indoorSectionHeading: string;
  readonly roomAreaLabel: string;
  readonly cadrLabel: string;
  readonly targetCadrLabel: string;
  readonly achievedAchLabel: string;
  readonly purgeTimeLabel: string;
  readonly dailyReductionLabel: string;
  readonly crGuideTitle: string;
  readonly crGuideSummary: string;
  readonly mythAlertHeading: string;
  readonly mythAlertBullets: readonly string[];
  readonly winterPlantsHeading: string;
  readonly winterPlantsSubtitle: string;
  readonly winterPlantsList: readonly string[];
  readonly otherOptionLabel: string;
  readonly customInputPlaceholder: string;
  readonly verifyCustomButton: string;
  readonly verifyingCustomButton: string;
  readonly indoorChartTitle: string;
  readonly indoorChartLegendOutdoor: string;
  readonly indoorChartLegendBaseline: string;
  readonly indoorChartLegendMitigated: string;
  readonly commuteSectionHeading: string;
  readonly originAreaLabel: string;
  readonly destinationAreaLabel: string;
  readonly planRouteButton: string;
  readonly planningRouteButton: string;
  readonly openGoogleMapsButton: string;
  readonly commuteDistanceLabel: string;
  readonly commuteModeLabel: string;
  readonly commuteMaskLabel: string;
  readonly paretoHeading: string;
  readonly tableTimeHeader: string;
  readonly tableDoseHeader: string;
  readonly tableCo2Header: string;
  readonly tableStatusHeader: string;
  readonly unitMin: string;
  readonly unitKm: string;
  readonly unitHr: string;
  readonly paradoxWarningLabel: string;
  readonly paretoOptimalLabel: string;
  readonly corridorHeading: string;
  readonly corridorSavedSummary: string;
  readonly corridorDirectLabel: string;
  readonly corridorCleanLabel: string;
  readonly rwaSectionHeading: string;
  readonly householdsLabel: string;
  readonly transitShiftLabel: string;
  readonly haltLeafBurningLabel: string;
  readonly co2SavedDailyLabel: string;
  readonly pm25AvoidedDailyLabel: string;
  readonly copyBulletinButton: string;
  readonly copiedBulletinButton: string;
  readonly printBulletinButton: string;
  readonly advisorHeading: string;
  readonly advisorPlaceholder: string;
  readonly advisorSendButton: string;
  readonly advisorStreamingLabel: string;
  readonly advisorChips: readonly string[];
  readonly quickCitiesHeading: string;
  readonly footerNotice: string;
  readonly languageLabel: string;
  readonly landingNavOverview: string;
  readonly landingNavConsole: string;
  readonly landingHeroHeadline: string;
  readonly landingHeroLede: string;
  readonly landingEnterConsole: string;
  readonly landingContinueAsGuest: string;
  readonly landingSimulateSevere: string;
  readonly landingSimulateClean: string;
  readonly landingInversionCeilingLabel: string;
  readonly landingEstimatedPm25Label: string;
  readonly landingVisibilityLabel: string;
  readonly landingSevereInversionDesc: string;
  readonly landingCleanAirDesc: string;
  readonly landingAuthGatewayTitle: string;
  readonly landingAuthGatewaySubtitle: string;
  readonly landingAuthGuestCta: string;
  readonly landingAuthSignedInAs: string;
  readonly landingAuthOpenConsole: string;
  readonly landingPillarsHeading: string;
  readonly landingPillarsSubheading: string;
  readonly landingPillarPblTitle: string;
  readonly landingPillarPblDesc: string;
  readonly landingPillarCadrTitle: string;
  readonly landingPillarCadrDesc: string;
  readonly landingPillarCommuteTitle: string;
  readonly landingPillarCommuteDesc: string;
  readonly landingPillarFamilyTitle: string;
  readonly landingPillarFamilyDesc: string;
  readonly landingPillarAdvisorTitle: string;
  readonly landingPillarAdvisorDesc: string;
  readonly landingBottomBannerTitle: string;
  readonly landingBottomBannerCta: string;
  readonly languageNames: Record<SupportedLanguage, string>;
  readonly cityNames: Record<string, string>;
  readonly defaultMemberLabels: Record<string, string>;
  readonly cpcbCategories: Record<CpcbCategory, string>;
  readonly inversionSeverities: Record<InversionSeverity, string>;
  readonly tightnessOptions: Record<BuildingTightness, string>;
  readonly fuelOptions: Record<CookingFuelType, string>;
  readonly roleOptions: Record<FamilyRole, string>;
  readonly maskOptions: Record<MaskTypeId, string>;
  readonly commuteModes: Record<CommuteModeId, string>;
  readonly outdoorStatuses: Record<FamilyMemberAdvisory['outdoorStatus'], string>;
  readonly corridorNodes: Record<CorridorNodeId, string>;
  readonly archetypeOptions: Record<MemberRoutineArchetype, string>;
  readonly memberHabitsToggle: string;
  readonly memberArchetypeLabel: string;
  readonly memberLeaveTimeLabel: string;
  readonly memberReturnTimeLabel: string;
  readonly memberCommuteLabel: string;
  readonly memberHealthNotesLabel: string;
  readonly memberHabitsNoteLabel: string;
  readonly memberTelegramBriefLabel: string;
  readonly memberConnectTelegramButton: string;
  readonly memberOpenTelegramLink: string;
  readonly memberTelegramPendingHint: string;
  readonly scheduleAllHouseholdTab: string;
  readonly shareWhatsAppButton: string;
  readonly copyBriefButton: string;
  readonly copiedBriefButton: string;
  readonly companionChatHeading: string;
  readonly companionChatSubheading: string;
  readonly companionChatMemberLabel: string;
  readonly companionChatPlaceholder: string;
  readonly companionChatSend: string;
  readonly companionChatSending: string;
  readonly companionChatUseGps: string;
  readonly companionChatGpsAttached: string;
  readonly companionChatUpdatedBadge: string;
  readonly companionChatChips: readonly string[];
}

const en: LocaleDictionary = {
  skipLink: 'Skip to main content',
  appTitle: 'PranaPulse AI',
  themeLightLabel: 'Light mode',
  themeDarkLabel: 'Dark mode',
  statusLiveGemini: 'Live sensor & satellite telemetry active',
  statusDeterministicMode: 'Verified sensor & physics engine active',
  heroHeadline: 'Winter smog telemetry',
  heroLede:
    'Live atmospheric trapping analysis, indoor CADR filtration modeling, and low-emission family schedules.',
  pollutantBreakdownHeading: '6-pollutant ambient load (ug/m3)',
  aqiScaleCaption: 'CPCB NAQI severity band',
  citySearchLabel: 'Search city or locality',
  citySearchPlaceholder: 'Search city (e.g. Delhi, Patna, Chennai)',
  useGpsButton: 'Use GPS',
  gpsLoading: 'Locating',
  gpsUnavailable: 'Location access denied or unavailable. Choose a city preset.',
  gpsIpFallbackNote:
    'Approximate network IP location shown. Enable browser & OS Location permission for street-level GPS.',
  severeBannerPrefix: 'Severe air quality threshold reached:',
  disagreementBannerText:
    'Station monitor reads significantly higher than satellite grid. Conservative safety thresholds applied.',
  stationCrossCheckLabel: 'Nearest monitor:',
  metricCpcbLabel: 'CPCB NAQI',
  metricUsEpaLabel: 'US-EPA & WHO 24h',
  metricPblLabel: 'Boundary layer ventilation',
  metricPlumeLabel: '500km thermal plumes',
  openWindowsYes: 'Cross-ventilate now (breakup window)',
  openWindowsNo: 'Keep windows sealed (trapping active)',
  cigarettesUnit: 'cig/day equivalent',
  whoMultipleUnit: 'x WHO 24h limit',
  fireHotspotsUnit: 'active anomalies',
  fireBaselineModelNote: 'Seasonal baseline estimate',
  simulatedFallbackNote: 'Offline atmospheric baseline active',
  chartTitle: '24-hour boundary layer and PM2.5 forecast',
  chartLegendPm25: 'PM2.5 ug/m3 (person load)',
  chartLegendPbl: 'Mixing height m (sensor)',
  chartTableCaption: 'Hourly PM2.5, planetary boundary layer height, and wind ventilation data',
  tabDashboard: 'Dashboard',
  tabRoutine: 'Family Routine',
  tabIndoor: 'Indoor & CADR',
  tabCommute: 'Commute & Route',
  tabGear: 'Masks & Purifiers',
  tabCommunity: 'RWA & Advisor',
  switchCityButton: 'Change city',
  previousSectionLabel: 'Previous',
  nextSectionLabel: 'Next',
  gearMasksHeading: 'Verified N95 & respirator buying guide',
  gearPurifiersHeading: 'CADR-sized True HEPA air purifier shop',
  gearMaskCustomLabel: 'Search any specific mask brand or model to buy',
  gearPurifierCustomLabel: 'Search any specific air purifier or HEPA filter to buy',
  buyAmazonLabel: 'Buy on Amazon.in',
  buyFlipkartLabel: 'Buy on Flipkart',
  buy1mgLabel: 'Buy on Tata 1mg',
  buyFilterLabel: 'Replacement HEPA filter',
  cadrMatchBadge: 'Sized for your room',
  cadrSmallBadge: 'For smaller rooms',
  refreshPlan: 'Update family plan',
  generatingPlan: 'Calculating',
  familySectionHeading: 'Family Care Roster',
  housingSectionHeading: 'Home envelope & cooking',
  tightnessLabel: 'Window sealing',
  fuelLabel: 'Cooking fuel',
  addMemberButton: 'Add member',
  removeMemberButton: 'Remove',
  newMemberPrefix: 'Member',
  memberNameLabel: 'Name',
  memberRoleLabel: 'Vulnerability profile',
  memberMaskLabel: 'Mask',
  memberHoursLabel: 'Outdoor hrs/day',
  memberStatusLabel: 'Guidance',
  memberDoseLabel: 'Est. daily dose',
  routineHeading: 'Low-emission daily schedule',
  hacksHeading: 'Tiered indoor air fixes',
  swapsHeading: 'Low-emission household swaps',
  aiSourceGemini: 'Verified against live sensor & aerosol physics',
  aiSourceFallback: 'Verified deterministic protocol active',
  indoorSectionHeading: 'Indoor mass-balance & CADR calculator',
  roomAreaLabel: 'Room area (m2)',
  cadrLabel: 'Purifier CADR (m3/h)',
  targetCadrLabel: '4.8 ACH target CADR',
  achievedAchLabel: 'Effective air changes',
  purgeTimeLabel: '90% smoke purge',
  dailyReductionLabel: 'Daily exposure cut',
  crGuideTitle: 'Corsi-Rosenthal DIY box specs',
  crGuideSummary:
    'Combine four MERV-13 pleated filters with a 50 cm shroud-sealed box fan (~INR 2,500) to reach 400+ m3/h clean delivery.',
  mythAlertHeading: 'Physics verification alerts',
  mythAlertBullets: [
    'Avoid ozone-generating ionizers or UV-ozone purifiers: ozone reacts indoors into ultrafine secondary aerosols and irritates airways (PMC7749091).',
    'Houseplants alone cannot clear severe winter PM2.5 smog inside rooms; prioritize MERV-13 DIY box fans or true HEPA filtration.',
  ],
  winterPlantsHeading: 'Supportive winter plants (~1% supplementary bio-buffer)',
  winterPlantsSubtitle:
    'While mechanical HEPA/MERV-13 filtration handles primary PM2.5 removal, these winter-hardy plants provide ~1% supplementary dust trapping, VOC uptake, and airway humidity:',
  winterPlantsList: [
    'Snake Plant (Sansevieria): Releases oxygen at night via CAM photosynthesis and traps coarse dust on waxy upright leaves.',
    'Areca Palm (Dypsis lutescens): Natural winter humidifier that keeps respiratory airways moist during dry thermal inversions.',
    'Spider Plant & Peace Lily: Absorbs indoor cooking formaldehydes, benzene, and xylene in low winter sunlight.',
    'Tulsi (Holy Basil) & Money Plant: Hardy balcony/windowsill bio-buffers that capture settled particles when wiped weekly.',
  ],
  otherOptionLabel: 'Other (Add your own)',
  customInputPlaceholder: 'Enter custom preference to verify with AI',
  verifyCustomButton: 'Verify with AI',
  verifyingCustomButton: 'Verifying',
  indoorChartTitle: '24-hour indoor vs outdoor PM2.5 concentration',
  indoorChartLegendOutdoor: 'Outdoor ug/m3',
  indoorChartLegendBaseline: 'Unfiltered indoor ug/m3',
  indoorChartLegendMitigated: 'Mitigated indoor ug/m3',
  commuteSectionHeading: 'Inhaled dose paradox & commute Pareto',
  originAreaLabel: 'Starting area (From)',
  destinationAreaLabel: 'Destination area (To)',
  planRouteButton: 'Find cleanest route',
  planningRouteButton: 'Checking route',
  openGoogleMapsButton: 'Verify & open clean route in Google Maps',
  commuteDistanceLabel: 'One-way distance (km)',
  commuteModeLabel: 'Primary mode',
  commuteMaskLabel: 'Respirator',
  paretoHeading: 'All modes ranked by pulmonary inhaled dose',
  tableTimeHeader: 'Time',
  tableDoseHeader: 'Dose',
  tableCo2Header: 'CO2',
  tableStatusHeader: 'Status',
  unitMin: 'min',
  unitKm: 'km',
  unitHr: 'hrs',
  paradoxWarningLabel: 'High ventilation dose risk',
  paretoOptimalLabel: 'Pareto balanced',
  corridorHeading: 'Dijkstra clean-corridor network',
  corridorSavedSummary: 'Exposure reduction vs ring flyover road',
  corridorDirectLabel: 'Direct arterial road',
  corridorCleanLabel: 'Lowest-dose parkway corridor',
  rwaSectionHeading: 'RWA neighborhood collective simulator',
  householdsLabel: 'Participating homes',
  transitShiftLabel: 'Shared transit shift (%)',
  haltLeafBurningLabel: 'Halt open leaf & biomass burning',
  co2SavedDailyLabel: 'Daily CO2 avoided',
  pm25AvoidedDailyLabel: 'Daily PM2.5 avoided',
  copyBulletinButton: 'Copy RWA bulletin',
  copiedBulletinButton: 'Copied to clipboard',
  printBulletinButton: 'Print notice',
  advisorHeading: 'Grounded AI smog advisor',
  advisorPlaceholder: 'Ask about school commute, ventilation windows, or COPD precautions',
  advisorSendButton: 'Ask advisor',
  advisorStreamingLabel: 'Streaming grounded guidance',
  advisorChips: [
    'When should we open windows for cooking smoke today?',
    'Is morning cycling safe at current PM2.5 or higher pulmonary risk?',
    'Compare MERV-13 DIY box vs ozone ionizer for bedroom asthma',
  ],
  quickCitiesHeading: 'City presets',
  footerNotice:
    'PranaPulse AI computes deterministic atmospheric & exposure equations for informational guidance only. Consult clinicians for medical emergencies.',
  languageLabel: 'Language',
  landingNavOverview: 'Overview',
  landingNavConsole: 'Live Console',
  landingHeroHeadline: 'Survive & Mitigate the Winter Smog Crisis',
  landingHeroLede:
    'Real-time atmospheric inversion telemetry, indoor CADR filtration modeling, and low-exposure family routines grounded in live ground sensors and satellite data.',
  landingEnterConsole: 'Launch Live Console',
  landingContinueAsGuest: 'Explore as Guest',
  landingSimulateSevere: 'Severe Winter Inversion (AQI 380 • 220m PBL)',
  landingSimulateClean: 'Clean Afternoon Air (AQI 45 • 1200m Mixing)',
  landingInversionCeilingLabel: 'Thermal Boundary Lid',
  landingEstimatedPm25Label: 'Estimated PM2.5 Load',
  landingVisibilityLabel: 'Urban Visibility',
  landingSevereInversionDesc:
    'Cold ground trapping keeps particulates suspended under 220 m.',
  landingCleanAirDesc:
    'Solar convective mixing lifts atmospheric inversion above 1200 m.',
  landingAuthGatewayTitle: 'Access PranaPulse Console',
  landingAuthGatewaySubtitle:
    'Launch immediately as a guest or sign in to synchronize your family roster across devices.',
  landingAuthGuestCta: 'Launch Live Console',
  landingAuthSignedInAs: 'Active session',
  landingAuthOpenConsole: 'Open Your Console',
  landingPillarsHeading: 'Engineered for Indo-Gangetic Winter Smog',
  landingPillarsSubheading:
    'Verified ground-station sensors, satellite telemetry, and peer-reviewed aerosol physics to protect household respiratory health.',
  landingPillarPblTitle: 'Planetary Boundary Layer Tracking',
  landingPillarPblDesc:
    'Real-time monitoring of nocturnal thermal inversions, ventilation indices, and CPCB NAQI ground stations.',
  landingPillarCadrTitle: 'Indoor Clearance & CADR Physics',
  landingPillarCadrDesc:
    'Room mass-balance modeling, Corsi-Rosenthal box specs, and precise air change calculations.',
  landingPillarCommuteTitle: 'Clean Commute Corridors',
  landingPillarCommuteDesc:
    'Dijkstra low-exposure pathfinding to navigate around arterial flyovers and diesel exhaust hot spots.',
  landingPillarFamilyTitle: 'Family Care Roster',
  landingPillarFamilyDesc:
    'Tailored outdoor exposure limits and mask guidelines for children, seniors, and daily commuters.',
  landingPillarAdvisorTitle: 'Physics-Grounded Health Advisor',
  landingPillarAdvisorDesc:
    'Multi-source guidance bound strictly to live sensor readings and peer-reviewed aerosol science.',
  landingBottomBannerTitle:
    'Protect your family from winter atmospheric trapping today.',
  landingBottomBannerCta: 'Enter Workbench Console',
  languageNames: { en: 'English', hi: 'हिन्दी', ta: 'தமிழ்' },
  cityNames: {
    'New Delhi': 'New Delhi',
    Lucknow: 'Lucknow',
    Patna: 'Patna',
    Kolkata: 'Kolkata',
    Mumbai: 'Mumbai',
    Chennai: 'Chennai',
    Bengaluru: 'Bengaluru',
    London: 'London',
    'Local Area Monitor': 'Local Area Monitor',
  },
  defaultMemberLabels: {
    m1: 'Aarav (School)',
    m2: 'Meera (Senior)',
    m3: 'Rohan (Commuter)',
  },
  cpcbCategories: {
    good: 'Good',
    satisfactory: 'Satisfactory',
    moderate: 'Moderate',
    poor: 'Poor',
    'very-poor': 'Very Poor',
    severe: 'Severe',
  },
  inversionSeverities: {
    neutral: 'Dispersion open',
    'moderate-trapping': 'Moderate inversion trap',
    'severe-inversion': 'Severe thermal lid',
  },
  tightnessOptions: {
    leaky: 'Standard leaky frames (1.2 ACH)',
    standard: 'Sealed typical apartment (0.6 ACH)',
    'weather-sealed': 'Weather-stripped envelope (0.28 ACH)',
  },
  fuelOptions: {
    induction: 'Induction electric (0 ug/h indoor)',
    'lpg-vented': 'LPG with range hood exhaust',
    'lpg-unvented': 'LPG without exhaust fan',
    'solid-biomass': 'Solid biomass / chulha inside',
  },
  roleOptions: {
    child: 'Child / school student',
    'senior-respiratory': 'Senior / COPD / asthma',
    commuter: 'Adult outdoor commuter',
    caregiver: 'Home caregiver',
  },
  maskOptions: {
    none: 'No mask',
    cloth: 'Cloth mask (low seal)',
    surgical: 'Surgical mask',
    'n95-ffp2': 'N95 / FFP2 respirator',
  },
  commuteModes: {
    metro: 'AC Metro Rail',
    'electric-bus': 'Electric Bus',
    'ev-car': 'EV Car (recirculated)',
    'petrol-car': 'Petrol Car',
    'two-wheeler': 'Two-Wheeler',
    cycling: 'Cycling',
    walking: 'Walking',
  },
  outdoorStatuses: {
    go: 'Normal outdoor activity',
    'caution-masked': 'Brief outing with N95 fit check',
    'limit-short': 'Limit exertion outdoors',
    'stay-indoors': 'Remain indoors with filtration',
  },
  corridorNodes: {
    'home-sector': 'Home Sector',
    'arterial-junction': 'Arterial Junction',
    'ring-flyover': 'Ring Road Flyover',
    'green-parkway': 'Tree-Buffered Parkway',
    'metro-concourse': 'Metro Concourse',
    'civic-hub': 'School / Work Hub',
  },
  archetypeOptions: {
    'school-student': 'School Student',
    'office-commuter': 'Office Commuter',
    'senior-homebound': 'Senior / Respiratory',
    'outdoor-active': 'Outdoor & Fitness',
    'home-caregiver': 'Home Caregiver',
  },
  memberHabitsToggle: 'Customize daily habits & Telegram',
  memberArchetypeLabel: 'Routine preset',
  memberLeaveTimeLabel: 'Leaves home',
  memberReturnTimeLabel: 'Returns home',
  memberCommuteLabel: 'Personal commute',
  memberHealthNotesLabel: 'Health notes (asthma, inhaler)',
  memberHabitsNoteLabel: 'Daily habits & timing notes',
  memberTelegramBriefLabel: 'Daily 06:30 morning brief on Telegram',
  memberConnectTelegramButton: 'Connect Telegram',
  memberOpenTelegramLink: 'Open Telegram to pair',
  memberTelegramPendingHint:
    'Add TELEGRAM_BOT_TOKEN and TELEGRAM_BOT_USERNAME in env to activate 1-tap Telegram pairing.',
  scheduleAllHouseholdTab: 'All Household',
  shareWhatsAppButton: 'Share on WhatsApp',
  copyBriefButton: 'Copy Brief',
  copiedBriefButton: 'Copied',
  companionChatHeading: 'Family Daily Companion Chat',
  companionChatSubheading:
    'Ask about live air and weather wherever you are, or share daily habit changes to adapt your schedule immediately.',
  companionChatMemberLabel: 'Chatting as',
  companionChatPlaceholder:
    'Ask e.g. Near Salt Lake right now, how is the air? Or: School timing is 08:00 to 15:00',
  companionChatSend: 'Ask Companion',
  companionChatSending: 'Checking live sensors',
  companionChatUseGps: 'Attach GPS',
  companionChatGpsAttached: 'GPS attached',
  companionChatUpdatedBadge: 'Applied to daily schedule',
  companionChatChips: [
    'I am outside right now, how is the air and weather for me?',
    'My new timing is 08:00 to 15:30 via metro',
    'Mild asthma today, can I sit on the terrace this afternoon?',
  ],
};

const hi: LocaleDictionary = {
  skipLink: 'मुख्य सामग्री पर जाएं',
  appTitle: 'PranaPulse AI',
  themeLightLabel: 'लाइट मोड',
  themeDarkLabel: 'डार्क मोड',
  statusLiveGemini: 'लाइव सेंसर व उपग्रह टेलीमेट्री सक्रिय',
  statusDeterministicMode: 'सत्यापित भौतिकी इंजन सक्रिय',
  heroHeadline: 'सर्दियों की धुंध टेलीमेट्री',
  heroLede: 'वायुमंडलीय इनवर्जन ट्रैपिंग विश्लेषण, इनडोर CADR फ़िल्ट्रेशन और कम-उत्सर्जन पारिवारिक दिनचर्या।',
  pollutantBreakdownHeading: '6-प्रदूषक परिवेशी स्तर (ug/m3)',
  aqiScaleCaption: 'CPCB NAQI गंभीरता स्तर',
  citySearchLabel: 'शहर या क्षेत्र खोजें',
  citySearchPlaceholder: 'शहर खोजें (जैसे दिल्ली, पटना, लखनऊ)',
  useGpsButton: 'GPS उपयोग करें',
  gpsLoading: 'खोज रहा है',
  gpsUnavailable: 'स्थान अनुमति उपलब्ध नहीं है। नीचे से शहर चुनें।',
  gpsIpFallbackNote:
    'नेटवर्क IP से अनुमानित स्थान दिखाया गया है। सटीक GPS के लिए ब्राउज़र व OS स्थान अनुमति चालू करें।',
  severeBannerPrefix: 'गंभीर वायु गुणवत्ता स्तर पार:',
  disagreementBannerText: 'निकटतम स्टेशन मॉडल से अधिक प्रदूषण दिखा रहा है। सुरक्षित सीमा लागू की गई है।',
  stationCrossCheckLabel: 'निकटतम स्टेशन:',
  metricCpcbLabel: 'CPCB NAQI',
  metricUsEpaLabel: 'US-EPA व WHO सीमा',
  metricPblLabel: 'मिश्रण परत वेंटिलेशन',
  metricPlumeLabel: '500 किमी धुआं स्रोत',
  openWindowsYes: 'अभी खिड़कियां खोलें (दोपहर फैलाव)',
  openWindowsNo: 'खिड़कियां बंद रखें (धुंध फंसाव सक्रिय)',
  cigarettesUnit: 'सिगरेट/दिन समतुल्य',
  whoMultipleUnit: 'x WHO 24घं सीमा',
  fireHotspotsUnit: 'सक्रिय थर्मल स्रोत',
  fireBaselineModelNote: 'मौसमी आधारभूत अनुमान',
  simulatedFallbackNote: 'ऑफ़लाइन वायुमंडलीय आधार सक्रिय',
  chartTitle: '24-घंटे की मिश्रण ऊंचाई और PM2.5 पूर्वानुमान',
  chartLegendPm25: 'PM2.5 ug/m3 (संपर्क)',
  chartLegendPbl: 'मिश्रण ऊंचाई मी (सेंसर)',
  chartTableCaption: 'प्रति घंटा PM2.5, मिश्रण ऊंचाई और हवा डेटा तालिका',
  tabDashboard: 'डैशबोर्ड',
  tabRoutine: 'पारिवारिक दिनचर्या',
  tabIndoor: 'इनडोर व CADR',
  tabCommute: 'यात्रा व कॉरिडोर',
  tabGear: 'मास्क व प्यूरिफायर',
  tabCommunity: 'RWA व सलाहकार',
  switchCityButton: 'शहर बदलें',
  previousSectionLabel: 'पिछला',
  nextSectionLabel: 'अगला',
  gearMasksHeading: 'सत्यापित N95 व मास्क खरीदारी गाइड',
  gearPurifiersHeading: 'CADR-आधारित True HEPA प्यूरिफायर दुकान',
  gearMaskCustomLabel: 'खरीदने के लिए कोई भी मास्क ब्रांड या मॉडल खोजें',
  gearPurifierCustomLabel: 'खरीदने के लिए कोई भी एयर प्यूरिफायर या फ़िल्टर खोजें',
  buyAmazonLabel: 'Amazon.in पर खरीदें',
  buyFlipkartLabel: 'Flipkart पर खरीदें',
  buy1mgLabel: 'Tata 1mg पर खरीदें',
  buyFilterLabel: 'रिप्लेसमेंट HEPA फ़िल्टर',
  cadrMatchBadge: 'आपके कमरे के लिए उपयुक्त',
  cadrSmallBadge: 'छोटे कमरों के लिए',
  refreshPlan: 'योजना अपडेट करें',
  generatingPlan: 'गणना जारी',
  familySectionHeading: 'परिवार सुरक्षा सूची',
  housingSectionHeading: 'घर और रसोई ईंधन',
  tightnessLabel: 'खिड़की सीलिंग',
  fuelLabel: 'खाना पकाने का ईंधन',
  addMemberButton: 'सदस्य जोड़ें',
  removeMemberButton: 'हटाएं',
  newMemberPrefix: 'सदस्य',
  memberNameLabel: 'नाम',
  memberRoleLabel: 'स्वास्थ्य वर्ग',
  memberMaskLabel: 'मास्क',
  memberHoursLabel: 'बाहर घंटे/दिन',
  memberStatusLabel: 'सलाह',
  memberDoseLabel: 'दैनिक खुराक',
  routineHeading: 'कम-उत्सर्जन दैनिक समय-सारणी',
  hacksHeading: 'लागत-आधारित इनडोर उपाय',
  swapsHeading: 'टिकाऊ घरेलू बदलाव',
  aiSourceGemini: 'लाइव सेंसर व प्रमाणित भौतिकी पर सत्यापित',
  aiSourceFallback: 'सत्यापित स्थानीय प्रोटोकॉल सक्रिय',
  indoorSectionHeading: 'इनडोर मास-बैलेंस और CADR कैलकुलेटर',
  roomAreaLabel: 'कमरे का क्षेत्रफल (m2)',
  cadrLabel: 'प्यूरिफायर CADR (m3/h)',
  targetCadrLabel: '4.8 ACH लक्ष्य CADR',
  achievedAchLabel: 'प्रभावी वायु परिवर्तन',
  purgeTimeLabel: '90% धुआं निकासी समय',
  dailyReductionLabel: 'दैनिक जोखिम में कमी',
  crGuideTitle: 'Corsi-Rosenthal DIY बॉक्स गाइड',
  crGuideSummary: 'चार MERV-13 फ़िल्टर और 50 सेमी बॉक्स पंखे (~₹2,500) से 400+ m3/h स्वच्छ हवा प्राप्त करें।',
  mythAlertHeading: 'वैज्ञानिक चेतावनी',
  mythAlertBullets: [
    'ओज़ोन जनरेटर या आयोनाइज़र से बचें: इनडोर ओज़ोन सूक्ष्म कण बनाता है और फेफड़ों में जलन पैदा करता है (PMC7749091)।',
    'केवल इनडोर पौधे सर्दियों के गंभीर PM2.5 धुंध को साफ नहीं कर सकते; MERV-13 DIY बॉक्स फैन या HEPA फ़िल्टर अपनाएं।',
  ],
  winterPlantsHeading: 'सर्दियों के सहायक पौधे (~1% पूरक जैव-सहायता)',
  winterPlantsSubtitle:
    'जबकि मुख्य PM2.5 सफाई HEPA/MERV-13 फ़िल्टर करते हैं, ये पौधे सर्दियों में ~1% अतिरिक्त धूल अवशोषण, VOC कमी और नमी प्रदान करते हैं:',
  winterPlantsList: [
    'स्नेक प्लांट (Sansevieria): रात में भी ऑक्सीजन छोड़ता है और इसकी पत्तियां मोटी धूल को रोकती हैं।',
    'एरेका पाम (Areca Palm): शुष्क सर्दियों में कमरे की नमी बनाए रखता है जिससे सांस की नली में जलन कम होती है।',
    'स्पाइडर प्लांट व पीस लिली: कम धूप में भी रसोई के VOC, बेंजीन और फॉर्मेल्डिहाइड सोखने में सहायक।',
    'तुलसी व मनी प्लांट: बालकनी और खिड़की के पास बाहरी धूल को रोकने वाले मजबूत भारतीय पौधे।',
  ],
  otherOptionLabel: 'अन्य (अपना विकल्प जोड़ें)',
  customInputPlaceholder: 'AI सत्यापन के लिए अपना विकल्प लिखें',
  verifyCustomButton: 'AI से जांचें',
  verifyingCustomButton: 'जांच जारी',
  indoorChartTitle: '24-घंटे इनडोर बनाम बाहरी PM2.5 स्तर',
  indoorChartLegendOutdoor: 'बाहरी ug/m3',
  indoorChartLegendBaseline: 'बिना फ़िल्टर इनडोर ug/m3',
  indoorChartLegendMitigated: 'फ़िल्टर सहित इनडोर ug/m3',
  commuteSectionHeading: 'श्वसन खुराक विरोधाभास और यात्रा मैट्रिक्स',
  originAreaLabel: 'प्रारंभिक क्षेत्र (कहाँ से)',
  destinationAreaLabel: 'गंतव्य क्षेत्र (कहाँ तक)',
  planRouteButton: 'स्वच्छ मार्ग खोजें',
  planningRouteButton: 'मार्ग जांच जारी',
  openGoogleMapsButton: 'Google Maps में स्वच्छ मार्ग खोलें',
  commuteDistanceLabel: 'एकतरफा दूरी (किमी)',
  commuteModeLabel: 'मुख्य वाहन',
  commuteMaskLabel: 'मास्क प्रकार',
  paretoHeading: 'सांस के PM2.5 जोखिम के अनुसार यात्रा तुलना',
  tableTimeHeader: 'समय',
  tableDoseHeader: 'खुराक',
  tableCo2Header: 'CO2',
  tableStatusHeader: 'स्थिति',
  unitMin: 'मिनट',
  unitKm: 'किमी',
  unitHr: 'घंटे',
  paradoxWarningLabel: 'उच्च श्वसन दर जोखिम',
  paretoOptimalLabel: 'संतुलित विकल्प',
  corridorHeading: 'Dijkstra स्वच्छ मार्ग नेटवर्क',
  corridorSavedSummary: 'मुख्य सड़क की तुलना में जोखिम बचाव',
  corridorDirectLabel: 'मुख्य ट्रैफ़िक मार्ग',
  corridorCleanLabel: 'न्यूनतम प्रदूषण मार्ग',
  rwaSectionHeading: 'RWA मोहल्ला सामूहिक प्रभाव सिम्युलेटर',
  householdsLabel: 'भाग लेने वाले घर',
  transitShiftLabel: 'सार्वजनिक परिवहन बदलाव (%)',
  haltLeafBurningLabel: 'खुले में पत्ते और कचरा जलाना रोकें',
  co2SavedDailyLabel: 'दैनिक CO2 बचत',
  pm25AvoidedDailyLabel: 'दैनिक PM2.5 कमी',
  copyBulletinButton: 'RWA नोटिस कॉपी करें',
  copiedBulletinButton: 'क्लिपबोर्ड पर कॉपी हुआ',
  printBulletinButton: 'प्रिंट करें',
  advisorHeading: 'सत्यापित AI धुंध सलाहकार',
  advisorPlaceholder: 'स्कूल यात्रा, खिड़की खोलने का समय या अस्थमा बचाव पूछें',
  advisorSendButton: 'सलाह पूछें',
  advisorStreamingLabel: 'सत्यापित उत्तर प्राप्त हो रहा है',
  advisorChips: [
    'आज रसोई का धुआं निकालने के लिए खिड़कियां कब खोलें?',
    'क्या आज सुबह साइकिल चलाना सुरक्षित है या फेफड़ों में अधिक धुंध जाएगी?',
    'बच्चों के कमरे के लिए MERV-13 फ़िल्टर बनाम आयोनाइज़र की तुलना करें',
  ],
  quickCitiesHeading: 'प्रमुख शहर',
  footerNotice:
    'PranaPulse AI सूचनात्मक पर्यावरणीय मार्गदर्शन के लिए भौतिकी गणना करता है। चिकित्सकीय आपात स्थिति में डॉक्टर से संपर्क करें।',
  languageLabel: 'भाषा',
  landingNavOverview: 'अवलोकन',
  landingNavConsole: 'लाइव कंसोल',
  landingHeroHeadline: 'सर्दियों के स्मॉग संकट से सुरक्षा और प्रबंधन',
  landingHeroLede:
    'लाइव ग्राउंड सेंसर और उपग्रह डेटा पर आधारित वास्तविक समय वायुमंडलीय इनवर्जन टेलीमेट्री, इनडोर CADR फ़िल्ट्रेशन मॉडल और कम-प्रदूषण पारिवारिक दिनचर्या।',
  landingEnterConsole: 'लाइव कंसोल शुरू करें',
  landingContinueAsGuest: 'अतिथि के रूप में देखें',
  landingSimulateSevere: 'गंभीर शीतकालीन इनवर्जन (AQI 380 • 220m PBL)',
  landingSimulateClean: 'स्वच्छ दोपहर की हवा (AQI 45 • 1200m मिक्सिंग)',
  landingInversionCeilingLabel: 'थर्मल बाउंड्री सीलिंग',
  landingEstimatedPm25Label: 'अनुमानित PM2.5 भार',
  landingVisibilityLabel: 'शहरी दृश्यता',
  landingSevereInversionDesc:
    'जमीन की ठंडक से प्रदूषक 220 मीटर के नीचे ही फंसे रहते हैं।',
  landingCleanAirDesc:
    'धूप से संवहन मिश्रण वायुमंडलीय इनवर्जन को 1200 मीटर से ऊपर उठाता है।',
  landingAuthGatewayTitle: 'प्राणपल्स कंसोल में प्रवेश करें',
  landingAuthGatewaySubtitle:
    'अतिथि के रूप में तुरंत शुरू करें या अपने पारिवारिक डेटा को सिंक करने के लिए साइन इन करें।',
  landingAuthGuestCta: 'लाइव कंसोल शुरू करें',
  landingAuthSignedInAs: 'सक्रिय सत्र',
  landingAuthOpenConsole: 'अपना कंसोल खोलें',
  landingPillarsHeading: 'सिंधु-गंगा मैदानों के शीतकालीन स्मॉग हेतु विशेष रूप से तैयार',
  landingPillarsSubheading:
    'पारिवारिक श्वसन स्वास्थ्य की सुरक्षा के लिए सत्यापित ग्राउंड-स्टेशन सेंसर, उपग्रह टेलीमेट्री और प्रमाणित एरोसोल भौतिकी का संगम।',
  landingPillarPblTitle: 'प्लेनेटरी बाउंड्री लेयर ट्रैकिंग',
  landingPillarPblDesc:
    'रात के थर्मल इनवर्जन, वेंटिलेशन इंडेक्स और CPCB NAQI मॉनिटरों की वास्तविक समय की निगरानी।',
  landingPillarCadrTitle: 'इनडोर प्यूरिफिकेशन और CADR भौतिकी',
  landingPillarCadrDesc:
    'कमरे का मास-बैलेंस मॉडल, कोर्सी-रोसेंथल बॉक्स विवरण और सटीक एयर चेंज प्रति घंटा गणना।',
  landingPillarCommuteTitle: 'स्वच्छ आवागमन गलियारे',
  landingPillarCommuteDesc:
    'व्यस्त फ्लाईओवर और डीजल धुएं वाले क्षेत्रों से बचकर सुरक्षित मार्ग खोजने हेतु डिक्सट्रा पाथफाइंडिंग।',
  landingPillarFamilyTitle: 'पारिवारिक देखभाल सूची',
  landingPillarFamilyDesc:
    'बच्चों, बुजुर्गों और यात्रियों के लिए विशिष्ट बाहरी जोखिम सीमा और मास्क दिशानिर्देश।',
  landingPillarAdvisorTitle: 'भौतिकी-आधारित स्वास्थ्य सलाहकार',
  landingPillarAdvisorDesc:
    'लाइव सेंसर डेटा और प्रमाणित वायुमंडलीय विज्ञान पर आधारित सटीक सुरक्षा परामर्श।',
  landingBottomBannerTitle:
    'आज ही अपने परिवार को शीतकालीन वायुमंडलीय प्रदूषण से सुरक्षित करें।',
  landingBottomBannerCta: 'वर्कबेंच कंसोल में प्रवेश करें',
  languageNames: { en: 'English', hi: 'हिन्दी', ta: 'தமிழ்' },
  cityNames: {
    'New Delhi': 'नई दिल्ली',
    Lucknow: 'लखनऊ',
    Patna: 'पटना',
    Kolkata: 'कोलकाता',
    Mumbai: 'मुंबई',
    Chennai: 'चेन्नई',
    Bengaluru: 'बेंगलुरु',
    London: 'लंदन',
    'Local Area Monitor': 'स्थानीय क्षेत्र स्टेशन',
  },
  defaultMemberLabels: {
    m1: 'आरव (स्कूल)',
    m2: 'मीरा (वरिष्ठ)',
    m3: 'रोहन (यात्री)',
  },
  cpcbCategories: {
    good: 'अच्छा',
    satisfactory: 'संतोषजनक',
    moderate: 'मध्यम',
    poor: 'खराब',
    'very-poor': 'बहुत खराब',
    severe: 'गंभीर',
  },
  inversionSeverities: {
    neutral: 'वायु फैलाव खुला है',
    'moderate-trapping': 'मध्यम धुंध फंसाव',
    'severe-inversion': 'गंभीर थर्मल ढक्कन',
  },
  tightnessOptions: {
    leaky: 'सामान्य खुली दरारें (1.2 ACH)',
    standard: 'मानक बंद कमरा (0.6 ACH)',
    'weather-sealed': 'सीलबंद कमरा (0.28 ACH)',
  },
  fuelOptions: {
    induction: 'इंडक्शन इलेक्ट्रिक (0 ug/h)',
    'lpg-vented': 'चिमनी सहित LPG',
    'lpg-unvented': 'बिना चिमनी LPG',
    'solid-biomass': 'चूल्हा / बायोमास',
  },
  roleOptions: {
    child: 'बच्चा / स्कूल छात्र',
    'senior-respiratory': 'वरिष्ठ / अस्थमा / COPD',
    commuter: 'दैनिक यात्री',
    caregiver: 'घर देखभालकर्ता',
  },
  maskOptions: {
    none: 'बिना मास्क',
    cloth: 'कपड़े का मास्क',
    surgical: 'सर्जिकल मास्क',
    'n95-ffp2': 'N95 / FFP2 मास्क',
  },
  commuteModes: {
    metro: 'AC मेट्रो रेल',
    'electric-bus': 'इलेक्ट्रिक बस',
    'ev-car': 'EV कार (बंद हवा)',
    'petrol-car': 'पेट्रोल कार',
    'two-wheeler': 'दोपहिया वाहन',
    cycling: 'साइकिल',
    walking: 'पैदल',
  },
  outdoorStatuses: {
    go: 'सामान्य बाहरी गतिविधि',
    'caution-masked': 'N95 पहनकर संक्षिप्त कार्य',
    'limit-short': 'बाहरी श्रम सीमित करें',
    'stay-indoors': 'फ़िल्टर वाले घर में रहें',
  },
  corridorNodes: {
    'home-sector': 'निवास सेक्टर',
    'arterial-junction': 'मुख्य चौराहा',
    'ring-flyover': 'रिंग रोड फ्लाईओवर',
    'green-parkway': 'हरित पार्क मार्ग',
    'metro-concourse': 'मेट्रो कॉनकोर्स',
    'civic-hub': 'स्कूल / कार्य केंद्र',
  },
  archetypeOptions: {
    'school-student': 'स्कूल छात्र',
    'office-commuter': 'ऑफ़िस यात्री',
    'senior-homebound': 'वरिष्ठ / श्वसन देखभाल',
    'outdoor-active': 'बाहरी व्यायाम',
    'home-caregiver': 'गृह देखभाल',
  },
  memberHabitsToggle: 'दैनिक आदतें व Telegram सेट करें',
  memberArchetypeLabel: 'दिनचर्या प्रकार',
  memberLeaveTimeLabel: 'घर से प्रस्थान',
  memberReturnTimeLabel: 'घर वापसी',
  memberCommuteLabel: 'व्यक्तिगत यात्रा साधन',
  memberHealthNotesLabel: 'स्वास्थ्य नोट (अस्थमा, इनहेलर)',
  memberHabitsNoteLabel: 'दैनिक आदतें व समय नोट',
  memberTelegramBriefLabel: 'Telegram पर सुबह 06:30 दैनिक बुलेटिन',
  memberConnectTelegramButton: 'Telegram जोड़ें',
  memberOpenTelegramLink: 'जोड़ने हेतु Telegram खोलें',
  memberTelegramPendingHint:
    '1-टैप Telegram पेयरिंग चालू करने हेतु env में TELEGRAM_BOT_TOKEN व TELEGRAM_BOT_USERNAME जोड़ें।',
  scheduleAllHouseholdTab: 'पूरा परिवार',
  shareWhatsAppButton: 'WhatsApp पर भेजें',
  copyBriefButton: 'सारांश कॉपी करें',
  copiedBriefButton: 'कॉपी किया गया',
  companionChatHeading: 'पारिवारिक दैनिक साथी चैट',
  companionChatSubheading:
    'बाहर होने पर तुरंत स्थानीय हवा व मौसम पूछें, या अपनी दिनचर्या बदलकर समय-सारणी अपडेट करें।',
  companionChatMemberLabel: 'सदस्य चुनें',
  companionChatPlaceholder:
    'पूछें जैसे: मैं अभी बाहर हूं, हवा कैसी है? या: मेरा स्कूल समय 08:00 से 15:00 है',
  companionChatSend: 'साथी से पूछें',
  companionChatSending: 'लाइव सेंसर जांच रहा है',
  companionChatUseGps: 'GPS जोड़ें',
  companionChatGpsAttached: 'GPS जुड़ा है',
  companionChatUpdatedBadge: 'दैनिक समय-सारणी अपडेट हुई',
  companionChatChips: [
    'मैं अभी बाहर हूं, मेरे लिए हवा और मौसम कैसा है?',
    'मेरा नया समय सुबह 08:00 से शाम 15:30 मेट्रो से है',
    'आज हल्का अस्थमा है, क्या दोपहर बालकनी में बैठना सुरक्षित है?',
  ],
};

const ta: LocaleDictionary = {
  skipLink: 'முதன்மை உள்ளடக்கத்திற்குச் செல்லவும்',
  appTitle: 'PranaPulse AI',
  themeLightLabel: 'பகல் முறை',
  themeDarkLabel: 'இரவு முறை',
  statusLiveGemini: 'நேரடி உணரி & செயற்கைக்கோள் தரவு செயலில்',
  statusDeterministicMode: 'சரிபார்க்கப்பட்ட இயற்பியல் அமைப்பு',
  heroHeadline: 'குளிர்காலப் புகைபனி அளவீடு',
  heroLede: 'வளிமண்டல வெப்பத் தலைகீழ் மாற்றம், வீட்டு CADR வடிகட்டல் மற்றும் குறைந்த உமிழ்வு குடும்ப அட்டவணை.',
  pollutantBreakdownHeading: '6-மாசுகளின் அளவு (ug/m3)',
  aqiScaleCaption: 'CPCB NAQI தீவிர நிலை',
  citySearchLabel: 'நகரம் அல்லது பகுதியைத் தேடுங்கள்',
  citySearchPlaceholder: 'நகரத்தைத் தேடுங்கள் (எ.கா. சென்னை, டெல்லி, மதுரை)',
  useGpsButton: 'GPS பயன்படுத்து',
  gpsLoading: 'கண்டறிகிறது',
  gpsUnavailable: 'இருப்பிட அனுமதி இல்லை. கீழே உள்ள நகரத்தைத் தேர்ந்தெடுக்கவும்.',
  gpsIpFallbackNote:
    'தோராயமான இணைய IP இருப்பிடம் காட்டப்படுகிறது. துல்லியமான GPS-க்கு இருப்பிட அனுமதியை இயக்கவும்.',
  severeBannerPrefix: 'கடுமையான காற்று மாசு வரம்பு எட்டப்பட்டது:',
  disagreementBannerText:
    'அருகிலுள்ள கண்காணிப்பு நிலையம் அதிக மாசைப் பதிவு செய்கிறது. பாதுகாப்பு வரம்பு செயலில் உள்ளது.',
  stationCrossCheckLabel: 'அருகிலுள்ள நிலையம்:',
  metricCpcbLabel: 'CPCB NAQI',
  metricUsEpaLabel: 'US-EPA & WHO 24மணி',
  metricPblLabel: 'காற்று கலப்பு அடுக்கு',
  metricPlumeLabel: '500 கிமீ வெப்பப் புகை',
  openWindowsYes: 'இப்போது ஜன்னல்களைத் திறக்கலாம்',
  openWindowsNo: 'ஜன்னல்களை மூடி வைக்கவும்',
  cigarettesUnit: 'சிகரெட்/நாள் சமம்',
  whoMultipleUnit: 'x WHO 24மணி வரம்பு',
  fireHotspotsUnit: 'செயலில் உள்ள புள்ளிகள்',
  fireBaselineModelNote: 'பருவகால அடிப்படை மதிப்பீடு',
  simulatedFallbackNote: 'ஆஃப்லைன் அடிப்படை மாதிரி செயலில்',
  chartTitle: '24-மணி நேர காற்று அடுக்கு மற்றும் PM2.5 கணிப்பு',
  chartLegendPm25: 'PM2.5 ug/m3 (தாக்கம்)',
  chartLegendPbl: 'கலப்பு உயரம் மீ (உணரி)',
  chartTableCaption: 'மணிநேர PM2.5, எல்லை அடுக்கு உயரம் மற்றும் காற்றோட்ட தரவு',
  tabDashboard: 'டாஷ்போர்டு',
  tabRoutine: 'குடும்ப அட்டவணை',
  tabIndoor: 'உள் காற்று & CADR',
  tabCommute: 'பயணம் & வழித்தடம்',
  tabGear: 'முகக்கவசம் & வடிகட்டி',
  tabCommunity: 'RWA & ஆலோசகர்',
  switchCityButton: 'நகரம் மாற்று',
  previousSectionLabel: 'முந்தைய',
  nextSectionLabel: 'அடுத்த',
  gearMasksHeading: 'சரிபார்க்கப்பட்ட N95 முகக்கவச வழிகாட்டி',
  gearPurifiersHeading: 'CADR அடிப்படையிலான HEPA காற்று வடிகட்டி',
  gearMaskCustomLabel: 'வாங்க விரும்பும் முகக்கவச மாதிரியைத் தேடுங்கள்',
  gearPurifierCustomLabel: 'வாங்க விரும்பும் காற்று வடிகட்டியைத் தேடுங்கள்',
  buyAmazonLabel: 'Amazon.in-ல் வாங்க',
  buyFlipkartLabel: 'Flipkart-ல் வாங்க',
  buy1mgLabel: 'Tata 1mg-ல் வாங்க',
  buyFilterLabel: 'மாற்று HEPA வடிகட்டி',
  cadrMatchBadge: 'உங்கள் அறைக்கு ஏற்றது',
  cadrSmallBadge: 'சிறிய அறைக்கு ஏற்றது',
  refreshPlan: 'திட்டத்தைப் புதுப்பி',
  generatingPlan: 'கணக்கிடுகிறது',
  familySectionHeading: 'குடும்ப பாதுகாப்பு பட்டியல்',
  housingSectionHeading: 'வீட்டு அமைப்பு மற்றும் சமையல் எரிபொருள்',
  tightnessLabel: 'ஜன்னல் அடைப்பு',
  fuelLabel: 'சமையல் எரிபொருள்',
  addMemberButton: 'உறுப்பினர் சேர்',
  removeMemberButton: 'நீக்கு',
  newMemberPrefix: 'உறுப்பினர்',
  memberNameLabel: 'பெயர்',
  memberRoleLabel: 'பாதிப்பு நிலை',
  memberMaskLabel: 'முகக்கவசம்',
  memberHoursLabel: 'வெளி நேரம் (மணி)',
  memberStatusLabel: 'வழிகாட்டுதல்',
  memberDoseLabel: 'தினசரி அளவு',
  routineHeading: 'குறைந்த உமிழ்வு தினசரி அட்டவணை',
  hacksHeading: 'வீட்டு காற்று மேம்பாட்டு வழிகள்',
  swapsHeading: 'சுற்றுச்சூழல் உகந்த மாற்றங்கள்',
  aiSourceGemini: 'நேரடி உணரி & சரிபார்க்கப்பட்ட இயற்பியலில் உருவாக்கப்பட்டது',
  aiSourceFallback: 'சரிபார்க்கப்பட்ட உள்ளூர் நெறிமுறை செயலில்',
  indoorSectionHeading: 'உள் காற்று சமநிலை மற்றும் CADR கணிப்பான்',
  roomAreaLabel: 'அறை பரப்பளவு (m2)',
  cadrLabel: 'வடிகட்டி CADR (m3/h)',
  targetCadrLabel: '4.8 ACH இலக்கு CADR',
  achievedAchLabel: 'செயல்திறன் மாற்றம்',
  purgeTimeLabel: '90% புகை நீக்க நேரம்',
  dailyReductionLabel: 'தினசரி பாதிப்பு குறைப்பு',
  crGuideTitle: 'Corsi-Rosenthal DIY பெட்டி வழிகாட்டி',
  crGuideSummary:
    'நான்கு MERV-13 வடிகட்டிகள் மற்றும் 50 செமீ பெட்டி மின்விசிறி (~₹2,500) மூலம் 400+ m3/h சுத்தமான காற்று.',
  mythAlertHeading: 'அறிவியல் எச்சரிக்கை',
  mythAlertBullets: [
    'ஓசோன் அயனிசர் கருவிகளைத் தவிர்க்கவும்: ஓசோன் நுண்ணிய துகள்களை உருவாக்கி சுவாசப் பாதையை பாதிக்கும் (PMC7749091).',
    'வீட்டுத் தாவரங்களால் மட்டுமே குளிர்கால PM2.5 புகையை நீக்க முடியாது; MERV-13 DIY அல்லது HEPA வடிகட்டியைப் பயன்படுத்தவும்.',
  ],
  winterPlantsHeading: 'குளிர்கால துணைத் தாவரங்கள் (~1% கூடுதல் உதவி)',
  winterPlantsSubtitle:
    'HEPA/MERV-13 வடிகட்டி முக்கியப் புகையை நீக்கினாலும், இந்த குளிர்காலத் தாவரங்கள் ~1% கூடுதல் தூசி மற்றும் VOC குறைப்பிற்கு உதவும்:',
  winterPlantsList: [
    'பாம்பு செடி (Snake Plant): இரவிலும் ஆக்ஸிஜனை வெளியிட்டு இலைகளில் தூசியைப் பிடிக்கும்.',
    'அரிகா பனை (Areca Palm): வறண்ட குளிர்காலத்தில் அறையின் ஈரப்பதத்தைக் காத்து சுவாசத்திற்கு உதவும்.',
    'ஸ்பைடர் செடி & பீஸ் லில்லி: சமையல் நச்சு வாயுக்களை (VOC, பென்சீன்) குறைந்த வெளிச்சத்திலும் உறிஞ்சும்.',
    'துளசி & மணி பிளாண்ட்: ஜன்னல் மற்றும் பால்கனியில் வெளிப்புறத் தூசியைத் தடுக்கும் தாவரங்கள்.',
  ],
  otherOptionLabel: 'மற்றவை (உங்கள் விருப்பத்தைச் சேர்க்கவும்)',
  customInputPlaceholder: 'AI மூலம் சரிபார்க்க உங்கள் விருப்பத்தை உள்ளிடவும்',
  verifyCustomButton: 'AI மூலம் சரிபார்',
  verifyingCustomButton: 'சரிபார்க்கிறது',
  indoorChartTitle: '24-மணி நேர உள் மற்றும் வெளி PM2.5 அளவு',
  indoorChartLegendOutdoor: 'வெளி ug/m3',
  indoorChartLegendBaseline: 'வடிகட்டி இல்லாத உள் ug/m3',
  indoorChartLegendMitigated: 'வடிகட்டிய உள் ug/m3',
  commuteSectionHeading: 'உள்ளிழுக்கும் அளவு முரண்பாடு & பயண ஒப்பீடு',
  originAreaLabel: 'புறப்படும் பகுதி (இருந்து)',
  destinationAreaLabel: 'சேரும் பகுதி (வரை)',
  planRouteButton: 'தூய வழியைக் கண்டறி',
  planningRouteButton: 'வழியைச் சரிபார்க்கிறது',
  openGoogleMapsButton: 'Google Maps-ல் தூய வழியைத் திற',
  commuteDistanceLabel: 'ஒரு வழி தூரம் (கிமீ)',
  commuteModeLabel: 'பயண முறை',
  commuteMaskLabel: 'முகக்கவசம்',
  paretoHeading: 'நுரையீரல் PM2.5 அளவின்படி பயண வரிசை',
  tableTimeHeader: 'நேரம்',
  tableDoseHeader: 'அளவு',
  tableCo2Header: 'CO2',
  tableStatusHeader: 'நிலை',
  unitMin: 'நிமி',
  unitKm: 'கிமீ',
  unitHr: 'மணி',
  paradoxWarningLabel: 'அதிக மூச்சு விகித அபாயம்',
  paretoOptimalLabel: 'சமநிலையான தேர்வு',
  corridorHeading: 'Dijkstra தூய வழித்தட வரைபடம்',
  corridorSavedSummary: 'நெடுஞ்சாலையை விட பாதிப்பு குறைப்பு',
  corridorDirectLabel: 'பிரதான போக்குவரத்து சாலை',
  corridorCleanLabel: 'குறைந்த மாசு பூங்கா வழி',
  rwaSectionHeading: 'RWA குடியிருப்பு கூட்டு தாக்க மாதிரி',
  householdsLabel: 'பங்கேற்கும் வீடுகள்',
  transitShiftLabel: 'பொதுப் போக்குவரத்து மாற்றம் (%)',
  haltLeafBurningLabel: 'திறந்தவெளி இலை எரிப்பை நிறுத்தவும்',
  co2SavedDailyLabel: 'தினசரி CO2 சேமிப்பு',
  pm25AvoidedDailyLabel: 'தினசரி PM2.5 தவிர்ப்பு',
  copyBulletinButton: 'RWA அறிவிப்பை நகலெடு',
  copiedBulletinButton: 'நகலெடுக்கப்பட்டது',
  printBulletinButton: 'அச்சிடு',
  advisorHeading: 'சரிபார்க்கப்பட்ட AI காற்று ஆலோசகர்',
  advisorPlaceholder: 'பள்ளி பயணம், ஜன்னல் நேரம் அல்லது ஆஸ்துமா பாதுகாப்பு பற்றி கேளுங்கள்',
  advisorSendButton: 'ஆலோசனை கேள்',
  advisorStreamingLabel: 'பதில் நேரடியாக வருகிறது',
  advisorChips: [
    'சமையல் புகையை வெளியேற்ற இன்று ஜன்னல்களை எப்போது திறப்பது?',
    'தற்போதைய PM2.5 அளவில் காலை சைக்கிள் ஓட்டுவது பாதுகாப்பானதா?',
    'ஆஸ்துமா அறைக்கு MERV-13 DIY vs ஓசோன் அயனிசரை ஒப்பிடுங்கள்',
  ],
  quickCitiesHeading: 'முக்கிய நகரங்கள்',
  footerNotice:
    'PranaPulse AI தகவல் வழிகாட்டுதலுக்கான சுற்றுச்சூழல் கணக்கீடுகளை வழங்குகிறது. மருத்துவ அவசரத்திற்கு மருத்துவரை அணுகவும்.',
  languageLabel: 'மொழி',
  landingNavOverview: 'கண்ணோட்டம்',
  landingNavConsole: 'நேரலை கன்சோல்',
  landingHeroHeadline: 'குளிர்கால புகை மூட்ட நெருக்கடியிலிருந்து பாதுகாப்பு',
  landingHeroLede:
    'நேரடி தரை உணரிகள் மற்றும் செயற்கைக்கோள் தரவுகளின் அடிப்படையில் நிகழ்நேர வளிமண்டல இன்வெர்ஷன் டெலிமெட்ரி, உள்ளக CADR வடிகட்டுதல் மற்றும் குறைந்த-வெளிப்பாடு குடும்ப வழிகாட்டல்.',
  landingEnterConsole: 'நேரலை கன்சோலைத் தொடங்கவும்',
  landingContinueAsGuest: 'விருந்தினராகப் பார்க்கவும்',
  landingSimulateSevere: 'கடுமையான குளிர்கால இன்வெர்ஷன் (AQI 380 • 220m PBL)',
  landingSimulateClean: 'சுத்தமான மதிய காற்று (AQI 45 • 1200m கலவை)',
  landingInversionCeilingLabel: 'வெப்ப வரம்பு மூடி',
  landingEstimatedPm25Label: 'மதிப்பிடப்பட்ட PM2.5 அளவு',
  landingVisibilityLabel: 'நகர பார்வைத் திறன்',
  landingSevereInversionDesc:
    'குளிர்ந்த நிலப்பரப்பு மாசுகளை 220 மீட்டருக்குள் தடுத்து வைக்கிறது.',
  landingCleanAirDesc:
    'சூரிய வெப்பக் கலவை வளிமண்டல இன்வெர்ஷனை 1200 மீட்டருக்கு மேல் உயர்த்துகிறது.',
  landingAuthGatewayTitle: 'பிராணபல்ஸ் கன்சோலை அணுகவும்',
  landingAuthGatewaySubtitle:
    'விருந்தினராக உடனடியாகத் தொடங்கவும் அல்லது உங்கள் குடும்பப் பட்டியலை ஒத்திசைக்க உள்நுழையவும்.',
  landingAuthGuestCta: 'நேரலை கன்சோலைத் தொடங்கவும்',
  landingAuthSignedInAs: 'செயலில் உள்ள அமர்வு',
  landingAuthOpenConsole: 'உங்கள் கன்சோலைத் திறக்கவும்',
  landingPillarsHeading: 'குளிர்கால புகை மூட்டத்திற்காக சிறப்பாக வடிவமைக்கப்பட்டது',
  landingPillarsSubheading:
    'குடும்ப சுவாச ஆரோக்கியத்தைப் பாதுகாக்க சரிபார்க்கப்பட்ட தரை உணரிகள், செயற்கைக்கோள் தரவு மற்றும் அறிவியல் இயற்பியல்.',
  landingPillarPblTitle: 'வளிமண்டல எல்லை அடுக்கு கண்காணிப்பு',
  landingPillarPblDesc:
    'இரவு நேர வெப்ப மாற்றங்கள், காற்றோட்டக் குறியீடுகள் மற்றும் CPCB NAQI நிலையங்களின் நிகழ்நேரக் கண்காணிப்பு.',
  landingPillarCadrTitle: 'உள்ளக தூய்மைப்படுத்தல் & CADR இயற்பியல்',
  landingPillarCadrDesc:
    'அறை நிறை-சமநிலை மாதிரி, கோர்சி-ரோசெந்தால் பெட்டி விவரக்குறிப்புகள் மற்றும் காற்று மாற்றக் கணக்கீடு.',
  landingPillarCommuteTitle: 'தூய பயண வழித்தடங்கள்',
  landingPillarCommuteDesc:
    'போக்குவரத்து நெரிசல்கள் மற்றும் டீசல் புகை மண்டலங்களைத் தவிர்ப்பதற்கான குறைந்த-வெளிப்பாடு வழித்தடம்.',
  landingPillarFamilyTitle: 'குடும்ப பராமரிப்புப் பட்டியல்',
  landingPillarFamilyDesc:
    'குழந்தைகள், முதியவர்கள் மற்றும் பயணிகளுக்கான தனிப்பயனாக்கப்பட்ட வெளிப்புற வெளிப்பாடு வரம்புகள்.',
  landingPillarAdvisorTitle: 'இயற்பியல் அடிப்படையிலான சுகாதார ஆலோசகர்',
  landingPillarAdvisorDesc:
    'நேரடி உணரி அளவீடுகள் மற்றும் அறிவியல் ஆய்வுகளுக்குக் கட்டுப்பட்ட நம்பகமான வழிகாட்டல்.',
  landingBottomBannerTitle:
    'இன்றே உங்கள் குடும்பத்தை குளிர்கால வளிமண்டல புகை மூட்டத்திலிருந்து பாதுகாக்கவும்.',
  landingBottomBannerCta: 'பணிமனை கன்சோலில் நுழையவும்',
  languageNames: { en: 'English', hi: 'हिन्दी', ta: 'தமிழ்' },
  cityNames: {
    'New Delhi': 'புது டெல்லி',
    Lucknow: 'லக்னோ',
    Patna: 'பாட்னா',
    Kolkata: 'கொல்கத்தா',
    Mumbai: 'மும்பை',
    Chennai: 'சென்னை',
    Bengaluru: 'பெங்களூரு',
    London: 'லண்டன்',
    'Local Area Monitor': 'உள்ளூர் கண்காணிப்பு நிலையம்',
  },
  defaultMemberLabels: {
    m1: 'ஆரவ் (பள்ளி)',
    m2: 'மீரா (மூத்தவர்)',
    m3: 'ரோஹன் (பயணி)',
  },
  cpcbCategories: {
    good: 'நன்று',
    satisfactory: 'திருப்திகரம்',
    moderate: 'மிதமானது',
    poor: 'மோசம்',
    'very-poor': 'மிக மோசம்',
    severe: 'கடுமையானது',
  },
  inversionSeverities: {
    neutral: 'காற்று பரவல் திறந்துள்ளது',
    'moderate-trapping': 'மிதமான புகை தேக்கம்',
    'severe-inversion': 'கடுமையான வெப்ப மூடி',
  },
  tightnessOptions: {
    leaky: 'சாதாரண இடைவெளி (1.2 ACH)',
    standard: 'அடைத்த அறை (0.6 ACH)',
    'weather-sealed': 'நன்கு மூடிய அறை (0.28 ACH)',
  },
  fuelOptions: {
    induction: 'மின் தூண்டல் அடுப்பு (0 ug/h)',
    'lpg-vented': 'புகைபோக்கி உள்ள LPG',
    'lpg-unvented': 'புகைபோக்கி இல்லாத LPG',
    'solid-biomass': 'விறகு / உயிரி எரிபொருள்',
  },
  roleOptions: {
    child: 'குழந்தை / பள்ளி மாணவர்',
    'senior-respiratory': 'மூத்தவர் / ஆஸ்துமா',
    commuter: 'தினசரி பயணி',
    caregiver: 'வீட்டு பராமரிப்பாளர்',
  },
  maskOptions: {
    none: 'முகக்கவசம் இல்லை',
    cloth: 'துணி முகக்கவசம்',
    surgical: 'மருத்துவ முகக்கவசம்',
    'n95-ffp2': 'N95 / FFP2 கவசம்',
  },
  commuteModes: {
    metro: 'AC மெட்ரோ ரயில்',
    'electric-bus': 'மின்சார பேருந்து',
    'ev-car': 'EV கார்',
    'petrol-car': 'பெட்ரோல் கார்',
    'two-wheeler': 'இருசக்கர வாகனம்',
    cycling: 'சைக்கிள்',
    walking: 'நடைபயணம்',
  },
  outdoorStatuses: {
    go: 'சாதாரண வெளி செயல்பாடு',
    'caution-masked': 'N95 உடன் குறுகிய பயணம்',
    'limit-short': 'வெளி உழைப்பைக் குறைக்கவும்',
    'stay-indoors': 'வடிகட்டிய அறையில் இருக்கவும்',
  },
  corridorNodes: {
    'home-sector': 'வீட்டுப் பகுதி',
    'arterial-junction': 'பிரதான சந்திப்பு',
    'ring-flyover': 'ரிங் ரோடு மேம்பாலம்',
    'green-parkway': 'பசுமைப் பூங்கா வழி',
    'metro-concourse': 'மெட்ரோ நிலையம்',
    'civic-hub': 'பள்ளி / பணி மையம்',
  },
  archetypeOptions: {
    'school-student': 'பள்ளி மாணவர்',
    'office-commuter': 'அலுவலகப் பயணி',
    'senior-homebound': 'மூத்தோர் / சுவாசப் பராமரிப்பு',
    'outdoor-active': 'வெளிப்புற உடற்பயிற்சி',
    'home-caregiver': 'இல்லப் பராமரிப்பாளர்',
  },
  memberHabitsToggle: 'தினசரி வழக்கம் & Telegram அமைப்பு',
  memberArchetypeLabel: 'அட்டவணை வகை',
  memberLeaveTimeLabel: 'புறப்படும் நேரம்',
  memberReturnTimeLabel: 'திரும்பும் நேரம்',
  memberCommuteLabel: 'தனிப்பட்ட பயணம்',
  memberHealthNotesLabel: 'உடல்நல குறிப்பு (ஆஸ்துமா, இன்ஹேலர்)',
  memberHabitsNoteLabel: 'தினசரி வழக்கம் & நேர குறிப்பு',
  memberTelegramBriefLabel: 'Telegram-ல் காலை 06:30 தினசரி அறிக்கை',
  memberConnectTelegramButton: 'Telegram இணை',
  memberOpenTelegramLink: 'இணைக்க Telegram திற',
  memberTelegramPendingHint:
    '1-தட்டல் Telegram இணைப்பை இயக்க env-ல் TELEGRAM_BOT_TOKEN மற்றும் TELEGRAM_BOT_USERNAME சேர்க்கவும்.',
  scheduleAllHouseholdTab: 'முழு குடும்பம்',
  shareWhatsAppButton: 'WhatsApp-ல் பகிர்',
  copyBriefButton: 'அறிக்கை நகலெடு',
  copiedBriefButton: 'நகலெடுக்கப்பட்டது',
  companionChatHeading: 'குடும்ப தினசரி துணை உரையாடல்',
  companionChatSubheading:
    'நீங்கள் இருக்கும் இடத்தின் நேரடி காற்று மற்றும் வானிலையைக் கேளுங்கள், அல்லது உங்கள் வழக்கத்தை உடனே புதுப்பியுங்கள்.',
  companionChatMemberLabel: 'உறுப்பினர்',
  companionChatPlaceholder:
    'கேளுங்கள் எ.கா. நான் இப்போது வெளியே உள்ளேன், காற்று எப்படி உள்ளது? அல்லது: பள்ளி நேரம் 08:00 முதல் 15:00',
  companionChatSend: 'துணையிடம் கேள்',
  companionChatSending: 'நேரடி உணரிகளைச் சரிபார்க்கிறது',
  companionChatUseGps: 'GPS இணை',
  companionChatGpsAttached: 'GPS இணைக்கப்பட்டது',
  companionChatUpdatedBadge: 'அட்டவணையில் சேர்க்கப்பட்டது',
  companionChatChips: [
    'நான் இப்போது வெளியே உள்ளேன், காற்று மற்றும் வானிலை எப்படி உள்ளது?',
    'என் புதிய நேரம் 08:00 முதல் 15:30 மெட்ரோ மூலம்',
    'இன்று லேசான ஆஸ்துமா உள்ளது, மதியம் பால்கனியில் அமரலாமா?',
  ],
};

export const TRANSLATIONS: Record<SupportedLanguage, LocaleDictionary> = {
  en,
  hi,
  ta,
};
