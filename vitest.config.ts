import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    testTimeout: 15_000,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.{ts,tsx}'],
    exclude: ['tests/e2e/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'lcov'],
      include: ['src/**/*.{ts,tsx}', 'server/**/*.ts', 'api/**/*.ts'],
      exclude: ['src/main.tsx', 'server/index.ts', '**/*.d.ts'],
      thresholds: {
        lines: 95,
        statements: 95,
        functions: 88,
        branches: 85,
      },
    },
  },
});
