import { useEffect, useState, type FormEvent } from 'react';
import { Copy, MonitorUp } from 'lucide-react';
import { useLyricsSource } from '../../services/obs';
import type { ObsOutputMode } from '../../../shared/obs-types';

const MODES: { id: ObsOutputMode; label: string; help: string }[] = [
  { id: 'full', label: 'Full screen', help: 'OBS shows exactly what the projector shows: backgrounds, pictures, videos and slides. It covers the camera while something is live.' },
  { id: 'overlay', label: 'Text over camera', help: 'Song, scripture and announcement text appears over the camera with a see-through background. Pictures, videos and presentations are still full screen.' }
];

interface LyricsSourceCardProps {
  obsConnected: boolean;
}

/** Turns on the local output page and adds it to OBS as a Browser Source. */
export function LyricsSourceCard({ obsConnected }: LyricsSourceCardProps) {
  const lyrics = useLyricsSource();
  const state = lyrics.state;
  const [enabled, setEnabled] = useState(false);
  const [port, setPort] = useState('4460');
  const [mode, setMode] = useState<ObsOutputMode>('full');
  const [loaded, setLoaded] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!state || loaded) return;
    setEnabled(state.enabled);
    setPort(String(state.port));
    setMode(state.mode);
    setLoaded(true);
  }, [state, loaded]);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(timer);
  }, [copied]);

  if (!state) return null;

  const portNumber = Number(port);
  const portValid = Number.isInteger(portNumber) && portNumber >= 1024 && portNumber <= 65535;
  const dirty = enabled !== state.enabled || portNumber !== state.port || mode !== state.mode;

  const onSave = (event: FormEvent) => {
    event.preventDefault();
    void lyrics.save({ enabled, port: portNumber, mode });
  };

  const copy = () => {
    navigator.clipboard.writeText(state.url).then(() => setCopied(true), () => undefined);
  };

  let status: string;
  if (state.running) status = state.clients === 0 ? 'On · no Browser Source is showing it yet' : `On · showing in ${state.clients} Browser Source${state.clients === 1 ? '' : 's'}`;
  else if (state.enabled) status = 'Not running';
  else status = 'Off';

  return (
    <section className="card">
      <header className="card-head">
        <span className={`conn-dot${state.running ? ' conn-connected' : state.error ? ' conn-error' : ''}`} aria-hidden="true" />
        <h3>KVLOG in OBS</h3>
        <span className="panel-meta">{status}</span>
      </header>
      <form className="card-body conn-form" onSubmit={onSave}>
        <p className="help">
          Sends the live slide to OBS as a Browser Source, with the same fade or cut as the projector. It follows Live Studio.
          On Clear or Blackout it becomes see-through, so your camera shows.
        </p>
        <div className="field">
          <span className="field-label">What OBS shows</span>
          <div className="segmented" role="radiogroup" aria-label="What OBS shows">
            {MODES.map((m) => (
              <button key={m.id} type="button" role="radio" aria-checked={mode === m.id} className={mode === m.id ? 'is-active' : undefined} onClick={() => setMode(m.id)}>
                {m.label}
              </button>
            ))}
          </div>
          <p className="help help-tight">{MODES.find((m) => m.id === mode)?.help}</p>
        </div>
        <div className="field-row">
          <label className="check">
            <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
            <span>Turn on KVLOG in OBS</span>
          </label>
          <label className="field">
            <span className="field-label">Port<span className="field-hint">1024–65535</span></span>
            <input className="input" value={port} inputMode="numeric" onChange={(e) => setPort(e.target.value.replace(/[^0-9]/g, ''))} />
          </label>
        </div>
        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={!portValid || !dirty || lyrics.busy}>Save</button>
          {state.error && <span className="bad-text" role="alert">{state.error}</span>}
        </div>

        {state.running && (
          <>
            <label className="field">
              <span className="field-label">Browser Source address</span>
              <div className="password-row">
                <input className="input mono" value={state.url} readOnly onFocus={(e) => e.target.select()} />
                <button type="button" className="btn" onClick={copy}>
                  <Copy size={13} aria-hidden="true" />
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
            </label>
            <div className="form-actions">
              <button type="button" className="btn" onClick={lyrics.addToObs} disabled={!obsConnected || lyrics.busy}
                title={obsConnected ? 'Create “KVLOG Output” in the current OBS scene' : 'Connect to OBS first'}>
                <MonitorUp size={13} aria-hidden="true" />
                Add to current OBS scene
              </button>
              {lyrics.message && <span className="ok-text" role="status">{lyrics.message}</span>}
            </div>
            <p className="help">
              Or add it by hand: in OBS, Sources → + → Browser, paste the address, size 1920 × 1080.
              Video sound goes to OBS: tick “Control audio via OBS” in the source's properties (KVLOG does this when it adds the source).
              For “Text over camera”, you can add options to the address, for example <code>?position=center&amp;size=72&amp;band=1</code>
              (position: bottom, center or top · size: text size in pixels · band=1: dark strip behind the text).
              If you added “KVLOG Lyrics” before, delete that source in OBS; “KVLOG Output” replaces it.
            </p>
          </>
        )}
        {lyrics.error && <p className="bad-text" role="alert">{lyrics.error}</p>}
        <p className="help">The page is only available on this computer (127.0.0.1), so OBS must run on the same PC as KVLOG.</p>
      </form>
    </section>
  );
}
