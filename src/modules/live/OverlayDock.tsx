import type { Dispatch } from 'react';
import { BadgeInfo, Clock, Hourglass, Image as ImageIcon, Layers2, PictureInPicture2, Power, Rows3, ScrollText, type LucideIcon } from 'lucide-react';
import { EmptyState } from '../../components/Panel';
import { useNowSeconds } from './useNowSeconds';
import { countdownSeconds, formatCountdown, type Overlay, type OverlayKind } from '../../../shared/overlay';
import type { PresentationAction, PresentationState } from '../../state/presentation';

export const OVERLAY_ICONS: Record<OverlayKind, LucideIcon> = {
  logo: ImageIcon,
  lowerThird: Rows3,
  clock: Clock,
  countdown: Hourglass,
  ticker: ScrollText,
  reference: BadgeInfo,
  pip: PictureInPicture2
};

interface OverlayDockProps {
  state: PresentationState;
  dispatch: Dispatch<PresentationAction>;
  onOpenOverlays: () => void;
}

function status(o: Overlay, since: number | undefined, now: number): string | null {
  if (since === undefined) return null;
  if (o.kind === 'countdown') return formatCountdown(countdownSeconds(o, since, now));
  if (o.autoHideSeconds > 0) return `${Math.max(0, Math.ceil(o.autoHideSeconds - (now - since) / 1000))}s`;
  return null;
}

/** Live Studio: turn overlays on and off with one click. */
export function OverlayDock({ state, dispatch, onOpenOverlays }: OverlayDockProps) {
  const onCount = Object.keys(state.overlayOn).length;
  const now = useNowSeconds(onCount > 0);

  return (
    <section className="panel ovl-dock" aria-label="Overlays">
      <header className="panel-head">
        <Layers2 size={14} aria-hidden="true" />
        <h2>Overlays</h2>
        <span className="panel-meta">{onCount ? `${onCount} on` : 'All off'}</span>
        <div className="panel-actions">
          {onCount > 0 && (
            <button type="button" className="btn btn-sm" onClick={() => dispatch({ type: 'allOverlaysOff' })} title="Turn every overlay off">
              All off
            </button>
          )}
          <button type="button" className="btn btn-sm" onClick={onOpenOverlays}>Edit</button>
        </div>
      </header>
      <div className="panel-body">
        {state.overlays.length === 0 ? (
          <EmptyState icon={Layers2} title="No overlays yet">
            <button type="button" className="btn btn-sm btn-primary" onClick={onOpenOverlays}>Create overlays</button>
          </EmptyState>
        ) : (
          <ul className="ovl-dock-list">
            {state.overlays.map((o) => {
              const since = state.overlayOn[o.id];
              const on = since !== undefined;
              const Icon = OVERLAY_ICONS[o.kind];
              const info = status(o, since, now);
              return (
                <li key={o.id}>
                  <button
                    type="button"
                    className={`ovl-toggle${on ? ' is-on' : ''}`}
                    aria-pressed={on}
                    onClick={() => dispatch({ type: 'setOverlay', overlayId: o.id, on: !on })}
                    title={on ? 'Click to turn off' : 'Click to turn on'}
                  >
                    <Icon size={14} aria-hidden="true" />
                    <span className="ovl-toggle-name">{o.name}</span>
                    {info && <span className="ovl-toggle-info">{info}</span>}
                    <span className="ovl-targets">
                      {o.projector && <span title="Projector">P</span>}
                      {o.obs && <span title="OBS">OBS</span>}
                    </span>
                    <Power size={13} aria-hidden="true" className="ovl-power" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
