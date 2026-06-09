/**
 * Runs once before all test workers start.
 * Logs in with the E2E passphrase and saves the browser session to
 * .auth/session.json so all workers share it without re-authenticating.
 *
 * SECURITY: SQUEEZYPAY_E2E_PASSPHRASE must be set in the environment.
 * There is no fallback — a missing env var fails loudly here before any
 * test runs, ensuring no hardcoded credential can ever appear in source.
 */
import { test as setup, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const SESSION_FILE = path.join('.auth', 'session.json');

setup('authenticate', async ({ page }) => {
  const passphrase = process.env.SQUEEZYPAY_E2E_PASSPHRASE;
  if (!passphrase) {
    throw new Error(
      'SQUEEZYPAY_E2E_PASSPHRASE is not set. ' +
        'Set this environment variable before running E2E tests. ' +
        'See wiki/Testing.md for instructions.',
    );
  }

  await page.goto('/');
  await page.locator('#login-passphrase').fill(passphrase);
  await page.getByRole('button', { name: 'Sign In' }).click();
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 15_000 });

  // Persist the authenticated session for all workers
  fs.mkdirSync('.auth', { recursive: true });
  await page.context().storageState({ path: SESSION_FILE });
});
