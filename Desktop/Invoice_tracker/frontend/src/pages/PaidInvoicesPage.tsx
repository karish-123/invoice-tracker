import { useState, useEffect, useCallback } from 'react';
import * as api from '../api/endpoints';
import type { Checkout, Executive, AppRoute, Shop } from '../types';
import StatusBadge  from '../components/StatusBadge';
import Spinner      from '../components/Spinner';
import PrintButton  from '../components/PrintButton';
import { downloadCsv } from '../api/endpoints';

const fmt = (iso: string | null) => iso ? new Date(iso).toLocaleString() : '—';

export default function PaidInvoicesPage() {
  const [rows,        setRows]       = useState<Checkout[]>([]);
  const [executives,  setExecs]      = useState<Executive[]>([]);
  const [routes,      setRoutes]     = useState<AppRoute[]>([]);
  const [shops,       setShops]      = useState<Shop[]>([]);
  const [loading,     setLoading]    = useState(true);
  const [error,       setError]      = useState('');

  // Filters
  const [filterExec,  setFilterExec] = useState('');
  const [filterRoute, setFilterRoute]= useState('');
  const [filterShop,  setFilterShop] = useState('');

  // Sort
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const toggleSort = (col: string) => {
    if (sortCol === col) {
      if (sortDir === 'asc') setSortDir('desc');
      else { setSortCol(null); setSortDir('asc'); }
    } else { setSortCol(col); setSortDir('asc'); }
  };
  const sortArrow = (col: string) => sortCol === col ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ' ↕';
  const getSortVal = (row: Checkout, col: string): string | number => {
    switch (col) {
      case 'invoiceNumber': return row.invoiceNumber;
      case 'executive':     return row.executive?.name ?? '';
      case 'route':         return row.route.routeNumber;
      case 'issued':        return row.outDatetime;
      case 'returned':      return row.inDatetime ?? '';
      case 'shop':          return row.shop?.name ?? '';
      case 'paidAt':        return row.paymentReceivedAt ?? '';
      case 'status':        return row.status;
      case 'amount':        return row.invoiceAmount ?? -1;
      default:              return '';
    }
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params: Parameters<typeof api.getPaidInvoices>[0] = {};
      if (filterExec)  params.executiveId = filterExec;
      if (filterRoute) params.routeId     = filterRoute;
      const [data, execs, rts, shs] = await Promise.all([
        api.getPaidInvoices(params),
        api.getExecutives(),
        api.getRoutes(),
        api.getShops(),
      ]);
      setRows(data);
      setExecs(execs);
      setRoutes(rts);
      setShops(shs);
    } catch {
      setError('Failed to load paid invoices.');
    } finally {
      setLoading(false);
    }
  }, [filterExec, filterRoute]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filteredRows = filterShop ? rows.filter(r => r.shop?.id === filterShop) : rows;
  const displayRows = sortCol
    ? [...filteredRows].sort((a, b) => {
        const va = getSortVal(a, sortCol);
        const vb = getSortVal(b, sortCol);
        const cmp = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb));
        return sortDir === 'asc' ? cmp : -cmp;
      })
    : filteredRows;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Paid Invoices</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">{rows.length} record{rows.length !== 1 ? 's' : ''}</span>
          <button
            onClick={() => {
              const params: Record<string, string> = {};
              if (filterExec)  params.executiveId = filterExec;
              if (filterRoute) params.routeId     = filterRoute;
              downloadCsv('/export/paid.csv', params, 'paid-invoices.csv').catch(() => alert('Export failed.'));
            }}
            className="btn-ghost text-sm no-print"
          >
            Export CSV
          </button>
          <PrintButton title="Paid Invoices" />
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
          <select value={filterRoute} onChange={e => { setFilterRoute(e.target.value); setFilterShop(''); }} className="input">
            <option value="">All</option>
            {routes.map(r => <option key={r.id} value={r.id}>{r.routeNumber}</option>)}
          </select>
        </div>
        <div className="flex-1 min-w-36">
          <label className="label">Shop</label>
          <select value={filterShop} onChange={e => setFilterShop(e.target.value)} className="input">
            <option value="">All</option>
            {(filterRoute ? shops.filter(s => s.routeId === filterRoute) : shops).map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
        <div className="flex items-end">
          <button onClick={() => { setFilterExec(''); setFilterRoute(''); setFilterShop(''); }} className="btn-ghost text-xs">
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
                {[
                  ['invoiceNumber', 'Invoice #'],
                  ['executive', 'Executive'],
                  ['route', 'Route'],
                  ['shop', 'Shop'],
                  ['issued', 'Issued'],
                  ['returned', 'Returned'],
                  ['paidAt', 'Paid At'],
                  ['status', 'Status'],
                  ['amount', 'Amount'],
                ].map(([key, label]) => (
                  <th key={key} className="th cursor-pointer select-none whitespace-nowrap" onClick={() => toggleSort(key)}>
                    {label}{sortArrow(key)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {displayRows.length === 0 && (
                <tr><td colSpan={9} className="td text-center text-gray-400 py-8">No paid invoices</td></tr>
              )}
              {displayRows.map(row => (
                <tr key={row.id} className="hover:bg-gray-50">
                  <td className="td font-mono font-medium">{row.invoiceNumber}</td>
                  <td className="td">{row.executive?.name ?? '—'}</td>
                  <td className="td">{row.route.routeNumber}</td>
                  <td className="td">{row.shop?.name ?? '—'}</td>
                  <td className="td whitespace-nowrap">{fmt(row.outDatetime)}</td>
                  <td className="td whitespace-nowrap">{fmt(row.inDatetime)}</td>
                  <td className="td whitespace-nowrap">{fmt(row.paymentReceivedAt)}</td>
                  <td className="td"><StatusBadge status={row.status} /></td>
                  <td className="td">{row.invoiceAmount != null ? `₹${row.invoiceAmount.toLocaleString('en-IN')}` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
