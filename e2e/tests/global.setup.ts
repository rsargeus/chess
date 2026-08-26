import { test as setup, expect, Browser, BrowserContext } from '@playwright/test';
import * as path from 'path';

const AUTH_DIR = path.resolve(__dirname, '../playwright/.auth');

async function loginUser(
  browser: Browser,
  email: string,
  password: string,
  authFile: string,
): Promise<void> {
  const context: BrowserContext = await browser.newContext();
  const page = await context.newPage();

  await page.goto(process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:5173');
  await page.locator('#login-email-btn').click();
  await page.waitForURL(/auth0\.com/);

  await page.locator('input[name="username"]').fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.locator('button[type="submit"], button[name="action"]').first().click();

  // Handle consent screen if it appears
  const acceptBtn = page.locator('button:has-text("Accept")');
  try {
    await acceptBtn.waitFor({ state: 'visible', timeout: 8_000 });
    await acceptBtn.click();
  } catch {
    // No consent screen
  }

  await page.waitForURL(/localhost:5173/, { timeout: 20_000 });
  await expect(page.locator('#app')).not.toHaveClass(/hidden/, { timeout: 10_000 });

  await context.storageState({ path: authFile });
  await context.close();
}

setup('authenticate both users', async ({ browser }) => {
  await loginUser(
    browser,
    process.env.PLAYWRIGHT_USER1_EMAIL!,
    process.env.PLAYWRIGHT_USER1_PASSWORD!,
    path.join(AUTH_DIR, 'user1.json'),
  );

  await loginUser(
    browser,
    process.env.PLAYWRIGHT_USER2_EMAIL!,
    process.env.PLAYWRIGHT_USER2_PASSWORD!,
    path.join(AUTH_DIR, 'user2.json'),
  );
});
