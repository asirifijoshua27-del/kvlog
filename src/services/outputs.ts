import { useCallback, useEffect, useState } from 'react';
import type { OutputRole, OutputsStatus } from '../../shared/output-types';
import { errorMessage } from './desktopBridge';

export interface OutputsControl {
  /** null in a web browser, where separate windows are not available. */
  status: OutputsStatus | null;
  error: string | null;
  open: (role: OutputRole) => void;
  close: (role: OutputRole) => void;
  toggle: (role: OutputRole) => void;
  assign: (role: OutputRole, displayId: number | null) => void;
}

/** Live status of the projector and stage-display windows, with actions to control them. */
export function useOutputs(): OutputsControl {
  const [status, setStatus] = useState<OutputsStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const bridge = window.kvlog;
    if (!bridge) return;
    let active = true;
    bridge
      .getOutputsStatus()
      .then((s) => active && setStatus(s))
      .catch((e: unknown) => active && setError(errorMessage(e)));
    const unsubscribe = bridge.onOutputsChanged((s) => setStatus(s));
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const run = useCallback((action: () => Promise<void>) => {
    setError(null);
    action().catch((e: unknown) => setError(errorMessage(e)));
  }, []);

  const open = useCallback((role: OutputRole) => run(() => window.kvlog!.openOutput(role)), [run]);
  const close = useCallback((role: OutputRole) => run(() => window.kvlog!.closeOutput(role)), [run]);
  const assign = useCallback(
    (role: OutputRole, displayId: number | null) => run(() => window.kvlog!.assignOutput(role, displayId)),
    [run]
  );
  const toggle = useCallback(
    (role: OutputRole) => (status?.[role].open ? close(role) : open(role)),
    [status, open, close]
  );

  return { status, error, open, close, toggle, assign };
}
