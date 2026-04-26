import { useState, useEffect, FormEvent } from 'react';
import * as api from '../api/endpoints';
import type { AppRoute, Shop, IssueResult } from '../types';
import InvoiceWithRemarksInput, { InvoiceEntry } from '../components/InvoiceWithRemarksInput';
import BatchResultTable  from '../components/BatchResultTable';
import Spinner           from '../components/Spinner';
import { useAuth }       from '../context/AuthContext';

export default function MasterInvoicePage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  const [routes,      setRoutes]      = useState<AppRoute[]>([]);
  const [shops,       setShops]       = useState<Shop[]>([]);
  const [routeId,     setRouteId]     = useState('');
  const [shopId,      setShopId]      = useState('');
  const [outDatetime, setOutDatetime] = useState('');
  const [entries,     setEntries]     = useState<InvoiceEntry[]>([]);
  const [results,     setResults]     = useState<IssueResult[] | null>(null);
  const [error,       setError]       = useState('');
  const [loading,     setLoading]     = useState(false);
  const [fetching,    setFetching]    = useState(true);

  useEffect(() => {
    api.getRoutes()
      .then(rts => setRoutes(rts.filter(r => r.isActive)))
      .catch(() => setError('Failed to load routes.'))
      .finally(() => setFetching(false));
  }, []);

  useEffect(() => {
    if (!routeId) { setShops([]); setShopId(''); return; }
    api.getShops({ routeId }).then(setShops).catch(() => {});
    setShopId('');
  }, [routeId]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!entries.length) { setError('Add at least one invoice number.'); return; }

    setLoading(true);
    try {
      const payload: Parameters<typeof api.addMasterInvoices>[0] = {
        routeId,
        invoices: entries.map(e => ({
          invoiceNumber: e.invoiceNumber,
          ...(e.remarks ? { remarks: e.remarks } : {}),
          ...(e.invoiceAmount ? { invoiceAmount: parseFloat(e.invoiceAmount) } : {}),
        })),
        ...(shopId      ? { shopId }      : {}),
        ...(isAdmin && outDatetime ? { outDatetime: new Date(outDatetime).toISOString() } : {}),
      };
      const { results: res } = await api.addMasterInvoices(payload);
      setResults(res);
      setEntries([]);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg ?? 'Request failed.');
    } finally {
      setLoading(false);
    }
  };

  if (fetching) return <Spinner text="Loading…" />;

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-2xl font-bold">Master Invoices</h1>

      <form onSubmit={handleSubmit} className="card p-6 space-y-5">
        {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</p>}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Route</label>
            <select value={routeId} onChange={e => setRouteId(e.target.value)} className="input" required>
              <option value="">Select route…</option>
              {routes.map(r => (
                <option key={r.id} value={r.id}>
                  {r.routeNumber}{r.description ? ` — ${r.description}` : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">Shop <span className="text-gray-400 font-normal">(optional)</span></label>
            <select value={shopId} onChange={e => setShopId(e.target.value)} className="input" disabled={!routeId}>
              <option value="">{routeId ? 'Select shop…' : 'Select route first'}</option>
              {shops.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          {isAdmin && (
            <div>
              <label className="label">Date/Time <span className="text-gray-400 font-normal">(optional — defaults to now)</span></label>
              <input
                type="datetime-local"
                value={outDatetime}
                onChange={e => setOutDatetime(e.target.value)}
                className="input"
              />
            </div>
          )}
        </div>

        <InvoiceWithRemarksInput entries={entries} onChange={setEntries} label="Invoice Numbers" />

        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? 'Submitting…' : 'Submit'}
        </button>
      </form>

      {results && <BatchResultTable results={results} />}
    </div>
  );
}
