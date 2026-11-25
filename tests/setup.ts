import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// Provide a silent null-returning canvas context stub so jsdom/axe-core and WebGL fallback tests
// exercise graceful degradation without printing "Not implemented: HTMLCanvasElement.prototype.getContext".
if (typeof HTMLCanvasElement !== 'undefined') {
  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
    configurable: true,
    writable: true,
    value: () => null,
  });
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
