# Super Admin Panel: Feature List

**Date:** 2026-09-19 · **Scope:** the `admin/` app, plus the endpoints it needs in
`api/src/platform/`

**Fonepay is deferred.** Subscriptions are handled manually: the admin records
each payment and extends the paid-until date. When Fonepay comes later, it only
needs to create the same payment records automatically, so the manual flow below
is its foundation.

**Tags:**

- `[UI]`: frontend only.
- `[API+UI]`: needs a backend endpoint in `api/src/platform/` as well.
- New endpoints below follow the existing `/api/admin/*` style and sit behind
  `PlatformAuthGuard`.

---

## Backend status (2026-09-19)

**The API for sections 1 and 2 is built and tested; the admin UI for it is not
yet.** Section 3 has no backend yet.

- **Before deploying:** apply migration `20260919120000_admin_panel` (additive only)
  with `cd api && npx prisma migrate deploy`.
- **Full request/response shapes:** Swagger at `/docs`.
- **Existing responses:** unchanged; fields were only added.

| Feature | Endpoint |
|---------|----------|
| 1.1 Sales per currency | `GET /admin/stats`: new `salesByCurrency[]` and `subscriptions { trial, expiringSoon, expired, inactive }` |
| 1.4 Filters, sorting | `GET /admin/businesses?status=&subscription=active\|trial\|expiring\|expired\|inactive\|no-expiry&type=&sort=newest\|oldest\|name\|sales\|expiry&days=7`. Each row gains `subscriptionStatus` |
| 1.5 Edit business | `PATCH /admin/businesses/:id` `{ name, type, salesModel, currency, taxId }` |
| 1.6 Suspension reason | `PATCH /admin/businesses/:id/suspend` `{ isSuspended, reason? }`; the reason appears in the shop's sign-in error |
| 2A.1 Trial | automatic on register (`TRIAL_DAYS`, default 14) |
| 2A.2 Payments | `POST /admin/businesses/:id/payments` `{ amount, method, months \| periodTo, periodFrom?, currency?, reference?, note? }`; `GET` the same path for history |
| 2A.3 Renewals | no separate endpoint: use `GET /admin/businesses?subscription=expiring&days=7&sort=expiry` (and `=expired`, `=trial`) |
| 2A.4 Reminders | runs daily at 09:00 server time (7/3/1/0 days before the end date); `POST /admin/businesses/:id/send-reminder` sends one now |
| 2B.1 Change password | `POST /admin/auth/change-password` `{ currentPassword, newPassword }`. Returns a new `accessToken`; older tokens stop working |
| 2B.2 Admin accounts | `GET` / `POST /admin/admins`, `PATCH /admin/admins/:id` `{ name?, isActive?, password? }` |
| 2B.3 Admin log | `GET /admin/audit-log?search=&adminId=&businessId=` |
| 2B.4 Hardening | login email normalised; admin sessions last 12h (`PLATFORM_JWT_EXPIRES_IN`) |
| 2C.1 User search | `GET /admin/users?search=` |
| 2C.2 Verify / resend | `POST /admin/users/:id/verify-email`, `POST /admin/users/:id/resend-verification` |
| 2C.3 Password reset | `POST /admin/users/:id/send-password-reset` |
| 2C.4 Edit user | `PATCH /admin/users/:id` `{ name?, email?, isActive? }` |
| 2C.5 Create business | `POST /admin/businesses` `{ businessName, ownerName, ownerEmail, type?, salesModel?, currency?, password?, subscribedTo? }`; returns `inviteSent` |

---

## ✅ Already built

- [x] Admin login and session: a separate `PlatformAdmin` account with a platform-only token.
- [x] Overview: businesses, users, products, platform sales, active and suspended counts, newest businesses.
- [x] Businesses list, with search and pagination.
- [x] Business detail:
  - suspend and reactivate;
  - activate or deactivate the subscription, with an end date;
  - staff and stores;
  - customers, sales (with a sale detail modal) and activity tabs.
- [x] Global activity feed, filterable by action.

---

## 1. Fix what's already there (small)

- [ ] **1.1 Platform sales total mixes currencies** `[API+UI]`
  - **Problem:** the overview adds sales from NPR and USD businesses together and
    shows the result as USD.
  - **Fix:** return totals grouped by `Business.currency` (a raw SQL join, since
    Prisma can't group sales by a business field) and show one figure per
    currency.
  - **Where:** `api/src/platform/platform.service.ts` → `stats()`, `admin/src/app/(dash)/page.tsx`.
- [ ] **1.2 Error states** `[UI]`
  - **Problem:** every page renders `isLoading || !data ? <Spinner />`, so a failed
    request spins forever.
  - **Fix:** show an error message with a Retry button.
- [ ] **1.3 Mobile navigation** `[UI]`
  - **Problem:** the sidebar is hidden below `lg`, and the mobile header only has
    "Sign out" (`src/app/(dash)/layout.tsx`), so on a phone you can't reach
    Businesses or Activity.
- [ ] **1.4 Businesses list: columns, filters, sorting** `[API+UI]`
  - **Columns to add:** subscription status (Trial / Active / Expiring / Expired)
    and the paid-until date.
  - **Filters:** active or suspended; subscription active, expiring within 7 days,
    expired or no expiry; business type.
  - **Sorting:** newest, name, most sales, expiry date.
  - **API:** add these query parameters to `GET /admin/businesses`.
- [ ] **1.5 Edit the business profile, including type** `[API+UI]`
  - The comment in `api/src/business/business.controller.ts` says only a
    super-admin can change the business type, but nothing implements it.
  - **Endpoint:** `PATCH /admin/businesses/:id` with `{ name, type, salesModel, currency, taxId }`.
- [ ] **1.6 Suspension reason** `[API+UI]`
  - **Schema:** add `Business.suspendedReason` and `Business.suspendedAt`.
  - **Panel:** require a reason when suspending, and show it on the business page.
  - **Shop side:** add the reason to the error message the shop's users see at login.
- [ ] **1.7 Replace `alert()` / `confirm()` with dialogs** `[UI]`
  - `Modal` already exists in `src/components/ui.tsx`.
- [ ] **1.8 Sale detail quantities** `[UI]`
  - `quantity` and `returnedQty` arrive as decimal strings (e.g. `"1.000"`), but
    `src/lib/api.ts` types them as `number`.
  - Type them as `string` and `Number()` them before comparing or displaying.

---

## 2. Must-have (before onboarding real shops)

### 2A. Subscriptions, handled manually

- [ ] **2A.1 Automatic trial on signup** `[API+UI]`
  - **Problem:** today every signup is free forever. The schema defaults are
    `isSubscribed = true` and `subscribedTo = null`.
  - **Fix:** on register (`api/src/auth/auth.service.ts` → `register()`), set
    `subscribedTo = now + TRIAL_DAYS`, with `TRIAL_DAYS` from env and a default of 14.
  - **Panel:** a business with no recorded payment shows a **Trial** badge.
- [ ] **2A.2 Record a payment** `[API+UI]`
  - **New table: `SubscriptionPayment`**

    | Field                    | Notes                                |
    | ------------------------ | ------------------------------------ |
    | `businessId`             |                                      |
    | `amount`, `currency`     |                                      |
    | `method`                 | CASH / BANK / ESEWA / KHALTI / OTHER |
    | `reference`              | receipt no., bank ref                |
    | `periodFrom`, `periodTo` | what the payment covers              |
    | `note`                   |                                      |
    | `recordedByAdminId`      |                                      |
    | `createdAt`              |                                      |

  - **Behaviour:** recording a payment sets `isSubscribed = true` and
    `subscribedTo = periodTo` in one transaction.
  - **Endpoints:** `POST /admin/businesses/:id/payments`, `GET /admin/businesses/:id/payments`.
  - **UI:**
    - a "Record payment" dialog, with quick +1 / +3 / +12 month buttons;
    - a **Payments** tab on the business page.

- [ ] **2A.3 Renewals page** `[API+UI]`
  - A new sidebar page listing:
    - businesses expiring within N days;
    - expired businesses;
    - trials ending.
  - **Endpoint:** `GET /admin/subscriptions?status=expiring|expired|trial&days=7`.
  - **Overview:** add cards for "Expiring this week" and "Expired".
- [ ] **2A.4 Renewal reminder emails** `[API+UI]`
  - A daily cron emails active OWNERs 7, 3 and 1 days before expiry and on the
    expiry day. It also posts a notification in the shop's bell
    (`NotificationsService.create` already exists but nothing calls it).
  - Copy the pattern of `api/src/notifications/low-stock.cron.ts`.
  - **Panel:** a "Send reminder now" button on the business page.

### 2B. Admin accounts and security

- [ ] **2B.1 Change own password** `[API+UI]`
  - There's no endpoint today, and the seeded login is still `admin12345`.
  - **Endpoint:** `POST /admin/auth/change-password`.
  - **UI:** a "My account" page.
- [ ] **2B.2 Manage admin accounts** `[API+UI]`
  - List, create, deactivate and reset password.
  - The `PlatformAdmin.isActive` field exists, but nothing uses it.
  - **Endpoints:** `GET/POST /admin/admins`, `PATCH /admin/admins/:id`.
  - **Guard:** an admin can't deactivate themselves or the last active admin.
- [ ] **2B.3 Admin action log** `[API+UI]`
  - **Problem:** admin actions are recorded nowhere. `AuditLog` requires a
    `businessId` and only covers shop users.
  - **New table: `PlatformAuditLog`**

    | Field                          | Notes |
    | ------------------------------ | ----- |
    | `adminId`                      |       |
    | `action`                       |       |
    | `businessId?`, `targetUserId?` |       |
    | `details`                      | JSON  |
    | `ip`                           |       |
    | `createdAt`                    |       |

  - **Record:** suspend and reactivate, subscription changes, payments recorded,
    user resets and verifications, business create/edit/delete, and impersonation.
  - **UI:** an "Admin log" page.

- [ ] **2B.4 Small hardening** `[API]`
  - Normalise the email on admin login (`platform-auth.service.ts`).
  - Give admin sessions a shorter lifetime than shop users, e.g. 12 hours instead of 7 days.

### 2C. Support tools for shops

- [ ] **2C.1 Global user search** `[API+UI]`
  - Find any user by email or name across all businesses, then jump to their
    business. This is the first step for "I can't log in" tickets.
  - **Endpoint:** `GET /admin/users?search=`.
- [ ] **2C.2 Verify email or resend the code** `[API+UI]`
  - Signup requires email verification, so any email outage blocks every new shop.
  - **Endpoints:** `POST /admin/users/:id/verify-email`, `POST /admin/users/:id/resend-verification`.
- [ ] **2C.3 Reset a shop user's password** `[API+UI]`
  - Send the normal reset email by reusing the forgot-password flow.
  - **Endpoint:** `POST /admin/users/:id/send-password-reset`.
- [ ] **2C.4 Activate or deactivate a shop user; fix a mistyped email** `[API+UI]`
  - **Endpoint:** `PATCH /admin/users/:id` with `{ isActive, email }`.
  - The email must stay unique.
- [ ] **2C.5 Create a business from the panel** `[API+UI]`
  - For shops onboarded in person.
  - **Endpoint:** `POST /admin/businesses` with `{ businessName, type, currency, ownerName, ownerEmail, subscribedTo? }`.
  - **It creates:** the business, a "Main Store", and a verified OWNER account.
    It then emails the owner a link to set their password.

---

## 3. Next (after the must-haves)

- [ ] **3.1 "View as owner" (impersonation)** `[API+UI]`
  - `POST /admin/businesses/:id/impersonate` returns a short-lived (30 minute),
    **read-only** shop token that carries an `impersonatedBy` claim.
  - The shop app shows a banner while it's in use.
  - It's written to the admin action log (2B.3).
- [ ] **3.2 Growth dashboard** `[API+UI]`
  - Signups per week, active businesses (a sale in the last 7 days), at-risk
    businesses (no sale in 14 days).
  - Payments collected this month, from `SubscriptionPayment`.
- [ ] **3.3 "Last active" per business** `[API+UI]`
  - The last login (the `auth.login` entry in `AuditLog`) or the last sale.
  - Shown as a column in the businesses list.
- [ ] **3.4 More read-only business tabs** `[API+UI]`
  - Products and stock, purchases and suppliers, shifts.
- [ ] **3.5 Internal notes on a business** `[API+UI]`
  - A `BusinessNote` table: `businessId`, `adminId`, `body`, `createdAt`.
  - For calls, payment promises, setup details.
- [ ] **3.6 Announcements** `[API+UI]`
  - Send a notification to all or selected businesses, which appears in the shop's bell.
  - Optionally email the owners as well.
- [ ] **3.7 Email log** `[API+UI]`
  - `MailService` writes an `EmailLog` row for each email: `to`, `type`, `status`,
    `error`, `businessId?`, `createdAt`.
  - An admin page, searchable by email address.
  - This answers "I never got my code".
- [ ] **3.8 System status page** `[API+UI]`
  - API and database up, Resend configured, when each cron last ran, and the
    deployed version or commit.
- [ ] **3.9 Two-factor login for admins (TOTP)** `[API+UI]`
  - An admin account can see every shop's data.
- [ ] **3.10 Export a business's data** `[API+UI]`
  - Reuse `BusinessService.exportData()`.
- [ ] **3.11 Delete a business** `[API+UI]`
  - For test or spam signups and deletion requests.
  - Require typing the business name to confirm; the database schema already
    deletes its data along with it.
  - Recorded in the admin action log.
- [ ] **3.12 Grace period** `[API]`
  - N days after expiry before the shop is locked out.

---

## 4. Later (only when needed)

- [ ] **Admin roles:** full admin vs read-only support, once more than one person does support.
- [ ] **Support ticket or feedback inbox,** fed from the shop app.
- [ ] **Platform settings page:** trial length, open or invite-only signup, maintenance banner.
- [ ] **Activity log retention or archiving:** `AuditLog` grows forever.
- [ ] **Fonepay online payment:** it creates `SubscriptionPayment` rows automatically (2A.2).

---

## Out of scope

- **Plans with feature limits, custom roles, per-business-type features:** removed
  on 2026-06-15 ("just inventory management"). A subscription is a simple
  paid-until date.
- **Fonepay:** deferred as of 2026-09-19.

---

## Related work outside `admin/`

These go with the subscription features but live in the other apps:

- **web: an expired-subscription screen.** Today an expired shop gets a 401 and is
  thrown back to login with "Your subscription is inactive". Show a proper
  screen instead: how to renew, and who to contact.
- **web: a trial banner,** e.g. "Trial: 5 days left".
- **api: trial on register (2A.1) and the reminder cron (2A.4).**

---

## Data model changes (summary)

| Change                                             | For             |
| -------------------------------------------------- | --------------- |
| `Business.suspendedReason`, `Business.suspendedAt` | 1.6             |
| New `SubscriptionPayment` table                    | 2A.2, 2A.3, 3.2 |
| New `PlatformAuditLog` table                       | 2B.3, 3.1, 3.11 |
| New `BusinessNote` table                           | 3.5             |
| New `EmailLog` table                               | 3.7             |

---

## Suggested build order

1. **Section 1 fixes.** They're small and make the current panel reliable.
2. **2B.1 change password.** The live admin still uses the default password.
3. **2A: trial, then record payment, then the renewals page, then reminders.**
   This is how you start charging shops without Fonepay.
4. **2B.2–2B.3:** admin accounts and the action log.
5. **2C:** support tools, in the order 2C.1, then 2C.2, then 2C.3.
6. **Section 3,** as real shops start asking.
