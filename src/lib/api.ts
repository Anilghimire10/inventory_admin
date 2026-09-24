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

const get = async <T>(url: string, params?: object) => (await api.get<T>(url, { params })).data;

// ---- Types ----
export interface AdminInfo { id: string; email: string; name: string }

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
  _count: { users: number; products: number; sales: number; stores: number; subscriptionPayments: number };
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
  createdAt: string;
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

const post = async <T>(url: string, body?: object) => (await api.post<T>(url, body)).data;
const patch = async <T>(url: string, body?: object) => (await api.patch<T>(url, body)).data;

export const AdminApi = {
  login: async (email: string, password: string) =>
    (await api.post<{ accessToken: string; admin: AdminInfo }>('/admin/auth/login', { email, password })).data,
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
  createAdmin: (dto: { email: string; name: string; password: string }) =>
    post<PlatformAdmin>('/admin/admins', dto),
  updateAdmin: (id: string, dto: { name?: string; isActive?: boolean; password?: string }) =>
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

  // Global activity feed across all businesses
  activityFeed: (params?: object) => get<Paginated<AdminActivity>>('/admin/activity', params),
};
