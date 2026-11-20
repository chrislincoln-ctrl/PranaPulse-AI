import type { User } from '@supabase/supabase-js';
import { ArrowRight, LogIn, LogOut, ShieldCheck, User as UserIcon } from 'lucide-react';
import { memo, useState, type ReactElement } from 'react';
import type { SupabaseAuthController } from '../hooks/useSupabaseAuth.js';
import { getUserDisplayName } from '../services/supabaseClient.js';
import type { LocaleDictionary } from '../i18n/translations.js';
import type { AuthMode } from './AuthFormFields.js';
import { AuthFormSection } from './AuthFormSection.js';

export interface LandingAccessGatewayCardProps {
  readonly auth: SupabaseAuthController;
  readonly onEnterConsole: () => void;
  readonly t: LocaleDictionary;
}

function ProfileUserBadge({
  user,
  displayName,
  badgeLabel,
}: {
  readonly user: User;
  readonly displayName: string;
  readonly badgeLabel: string;
}): ReactElement {
  return (
    <div className="flex items-center justify-between rounded-lg border border-ok/30 bg-ok-soft/30 p-3">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/20 text-accent-ink font-semibold">
          <UserIcon className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="text-left text-xs">
          <p className="font-semibold text-ink">{displayName}</p>
          <p className="text-muted">{user.email ?? ''}</p>
        </div>
      </div>
      <span className="inline-flex items-center gap-1 rounded bg-ok/20 px-2 py-0.5 text-xs font-medium text-ok">
        <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
        {badgeLabel}
      </span>
    </div>
  );
}

function SignedInProfileGateway({
  user,
  auth,
  onEnterConsole,
  t,
}: {
  readonly user: User;
  readonly auth: SupabaseAuthController;
  readonly onEnterConsole: () => void;
  readonly t: LocaleDictionary;
}): ReactElement {
  const displayName = getUserDisplayName(user);
  return (
    <div className="space-y-4">
      <ProfileUserBadge
        user={user}
        displayName={displayName}
        badgeLabel={t.landingAuthSignedInAs}
      />
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={onEnterConsole}
          className="btn-primary touch-target inline-flex w-full items-center justify-center gap-2 py-2.5 text-sm font-semibold"
        >
          <span>{t.landingAuthOpenConsole}</span>
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => {
            void auth.signOut();
          }}
          className="btn-secondary touch-target inline-flex w-full items-center justify-center gap-2 text-xs"
        >
          <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Sign out</span>
        </button>
      </div>
    </div>
  );
}

function GuestLaunchButton({
  onEnterConsole,
  label,
}: {
  readonly onEnterConsole: () => void;
  readonly label: string;
}): ReactElement {
  return (
    <button
      type="button"
      onClick={onEnterConsole}
      className="btn-primary touch-target inline-flex w-full items-center justify-center gap-2 py-3 text-base font-semibold shadow-sm transition-transform active:scale-[0.98]"
    >
      <LogIn className="h-5 w-5" aria-hidden="true" />
      <span>{label}</span>
      <ArrowRight className="h-5 w-5" aria-hidden="true" />
    </button>
  );
}

export const LandingAccessGatewayCard = memo(
  function LandingAccessGatewayCard({
    auth,
    onEnterConsole,
    t,
  }: LandingAccessGatewayCardProps): ReactElement {
    const [authMode, setAuthMode] = useState<AuthMode>('signin');

    return (
      <section
        aria-label={t.landingAuthGatewayTitle}
        className="card flex flex-col gap-4 border border-rule bg-paper-2 p-5 shadow-sm sm:p-6"
      >
        <div>
          <h2 className="text-base font-bold text-ink sm:text-lg">
            {t.landingAuthGatewayTitle}
          </h2>
          <p className="mt-1 text-xs text-muted">
            {t.landingAuthGatewaySubtitle}
          </p>
        </div>

        <GuestLaunchButton
          onEnterConsole={onEnterConsole}
          label={t.landingAuthGuestCta}
        />

        <div className="relative flex items-center justify-center">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-rule" />
          </div>
          <span className="relative bg-paper-2 px-3 text-xs text-muted uppercase tracking-wider">
            Supabase Cloud Sync
          </span>
        </div>

        {auth.user ? (
          <SignedInProfileGateway
            user={auth.user}
            auth={auth}
            onEnterConsole={onEnterConsole}
            t={t}
          />
        ) : (
          <AuthFormSection
            auth={auth}
            mode={authMode}
            onChangeMode={setAuthMode}
            onSignedInSuccess={onEnterConsole}
          />
        )}
      </section>
    );
  },
);
