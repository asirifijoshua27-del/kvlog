import { useEffect, useState } from 'react';
import type { UpdateState } from '../../shared/system';

export function useUpdates(): UpdateState | null {
  const [state, setState] = useState<UpdateState | null>(null);
  useEffect(() => {
    const bridge = window.kvlog;
    if (!bridge) return;
    let active = true;
    bridge.getUpdateState().then((s) => active && setState(s)).catch(() => undefined);
    const off = bridge.onUpdateState(setState);
    return () => {
      active = false;
      off();
    };
  }, []);
  return state;
}
