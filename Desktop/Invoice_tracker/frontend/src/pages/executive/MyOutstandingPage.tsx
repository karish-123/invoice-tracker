import { useState, useEffect } from 'react';
import * as api from '../../api/endpoints';
import type { MeOutstanding, MeHistoryItem } from '../../types';
import StatusBadge from '../../components/StatusBadge';
import Spinner    from '../../components/Spinner';

const fmt = (iso: string | null) => iso ? new Date(iso).toLocaleString() : '—';
const daysOut = (iso: string) => Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);

function useSort<T>(getValue: (row: T, col: string) => string | number) {
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const toggleSort = (col: string) => {
    if (sortCol === col) {
      if (sortDir === 'asc') setSortDir('desc');
      else { setSortCol(null); setSortDir('asc'); }
    } else { setSortCol(col); setSortDir('asc'); }
  };
  const sortArrow = (col: string) => sortCol === col ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ' ↕';
  const sortRows = (rows: T[]): T[] => {
    if (!sortCol) return rows;
    return [...rows].sort((a, b) => {
      const va = getValue(a, sortCol);
      const vb = getValue(b, sortCol);
      const cmp = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb));
      return sortDir === 'asc' ? cmp : -cmp;
    });
  };
  return { toggleSort, sortArrow, sortRows };
}

export default function MyOutstandingPage() {
  const [outstanding, setOutstanding] = useState<MeOutstanding[]>([]);
  const [history,     setHistory]     = useState<MeHistoryItem[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState('');
  const [showHistory, setShowHistory] = useState(false);

  const outSort = useSort<MeOutstanding>((row, col) => {
    switch (col) {
      case 'invoiceNumber': return row.invoiceNumber;
      case 'route':         return row.route.routeNumber;
      case 'issuedAt':      return row.outDatetime;
      case 'daysOut':       return daysOut(row.outDatetime);
      case 'issuedBy':      return row.outByUser.name;
      case 'status':        return row.status;
      default:              return '';
    }
  });

  const histSort = useSort<MeHistoryItem>((row, col) => {
    switch (col) {
      case 'invoiceNumber': return row.invoiceNumber;
      case 'route':         return row.route.routeNumber;
      case 'issuedAt':      return row.outDatetime;
      case 'returnedAt':    return row.inDatetime ?? '';
      case 'status':        return row.status;
      default:              return '';
    }
  });

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

  if (loading) return <Spinner text="Loading..." />;

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
              {[
                ['invoiceNumber', 'Invoice #'],
                ['route', 'Route'],
                ['issuedAt', 'Issued At'],
                ['daysOut', 'Days Out'],
                ['issuedBy', 'Issued By'],
                ['status', 'Status'],
              ].map(([key, label]) => (
                <th key={key} className="th cursor-pointer select-none whitespace-nowrap" onClick={() => outSort.toggleSort(key)}>
                  {label}{outSort.sortArrow(key)}
                </th>
              ))}
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
            {outSort.sortRows(outstanding).map(row => (
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
                {[
                  ['invoiceNumber', 'Invoice #'],
                  ['route', 'Route'],
                  ['issuedAt', 'Issued At'],
                  ['returnedAt', 'Returned At'],
                  ['status', 'Status'],
                ].map(([key, label]) => (
                  <th key={key} className="th cursor-pointer select-none whitespace-nowrap" onClick={() => histSort.toggleSort(key)}>
                    {label}{histSort.sortArrow(key)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {histSort.sortRows(history).map(row => (
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
