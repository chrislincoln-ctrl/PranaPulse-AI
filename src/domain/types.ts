/**
 * Pure domain types for PranaPulse AI atmospheric physics, indoor mass-balance,
 * commute pulmonary dose optimization, clean-corridor routing, and community impact.
 */

export type PollutantKey = 'pm25' | 'pm10' | 'no2' | 'o3' | 'so2' | 'co';

export type CpcbCategory = 'good' | 'satisfactory' | 'moderate' | 'poor' | 'very-poor' | 'severe';

export type UsEpaCategory =
  'good' | 'moderate' | 'usg' | 'unhealthy' | 'very-unhealthy' | 'hazardous';

export type InversionSeverity = 'neutral' | 'moderate-trapping' | 'severe-inversion';

export type CookingFuelType = 'induction' | 'lpg-vented' | 'lpg-unvented' | 'solid-biomass';

export type BuildingTightness = 'leaky' | 'standard' | 'weather-sealed';

export type CommuteModeId =
  'metro' | 'electric-bus' | 'ev-car' | 'petrol-car' | 'two-wheeler' | 'cycling' | 'walking';

export type MaskTypeId = 'none' | 'cloth' | 'surgical' | 'n95-ffp2';

export type FamilyRole = 'child' | 'senior-respiratory' | 'commuter' | 'caregiver';

export type MemberRoutineArchetype =
  'school-student' | 'office-commuter' | 'senior-homebound' | 'outdoor-active' | 'home-caregiver';

export interface PollutantReadingInput {
  readonly pm25UgM3: number;
  readonly pm10UgM3: number;
  readonly no2UgM3: number;
  readonly o3UgM3: number;
  readonly so2UgM3: number;
  readonly coUgM3: number;
}

export interface AqiAssessment {
  readonly cpcbNaqi: number;
  readonly cpcbCategory: CpcbCategory;
  readonly dominantCpcbPollutant: PollutantKey;
  readonly usEpaAqi: number;
  readonly usEpaCategory: UsEpaCategory;
  readonly whoAnnualMultiple: number;
  readonly who24hMultiple: number;
  readonly cigaretteEquivPerDay: number;
}

export interface HourlyAtmosPoint {
  readonly hourIso: string;
  readonly hourOfDay: number;
  readonly pm25UgM3: number;
  readonly pblMeters: number;
  readonly windKmh: number;
  readonly rhPercent: number;
}

export interface HourlyDispersionPoint {
  readonly hourIso: string;
  readonly hourOfDay: number;
  readonly ventilationM2S: number;
  readonly severity: InversionSeverity;
  readonly isSafeWindowHour: boolean;
}

export interface InversionAnalysis {
  readonly currentSeverity: InversionSeverity;
  readonly currentVentilationM2S: number;
  readonly currentPblMeters: number;
  readonly hygroscopicHazeRisk: boolean;
  readonly openWindowsNow: boolean;
  readonly bestWindowHours: readonly number[];
  readonly avoidOutdoorHours: readonly number[];
  readonly hourly: readonly HourlyDispersionPoint[];
}

export interface IndoorSimulationInput {
  readonly roomAreaM2: number;
  readonly ceilingHeightM?: number;
  readonly cadrM3Hr: number;
  readonly tightness: BuildingTightness;
  readonly cookingFuel: CookingFuelType;
  readonly openWindowHours: readonly number[];
  readonly hourlyOutdoorPm25: readonly number[];
}

export interface HourlyIndoorPoint {
  readonly hourIndex: number;
  readonly outdoorPm25: number;
  readonly indoorBaselinePm25: number;
  readonly indoorMitigatedPm25: number;
}

export interface IndoorClearanceSummary {
  readonly roomVolumeM3: number;
  readonly requiredCadr48Ach: number;
  readonly achievedAch: number;
  readonly purge90Minutes: number;
  readonly dailyMeanOutdoorPm25: number;
  readonly dailyMeanBaselinePm25: number;
  readonly dailyMeanMitigatedPm25: number;
  readonly exposureReductionPct: number;
  readonly mythAlerts: readonly string[];
  readonly hourly: readonly HourlyIndoorPoint[];
}

export interface CommuteOptionEvaluation {
  readonly mode: CommuteModeId;
  readonly mask: MaskTypeId;
  readonly durationMinutes: number;
  readonly personalInhaledUg: number;
  readonly cigaretteEquiv: number;
  readonly communityCo2Grams: number;
  readonly communityPm25Mg: number;
  readonly isParetoOptimal: boolean;
  readonly paradoxWarning: boolean;
}

export type CorridorNodeId =
  | 'home-sector'
  | 'arterial-junction'
  | 'ring-flyover'
  | 'green-parkway'
  | 'metro-concourse'
  | 'civic-hub';

export interface CorridorSegment {
  readonly from: CorridorNodeId;
  readonly to: CorridorNodeId;
  readonly distanceKm: number;
  readonly exposureUg: number;
  readonly minutes: number;
}

export interface CorridorRouteComparison {
  readonly lowestExposurePath: readonly CorridorNodeId[];
  readonly lowestExposureUg: number;
  readonly lowestExposureMinutes: number;
  readonly directRoadPath: readonly CorridorNodeId[];
  readonly directRoadExposureUg: number;
  readonly exposureSavedUg: number;
  readonly exposureSavedPct: number;
  readonly segments: readonly CorridorSegment[];
  readonly directSegments?: readonly CorridorSegment[];
}

export interface FamilyMemberInput {
  readonly id: string;
  readonly label: string;
  readonly role: FamilyRole;
  readonly mask: MaskTypeId;
  readonly dailyOutdoorHours: number;
  readonly archetype?: MemberRoutineArchetype | undefined;
  readonly leaveHomeTime?: string | undefined;
  readonly returnHomeTime?: string | undefined;
  readonly commuteMode?: CommuteModeId | undefined;
  readonly healthNotes?: string | undefined;
  readonly dailyHabitsNote?: string | undefined;
  readonly telegramDailyBrief?: boolean | undefined;
  readonly briefTimeLocal?: string | undefined;
}

export interface RoutineStepItem {
  readonly timeWindow: string;
  readonly actionTitle: string;
  readonly reasonSummary: string;
  readonly estimatedImpactLabel: string;
  readonly exposureTag: 'indoor' | 'commute' | 'outdoor' | 'ventilation';
}

export interface MemberDailySchedule {
  readonly memberId: string;
  readonly memberLabel: string;
  readonly archetype: MemberRoutineArchetype;
  readonly summaryHeadline: string;
  readonly dailyRoutine: readonly RoutineStepItem[];
  readonly shareBriefText: string;
}

export interface FamilyMemberAdvisory {
  readonly id: string;
  readonly label: string;
  readonly role: FamilyRole;
  readonly estimatedDailyInhaledUg: number;
  readonly cigaretteEquiv: number;
  readonly outdoorStatus: 'go' | 'caution-masked' | 'limit-short' | 'stay-indoors';
}

export interface RwaCollectiveImpact {
  readonly householdsParticipating: number;
  readonly dailyCo2SavedKg: number;
  readonly dailyPm25AvoidedG: number;
  readonly annualCo2SavedKg: number;
}

export interface StationCrossCheckResult {
  readonly stationAvailable: boolean;
  readonly modelAqi: number;
  readonly stationAqi: number | null;
  readonly deltaAqi: number;
  readonly disagreementDetected: boolean;
  readonly effectiveSafetyAqi: number;
}
