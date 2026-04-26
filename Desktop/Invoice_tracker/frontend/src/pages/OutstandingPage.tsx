import { useState, useEffect, useCallback } from 'react';
import * as api from '../api/endpoints';
import { downloadCsv } from '../api/endpoints';
import type { Checkout, Executive, AppRoute, Shop } from '../types';
import StatusBadge from '../components/StatusBadge';
import Spinner     from '../components/Spinner';
import Modal       from '../components/Modal';
import CommentSection from '../components/CommentSection';
import PrintButton from '../components/PrintButton';

const fmt = (iso: string) => new Date(iso).toLocaleString();
const daysOut = (iso: string) => Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);

export default function OutstandingPage() {
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
  const [filterDays,  setFilterDays] = useState('');

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
      case 'daysOut':       return daysOut(row.outDatetime);
      case 'shop':          return row.shop?.name ?? '';
      case 'issuedBy':      return row.outByUser.name;
      case 'status':        return row.status;
      case 'amount':        return row.invoiceAmount ?? -1;
      default:              return '';
    }
  };

  // Void modal
  const [voidTarget,       setVoidTarget]       = useState<Checkout | null>(null);
  const [voidReason,       setVoidReason]       = useState('');
  const [returnToPending,  setReturnToPending]  = useState(false);
  const [voiding,          setVoiding]          = useState(false);
  const [voidError,        setVoidError]        = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params: Parameters<typeof api.getOutstanding>[0] = {};
      if (filterExec)  params.executiveId   = filterExec;
      if (filterRoute) params.routeId       = filterRoute;
      if (filterDays)  params.olderThanDays = Number(filterDays);
      const [data, execs, rts, shs] = await Promise.all([
        api.getOutstanding(params),
        api.getExecutives(),
        api.getRoutes(),
        api.getShops(),
      ]);
      setRows(data);
      setExecs(execs);
      setRoutes(rts);
      setShops(shs);
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
      await api.voidCheckout(voidTarget.id, voidReason.trim(), returnToPending);
      setVoidTarget(null);
      setVoidReason('');
      setReturnToPending(false);
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
              downloadCsv('/export/outstanding.csv', params, 'outstanding.csv').catch(() => alert('Export failed.'));
            }}
            className="btn-ghost text-sm no-print"
          >
            Export CSV
          </button>
          <PrintButton title="Outstanding Invoices" />
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
        <div className="w-36">
          <label className="label">Older than (days)</label>
          <input
            type="number" min="0" placeholder="e.g. 7"
            value={filterDays} onChange={e => setFilterDays(e.target.value)}
            className="input"
          />
        </div>
        <div className="flex items-end">
          <button onClick={() => { setFilterExec(''); setFilterRoute(''); setFilterShop(''); setFilterDays(''); }} className="btn-ghost text-xs">
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
                {[
                  ['invoiceNumber', 'Invoice #'],
                  ['executive', 'Executive'],
                  ['route', 'Route'],
                  ['shop', 'Shop'],
                  ['issued', 'Issued'],
                  ['daysOut', 'Days Out'],
                  ['issuedBy', 'Issued By'],
                  ['status', 'Status'],
                  ['amount', 'Amount'],
                ].map(([key, label]) => (
                  <th key={key} className="th cursor-pointer select-none whitespace-nowrap" onClick={() => toggleSort(key)}>
                    {label}{sortArrow(key)}
                  </th>
                ))}
                <th className="th no-print">Comments</th>
                <th className="th no-print"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.length === 0 && (
                <tr><td colSpan={11} className="td text-center text-gray-400 py-8">No outstanding invoices</td></tr>
              )}
              {(sortCol
                ? [...rows].filter(r => !filterShop || r.shop?.id === filterShop).sort((a, b) => {
                    const va = getSortVal(a, sortCol!);
                    const vb = getSortVal(b, sortCol!);
                    const cmp = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb));
                    return sortDir === 'asc' ? cmp : -cmp;
                  })
                : rows.filter(r => !filterShop || r.shop?.id === filterShop)
              ).map(row => (
                <tr key={row.id} className="hover:bg-gray-50">
                  <td className="td font-mono font-medium">{row.invoiceNumber}</td>
                  <td className="td">{row.executive.name}</td>
                  <td className="td">{row.route.routeNumber}</td>
                  <td className="td">{row.shop?.name ?? '—'}</td>
                  <td className="td whitespace-nowrap">{fmt(row.outDatetime)}</td>
                  <td className="td">
                    <span className={`font-medium ${daysOut(row.outDatetime) >= 7 ? 'text-red-600' : ''}`}>
                      {daysOut(row.outDatetime)}d
                    </span>
                  </td>
                  <td className="td">{row.outByUser.name}</td>
                  <td className="td"><StatusBadge status={row.status} /></td>
                  <td className="td">{row.invoiceAmount != null ? `₹${row.invoiceAmount.toLocaleString('en-IN')}` : '—'}</td>
                  <td className="td no-print"><CommentSection entityType="CHECKOUT" entityId={row.id} compact showPreview /></td>
                  <td className="td no-print">
                    <button
                      onClick={() => { setVoidTarget(row); setVoidReason(''); setVoidError(''); setReturnToPending(false); }}
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
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={returnToPending}
                onChange={e => setReturnToPending(e.target.checked)}
              />
              Return invoice to pending pool for re-delivery
            </label>
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
