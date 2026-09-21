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
  customers: (id: string, params?: object) =>
    get<Paginated<AdminCustomer>>(`/admin/businesses/${id}/customers`, params),
  sales: (id: string, params?: object) =>
    get<Paginated<AdminSaleRow>>(`/admin/businesses/${id}/sales`, params),
  sale: (id: string, saleId: string) =>
    get<AdminSaleDetail>(`/admin/businesses/${id}/sales/${saleId}`),
  activity: (id: string, params?: object) =>
    get<Paginated<AdminActivity>>(`/admin/businesses/${id}/activity`, params),

  // Global activity feed across all businesses
  activityFeed: (params?: object) => get<Paginated<AdminActivity>>('/admin/activity', params),
};
