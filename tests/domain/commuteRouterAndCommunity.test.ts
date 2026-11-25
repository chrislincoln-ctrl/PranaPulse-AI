import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { buildClientGoogleMapsUrl, extractMetroCity } from '../../src/config/cityCorridors.js';
import { resolveDirectionalCorridor } from '../../src/config/cityDirectionalWaypoints.js';
import { findLowestExposureCorridor } from '../../src/domain/cleanCorridorRouter.js';
import {
  evaluateFamilyMember,
  simulateRwaCollectiveImpact,
} from '../../src/domain/communityImpact.js';
import { evaluateCommuteOption, rankCommutePareto } from '../../src/domain/commutePareto.js';

describe('commutePareto, cleanCorridorRouter, and communityImpact engines', () => {
  it('computes exact inhaled lung dose, emissions, duration, and paradox boundaries', () => {
    const unmaskedCycling = evaluateCommuteOption({
      mode: 'cycling',
      mask: 'none',
      distanceKm: 16,
      ambientPm25UgM3: 90,
    });
    // durationHours = 1.0, microEnv = 90 * 1.15 = 103.5, inhaled = 103.5 * 1.0 * 2.4 = 248.4 ug
    expect(unmaskedCycling.durationMinutes).toBe(60);
    expect(unmaskedCycling.personalInhaledUg).toBe(248.4);
    expect(unmaskedCycling.cigaretteEquiv).toBe(0.8);
    expect(unmaskedCycling.communityCo2Grams).toBe(0);
    expect(unmaskedCycling.communityPm25Mg).toBe(0);
    expect(unmaskedCycling.isParetoOptimal).toBe(false);
    expect(unmaskedCycling.paradoxWarning).toBe(true);

    const justBelowParadox = evaluateCommuteOption({
      mode: 'cycling',
      mask: 'none',
      distanceKm: 16,
      ambientPm25UgM3: 89.9,
    });
    expect(justBelowParadox.paradoxWarning).toBe(false);

    const petrolDrive = evaluateCommuteOption({
      mode: 'petrol-car',
      mask: 'n95-ffp2',
      distanceKm: 10,
      ambientPm25UgM3: 180,
    });
    expect(petrolDrive.communityCo2Grams).toBe(1_680);
    expect(petrolDrive.communityPm25Mg).toBe(68);
    expect(petrolDrive.paradoxWarning).toBe(false);

    expect(() =>
      evaluateCommuteOption({
        mode: 'metro',
        mask: 'none',
        distanceKm: -1,
        ambientPm25UgM3: 50,
      }),
    ).toThrow(/distanceKm/);
    expect(() =>
      evaluateCommuteOption({
        mode: 'metro',
        mask: 'none',
        distanceKm: 10,
        ambientPm25UgM3: -1,
      }),
    ).toThrow(/ambientPm25UgM3/);
  });

  it('identifies the exact Pareto-optimal commute frontier across modes', () => {
    const ranked = rankCommutePareto(12, 180, 'n95-ffp2');
    expect(ranked).toHaveLength(7);

    const metro = ranked[0]!;
    expect(metro.mode).toBe('metro');
    expect(metro.isParetoOptimal).toBe(true);

    const cycling = ranked.find((entry) => entry.mode === 'cycling')!;
    expect(cycling.isParetoOptimal).toBe(true);

    const petrol = ranked.find((entry) => entry.mode === 'petrol-car')!;
    expect(petrol.isParetoOptimal).toBe(false);

    const eBus = ranked.find((entry) => entry.mode === 'electric-bus')!;
    expect(eBus.isParetoOptimal).toBe(false);
  });

  it('finds lowest exposure transit corridor over arterial road canyon via Dijkstra', () => {
    const sameNode = findLowestExposureCorridor('home-sector', 'home-sector', 150);
    expect(sameNode).toEqual({
      lowestExposurePath: ['home-sector'],
      lowestExposureUg: 0,
      lowestExposureMinutes: 0,
      directRoadPath: ['home-sector'],
      directRoadExposureUg: 0,
      exposureSavedUg: 0,
      exposureSavedPct: 0,
      segments: [],
    });

    const route = findLowestExposureCorridor('home-sector', 'civic-hub', 200);
    expect(route.lowestExposurePath).toEqual(['home-sector', 'metro-concourse', 'civic-hub']);
    expect(route.directRoadPath).toEqual([
      'home-sector',
      'arterial-junction',
      'ring-flyover',
      'civic-hub',
    ]);
    expect(route.lowestExposureMinutes).toBe(20);
    expect(route.lowestExposureUg).toBe(29.3);
    expect(route.directRoadExposureUg).toBe(96);
    expect(route.exposureSavedUg).toBe(66.7);
    expect(route.exposureSavedPct).toBe(69.5);
    expect(route.segments).toEqual([
      { from: 'home-sector', to: 'metro-concourse', distanceKm: 1.4, exposureUg: 14, minutes: 6 },
      { from: 'metro-concourse', to: 'civic-hub', distanceKm: 7.4, exposureUg: 15.3, minutes: 14 },
    ]);

    // Verify reverse graph symmetry (civic-hub back to home-sector)
    const reverseRoute = findLowestExposureCorridor('civic-hub', 'home-sector', 200);
    expect(reverseRoute.lowestExposurePath).toEqual([
      'civic-hub',
      'metro-concourse',
      'home-sector',
    ]);
    expect(reverseRoute.lowestExposureUg).toBe(29.3);
    // Mode-synced Dijkstra: surface/cycling modes must never route through enclosed metro tunnels
    const cyclingUnmasked = findLowestExposureCorridor('home-sector', 'civic-hub', 200, {
      commuteMode: 'cycling',
      mask: 'none',
      distanceKm: 10,
    });
    expect(cyclingUnmasked.lowestExposurePath).toEqual([
      'home-sector',
      'green-parkway',
      'civic-hub',
    ]);
    expect(cyclingUnmasked.lowestExposurePath).not.toContain('metro-concourse');

    const cyclingMasked = findLowestExposureCorridor('home-sector', 'civic-hub', 200, {
      commuteMode: 'cycling',
      mask: 'n95-ffp2',
      distanceKm: 10,
    });
    expect(cyclingMasked.lowestExposureUg).toBeLessThan(cyclingUnmasked.lowestExposureUg);

    const metroUnmasked = findLowestExposureCorridor('home-sector', 'civic-hub', 200, {
      commuteMode: 'metro',
      mask: 'none',
      distanceKm: 10,
    });
    expect(metroUnmasked.lowestExposurePath).toEqual([
      'home-sector',
      'metro-concourse',
      'civic-hub',
    ]);

    expect(() => findLowestExposureCorridor('home-sector', 'civic-hub', -10)).toThrow(
      /ambientPm25UgM3/,
    );
  });

  it('evaluates exact family sensitivity math, posture cutoffs, and RWA collective savings', () => {
    // 100 * 10 * 0.54 * 1.0 * (1 - 0) = 540.0 ug; 540 / 15 / 22 = 1.6 cigs
    const baselineCaregiver = evaluateFamilyMember(
      {
        id: 'm0',
        label: 'Caregiver',
        role: 'caregiver',
        mask: 'none',
        dailyOutdoorHours: 10,
      },
      100,
      100,
    );
    expect(baselineCaregiver.estimatedDailyInhaledUg).toBe(540);
    expect(baselineCaregiver.cigaretteEquiv).toBe(1.6);
    expect(baselineCaregiver.outdoorStatus).toBe('go');

    expect(
      evaluateFamilyMember(
        { id: 'c1', label: 'A', role: 'caregiver', mask: 'none', dailyOutdoorHours: 30 },
        10,
        101,
      ).estimatedDailyInhaledUg,
    ).toBe(129.6);
    expect(
      evaluateFamilyMember(
        { id: 'c2', label: 'B', role: 'caregiver', mask: 'none', dailyOutdoorHours: 1 },
        10,
        101,
      ).outdoorStatus,
    ).toBe('caution-masked');
    expect(
      evaluateFamilyMember(
        { id: 'c3', label: 'C', role: 'caregiver', mask: 'none', dailyOutdoorHours: 1 },
        10,
        200,
      ).outdoorStatus,
    ).toBe('limit-short');
    expect(
      evaluateFamilyMember(
        { id: 'c4', label: 'D', role: 'caregiver', mask: 'n95-ffp2', dailyOutdoorHours: 10 },
        100,
        300,
      ).outdoorStatus,
    ).toBe('stay-indoors');

    const maskedDose = evaluateFamilyMember(
      { id: 'c4', label: 'D', role: 'caregiver', mask: 'n95-ffp2', dailyOutdoorHours: 10 },
      100,
      300,
    );
    expect(maskedDose.estimatedDailyInhaledUg).toBe(54);

    expect(() =>
      evaluateFamilyMember(
        { id: 'bad1', label: 'X', role: 'child', mask: 'none', dailyOutdoorHours: -1 },
        50,
        50,
      ),
    ).toThrow(/dailyOutdoorHours/);
    expect(() =>
      evaluateFamilyMember(
        { id: 'bad2', label: 'X', role: 'child', mask: 'none', dailyOutdoorHours: 1 },
        -50,
        50,
      ),
    ).toThrow(/ambientPm25UgM3/);
    expect(() =>
      evaluateFamilyMember(
        { id: 'bad3', label: 'X', role: 'child', mask: 'none', dailyOutdoorHours: 1 },
        50,
        -50,
      ),
    ).toThrow(/effectiveCpcbNaqi/);

    const rwaWithLeafBan = simulateRwaCollectiveImpact({
      householdsParticipating: 100,
      avgCommuteDistanceKm: 10,
      transitShiftShare: 1.5, // Clamped cleanly to 1.0
      haltLeafBurning: true,
    });
    // CO2: (100 * 10 * 140 + 100 * 820) / 1000 = 222 kg/day; annual = 57,720 kg
    // PM2.5: (100 * 10 * 6.4) / 1000 + (100 * 14.5) = 6.4 + 1450 = 1456.4 g/day
    expect(rwaWithLeafBan.householdsParticipating).toBe(100);
    expect(rwaWithLeafBan.dailyCo2SavedKg).toBe(222);
    expect(rwaWithLeafBan.annualCo2SavedKg).toBe(57_720);
    expect(rwaWithLeafBan.dailyPm25AvoidedG).toBe(1_456.4);

    const rwaWithoutLeafBan = simulateRwaCollectiveImpact({
      householdsParticipating: 100,
      avgCommuteDistanceKm: 10,
      transitShiftShare: 0.5,
      haltLeafBurning: false,
    });
    expect(rwaWithoutLeafBan.dailyPm25AvoidedG).toBe(3.2);

    expect(() =>
      simulateRwaCollectiveImpact({
        householdsParticipating: -1,
        avgCommuteDistanceKm: 10,
        transitShiftShare: 0.5,
        haltLeafBurning: false,
      }),
    ).toThrow(/householdsParticipating/);
    expect(() =>
      simulateRwaCollectiveImpact({
        householdsParticipating: 10,
        avgCommuteDistanceKm: -1,
        transitShiftShare: 0.5,
        haltLeafBurning: false,
      }),
    ).toThrow(/avgCommuteDistanceKm/);
    expect(() =>
      simulateRwaCollectiveImpact({
        householdsParticipating: 10,
        avgCommuteDistanceKm: 10,
        transitShiftShare: -0.1,
        haltLeafBurning: false,
      }),
    ).toThrow(/transitShiftShare/);
  });

  it('property: better mask filtration never increases inhaled pulmonary PM2.5 dose', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0.5, max: 40, noNaN: true }),
        fc.double({ min: 5, max: 400, noNaN: true }),
        (distanceKm, pm25) => {
          const none = evaluateCommuteOption({
            mode: 'walking',
            mask: 'none',
            distanceKm,
            ambientPm25UgM3: pm25,
          });
          const cloth = evaluateCommuteOption({
            mode: 'walking',
            mask: 'cloth',
            distanceKm,
            ambientPm25UgM3: pm25,
          });
          const n95 = evaluateCommuteOption({
            mode: 'walking',
            mask: 'n95-ffp2',
            distanceKm,
            ambientPm25UgM3: pm25,
          });
          expect(n95.personalInhaledUg).toBeLessThanOrEqual(cloth.personalInhaledUg);
          expect(cloth.personalInhaledUg).toBeLessThanOrEqual(none.personalInhaledUg);
        },
      ),
    );
  });

  it('keeps user-entered From & To areas in Google Maps URLs without leaking GPS sub-localities', () => {
    expect(extractMetroCity('Shimultala, Kolkata')).toBe('Kolkata');
    expect(extractMetroCity('Garia, Greater Kolkata, India')).toBe('Kolkata');

    const transitUrl = buildClientGoogleMapsUrl({
      city: 'Shimultala, Kolkata',
      fromArea: 'Garia',
      toArea: 'Esplanade',
      greenWaypoint: 'Rabindra Sarobar Lake',
      commuteMode: 'metro',
    });
    expect(transitUrl).toContain('origin=Garia%2C%20Kolkata');
    expect(transitUrl).toContain('destination=Esplanade%2C%20Kolkata');
    expect(transitUrl).not.toContain('Shimultala');

    const carUrl = buildClientGoogleMapsUrl({
      city: 'Shimultala, Kolkata',
      fromArea: 'Salt Lake Sector V, Kolkata',
      toArea: 'Howrah Station, Howrah',
      greenWaypoint: 'Rabindra Sarobar Lake',
      commuteMode: 'ev-car',
    });
    expect(carUrl).toContain('origin=Salt%20Lake%20Sector%20V%2C%20Kolkata');
    expect(carUrl).toContain('destination=Howrah%20Station%2C%20Howrah');
    expect(carUrl).not.toContain('Shimultala');

    // Preserve exact user-entered destination & return per-segment direct arterial doses
    const kolkataDir = resolveDirectionalCorridor({
      city: 'Kolkata',
      fromArea: 'Garia',
      toArea: 'Park Street / BBD Bagh',
      commuteMode: 'electric-bus',
    });
    expect(kolkataDir?.nodes['home-sector']).toBe('Garia');
    expect(kolkataDir?.nodes['civic-hub']).toBe('Park Street / BBD Bagh');
    expect(kolkataDir?.intermediateMetroStops).not.toContain('Park Street Metro');

    const busRoute = findLowestExposureCorridor('home-sector', 'civic-hub', 100, {
      commuteMode: 'electric-bus',
      mask: 'n95-ffp2',
      distanceKm: 12,
    });
    expect(busRoute.directSegments).toHaveLength(3);
  });
});
