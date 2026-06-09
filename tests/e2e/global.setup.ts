/**
 * Runs once before all test workers start.
 * Logs in, extracts the JWT from sessionStorage, and writes it to
 * .auth/session.json for workers to inject before each test navigation.
 *
 * We use sessionStorage (not localStorage) in the app, which Playwright's
 * native storageState does not persist. Instead we read the token out and
 * let fixtures.ts inject it via addInitScript before every page.goto().
 *
 * SECURITY: SQUEEZYPAY_E2E_PASSPHRASE must be set in the environment.
 * There is no fallback — a missing env var fails loudly here before any
 * test runs. No hardcoded credential exists anywhere in source.
 */
import { test as setup, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const SESSION_FILE = path.join('.auth', 'session.json');
const TOKEN_KEY = 'squeezypay_token';

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

  // Extract the JWT from sessionStorage
  const token = await page.evaluate((key: string) => sessionStorage.getItem(key), TOKEN_KEY);
  if (!token) {
    throw new Error('Login succeeded but no token found in sessionStorage. Check TOKEN_KEY.');
  }

  fs.mkdirSync('.auth', { recursive: true });
  fs.writeFileSync(SESSION_FILE, JSON.stringify({ token }));
});
