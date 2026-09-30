import { expect, test } from '@playwright/test';
import { apiToken, dropBusiness, makeBusiness, signIn } from './helpers';

let token: string;
let shop: { id: string; name: string };

test.beforeAll(async () => {
  token = await apiToken();
  shop = await makeBusiness(token, 'Onboarding', 20);
});
test.afterAll(async () => {
  if (shop) await dropBusiness(token, shop);
});

test('a brand-new shop shows up with nothing set up yet, and is not stuck yet', async ({ page }) => {
  await signIn(page);
  await page.goto('/onboarding');
  await page.getByLabel('Which shops').selectOption('recent');
  const row = page.locator('tr', { hasText: shop.name });
  await expect(row).toBeVisible();
  await expect(row).toContainText('Signed up today');
  await expect(row).toContainText('0/5');
  await expect(row).not.toContainText('stuck');
});
