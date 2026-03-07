import { useState, useEffect, useCallback } from 'react';
import * as api from '../api/endpoints';
import type { ApprovalRequest, ApprovalStatus, IssueResult } from '../types';
import Modal            from '../components/Modal';
import Spinner          from '../components/Spinner';
import BatchResultTable from '../components/BatchResultTable';

const fmt = (iso: string) => new Date(iso).toLocaleString();

type StatusFilter = ApprovalStatus | '';

const statusColors: Record<ApprovalStatus, string> = {
  PENDING:  'bg-amber-100 text-amber-800',
  APPROVED: 'bg-green-100 text-green-800',
  REJECTED: 'bg-red-100 text-red-800',
};

function ApprovalBadge({ status }: { status: ApprovalStatus }) {
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusColors[status]}`}>
      {status}
    </span>
  );
}

export default function ApprovalsPage() {
  const [approvals,   setApprovals]   = useState<ApprovalRequest[]>([]);
  const [statusFilter,setStatusFilter]= useState<StatusFilter>('PENDING');
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState('');

  // Approve state
  const [approvingId,  setApprovingId]  = useState<string | null>(null);
  const [approveResult,setApproveResult]= useState<{ approval: ApprovalRequest; results: IssueResult[] } | null>(null);

  // Reject modal
  const [rejectTarget, setRejectTarget] = useState<ApprovalRequest | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejecting,    setRejecting]    = useState(false);
  const [rejectError,  setRejectError]  = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.getApprovals(statusFilter ? { status: statusFilter as ApprovalStatus } : undefined);
      setApprovals(data);
    } catch {
      setError('Failed to load approval requests.');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  const handleApprove = async (id: string) => {
    setApprovingId(id);
    try {
      const result = await api.approveRequest(id);
      setApproveResult({ approval: result.approval, results: result.results ?? [] });
      load();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg ?? 'Approval failed.');
    } finally {
      setApprovingId(null);
    }
  };

  const handleReject = async () => {
    if (!rejectTarget || !rejectReason.trim()) return;
    setRejecting(true);
    setRejectError('');
    try {
      await api.rejectRequest(rejectTarget.id, rejectReason.trim());
      setRejectTarget(null);
      setRejectReason('');
      load();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setRejectError(msg ?? 'Rejection failed.');
    } finally {
      setRejecting(false);
    }
  };

  const tabs: { label: string; value: StatusFilter }[] = [
    { label: 'Pending',  value: 'PENDING' },
    { label: 'Approved', value: 'APPROVED' },
    { label: 'Rejected', value: 'REJECTED' },
    { label: 'All',      value: '' },
  ];

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Approval Requests</h1>

      {/* Filter tabs */}
      <div className="flex gap-1">
        {tabs.map(t => (
          <button
            key={t.value}
            onClick={() => setStatusFilter(t.value)}
            className={`btn text-sm py-1 px-3 ${statusFilter === t.value ? 'btn-primary' : 'btn-ghost'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {loading ? <Spinner text="Loading…" /> : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="th">Type</th>
                <th className="th">Requested By</th>
                <th className="th">Requested At</th>
                <th className="th">Invoices</th>
                <th className="th">Backdated To</th>
                <th className="th">Reason</th>
                <th className="th">Status</th>
                <th className="th"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {approvals.length === 0 && (
                <tr><td colSpan={8} className="td text-center text-gray-400 py-8">No requests found</td></tr>
              )}
              {approvals.map(a => {
                const nums = a.payload.invoiceNumbers;
                const invoicePreview = nums.slice(0, 2).join(', ') + (nums.length > 2 ? ` +${nums.length - 2} more` : '');
                return (
                  <tr key={a.id} className="hover:bg-gray-50">
                    <td className="td">
                      <span className="text-xs font-mono">{a.requestType === 'CHECKOUT_BACKDATE' ? 'Issue' : 'Return'}</span>
                    </td>
                    <td className="td">{a.requestedBy.name}</td>
                    <td className="td whitespace-nowrap">{fmt(a.requestedAt)}</td>
                    <td className="td text-xs font-mono" title={nums.join(', ')}>{invoicePreview}</td>
                    <td className="td whitespace-nowrap">{fmt(a.payload.requestedDatetime)}</td>
                    <td className="td max-w-xs">
                      <span className="line-clamp-2 text-xs text-gray-600" title={a.payload.reason}>
                        {a.payload.reason}
                      </span>
                    </td>
                    <td className="td"><ApprovalBadge status={a.status} /></td>
                    <td className="td">
                      {a.status === 'PENDING' && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleApprove(a.id)}
                            disabled={approvingId === a.id}
                            className="text-xs text-green-700 hover:underline font-medium"
                          >
                            {approvingId === a.id ? 'Approving…' : 'Approve'}
                          </button>
                          <button
                            onClick={() => { setRejectTarget(a); setRejectReason(''); setRejectError(''); }}
                            className="text-xs text-red-600 hover:underline"
                          >
                            Reject
                          </button>
                        </div>
                      )}
                      {a.status === 'REJECTED' && a.reviewReason && (
                        <span className="text-xs text-gray-500 italic" title={a.reviewReason}>
                          {a.reviewReason.slice(0, 40)}{a.reviewReason.length > 40 ? '…' : ''}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Approve result modal */}
      {approveResult && (
        <Modal title="Approval Applied" onClose={() => setApproveResult(null)} wide>
          <div className="space-y-4">
            <p className="text-sm text-green-700">Request approved. Per-invoice results:</p>
            <BatchResultTable results={approveResult.results} />
            <div className="flex justify-end">
              <button onClick={() => setApproveResult(null)} className="btn-ghost">Close</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Reject modal */}
      {rejectTarget && (
        <Modal title={`Reject — ${rejectTarget.requestType === 'CHECKOUT_BACKDATE' ? 'Issue' : 'Return'} Backdate`} onClose={() => setRejectTarget(null)}>
          <div className="space-y-4">
            {rejectError && <p className="text-sm text-red-600">{rejectError}</p>}
            <p className="text-sm text-gray-600">
              Invoices: <span className="font-mono text-xs">{rejectTarget.payload.invoiceNumbers.join(', ')}</span>
            </p>
            <div>
              <label className="label">Rejection Reason *</label>
              <textarea
                rows={3}
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                className="input resize-none"
                placeholder="Explain why this request is being rejected…"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setRejectTarget(null)} className="btn-ghost">Cancel</button>
              <button onClick={handleReject} disabled={rejecting || !rejectReason.trim()} className="btn-danger">
                {rejecting ? 'Rejecting…' : 'Reject'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
