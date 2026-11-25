import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  calculatePurgeMinutes,
  calculateRequiredCadr,
  calculateRoomVolume,
  simulateIndoor24h,
} from '../../src/domain/indoorMassBalance.js';
import {
  analyzeInversionSchedule,
  classifyInversionSeverity,
  computeVentilationCoefficient,
} from '../../src/domain/inversionModel.js';
import type { HourlyAtmosPoint } from '../../src/domain/types.js';

function makeWinterDaySeries(): HourlyAtmosPoint[] {
  return Array.from({ length: 24 }, (_, hour) => {
    const isMiddayBreakup = hour >= 12 && hour <= 15;
    const isMorningPeak = hour >= 7 && hour <= 9;
    let pm = 200;
    if (isMiddayBreakup) {
      pm = 75 - hour * 0.5;
    } else if (isMorningPeak) {
      pm = 290 + hour;
    }
    return {
      hourIso: `2026-11-18T${String(hour).padStart(2, '0')}:00`,
      hourOfDay: hour,
      pm25UgM3: pm,
      pblMeters: isMiddayBreakup ? 1_250 : 210,
      windKmh: isMiddayBreakup ? 18 : 3,
      rhPercent: isMiddayBreakup ? 74 : 75,
    };
  });
}

describe('inversionModel and indoorMassBalance engines', () => {
  it('computes ventilation coefficient and validates non-negative inputs', () => {
    expect(computeVentilationCoefficient(360, 3.6)).toBe(360);
    expect(() => computeVentilationCoefficient(-1, 5)).toThrow(/pblMeters/);
    expect(() => computeVentilationCoefficient(100, -1)).toThrow(/windKmh/);
  });

  it('classifies exact boundary cutoffs for inversion severity tiers', () => {
    expect(classifyInversionSeverity(250, 36)).toBe('severe-inversion');
    expect(classifyInversionSeverity(251, 36)).toBe('moderate-trapping');
    expect(classifyInversionSeverity(500, 10.7)).toBe('severe-inversion');
    expect(classifyInversionSeverity(500, 10.8)).toBe('moderate-trapping');
    expect(classifyInversionSeverity(400, 36)).toBe('moderate-trapping');
    expect(classifyInversionSeverity(401, 36)).toBe('neutral');
    expect(classifyInversionSeverity(500, 23)).toBe('moderate-trapping');
    expect(classifyInversionSeverity(500, 23.1)).toBe('neutral');
  });

  it('analyzes 24h boundary layer windows, humidity threshold, and open-window states', () => {
    const series = makeWinterDaySeries();
    const nightResult = analyzeInversionSchedule(series, 7);

    expect(nightResult.currentSeverity).toBe('severe-inversion');
    expect(nightResult.currentPblMeters).toBe(210);
    expect(nightResult.currentVentilationM2S).toBe(175);
    expect(nightResult.hygroscopicHazeRisk).toBe(true);
    expect(nightResult.openWindowsNow).toBe(false);
    expect(nightResult.bestWindowHours).toEqual([13, 14, 15]);
    expect(nightResult.avoidOutdoorHours).toEqual([7, 8, 9]);
    expect(nightResult.hourly[12]?.isSafeWindowHour).toBe(true);
    expect(nightResult.hourly[7]?.severity).toBe('severe-inversion');

    // Hour 12 is not in top-3 bestWindowHours [13,14,15] and has 1250m PBL + 18 km/h = 6250 >= 6000 VC
    const hour12Breakup = analyzeInversionSchedule(series, 12);
    expect(hour12Breakup.currentSeverity).toBe('neutral');
    expect(hour12Breakup.currentVentilationM2S).toBe(6_250);
    expect(hour12Breakup.hygroscopicHazeRisk).toBe(false);
    expect(hour12Breakup.openWindowsNow).toBe(true);

    // Clamped index edges and neutral low-VC closed-window case
    const lowVcNeutralSeries = series.map((pt, idx) =>
      idx === 12 ? { ...pt, windKmh: 12, pblMeters: 1_200 } : pt,
    );
    const closedNeutral = analyzeInversionSchedule(lowVcNeutralSeries, 12);
    expect(closedNeutral.currentVentilationM2S).toBe(4_000);
    expect(closedNeutral.openWindowsNow).toBe(false);

    expect(analyzeInversionSchedule(series, 99).currentPblMeters).toBe(210);
    expect(() => analyzeInversionSchedule([])).toThrow(/Hourly atmospheric series cannot be empty/);
  });

  it('calculates room volume, required CADR, purge minutes, and validates positive bounds', () => {
    const vol = calculateRoomVolume(20, 3);
    expect(vol).toBe(60);
    expect(calculateRequiredCadr(60)).toBe(288);
    expect(calculateRequiredCadr(60, 5)).toBe(300);
    expect(calculatePurgeMinutes(60, 380)).toBe(22);

    expect(() => calculateRoomVolume(0)).toThrow(/areaM2 must be a positive finite number/);
    expect(() => calculateRoomVolume(20, 0)).toThrow(/ceilingHeightM must be a positive/);
    expect(() => calculateRequiredCadr(-10)).toThrow(/roomVolumeM3/);
    expect(() => calculateRequiredCadr(40, 0)).toThrow(/targetAch/);
    expect(() => calculatePurgeMinutes(0, 200)).toThrow(/roomVolumeM3/);
    expect(() => calculatePurgeMinutes(40, 0)).toThrow(/cadrM3Hr/);
    expect(() => calculatePurgeMinutes(40, 200, 1)).toThrow(/targetEfficiency must lie strictly/);
    expect(() => calculatePurgeMinutes(40, 200, 0)).toThrow(/targetEfficiency must lie strictly/);
    expect(() =>
      simulateIndoor24h({
        roomAreaM2: 20,
        cadrM3Hr: 300,
        tightness: 'standard',
        cookingFuel: 'induction',
        openWindowHours: [13],
        hourlyOutdoorPm25: [],
      }),
    ).toThrow(/hourlyOutdoorPm25 cannot be empty/);
  });

  it('simulates 24h indoor mass balance reduction, window-open vs sealed, and anti-myth warnings', () => {
    const outdoor = makeWinterDaySeries().map((pt) => pt.pm25UgM3);
    const mitigated = simulateIndoor24h({
      roomAreaM2: 22,
      cadrM3Hr: 380,
      tightness: 'weather-sealed',
      cookingFuel: 'solid-biomass',
      openWindowHours: [13, 14],
      hourlyOutdoorPm25: outdoor,
    });

    expect(mitigated.roomVolumeM3).toBe(63.8);
    expect(mitigated.requiredCadr48Ach).toBe(306);
    expect(mitigated.achievedAch).toBe(6);
    expect(mitigated.purge90Minutes).toBe(23);
    expect(mitigated.hourly).toHaveLength(24);
    expect(mitigated.dailyMeanOutdoorPm25).toBeGreaterThan(150);
    expect(mitigated.dailyMeanBaselinePm25).toBeCloseTo(131.3, 1);
    expect(mitigated.dailyMeanMitigatedPm25).toBeLessThan(25);
    expect(mitigated.exposureReductionPct).toBeGreaterThan(80);
    expect(mitigated.mythAlerts.some((msg) => msg.includes('ozone'))).toBe(true);
    expect(mitigated.mythAlerts.some((msg) => msg.includes('Houseplants'))).toBe(true);

    // Opening windows during polluted peak without CADR increases indoor PM2.5 vs keeping sealed
    const unsealedWindows = simulateIndoor24h({
      roomAreaM2: 22,
      cadrM3Hr: 0,
      tightness: 'weather-sealed',
      cookingFuel: 'induction',
      openWindowHours: [7, 8],
      hourlyOutdoorPm25: outdoor,
    });
    const sealedWindows = simulateIndoor24h({
      roomAreaM2: 22,
      cadrM3Hr: 0,
      tightness: 'weather-sealed',
      cookingFuel: 'induction',
      openWindowHours: [],
      hourlyOutdoorPm25: outdoor,
    });
    const unsealedHour = unsealedWindows.hourly[8];
    const sealedHour = sealedWindows.hourly[8];
    expect(unsealedHour).toBeDefined();
    expect(sealedHour).toBeDefined();
    expect(unsealedHour?.indoorMitigatedPm25 ?? 0).toBeGreaterThan(
      sealedHour?.indoorMitigatedPm25 ?? Number.POSITIVE_INFINITY,
    );

    const zeroOutdoor = simulateIndoor24h({
      roomAreaM2: 18,
      cadrM3Hr: 250,
      tightness: 'standard',
      cookingFuel: 'induction',
      openWindowHours: [],
      hourlyOutdoorPm25: [0, 0, 0, 0],
    });
    expect(zeroOutdoor.dailyMeanOutdoorPm25).toBe(0);
    expect(zeroOutdoor.exposureReductionPct).toBe(0);
  });

  it('property: higher CADR strictly reduces or preserves 90% purge duration', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 15, max: 120, noNaN: true }),
        fc.double({ min: 100, max: 400, noNaN: true }),
        fc.double({ min: 401, max: 900, noNaN: true }),
        (volume, lowCadr, highCadr) => {
          const slowMinutes = calculatePurgeMinutes(volume, lowCadr);
          const fastMinutes = calculatePurgeMinutes(volume, highCadr);
          expect(fastMinutes).toBeLessThanOrEqual(slowMinutes);
        },
      ),
    );
  });
});
