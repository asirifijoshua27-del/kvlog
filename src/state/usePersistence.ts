import { useCallback, useEffect, useRef, useState, type Dispatch } from 'react';
import { toAppData, type PresentationAction, type PresentationState } from './presentation';
import { createSampleData } from '../data/sampleService';
import { errorMessage } from '../services/desktopBridge';
import type { AppData } from '../../shared/data-types';

export type SaveStatus =
  | { kind: 'loading' }
  | { kind: 'saved'; at: Date | null }
  | { kind: 'saving' }
  | { kind: 'error'; message: string }
  | { kind: 'readonly' }
  | { kind: 'unavailable' };

export interface Persistence {
  status: SaveStatus;
  filePath: string | null;
  notice: string | null;
  dismissNotice: () => void;
  /** Saves pending changes now. */
  flush: () => Promise<void>;
  /** Reads the data file again (after a restore). */
  reload: () => Promise<void>;
}

const SAVE_DELAY_MS = 500;

/** Loads saved data on start-up and saves changes automatically shortly after they happen. */
export function usePersistence(state: PresentationState, dispatch: Dispatch<PresentationAction>): Persistence {
  const [status, setStatus] = useState<SaveStatus>({ kind: 'loading' });
  const [filePath, setFilePath] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const lastSavedJson = useRef<string | null>(null);
  const pending = useRef<{ json: string; data: AppData } | null>(null);
  const timer = useRef<number | null>(null);
  const savingDisabled = useRef(true);
  const skipFirstSave = useRef(false);

  // Load once at start-up.
  useEffect(() => {
    let cancelled = false;
    const bridge = window.kvlog;
    if (!bridge) {
      dispatch({ type: 'loadData', data: createSampleData() });
      setStatus({ kind: 'unavailable' });
      return;
    }
    bridge
      .loadData()
      .then((result) => {
        if (cancelled) return;
        setFilePath(result.filePath);
        setNotice(result.notice);
        savingDisabled.current = result.readOnly;
        // Saved data is already on disk; sample data for a first launch should be saved straight away.
        skipFirstSave.current = result.data !== null;
        dispatch({ type: 'loadData', data: result.data ?? createSampleData() });
        setStatus(result.readOnly ? { kind: 'readonly' } : { kind: 'saved', at: null });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        // Do not risk overwriting a file we could not read.
        savingDisabled.current = true;
        dispatch({ type: 'loadData', data: createSampleData() });
        setNotice(`KVLOG could not load your saved data: ${errorMessage(error)}. Saving is turned off for this session.`);
        setStatus({ kind: 'readonly' });
      });
    return () => {
      cancelled = true;
    };
  }, [dispatch]);

  const flush = useCallback(async () => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
    const bridge = window.kvlog;
    const job = pending.current;
    if (!job || !bridge || savingDisabled.current) return;
    pending.current = null;
    setStatus({ kind: 'saving' });
    try {
      await bridge.saveData(job.data);
      lastSavedJson.current = job.json;
      if (!pending.current) setStatus({ kind: 'saved', at: new Date() });
    } catch (error) {
      if (!pending.current) pending.current = job;
      setStatus({ kind: 'error', message: errorMessage(error) });
    }
  }, []);

  // Schedule a save whenever saved content changes.
  const { loaded, library, plans, media, templates, overlays, activePlanId, settings } = state;
  useEffect(() => {
    if (!loaded || !window.kvlog || savingDisabled.current) return;
    const data = toAppData({ library, plans, media, templates, overlays, activePlanId, settings });
    const json = JSON.stringify(data);
    if (skipFirstSave.current) {
      skipFirstSave.current = false;
      lastSavedJson.current = json;
      return;
    }
    if (json === lastSavedJson.current) return;
    pending.current = { json, data };
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => void flush(), SAVE_DELAY_MS);
  }, [loaded, library, plans, media, templates, overlays, activePlanId, settings, flush]);

  // Save immediately when the window is closing.
  useEffect(() => {
    const bridge = window.kvlog;
    if (!bridge) return;
    return bridge.onBeforeClose(() => {
      void flush().finally(() => void bridge.readyToClose());
    });
  }, [flush]);

  const dismissNotice = useCallback(() => setNotice(null), []);

  const reload = useCallback(async () => {
    const bridge = window.kvlog;
    if (!bridge) return;
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
    pending.current = null;
    const result = await bridge.loadData();
    if (!result.data) throw new Error(result.notice ?? 'The restored data could not be read.');
    savingDisabled.current = result.readOnly;
    skipFirstSave.current = true;
    dispatch({ type: 'loadData', data: result.data });
    setStatus({ kind: 'saved', at: new Date() });
  }, [dispatch]);

  return { status, filePath, notice, dismissNotice, flush, reload };
}
