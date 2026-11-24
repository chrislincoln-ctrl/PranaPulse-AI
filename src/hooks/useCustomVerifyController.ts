import { useState } from 'react';
import { formatCustomDisplayLabel } from '../utils/inputSanitizer.js';
import type { SupportedLanguage } from '../validators/schemas.js';
import {
  isCustomOptionId,
  useVerifiedCustomOptions,
  type CustomVerifyCategory,
  type VerifiedCustomOption,
} from './useVerifiedCustomOptions.js';

export const OTHER_SENTINEL = '__other__';

export interface VerifyApiResult {
  readonly isValid: boolean;
  readonly mappedValue: string;
  readonly explanation: string;
  readonly displayLabel?: string;
}

export interface CustomVerifyControllerParams {
  readonly category: CustomVerifyCategory;
  readonly scopeKey: string;
  readonly language: SupportedLanguage;
  readonly onChangeValue: (nextValue: string) => void;
}

interface DrawerResetters {
  readonly setIsOtherOpen: (open: boolean) => void;
  readonly setCustomText: (val: string) => void;
  readonly setFeedback: (val: VerifyApiResult | null) => void;
  readonly setShowNote: (open: boolean) => void;
}

const CLIENT_VERIFY_TIMEOUT_MS = 10_000;
const NETWORK_FALLBACK_MSG =
  'Verification request timed out or was rate-limited. Please try again.';

async function requestCustomVerification(params: {
  readonly category: CustomVerifyCategory;
  readonly customText: string;
  readonly language: SupportedLanguage;
}): Promise<VerifyApiResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, CLIENT_VERIFY_TIMEOUT_MS);
  try {
    const res = await fetch('/api/verify-custom', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
      signal: controller.signal,
    });
    if (res.ok) {
      return (await res.json()) as VerifyApiResult;
    }
    return { isValid: false, mappedValue: '', explanation: NETWORK_FALLBACK_MSG };
  } catch {
    return { isValid: false, mappedValue: '', explanation: NETWORK_FALLBACK_MSG };
  } finally {
    clearTimeout(timer);
  }
}

function handlePickedOption(
  picked: string,
  store: ReturnType<typeof useVerifiedCustomOptions>,
  onChangeValue: (nextValue: string) => void,
  setIsOtherOpen: (open: boolean) => void,
): void {
  if (picked === OTHER_SENTINEL) {
    setIsOtherOpen(true);
    return;
  }
  setIsOtherOpen(false);
  if (isCustomOptionId(picked)) {
    const selected = store.selectCustomById(picked);
    if (selected) {
      onChangeValue(selected.mappedValue);
    }
    return;
  }
  store.clearActiveCustom();
  onChangeValue(picked);
}

function commitVerifyResponse(
  res: VerifyApiResult,
  trimmed: string,
  store: ReturnType<typeof useVerifiedCustomOptions>,
  callbacks: DrawerResetters & { readonly onChangeValue: (nextValue: string) => void },
): void {
  if (!res.isValid) {
    callbacks.setFeedback(res);
    return;
  }
  const label = formatCustomDisplayLabel(res.displayLabel ?? trimmed) || trimmed;
  store.saveAndSelectCustom({ label, mappedValue: res.mappedValue, explanation: res.explanation });
  callbacks.onChangeValue(res.mappedValue);
  callbacks.setIsOtherOpen(false);
  callbacks.setCustomText('');
  callbacks.setFeedback(null);
  callbacks.setShowNote(false);
}

interface VerifyFlowContext extends DrawerResetters {
  readonly category: CustomVerifyCategory;
  readonly language: SupportedLanguage;
  readonly store: ReturnType<typeof useVerifiedCustomOptions>;
  readonly onChangeValue: (nextValue: string) => void;
  readonly setVerifying: (busy: boolean) => void;
}

function executeVerification(rawText: string, ctx: VerifyFlowContext): void {
  const trimmed = rawText.trim();
  if (!trimmed) {
    return;
  }
  ctx.setVerifying(true);
  void requestCustomVerification({
    category: ctx.category,
    customText: trimmed,
    language: ctx.language,
  })
    .then((res) => {
      commitVerifyResponse(res, trimmed, ctx.store, ctx);
    })
    .finally(() => {
      ctx.setVerifying(false);
    });
}

/**
 * Coordinates AI verification, auto-adding verified entries into the shared dropdown store,
 * and automatically minimizing the entry drawer once approved.
 */
export function useCustomVerifyController({
  category,
  scopeKey,
  language,
  onChangeValue,
}: CustomVerifyControllerParams) {
  const store = useVerifiedCustomOptions(category, scopeKey);
  const [isOtherOpen, setIsOtherOpen] = useState(false);
  const [customText, setCustomText] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [feedback, setFeedback] = useState<VerifyApiResult | null>(null);
  const [showNote, setShowNote] = useState(false);

  const runVerify = (): void => {
    executeVerification(customText, {
      category,
      language,
      store,
      onChangeValue,
      setVerifying,
      setIsOtherOpen,
      setCustomText,
      setFeedback,
      setShowNote,
    });
  };
  const selectOption = (picked: string): void => {
    setFeedback(null);
    setShowNote(false);
    handlePickedOption(picked, store, onChangeValue, setIsOtherOpen);
  };
  const toggleNote = (): void => {
    setShowNote((prev) => !prev);
  };

  return {
    ...store,
    isOtherOpen,
    customText,
    verifying,
    feedback,
    showNote,
    setCustomText,
    toggleNote,
    runVerify,
    selectOption,
  };
}

/** Resolves which `<option value>` is selected inside a CustomVerifiedSelect. */
export function resolveCustomSelectValue(
  isOtherOpen: boolean,
  activeCustom: VerifiedCustomOption | null,
  value: string,
): string {
  if (isOtherOpen) {
    return OTHER_SENTINEL;
  }
  return activeCustom ? activeCustom.id : value;
}
