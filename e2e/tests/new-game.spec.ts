import { test, expect } from '@playwright/test';

test.describe('New game', () => {
  test('logged-in user sees the app', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#app')).not.toHaveClass(/hidden/);
    await expect(page.locator('#login-screen')).toHaveClass(/hidden/);
  });

  test('can open new game dialog', async ({ page }) => {
    await page.goto('/');
    await page.locator('#new-game-btn').click();
    await expect(page.locator('#mode-modal')).not.toHaveClass(/hidden/, { timeout: 5_000 });
  });
});
