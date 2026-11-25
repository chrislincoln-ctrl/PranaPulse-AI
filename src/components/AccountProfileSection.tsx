import type { User } from '@supabase/supabase-js';
import { LogOut, ShieldCheck } from 'lucide-react';
import { memo, type ReactElement } from 'react';
import type { SupabaseAuthController } from '../hooks/useSupabaseAuth.js';
import type { LocaleDictionary } from '../i18n/translations.js';
import { getUserDisplayName } from '../services/supabaseClient.js';
import type { PlanRequestPayload } from '../validators/schemas.js';

export interface AccountProfileSectionProps {
  readonly user: User;
  readonly auth: SupabaseAuthController;
  readonly workspaceInput: PlanRequestPayload;
  readonly t: LocaleDictionary;
}

function formatSyncTimestamp(isoValue: string | null, t: LocaleDictionary): string {
  if (!isoValue) {
    return t.auth.notSyncedYet;
  }
  const parsed = new Date(isoValue);
  if (Number.isNaN(parsed.getTime())) {
    return t.auth.syncedLabel;
  }
  return parsed.toLocaleString(t.locale, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function WorkspaceSnapshotGrid({
  workspaceInput,
  lastSavedAt,
  t,
}: {
  readonly workspaceInput: PlanRequestPayload;
  readonly lastSavedAt: string | null;
  readonly t: LocaleDictionary;
}): ReactElement {
  const cityLabel = t.cityNames[workspaceInput.city] ?? workspaceInput.city;
  return (
    <div className="space-y-1.5">
      <p className="measured text-xs tracking-wider text-muted uppercase">
        {t.auth.snapshotHeading}
      </p>
      <div className="panels overflow-hidden rounded-lg">
        <div className="panel">
          <p className="text-xs text-muted">{t.auth.monitoredCityLabel}</p>
          <p className="mt-0.5 truncate text-sm font-semibold text-ink">{cityLabel}</p>
        </div>
        <div className="panel">
          <p className="text-xs text-muted">{t.auth.roomCadrLabel}</p>
          <p className="measured mt-0.5 text-sm font-semibold text-ink">
            {workspaceInput.areaM2} m² · {workspaceInput.cadrM3Hr} m³/h
          </p>
        </div>
        <div className="panel">
          <p className="text-xs text-muted">{t.auth.commuteMaskLabel}</p>
          <p className="mt-0.5 truncate text-sm font-semibold text-ink">
            {t.commuteModes[workspaceInput.commuteMode]} · {t.maskOptions[workspaceInput.mask]}
          </p>
        </div>
        <div className="panel">
          <p className="text-xs text-muted">{t.auth.lastCloudSaveLabel}</p>
          <p className="measured mt-0.5 text-xs font-medium text-ink-2">
            {formatSyncTimestamp(lastSavedAt, t)}
          </p>
        </div>
      </div>
    </div>
  );
}

function ProfileIdentityCard({
  displayName,
  email,
  t,
}: {
  readonly displayName: string;
  readonly email: string | undefined;
  readonly t: LocaleDictionary;
}): ReactElement {
  return (
    <div className="surface-recessed flex items-center justify-between gap-3 p-3.5">
      <div className="flex min-w-0 items-center gap-3">
        <span className="auth-avatar-badge h-10 w-10 text-sm" aria-hidden="true">
          {displayName.charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-ink">{displayName}</p>
          <p className="measured truncate text-xs text-muted">{email ?? t.auth.signedInFallback}</p>
        </div>
      </div>
      <span className="status-pill shrink-0 text-ok">
        <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
        <span>{t.auth.statusActive}</span>
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
  t,
}: AccountProfileSectionProps): ReactElement {
  return (
    <div className="space-y-4">
      <ProfileIdentityCard displayName={getUserDisplayName(user)} email={user.email} t={t} />
      <WorkspaceSnapshotGrid workspaceInput={workspaceInput} lastSavedAt={auth.lastSavedAt} t={t} />
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
          <span>{t.auth.signOutButton}</span>
        </button>
      </div>
    </div>
  );
});
