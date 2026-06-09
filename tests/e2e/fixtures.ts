/**
 * Shared Playwright fixtures.
 *
 * Authentication is handled once in global.setup.ts via storageState.
 * Workers load the saved session — no worker calls /api/auth/login directly.
 * This avoids rate limit exhaustion when many workers run in parallel.
 *
 * SECURITY: SQUEEZYPAY_E2E_PASSPHRASE must be set in the environment.
 * There is no fallback — a missing env var fails loudly in global.setup.ts
 * before any test runs. No hardcoded credential exists anywhere in source.
 */
import { test as base, expect, type Page } from '@playwright/test';

export type { Page };

/**
 * Returns the E2E passphrase from the environment.
 * Throws immediately if not set — used by tests that must supply the
 * passphrase as input (e.g. settings tests verifying validation errors).
 */
export function passphrase(): string {
  const p = process.env.SQUEEZYPAY_E2E_PASSPHRASE;
  if (!p) {
    throw new Error(
      'SQUEEZYPAY_E2E_PASSPHRASE is not set. ' +
        'Set this environment variable before running E2E tests. ' +
        'See wiki/Testing.md for instructions.',
    );
  }
  return p;
}

export const test = base.extend<{ loggedInPage: Page }>({
  /**
   * Provides a page that is already on the Dashboard.
   * The storageState from global.setup.ts supplies the valid session —
   * no additional login request is made here.
   */
  loggedInPage: async ({ page }, use) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 10_000 });
    await use(page);
  },
});

export { expect };
