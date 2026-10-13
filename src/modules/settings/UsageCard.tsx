import { useEffect, useState, type Dispatch } from 'react';
import { FileSpreadsheet, RefreshCw } from 'lucide-react';
import { errorMessage } from '../../services/desktopBridge';
import { todayIso } from '../../services/dates';
import type { PresentationAction, PresentationState } from '../../state/presentation';
import type { UsageSummaryRow } from '../../../shared/usage';

function monthsAgo(n: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Song usage for licence reporting (CCLI or similar). */
export function UsageCard({ state, dispatch }: { state: PresentationState; dispatch: Dispatch<PresentationAction> }) {
  const { logUsage, ccliLicence } = state.settings;
  const [from, setFrom] = useState(() => monthsAgo(6));
  const [to, setTo] = useState(todayIso);
  const [rows, setRows] = useState<UsageSummaryRow[] | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const bridge = window.kvlog;

  const refresh = async () => {
    if (!bridge) return;
    try {
      setRows(await bridge.getUsageSummary(from, to));
    } catch (error) {
      setMsg({ ok: false, text: errorMessage(error) });
    }
  };
  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to]);

  const onExport = async () => {
    if (!bridge) return;
    try {
      const file = await bridge.exportUsageReport(from, to, ccliLicence);
      if (file) setMsg({ ok: true, text: `Saved ${file}` });
    } catch (error) {
      setMsg({ ok: false, text: errorMessage(error) });
    }
  };

  const total = rows?.reduce((n, r) => n + r.count, 0) ?? 0;

  return (
    <section className="card">
      <header className="card-head"><h3>Song usage report</h3></header>
      <div className="card-body form-stack">
        <label className="check">
          <input type="checkbox" checked={logUsage} onChange={(e) => dispatch({ type: 'updateSettings', changes: { logUsage: e.target.checked } })} />
          <span>Record every song shown live</span>
        </label>
        <p className="help">
          For a CCLI or similar licence. A song counts once per service (once in 4 hours), however many slides are shown.
          Add each song's CCLI number in Presentation Studio. If your church has no song licence, leave this off.
        </p>
        <label className="auto-row">
          <span>Licence number</span>
          <input className="input" value={ccliLicence} placeholder="e.g. CCLI licence number" onChange={(e) => dispatch({ type: 'updateSettings', changes: { ccliLicence: e.target.value.slice(0, 40) } })} />
        </label>
        <div className="inline-row">
          <label className="inline-row"><span className="help-inline">From</span><input className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
          <label className="inline-row"><span className="help-inline">To</span><input className="input" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
          <button type="button" className="icon-btn" title="Refresh" aria-label="Refresh" onClick={() => void refresh()}><RefreshCw size={14} /></button>
          <button type="button" className="btn" disabled={!bridge || !rows?.length} onClick={() => void onExport()}>
            <FileSpreadsheet size={14} aria-hidden="true" />
            Save report (Excel CSV)
          </button>
        </div>
        {rows && (rows.length === 0 ? (
          <p className="help">No songs recorded in this period.</p>
        ) : (
          <>
            <p className="help-inline">{rows.length} song{rows.length === 1 ? '' : 's'}, used {total} time{total === 1 ? '' : 's'}</p>
            <div className="usage-scroll">
              <table className="usage-table">
                <thead><tr><th>Song</th><th>CCLI #</th><th className="num">Times</th><th>Last used</th></tr></thead>
                <tbody>
                  {rows.slice(0, 300).map((r) => (
                    <tr key={`${r.ccli}|${r.title}`}>
                      <td>{r.title}</td>
                      <td>{r.ccli || <span className="bad-text">missing</span>}</td>
                      <td className="num">{r.count}</td>
                      <td>{new Date(r.last).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ))}
        {msg && <p className={msg.ok ? 'ok-text' : 'bad-text'}>{msg.text}</p>}
      </div>
    </section>
  );
}
