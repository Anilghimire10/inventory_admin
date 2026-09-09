# Inventory — Super Admin Panel

Platform-operator console (Next.js App Router). Sees and manages **every**
business — separate from the per-business customer app.

## Run

```bash
npm install
npm run dev        # http://localhost:5174
```

Requires the API (`../api`) running on :3000 — the admin app proxies `/api` to it
(see `next.config.mjs`). Override the target with `API_URL` in `.env`.

**Login** (seeded by the API's `npm run db:seed`):
`admin@platform.com` / `admin12345` — override via `PLATFORM_ADMIN_EMAIL` /
`PLATFORM_ADMIN_PASSWORD` in the API's `.env`.

## What it does

- **Overview** — platform-wide totals: businesses, users, products, total sales,
  active vs suspended counts, newest businesses.
- **Businesses** — searchable list of every tenant with user/product/sales counts.
- **Business detail** — profile, users, stores, recent sales, totals, and a
  **Suspend / Reactivate** action. Suspending a business locks out all its users
  (enforced in the API on login and on every request).

## Security model

Super-admins are a **separate account type** (`PlatformAdmin` table) with their
own login and JWT (`scope: 'platform'`), validated by a dedicated
`platform-jwt` Passport strategy. They are completely independent of tenant
(business) users — a tenant token can't access admin routes and vice-versa.
All admin endpoints live under `/api/admin/*` behind `PlatformAuthGuard`.
