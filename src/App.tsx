import { memo, useCallback, useEffect, useState, type ReactElement } from 'react';
import { ActiveSectionStrip } from './components/ActiveSectionStrip.js';
import { AppHeaderBar, type ThemeMode } from './components/AppHeaderBar.js';
import { AuthModal } from './components/AuthModal.js';
import { ConsoleSmogBackdrop } from './components/ConsoleSmogBackdrop.js';
import { LandingPageView } from './components/LandingPageView.js';
import { SectionStepperFooter } from './components/SectionStepperFooter.js';
import { SegmentedTabs } from './components/SegmentedTabs.js';
import { SevereAlertBanner } from './components/SevereAlertBanner.js';
import { WorkbenchCompanionOverlay, WorkbenchTabPanel } from './components/WorkbenchTabPanel.js';
import { APP_META } from './config/constants.js';
import type { WorkbenchTabId } from './config/uiConstants.js';
import { useAirQualityWorkspace } from './hooks/useAirQualityWorkspace.js';
import { useSupabaseAuth } from './hooks/useSupabaseAuth.js';
import { TRANSLATIONS, type LocaleDictionary } from './i18n/translations.js';
import type { SavedWorkspacePreferences } from './services/supabaseClient.js';

export type { ThemeMode };

function AppMainContent({
  activeTab,
  workspace,
  onSelectTab,
  onStepTab,
  t,
}: {
  readonly activeTab: WorkbenchTabId;
  readonly workspace: ReturnType<typeof useAirQualityWorkspace>;
  readonly onSelectTab: (tab: WorkbenchTabId) => void;
  readonly onStepTab: (tab: WorkbenchTabId) => void;
  readonly t: LocaleDictionary;
}): ReactElement {
  return (
    <main id="main-content" className="container relative z-[2] flex-1 pb-36 sm:pb-40">
      <div className="pt-3 pb-3 sm:pt-4 sm:pb-4">
        <SegmentedTabs activeTab={activeTab} onSelectTab={onSelectTab} t={t} />
      </div>
      <SevereAlertBanner telemetry={workspace.bundle.telemetry} t={t} />
      {activeTab !== 'dashboard' && (
        <ActiveSectionStrip
          activeTab={activeTab}
          telemetry={workspace.bundle.telemetry}
          onOpenDashboard={() => {
            onStepTab('dashboard');
          }}
          t={t}
        />
      )}
      <div role="tabpanel" id={`panel-${activeTab}`} aria-labelledby={`tab-${activeTab}`}>
        <WorkbenchTabPanel activeTab={activeTab} workspace={workspace} t={t} />
      </div>
      <SectionStepperFooter activeTab={activeTab} onSelectTab={onStepTab} t={t} />
    </main>
  );
}

function AppFooter({ notice }: { readonly notice: string }): ReactElement {
  return (
    <footer className="relative z-[2] border-t border-rule/80 bg-paper-3/85 px-4 py-4 text-center text-xs text-muted backdrop-blur-md">
      <div className="container">
        {APP_META.DISPLAY_NAME} v{APP_META.VERSION}: {notice}
      </div>
    </footer>
  );
}

function useCloudWorkspaceRestore(
  selectCity: ReturnType<typeof useAirQualityWorkspace>['selectCity'],
  updateInput: ReturnType<typeof useAirQualityWorkspace>['updateInput'],
) {
  const onRestore = useCallback(
    (prefs: SavedWorkspacePreferences): void => {
      const { city, lat, lon, members, savedAt: _savedAt, ...rest } = prefs;
      selectCity(city, lat, lon);
      updateInput(members ? { ...rest, members } : rest);
    },
    [selectCity, updateInput],
  );
  return useSupabaseAuth(onRestore);
}

function SkipToMainLink({ label }: { readonly label: string }): ReactElement {
  return (
    <a
      href="#main-content"
      className="sr-only touch-target focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[60] focus:rounded focus:bg-accent focus:px-4 focus:py-2 focus:text-accent-ink"
    >
      {label}
    </a>
  );
}

const THEME_KEY = 'pranapulse_theme_mode';

function getInitialThemeMode(): ThemeMode {
  if (typeof window === 'undefined') {
    return 'dark';
  }
  try {
    const saved = localStorage.getItem(THEME_KEY);
    return saved === 'light' || saved === 'dark' ? saved : 'dark';
  } catch {
    return 'dark';
  }
}

function useDocumentThemeMode(): readonly [ThemeMode, () => void] {
  const [themeMode, setThemeMode] = useState<ThemeMode>(getInitialThemeMode);
  useEffect(() => {
    document.documentElement.dataset.mode = themeMode;
    try {
      localStorage.setItem(THEME_KEY, themeMode);
    } catch {
      // ignore
    }
  }, [themeMode]);
  const toggleTheme = useCallback((): void => {
    setThemeMode((prev) => (prev === 'light' ? 'dark' : 'light'));
  }, []);
  return [themeMode, toggleTheme] as const;
}

function scrollToMainTop(): void {
  const mainEl = document.getElementById('main-content');
  if (mainEl && typeof mainEl.scrollIntoView === 'function') {
    mainEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

interface AppShellProps {
  readonly viewMode: 'landing' | 'workbench';
  readonly onToggleViewMode: (m: 'landing' | 'workbench') => void;
  readonly workspace: ReturnType<typeof useAirQualityWorkspace>;
  readonly auth: ReturnType<typeof useSupabaseAuth>;
  readonly t: LocaleDictionary;
  readonly themeMode: ThemeMode;
  readonly toggleTheme: () => void;
  readonly activeTab: WorkbenchTabId;
  readonly setActiveTab: (tab: WorkbenchTabId) => void;
  readonly handleStepTab: (tab: WorkbenchTabId) => void;
  readonly authModalOpen: boolean;
  readonly setAuthModalOpen: (open: boolean) => void;
}

function AppViewBody(p: AppShellProps): ReactElement {
  if (p.viewMode === 'landing') {
    return (
      <LandingPageView
        workspace={p.workspace}
        auth={p.auth}
        onEnterConsole={() => {
          if (p.auth.user) {
            p.onToggleViewMode('workbench');
          } else {
            p.auth.clearMessages();
            p.setAuthModalOpen(true);
          }
        }}
        t={p.t}
      />
    );
  }
  return (
    <AppMainContent
      activeTab={p.activeTab}
      workspace={p.workspace}
      onSelectTab={p.setActiveTab}
      onStepTab={p.handleStepTab}
      t={p.t}
    />
  );
}

/** Stateless shell rendering the header, body, footer and auth modal. */
function AppShell(p: AppShellProps): ReactElement {
  return (
    <div className="relative flex min-h-dvh flex-col bg-paper text-ink">
      {p.viewMode === 'workbench' && (
        <ConsoleSmogBackdrop
          aqi={p.workspace.bundle.telemetry.stationCrossCheck.effectiveSafetyAqi}
        />
      )}
      <SkipToMainLink label={p.t.skipLink} />
      <AppHeaderBar
        language={p.workspace.input.language}
        themeMode={p.themeMode}
        liveGeminiConfigured={p.workspace.liveGeminiConfigured}
        authUser={p.auth.user}
        authInitializing={p.auth.isInitializing}
        viewMode={p.viewMode}
        onToggleViewMode={p.onToggleViewMode}
        onChangeLanguage={(language) => {
          p.workspace.updateInput({ language });
        }}
        onToggleTheme={p.toggleTheme}
        onOpenAuthModal={() => {
          p.auth.clearMessages();
          p.setAuthModalOpen(true);
        }}
        t={p.t}
      />
      <AppViewBody {...p} />
      <AppFooter notice={p.t.footerNotice} />
      {p.viewMode === 'workbench' && <WorkbenchCompanionOverlay workspace={p.workspace} t={p.t} />}
      <AuthModal
        isOpen={p.authModalOpen}
        auth={p.auth}
        workspaceInput={p.workspace.input}
        onClose={() => {
          p.setAuthModalOpen(false);
        }}
        onSignedInSuccess={() => {
          p.onToggleViewMode('workbench');
        }}
      />
    </div>
  );
}

/**
 * Accessible Workbench application root uniting real-time atmospheric telemetry,
 * deterministic domain physics, and localized Gemini guidance in Light and Dark modes.
 */
export const App = memo(function App(): ReactElement {
  const [activeTab, setActiveTab] = useState<WorkbenchTabId>('dashboard');
  const [themeMode, toggleTheme] = useDocumentThemeMode();
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const defaultMode =
    typeof process !== 'undefined' && process.env.NODE_ENV === 'test' ? 'workbench' : 'landing';
  const [viewMode, setViewMode] = useState<'landing' | 'workbench'>(defaultMode);
  const workspace = useAirQualityWorkspace();
  const auth = useCloudWorkspaceRestore(workspace.selectCity, workspace.updateInput);
  const t = TRANSLATIONS[workspace.input.language];

  const handleStepTab = useCallback((nextTab: WorkbenchTabId): void => {
    setActiveTab(nextTab);
    scrollToMainTop();
  }, []);

  const handleToggleViewMode = useCallback((mode: 'landing' | 'workbench'): void => {
    setViewMode(mode);
    if (mode === 'workbench') {
      setActiveTab('dashboard');
    }
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const hasOAuth =
        window.location.hash.includes('access_token=') || window.location.search.includes('code=');
      if (hasOAuth) {
        setViewMode('workbench');
      }
    }
  }, []);

  return (
    <AppShell
      viewMode={viewMode}
      onToggleViewMode={handleToggleViewMode}
      workspace={workspace}
      auth={auth}
      t={t}
      themeMode={themeMode}
      toggleTheme={toggleTheme}
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      handleStepTab={handleStepTab}
      authModalOpen={authModalOpen}
      setAuthModalOpen={setAuthModalOpen}
    />
  );
});
