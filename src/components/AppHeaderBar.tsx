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
  readonly viewMode: 'landing' | 'workbench';
  readonly onToggleViewMode: (mode: 'landing' | 'workbench') => void;
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

function BrandLogoButton({
  onReturnLanding,
}: {
  readonly onReturnLanding: () => void;
}): ReactElement {
  return (
    <button
      type="button"
      onClick={onReturnLanding}
      className="group flex cursor-pointer items-center gap-2.5 text-left transition-opacity hover:opacity-85 focus:outline-hidden sm:gap-3"
      aria-label={`${APP_META.DISPLAY_NAME} - Return to landing page`}
    >
      <Wind
        className="h-6 w-6 shrink-0 text-cool transition-transform group-hover:scale-105"
        aria-hidden="true"
      />
      <span className="text-base font-semibold text-ink sm:text-lg">{APP_META.DISPLAY_NAME}</span>
    </button>
  );
}

/**
 * Top workbench header bar containing brand mark, AI engine status, theme toggle,
 * language selector, and Supabase Sign In / Account modal trigger.
 */
export const AppHeaderBar = memo(function AppHeaderBar(props: AppHeaderBarProps): ReactElement {
  return (
    <header className="sticky top-0 z-[20] border-b border-rule/80 bg-paper-3/85 backdrop-blur-md">
      <div className="container flex flex-wrap items-center justify-between gap-2.5 py-2.5 sm:gap-4 sm:py-3">
        <BrandLogoButton
          onReturnLanding={() => {
            props.onToggleViewMode('landing');
          }}
        />
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
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
