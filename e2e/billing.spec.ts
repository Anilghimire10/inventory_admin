import { expect, test } from '@playwright/test';
import { apiToken, dropBusiness, makeBusiness, signIn } from './helpers';

let token: string;
let shop: { id: string; name: string };

test.beforeAll(async () => {
  token = await apiToken();
  shop = await makeBusiness(token, 'Billing', 20);
});
test.afterAll(async () => {
  if (shop) await dropBusiness(token, shop);
});

test('record a payment, print its receipt, see the shop in Renewals', async ({ page }) => {
  await signIn(page);
  await page.goto(`/businesses/${shop.id}`);
  await page.getByRole('button', { name: /Record payment/ }).click();
  await page.getByLabel(/Amount/).fill('1500');
  // Keep the test from emailing anyone.
  await page.getByLabel('Email the receipt to the owner').uncheck();
  await page.getByRole('button', { name: /^Record/ }).last().click();
  await expect(page.getByText(/SUB-\d{6} recorded/)).toBeVisible();

  await page.getByRole('button', { name: 'payments', exact: true }).click();
  const printButton = page.getByRole('button', { name: /^Print SUB-/ }).first();
  const [receipt] = await Promise.all([page.waitForEvent('popup'), printButton.click()]);
  await receipt.waitForLoadState();
  const text = await receipt.locator('body').innerText();
  expect(text).toContain('RECEIPT');
  expect(text).toContain(shop.name);
  expect(text).toMatch(/1,500\.00/);
  await receipt.close();

  // Paid ~20 days + 1 month ahead now; the 90-day window has it.
  await page.goto('/renewals');
  await page.getByLabel('Ending within').selectOption('90');
  await expect(page.getByRole('link', { name: shop.name })).toBeVisible();
});

test('suspend a shop, then reactivate it', async ({ page }) => {
  await signIn(page);
  await page.goto(`/businesses/${shop.id}`);
  await page.getByRole('button', { name: 'Suspend' }).click();
  await page.getByLabel('Reason for suspension').fill('E2E test');
  await page.getByRole('button', { name: 'Suspend Business' }).click();
  await expect(page.getByText('Business has been suspended')).toBeVisible();
  await expect(page.getByText('Suspended', { exact: true }).first()).toBeVisible();

  await page.getByRole('button', { name: 'Reactivate' }).click();
  await page.getByRole('button', { name: 'Reactivate Business' }).click();
  await expect(page.getByText('Business reactivated successfully')).toBeVisible();
});
