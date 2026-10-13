import { useCallback, useEffect, useState } from 'react';
import type { ObsAudioLevels, LyricsSourceSettings, LyricsSourceState, ObsOutputAction, ObsSettingsInput, ObsState } from '../../shared/obs-types';
import { errorMessage } from './desktopBridge';

export interface ObsControl {
  /** null in a web browser, where OBS cannot be reached. */
  state: ObsState | null;
  /** The last failed action (switching scenes, saving settings…). */
  actionError: string | null;
  busy: boolean;
  connect: () => void;
  disconnect: () => void;
  saveSettings: (input: ObsSettingsInput) => Promise<boolean>;
  setProgramScene: (sceneName: string) => void;
  output: (action: ObsOutputAction) => void;
  setMuted: (inputName: string, muted: boolean) => void;
  setVolume: (inputName: string, volumeDb: number) => void;
  clearActionError: () => void;
}

export function useObs(): ObsControl {
  const [state, setState] = useState<ObsState | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const bridge = window.kvlog;
    if (!bridge) return;
    let active = true;
    bridge
      .getObsState()
      .then((s) => active && setState(s))
      .catch((e: unknown) => active && setActionError(errorMessage(e)));
    const unsubscribe = bridge.onObsState((s) => setState(s));
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const run = useCallback(async (action: () => Promise<unknown>): Promise<boolean> => {
    setActionError(null);
    setBusy(true);
    try {
      await action();
      return true;
    } catch (e) {
      setActionError(errorMessage(e));
      return false;
    } finally {
      setBusy(false);
    }
  }, []);

  const connect = useCallback(() => void run(() => window.kvlog!.connectObs()), [run]);
  const disconnect = useCallback(() => void run(() => window.kvlog!.disconnectObs()), [run]);
  const saveSettings = useCallback(
    (input: ObsSettingsInput) =>
      run(async () => {
        setState(await window.kvlog!.saveObsSettings(input));
      }),
    [run]
  );
  const setProgramScene = useCallback((sceneName: string) => void run(() => window.kvlog!.setObsProgramScene(sceneName)), [run]);
  const output = useCallback((action: ObsOutputAction) => void run(() => window.kvlog!.obsOutput(action)), [run]);
  const setMuted = useCallback((inputName: string, muted: boolean) => void run(() => window.kvlog!.setObsInputMuted(inputName, muted)), [run]);
  // Faders send many changes while dragging, so they skip the busy flag.
  const setVolume = useCallback((inputName: string, volumeDb: number) => {
    window.kvlog?.setObsInputVolume(inputName, volumeDb).catch((e: unknown) => setActionError(errorMessage(e)));
  }, []);
  const clearActionError = useCallback(() => setActionError(null), []);

  return { state, actionError, busy, connect, disconnect, saveSettings, setProgramScene, output, setMuted, setVolume, clearActionError };
}

export interface LyricsSourceControl {
  state: LyricsSourceState | null;
  error: string | null;
  /** Result of "Add to OBS". */
  message: string | null;
  busy: boolean;
  save: (input: LyricsSourceSettings) => Promise<boolean>;
  addToObs: () => void;
}

export function useLyricsSource(): LyricsSourceControl {
  const [state, setState] = useState<LyricsSourceState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const bridge = window.kvlog;
    if (!bridge) return;
    let active = true;
    bridge.getLyricsState().then((s) => active && setState(s)).catch((e: unknown) => active && setError(errorMessage(e)));
    const unsubscribe = bridge.onLyricsState((s) => setState(s));
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const save = useCallback(async (input: LyricsSourceSettings) => {
    setError(null);
    setMessage(null);
    setBusy(true);
    try {
      setState(await window.kvlog!.saveLyricsSettings(input));
      return true;
    } catch (e) {
      setError(errorMessage(e));
      return false;
    } finally {
      setBusy(false);
    }
  }, []);

  const addToObs = useCallback(() => {
    setError(null);
    setMessage(null);
    setBusy(true);
    window.kvlog!
      .addLyricsSourceToObs()
      .then((m) => setMessage(m))
      .catch((e: unknown) => setError(errorMessage(e)))
      .finally(() => setBusy(false));
  }, []);

  return { state, error, message, busy, save, addToObs };
}

/** Short status text for pills and headings. */
export function describeObsConnection(state: ObsState | null): string {
  if (!state) return 'Unavailable';
  switch (state.connection) {
    case 'connected':
      return 'Connected';
    case 'connecting':
      return 'Connecting…';
    case 'reconnecting':
      return 'Reconnecting…';
    default:
      if (state.nextRetryAt) return 'Retrying…';
      if (state.error?.code === 'auth-failed' || state.error?.code === 'auth-required') return 'Wrong password';
      if (state.error) return 'Not reachable';
      return 'Not connected';
  }
}

/** Refreshes a picture of an OBS scene about once a second while the window is visible. */
export function useObsScreenshot(sceneName: string | null, intervalMs = 1000, width = 640): string | null {
  const [image, setImage] = useState<string | null>(null);

  useEffect(() => {
    setImage(null);
    const bridge = window.kvlog;
    if (!bridge || !sceneName) return;
    let active = true;
    let timer: number | undefined;
    const tick = async () => {
      if (!active) return;
      if (document.visibilityState === 'visible') {
        try {
          const data = await bridge.getObsScreenshot(sceneName, width);
          if (active) setImage(data);
        } catch {
          if (active) setImage(null);
        }
      }
      if (active) timer = window.setTimeout(tick, intervalMs);
    };
    void tick();
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [sceneName, intervalMs, width]);

  return image;
}

/** Live OBS audio levels (dBFS per input). Only listens while `enabled`. */
export function useObsLevels(enabled: boolean): ObsAudioLevels {
  const [levels, setLevels] = useState<ObsAudioLevels>({});
  useEffect(() => {
    const bridge = window.kvlog;
    if (!bridge || !enabled) {
      setLevels({});
      return;
    }
    return bridge.onObsLevels((l) => setLevels(l));
  }, [enabled]);
  return levels;
}
