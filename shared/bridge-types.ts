// Types shared between the Electron main process, the preload bridge and the React UI.
// Type-only: nothing in this file runs at runtime.
import type { AppData, LoadResult, MediaImportResult, SaveResult, PresentationImportResult } from './data-types';
import type { OutputRole, OutputSnapshot, OutputsStatus } from './output-types';
import type { BibleInfo } from './bible';
import type { SongImportMode, SongImportResult } from './song-import';
import type { BackupResult, UsageEntry, UsageSummaryRow } from './usage';
import type { AutoBackupInfo, UpdateState } from './system';
import type { LyricsSourceSettings, LyricsSourceState, ObsOutputAction, ObsSettingsInput, ObsState, ObsAudioLevels } from './obs-types';

export interface SecurityReport {
  contextIsolation: boolean;
  nodeIntegration: boolean;
  sandbox: boolean;
  webSecurity: boolean;
}

export interface AppInfo {
  name: string;
  version: string;
  electron: string;
  chrome: string;
  node: string;
  platform: string;
  arch: string;
  isPackaged: boolean;
  security: SecurityReport;
}

export interface DisplayBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DisplayInfo {
  id: number;
  index: number;
  label: string;
  isPrimary: boolean;
  bounds: DisplayBounds;
  scaleFactor: number;
  rotation: number;
  refreshRate: number;
}

/** The only API the renderer can use. Exposed as window.kvlog by electron/preload.ts. */
export interface KvlogBridge {
  getAppInfo(): Promise<AppInfo>;
  listDisplays(): Promise<DisplayInfo[]>;
  identifyDisplay(displayId: number): Promise<void>;
  onDisplaysChanged(callback: (displays: DisplayInfo[]) => void): () => void;
  /** Puts the main KVLOG window in or out of full screen (used by the presentation output). */
  setFullScreen(on: boolean): Promise<void>;

  /** Reads the saved library and service plans. */
  loadData(): Promise<LoadResult>;
  /** Validates and saves the library and service plans. */
  saveData(data: AppData): Promise<SaveResult>;
  /** Opens File Explorer with the data file selected. */
  revealDataFile(): Promise<void>;
  /** Called when the window is about to close, so unsaved changes can be written first. */
  onBeforeClose(callback: () => void): () => void;
  /** Tells the main process it may now close the window. */
  readyToClose(): Promise<void>;

  // Projector and stage display (main window)
  getOutputsStatus(): Promise<OutputsStatus>;
  openOutput(role: OutputRole): Promise<void>;
  closeOutput(role: OutputRole): Promise<void>;
  /** Choose the display for an output, or null for a normal window. */
  assignOutput(role: OutputRole, displayId: number | null): Promise<void>;
  onOutputsChanged(callback: (status: OutputsStatus) => void): () => void;
  publishOutput(snapshot: OutputSnapshot): Promise<void>;

  // Output windows only
  getOutputState(): Promise<OutputSnapshot | null>;
  onOutputState(callback: (snapshot: OutputSnapshot) => void): () => void;
  closeSelf(): Promise<void>;

  // Bible
  listBibles(): Promise<BibleInfo[]>;
  /** Downloads a public-domain translation (key from BIBLE_DOWNLOADS). */
  downloadBible(key: string): Promise<BibleInfo>;
  /** Opens a file dialog. Null when cancelled. */
  importBible(): Promise<BibleInfo | null>;
  renameBible(id: string, abbrev: string, name: string): Promise<BibleInfo>;
  deleteBible(id: string): Promise<void>;
  /** Verse texts of one chapter (index 0 = verse 1). */
  getBibleChapter(id: string, book: number, chapter: number): Promise<string[]>;

  // Media Library
  importMedia(): Promise<MediaImportResult>;
  /** Opens a file dialog. PowerPoint files are converted here; PDFs come back as bytes for the UI to render. */
  importPresentation(): Promise<PresentationImportResult>;
  /** Saves PNG slide images and returns their media file names. */
  savePresentationPages(pages: Uint8Array[]): Promise<string[]>;
  findMissingMedia(fileNames: string[]): Promise<string[]>;
  deleteMedia(fileName: string): Promise<void>;

  // OBS Studio (the password is sent once when saved and never returned)
  getObsState(): Promise<ObsState>;
  saveObsSettings(input: ObsSettingsInput): Promise<ObsState>;
  connectObs(): Promise<void>;
  disconnectObs(): Promise<void>;
  setObsProgramScene(sceneName: string): Promise<void>;
  onObsState(callback: (state: ObsState) => void): () => void;
  /** Start/stop streaming or recording. Resolves when OBS accepts the request; the result arrives in ObsState.outputNotice. */
  obsOutput(action: ObsOutputAction): Promise<void>;
  setObsInputMuted(inputName: string, muted: boolean): Promise<void>;
  /** Sets an OBS fader, in dB (0 = full). */
  setObsInputVolume(inputName: string, volumeDb: number): Promise<void>;
  /** Live audio levels from OBS, about 10 times a second. */
  onObsLevels(callback: (levels: ObsAudioLevels) => void): () => void;
  /** Adds the lyric Browser Source to the current OBS scene. Returns a message describing what was done. */
  addLyricsSourceToObs(): Promise<string>;
  /** JPEG data URL of a scene as OBS renders it, or null. */
  getObsScreenshot(sceneName: string, width?: number): Promise<string | null>;

  // Lyric browser source
  getLyricsState(): Promise<LyricsSourceState>;
  saveLyricsSettings(input: LyricsSourceSettings): Promise<LyricsSourceState>;
  onLyricsState(callback: (state: LyricsSourceState) => void): () => void;

  // Songs
  /** Opens a file (or folder) dialog and reads every song found. Nothing is saved. */
  importSongs(mode: SongImportMode): Promise<SongImportResult>;

  // Song usage (licence reports)
  /** Records a song shown. False when it was already counted in the last 4 hours. */
  logSongUse(entry: Omit<UsageEntry, 'at'>): Promise<boolean>;
  /** Dates are local YYYY-MM-DD, '' = no limit. */
  getUsageSummary(from: string, to: string): Promise<UsageSummaryRow[]>;
  /** Saves a CSV report. Returns the file path, or null when cancelled. */
  exportUsageReport(from: string, to: string, licence: string): Promise<string | null>;

  // Backup
  exportBackup(): Promise<BackupResult>;
  /** Restores a backup folder. Reload data afterwards. */
  restoreBackup(): Promise<BackupResult>;
  openBackupFolder(folder: string): Promise<void>;
  /** Daily automatic backups, newest first. */
  listAutoBackups(): Promise<AutoBackupInfo[]>;
  /** Puts a daily backup back. Reload data afterwards. */
  restoreAutoBackup(name: string): Promise<AutoBackupInfo>;
  openAutoBackups(): Promise<void>;

  // Updates
  getUpdateState(): Promise<UpdateState>;
  checkForUpdates(): Promise<void>;
  /** Closes KVLOG and installs the downloaded update. Save first. */
  installUpdate(): Promise<void>;
  onUpdateState(callback: (state: UpdateState) => void): () => void;
}
