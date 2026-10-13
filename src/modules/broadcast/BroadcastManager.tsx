import { useEffect, useState, type Dispatch, type FormEvent } from 'react';
import { Info, PlugZap, Unplug } from 'lucide-react';
import type { ModuleMeta } from '../registry';
import { describeObsConnection, type ObsControl } from '../../services/obs';
import { OutputControls } from './OutputControls';
import { LyricsSourceCard } from './LyricsSourceCard';
import { ObsAutomationCard } from './ObsAutomationCard';
import type { PresentationAction, PresentationState } from '../../state/presentation';

interface BroadcastManagerProps {
  meta: ModuleMeta;
  obs: ObsControl;
  state: PresentationState;
  dispatch: Dispatch<PresentationAction>;
}

export function BroadcastManager({ meta, obs, state: presentation, dispatch }: BroadcastManagerProps) {
  const Icon = meta.icon;
  const state = obs.state;
  const [host, setHost] = useState('127.0.0.1');
  const [port, setPort] = useState('4455');
  const [password, setPassword] = useState('');
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [autoConnect, setAutoConnect] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loadedFromState, setLoadedFromState] = useState(false);

  // Fill the form from the saved settings once they arrive.
  useEffect(() => {
    if (!state || loadedFromState) return;
    setHost(state.settings.host);
    setPort(String(state.settings.port));
    setAutoConnect(state.settings.autoConnect);
    setLoadedFromState(true);
  }, [state, loadedFromState]);

  useEffect(() => {
    if (!saved) return;
    const timer = window.setTimeout(() => setSaved(false), 2500);
    return () => window.clearTimeout(timer);
  }, [saved]);

  if (!state) {
    return (
      <div className="page">
        <div className="page-inner">
          <div className="notice notice-error">
            <Info size={16} aria-hidden="true" />
            <span>OBS can only be reached from the KVLOG desktop app. Start it with “npm run dev”.</span>
          </div>
        </div>
      </div>
    );
  }

  const connected = state.connection === 'connected';
  const working = state.connection === 'connecting' || state.connection === 'reconnecting';
  const portNumber = Number(port);
  const portValid = Number.isInteger(portNumber) && portNumber >= 1 && portNumber <= 65535;

  const onSave = async (event: FormEvent) => {
    event.preventDefault();
    const ok = await obs.saveSettings({
      host: host.trim(),
      port: portNumber,
      password: passwordTouched ? password : null,
      autoConnect
    });
    if (ok) {
      setPassword('');
      setPasswordTouched(false);
      setSaved(true);
    }
  };

  const retryIn = state.nextRetryAt ? Math.max(0, Math.round((Date.parse(state.nextRetryAt) - Date.now()) / 1000)) : null;

  return (
    <div className="page">
      <div className="page-inner">
        <header className="page-header">
          <div className="page-icon" aria-hidden="true">
            <Icon size={20} strokeWidth={1.75} />
          </div>
          <div>
            <h2>{meta.label}</h2>
            <p>Connect KVLOG to OBS Studio on this computer or your network. OBS does the video, streaming and recording.</p>
          </div>
        </header>

        <section className="card">
          <header className="card-head">
            <span className={`conn-dot conn-${state.connection}${state.error && !connected ? ' conn-error' : ''}`} aria-hidden="true" />
            <h3>{describeObsConnection(state)}</h3>
            <span className="panel-meta">{state.settings.host}:{state.settings.port}</span>
            <div className="panel-actions">
              {connected || working || state.nextRetryAt ? (
                <button type="button" className="btn btn-sm" onClick={obs.disconnect} disabled={obs.busy}>
                  <Unplug size={13} aria-hidden="true" />
                  {connected ? 'Disconnect' : 'Stop trying'}
                </button>
              ) : (
                <button type="button" className="btn btn-sm btn-primary" onClick={obs.connect} disabled={obs.busy}>
                  <PlugZap size={13} aria-hidden="true" />
                  Connect
                </button>
              )}
            </div>
          </header>
          <div className="card-body conn-body">
            {state.error && (
              <p className={connected ? 'help' : 'bad-text'} role="alert">
                {state.error.message}
                {retryIn !== null && ` Trying again in ${retryIn} s.`}
              </p>
            )}
            {connected && (
              <dl className="kv">
                <dt>OBS version</dt><dd>{state.obsVersion ?? 'Unknown'}</dd>
                <dt>WebSocket version</dt><dd>{state.websocketVersion ?? 'Unknown'}</dd>
                <dt>Scenes</dt><dd>{state.scenes.length}</dd>
                <dt>Program scene</dt><dd>{state.programScene ?? 'None'}</dd>
                <dt>Studio Mode</dt><dd>{state.studioMode ? `On · preview: ${state.previewScene ?? 'none'}` : 'Off'}</dd>
              </dl>
            )}
            {!connected && !state.error && !working && <p className="help">Not connected. Check the settings below, then click Connect.</p>}
          </div>
        </section>

        <section className="card">
          <header className="card-head"><h3>Connection settings</h3></header>
          <form className="card-body conn-form" onSubmit={onSave}>
            <div className="field-row">
              <label className="field">
                <span className="field-label">Address</span>
                <input className="input" value={host} spellCheck={false} onChange={(e) => setHost(e.target.value)} placeholder="127.0.0.1" />
              </label>
              <label className="field">
                <span className="field-label">Port</span>
                <input className="input" value={port} inputMode="numeric" onChange={(e) => setPort(e.target.value.replace(/[^0-9]/g, ''))} placeholder="4455" />
              </label>
            </div>
            <label className="field">
              <span className="field-label">
                Password
                <span className="field-hint">{state.settings.hasPassword ? 'A password is saved. Leave empty to keep it.' : 'No password saved'}</span>
              </span>
              <div className="password-row">
                <input
                  className="input"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  autoComplete="off"
                  spellCheck={false}
                  placeholder={state.settings.hasPassword ? '••••••••' : 'From OBS → Tools → WebSocket Server Settings'}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setPasswordTouched(true);
                  }}
                />
                <button type="button" className="btn" onClick={() => setShowPassword((v) => !v)}>{showPassword ? 'Hide' : 'Show'}</button>
                {state.settings.hasPassword && (
                  <button type="button" className="btn" onClick={() => { setPassword(''); setPasswordTouched(true); }} title="Remove the saved password when you save">
                    Clear
                  </button>
                )}
              </div>
            </label>
            <label className="check">
              <input type="checkbox" checked={autoConnect} onChange={(e) => setAutoConnect(e.target.checked)} />
              <span>Connect automatically when KVLOG starts</span>
            </label>
            {!state.settings.canStorePassword && (
              <p className="bad-text">Windows cannot encrypt the password on this computer, so it is kept only until KVLOG closes.</p>
            )}
            {passwordTouched && password === '' && state.settings.hasPassword && <p className="help">The saved password will be removed.</p>}
            <div className="form-actions">
              <button type="submit" className="btn btn-primary" disabled={!host.trim() || !portValid || obs.busy}>Save</button>
              {saved && <span className="ok-text">Saved</span>}
              {obs.actionError && <span className="bad-text" role="alert">{obs.actionError}</span>}
            </div>
            <p className="help">The password is encrypted by Windows and stored only on this computer. It is never shown or written to logs.</p>
          </form>
        </section>

        <section className="card">
          <header className="card-head"><h3>Stream and recording</h3><span className="panel-meta">Reported by OBS</span></header>
          <div className="card-body">
            {connected ? (
              <OutputControls obs={obs} />
            ) : (
              <p className="help">Connect to OBS to start and stop the stream and recording. Stream settings (service, key, quality) stay in OBS.</p>
            )}
            {connected && <p className="help help-gap">Go live and Stop need a second click. Stream service, key and quality are set in OBS.</p>}
          </div>
        </section>

        <ObsAutomationCard state={presentation} dispatch={dispatch} scenes={state.scenes.map((s) => s.name)} connected={connected} />

        <LyricsSourceCard obsConnected={connected} />
      </div>
    </div>
  );
}
