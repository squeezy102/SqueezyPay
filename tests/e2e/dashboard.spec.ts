import { test, expect } from './fixtures';

test.describe('Dashboard', () => {
  test('dashboard shows key sections after login', async ({ loggedInPage: page }) => {
    // Heading confirms we're on the dashboard
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();

    // Sidebar nav items confirm structural elements are present
    await expect(page.getByRole('button', { name: 'Bills' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Income' })).toBeVisible();

    // Page should not show any error / crash state
    await expect(page.locator('body')).not.toContainText('Something went wrong');
    await expect(page.locator('body')).not.toContainText('Unexpected Application Error');
  });
});
