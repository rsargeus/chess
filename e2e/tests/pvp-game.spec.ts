import { test, expect } from '@playwright/test';

test.describe('PvP game', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#app')).not.toHaveClass(/hidden/);
  });

  test('starts a PvP game and shows the board', async ({ page }) => {
    await page.locator('#new-game-btn').click();
    await expect(page.locator('#mode-modal')).not.toHaveClass(/hidden/);

    await page.locator('#mode-pvp-btn').click();

    // Board should be visible and resign button should appear
    await expect(page.locator('#board')).toBeVisible();
    await expect(page.locator('#resign-btn')).not.toHaveClass(/hidden/);
    await expect(page.locator('#new-game-btn')).toHaveClass(/hidden/);
  });

  test('resign shows game-over overlay', async ({ page }) => {
    // Start a PvP game
    await page.locator('#new-game-btn').click();
    await page.locator('#mode-pvp-btn').click();
    await expect(page.locator('#resign-btn')).not.toHaveClass(/hidden/);

    await page.locator('#resign-btn').click();

    await expect(page.locator('#overlay')).not.toHaveClass(/hidden/);
    await expect(page.locator('#overlay-msg')).toContainText(/resigned/i);
  });

  test('after resign, "Quit" button returns to lobby', async ({ page }) => {
    await page.locator('#new-game-btn').click();
    await page.locator('#mode-pvp-btn').click();
    await page.locator('#resign-btn').click();
    await expect(page.locator('#overlay')).not.toHaveClass(/hidden/);

    await page.locator('#overlay-new-game').click();

    // Overlay should hide and new-game button should reappear
    await expect(page.locator('#overlay')).toHaveClass(/hidden/);
    await expect(page.locator('#new-game-btn')).not.toHaveClass(/hidden/);
  });
});
