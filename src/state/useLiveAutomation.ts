import { useEffect, useRef } from 'react';
import { getActivePlan, type PresentationState } from './presentation';
import { extrasOf } from '../../shared/extras';
import type { ObsControl } from '../services/obs';
import type { ServiceItem } from '../types';

/** The OBS scene an item asks for: its own choice, else the default for its type. null = leave OBS alone. */
export function sceneFor(item: ServiceItem, state: PresentationState): string | null {
  const own = extrasOf(item).obsScene;
  if (own === '-') return null;
  return own || state.settings.obsSceneByKind[item.kind] || null;
}

/**
 * Runs when a new item goes live:
 * - switches OBS to the item's scene (when automatic switching is on),
 * - records songs for the licence report (when usage logging is on).
 */
export function useLiveAutomation(state: PresentationState, obs: ObsControl): void {
  const lastItem = useRef<string | null>(null);
  const liveId = state.blackout ? null : state.live?.itemId ?? null;
  const obsRef = useRef(obs);
  obsRef.current = obs;
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    if (!liveId || liveId === lastItem.current) {
      if (!liveId) lastItem.current = null;
      return;
    }
    lastItem.current = liveId;
    const s = stateRef.current;
    const item = s.library.find((i) => i.id === liveId);
    if (!item) return;

    const o = obsRef.current;
    const scene = s.settings.obsAuto ? sceneFor(item, s) : null;
    if (scene && o.state?.connection === 'connected' && o.state.programScene !== scene && o.state.scenes.some((sc) => sc.name === scene)) {
      o.setProgramScene(scene);
    }

    if (item.kind === 'song' && s.settings.logUsage && window.kvlog) {
      const plan = getActivePlan(s);
      window.kvlog
        .logSongUse({ songId: item.id, title: item.title, subtitle: item.subtitle, ccli: extrasOf(item).ccli, service: plan?.name ?? '' })
        .catch((error: unknown) => console.warn('Could not record song use:', error));
    }
  }, [liveId]);
}
