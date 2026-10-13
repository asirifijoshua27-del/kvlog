import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { SlideView } from '../../components/SlideView';
import { ROLE_LABELS, resolveBoxes, type LayoutBox, type LayoutItem, type LayoutSlide } from '../../../shared/layout';
import type { BackgroundRef, ItemKind } from '../../types';
import type { PictureFilter } from '../../../shared/filters';

type Handle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';
const HANDLES: Handle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
const SNAP = 0.8;
const MIN_SIZE = 2;

interface Drag {
  id: string;
  mode: 'move' | Handle;
  startX: number;
  startY: number;
  start: LayoutBox;
  rect: DOMRect;
  moved: boolean;
}

interface Guides {
  x: number[];
  y: number[];
}

interface EditorCanvasProps {
  kind: ItemKind;
  item: LayoutItem;
  slide: LayoutSlide | null;
  background: BackgroundRef;
  boxes: LayoutBox[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onCommit: (boxes: LayoutBox[]) => void;
  onEditText: (id: string) => void;
  bgFilter?: PictureFilter | null;
}

const round = (n: number) => Math.round(n * 10) / 10;

/** Snaps a box's edges/centre to the slide centre, safe margins and other boxes. */
function snap(box: LayoutBox, others: LayoutBox[], moving: boolean): { box: LayoutBox; guides: Guides } {
  const xs = [0, 5, 50, 95, 100, ...others.flatMap((o) => [o.x, o.x + o.w / 2, o.x + o.w])];
  const ys = [0, 5, 50, 95, 100, ...others.flatMap((o) => [o.y, o.y + o.h / 2, o.y + o.h])];
  const guides: Guides = { x: [], y: [] };
  const next = { ...box };
  if (moving) {
    const tryAxis = (pos: number, size: number, targets: number[], out: number[]): number => {
      for (const anchor of [0, size / 2, size]) {
        const hit = targets.find((t) => Math.abs(pos + anchor - t) < SNAP);
        if (hit !== undefined) {
          out.push(hit);
          return hit - anchor;
        }
      }
      return pos;
    };
    next.x = tryAxis(box.x, box.w, xs, guides.x);
    next.y = tryAxis(box.y, box.h, ys, guides.y);
  }
  return { box: next, guides };
}

/** The 16:9 design surface: drag boxes to move them, drag the handles to resize. Alt turns snapping off. */
export function EditorCanvas({ kind, item, slide, background, boxes, selectedId, onSelect, onCommit, onEditText, bgFilter = null }: EditorCanvasProps) {
  const surface = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  const [draft, setDraftState] = useState<LayoutBox[] | null>(null);
  const draftRef = useRef<LayoutBox[] | null>(null);
  const setDraft = (next: LayoutBox[] | null) => {
    draftRef.current = next;
    setDraftState(next);
  };
  const [guides, setGuides] = useState<Guides>({ x: [], y: [] });
  const shown = draft ?? boxes;

  // A new item/slide/template while dragging: drop the draft.
  useEffect(() => {
    drag.current = null;
    setDraft(null);
  }, [boxes]);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const d = drag.current;
      if (!d) return;
      const dx = ((e.clientX - d.startX) / d.rect.width) * 100;
      const dy = ((e.clientY - d.startY) / d.rect.height) * 100;
      if (!d.moved && Math.abs(dx) < 0.3 && Math.abs(dy) < 0.3) return;
      d.moved = true;
      const s = d.start;
      let next: LayoutBox = { ...s };
      if (d.mode === 'move') {
        next.x = s.x + dx;
        next.y = s.y + dy;
      } else {
        const m = d.mode;
        if (m.includes('e')) next.w = Math.max(MIN_SIZE, s.w + dx);
        if (m.includes('s')) next.h = Math.max(MIN_SIZE, s.h + dy);
        if (m.includes('w')) {
          const w = Math.max(MIN_SIZE, s.w - dx);
          next.x = s.x + s.w - w;
          next.w = w;
        }
        if (m.includes('n')) {
          const h = Math.max(MIN_SIZE, s.h - dy);
          next.y = s.y + s.h - h;
          next.h = h;
        }
        // Shift on a corner keeps the shape (useful for logos).
        if (e.shiftKey && m.length === 2) {
          const ratio = s.w / s.h;
          next.h = next.w / ratio;
          if (m.includes('n')) next.y = s.y + s.h - next.h;
        }
      }
      const others = boxes.filter((b) => b.id !== d.id);
      const snapped = e.altKey ? { box: next, guides: { x: [], y: [] } } : snap(next, others, d.mode === 'move');
      next = { ...snapped.box, x: round(snapped.box.x), y: round(snapped.box.y), w: round(snapped.box.w), h: round(snapped.box.h) };
      setGuides(snapped.guides);
      setDraft(boxes.map((b) => (b.id === d.id ? next : b)));
    };
    const onUp = () => {
      const d = drag.current;
      if (!d) return;
      drag.current = null;
      setGuides({ x: [], y: [] });
      const current = draftRef.current;
      setDraft(null);
      if (d.moved && current) onCommit(current);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [boxes, onCommit]);

  const begin = (e: ReactPointerEvent, box: LayoutBox, mode: Drag['mode']) => {
    if (e.button !== 0 || !surface.current) return;
    e.stopPropagation();
    e.preventDefault();
    onSelect(box.id);
    if (box.locked) return;
    drag.current = { id: box.id, mode, startX: e.clientX, startY: e.clientY, start: box, rect: surface.current.getBoundingClientRect(), moved: false };
  };

  const rendered = resolveBoxes(shown, item, slide);

  return (
    <div className="ed-stage">
      <div className="ed-canvas" ref={surface} onPointerDown={() => onSelect(null)}>
        <SlideView item={{ kind, background, title: item.title, subtitle: item.subtitle }} slide={{ lines: [], layout: { background, bgFilter, boxes: rendered } }} />
        <div className="ed-overlay">
          <div className="ed-safe" aria-hidden="true" />
          {guides.x.map((x, i) => <div key={`gx${i}`} className="ed-guide ed-guide-v" style={{ left: `${x}%` }} />)}
          {guides.y.map((y, i) => <div key={`gy${i}`} className="ed-guide ed-guide-h" style={{ top: `${y}%` }} />)}
          {shown.filter((box) => !box.hidden).map((box) => {
            const selected = box.id === selectedId;
            return (
              <div
                key={box.id}
                className={`ed-box${selected ? ' is-selected' : ''}${box.locked ? ' is-locked' : ''}`}
                style={{ left: `${box.x}%`, top: `${box.y}%`, width: `${box.w}%`, height: `${box.h}%` }}
                onPointerDown={(e) => begin(e, box, 'move')}
                onDoubleClick={() => onEditText(box.id)}
                title={box.locked ? `${ROLE_LABELS[box.role]} · locked` : `${ROLE_LABELS[box.role]} · drag to move · double-click to edit`}
              >
                <span className="ed-box-label">{ROLE_LABELS[box.role]}{box.locked ? ' · locked' : ''}</span>
                {selected && !box.locked && HANDLES.map((h) => <span key={h} className={`ed-h ed-h-${h}`} onPointerDown={(e) => begin(e, box, h)} />)}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
