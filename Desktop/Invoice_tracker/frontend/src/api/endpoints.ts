// Typed wrappers — shapes match API_CONTRACT.md exactly
import client from './client';
import type {
  LoginResponse, User, Executive, AppRoute,
  Checkout, BatchResult, InvoiceHistory, MeOutstanding, MeHistoryItem,
  ApprovalRequest, ApprovalActionResult, ApprovalStatus, CheckoutHistory,
  ApprovalRequestType, PendingInvoice,
  Shop, FieldReport, FieldReportApproveResult, BulkShopResult,
  FieldReportStatus, FieldReportRemark, FieldReportApprovalStatus,
  Comment, CommentEntityType, DailyActivity,
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

export const addMasterInvoices = (data: {
  routeId: string;
  shopId?: string;
  outDatetime?: string;
  invoices: { invoiceNumber: string; remarks?: string; invoiceAmount?: number }[];
}) => client.post<BatchResult>('/checkouts/master', data).then(r => r.data);

export const addOldInvoices = (data: {
  routeId: string;
  invoices: { invoiceNumber: string; invoiceAmount?: number }[];
}) => client.post<BatchResult>('/checkouts/old-invoices', data).then(r => r.data);

export const getPendingInvoices = (params?: { routeId?: string }) =>
  client.get<PendingInvoice[]>('/checkouts/pending', { params }).then(r => r.data);

export const issueInvoices = (data: {
  executiveId?: string; routeId?: string;
  outDatetime?: string; invoiceNumbers: string[];
}) => client.post<BatchResult>('/checkouts/issue', data).then(r => r.data);

export const returnInvoices = (data: {
  invoiceNumbers: string[]; inDatetime?: string; remarks?: string;
}) => client.post<BatchResult>('/checkouts/return', data).then(r => r.data);

export const markPaymentReceived = (invoiceNumbers: string[]) =>
  client.post<BatchResult>('/checkouts/payment', { invoiceNumbers }).then(r => r.data);

export const getOutstanding = (params?: {
  executiveId?: string; routeId?: string; olderThanDays?: number;
}) => client.get<Checkout[]>('/checkouts/outstanding', { params }).then(r => r.data);

export const getPaidInvoices = (params?: {
  executiveId?: string; routeId?: string;
}) => client.get<Checkout[]>('/checkouts/paid', { params }).then(r => r.data);

export const voidCheckout = (id: string, voidReason: string, returnToPending?: boolean) =>
  client.post<Checkout>(`/checkouts/${id}/void`, { voidReason, returnToPending }).then(r => r.data);

export const updateCheckout = (id: string, data: {
  routeId?: string; shopId?: string | null; executiveId?: string | null;
  invoiceNumber?: string; outDatetime?: string;
  status?: string; invoiceAmount?: number | null;
}) => client.patch<CheckoutHistory>(`/checkouts/${id}`, data).then(r => r.data);

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

// ── Shops ─────────────────────────────────────────────────────────────────────

export const getShops = (params?: { routeId?: string; includeInactive?: boolean }) =>
  client.get<Shop[]>('/shops', { params }).then(r => r.data);

export const createShop = (routeId: string, name: string) =>
  client.post<Shop>('/shops', { routeId, name }).then(r => r.data);

export const updateShop = (id: string, data: { name?: string; isActive?: boolean }) =>
  client.patch<Shop>(`/shops/${id}`, data).then(r => r.data);

export const bulkCreateShops = (rows: { routeNumber: string; shopName: string }[]) =>
  client.post<BulkShopResult>('/shops/bulk', { rows }).then(r => r.data);

// ── Field Reports ─────────────────────────────────────────────────────────────

export const createFieldReport = (data: {
  routeId:      string;
  shopId?:      string;
  newShopName?: string;
  isNewShop?:   boolean;
  status:       FieldReportStatus;
  apprValue?:   number;
  remark:       FieldReportRemark;
  customRemark?: string;
  orderTakenBy: string;
  visitDate:    string;
}) => client.post<FieldReport>('/field-reports', data).then(r => r.data);

export const getFieldReports = (params?: {
  executiveId?:    string;
  routeId?:        string;
  approvalStatus?: FieldReportApprovalStatus;
}) => client.get<FieldReport[]>('/field-reports', { params }).then(r => r.data);

export const updateFieldReport = (id: string, data: {
  routeId?:      string;
  shopId?:       string | null;
  newShopName?:  string | null;
  isNewShop?:    boolean;
  status?:       FieldReportStatus;
  apprValue?:    number | null;
  remark?:       FieldReportRemark;
  customRemark?: string | null;
  orderTakenBy?: string;
  visitDate?:    string;
}) => client.patch<FieldReport>(`/field-reports/${id}`, data).then(r => r.data);

export const approveFieldReport = (id: string, data: {
  invoices?: { invoiceNumber: string; invoiceAmount?: number }[];
  invoiceNumbers?: string[];
  reviewRemark?:   string;
}) => client.post<FieldReportApproveResult>(`/field-reports/${id}/approve`, data).then(r => r.data);

export const rejectFieldReport = (id: string, reviewRemark: string) =>
  client.post<FieldReport>(`/field-reports/${id}/reject`, { reviewRemark }).then(r => r.data);

// ── Comments ──────────────────────────────────────────────────────────────────

export const getComments = (entityType: CommentEntityType, entityId: string) =>
  client.get<Comment[]>('/comments', { params: { entityType, entityId } }).then(r => r.data);

export const addComment = (entityType: CommentEntityType, entityId: string, text: string) =>
  client.post<Comment>('/comments', { entityType, entityId, text }).then(r => r.data);

// ── Reports ───────────────────────────────────────────────────────────────────

export const getPendingOnDate = (date: string) =>
  client.get<Checkout[]>('/checkouts/pending-on-date', { params: { date } }).then(r => r.data);

export const getDailyActivity = (params: { dateFrom: string; dateTo: string; executiveId?: string }) =>
  client.get<DailyActivity>('/checkouts/daily-activity', { params }).then(r => r.data);

// ── CSV Export (authenticated blob download) ──────────────────────────────────

export async function downloadCsv(
  path: string,
  params: Record<string, string>,
  filename: string,
): Promise<void> {
  const res = await client.get<Blob>(path, { params, responseType: 'blob' });
  const url = URL.createObjectURL(res.data);
  const a   = document.createElement('a');
  a.href     = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── Dashboard (JSON summary for Export page) ──────────────────────────────────

export interface DashboardTotals {
  checkoutCount:   number;
  outstandingCount: number;
  returnedCount:   number;
  paidCount:       number;
  voidedCount:     number;
  invoiceValue:    number;
  collectedValue:  number;
}

export interface DashboardByExecutive {
  executiveId:     string;
  name:            string;
  issuedCount:     number;
  returnedCount:   number;
  paidCount:       number;
  outstandingCount: number;
  invoiceValue:    number;
  collectedValue:  number;
}

export interface DashboardByRoute {
  routeId:         string;
  routeNumber:     string;
  issuedCount:     number;
  paidCount:       number;
  outstandingCount: number;
  invoiceValue:    number;
}

export interface DashboardResult {
  totals:      DashboardTotals;
  byExecutive: DashboardByExecutive[];
  byRoute:     DashboardByRoute[];
  rows:        CheckoutHistory[];
}

export const getDashboard = (params: {
  dateFrom?:    string;
  dateTo?:      string;
  executiveId?: string;
  routeId?:     string;
  status?:      string;
}) => client.get<DashboardResult>('/export/dashboard', { params }).then(r => r.data);
