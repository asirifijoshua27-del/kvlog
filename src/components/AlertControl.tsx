import { useEffect, useRef, useState, type Dispatch } from 'react';
import { BellRing, Plus, X } from 'lucide-react';
import type { PresentationAction, PresentationState } from '../state/presentation';

/** Toolbar button: one tap shows a message (nursery call…) on the projector and the stage display. */
export function AlertControl({ state, dispatch }: { state: PresentationState; dispatch: Dispatch<PresentationAction> }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const box = useRef<HTMLDivElement>(null);
  const presets = state.settings.alertPresets;
  const on = state.alert !== null;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setOpen(false);
      }
    };
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey, true);
    };
  }, [open]);

  const show = (message: string) => {
    dispatch({ type: 'showAlert', text: message });
    setOpen(false);
  };
  const setPresets = (alertPresets: string[]) => dispatch({ type: 'updateSettings', changes: { alertPresets } });
  const custom = text.trim();

  return (
    <div className="alert-ctl" ref={box}>
      <button type="button" className={`tool-btn labeled${on ? ' is-on alert-on' : ''}`} aria-expanded={open} aria-label={on ? 'Hide alert' : 'Alert'}
        title={on ? `Showing: ${state.alert?.text}` : 'Show an alert on the projector and stage display'}
        onClick={() => (on ? dispatch({ type: 'hideAlert' }) : setOpen((v) => !v))}>
        <BellRing size={15} aria-hidden="true" />
        <span className="tool-btn-text">{on ? 'Hide alert' : 'Alert'}</span>
      </button>
      {open && (
        <div className="alert-pop" role="dialog" aria-label="Show an alert">
          <div className="alert-pop-head">Tap a message to show it</div>
          <ul className="alert-presets">
            {presets.map((p, i) => (
              <li key={i}>
                <button type="button" className="alert-preset" onClick={() => show(p)}>{p}</button>
                <button type="button" className="icon-btn" aria-label="Remove this message" title="Remove" onClick={() => setPresets(presets.filter((_, j) => j !== i))}>
                  <X size={12} />
                </button>
              </li>
            ))}
          </ul>
          <textarea className="textarea" rows={2} value={text} placeholder="Type a message, e.g. Parent of Ama Mensah, please come to the nursery." maxLength={300}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && custom) {
                e.preventDefault();
                show(custom);
                setText('');
              }
            }} />
          <div className="inline-row">
            <button type="button" className="btn btn-primary btn-sm" disabled={!custom} onClick={() => { show(custom); setText(''); }}>Show</button>
            <button type="button" className="btn btn-sm" disabled={!custom || presets.includes(custom)} onClick={() => setPresets([...presets, custom].slice(0, 30))}>
              <Plus size={12} aria-hidden="true" />Save as a ready message
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
