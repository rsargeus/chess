import { test, expect } from '@playwright/test';

async function makeMove(page: import('@playwright/test').Page, from: string, to: string) {
  await page.locator(`[data-sq="${from}"]`).click();
  await page.locator(`[data-sq="${to}"]`).click();
}

test.describe('Play from this position', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/me', async (route) => {
      if (route.request().method() === 'GET' && !route.request().url().endsWith('/profile')) {
        await route.fulfill({ json: { premium: true } });
      } else {
        await route.continue();
      }
    });

    await page.goto('/');
    await expect(page.locator('#app')).not.toHaveClass(/hidden/);

    // Start a vs Computer game at level 1
    await page.locator('#new-game-btn').click();
    await page.locator('#mode-computer-btn').click();
    await page.locator('#level-slider').fill('1');
    await page.locator('#level-start-btn').click();
    await expect(page.locator('#status')).toContainText(/your turn/i);

    // Make two full moves (player + AI responds twice)
    await makeMove(page, 'e2', 'e4');
    await expect(page.locator('#status')).toContainText(/your turn/i, { timeout: 15_000 });
    await makeMove(page, 'd2', 'd4');
    await expect(page.locator('#status')).toContainText(/your turn/i, { timeout: 15_000 });

    // Now we have at least 4 moves in history (2 player + 2 AI)
  });

  test('"Play from here" button is hidden when viewing latest position', async ({ page }) => {
    await expect(page.locator('#play-from-btn')).toHaveClass(/hidden/);
  });

  test('"Play from here" button appears when navigating back', async ({ page }) => {
    await page.locator('#nav-back-btn').click();
    await expect(page.locator('#play-from-btn')).not.toHaveClass(/hidden/);
  });

  test('play from white-to-move position: player can move own pieces, game continues', async ({ page }) => {
    // Navigate back to a white-to-move position (after even number of half-moves)
    // Go back 2 half-moves so it's white's turn again
    await page.locator('#nav-back-btn').click();
    await page.locator('#nav-back-btn').click();

    await expect(page.locator('#play-from-btn')).not.toHaveClass(/hidden/);

    // Verify status before clicking
    const moveListBefore = await page.locator('#move-list .move-row').count();

    await page.locator('#play-from-btn').click();

    // Button should hide again (now at latest position)
    await expect(page.locator('#play-from-btn')).toHaveClass(/hidden/, { timeout: 5_000 });

    // Status should say "Your turn" — it's white's turn and player is white
    await expect(page.locator('#status')).toContainText(/your turn/i, { timeout: 5_000 });

    // Move list should be shorter — later moves were removed
    const moveListAfter = await page.locator('#move-list .move-row').count();
    expect(moveListAfter).toBeLessThan(moveListBefore);

    // Player can still move a white piece — click e.g. Nf3 or d4 pawn
    // Just verify a white square is selectable (has highlights after click)
    await page.locator('[data-sq="g1"]').click();
    await expect(page.locator('[data-sq="f3"]')).toHaveClass(/highlight/, { timeout: 3_000 });
  });

  test('play from black-to-move position: AI plays automatically, then player can move', async ({ page }) => {
    test.setTimeout(60_000);

    // Navigate back 1 half-move → black's turn (after white's last move)
    await page.locator('#nav-back-btn').click();

    await expect(page.locator('#play-from-btn')).not.toHaveClass(/hidden/);

    await page.locator('#play-from-btn').click();

    // Wait for "Play from here" to hide — signals setMoveHistory + board.setFen(interactive=true) completed
    await expect(page.locator('#play-from-btn')).toHaveClass(/hidden/, { timeout: 20_000 });

    // Status should say "Your turn" — AI auto-played, now it's white's turn
    await expect(page.locator('#status')).toContainText(/your turn/i, { timeout: 5_000 });

    // Player should be able to select a white piece (g1 knight)
    await page.locator('[data-sq="g1"]').click();
    await expect(page.locator('[data-sq="f3"]')).toHaveClass(/highlight/, { timeout: 3_000 });

    // Black pieces should NOT be selectable — click a black pawn and expect no highlights
    await page.locator('[data-sq="g1"]').click(); // deselect
    await page.locator('[data-sq="d7"]').click(); // try clicking black pawn
    const blackHighlights = await page.locator('.square.highlight').count();
    expect(blackHighlights).toBe(0);
  });
});
