import { memo, useState, type ReactElement, type SyntheticEvent } from 'react';
import type { SupabaseAuthController } from '../hooks/useSupabaseAuth.js';
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

function MissingConfigNotice(): ReactElement {
  return (
    <div role="alert" className="rounded-lg border border-bad/40 bg-bad-soft p-3 text-xs text-bad">
      Supabase keys are missing. Add <code>VITE_SUPABASE_URL</code> and{' '}
      <code>VITE_SUPABASE_ANON_KEY</code> in <code>.env</code> and rebuild to enable sign-in.
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
}

function AuthFormBody(p: AuthFormBodyProps): ReactElement {
  return (
    <form onSubmit={p.onSubmit} className="space-y-3.5">
      {p.mode === 'signup' && (
        <AuthNameField fullName={p.fullName} disabled={p.disabled} onChange={p.onFullName} />
      )}
      <AuthEmailField email={p.email} disabled={p.disabled} onChange={p.onEmail} />
      {p.mode !== 'reset' && (
        <AuthPasswordField
          mode={p.mode}
          password={p.password}
          showPassword={p.showPassword}
          disabled={p.disabled}
          onChange={p.onPassword}
          onToggleVisibility={p.onTogglePassword}
        />
      )}
      <button
        type="submit"
        disabled={p.disabled}
        className="btn-primary touch-target inline-flex w-full items-center justify-center gap-2 text-sm"
      >
        <AuthSubmitIcon mode={p.mode} busy={p.busy} />
        <span>{getAuthSubmitLabel(p.mode, p.busy)}</span>
      </button>
    </form>
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

/**
 * Email + password Sign In, Account Creation, and Password Reset form backed by Supabase Auth.
 */
export const AuthFormSection = memo(function AuthFormSection({
  auth,
  mode,
  onChangeMode,
  onSignedInSuccess,
}: AuthFormSectionProps): ReactElement {
  const creds = useAuthCredentials();
  const handleSubmit = (event: SyntheticEvent<HTMLFormElement>): void => {
    event.preventDefault();
    void dispatchAuthSubmit({
      mode,
      auth,
      email: creds.email,
      password: creds.password,
      fullName: creds.fullName,
      clearPassword: creds.clearPassword,
      onSignedInSuccess,
    });
  };

  return (
    <div className="space-y-4">
      <AuthModeSwitcher
        mode={mode}
        onSelect={(nextMode) => {
          auth.clearMessages();
          onChangeMode(nextMode);
        }}
      />
      {!auth.isConfigured && <MissingConfigNotice />}
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
      />
      <p className="text-xs leading-relaxed text-muted">
        Guest telemetry stays available without an account. Sign in to sync your monitored city,
        room CADR, and commute mask profile across devices.
      </p>
    </div>
  );
});
