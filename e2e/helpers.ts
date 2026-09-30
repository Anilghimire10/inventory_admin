import { expect, type Page } from '@playwright/test';

export const API = process.env.API_URL ?? 'http://localhost:3000/api';
export const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'admin@platform.com';
export const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? 'admin12345';

/** A signed-in admin token, straight from the API (for setup and cleanup). */
export async function apiToken() {
  const res = await fetch(`${API}/admin/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'user-agent': 'admin-e2e' },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });
  const body = (await res.json()) as { accessToken?: string };
  if (!body.accessToken) throw new Error(`Admin sign-in failed: ${JSON.stringify(body)}`);
  return body.accessToken;
}

export async function api<T>(token: string, method: string, path: string, body?: unknown): Promise<{ status: number; body: T }> {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, body: (await res.json().catch(() => null)) as T };
}

/**
 * A business made for one test: unique name, an owner with a password (so
 * no invite email), paid until `paidDays` from now. Delete it with
 * `dropBusiness` when done.
 */
export async function makeBusiness(token: string, label: string, paidDays = 20) {
  const stamp = Date.now().toString(36);
  const name = `E2E ${label} ${stamp}`;
  const res = await api<{ business: { id: string; name: string } }>(token, 'POST', '/admin/businesses', {
    businessName: name,
    ownerName: 'E2E Owner',
    ownerEmail: `e2e+${stamp}@example.com`,
    password: `E2e-password-${stamp}`,
    subscribedTo: new Date(Date.now() + paidDays * 24 * 3600_000).toISOString(),
  });
  if (res.status !== 201) throw new Error(`Could not create the test business: ${JSON.stringify(res.body)}`);
  return res.body.business;
}

export async function dropBusiness(token: string, b: { id: string; name: string }) {
  await api(token, 'DELETE', `/admin/businesses/${b.id}`, { confirmName: b.name });
}

export async function signIn(page: Page) {
  await page.goto('/login');
  await page.fill('input[type=email]', ADMIN_EMAIL);
  await page.fill('input[type=password]', ADMIN_PASSWORD);
  await page.click('button[type=submit]');
  await expect(page).not.toHaveURL(/\/login/, { timeout: 30_000 });
}
