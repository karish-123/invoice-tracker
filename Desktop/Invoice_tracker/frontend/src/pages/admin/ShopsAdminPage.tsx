import { useState, useEffect, ChangeEvent } from 'react';
import * as api from '../../api/endpoints';
import type { Shop, BulkShopResult } from '../../types';
import Spinner from '../../components/Spinner';
import CommentSection from '../../components/CommentSection';

interface ParsedRow { routeNumber: string; shopName: string }

const TEMPLATE_CSV = 'route_number,shop_name\nBLR South - 01,ABC Traders\nBLR South - 01,XYZ Stores\n';
const TEMPLATE_DATA_URL = `data:text/csv;charset=utf-8,${encodeURIComponent(TEMPLATE_CSV)}`;

function parseCsv(text: string): ParsedRow[] {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) return [];
  // Skip header if the first row looks like a header
  const first = lines[0].toLowerCase();
  const dataLines = first.includes('route') && first.includes('shop') ? lines.slice(1) : lines;
  return dataLines.map(line => {
    const parts = line.split(',').map(p => p.trim());
    return { routeNumber: parts[0] ?? '', shopName: parts[1] ?? '' };
  });
}

async function parseExcel(file: File): Promise<ParsedRow[]> {
  const XLSX = await import('xlsx');
  const buf = await file.arrayBuffer();
  const workbook = XLSX.read(buf, { type: 'array' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<(string | number)[]>(sheet, { header: 1, defval: '' });
  if (rows.length === 0) return [];
  const first = String(rows[0]?.[0] ?? '').toLowerCase();
  const dataRows = first.includes('route') ? rows.slice(1) : rows;
  return dataRows
    .map(r => ({ routeNumber: String(r[0] ?? '').trim(), shopName: String(r[1] ?? '').trim() }))
    .filter(r => r.routeNumber || r.shopName);
}

export default function ShopsAdminPage() {
  const [shops,      setShops]      = useState<Shop[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState('');

  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [fileName,   setFileName]   = useState('');
  const [parseErr,   setParseErr]   = useState('');
  const [uploading,  setUploading]  = useState(false);
  const [result,     setResult]     = useState<BulkShopResult | null>(null);

  const load = () => {
    setLoading(true);
    api.getShops({ includeInactive: true })
      .then(setShops)
      .catch(() => setError('Failed to load shops.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleFile = async (e: ChangeEvent<HTMLInputElement>) => {
    setParseErr(''); setResult(null);
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    try {
      const lower = file.name.toLowerCase();
      const rows = lower.endsWith('.xlsx') || lower.endsWith('.xls')
        ? await parseExcel(file)
        : parseCsv(await file.text());
      const cleaned = rows.filter(r => r.routeNumber || r.shopName);
      if (cleaned.length === 0) {
        setParseErr('No rows found in file.');
        setParsedRows([]);
        return;
      }
      setParsedRows(cleaned);
    } catch {
      setParseErr('Failed to parse file. Make sure it has two columns: route_number, shop_name.');
      setParsedRows([]);
    }
  };

  const handleUpload = async () => {
    if (parsedRows.length === 0) return;
    setUploading(true);
    try {
      const res = await api.bulkCreateShops(parsedRows);
      setResult(res);
      setParsedRows([]);
      setFileName('');
      load(); // refresh the shop list
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setParseErr(msg ?? 'Upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const toggleActive = async (shop: Shop) => {
    try {
      const updated = await api.updateShop(shop.id, { isActive: !shop.isActive });
      setShops(prev => prev.map(s => s.id === shop.id ? updated : s));
    } catch {
      setError('Failed to update shop.');
    }
  };

  // Group shops by route
  const shopsByRoute = shops.reduce<Record<string, { routeNumber: string; shops: Shop[] }>>((acc, s) => {
    const key = s.route.routeNumber;
    if (!acc[key]) acc[key] = { routeNumber: key, shops: [] };
    acc[key].shops.push(s);
    return acc;
  }, {});
  const groupedRoutes = Object.values(shopsByRoute).sort((a, b) => a.routeNumber.localeCompare(b.routeNumber));

  return (
    <div className="space-y-8 max-w-5xl">
      <h1 className="text-2xl font-bold">Shops</h1>

      {/* Bulk Upload Section */}
      <div className="card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-700">Bulk Upload (CSV / Excel)</h2>
          <a
            href={TEMPLATE_DATA_URL}
            download="shops-template.csv"
            className="text-sm text-blue-600 hover:underline"
          >
            Download template
          </a>
        </div>

        <p className="text-xs text-gray-500">
          File should have two columns: <code className="bg-gray-100 px-1 rounded">route_number</code> and <code className="bg-gray-100 px-1 rounded">shop_name</code>. Unknown routes will be created automatically. Duplicates are skipped.
        </p>

        <input
          type="file"
          accept=".csv,.xlsx,.xls"
          onChange={handleFile}
          className="block w-full text-sm text-gray-700 file:mr-3 file:py-2 file:px-4 file:rounded file:border-0 file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
        />

        {fileName && parsedRows.length > 0 && (
          <div className="text-sm space-y-2">
            <p className="text-gray-600">
              <span className="font-medium">{fileName}</span> — {parsedRows.length} row{parsedRows.length === 1 ? '' : 's'} ready to upload
            </p>
            <div className="border rounded overflow-hidden max-h-48 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 border-b sticky top-0">
                  <tr>
                    <th className="th">#</th>
                    <th className="th">Route</th>
                    <th className="th">Shop</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {parsedRows.slice(0, 20).map((r, i) => (
                    <tr key={i}>
                      <td className="td text-gray-400">{i + 1}</td>
                      <td className="td">{r.routeNumber || <span className="text-red-500">—</span>}</td>
                      <td className="td">{r.shopName || <span className="text-red-500">—</span>}</td>
                    </tr>
                  ))}
                  {parsedRows.length > 20 && (
                    <tr>
                      <td colSpan={3} className="td text-center text-gray-400 italic">
                        +{parsedRows.length - 20} more rows…
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <button onClick={handleUpload} disabled={uploading} className="btn-primary">
              {uploading ? 'Uploading…' : `Upload ${parsedRows.length} row${parsedRows.length === 1 ? '' : 's'}`}
            </button>
          </div>
        )}

        {parseErr && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{parseErr}</p>}

        {result && (
          <div className="text-sm bg-green-50 border border-green-200 rounded px-4 py-3 space-y-1">
            <p className="font-semibold text-green-800">Upload complete</p>
            <ul className="text-gray-700 list-disc list-inside">
              <li>Total rows: {result.total}</li>
              <li>Shops created: {result.created}</li>
              <li>Duplicates skipped: {result.skippedDuplicates}</li>
              <li>Routes auto-created: {result.routesCreated}</li>
              {result.errors.length > 0 && (
                <li className="text-red-700">Errors: {result.errors.length}</li>
              )}
            </ul>
            {result.errors.length > 0 && (
              <details className="mt-2">
                <summary className="cursor-pointer text-red-700">View error rows</summary>
                <ul className="mt-1 list-disc list-inside text-xs text-red-700">
                  {result.errors.map((e, i) => (
                    <li key={i}>Row {e.row}: {e.reason}</li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}
      </div>

      {/* Existing Shops List */}
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b bg-gray-50 flex items-center justify-between">
          <h2 className="font-semibold text-sm text-gray-700">All Shops ({shops.length})</h2>
        </div>

        {error && <p className="text-sm text-red-600 px-4 py-2">{error}</p>}

        {loading ? <Spinner text="Loading…" /> : shops.length === 0 ? (
          <p className="td text-center text-gray-400 py-8">No shops yet. Upload a CSV/Excel file above to get started.</p>
        ) : (
          <div className="divide-y">
            {groupedRoutes.map(group => (
              <div key={group.routeNumber} className="px-4 py-3">
                <h3 className="font-semibold text-sm text-gray-600 mb-2">{group.routeNumber}</h3>
                <div className="flex flex-wrap gap-2">
                  {group.shops.map(s => (
                    <div
                      key={s.id}
                      className={`flex flex-col gap-1 px-3 py-1.5 rounded border text-sm ${
                        s.isActive ? 'bg-white border-gray-300' : 'bg-gray-100 border-gray-200 text-gray-400'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span>{s.name}</span>
                        <button
                          onClick={() => toggleActive(s)}
                          className={`text-xs px-1.5 py-0.5 rounded ${
                            s.isActive
                              ? 'text-red-600 hover:bg-red-50'
                              : 'text-green-700 hover:bg-green-50'
                          }`}
                        >
                          {s.isActive ? 'Retire' : 'Restore'}
                        </button>
                      </div>
                      <CommentSection entityType="SHOP" entityId={s.id} compact />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
