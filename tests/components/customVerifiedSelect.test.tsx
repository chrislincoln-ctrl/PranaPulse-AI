import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState, type ReactElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CustomVerifiedSelect } from '../../src/components/CustomVerifiedSelect.js';
import type { CookingFuelType } from '../../src/domain/types.js';
import { resetVerifiedCustomOptions } from '../../src/hooks/useVerifiedCustomOptions.js';
import { TRANSLATIONS } from '../../src/i18n/translations.js';

const FUEL_OPTIONS: readonly { readonly value: CookingFuelType; readonly label: string }[] = [
  { value: 'induction', label: 'Induction electric' },
  { value: 'lpg-vented', label: 'LPG with range hood exhaust' },
  { value: 'lpg-unvented', label: 'LPG without exhaust' },
  { value: 'solid-biomass', label: 'Solid fuel / biomass' },
];

function CookingFuelHarness({
  id = 'fuel-select',
  initial = 'lpg-vented',
  onEmit,
}: {
  readonly id?: string;
  readonly initial?: CookingFuelType;
  readonly onEmit?: (val: CookingFuelType) => void;
}): ReactElement {
  const [fuel, setFuel] = useState<CookingFuelType>(initial);
  return (
    <CustomVerifiedSelect
      id={id}
      label="Cooking fuel"
      category="cookingFuel"
      scopeKey="cookingFuel"
      value={fuel}
      options={FUEL_OPTIONS}
      language="en"
      onChangeValue={(next) => {
        setFuel(next);
        onEmit?.(next);
      }}
      t={TRANSLATIONS.en}
    />
  );
}

describe('CustomVerifiedSelect auto-minimize & shared dropdown option flow', () => {
  afterEach(() => {
    resetVerifiedCustomOptions();
    vi.restoreAllMocks();
  });

  it('keeps drawer expanded with red alert when AI rejects invalid input like Flying banana', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          isValid: false,
          mappedValue: 'lpg-unvented',
          displayLabel: '',
          explanation: 'Entry does not satisfy the condition for cooking fuel.',
        }),
        { status: 200 },
      ),
    );
    const onEmit = vi.fn();
    render(<CookingFuelHarness onEmit={onEmit} />);

    fireEvent.change(screen.getByLabelText('Cooking fuel'), { target: { value: '__other__' } });
    const input = screen.getByPlaceholderText(TRANSLATIONS.en.customInputPlaceholder);
    fireEvent.change(input, { target: { value: 'Flying banana' } });
    fireEvent.click(screen.getByRole('button', { name: TRANSLATIONS.en.verifyCustomButton }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Entry does not satisfy the condition for cooking fuel.',
      );
    });
    expect(screen.getByPlaceholderText(TRANSLATIONS.en.customInputPlaceholder)).toBeInTheDocument();
    expect(onEmit).not.toHaveBeenCalled();
  });

  it('adds verified custom option to dropdown, selects it, collapses drawer, and toggles AI note inline', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          isValid: true,
          mappedValue: 'solid-biomass',
          displayLabel: 'Kerosene',
          explanation: 'Kerosene maps closest to solid-biomass indoor emissions.',
        }),
        { status: 200 },
      ),
    );
    const onEmit = vi.fn();
    render(<CookingFuelHarness onEmit={onEmit} />);

    const select = screen.getByLabelText<HTMLSelectElement>('Cooking fuel');
    fireEvent.change(select, { target: { value: '__other__' } });
    fireEvent.change(screen.getByPlaceholderText(TRANSLATIONS.en.customInputPlaceholder), {
      target: { value: 'kersosene' },
    });
    fireEvent.click(screen.getByRole('button', { name: TRANSLATIONS.en.verifyCustomButton }));

    await waitFor(() => {
      expect(select.value).toBe('custom:kerosene');
    });
    expect(onEmit).toHaveBeenCalledWith('solid-biomass');
    expect(
      screen.queryByPlaceholderText(TRANSLATIONS.en.customInputPlaceholder),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: TRANSLATIONS.en.verifyCustomButton }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Kerosene' })).toBeInTheDocument();

    // Clicking the compact inline AI badge peeks the Gemini rationale on demand.
    const pill = screen.getByRole('button', { name: 'AI' });
    expect(pill).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(pill);
    expect(pill).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('status')).toHaveTextContent(
      'Kerosene maps closest to solid-biomass indoor emissions.',
    );
    fireEvent.click(pill);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();

    // Switching to a built-in option and back to the verified custom option works cleanly.
    fireEvent.change(select, { target: { value: 'induction' } });
    expect(select.value).toBe('induction');
    expect(onEmit).toHaveBeenLastCalledWith('induction');
    fireEvent.change(select, { target: { value: 'custom:kerosene' } });
    expect(select.value).toBe('custom:kerosene');
    expect(onEmit).toHaveBeenLastCalledWith('solid-biomass');
  });

  it('persists verified custom option across remounts (Family Routine -> Indoor CADR tab switch)', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          isValid: true,
          mappedValue: 'lpg-unvented',
          displayLabel: 'Kerosene Stove',
          explanation: 'Kerosene stove verified.',
        }),
        { status: 200 },
      ),
    );
    const first = render(<CookingFuelHarness id="roster-fuel" />);
    fireEvent.change(screen.getByLabelText('Cooking fuel'), { target: { value: '__other__' } });
    fireEvent.change(screen.getByPlaceholderText(TRANSLATIONS.en.customInputPlaceholder), {
      target: { value: 'kerosene stove' },
    });
    fireEvent.click(screen.getByRole('button', { name: TRANSLATIONS.en.verifyCustomButton }));

    await waitFor(() => {
      expect(screen.getByLabelText<HTMLSelectElement>('Cooking fuel').value).toBe(
        'custom:kerosene-stove',
      );
    });
    first.unmount();

    // Simulate switching to Indoor & CADR tab with the same synced physics value.
    render(<CookingFuelHarness id="indoor-fuel" initial="lpg-unvented" />);
    const remountedSelect = screen.getByLabelText<HTMLSelectElement>('Cooking fuel');
    expect(remountedSelect.value).toBe('custom:kerosene-stove');
    expect(screen.getByRole('option', { name: 'Kerosene Stove' })).toBeInTheDocument();
  });

  it('surfaces a visible error alert instead of failing silently on HTTP 504/429', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('Gateway Timeout', { status: 504 }),
    );
    render(<CookingFuelHarness />);
    fireEvent.change(screen.getByLabelText('Cooking fuel'), { target: { value: '__other__' } });
    fireEvent.change(screen.getByPlaceholderText(TRANSLATIONS.en.customInputPlaceholder), {
      target: { value: 'kerosene' },
    });
    fireEvent.click(screen.getByRole('button', { name: TRANSLATIONS.en.verifyCustomButton }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/timed out|try again/i);
    });
  });
});
