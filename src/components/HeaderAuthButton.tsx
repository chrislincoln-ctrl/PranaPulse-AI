import type { User } from '@supabase/supabase-js';
import { LogIn } from 'lucide-react';
import { memo, type ReactElement } from 'react';
import { getUserDisplayName } from '../services/supabaseClient.js';

export interface HeaderAuthButtonProps {
  readonly user: User | null;
  readonly isInitializing: boolean;
  readonly onOpenModal: () => void;
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
}: HeaderAuthButtonProps): ReactElement {
  if (user) {
    const displayName = getUserDisplayName(user);
    const initial = displayName.charAt(0).toUpperCase();
    return (
      <button
        type="button"
        onClick={onOpenModal}
        aria-label={`Open cloud account settings for ${displayName}`}
        className="btn-secondary touch-target inline-flex items-center gap-2 text-sm"
      >
        <span className="auth-avatar-badge" aria-hidden="true">
          {initial}
        </span>
        <span className="font-medium text-ink">{formatCompactName(displayName)}</span>
        <span className="h-2 w-2 rounded-full bg-ok" aria-hidden="true" />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onOpenModal}
      disabled={isInitializing}
      aria-label="Sign in to PranaPulse AI"
      className="btn-primary touch-target inline-flex items-center gap-2 text-sm"
    >
      <LogIn className="h-4 w-4" aria-hidden="true" />
      <span>Sign in</span>
    </button>
  );
});

