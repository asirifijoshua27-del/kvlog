import { useState, type Dispatch } from 'react';
import { ArrowRightToLine, X } from 'lucide-react';
import { Monitor } from './Monitor';
import { SlideGrid } from './SlideGrid';
import { ServicePlaylist } from './ServicePlaylist';
import { ObsDock } from './ObsDock';
import { ObsMonitor } from './ObsMonitor';
import { SendToObsButton } from './SendToObsButton';
import { SlideView } from '../../components/SlideView';
import { OverlayLayer } from '../../components/OverlayLayer';
import { AlertBar } from '../../components/AlertBar';
import { buildSnapshot } from '../../state/useOutputPublisher';
import { TransitionView, liveSlideKey } from '../../components/TransitionView';
import { getActivePlan, getNextPointer, resolvePointer, type PresentationAction, type PresentationState } from '../../state/presentation';
import type { ModuleId } from '../../types';
import type { ObsControl } from '../../services/obs';

interface LiveStudioProps {
  state: PresentationState;
  dispatch: Dispatch<PresentationAction>;
  onNavigate: (id: ModuleId) => void;
  obs: ObsControl;
}

const CLICK_MODE_KEY = 'kvlog.live.clickMode';

function readClickMode(): 'live' | 'preview' {
  try {
    return localStorage.getItem(CLICK_MODE_KEY) === 'preview' ? 'preview' : 'live';
  } catch {
    return 'live';
  }
}

export function LiveStudio({ state, dispatch, onNavigate, obs }: LiveStudioProps) {
  const [clickMode, setClickModeState] = useState<'live' | 'preview'>(readClickMode);
  const setClickMode = (mode: 'live' | 'preview') => {
    setClickModeState(mode);
    try {
      localStorage.setItem(CLICK_MODE_KEY, mode);
    } catch {
      // Only kept for this session.
    }
    if (mode === 'live') dispatch({ type: 'clearPreview' });
  };
  const live = resolvePointer(state, state.live);
  const nextPointer = getNextPointer(state);
  const next = resolvePointer(state, nextPointer);
  const selected = state.library.find((i) => i.id === state.selectedItemId) ?? null;
  const plan = getActivePlan(state);

  const liveCaption = state.blackout
    ? 'Blackout'
    : live
      ? `${live.item.title} · ${live.index + 1}/${live.item.slides.length}`
      : 'Clear';
  const nextCaption = next ? `${next.item.title} · ${next.index + 1}/${next.item.slides.length}` : 'End of service';
  const queued = !!state.preview;

  return (
    <div className="live-studio">
      <div className="monitors">
        <Monitor label="Live output" tone="live" caption={liveCaption} action={<SendToObsButton obsConnected={obs.state?.connection === 'connected'} />}>
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
          <AlertBar alert={state.alert} />
          </div>
        </Monitor>
        <Monitor
          label={queued ? 'Preview' : 'Next'}
          tone="next"
          caption={nextCaption}
          action={
            <div className="monitor-actions">
              <div className="segmented segmented-sm" role="radiogroup" aria-label="What a click on a slide does">
                <button type="button" role="radio" aria-checked={clickMode === 'live'} className={clickMode === 'live' ? 'is-active' : undefined} onClick={() => setClickMode('live')} title="Clicking a slide sends it straight to the audience">
                  Click = Live
                </button>
                <button type="button" role="radio" aria-checked={clickMode === 'preview'} className={clickMode === 'preview' ? 'is-active' : undefined} onClick={() => setClickMode('preview')} title="Clicking a slide puts it in Preview; Take (Enter) sends it live">
                  Click = Preview
                </button>
              </div>
              {queued && (
                <button type="button" className="icon-btn" title="Remove from Preview (back to the next slide in order)" aria-label="Clear preview" onClick={() => dispatch({ type: 'clearPreview' })}>
                  <X size={13} />
                </button>
              )}
              <button type="button" className="btn btn-sm btn-primary" disabled={!next} onClick={() => dispatch({ type: 'take' })} title="Send this slide live (Enter)">
                <ArrowRightToLine size={13} aria-hidden="true" />
                Take
              </button>
            </div>
          }
        >
          <SlideView item={next?.item ?? null} slide={next?.slide ?? null} />
        </Monitor>
        <ObsMonitor obs={obs} />
      </div>

      <SlideGrid
        item={selected}
        live={state.live}
        next={nextPointer}
        nextIsPreview={queued}
        clickMode={clickMode}
        onGoLive={(slideIndex) => selected && dispatch({ type: 'goLive', itemId: selected.id, slideIndex })}
        onPreview={(slideIndex) => selected && dispatch({ type: 'setPreview', itemId: selected.id, slideIndex })}
      />

      <div className="live-side">
        <ServicePlaylist
          items={state.items}
          planName={plan ? plan.name.trim() || 'Untitled service' : null}
          onOpenPlanner={() => onNavigate('planner')}
          selectedId={state.selectedItemId}
          liveItemId={state.blackout ? null : state.live?.itemId ?? null}
          onSelect={(itemId) => dispatch({ type: 'selectItem', itemId })}
          onGoLive={(itemId) => dispatch({ type: 'goLive', itemId, slideIndex: 0 })}
        />
        <ObsDock obs={obs} onOpenBroadcast={() => onNavigate('broadcast')} />
      </div>
    </div>
  );
}
