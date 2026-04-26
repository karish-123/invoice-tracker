import { useState, useEffect } from 'react';
import * as api from '../api/endpoints';
import type { DashboardResult } from '../api/endpoints';
import type { Executive, AppRoute, CheckoutHistory } from '../types';
import { useAuth } from '../context/AuthContext';
import { useSort } from '../hooks/useSort';
import StatusBadge from '../components/StatusBadge';
import CommentSection from '../components/CommentSection';
import PrintButton from '../components/PrintButton';
import { downloadCsv } from '../api/endpoints';
import Spinner from '../components/Spinner';

const fmt = (iso: string | null) => iso ? new Date(iso).toLocaleString() : '—';
const fmtRs = (v: number) => `₹${v.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

function SummaryCard({ label, value, sub, color = 'blue' }: { label: string; value: string | number; sub?: string; color?: string }) {
  const colors: Record<string, string> = {
    blue:   'bg-blue-50 text-blue-700 border-blue-200',
    green:  'bg-green-50 text-green-700 border-green-200',
    purple: 'bg-purple-50 text-purple-700 border-purple-200',
    orange: 'bg-orange-50 text-orange-700 border-orange-200',
    red:    'bg-red-50 text-red-700 border-red-200',
    gray:   'bg-gray-50 text-gray-700 border-gray-200',
  };
  return (
    <div className={`rounded-lg border p-4 ${colors[color] ?? colors.blue}`}>
      <p className="text-xl font-bold">{value}</p>
      <p className="text-sm font-medium">{label}</p>
      {sub && <p className="text-xs mt-0.5 opacity-75">{sub}</p>}
    </div>
  );
}

export default function ExportPage() {
  const { user } = useAuth();
  const isExecutive = user?.role === 'EXECUTIVE';
  const isAdmin     = user?.role === 'ADMIN';

  const [executives, setExecutives] = useState<Executive[]>([]);
  const [routes,     setRoutes]     = useState<AppRoute[]>([]);

  const [dateFrom,    setDateFrom]    = useState('');
  const [dateTo,      setDateTo]      = useState('');
  const [executiveId, setExecutiveId] = useState('');
  const [routeId,     setRouteId]     = useState('');
  const [status,      setStatus]      = useState('');

  const [data,    setData]    = useState<DashboardResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const [csvErr,  setCsvErr]  = useState('');

  useEffect(() => {
    if (isExecutive) {
      api.getRoutes().then(setRoutes).catch(() => {});
    } else {
      Promise.all([api.getExecutives(), api.getRoutes()])
        .then(([execs, rts]) => { setExecutives(execs); setRoutes(rts); })
        .catch(() => {});
    }
  }, [isExecutive]);

  const buildParams = () => {
    const p: Record<string, string> = {};
    if (dateFrom)    p.dateFrom    = dateFrom;
    if (dateTo)      p.dateTo      = dateTo;
    if (executiveId) p.executiveId = executiveId;
    if (routeId)     p.routeId     = routeId;
    if (status)      p.status      = status;
    return p;
  };

  const handleLoad = () => {
    setLoading(true); setError('');
    api.getDashboard(buildParams())
      .then(setData)
      .catch(() => setError('Failed to load dashboard data.'))
      .finally(() => setLoading(false));
  };

  const handleExport = () => {
    setCsvErr('');
    downloadCsv('/export/history.csv', buildParams(), 'history.csv')
      .catch(() => setCsvErr('CSV export failed — try again.'));
  };

  // Sorting for rows table
  const rowSort = useSort<CheckoutHistory>((r, col) => {
    switch (col) {
      case 'invoice':   return r.invoiceNumber;
      case 'amount':    return r.invoiceAmount ?? 0;
      case 'executive': return r.executive?.name ?? '';
      case 'route':     return r.route.routeNumber;
      case 'shop':      return r.shop?.name ?? '';
      case 'issued':    return r.outDatetime;
      case 'returned':  return r.inDatetime ?? '';
      case 'status':    return r.status;
      case 'paidAt':    return r.paymentReceivedAt ?? '';
      default:          return '';
    }
  });

  // Sorting for by-executive table
  const execSort = useSort<DashboardResult['byExecutive'][number]>((r, col) => {
    switch (col) {
      case 'name':      return r.name;
      case 'issued':    return r.issuedCount;
      case 'returned':  return r.returnedCount;
      case 'paid':      return r.paidCount;
      case 'outstanding': return r.outstandingCount;
      case 'value':     return r.invoiceValue;
      case 'collected': return r.collectedValue;
      default:          return '';
    }
  });

  // Sorting for by-route table
  const routeSort = useSort<DashboardResult['byRoute'][number]>((r, col) => {
    switch (col) {
      case 'route':       return r.routeNumber;
      case 'issued':      return r.issuedCount;
      case 'paid':        return r.paidCount;
      case 'outstanding': return r.outstandingCount;
      case 'value':       return r.invoiceValue;
      default:            return '';
    }
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Export & Dashboard</h1>
        {data && <PrintButton title="Invoice Dashboard" />}
      </div>

      {/* Filters */}
      <div className="card p-4 space-y-3 no-print">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div>
            <label className="label">From Date</label>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="input" />
          </div>
          <div>
            <label className="label">To Date</label>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="input" />
          </div>
          {!isExecutive && (
            <div>
              <label className="label">Executive</label>
              <select value={executiveId} onChange={e => setExecutiveId(e.target.value)} className="input">
                <option value="">All</option>
                {executives.map(ex => <option key={ex.id} value={ex.id}>{ex.name}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="label">Route</label>
            <select value={routeId} onChange={e => setRouteId(e.target.value)} className="input">
              <option value="">All</option>
              {routes.map(r => <option key={r.id} value={r.id}>{r.routeNumber}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Status</label>
            <select value={status} onChange={e => setStatus(e.target.value)} className="input">
              <option value="">All</option>
              <option value="OUTSTANDING">Outstanding</option>
              <option value="RETURNED">Returned</option>
              <option value="PAID">Paid</option>
              <option value="VOIDED">Voided</option>
            </select>
          </div>
        </div>
        <div className="flex items-center gap-3 pt-1">
          <button onClick={handleLoad} className="btn-primary" disabled={loading}>
            {loading ? 'Loading…' : 'Load Dashboard'}
          </button>
          <button onClick={handleExport} className="btn-ghost text-sm">Download CSV</button>
          <button onClick={() => { setDateFrom(''); setDateTo(''); setExecutiveId(''); setRouteId(''); setStatus(''); setData(null); }} className="btn-ghost text-sm">Reset</button>
        </div>
        {csvErr && <p className="text-sm text-red-600">{csvErr}</p>}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {loading && <Spinner text="Loading dashboard…" />}

      {data && !loading && (
        <div className="space-y-6">
          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 no-print">
            <SummaryCard label="Total Invoices" value={data.totals.checkoutCount} color="blue" />
            <SummaryCard label="Outstanding" value={data.totals.outstandingCount} color="orange" />
            <SummaryCard label="Returned" value={data.totals.returnedCount} color="gray" />
            <SummaryCard label="Paid" value={data.totals.paidCount} color="green" />
            {isAdmin && <SummaryCard label="Invoice Value" value={fmtRs(data.totals.invoiceValue)} color="purple" sub="sum of invoice amounts" />}
            {isAdmin && <SummaryCard label="Collected" value={fmtRs(data.totals.collectedValue)} color="green" sub="paid invoices" />}
          </div>

          {/* Per-executive breakdown */}
          {data.byExecutive.length > 0 && (
            <div className="card overflow-hidden">
              <div className="px-4 py-3 border-b bg-gray-50">
                <h2 className="font-semibold text-sm text-gray-700">By Executive</h2>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    {[
                      ['name','Executive'],['issued','Issued'],['returned','Returned'],
                      ['paid','Paid'],['outstanding','Outstanding'],
                      ...(isAdmin ? [['value','Invoice Value'],['collected','Collected']] : []),
                    ].map(([k,l])=>(
                      <th key={k} className="th cursor-pointer select-none whitespace-nowrap" onClick={()=>execSort.toggleSort(k)}>
                        {l}{execSort.sortArrow(k)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {execSort.sortRows(data.byExecutive).map(ex => (
                    <tr key={ex.executiveId} className="hover:bg-gray-50">
                      <td className="td font-medium">{ex.name}</td>
                      <td className="td">{ex.issuedCount}</td>
                      <td className="td">{ex.returnedCount}</td>
                      <td className="td">{ex.paidCount}</td>
                      <td className="td">{ex.outstandingCount}</td>
                      {isAdmin && <td className="td">{ex.invoiceValue ? fmtRs(ex.invoiceValue) : '—'}</td>}
                      {isAdmin && <td className="td">{ex.collectedValue ? fmtRs(ex.collectedValue) : '—'}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Per-route breakdown */}
          {data.byRoute.length > 0 && (
            <div className="card overflow-hidden">
              <div className="px-4 py-3 border-b bg-gray-50">
                <h2 className="font-semibold text-sm text-gray-700">By Route</h2>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    {[
                      ['route','Route'],['issued','Issued'],['paid','Paid'],
                      ['outstanding','Outstanding'],
                      ...(isAdmin ? [['value','Invoice Value']] : []),
                    ].map(([k,l])=>(
                      <th key={k} className="th cursor-pointer select-none whitespace-nowrap" onClick={()=>routeSort.toggleSort(k)}>
                        {l}{routeSort.sortArrow(k)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {routeSort.sortRows(data.byRoute).map(rt => (
                    <tr key={rt.routeId} className="hover:bg-gray-50">
                      <td className="td font-medium">{rt.routeNumber}</td>
                      <td className="td">{rt.issuedCount}</td>
                      <td className="td">{rt.paidCount}</td>
                      <td className="td">{rt.outstandingCount}</td>
                      {isAdmin && <td className="td">{rt.invoiceValue ? fmtRs(rt.invoiceValue) : '—'}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Full rows table */}
          {data.rows.length > 0 && (
            <div className="card overflow-hidden">
              <div className="px-4 py-3 border-b bg-gray-50 flex items-center justify-between">
                <h2 className="font-semibold text-sm text-gray-700">All Invoices ({data.rows.length})</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      {[
                        ['invoice','Invoice #'],
                        ...(isAdmin ? [['amount','Amount']] : []),
                        ['executive','Executive'],
                        ['route','Route'],['shop','Shop'],['issued','Issued At'],
                        ['returned','Returned At'],['status','Status'],['paidAt','Paid At'],
                      ].map(([k,l])=>(
                        <th key={k} className="th cursor-pointer select-none whitespace-nowrap" onClick={()=>rowSort.toggleSort(k)}>
                          {l}{rowSort.sortArrow(k)}
                        </th>
                      ))}
                      <th className="th no-print">Comments</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {rowSort.sortRows(data.rows).map(r => (
                      <tr key={r.id} className="hover:bg-gray-50">
                        <td className="td font-mono font-medium">{r.invoiceNumber}</td>
                        {isAdmin && <td className="td">{r.invoiceAmount != null ? fmtRs(r.invoiceAmount) : '—'}</td>}
                        <td className="td">{r.executive?.name ?? '—'}</td>
                        <td className="td">{r.route.routeNumber}</td>
                        <td className="td">{r.shop?.name ?? '—'}</td>
                        <td className="td whitespace-nowrap">{fmt(r.outDatetime)}</td>
                        <td className="td whitespace-nowrap">{fmt(r.inDatetime)}</td>
                        <td className="td"><StatusBadge status={r.status} /></td>
                        <td className="td whitespace-nowrap">{fmt(r.paymentReceivedAt)}</td>
                        <td className="td no-print"><CommentSection entityType="CHECKOUT" entityId={r.id} compact showPreview /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {data.rows.length === 0 && (
            <p className="text-center text-gray-400 py-8">No invoices match the selected filters.</p>
          )}
        </div>
      )}
    </div>
  );
}
