import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { CPCB_BREAKPOINTS, US_EPA_PM_BREAKPOINTS } from '../../src/config/physicsConstants.js';
import {
  assertFiniteNonNegative,
  classifyCpcbCategory,
  classifyUsEpaCategory,
  evaluatePollutantStandards,
  evaluateStationCrossCheck,
  interpolateBreakpoint,
} from '../../src/domain/aqiStandards.js';

describe('aqiStandards domain physics & property invariants', () => {
  it('validates finite non-negative bounds with contextual RangeError diagnostics', () => {
    expect(assertFiniteNonNegative(0, 'pm25')).toBe(0);
    expect(assertFiniteNonNegative(42.5, 'pm25')).toBe(42.5);
    expect(() => assertFiniteNonNegative(-0.1, 'pm25')).toThrow(
      /pm25 must be a finite non-negative number/,
    );
    expect(() => assertFiniteNonNegative(Number.NaN, 'naqi')).toThrow(
      /naqi must be a finite non-negative number/,
    );
    expect(() => assertFiniteNonNegative(Number.POSITIVE_INFINITY, 'aqi')).toThrow(
      /aqi must be a finite non-negative number/,
    );
    expect(() => interpolateBreakpoint(10, [])).toThrow(/Breakpoint table cannot be empty/);
    expect(() => interpolateBreakpoint(-1, CPCB_BREAKPOINTS.pm25)).toThrow(/concentration/);
    expect(() => classifyCpcbCategory(-1)).toThrow(/naqi/);
    expect(() => classifyUsEpaCategory(-1)).toThrow(/aqi/);
    expect(() => evaluateStationCrossCheck(-1, 50)).toThrow(/modelAqi/);
  });

  it('interpolates India CPCB NAQI and US-EPA 2024 breakpoints accurately across all tiers', () => {
    expect(interpolateBreakpoint(0, CPCB_BREAKPOINTS.pm25)).toBe(0);
    expect(interpolateBreakpoint(15, CPCB_BREAKPOINTS.pm25)).toBe(25);
    expect(interpolateBreakpoint(30, CPCB_BREAKPOINTS.pm25)).toBe(50);
    expect(interpolateBreakpoint(60, CPCB_BREAKPOINTS.pm25)).toBe(100);
    expect(interpolateBreakpoint(90, CPCB_BREAKPOINTS.pm25)).toBe(200);
    expect(interpolateBreakpoint(120, CPCB_BREAKPOINTS.pm25)).toBe(300);
    expect(interpolateBreakpoint(250, CPCB_BREAKPOINTS.pm25)).toBe(400);
    expect(interpolateBreakpoint(900, CPCB_BREAKPOINTS.pm25)).toBe(500);
    expect(interpolateBreakpoint(5, [{ cLow: 5, cHigh: 5, iLow: 50, iHigh: 50 }])).toBe(50);

    expect(interpolateBreakpoint(9, US_EPA_PM_BREAKPOINTS.pm25)).toBe(50);
    expect(interpolateBreakpoint(35.4, US_EPA_PM_BREAKPOINTS.pm25)).toBe(100);
    expect(interpolateBreakpoint(500.4, US_EPA_PM_BREAKPOINTS.pm25)).toBe(500);
    expect(interpolateBreakpoint(999, US_EPA_PM_BREAKPOINTS.pm10)).toBe(500);
  });

  it('classifies every CPCB and US-EPA boundary tier consistently', () => {
    expect(classifyCpcbCategory(0)).toBe('good');
    expect(classifyCpcbCategory(50)).toBe('good');
    expect(classifyCpcbCategory(51)).toBe('satisfactory');
    expect(classifyCpcbCategory(100)).toBe('satisfactory');
    expect(classifyCpcbCategory(101)).toBe('moderate');
    expect(classifyCpcbCategory(200)).toBe('moderate');
    expect(classifyCpcbCategory(201)).toBe('poor');
    expect(classifyCpcbCategory(300)).toBe('poor');
    expect(classifyCpcbCategory(301)).toBe('very-poor');
    expect(classifyCpcbCategory(400)).toBe('very-poor');
    expect(classifyCpcbCategory(401)).toBe('severe');

    expect(classifyUsEpaCategory(50)).toBe('good');
    expect(classifyUsEpaCategory(100)).toBe('moderate');
    expect(classifyUsEpaCategory(150)).toBe('usg');
    expect(classifyUsEpaCategory(200)).toBe('unhealthy');
    expect(classifyUsEpaCategory(300)).toBe('very-unhealthy');
    expect(classifyUsEpaCategory(301)).toBe('hazardous');
  });

  it('identifies each CPCB dominant pollutant cleanly and preserves zero-tie preference', () => {
    const baseZero = evaluatePollutantStandards({
      pm25UgM3: 0,
      pm10UgM3: 0,
      no2UgM3: 0,
      o3UgM3: 0,
      so2UgM3: 0,
      coUgM3: 0,
    });
    expect(baseZero.cpcbNaqi).toBe(0);
    expect(baseZero.dominantCpcbPollutant).toBe('pm25');

    const winterSmog = evaluatePollutantStandards({
      pm25UgM3: 110,
      pm10UgM3: 180,
      no2UgM3: 65,
      o3UgM3: 40,
      so2UgM3: 25,
      coUgM3: 1_500,
    });
    expect(winterSmog.dominantCpcbPollutant).toBe('pm25');
    expect(winterSmog.cpcbCategory).toBe('poor');
    expect(winterSmog.cpcbNaqi).toBe(267);
    expect(winterSmog.usEpaAqi).toBe(189);
    expect(winterSmog.usEpaCategory).toBe('unhealthy');
    expect(winterSmog.whoAnnualMultiple).toBe(22);
    expect(winterSmog.who24hMultiple).toBe(7.3);
    expect(winterSmog.cigaretteEquivPerDay).toBe(5);

    expect(
      evaluatePollutantStandards({
        pm25UgM3: 5,
        pm10UgM3: 300,
        no2UgM3: 10,
        o3UgM3: 10,
        so2UgM3: 10,
        coUgM3: 200,
      }).dominantCpcbPollutant,
    ).toBe('pm10');
    expect(
      evaluatePollutantStandards({
        pm25UgM3: 5,
        pm10UgM3: 10,
        no2UgM3: 280,
        o3UgM3: 10,
        so2UgM3: 10,
        coUgM3: 200,
      }).dominantCpcbPollutant,
    ).toBe('no2');
    expect(
      evaluatePollutantStandards({
        pm25UgM3: 5,
        pm10UgM3: 10,
        no2UgM3: 10,
        o3UgM3: 208,
        so2UgM3: 10,
        coUgM3: 200,
      }).dominantCpcbPollutant,
    ).toBe('o3');
    expect(
      evaluatePollutantStandards({
        pm25UgM3: 5,
        pm10UgM3: 10,
        no2UgM3: 10,
        o3UgM3: 10,
        so2UgM3: 800,
        coUgM3: 200,
      }).dominantCpcbPollutant,
    ).toBe('so2');
    expect(
      evaluatePollutantStandards({
        pm25UgM3: 5,
        pm10UgM3: 10,
        no2UgM3: 10,
        o3UgM3: 10,
        so2UgM3: 10,
        coUgM3: 17_000,
      }).dominantCpcbPollutant,
    ).toBe('co');
  });

  it('rejects negative/NaN station fields cleanly and enforces >50 AQI delta threshold', () => {
    expect(() =>
      evaluatePollutantStandards({
        pm25UgM3: -1,
        pm10UgM3: 10,
        no2UgM3: 10,
        o3UgM3: 10,
        so2UgM3: 10,
        coUgM3: 10,
      }),
    ).toThrow(/pm25UgM3/);
    expect(() =>
      evaluatePollutantStandards({
        pm25UgM3: 10,
        pm10UgM3: -1,
        no2UgM3: 10,
        o3UgM3: 10,
        so2UgM3: 10,
        coUgM3: 10,
      }),
    ).toThrow(/pm10UgM3/);
    expect(() =>
      evaluatePollutantStandards({
        pm25UgM3: 10,
        pm10UgM3: 10,
        no2UgM3: -1,
        o3UgM3: 10,
        so2UgM3: 10,
        coUgM3: 10,
      }),
    ).toThrow(/no2UgM3/);
    expect(() =>
      evaluatePollutantStandards({
        pm25UgM3: 10,
        pm10UgM3: 10,
        no2UgM3: 10,
        o3UgM3: -1,
        so2UgM3: 10,
        coUgM3: 10,
      }),
    ).toThrow(/o3UgM3/);
    expect(() =>
      evaluatePollutantStandards({
        pm25UgM3: 10,
        pm10UgM3: 10,
        no2UgM3: 10,
        o3UgM3: 10,
        so2UgM3: -1,
        coUgM3: 10,
      }),
    ).toThrow(/so2UgM3/);
    expect(() =>
      evaluatePollutantStandards({
        pm25UgM3: 10,
        pm10UgM3: 10,
        no2UgM3: 10,
        o3UgM3: 10,
        so2UgM3: 10,
        coUgM3: -1,
      }),
    ).toThrow(/coUgM3/);

    expect(evaluateStationCrossCheck(154, null).stationAvailable).toBe(false);
    expect(evaluateStationCrossCheck(154, -5).stationAvailable).toBe(false);
    expect(evaluateStationCrossCheck(154, Number.NaN).stationAvailable).toBe(false);

    const zeroStation = evaluateStationCrossCheck(10, 0);
    expect(zeroStation.stationAvailable).toBe(true);
    expect(zeroStation.stationAqi).toBe(0);
    expect(zeroStation.effectiveSafetyAqi).toBe(10);

    const exactBoundary = evaluateStationCrossCheck(150, 200);
    expect(exactBoundary.deltaAqi).toBe(50);
    expect(exactBoundary.disagreementDetected).toBe(false);
    expect(exactBoundary.effectiveSafetyAqi).toBe(200);

    const delhiDisagreement = evaluateStationCrossCheck(154, 248);
    expect(delhiDisagreement).toEqual({
      stationAvailable: true,
      modelAqi: 154,
      stationAqi: 248,
      deltaAqi: 94,
      disagreementDetected: true,
      effectiveSafetyAqi: 248,
    });
  });

  it('property: CPCB PM2.5 interpolation is monotonic and bounded within [0, 500]', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 1500, noNaN: true }),
        fc.double({ min: 0, max: 1500, noNaN: true }),
        (a, b) => {
          const low = Math.min(a, b);
          const high = Math.max(a, b);
          const subLow = interpolateBreakpoint(low, CPCB_BREAKPOINTS.pm25);
          const subHigh = interpolateBreakpoint(high, CPCB_BREAKPOINTS.pm25);
          expect(subLow).toBeGreaterThanOrEqual(0);
          expect(subHigh).toBeLessThanOrEqual(500);
          expect(subHigh).toBeGreaterThanOrEqual(subLow);
        },
      ),
    );
  });
});
