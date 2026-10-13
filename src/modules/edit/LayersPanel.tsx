import { ArrowDown, ArrowUp, Eye, EyeOff, Lock, LockOpen } from 'lucide-react';
import { ROLE_LABELS, type LayoutBox } from '../../../shared/layout';

interface LayersPanelProps {
  boxes: LayoutBox[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onToggle: (id: string, field: 'hidden' | 'locked') => void;
  onMove: (id: string, dir: 1 | -1) => void;
}

function describe(box: LayoutBox): string {
  const words = box.text.trim().split('\n')[0];
  return words ? `${ROLE_LABELS[box.role]}: ${words.slice(0, 28)}` : ROLE_LABELS[box.role];
}

/** Every object on the slide, top layer first. */
export function LayersPanel({ boxes, selectedId, onSelect, onToggle, onMove }: LayersPanelProps) {
  const top = [...boxes].reverse();
  return (
    <section className="layers" aria-label="Layers">
      <header className="layers-head">
        <h3>Layers</h3>
        <span className="panel-meta">Top first</span>
      </header>
      <ul className="layers-list">
        {top.length === 0 && <li className="help layers-empty">No objects on this slide.</li>}
        {top.map((box, i) => (
          <li key={box.id} className={`layer-row${box.id === selectedId ? ' is-selected' : ''}${box.hidden ? ' is-hidden' : ''}`}>
            <button type="button" className="layer-name" onClick={() => onSelect(box.id)} title={describe(box)}>
              {describe(box)}
            </button>
            <button type="button" className="icon-btn" title="Bring forward" aria-label="Bring forward" disabled={i === 0} onClick={() => onMove(box.id, 1)}><ArrowUp size={12} /></button>
            <button type="button" className="icon-btn" title="Send backward" aria-label="Send backward" disabled={i === top.length - 1} onClick={() => onMove(box.id, -1)}><ArrowDown size={12} /></button>
            <button type="button" className={`icon-btn${box.locked ? ' is-on' : ''}`} title={box.locked ? 'Unlock' : 'Lock (stops moving and deleting)'} aria-label={box.locked ? 'Unlock' : 'Lock'} aria-pressed={box.locked} onClick={() => onToggle(box.id, 'locked')}>
              {box.locked ? <Lock size={12} /> : <LockOpen size={12} />}
            </button>
            <button type="button" className={`icon-btn${box.hidden ? ' is-on' : ''}`} title={box.hidden ? 'Show' : 'Hide on all screens'} aria-label={box.hidden ? 'Show' : 'Hide'} aria-pressed={box.hidden} onClick={() => onToggle(box.id, 'hidden')}>
              {box.hidden ? <EyeOff size={12} /> : <Eye size={12} />}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
