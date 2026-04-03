import { useState, useEffect, FormEvent } from 'react';
import * as api from '../api/endpoints';
import type { InvoiceHistory, CheckoutHistory, Executive, AppRoute, CheckoutStatus } from '../types';
import StatusBadge from '../components/StatusBadge';
import Spinner     from '../components/Spinner';
import { useAuth } from '../context/AuthContext';
import { buildExportUrl } from '../api/endpoints';

const fmt = (iso: string | null) => iso ? new Date(iso).toLocaleString() : '—';

function HistoryRow({
  c, isAdmin, routes, executives, onUpdated,
}: {
  c: CheckoutHistory;
  isAdmin: boolean;
  routes: AppRoute[];
  executives: Executive[];
  onUpdated: (updated: CheckoutHistory) => void;
}) {
  const [editing,  setEditing]  = useState(false);
  const [routeId,  setRouteId]  = useState(c.route.id);
  const [execId,   setExecId]   = useState(c.executive?.id ?? '');
  const [invNum,   setInvNum]   = useState(c.invoiceNumber);
  const [outDt,    setOutDt]    = useState(c.outDatetime ? new Date(c.outDatetime).toISOString().slice(0, 16) : '');
  const [saving,   setSaving]   = useState(false);
  const [saveErr,  setSaveErr]  = useState('');

  const handleSave = async () => {
    setSaving(true);
    setSaveErr('');
    try {
      const payload: { routeId?: string; executiveId?: string | null; invoiceNumber?: string; outDatetime?: string } = {};
      if (routeId !== c.route.id) payload.routeId = routeId;
      if (execId  !== (c.executive?.id ?? '')) payload.executiveId = execId || null;
      if (invNum  !== c.invoiceNumber) payload.invoiceNumber = invNum;
      const origDt = new Date(c.outDatetime).toISOString().slice(0, 16);
      if (outDt !== origDt) payload.outDatetime = new Date(outDt).toISOString();
      if (Object.keys(payload).length === 0) { setEditing(false); setSaving(false); return; }
      const updated = await api.updateCheckout(c.id, payload);
      onUpdated(updated);
      setEditing(false);
    } catch {
      setSaveErr('Save failed.');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setRouteId(c.route.id);
    setExecId(c.executive?.id ?? '');
    setInvNum(c.invoiceNumber);
    setOutDt(c.outDatetime ? new Date(c.outDatetime).toISOString().slice(0, 16) : '');
    setSaveErr('');
    setEditing(false);
  };

  if (editing) {
    return (
      <tr className="bg-blue-50">
        <td className="td">
          <input
            type="text"
            value={invNum}
            onChange={e => setInvNum(e.target.value)}
            className="input text-xs py-0.5 font-mono w-28"
          />
        </td>
        <td className="td">
          <input
            type="datetime-local"
            value={outDt}
            onChange={e => setOutDt(e.target.value)}
            className="input text-xs py-0.5"
          />
        </td>
        <td className="td">
          <select
            value={execId}
            onChange={e => setExecId(e.target.value)}
            className="input text-xs py-0.5"
          >
            <option value="">— none —</option>
            {executives.map(ex => <option key={ex.id} value={ex.id}>{ex.name}</option>)}
          </select>
        </td>
        <td className="td">
          <select
            value={routeId}
            onChange={e => setRouteId(e.target.value)}
            className="input text-xs py-0.5"
          >
            {routes.map(r => <option key={r.id} value={r.id}>{r.routeNumber}</option>)}
          </select>
        </td>
        <td className="td">{c.outByUser.name}</td>
        <td className="td whitespace-nowrap">{fmt(c.inDatetime)}</td>
        <td className="td">{c.inByUser?.name ?? '—'}</td>
        <td className="td"><StatusBadge status={c.status} /></td>
        <td className="td text-xs" colSpan={2}>
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={handleSave} disabled={saving} className="btn-primary text-xs py-0.5 px-2">
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button onClick={handleCancel} disabled={saving} className="btn-ghost text-xs py-0.5 px-2">
              Cancel
            </button>
            {saveErr && <span className="text-red-600 text-xs">{saveErr}</span>}
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr className="hover:bg-gray-50">
      <td className="td font-mono text-xs">{c.invoiceNumber}</td>
      <td className="td whitespace-nowrap">{fmt(c.outDatetime)}</td>
      <td className="td">{c.executive?.name ?? '—'}</td>
      <td className="td">{c.route.routeNumber}</td>
      <td className="td">{c.outByUser.name}</td>
      <td className="td whitespace-nowrap">{fmt(c.inDatetime)}</td>
      <td className="td">{c.inByUser?.name ?? '—'}</td>
      <td className="td"><StatusBadge status={c.status} /></td>
      <td className="td text-xs text-gray-500 max-w-xs truncate" title={c.voidReason ?? ''}>
        {c.voidReason ?? '—'}
      </td>
      {isAdmin && (
        <td className="td">
          <button
            onClick={() => setEditing(true)}
            className="text-xs text-blue-600 hover:underline"
          >
            Edit
          </button>
        </td>
      )}
    </tr>
  );
}

export default function InvoiceHistoryPage() {
  const { user } = useAuth();
  const isExecutive = user?.role === 'EXECUTIVE';
  const isAdmin     = user?.role === 'ADMIN';

  const [query,      setQuery]      = useState('');
  const [singleData, setSingleData] = useState<InvoiceHistory | null>(null);
  const [searchRows, setSearchRows] = useState<CheckoutHistory[] | null>(null);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState('');

  // Filters
  const [showFilters,     setShowFilters]     = useState(false);
  const [filterExecutive, setFilterExecutive] = useState('');
  const [filterRoute,     setFilterRoute]     = useState('');
  const [filterDateFrom,  setFilterDateFrom]  = useState('');
  const [filterDateTo,    setFilterDateTo]    = useState('');
  const [filterStatus,    setFilterStatus]    = useState<CheckoutStatus | ''>('');
  const [executives,      setExecutives]      = useState<Executive[]>([]);
  const [routes,          setRoutes]          = useState<AppRoute[]>([]);

  useEffect(() => {
    if (isExecutive) {
      api.getRoutes().then(setRoutes).catch(() => {});
    } else {
      Promise.all([api.getExecutives(), api.getRoutes()])
        .then(([execs, rts]) => { setExecutives(execs); setRoutes(rts); })
        .catch(() => {});
    }
  }, [isExecutive]);

  const hasFilters = !!(filterExecutive || filterRoute || filterDateFrom || filterDateTo || filterStatus);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSingleData(null);
    setSearchRows(null);

    // Use search endpoint when filters are active OR no invoice number entered
    if (hasFilters || !query.trim()) {
      setLoading(true);
      try {
        const params: Parameters<typeof api.searchInvoices>[0] = {};
        if (query.trim())      params.invoiceNumber = query.trim();
        if (filterExecutive)   params.executiveId   = filterExecutive;
        if (filterRoute)       params.routeId       = filterRoute;
        if (filterDateFrom)    params.dateFrom      = filterDateFrom;
        if (filterDateTo)      params.dateTo        = filterDateTo;
        if (filterStatus)      params.status        = filterStatus;
        const rows = await api.searchInvoices(params);
        setSearchRows(rows);
      } catch {
        setError('Search failed.');
      } finally {
        setLoading(false);
      }
    } else {
      // Single invoice lookup (preserves checkout count display)
      setLoading(true);
      try {
        const result = await api.getInvoiceHistory(query.trim());
        setSingleData(result);
      } catch (err: unknown) {
        const status = (err as { response?: { status?: number } })?.response?.status;
        if (status === 404) setError(`Invoice "${query.trim()}" not found.`);
        else setError('Failed to load history.');
      } finally {
        setLoading(false);
      }
    }
  };

  const buildExportParams = () => {
    const params: Record<string, string> = {};
    if (query.trim())      params.invoiceNumber = query.trim();
    if (filterExecutive)   params.executiveId   = filterExecutive;
    if (filterRoute)       params.routeId       = filterRoute;
    if (filterDateFrom)    params.dateFrom      = filterDateFrom;
    if (filterDateTo)      params.dateTo        = filterDateTo;
    if (filterStatus)      params.status        = filterStatus;
    return params;
  };

  const [routeSort, setRouteSort] = useState<'asc' | 'desc' | null>(null);

  const allRows: CheckoutHistory[] = singleData ? singleData.history : (searchRows ?? []);
  const hasResults = singleData !== null || searchRows !== null;

  const handleRowUpdated = (updated: CheckoutHistory) => {
    if (singleData) {
      setSingleData({
        ...singleData,
        history: singleData.history.map(r => r.id === updated.id ? updated : r),
      });
    } else if (searchRows) {
      setSearchRows(searchRows.map(r => r.id === updated.id ? updated : r));
    }
  };

  const displayRows = routeSort
    ? [...allRows].sort((a, b) => {
        const cmp = a.route.routeNumber.localeCompare(b.route.routeNumber);
        return routeSort === 'asc' ? cmp : -cmp;
      })
    : allRows;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Invoice Search</h1>

      <form onSubmit={handleSubmit} className="card p-4 space-y-4">
        {error && <p className="text-sm text-red-600">{error}</p>}

        {/* Primary search */}
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <label className="label">Invoice Number</label>
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="e.g. INV-0042"
              className="input"
            />
          </div>
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? 'Searching…' : 'Search'}
          </button>
          <button
            type="button"
            onClick={() => setShowFilters(v => !v)}
            className="btn-ghost text-sm"
          >
            {showFilters ? 'Hide Filters' : 'Filters'}
          </button>
        </div>

        {/* Filter panel */}
        {showFilters && (
          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-gray-100">
            {!isExecutive && (
              <div>
                <label className="label">Executive</label>
                <select value={filterExecutive} onChange={e => setFilterExecutive(e.target.value)} className="input">
                  <option value="">All</option>
                  {executives.map(ex => <option key={ex.id} value={ex.id}>{ex.name}</option>)}
                </select>
              </div>
            )}
            <div>
              <label className="label">Route</label>
              <select value={filterRoute} onChange={e => setFilterRoute(e.target.value)} className="input">
                <option value="">All</option>
                {routes.map(r => <option key={r.id} value={r.id}>{r.routeNumber}</option>)}
              </select>
            </div>
            <div>
              <label className="label">From Date</label>
              <input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} className="input" />
            </div>
            <div>
              <label className="label">To Date</label>
              <input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} className="input" />
            </div>
            <div>
              <label className="label">Status</label>
              <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as CheckoutStatus | '')} className="input">
                <option value="">All</option>
                <option value="OUTSTANDING">Outstanding</option>
                <option value="RETURNED">Returned</option>
                <option value="VOIDED">Voided</option>
                <option value="PAID">Paid</option>
              </select>
            </div>
            <div className="flex items-end">
              <button
                type="button"
                onClick={() => { setFilterExecutive(''); setFilterRoute(''); setFilterDateFrom(''); setFilterDateTo(''); setFilterStatus(''); }}
                className="btn-ghost text-xs"
              >
                Reset Filters
              </button>
            </div>
          </div>
        )}
      </form>

      {loading && <Spinner text="Searching…" />}

      {hasResults && !loading && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {singleData && (
                <h2 className="text-lg font-semibold font-mono">{singleData.invoiceNumber}</h2>
              )}
              <span className="text-sm text-gray-500">
                {allRows.length} record{allRows.length !== 1 ? 's' : ''}
                {singleData && ` (${singleData.totalCheckouts} checkout${singleData.totalCheckouts !== 1 ? 's' : ''})`}
              </span>
            </div>
            <button
              onClick={() => { window.location.href = buildExportUrl('/export/history.csv', buildExportParams()); }}
              className="btn-ghost text-sm"
            >
              Export CSV
            </button>
          </div>

          {allRows.length === 0 ? (
            <p className="text-sm text-gray-400">No records found.</p>
          ) : (
            <div className="card overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="th">Invoice #</th>
                    <th className="th">Issued At</th>
                    <th className="th">Executive</th>
                    <th
                      className="th cursor-pointer select-none whitespace-nowrap"
                      onClick={() => setRouteSort(s => s === 'asc' ? 'desc' : 'asc')}
                    >
                      Route {routeSort === 'asc' ? '↑' : routeSort === 'desc' ? '↓' : '↕'}
                    </th>
                    <th className="th">Issued By</th>
                    <th className="th">Returned At</th>
                    <th className="th">Returned By</th>
                    <th className="th">Status</th>
                    <th className="th">Void Reason</th>
                    {isAdmin && <th className="th" />}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {displayRows.map(c => (
                    <HistoryRow
                      key={c.id}
                      c={c}
                      isAdmin={isAdmin}
                      routes={routes}
                      executives={executives}
                      onUpdated={handleRowUpdated}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
