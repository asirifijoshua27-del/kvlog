import { useEffect, useState } from 'react';
import { ArchiveRestore, FolderOpen, HardDriveDownload, Loader2 } from 'lucide-react';
import { errorMessage } from '../../services/desktopBridge';
import type { Persistence } from '../../state/usePersistence';
import type { BackupResult } from '../../../shared/usage';
import type { AutoBackupInfo } from '../../../shared/system';

type Msg = { tone: 'ok' | 'error' | 'busy'; text: string; folder?: string } | null;

function describe(r: BackupResult, verb: string): string {
  const parts = [`${r.items} item${r.items === 1 ? '' : 's'}`, `${r.plans} service${r.plans === 1 ? '' : 's'}`, `${r.mediaFiles} media file${r.mediaFiles === 1 ? '' : 's'}`, `${r.bibles} Bible${r.bibles === 1 ? '' : 's'}`];
  const problems = r.problems.length ? ` ${r.problems.length} file${r.problems.length === 1 ? '' : 's'} could not be copied: ${r.problems.slice(0, 3).join('; ')}${r.problems.length > 3 ? '…' : ''}` : '';
  return `${verb} ${parts.join(', ')}.${problems}`;
}

/** Full backup to a folder, and restore from one (for a new computer, or after a mistake). */
export function BackupCard({ persistence }: { persistence: Persistence }) {
  const [msg, setMsg] = useState<Msg>(null);
  const [confirmRestore, setConfirmRestore] = useState(false);
  const bridge = window.kvlog;
  const busy = msg?.tone === 'busy';
  const [daily, setDaily] = useState<AutoBackupInfo[]>([]);
  const [pick, setPick] = useState('');
  const [confirmDaily, setConfirmDaily] = useState(false);

  useEffect(() => {
    bridge?.listAutoBackups().then((list) => {
      setDaily(list);
      setPick((p) => p || list[0]?.name || '');
    }).catch(() => undefined);
  }, [bridge, msg]);

  const dayLabel = (name: string) => new Date(`${name}T12:00`).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

  const onRestoreDaily = async () => {
    if (!bridge || !pick) return;
    setConfirmDaily(false);
    setMsg({ tone: 'busy', text: 'Restoring…' });
    try {
      await persistence.flush();
      const r = await bridge.restoreAutoBackup(pick);
      await persistence.reload();
      setMsg({ tone: 'ok', text: `Restored the backup from ${dayLabel(pick)}: ${r.items} items, ${r.plans} services.` });
    } catch (error) {
      setMsg({ tone: 'error', text: errorMessage(error) });
    }
  };

  const onExport = async () => {
    if (!bridge) return;
    setMsg({ tone: 'busy', text: 'Saving and copying files…' });
    try {
      await persistence.flush();
      const r = await bridge.exportBackup();
      setMsg(r.folder ? { tone: r.problems.length ? 'error' : 'ok', text: describe(r, 'Backed up'), folder: r.folder } : null);
    } catch (error) {
      setMsg({ tone: 'error', text: errorMessage(error) });
    }
  };

  const onRestore = async () => {
    if (!bridge) return;
    setConfirmRestore(false);
    setMsg({ tone: 'busy', text: 'Restoring…' });
    try {
      await persistence.flush();
      const r = await bridge.restoreBackup();
      if (!r.folder) {
        setMsg(null);
        return;
      }
      await persistence.reload();
      setMsg({ tone: r.problems.length ? 'error' : 'ok', text: describe(r, 'Restored') });
    } catch (error) {
      setMsg({ tone: 'error', text: errorMessage(error) });
    }
  };

  return (
    <section className="card">
      <header className="card-head"><h3>Backup and restore</h3></header>
      <div className="card-body form-stack">
        <p className="help">
          A backup is a folder with everything: songs and other items, services, templates, overlays, pictures and videos, Bibles and the song report log.
          Save it to a USB stick or another drive. To move KVLOG to a new computer, install KVLOG there and restore the folder.
          OBS settings are not included; enter the OBS password again on the new computer.
        </p>
        <div className="inline-row">
          <button type="button" className="btn btn-primary" disabled={!bridge || busy} onClick={() => void onExport()}>
            <HardDriveDownload size={14} aria-hidden="true" />
            Back up now
          </button>
          <button type="button" className={`btn${confirmRestore ? ' btn-danger' : ''}`} disabled={!bridge || busy}
            onClick={() => (confirmRestore ? void onRestore() : setConfirmRestore(true))}>
            <ArchiveRestore size={14} aria-hidden="true" />
            {confirmRestore ? 'Click again: replace everything with a backup' : 'Restore a backup…'}
          </button>
          {confirmRestore && <button type="button" className="btn" onClick={() => setConfirmRestore(false)}>Cancel</button>}
        </div>
        {confirmRestore && <p className="help">Restoring replaces your current library and services. A copy of the current data is kept next to the data file (…before-restore).</p>}
        {msg && (
          <p className={msg.tone === 'error' ? 'bad-text' : msg.tone === 'ok' ? 'ok-text' : 'help-inline'} role={msg.tone === 'error' ? 'alert' : 'status'}>
            {msg.tone === 'busy' && <Loader2 size={13} className="spin" aria-hidden="true" />} {msg.text}
          </p>
        )}
        <div className="daily-backups">
          <h4>Daily backups</h4>
          <p className="help">KVLOG saves a copy of your songs and services every day it is used, and keeps the last 14 days. Pictures and videos are only in the full backup above.</p>
          {daily.length === 0 ? (
            <p className="help">The first daily backup is made a few minutes after KVLOG starts.</p>
          ) : (
            <div className="inline-row">
              <select className="input" value={pick} onChange={(e) => { setPick(e.target.value); setConfirmDaily(false); }} aria-label="Daily backup">
                {daily.map((d) => (
                  <option key={d.name} value={d.name}>{dayLabel(d.name)} · {d.items} items, {d.plans} services</option>
                ))}
              </select>
              <button type="button" className={`btn btn-sm${confirmDaily ? ' btn-danger' : ''}`} disabled={busy || !pick}
                onClick={() => (confirmDaily ? void onRestoreDaily() : setConfirmDaily(true))}>
                {confirmDaily ? 'Click again to restore this day' : 'Restore this day'}
              </button>
              <button type="button" className="btn btn-sm" onClick={() => void bridge?.openAutoBackups()}>
                <FolderOpen size={13} aria-hidden="true" />
                Open folder
              </button>
            </div>
          )}
        </div>
        {msg?.folder && (
          <button type="button" className="btn btn-sm" onClick={() => void bridge?.openBackupFolder(msg.folder!)}>
            <FolderOpen size={13} aria-hidden="true" />
            Open the backup folder
          </button>
        )}
      </div>
    </section>
  );
}
