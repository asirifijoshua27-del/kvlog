import type { ReactNode, RefObject } from 'react';
import {
  AlignCenter, AlignLeft, AlignRight, AlignVerticalJustifyCenter, AlignVerticalJustifyEnd, AlignVerticalJustifyStart,
  Bold, CaseUpper, Copy, Eye, EyeOff, Italic, Lock, LockOpen, Trash2
} from 'lucide-react';
import { BACKGROUNDS } from '../../data/backgrounds';
import { FONT_CHOICES, ROLE_LABELS, isTextRole, type LayoutBox, type SlideTemplate, type TextStyle } from '../../../shared/layout';
import type { BackgroundRef, MediaItem } from '../../types';
import type { PictureFilter } from '../../../shared/filters';
import { FilterControls } from './FilterControls';

export type BoxPatch = Partial<Omit<LayoutBox, 'style'>> & { style?: Partial<TextStyle> };

interface InspectorProps {
  box: LayoutBox | null;
  mode: 'template' | 'slide';
  /** The template being edited (only user templates can be renamed). */
  template: SlideTemplate | null;
  media: MediaItem[];
  textRef: RefObject<HTMLTextAreaElement>;
  onPatch: (patch: BoxPatch, key: string) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onTemplateChange: (changes: Partial<Pick<SlideTemplate, 'name' | 'background'>>, key: string) => void;
  /** Background filter for what is being edited (template or this slide). */
  bgFilter: PictureFilter | null;
  /** This slide has no filter of its own and shows the template's. */
  bgFilterInherited: boolean;
  onBgFilter: (next: PictureFilter | null, key: string) => void;
  /** Built-in backgrounds are gradients; filters other than Darken only change pictures and videos. */
  bgIsMedia: boolean;
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="ins-row">
      <span className="ins-label">{label}</span>
      <span className="ins-control">{children}</span>
    </label>
  );
}

function Num({ value, onChange, step = 0.5, min, max, suffix, disabled }: { value: number; onChange: (n: number) => void; step?: number; min?: number; max?: number; suffix?: string; disabled?: boolean }) {
  return (
    <span className="ins-num">
      <input
        className="input"
        type="number"
        value={Math.round(value * 100) / 100}
        step={step}
        disabled={disabled}
        min={min}
        max={max}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (e.target.value !== '' && Number.isFinite(n)) onChange(min !== undefined || max !== undefined ? Math.min(max ?? n, Math.max(min ?? n, n)) : n);
        }}
      />
      {suffix && <span className="ins-suffix">{suffix}</span>}
    </span>
  );
}

function Color({ value, onChange, label }: { value: string; onChange: (c: string) => void; label: string }) {
  return <input className="ins-color" type="color" aria-label={label} value={value.slice(0, 7) || '#000000'} onChange={(e) => onChange(e.target.value)} />;
}

function Toggle({ on, onClick, label, children }: { on: boolean; onClick: () => void; label: string; children: ReactNode }) {
  return (
    <button type="button" className={`ins-toggle${on ? ' is-on' : ''}`} aria-pressed={on} aria-label={label} title={label} onClick={onClick}>
      {children}
    </button>
  );
}

export function Inspector({ box, mode, template, media, textRef, onPatch, onDuplicate, onDelete, onTemplateChange, bgFilter, bgFilterInherited, onBgFilter, bgIsMedia }: InspectorProps) {
  if (!box) {
    const editable = template && !template.id.startsWith('builtin:');
    return (
      <div className="ins">
        <section className="ins-sec">
          <h3>{mode === 'slide' ? 'This slide' : 'Template'}</h3>
          {mode === 'template' && editable && template && (
            <>
              <Row label="Name">
                <input className="input" value={template.name} maxLength={200} onChange={(e) => onTemplateChange({ name: e.target.value }, 'tpl-name')} />
              </Row>
              <Row label="Background">
                <select
                  className="input"
                  value={template.background ?? ''}
                  onChange={(e) => onTemplateChange({ background: (e.target.value || null) as BackgroundRef | null }, 'tpl-bg')}
                >
                  <option value="">Each item's own background</option>
                  {BACKGROUNDS.map((bg) => <option key={bg.id} value={bg.id}>{bg.label}</option>)}
                  {media.map((m) => <option key={m.id} value={`media:${m.id}`}>{m.kind === 'video' ? 'Video: ' : 'Picture: '}{m.name}</option>)}
                </select>
              </Row>
            </>
          )}
          <p className="help">
            Click a box on the slide to change it, or add text, a picture or a shape above the slide.
            {mode === 'template' ? ' Changes apply to every slide and every item that uses this template.' : ' Changes apply to this slide only.'}
          </p>
          {mode === 'template' && !editable && <p className="help">Built-in templates are copied the first time you change them, so the original stays available.</p>}
          <p className="help">Keys: arrows move (Shift = bigger steps), Delete removes, Ctrl+D duplicates, Ctrl+Z / Ctrl+Y undo and redo. Hold Alt while dragging to stop snapping.</p>
        </section>
        <section className="ins-sec">
          <h3>{mode === 'slide' ? 'Background filter: this slide' : 'Background filter: all slides'}</h3>
          {mode === 'slide' && bgFilterInherited && bgFilter && <p className="help">Showing the template's filter. Changing it here gives this slide its own.</p>}
          <FilterControls value={bgFilter} onChange={onBgFilter} />
          {!bgIsMedia && <p className="help">This background is a built-in colour, so only Darken shows. Choose a picture or video background to use the other filters.</p>}
          {mode === 'template' && !editable && <p className="help">Changing a built-in template's filter makes an editable copy.</p>}
        </section>
      </div>
    );
  }

  const s = box.style;
  const text = isTextRole(box.role);
  const style = (patch: Partial<TextStyle>, key: string) => onPatch({ style: patch }, key);
  const images = media;

  return (
    <div className="ins">
      <section className="ins-sec">
        <header className="ins-head">
          <h3>{ROLE_LABELS[box.role]}</h3>
          <div className="ins-actions">
            <button type="button" className={`icon-btn${box.locked ? ' is-on' : ''}`} title={box.locked ? 'Unlock' : 'Lock'} aria-label={box.locked ? 'Unlock' : 'Lock'} aria-pressed={box.locked} onClick={() => onPatch({ locked: !box.locked }, 'locked')}>{box.locked ? <Lock size={14} /> : <LockOpen size={14} />}</button>
            <button type="button" className={`icon-btn${box.hidden ? ' is-on' : ''}`} title={box.hidden ? 'Show' : 'Hide'} aria-label={box.hidden ? 'Show' : 'Hide'} aria-pressed={box.hidden} onClick={() => onPatch({ hidden: !box.hidden }, 'hidden')}>{box.hidden ? <EyeOff size={14} /> : <Eye size={14} />}</button>
            <button type="button" className="icon-btn" title="Duplicate (Ctrl+D)" aria-label="Duplicate" onClick={onDuplicate}><Copy size={14} /></button>
            <button type="button" className="icon-btn" title="Delete (Del)" aria-label="Delete" disabled={box.locked} onClick={onDelete}><Trash2 size={14} /></button>
          </div>
        </header>
        {box.locked && <p className="help">Locked: unlock to move, resize or delete it.</p>}
        <div className="ins-grid4">
          {(['x', 'y', 'w', 'h'] as const).map((k) => (
            <label key={k} className="ins-mini">
              <span>{k.toUpperCase()}</span>
              <Num value={box[k]} step={0.5} disabled={box.locked} min={k === 'w' || k === 'h' ? 1 : -50} max={k === 'w' || k === 'h' ? 200 : 150} onChange={(n) => onPatch({ [k]: n }, `pos-${k}`)} />
            </label>
          ))}
        </div>
      </section>

      {text && (
        <section className="ins-sec">
          <h3>Text</h3>
          {box.role === 'text' && (
            <textarea ref={textRef} className="textarea" rows={3} value={box.text} placeholder="Type the text" onChange={(e) => onPatch({ text: e.target.value }, 'text')} />
          )}
          {box.role === 'content' && mode === 'slide' && (
            <>
              <textarea
                ref={textRef}
                className="textarea"
                rows={4}
                value={box.text}
                placeholder="Leave empty to use the item's words. Type here to change the words on this slide only."
                onChange={(e) => onPatch({ text: e.target.value }, 'text')}
              />
            </>
          )}
          {box.role === 'content' && mode === 'template' && <p className="help">Shows each slide's words. Edit the words in Presentation Studio, or switch to “This slide only” to change one slide.</p>}
          {box.role === 'title' && <p className="help">Shows the item's title.</p>}
          {box.role === 'reference' && <p className="help">Shows the scripture reference, or the item's second line (author, speaker).</p>}
        </section>
      )}

      {text && (
        <section className="ins-sec">
          <h3>Font</h3>
          <Row label="Font">
            <select className="input" value={s.font} onChange={(e) => style({ font: e.target.value }, 'font')} style={{ fontFamily: s.font }}>
              {FONT_CHOICES.map((f) => <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>)}
            </select>
          </Row>
          <Row label="Size">
            <Num value={s.size} step={0.2} min={0.5} max={30} onChange={(n) => style({ size: n }, 'size')} />
            <label className="check ins-inline">
              <input type="checkbox" checked={s.autoFit} onChange={(e) => style({ autoFit: e.target.checked }, 'autofit')} />
              <span>Shrink to fit</span>
            </label>
          </Row>
          <Row label="Colour">
            <Color label="Text colour" value={s.color} onChange={(c) => style({ color: c }, 'color')} />
            <div className="ins-toggles">
              <Toggle on={s.bold} label="Bold" onClick={() => style({ bold: !s.bold }, 'bold')}><Bold size={14} /></Toggle>
              <Toggle on={s.italic} label="Italic" onClick={() => style({ italic: !s.italic }, 'italic')}><Italic size={14} /></Toggle>
              <Toggle on={s.uppercase} label="Capitals" onClick={() => style({ uppercase: !s.uppercase }, 'upper')}><CaseUpper size={14} /></Toggle>
            </div>
          </Row>
        </section>
      )}

      {text && (
        <section className="ins-sec">
          <h3>Alignment</h3>
          <Row label="Across">
            <div className="ins-toggles">
              <Toggle on={s.align === 'left'} label="Left" onClick={() => style({ align: 'left' }, 'align')}><AlignLeft size={14} /></Toggle>
              <Toggle on={s.align === 'center'} label="Centre" onClick={() => style({ align: 'center' }, 'align')}><AlignCenter size={14} /></Toggle>
              <Toggle on={s.align === 'right'} label="Right" onClick={() => style({ align: 'right' }, 'align')}><AlignRight size={14} /></Toggle>
            </div>
          </Row>
          <Row label="Up / down">
            <div className="ins-toggles">
              <Toggle on={s.valign === 'top'} label="Top" onClick={() => style({ valign: 'top' }, 'valign')}><AlignVerticalJustifyStart size={14} /></Toggle>
              <Toggle on={s.valign === 'middle'} label="Middle" onClick={() => style({ valign: 'middle' }, 'valign')}><AlignVerticalJustifyCenter size={14} /></Toggle>
              <Toggle on={s.valign === 'bottom'} label="Bottom" onClick={() => style({ valign: 'bottom' }, 'valign')}><AlignVerticalJustifyEnd size={14} /></Toggle>
            </div>
          </Row>
          <Row label="Line spacing">
            <Num value={s.lineHeight} step={0.05} min={0.8} max={3} onChange={(n) => style({ lineHeight: n }, 'lh')} />
          </Row>
        </section>
      )}

      <section className="ins-sec">
        <h3>Effects</h3>
        <Row label="Transparency">
          <input className="ins-range" type="range" min={0} max={1} step={0.05} value={box.alpha} onChange={(e) => onPatch({ alpha: Number(e.target.value) }, 'alpha')} />
          <span className="ins-suffix">{Math.round(box.alpha * 100)}%</span>
        </Row>
        {text && (
          <>
          <Row label="Outline">
            <Num value={s.outlineWidth} step={0.05} min={0} max={2} onChange={(n) => style({ outlineWidth: n }, 'outline')} />
            <Color label="Outline colour" value={s.outlineColor} onChange={(c) => style({ outlineColor: c }, 'outline-color')} />
          </Row>
          <Row label="Shadow">
            <label className="check">
              <input type="checkbox" checked={s.shadow} onChange={(e) => style({ shadow: e.target.checked }, 'shadow')} />
              <span>Drop shadow</span>
            </label>
          </Row>
          </>
        )}
      </section>

      {box.role === 'image' && (
        <section className="ins-sec">
          <h3>Picture</h3>
          {images.length === 0 ? (
            <p className="help">Add pictures (PNG logos with see-through backgrounds work well) in the Media Library first.</p>
          ) : (
            <Row label="File">
              <select className="input" value={box.mediaId ?? ''} onChange={(e) => onPatch({ mediaId: e.target.value || null }, 'media')}>
                <option value="">None</option>
                {images.map((m) => <option key={m.id} value={m.id}>{m.kind === 'video' ? 'Video: ' : ''}{m.name}</option>)}
              </select>
            </Row>
          )}
          <Row label="Fit">
            <div className="segmented segmented-sm">
              <button type="button" className={box.fit === 'contain' ? 'is-active' : undefined} onClick={() => onPatch({ fit: 'contain' }, 'fit')}>Whole picture</button>
              <button type="button" className={box.fit === 'cover' ? 'is-active' : undefined} onClick={() => onPatch({ fit: 'cover' }, 'fit')}>Fill box</button>
            </div>
          </Row>
          <p className="help">Shift + drag a corner keeps the picture's shape.</p>
        </section>
      )}

      {box.role === 'image' && (
        <section className="ins-sec">
          <h3>Picture filter</h3>
          <FilterControls value={box.filter ?? null} onChange={(next, key) => onPatch({ filter: next }, `filter-${key}`)} />
        </section>
      )}

      <section className="ins-sec">
        <h3>{box.role === 'shape' ? 'Shape' : 'Fill and border'}</h3>
        <Row label="Fill">
          <label className="check">
            <input type="checkbox" checked={box.fill !== ''} onChange={(e) => onPatch({ fill: e.target.checked ? '#000000' : '' }, 'fill-on')} />
            <span>Colour</span>
          </label>
          {box.fill !== '' && <Color label="Fill colour" value={box.fill} onChange={(c) => onPatch({ fill: c }, 'fill')} />}
        </Row>
        {box.fill !== '' && (
          <Row label="Opacity">
            <input className="ins-range" type="range" min={0} max={1} step={0.05} value={box.opacity} onChange={(e) => onPatch({ opacity: Number(e.target.value) }, 'opacity')} />
            <span className="ins-suffix">{Math.round(box.opacity * 100)}%</span>
          </Row>
        )}
        <Row label="Corners">
          <Num value={box.radius} step={0.2} min={0} max={50} onChange={(n) => onPatch({ radius: n }, 'radius')} />
        </Row>
        <Row label="Border">
          <Num value={box.borderWidth} step={0.05} min={0} max={5} onChange={(n) => onPatch({ borderWidth: n }, 'border')} />
          {box.borderWidth > 0 && <Color label="Border colour" value={box.borderColor} onChange={(c) => onPatch({ borderColor: c }, 'border-color')} />}
        </Row>
      </section>
    </div>
  );
}
