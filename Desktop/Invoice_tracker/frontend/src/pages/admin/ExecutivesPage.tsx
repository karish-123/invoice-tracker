import { useState, useEffect, FormEvent } from 'react';
import * as api from '../../api/endpoints';
import type { Executive } from '../../types';
import Modal   from '../../components/Modal';
import Spinner from '../../components/Spinner';

type FormState = { name: string; isActive: boolean };
const empty: FormState = { name: '', isActive: true };

export default function ExecutivesPage() {
  const [rows,    setRows]    = useState<Executive[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  // Modal
  const [editing,    setEditing]    = useState<Executive | null>(null);
  const [isNew,      setIsNew]      = useState(false);
  const [form,       setForm]       = useState<FormState>(empty);
  const [saving,     setSaving]     = useState(false);
  const [saveError,  setSaveError]  = useState('');

  // Delete confirm
  const [delTarget, setDelTarget] = useState<Executive | null>(null);
  const [deleting,  setDeleting]  = useState(false);

  const load = () => {
    setLoading(true);
    api.getExecutives()
      .then(setRows)
      .catch(() => setError('Failed to load executives.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const openNew = () => {
    setIsNew(true);
    setEditing(null);
    setForm(empty);
    setSaveError('');
  };

  const openEdit = (ex: Executive) => {
    setIsNew(false);
    setEditing(ex);
    setForm({ name: ex.name, isActive: ex.isActive });
    setSaveError('');
  };

  const closeModal = () => { setEditing(null); setIsNew(false); };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveError('');
    try {
      if (isNew) {
        await api.createExecutive({ name: form.name.trim() });
      } else if (editing) {
        await api.updateExecutive(editing.id, { name: form.name.trim(), isActive: form.isActive });
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
      await api.deleteExecutive(delTarget.id);
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
        <h1 className="text-2xl font-bold">Executives</h1>
        <button onClick={openNew} className="btn-primary text-sm">+ Add Executive</button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {loading ? <Spinner text="Loading…" /> : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="th">Name</th>
                <th className="th">Status</th>
                <th className="th"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.length === 0 && (
                <tr><td colSpan={3} className="td text-center text-gray-400 py-8">No executives</td></tr>
              )}
              {rows.map(ex => (
                <tr key={ex.id} className="hover:bg-gray-50">
                  <td className="td font-medium">{ex.name}</td>
                  <td className="td">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      ex.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {ex.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="td">
                    <div className="flex gap-3">
                      <button onClick={() => openEdit(ex)} className="text-xs text-blue-600 hover:underline">Edit</button>
                      <button onClick={() => setDelTarget(ex)} className="text-xs text-red-600 hover:underline">Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create / Edit modal */}
      {(isNew || editing) && (
        <Modal title={isNew ? 'Add Executive' : `Edit — ${editing?.name}`} onClose={closeModal}>
          <form onSubmit={handleSave} className="space-y-4">
            {saveError && <p className="text-sm text-red-600">{saveError}</p>}
            <div>
              <label className="label">Name *</label>
              <input
                required
                type="text"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="input"
              />
            </div>
            {!isNew && (
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="ex-active"
                  checked={form.isActive}
                  onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))}
                />
                <label htmlFor="ex-active" className="text-sm">Active</label>
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

      {/* Delete confirm modal */}
      {delTarget && (
        <Modal title="Delete Executive" onClose={() => setDelTarget(null)}>
          <div className="space-y-4">
            <p className="text-sm text-gray-700">
              Delete <strong>{delTarget.name}</strong>? This cannot be undone.
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
