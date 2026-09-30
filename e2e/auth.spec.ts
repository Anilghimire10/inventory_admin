import { expect, test } from '@playwright/test';
import { API, signIn } from './helpers';

test('sign in, see this browser in sessions, and sign out for real', async ({ page }) => {
  await signIn(page);
  await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible();

  await page.goto('/account');
  await expect(page.getByText("Where you're signed in")).toBeVisible();
  await expect(page.getByText('This browser')).toBeVisible();

  // Signing out must end the session on the server, not just drop the token here.
  const token = await page.evaluate(() => sessionStorage.getItem('admin_token'));
  expect(token).toBeTruthy();
  await page.getByRole('button', { name: /admin@|Platform Admin/ }).first().click();
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page).toHaveURL(/\/login/);
  const me = await fetch(`${API}/admin/auth/me`, { headers: { authorization: `Bearer ${token}` } });
  expect(me.status).toBe(401);
});
