import { useState, useEffect, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import * as api from '../api/endpoints';
import type { Executive, IssueResult } from '../types';
import InvoiceChipInput from '../components/InvoiceChipInput';
import BatchResultTable  from '../components/BatchResultTable';
import Spinner           from '../components/Spinner';
import Modal             from '../components/Modal';
import { useAuth }       from '../context/AuthContext';

export default function IssuePage() {
  const { user } = useAuth();
  const isAdmin  = user?.role === 'ADMIN';

  const [executives,   setExecutives]   = useState<Executive[]>([]);
  const [executiveId,  setExecutiveId]  = useState('');
  const [invoices,     setInvoices]     = useState<string[]>([]);
  const [outDatetime,  setOutDatetime]  = useState('');
  const [results,      setResults]      = useState<IssueResult[] | null>(null);
  const [error,        setError]        = useState('');
  const [loading,      setLoading]      = useState(false);
  const [fetching,     setFetching]     = useState(true);

  // Backdate modal (OFFICE_STAFF only)
  const [bdOpen,    setBdOpen]    = useState(false);
  const [bdDatetime,setBdDatetime]= useState('');
  const [bdReason,  setBdReason]  = useState('');
  const [bdLoading, setBdLoading] = useState(false);
  const [bdError,   setBdError]   = useState('');
  const [bdSuccess, setBdSuccess] = useState(false);

  useEffect(() => {
    api.getExecutives()
      .then(execs => setExecutives(execs.filter(e => e.isActive)))
      .catch(() => setError('Failed to load executives.'))
      .finally(() => setFetching(false));
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!invoices.length) { setError('Add at least one invoice number.'); return; }

    setLoading(true);
    try {
      const payload: Parameters<typeof api.issueInvoices>[0] = {
        executiveId, invoiceNumbers: invoices,
      };
      if (isAdmin && outDatetime) payload.outDatetime = new Date(outDatetime).toISOString();
      const { results: res } = await api.issueInvoices(payload);
      setResults(res);
      setInvoices([]);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg ?? 'Request failed.');
    } finally {
      setLoading(false);
    }
  };

  const openBackdate = () => {
    if (!executiveId) {
      setError('Select an executive before requesting a backdate.');
      return;
    }
    if (!invoices.length) {
      setError('Add at least one invoice number before requesting a backdate.');
      return;
    }
    setError('');
    setBdOpen(true);
    setBdDatetime('');
    setBdReason('');
    setBdError('');
    setBdSuccess(false);
  };

  const handleBackdateSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBdLoading(true);
    setBdError('');
    try {
      await api.createApproval({
        requestType:       'CHECKOUT_BACKDATE',
        executiveId,
        invoiceNumbers:    invoices,
        requestedDatetime: new Date(bdDatetime).toISOString(),
        reason:            bdReason.trim(),
      });
      setBdSuccess(true);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setBdError(msg ?? 'Failed to submit request.');
    } finally {
      setBdLoading(false);
    }
  };

  if (fetching) return <Spinner text="Loading…" />;

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">Issued Invoices</h1>

      <form onSubmit={handleSubmit} className="card p-6 space-y-5">
        {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</p>}

        <div>
          <label className="label">Executive</label>
          <select value={executiveId} onChange={e => setExecutiveId(e.target.value)} className="input" required>
            <option value="">Select executive…</option>
            {executives.map(ex => <option key={ex.id} value={ex.id}>{ex.name}</option>)}
          </select>
        </div>

        <InvoiceChipInput invoices={invoices} onChange={setInvoices} label="Invoice Numbers" />

        {/* Datetime: ADMIN only */}
        {isAdmin && (
          <div>
            <label className="label">Out Date/Time <span className="text-gray-400 font-normal">(optional — defaults to now)</span></label>
            <input
              type="datetime-local"
              value={outDatetime}
              onChange={e => setOutDatetime(e.target.value)}
              className="input"
            />
          </div>
        )}

        <div className="flex flex-col gap-2">
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? 'Submitting…' : 'Submit'}
          </button>

          {!isAdmin && (
            <button type="button" onClick={openBackdate} className="btn-ghost text-sm">
              Need to backdate? Submit an approval request
            </button>
          )}
        </div>
      </form>

      {results && <BatchResultTable results={results} />}

      {/* Backdate approval modal */}
      {bdOpen && (
        <Modal title="Request Backdated Issue" onClose={() => setBdOpen(false)} wide>
          {bdSuccess ? (
            <div className="space-y-4">
              <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded px-3 py-2">
                Backdate request submitted successfully. An admin will review it shortly.
              </p>
              <p className="text-sm text-gray-600">
                Track the status in{' '}
                <Link to="/my-approvals" className="text-blue-600 hover:underline" onClick={() => setBdOpen(false)}>
                  My Requests
                </Link>.
              </p>
              <div className="flex justify-end">
                <button onClick={() => setBdOpen(false)} className="btn-ghost">Close</button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleBackdateSubmit} className="space-y-4">
              {bdError && <p className="text-sm text-red-600">{bdError}</p>}
              <div className="text-sm text-gray-600 bg-gray-50 rounded p-3 space-y-1">
                <p><span className="font-medium">Invoices:</span> {invoices.join(', ')}</p>
                <p><span className="font-medium">Executive:</span> {executives.find(e => e.id === executiveId)?.name}</p>
              </div>
              <div>
                <label className="label">Backdated Issue Date/Time *</label>
                <input
                  required
                  type="datetime-local"
                  value={bdDatetime}
                  onChange={e => setBdDatetime(e.target.value)}
                  className="input"
                />
              </div>
              <div>
                <label className="label">Reason *</label>
                <textarea
                  required
                  rows={3}
                  value={bdReason}
                  onChange={e => setBdReason(e.target.value)}
                  className="input resize-none"
                  placeholder="Why does this need to be backdated?"
                />
              </div>
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => setBdOpen(false)} className="btn-ghost">Cancel</button>
                <button type="submit" disabled={bdLoading} className="btn-primary">
                  {bdLoading ? 'Submitting…' : 'Submit Request'}
                </button>
              </div>
            </form>
          )}
        </Modal>
      )}
    </div>
  );
}
