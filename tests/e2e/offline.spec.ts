import { test, expect } from './fixtures';

test.describe('Offline banner', () => {
  test(
    'offline banner appears when backend is unreachable and disappears on recovery',
    async ({ loggedInPage: page }) => {
      // Intercept health check to simulate a down backend
      await page.route('**/health', (route) =>
        route.fulfill({ status: 503, body: 'Service Unavailable' }),
      );

      // Give the initial poll time to complete — it fires at t=0 and sets
      // firstPollDone=true on the useBackendHealth hook. The first failure is
      // intentionally swallowed to avoid a false-positive banner on startup.
      await page.waitForTimeout(500);

      // Trigger an immediate re-poll via the browser's "online" event.
      // The hook listens for this event and fires an unthrottled check.
      await page.evaluate(() => window.dispatchEvent(new Event('online')));

      // Banner should now appear quickly (role="alert", text contains "Backend offline")
      await page.getByRole('alert').waitFor({ timeout: 5_000 });
      await expect(page.getByRole('alert')).toContainText('Backend offline');

      // Restore the real health endpoint
      await page.unroute('**/health');

      // Trigger another online event to force an immediate re-check
      await page.evaluate(() => window.dispatchEvent(new Event('online')));

      // Banner should disappear once the health check succeeds
      await expect(page.getByRole('alert')).not.toBeVisible({ timeout: 10_000 });
    },
  );
});
