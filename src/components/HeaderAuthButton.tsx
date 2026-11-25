import type { User } from '@supabase/supabase-js';
import { LogIn } from 'lucide-react';
import { memo, type ReactElement } from 'react';
import { TRANSLATIONS, type LocaleDictionary } from '../i18n/translations.js';
import { getUserDisplayName } from '../services/supabaseClient.js';

export interface HeaderAuthButtonProps {
  readonly user: User | null;
  readonly isInitializing: boolean;
  readonly onOpenModal: () => void;
  readonly t?: LocaleDictionary;
}

const MAX_DISPLAY_CHARS = 16;

function formatCompactName(raw: string): string {
  return raw.length > MAX_DISPLAY_CHARS ? `${raw.slice(0, MAX_DISPLAY_CHARS - 1)}…` : raw;
}

/**
 * Header trigger for optional Supabase Sign In / Cloud Account modal while keeping
 * full guest telemetry accessible immediately.
 */
export const HeaderAuthButton = memo(function HeaderAuthButton({
  user,
  isInitializing,
  onOpenModal,
  t = TRANSLATIONS.en,
}: HeaderAuthButtonProps): ReactElement {
  if (user) {
    const displayName = getUserDisplayName(user);
    const initial = displayName.charAt(0).toUpperCase();
    return (
      <button
        type="button"
        onClick={onOpenModal}
        aria-label={`${t.auth.headerAccountAriaPrefix} ${displayName}`}
        className="btn-secondary touch-target inline-flex items-center gap-1.5 px-2.5 text-xs sm:gap-2 sm:px-3.5 sm:text-sm"
      >
        <span className="auth-avatar-badge" aria-hidden="true">
          {initial}
        </span>
        <span className="hidden font-medium text-ink sm:inline">
          {formatCompactName(displayName)}
        </span>
        <span className="h-2 w-2 shrink-0 rounded-full bg-ok" aria-hidden="true" />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onOpenModal}
      disabled={isInitializing}
      aria-label={t.auth.headerSignInAria}
      className="btn-primary touch-target inline-flex items-center gap-1 px-2.5 text-xs whitespace-nowrap sm:gap-2 sm:px-4 sm:text-sm"
    >
      <LogIn className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" aria-hidden="true" />
      <span>{t.auth.headerSignIn}</span>
    </button>
  );
});
