import { useState, useEffect, useCallback } from 'react';
import * as api from '../api/endpoints';
import { buildExportUrl } from '../api/endpoints';
import type { Checkout, Executive, AppRoute } from '../types';
import StatusBadge from '../components/StatusBadge';
import Spinner     from '../components/Spinner';
import Modal       from '../components/Modal';

const fmt = (iso: string) => new Date(iso).toLocaleString();
const daysOut = (iso: string) => Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);

export default function OutstandingPage() {
  const [rows,        setRows]       = useState<Checkout[]>([]);
  const [executives,  setExecs]      = useState<Executive[]>([]);
  const [routes,      setRoutes]     = useState<AppRoute[]>([]);
  const [loading,     setLoading]    = useState(true);
  const [error,       setError]      = useState('');

  // Filters
  const [filterExec,  setFilterExec] = useState('');
  const [filterRoute, setFilterRoute]= useState('');
  const [filterDays,  setFilterDays] = useState('');

  // Sort
  const [routeSort, setRouteSort] = useState<'asc' | 'desc' | null>(null);

  // Void modal
  const [voidTarget,  setVoidTarget] = useState<Checkout | null>(null);
  const [voidReason,  setVoidReason] = useState('');
  const [voiding,     setVoiding]    = useState(false);
  const [voidError,   setVoidError]  = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params: Parameters<typeof api.getOutstanding>[0] = {};
      if (filterExec)  params.executiveId   = filterExec;
      if (filterRoute) params.routeId       = filterRoute;
      if (filterDays)  params.olderThanDays = Number(filterDays);
      const [data, execs, rts] = await Promise.all([
        api.getOutstanding(params),
        api.getExecutives(),
        api.getRoutes(),
      ]);
      setRows(data);
      setExecs(execs);
      setRoutes(rts);
    } catch {
      setError('Failed to load outstanding checkouts.');
    } finally {
      setLoading(false);
    }
  }, [filterExec, filterRoute, filterDays]);

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
        <h1 className="text-2xl font-bold">Outstanding Invoices</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">{rows.length} record{rows.length !== 1 ? 's' : ''}</span>
          <button
            onClick={() => {
              const params: Record<string, string> = {};
              if (filterExec)  params.executiveId   = filterExec;
              if (filterRoute) params.routeId       = filterRoute;
              if (filterDays)  params.olderThanDays = filterDays;
              window.location.href = buildExportUrl('/export/outstanding.csv', params);
            }}
            className="btn-ghost text-sm"
          >
            Export CSV
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4 flex flex-wrap gap-3">
        <div className="flex-1 min-w-36">
          <label className="label">Executive</label>
          <select value={filterExec} onChange={e => setFilterExec(e.target.value)} className="input">
            <option value="">All</option>
            {executives.map(ex => <option key={ex.id} value={ex.id}>{ex.name}</option>)}
          </select>
        </div>
        <div className="flex-1 min-w-36">
          <label className="label">Route</label>
          <select value={filterRoute} onChange={e => setFilterRoute(e.target.value)} className="input">
            <option value="">All</option>
            {routes.map(r => <option key={r.id} value={r.id}>{r.routeNumber}</option>)}
          </select>
        </div>
        <div className="w-36">
          <label className="label">Older than (days)</label>
          <input
            type="number" min="0" placeholder="e.g. 7"
            value={filterDays} onChange={e => setFilterDays(e.target.value)}
            className="input"
          />
        </div>
        <div className="flex items-end">
          <button onClick={() => { setFilterExec(''); setFilterRoute(''); setFilterDays(''); }} className="btn-ghost text-xs">
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
                <th className="th">Executive</th>
                <th
                  className="th cursor-pointer select-none whitespace-nowrap"
                  onClick={() => setRouteSort(s => s === 'asc' ? 'desc' : 'asc')}
                >
                  Route {routeSort === 'asc' ? '↑' : routeSort === 'desc' ? '↓' : '↕'}
                </th>
                <th className="th">Issued</th>
                <th className="th">Days Out</th>
                <th className="th">Issued By</th>
                <th className="th">Status</th>
                <th className="th"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.length === 0 && (
                <tr><td colSpan={8} className="td text-center text-gray-400 py-8">No outstanding invoices</td></tr>
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
                  <td className="td">{row.executive.name}</td>
                  <td className="td">{row.route.routeNumber}</td>
                  <td className="td whitespace-nowrap">{fmt(row.outDatetime)}</td>
                  <td className="td">
                    <span className={`font-medium ${daysOut(row.outDatetime) >= 7 ? 'text-red-600' : ''}`}>
                      {daysOut(row.outDatetime)}d
                    </span>
                  </td>
                  <td className="td">{row.outByUser.name}</td>
                  <td className="td"><StatusBadge status={row.status} /></td>
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
              This will permanently void this checkout. The invoice can be re-issued afterwards.
            </p>
            {voidError && <p className="text-sm text-red-600">{voidError}</p>}
            <div>
              <label className="label">Reason *</label>
              <textarea
                rows={3}
                value={voidReason}
                onChange={e => setVoidReason(e.target.value)}
                className="input resize-none"
                placeholder="Explain why this checkout is being voided…"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setVoidTarget(null)} className="btn-ghost">Cancel</button>
              <button onClick={handleVoid} disabled={voiding || !voidReason.trim()} className="btn-danger">
                {voiding ? 'Voiding…' : 'Void Checkout'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
