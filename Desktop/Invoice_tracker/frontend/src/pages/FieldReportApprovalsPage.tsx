import { useState, useEffect } from 'react';
import * as api from '../api/endpoints';
import type { FieldReport, FieldReportApprovalStatus, FieldReportStatus, FieldReportRemark, AppRoute, Shop } from '../types';
import Spinner from '../components/Spinner';
import CommentSection from '../components/CommentSection';
import PrintButton from '../components/PrintButton';
import { useSort } from '../hooks/useSort';
import {
  STATUS_OPTIONS, REMARK_OPTIONS, STATUS_LABEL, REMARK_LABEL, ORDER_STATUSES,
} from '../constants/fieldReport';

const APPROVAL_BADGE: Record<string, string> = {
  PENDING:  'bg-yellow-100 text-yellow-800',
  APPROVED: 'bg-green-100  text-green-800',
  REJECTED: 'bg-red-100    text-red-800',
};

function shopDisplay(r: FieldReport) {
  if (r.shop) return r.shop.name;
  if (r.newShopName) return `${r.newShopName} (new)`;
  return '—';
}

const fmt = (d: string) => new Date(d).toLocaleDateString();

// ── Edit & Approve Modal ──────────────────────────────────────────────────────

interface ApproveModalProps {
  report:  FieldReport;
  onClose: () => void;
  onDone:  (updated: FieldReport) => void;
}

function ApproveModal({ report, onClose, onDone }: ApproveModalProps) {
  // Editable fields — pre-populated from the report
  const [routeId,       setRouteId]      = useState(report.route.id);
  const [shopId,        setShopId]       = useState(report.shop?.id ?? '');
  const [newShopName,   setNewShopName]  = useState(report.newShopName ?? '');
  const [isNewShopFlag, setIsNewShopFlag]= useState(report.isNewShop);
  const [status,        setStatus]       = useState<FieldReportStatus>(report.status);
  const [apprValue,     setApprValue]    = useState(report.apprValue ? String(Number(report.apprValue)) : '');
  const [remark,        setRemark]       = useState<FieldReportRemark>(report.remark);
  const [customRemark,  setCustomRemark] = useState(report.customRemark ?? '');
  const [orderTakenBy,  setOrderTakenBy] = useState(report.orderTakenBy);
  const [visitDate,     setVisitDate]    = useState(report.visitDate.slice(0, 10));

  // Invoice list (needed when status requires orders)
  const [invoiceInput,  setInvoiceInput] = useState('');
  const [invoiceList,   setInvoiceList]  = useState<{ invoiceNumber: string; invoiceAmount: string }[]>([]);
  const [invoiceAmtInput, setInvoiceAmtInput] = useState('');

  // Review remark
  const [reviewRemark, setReviewRemark] = useState('');

  const [routes,  setRoutes]  = useState<AppRoute[]>([]);
  const [shops,   setShops]   = useState<Shop[]>([]);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  const currentNeedsInvoices = ORDER_STATUSES.has(status);

  useEffect(() => {
    api.getRoutes().then(r => setRoutes(r.filter(x => x.isActive))).catch(() => {});
  }, []);

  useEffect(() => {
    if (!routeId) { setShops([]); return; }
    api.getShops({ routeId }).then(setShops).catch(() => {});
  }, [routeId]);

  const addInvoice = () => {
    const trimmed = invoiceInput.trim();
    if (!trimmed) return;
    if (!invoiceList.find(i => i.invoiceNumber === trimmed)) {
      setInvoiceList(prev => [...prev, { invoiceNumber: trimmed, invoiceAmount: invoiceAmtInput.trim() }]);
    }
    setInvoiceInput('');
    setInvoiceAmtInput('');
  };

  const removeInvoice = (inv: string) =>
    setInvoiceList(prev => prev.filter(i => i.invoiceNumber !== inv));

  const handleSaveAndApprove = async () => {
    if (currentNeedsInvoices && invoiceList.length === 0) {
      setError('Add at least one invoice number.');
      return;
    }
    setLoading(true); setError('');
    try {
      // Step 1: patch any changed fields
      const patch: Parameters<typeof api.updateFieldReport>[1] = {};
      if (routeId       !== report.route.id)           patch.routeId      = routeId;
      if (shopId        !== (report.shop?.id ?? ''))  patch.shopId       = shopId || null;
      if (newShopName   !== (report.newShopName ?? '')) patch.newShopName = newShopName || null;
      if (isNewShopFlag !== report.isNewShop)          patch.isNewShop    = isNewShopFlag;
      if (status        !== report.status)             patch.status       = status;
      if (apprValue !== (report.apprValue ? String(Number(report.apprValue)) : ''))
        patch.apprValue = apprValue ? parseFloat(apprValue) : null;
      if (remark       !== report.remark)           patch.remark       = remark;
      if (customRemark !== (report.customRemark ?? '')) patch.customRemark = customRemark || null;
      if (orderTakenBy !== report.orderTakenBy)     patch.orderTakenBy = orderTakenBy;
      if (visitDate    !== report.visitDate.slice(0, 10)) patch.visitDate = visitDate;

      if (Object.keys(patch).length > 0) {
        await api.updateFieldReport(report.id, patch);
      }

      // Step 2: approve
      const result = await api.approveFieldReport(report.id, {
        invoices: invoiceList.map(i => ({
          invoiceNumber: i.invoiceNumber,
          ...(i.invoiceAmount ? { invoiceAmount: parseFloat(i.invoiceAmount) } : {}),
        })),
        reviewRemark: reviewRemark || undefined,
      });
      onDone(result.fieldReport!);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg ?? 'Operation failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl p-6 space-y-4 my-4">
        <h3 className="font-semibold text-lg">Edit & Approve Field Report</h3>

        <CommentSection entityType="FIELD_REPORT" entityId={report.id} />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Route */}
          <div>
            <label className="label">Route</label>
            <select value={routeId} onChange={e => setRouteId(e.target.value)} className="input">
              {routes.map(r => <option key={r.id} value={r.id}>{r.routeNumber}{r.description ? ` — ${r.description}` : ''}</option>)}
            </select>
          </div>

          {/* Status */}
          <div>
            <label className="label">Status</label>
            <select value={status} onChange={e => setStatus(e.target.value as FieldReportStatus)} className="input">
              {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          {/* Shop */}
          <div className="space-y-1">
            <label className="label">Shop</label>
            <select
              value={shopId}
              onChange={e => { setShopId(e.target.value); if (e.target.value) setNewShopName(''); }}
              className="input"
            >
              <option value="">{isNewShopFlag ? '— Or select existing shop —' : '— None —'}</option>
              {shops.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            {isNewShopFlag && !shopId && (
              <input type="text" value={newShopName} onChange={e => setNewShopName(e.target.value)}
                placeholder="New shop name…" className="input" />
            )}
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={isNewShopFlag}
                onChange={e => { setIsNewShopFlag(e.target.checked); if (!e.target.checked) setNewShopName(''); }}
              />
              New shop
            </label>
          </div>

          {/* Appr. Value */}
          <div>
            <label className="label">Approx. Value (₹)</label>
            <input type="number" min="0" step="0.01" value={apprValue}
              onChange={e => setApprValue(e.target.value)} className="input" placeholder="Optional" />
          </div>

          {/* Remark */}
          <div>
            <label className="label">Remark</label>
            <select value={remark} onChange={e => setRemark(e.target.value as FieldReportRemark)} className="input">
              {REMARK_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          {remark === 'CUSTOM' && (
            <div>
              <label className="label">Custom Remark</label>
              <input type="text" value={customRemark} onChange={e => setCustomRemark(e.target.value)}
                placeholder="Enter message…" className="input" />
            </div>
          )}

          {/* Order Taken By */}
          <div>
            <label className="label">Order Taken By</label>
            <input type="text" value={orderTakenBy} onChange={e => setOrderTakenBy(e.target.value)} className="input" />
          </div>

          {/* Visit Date */}
          <div>
            <label className="label">Visit Date</label>
            <input type="date" value={visitDate} onChange={e => setVisitDate(e.target.value)} className="input" />
          </div>
        </div>

        {/* Invoice list */}
        {currentNeedsInvoices && (
          <div>
            <label className="label">Invoice Numbers {currentNeedsInvoices && <span className="text-red-500">*</span>}</label>
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <input type="text" value={invoiceInput} onChange={e => setInvoiceInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addInvoice(); } }}
                  placeholder="Invoice number…" className="input" />
              </div>
              <div className="w-32">
                <input type="number" min="0" step="0.01" value={invoiceAmtInput}
                  onChange={e => setInvoiceAmtInput(e.target.value)}
                  placeholder="Amount ₹" className="input" />
              </div>
              <button type="button" onClick={addInvoice} className="btn-ghost whitespace-nowrap">Add</button>
            </div>
            {invoiceList.length > 0 && (
              <div className="mt-2 space-y-1">
                {invoiceList.map(inv => (
                  <div key={inv.invoiceNumber} className="flex items-center gap-2 bg-blue-50 px-3 py-1.5 rounded text-sm">
                    <span className="font-mono font-medium flex-1">{inv.invoiceNumber}</span>
                    {inv.invoiceAmount && <span className="text-gray-600">₹{Number(inv.invoiceAmount).toLocaleString()}</span>}
                    <button type="button" onClick={() => removeInvoice(inv.invoiceNumber)}
                      className="text-red-500 hover:text-red-700 ml-1">×</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Review remark */}
        <div>
          <label className="label">Review Note (optional)</label>
          <input type="text" value={reviewRemark} onChange={e => setReviewRemark(e.target.value)}
            placeholder="Optional note…" className="input" />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-3 justify-end pt-2">
          <button type="button" onClick={onClose} className="btn-ghost" disabled={loading}>Cancel</button>
          <button type="button" onClick={handleSaveAndApprove} disabled={loading} className="btn-primary">
            {loading ? 'Saving…' : 'Save & Approve'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Reject Modal ──────────────────────────────────────────────────────────────

interface RejectModalProps {
  report:  FieldReport;
  onClose: () => void;
  onDone:  (updated: FieldReport) => void;
}

function RejectModal({ report, onClose, onDone }: RejectModalProps) {
  const [reviewRemark, setReviewRemark] = useState('');
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState('');

  const handleReject = async () => {
    if (!reviewRemark.trim()) { setError('Remark is required for rejection.'); return; }
    setLoading(true); setError('');
    try {
      const updated = await api.rejectFieldReport(report.id, reviewRemark);
      onDone(updated);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg ?? 'Rejection failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 space-y-4">
        <h3 className="font-semibold text-lg">Reject Field Report</h3>
        <div className="text-sm text-gray-600 space-y-1">
          <p><span className="font-medium">Shop:</span> {shopDisplay(report)}</p>
          <p><span className="font-medium">Executive:</span> {report.executive.name}</p>
        </div>
        <CommentSection entityType="FIELD_REPORT" entityId={report.id} />
        <div>
          <label className="label">Reason for Rejection <span className="text-red-500">*</span></label>
          <input type="text" value={reviewRemark} onChange={e => setReviewRemark(e.target.value)}
            placeholder="Required…" className="input" />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex gap-3 justify-end pt-2">
          <button type="button" onClick={onClose} className="btn-ghost" disabled={loading}>Cancel</button>
          <button type="button" onClick={handleReject} disabled={loading}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-1.5 rounded text-sm font-medium disabled:opacity-50">
            {loading ? 'Rejecting…' : 'Reject'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function FieldReportApprovalsPage() {
  const [reports,      setReports]      = useState<FieldReport[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState('');
  const [filterStatus, setFilterStatus] = useState<FieldReportApprovalStatus | ''>('PENDING');
  const [approvingId,  setApprovingId]  = useState<string | null>(null);
  const [rejectingId,  setRejectingId]  = useState<string | null>(null);

  const sort = useSort<FieldReport>((r, col) => {
    switch (col) {
      case 'date':         return r.visitDate;
      case 'executive':    return r.executive.name;
      case 'route':        return r.route.routeNumber;
      case 'shop':         return shopDisplay(r);
      case 'status':       return r.status;
      case 'value':        return r.apprValue ? Number(r.apprValue) : 0;
      case 'remark':       return r.remark === 'CUSTOM' ? (r.customRemark ?? '') : REMARK_LABEL[r.remark];
      case 'orderTakenBy': return r.orderTakenBy;
      case 'approval':     return r.approvalStatus;
      case 'note':         return r.reviewRemark ?? '';
      default:             return '';
    }
  });

  const fetchReports = () => {
    setLoading(true);
    api.getFieldReports(filterStatus ? { approvalStatus: filterStatus as FieldReportApprovalStatus } : {})
      .then(setReports)
      .catch(() => setError('Failed to load field reports.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchReports(); }, [filterStatus]);

  const handleDone = (updated: FieldReport) => {
    setReports(prev => prev.map(r => r.id === updated.id ? updated : r));
    setApprovingId(null);
    setRejectingId(null);
  };

  const approvingReport = reports.find(r => r.id === approvingId) ?? null;
  const rejectingReport = reports.find(r => r.id === rejectingId) ?? null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Field Report Approvals</h1>
        <div className="flex items-center gap-3 no-print">
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value as FieldReportApprovalStatus | '')}
            className="input w-40"
          >
            <option value="">All</option>
            <option value="PENDING">Pending</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
          </select>
          <PrintButton title="Field Report Approvals" />
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {loading ? <Spinner text="Loading…" /> : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                {[
                  ['date', 'Date'], ['executive', 'Executive'], ['route', 'Route'],
                  ['shop', 'Shop'], ['status', 'Status'], ['value', 'Appr. Value'],
                  ['remark', 'Remarks'], ['orderTakenBy', 'Order Taken By'],
                  ['approval', 'Approval'], ['note', 'Review Note'],
                ].map(([key, label]) => (
                  <th key={key} className="th cursor-pointer select-none whitespace-nowrap" onClick={() => sort.toggleSort(key)}>
                    {label}{sort.sortArrow(key)}
                  </th>
                ))}
                <th className="th no-print">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {reports.length === 0 && (
                <tr>
                  <td colSpan={11} className="td text-center text-gray-400 py-8">No field reports found.</td>
                </tr>
              )}
              {sort.sortRows(reports).map(r => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="td whitespace-nowrap">{fmt(r.visitDate)}</td>
                  <td className="td">{r.executive.name}</td>
                  <td className="td">{r.route.routeNumber}</td>
                  <td className="td">{shopDisplay(r)}</td>
                  <td className="td whitespace-nowrap">
                    {STATUS_LABEL[r.status] ?? r.status}
                    {r.isNewShop && <span className="ml-1.5 text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">New</span>}
                  </td>
                  <td className="td">{r.apprValue ? `₹${Number(r.apprValue).toLocaleString()}` : '—'}</td>
                  <td className="td">
                    {r.remark === 'CUSTOM' ? r.customRemark : REMARK_LABEL[r.remark]}
                  </td>
                  <td className="td">{r.orderTakenBy}</td>
                  <td className="td">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${APPROVAL_BADGE[r.approvalStatus]}`}>
                      {r.approvalStatus}
                    </span>
                  </td>
                  <td className="td text-gray-500">{r.reviewRemark ?? '—'}</td>
                  <td className="td no-print">
                    {r.approvalStatus === 'PENDING' && (
                      <div className="flex gap-2">
                        <button onClick={() => setApprovingId(r.id)}
                          className="text-xs text-green-700 hover:underline font-medium">
                          Approve
                        </button>
                        <button onClick={() => setRejectingId(r.id)}
                          className="text-xs text-red-600 hover:underline font-medium">
                          Reject
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {approvingReport && (
        <ApproveModal report={approvingReport} onClose={() => setApprovingId(null)} onDone={handleDone} />
      )}
      {rejectingReport && (
        <RejectModal report={rejectingReport} onClose={() => setRejectingId(null)} onDone={handleDone} />
      )}
    </div>
  );
}
