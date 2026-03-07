import { useState, useEffect, FormEvent } from 'react';
import * as api from '../../api/endpoints';
import type { User, Executive, Role } from '../../types';
import Modal   from '../../components/Modal';
import Spinner from '../../components/Spinner';

const ROLES: Role[] = ['ADMIN', 'OFFICE_STAFF', 'EXECUTIVE'];

type FormState = {
  name:        string;
  username:    string;
  password:    string;
  role:        Role;
  isActive:    boolean;
  executiveId: string;
};

const emptyForm = (): FormState => ({
  name: '', username: '', password: '', role: 'OFFICE_STAFF', isActive: true, executiveId: '',
});

export default function UsersPage() {
  const [rows,       setRows]       = useState<User[]>([]);
  const [executives, setExecutives] = useState<Executive[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState('');

  const [editing,   setEditing]   = useState<User | null>(null);
  const [isNew,     setIsNew]     = useState(false);
  const [form,      setForm]      = useState<FormState>(emptyForm());
  const [saving,    setSaving]    = useState(false);
  const [saveError, setSaveError] = useState('');

  const [delTarget, setDelTarget] = useState<User | null>(null);
  const [deleting,  setDeleting]  = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all([api.getUsers(), api.getExecutives()])
      .then(([users, execs]) => {
        setRows(users);
        setExecutives(execs);
      })
      .catch(() => setError('Failed to load users.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const openNew = () => {
    setIsNew(true);
    setEditing(null);
    setForm(emptyForm());
    setSaveError('');
  };

  const openEdit = (u: User) => {
    setIsNew(false);
    setEditing(u);
    setForm({
      name:        u.name,
      username:    u.username,
      password:    '',
      role:        u.role,
      isActive:    u.isActive,
      executiveId: u.executiveId ?? '',
    });
    setSaveError('');
  };

  const closeModal = () => { setEditing(null); setIsNew(false); };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveError('');
    try {
      if (isNew) {
        await api.createUser({
          name:        form.name.trim(),
          username:    form.username.trim(),
          password:    form.password,
          role:        form.role,
          executiveId: form.role === 'EXECUTIVE' && form.executiveId ? form.executiveId : null,
        });
      } else if (editing) {
        const patch: Parameters<typeof api.updateUser>[1] = {
          name:        form.name.trim(),
          username:    form.username.trim(),
          role:        form.role,
          isActive:    form.isActive,
          executiveId: form.role === 'EXECUTIVE' && form.executiveId ? form.executiveId : null,
        };
        if (form.password) patch.password = form.password;
        await api.updateUser(editing.id, patch);
      }
      closeModal();
      load();
    } catch (err: unknown) {
      const raw = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? '';
      let friendly = raw;
      if (raw.toLowerCase().includes('unique constraint') || raw.toLowerCase().includes('p2002')) {
        friendly = 'That username is already taken. Choose a different username.';
      } else if (raw.toLowerCase().includes('at least 8') || raw.toLowerCase().includes('min')) {
        friendly = 'Password must be at least 8 characters.';
      }
      setSaveError(friendly || 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!delTarget) return;
    setDeleting(true);
    try {
      await api.deleteUser(delTarget.id);
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

  const fld = <K extends keyof FormState>(k: K) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm(f => ({ ...f, [k]: e.target.value as FormState[K] }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Users</h1>
        <button onClick={openNew} className="btn-primary text-sm">+ Add User</button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {loading ? <Spinner text="Loading…" /> : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="th">Name</th>
                <th className="th">Username</th>
                <th className="th">Role</th>
                <th className="th">Status</th>
                <th className="th">Created</th>
                <th className="th"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.length === 0 && (
                <tr><td colSpan={6} className="td text-center text-gray-400 py-8">No users</td></tr>
              )}
              {rows.map(u => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="td font-medium">{u.name}</td>
                  <td className="td font-mono text-gray-600">{u.username}</td>
                  <td className="td">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      u.role === 'ADMIN'        ? 'bg-purple-100 text-purple-700' :
                      u.role === 'OFFICE_STAFF' ? 'bg-blue-100 text-blue-700'    :
                                                  'bg-yellow-100 text-yellow-700'
                    }`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="td">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      u.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {u.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="td text-gray-500 whitespace-nowrap">
                    {new Date(u.createdAt).toLocaleDateString()}
                  </td>
                  <td className="td">
                    <div className="flex gap-3">
                      <button onClick={() => openEdit(u)} className="text-xs text-blue-600 hover:underline">Edit</button>
                      <button onClick={() => setDelTarget(u)} className="text-xs text-red-600 hover:underline">Delete</button>
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
        <Modal title={isNew ? 'Add User' : `Edit — ${editing?.name}`} onClose={closeModal}>
          <form onSubmit={handleSave} className="space-y-4">
            {saveError && <p className="text-sm text-red-600">{saveError}</p>}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Full Name *</label>
                <input required type="text" value={form.name} onChange={fld('name')} className="input" />
              </div>
              <div>
                <label className="label">Username *</label>
                <input required type="text" value={form.username} onChange={fld('username')} className="input" />
              </div>
            </div>

            <div>
              <label className="label">
                Password {!isNew && <span className="text-gray-400 font-normal">(leave blank to keep current)</span>}
                {isNew && ' *'}
              </label>
              <input
                type="password"
                value={form.password}
                onChange={fld('password')}
                className="input"
                required={isNew}
                autoComplete="new-password"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Role *</label>
                <select value={form.role} onChange={fld('role')} className="input" required>
                  {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
                {form.role === 'ADMIN' && (
                  <p className="mt-1 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                    This user will have full admin access. Confirm this is intended.
                  </p>
                )}
              </div>
              <div>
                <label className="label">
                  Executive {form.role !== 'EXECUTIVE' && <span className="text-gray-400 font-normal">(N/A)</span>}
                </label>
                <select
                  value={form.executiveId}
                  onChange={fld('executiveId')}
                  className="input"
                  disabled={form.role !== 'EXECUTIVE'}
                >
                  <option value="">— none —</option>
                  {executives.map(ex => <option key={ex.id} value={ex.id}>{ex.name}</option>)}
                </select>
              </div>
            </div>

            {!isNew && (
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="user-active"
                  checked={form.isActive}
                  onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))}
                />
                <label htmlFor="user-active" className="text-sm">Active</label>
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

      {/* Delete confirm */}
      {delTarget && (
        <Modal title="Delete User" onClose={() => setDelTarget(null)}>
          <div className="space-y-4">
            <p className="text-sm text-gray-700">
              Delete user <strong>{delTarget.name}</strong> (<code>{delTarget.username}</code>)?
              This cannot be undone.
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
