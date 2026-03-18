// Typed wrappers — shapes match API_CONTRACT.md exactly
import client from './client';
import type {
  LoginResponse, User, Executive, AppRoute,
  Checkout, BatchResult, InvoiceHistory, MeOutstanding, MeHistoryItem,
  ApprovalRequest, ApprovalActionResult, ApprovalStatus, CheckoutHistory,
  ApprovalRequestType,
} from '../types';

// ── Auth ─────────────────────────────────────────────────────────────────────

export const login = (username: string, password: string) =>
  client.post<LoginResponse>('/auth/login', { username, password }).then(r => r.data);

export const getMe = () =>
  client.get<User>('/auth/me').then(r => r.data);

export const apiLogout = () =>
  client.post<{ message: string }>('/auth/logout').then(r => r.data);

// ── Users (ADMIN) ─────────────────────────────────────────────────────────────

export const getUsers = () =>
  client.get<User[]>('/users').then(r => r.data);

export const createUser = (data: {
  name: string; username: string; password: string;
  role: string; executiveId?: string | null;
}) => client.post<User>('/users', data).then(r => r.data);

export const updateUser = (id: string, data: Partial<{
  name: string; username: string; password: string;
  role: string; isActive: boolean; executiveId: string | null;
}>) => client.patch<User>(`/users/${id}`, data).then(r => r.data);

export const deleteUser = (id: string) =>
  client.delete(`/users/${id}`);

// ── Executives (GET: ADMIN+OFFICE_STAFF; write: ADMIN) ───────────────────────

export const getExecutives = () =>
  client.get<Executive[]>('/executives').then(r => r.data);

export const createExecutive = (data: { name: string }) =>
  client.post<Executive>('/executives', data).then(r => r.data);

export const updateExecutive = (id: string, data: { name?: string; isActive?: boolean }) =>
  client.patch<Executive>(`/executives/${id}`, data).then(r => r.data);

export const deleteExecutive = (id: string) =>
  client.delete(`/executives/${id}`);

// ── Routes (GET: ADMIN+OFFICE_STAFF; write: ADMIN) ───────────────────────────

export const getRoutes = () =>
  client.get<AppRoute[]>('/routes').then(r => r.data);

export const createRoute = (data: { routeNumber: string; description?: string | null }) =>
  client.post<AppRoute>('/routes', data).then(r => r.data);

export const updateRoute = (id: string, data: {
  routeNumber?: string; description?: string | null; isActive?: boolean;
}) => client.patch<AppRoute>(`/routes/${id}`, data).then(r => r.data);

export const deleteRoute = (id: string) =>
  client.delete(`/routes/${id}`);

// ── Checkouts (ADMIN + OFFICE_STAFF) ─────────────────────────────────────────

export const issueInvoices = (data: {
  executiveId?: string; routeId?: string;
  outDatetime?: string; invoiceNumbers: string[];
}) => client.post<BatchResult>('/checkouts/issue', data).then(r => r.data);

export const returnInvoices = (data: {
  invoiceNumbers: string[]; inDatetime?: string;
}) => client.post<BatchResult>('/checkouts/return', data).then(r => r.data);

export const markPaymentReceived = (invoiceNumbers: string[]) =>
  client.post<BatchResult>('/checkouts/payment', { invoiceNumbers }).then(r => r.data);

export const getOutstanding = (params?: {
  executiveId?: string; routeId?: string; olderThanDays?: number;
}) => client.get<Checkout[]>('/checkouts/outstanding', { params }).then(r => r.data);

export const voidCheckout = (id: string, voidReason: string) =>
  client.post<Checkout>(`/checkouts/${id}/void`, { voidReason }).then(r => r.data);

// ── Invoices (any authenticated) ──────────────────────────────────────────────

export const getInvoiceHistory = (invoiceNumber: string) =>
  client.get<InvoiceHistory>(
    `/invoices/${encodeURIComponent(invoiceNumber)}/history`
  ).then(r => r.data);

export const searchInvoices = (params: {
  invoiceNumber?: string;
  executiveId?:   string;
  routeId?:       string;
  dateFrom?:      string;
  dateTo?:        string;
  status?:        string;
}) => client.get<CheckoutHistory[]>('/invoices/search', { params }).then(r => r.data);

// ── Me (EXECUTIVE only) ───────────────────────────────────────────────────────

export const getMyOutstanding = () =>
  client.get<MeOutstanding[]>('/me/outstanding').then(r => r.data);

export const getMyHistory = () =>
  client.get<MeHistoryItem[]>('/me/history').then(r => r.data);

// ── Approvals ─────────────────────────────────────────────────────────────────

export const createApproval = (data: {
  requestType:       ApprovalRequestType;
  executiveId?:      string;
  routeId?:          string;
  invoiceNumbers:    string[];
  requestedDatetime: string;
  reason:            string;
}) => client.post<ApprovalRequest>('/approvals', data).then(r => r.data);

export const getApprovals = (params?: { status?: ApprovalStatus }) =>
  client.get<ApprovalRequest[]>('/approvals', { params }).then(r => r.data);

export const approveRequest = (id: string) =>
  client.post<ApprovalActionResult>(`/approvals/${id}/approve`).then(r => r.data);

export const rejectRequest = (id: string, reviewReason: string) =>
  client.post<ApprovalRequest>(`/approvals/${id}/reject`, { reviewReason }).then(r => r.data);

// ── CSV Export (browser download — not Axios fetch) ───────────────────────────

export function buildExportUrl(
  path: '/export/history.csv' | '/export/outstanding.csv',
  params: Record<string, string>,
): string {
  const token = localStorage.getItem('token') ?? '';
  const base  = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:3000';
  const qs    = new URLSearchParams({ ...params, token }).toString();
  return `${base}${path}?${qs}`;
}
