import { app, BrowserWindow, ipcMain, screen, session, shell, type IpcMainInvokeEvent, type WebPreferences } from 'electron';
import * as path from 'node:path';
import type { AppInfo, DisplayInfo } from '../shared/bridge-types';
import type { LoadResult, SaveResult, PresentationImportResult } from '../shared/data-types';
import type { MediaImportResult } from '../shared/data-types';
import type { OutputRole, OutputSnapshot, OutputsStatus } from '../shared/output-types';
import { dataFilePath, loadAppData, saveAppData } from './storage';
import { loadSettings } from './settings';
import { deleteMediaFile, findMissingMedia, handleMediaProtocol, importMedia, importPresentation, registerMediaScheme, savePresentationPages } from './media';
import { OutputManager, validateSnapshot } from './outputs';
import { deleteBible, downloadBible, getChapter, importBible, listBibles, renameBible } from './bible';
import type { BibleInfo } from '../shared/bible';
import { ObsService } from './obs';
import { LyricsServer, LYRICS_SOURCE_NAME } from './lyrics';
import type { LyricsSourceState, ObsState } from '../shared/obs-types';
import { importSongs } from './songImport';
import type { SongImportResult } from '../shared/song-import';
import { exportUsage, logSongUse, usageSummary } from './usage';
import { exportBackup, restoreBackup } from './backup';
import type { BackupResult, UsageSummaryRow } from '../shared/usage';
import { listAutoBackups, openAutoBackups, restoreAutoBackup, startAutoBackups } from './autoBackup';
import { checkForUpdates, getUpdateState, installUpdate, startUpdater } from './updater';
import type { AutoBackupInfo, UpdateState } from '../shared/system';

// Tests run KVLOG with its own empty data folder.
if (process.env.KVLOG_USER_DATA) app.setPath('userData', process.env.KVLOG_USER_DATA);

const DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;
const isDev = !app.isPackaged && typeof DEV_SERVER_URL === 'string' && DEV_SERVER_URL.length > 0;

// Every KVLOG window uses these settings. The renderer never gets direct Node.js access.
const SECURE_WEB_PREFERENCES: WebPreferences = {
  contextIsolation: true,
  nodeIntegration: false,
  sandbox: true,
  // Videos start on the projector without anyone clicking inside that window.
  autoplayPolicy: 'no-user-gesture-required',
  webSecurity: true,
  allowRunningInsecureContent: false,
  spellcheck: false
};

let mainWindow: BrowserWindow | null = null;
let outputs: OutputManager | null = null;
let obs: ObsService | null = null;
let lyrics: LyricsServer | null = null;
let closeAllowed = false;
let closeTimer: NodeJS.Timeout | null = null;
const CLOSE_TIMEOUT_MS = 3000;

/** Closes the main window for real, after the UI has saved (or the timeout passed). */
function finishClose(): void {
  if (closeTimer) clearTimeout(closeTimer);
  closeTimer = null;
  closeAllowed = true;
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.close();
}

function isAllowedRendererUrl(url: string): boolean {
  if (isDev && DEV_SERVER_URL) return url.startsWith(DEV_SERVER_URL);
  return url.startsWith('file://');
}

/** Rejects IPC calls that do not come from the KVLOG main window. */
function assertTrustedSender(event: IpcMainInvokeEvent): void {
  const frameUrl = event.senderFrame?.url ?? '';
  const fromMainWindow = mainWindow !== null && event.sender.id === mainWindow.webContents.id;
  if (!fromMainWindow || !isAllowedRendererUrl(frameUrl)) {
    throw new Error('Rejected IPC request from an untrusted sender.');
  }
}

/** Output windows (projector, stage) may only read the presentation state and close themselves. */
function assertOutputSender(event: IpcMainInvokeEvent): OutputRole {
  const frameUrl = event.senderFrame?.url ?? '';
  const role = outputs?.roleOf(event.sender.id) ?? null;
  if (!role || !isAllowedRendererUrl(frameUrl)) throw new Error('Rejected IPC request from an untrusted sender.');
  return role;
}

function parseRole(value: unknown): OutputRole {
  if (value !== 'projector' && value !== 'stage') throw new Error('Unknown output type.');
  return value;
}

function requireObs(): ObsService {
  if (!obs) throw new Error('The OBS connection is not ready yet.');
  return obs;
}

function requireLyrics(): LyricsServer {
  if (!lyrics) throw new Error('The lyric source is not ready yet.');
  return lyrics;
}

function requireOutputs(): OutputManager {
  if (!outputs) throw new Error('Output windows are not ready yet.');
  return outputs;
}

/** Loads the KVLOG interface into a window. Output windows use a #/output/<role> address. */
function loadRenderer(win: BrowserWindow, hash?: string): void {
  if (isDev && DEV_SERVER_URL) {
    void win.loadURL(hash ? `${DEV_SERVER_URL}#${hash}` : DEV_SERVER_URL);
  } else {
    void win.loadFile(path.join(__dirname, '..', '..', 'dist', 'index.html'), hash ? { hash } : undefined);
  }
}

function toDisplayInfo(display: Electron.Display, index: number, primaryId: number): DisplayInfo {
  return {
    id: display.id,
    index: index + 1,
    label: display.label && display.label.trim().length > 0 ? display.label : `Display ${index + 1}`,
    isPrimary: display.id === primaryId,
    bounds: { ...display.bounds },
    scaleFactor: display.scaleFactor,
    rotation: display.rotation,
    refreshRate: Math.round(display.displayFrequency ?? 0)
  };
}

function listDisplays(): DisplayInfo[] {
  const primaryId = screen.getPrimaryDisplay().id;
  return screen.getAllDisplays().map((d, i) => toDisplayInfo(d, i, primaryId));
}

/** Briefly shows a numbered badge in the centre of a display so the operator knows which is which. */
function showIdentifyBadge(display: Electron.Display, index: number): void {
  const size = 220;
  const badge = new BrowserWindow({
    x: Math.round(display.bounds.x + display.bounds.width / 2 - size / 2),
    y: Math.round(display.bounds.y + display.bounds.height / 2 - size / 2),
    width: size,
    height: size,
    frame: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    focusable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    show: false,
    backgroundColor: '#0b0d11',
    webPreferences: { ...SECURE_WEB_PREFERENCES }
  });
  const html = `<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'"></head>
<body style="margin:0;height:100vh;display:grid;place-items:center;background:#0b0d11;color:#e5e7ea;font:600 120px 'Segoe UI',system-ui,sans-serif;border:4px solid #4b8fe2;box-sizing:border-box">${index}</body></html>`;
  badge.once('ready-to-show', () => badge.showInactive());
  void badge.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
  setTimeout(() => {
    if (!badge.isDestroyed()) badge.close();
  }, 1800);
}

function registerIpcHandlers(): void {
  ipcMain.handle('app:get-info', (event): AppInfo => {
    assertTrustedSender(event);
    // Every KVLOG window is created with SECURE_WEB_PREFERENCES, so report those values.
    const prefs = SECURE_WEB_PREFERENCES;
    return {
      name: app.getName(),
      version: app.getVersion(),
      electron: process.versions.electron,
      chrome: process.versions.chrome,
      node: process.versions.node,
      platform: process.platform,
      arch: process.arch,
      isPackaged: app.isPackaged,
      security: {
        contextIsolation: prefs.contextIsolation === true,
        nodeIntegration: prefs.nodeIntegration === true,
        sandbox: prefs.sandbox === true,
        webSecurity: prefs.webSecurity !== false
      }
    };
  });

  ipcMain.handle('displays:list', (event): DisplayInfo[] => {
    assertTrustedSender(event);
    return listDisplays();
  });

  ipcMain.handle('displays:identify', (event, displayId: unknown): void => {
    assertTrustedSender(event);
    if (typeof displayId !== 'number' || !Number.isInteger(displayId)) {
      throw new Error('displayId must be an integer.');
    }
    const all = screen.getAllDisplays();
    const index = all.findIndex((d) => d.id === displayId);
    if (index === -1) throw new Error('That display is no longer connected.');
    showIdentifyBadge(all[index], index + 1);
  });

  ipcMain.handle('window:set-fullscreen', (event, on: unknown): void => {
    assertTrustedSender(event);
    if (typeof on !== 'boolean') throw new Error('Full-screen value must be true or false.');
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.setFullScreen(on);
  });

  ipcMain.handle('data:load', async (event): Promise<LoadResult> => {
    assertTrustedSender(event);
    return loadAppData();
  });

  ipcMain.handle('data:save', async (event, data: unknown): Promise<SaveResult> => {
    assertTrustedSender(event);
    return saveAppData(data);
  });

  // The path is decided here in the main process; the UI cannot choose which file is shown.
  ipcMain.handle('data:reveal', (event): void => {
    assertTrustedSender(event);
    shell.showItemInFolder(dataFilePath());
  });

  // ----- Projector and stage display -----
  ipcMain.handle('outputs:status', (event): OutputsStatus => {
    assertTrustedSender(event);
    return requireOutputs().status();
  });
  ipcMain.handle('outputs:open', (event, role: unknown): void => {
    assertTrustedSender(event);
    requireOutputs().open(parseRole(role));
  });
  ipcMain.handle('outputs:close', (event, role: unknown): void => {
    assertTrustedSender(event);
    requireOutputs().close(parseRole(role));
  });
  ipcMain.handle('outputs:assign', (event, role: unknown, displayId: unknown): void => {
    assertTrustedSender(event);
    if (displayId !== null && (typeof displayId !== 'number' || !Number.isInteger(displayId))) {
      throw new Error('displayId must be an integer or null.');
    }
    requireOutputs().assign(parseRole(role), displayId);
  });
  ipcMain.handle('output:publish', (event, snapshot: unknown): void => {
    assertTrustedSender(event);
    const valid = validateSnapshot(snapshot);
    requireOutputs().publish(valid);
    lyrics?.publish(valid);
  });
  ipcMain.handle('output:get-state', (event): OutputSnapshot | null => {
    assertOutputSender(event);
    return requireOutputs().getSnapshot();
  });
  ipcMain.handle('output:close-self', (event): void => {
    const role = assertOutputSender(event);
    requireOutputs().close(role);
  });

  // ----- OBS Studio -----
  ipcMain.handle('obs:get-state', (event): ObsState => {
    assertTrustedSender(event);
    return requireObs().getState();
  });
  ipcMain.handle('obs:save-settings', (event, input: unknown): ObsState => {
    assertTrustedSender(event);
    return requireObs().saveSettings(input);
  });
  ipcMain.handle('obs:connect', async (event): Promise<void> => {
    assertTrustedSender(event);
    await requireObs().connect();
  });
  ipcMain.handle('obs:disconnect', async (event): Promise<void> => {
    assertTrustedSender(event);
    await requireObs().disconnect();
  });
  ipcMain.handle('obs:set-program-scene', async (event, sceneName: unknown): Promise<void> => {
    assertTrustedSender(event);
    await requireObs().setProgramScene(sceneName);
  });
  ipcMain.handle('obs:output', async (event, action: unknown): Promise<void> => {
    assertTrustedSender(event);
    await requireObs().controlOutput(action);
  });
  ipcMain.handle('obs:set-muted', async (event, inputName: unknown, muted: unknown): Promise<void> => {
    assertTrustedSender(event);
    await requireObs().setInputMuted(inputName, muted);
  });
  ipcMain.handle('obs:set-volume', async (event, inputName: unknown, volumeDb: unknown): Promise<void> => {
    assertTrustedSender(event);
    await requireObs().setInputVolume(inputName, volumeDb);
  });
  ipcMain.handle('obs:screenshot', async (event, sceneName: unknown, width: unknown): Promise<string | null> => {
    assertTrustedSender(event);
    return requireObs().getScreenshot(sceneName, width);
  });
  ipcMain.handle('obs:add-lyrics-source', async (event): Promise<string> => {
    assertTrustedSender(event);
    const server = requireLyrics();
    if (!server.getState().running) throw new Error('Turn on the lyric source first.');
    return requireObs().addBrowserSource(LYRICS_SOURCE_NAME, server.url());
  });

  // ----- Lyric browser source -----
  ipcMain.handle('lyrics:get-state', (event): LyricsSourceState => {
    assertTrustedSender(event);
    return requireLyrics().getState();
  });
  ipcMain.handle('lyrics:save-settings', async (event, input: unknown): Promise<LyricsSourceState> => {
    assertTrustedSender(event);
    return requireLyrics().saveSettings(input);
  });

  // ----- Media Library -----
  ipcMain.handle('media:import', async (event): Promise<MediaImportResult> => {
    assertTrustedSender(event);
    return importMedia(mainWindow);
  });
  ipcMain.handle('media:import-presentation', async (event): Promise<PresentationImportResult> => {
    assertTrustedSender(event);
    return importPresentation(mainWindow);
  });
  ipcMain.handle('media:save-pages', async (event, pages: unknown): Promise<string[]> => {
    assertTrustedSender(event);
    return savePresentationPages(pages);
  });
  // ----- Bible -----
  ipcMain.handle('bible:list', async (event): Promise<BibleInfo[]> => {
    assertTrustedSender(event);
    return listBibles();
  });
  ipcMain.handle('bible:download', async (event, key: unknown): Promise<BibleInfo> => {
    assertTrustedSender(event);
    return downloadBible(key);
  });
  ipcMain.handle('bible:import', async (event): Promise<BibleInfo | null> => {
    assertTrustedSender(event);
    return importBible(mainWindow);
  });
  ipcMain.handle('bible:rename', async (event, id: unknown, abbrev: unknown, name: unknown): Promise<BibleInfo> => {
    assertTrustedSender(event);
    return renameBible(id, abbrev, name);
  });
  ipcMain.handle('bible:delete', async (event, id: unknown): Promise<void> => {
    assertTrustedSender(event);
    await deleteBible(id);
  });
  ipcMain.handle('bible:chapter', async (event, id: unknown, book: unknown, chapter: unknown): Promise<string[]> => {
    assertTrustedSender(event);
    return getChapter(id, book, chapter);
  });
  ipcMain.handle('media:find-missing', async (event, fileNames: unknown): Promise<string[]> => {
    assertTrustedSender(event);
    return findMissingMedia(fileNames);
  });
  ipcMain.handle('media:delete', async (event, fileName: unknown): Promise<void> => {
    assertTrustedSender(event);
    await deleteMediaFile(fileName);
  });

  // ----- Songs, usage reports, backups -----
  ipcMain.handle('songs:import', async (event, mode: unknown): Promise<SongImportResult> => {
    assertTrustedSender(event);
    return importSongs(mainWindow, mode);
  });
  ipcMain.handle('usage:log', async (event, entry: unknown): Promise<boolean> => {
    assertTrustedSender(event);
    return logSongUse(entry);
  });
  ipcMain.handle('usage:summary', async (event, from: unknown, to: unknown): Promise<UsageSummaryRow[]> => {
    assertTrustedSender(event);
    return usageSummary(from, to);
  });
  ipcMain.handle('usage:export', async (event, from: unknown, to: unknown, licence: unknown): Promise<string | null> => {
    assertTrustedSender(event);
    return exportUsage(mainWindow, from, to, licence);
  });
  ipcMain.handle('backup:export', async (event): Promise<BackupResult> => {
    assertTrustedSender(event);
    return exportBackup(mainWindow);
  });
  ipcMain.handle('backup:restore', async (event): Promise<BackupResult> => {
    assertTrustedSender(event);
    return restoreBackup(mainWindow);
  });
  ipcMain.handle('backup:reveal', (event, folder: unknown): void => {
    assertTrustedSender(event);
    if (typeof folder === 'string' && folder.length < 1000 && path.basename(folder).startsWith('KVLOG backup')) void shell.openPath(folder);
  });

  ipcMain.handle('autobackup:list', async (event): Promise<AutoBackupInfo[]> => {
    assertTrustedSender(event);
    return listAutoBackups();
  });
  ipcMain.handle('autobackup:restore', async (event, name: unknown): Promise<AutoBackupInfo> => {
    assertTrustedSender(event);
    return restoreAutoBackup(name);
  });
  ipcMain.handle('autobackup:open', async (event): Promise<void> => {
    assertTrustedSender(event);
    await openAutoBackups();
  });

  // ----- Updates -----
  ipcMain.handle('update:get-state', (event): UpdateState => {
    assertTrustedSender(event);
    return getUpdateState();
  });
  ipcMain.handle('update:check', async (event): Promise<void> => {
    assertTrustedSender(event);
    await checkForUpdates();
  });
  // The UI saves first, then calls this.
  ipcMain.handle('update:install', (event): void => {
    assertTrustedSender(event);
    closeAllowed = true;
    outputs?.closeAll();
    installUpdate();
  });

  ipcMain.handle('app:ready-to-close', (event): void => {
    assertTrustedSender(event);
    finishClose();
  });
}

function watchDisplays(): void {
  const notify = () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('displays:changed', listDisplays());
    }
  };
  const plugged = () => {
    notify();
    outputs?.onDisplaysChanged();
  };
  screen.on('display-added', plugged);
  screen.on('display-removed', plugged);
  screen.on('display-metrics-changed', notify);
}

function installSecurityPolicies(): void {
  if (isDev) {
    // Development only: Vite's hot reload needs an inline script and a websocket.
    const devCsp =
      "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: kvlog-media:; media-src 'self' blob: kvlog-media:; font-src 'self' data:; connect-src 'self' ws://127.0.0.1:5173 http://127.0.0.1:5173; object-src 'none'";
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
      callback({ responseHeaders: { ...details.responseHeaders, 'Content-Security-Policy': [devCsp] } });
    });
  }
  // KVLOG does not need camera, microphone, notifications etc. in the renderer. OBS handles capture.
  session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
}

function createMainWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1600,
    height: 960,
    minWidth: 1200,
    minHeight: 720,
    title: 'KVLOG',
    backgroundColor: '#0b0d11',
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      ...SECURE_WEB_PREFERENCES,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  closeAllowed = false;
  mainWindow.once('ready-to-show', () => mainWindow?.show());

  // Give the UI a moment to save unsaved changes before the window closes.
  mainWindow.on('close', (event) => {
    if (closeAllowed || !mainWindow) return;
    event.preventDefault();
    if (closeTimer) return;
    mainWindow.webContents.send('app:before-close');
    closeTimer = setTimeout(finishClose, CLOSE_TIMEOUT_MS);
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    outputs?.closeAll();
    void obs?.disconnect();
  });

  loadRenderer(mainWindow);
}

// Lock down every web page Electron creates: no pop-ups, no navigation away, no <webview>.
app.on('web-contents-created', (_event, contents) => {
  contents.setWindowOpenHandler(() => ({ action: 'deny' }));
  contents.on('will-navigate', (event, url) => {
    if (!isAllowedRendererUrl(url)) event.preventDefault();
  });
  contents.on('will-attach-webview', (event) => event.preventDefault());
});

registerMediaScheme();

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });

  app.whenReady().then(() => {
    app.setAppUserModelId('com.kvlog.app');
    installSecurityPolicies();
    loadSettings();
    handleMediaProtocol();
    outputs = new OutputManager({
      webPreferences: { ...SECURE_WEB_PREFERENCES, preload: path.join(__dirname, 'preload.js') },
      load: (win, role) => loadRenderer(win, `/output/${role}`),
      mainWindow: () => mainWindow
    });
    obs = new ObsService(
      (state) => {
        if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('obs:state', state);
      },
      (levels) => {
        if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('obs:levels', levels);
      }
    );
    lyrics = new LyricsServer((state) => {
      if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('lyrics:state', state);
    });
    registerIpcHandlers();
    createMainWindow();
    obs.start();
    void lyrics.start();
    watchDisplays();
    startAutoBackups();
    startUpdater((state) => {
      if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('update:state', state);
    });

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
    });
  });

  app.on('window-all-closed', () => {
    void lyrics?.stop();
    if (process.platform !== 'darwin') app.quit();
  });
}
