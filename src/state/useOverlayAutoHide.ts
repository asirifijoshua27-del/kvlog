import { useEffect, type Dispatch } from 'react';
import type { PresentationAction, PresentationState } from './presentation';

/** Turns overlays off by themselves when their "Turn off after" time is up (e.g. lower thirds). */
export function useOverlayAutoHide(state: PresentationState, dispatch: Dispatch<PresentationAction>): void {
  const { overlays, overlayOn } = state;
  useEffect(() => {
    const timers: number[] = [];
    for (const o of overlays) {
      const since = overlayOn[o.id];
      if (since === undefined || o.autoHideSeconds <= 0) continue;
      const wait = Math.max(0, since + o.autoHideSeconds * 1000 - Date.now());
      timers.push(window.setTimeout(() => dispatch({ type: 'setOverlay', overlayId: o.id, on: false }), wait));
    }
    return () => timers.forEach((id) => window.clearTimeout(id));
  }, [overlays, overlayOn, dispatch]);
}
