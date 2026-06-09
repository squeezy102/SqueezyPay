/**
 * Shared Playwright fixtures.
 *
 * The app stores its JWT in sessionStorage, which Playwright's native
 * storageState does not persist across contexts. Instead, global.setup.ts
 * logs in once and writes the token to .auth/session.json. The loggedInPage
 * fixture reads that token and injects it via addInitScript before
 * navigating, so no worker ever calls /api/auth/login directly.
 *
 * This avoids rate limit exhaustion when many workers run in parallel.
 *
 * SECURITY: SQUEEZYPAY_E2E_PASSPHRASE must be set in the environment.
 * There is no fallback — a missing env var fails loudly in global.setup.ts
 * before any test runs. No hardcoded credential exists anywhere in source.
 */
import { test as base, expect, type Page } from '@playwright/test';
import fs from 'fs';
import path from 'path';

export type { Page };

const SESSION_FILE = path.join('.auth', 'session.json');
const TOKEN_KEY = 'squeezypay_token';

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

function readToken(): string {
  const raw = fs.readFileSync(SESSION_FILE, 'utf-8');
  const { token } = JSON.parse(raw) as { token: string };
  if (!token) throw new Error('.auth/session.json exists but contains no token');
  return token;
}

export const test = base.extend<{ loggedInPage: Page }>({
  /**
   * Provides a page that is already authenticated.
   * Injects the saved JWT into sessionStorage before navigating so the
   * app loads directly into the Dashboard without a login round-trip.
   */
  loggedInPage: async ({ page }, use) => {
    const token = readToken();

    // Inject the token into sessionStorage before the page loads
    await page.addInitScript(
      ({ key, value }: { key: string; value: string }) => {
        sessionStorage.setItem(key, value);
      },
      { key: TOKEN_KEY, value: token },
    );

    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 10_000 });
    await use(page);
  },
});

export { expect };
