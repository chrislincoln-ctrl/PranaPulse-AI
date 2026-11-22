import { AlertCircle, CheckCircle2, X } from 'lucide-react';
import { memo, useEffect, useState, type ReactElement } from 'react';
import type { SupabaseAuthController } from '../hooks/useSupabaseAuth.js';
import type { PlanRequestPayload } from '../validators/schemas.js';
import { AccountProfileSection } from './AccountProfileSection.js';
import { AuthFormSection, type AuthMode } from './AuthFormSection.js';
import { CornerReticles } from './HeroMasthead.js';

export interface AuthModalProps {
  readonly isOpen: boolean;
  readonly auth: SupabaseAuthController;
  readonly workspaceInput: PlanRequestPayload;
  readonly onClose: () => void;
  readonly onSignedInSuccess?: () => void;
  readonly onContinueAsGuest?: () => void;
}

function getModalTitle(isSignedIn: boolean, mode: AuthMode): string {
  if (isSignedIn) {
    return 'Cloud account & sync';
  }
  if (mode === 'signup') {
    return 'Create your telemetry account';
  }
  if (mode === 'reset') {
    return 'Reset account password';
  }
  return 'Sign in to PranaPulse AI';
}

function FeedbackBanners({
  errorMessage,
  noticeMessage,
}: {
  readonly errorMessage: string | null;
  readonly noticeMessage: string | null;
}): ReactElement | null {
  if (!errorMessage && !noticeMessage) {
    return null;
  }
  return (
    <div className="space-y-2">
      {errorMessage && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-bad/40 bg-bad-soft p-3 text-xs text-bad"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{errorMessage}</span>
        </div>
      )}
      {noticeMessage && (
        <div
          role="status"
          className="flex items-start gap-2 rounded-lg border border-ok/40 bg-ok-soft p-3 text-xs text-ok"
        >
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{noticeMessage}</span>
        </div>
      )}
    </div>
  );
}

function AuthModalHeader({
  title,
  onClose,
}: {
  readonly title: string;
  readonly onClose: () => void;
}): ReactElement {
  return (
    <div className="auth-modal-banner">
      <div className="relative z-10 flex items-start justify-between gap-3">
        <div className="space-y-2">
          <div className="hero-hud-badge flex-nowrap! whitespace-nowrap">
            <span className="relative flex h-2 w-2 shrink-0" aria-hidden="true">
              <span className="hud-pulse-ring bg-ok" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-ok" />
            </span>
            <span className="measured text-[10px] font-semibold tracking-[0.08em] text-ink uppercase sm:text-[11px] sm:tracking-[0.14em]">
              Supabase Auth · Cloud Sync
            </span>
          </div>
          <h2 id="auth-modal-title" className="text-xl font-bold tracking-tight text-ink">
            {title}
          </h2>
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Close sign-in dialog"
          className="btn-secondary touch-target inline-flex items-center justify-center px-2.5"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

function useModalDismissEffect(isOpen: boolean, onClose: () => void): void {
  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen, onClose]);
}

function AuthModalBody({
  auth,
  workspaceInput,
  mode,
  onChangeMode,
  onSignedIn,
  onGuest,
}: {
  readonly auth: SupabaseAuthController;
  readonly workspaceInput: PlanRequestPayload;
  readonly mode: AuthMode;
  readonly onChangeMode: (next: AuthMode) => void;
  readonly onSignedIn: () => void;
  readonly onGuest?: (() => void) | undefined;
}): ReactElement {
  return (
    <div className="space-y-4 p-4 sm:p-6">
      <FeedbackBanners errorMessage={auth.errorMessage} noticeMessage={auth.noticeMessage} />
      {auth.user ? (
        <AccountProfileSection user={auth.user} auth={auth} workspaceInput={workspaceInput} />
      ) : (
        <AuthFormSection
          auth={auth}
          mode={mode}
          onChangeMode={onChangeMode}
          onSignedInSuccess={onSignedIn}
          onContinueAsGuest={onGuest}
        />
      )}
    </div>
  );
}

function wrapCloseAction(
  onClose: () => void,
  action: (() => void) | undefined,
): (() => void) | undefined {
  if (!action) {
    return undefined;
  }
  return () => {
    onClose();
    action();
  };
}

/**
 * Accessible Supabase Auth & Cloud Profile modal styled to match the PranaPulse AI
 * telemetry console in both Light and Dark modes.
 */
export const AuthModal = memo(function AuthModal({
  isOpen,
  auth,
  workspaceInput,
  onClose,
  onSignedInSuccess,
  onContinueAsGuest,
}: AuthModalProps): ReactElement | null {
  const [mode, setMode] = useState<AuthMode>('signin');
  useModalDismissEffect(isOpen, onClose);
  if (!isOpen) {
    return null;
  }
  const handleSignedIn = (): void => {
    onClose();
    onSignedInSuccess?.();
  };

  return (
    <div className="auth-backdrop">
      <button
        type="button"
        tabIndex={-1}
        aria-hidden="true"
        onClick={onClose}
        className="fixed inset-0 z-0 cursor-default bg-transparent"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-modal-title"
        className="auth-dialog z-10"
      >
        <CornerReticles />
        <AuthModalHeader title={getModalTitle(Boolean(auth.user), mode)} onClose={onClose} />
        <AuthModalBody
          auth={auth}
          workspaceInput={workspaceInput}
          mode={mode}
          onChangeMode={setMode}
          onSignedIn={handleSignedIn}
          onGuest={wrapCloseAction(onClose, onContinueAsGuest)}
        />
      </div>
    </div>
  );
});
