import { test, expect, passphrase } from './fixtures';

test.describe('Auth', () => {
  test('shows login screen on first load', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#login-passphrase')).toBeVisible();
  });

  test('wrong passphrase shows error', async ({ page }) => {
    await page.goto('/');
    await page.locator('#login-passphrase').fill('totally-wrong-passphrase-xyz');
    await page.getByRole('button', { name: 'Sign In' }).click();
    await expect(page.getByText('Incorrect passphrase')).toBeVisible();
  });

  test('correct passphrase lands on dashboard', async ({ page }) => {
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
