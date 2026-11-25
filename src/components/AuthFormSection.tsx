import { memo, useState, type ReactElement, type SyntheticEvent } from 'react';
import type { SupabaseAuthController } from '../hooks/useSupabaseAuth.js';
import type { LocaleDictionary } from '../i18n/translations.js';
import {
  AuthEmailField,
  AuthModeSwitcher,
  AuthNameField,
  AuthPasswordField,
  AuthSubmitIcon,
  getAuthSubmitLabel,
  type AuthMode,
} from './AuthFormFields.js';

export type { AuthMode };

export interface AuthFormSectionProps {
  readonly auth: SupabaseAuthController;
  readonly mode: AuthMode;
  readonly onChangeMode: (nextMode: AuthMode) => void;
  readonly onSignedInSuccess: () => void;
  readonly onContinueAsGuest?: (() => void) | undefined;
  readonly t: LocaleDictionary;
}

interface SubmitContext {
  readonly mode: AuthMode;
  readonly auth: SupabaseAuthController;
  readonly email: string;
  readonly password: string;
  readonly fullName: string;
  readonly clearPassword: () => void;
  readonly onSignedInSuccess: () => void;
}

function MissingConfigNotice({ t }: { readonly t: LocaleDictionary }): ReactElement {
  return (
    <div role="alert" className="rounded-lg border border-bad/40 bg-bad-soft p-3 text-xs text-bad">
      {t.auth.missingConfigPrefix} <code>VITE_SUPABASE_URL</code> {t.auth.missingConfigAnd}{' '}
      <code>VITE_SUPABASE_ANON_KEY</code> {t.auth.missingConfigSuffix}
    </div>
  );
}

async function dispatchAuthSubmit(ctx: SubmitContext): Promise<void> {
  if (ctx.mode === 'reset') {
    await ctx.auth.resetPassword(ctx.email);
    return;
  }
  if (ctx.mode === 'signup') {
    if (await ctx.auth.signUp(ctx.email, ctx.password, ctx.fullName)) {
      ctx.clearPassword();
    }
    return;
  }
  if (await ctx.auth.signIn(ctx.email, ctx.password)) {
    ctx.clearPassword();
    ctx.onSignedInSuccess();
  }
}

interface AuthFormBodyProps {
  readonly mode: AuthMode;
  readonly fullName: string;
  readonly email: string;
  readonly password: string;
  readonly showPassword: boolean;
  readonly disabled: boolean;
  readonly busy: boolean;
  readonly onFullName: (value: string) => void;
  readonly onEmail: (value: string) => void;
  readonly onPassword: (value: string) => void;
  readonly onTogglePassword: () => void;
  readonly onSubmit: (event: SyntheticEvent<HTMLFormElement>) => void;
  readonly t: LocaleDictionary;
}

function AuthFormBody(p: AuthFormBodyProps): ReactElement {
  return (
    <form onSubmit={p.onSubmit} className="space-y-3.5">
      {p.mode === 'signup' && (
        <AuthNameField
          fullName={p.fullName}
          disabled={p.disabled}
          onChange={p.onFullName}
          t={p.t}
        />
      )}
      <AuthEmailField email={p.email} disabled={p.disabled} onChange={p.onEmail} t={p.t} />
      {p.mode !== 'reset' && (
        <AuthPasswordField
          mode={p.mode}
          password={p.password}
          showPassword={p.showPassword}
          disabled={p.disabled}
          onChange={p.onPassword}
          onToggleVisibility={p.onTogglePassword}
          t={p.t}
        />
      )}
      <button
        type="submit"
        disabled={p.disabled}
        data-loading={p.busy ? 'true' : undefined}
        className="btn-primary touch-target inline-flex w-full items-center justify-center gap-2 text-sm"
      >
        <AuthSubmitIcon mode={p.mode} busy={p.busy} />
        <span>{getAuthSubmitLabel(p.mode, p.busy, p.t)}</span>
      </button>
    </form>
  );
}

function GoogleLogoIcon(): ReactElement {
  return (
    <svg className="h-4.5 w-4.5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
      />
    </svg>
  );
}

function GoogleSignInOption({
  auth,
  mode,
  t,
}: {
  readonly auth: SupabaseAuthController;
  readonly mode: AuthMode;
  readonly t: LocaleDictionary;
}): ReactElement | null {
  if (mode === 'reset') {
    return null;
  }
  return (
    <div className="space-y-3">
      <button
        type="button"
        disabled={auth.busy || !auth.isConfigured}
        onClick={() => {
          void auth.signInWithGoogle();
        }}
        className="touch-target inline-flex w-full items-center justify-center gap-2.5 rounded-lg border border-rule bg-paper-2 px-4 py-2.5 text-sm font-semibold text-ink shadow-xs transition hover:border-accent/40 hover:bg-paper-3 active:scale-[0.99] disabled:opacity-50"
      >
        <GoogleLogoIcon />
        <span>{t.auth.googleButton}</span>
      </button>
      <div className="relative flex items-center justify-center">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-rule" />
        </div>
        <span className="relative bg-paper-2 px-3 text-xs tracking-wider text-muted uppercase">
          {t.auth.dividerOr}
        </span>
      </div>
    </div>
  );
}

function useAuthCredentials() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  return {
    fullName,
    email,
    password,
    showPassword,
    setFullName,
    setEmail,
    setPassword,
    clearPassword: () => {
      setPassword('');
    },
    togglePassword: () => {
      setShowPassword((prev) => !prev);
    },
  };
}

function GuestFallbackFooter({
  onContinueAsGuest,
  t,
}: {
  readonly onContinueAsGuest?: (() => void) | undefined;
  readonly t: LocaleDictionary;
}): ReactElement {
  return (
    <>
      {onContinueAsGuest && (
        <button
          type="button"
          onClick={onContinueAsGuest}
          className="btn-secondary touch-target inline-flex w-full items-center justify-center text-sm"
        >
          {t.auth.continueGuestButton}
        </button>
      )}
      <p className="text-xs leading-relaxed text-muted">{t.auth.guestFooterNote}</p>
    </>
  );
}

/**
 * Email + password Sign In, Account Creation, and Password Reset form backed by Supabase Auth.
 */
export const AuthFormSection = memo(function AuthFormSection({
  auth,
  mode,
  onChangeMode,
  onSignedInSuccess,
  onContinueAsGuest,
  t,
}: AuthFormSectionProps): ReactElement {
  const creds = useAuthCredentials();
  const handleSubmit = (event: SyntheticEvent<HTMLFormElement>): void => {
    event.preventDefault();
    void dispatchAuthSubmit({ mode, auth, ...creds, onSignedInSuccess });
  };

  return (
    <div className="space-y-4">
      <AuthModeSwitcher
        mode={mode}
        onSelect={(nextMode) => {
          auth.clearMessages();
          onChangeMode(nextMode);
        }}
        t={t}
      />
      {!auth.isConfigured && <MissingConfigNotice t={t} />}
      <GoogleSignInOption auth={auth} mode={mode} t={t} />
      <AuthFormBody
        mode={mode}
        fullName={creds.fullName}
        email={creds.email}
        password={creds.password}
        showPassword={creds.showPassword}
        disabled={auth.busy || !auth.isConfigured}
        busy={auth.busy}
        onFullName={creds.setFullName}
        onEmail={creds.setEmail}
        onPassword={creds.setPassword}
        onTogglePassword={creds.togglePassword}
        onSubmit={handleSubmit}
        t={t}
      />
      <GuestFallbackFooter onContinueAsGuest={onContinueAsGuest} t={t} />
    </div>
  );
});
