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
      className="btn-secondary touch-target inline-flex items-center justify-center gap-2 px-2 text-xs sm:px-3.5 sm:text-sm"
    >
      {isDark ? (
        <Sun className="h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
      ) : (
        <Moon className="h-4 w-4 shrink-0 text-cool" aria-hidden="true" />
      )}
      <span className="hidden sm:inline">{nextLabel}</span>
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
    <div className="flex items-center gap-1.5 sm:gap-2">
      <label htmlFor="language-select" className="sr-only text-xs text-muted sm:not-sr-only">
        {t.languageLabel}
      </label>
      <select
        id="language-select"
        value={language}
        onChange={(e) => {
          onChangeLanguage(e.target.value as SupportedLanguage);
        }}
        className="field-control w-auto max-w-[74px] px-1.5 text-[11px] sm:max-w-none sm:px-3 sm:text-sm"
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
  returnSuffix,
}: {
  readonly onReturnLanding: () => void;
  readonly returnSuffix: string;
}): ReactElement {
  return (
    <button
      type="button"
      onClick={onReturnLanding}
      className="touch-target group flex min-w-0 shrink items-center gap-1 text-left transition-opacity hover:opacity-85 focus:outline-hidden sm:shrink-0 sm:gap-3"
      aria-label={`${APP_META.DISPLAY_NAME} - ${returnSuffix}`}
    >
      <Wind
        className="h-4 w-4 shrink-0 text-cool transition-transform group-hover:scale-105 sm:h-6 sm:w-6"
        aria-hidden="true"
      />
      <span className="truncate text-xs font-semibold tracking-tight whitespace-nowrap text-ink sm:text-lg">
        {APP_META.DISPLAY_NAME}
      </span>
    </button>
  );
}

/**
 * Top workbench header bar containing brand mark, AI engine status, theme toggle,
 * language selector, and Supabase Sign In / Account modal trigger.
 */
export const AppHeaderBar = memo(function AppHeaderBar(props: AppHeaderBarProps): ReactElement {
  return (
    <header className="sticky top-0 z-[300] border-b border-rule/80 bg-paper-3/95 shadow-sm backdrop-blur-lg">
      <div className="container flex items-center justify-between gap-1 px-2.5 py-2 sm:gap-4 sm:px-6 sm:py-3">
        <BrandLogoButton
          onReturnLanding={() => {
            props.onToggleViewMode('landing');
          }}
          returnSuffix={props.t.ui.returnToLandingSuffix}
        />
        <div className="flex shrink-0 items-center gap-1 sm:gap-3">
          <span className="status-pill hidden text-ink-2 lg:inline-flex">
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
            t={props.t}
          />
        </div>
      </div>
    </header>
  );
});
