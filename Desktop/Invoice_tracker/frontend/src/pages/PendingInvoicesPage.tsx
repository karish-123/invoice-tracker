import { useState, useEffect, useCallback } from 'react';
import * as api from '../api/endpoints';
import type { PendingInvoice, AppRoute } from '../types';
import Spinner from '../components/Spinner';
import Modal   from '../components/Modal';

const fmt = (iso: string) => new Date(iso).toLocaleString();

export default function PendingInvoicesPage() {
  const [rows,        setRows]       = useState<PendingInvoice[]>([]);
  const [routes,      setRoutes]     = useState<AppRoute[]>([]);
  const [loading,     setLoading]    = useState(true);
  const [error,       setError]      = useState('');

  // Route filter
  const [filterRoute, setFilterRoute] = useState('');

  // Sort
  const [routeSort, setRouteSort] = useState<'asc' | 'desc' | null>(null);

  // Void modal
  const [voidTarget, setVoidTarget] = useState<PendingInvoice | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const [voiding,    setVoiding]    = useState(false);
  const [voidError,  setVoidError]  = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params: Parameters<typeof api.getPendingInvoices>[0] = {};
      if (filterRoute) params.routeId = filterRoute;
      const [data, rts] = await Promise.all([
        api.getPendingInvoices(params),
        api.getRoutes(),
      ]);
      setRows(data);
      setRoutes(rts);
    } catch {
      setError('Failed to load pending invoices.');
    } finally {
      setLoading(false);
    }
  }, [filterRoute]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleVoid = async () => {
    if (!voidTarget || !voidReason.trim()) return;
    setVoiding(true);
    setVoidError('');
    try {
      await api.voidCheckout(voidTarget.id, voidReason.trim());
      setVoidTarget(null);
      setVoidReason('');
      fetchData();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setVoidError(msg ?? 'Failed to void.');
    } finally {
      setVoiding(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Invoices for Delivery</h1>
        <span className="text-sm text-gray-500">{rows.length} record{rows.length !== 1 ? 's' : ''}</span>
      </div>

      <p className="text-sm text-gray-500">
        Invoices recorded in Master Invoices that have not yet been issued to an executive.
      </p>

      {/* Filters */}
      <div className="card p-4 flex flex-wrap gap-3">
        <div className="flex-1 min-w-36">
          <label className="label">Route</label>
          <select value={filterRoute} onChange={e => setFilterRoute(e.target.value)} className="input">
            <option value="">All</option>
            {routes.map(r => <option key={r.id} value={r.id}>{r.routeNumber}</option>)}
          </select>
        </div>
        <div className="flex items-end">
          <button onClick={() => setFilterRoute('')} className="btn-ghost text-xs">
            Reset
          </button>
        </div>
      </div>

      {error && <p className="text-red-600 text-sm">{error}</p>}

      {loading ? <Spinner text="Loading…" /> : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="th">Invoice #</th>
                <th
                  className="th cursor-pointer select-none whitespace-nowrap"
                  onClick={() => setRouteSort(s => s === 'asc' ? 'desc' : 'asc')}
                >
                  Route {routeSort === 'asc' ? '↑' : routeSort === 'desc' ? '↓' : '↕'}
                </th>
                <th className="th">Date Added</th>
                <th className="th">Added By</th>
                <th className="th"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="td text-center text-gray-400 py-8">
                    No pending invoices — all master invoices have been issued.
                  </td>
                </tr>
              )}
              {(routeSort
                ? [...rows].sort((a, b) => {
                    const cmp = a.route.routeNumber.localeCompare(b.route.routeNumber);
                    return routeSort === 'asc' ? cmp : -cmp;
                  })
                : rows
              ).map(row => (
                <tr key={row.id} className="hover:bg-gray-50">
                  <td className="td font-mono font-medium">{row.invoiceNumber}</td>
                  <td className="td">{row.route.routeNumber}</td>
                  <td className="td whitespace-nowrap">{fmt(row.outDatetime)}</td>
                  <td className="td">{row.outByUser.name}</td>
                  <td className="td">
                    <button
                      onClick={() => { setVoidTarget(row); setVoidReason(''); setVoidError(''); }}
                      className="text-xs text-red-600 hover:underline"
                    >
                      Void
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Void modal */}
      {voidTarget && (
        <Modal title={`Void ${voidTarget.invoiceNumber}`} onClose={() => setVoidTarget(null)}>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              This will permanently void this pending invoice entry. It can be re-added afterwards.
            </p>
            {voidError && <p className="text-sm text-red-600">{voidError}</p>}
            <div>
              <label className="label">Reason *</label>
              <textarea
                rows={3}
                value={voidReason}
                onChange={e => setVoidReason(e.target.value)}
                className="input resize-none"
                placeholder="Explain why this entry is being voided…"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setVoidTarget(null)} className="btn-ghost">Cancel</button>
              <button onClick={handleVoid} disabled={voiding || !voidReason.trim()} className="btn-danger">
                {voiding ? 'Voiding…' : 'Void Entry'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
