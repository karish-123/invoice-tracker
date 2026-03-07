import { useState, useEffect, FormEvent } from 'react';
import * as api from '../../api/endpoints';
import type { AppRoute } from '../../types';
import Modal   from '../../components/Modal';
import Spinner from '../../components/Spinner';

type FormState = { routeNumber: string; description: string; isActive: boolean };
const empty: FormState = { routeNumber: '', description: '', isActive: true };

export default function RoutesAdminPage() {
  const [rows,    setRows]    = useState<AppRoute[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  const [editing,   setEditing]   = useState<AppRoute | null>(null);
  const [isNew,     setIsNew]     = useState(false);
  const [form,      setForm]      = useState<FormState>(empty);
  const [saving,    setSaving]    = useState(false);
  const [saveError, setSaveError] = useState('');

  const [delTarget, setDelTarget] = useState<AppRoute | null>(null);
  const [deleting,  setDeleting]  = useState(false);

  const load = () => {
    setLoading(true);
    api.getRoutes()
      .then(setRows)
      .catch(() => setError('Failed to load routes.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const openNew = () => {
    setIsNew(true);
    setEditing(null);
    setForm(empty);
    setSaveError('');
  };

  const openEdit = (r: AppRoute) => {
    setIsNew(false);
    setEditing(r);
    setForm({ routeNumber: r.routeNumber, description: r.description ?? '', isActive: r.isActive });
    setSaveError('');
  };

  const closeModal = () => { setEditing(null); setIsNew(false); };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveError('');
    const payload = {
      routeNumber:  form.routeNumber.trim(),
      description:  form.description.trim() || null,
    };
    try {
      if (isNew) {
        await api.createRoute(payload);
      } else if (editing) {
        await api.updateRoute(editing.id, { ...payload, isActive: form.isActive });
      }
      closeModal();
      load();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setSaveError(msg ?? 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!delTarget) return;
    setDeleting(true);
    try {
      await api.deleteRoute(delTarget.id);
      setDelTarget(null);
      load();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg ?? 'Delete failed.');
      setDelTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Routes</h1>
        <button onClick={openNew} className="btn-primary text-sm">+ Add Route</button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {loading ? <Spinner text="Loading…" /> : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="th">Route #</th>
                <th className="th">Description</th>
                <th className="th">Status</th>
                <th className="th"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.length === 0 && (
                <tr><td colSpan={4} className="td text-center text-gray-400 py-8">No routes</td></tr>
              )}
              {rows.map(r => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="td font-mono font-medium">{r.routeNumber}</td>
                  <td className="td text-gray-600">{r.description ?? '—'}</td>
                  <td className="td">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      r.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {r.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="td">
                    <div className="flex gap-3">
                      <button onClick={() => openEdit(r)} className="text-xs text-blue-600 hover:underline">Edit</button>
                      <button onClick={() => setDelTarget(r)} className="text-xs text-red-600 hover:underline">Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {(isNew || editing) && (
        <Modal title={isNew ? 'Add Route' : `Edit — ${editing?.routeNumber}`} onClose={closeModal}>
          <form onSubmit={handleSave} className="space-y-4">
            {saveError && <p className="text-sm text-red-600">{saveError}</p>}
            <div>
              <label className="label">Route Number *</label>
              <input
                required
                type="text"
                value={form.routeNumber}
                onChange={e => setForm(f => ({ ...f, routeNumber: e.target.value }))}
                className="input"
                placeholder="e.g. RT-01"
              />
            </div>
            <div>
              <label className="label">Description <span className="text-gray-400 font-normal">(optional)</span></label>
              <input
                type="text"
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                className="input"
                placeholder="e.g. North Region"
              />
            </div>
            {!isNew && (
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="route-active"
                  checked={form.isActive}
                  onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))}
                />
                <label htmlFor="route-active" className="text-sm">Active</label>
              </div>
            )}
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={closeModal} className="btn-ghost">Cancel</button>
              <button type="submit" disabled={saving} className="btn-primary">
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {delTarget && (
        <Modal title="Delete Route" onClose={() => setDelTarget(null)}>
          <div className="space-y-4">
            <p className="text-sm text-gray-700">
              Delete route <strong>{delTarget.routeNumber}</strong>? This cannot be undone.
            </p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setDelTarget(null)} className="btn-ghost">Cancel</button>
              <button onClick={handleDelete} disabled={deleting} className="btn-danger">
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
