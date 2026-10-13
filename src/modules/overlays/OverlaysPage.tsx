import { useEffect, useRef, useState, type Dispatch, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, Copy, Layers2, Plus, Power, Trash2 } from 'lucide-react';
import type { ModuleMeta } from '../registry';
import { ConfirmButton } from '../../components/ConfirmButton';
import { EmptyState } from '../../components/Panel';
import { OverlayLayer } from '../../components/OverlayLayer';
import { SlideView } from '../../components/SlideView';
import { OVERLAY_ICONS } from '../live/OverlayDock';
import { newId } from '../../data/itemFactory';
import { resolvePointer, type PresentationAction, type PresentationState } from '../../state/presentation';
import { FONT_CHOICES } from '../../../shared/layout';
import { OVERLAY_KINDS, OVERLAY_LABELS, makeOverlay, type Overlay, type OverlayKind, type OutputOverlay } from '../../../shared/overlay';

interface OverlaysPageProps {
  meta: ModuleMeta;
  state: PresentationState;
  dispatch: Dispatch<PresentationAction>;
}

type Patch = Partial<Omit<Overlay, 'id' | 'kind'>>;

const PRESETS: { label: string; place: (o: Overlay) => Pick<Overlay, 'x' | 'y'> }[] = [
  { label: 'Top left', place: () => ({ x: 4, y: 4 }) },
  { label: 'Top right', place: (o) => ({ x: 96 - o.w, y: 4 }) },
  { label: 'Centre', place: (o) => ({ x: (100 - o.w) / 2, y: (100 - o.h) / 2 }) },
  { label: 'Bottom left', place: (o) => ({ x: 4, y: 96 - o.h }) },
  { label: 'Bottom right', place: (o) => ({ x: 96 - o.w, y: 96 - o.h }) }
];

function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <div className="ins-row">
      <span className="ins-label">{label}</span>
      <span className="ins-control">{children}</span>
      {hint && <span className="ovl-hint">{hint}</span>}
    </div>
  );
}

function Num({ value, onChange, step = 0.5, min, max }: { value: number; onChange: (n: number) => void; step?: number; min: number; max: number }) {
  return (
    <span className="ins-num">
      <input className="input" type="number" value={Math.round(value * 100) / 100} step={step} min={min} max={max}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (e.target.value !== '' && Number.isFinite(n)) onChange(Math.min(max, Math.max(min, n)));
        }} />
    </span>
  );
}

export function OverlaysPage({ meta, state, dispatch }: OverlaysPageProps) {
  const [selectedId, setSelectedId] = useState<string | null>(state.overlays[0]?.id ?? null);
  const selected = state.overlays.find((o) => o.id === selectedId) ?? state.overlays[0] ?? null;
  const surface = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: string; resize: boolean; x: number; y: number; start: Overlay; rect: DOMRect } | null>(null);
  const [draft, setDraft] = useState<Overlay | null>(null);
  const draftRef = useRef<Overlay | null>(null);
  const Icon = meta.icon;

  const patch = (changes: Patch) => selected && dispatch({ type: 'updateOverlay', overlayId: selected.id, changes });

  const add = (kind: OverlayKind) => {
    const o = makeOverlay(kind, newId());
    const sameKind = state.overlays.filter((x) => x.kind === kind).length;
    if (sameKind) o.name = `${o.name} ${sameKind + 1}`;
    if ((kind === 'logo' || kind === 'pip') && !o.mediaId) o.mediaId = state.media.find((m) => (kind === 'logo' ? m.kind === 'image' : true))?.id ?? null;
    dispatch({ type: 'createOverlay', overlay: o });
    setSelectedId(o.id);
  };

  const duplicate = () => {
    if (!selected) return;
    const copy = { ...selected, id: newId(), name: `${selected.name} copy` };
    dispatch({ type: 'createOverlay', overlay: copy });
    setSelectedId(copy.id);
  };

  // Drag to move, corner to resize. Commits once on release.
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const d = drag.current;
      if (!d) return;
      const dx = ((e.clientX - d.x) / d.rect.width) * 100;
      const dy = ((e.clientY - d.y) / d.rect.height) * 100;
      const r = (n: number) => Math.round(n * 10) / 10;
      const next = d.resize
        ? { ...d.start, w: r(Math.max(2, d.start.w + dx)), h: r(Math.max(2, d.start.h + dy)) }
        : { ...d.start, x: r(d.start.x + dx), y: r(d.start.y + dy) };
      draftRef.current = next;
      setDraft(next);
    };
    const onUp = () => {
      const d = drag.current;
      drag.current = null;
      const final = draftRef.current;
      draftRef.current = null;
      setDraft(null);
      if (d && final) dispatch({ type: 'updateOverlay', overlayId: d.id, changes: { x: final.x, y: final.y, w: final.w, h: final.h } });
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [dispatch]);

  const begin = (e: ReactPointerEvent, o: Overlay, resize: boolean) => {
    if (e.button !== 0 || !surface.current) return;
    e.preventDefault();
    e.stopPropagation();
    setSelectedId(o.id);
    drag.current = { id: o.id, resize, x: e.clientX, y: e.clientY, start: o, rect: surface.current.getBoundingClientRect() };
  };

  const live = resolvePointer(state, state.live);
  const refText = live ? [live.item.title, live.slide.footer || live.item.subtitle].filter(Boolean).join(' · ') : 'Amazing Grace · John Newton';
  const preview: OutputOverlay[] = state.overlays.map((o) => {
    const shown = draft && draft.id === o.id ? draft : o;
    const file = shown.mediaId ? state.media.find((m) => m.id === shown.mediaId)?.fileName ?? null : null;
    return { ...shown, since: state.overlayOn[o.id] ?? Date.now(), file, refText };
  });
  const selectedPreview = preview.find((p) => p.id === selected?.id);
  const visible = selected ? preview.filter((p) => p.id in state.overlayOn || p.id === selected.id) : [];

  return (
    <div className="ovp">
      <aside className="ovp-list">
        <header className="ovp-list-head">
          <Icon size={15} aria-hidden="true" />
          <h2>Overlays</h2>
          <select className="input ovp-add" value="" aria-label="Add overlay" onChange={(e) => e.target.value && add(e.target.value as OverlayKind)}>
            <option value="">+ Add…</option>
            {OVERLAY_KINDS.map((k) => <option key={k} value={k}>{OVERLAY_LABELS[k]}</option>)}
          </select>
        </header>
        <ul className="ovp-items">
          {state.overlays.map((o, i) => {
            const KindIcon = OVERLAY_ICONS[o.kind];
            const on = o.id in state.overlayOn;
            return (
              <li key={o.id} className={`ovp-item${o.id === selected?.id ? ' is-selected' : ''}`}>
                <button type="button" className="ovp-item-name" onClick={() => setSelectedId(o.id)}>
                  <KindIcon size={14} aria-hidden="true" />
                  <span>{o.name}</span>
                </button>
                <button type="button" className="icon-btn" disabled={i === 0} title="Draw below others" aria-label="Move down a layer" onClick={() => dispatch({ type: 'moveOverlay', overlayId: o.id, delta: -1 })}><ArrowDown size={12} /></button>
                <button type="button" className="icon-btn" disabled={i === state.overlays.length - 1} title="Draw above others" aria-label="Move up a layer" onClick={() => dispatch({ type: 'moveOverlay', overlayId: o.id, delta: 1 })}><ArrowUp size={12} /></button>
                <button type="button" className={`icon-btn ovp-power${on ? ' is-on' : ''}`} aria-pressed={on} title={on ? 'On now: click to turn off' : 'Turn on now'} aria-label={on ? 'Turn off' : 'Turn on'} onClick={() => dispatch({ type: 'setOverlay', overlayId: o.id, on: !on })}>
                  <Power size={13} />
                </button>
              </li>
            );
          })}
        </ul>
        {Object.keys(state.overlayOn).length > 0 && (
          <div className="ovp-alloff">
            <button type="button" className="btn btn-sm" onClick={() => dispatch({ type: 'allOverlaysOff' })}><Power size={13} aria-hidden="true" />Turn all off</button>
          </div>
        )}
        <p className="help ovp-help">The power button turns an overlay on or off right away, on the projector and/or OBS. Items lower in the list sit on top.</p>
      </aside>

      <section className="ovp-center">
        {!selected ? (
          <section className="card">
            <EmptyState icon={Layers2} title="No overlays yet">
              Choose <strong>+ Add…</strong> to create a logo, lower third, clock, countdown, ticker, song/verse bar or picture-in-picture.
            </EmptyState>
          </section>
        ) : (
          <>
            <div className="ed-stage">
              <div className="ed-canvas" ref={surface}>
                <SlideView item={live?.item ?? { kind: 'song', background: 'midnight' }} slide={live?.slide ?? { lines: ['Amazing grace, how sweet the sound', 'That saved a wretch like me'] }} />
                <div className="ovl-host-abs">
                  <OverlayLayer overlays={visible} target="all" />
                </div>
                <div className="ed-overlay">
                  <div className="ed-safe" aria-hidden="true" />
                  {selectedPreview && (
                    <div
                      className="ed-box is-selected"
                      style={{ left: `${selectedPreview.x}%`, top: `${selectedPreview.y}%`, width: `${selectedPreview.w}%`, height: `${selectedPreview.h}%` }}
                      onPointerDown={(e) => begin(e, selected, false)}
                      title="Drag to move"
                    >
                      <span className="ed-box-label">{selected.name}</span>
                      <span className="ed-h ed-h-se" onPointerDown={(e) => begin(e, selected, true)} />
                    </div>
                  )}
                </div>
              </div>
            </div>
            <p className="help-inline">
              Showing the live slide (or a sample), the overlays that are on, and the selected one. Drag it to move, drag the corner to resize.
            </p>
          </>
        )}
      </section>

      <aside className="ovp-form">
        {selected && (
          <div className="ins">
            <section className="ins-sec">
              <header className="ins-head">
                <h3>{OVERLAY_LABELS[selected.kind]}</h3>
                <div className="ins-actions">
                  <button type="button" className="icon-btn" title="Duplicate" aria-label="Duplicate" onClick={duplicate}><Copy size={14} /></button>
                  <ConfirmButton className="icon-btn" label={<Trash2 size={14} aria-label="Delete" />} confirmLabel="Delete?" onConfirm={() => dispatch({ type: 'deleteOverlay', overlayId: selected.id })} />
                </div>
              </header>
              <Field label="Name"><input className="input" value={selected.name} maxLength={200} onChange={(e) => patch({ name: e.target.value })} /></Field>
              <Field label="Show on">
                <label className="check"><input type="checkbox" checked={selected.projector} onChange={(e) => patch({ projector: e.target.checked })} /><span>Projector</span></label>
                <label className="check"><input type="checkbox" checked={selected.obs} onChange={(e) => patch({ obs: e.target.checked })} /><span>OBS</span></label>
              </Field>
              <Field label="Blackout">
                <label className="check"><input type="checkbox" checked={selected.keepOnBlackout} onChange={(e) => patch({ keepOnBlackout: e.target.checked })} /><span>Keep showing</span></label>
              </Field>
              <Field label="Turn off after">
                <Num value={selected.autoHideSeconds} step={1} min={0} max={3600} onChange={(n) => patch({ autoHideSeconds: n })} />
                <span className="ins-suffix">seconds (0 = stays on)</span>
              </Field>
            </section>

            <section className="ins-sec">
              <h3>Content</h3>
              {(selected.kind === 'logo' || selected.kind === 'pip') && (
                <Field label={selected.kind === 'pip' ? 'Video / picture' : 'Picture'}>
                  <select className="input" value={selected.mediaId ?? ''} onChange={(e) => patch({ mediaId: e.target.value || null })}>
                    <option value="">None</option>
                    {state.media.filter((m) => selected.kind === 'pip' || m.kind === 'image').map((m) => <option key={m.id} value={m.id}>{m.kind === 'video' ? 'Video: ' : ''}{m.name}</option>)}
                  </select>
                </Field>
              )}
              {(selected.kind === 'logo' || selected.kind === 'pip') && state.media.length === 0 && <p className="help">Add pictures or videos in the Media Library first. PNG logos with see-through backgrounds work best.</p>}
              {selected.kind === 'lowerThird' && (
                <>
                  <Field label="Name"><input className="input" value={selected.line1} onChange={(e) => patch({ line1: e.target.value })} /></Field>
                  <Field label="Title"><input className="input" value={selected.line2} onChange={(e) => patch({ line2: e.target.value })} /></Field>
                </>
              )}
              {selected.kind === 'ticker' && (
                <>
                  <textarea className="textarea" rows={3} value={selected.line1} onChange={(e) => patch({ line1: e.target.value.replace(/\n/g, ' ') })} placeholder="Text that scrolls across the screen" />
                  <Field label="Speed"><input className="ins-range" type="range" min={2} max={40} step={1} value={selected.tickerSpeed} onChange={(e) => patch({ tickerSpeed: Number(e.target.value) })} /></Field>
                </>
              )}
              {selected.kind === 'clock' && (
                <Field label="Format">
                  <label className="check"><input type="checkbox" checked={selected.clock24} onChange={(e) => patch({ clock24: e.target.checked })} /><span>24-hour</span></label>
                  <label className="check"><input type="checkbox" checked={selected.clockSeconds} onChange={(e) => patch({ clockSeconds: e.target.checked })} /><span>Seconds</span></label>
                </Field>
              )}
              {selected.kind === 'countdown' && (
                <>
                  <Field label="Count down">
                    <div className="segmented segmented-sm">
                      <button type="button" className={selected.countdownMode === 'duration' ? 'is-active' : undefined} onClick={() => patch({ countdownMode: 'duration' })}>For minutes</button>
                      <button type="button" className={selected.countdownMode === 'until' ? 'is-active' : undefined} onClick={() => patch({ countdownMode: 'until' })}>Until a time</button>
                    </div>
                  </Field>
                  {selected.countdownMode === 'duration' ? (
                    <Field label="Minutes"><Num value={selected.countdownMinutes} step={1} min={0.1} max={600} onChange={(n) => patch({ countdownMinutes: n })} /><span className="ins-suffix">from when it is turned on</span></Field>
                  ) : (
                    <Field label="Until"><input className="input" type="time" value={selected.countdownUntil.padStart(5, '0')} onChange={(e) => e.target.value && patch({ countdownUntil: e.target.value })} /></Field>
                  )}
                  <Field label="Label"><input className="input" value={selected.line1} onChange={(e) => patch({ line1: e.target.value })} placeholder="Service starts in" /></Field>
                  <Field label="At zero"><input className="input" value={selected.line2} onChange={(e) => patch({ line2: e.target.value })} placeholder="Leave empty to show 00:00" /></Field>
                </>
              )}
              {selected.kind === 'reference' && <p className="help">Shows the live item's title and reference (for example “John 3:16 · KJV” or “Amazing Grace · John Newton”). Hidden when nothing is live.</p>}
            </section>

            <section className="ins-sec">
              <h3>Position</h3>
              <div className="ovp-presets">
                {PRESETS.map((p) => <button key={p.label} type="button" className="btn btn-sm" onClick={() => patch(p.place(selected))}>{p.label}</button>)}
              </div>
              <div className="ins-grid4">
                {(['x', 'y', 'w', 'h'] as const).map((k) => (
                  <label key={k} className="ins-mini"><span>{k.toUpperCase()}</span><Num value={selected[k]} step={0.5} min={k === 'w' || k === 'h' ? 1 : -50} max={k === 'w' || k === 'h' ? 200 : 150} onChange={(n) => patch({ [k]: n })} /></label>
                ))}
              </div>
            </section>

            <section className="ins-sec">
              <h3>Look</h3>
              {selected.kind !== 'logo' && selected.kind !== 'pip' && (
                <>
                  <Field label="Font">
                    <select className="input" value={selected.font} onChange={(e) => patch({ font: e.target.value })}>
                      {FONT_CHOICES.map((f) => <option key={f} value={f}>{f}</option>)}
                    </select>
                  </Field>
                  <Field label="Text size"><Num value={selected.size} step={0.1} min={0.5} max={30} onChange={(n) => patch({ size: n })} /></Field>
                  <Field label="Text colour"><input className="ins-color" type="color" value={selected.textColor} onChange={(e) => patch({ textColor: e.target.value })} /></Field>
                  {(selected.kind === 'lowerThird' || selected.kind === 'ticker' || selected.kind === 'reference') && (
                    <Field label="Accent"><input className="ins-color" type="color" value={selected.accentColor} onChange={(e) => patch({ accentColor: e.target.value })} /></Field>
                  )}
                </>
              )}
              <Field label="Background">
                <input className="ins-color" type="color" value={selected.bgColor} onChange={(e) => patch({ bgColor: e.target.value })} />
                <input className="ins-range" type="range" min={0} max={1} step={0.05} value={selected.bgOpacity} onChange={(e) => patch({ bgOpacity: Number(e.target.value) })} aria-label="Background opacity" />
                <span className="ins-suffix">{Math.round(selected.bgOpacity * 100)}%</span>
              </Field>
              <Field label="Corners"><Num value={selected.radius} step={0.1} min={0} max={20} onChange={(n) => patch({ radius: n })} /></Field>
              <Field label="Transparency">
                <input className="ins-range" type="range" min={0.05} max={1} step={0.05} value={selected.alpha} onChange={(e) => patch({ alpha: Number(e.target.value) })} />
                <span className="ins-suffix">{Math.round(selected.alpha * 100)}%</span>
              </Field>
            </section>

            <section className="ins-sec">
              <button type="button" className={`btn${selected.id in state.overlayOn ? '' : ' btn-primary'}`} onClick={() => dispatch({ type: 'setOverlay', overlayId: selected.id, on: !(selected.id in state.overlayOn) })}>
                <Power size={14} aria-hidden="true" />
                {selected.id in state.overlayOn ? 'Turn off now' : 'Turn on now'}
              </button>
            </section>
          </div>
        )}
        {!selected && (
          <div className="ins"><section className="ins-sec"><button type="button" className="btn btn-primary" onClick={() => add('logo')}><Plus size={14} aria-hidden="true" />Add a logo</button></section></div>
        )}
      </aside>
    </div>
  );
}
