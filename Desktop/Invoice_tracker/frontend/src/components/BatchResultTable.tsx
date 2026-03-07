import type { IssueResult } from '../types';

interface Props { results: IssueResult[]; className?: string }

export default function BatchResultTable({ results, className = '' }: Props) {
  const ok   = results.filter(r => r.success).length;
  const fail = results.length - ok;

  return (
    <div className={className}>
      <div className="flex gap-4 mb-3 text-sm font-medium">
        <span className="text-green-700">{ok} succeeded</span>
        {fail > 0 && <span className="text-red-700">{fail} failed</span>}
      </div>
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="th">Invoice #</th>
              <th className="th">Result</th>
              <th className="th">Detail</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {results.map(r => (
              <tr key={r.invoiceNumber} className={r.success ? 'bg-green-50' : 'bg-red-50'}>
                <td className="td font-mono">{r.invoiceNumber}</td>
                <td className="td font-semibold">
                  <span className={r.success ? 'text-green-700' : 'text-red-700'}>
                    {r.success ? '✓ OK' : '✗ Failed'}
                  </span>
                </td>
                <td className="td text-xs text-gray-500">
                  {r.error ?? (r.checkoutId ? `id: ${r.checkoutId.slice(0, 8)}…` : '')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
