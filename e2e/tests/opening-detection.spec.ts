import { test, expect } from '@playwright/test';

// Moves a piece by clicking from-square then to-square on the live game
// board, and waits for the turn indicator to flip before returning. Local
// PvP has no AI delay to naturally pace clicks — firing them back-to-back
// races the frontend's in-flight-submission guard and silently drops moves.
async function makeMove(
  page: import('@playwright/test').Page,
  from: string,
  to: string,
  nextTurn: 'White' | 'Black',
) {
  await page.locator(`#board [data-sq="${from}"]`).click();
  await page.locator(`#board [data-sq="${to}"]`).click();
  await expect(page.locator('#status')).toContainText(new RegExp(`${nextTurn} to move`, 'i'));
}

test.describe('Opening detection in a live game', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#app')).not.toHaveClass(/hidden/);

    // Local two-player mode — lets a single page control both colors so the
    // exact move sequence (and therefore which opening line matches) is
    // deterministic.
    await page.locator('#new-game-btn').click();
    await page.locator('#mode-pvp-btn').click();
    await expect(page.locator('#board')).toBeVisible();
  });

  test('live opening label appears above the board once a known line is reached', async ({ page }) => {
    await expect(page.locator('#opening-label')).toHaveClass(/hidden/);

    await makeMove(page, 'e2', 'e4', 'Black');
    await makeMove(page, 'e7', 'e5', 'White');
    await makeMove(page, 'g1', 'f3', 'Black');
    await makeMove(page, 'b8', 'c6', 'White');
    await makeMove(page, 'f1', 'b5', 'Black');
    await makeMove(page, 'a7', 'a6', 'White');

    await expect(page.locator('#opening-label')).not.toHaveClass(/hidden/);
    await expect(page.locator('#opening-label')).toContainText('C88');
    await expect(page.locator('#opening-label')).toContainText('Ruy López');
  });

  test('game-over overlay reports the deviation point and links into training that line', async ({ page }) => {
    await makeMove(page, 'e2', 'e4', 'Black');
    await makeMove(page, 'e7', 'e5', 'White');
    await makeMove(page, 'g1', 'f3', 'Black');
    await makeMove(page, 'b8', 'c6', 'White');
    await makeMove(page, 'f1', 'b5', 'Black');
    await makeMove(page, 'a7', 'a6', 'White');
    // Real Morphy Defense continues 7.Ba4 — play something else to deviate.
    await makeMove(page, 'd2', 'd3', 'Black');

    await page.locator('#resign-btn').click();
    await expect(page.locator('#overlay')).not.toHaveClass(/hidden/);

    const openingText = page.locator('#overlay-opening-text');
    await expect(openingText).toContainText('Ruy López');
    await expect(openingText).toContainText('Morphy');
    await expect(openingText).toContainText(/avvek/i);

    await page.locator('#overlay-opening-btn').click();

    // Deep-links straight into training that exact line.
    await expect(page.locator('#training-overlay')).not.toHaveClass(/hidden/);
    await expect(page.locator('#tinfo-variant-name')).toContainText('Morphy');
  });
});
