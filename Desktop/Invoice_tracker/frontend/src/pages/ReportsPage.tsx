import { useState, useEffect } from 'react';
import * as api from '../api/endpoints';
import type { Checkout, DailyActivity, PerExecutiveSummary, Executive, FieldReport } from '../types';
import Spinner from '../components/Spinner';
import PrintButton from '../components/PrintButton';
import { useSort } from '../hooks/useSort';
import { useAuth } from '../context/AuthContext';
import { STATUS_LABEL } from '../constants/fieldReport';

const fmt = (iso: string | null) => iso ? new Date(iso).toLocaleString() : '—';
const today = () => new Date().toISOString().slice(0, 10);
const fmtRs = (v: number) =>
  `₹${v.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

export default function ReportsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Reports</h1>
      <ActivityDashboard />
    </div>
  );
}

// ── Activity Dashboard ────────────────────────────────────────────────────────

function ActivityDashboard() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  const [dateFrom,    setDateFrom]    = useState(today());
  const [dateTo,      setDateTo]      = useState(today());
  const [executives,  setExecutives]  = useState<Executive[]>([]);
  const [executiveId, setExecutiveId] = useState('');
  const [data,        setData]        = useState<DailyActivity | null>(null);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState('');

  useEffect(() => {
    api.getExecutives().then(setExecutives).catch(() => {});
  }, []);

  const execSort = useSort<PerExecutiveSummary>((r, col) => {
    switch (col) {
      case 'name':      return r.name;
      case 'issued':    return r.issuedCount;
      case 'returned':  return r.returnedCount;
      case 'paid':      return r.paidCount;
      case 'reports':   return r.fieldReportCount;
      case 'collected': return r.collectedValue;
      default:          return '';
    }
  });

  const load = () => {
    if (!dateFrom || !dateTo) return;
    setLoading(true); setError('');
    api.getDailyActivity({ dateFrom, dateTo, executiveId: executiveId || undefined })
      .then(setData)
      .catch(() => setError('Failed to load data.'))
      .finally(() => setLoading(false));
  };

  const rangeLabel = dateFrom === dateTo
    ? new Date(dateFrom).toLocaleDateString()
    : `${new Date(dateFrom).toLocaleDateString()} – ${new Date(dateTo).toLocaleDateString()}`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-4 no-print">
        <div>
          <label className="label">From Date</label>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="input" />
        </div>
        <div>
          <label className="label">To Date</label>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="input" />
        </div>
        <div>
          <label className="label">Executive</label>
          <select value={executiveId} onChange={e => setExecutiveId(e.target.value)} className="input">
            <option value="">All Executives</option>
            {executives.map(ex => <option key={ex.id} value={ex.id}>{ex.name}</option>)}
          </select>
        </div>
        <button onClick={load} className="btn-primary">Load</button>
        {data && <PrintButton title={`Activity Report — ${rangeLabel}`} />}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {loading ? <Spinner text="Loading…" /> : data && (
        <div className="space-y-6">
          {/* Summary cards — hidden on print */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 no-print">
            <SummaryCard label="Issued"        count={data.issued.length}       color="blue" />
            <SummaryCard label="Returned"      count={data.returned.length}     color="green" />
            <SummaryCard label="Payments"      count={data.payments.length}     color="purple" />
            <SummaryCard label="Field Reports" count={data.fieldReports.length} color="orange" />
            {isAdmin && (
              <div className="rounded-lg border p-4 bg-green-50 text-green-700 border-green-200">
                <p className="text-xl font-bold">{fmtRs(data.totalCollected)}</p>
                <p className="text-sm font-medium">Total Collected</p>
              </div>
            )}
          </div>

          {/* Per-executive breakdown — prints */}
          {data.perExecutive.length > 0 && (
            <div className="card overflow-hidden">
              <div className="px-4 py-3 border-b bg-gray-50">
                <h3 className="font-semibold text-sm text-gray-700">Per Executive Performance</h3>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    {[
                      ['name','Executive'],['issued','Issued'],['returned','Returned'],
                      ['paid','Paid'],['reports','Field Reports'],
                      ...(isAdmin ? [['collected','Collected']] : []),
                    ].map(([k,l])=>(
                      <th key={k} className="th cursor-pointer select-none whitespace-nowrap" onClick={()=>execSort.toggleSort(k)}>
                        {l}{execSort.sortArrow(k)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {execSort.sortRows(data.perExecutive).map(ex => (
                    <tr key={ex.executiveId} className="hover:bg-gray-50">
                      <td className="td font-medium">{ex.name}</td>
                      <td className="td">{ex.issuedCount}</td>
                      <td className="td">{ex.returnedCount}</td>
                      <td className="td">{ex.paidCount}</td>
                      <td className="td">{ex.fieldReportCount}</td>
                      {isAdmin && <td className="td">{ex.collectedValue ? fmtRs(ex.collectedValue) : '—'}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Field Reports summary + table — prints */}
          <div className="card overflow-hidden">
            <div className="px-4 py-3 border-b bg-gray-50">
              <h3 className="font-semibold text-sm text-gray-700">Field Reports ({data.fieldReports.length})</h3>
            </div>

            {/* Field report metrics */}
            <FieldReportSummary fieldReports={data.fieldReports} />

            {/* Detail table */}
            {data.fieldReports.length > 0 && (
              <table className="w-full text-sm border-t">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="th">Executive</th><th className="th">Route</th>
                    <th className="th">Shop</th><th className="th">Status</th>
                    <th className="th">Approx Value</th>
                    <th className="th">Approval</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {data.fieldReports.map(fr => (
                    <tr key={fr.id} className="hover:bg-gray-50">
                      <td className="td">{fr.executive.name}</td>
                      <td className="td">{fr.route.routeNumber}</td>
                      <td className="td">{fr.shop?.name ?? fr.newShopName ?? '—'}</td>
                      <td className="td">
                        {STATUS_LABEL[fr.status] ?? fr.status.replace(/_/g, ' ')}
                        {fr.isNewShop && <span className="ml-1.5 text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">New</span>}
                      </td>
                      <td className="td">{fr.apprValue ? fmtRs(parseFloat(fr.apprValue)) : '—'}</td>
                      <td className="td">{fr.approvalStatus}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {data.fieldReports.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-6">No field reports in this range.</p>
            )}
          </div>

          {/* Issued / Returned / Payments — hidden on print */}
          <div className="no-print space-y-6">
            {data.issued.length > 0 && (
              <ActivityTable title="Issued" rows={data.issued} columns={['invoiceNumber','executive','route','outDatetime','invoiceAmount']} />
            )}
            {data.returned.length > 0 && (
              <ActivityTable title="Returned" rows={data.returned} columns={['invoiceNumber','executive','route','inDatetime','invoiceAmount']} />
            )}
            {data.payments.length > 0 && (
              <ActivityTable title="Payments Received" rows={data.payments} columns={['invoiceNumber','executive','route','paymentReceivedAt','invoiceAmount']} />
            )}
          </div>

          {data.issued.length === 0 && data.returned.length === 0 && data.payments.length === 0 && data.fieldReports.length === 0 && (
            <p className="text-gray-400 text-center py-8">No activity in the selected range.</p>
          )}
        </div>
      )}
    </div>
  );
}

function SummaryCard({ label, count, color }: { label: string; count: number; color: string }) {
  const colors: Record<string, string> = {
    blue:   'bg-blue-50 text-blue-700 border-blue-200',
    green:  'bg-green-50 text-green-700 border-green-200',
    purple: 'bg-purple-50 text-purple-700 border-purple-200',
    orange: 'bg-orange-50 text-orange-700 border-orange-200',
  };
  return (
    <div className={`rounded-lg border p-4 ${colors[color]}`}>
      <p className="text-2xl font-bold">{count}</p>
      <p className="text-sm">{label}</p>
    </div>
  );
}

function FieldReportSummary({ fieldReports }: { fieldReports: FieldReport[] }) {
  const shopsVisited  = fieldReports.length;
  const ordersCount   = fieldReports.filter(fr => fr.status === 'ORDER_DONE' || fr.status === 'ORDER_PAYMENT_DONE').length;
  const paymentsCount = fieldReports.filter(fr => fr.status === 'PAYMENT_DONE' || fr.status === 'ORDER_PAYMENT_DONE').length;
  const newShops      = fieldReports.filter(fr => fr.isNewShop).length;
  const approxValue   = fieldReports.reduce((sum, fr) => sum + (fr.apprValue ? parseFloat(fr.apprValue) : 0), 0);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 p-4 border-b bg-white no-print">
      <MetricBox label="Shops Visited"   value={shopsVisited}  color="orange" />
      <MetricBox label="Orders"          value={ordersCount}   color="blue" />
      <MetricBox label="Payments"        value={paymentsCount} color="green" />
      <MetricBox label="New Shops"       value={newShops}      color="purple" />
      <MetricBox label="Approx Order Value" value={approxValue > 0 ? fmtRs(approxValue) : '—'} color="teal" />
    </div>
  );
}

function MetricBox({ label, value, color }: { label: string; value: string | number; color: string }) {
  const colors: Record<string, string> = {
    orange: 'bg-orange-50 text-orange-700 border-orange-200',
    blue:   'bg-blue-50 text-blue-700 border-blue-200',
    green:  'bg-green-50 text-green-700 border-green-200',
    purple: 'bg-purple-50 text-purple-700 border-purple-200',
    teal:   'bg-teal-50 text-teal-700 border-teal-200',
  };
  return (
    <div className={`rounded-lg border p-3 ${colors[color]}`}>
      <p className="text-xl font-bold">{value}</p>
      <p className="text-xs font-medium mt-0.5">{label}</p>
    </div>
  );
}

function ActivityTable({ title, rows, columns }: { title: string; rows: Checkout[]; columns: string[] }) {
  const colLabel: Record<string, string> = {
    invoiceNumber: 'Invoice #', executive: 'Executive', route: 'Route',
    outDatetime: 'Issued At', inDatetime: 'Returned At', paymentReceivedAt: 'Paid At',
    invoiceAmount: 'Amount',
  };

  const sort = useSort<Checkout>((r, col) => {
    switch (col) {
      case 'invoiceNumber':     return r.invoiceNumber;
      case 'executive':         return r.executive?.name ?? '';
      case 'route':             return r.route.routeNumber;
      case 'outDatetime':       return r.outDatetime;
      case 'inDatetime':        return r.inDatetime ?? '';
      case 'paymentReceivedAt': return r.paymentReceivedAt ?? '';
      case 'invoiceAmount':     return r.invoiceAmount ?? 0;
      default:                  return '';
    }
  });

  const cellValue = (row: Checkout, col: string) => {
    switch (col) {
      case 'invoiceNumber':     return row.invoiceNumber;
      case 'executive':         return row.executive?.name ?? '—';
      case 'route':             return row.route.routeNumber;
      case 'outDatetime':       return fmt(row.outDatetime);
      case 'inDatetime':        return fmt(row.inDatetime);
      case 'paymentReceivedAt': return fmt(row.paymentReceivedAt);
      case 'invoiceAmount':     return row.invoiceAmount != null ? fmtRs(row.invoiceAmount) : '—';
      default:                  return '';
    }
  };

  return (
    <div className="card overflow-hidden">
      <div className="px-4 py-3 border-b bg-gray-50">
        <h3 className="font-semibold text-sm text-gray-700">{title} ({rows.length})</h3>
      </div>
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b">
          <tr>
            {columns.map(c => (
              <th key={c} className="th cursor-pointer select-none whitespace-nowrap" onClick={() => sort.toggleSort(c)}>
                {colLabel[c] ?? c}{sort.sortArrow(c)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">
          {sort.sortRows(rows).map(r => (
            <tr key={r.id} className="hover:bg-gray-50">
              {columns.map(c => <td key={c} className="td">{cellValue(r, c)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
