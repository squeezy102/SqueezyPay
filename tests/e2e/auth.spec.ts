/**
 * Auth tests require a fresh browser context with no stored session so we can
 * test the login screen, wrong-passphrase errors, and logout flow.
 * Each test uses `browser.newContext()` (no storageState) to ensure it starts
 * from a completely unauthenticated state.
 */
import { test as base, expect, passphrase } from './fixtures';
import { Browser, BrowserContext, Page } from '@playwright/test';

const test = base.extend<{ freshPage: Page }, { browser: Browser }>({
  freshPage: async ({ browser }, use) => {
    // Explicitly create a context with no storageState
    const ctx: BrowserContext = await browser.newContext();
    const page: Page = await ctx.newPage();
    await use(page);
    await ctx.close();
  },
});

test.describe('Auth', () => {
  test('shows login screen on first load', async ({ freshPage: page }) => {
    await page.goto('/');
    await expect(page.locator('#login-passphrase')).toBeVisible();
  });

  test('wrong passphrase shows error', async ({ freshPage: page }) => {
    await page.goto('/');
    await page.locator('#login-passphrase').fill('totally-wrong-passphrase-xyz');
    await page.getByRole('button', { name: 'Sign In' }).click();
    await expect(page.getByText('Incorrect passphrase')).toBeVisible();
  });

  test('correct passphrase lands on dashboard', async ({ freshPage: page }) => {
    await page.goto('/');
    await page.locator('#login-passphrase').fill(passphrase());
    await page.getByRole('button', { name: 'Sign In' }).click();
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 10_000 });
  });

  test('logout returns to login screen', async ({ loggedInPage: page }) => {
    await page.getByRole('button', { name: 'Sign Out' }).click();
    await expect(page.locator('#login-passphrase')).toBeVisible({ timeout: 5_000 });
  });
});
