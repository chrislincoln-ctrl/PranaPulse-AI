import { memo, type ReactElement } from 'react';
import type { WorkbenchTabId } from '../config/uiConstants.js';
import type { FamilyMemberInput } from '../domain/types.js';
import type { useAirQualityWorkspace } from '../hooks/useAirQualityWorkspace.js';
import type { LocaleDictionary } from '../i18n/translations.js';
import { CommunityAdvisorView } from './CommunityAdvisorView.js';
import { CommuteCorridorView } from './CommuteCorridorView.js';
import { FamilyCompanionChat } from './FamilyCompanionChat.js';
import { FamilyRoutineView } from './FamilyRoutineView.js';
import { GearMarketplaceView } from './GearMarketplaceView.js';
import { IndoorCadrView } from './IndoorCadrView.js';
import { TelemetryHero } from './TelemetryHero.js';

export interface WorkbenchTabPanelProps {
  readonly activeTab: WorkbenchTabId;
  readonly workspace: ReturnType<typeof useAirQualityWorkspace>;
  readonly t: LocaleDictionary;
}

function renderWorkbenchModule(
  activeTab: Exclude<WorkbenchTabId, 'dashboard'>,
  workspace: ReturnType<typeof useAirQualityWorkspace>,
  t: LocaleDictionary,
): ReactElement {
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

/**
 * Renders the currently selected workbench section, placing the atmospheric
 * telemetry hero in the dedicated first Dashboard tab.
 */
export const WorkbenchTabPanel = memo(function WorkbenchTabPanel({
  activeTab,
  workspace,
  t,
}: WorkbenchTabPanelProps): ReactElement {
  const applyMemberPatch = (memberId: string, patch: Partial<FamilyMemberInput>): void => {
    workspace.updateInput({
      members: workspace.input.members.map((m) => (m.id === memberId ? { ...m, ...patch } : m)),
    });
  };
  const activeView =
    activeTab === 'dashboard' ? (
      <TelemetryHero
        telemetry={workspace.bundle.telemetry}
        gpsStatus={workspace.gpsStatus}
        gpsCity={workspace.gpsCity}
        onSelectCity={workspace.selectCity}
        onRequestGps={workspace.requestGeolocation}
        t={t}
      />
    ) : (
      renderWorkbenchModule(activeTab, workspace, t)
    );

  return (
    <>
      {activeView}
      <FamilyCompanionChat
        input={workspace.input}
        memberSchedules={workspace.bundle.aiPlan.memberSchedules ?? []}
        onApplyMemberPatch={applyMemberPatch}
        t={t}
      />
    </>
  );
});
