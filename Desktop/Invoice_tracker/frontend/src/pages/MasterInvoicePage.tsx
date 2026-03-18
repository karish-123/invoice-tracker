import { useState, useEffect, FormEvent } from 'react';
import * as api from '../api/endpoints';
import type { AppRoute, IssueResult } from '../types';
import InvoiceChipInput from '../components/InvoiceChipInput';
import BatchResultTable  from '../components/BatchResultTable';
import Spinner           from '../components/Spinner';

export default function MasterInvoicePage() {
  const [routes,   setRoutes]   = useState<AppRoute[]>([]);
  const [routeId,  setRouteId]  = useState('');
  const [invoices, setInvoices] = useState<string[]>([]);
  const [results,  setResults]  = useState<IssueResult[] | null>(null);
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    api.getRoutes()
      .then(rts => setRoutes(rts.filter(r => r.isActive)))
      .catch(() => setError('Failed to load routes.'))
      .finally(() => setFetching(false));
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!invoices.length) { setError('Add at least one invoice number.'); return; }

    setLoading(true);
    try {
      const { results: res } = await api.issueInvoices({ routeId, invoiceNumbers: invoices });
      setResults(res);
      setInvoices([]);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg ?? 'Request failed.');
    } finally {
      setLoading(false);
    }
  };

  if (fetching) return <Spinner text="Loading…" />;

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">Master Invoice</h1>

      <form onSubmit={handleSubmit} className="card p-6 space-y-5">
        {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</p>}

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

        <InvoiceChipInput invoices={invoices} onChange={setInvoices} label="Invoice Numbers" />

        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? 'Submitting…' : 'Submit'}
        </button>
      </form>

      {results && <BatchResultTable results={results} />}
    </div>
  );
}
