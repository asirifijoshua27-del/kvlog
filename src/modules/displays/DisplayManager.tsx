import { useState, type Dispatch } from 'react';
import { ScreenSetup } from './ScreenSetup';
import type { PresentationAction, PresentationState } from '../../state/presentation';
import { Eye, Info, MonitorPlay, MonitorSpeaker, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ModuleMeta } from '../registry';
import { identifyDisplay, type DisplaysState } from '../../services/desktopBridge';
import type { OutputsControl } from '../../services/outputs';
import type { OutputRole } from '../../../shared/output-types';
import type { DisplayInfo } from '../../../shared/bridge-types';

interface DisplayManagerProps {
  meta: ModuleMeta;
  displays: DisplaysState;
  outputs: OutputsControl;
  state: PresentationState;
  dispatch: Dispatch<PresentationAction>;
}

const ROLE_INFO: Record<OutputRole, { label: string; icon: LucideIcon; text: string }> = {
  projector: { label: 'Projector', icon: MonitorPlay, text: 'What the audience sees. Full screen, no text other than the slides.' },
  stage: { label: 'Stage display', icon: MonitorSpeaker, text: 'For people on stage: current and next slide, clock and notes.' }
};

function RoleCard({ role, displays, outputs }: { role: OutputRole; displays: DisplayInfo[]; outputs: OutputsControl }) {
  const info = ROLE_INFO[role];
  const Icon = info.icon;
  const status = outputs.status?.[role] ?? null;
  const assignedId = status?.assignment?.displayId ?? null;
  const assignedConnected = assignedId !== null && displays.some((d) => d.id === assignedId);
  const selectValue = assignedConnected ? String(assignedId) : 'window';
  const current = status?.open ? displays.find((d) => d.id === status.displayId) : undefined;

  let stateText = 'Closed';
  if (status?.open) stateText = status.fullscreen && current ? `Showing full screen on ${current.label}` : 'Open in a window';

  return (
    <section className="card role-card">
      <header className="card-head">
        <Icon size={15} aria-hidden="true" />
        <h3>{info.label}</h3>
        <span className={`tag tag-inline ${status?.open ? 'tag-live' : 'tag-neutral'}`}>{status?.open ? 'On' : 'Off'}</span>
      </header>
      <div className="card-body role-body">
        <p className="help">{info.text}</p>
        <label className="field">
          <span className="field-label">Show on</span>
          <select
            className="input"
            value={selectValue}
            disabled={!outputs.status}
            onChange={(e) => outputs.assign(role, e.target.value === 'window' ? null : Number(e.target.value))}
          >
            <option value="window">A normal window (for testing)</option>
            {displays.map((d) => (
              <option key={d.id} value={d.id}>
                {d.index}. {d.label} ({d.bounds.width}×{d.bounds.height}){d.isPrimary ? ' · main screen' : ''}
              </option>
            ))}
          </select>
        </label>
        {status?.assignment && !assignedConnected && (
          <p className="bad-text">{status.assignment.label} is not connected. It will be used again when you plug it back in.</p>
        )}
        {assignedConnected && displays.find((d) => d.id === assignedId)?.isPrimary && (
          <p className="help">This is the screen KVLOG is on. The output will cover it; press Esc on the output to close it.</p>
        )}
        {status?.problem && <p className="bad-text">{status.problem}</p>}
        <div className="role-actions">
          <span className="role-state">{stateText}</span>
          {status?.open ? (
            <button type="button" className="btn" onClick={() => outputs.close(role)}>
              <X size={14} aria-hidden="true" />
              Close
            </button>
          ) : (
            <button type="button" className="btn btn-primary" disabled={!outputs.status} onClick={() => outputs.open(role)}>
              <Icon size={14} aria-hidden="true" />
              Open {info.label.toLowerCase()}
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

export function DisplayManager({ meta, displays, outputs, state, dispatch }: DisplayManagerProps) {
  const [error, setError] = useState<string | null>(null);
  const Icon = meta.icon;
  const list = displays.displays ?? [];

  const onIdentify = async (id: number) => {
    setError(null);
    try {
      await identifyDisplay(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const problem = error ?? outputs.error ?? displays.error;

  return (
    <div className="page">
      <div className="page-inner">
        <header className="page-header">
          <div className="page-icon" aria-hidden="true">
            <Icon size={20} strokeWidth={1.75} />
          </div>
          <div>
            <h2>{meta.label}</h2>
            <p>Choose where the projector and stage display appear. KVLOG remembers your choice on this computer.</p>
          </div>
        </header>

        {problem && (
          <div className="notice notice-error" role="alert">
            <Info size={16} aria-hidden="true" />
            <span>{problem}</span>
          </div>
        )}

        <div className="role-grid">
          <RoleCard role="projector" displays={list} outputs={outputs} />
          <RoleCard role="stage" displays={list} outputs={outputs} />
        </div>

        <ScreenSetup state={state} dispatch={dispatch} />

        <h3 className="section-title">Connected screens</h3>
        <div className="display-grid">
          {list.map((d) => (
            <section key={d.id} className="card display-card">
              <div className="display-shape" style={{ aspectRatio: `${d.bounds.width} / ${d.bounds.height}` }}>
                {d.index}
              </div>
              <div className="display-head">
                <h3>{d.label}</h3>
                {d.isPrimary && <span className="tag tag-next">Main screen</span>}
              </div>
              <dl className="kv kv-compact">
                <dt>Resolution</dt>
                <dd>{d.bounds.width} × {d.bounds.height}</dd>
                <dt>Scale</dt>
                <dd>{Math.round(d.scaleFactor * 100)}%</dd>
                <dt>Refresh</dt>
                <dd>{d.refreshRate > 0 ? `${d.refreshRate} Hz` : 'Unknown'}</dd>
              </dl>
              <button type="button" className="btn" onClick={() => onIdentify(d.id)}>
                <Eye size={14} aria-hidden="true" />
                Identify
              </button>
            </section>
          ))}
        </div>

        <div className="notice">
          <Info size={16} aria-hidden="true" />
          <span>
            Only one screen? Choose “A normal window” to try both outputs side by side. To use a projector or TV, connect it and set
            Windows to <strong>Extend these displays</strong> (press Windows key + P).
          </span>
        </div>
      </div>
    </div>
  );
}
