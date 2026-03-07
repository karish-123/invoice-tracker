// ── Derived strictly from API_CONTRACT.md / backend source ──────────────────

export type Role = 'ADMIN' | 'OFFICE_STAFF' | 'EXECUTIVE';
export type CheckoutStatus = 'OUTSTANDING' | 'RETURNED' | 'VOIDED';

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
  executive:     UserRef;
  route:         { id: string; routeNumber: string };
  outDatetime:   string;
  outByUser:     UserRef;
  inDatetime:    string | null;
  inByUser:      UserRef | null;
  status:        CheckoutStatus;
  voided:        boolean;
  voidReason:    string | null;
  createdAt:     string;
}

export interface CheckoutHistory extends Checkout {
  voidedByUser: UserRef | null;
  voidedAt:     string | null;
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
  outDatetime:   string;
  outByUser:     UserRef;
  status:        'OUTSTANDING';
}

export interface MeHistoryItem {
  id:            string;
  invoiceNumber: string;
  route:         { id: string; routeNumber: string };
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
