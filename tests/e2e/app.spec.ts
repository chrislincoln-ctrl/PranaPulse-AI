import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test.describe('PranaPulse AI live E2E, WCAG 2.2 AA & Hallmark viewport verification', () => {
  test('fits hero telemetry above 1280x800 fold, passes full axe color-contrast in Light and Dark modes, and supports full interaction flows', async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');

    await expect(page.locator('html')).toHaveAttribute('data-mode', 'light');

    const heading = page.getByRole('heading', { level: 1 });
    await expect(heading).toBeVisible();

    const heroChart = page.getByRole('img', { name: /24-hour boundary layer/i });
    await expect(heroChart).toBeVisible();

    // Hallmark Gate 44b: Hero H1 and focal chart fit completely inside initial 1280x800 viewport
    const hBox = await heading.boundingBox();
    const chartBox = await heroChart.boundingBox();
    expect(hBox).not.toBeNull();
    expect(chartBox).not.toBeNull();
    if (hBox && chartBox) {
      expect(hBox.y).toBeGreaterThanOrEqual(0);
      expect(chartBox.y + chartBox.height).toBeLessThanOrEqual(800);
    }

    // Verify zero horizontal scrollbars (Hallmark Gate 34)
    const hasHorizOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    expect(hasHorizOverflow).toBe(false);

    // Real Chromium WCAG 2.2 AA + color-contrast audit on Light Mode default screen
    const lightAxe = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(lightAxe.violations).toEqual([]);

    // Toggle to Dark Mode and verify full WCAG 2.2 AA color-contrast in Dark Mode
    await page.getByRole('button', { name: /Dark mode/i }).click();
    await expect(page.locator('html')).toHaveAttribute('data-mode', 'dark');
    const darkAxe = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(darkAxe.violations).toEqual([]);

    // Toggle back to Light Mode
    await page.getByRole('button', { name: /Light mode/i }).click();
    await expect(page.locator('html')).toHaveAttribute('data-mode', 'light');

    // Navigate workbench tabs and verify streaming Q&A + Hindi switch
    await page.getByRole('tab', { name: /Indoor & CADR/i }).click();
    await expect(page.getByText(/Corsi-Rosenthal DIY box specs/i)).toBeVisible();

    await page.getByRole('tab', { name: /Commute & Route/i }).click();
    await expect(page.getByRole('img', { name: /Dijkstra clean-corridor network/i })).toBeVisible();

    await page.getByRole('tab', { name: /RWA & Advisor/i }).click();
    await expect(page.getByRole('button', { name: /Ask advisor/i })).toBeDisabled();
    const input = page.getByPlaceholder(/Ask about school commute/i);
    await input.fill('Window schedule check');
    await page.getByRole('button', { name: /Ask advisor/i }).click();
    await expect(page.locator('[aria-live="polite"]')).toContainText(/ug\/m3|windows/i);

    await page.getByLabel(/Language/i).selectOption('hi');
    await expect(page.locator('html')).toHaveAttribute('lang', 'hi');

    const tabAxe = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(tabAxe.violations).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test('renders mobile 375x812 cleanly without horizontal overflow and switches sections without hero scrolling', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');

    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await page.getByRole('tab', { name: /Family Routine/i }).click();
    const routineHeading = page.getByRole('heading', { level: 1, name: /Family Routine/i });
    await expect(routineHeading).toBeVisible();

    const routineBox = await routineHeading.boundingBox();
    expect(routineBox).not.toBeNull();
    if (routineBox) {
      expect(routineBox.y).toBeLessThan(460);
    }

    await page.getByRole('button', { name: /Next: Indoor & CADR/i }).click();
    await expect(page.getByRole('heading', { level: 1, name: /Indoor & CADR/i })).toBeVisible();

    const offenders = await page.evaluate(() => {
      if (document.documentElement.scrollWidth <= window.innerWidth) {
        return [];
      }
      return Array.from(document.querySelectorAll('*'))
        .map((el) => ({
          tag: el.tagName,
          cls: (el.getAttribute('class') ?? '').slice(0, 40),
          right: Math.round(el.getBoundingClientRect().right),
        }))
        .filter((item) => item.right > window.innerWidth)
        .slice(0, 8);
    });
    expect(offenders).toEqual([]);
  });
});
