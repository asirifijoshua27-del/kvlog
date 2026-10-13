import { useEffect, useRef, useState } from 'react';
import { Clapperboard, Eye, EyeOff, Layers, Mic, MicOff, PlugZap, Volume2 } from 'lucide-react';
import { EmptyState } from '../../components/Panel';
import { describeObsConnection, useObsLevels, type ObsControl } from '../../services/obs';
import { OutputControls } from '../broadcast/OutputControls';
import type { ObsAudioInput } from '../../../shared/obs-types';

type Tab = 'audio' | 'sources';

interface ObsDockProps {
  obs: ObsControl;
  onOpenBroadcast: () => void;
}

const MIN_DB = -60;

/** Fader travel 0–1 to dB, shaped like OBS's own faders (most of the travel is the useful range). */
function travelToDb(t: number): number {
  if (t <= 0) return -100;
  return Math.max(MIN_DB, 20 * Math.log10(t ** 3));
}
function dbToTravel(db: number): number {
  if (db <= MIN_DB) return 0;
  return Math.min(1, Math.cbrt(10 ** (db / 20)));
}
const levelPercent = (db: number | undefined) => (db === undefined ? 0 : Math.max(0, Math.min(100, ((db - MIN_DB) / -MIN_DB) * 100)));

function AudioRow({ input, level, disabled, onMute, onVolume }: { input: ObsAudioInput; level: number | undefined; disabled: boolean; onMute: () => void; onVolume: (db: number) => void }) {
  // Local fader value while dragging, so OBS echoes do not make it jump.
  const [dragging, setDragging] = useState<number | null>(null);
  const sendTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(sendTimer.current), []);
  const travel = dragging ?? dbToTravel(input.volumeDb);
  const db = travelToDb(travel);
  const pct = input.muted ? 0 : levelPercent(level);
  const clipping = !input.muted && level !== undefined && level > -3;

  return (
    <li className={`mix-row${input.muted ? ' is-muted' : ''}`}>
      <div className="mix-top">
        <span className="mix-name" title={input.name}>{input.name}</span>
        <span className="mix-db">{db <= -99 ? '−∞' : `${db.toFixed(1)} dB`}</span>
        <button
          type="button"
          className={`icon-btn mix-mute${input.muted ? ' is-on' : ''}`}
          aria-pressed={input.muted}
          disabled={disabled}
          title={input.muted ? `Unmute “${input.name}” in OBS` : `Mute “${input.name}” in OBS`}
          aria-label={input.muted ? 'Unmute' : 'Mute'}
          onClick={onMute}
        >
          {input.muted ? <MicOff size={14} /> : <Mic size={14} />}
        </button>
      </div>
      <div className="mix-meter" aria-hidden="true">
        <span className={`mix-level${clipping ? ' is-hot' : ''}`} style={{ width: `${pct}%` }} />
      </div>
      <input
        className="mix-fader"
        type="range"
        min={0}
        max={1}
        step={0.005}
        value={travel}
        aria-label={`${input.name} volume`}
        onChange={(e) => {
          const t = Number(e.target.value);
          setDragging(t);
          window.clearTimeout(sendTimer.current);
          sendTimer.current = window.setTimeout(() => onVolume(travelToDb(t)), 60);
        }}
        onPointerUp={() => window.setTimeout(() => setDragging(null), 300)}
        onKeyUp={() => window.setTimeout(() => setDragging(null), 300)}
        onDoubleClick={() => onVolume(0)}
        title="Drag to change the OBS volume. Double-click for 0 dB."
      />
    </li>
  );
}

export function ObsDock({ obs, onOpenBroadcast }: ObsDockProps) {
  const [tab, setTab] = useState<Tab>('audio');
  const state = obs.state;
  const connected = state?.connection === 'connected';
  const levels = useObsLevels(connected && tab === 'audio');

  if (!state || state.connection !== 'connected') {
    const waiting = state?.connection === 'connecting' || state?.connection === 'reconnecting';
    return (
      <section className="panel obs-dock" aria-label="OBS Studio">
        <header className="panel-head">
          <Clapperboard size={14} aria-hidden="true" />
          <h2>OBS Studio</h2>
          <span className="panel-meta">{describeObsConnection(state)}</span>
        </header>
        <div className="panel-body">
          <EmptyState
            icon={Clapperboard}
            title={waiting ? 'Connecting to OBS…' : 'OBS is not connected'}
            action={
              <div className="dock-actions">
                {state && !waiting && (
                  <button type="button" className="btn btn-primary" onClick={obs.connect} disabled={obs.busy}>
                    <PlugZap size={14} aria-hidden="true" />
                    Connect
                  </button>
                )}
                <button type="button" className="btn" onClick={onOpenBroadcast}>Connection settings</button>
              </div>
            }
          >
            {state ? state.error?.message ?? 'Connect to switch OBS scenes and check audio here.' : 'OBS is only available in the desktop app.'}
          </EmptyState>
        </div>
      </section>
    );
  }

  return (
    <section className="panel obs-dock" aria-label="OBS Studio">
      <header className="panel-head">
        <Clapperboard size={14} aria-hidden="true" />
        <h2>OBS Studio</h2>
        <span className="panel-meta" title={state.studioMode ? 'Studio Mode is on in OBS. Clicking a scene switches the program directly.' : undefined}>
          {describeObsConnection(state)}
          {state.studioMode ? ' · Studio Mode' : ''}
        </span>
      </header>
      <OutputControls obs={obs} compact />

      <div className="obs-scenes-wrap">
        <div className="obs-sub">Scenes <span>click to switch</span></div>
        {state.scenes.length === 0 ? (
          <p className="help obs-empty">OBS reports no scenes.</p>
        ) : (
          <div className="obs-scene-grid">
            {state.scenes.map((scene) => {
              const isProgram = scene.name === state.programScene;
              const isPreview = scene.name === state.previewScene;
              return (
                <button
                  key={scene.name}
                  type="button"
                  className={`obs-tile${isProgram ? ' is-program' : ''}${isPreview && !isProgram ? ' is-preview' : ''}`}
                  aria-pressed={isProgram}
                  disabled={obs.busy && !isProgram}
                  title={isProgram ? 'On program now' : `Switch the OBS program to “${scene.name}”`}
                  onClick={() => !isProgram && obs.setProgramScene(scene.name)}
                >
                  <span className="obs-tile-name">{scene.name}</span>
                  {isProgram && <span className="obs-tile-tag">Program</span>}
                  {isPreview && !isProgram && <span className="obs-tile-tag is-preview">Preview</span>}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="tabs" role="tablist" aria-label="OBS panels">
        <button type="button" role="tab" aria-selected={tab === 'audio'} className={`tab${tab === 'audio' ? ' is-active' : ''}`} onClick={() => setTab('audio')}>
          <Volume2 size={13} aria-hidden="true" /> Audio
        </button>
        <button type="button" role="tab" aria-selected={tab === 'sources'} className={`tab${tab === 'sources' ? ' is-active' : ''}`} onClick={() => setTab('sources')}>
          <Layers size={13} aria-hidden="true" /> Sources in scene
        </button>
      </div>
      <div className="panel-body" role="tabpanel">
        {tab === 'audio' ? (
          state.audio.length === 0 ? (
            <EmptyState icon={Volume2} title="No audio sources">OBS reports no sources with audio.</EmptyState>
          ) : (
            <ul className="mix-list">
              {state.audio.map((input) => (
                <AudioRow
                  key={input.name}
                  input={input}
                  level={levels[input.name]}
                  disabled={obs.busy}
                  onMute={() => obs.setMuted(input.name, !input.muted)}
                  onVolume={(db) => obs.setVolume(input.name, db)}
                />
              ))}
            </ul>
          )
        ) : state.sources.length === 0 ? (
          <EmptyState icon={Layers} title="No sources">The current OBS scene has no sources.</EmptyState>
        ) : (
          <ul className="obs-list">
            {state.sources.map((source) => (
              <li key={source.id} className={`obs-source${source.enabled ? '' : ' is-hidden'}`}>
                {source.enabled ? <Eye size={13} aria-label="Visible" /> : <EyeOff size={13} aria-label="Hidden" />}
                <span className="obs-source-name">{source.name}</span>
                <span className="obs-source-kind">{source.isGroup ? 'group' : source.kind.replace(/_/g, ' ')}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      {obs.actionError && <div className="panel-foot bad-text" role="alert">{obs.actionError}</div>}
    </section>
  );
}
