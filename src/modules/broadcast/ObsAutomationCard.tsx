import type { Dispatch } from 'react';
import { ITEM_KINDS, KIND_META } from '../../data/kinds';
import type { PresentationAction, PresentationState } from '../../state/presentation';
import type { ItemKind } from '../../types';

interface Props {
  state: PresentationState;
  dispatch: Dispatch<PresentationAction>;
  scenes: string[];
  connected: boolean;
}

/** Switch OBS scenes when an item goes live: a default per item type, and a choice on each item. */
export function ObsAutomationCard({ state, dispatch, scenes, connected }: Props) {
  const { obsAuto, obsSceneByKind } = state.settings;
  const setKind = (kind: ItemKind, scene: string) => {
    const next = { ...obsSceneByKind };
    if (scene) next[kind] = scene;
    else delete next[kind];
    dispatch({ type: 'updateSettings', changes: { obsSceneByKind: next } });
  };

  return (
    <section className="card">
      <header className="card-head"><h3>Automatic scene switching</h3></header>
      <div className="card-body form-stack">
        <label className="check">
          <input type="checkbox" checked={obsAuto} onChange={(e) => dispatch({ type: 'updateSettings', changes: { obsAuto: e.target.checked } })} />
          <span>Switch the OBS scene when an item goes live</span>
        </label>
        <p className="help">Choose a scene for each type of item. A single item can use a different scene: pick it under <strong>OBS scene</strong> in Presentation Studio.</p>
        <div className="auto-grid">
          {ITEM_KINDS.map((kind) => {
            const current = obsSceneByKind[kind] ?? '';
            const missing = current && connected && !scenes.includes(current);
            return (
              <label key={kind} className="auto-row">
                <span>{KIND_META[kind].label}</span>
                <select className="input" value={current} disabled={!obsAuto} onChange={(e) => setKind(kind, e.target.value)}>
                  <option value="">Don't switch</option>
                  {current && !scenes.includes(current) && <option value={current}>{current} (not in OBS)</option>}
                  {scenes.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                {missing && <span className="bad-text">Not found in OBS</span>}
              </label>
            );
          })}
        </div>
        {!connected && <p className="help">Connect to OBS to see its scenes.</p>}
      </div>
    </section>
  );
}
