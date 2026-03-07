import { useState, useEffect } from 'react';
import * as api from '../api/endpoints';
import type { ApprovalRequest, ApprovalStatus } from '../types';
import Spinner from '../components/Spinner';

const fmt = (iso: string) => new Date(iso).toLocaleString();

const statusColors: Record<ApprovalStatus, string> = {
  PENDING:  'bg-amber-100 text-amber-800',
  APPROVED: 'bg-green-100 text-green-800',
  REJECTED: 'bg-red-100 text-red-800',
};

export default function MyApprovalsPage() {
  const [approvals,  setApprovals]  = useState<ApprovalRequest[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState('');
  const [bannerDismissed, setBannerDismissed] = useState(false);

  useEffect(() => {
    api.getApprovals()
      .then(setApprovals)
      .catch(() => setError('Failed to load your requests.'))
      .finally(() => setLoading(false));
  }, []);

  const rejectedCount = approvals.filter(a => a.status === 'REJECTED').length;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">My Backdate Requests</h1>

      {rejectedCount > 0 && !bannerDismissed && (
        <div className="flex items-start justify-between bg-amber-50 border border-amber-200 rounded px-4 py-3">
          <p className="text-sm text-amber-800">
            {rejectedCount} of your request{rejectedCount !== 1 ? 's were' : ' was'} rejected. Review the reason below.
          </p>
          <button onClick={() => setBannerDismissed(true)} className="text-amber-600 hover:text-amber-800 text-lg leading-none ml-4">×</button>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      {loading ? <Spinner text="Loading…" /> : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="th">Type</th>
                <th className="th">Submitted At</th>
                <th className="th">Invoices</th>
                <th className="th">Backdated To</th>
                <th className="th">Reason</th>
                <th className="th">Status</th>
                <th className="th">Review Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {approvals.length === 0 && (
                <tr><td colSpan={7} className="td text-center text-gray-400 py-8">No backdate requests yet</td></tr>
              )}
              {approvals.map(a => {
                const nums = a.payload.invoiceNumbers;
                const invoicePreview = nums.slice(0, 2).join(', ') + (nums.length > 2 ? ` +${nums.length - 2} more` : '');
                return (
                  <tr key={a.id} className="hover:bg-gray-50">
                    <td className="td text-xs font-mono">
                      {a.requestType === 'CHECKOUT_BACKDATE' ? 'Issue' : 'Return'}
                    </td>
                    <td className="td whitespace-nowrap">{fmt(a.requestedAt)}</td>
                    <td className="td text-xs font-mono" title={nums.join(', ')}>{invoicePreview}</td>
                    <td className="td whitespace-nowrap">{fmt(a.payload.requestedDatetime)}</td>
                    <td className="td max-w-xs">
                      <span className="line-clamp-2 text-xs text-gray-600" title={a.payload.reason}>
                        {a.payload.reason}
                      </span>
                    </td>
                    <td className="td">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusColors[a.status]}`}>
                        {a.status}
                      </span>
                    </td>
                    <td className="td text-xs text-gray-500 italic max-w-xs">
                      {a.reviewReason ?? '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
