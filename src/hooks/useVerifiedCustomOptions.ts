import { useCallback, useSyncExternalStore } from 'react';

export type CustomVerifyCategory = 'role' | 'tightness' | 'cookingFuel';

export interface VerifiedCustomOption {
  readonly id: string;
  readonly label: string;
  readonly mappedValue: string;
  readonly explanation: string;
}

interface VerifiedCustomStoreState {
  readonly optionsByCategory: Record<CustomVerifyCategory, readonly VerifiedCustomOption[]>;
  readonly activeIdByScope: Record<string, string>;
}

const STORAGE_KEY = 'pranapulse_verified_custom_options_v1';
export const CUSTOM_OPTION_PREFIX = 'custom:';
const SLUG_NON_ALNUM_RE = /[^a-z0-9]+/g;
const SLUG_EDGE_DASH_RE = /^-+|-+$/g;
const MAX_CUSTOM_PER_CATEGORY = 12;

function createEmptyState(): VerifiedCustomStoreState {
  return {
    optionsByCategory: { role: [], tightness: [], cookingFuel: [] },
    activeIdByScope: {},
  };
}

function isValidCustomOption(item: unknown): item is VerifiedCustomOption {
  if (!item || typeof item !== 'object') {
    return false;
  }
  const rec = item as Record<string, unknown>;
  return (
    typeof rec.id === 'string' &&
    rec.id.startsWith(CUSTOM_OPTION_PREFIX) &&
    typeof rec.label === 'string' &&
    rec.label.trim().length > 0 &&
    typeof rec.mappedValue === 'string' &&
    typeof rec.explanation === 'string'
  );
}

function readCategoryList(raw: unknown): readonly VerifiedCustomOption[] {
  return Array.isArray(raw)
    ? raw.filter(isValidCustomOption).slice(0, MAX_CUSTOM_PER_CATEGORY)
    : [];
}

function readActiveMap(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== 'object') {
    return {};
  }
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === 'string' && v.startsWith(CUSTOM_OPTION_PREFIX)) {
      out[k] = v;
    }
  }
  return out;
}

function parsePersistedState(raw: string): VerifiedCustomStoreState {
  const parsed = JSON.parse(raw) as Partial<VerifiedCustomStoreState> | null;
  const opts = parsed?.optionsByCategory;
  return {
    optionsByCategory: {
      role: readCategoryList(opts?.role),
      tightness: readCategoryList(opts?.tightness),
      cookingFuel: readCategoryList(opts?.cookingFuel),
    },
    activeIdByScope: readActiveMap(parsed?.activeIdByScope),
  };
}

function loadInitialState(): VerifiedCustomStoreState {
  if (typeof window === 'undefined') {
    return createEmptyState();
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? parsePersistedState(raw) : createEmptyState();
  } catch {
    return createEmptyState();
  }
}

let storeState: VerifiedCustomStoreState = loadInitialState();
const listeners = new Set<() => void>();

function persistAndEmit(next: VerifiedCustomStoreState): void {
  storeState = next;
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Ignore storage quota or private-mode failures.
    }
  }
  for (const listener of listeners) {
    listener();
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): VerifiedCustomStoreState {
  return storeState;
}

function buildCustomOptionId(label: string): string {
  const slug = label.toLowerCase().replace(SLUG_NON_ALNUM_RE, '-').replace(SLUG_EDGE_DASH_RE, '');
  const fallback = slug.length > 0 ? slug : encodeURIComponent(label.toLowerCase());
  return `${CUSTOM_OPTION_PREFIX}${fallback}`;
}

function upsertCategoryOption(
  existing: readonly VerifiedCustomOption[],
  option: VerifiedCustomOption,
): readonly VerifiedCustomOption[] {
  const filtered = existing.filter((item) => item.id !== option.id);
  return [...filtered, option].slice(-MAX_CUSTOM_PER_CATEGORY);
}

function saveCustomOptionToStore(
  category: CustomVerifyCategory,
  scopeKey: string,
  entry: Omit<VerifiedCustomOption, 'id'>,
): VerifiedCustomOption {
  const option: VerifiedCustomOption = { ...entry, id: buildCustomOptionId(entry.label) };
  const cur = storeState;
  persistAndEmit({
    optionsByCategory: {
      ...cur.optionsByCategory,
      [category]: upsertCategoryOption(cur.optionsByCategory[category], option),
    },
    activeIdByScope: { ...cur.activeIdByScope, [scopeKey]: option.id },
  });
  return option;
}

function selectCustomOptionInStore(
  category: CustomVerifyCategory,
  scopeKey: string,
  id: string,
): VerifiedCustomOption | null {
  const found = storeState.optionsByCategory[category].find((item) => item.id === id) ?? null;
  if (!found) {
    return null;
  }
  persistAndEmit({
    ...storeState,
    activeIdByScope: { ...storeState.activeIdByScope, [scopeKey]: found.id },
  });
  return found;
}

function clearCustomScopeInStore(scopeKey: string): void {
  if (!(scopeKey in storeState.activeIdByScope)) {
    return;
  }
  const nextActive = { ...storeState.activeIdByScope };
  Reflect.deleteProperty(nextActive, scopeKey);
  persistAndEmit({ ...storeState, activeIdByScope: nextActive });
}

/** Checks whether a `<select>` option value represents a verified custom entry. */
export function isCustomOptionId(value: string): boolean {
  return value.startsWith(CUSTOM_OPTION_PREFIX);
}

/** Resets in-memory and persisted verified custom options (used in automated tests). */
export function resetVerifiedCustomOptions(): void {
  storeState = createEmptyState();
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore storage errors in test environments.
    }
  }
  for (const listener of listeners) {
    listener();
  }
}

/**
 * Shared React hook storing AI-verified custom dropdown options per category
 * and active custom selection per field scope across tabs (e.g., Family Routine <-> Indoor & CADR).
 */
export function useVerifiedCustomOptions(category: CustomVerifyCategory, scopeKey: string) {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const customOptions = snapshot.optionsByCategory[category];
  const activeId = snapshot.activeIdByScope[scopeKey];
  const activeCustom = activeId
    ? (customOptions.find((item) => item.id === activeId) ?? null)
    : null;

  const saveAndSelectCustom = useCallback(
    (entry: Omit<VerifiedCustomOption, 'id'>): VerifiedCustomOption =>
      saveCustomOptionToStore(category, scopeKey, entry),
    [category, scopeKey],
  );
  const selectCustomById = useCallback(
    (id: string): VerifiedCustomOption | null => selectCustomOptionInStore(category, scopeKey, id),
    [category, scopeKey],
  );
  const clearActiveCustom = useCallback((): void => {
    clearCustomScopeInStore(scopeKey);
  }, [scopeKey]);

  return {
    customOptions,
    activeCustom,
    saveAndSelectCustom,
    selectCustomById,
    clearActiveCustom,
  };
}
