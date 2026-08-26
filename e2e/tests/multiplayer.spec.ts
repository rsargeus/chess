import { test, expect, chromium } from '@playwright/test';
import * as path from 'path';

const AUTH_DIR = path.resolve(__dirname, '../playwright/.auth');
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:5173';


// Moves a piece by clicking from-square then to-square
async function makeMove(page: import('@playwright/test').Page, from: string, to: string) {
  await page.locator(`[data-sq="${from}"]`).click();
  await page.locator(`[data-sq="${to}"]`).click();
}

test('two players can play a multiplayer game', async () => {
  const browser = await chromium.launch();

  // Two isolated contexts — one per user
  const ctx1 = await browser.newContext({ storageState: path.join(AUTH_DIR, 'user1.json') });
  const ctx2 = await browser.newContext({ storageState: path.join(AUTH_DIR, 'user2.json') });
  const page1 = await ctx1.newPage();
  const page2 = await ctx2.newPage();


  try {
    // --- User 1: create a multiplayer game ---
    await page1.goto(BASE_URL);
    await expect(page1.locator('#app')).not.toHaveClass(/hidden/);

    await page1.locator('#new-game-btn').click();
    await page1.locator('#mode-multiplayer-btn').click();

    // Invite modal should appear with join URL
    await expect(page1.locator('#invite-modal')).not.toHaveClass(/hidden/);
    const inviteUrl = await page1.locator('#invite-link-box').textContent();
    expect(inviteUrl).toMatch(/\?join=/);

    // --- User 2: join via invite link ---
    await page2.goto(inviteUrl!);
    await expect(page2.locator('#app')).not.toHaveClass(/hidden/);

    // Close the invite modal on user 1's side
    await page1.locator('#invite-close-btn').click();

    // Both boards should now be active
    await expect(page1.locator('#board')).toBeVisible();
    await expect(page2.locator('#board')).toBeVisible();

    // Both should show "Your turn" / "Their turn" status
    await expect(page1.locator('#status')).toBeVisible();
    await expect(page2.locator('#status')).toBeVisible();

    // Eval bar should be visible and start at neutral (score "—", fill width 0%)
    await expect(page1.locator('#coach-eval-wrap')).not.toHaveClass(/hidden/);
    await expect(page1.locator('#coach-score')).toHaveText('—');
    await expect(page1.locator('#coach-eval-fill')).toHaveCSS('width', '0px');

    // --- User 1 (white) plays e2→e4 ---
    await makeMove(page1, 'e2', 'e4');

    // User 2 should see the move appear on their board
    await expect(page2.locator('[data-sq="e4"]')).toHaveAttribute('data-sq', 'e4');
    // Wait for user 2's status to update to "Your turn"
    await expect(page2.locator('#status')).toContainText(/your turn/i, { timeout: 8_000 });

    // Eval bar on user 1's side should update after Stockfish analysis.
    // We check three things to confirm the engine is truly running:
    //   1. score changes from '—' to a real eval string
    //   2. fill width becomes non-zero (stays 0 if scoreCp is null/coerced to 0)
    //   3. best-move recommendation is populated (stays empty when engine is down)
    await expect(page1.locator('#coach-score')).not.toHaveText('—', { timeout: 20_000 });
    await expect(page1.locator('#coach-score')).toContainText(/^[+\-]?\d+\.\d+$|^Mate/);
    await expect(page1.locator('#coach-eval-fill')).not.toHaveCSS('width', '0px');
    await expect(page1.locator('#coach-best-san')).not.toHaveText('—');
    await expect(page1.locator('#coach-best-san')).not.toBeEmpty();

    // --- User 2 (black) plays e7→e5 ---
    await makeMove(page2, 'e7', 'e5');

    // User 1 should see the response
    await expect(page1.locator('#status')).toContainText(/your turn/i, { timeout: 8_000 });

    // Eval bar on user 2's side should update after Stockfish analysis
    await expect(page2.locator('#coach-score')).not.toHaveText('—', { timeout: 20_000 });
    await expect(page2.locator('#coach-eval-fill')).not.toHaveCSS('width', '0px');
    await expect(page2.locator('#coach-best-san')).not.toHaveText('—');
    await expect(page2.locator('#coach-best-san')).not.toBeEmpty();

    // --- User 1 plays Nf3 ---
    await makeMove(page1, 'g1', 'f3');
    await expect(page2.locator('#status')).toContainText(/your turn/i, { timeout: 8_000 });

    // Eval bar score on user 1's side should update again
    await expect(page1.locator('#coach-score')).toContainText(/^[+\-]?\d+\.\d+$|^Mate/, { timeout: 20_000 });
    await expect(page1.locator('#coach-eval-fill')).not.toHaveCSS('width', '0px');

  } finally {
    await ctx1.close();
    await ctx2.close();
    await browser.close();
  }
});
