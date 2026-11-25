import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

async function waitForThemeTransitions(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          resolve();
        });
      });
    });
    const transitions = document.getAnimations().filter((anim) => anim instanceof CSSTransition);
    await Promise.all(transitions.map((anim) => anim.finished.catch(() => undefined)));
  });
}

async function enterWorkbenchAsGuest(page: Page): Promise<void> {
  const launchBtn = page.getByRole('button', { name: /Launch Live Console/i });
  await expect(launchBtn).toBeVisible();
  await launchBtn.click();
  const continueGuestBtn = page.getByRole('button', { name: /Continue as Guest/i });
  if (await continueGuestBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
    await continueGuestBtn.click();
  }
  await expect(page.getByRole('tablist')).toBeVisible();
}

test.describe('PranaPulse AI live E2E, WCAG 2.2 AA & Hallmark viewport verification', () => {
  test('verifies landing showcase, enters workbench, passes WCAG 2.2 AA in Dark/Light modes, and navigates all sections', async ({
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

    await expect(page.locator('html')).toHaveAttribute('data-mode', 'dark');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    const landingAxe = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(landingAxe.violations).toEqual([]);

    await enterWorkbenchAsGuest(page);

    const heading = page.getByRole('heading', { level: 1 });
    await expect(heading).toBeVisible();
    const heroChart = page.getByRole('img', { name: /24-hour boundary layer/i });
    await expect(heroChart).toBeVisible();

    const hasHorizOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    expect(hasHorizOverflow).toBe(false);

    const darkAxe = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(darkAxe.violations).toEqual([]);

    await page.getByRole('button', { name: /Light mode/i }).click();
    await expect(page.locator('html')).toHaveAttribute('data-mode', 'light');
    await waitForThemeTransitions(page);
    const lightAxe = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(lightAxe.violations).toEqual([]);

    await page.getByRole('button', { name: /Dark mode/i }).click();
    await expect(page.locator('html')).toHaveAttribute('data-mode', 'dark');
    await waitForThemeTransitions(page);

    await page.getByRole('tab', { name: /Indoor & CADR/i }).click();
    await expect(page.getByText(/Corsi-Rosenthal DIY box specs/i)).toBeVisible();

    await page.getByRole('tab', { name: /Commute & Route/i }).click();
    await expect(page.getByRole('img', { name: /Dijkstra clean-corridor network/i })).toBeVisible();

    await page.getByRole('tab', { name: /^RWA$/i }).click();
    await expect(page.getByRole('button', { name: /Copy RWA bulletin/i })).toBeVisible();

    await page.getByLabel(/Language/i).selectOption('hi');
    await expect(page.locator('html')).toHaveAttribute('lang', 'hi');

    const tabAxe = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(tabAxe.violations).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test('renders mobile 375x812 cleanly without horizontal overflow across landing and workbench tabs', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');

    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    const landingOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    expect(landingOverflow).toBe(false);

    await enterWorkbenchAsGuest(page);
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

    await page.getByRole('tab', { name: /^RWA$/i }).click();
    await expect(page.getByRole('heading', { level: 1, name: /^RWA$/i })).toBeVisible();

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
