// Connection to OBS Studio through its official WebSocket API (obs-websocket 5.x, built into
// OBS 28 and newer). Runs in the main process so the password never reaches the UI.
// Everything shown in KVLOG comes from OBS itself. Nothing here is simulated.
import obsModule = require('obs-websocket-js');
import type { ObsAudioInput, ObsAudioLevels, ObsConnectionState, ObsError, ObsErrorCode, ObsNotice, ObsOutputAction, ObsOutputStatus, ObsScene, ObsSettingsInput, ObsSource, ObsState } from '../shared/obs-types';
import { canEncrypt, getObsPassword, getObsSettings, hasObsPassword, isValidHost, isValidPort, setObsSettings } from './settings';

const OBSWebSocket = obsModule.default;
type ObsClient = InstanceType<typeof OBSWebSocket>;
type Data = Record<string, unknown>;

const CONNECT_TIMEOUT_MS = 8000;
const POLL_MS = 2000;
const MIN_RETRY_MS = 2000;
const MAX_RETRY_MS = 30000;
const MAX_PASSWORD = 256;
const CONFIRM_MS = 15000;
const MAX_AUDIO_INPUTS = 64;
const LEVELS_MS = 100;
// obs-websocket event groups: everything normal (0x7FF) plus the high-volume InputVolumeMeters (1 << 16).
const EVENT_SUBSCRIPTIONS = 0x7ff | (1 << 16);

type OutputKind = 'stream' | 'record';

const OUTPUT_REQUESTS: Record<ObsOutputAction, string> = {
  'start-stream': 'StartStream',
  'stop-stream': 'StopStream',
  'start-record': 'StartRecord',
  'stop-record': 'StopRecord',
  'pause-record': 'PauseRecord',
  'resume-record': 'ResumeRecord'
};

class TimeoutError extends Error {}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new TimeoutError('timeout')), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

const str = (v: unknown): string | null => (typeof v === 'string' ? v : null);
const num = (v: unknown): number => (typeof v === 'number' ? v : 0);

function errorCode(error: unknown): number | null {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === 'number' ? code : null;
}

function errorText(error: unknown): string {
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  return message.slice(0, 200);
}

function classify(error: unknown, address: string): ObsError {
  if (error instanceof TimeoutError) {
    return { code: 'timeout', message: `OBS at ${address} did not answer within ${CONNECT_TIMEOUT_MS / 1000} seconds.` };
  }
  const code = errorCode(error);
  const text = errorText(error);
  if (code === 4009) {
    return { code: 'auth-failed', message: 'OBS rejected the password. Copy it again from OBS → Tools → WebSocket Server Settings → Show Connect Info.' };
  }
  if (/password/i.test(text)) {
    return { code: 'auth-required', message: 'OBS requires a password. Enter it below and save.' };
  }
  if (code === 4010) {
    return { code: 'unsupported-version', message: 'This OBS version is not supported. Use OBS Studio 28 or newer.' };
  }
  if (code === 1006 || code === -1 || /ECONNREFUSED|ENOTFOUND|EHOSTUNREACH|ETIMEDOUT|ECONNRESET/i.test(text)) {
    return { code: 'not-reachable', message: `Could not reach OBS at ${address}. Check that OBS is running and its WebSocket server is enabled.` };
  }
  return { code: 'unknown', message: `Could not connect to OBS${text ? `: ${text}` : '.'}` };
}

function requestMessage(error: unknown): string {
  const code = errorCode(error);
  if (code === 204) return 'This OBS version does not support that request.';
  if (code === 600) return 'That item no longer exists in OBS.';
  if (code === 500) return 'OBS says this is already running.';
  if (code === 501) return 'OBS says this is not running.';
  if (code === 502) return 'The recording is paused. Resume it first.';
  if (code === 503) return 'The recording is not paused.';
  if (code === 601) return 'OBS already has a source with that name that is not a Browser Source. Rename it in OBS and try again.';
  return `OBS could not complete the request${errorText(error) ? `: ${errorText(error)}` : '.'}`;
}

const RETRYABLE: ObsErrorCode[] = ['not-reachable', 'timeout', 'closed'];

type LiveState = Omit<ObsState, 'settings'>;

const EMPTY: LiveState = {
  connection: 'disconnected',
  error: null,
  obsVersion: null,
  websocketVersion: null,
  scenes: [],
  programScene: null,
  previewScene: null,
  studioMode: false,
  sources: [],
  stream: null,
  record: null,
  audio: [],
  outputNotice: null,
  outputPending: null,
  nextRetryAt: null
};

export class ObsService {
  private obs: ObsClient | null = null;
  private generation = 0;
  private live: LiveState = { ...EMPTY };
  private wantConnected = false;
  private retryDelay = MIN_RETRY_MS;
  private retryTimer: NodeJS.Timeout | null = null;
  private pollTimer: NodeJS.Timeout | null = null;
  private refreshTimer: NodeJS.Timeout | null = null;
  private confirmTimer: NodeJS.Timeout | null = null;
  /** Which outputs KVLOG asked OBS to stop, so a stop we asked for is not reported as unexpected. */
  private stopRequested: Record<OutputKind, boolean> = { stream: false, record: false };

  private levels: ObsAudioLevels = {};
  private lastLevelsAt = 0;

  constructor(
    private readonly notify: (state: ObsState) => void,
    private readonly notifyLevels: (levels: ObsAudioLevels) => void = () => undefined
  ) {}

  getState(): ObsState {
    const s = getObsSettings();
    return {
      ...this.live,
      settings: { host: s.host, port: s.port, autoConnect: s.autoConnect, hasPassword: hasObsPassword(), canStorePassword: canEncrypt() }
    };
  }

  /** Called once at start-up. */
  start(): void {
    if (getObsSettings().autoConnect) void this.connect();
    else this.emit();
  }

  async connect(): Promise<void> {
    this.wantConnected = true;
    this.clearRetry();
    this.retryDelay = MIN_RETRY_MS;
    await this.open(false);
  }

  async disconnect(): Promise<void> {
    this.wantConnected = false;
    this.clearRetry();
    this.generation += 1;
    const obs = this.obs;
    this.obs = null;
    this.stopTimers();
    this.reset('disconnected', null);
    if (obs) await obs.disconnect().catch(() => undefined);
  }

  saveSettings(input: unknown): ObsState {
    if (typeof input !== 'object' || input === null) throw new Error('Invalid OBS settings.');
    const v = input as Partial<ObsSettingsInput>;
    const host = typeof v.host === 'string' ? v.host.trim() : '';
    if (!isValidHost(host)) throw new Error('Enter a valid address, for example 127.0.0.1.');
    if (!isValidPort(v.port)) throw new Error('The port must be a number from 1 to 65535.');
    if (v.password !== null && (typeof v.password !== 'string' || v.password.length > MAX_PASSWORD)) {
      throw new Error('The password is too long.');
    }
    if (typeof v.autoConnect !== 'boolean') throw new Error('Invalid OBS settings.');

    const before = getObsSettings();
    setObsSettings({ host, port: v.port, autoConnect: v.autoConnect, password: v.password });
    const changed = before.host !== host || before.port !== v.port || v.password !== null;
    if (changed && this.wantConnected) void this.connect();
    else this.emit();
    return this.getState();
  }

  async setProgramScene(sceneName: unknown): Promise<void> {
    if (typeof sceneName !== 'string' || sceneName.length > 512) throw new Error('Invalid scene name.');
    if (!this.obs || this.live.connection !== 'connected') throw new Error('OBS is not connected.');
    if (!this.live.scenes.some((s) => s.name === sceneName)) throw new Error('That scene is not in OBS any more.');
    try {
      await this.request('SetCurrentProgramScene', { sceneName });
    } catch (error) {
      throw new Error(requestMessage(error));
    }
  }

  /** Start/stop streaming and recording. Success is only reported once OBS confirms it. */
  async controlOutput(action: unknown): Promise<void> {
    if (typeof action !== 'string' || !(action in OUTPUT_REQUESTS)) throw new Error('Unknown stream or recording action.');
    const a = action as ObsOutputAction;
    this.requireConnected();
    const kind: OutputKind = a.endsWith('stream') ? 'stream' : 'record';
    const confirms = a.startsWith('start') || a.startsWith('stop');
    if (confirms && this.live.outputPending) throw new Error('Still waiting for OBS to confirm the last action.');

    if (confirms) {
      this.stopRequested[kind] = a.startsWith('stop');
      this.clearConfirm();
      this.confirmTimer = setTimeout(() => {
        this.confirmTimer = null;
        if (this.live.outputPending !== kind) return;
        const what = kind === 'stream' ? 'the stream' : 'the recording';
        this.update({ outputPending: null, outputNotice: this.notice('error', `OBS did not confirm that ${what} ${a.startsWith('start') ? 'started' : 'stopped'} within ${CONFIRM_MS / 1000} seconds. Check OBS.`) });
        void this.pollOutputs(this.generation);
      }, CONFIRM_MS);
      this.update({ outputPending: kind, outputNotice: null });
    }
    try {
      await this.request(OUTPUT_REQUESTS[a]);
    } catch (error) {
      if (confirms) {
        this.clearConfirm();
        this.stopRequested[kind] = false;
        this.update({ outputPending: null });
      }
      throw new Error(requestMessage(error));
    }
  }

  async setInputMuted(inputName: unknown, muted: unknown): Promise<void> {
    if (typeof inputName !== 'string' || inputName.length > 512 || typeof muted !== 'boolean') throw new Error('Invalid audio request.');
    this.requireConnected();
    if (!this.live.audio.some((i) => i.name === inputName)) throw new Error('That audio source is not in OBS any more.');
    try {
      await this.request('SetInputMute', { inputName, inputMuted: muted });
    } catch (error) {
      throw new Error(requestMessage(error));
    }
  }

  async setInputVolume(inputName: unknown, volumeDb: unknown): Promise<void> {
    if (typeof inputName !== 'string' || inputName.length > 512 || typeof volumeDb !== 'number' || !Number.isFinite(volumeDb)) throw new Error('Invalid audio request.');
    this.requireConnected();
    if (!this.live.audio.some((i) => i.name === inputName)) throw new Error('That audio source is not in OBS any more.');
    const db = Math.min(26, Math.max(-100, volumeDb));
    try {
      await this.request('SetInputVolume', { inputName, inputVolumeDb: db });
    } catch (error) {
      throw new Error(requestMessage(error));
    }
  }

  /** Creates (or updates) a Browser Source in the current program scene. `url` comes from the main process only. */
  async addBrowserSource(inputName: string, url: string): Promise<string> {
    this.requireConnected();
    const sceneName = this.live.programScene;
    if (!sceneName) throw new Error('OBS has no current scene.');
    try {
      const list = await this.request('GetInputList', { inputKind: 'browser_source' });
      const inputs = Array.isArray(list.inputs) ? (list.inputs as Data[]) : [];
      if (!inputs.some((i) => i.inputName === inputName)) {
        await this.request('CreateInput', {
          sceneName,
          inputName,
          inputKind: 'browser_source',
          inputSettings: { url, width: 1920, height: 1080, reroute_audio: true, shutdown: false, restart_when_active: false },
          sceneItemEnabled: true
        });
        return `Created “${inputName}” in “${sceneName}” (1920 × 1080).`;
      }
      await this.request('SetInputSettings', { inputName, inputSettings: { url, width: 1920, height: 1080, reroute_audio: true }, overlay: true });
      try {
        await this.request('GetSceneItemId', { sceneName, sourceName: inputName });
        return `“${inputName}” is already in “${sceneName}”. Its address was updated.`;
      } catch (error) {
        if (errorCode(error) !== 600) throw error;
      }
      await this.request('CreateSceneItem', { sceneName, sourceName: inputName, sceneItemEnabled: true });
      return `Added “${inputName}” to “${sceneName}”.`;
    } catch (error) {
      throw new Error(requestMessage(error));
    }
  }

  /** A small JPEG of a scene as OBS renders it, for the preview monitor. Null when unavailable. */
  async getScreenshot(sceneName: unknown, width: unknown = 640): Promise<string | null> {
    if (typeof sceneName !== 'string' || sceneName.length > 512) throw new Error('Invalid scene.');
    const imageWidth = typeof width === 'number' && Number.isFinite(width) ? Math.round(Math.min(1920, Math.max(320, width))) : 640;
    if (!this.obs || this.live.connection !== 'connected') return null;
    if (!this.live.scenes.some((s) => s.name === sceneName)) return null;
    try {
      const r = await this.request('GetSourceScreenshot', { sourceName: sceneName, imageFormat: 'jpg', imageWidth, imageCompressionQuality: 70 });
      const data = str(r.imageData);
      return data && /^data:image\/(jpeg|jpg|png);base64,/.test(data) ? data : null;
    } catch {
      return null;
    }
  }

  // ----- internals -----

  private requireConnected(): void {
    if (!this.obs || this.live.connection !== 'connected') throw new Error('OBS is not connected.');
  }

  private notice(tone: ObsNotice['tone'], message: string): ObsNotice {
    return { tone, message, at: new Date().toISOString() };
  }

  private clearConfirm(): void {
    if (this.confirmTimer) clearTimeout(this.confirmTimer);
    this.confirmTimer = null;
  }

  /** Turns OBS's StreamStateChanged / RecordStateChanged events into plain-language results. */
  private onOutputEvent(kind: OutputKind, outputState: string | null, outputPath: string | null): void {
    const pending = this.live.outputPending === kind;
    const wantedStop = this.stopRequested[kind];
    const isStream = kind === 'stream';
    const done = (notice: ObsNotice) => {
      if (pending) this.clearConfirm();
      this.update({ outputPending: pending ? null : this.live.outputPending, outputNotice: notice });
    };
    switch (outputState) {
      case 'OBS_WEBSOCKET_OUTPUT_STARTED':
        if (pending && !wantedStop) done(this.notice('ok', isStream ? 'The stream is live.' : 'Recording started.'));
        break;
      case 'OBS_WEBSOCKET_OUTPUT_STOPPED': {
        this.stopRequested[kind] = false;
        const saved = outputPath ? ` Saved to ${outputPath.slice(0, 400)}` : '';
        if (pending && !wantedStop) {
          done(this.notice('error', isStream
            ? 'OBS could not start the stream. In OBS, check Settings → Stream (service and stream key) and your internet connection.'
            : 'OBS could not start recording. In OBS, check Settings → Output → Recording (folder and free disk space).'));
        } else if (wantedStop) {
          done(this.notice('ok', isStream ? 'The stream has stopped.' : `Recording stopped.${saved}`));
        } else {
          done(this.notice(isStream ? 'error' : 'ok', isStream
            ? 'OBS reports the stream stopped. It was stopped in OBS, or the connection to the streaming service failed.'
            : `OBS reports recording stopped.${saved}`));
        }
        break;
      }
      case 'OBS_WEBSOCKET_OUTPUT_RECONNECTING':
        if (isStream) done(this.notice('error', 'The stream lost its connection. OBS is reconnecting.'));
        break;
      case 'OBS_WEBSOCKET_OUTPUT_RECONNECTED':
        if (isStream) done(this.notice('ok', 'The stream reconnected.'));
        break;
    }
  }

  private async refreshAudio(gen: number): Promise<void> {
    try {
      const list = await this.request('GetInputList');
      const names = (Array.isArray(list.inputs) ? (list.inputs as Data[]) : [])
        .map((i) => str(i.inputName))
        .filter((n): n is string => n !== null && n !== '')
        .slice(0, MAX_AUDIO_INPUTS);
      // Inputs without audio reject GetInputMute, which is how they are left out.
      const results = await Promise.all(
        names.map(async (name): Promise<ObsAudioInput | null> => {
          try {
            const r = await this.request('GetInputMute', { inputName: name });
            const v = await this.request('GetInputVolume', { inputName: name }).catch(() => ({ inputVolumeDb: 0 }) as Data);
            const db = typeof v.inputVolumeDb === 'number' && Number.isFinite(v.inputVolumeDb) ? v.inputVolumeDb : -100;
            return { name, muted: r.inputMuted === true, volumeDb: db };
          } catch {
            return null;
          }
        })
      );
      if (gen !== this.generation) return;
      this.update({ audio: results.filter((r): r is ObsAudioInput => r !== null) });
    } catch {
      // Audio is optional; the Audio tab simply stays empty.
    }
  }

  private emit(): void {
    this.notify(this.getState());
  }

  private update(changes: Partial<LiveState>): void {
    this.live = { ...this.live, ...changes };
    this.emit();
  }

  private reset(connection: ObsConnectionState, error: ObsError | null, nextRetryAt: string | null = null): void {
    this.live = { ...EMPTY, connection, error, nextRetryAt };
    this.levels = {};
    this.notifyLevels({});
    this.emit();
  }

  private async request<T extends Data = Data>(type: string, data?: Data): Promise<T> {
    const obs = this.obs;
    if (!obs) throw new Error('OBS is not connected.');
    const call = obs.call.bind(obs) as unknown as (t: string, d?: Data) => Promise<unknown>;
    return (await call(type, data)) as T;
  }

  private address(): string {
    const { host, port } = getObsSettings();
    return `${host}:${port}`;
  }

  private async open(isRetry: boolean): Promise<void> {
    const gen = ++this.generation;
    const previous = this.obs;
    this.obs = null;
    this.stopTimers();
    if (previous) previous.disconnect().catch(() => undefined);

    const { host, port } = getObsSettings();
    const address = this.address();
    const obs = new OBSWebSocket();
    this.obs = obs;
    this.live = { ...EMPTY, connection: isRetry ? 'reconnecting' : 'connecting', error: isRetry ? this.live.error : null };
    this.emit();
    this.attachEvents(obs, gen);

    try {
      const urlHost = host.includes(':') && !host.startsWith('[') ? `[${host}]` : host;
      const result = await withTimeout(obs.connect(`ws://${urlHost}:${port}`, getObsPassword(), { rpcVersion: 1, eventSubscriptions: EVENT_SUBSCRIPTIONS }), CONNECT_TIMEOUT_MS);
      if (gen !== this.generation) {
        obs.disconnect().catch(() => undefined);
        return;
      }
      this.retryDelay = MIN_RETRY_MS;
      this.update({ connection: 'connected', error: null, websocketVersion: result.obsWebSocketVersion });
      await this.refreshAll(gen);
      this.pollTimer = setInterval(() => void this.pollOutputs(gen), POLL_MS);
    } catch (error) {
      if (gen !== this.generation) return;
      this.obs = null;
      obs.disconnect().catch(() => undefined);
      const problem = classify(error, address);
      const retry = this.wantConnected && RETRYABLE.includes(problem.code);
      this.reset('disconnected', problem);
      if (retry) this.scheduleRetry();
    }
  }

  private attachEvents(obs: ObsClient, gen: number): void {
    const on = obs.on.bind(obs) as unknown as (event: string, handler: (data: Data) => void) => void;
    const current = () => gen === this.generation;

    const lost = (message: string) => {
      if (!current() || this.live.connection !== 'connected') return;
      this.obs = null;
      this.stopTimers();
      this.reset('disconnected', { code: 'closed', message });
      if (this.wantConnected) this.scheduleRetry();
    };
    on('ConnectionClosed', () => lost('The connection to OBS was lost.'));
    on('ExitStarted', () => lost('OBS was closed.'));

    on('CurrentProgramSceneChanged', (d) => {
      if (!current()) return;
      this.update({ programScene: str(d.sceneName) });
      this.scheduleRefresh(gen);
    });
    on('CurrentPreviewSceneChanged', (d) => current() && this.update({ previewScene: str(d.sceneName) }));
    on('StudioModeStateChanged', (d) => {
      if (!current()) return;
      this.update({ studioMode: d.studioModeEnabled === true });
      this.scheduleRefresh(gen);
    });
    for (const event of [
      'SceneListChanged',
      'SceneCreated',
      'SceneRemoved',
      'SceneNameChanged',
      'SceneItemCreated',
      'SceneItemRemoved',
      'SceneItemEnableStateChanged',
      'SceneItemListReindexed',
      'InputNameChanged',
      'InputCreated',
      'InputRemoved'
    ]) {
      on(event, () => current() && this.scheduleRefresh(gen));
    }
    on('InputMuteStateChanged', (d) => {
      if (!current()) return;
      const name = str(d.inputName);
      this.update({ audio: this.live.audio.map((i) => (i.name === name ? { ...i, muted: d.inputMuted === true } : i)) });
    });
    on('InputVolumeChanged', (d) => {
      if (!current()) return;
      const name = str(d.inputName);
      const db = typeof d.inputVolumeDb === 'number' ? d.inputVolumeDb : null;
      if (db === null) return;
      this.update({ audio: this.live.audio.map((i) => (i.name === name ? { ...i, volumeDb: db } : i)) });
    });
    // About 20 times a second. Only the loudest channel of each input is kept, sent at most every 100 ms.
    on('InputVolumeMeters', (d) => {
      if (!current() || !Array.isArray(d.inputs)) return;
      for (const input of d.inputs as Data[]) {
        const name = str(input.inputName);
        if (!name) continue;
        const channels = Array.isArray(input.inputLevelsMul) ? (input.inputLevelsMul as unknown[]) : [];
        let peak = 0;
        for (const ch of channels) if (Array.isArray(ch) && typeof ch[1] === 'number') peak = Math.max(peak, ch[1]);
        this.levels[name] = peak > 0 ? Math.max(-60, Math.min(0, 20 * Math.log10(peak))) : -60;
      }
      const now = Date.now();
      if (now - this.lastLevelsAt >= LEVELS_MS) {
        this.lastLevelsAt = now;
        this.notifyLevels({ ...this.levels });
      }
    });
    on('StreamStateChanged', (d) => {
      if (!current()) return;
      this.onOutputEvent('stream', str(d.outputState), null);
      void this.pollOutputs(gen);
    });
    on('RecordStateChanged', (d) => {
      if (!current()) return;
      this.onOutputEvent('record', str(d.outputState), str(d.outputPath));
      void this.pollOutputs(gen);
    });
  }

  private scheduleRefresh(gen: number): void {
    if (this.refreshTimer) clearTimeout(this.refreshTimer);
    this.refreshTimer = setTimeout(() => void this.refreshAll(gen), 150);
  }

  private async refreshAll(gen: number): Promise<void> {
    try {
      const [version, list, studio] = await Promise.all([
        this.request('GetVersion'),
        this.request('GetSceneList'),
        this.request('GetStudioModeEnabled').catch(() => ({ studioModeEnabled: false }) as Data)
      ]);
      if (gen !== this.generation) return;

      const rawScenes = Array.isArray(list.scenes) ? (list.scenes as Data[]) : [];
      // OBS lists index 0 at the bottom of its Scenes panel; show them in the same order as OBS.
      const scenes: ObsScene[] = [...rawScenes]
        .sort((a, b) => num(b.sceneIndex) - num(a.sceneIndex))
        .map((s) => ({ name: str(s.sceneName) ?? '' }))
        .filter((s) => s.name !== '');
      const programScene = str(list.currentProgramSceneName);
      const studioMode = studio.studioModeEnabled === true;

      let sources: ObsSource[] = [];
      if (programScene) {
        const items = await this.request('GetSceneItemList', { sceneName: programScene });
        const rawItems = Array.isArray(items.sceneItems) ? (items.sceneItems as Data[]) : [];
        sources = [...rawItems]
          .sort((a, b) => num(b.sceneItemIndex) - num(a.sceneItemIndex))
          .map((item) => ({
            id: num(item.sceneItemId),
            name: str(item.sourceName) ?? 'Unnamed source',
            kind: str(item.inputKind) ?? (item.isGroup === true ? 'group' : 'scene'),
            enabled: item.sceneItemEnabled === true,
            isGroup: item.isGroup === true
          }));
      }
      if (gen !== this.generation) return;

      this.update({
        obsVersion: str(version.obsVersion),
        websocketVersion: str(version.obsWebSocketVersion) ?? this.live.websocketVersion,
        scenes,
        programScene,
        previewScene: studioMode ? str(list.currentPreviewSceneName) : null,
        studioMode,
        sources
      });
      await Promise.all([this.pollOutputs(gen), this.refreshAudio(gen)]);
    } catch (error) {
      if (gen !== this.generation || this.live.connection !== 'connected') return;
      this.update({ error: { code: 'request-failed', message: requestMessage(error) } });
    }
  }

  private async pollOutputs(gen: number): Promise<void> {
    if (gen !== this.generation || !this.obs) return;
    const read = async (type: string, flagKey: string): Promise<ObsOutputStatus | null> => {
      try {
        const r = await this.request(type);
        return { active: r.outputActive === true, flag: r[flagKey] === true, timecode: str(r.outputTimecode) ?? '00:00:00' };
      } catch {
        return null;
      }
    };
    const [stream, record] = await Promise.all([read('GetStreamStatus', 'outputReconnecting'), read('GetRecordStatus', 'outputPaused')]);
    if (gen !== this.generation) return;
    const same = JSON.stringify([stream, record]) === JSON.stringify([this.live.stream, this.live.record]);
    if (!same) this.update({ stream, record });
  }

  private scheduleRetry(): void {
    this.clearRetry();
    const delay = this.retryDelay;
    this.retryDelay = Math.min(this.retryDelay * 2, MAX_RETRY_MS);
    this.update({ nextRetryAt: new Date(Date.now() + delay).toISOString() });
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      if (this.wantConnected) void this.open(true);
    }, delay);
  }

  private clearRetry(): void {
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = null;
  }

  private stopTimers(): void {
    if (this.pollTimer) clearInterval(this.pollTimer);
    if (this.refreshTimer) clearTimeout(this.refreshTimer);
    this.clearConfirm();
    this.stopRequested = { stream: false, record: false };
    this.pollTimer = null;
    this.refreshTimer = null;
  }
}
