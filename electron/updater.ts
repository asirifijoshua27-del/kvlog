// Automatic updates from GitHub Releases (electron-updater). Updates download in the background
// and install when KVLOG closes, or straight away when the operator clicks "Restart and update".
// Never restarts by itself: a service may be running.
import { app } from 'electron';
import { autoUpdater } from 'electron-updater';
import type { UpdateState } from '../shared/system';

const CHECK_EVERY_MS = 6 * 60 * 60 * 1000;
let state: UpdateState = { status: 'disabled', current: '', version: null, percent: 0, message: null, checkedAt: null };
let notify: (s: UpdateState) => void = () => undefined;

function update(changes: Partial<UpdateState>): void {
  state = { ...state, ...changes };
  notify(state);
}

export function getUpdateState(): UpdateState {
  return state;
}

export function startUpdater(onChange: (s: UpdateState) => void): void {
  notify = onChange;
  state = { ...state, current: app.getVersion() };
  // Development copies (npm run dev) are not updated.
  if (!app.isPackaged || process.env.KVLOG_NO_UPDATES === '1') return;
  update({ status: 'idle' });
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on('checking-for-update', () => update({ status: 'checking', message: null }));
  autoUpdater.on('update-not-available', () => update({ status: 'none', checkedAt: new Date().toISOString() }));
  autoUpdater.on('update-available', (info) => update({ status: 'downloading', version: info.version, percent: 0, checkedAt: new Date().toISOString() }));
  autoUpdater.on('download-progress', (p) => update({ status: 'downloading', percent: Math.round(p.percent) }));
  autoUpdater.on('update-downloaded', (info) => update({ status: 'ready', version: info.version, percent: 100 }));
  autoUpdater.on('error', (error) => {
    const offline = /ENOTFOUND|ETIMEDOUT|ECONNREFUSED|EAI_AGAIN|net::/i.test(String(error?.message));
    update({ status: 'error', message: offline ? 'No internet connection. KVLOG will try again later.' : 'The update check failed. KVLOG will try again later.' });
  });
  setTimeout(() => void checkForUpdates(), 15000);
  setInterval(() => void checkForUpdates(), CHECK_EVERY_MS);
}

export async function checkForUpdates(): Promise<void> {
  if (state.status === 'disabled' || state.status === 'downloading' || state.status === 'ready') return;
  try {
    await autoUpdater.checkForUpdates();
  } catch {
    // Reported through the 'error' event.
  }
}

/** Closes KVLOG and installs the downloaded update. Call only after the UI has saved. */
export function installUpdate(): void {
  if (state.status !== 'ready') throw new Error('No update is ready to install.');
  autoUpdater.quitAndInstall(true, true);
}
