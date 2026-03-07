interface Props {
  value:       string;
  onChange:    (v: string) => void;
  label?:      string;
  placeholder?: string;
}

/** Textarea that auto-parses comma/newline separated invoice numbers and shows a count. */
export default function BatchInput({ value, onChange, label, placeholder }: Props) {
  const items    = value.split(/[\n,]+/).map(s => s.trim()).filter(Boolean);
  const unique   = [...new Set(items)];
  const dupes    = items.length - unique.length;

  return (
    <div>
      {label && <label className="label">{label}</label>}
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        rows={6}
        placeholder={placeholder ?? 'Paste invoice numbers — newline or comma separated'}
        className="input font-mono resize-y"
      />
      {items.length > 0 && (
        <p className="mt-1 text-xs text-gray-500">
          {unique.length} unique invoice{unique.length !== 1 ? 's' : ''}
          {dupes > 0 && <span className="text-amber-600"> · {dupes} duplicate{dupes !== 1 ? 's' : ''} removed</span>}
        </p>
      )}
    </div>
  );
}

/** Parse a raw textarea value into a deduped, trimmed array. */
export function parseBatch(raw: string): string[] {
  const items = raw.split(/[\n,]+/).map(s => s.trim()).filter(Boolean);
  return [...new Set(items)];
}
