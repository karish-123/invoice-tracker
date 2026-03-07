import { useState, useEffect } from 'react';
import * as api from '../../api/endpoints';
import type { MeOutstanding, MeHistoryItem } from '../../types';
import StatusBadge from '../../components/StatusBadge';
import Spinner    from '../../components/Spinner';

const fmt = (iso: string | null) => iso ? new Date(iso).toLocaleString() : '—';
const daysOut = (iso: string) => Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);

export default function MyOutstandingPage() {
  const [outstanding, setOutstanding] = useState<MeOutstanding[]>([]);
  const [history,     setHistory]     = useState<MeHistoryItem[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState('');
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    setLoading(true);
    Promise.all([api.getMyOutstanding(), api.getMyHistory()])
      .then(([out, hist]) => {
        setOutstanding(out);
        setHistory(hist);
      })
      .catch(() => setError('Failed to load your invoices.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner text="Loading…" />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">My Invoices</h1>
        <span className="text-sm text-gray-500">{outstanding.length} outstanding</span>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {/* Outstanding */}
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b bg-gray-50">
          <h2 className="font-semibold text-sm text-gray-700">Outstanding Invoices</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="th">Invoice #</th>
              <th className="th">Route</th>
              <th className="th">Issued At</th>
              <th className="th">Days Out</th>
              <th className="th">Issued By</th>
              <th className="th">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {outstanding.length === 0 && (
              <tr>
                <td colSpan={6} className="td text-center text-gray-400 py-8">
                  No outstanding invoices — all clear!
                </td>
              </tr>
            )}
            {outstanding.map(row => (
              <tr key={row.id} className="hover:bg-gray-50">
                <td className="td font-mono font-medium">{row.invoiceNumber}</td>
                <td className="td">{row.route.routeNumber}</td>
                <td className="td whitespace-nowrap">{fmt(row.outDatetime)}</td>
                <td className="td">
                  <span className={`font-medium ${daysOut(row.outDatetime) >= 7 ? 'text-red-600' : ''}`}>
                    {daysOut(row.outDatetime)}d
                  </span>
                </td>
                <td className="td">{row.outByUser.name}</td>
                <td className="td"><StatusBadge status={row.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* History toggle */}
      <div>
        <button onClick={() => setShowHistory(v => !v)} className="btn-ghost text-sm">
          {showHistory ? 'Hide' : 'Show'} full history ({history.length} records)
        </button>
      </div>

      {showHistory && (
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b bg-gray-50">
            <h2 className="font-semibold text-sm text-gray-700">Full History</h2>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="th">Invoice #</th>
                <th className="th">Route</th>
                <th className="th">Issued At</th>
                <th className="th">Returned At</th>
                <th className="th">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {history.map(row => (
                <tr key={row.id} className="hover:bg-gray-50">
                  <td className="td font-mono font-medium">{row.invoiceNumber}</td>
                  <td className="td">{row.route.routeNumber}</td>
                  <td className="td whitespace-nowrap">{fmt(row.outDatetime)}</td>
                  <td className="td whitespace-nowrap">{fmt(row.inDatetime)}</td>
                  <td className="td"><StatusBadge status={row.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
