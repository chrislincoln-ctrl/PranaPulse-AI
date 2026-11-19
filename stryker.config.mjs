/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
export default {
  packageManager: 'npm',
  reporters: ['progress', 'clear-text', 'html'],
  testRunner: 'vitest',
  mutate: [
    'src/domain/**/*.ts',
    '!src/domain/fallbackPlanBuilder.ts',
    '!src/domain/localBaseline.ts',
    '!src/domain/types.ts',
  ],
  coverageAnalysis: 'perTest',
  vitest: {
    configFile: 'vitest.mutation.config.ts',
  },
  thresholds: {
    high: 90,
    low: 80,
    break: 75,
  },
  tempDirName: '.stryker-tmp',
};
