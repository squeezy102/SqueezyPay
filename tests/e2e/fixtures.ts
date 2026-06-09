/**
 * Shared Playwright fixtures.
 *
 * SECURITY: SQUEEZYPAY_E2E_PASSPHRASE must be set in the environment.
 * There is no fallback — a missing env var is an immediate test failure.
 * This prevents any hardcoded credential from existing in source code.
 */
import { test as base, expect, type Page } from '@playwright/test';

export type { Page };

function getPassphrase(): string {
  const p = process.env.SQUEEZYPAY_E2E_PASSPHRASE;
  if (!p) {
    throw new Error(
      'SQUEEZYPAY_E2E_PASSPHRASE is not set. ' +
        'Set this environment variable before running E2E tests. ' +
        'See tests/e2e/README.md for instructions.',
    );
  }
  return p;
}

/** Exported so specs can use it without re-reading the env var. */
export function passphrase(): string {
  return getPassphrase();
}

async function login(page: Page): Promise<void> {
  await page.goto('/');
  await page.locator('#login-passphrase').fill(getPassphrase());
  await page.getByRole('button', { name: 'Sign In' }).click();
  await page.getByRole('heading', { name: 'Dashboard' }).waitFor({ timeout: 10_000 });
}

export const test = base.extend<{ loggedInPage: Page }>({
  loggedInPage: async ({ page }, use) => {
    await login(page);
    await use(page);
  },
});

export { expect };
