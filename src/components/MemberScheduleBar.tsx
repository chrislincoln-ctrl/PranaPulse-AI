import { Check, Copy, Eye, EyeOff, Share2 } from 'lucide-react';
import { memo, useState, type ReactElement } from 'react';
import type { MemberDailySchedule } from '../domain/types.js';
import type { LocaleDictionary } from '../i18n/translations.js';

export interface MemberScheduleBarProps {
  readonly memberSchedules: readonly MemberDailySchedule[];
  readonly selectedMemberId: string | null;
  readonly onSelectMemberId: (id: string) => void;
  readonly activeSchedule: MemberDailySchedule | null;
  readonly t: LocaleDictionary;
}

const COPY_RESET_MS = 2_000;

function tabButtonClass(active: boolean): string {
  return `rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
    active
      ? 'border-accent bg-accent text-accent-ink'
      : 'border-rule bg-paper-2 text-ink-2 hover:border-accent hover:text-ink'
  }`;
}

function MemberTabsStrip({
  memberSchedules,
  selectedMemberId,
  onSelectMemberId,
  t,
}: Omit<MemberScheduleBarProps, 'activeSchedule'>): ReactElement {
  return (
    <div
      role="tablist"
      aria-label={t.familySectionHeading}
      className="flex flex-wrap items-center gap-1.5"
    >
      {memberSchedules.map((sched) => {
        const isSelected = selectedMemberId === sched.memberId;
        return (
          <button
            key={sched.memberId}
            type="button"
            role="tab"
            aria-selected={isSelected}
            onClick={() => {
              onSelectMemberId(sched.memberId);
            }}
            className={tabButtonClass(isSelected)}
          >
            {sched.memberLabel} · {t.archetypeOptions[sched.archetype]}
          </button>
        );
      })}
    </div>
  );
}

function ShareActionButtons(p: {
  readonly waUrl: string;
  readonly copied: boolean;
  readonly showPreview: boolean;
  readonly onCopy: () => void;
  readonly onTogglePreview: () => void;
  readonly t: LocaleDictionary;
}): ReactElement {
  const CopyIcon = p.copied ? Check : Copy;
  const PreviewIcon = p.showPreview ? EyeOff : Eye;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <a
        href={p.waUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="btn-secondary inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-ok"
      >
        <Share2 className="h-3.5 w-3.5" aria-hidden="true" />
        <span>{p.t.shareWhatsAppButton}</span>
      </a>
      <button
        type="button"
        onClick={p.onCopy}
        className="btn-secondary inline-flex items-center gap-1.5 px-2.5 py-1 text-xs"
      >
        <CopyIcon
          className={`h-3.5 w-3.5 ${p.copied ? 'text-ok' : 'text-muted'}`}
          aria-hidden="true"
        />
        <span>{p.copied ? p.t.copiedBriefButton : p.t.copyBriefButton}</span>
      </button>
      <button
        type="button"
        aria-expanded={p.showPreview}
        onClick={p.onTogglePreview}
        className="btn-secondary inline-flex items-center gap-1 px-2.5 py-1 text-xs text-ink-2"
      >
        <PreviewIcon className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
        <span>{p.t.ui.whatsappBriefPreviewButton}</span>
      </button>
    </div>
  );
}

function MemberShareBar({
  schedule,
  t,
}: {
  readonly schedule: MemberDailySchedule;
  readonly t: LocaleDictionary;
}): ReactElement {
  const [copied, setCopied] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const waUrl = `https://wa.me/?text=${encodeURIComponent(schedule.shareBriefText)}`;

  const handleCopy = (): void => {
    void navigator.clipboard.writeText(schedule.shareBriefText).catch(() => undefined);
    setCopied(true);
    setTimeout(() => {
      setCopied(false);
    }, COPY_RESET_MS);
  };

  return (
    <div className="space-y-2 rounded border border-rule bg-paper-2 px-3 py-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-medium text-ink-2">{schedule.summaryHeadline}</span>
        <ShareActionButtons
          waUrl={waUrl}
          copied={copied}
          showPreview={showPreview}
          onCopy={handleCopy}
          onTogglePreview={() => {
            setShowPreview((prev) => !prev);
          }}
          t={t}
        />
      </div>
      {showPreview && (
        <pre className="measured overflow-x-auto rounded border border-rule bg-paper-3 p-2.5 text-xs whitespace-pre-wrap text-ink-2">
          {schedule.shareBriefText}
        </pre>
      )}
    </div>
  );
}

/** Per-member schedule pill selector paired with 1-click WhatsApp sharing and brief preview controls. */
export const MemberScheduleBar = memo(function MemberScheduleBar(
  props: MemberScheduleBarProps,
): ReactElement | null {
  const firstSchedule = props.memberSchedules[0] ?? null;
  const shareTarget = props.activeSchedule ?? firstSchedule;
  if (!shareTarget) {
    return null;
  }
  return (
    <div className="mt-4 space-y-3">
      <MemberTabsStrip
        memberSchedules={props.memberSchedules}
        selectedMemberId={props.selectedMemberId}
        onSelectMemberId={props.onSelectMemberId}
        t={props.t}
      />
      <MemberShareBar schedule={shareTarget} t={props.t} />
    </div>
  );
});
