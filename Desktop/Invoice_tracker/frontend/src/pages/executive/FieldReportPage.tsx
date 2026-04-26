import { useState, useEffect, FormEvent } from 'react';
import * as api from '../../api/endpoints';
import { useAuth } from '../../context/AuthContext';
import type { AppRoute, Shop, FieldReport, FieldReportStatus, FieldReportRemark } from '../../types';
import Spinner from '../../components/Spinner';
import PrintButton from '../../components/PrintButton';
import { useSort } from '../../hooks/useSort';
import { STATUS_OPTIONS, REMARK_OPTIONS, STATUS_LABEL, REMARK_LABEL } from '../../constants/fieldReport';

const APPROVAL_BADGE: Record<string, string> = {
  PENDING:  'bg-yellow-100 text-yellow-800',
  APPROVED: 'bg-green-100  text-green-800',
  REJECTED: 'bg-red-100    text-red-800',
};

const fmt = (d: string) => new Date(d).toLocaleDateString();

function shopDisplay(r: FieldReport) {
  if (r.shop) return r.shop.name;
  if (r.newShopName) return `${r.newShopName} (new)`;
  return '—';
}

export default function FieldReportPage() {
  const frSort = useSort<FieldReport>((r, col) => {
    switch (col) {
      case 'date':     return r.visitDate;
      case 'route':    return r.route.routeNumber;
      case 'shop':     return shopDisplay(r);
      case 'status':   return r.status;
      case 'value':    return r.apprValue ? Number(r.apprValue) : 0;
      case 'remark':   return r.remark === 'CUSTOM' ? (r.customRemark ?? '') : REMARK_LABEL[r.remark];
      case 'approval': return r.approvalStatus;
      case 'note':     return r.reviewRemark ?? '';
      default:         return '';
    }
  });
  const { user } = useAuth();

  const [routes,   setRoutes]   = useState<AppRoute[]>([]);
  const [shops,    setShops]    = useState<Shop[]>([]);
  const [reports,  setReports]  = useState<FieldReport[]>([]);
  const [fetching, setFetching] = useState(true);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const [success,  setSuccess]  = useState('');

  // Form state
  const [routeId,      setRouteId]      = useState('');
  const [shopId,       setShopId]       = useState('');
  const [newShopName,  setNewShopName]  = useState('');
  const [isNewShop,    setIsNewShop]    = useState(false);
  const [status,       setStatus]       = useState<FieldReportStatus>('VISITED');
  const [apprValue,    setApprValue]    = useState('');
  const [remark,       setRemark]       = useState<FieldReportRemark>('WITH_STAND');
  const [customRemark, setCustomRemark] = useState('');
  const [orderTakenBy, setOrderTakenBy] = useState(user?.name ?? '');
  const [visitDate,    setVisitDate]    = useState(() => new Date().toISOString().slice(0, 10));

  useEffect(() => {
    Promise.all([api.getRoutes(), api.getFieldReports()])
      .then(([rts, reps]) => {
        setRoutes(rts.filter(r => r.isActive));
        setReports(reps);
      })
      .catch(() => setError('Failed to load data.'))
      .finally(() => setFetching(false));
  }, []);

  useEffect(() => {
    if (!routeId) { setShops([]); setShopId(''); return; }
    api.getShops({ routeId }).then(setShops).catch(() => {});
    setShopId('');
    setNewShopName('');
  }, [routeId]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(''); setSuccess('');

    if (!routeId) { setError('Select a route.'); return; }
    if (!shopId && !isNewShop) { setError('Select a shop.'); return; }
    if (isNewShop && !shopId && !newShopName.trim()) { setError('Enter a new shop name or select an existing shop.'); return; }
    if (remark === 'CUSTOM' && !customRemark.trim()) { setError('Enter a custom remark.'); return; }

    setLoading(true);
    try {
      const payload: Parameters<typeof api.createFieldReport>[0] = {
        routeId,
        status,
        remark,
        orderTakenBy,
        visitDate,
        isNewShop,
        ...(isNewShop && newShopName.trim() ? { newShopName: newShopName.trim() } : {}),
        ...(shopId ? { shopId } : {}),
        ...(apprValue ? { apprValue: parseFloat(apprValue) } : {}),
        ...(remark === 'CUSTOM' ? { customRemark } : {}),
      };
      const report = await api.createFieldReport(payload);
      setReports(prev => [report, ...prev]);
      setSuccess('Field report submitted successfully.');
      // Reset form
      setShopId(''); setNewShopName(''); setIsNewShop(false); setStatus('VISITED');
      setApprValue(''); setRemark('WITH_STAND'); setCustomRemark('');
      setOrderTakenBy(user?.name ?? '');
      setVisitDate(new Date().toISOString().slice(0, 10));
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg ?? 'Submission failed.');
    } finally {
      setLoading(false);
    }
  };

  if (fetching) return <Spinner text="Loading…" />;

  return (
    <div className="space-y-8 max-w-5xl">
      <h1 className="text-2xl font-bold">Field Report</h1>

      {/* Form */}
      <form onSubmit={handleSubmit} className="card p-6 space-y-5">
        <h2 className="font-semibold text-gray-700">New Visit Entry</h2>

        {error   && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</p>}
        {success && <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded px-3 py-2">{success}</p>}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Route */}
          <div>
            <label className="label">Route No.</label>
            <select value={routeId} onChange={e => setRouteId(e.target.value)} className="input" required>
              <option value="">Select route…</option>
              {routes.map(r => (
                <option key={r.id} value={r.id}>
                  {r.routeNumber}{r.description ? ` — ${r.description}` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Status */}
          <div>
            <label className="label">Status</label>
            <select value={status} onChange={e => setStatus(e.target.value as FieldReportStatus)} className="input">
              {STATUS_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          {/* Shop */}
          <div className="space-y-2">
            <label className="label">Shop Name</label>
            <select
              value={shopId}
              onChange={e => { setShopId(e.target.value); if (e.target.value) setNewShopName(''); }}
              className="input"
              required={!isNewShop}
              disabled={!routeId}
            >
              <option value="">{routeId ? (isNewShop ? '— Or select existing shop —' : 'Select shop…') : 'Select route first'}</option>
              {shops.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            {isNewShop && !shopId && (
              <input
                type="text"
                value={newShopName}
                onChange={e => setNewShopName(e.target.value)}
                placeholder="New shop name…"
                className="input"
              />
            )}
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={isNewShop}
                onChange={e => { setIsNewShop(e.target.checked); if (!e.target.checked) setNewShopName(''); }}
              />
              This is a new shop
            </label>
          </div>

          {/* Appr. Value */}
          <div>
            <label className="label">Approx. Value (₹)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={apprValue}
              onChange={e => setApprValue(e.target.value)}
              placeholder="Optional"
              className="input"
            />
          </div>

          {/* Remarks */}
          <div>
            <label className="label">Remarks</label>
            <select value={remark} onChange={e => setRemark(e.target.value as FieldReportRemark)} className="input">
              {REMARK_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          {remark === 'CUSTOM' && (
            <div>
              <label className="label">Custom Remark</label>
              <input
                type="text"
                value={customRemark}
                onChange={e => setCustomRemark(e.target.value)}
                placeholder="Enter message…"
                className="input"
                required
              />
            </div>
          )}

          {/* Order Taken By */}
          <div>
            <label className="label">Order Taken By</label>
            <input
              type="text"
              value={orderTakenBy}
              onChange={e => setOrderTakenBy(e.target.value)}
              className="input"
              required
            />
          </div>

          {/* Date */}
          <div>
            <label className="label">Visit Date</label>
            <input
              type="date"
              value={visitDate}
              onChange={e => setVisitDate(e.target.value)}
              className="input"
              required
            />
          </div>
        </div>

        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? 'Submitting…' : 'Submit Field Report'}
        </button>
      </form>

      {/* My submissions */}
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b bg-gray-50 flex items-center justify-between">
          <h2 className="font-semibold text-sm text-gray-700">My Submissions ({reports.length})</h2>
          <PrintButton title="My Field Reports" />
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              {[
                ['date', 'Date'], ['route', 'Route'], ['shop', 'Shop'],
                ['status', 'Status'], ['value', 'Appr. Value'], ['remark', 'Remarks'],
                ['approval', 'Approval'], ['note', 'Review Note'],
              ].map(([key, label]) => (
                <th key={key} className="th cursor-pointer select-none whitespace-nowrap" onClick={() => frSort.toggleSort(key)}>
                  {label}{frSort.sortArrow(key)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {reports.length === 0 && (
              <tr>
                <td colSpan={8} className="td text-center text-gray-400 py-8">No field reports yet.</td>
              </tr>
            )}
            {frSort.sortRows(reports).map(r => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className="td whitespace-nowrap">{fmt(r.visitDate)}</td>
                <td className="td">{r.route.routeNumber}</td>
                <td className="td">{shopDisplay(r)}</td>
                <td className="td">
                  {STATUS_LABEL[r.status] ?? r.status}
                  {r.isNewShop && <span className="ml-1.5 text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">New</span>}
                </td>
                <td className="td">{r.apprValue ? `₹${Number(r.apprValue).toLocaleString()}` : '—'}</td>
                <td className="td">
                  {r.remark === 'CUSTOM' ? r.customRemark : REMARK_LABEL[r.remark]}
                </td>
                <td className="td">
                  <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${APPROVAL_BADGE[r.approvalStatus]}`}>
                    {r.approvalStatus}
                  </span>
                </td>
                <td className="td text-gray-500">{r.reviewRemark ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
