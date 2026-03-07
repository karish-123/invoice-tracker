import { useState, KeyboardEvent, useRef } from 'react';
import { parseBatch } from './BatchInput';

interface Props {
  invoices:  string[];
  onChange:  (invoices: string[]) => void;
  label?:    string;
}

export default function InvoiceChipInput({ invoices, onChange, label }: Props) {
  const [inputValue,   setInputValue]   = useState('');
  const [pasteMode,    setPasteMode]    = useState(false);
  const [pasteRaw,     setPasteRaw]     = useState('');
  const [isDuplicate,  setIsDuplicate]  = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const addInvoice = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    if (invoices.includes(trimmed)) {
      setIsDuplicate(true);
      setTimeout(() => setIsDuplicate(false), 1000);
      setInputValue('');
      return;
    }
    onChange([...invoices, trimmed]);
    setInputValue('');
  };

  const removeInvoice = (inv: string) => {
    onChange(invoices.filter(i => i !== inv));
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addInvoice(inputValue);
    }
  };

  const applyPaste = () => {
    const parsed = parseBatch(pasteRaw);
    const merged = [...new Set([...invoices, ...parsed])];
    onChange(merged);
    setPasteRaw('');
    setPasteMode(false);
  };

  return (
    <div className="space-y-2">
      {label && <label className="label">{label}</label>}

      {/* Chip area */}
      {invoices.length > 0 && (
        <div className="flex flex-wrap gap-1.5 p-2 bg-gray-50 border border-gray-200 rounded max-h-28 overflow-y-auto">
          {invoices.map(inv => (
            <span
              key={inv}
              className="inline-flex items-center gap-1 bg-blue-100 text-blue-800 text-xs font-medium px-2 py-0.5 rounded-full"
            >
              {inv}
              <button
                type="button"
                onClick={() => removeInvoice(inv)}
                className="text-blue-600 hover:text-blue-900 leading-none"
                aria-label={`Remove ${inv}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Input row */}
      <div className="flex gap-2">
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Invoice number, then Enter"
          className={`input flex-1 ${isDuplicate ? 'border-amber-400 bg-amber-50' : ''}`}
        />
        <button
          type="button"
          onClick={() => addInvoice(inputValue)}
          className="btn-ghost text-sm px-3"
        >
          Add
        </button>
      </div>

      {isDuplicate && (
        <p className="text-xs text-amber-700">Already in the list.</p>
      )}

      {/* Paste many toggle */}
      {!pasteMode ? (
        <button
          type="button"
          onClick={() => setPasteMode(true)}
          className="text-xs text-gray-500 hover:text-gray-700 underline"
        >
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

      {/* Count */}
      <p className="text-xs text-gray-500">
        {invoices.length} invoice{invoices.length !== 1 ? 's' : ''} added
      </p>
    </div>
  );
}
