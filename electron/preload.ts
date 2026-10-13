// The preload script is the ONLY bridge between the UI and the operating system.
// It runs sandboxed, so it may only require('electron'). Keep this file small and explicit.
// Only `import type` is allowed from ../shared here.
import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import type { DisplayInfo, KvlogBridge } from '../shared/bridge-types';
import type { AppData } from '../shared/data-types';
import type { OutputRole, OutputSnapshot, OutputsStatus } from '../shared/output-types';
import type { SongImportMode } from '../shared/song-import';
import type { UsageEntry } from '../shared/usage';
import type { UpdateState } from '../shared/system';
import type { LyricsSourceSettings, LyricsSourceState, ObsOutputAction, ObsSettingsInput, ObsState, ObsAudioLevels } from '../shared/obs-types';

/** Subscribes to a main-process event and returns an unsubscribe function. */
function listen<T>(channel: string, callback: (value: T) => void): () => void {
  const listener = (_event: IpcRendererEvent, value: T) => callback(value);
  ipcRenderer.on(channel, listener);
  return () => {
    ipcRenderer.removeListener(channel, listener);
  };
}

const bridge: KvlogBridge = {
  getAppInfo: () => ipcRenderer.invoke('app:get-info'),
  listDisplays: () => ipcRenderer.invoke('displays:list'),
  identifyDisplay: (displayId: number) => ipcRenderer.invoke('displays:identify', displayId),
  onDisplaysChanged: (callback) => {
    const listener = (_event: IpcRendererEvent, displays: DisplayInfo[]) => callback(displays);
    ipcRenderer.on('displays:changed', listener);
    return () => {
      ipcRenderer.removeListener('displays:changed', listener);
    };
  },
  setFullScreen: (on: boolean) => ipcRenderer.invoke('window:set-fullscreen', on),

  loadData: () => ipcRenderer.invoke('data:load'),
  saveData: (data: AppData) => ipcRenderer.invoke('data:save', data),
  revealDataFile: () => ipcRenderer.invoke('data:reveal'),
  onBeforeClose: (callback) => {
    const listener = () => callback();
    ipcRenderer.on('app:before-close', listener);
    return () => {
      ipcRenderer.removeListener('app:before-close', listener);
    };
  },
  readyToClose: () => ipcRenderer.invoke('app:ready-to-close'),

  getOutputsStatus: () => ipcRenderer.invoke('outputs:status'),
  openOutput: (role: OutputRole) => ipcRenderer.invoke('outputs:open', role),
  closeOutput: (role: OutputRole) => ipcRenderer.invoke('outputs:close', role),
  assignOutput: (role: OutputRole, displayId: number | null) => ipcRenderer.invoke('outputs:assign', role, displayId),
  onOutputsChanged: (callback) => listen<OutputsStatus>('outputs:changed', callback),
  publishOutput: (snapshot: OutputSnapshot) => ipcRenderer.invoke('output:publish', snapshot),

  getOutputState: () => ipcRenderer.invoke('output:get-state'),
  onOutputState: (callback) => listen<OutputSnapshot>('output:state', callback),
  closeSelf: () => ipcRenderer.invoke('output:close-self'),

  listBibles: () => ipcRenderer.invoke('bible:list'),
  downloadBible: (key: string) => ipcRenderer.invoke('bible:download', key),
  importBible: () => ipcRenderer.invoke('bible:import'),
  renameBible: (id: string, abbrev: string, name: string) => ipcRenderer.invoke('bible:rename', id, abbrev, name),
  deleteBible: (id: string) => ipcRenderer.invoke('bible:delete', id),
  getBibleChapter: (id: string, book: number, chapter: number) => ipcRenderer.invoke('bible:chapter', id, book, chapter),

  importMedia: () => ipcRenderer.invoke('media:import'),
  importPresentation: () => ipcRenderer.invoke('media:import-presentation'),
  savePresentationPages: (pages: Uint8Array[]) => ipcRenderer.invoke('media:save-pages', pages),
  findMissingMedia: (fileNames: string[]) => ipcRenderer.invoke('media:find-missing', fileNames),
  deleteMedia: (fileName: string) => ipcRenderer.invoke('media:delete', fileName),

  getObsState: () => ipcRenderer.invoke('obs:get-state'),
  saveObsSettings: (input: ObsSettingsInput) => ipcRenderer.invoke('obs:save-settings', input),
  connectObs: () => ipcRenderer.invoke('obs:connect'),
  disconnectObs: () => ipcRenderer.invoke('obs:disconnect'),
  setObsProgramScene: (sceneName: string) => ipcRenderer.invoke('obs:set-program-scene', sceneName),
  onObsState: (callback) => listen<ObsState>('obs:state', callback),
  obsOutput: (action: ObsOutputAction) => ipcRenderer.invoke('obs:output', action),
  setObsInputMuted: (inputName: string, muted: boolean) => ipcRenderer.invoke('obs:set-muted', inputName, muted),
  setObsInputVolume: (inputName: string, volumeDb: number) => ipcRenderer.invoke('obs:set-volume', inputName, volumeDb),
  onObsLevels: (callback) => listen<ObsAudioLevels>('obs:levels', callback),
  addLyricsSourceToObs: () => ipcRenderer.invoke('obs:add-lyrics-source'),
  getObsScreenshot: (sceneName: string, width?: number) => ipcRenderer.invoke('obs:screenshot', sceneName, width),

  getLyricsState: () => ipcRenderer.invoke('lyrics:get-state'),
  saveLyricsSettings: (input: LyricsSourceSettings) => ipcRenderer.invoke('lyrics:save-settings', input),
  onLyricsState: (callback) => listen<LyricsSourceState>('lyrics:state', callback),

  importSongs: (mode: SongImportMode) => ipcRenderer.invoke('songs:import', mode),
  logSongUse: (entry: Omit<UsageEntry, 'at'>) => ipcRenderer.invoke('usage:log', entry),
  getUsageSummary: (from: string, to: string) => ipcRenderer.invoke('usage:summary', from, to),
  exportUsageReport: (from: string, to: string, licence: string) => ipcRenderer.invoke('usage:export', from, to, licence),
  exportBackup: () => ipcRenderer.invoke('backup:export'),
  restoreBackup: () => ipcRenderer.invoke('backup:restore'),
  openBackupFolder: (folder: string) => ipcRenderer.invoke('backup:reveal', folder),
  listAutoBackups: () => ipcRenderer.invoke('autobackup:list'),
  restoreAutoBackup: (name: string) => ipcRenderer.invoke('autobackup:restore', name),
  openAutoBackups: () => ipcRenderer.invoke('autobackup:open'),

  getUpdateState: () => ipcRenderer.invoke('update:get-state'),
  checkForUpdates: () => ipcRenderer.invoke('update:check'),
  installUpdate: () => ipcRenderer.invoke('update:install'),
  onUpdateState: (callback) => listen<UpdateState>('update:state', callback)
};

contextBridge.exposeInMainWorld('kvlog', bridge);
