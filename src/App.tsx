import { memo, useCallback, useEffect, useState, type ReactElement } from 'react';
import { AppHeaderBar, type ThemeMode } from './components/AppHeaderBar.js';
import { AuthModal } from './components/AuthModal.js';
import { CommunityAdvisorView } from './components/CommunityAdvisorView.js';
import { CommuteCorridorView } from './components/CommuteCorridorView.js';
import { FamilyRoutineView } from './components/FamilyRoutineView.js';
import { GearMarketplaceView } from './components/GearMarketplaceView.js';
import { IndoorCadrView } from './components/IndoorCadrView.js';
import { SegmentedTabs } from './components/SegmentedTabs.js';
import { TelemetryHero } from './components/TelemetryHero.js';
import { APP_META } from './config/constants.js';
import type { WorkbenchTabId } from './config/uiConstants.js';
import { useAirQualityWorkspace } from './hooks/useAirQualityWorkspace.js';
import { useSupabaseAuth } from './hooks/useSupabaseAuth.js';
import { TRANSLATIONS, type LocaleDictionary } from './i18n/translations.js';
import type { SavedWorkspacePreferences } from './services/supabaseClient.js';

export type { ThemeMode };

interface TabPanelProps {
  readonly activeTab: WorkbenchTabId;
  readonly workspace: ReturnType<typeof useAirQualityWorkspace>;
  readonly t: LocaleDictionary;
}

function TabPanelBody({ activeTab, workspace, t }: TabPanelProps): ReactElement {
  const { input, bundle, updateInput } = workspace;
  if (activeTab === 'indoor') {
    return (
      <IndoorCadrView input={input} indoor={bundle.indoor} onUpdateInput={updateInput} t={t} />
    );
  }
  if (activeTab === 'commute') {
    return (
      <CommuteCorridorView
        input={input}
        commuteOptions={bundle.commuteOptions}
        corridor={bundle.corridor}
        onUpdateInput={updateInput}
        t={t}
      />
    );
  }
  if (activeTab === 'gear') {
    return <GearMarketplaceView input={input} indoor={bundle.indoor} t={t} />;
  }
  if (activeTab === 'community') {
    return (
      <CommunityAdvisorView
        input={input}
        telemetry={bundle.telemetry}
        rwa={bundle.rwa}
        groqConfigured={workspace.groqConfigured}
        onUpdateInput={updateInput}
        t={t}
      />
    );
  }
  return (
    <FamilyRoutineView
      input={input}
      advisories={bundle.memberAdvisories}
      aiPlan={bundle.aiPlan}
      aiIsFallback={bundle.aiMeta.isFallback}
      isLoadingPlan={workspace.isLoadingPlan}
      onUpdateInput={updateInput}
      onRefreshPlan={workspace.refreshPlanNow}
      t={t}
    />
  );
}

function AppMainContent({
  activeTab,
  workspace,
  onSelectTab,
  t,
}: {
  readonly activeTab: WorkbenchTabId;
  readonly workspace: ReturnType<typeof useAirQualityWorkspace>;
  readonly onSelectTab: (tab: WorkbenchTabId) => void;
  readonly t: LocaleDictionary;
}): ReactElement {
  return (
    <main id="main-content" className="container flex-1 pb-12">
      <TelemetryHero
        telemetry={workspace.bundle.telemetry}
        gpsStatus={workspace.gpsStatus}
        gpsCity={workspace.gpsCity}
        onSelectCity={workspace.selectCity}
        onRequestGps={workspace.requestGeolocation}
        t={t}
      />
      <div className="mb-6 border-t border-rule pt-6">
        <SegmentedTabs activeTab={activeTab} onSelectTab={onSelectTab} t={t} />
      </div>
      <div role="tabpanel" id={`panel-${activeTab}`} aria-labelledby={`tab-${activeTab}`}>
        <TabPanelBody activeTab={activeTab} workspace={workspace} t={t} />
      </div>
    </main>
  );
}

function AppFooter({ notice }: { readonly notice: string }): ReactElement {
  return (
    <footer className="border-t border-rule bg-paper-3 px-4 py-4 text-center text-xs text-muted">
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
      selectCity(prefs.city, prefs.lat, prefs.lon);
      updateInput({
        areaM2: prefs.areaM2,
        cadrM3Hr: prefs.cadrM3Hr,
        tightness: prefs.tightness,
        cookingFuel: prefs.cookingFuel,
        commuteDistanceKm: prefs.commuteDistanceKm,
        commuteMode: prefs.commuteMode,
        mask: prefs.mask,
        language: prefs.language,
      });
    },
    [selectCity, updateInput],
  );
  return useSupabaseAuth(onRestore);
}

function SkipToMainLink({ label }: { readonly label: string }): ReactElement {
  return (
    <a
      href="#main-content"
      className="sr-only touch-target focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded focus:bg-accent focus:px-4 focus:py-2 focus:text-accent-ink"
    >
      {label}
    </a>
  );
}

function useDocumentThemeMode(): readonly [ThemeMode, () => void] {
  const [themeMode, setThemeMode] = useState<ThemeMode>('light');
  useEffect(() => {
    document.documentElement.dataset.mode = themeMode;
  }, [themeMode]);
  const toggleTheme = useCallback((): void => {
    setThemeMode((prev) => (prev === 'light' ? 'dark' : 'light'));
  }, []);
  return [themeMode, toggleTheme] as const;
}

/**
 * Accessible Workbench application root uniting real-time atmospheric telemetry,
 * deterministic domain physics, and localized Gemini guidance in Light and Dark modes.
 */
export const App = memo(function App(): ReactElement {
  const [activeTab, setActiveTab] = useState<WorkbenchTabId>('routine');
  const [themeMode, toggleTheme] = useDocumentThemeMode();
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const workspace = useAirQualityWorkspace();
  const auth = useCloudWorkspaceRestore(workspace.selectCity, workspace.updateInput);
  const t = TRANSLATIONS[workspace.input.language];

  return (
    <div className="flex min-h-dvh flex-col bg-paper text-ink">
      <SkipToMainLink label={t.skipLink} />
      <AppHeaderBar
        language={workspace.input.language}
        themeMode={themeMode}
        liveGeminiConfigured={workspace.liveGeminiConfigured}
        authUser={auth.user}
        authInitializing={auth.isInitializing}
        onChangeLanguage={(language) => {
          workspace.updateInput({ language });
        }}
        onToggleTheme={toggleTheme}
        onOpenAuthModal={() => {
          auth.clearMessages();
          setAuthModalOpen(true);
        }}
        t={t}
      />
      <AppMainContent
        activeTab={activeTab}
        workspace={workspace}
        onSelectTab={setActiveTab}
        t={t}
      />
      <AppFooter notice={t.footerNotice} />
      <AuthModal
        isOpen={authModalOpen}
        auth={auth}
        workspaceInput={workspace.input}
        onClose={() => {
          setAuthModalOpen(false);
        }}
      />
    </div>
  );
});
