import { useEffect, useState } from 'react';
import { TransitionView, liveSlideKey } from './TransitionView';
import { resolvePointer, type PresentationState } from '../state/presentation';
import { OverlayLayer } from './OverlayLayer';
import { buildSnapshot } from '../state/useOutputPublisher';

interface OutputViewProps {
  state: PresentationState;
  onClose: () => void;
}

/**
 * Full-screen presentation output inside the main window (F5).
 * Separate projector and stage-display windows arrive in Milestone 4.
 */
export function OutputView({ state, onClose }: OutputViewProps) {
  const [wake, setWake] = useState(0);
  const [showHint, setShowHint] = useState(true);

  // Show the hint and cursor briefly after opening or moving the mouse.
  useEffect(() => {
    setShowHint(true);
    const timer = window.setTimeout(() => setShowHint(false), 2500);
    return () => window.clearTimeout(timer);
  }, [wake]);

  // Esc / F5 close the output. Runs before the global shortcuts, so Esc does not also clear the slide.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' || event.key === 'F5') {
        event.preventDefault();
        event.stopImmediatePropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [onClose]);

  const live = resolvePointer(state, state.live);

  return (
    <div
      className={`output${showHint ? '' : ' hide-cursor'}`}
      role="dialog"
      aria-label="Presentation output"
      onMouseMove={() => setWake((n) => n + 1)}
    >
      <div className="output-stage">
        <div className="ovl-host">
        <TransitionView
          slideKey={liveSlideKey(live?.item.id, live?.index, state.blackout)}
          transition={live?.item.transition ?? 'fade'}
          item={live?.item ?? null}
          slide={live?.slide ?? null}
          blackout={state.blackout}
          playing
          since={state.liveSince}
        />
        <OverlayLayer overlays={buildSnapshot(state, state.media).overlays} target="projector" blackout={state.blackout} playing />
        </div>
      </div>
      <div className={`output-hint${showHint ? ' is-visible' : ''}`}>Esc to exit · ← → change slide · B blackout</div>
    </div>
  );
}
