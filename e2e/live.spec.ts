import { expect, test } from '@playwright/test';
import { API, api, apiToken, dropBusiness, signIn } from './helpers';

let token: string;
let shop: { id: string; name: string } | undefined;
let shopToken: string;

test.beforeAll(async () => {
  token = await apiToken();
  // Our own shop, with a password we know, so it can write in as itself.
  const stamp = Date.now().toString(36);
  const email = `e2e+live-${stamp}@example.com`;
  const password = `E2e-password-${stamp}`;
  const made = await api<{ business: { id: string; name: string } }>(token, 'POST', '/admin/businesses', {
    businessName: `E2E Live ${stamp}`,
    ownerName: 'E2E Owner',
    ownerEmail: email,
    password,
    subscribedTo: new Date(Date.now() + 20 * 24 * 3600_000).toISOString(),
  });
  if (made.status !== 201) throw new Error(`Could not create the test business: ${JSON.stringify(made.body)}`);
  shop = made.body.business;
  const login = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  shopToken = ((await login.json()) as { accessToken: string }).accessToken;
});
test.afterAll(async () => {
  if (shop) await dropBusiness(token, shop);
});

test('a shop writing in lights up the Support badge within seconds', async ({ page }) => {
  await signIn(page);
  await Promise.all([
    page.waitForResponse((r) => r.url().endsWith('/api/admin/events') && r.status() === 200),
    page.goto('/support'),
  ]);
  const badge = page.getByLabel(/waiting for a reply$/);
  const before = (await badge.count()) ? Number(await badge.innerText()) : 0;

  const ticket = await api(shopToken, 'POST', '/support', {
    category: 'HOW_TO',
    subject: 'Live check: how do I print a receipt?',
    body: 'Testing that the panel hears this at once.',
  });
  expect(ticket.status).toBe(201);

  // The badge polls every minute; this is the push.
  await expect(badge).toHaveAccessibleName(`${before + 1} waiting for a reply`, { timeout: 5_000 });
});
