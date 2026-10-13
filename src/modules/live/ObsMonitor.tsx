import { useEffect, useState } from 'react';
import { Maximize2, MonitorOff, X } from 'lucide-react';
import { Monitor } from './Monitor';
import { useObsScreenshot, type ObsControl } from '../../services/obs';

type View = 'program' | 'preview';

function ObsPicture({ image, scene, connected }: { image: string | null; scene: string | null; connected: boolean }) {
  return image ? (
    <img src={image} alt={`OBS scene ${scene}`} draggable={false} />
  ) : (
    <span className="obs-screen-empty">
      <MonitorOff size={18} aria-hidden="true" />
      {connected ? 'Waiting for picture…' : 'Connect OBS on the Broadcast page'}
    </span>
  );
}

/** What OBS is sending to the stream/recording (Program). In Studio Mode the OBS Preview can be shown instead. */
export function ObsMonitor({ obs }: { obs: ObsControl }) {
  const state = obs.state;
  const connected = state?.connection === 'connected';
  const studio = connected && state?.studioMode === true;
  const [view, setView] = useState<View>('program');
  const [large, setLarge] = useState(false);
  const shown: View = studio ? view : 'program';
  const scene = connected ? (shown === 'preview' ? state?.previewScene : state?.programScene) ?? null : null;
  const small = useObsScreenshot(large ? null : scene, 1000, 640);
  const big = useObsScreenshot(large ? scene : null, 500, 1280);
  const label = shown === 'preview' ? 'OBS preview' : 'OBS program';

  useEffect(() => {
    if (!large) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        setLarge(false);
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [large]);

  const toggle = studio ? (
    <div className="segmented segmented-sm" role="radiogroup" aria-label="Which OBS scene to show">
      {(['program', 'preview'] as View[]).map((v) => (
        <button key={v} type="button" role="radio" aria-checked={view === v} className={view === v ? 'is-active' : undefined} onClick={() => setView(v)}>
          {v === 'program' ? 'Program' : 'Preview'}
        </button>
      ))}
    </div>
  ) : null;

  return (
    <>
      <Monitor
        label={label}
        tone="obs"
        caption={scene ?? (connected ? 'No scene' : 'Not connected')}
        action={
          <div className="monitor-actions">
            {toggle}
            <button type="button" className="icon-btn" title="Show larger" aria-label="Show OBS picture larger" disabled={!connected} onClick={() => setLarge(true)}>
              <Maximize2 size={13} />
            </button>
          </div>
        }
      >
        <div className="obs-screen">
          <ObsPicture image={small} scene={scene} connected={connected} />
        </div>
      </Monitor>
      {large && (
        <div className="obs-large" role="dialog" aria-modal="true" aria-label={label} onClick={() => setLarge(false)}>
          <div className="obs-large-panel" onClick={(e) => e.stopPropagation()}>
            <div className="obs-large-head">
              <span className={`obs-large-tag${shown === 'program' ? ' is-program' : ''}`}>{shown === 'program' ? 'Program' : 'Preview'}</span>
              <span className="obs-large-scene">{scene ?? 'No scene'}</span>
              {toggle}
              <button type="button" className="icon-btn" aria-label="Close (Esc)" title="Close (Esc)" onClick={() => setLarge(false)}>
                <X size={15} />
              </button>
            </div>
            <div className="obs-screen">
              <ObsPicture image={big} scene={scene} connected={connected} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
