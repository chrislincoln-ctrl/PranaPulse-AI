/**
 * Complete EN / HI / TA localization dictionary aggregator for PranaPulse AI.
 * All three locales share the exact same strict TypeScript interface.
 */

import type { SupportedLanguage } from '../validators/schemas.js';
import { EN_TRANSLATIONS } from './en.js';
import { HI_TRANSLATIONS } from './hi.js';
import { TA_TRANSLATIONS } from './ta.js';
import type { LocaleDictionary } from './types.js';

export type { LocaleDictionary } from './types.js';

export const TRANSLATIONS: Record<SupportedLanguage, LocaleDictionary> = {
  en: EN_TRANSLATIONS,
  hi: HI_TRANSLATIONS,
  ta: TA_TRANSLATIONS,
};
