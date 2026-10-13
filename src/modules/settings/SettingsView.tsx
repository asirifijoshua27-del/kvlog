import { useState, type Dispatch } from 'react';
import { BackupCard } from './BackupCard';
import { UsageCard } from './UsageCard';
import { UpdatesCard } from './UpdatesCard';
import type { UpdateState } from '../../../shared/system';
import type { PresentationAction, PresentationState } from '../../state/presentation';
import { FolderOpen, Info } from 'lucide-react';
import type { ModuleMeta } from '../registry';
import { errorMessage, revealDataFile, type AppInfoState } from '../../services/desktopBridge';
import type { Persistence } from '../../state/usePersistence';

const SHORTCUTS: [string, string][] = [
  ['→  ↓  Space  Page Down', 'Next slide'],
  ['←  ↑  Page Up', 'Previous slide'],
  ['B', 'Toggle blackout'],
  ['Esc', 'Clear output'],
  ['F5', 'Full-screen output']
];

function describeSave(persistence: Persistence): string {
  const s = persistence.status;
  switch (s.kind) {
    case 'saved':
      return s.at ? `Saved at ${s.at.toLocaleTimeString()}` : 'Up to date';
    case 'saving':
      return 'Saving…';
    case 'error':
      return `Save failed: ${s.message}`;
    case 'readonly':
      return 'Saving is turned off to protect your data file';
    case 'unavailable':
      return 'Not available in a web browser';
    default:
      return 'Loading…';
  }
}

function yesNo(value: boolean, good: boolean) {
  return <span className={value === good ? 'ok-text' : 'bad-text'}>{value ? 'Enabled' : 'Disabled'}</span>;
}

interface SettingsViewProps {
  meta: ModuleMeta;
  appInfo: AppInfoState;
  persistence: Persistence;
  counts: { items: number; plans: number };
  state: PresentationState;
  dispatch: Dispatch<PresentationAction>;
  updates: UpdateState | null;
}

export function SettingsView({ meta, appInfo, persistence, counts, state, dispatch, updates }: SettingsViewProps) {
  const Icon = meta.icon;
  const info = appInfo.info;
  const [revealError, setRevealError] = useState<string | null>(null);

  const onReveal = async () => {
    setRevealError(null);
    try {
      await revealDataFile();
    } catch (error) {
      setRevealError(errorMessage(error));
    }
  };

  return (
    <div className="page">
      <div className="page-inner">
        <header className="page-header">
          <div className="page-icon" aria-hidden="true">
            <Icon size={20} strokeWidth={1.75} />
          </div>
          <div>
            <h2>{meta.label}</h2>
            <p>{meta.description}</p>
          </div>
        </header>

        {appInfo.error && (
          <div className="notice notice-error" role="alert">
            <Info size={16} aria-hidden="true" />
            <span>{appInfo.error}</span>
          </div>
        )}

        {info && (
          <div className="settings-grid">
            <section className="card">
              <header className="card-head"><h3>Application</h3></header>
              <div className="card-body">
                <dl className="kv">
                  <dt>Version</dt><dd>{info.version}</dd>
                  <dt>Electron</dt><dd>{info.electron}</dd>
                  <dt>Chromium</dt><dd>{info.chrome}</dd>
                  <dt>Node.js</dt><dd>{info.node}</dd>
                  <dt>Platform</dt><dd>{info.platform} ({info.arch})</dd>
                  <dt>Mode</dt><dd>{info.isPackaged ? 'Installed' : 'Development'}</dd>
                </dl>
              </div>
            </section>
            <section className="card">
              <header className="card-head"><h3>Window security</h3></header>
              <div className="card-body">
                <dl className="kv">
                  <dt>Context isolation</dt><dd>{yesNo(info.security.contextIsolation, true)}</dd>
                  <dt>Node integration</dt><dd>{yesNo(info.security.nodeIntegration, false)}</dd>
                  <dt>Sandbox</dt><dd>{yesNo(info.security.sandbox, true)}</dd>
                  <dt>Web security</dt><dd>{yesNo(info.security.webSecurity, true)}</dd>
                </dl>
              </div>
            </section>
          </div>
        )}

        <section className="card">
          <header className="card-head"><h3>Local data</h3></header>
          <div className="card-body data-card">
            <dl className="kv">
              <dt>Status</dt><dd>{describeSave(persistence)}</dd>
              <dt>Library</dt><dd>{counts.items} item{counts.items === 1 ? '' : 's'}</dd>
              <dt>Service plans</dt><dd>{counts.plans}</dd>
              <dt>Data file</dt><dd className="path-text">{persistence.filePath ?? 'Not available'}</dd>
            </dl>
            <p className="help">
              KVLOG saves automatically. The previous version is kept next to it as a .bak file.
            </p>
            {persistence.filePath && (
              <button type="button" className="btn" onClick={onReveal}>
                <FolderOpen size={14} aria-hidden="true" />
                Show in File Explorer
              </button>
            )}
            {revealError && <p className="bad-text">{revealError}</p>}
          </div>
        </section>

        <UpdatesCard updates={updates} persistence={persistence} />

        <BackupCard persistence={persistence} />

        <UsageCard state={state} dispatch={dispatch} />

        <section className="card">
          <header className="card-head"><h3>Keyboard shortcuts</h3></header>
          <div className="card-body">
            <dl className="kv">
              {SHORTCUTS.map(([keys, action]) => (
                <div className="kv-row" key={keys}>
                  <dt>{action}</dt>
                  <dd>{keys}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

      </div>
    </div>
  );
}
