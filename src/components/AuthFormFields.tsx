import { Eye, EyeOff, KeyRound, Loader2, Mail, UserPlus } from 'lucide-react';
import type { ReactElement } from 'react';
import type { LocaleDictionary } from '../i18n/translations.js';

export type AuthMode = 'signin' | 'signup' | 'reset';

const MIN_PASSWORD_LENGTH = 6;

export function getAuthSubmitLabel(mode: AuthMode, busy: boolean, t: LocaleDictionary): string {
  if (busy) {
    return t.auth.submitConnecting;
  }
  if (mode === 'signup') {
    return t.auth.submitSignUp;
  }
  if (mode === 'reset') {
    return t.auth.submitReset;
  }
  return t.auth.submitSignIn;
}

export function AuthModeSwitcher({
  mode,
  onSelect,
  t,
}: {
  readonly mode: AuthMode;
  readonly onSelect: (nextMode: AuthMode) => void;
  readonly t: LocaleDictionary;
}): ReactElement {
  const modes: readonly { readonly id: AuthMode; readonly label: string }[] = [
    { id: 'signin', label: t.auth.modeSignIn },
    { id: 'signup', label: t.auth.modeSignUp },
    { id: 'reset', label: t.auth.modeReset },
  ];

  return (
    <div
      role="tablist"
      aria-label={t.auth.modeAriaLabel}
      className="grid w-full grid-cols-3 gap-1 rounded-lg border border-rule-2/60 bg-paper-3/85 p-1"
    >
      {modes.map((item) => {
        const active = mode === item.id;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => {
              onSelect(item.id);
            }}
            className={`min-h-[40px] cursor-pointer rounded-md px-2 py-1.5 text-center text-xs font-medium transition-colors sm:text-sm ${
              active
                ? 'border border-accent/55 bg-paper-2 font-semibold text-ink shadow-xs'
                : 'border border-transparent text-ink-2 hover:bg-paper-2/50 hover:text-ink'
            }`}
          >
            {item.label}
          </button>
        );
      })}
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
  t,
}: {
  readonly fullName: string;
  readonly disabled: boolean;
  readonly onChange: (value: string) => void;
  readonly t: LocaleDictionary;
}): ReactElement {
  return (
    <div className="space-y-1.5">
      <label htmlFor="auth-name-input" className="block text-xs font-medium text-ink-2">
        {t.auth.nameLabel}
      </label>
      <input
        id="auth-name-input"
        type="text"
        autoComplete="name"
        placeholder={t.auth.namePlaceholder}
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
  t,
}: {
  readonly email: string;
  readonly disabled: boolean;
  readonly onChange: (value: string) => void;
  readonly t: LocaleDictionary;
}): ReactElement {
  return (
    <div className="space-y-1.5">
      <label htmlFor="auth-email-input" className="block text-xs font-medium text-ink-2">
        {t.auth.emailLabel}
      </label>
      <input
        id="auth-email-input"
        type="email"
        required
        autoComplete="email"
        placeholder={t.auth.emailPlaceholder}
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
  t,
}: {
  readonly showPassword: boolean;
  readonly onToggle: () => void;
  readonly t: LocaleDictionary;
}): ReactElement {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={showPassword ? t.auth.hidePasswordAria : t.auth.showPasswordAria}
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
  t,
}: {
  readonly mode: AuthMode;
  readonly password: string;
  readonly showPassword: boolean;
  readonly disabled: boolean;
  readonly onChange: (value: string) => void;
  readonly onToggleVisibility: () => void;
  readonly t: LocaleDictionary;
}): ReactElement {
  const placeholder =
    mode === 'signup' ? t.auth.passwordSignupPlaceholder : t.auth.passwordSigninPlaceholder;
  return (
    <div className="space-y-1.5">
      <label htmlFor="auth-password-input" className="block text-xs font-medium text-ink-2">
        {t.auth.passwordLabel}
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
        <PasswordVisibilityToggle showPassword={showPassword} onToggle={onToggleVisibility} t={t} />
      </div>
    </div>
  );
}
