import { useState, KeyboardEvent } from 'react';

export interface InvoiceEntry {
  invoiceNumber: string;
  remarks:       string;
  invoiceAmount: string;
}

interface Props {
  entries:   InvoiceEntry[];
  onChange:  (entries: InvoiceEntry[]) => void;
  label?:    string;
}

export default function InvoiceWithRemarksInput({ entries, onChange, label }: Props) {
  const [inputValue, setInputValue] = useState('');
  const [pasteMode,  setPasteMode]  = useState(false);
  const [pasteRaw,   setPasteRaw]   = useState('');

  const addInvoice = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    if (entries.some(e => e.invoiceNumber === trimmed)) {
      setInputValue('');
      return;
    }
    onChange([...entries, { invoiceNumber: trimmed, remarks: '', invoiceAmount: '' }]);
    setInputValue('');
  };

  const removeEntry = (idx: number) => onChange(entries.filter((_, i) => i !== idx));

  const updateRemarks = (idx: number, remarks: string) => {
    const updated = [...entries];
    updated[idx] = { ...updated[idx], remarks };
    onChange(updated);
  };

  const updateAmount = (idx: number, invoiceAmount: string) => {
    const updated = [...entries];
    updated[idx] = { ...updated[idx], invoiceAmount };
    onChange(updated);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); addInvoice(inputValue); }
  };

  const applyPaste = () => {
    const lines = pasteRaw.split(/[\n,]+/).map(s => s.trim()).filter(Boolean);
    const existing = new Set(entries.map(e => e.invoiceNumber));
    const newEntries = lines
      .filter(l => !existing.has(l))
      .map(invoiceNumber => ({ invoiceNumber, remarks: '', invoiceAmount: '' }));
    onChange([...entries, ...newEntries]);
    setPasteRaw('');
    setPasteMode(false);
  };

  return (
    <div className="space-y-2">
      {label && <label className="label">{label}</label>}

      {entries.length > 0 && (
        <div className="border border-gray-200 rounded overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="th">Invoice #</th>
                <th className="th">Amount (₹)</th>
                <th className="th">Remarks</th>
                <th className="th w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {entries.map((entry, idx) => (
                <tr key={entry.invoiceNumber}>
                  <td className="td font-mono text-sm">{entry.invoiceNumber}</td>
                  <td className="td">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={entry.invoiceAmount}
                      onChange={e => updateAmount(idx, e.target.value)}
                      placeholder="Optional"
                      className="w-full px-2 py-1 text-sm border border-gray-200 rounded focus:outline-none focus:border-blue-400"
                    />
                  </td>
                  <td className="td">
                    <input
                      type="text"
                      value={entry.remarks}
                      onChange={e => updateRemarks(idx, e.target.value)}
                      placeholder="Optional remarks…"
                      className="w-full px-2 py-1 text-sm border border-gray-200 rounded focus:outline-none focus:border-blue-400"
                    />
                  </td>
                  <td className="td">
                    <button
                      type="button"
                      onClick={() => removeEntry(idx)}
                      className="text-red-500 hover:text-red-700"
                    >
                      ×
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex gap-2">
        <input
          type="text"
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Invoice number, then Enter"
          className="input flex-1"
        />
        <button type="button" onClick={() => addInvoice(inputValue)} className="btn-ghost text-sm px-3">
          Add
        </button>
      </div>

      {!pasteMode ? (
        <button type="button" onClick={() => setPasteMode(true)} className="text-xs text-gray-500 hover:text-gray-700 underline">
          Paste many at once
        </button>
      ) : (
        <div className="space-y-1">
          <textarea
            rows={3}
            value={pasteRaw}
            onChange={e => setPasteRaw(e.target.value)}
            className="input resize-none text-xs font-mono"
            placeholder="Paste invoice numbers (comma or newline separated)"
          />
          <div className="flex gap-2">
            <button type="button" onClick={applyPaste} className="btn-primary text-xs py-1">Apply</button>
            <button type="button" onClick={() => { setPasteMode(false); setPasteRaw(''); }} className="btn-ghost text-xs py-1">Cancel</button>
          </div>
        </div>
      )}

      <p className="text-xs text-gray-500">{entries.length} invoice{entries.length !== 1 ? 's' : ''} added</p>
    </div>
  );
}
