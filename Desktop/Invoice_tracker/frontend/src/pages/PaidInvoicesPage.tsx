import { useState, useEffect, useCallback } from 'react';
import * as api from '../api/endpoints';
import type { Checkout, Executive, AppRoute } from '../types';
import StatusBadge from '../components/StatusBadge';
import Spinner     from '../components/Spinner';

const fmt = (iso: string | null) => iso ? new Date(iso).toLocaleString() : '—';

export default function PaidInvoicesPage() {
  const [rows,        setRows]       = useState<Checkout[]>([]);
  const [executives,  setExecs]      = useState<Executive[]>([]);
  const [routes,      setRoutes]     = useState<AppRoute[]>([]);
  const [loading,     setLoading]    = useState(true);
  const [error,       setError]      = useState('');

  // Filters
  const [filterExec,  setFilterExec] = useState('');
  const [filterRoute, setFilterRoute]= useState('');

  // Sort
  const [routeSort, setRouteSort] = useState<'asc' | 'desc' | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params: Parameters<typeof api.getPaidInvoices>[0] = {};
      if (filterExec)  params.executiveId = filterExec;
      if (filterRoute) params.routeId     = filterRoute;
      const [data, execs, rts] = await Promise.all([
        api.getPaidInvoices(params),
        api.getExecutives(),
        api.getRoutes(),
      ]);
      setRows(data);
      setExecs(execs);
      setRoutes(rts);
    } catch {
      setError('Failed to load paid invoices.');
    } finally {
      setLoading(false);
    }
  }, [filterExec, filterRoute]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const displayRows = routeSort
    ? [...rows].sort((a, b) => {
        const cmp = a.route.routeNumber.localeCompare(b.route.routeNumber);
        return routeSort === 'asc' ? cmp : -cmp;
      })
    : rows;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Paid Invoices</h1>
        <span className="text-sm text-gray-500">{rows.length} record{rows.length !== 1 ? 's' : ''}</span>
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
        <div className="flex items-end">
          <button onClick={() => { setFilterExec(''); setFilterRoute(''); }} className="btn-ghost text-xs">
            Reset
          </button>
        </div>
      </div>

      {error && <p className="text-red-600 text-sm">{error}</p>}

      {loading ? <Spinner text="Loading..." /> : (
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
                <th className="th">Returned</th>
                <th className="th">Paid At</th>
                <th className="th">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {displayRows.length === 0 && (
                <tr><td colSpan={7} className="td text-center text-gray-400 py-8">No paid invoices</td></tr>
              )}
              {displayRows.map(row => (
                <tr key={row.id} className="hover:bg-gray-50">
                  <td className="td font-mono font-medium">{row.invoiceNumber}</td>
                  <td className="td">{row.executive?.name ?? '—'}</td>
                  <td className="td">{row.route.routeNumber}</td>
                  <td className="td whitespace-nowrap">{fmt(row.outDatetime)}</td>
                  <td className="td whitespace-nowrap">{fmt(row.inDatetime)}</td>
                  <td className="td whitespace-nowrap">{fmt(row.paymentReceivedAt)}</td>
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
