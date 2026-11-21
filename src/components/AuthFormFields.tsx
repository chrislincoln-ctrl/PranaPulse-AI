import { Eye, EyeOff, KeyRound, Loader2, Mail, UserPlus } from 'lucide-react';
import type { ReactElement } from 'react';

export type AuthMode = 'signin' | 'signup' | 'reset';

const MIN_PASSWORD_LENGTH = 6;

const AUTH_MODES: readonly { readonly id: AuthMode; readonly label: string }[] = [
  { id: 'signin', label: 'Sign in' },
  { id: 'signup', label: 'Create account' },
  { id: 'reset', label: 'Reset' },
];

export function getAuthSubmitLabel(mode: AuthMode, busy: boolean): string {
  if (busy) {
    return 'Connecting to Supabase…';
  }
  if (mode === 'signup') {
    return 'Create cloud account';
  }
  if (mode === 'reset') {
    return 'Send password reset link';
  }
  return 'Sign in to workspace';
}

export function AuthModeSwitcher({
  mode,
  onSelect,
}: {
  readonly mode: AuthMode;
  readonly onSelect: (nextMode: AuthMode) => void;
}): ReactElement {
  return (
    <div
      role="tablist"
      aria-label="Authentication mode"
      className="segmented-rail grid grid-cols-3"
    >
      {AUTH_MODES.map((item) => (
        <button
          key={item.id}
          type="button"
          role="tab"
          aria-selected={mode === item.id}
          onClick={() => {
            onSelect(item.id);
          }}
          className="segmented-tab text-center text-xs sm:text-sm"
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

export function AuthSubmitIcon({
  mode,
  busy,
}: {
  readonly mode: AuthMode;
  readonly busy: boolean;
}): ReactElement {
  if (busy) {
    return <Loader2 className="h-4 w-4 icon-spin keep-motion" aria-hidden="true" />;
  }
  if (mode === 'signup') {
    return <UserPlus className="h-4 w-4" aria-hidden="true" />;
  }
  if (mode === 'reset') {
    return <Mail className="h-4 w-4" aria-hidden="true" />;
  }
  return <KeyRound className="h-4 w-4" aria-hidden="true" />;
}

export function AuthNameField({
  fullName,
  disabled,
  onChange,
}: {
  readonly fullName: string;
  readonly disabled: boolean;
  readonly onChange: (value: string) => void;
}): ReactElement {
  return (
    <div className="space-y-1.5">
      <label htmlFor="auth-name-input" className="block text-xs font-medium text-ink-2">
        Display name (optional)
      </label>
      <input
        id="auth-name-input"
        type="text"
        autoComplete="name"
        placeholder="e.g. Aarav Sharma"
        value={fullName}
        disabled={disabled}
        onChange={(e) => {
          onChange(e.target.value);
        }}
        className="field-control text-sm"
      />
    </div>
  );
}

export function AuthEmailField({
  email,
  disabled,
  onChange,
}: {
  readonly email: string;
  readonly disabled: boolean;
  readonly onChange: (value: string) => void;
}): ReactElement {
  return (
    <div className="space-y-1.5">
      <label htmlFor="auth-email-input" className="block text-xs font-medium text-ink-2">
        Email address
      </label>
      <input
        id="auth-email-input"
        type="email"
        required
        autoComplete="email"
        placeholder="you@example.com"
        value={email}
        disabled={disabled}
        onChange={(e) => {
          onChange(e.target.value);
        }}
        className="field-control text-sm"
      />
    </div>
  );
}

function PasswordVisibilityToggle({
  showPassword,
  onToggle,
}: {
  readonly showPassword: boolean;
  readonly onToggle: () => void;
}): ReactElement {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={showPassword ? 'Hide password' : 'Show password'}
      className="touch-target absolute right-0 inline-flex items-center justify-center rounded-md px-3 text-muted hover:text-ink"
    >
      {showPassword ? (
        <EyeOff className="h-4 w-4" aria-hidden="true" />
      ) : (
        <Eye className="h-4 w-4" aria-hidden="true" />
      )}
    </button>
  );
}

export function AuthPasswordField({
  mode,
  password,
  showPassword,
  disabled,
  onChange,
  onToggleVisibility,
}: {
  readonly mode: AuthMode;
  readonly password: string;
  readonly showPassword: boolean;
  readonly disabled: boolean;
  readonly onChange: (value: string) => void;
  readonly onToggleVisibility: () => void;
}): ReactElement {
  const placeholder = mode === 'signup' ? 'At least 6 characters' : 'Enter your password';
  return (
    <div className="space-y-1.5">
      <label htmlFor="auth-password-input" className="block text-xs font-medium text-ink-2">
        Password
      </label>
      <div className="relative flex items-center">
        <input
          id="auth-password-input"
          type={showPassword ? 'text' : 'password'}
          required
          minLength={MIN_PASSWORD_LENGTH}
          autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
          placeholder={placeholder}
          value={password}
          disabled={disabled}
          onChange={(e) => {
            onChange(e.target.value);
          }}
          className="field-control pr-12 text-sm"
        />
        <PasswordVisibilityToggle showPassword={showPassword} onToggle={onToggleVisibility} />
      </div>
    </div>
  );
}
