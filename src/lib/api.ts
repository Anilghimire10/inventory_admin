import axios, { AxiosError } from 'axios';

const TOKEN_KEY = 'admin_token';

// sessionStorage, not localStorage: the token must stay scoped to one tab.
// localStorage is shared by every tab of the same origin, so two platform
// admins signed in from two tabs on the same machine would overwrite each
// other's token and both end up as whoever logged in last on refresh.
export const getToken = () =>
  typeof window === 'undefined' ? null : sessionStorage.getItem(TOKEN_KEY);
export const setToken = (t: string) => sessionStorage.setItem(TOKEN_KEY, t);
export const clearToken = () => sessionStorage.removeItem(TOKEN_KEY);

export const api = axios.create({ baseURL: '/api' });

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (error: AxiosError) => {
    // Two-factor is required and not set up yet: the Account page is the one
    // place that works until it is.
    if (
      error.response?.status === 403 &&
      (error.response.data as { code?: string } | undefined)?.code === 'TWOFA_REQUIRED' &&
      !location.pathname.startsWith('/account')
    ) {
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      location.href = '/account';
    }
    if (error.response?.status === 401 && getToken()) {
      clearToken();
      // Same hard navigation as logout, and for the same reason: the session
      // is gone, so the cache built under it must go too rather than be
      // carried into the next sign-in.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      if (!location.pathname.startsWith('/login')) location.href = '/login';
    }
    return Promise.reject(error);
  },
);

export function apiError(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as { message?: string | string[] } | undefined;
    if (data?.message) return Array.isArray(data.message) ? data.message.join(', ') : data.message;
    return err.message;
  }
  return 'Something went wrong';
}

/** The API's machine-readable `code` on an error, e.g. TOTP_REQUIRED. */
export function apiErrorCode(err: unknown): string | null {
  if (!axios.isAxiosError(err)) return null;
  const data = err.response?.data as { code?: unknown } | undefined;
  return typeof data?.code === 'string' ? data.code : null;
}

const get = async <T>(url: string, params?: object) => (await api.get<T>(url, { params })).data;

// ---- Types ----
/** ADMIN can change anything; SUPPORT is read-only apart from support tickets. */
export type AdminRole = 'ADMIN' | 'SUPPORT';

export interface AdminInfo {
  id: string;
  email: string;
  name: string;
  role: AdminRole;
  /** From GET /admin/auth/me; login's response leaves it out. */
  twoFactorEnabled?: boolean;
  /** The platform requires two-factor and this admin hasn't set it up. */
  twoFactorRequired?: boolean;
}

/** GET /admin/auth/sessions -- one place this admin is signed in. */
export interface AdminSessionInfo {
  id: string;
  createdAt: string;
  lastSeenAt: string;
  expiresAt: string;
  ip: string | null;
  userAgent: string | null;
  /** "Chrome on macOS" */
  device: string;
  current: boolean;
}

/** Mirrors SubscriptionStatus in the API (`api/src/common/subscription.ts`). */
export type SubscriptionStatus = 'inactive' | 'expired' | 'trial' | 'expiring' | 'active';

export const BUSINESS_TYPES = ['GROCERY', 'PHARMACY', 'RETAIL', 'OTHER'] as const;
export type BusinessType = (typeof BUSINESS_TYPES)[number];

export const SALES_MODELS = ['RETAIL', 'WHOLESALE'] as const;
export type SalesModel = (typeof SALES_MODELS)[number];

export const SUBSCRIPTION_FILTERS = [
  'active', 'trial', 'expiring', 'expired', 'inactive', 'no-expiry',
] as const;
export type SubscriptionFilter = (typeof SUBSCRIPTION_FILTERS)[number];

export const BUSINESS_SORTS = ['newest', 'oldest', 'name', 'sales', 'expiry'] as const;
export type BusinessSort = (typeof BUSINESS_SORTS)[number];

export interface PlatformStats {
  businesses: number;
  activeBusinesses: number;
  suspendedBusinesses: number;
  users: number;
  products: number;
  /** Adds every currency together — show salesByCurrency instead. */
  totalSalesValue: number;
  totalTransactions: number;
  salesByCurrency: { currency: string; total: number; count: number }[];
  subscriptions: { trial: number; expiringSoon: number; expired: number; inactive: number };
  recentBusinesses: { id: string; name: string; type: string; createdAt: string }[];
}

export interface BusinessRow {
  id: string;
  name: string;
  type: BusinessType;
  currency: string;
  isSuspended: boolean;
  suspendedReason?: string | null;
  isSubscribed: boolean;
  subscribedTo?: string | null;
  subscriptionStatus: SubscriptionStatus;
  createdAt: string;
  /** Latest sign-in or sale, whichever is later. Null if neither ever happened. */
  lastActiveAt?: string | null;
  _count: { users: number; products: number; sales: number; stores: number; subscriptionPayments: number };
}

// ---- Platform insights ----

export interface GrowthStats {
  businesses: number;
  newThisMonth: number;
  /** Twelve weeks, oldest first, empty weeks included. */
  signupsByWeek: { weekStart: string; count: number }[];
  /** Businesses with a sale in the last 7 days. */
  activeLast7Days: number;
  /** Has sold before, nothing in 14 days, not suspended. Oldest-silent first. */
  atRisk: { count: number; businesses: { id: string; name: string; lastSaleAt: string }[] };
  paymentsThisMonth: { currency: string; total: number; count: number }[];
  paymentsLastMonth: { currency: string; total: number; count: number }[];
  /** Paid at least once, out of those plus trials that ended unpaid. Null until any trial has decided. */
  trialToPaid: { converted: number; endedUnpaid: number; rate: number | null };
  /** Paid before, now past the end date, out of every shop that has paid. */
  lapsed: { count: number; ofPaying: number; rate: number | null };
  /** Paying shops ending this calendar month, at their last price. */
  dueThisMonth: { currency: string; total: number; count: number }[];
}

export interface CronRun {
  name: string;
  schedule: string;
  startedAt: string | null;
  finishedAt: string | null;
  ok: boolean | null;
  summary: string | null;
}

export interface SystemStatus {
  app: {
    version: string | null;
    commit: string | null;
    environment: string;
    node: string;
    startedAt: string;
    uptimeSeconds: number;
  };
  database: {
    ok: boolean;
    latencyMs: number | null;
    error: string | null;
    lastMigration: { name: string; finishedAt: string } | null;
  };
  email: {
    transport: string;
    configured: boolean;
    last24h: { sent: number; failed: number; logged: number };
  };
  storage: { productImages: 'supabase' | 'local-disk' };
  subscriptions: { trialDays: number; graceDays: number; supportContactSet: boolean };
  crons: CronRun[];
}

export const EMAIL_TYPES = [
  'verification',
  'password-reset',
  'receipt',
  'low-stock',
  'invite',
  'subscription-reminder',
  'subscription-receipt',
  'admin-new-sign-in',
  'announcement',
  'support-reply',
  'support-new',
  'support-followup',
  'payment-claim',
  'admin-digest',
] as const;

/** Who an announcement goes to, by subscription status. `selected` = businessIds. */
export type AnnouncementAudience = 'all' | 'selected' | 'trial' | 'active' | 'expiring' | 'expired';

export interface SendAnnouncementInput {
  title: string;
  body: string;
  /** Given: exactly these businesses (audience "selected"). */
  businessIds?: string[];
  audience?: Exclude<AnnouncementAudience, 'selected'>;
  email?: boolean;
  /** ISO time to send it; omitted or past = now. Up to 90 days ahead. */
  scheduledFor?: string;
}

/** An announcement: sent, waiting to go out, or cancelled. */
export interface AnnouncementEntry {
  id: string;
  title: string;
  body: string;
  audience: AnnouncementAudience;
  businessIds: string[];
  email: boolean;
  createdByEmail: string;
  createdAt: string;
  scheduledFor: string | null;
  sentAt: string | null;
  cancelledAt: string | null;
  status: 'scheduled' | 'sent' | 'cancelled';
  /** Shops it reached (null until sent). */
  businesses: number | null;
  emailed: number | null;
  failed: number | null;
  /** Shops where at least one person has opened it in the bell. */
  seenByShops: number;
  seenByPeople: number;
}

export interface EmailLogEntry {
  id: string;
  to: string;
  type: (typeof EMAIL_TYPES)[number];
  subject: string;
  status: 'SENT' | 'FAILED' | 'LOGGED';
  error?: string | null;
  business?: { id: string; name: string } | null;
  createdAt: string;
}

// ---- More read-only business tabs ----

export interface AdminProduct {
  id: string;
  name: string;
  variantName?: string | null;
  sku?: string | null;
  unit: string;
  /** Decimals, sent as strings. */
  costPrice: string;
  sellingPrice: string;
  reorderLevel: number;
  isActive: boolean;
  /** Across every store. */
  onHand: number;
}

export interface AdminPurchase {
  id: string;
  reference?: string | null;
  status: 'DRAFT' | 'ORDERED' | 'RECEIVED' | 'CANCELLED';
  total: string;
  amountPaid: string;
  createdAt: string;
  receivedAt?: string | null;
  supplier?: { name: string } | null;
  store: { name: string };
  _count: { items: number };
}

export interface AdminShift {
  id: string;
  openedAt: string;
  closedAt?: string | null;
  openingFloat: string;
  expectedCash?: string | null;
  countedCash?: string | null;
  variance?: string | null;
  store: { name: string };
  user: { name: string };
  _count: { sales: number };
}

/** An admin's internal note on a business. The shop never sees these. */
export interface BusinessNote {
  id: string;
  body: string;
  /** Snapshot, so the note outlives the admin account. */
  adminEmail: string;
  admin?: { id: string; name: string } | null;
  createdAt: string;
}

export interface BusinessDetail extends BusinessRow {
  salesModel: SalesModel;
  taxId?: string | null;
  suspendedAt?: string | null;
  _count: {
    users: number; products: number; sales: number; stores: number;
    customers: number; subscriptionPayments: number;
  };
  stores: { id: string; name: string; isActive: boolean }[];
  users: {
    id: string;
    name: string;
    email: string;
    role: string;
    isActive: boolean;
    emailVerified: boolean;
    createdAt: string;
  }[];
  totalSalesValue: number;
  totalTransactions: number;
  recentSales: { id: string; receiptNo: string; total: string; status: string; createdAt: string }[];
  /** The tenders the shop takes at its till (its Settings -> Payment methods). */
  acceptedTenders?: string[];
  /** The plan the shop is on (null: none, or since removed), and its branches open. */
  plan?: { id: string; name: string; maxStores: number | null } | null;
  activeStores?: number;
  planId?: string | null;
  /** The shop's first steps (its Dashboard's Getting started), each true once done. */
  setup?: { products: boolean; stock: boolean; paymentMethods: boolean; staff: boolean; sale: boolean };
}

export interface UpdateBusinessInput {
  name?: string;
  type?: BusinessType;
  salesModel?: SalesModel;
  currency?: string;
  taxId?: string;
  /** The shop's plan by id; null takes it off any plan (no branch limit). */
  planId?: string | null;
}

export interface Paginated<T> {
  data: T[];
  meta: { total: number; page: number; limit: number; pages: number };
}

export interface AdminCustomer {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  creditBalance: string;
  createdAt: string;
  _count: { sales: number };
}

/** How a shop's sale was paid, by name (the API's PaymentMethod). */
export const SALE_TENDER_LABELS: Record<string, string> = {
  CASH: 'Cash',
  CARD: 'Card',
  MOBILE: 'Mobile / QR',
  KHALTI: 'Khalti',
  CONNECTIPS: 'connectIPS',
  CREDIT: 'Credit',
  MIXED: 'Part credit',
};

export interface AdminSaleRow {
  id: string;
  receiptNo: string;
  total: string;
  status: string;
  paymentMethod: string;
  createdAt: string;
  customer?: { name: string } | null;
  user?: { name: string } | null;
  _count: { items: number };
}

export interface AdminSaleItem {
  id: string;
  name: string;
  /** Decimal, sent as a string (e.g. "1.000"). */
  quantity: string;
  unitPrice: string;
  lineTotal: string;
  /** Decimal, sent as a string. */
  returnedQty: string;
}

export interface AdminSaleDetail extends AdminSaleRow {
  subtotal: string;
  discount: string;
  tax: string;
  amountPaid: string;
  items: AdminSaleItem[];
  store?: { name: string } | null;
}

export interface AdminActivity {
  id: string;
  action: string;
  summary?: string | null;
  entity?: string | null;
  entityId?: string | null;
  ip?: string | null;
  createdAt: string;
  userName?: string | null;
  user?: { id: string; name: string; role?: string | null } | null;
  business?: { id: string; name: string } | null;
}

/** Mirrors SubscriptionPaymentMethod in the API schema. */
export const SUBSCRIPTION_PAYMENT_METHODS = ['CASH', 'BANK', 'ESEWA', 'KHALTI', 'CONNECTIPS', 'OTHER'] as const;
export type SubscriptionPaymentMethod = (typeof SUBSCRIPTION_PAYMENT_METHODS)[number];

export const PAYMENT_METHOD_LABELS: Record<SubscriptionPaymentMethod, string> = {
  CASH: 'Cash',
  BANK: 'Bank transfer',
  ESEWA: 'eSewa',
  KHALTI: 'Khalti',
  CONNECTIPS: 'connectIPS',
  OTHER: 'Other',
};

/** Money a shop paid for its subscription, recorded by hand in this panel. */
export interface SubscriptionPayment {
  id: string;
  /** Decimal, sent as a string. */
  amount: string;
  currency: string;
  method: SubscriptionPaymentMethod;
  reference?: string | null;
  periodFrom: string;
  periodTo: string;
  /** The plan it paid for, by its name then. */
  planName?: string | null;
  note?: string | null;
  createdAt: string;
  /** Sequential across the platform; printed as SUB-000042 (`receiptLabel`). */
  receiptNo: number;
  recordedByAdmin?: { id: string; name: string } | null;
}

/** SUB-000042: how a receipt number is printed. Matches the API. */
export const receiptLabel = (n: number) => `SUB-${String(n).padStart(6, '0')}`;

/** GET /admin/payments/:id/receipt -- everything a printed receipt shows. */
export interface SubscriptionReceipt {
  receiptNo: string;
  issuedAt: string;
  seller: {
    name: string | null;
    taxId: string | null;
    address: string | null;
    phone: string | null;
    email: string | null;
  };
  buyer: { businessId: string; name: string; taxId: string | null };
  amount: number;
  currency: string;
  methodLabel: string;
  reference: string | null;
  periodFrom: string;
  periodTo: string;
}

/** GET /admin/onboarding -- how far one shop has got with setting up. */
export interface OnboardingRow {
  id: string;
  name: string;
  type: string;
  createdAt: string;
  ageDays: number;
  /** Still on the free trial: when it ends. Null once they've paid. */
  trialEndsAt: string | null;
  subscriptionStatus: SubscriptionStatus;
  steps: { products: boolean; firstSale: boolean; staff: boolean; shiftClosed: boolean; paid: boolean };
  done: number;
  counts: { products: number; sales: number; staff: number };
  firstSaleAt: string | null;
  lastActiveAt: string | null;
  /** Signed up 3+ days ago and hasn't sold anything yet. */
  stuck: boolean;
  owner: { name: string; email: string } | null;
  phone: string | null;
}

export type OnboardingScope = 'trial' | 'recent' | 'all';

/** GET /admin/renewals -- one subscription ending soon, or already ended. */
export interface RenewalRow {
  id: string;
  name: string;
  endsAt: string;
  /** When they're actually locked out, after the grace period. */
  accessEndsAt: string;
  daysLeft: number;
  overdue: boolean;
  kind: 'trial' | 'paid';
  lastPayment: {
    amount: number;
    currency: string;
    periodFrom: string;
    periodTo: string;
    paidAt: string;
  } | null;
  owners: { name: string; email: string; emailVerified: boolean }[];
}

/** Give `months` or `periodTo`, not both. */
export interface RecordPaymentInput {
  amount: number;
  method: SubscriptionPaymentMethod;
  currency?: string;
  reference?: string;
  months?: number;
  periodFrom?: string;
  periodTo?: string;
  note?: string;
  /** Email the receipt to the business's owners once it's recorded. */
  emailReceipt?: boolean;
  /** The plan it pays for; the shop moves onto it. */
  planId?: string;
}

/** A shop user, as the support tools see them: across every business. */
export interface TenantUser {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  emailVerified: boolean;
  createdAt: string;
  business: { id: string; name: string; isSuspended: boolean };
  store?: { id: string; name: string } | null;
}

export interface PlatformAdmin {
  id: string;
  email: string;
  name: string;
  isActive: boolean;
  role: AdminRole;
  createdAt: string;
  /** When two-factor was turned on; null when it's off. */
  totpEnabledAt?: string | null;
}

/** What a platform admin did. Separate from a shop's own activity log. */
export interface AdminAuditEntry {
  id: string;
  action: string;
  /** Snapshot, so the entry outlives the admin account. */
  adminEmail: string;
  admin?: { id: string; name: string; email: string } | null;
  business?: { id: string; name: string } | null;
  targetUserId?: string | null;
  details?: Record<string, unknown> | null;
  ip?: string | null;
  createdAt: string;
}

export interface CreateBusinessInput {
  businessName: string;
  type?: BusinessType;
  salesModel?: SalesModel;
  currency?: string;
  ownerName: string;
  ownerEmail: string;
  /** Omit to email the owner an invite instead. */
  password?: string;
  /** Paid-until date. Omitted, the business starts on the standard trial. */
  subscribedTo?: string;
}

export interface PlatformSettings {
  /** Null falls back to the API's TRIAL_DAYS (`envTrialDays`). */
  trialDays: number | null;
  envTrialDays: number;
  signupOpen: boolean;
  maintenanceMessage: string | null;
  /** Null keeps shop activity logs forever. */
  auditRetentionDays: number | null;
  /** Admins without two-factor can only reach their Account page. */
  requireAdminTwoFactor: boolean;
  /** Printed on subscription receipts as the seller. Null = left off. */
  billingName: string | null;
  billingTaxId: string | null;
  billingAddress: string | null;
  billingPhone: string | null;
  billingEmail: string | null;
  /** How shops pay, shown on their Subscription page. */
  subscriptionPrice: string | null;
  paymentInstructions: string | null;
  paymentMethods: PaymentMethodSetting[] | null;
  /** The plans shops choose from, in the order they see them. */
  plans: SubscriptionPlan[] | null;
  /** Shops on each plan, by plan id; "none" counts those on no plan. */
  planUsage: Record<string, number>;
  /** The gateways set up on the server; their keys are in its environment. */
  onlineGateways: { id: 'ESEWA' | 'KHALTI' | 'CONNECTIPS'; label: string; test: boolean }[];
  /** The morning summary email to full admins. */
  adminDigestEnabled: boolean;
  /** Day (Nepal time) it last went out. */
  adminDigestSentOn: string | null;
  updatedAt: string;
  updatedBy: string | null;
  activityLog: { total: number; oldestAt: string | null; dueForRemoval: number };
}

export type PaymentClaimStatus = 'PENDING' | 'CONFIRMED' | 'REJECTED' | 'CANCELLED';

/** A shop's "I've paid" report, as the Payments to confirm page lists it. */
export interface PaymentClaimRow {
  id: string;
  businessId: string;
  business: { id: string; name: string; currency: string; isSubscribed: boolean; subscribedTo: string | null };
  submittedByName: string;
  amount: number;
  currency: string;
  method: SubscriptionPaymentMethod;
  reference: string | null;
  months: number | null;
  /** The plan the shop says it paid for, by its name then. */
  planId: string | null;
  planName: string | null;
  note: string | null;
  proofUrl: string | null;
  status: PaymentClaimStatus;
  rejectReason: string | null;
  reviewedBy: { name: string } | null;
  reviewedAt: string | null;
  payment: { id: string; receiptNo: number } | null;
  createdAt: string;
}

/** One way shops can pay the platform: eSewa, Khalti, a bank account ... */
export interface PaymentMethodSetting {
  label: string;
  details: string;
  /** An uploaded QR code, from AdminApi.uploadPaymentQr. */
  qrUrl?: string | null;
}

/** The lengths a plan can be sold for, in months. */
export const PLAN_LENGTHS = [1, 3, 12] as const;

/**
 * A subscription plan (Plans & billing). `id` stays the same through a
 * rename or a price change; a new plan is sent without one and given one.
 */
export interface SubscriptionPlan {
  id?: string;
  name: string;
  description: string | null;
  /** What's included, one short line each. */
  features: string[];
  /** Branches a shop may have open; null is unlimited. */
  maxStores: number | null;
  /**
   * One per length sold (1, 3 or 12 months): `amount` in NPR, and
   * `amountUsd` for shops outside Nepal (null: they see the NPR price).
   */
  prices: { months: number; amount: number; amountUsd?: number | null }[];
}

/** The currency a shop's plans are priced in: NPR for a rupee shop, USD for any other. Matches the API. */
export const pricingCurrency = (businessCurrency: string | null | undefined) =>
  (businessCurrency ?? 'NPR').toUpperCase() === 'NPR' ? 'NPR' : 'USD';

/** "1 month", "3 months", "1 year". */
export const planLengthLabel = (m: number) => (m === 12 ? '1 year' : `${m} month${m === 1 ? '' : 's'}`);

export const BILLING_FIELDS = [
  'billingName',
  'billingTaxId',
  'billingAddress',
  'billingPhone',
  'billingEmail',
] as const;

export type UpdateSettingsInput = Partial<
  Pick<
    PlatformSettings,
    | 'trialDays'
    | 'signupOpen'
    | 'maintenanceMessage'
    | 'auditRetentionDays'
    | 'requireAdminTwoFactor'
    | 'subscriptionPrice'
    | 'paymentInstructions'
    | 'paymentMethods'
    | 'plans'
    | 'adminDigestEnabled'
    | (typeof BILLING_FIELDS)[number]
  >
>;

export type TicketStatus = 'OPEN' | 'CLOSED';

/** What a ticket is about. The shop picks it; an admin can correct it. */
export type TicketCategory = 'BILLING' | 'PROBLEM' | 'HOW_TO' | 'FEATURE' | 'OTHER';

export const TICKET_CATEGORIES: { value: TicketCategory; label: string }[] = [
  { value: 'PROBLEM', label: 'Problem' },
  { value: 'HOW_TO', label: 'How to' },
  { value: 'BILLING', label: 'Billing' },
  { value: 'FEATURE', label: 'Feature request' },
  { value: 'OTHER', label: 'Other' },
];

export const ticketCategoryLabel = (c: TicketCategory) =>
  TICKET_CATEGORIES.find((x) => x.value === c)?.label ?? 'Other';

export interface SupportTicketRow {
  id: string;
  subject: string;
  status: TicketStatus;
  category: TicketCategory;
  userName: string;
  userEmail: string;
  lastMessageAt: string;
  createdAt: string;
  messageCount: number;
  lastMessage: { body: string; fromAdmin: boolean } | null;
  /** Open, and the shop spoke last. */
  awaitingReply: boolean;
  business: { id: string; name: string };
  /** Which admin is handling it; shops never see this. */
  assignedAdmin: { id: string; name: string } | null;
}

/** A canned answer. {name} and {business} are filled in from the ticket. */
export interface SupportReplyTemplate {
  id: string;
  title: string;
  body: string;
  createdByEmail: string;
  createdAt: string;
  updatedAt: string;
}

export interface SupportMessage {
  id: string;
  fromAdmin: boolean;
  authorName: string;
  body: string;
  createdAt: string;
}

export interface SupportTicket extends Omit<SupportTicketRow, 'messages' | 'lastMessage' | 'messageCount' | 'awaitingReply'> {
  messages: SupportMessage[];
}

const post = async <T>(url: string, body?: object) => (await api.post<T>(url, body)).data;

/** Save a response body as a file, named by its Content-Disposition. */
async function download(url: string, fallbackName: string) {
  const res = await api.get<Blob>(url, { responseType: 'blob' });
  const header = String(res.headers['content-disposition'] ?? '');
  const name = /filename="([^"]+)"/.exec(header)?.[1] ?? fallbackName;
  const href = URL.createObjectURL(res.data);
  const a = document.createElement('a');
  a.href = href;
  a.download = name;
  a.click();
  URL.revokeObjectURL(href);
}
const patch = async <T>(url: string, body?: object) => (await api.patch<T>(url, body)).data;

export const AdminApi = {
  login: async (email: string, password: string, code?: string) =>
    (
      await api.post<{ accessToken: string; admin: AdminInfo }>('/admin/auth/login', {
        email,
        password,
        ...(code ? { code } : {}),
      })
    ).data,
  // ---- Two-factor ----
  /** Starts enrolment. Not in force until `enableTwoFactor` sees a code. */
  setupTwoFactor: () => post<{ secret: string; otpauthUrl: string }>('/admin/auth/2fa/setup'),
  /** Signs out every other session; the returned token keeps this one. */
  enableTwoFactor: (code: string) =>
    post<{ enabled: true; accessToken: string }>('/admin/auth/2fa/enable', { code }),
  disableTwoFactor: (password: string, code: string) =>
    post<{ enabled: false }>('/admin/auth/2fa/disable', { password, code }),
  me: () => get<AdminInfo>('/admin/auth/me'),
  /** End this session on the server (the panel then drops the token). */
  logout: () => post<{ ok: true }>('/admin/auth/logout'),
  sessions: () => get<AdminSessionInfo[]>('/admin/auth/sessions'),
  revokeSession: (id: string) => post<{ ok: true }>(`/admin/auth/sessions/${id}/revoke`),
  revokeOtherSessions: () => post<{ ended: number }>('/admin/auth/sessions/revoke-others'),
  /** Sign another admin out of every session. Full admins only. */
  signOutAdmin: (id: string) => post<{ ended: number }>(`/admin/admins/${id}/sign-out`),
  stats: () => get<PlatformStats>('/admin/stats'),
  businesses: (params?: object) => get<Paginated<BusinessRow>>('/admin/businesses', params),
  business: (id: string) => get<BusinessDetail>(`/admin/businesses/${id}`),
  updateBusiness: async (id: string, dto: UpdateBusinessInput) =>
    (await api.patch<BusinessDetail>(`/admin/businesses/${id}`, dto)).data,
  setSuspended: async (id: string, isSuspended: boolean, reason?: string) =>
    (await api.patch(`/admin/businesses/${id}/suspend`, { isSuspended, ...(reason ? { reason } : {}) })).data,
  setSubscription: async (id: string, isSubscribed: boolean, subscribedTo: string | null) =>
    (await api.patch(`/admin/businesses/${id}/subscription`, { isSubscribed, subscribedTo })).data,
  payments: (id: string, params?: object) =>
    get<Paginated<SubscriptionPayment>>(`/admin/businesses/${id}/payments`, params),
  /** Records the payment and extends the paid-until date in one step. */
  recordPayment: async (id: string, dto: RecordPaymentInput) =>
    (
      await api.post<{
        payment: SubscriptionPayment;
        business: { subscribedTo: string | null };
        /** Present when the receipt was asked to be emailed. */
        receipt?: { emailed: number; failed: number; error?: string };
      }>(
        `/admin/businesses/${id}/payments`,
        dto,
      )
    ).data,
  /** Emails the owners and posts a bell notification about the end date now. */
  sendReminder: async (id: string) =>
    (
      await api.post<{ daysLeft: number; emailed: number; failed: number }>(
        `/admin/businesses/${id}/send-reminder`,
      )
    ).data,
  receipt: (paymentId: string) => get<SubscriptionReceipt>(`/admin/payments/${paymentId}/receipt`),
  emailReceipt: (paymentId: string) =>
    post<{ receiptNo: string; emailed: number; failed: number }>(`/admin/payments/${paymentId}/email-receipt`),
  renewals: (days: number) => get<RenewalRow[]>('/admin/renewals', { days }),
  onboarding: (scope: OnboardingScope) => get<OnboardingRow[]>('/admin/onboarding', { scope }),
  remindBusinesses: (businessIds: string[]) =>
    post<{ reminded: number; skipped: number; emailed: number; failed: number }>('/admin/renewals/remind', {
      businessIds,
    }),
  customers: (id: string, params?: object) =>
    get<Paginated<AdminCustomer>>(`/admin/businesses/${id}/customers`, params),
  products: (id: string, params?: object) =>
    get<Paginated<AdminProduct>>(`/admin/businesses/${id}/products`, params),
  purchases: (id: string, params?: object) =>
    get<Paginated<AdminPurchase>>(`/admin/businesses/${id}/purchases`, params),
  shifts: (id: string, params?: object) => get<Paginated<AdminShift>>(`/admin/businesses/${id}/shifts`, params),
  // ---- Platform insights ----
  growth: () => get<GrowthStats>('/admin/growth'),
  /** Every subscription payment, newest first; from/to bound when recorded. */
  allPayments: (params?: object) =>
    get<Paginated<SubscriptionPayment & { business: { id: string; name: string; taxId: string | null } }>>(
      '/admin/payments',
      params,
    ),
  system: () => get<SystemStatus>('/admin/system'),
  emailLog: (params?: object) => get<Paginated<EmailLogEntry>>('/admin/email-log', params),
  announcements: () => get<AnnouncementEntry[]>('/admin/announcements'),
  sendAnnouncement: (dto: SendAnnouncementInput) =>
    post<{
      scheduled: boolean;
      id: string;
      scheduledFor?: string;
      /** Reached (sent now) or would reach today (scheduled). */
      businesses: number;
      emailed: number;
      failed: number;
    }>('/admin/announcements', dto),
  cancelAnnouncement: (id: string) => post<{ ok: true }>(`/admin/announcements/${id}/cancel`),
  // ---- Internal notes ----
  notes: (id: string) => get<BusinessNote[]>(`/admin/businesses/${id}/notes`),
  addNote: (id: string, body: string) => post<BusinessNote>(`/admin/businesses/${id}/notes`, { body }),
  deleteNote: async (id: string, noteId: string) =>
    (await api.delete<{ deleted: true }>(`/admin/businesses/${id}/notes/${noteId}`)).data,
  /** A 30-minute, read-only session in the shop app as the owner. Logged. */
  impersonate: (id: string) =>
    post<{ url: string; expiresAt: string; owner: { name: string; email: string } }>(
      `/admin/businesses/${id}/impersonate`,
    ),
  // ---- Export and deletion ----
  /** Downloads everything the business holds, as NDJSON. Logged. */
  exportBusiness: (id: string) => download(`/admin/businesses/${id}/export`, 'business-export.ndjson'),
  /** Permanent. `confirmName` must match the business name exactly. */
  deleteBusiness: async (id: string, confirmName: string) =>
    (await api.delete<{ deleted: true; name: string }>(`/admin/businesses/${id}`, { data: { confirmName } })).data,
  sales: (id: string, params?: object) =>
    get<Paginated<AdminSaleRow>>(`/admin/businesses/${id}/sales`, params),
  sale: (id: string, saleId: string) =>
    get<AdminSaleDetail>(`/admin/businesses/${id}/sales/${saleId}`),
  activity: (id: string, params?: object) =>
    get<Paginated<AdminActivity>>(`/admin/businesses/${id}/activity`, params),

  createBusiness: (dto: CreateBusinessInput) =>
    post<{ business: { id: string; name: string }; owner: { id: string; email: string }; inviteSent: boolean }>(
      '/admin/businesses',
      dto,
    ),

  // ---- This admin ----
  /** Returns a fresh token; every token issued before the change stops working. */
  changePassword: (currentPassword: string, newPassword: string) =>
    post<{ message: string; accessToken: string }>('/admin/auth/change-password', {
      currentPassword,
      newPassword,
    }),

  // ---- Admin accounts and their log ----
  admins: () => get<PlatformAdmin[]>('/admin/admins'),
  createAdmin: (dto: { email: string; name: string; password: string; role?: AdminRole }) =>
    post<PlatformAdmin>('/admin/admins', dto),
  updateAdmin: (
    id: string,
    dto: { name?: string; isActive?: boolean; password?: string; resetTwoFactor?: boolean; role?: AdminRole },
  ) =>
    patch<PlatformAdmin>(`/admin/admins/${id}`, dto),
  auditLog: (params?: object) => get<Paginated<AdminAuditEntry>>('/admin/audit-log', params),

  // ---- Shop users (support) ----
  users: (params?: object) => get<Paginated<TenantUser>>('/admin/users', params),
  updateUser: (id: string, dto: { name?: string; email?: string; isActive?: boolean }) =>
    patch<TenantUser>(`/admin/users/${id}`, dto),
  verifyUserEmail: (id: string) => post<TenantUser>(`/admin/users/${id}/verify-email`),
  resendVerification: (id: string) =>
    post<{ message: string }>(`/admin/users/${id}/resend-verification`),
  sendPasswordReset: (id: string) =>
    post<{ message: string }>(`/admin/users/${id}/send-password-reset`),

  // ---- Platform settings ----
  settings: () => get<PlatformSettings>('/admin/settings'),
  updateSettings: (dto: UpdateSettingsInput) => patch<PlatformSettings>('/admin/settings', dto),
  // ---- Payment reports ("I've paid") ----
  paymentClaims: (params?: { status?: PaymentClaimStatus; page?: number; limit?: number }) =>
    get<Paginated<PaymentClaimRow> & { pendingCount: number }>('/admin/payment-claims', params),
  confirmPaymentClaim: (
    id: string,
    dto: { months?: number; periodTo?: string; amount?: number; emailReceipt?: boolean; planId?: string },
  ) =>
    post<{ claimId: string; business: { subscribedTo: string | null }; receipt?: { emailed: number; failed: number; error?: string } }>(
      `/admin/payment-claims/${id}/confirm`,
      dto,
    ),
  rejectPaymentClaim: (id: string, reason: string) =>
    post<{ claimId: string; rejected: true }>(`/admin/payment-claims/${id}/reject`, { reason }),
  /** The daily summary, to yourself, now. */
  sendDigestToMe: () => post<{ sentTo: string }>('/admin/settings/digest/send-me'),
  /** A payment QR code image; returns the url to put in a payment method. */
  uploadPaymentQr: async (file: File) => {
    const form = new FormData();
    form.append('image', file);
    return (await api.post<{ url: string }>('/admin/settings/payment-qr', form)).data;
  },

  // ---- Support inbox ----
  tickets: (params?: object) =>
    get<Paginated<SupportTicketRow> & { openCount: number; awaitingCount: number }>('/admin/support', params),
  ticket: (id: string) => get<SupportTicket>(`/admin/support/${id}`),
  replyToTicket: (id: string, body: string) => post<SupportTicket>(`/admin/support/${id}/messages`, { body }),
  assignTicket: (id: string, adminId: string | null) =>
    patch<SupportTicket>(`/admin/support/${id}/assign`, { adminId }),
  replyTemplates: () => get<SupportReplyTemplate[]>('/admin/support/templates'),
  createReplyTemplate: (dto: { title: string; body: string }) =>
    post<SupportReplyTemplate>('/admin/support/templates', dto),
  updateReplyTemplate: (id: string, dto: { title: string; body: string }) =>
    patch<SupportReplyTemplate>(`/admin/support/templates/${id}`, dto),
  deleteReplyTemplate: async (id: string) => (await api.delete(`/admin/support/templates/${id}`)).data,
  /** Close or reopen, and/or correct the category. */
  updateTicket: (id: string, dto: { status?: TicketStatus; category?: TicketCategory }) =>
    patch<SupportTicket>(`/admin/support/${id}`, dto),

  // Global activity feed across all businesses
  activityFeed: (params?: object) => get<Paginated<AdminActivity>>('/admin/activity', params),
};
