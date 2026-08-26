import { test, expect } from '@playwright/test';

// Player move coordinates for the Réti opening (white side, 16-move line)
// moves: Nf3 d5 g3 Nf6 Bg2 e6 O-O Be7 c4 O-O b3 a5 Bb2 c6 d3 Nbd7
// Player moves (white, even indices): Nf3 g3 Bg2 O-O c4 b3 Bb2 d3
const RETI_PLAYER_MOVES: [string, string][] = [
  ['g1', 'f3'], // Nf3
  ['g2', 'g3'], // g3
  ['f1', 'g2'], // Bg2
  ['e1', 'g1'], // O-O
  ['c2', 'c4'], // c4
  ['b2', 'b3'], // b3
  ['c1', 'b2'], // Bb2
  ['d2', 'd3'], // d3
];

async function makeTrainingMove(page: import('@playwright/test').Page, from: string, to: string) {
  // Use the board container directly — #board is empty when no game is active,
  // so [data-sq] uniquely targets the training board squares.
  await page.locator(`[data-sq="${from}"]`).click();
  await page.locator(`[data-sq="${to}"]`).click();
}

// On mobile viewports the library is an off-canvas drawer (closed by
// default) instead of an always-visible sidebar — the toggle button only
// exists/is visible in that layout, so this is a no-op on desktop.
async function ensureLibraryOpen(page: import('@playwright/test').Page) {
  const toggle = page.locator('#training-lib-toggle-btn');
  if (await toggle.isVisible()) {
    await toggle.click();
  }
}

test.describe('Opening training', () => {
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
  });

  test('training overlay opens when clicking Training button', async ({ page }) => {
    await page.locator('#training-btn').click();
    await expect(page.locator('#training-overlay')).not.toHaveClass(/hidden/);
    await expect(page.locator('#training-lib-scroll')).toBeVisible();
  });

  test('search filters the opening library', async ({ page }) => {
    await page.locator('#training-btn').click();

    await page.locator('#training-search').fill('Réti');
    await expect(page.locator('.tlib-item')).toHaveCount(1);
    await expect(page.locator('.tlib-item')).toContainText('Réti');
  });

  test('selecting an opening starts training session', async ({ page }) => {
    await page.locator('#training-btn').click();

    // Search to make Réti (single-line) easy to find
    await page.locator('#training-search').fill('Réti');
    await ensureLibraryOpen(page);
    await page.locator('.tlib-item').click();

    // Board and status bar should appear
    await expect(page.locator('#training-board')).toBeVisible();
    await expect(page.locator('#tstat-text')).toContainText(/Din tur|your turn/i);
    await expect(page.locator('#tinfo-variant-name')).toContainText('Huvudlinjen');
  });

  test('wrong move shows error feedback and board stays interactive', async ({ page }) => {
    await page.locator('#training-btn').click();
    await page.locator('#training-search').fill('Réti');
    await ensureLibraryOpen(page);
    await page.locator('.tlib-item').click();
    await expect(page.locator('#tstat-text')).toContainText(/Din tur/i);

    // Make a wrong first move (a2→a4 instead of g1→f3)
    await makeTrainingMove(page, 'a2', 'a4');

    await expect(page.locator('#tinfo-feedback')).toHaveClass(/err/);
    await expect(page.locator('#tinfo-feedback')).toContainText(/Inte rätt/i);

    // Board must still be interactive — status shows "Fel drag" (not locked to AI)
    await expect(page.locator('#tstat-text')).toContainText(/Fel drag/i);
  });

  test('hint button highlights squares on training board', async ({ page }) => {
    await page.locator('#training-btn').click();
    await page.locator('#training-search').fill('Réti');
    await ensureLibraryOpen(page);
    await page.locator('.tlib-item').click();
    await expect(page.locator('#tstat-text')).toContainText(/Din tur/i);

    await page.locator('#training-hint-btn').click();

    // Hint squares should get css classes
    await expect(page.locator('#training-board .training-hint-from')).toBeVisible();
    await expect(page.locator('#training-board .training-hint-to')).toBeVisible();
  });

  test('close button hides training overlay', async ({ page }) => {
    await page.locator('#training-btn').click();
    await expect(page.locator('#training-overlay')).not.toHaveClass(/hidden/);

    await page.locator('#training-close-btn').click();
    await expect(page.locator('#training-overlay')).toHaveClass(/hidden/);
  });

  test('playing through Réti opening shows completion banner', async ({ page }) => {
    test.setTimeout(60_000);

    await page.locator('#training-btn').click();
    await page.locator('#training-search').fill('Réti');
    await ensureLibraryOpen(page);
    await page.locator('.tlib-item').click();

    for (let i = 0; i < RETI_PLAYER_MOVES.length; i++) {
      const [from, to] = RETI_PLAYER_MOVES[i];

      // For iterations after the first, wait for the AI to have played its previous
      // response (progress = 2*i: i player moves + i AI moves). This prevents the
      // loop from clicking too early while the session is still on the AI's turn.
      if (i > 0) {
        await expect(page.locator('#tstat-progress')).toContainText(`${2 * i} / 16`, { timeout: 10_000 });
      }

      await expect(page.locator('#tstat-text')).toContainText(/Din tur/i, { timeout: 5_000 });
      await makeTrainingMove(page, from, to);
      await expect(page.locator('#tinfo-feedback')).toContainText(/Rätt/i, { timeout: 5_000 });
    }

    // Completion banner should appear after the final AI move
    await expect(page.locator('#training-complete-banner')).toHaveClass(/show/, { timeout: 10_000 });
    await expect(page.locator('#tcb-title')).toContainText('Huvudlinjen');
  });

  test('Continue vs AI starts a game with opening moves pre-applied', async ({ page }) => {
    test.setTimeout(90_000);

    await page.locator('#training-btn').click();
    await page.locator('#training-search').fill('Réti');
    await ensureLibraryOpen(page);
    await page.locator('.tlib-item').click();

    for (let i = 0; i < RETI_PLAYER_MOVES.length; i++) {
      const [from, to] = RETI_PLAYER_MOVES[i];
      if (i > 0) {
        await expect(page.locator('#tstat-progress')).toContainText(`${2 * i} / 16`, { timeout: 10_000 });
      }
      await expect(page.locator('#tstat-text')).toContainText(/Din tur/i, { timeout: 5_000 });
      await makeTrainingMove(page, from, to);
      await expect(page.locator('#tinfo-feedback')).toContainText(/Rätt/i, { timeout: 5_000 });
    }

    await expect(page.locator('#training-complete-banner')).toHaveClass(/show/, { timeout: 10_000 });

    // Click "Fortsätt mot AI"
    await page.locator('#tcb-continue-btn').click();

    // Level modal should appear
    await expect(page.locator('#level-modal')).not.toHaveClass(/hidden/, { timeout: 10_000 });
    await page.locator('#level-slider').fill('1');
    await page.locator('#level-start-btn').click();

    // Game should start and training overlay should close
    await expect(page.locator('#training-overlay')).toHaveClass(/hidden/, { timeout: 10_000 });
    await expect(page.locator('#resign-btn')).not.toHaveClass(/hidden/, { timeout: 10_000 });
    await expect(page.locator('#undo-btn')).not.toHaveClass(/hidden/);

    // Move list should contain the opening moves (16 moves = 8 rows)
    await expect(page.locator('#move-list .move-row')).toHaveCount(8, { timeout: 10_000 });

    // First move in the list should be Nf3
    await expect(page.locator('#move-list .move-row').first()).toContainText('Nf3');
  });
});
