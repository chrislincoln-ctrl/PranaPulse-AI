import type { User } from '@supabase/supabase-js';
import { Moon, ShieldCheck, Sun, Wind } from 'lucide-react';
import { memo, type ReactElement } from 'react';
import { APP_META } from '../config/constants.js';
import { SUPPORTED_LANGUAGES } from '../config/uiConstants.js';
import type { LocaleDictionary } from '../i18n/translations.js';
import type { SupportedLanguage } from '../validators/schemas.js';
import { HeaderAuthButton } from './HeaderAuthButton.js';

export type ThemeMode = 'light' | 'dark';

export interface AppHeaderBarProps {
  readonly language: SupportedLanguage;
  readonly themeMode: ThemeMode;
  readonly liveGeminiConfigured: boolean;
  readonly authUser: User | null;
  readonly authInitializing: boolean;
  readonly onChangeLanguage: (lang: SupportedLanguage) => void;
  readonly onToggleTheme: () => void;
  readonly onOpenAuthModal: () => void;
  readonly t: LocaleDictionary;
}

function ThemeToggleButton({
  themeMode,
  onToggleTheme,
  t,
}: {
  readonly themeMode: ThemeMode;
  readonly onToggleTheme: () => void;
  readonly t: LocaleDictionary;
}): ReactElement {
  const isDark = themeMode === 'dark';
  const nextLabel = isDark ? t.themeLightLabel : t.themeDarkLabel;
  return (
    <button
      type="button"
      onClick={onToggleTheme}
      aria-pressed={isDark}
      aria-label={nextLabel}
      className="btn-secondary touch-target inline-flex items-center gap-2 text-sm"
    >
      {isDark ? (
        <Sun className="h-4 w-4 text-accent" aria-hidden="true" />
      ) : (
        <Moon className="h-4 w-4 text-cool" aria-hidden="true" />
      )}
      <span>{nextLabel}</span>
    </button>
  );
}

function LanguageSelectControl({
  language,
  onChangeLanguage,
  t,
}: {
  readonly language: SupportedLanguage;
  readonly onChangeLanguage: (lang: SupportedLanguage) => void;
  readonly t: LocaleDictionary;
}): ReactElement {
  return (
    <div className="flex items-center gap-2">
      <label htmlFor="language-select" className="text-xs text-muted">
        {t.languageLabel}
      </label>
      <select
        id="language-select"
        value={language}
        onChange={(e) => {
          onChangeLanguage(e.target.value as SupportedLanguage);
        }}
        className="field-control w-auto text-sm"
      >
        {SUPPORTED_LANGUAGES.map((code) => (
          <option key={code} value={code}>
            {t.languageNames[code]}
          </option>
        ))}
      </select>
    </div>
  );
}

/**
 * Top workbench header bar containing brand mark, AI engine status, theme toggle,
 * language selector, and Supabase Sign In / Account modal trigger.
 */
export const AppHeaderBar = memo(function AppHeaderBar(props: AppHeaderBarProps): ReactElement {
  return (
    <header className="border-b border-rule bg-paper-3">
      <div className="container flex flex-wrap items-center justify-between gap-4 py-3">
        <div className="flex items-center gap-3">
          <Wind className="h-6 w-6 text-cool" aria-hidden="true" />
          <span className="text-lg font-semibold text-ink">{APP_META.DISPLAY_NAME}</span>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="status-pill text-ink-2">
            <ShieldCheck className="h-4 w-4 text-ok" aria-hidden="true" />
            <span>
              {props.liveGeminiConfigured
                ? props.t.statusLiveGemini
                : props.t.statusDeterministicMode}
            </span>
          </span>
          <ThemeToggleButton
            themeMode={props.themeMode}
            onToggleTheme={props.onToggleTheme}
            t={props.t}
          />
          <LanguageSelectControl
            language={props.language}
            onChangeLanguage={props.onChangeLanguage}
            t={props.t}
          />
          <HeaderAuthButton
            user={props.authUser}
            isInitializing={props.authInitializing}
            onOpenModal={props.onOpenAuthModal}
          />
        </div>
      </div>
    </header>
  );
});

