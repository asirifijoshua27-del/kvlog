// Types for the OBS Studio connection. Type-only.

export type ObsConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

export type ObsErrorCode =
  | 'not-reachable'
  | 'auth-failed'
  | 'auth-required'
  | 'timeout'
  | 'unsupported-version'
  | 'closed'
  | 'request-failed'
  | 'invalid-settings'
  | 'unknown';

export interface ObsError {
  code: ObsErrorCode;
  message: string;
}

/** What the UI may know about the saved settings. The password itself never leaves the main process. */
export interface ObsSettingsView {
  host: string;
  port: number;
  hasPassword: boolean;
  autoConnect: boolean;
  /** False if Windows cannot encrypt the password; it is then kept only until KVLOG closes. */
  canStorePassword: boolean;
}

export interface ObsSettingsInput {
  host: string;
  port: number;
  /** null keeps the saved password, '' removes it, any other text replaces it. */
  password: string | null;
  autoConnect: boolean;
}

export interface ObsScene {
  name: string;
}

export interface ObsSource {
  id: number;
  name: string;
  kind: string;
  enabled: boolean;
  isGroup: boolean;
}

export interface ObsOutputStatus {
  active: boolean;
  /** Stream: reconnecting. Record: paused. */
  flag: boolean;
  timecode: string;
}

export type ObsOutputAction = 'start-stream' | 'stop-stream' | 'start-record' | 'stop-record' | 'pause-record' | 'resume-record';

export interface ObsAudioInput {
  name: string;
  muted: boolean;
  /** Fader position in dB (0 = full, -100 = silent). */
  volumeDb: number;
}

/** Live audio level per input in dBFS (-60 … 0), sent about 10 times a second. */
export type ObsAudioLevels = Record<string, number>;

/** The result of the last stream/record action, or an unexpected stop reported by OBS. */
export interface ObsNotice {
  tone: 'ok' | 'error';
  message: string;
  /** ISO time. */
  at: string;
}

export interface ObsState {
  settings: ObsSettingsView;
  connection: ObsConnectionState;
  error: ObsError | null;
  obsVersion: string | null;
  websocketVersion: string | null;
  /** Scenes in the order OBS shows them (top first). */
  scenes: ObsScene[];
  programScene: string | null;
  previewScene: string | null;
  studioMode: boolean;
  /** Sources in the current program scene, top first. */
  sources: ObsSource[];
  stream: ObsOutputStatus | null;
  record: ObsOutputStatus | null;
  /** Inputs that have audio (mic, desktop audio, media), in OBS order. */
  audio: ObsAudioInput[];
  outputNotice: ObsNotice | null;
  /** True while a start/stop request is waiting for OBS to confirm. */
  outputPending: 'stream' | 'record' | null;
  /** When the next automatic reconnect attempt happens (ISO time), if any. */
  nextRetryAt: string | null;
}

// ----- Lyric browser source -----

/** full: OBS shows exactly what the projector shows. overlay: song/scripture text over the camera; pictures, videos and presentations full screen. */
export type ObsOutputMode = 'full' | 'overlay';

export interface LyricsSourceSettings {
  enabled: boolean;
  port: number;
  mode: ObsOutputMode;
}

export interface LyricsSourceState extends LyricsSourceSettings {
  running: boolean;
  /** The address to paste into an OBS Browser Source. */
  url: string;
  error: string | null;
  /** How many browser sources are showing the page right now. */
  clients: number;
}
