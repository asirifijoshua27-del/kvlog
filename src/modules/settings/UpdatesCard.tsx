import { useState } from 'react';
import { Download, RefreshCw, RotateCw } from 'lucide-react';
import { errorMessage } from '../../services/desktopBridge';
import type { Persistence } from '../../state/usePersistence';
import type { UpdateState } from '../../../shared/system';

function describe(u: UpdateState): string {
  switch (u.status) {
    case 'disabled':
      return 'Updates are only checked in the installed app.';
    case 'checking':
      return 'Checking for updates…';
    case 'none':
      return 'KVLOG is up to date.';
    case 'downloading':
      return `Downloading version ${u.version ?? ''}… ${u.percent}%`;
    case 'ready':
      return `Version ${u.version} is ready. It installs when you close KVLOG, or click Restart and update.`;
    case 'error':
      return u.message ?? 'The update check failed.';
    default:
      return 'KVLOG checks for updates every few hours while it is open.';
  }
}

export function UpdatesCard({ updates, persistence }: { updates: UpdateState | null; persistence: Persistence }) {
  const [error, setError] = useState<string | null>(null);
  if (!updates) return null;

  const install = async () => {
    setError(null);
    try {
      await persistence.flush();
      await window.kvlog?.installUpdate();
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  return (
    <section className="card">
      <header className="card-head"><h3>Updates</h3><span className="panel-meta">Version {updates.current}</span></header>
      <div className="card-body form-stack">
        <p className={updates.status === 'error' ? 'bad-text' : updates.status === 'ready' ? 'ok-text' : 'help'}>{describe(updates)}</p>
        {updates.status === 'downloading' && (
          <div className="update-bar"><span style={{ width: `${updates.percent}%` }} /></div>
        )}
        <div className="inline-row">
          {updates.status === 'ready' ? (
            <button type="button" className="btn btn-primary" onClick={() => void install()} title="Do this after the service, not during it">
              <RotateCw size={14} aria-hidden="true" />
              Restart and update
            </button>
          ) : (
            <button type="button" className="btn" disabled={updates.status === 'disabled' || updates.status === 'checking' || updates.status === 'downloading'} onClick={() => void window.kvlog?.checkForUpdates()}>
              {updates.status === 'checking' ? <RefreshCw size={14} className="spin" aria-hidden="true" /> : <Download size={14} aria-hidden="true" />}
              Check now
            </button>
          )}
          {updates.checkedAt && <span className="help-inline">Last checked {new Date(updates.checkedAt).toLocaleString()}</span>}
        </div>
        {error && <p className="bad-text">{error}</p>}
        <p className="help">Updates never restart KVLOG by themselves, so a service is never interrupted.</p>
      </div>
    </section>
  );
}
