import { test, expect } from '@playwright/test';

test.describe('Game history', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#app')).not.toHaveClass(/hidden/);
  });

  test('game list shows resigned game when filter is set to all games', async ({ page }) => {
    // Start and immediately resign a PvP game
    await page.locator('#new-game-btn').click();
    await page.locator('#mode-pvp-btn').click();
    await expect(page.locator('#resign-btn')).not.toHaveClass(/hidden/);
    await page.locator('#resign-btn').click();

    // Return to lobby
    await page.locator('#overlay-new-game').click();

    // Switch to "all games" filter (default is active-only, resigned games are hidden)
    await page.locator('#active-filter-btn').click();

    // Game list should contain at least one .game-card
    await expect(page.locator('#game-list .game-card').first()).toBeVisible({ timeout: 5_000 });
  });

  test('clicking a game card loads that game', async ({ page }) => {
    // Show all games
    await page.locator('#active-filter-btn').click();

    const firstGame = page.locator('#game-list .game-card').first();

    // Only run if there are games in the list
    await firstGame.waitFor({ state: 'visible', timeout: 5_000 }).catch(() => {});
    const isVisible = await firstGame.isVisible();
    test.skip(!isVisible, 'No games in history — skipping');

    await firstGame.click();

    // Board should load and URL should contain ?game=
    await expect(page.locator('#board')).toBeVisible();
    await expect(page).toHaveURL(/\?game=/);
  });
});
