// ── Derived strictly from API_CONTRACT.md / backend source ──────────────────

export type Role = 'ADMIN' | 'OFFICE_STAFF' | 'EXECUTIVE';
export type CheckoutStatus = 'OUTSTANDING' | 'RETURNED' | 'VOIDED' | 'PAID';

export interface AuthUser {
  id:          string;
  name:        string;
  username:    string;
  role:        Role;
  executiveId: string | null;
}

export interface LoginResponse {
  token: string;
  user:  AuthUser;
}

export interface User {
  id:          string;
  name:        string;
  username:    string;
  role:        Role;
  isActive:    boolean;
  executiveId: string | null;
  createdAt:   string;
}

export interface Executive {
  id:       string;
  name:     string;
  isActive: boolean;
}

export interface AppRoute {
  id:          string;
  routeNumber: string;
  description: string | null;
  isActive:    boolean;
}

export interface UserRef {
  id:   string;
  name: string;
}

export interface Checkout {
  id:            string;
  invoiceNumber: string;
  remarks:       string | null;
  executive:     UserRef;
  route:         { id: string; routeNumber: string };
  shop:          { id: string; name: string } | null;
  outDatetime:   string;
  outByUser:     UserRef;
  inDatetime:    string | null;
  inByUser:      UserRef | null;
  status:               CheckoutStatus;
  voided:               boolean;
  voidReason:           string | null;
  paymentReceived:      boolean;
  paymentReceivedAt:    string | null;
  invoiceAmount:        number | null;
  createdAt:            string;
}

export interface CheckoutHistory extends Checkout {
  voidedByUser:         UserRef | null;
  voidedAt:             string | null;
  paymentReceivedByUser: UserRef | null;
}

export interface PendingInvoice {
  id:            string;
  invoiceNumber: string;
  route:         { id: string; routeNumber: string };
  outDatetime:   string;
  outByUser:     UserRef;
  voided:        boolean;
  invoiceAmount: number | null;
}

export interface IssueResult {
  invoiceNumber: string;
  success:       boolean;
  checkoutId?:   string;
  error?:        string;
}

export interface BatchResult {
  results: IssueResult[];
}

export interface InvoiceHistory {
  invoiceNumber:  string;
  totalCheckouts: number;
  history:        CheckoutHistory[];
}

export interface MeOutstanding {
  id:            string;
  invoiceNumber: string;
  route:         { id: string; routeNumber: string };
  shop:          { id: string; name: string } | null;
  outDatetime:   string;
  outByUser:     UserRef;
  status:        'OUTSTANDING';
}

export interface MeHistoryItem {
  id:            string;
  invoiceNumber: string;
  route:         { id: string; routeNumber: string };
  shop:          { id: string; name: string } | null;
  outDatetime:   string;
  outByUser:     UserRef;
  inDatetime:    string | null;
  inByUser:      UserRef | null;
  status:        CheckoutStatus;
}

// ── Approval Requests ────────────────────────────────────────────────────────

export type ApprovalRequestType = 'CHECKOUT_BACKDATE' | 'RETURN_BACKDATE';
export type ApprovalStatus      = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface ApprovalPayload {
  executiveId?:      string;
  routeId?:          string;
  invoiceNumbers:    string[];
  requestedDatetime: string;
  reason:            string;
}

export interface ApprovalRequest {
  id:           string;
  requestType:  ApprovalRequestType;
  requestedBy:  UserRef;
  requestedAt:  string;
  status:       ApprovalStatus;
  reviewedBy:   UserRef | null;
  reviewedAt:   string | null;
  reviewReason: string | null;
  payload:      ApprovalPayload;
}

export interface ApprovalActionResult {
  approval: ApprovalRequest;
  results?: IssueResult[];
}

// ── Field Reports ─────────────────────────────────────────────────────────────

export type FieldReportStatus =
  | 'VISITED'
  | 'ORDER_DONE'
  | 'PAYMENT_DONE'
  | 'ORDER_PAYMENT_DONE'
  | 'NEW_SHOP';

export type FieldReportRemark =
  | 'DEFAULT'
  | 'WITH_STAND'
  | 'URGENT'
  | 'PAYMENT_ON_DELIVERY'
  | 'IMMEDIATE_PAYMENT'
  | 'CUSTOM';

export type FieldReportApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface Shop {
  id:       string;
  name:     string;
  routeId:  string;
  route:    { id: string; routeNumber: string };
  isActive: boolean;
}

export interface FieldReport {
  id:              string;
  route:           { id: string; routeNumber: string };
  shop:            { id: string; name: string } | null;
  newShopName:     string | null;
  isNewShop:       boolean;
  status:          FieldReportStatus;
  apprValue:       string | null;
  remark:          FieldReportRemark;
  customRemark:    string | null;
  orderTakenBy:    string;
  visitDate:       string;
  executive:       { id: string; name: string };
  createdByUser:   { id: string; name: string };
  createdAt:       string;
  approvalStatus:  FieldReportApprovalStatus;
  reviewedByUser:  { id: string; name: string } | null;
  reviewedAt:      string | null;
  reviewRemark:    string | null;
}

export interface FieldReportApproveResult {
  fieldReport: FieldReport;
  results:     IssueResult[];
}

export interface BulkShopResult {
  total:             number;
  created:           number;
  skippedDuplicates: number;
  routesCreated:     number;
  errors:            { row: number; reason: string }[];
}

// ── Comments ──────────────────────────────────────────────────────────────────

export type CommentEntityType = 'CHECKOUT' | 'FIELD_REPORT' | 'APPROVAL_REQUEST' | 'SHOP';

export interface Comment {
  id:            string;
  entityType:    CommentEntityType;
  entityId:      string;
  text:          string;
  createdByUser: UserRef;
  createdAt:     string;
}

// ── Reports ───────────────────────────────────────────────────────────────────

export interface PerExecutiveSummary {
  executiveId:     string;
  name:            string;
  issuedCount:     number;
  returnedCount:   number;
  paidCount:       number;
  fieldReportCount: number;
  collectedValue:  number;
}

export interface DailyActivity {
  issued:         Checkout[];
  returned:       Checkout[];
  payments:       Checkout[];
  fieldReports:   FieldReport[];
  perExecutive:   PerExecutiveSummary[];
  totalCollected: number;
}
