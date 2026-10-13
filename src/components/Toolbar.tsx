import type { Dispatch } from 'react';
import { ChevronLeft, ChevronRight, Eraser, EyeOff, MonitorPlay, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { StatusPill, type PillTone } from './StatusPill';
import { AlertControl } from './AlertControl';
import { describeObsConnection } from '../services/obs';
import type { ObsOutputStatus, ObsState } from '../../shared/obs-types';
import { useClock } from '../services/useClock';
import type { PresentationAction, PresentationState } from '../state/presentation';

interface ToolbarProps {
  title: string;
  description: string;
  state: PresentationState;
  dispatch: Dispatch<PresentationAction>;
  onPresent: () => void;
  /** True while the projector output is showing. */
  presenting: boolean;
  obs: ObsState | null;
  navHidden: boolean;
  onToggleNav: () => void;
}

function obsTone(obs: ObsState | null): PillTone {
  if (!obs) return 'idle';
  if (obs.connection === 'connected') return 'ok';
  if (obs.connection !== 'disconnected' || obs.error) return 'warn';
  return 'idle';
}

/** Stream/record pill. Shows "Unknown" rather than guessing when OBS does not report it. */
function outputPill(obs: ObsState | null, status: ObsOutputStatus | null, flagText: string): { value: string; tone: PillTone } {
  if (!obs || obs.connection !== 'connected') return { value: 'Unavailable', tone: 'idle' };
  if (!status) return { value: 'Unknown', tone: 'idle' };
  if (!status.active) return { value: 'Off', tone: 'idle' };
  return { value: status.flag ? flagText : status.timecode.split('.')[0], tone: status.flag ? 'warn' : 'live' };
}

export function Toolbar({ title, description, state, dispatch, onPresent, presenting, obs, navHidden, onToggleNav }: ToolbarProps) {
  const clock = useClock();
  const stream = outputPill(obs, obs?.stream ?? null, 'Reconnecting');
  const record = outputPill(obs, obs?.record ?? null, 'Paused');
  const needsObs = 'Requires an OBS connection';
  const hasOutput = state.live !== null || state.blackout;

  return (
    <header className="toolbar">
      <button type="button" className="tool-btn" onClick={onToggleNav} aria-pressed={!navHidden}
        title={navHidden ? 'Show the menu (Ctrl+\\)' : 'Hide the menu (Ctrl+\\)'} aria-label={navHidden ? 'Show the menu' : 'Hide the menu'}>
        {navHidden ? <PanelLeftOpen size={16} aria-hidden="true" /> : <PanelLeftClose size={16} aria-hidden="true" />}
      </button>
      <div className="toolbar-title">
        <h1>{title}</h1>
        <p>{description}</p>
      </div>

      <div className="toolbar-transport" role="group" aria-label="Presentation output controls">
        <button type="button" className="tool-btn" title="Previous slide (←)" aria-label="Previous slide"
          disabled={!state.live} onClick={() => dispatch({ type: 'step', delta: -1 })}>
          <ChevronLeft size={16} aria-hidden="true" />
        </button>
        <button type="button" className="tool-btn" title="Next slide (→ or Space)" aria-label="Next slide"
          onClick={() => dispatch({ type: 'step', delta: 1 })}>
          <ChevronRight size={16} aria-hidden="true" />
        </button>
        <span className="toolbar-divider" aria-hidden="true" />
        <button type="button" className={`tool-btn labeled${state.blackout ? ' is-on' : ''}`} title="Blackout (B)"
          aria-pressed={state.blackout} onClick={() => dispatch({ type: 'toggleBlackout' })}>
          <EyeOff size={15} aria-hidden="true" />
          <span className="tool-btn-text">Blackout</span>
        </button>
        <button type="button" className="tool-btn labeled" title="Clear output (Esc)" disabled={!hasOutput}
          onClick={() => dispatch({ type: 'clear' })}>
          <Eraser size={15} aria-hidden="true" />
          <span className="tool-btn-text">Clear</span>
        </button>
        <AlertControl state={state} dispatch={dispatch} />
        <button type="button" className={`tool-btn labeled${presenting ? ' is-live' : ''}`} aria-pressed={presenting}
          title={presenting ? 'Close the projector (F5)' : 'Open the projector (F5)'} onClick={onPresent}>
          <MonitorPlay size={15} aria-hidden="true" />
          <span className="tool-btn-text">{presenting ? 'Projector on' : 'Present'}</span>
        </button>
      </div>

      <div className="toolbar-status">
        <StatusPill label="OBS" value={describeObsConnection(obs)} tone={obsTone(obs)} title={obs?.error?.message} />
        <StatusPill label="Stream" value={stream.value} tone={stream.tone} title={obs?.connection === 'connected' ? 'Reported by OBS' : needsObs} />
        <StatusPill label="Rec" value={record.value} tone={record.tone} title={obs?.connection === 'connected' ? 'Reported by OBS' : needsObs} />
        <time className="clock" aria-label="Current time">{clock}</time>
      </div>
    </header>
  );
}
