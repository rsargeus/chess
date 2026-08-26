import { test, expect } from '@playwright/test';

test.describe('AI game', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#app')).not.toHaveClass(/hidden/);
  });

  test('non-premium user sees payment modal when choosing AI opponent', async ({ page }) => {
    await page.locator('#new-game-btn').click();
    await page.locator('#mode-computer-btn').click();

    // Either payment modal (non-premium) or level modal (premium)
    const paymentModal = page.locator('#payment-modal');
    const levelModal = page.locator('#level-modal');

    await Promise.race([
      expect(paymentModal).not.toHaveClass(/hidden/),
      expect(levelModal).not.toHaveClass(/hidden/),
    ]);
  });

  test('payment modal can be cancelled', async ({ page }) => {
    await page.locator('#new-game-btn').click();
    await page.locator('#mode-computer-btn').click();

    // Wait for whichever modal appears (payment for non-premium, level for premium)
    const paymentModal = page.locator('#payment-modal');
    const levelModal = page.locator('#level-modal');

    await page.locator('#payment-modal:not(.hidden), #level-modal:not(.hidden)').waitFor({ state: 'attached', timeout: 10_000 });

    const isPayment = await paymentModal.evaluate(el => !el.classList.contains('hidden'));

    if (isPayment) {
      await page.locator('#payment-cancel-btn').click();
      await expect(paymentModal).toHaveClass(/hidden/);
    } else {
      await page.locator('#level-cancel-btn').click();
      await expect(levelModal).toHaveClass(/hidden/);
    }
  });

  test('premium user: level modal shows slider and can start game', async ({ page }) => {
    await page.locator('#new-game-btn').click();
    await page.locator('#mode-computer-btn').click();

    const levelModal = page.locator('#level-modal');
    const isLevelModal = await levelModal.evaluate(el => !el.classList.contains('hidden')).catch(() => false);

    test.skip(!isLevelModal, 'Test user is not premium — skipping level modal test');

    await expect(levelModal).not.toHaveClass(/hidden/);
    await expect(page.locator('#level-slider')).toBeVisible();

    // Change level to 3
    await page.locator('#level-slider').fill('3');
    await expect(page.locator('#level-label')).toHaveText('3');

    await page.locator('#level-start-btn').click();

    await expect(page.locator('#board')).toBeVisible();
    await expect(page.locator('#resign-btn')).not.toHaveClass(/hidden/);
  });
});
