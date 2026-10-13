import { useEffect, useMemo, useState } from 'react';
import { TransitionView, liveSlideKey } from '../components/TransitionView';
import { MediaContext, type MediaLookup } from '../components/MediaContext';
import { StageDisplay } from './StageDisplay';
import { OverlayLayer } from '../components/OverlayLayer';
import { AlertBar } from '../components/AlertBar';
import { ScreenGuide } from '../components/ScreenGuide';
import { pictureFrame } from '../../shared/extras';
import type { OutputRole, OutputSnapshot } from '../../shared/output-types';

const EMPTY: OutputSnapshot = { live: null, next: null, blackout: false, overlays: [], liveSince: 0, serviceName: '', notes: '', media: {} };

/** Receives presentation state from the main window. */
function useOutputSnapshot(): { snapshot: OutputSnapshot; connected: boolean } {
  const [snapshot, setSnapshot] = useState<OutputSnapshot>(EMPTY);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const bridge = window.kvlog;
    if (!bridge) return;
    let active = true;
    const unsubscribe = bridge.onOutputState((s) => {
      setSnapshot(s);
      setConnected(true);
    });
    bridge
      .getOutputState()
      .then((s) => {
        if (active && s) {
          setSnapshot(s);
          setConnected(true);
        }
      })
      .catch(() => undefined);
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  return { snapshot, connected };
}

/** Esc closes this output window. Everything else is controlled from the main KVLOG window. */
function useCloseOnEscape(): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        void window.kvlog?.closeSelf();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}

function ProjectorOutput({ snapshot }: { snapshot: OutputSnapshot }) {
  const f = pictureFrame(snapshot.screens?.projector);
  return (
    <div className="projector">
      <div className="projector-safe" style={{ left: `${f.x}%`, top: `${f.y}%`, width: `${f.scale * 100}%`, height: `${f.scale * 100}%` }}>
      <div className="projector-stage">
        <div className="ovl-host">
        <TransitionView
          slideKey={liveSlideKey(snapshot.live?.itemId, snapshot.live?.index, snapshot.blackout)}
          transition={snapshot.live?.transition ?? 'fade'}
          item={snapshot.live}
          slide={snapshot.live}
          blackout={snapshot.blackout}
          playing
          sound
          since={snapshot.liveSince}
        />
        <OverlayLayer overlays={snapshot.overlays} target="projector" blackout={snapshot.blackout} playing />
        <AlertBar alert={snapshot.alert} />
        {snapshot.guide && <ScreenGuide label="KVLOG safe area (projector)" />}
        </div>
      </div>
      </div>
    </div>
  );
}

export function OutputApp({ role }: { role: OutputRole }) {
  const { snapshot, connected } = useOutputSnapshot();
  useCloseOnEscape();

  useEffect(() => {
    document.title = role === 'projector' ? 'KVLOG Projector' : 'KVLOG Stage Display';
    document.body.classList.add('output-body');
  }, [role]);

  const media = useMemo<MediaLookup>(() => ({ files: snapshot.media, missing: new Set() }), [snapshot.media]);

  return (
    <MediaContext.Provider value={media}>
      {role === 'projector' ? <ProjectorOutput snapshot={snapshot} /> : <StageDisplay snapshot={snapshot} connected={connected} />}
    </MediaContext.Provider>
  );
}
