import { useState, useEffect } from 'react';
import * as api from '../api/endpoints';
import { buildExportUrl } from '../api/endpoints';
import type { Executive, AppRoute } from '../types';
import { useAuth } from '../context/AuthContext';

export default function ExportPage() {
  const { user } = useAuth();
  const isExecutive = user?.role === 'EXECUTIVE';

  const [executives, setExecutives] = useState<Executive[]>([]);
  const [routes,     setRoutes]     = useState<AppRoute[]>([]);

  const [dateFrom,      setDateFrom]      = useState('');
  const [dateTo,        setDateTo]        = useState('');
  const [executiveId,   setExecutiveId]   = useState('');
  const [routeId,       setRouteId]       = useState('');
  const [status,        setStatus]        = useState('');

  useEffect(() => {
    if (isExecutive) {
      api.getRoutes().then(setRoutes).catch(() => {});
    } else {
      Promise.all([api.getExecutives(), api.getRoutes()])
        .then(([execs, rts]) => { setExecutives(execs); setRoutes(rts); })
        .catch(() => {});
    }
  }, [isExecutive]);

  const handleExport = () => {
    const params: Record<string, string> = {};
    if (dateFrom)    params.dateFrom    = dateFrom;
    if (dateTo)      params.dateTo      = dateTo;
    if (executiveId) params.executiveId = executiveId;
    if (routeId)     params.routeId     = routeId;
    if (status)      params.status      = status;
    window.location.href = buildExportUrl('/export/history.csv', params);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Export Data</h1>
      <p className="text-sm text-gray-500">
        Download invoice history as a CSV file. Use the filters below to narrow the data.
      </p>

      <div className="card p-6 space-y-4 max-w-lg">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">From Date</label>
            <input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              className="input"
            />
          </div>
          <div>
            <label className="label">To Date</label>
            <input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              className="input"
            />
          </div>
        </div>

        {!isExecutive && (
          <div>
            <label className="label">Executive</label>
            <select value={executiveId} onChange={e => setExecutiveId(e.target.value)} className="input">
              <option value="">All</option>
              {executives.map(ex => <option key={ex.id} value={ex.id}>{ex.name}</option>)}
            </select>
          </div>
        )}

        <div>
          <label className="label">Route</label>
          <select value={routeId} onChange={e => setRouteId(e.target.value)} className="input">
            <option value="">All</option>
            {routes.map(r => <option key={r.id} value={r.id}>{r.routeNumber}</option>)}
          </select>
        </div>

        <div>
          <label className="label">Status</label>
          <select value={status} onChange={e => setStatus(e.target.value)} className="input">
            <option value="">All</option>
            <option value="OUTSTANDING">Outstanding</option>
            <option value="RETURNED">Returned</option>
            <option value="PAID">Paid</option>
            <option value="VOIDED">Voided</option>
          </select>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button onClick={handleExport} className="btn-primary">
            Download CSV
          </button>
          <button
            onClick={() => { setDateFrom(''); setDateTo(''); setExecutiveId(''); setRouteId(''); setStatus(''); }}
            className="btn-ghost text-sm"
          >
            Reset
          </button>
        </div>
      </div>
    </div>
  );
}
