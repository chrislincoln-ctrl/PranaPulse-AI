import { UserPlus } from 'lucide-react';
import { memo, type ReactElement } from 'react';
import { VALIDATION_BOUNDS } from '../config/constants.js';
import type { FamilyMemberAdvisory, FamilyMemberInput } from '../domain/types.js';
import type { LocaleDictionary } from '../i18n/translations.js';
import type { AiPlanOutput, PlanRequestPayload } from '../validators/schemas.js';
import { FamilyMemberRow } from './FamilyMemberRow.js';
import { HousingEnvelopeSelects } from './FormFields.js';
import { ScheduleLedger } from './ScheduleLedger.js';

export interface FamilyRoutineViewProps {
  readonly input: PlanRequestPayload;
  readonly advisories: readonly FamilyMemberAdvisory[];
  readonly aiPlan: AiPlanOutput;
  readonly aiIsFallback: boolean;
  readonly isLoadingPlan: boolean;
  readonly onUpdateInput: (patch: Partial<PlanRequestPayload>) => void;
  readonly onRefreshPlan: () => void;
  readonly t: LocaleDictionary;
}

function HousingControls({
  input,
  onUpdateInput,
  t,
}: {
  readonly input: PlanRequestPayload;
  readonly onUpdateInput: (patch: Partial<PlanRequestPayload>) => void;
  readonly t: LocaleDictionary;
}): ReactElement {
  return (
    <div className="mb-6">
      <HousingEnvelopeSelects idPrefix="roster" input={input} onUpdateInput={onUpdateInput} t={t} />
    </div>
  );
}

function RosterMemberList({
  members,
  advisories,
  language,
  onUpdateInput,
  t,
}: {
  readonly members: readonly FamilyMemberInput[];
  readonly advisories: readonly FamilyMemberAdvisory[];
  readonly language: PlanRequestPayload['language'];
  readonly onUpdateInput: (patch: Partial<PlanRequestPayload>) => void;
  readonly t: LocaleDictionary;
}): ReactElement {
  const advisoryMap = new Map(advisories.map((a) => [a.id, a]));
  return (
    <ul className="divide-y divide-rule">
      {members.map((member) => (
        <FamilyMemberRow
          key={member.id}
          member={member}
          advisory={advisoryMap.get(member.id)}
          language={language}
          canRemove={members.length > VALIDATION_BOUNDS.MIN_FAMILY_MEMBERS}
          onChange={(patch: Partial<FamilyMemberInput>) => {
            onUpdateInput({
              members: members.map((m) => (m.id === member.id ? { ...m, ...patch } : m)),
            });
          }}
          onRemove={() => {
            onUpdateInput({ members: members.filter((m) => m.id !== member.id) });
          }}
          t={t}
        />
      ))}
    </ul>
  );
}

function RosterHeaderBar({
  heading,
  addLabel,
  canAdd,
  onAdd,
}: {
  readonly heading: string;
  readonly addLabel: string;
  readonly canAdd: boolean;
  readonly onAdd: () => void;
}): ReactElement {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
      <h2 id="family-roster-title" className="text-ink">
        {heading}
      </h2>
      {canAdd && (
        <button
          type="button"
          onClick={onAdd}
          className="btn-secondary touch-target inline-flex items-center gap-2 text-sm"
        >
          <UserPlus className="h-4 w-4 text-accent" aria-hidden="true" />
          <span>{addLabel}</span>
        </button>
      )}
    </div>
  );
}

function FamilyRosterSection({
  input,
  advisories,
  onUpdateInput,
  t,
}: {
  readonly input: PlanRequestPayload;
  readonly advisories: readonly FamilyMemberAdvisory[];
  readonly onUpdateInput: (patch: Partial<PlanRequestPayload>) => void;
  readonly t: LocaleDictionary;
}): ReactElement {
  const canAdd = input.members.length < VALIDATION_BOUNDS.MAX_FAMILY_MEMBERS;
  const addMember = (): void => {
    const nextIdx = input.members.length + 1;
    onUpdateInput({
      members: [
        ...input.members,
        {
          id: `m${String(nextIdx)}`,
          label: `${t.newMemberPrefix} ${String(nextIdx)}`,
          role: 'caregiver',
          mask: 'n95-ffp2',
          dailyOutdoorHours: 1,
        },
      ],
    });
  };

  return (
    <section
      aria-labelledby="family-roster-title"
      className="surface-hairline min-w-0 p-4 sm:p-6 lg:col-span-6"
    >
      <RosterHeaderBar
        heading={t.familySectionHeading}
        addLabel={t.addMemberButton}
        canAdd={canAdd}
        onAdd={addMember}
      />
      <HousingControls input={input} onUpdateInput={onUpdateInput} t={t} />
      <RosterMemberList
        members={input.members}
        advisories={advisories}
        language={input.language}
        onUpdateInput={onUpdateInput}
        t={t}
      />
    </section>
  );
}

/**
 * Interactive Family Care Roster builder paired with personalized daily smog defense schedule.
 */
export const FamilyRoutineView = memo(function FamilyRoutineView({
  input,
  advisories,
  aiPlan,
  aiIsFallback,
  isLoadingPlan,
  onUpdateInput,
  onRefreshPlan,
  t,
}: FamilyRoutineViewProps): ReactElement {
  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
      <FamilyRosterSection
        input={input}
        advisories={advisories}
        onUpdateInput={onUpdateInput}
        t={t}
      />
      <section aria-label={t.routineHeading} className="min-w-0 lg:col-span-6">
        <ScheduleLedger
          aiPlan={aiPlan}
          aiIsFallback={aiIsFallback}
          isLoadingPlan={isLoadingPlan}
          onRefreshPlan={onRefreshPlan}
          t={t}
        />
      </section>
    </div>
  );
});
