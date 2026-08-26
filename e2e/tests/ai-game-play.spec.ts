import { test, expect } from '@playwright/test';

// Moves a piece by clicking from-square then to-square
async function makeMove(page: import('@playwright/test').Page, from: string, to: string) {
  await page.locator(`[data-sq="${from}"]`).click();
  await page.locator(`[data-sq="${to}"]`).click();
}

test.describe('Playing against AI', () => {
  test.beforeEach(async ({ page }) => {
    // /me requires both Auth0 role AND premiumExpiresAt in DB to return premium:true.
    // Mock the frontend check — the backend game creation check uses the JWT directly.
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

  test('can start a game against AI at level 1', async ({ page }) => {
    await page.locator('#new-game-btn').click();
    await page.locator('#mode-computer-btn').click();

    await expect(page.locator('#level-modal')).not.toHaveClass(/hidden/);

    await page.locator('#level-slider').fill('1');
    await expect(page.locator('#level-label')).toHaveText('1');
    await expect(page.locator('#level-name')).toHaveText('Beginner');

    await page.locator('#level-start-btn').click();

    await expect(page.locator('#board')).toBeVisible();
    await expect(page.locator('#resign-btn')).not.toHaveClass(/hidden/);
    await expect(page.locator('#undo-btn')).not.toHaveClass(/hidden/);
    await expect(page.locator('#status')).toContainText(/your turn/i);
  });

  test('can play a move and AI responds', async ({ page }) => {
    await page.locator('#new-game-btn').click();
    await page.locator('#mode-computer-btn').click();
    await page.locator('#level-slider').fill('1');
    await page.locator('#level-start-btn').click();
    await expect(page.locator('#status')).toContainText(/your turn/i);

    await makeMove(page, 'e2', 'e4');

    await expect(page.locator('#status')).toContainText(/your turn/i, { timeout: 15_000 });

    await expect(page.locator('#move-list .move-row')).toHaveCount(1);
    await expect(page.locator('#move-list .move-row').first()).toContainText('e4');
  });

  test('undo removes the last two moves', async ({ page }) => {
    await page.locator('#new-game-btn').click();
    await page.locator('#mode-computer-btn').click();
    await page.locator('#level-slider').fill('1');
    await page.locator('#level-start-btn').click();
    await expect(page.locator('#status')).toContainText(/your turn/i);

    await makeMove(page, 'e2', 'e4');
    await expect(page.locator('#status')).toContainText(/your turn/i, { timeout: 15_000 });

    await expect(page.locator('#undo-btn')).toBeEnabled();
    await page.locator('#undo-btn').click();

    await expect(page.locator('#move-list .move-row')).toHaveCount(0, { timeout: 5_000 });
    await expect(page.locator('#status')).toContainText(/your turn/i);
  });

  test('eval bar and Stockfish analysis update after player move', async ({ page }) => {
    // This test exercises the real Stockfish engine. On a cold backend start the
    // engine can take up to 60 s to initialise, so use a generous test timeout.
    test.setTimeout(180_000);

    // Wait until the backend is ready (wake-up banner hides the button while it starts)
    await page.locator('#new-game-btn:not([disabled])').waitFor({ timeout: 90_000 });
    await page.locator('#new-game-btn').click();
    await page.locator('#mode-computer-btn').click();
    await page.locator('#level-slider').fill('1');
    await page.locator('#level-start-btn').click();
    await expect(page.locator('#status')).toContainText(/your turn/i);

    // Ensure eval bar is visible — toggle it on if hidden
    const evalWrap = page.locator('#coach-eval-wrap');
    if (await evalWrap.evaluate(el => el.classList.contains('hidden'))) {
      await page.locator('#eval-toggle-btn').click();
    }
    await expect(evalWrap).not.toHaveClass(/hidden/);
    // Before any move: score is '—', fill width is 0, best move is '—'
    await expect(page.locator('#coach-score')).toHaveText('—');
    await expect(page.locator('#coach-eval-fill')).toHaveCSS('width', '0px');
    await expect(page.locator('#coach-best-san')).toHaveText('—');

    await makeMove(page, 'e2', 'e4');

    // Wait for AI to respond
    await expect(page.locator('#status')).toContainText(/your turn/i, { timeout: 15_000 });

    // Score must change from '—' to a real eval
    await expect(page.locator('#coach-score')).not.toHaveText('—', { timeout: 20_000 });
    await expect(page.locator('#coach-score')).toContainText(/^[+\-]?\d+\.\d+$|^Mate/);

    // Eval bar fill must have non-zero width — this only happens when Stockfish
    // returns a real (non-null) score. If the engine is down, scoreCp comes back
    // as null which JavaScript coerces to 0, leaving the bar at 0 px.
    await expect(page.locator('#coach-eval-fill')).not.toHaveCSS('width', '0px');

    // Best-move recommendation must be populated with a chess move (e.g. "Nf3",
    // "d4"). When Stockfish is unavailable, bestMove is null and the element
    // becomes empty — this catches that failure explicitly.
    await expect(page.locator('#coach-best-san')).not.toHaveText('—');
    await expect(page.locator('#coach-best-san')).not.toBeEmpty();
  });

  test('"Ask coach" button appears after a move and loads a coaching message', async ({ page }) => {
    // Groq typically responds in 1–3 s but can be slower under load
    test.setTimeout(60_000);

    await page.locator('#new-game-btn').click();
    await page.locator('#mode-computer-btn').click();
    await page.locator('#level-slider').fill('1');
    await page.locator('#level-start-btn').click();
    await expect(page.locator('#status')).toContainText(/your turn/i);

    // "Ask coach" button should not be visible before any move
    await expect(page.locator('#coach-ask-row')).toHaveClass(/hidden/);

    await makeMove(page, 'e2', 'e4');

    // Wait for analysis to complete (spinner disappears)
    await expect(page.locator('#coach-spinner')).toHaveClass(/hidden/, { timeout: 15_000 });

    // "Ask coach" button should now be visible
    await expect(page.locator('#coach-ask-row')).not.toHaveClass(/hidden/);
    await expect(page.locator('#coach-ask-btn')).toBeVisible();
    await expect(page.locator('#coach-ask-btn')).toBeEnabled();

    // Message row hidden before clicking
    await expect(page.locator('#coach-msg-row')).toHaveClass(/hidden/);

    await page.locator('#coach-ask-btn').click();

    // Message appears, ask button disappears (Groq can take up to 20 s)
    await expect(page.locator('#coach-msg-row')).not.toHaveClass(/hidden/, { timeout: 20_000 });
    await expect(page.locator('#coach-msg')).not.toBeEmpty();
    await expect(page.locator('#coach-ask-row')).toHaveClass(/hidden/);
  });
});
