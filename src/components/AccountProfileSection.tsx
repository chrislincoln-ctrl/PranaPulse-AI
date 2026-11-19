import type { User } from '@supabase/supabase-js';
import { LogOut, ShieldCheck } from 'lucide-react';
import { memo, type ReactElement } from 'react';
import type { SupabaseAuthController } from '../hooks/useSupabaseAuth.js';
import { getUserDisplayName } from '../services/supabaseClient.js';
import type { PlanRequestPayload } from '../validators/schemas.js';

export interface AccountProfileSectionProps {
  readonly user: User;
  readonly auth: SupabaseAuthController;
  readonly workspaceInput: PlanRequestPayload;
}

function formatSyncTimestamp(isoValue: string | null): string {
  if (!isoValue) {
    return 'Not synced yet';
  }
  const parsed = new Date(isoValue);
  if (Number.isNaN(parsed.getTime())) {
    return 'Synced';
  }
  return parsed.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function WorkspaceSnapshotGrid({
  workspaceInput,
  lastSavedAt,
}: {
  readonly workspaceInput: PlanRequestPayload;
  readonly lastSavedAt: string | null;
}): ReactElement {
  return (
    <div className="space-y-1.5">
      <p className="measured text-xs uppercase tracking-wider text-muted">
        Synced workspace snapshot
      </p>
      <div className="panels overflow-hidden rounded-lg">
        <div className="panel">
          <p className="text-xs text-muted">Monitored city</p>
          <p className="mt-0.5 truncate text-sm font-semibold text-ink">{workspaceInput.city}</p>
        </div>
        <div className="panel">
          <p className="text-xs text-muted">Room &amp; CADR</p>
          <p className="measured mt-0.5 text-sm font-semibold text-ink">
            {workspaceInput.areaM2} m² · {workspaceInput.cadrM3Hr} m³/h
          </p>
        </div>
        <div className="panel">
          <p className="text-xs text-muted">Commute &amp; mask</p>
          <p className="mt-0.5 truncate text-sm font-semibold text-ink">
            {workspaceInput.commuteMode} · {workspaceInput.mask}
          </p>
        </div>
        <div className="panel">
          <p className="text-xs text-muted">Last cloud save</p>
          <p className="measured mt-0.5 text-xs font-medium text-ink-2">
            {formatSyncTimestamp(lastSavedAt)}
          </p>
        </div>
      </div>
    </div>
  );
}

function ProfileIdentityCard({
  displayName,
  email,
}: {
  readonly displayName: string;
  readonly email: string | undefined;
}): ReactElement {
  return (
    <div className="surface-recessed flex items-center justify-between gap-3 p-3.5">
      <div className="flex min-w-0 items-center gap-3">
        <span className="auth-avatar-badge h-10 w-10 text-sm" aria-hidden="true">
          {displayName.charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-ink">{displayName}</p>
          <p className="measured truncate text-xs text-muted">{email ?? 'Signed in'}</p>
        </div>
      </div>
      <span className="status-pill shrink-0 text-ok">
        <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
        <span>Active</span>
      </span>
    </div>
  );
}

/**
 * Signed-in Supabase account panel displaying active session identity, workspace sync preview,
 * and sign-out action.
 */
export const AccountProfileSection = memo(function AccountProfileSection({
  user,
  auth,
  workspaceInput,
}: AccountProfileSectionProps): ReactElement {
  return (
    <div className="space-y-4">
      <ProfileIdentityCard displayName={getUserDisplayName(user)} email={user.email} />
      <WorkspaceSnapshotGrid workspaceInput={workspaceInput} lastSavedAt={auth.lastSavedAt} />
      <div className="pt-1">
        <button
          type="button"
          disabled={auth.busy}
          onClick={() => {
            void auth.signOut();
          }}
          className="btn-secondary touch-target inline-flex w-full items-center justify-center gap-2 text-sm"
        >
          <LogOut className="h-4 w-4 text-muted" aria-hidden="true" />
          <span>Sign out</span>
        </button>
      </div>
    </div>
  );
});
