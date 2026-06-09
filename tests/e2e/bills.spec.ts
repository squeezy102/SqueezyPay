/**
 * Bills E2E tests.
 *
 * ISOLATION RULES (non-negotiable):
 * - Every test that creates a bill must delete it before the test ends.
 * - Cleanup runs in a `try/finally` block so it fires even on failure.
 * - Bill names include a per-invocation UUID suffix so parallel workers
 *   never conflict — each worker operates on its own named data.
 * - After every test the database must be exactly as it was before.
 */
import { test, expect, type Page } from './fixtures';

/** Navigate to the Bills tab via the sidebar nav button */
async function goToBills(page: Page) {
  await page.getByRole('button', { name: 'Bills' }).click();
  await expect(page.getByRole('button', { name: 'Overview' })).toBeVisible();
}

/** Navigate to the Manage Billers sub-view */
async function goToManageBillers(page: Page) {
  await goToBills(page);
  await page.getByRole('button', { name: 'Manage Billers' }).click();
  await expect(page.getByRole('button', { name: 'Add Biller' })).toBeVisible();
}

/**
 * Create a biller with the given unique name.
 * Returns a cleanup function that deletes it — call inside finally.
 */
async function createBill(page: Page, name: string): Promise<() => Promise<void>> {
  await page.getByRole('button', { name: 'Add Biller' }).click();

  await page.locator('#bill-form-name').fill(name);
  await page.locator('#bill-form-url').fill('https://example.com');

  const dayInput = page.locator('#bill-form-day-of-month');
  await dayInput.fill('');
  await dayInput.fill('15');

  await page.getByRole('button', { name: 'Add Bill' }).click();
  await expect(page.getByText(name)).toBeVisible({ timeout: 8_000 });

  return async () => {
    // If the Manage Billers view is not visible, navigate back to it first
    const addBillerVisible = await page.getByRole('button', { name: 'Add Biller' }).isVisible();
    if (!addBillerVisible) {
      await goToManageBillers(page);
    }

    const deleteBtn = page.getByRole('button', { name: `Delete ${name}` });
    const btnExists = await deleteBtn.isVisible({ timeout: 3_000 }).catch(() => false);
    if (!btnExists) return; // already gone — nothing to clean up

    await deleteBtn.click();
    await expect(page.getByRole('heading', { name: 'Delete biller?' })).toBeVisible();

    // Click the destructive "Delete" button inside the confirm dialog
    await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
    await expect(page.getByText(name)).not.toBeVisible({ timeout: 8_000 });
  };
}

test.describe('Bills', () => {
  test('bills tab loads and shows sub-nav pills', async ({ loggedInPage: page }) => {
    await goToBills(page);

    await expect(page.getByRole('button', { name: 'Overview' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Pay Bills' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Payment History' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Manage Billers' })).toBeVisible();
  });

  test('can add a bill and it appears in the Manage Billers list', async ({ loggedInPage: page }) => {
    const name = `E2E Bill ${crypto.randomUUID()}`;
    await goToManageBillers(page);

    const cleanup = await createBill(page, name);
    try {
      await expect(page.getByText(name)).toBeVisible();
    } finally {
      await cleanup();
    }
  });

  test('can delete a bill from the Manage Billers list', async ({ loggedInPage: page }) => {
    const name = `E2E Bill ${crypto.randomUUID()}`;
    await goToManageBillers(page);

    const cleanup = await createBill(page, name);
    try {
      // Verify it exists before deleting
      await expect(page.getByText(name)).toBeVisible();
      // Cleanup deletes it — this is the thing under test here
    } finally {
      await cleanup();
    }

    // After cleanup the bill must be gone
    await expect(page.getByText(name)).not.toBeVisible({ timeout: 8_000 });
  });
});
