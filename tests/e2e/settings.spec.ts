import { test, expect, passphrase, type Page } from './fixtures';

/** Navigate to the Settings tab */
async function goToSettings(page: Page) {
  await page.getByRole('button', { name: 'Settings' }).click();
  await expect(page.getByRole('heading', { name: 'Change Passphrase' })).toBeVisible();
}

test.describe('Settings', () => {
  test('settings tab loads and shows Change Passphrase section', async ({ loggedInPage: page }) => {
    await goToSettings(page);

    await expect(page.getByRole('heading', { name: 'Change Passphrase' })).toBeVisible();
    await expect(page.locator('#settings-current-passphrase')).toBeVisible();
    await expect(page.locator('#settings-new-passphrase')).toBeVisible();
    await expect(page.locator('#settings-confirm-passphrase')).toBeVisible();
  });

  test('wrong current passphrase shows error from backend', async ({ loggedInPage: page }) => {
    await goToSettings(page);

    await page.locator('#settings-current-passphrase').fill('wrong-passphrase-xyz');
    await page.locator('#settings-new-passphrase').fill('newpassword123');
    await page.locator('#settings-confirm-passphrase').fill('newpassword123');

    await page.getByRole('button', { name: 'Update Passphrase' }).click();

    await expect(page.getByText('Current passphrase is incorrect.')).toBeVisible({ timeout: 8_000 });
  });

  test('mismatched new passphrases show validation error', async ({ loggedInPage: page }) => {
    await goToSettings(page);

    await page.locator('#settings-current-passphrase').fill(passphrase());
    await page.locator('#settings-new-passphrase').fill('newpassword123');
    await page.locator('#settings-confirm-passphrase').fill('different-value-456');

    await page.getByRole('button', { name: 'Update Passphrase' }).click();

    await expect(page.getByText('New passphrases do not match.')).toBeVisible();
  });

  test('new passphrase under 8 characters shows validation error', async ({ loggedInPage: page }) => {
    await goToSettings(page);

    await page.locator('#settings-current-passphrase').fill(passphrase());
    await page.locator('#settings-new-passphrase').fill('short');
    await page.locator('#settings-confirm-passphrase').fill('short');

    await page.getByRole('button', { name: 'Update Passphrase' }).click();

    await expect(page.getByText('New passphrase must be at least 8 characters.')).toBeVisible();
  });
});
