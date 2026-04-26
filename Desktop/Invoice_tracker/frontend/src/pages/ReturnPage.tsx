import { useState, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import * as api from '../api/endpoints';
import type { IssueResult } from '../types';
import InvoiceChipInput from '../components/InvoiceChipInput';
import BatchResultTable  from '../components/BatchResultTable';
import Modal             from '../components/Modal';
import { useAuth }       from '../context/AuthContext';

export default function ReturnPage() {
  const { user } = useAuth();
  const isAdmin  = user?.role === 'ADMIN';

  const [invoices,    setInvoices]    = useState<string[]>([]);
  const [inDatetime,  setInDatetime]  = useState('');
  const [remarks,     setRemarks]     = useState('');
  const [results,     setResults]     = useState<IssueResult[] | null>(null);
  const [error,       setError]       = useState('');
  const [loading,     setLoading]     = useState(false);

  // Payment Received section
  const [pmtInvoices, setPmtInvoices] = useState<string[]>([]);
  const [pmtResults,  setPmtResults]  = useState<IssueResult[] | null>(null);
  const [pmtError,    setPmtError]    = useState('');
  const [pmtLoading,  setPmtLoading]  = useState(false);

  // Backdate modal (OFFICE_STAFF only)
  const [bdOpen,    setBdOpen]    = useState(false);
  const [bdDatetime,setBdDatetime]= useState('');
  const [bdReason,  setBdReason]  = useState('');
  const [bdLoading, setBdLoading] = useState(false);
  const [bdError,   setBdError]   = useState('');
  const [bdSuccess, setBdSuccess] = useState(false);

  const handlePaymentSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setPmtError('');
    if (!pmtInvoices.length) { setPmtError('Add at least one invoice number.'); return; }
    setPmtLoading(true);
    try {
      const { results: res } = await api.markPaymentReceived(pmtInvoices);
      setPmtResults(res);
      setPmtInvoices([]);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setPmtError(msg ?? 'Request failed.');
    } finally {
      setPmtLoading(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!invoices.length) { setError('Add at least one invoice number.'); return; }

    setLoading(true);
    try {
      const payload: Parameters<typeof api.returnInvoices>[0] = { invoiceNumbers: invoices };
      if (isAdmin && inDatetime) payload.inDatetime = new Date(inDatetime).toISOString();
      if (remarks.trim()) payload.remarks = remarks.trim();
      const { results: res } = await api.returnInvoices(payload);
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
        requestType:       'RETURN_BACKDATE',
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

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">Return Invoices</h1>

      <form onSubmit={handleSubmit} className="card p-6 space-y-5">
        {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</p>}

        <InvoiceChipInput invoices={invoices} onChange={setInvoices} label="Invoice Numbers to Return" />

        {/* Datetime: ADMIN only */}
        {isAdmin && (
          <div>
            <label className="label">In Date/Time <span className="text-gray-400 font-normal">(optional — defaults to now)</span></label>
            <input
              type="datetime-local"
              value={inDatetime}
              onChange={e => setInDatetime(e.target.value)}
              className="input"
            />
          </div>
        )}

        <div>
          <label className="label">Remarks <span className="text-gray-400 font-normal">(optional)</span></label>
          <input
            type="text"
            value={remarks}
            onChange={e => setRemarks(e.target.value)}
            placeholder="e.g. Received partial return, items damaged…"
            className="input"
          />
        </div>

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

      {/* ── Payment Received ── */}
      <h2 className="text-xl font-semibold">Payment Received</h2>
      <form onSubmit={handlePaymentSubmit} className="card p-6 space-y-5">
        <p className="text-sm text-gray-500">
          Mark invoices as fully paid. Paid invoices are permanently closed and cannot be re-issued.
        </p>
        {pmtError && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{pmtError}</p>}

        <InvoiceChipInput invoices={pmtInvoices} onChange={setPmtInvoices} label="Invoice Numbers" />

        <button type="submit" disabled={pmtLoading} className="btn-primary w-full">
          {pmtLoading ? 'Marking…' : 'Mark as Paid'}
        </button>
      </form>

      {pmtResults && <BatchResultTable results={pmtResults} />}

      {/* Backdate approval modal */}
      {bdOpen && (
        <Modal title="Request Backdated Return" onClose={() => setBdOpen(false)} wide>
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
              <div className="text-sm text-gray-600 bg-gray-50 rounded p-3">
                <p><span className="font-medium">Invoices:</span> {invoices.join(', ')}</p>
              </div>
              <div>
                <label className="label">Backdated Return Date/Time *</label>
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
                  placeholder="Why does this return need to be backdated?"
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
