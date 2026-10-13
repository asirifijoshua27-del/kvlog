import { useEffect, useState } from 'react';
import type { AppInfo, DisplayInfo } from '../../shared/bridge-types';

const NO_BRIDGE =
  'Desktop features are unavailable because KVLOG is open in a web browser. Launch it with "npm run dev" to use them.';

/** A readable message from an error, without Electron's "Error invoking remote method" prefix. */
export function errorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/^Error invoking remote method '[^']+': (?:Error: )?/, '');
}

export interface DisplaysState {
  displays: DisplayInfo[] | null;
  error: string | null;
}

export function useDisplays(): DisplaysState {
  const [state, setState] = useState<DisplaysState>({ displays: null, error: null });

  useEffect(() => {
    const bridge = window.kvlog;
    if (!bridge) {
      setState({ displays: null, error: NO_BRIDGE });
      return;
    }
    let active = true;
    bridge
      .listDisplays()
      .then((displays) => active && setState({ displays, error: null }))
      .catch((error: unknown) => active && setState({ displays: null, error: errorMessage(error) }));
    const unsubscribe = bridge.onDisplaysChanged((displays) => setState({ displays, error: null }));
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  return state;
}

export interface AppInfoState {
  info: AppInfo | null;
  error: string | null;
}

export function useAppInfo(): AppInfoState {
  const [state, setState] = useState<AppInfoState>({ info: null, error: null });

  useEffect(() => {
    const bridge = window.kvlog;
    if (!bridge) {
      setState({ info: null, error: NO_BRIDGE });
      return;
    }
    let active = true;
    bridge
      .getAppInfo()
      .then((info) => active && setState({ info, error: null }))
      .catch((error: unknown) => active && setState({ info: null, error: errorMessage(error) }));
    return () => {
      active = false;
    };
  }, []);

  return state;
}

/** Full screen for the presentation output. Silently does nothing in a normal browser. */
export async function setWindowFullScreen(on: boolean): Promise<void> {
  if (!window.kvlog) return;
  try {
    await window.kvlog.setFullScreen(on);
  } catch (error) {
    console.warn('Could not change full screen:', errorMessage(error));
  }
}

export async function revealDataFile(): Promise<void> {
  if (!window.kvlog) throw new Error(NO_BRIDGE);
  await window.kvlog.revealDataFile();
}

export async function identifyDisplay(displayId: number): Promise<void> {
  if (!window.kvlog) throw new Error(NO_BRIDGE);
  await window.kvlog.identifyDisplay(displayId);
}
