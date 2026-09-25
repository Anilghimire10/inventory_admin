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
  'announcement',
  'support-reply',
  'support-new',
] as const;

export interface SendAnnouncementInput {
  title: string;
  body: string;
  /** Omit or leave empty for every business that isn't suspended. */
  businessIds?: string[];
  email?: boolean;
}

/** A past announcement, as recorded in the admin log. */
export interface AnnouncementEntry {
  id: string;
  adminEmail: string;
  createdAt: string;
  details: {
    title: string;
    body: string;
    audience: 'all' | 'selected';
    businesses: number;
    skipped: number;
    email: boolean;
    emailed: number;
    failed: number;
  };
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
}

export interface UpdateBusinessInput {
  name?: string;
  type?: BusinessType;
  salesModel?: SalesModel;
  currency?: string;
  taxId?: string;
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
export const SUBSCRIPTION_PAYMENT_METHODS = ['CASH', 'BANK', 'ESEWA', 'KHALTI', 'OTHER'] as const;
export type SubscriptionPaymentMethod = (typeof SUBSCRIPTION_PAYMENT_METHODS)[number];

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
  note?: string | null;
  createdAt: string;
  recordedByAdmin?: { id: string; name: string } | null;
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
  updatedAt: string;
  updatedBy: string | null;
  activityLog: { total: number; oldestAt: string | null; dueForRemoval: number };
}

export type UpdateSettingsInput = Partial<
  Pick<PlatformSettings, 'trialDays' | 'signupOpen' | 'maintenanceMessage' | 'auditRetentionDays'>
>;

export type TicketStatus = 'OPEN' | 'CLOSED';

export interface SupportTicketRow {
  id: string;
  subject: string;
  status: TicketStatus;
  userName: string;
  userEmail: string;
  lastMessageAt: string;
  createdAt: string;
  messageCount: number;
  lastMessage: { body: string; fromAdmin: boolean } | null;
  /** Open, and the shop spoke last. */
  awaitingReply: boolean;
  business: { id: string; name: string };
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
      await api.post<{ payment: SubscriptionPayment; business: { subscribedTo: string | null } }>(
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
  customers: (id: string, params?: object) =>
    get<Paginated<AdminCustomer>>(`/admin/businesses/${id}/customers`, params),
  products: (id: string, params?: object) =>
    get<Paginated<AdminProduct>>(`/admin/businesses/${id}/products`, params),
  purchases: (id: string, params?: object) =>
    get<Paginated<AdminPurchase>>(`/admin/businesses/${id}/purchases`, params),
  shifts: (id: string, params?: object) => get<Paginated<AdminShift>>(`/admin/businesses/${id}/shifts`, params),
  // ---- Platform insights ----
  growth: () => get<GrowthStats>('/admin/growth'),
  system: () => get<SystemStatus>('/admin/system'),
  emailLog: (params?: object) => get<Paginated<EmailLogEntry>>('/admin/email-log', params),
  announcements: () => get<AnnouncementEntry[]>('/admin/announcements'),
  sendAnnouncement: (dto: SendAnnouncementInput) =>
    post<{ businesses: number; emailed: number; failed: number }>('/admin/announcements', dto),
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

  // ---- Support inbox ----
  tickets: (params?: object) =>
    get<Paginated<SupportTicketRow> & { openCount: number }>('/admin/support', params),
  ticket: (id: string) => get<SupportTicket>(`/admin/support/${id}`),
  replyToTicket: (id: string, body: string) => post<SupportTicket>(`/admin/support/${id}/messages`, { body }),
  setTicketStatus: (id: string, status: TicketStatus) =>
    patch<SupportTicket>(`/admin/support/${id}`, { status }),

  // Global activity feed across all businesses
  activityFeed: (params?: object) => get<Paginated<AdminActivity>>('/admin/activity', params),
};
