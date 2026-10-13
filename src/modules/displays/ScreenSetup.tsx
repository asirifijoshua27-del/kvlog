import { useEffect, useState, type Dispatch } from 'react';
import { Crosshair, RotateCcw } from 'lucide-react';
import { BUILT_IN_TEMPLATES } from '../../../shared/layout';
import { MAX_MARGIN, NO_MARGINS, STAGE_LAYOUTS, pictureFrame, type Margins, type ScreenSetup as Setup } from '../../../shared/extras';
import type { PresentationAction, PresentationState } from '../../state/presentation';

type Screen = 'projector' | 'obs' | 'stage';
const SCREENS: { id: Screen; label: string; help: string }[] = [
  { id: 'projector', label: 'Projector', help: 'If the projector or TV cuts off the edges, add margins until the yellow guide is fully visible. The picture shrinks to fit and keeps its shape.' },
  { id: 'obs', label: 'OBS', help: 'Shrinks the KVLOG picture inside OBS, e.g. to keep lyrics clear of a frame or a cropped phone view.' },
  { id: 'stage', label: 'Stage display', help: 'Keeps the stage display away from the edges of the confidence monitor.' }
];
const SIDES: { key: keyof Margins; label: string }[] = [
  { key: 'top', label: 'Top' },
  { key: 'bottom', label: 'Bottom' },
  { key: 'left', label: 'Left' },
  { key: 'right', label: 'Right' }
];

interface Props {
  state: PresentationState;
  dispatch: Dispatch<PresentationAction>;
}

/** Safe margins per screen, the OBS template and the stage display layout. */
export function ScreenSetup({ state, dispatch }: Props) {
  const screens = state.settings.screens;
  const [screen, setScreen] = useState<Screen>('projector');
  const set = (changes: Partial<Setup>) => dispatch({ type: 'updateSettings', changes: { screens: { ...screens, ...changes } } });
  const margins = screens[screen];
  const setMargins = (m: Margins) => set({ [screen]: m } as Partial<Setup>);
  const allSame = margins.top === margins.right && margins.top === margins.bottom && margins.top === margins.left;
  const f = pictureFrame(margins);

  // The guide is only for setting up: turn it off when leaving this page.
  useEffect(() => () => dispatch({ type: 'setScreenGuide', on: false }), [dispatch]);

  const custom = state.templates;
  const info = SCREENS.find((s) => s.id === screen)!;

  return (
    <>
      <h3 className="section-title">Screen setup</h3>
      <div className="role-grid">
        <section className="card">
          <header className="card-head">
            <h3>Safe margins</h3>
            <button type="button" className={`btn btn-sm${state.screenGuide ? ' btn-primary' : ''}`} aria-pressed={state.screenGuide}
              onClick={() => dispatch({ type: 'setScreenGuide', on: !state.screenGuide })} title="Shows a yellow frame on the projector, OBS and the stage display">
              <Crosshair size={13} aria-hidden="true" />
              {state.screenGuide ? 'Hide guide' : 'Show guide on screens'}
            </button>
          </header>
          <div className="card-body form-stack">
            <div className="segmented" role="tablist" aria-label="Screen">
              {SCREENS.map((s) => (
                <button key={s.id} type="button" role="tab" aria-selected={screen === s.id} className={screen === s.id ? 'is-active' : undefined} onClick={() => setScreen(s.id)}>
                  {s.label}
                </button>
              ))}
            </div>
            <p className="help">{info.help}</p>
            <div className="margin-setup">
              <div className="margin-preview" aria-hidden="true">
                <div className="margin-safe" style={{ inset: `${margins.top}% ${margins.right}% ${margins.bottom}% ${margins.left}%` }} />
                <div className="margin-picture" style={{ left: `${f.x}%`, top: `${f.y}%`, width: `${f.scale * 100}%`, height: `${f.scale * 100}%` }}>
                  {Math.round(f.scale * 100)}%
                </div>
              </div>
              <div className="form-stack">
                <label className="auto-row">
                  <span>All sides</span>
                  <span className="inline-row">
                    <input className="ins-range" type="range" min={0} max={MAX_MARGIN} step={0.5} value={allSame ? margins.top : Math.max(margins.top, margins.right, margins.bottom, margins.left)}
                      onChange={(e) => { const v = Number(e.target.value); setMargins({ top: v, right: v, bottom: v, left: v }); }} />
                  </span>
                </label>
                {SIDES.map((side) => (
                  <label key={side.key} className="auto-row">
                    <span>{side.label}</span>
                    <span className="inline-row">
                      <input className="ins-range" type="range" min={0} max={MAX_MARGIN} step={0.5} value={margins[side.key]}
                        onChange={(e) => setMargins({ ...margins, [side.key]: Number(e.target.value) })} />
                      <span className="margin-val">{margins[side.key]}%</span>
                    </span>
                  </label>
                ))}
                <button type="button" className="btn btn-sm" disabled={allSame && margins.top === 0} onClick={() => setMargins({ ...NO_MARGINS })}>
                  <RotateCcw size={12} aria-hidden="true" />No margins
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className="card">
          <header className="card-head"><h3>OBS look</h3></header>
          <div className="card-body form-stack">
            <p className="help">Use a different template in OBS than on the projector, e.g. a lower-third template for the stream while the room sees full-screen lyrics. Slides you designed yourself stay the same.</p>
            <label className="auto-row">
              <span>Template in OBS</span>
              <select className="input" value={screens.obsTemplate} onChange={(e) => set({ obsTemplate: e.target.value })}>
                <option value="same">Same as the projector</option>
                <option value="classic">Classic</option>
                <optgroup label="Built-in">
                  {BUILT_IN_TEMPLATES.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </optgroup>
                {custom.length > 0 && (
                  <optgroup label="Your templates">
                    {custom.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </optgroup>
                )}
                {screens.obsTemplate !== 'same' && screens.obsTemplate !== 'classic' && !BUILT_IN_TEMPLATES.some((t) => t.id === screens.obsTemplate) && !custom.some((t) => t.id === screens.obsTemplate) && (
                  <option value={screens.obsTemplate}>(deleted template: uses Classic)</option>
                )}
              </select>
            </label>
            <p className="help">Text over camera (Broadcast → KVLOG in OBS) still decides whether OBS shows a background.</p>
          </div>
        </section>

        <section className="card">
          <header className="card-head"><h3>Stage display layout</h3></header>
          <div className="card-body form-stack">
            <div className="layout-pick" role="radiogroup" aria-label="Stage display layout">
              {STAGE_LAYOUTS.map((l) => (
                <button key={l.id} type="button" role="radio" aria-checked={screens.stageLayout === l.id}
                  className={`layout-opt${screens.stageLayout === l.id ? ' is-active' : ''}`} onClick={() => set({ stageLayout: l.id })}>
                  <span className={`layout-thumb layout-thumb-${l.id}`} aria-hidden="true"><i /><i /><i /></span>
                  <strong>{l.label}</strong>
                  <span>{l.help}</span>
                </button>
              ))}
            </div>
            <label className="auto-row">
              <span>Text size</span>
              <span className="inline-row">
                <input className="ins-range" type="range" min={50} max={200} step={5} value={screens.stageTextScale} onChange={(e) => set({ stageTextScale: Number(e.target.value) })} />
                <span className="margin-val">{screens.stageTextScale}%</span>
              </span>
            </label>
            <label className="check">
              <input type="checkbox" checked={state.settings.stageChords} onChange={(e) => dispatch({ type: 'updateSettings', changes: { stageChords: e.target.checked } })} />
              <span>Show chords and the song key</span>
            </label>
          </div>
        </section>
      </div>
    </>
  );
}
