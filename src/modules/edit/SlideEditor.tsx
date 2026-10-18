import { matchesQuery } from '../../services/search';
import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch } from 'react';
import {
  ArrowDown, ArrowUp, ClipboardPaste, Copy, CopyPlus, Image as ImageIcon, LayoutTemplate, ListChecks, Plus,
  Redo2, RotateCcw, Save, Search, Square, Trash2, Type, Undo2, X
} from 'lucide-react';
import { EmptyState } from '../../components/Panel';
import { SlideView } from '../../components/SlideView';
import { isDesignable, KIND_META } from '../../data/kinds';
import { newId } from '../../data/itemFactory';
import { getActivePlan, type PresentationAction, type PresentationState } from '../../state/presentation';
import {
  applyTemplateToDeckSlide, cloneBoxes, findTemplate, isBuiltInTemplate, makeBox, newBoxId, newDeckSlide, starterDeckBoxes, starterTemplate,
  type BoxRole, type DeckSlide, type LayoutBox, type SlideTemplate
} from '../../../shared/layout';
import type { EditableItemFields, ItemKind, ServiceItem } from '../../types';
import type { PictureFilter } from '../../../shared/filters';
import { EditorCanvas } from './EditorCanvas';
import { Inspector, type BoxPatch } from './Inspector';
import { LayersPanel } from './LayersPanel';
import { TemplateDrawer } from './TemplateDrawer';

interface SlideEditorProps {
  state: PresentationState;
  dispatch: Dispatch<PresentationAction>;
}

interface HistoryEntry {
  key: string | null;
  at: number;
  undo: () => void;
  redo: () => void;
}

/** Kept between visits to the editor, so objects can be copied from one item to another. */
let clipboard: { kind: 'boxes'; boxes: LayoutBox[] } | { kind: 'slide'; slide: DeckSlide } | null = null;

const MERGE_MS = 1200;
const MAX_HISTORY = 200;

function isTyping(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));
}

const freshCopy = (b: LayoutBox, offset = 0): LayoutBox => ({ ...b, id: newBoxId(), x: b.x + offset, y: b.y + offset, locked: false, style: { ...b.style } });

export function SlideEditor({ state, dispatch }: SlideEditorProps) {
  const plan = getActivePlan(state);
  const designable = state.library.filter((i) => isDesignable(i.kind));
  const serviceItems = state.items.filter((i) => isDesignable(i.kind));
  const selected = state.library.find((i) => i.id === state.selectedItemId);
  const item: ServiceItem | undefined = selected && isDesignable(selected.kind) ? selected : serviceItems[0] ?? designable[0];
  const isDeck = item?.kind === 'slides';

  const [slideIndex, setSlideIndex] = useState(0);
  const [mode, setMode] = useState<'template' | 'slide'>('template');
  const [selectedBox, setSelectedBox] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [kindFilter, setKindFilter] = useState<'all' | ItemKind>('all');
  const [sort, setSort] = useState<'order' | 'title' | 'kind'>('order');
  const [, setTick] = useState(0);
  const undoStack = useRef<HistoryEntry[]>([]);
  const redoStack = useRef<HistoryEntry[]>([]);
  const textRef = useRef<HTMLTextAreaElement>(null);

  const slideCount = item ? (isDeck ? item.deck.length : item.slides.length) : 0;
  const index = Math.min(slideIndex, Math.max(0, slideCount - 1));
  const slide = item?.slides[index] ?? null;
  const key = String(index);
  const template = item ? findTemplate(state.templates, item.templateId) : null;
  const base: SlideTemplate | null = item ? template ?? starterTemplate(item.kind) : null;
  const page = isDeck ? item?.deck[index] : undefined;
  const slideBoxes = isDeck ? page?.boxes : item?.slideLayouts[key];
  const editMode: 'template' | 'slide' = isDeck ? 'slide' : mode;
  const boxes: LayoutBox[] = editMode === 'slide' ? slideBoxes ?? base?.boxes ?? [] : base?.boxes ?? [];
  const background = page?.background ?? template?.background ?? item?.background ?? 'black';
  const box = boxes.find((b) => b.id === selectedBox) ?? null;
  const customCount = item && !isDeck ? new Set([...Object.keys(item.slideLayouts), ...Object.keys(item.slideFilters ?? {})]).size : 0;
  const tplFilter = template?.bgFilter ?? null;
  const ownSlideFilter = isDeck ? page?.bgFilter ?? null : item?.slideFilters?.[key] ?? null;
  const bgFilter = editMode === 'slide' ? ownSlideFilter ?? tplFilter : tplFilter;

  useEffect(() => {
    setSelectedBox(null);
    setMode(item && !isDeck && item.slideLayouts[String(index)] ? 'slide' : 'template');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.id, index]);

  useEffect(() => {
    if (!notice) return;
    const t = window.setTimeout(() => setNotice(null), 6000);
    return () => window.clearTimeout(t);
  }, [notice]);

  // ----- Undo / redo: every change records how to undo and redo itself -----
  const record = useCallback((entryKey: string | null, undo: () => void, redo: () => void) => {
    const last = undoStack.current[undoStack.current.length - 1];
    const now = Date.now();
    if (entryKey && last && last.key === entryKey && now - last.at < MERGE_MS) {
      last.redo = redo;
      last.at = now;
    } else {
      undoStack.current.push({ key: entryKey, at: now, undo, redo });
      if (undoStack.current.length > MAX_HISTORY) undoStack.current.shift();
    }
    redoStack.current = [];
    setTick((n) => n + 1);
  }, []);
  const undo = useCallback(() => {
    const entry = undoStack.current.pop();
    if (!entry) return;
    entry.undo();
    redoStack.current.push(entry);
    setTick((n) => n + 1);
  }, []);
  const redo = useCallback(() => {
    const entry = redoStack.current.pop();
    if (!entry) return;
    entry.redo();
    undoStack.current.push({ ...entry, key: null });
    setTick((n) => n + 1);
  }, []);

  const setItemField = (itemId: string, changes: Partial<EditableItemFields>) => dispatch({ type: 'updateItem', itemId, changes });

  /** Changes an item field with undo. */
  const changeItem = <K extends keyof EditableItemFields>(target: ServiceItem, field: K, after: EditableItemFields[K], entryKey: string | null = null) => {
    const before = target[field];
    setItemField(target.id, { [field]: after } as Partial<EditableItemFields>);
    record(entryKey, () => setItemField(target.id, { [field]: before } as Partial<EditableItemFields>), () => setItemField(target.id, { [field]: after } as Partial<EditableItemFields>));
  };

  const setDeck = (next: DeckSlide[], entryKey: string | null = null) => item && changeItem(item, 'deck', next, entryKey);

  /** Saves new boxes to where we are editing: a deck slide, one slide, a user template, or a new copy of a built-in. */
  const commit = (next: LayoutBox[], entryKey: string | null = null) => {
    if (!item || !base) return;
    if (isDeck) {
      setDeck(item.deck.map((p, i) => (i === index ? { ...p, boxes: next } : p)), entryKey && `${item.id}:${index}:${entryKey}`);
      return;
    }
    if (editMode === 'slide') {
      changeItem(item, 'slideLayouts', { ...item.slideLayouts, [key]: next }, entryKey && `${item.id}:${key}:${entryKey}`);
      return;
    }
    if (template && !isBuiltInTemplate(template.id)) {
      const before = template.boxes;
      const set = (b: LayoutBox[]) => dispatch({ type: 'updateTemplate', templateId: template.id, changes: { boxes: b } });
      set(next);
      record(entryKey && `${template.id}:${entryKey}`, () => set(before), () => set(next));
      return;
    }
    const copy: SlideTemplate = { id: newId(), name: `${base.name} (my copy)`, background: base.background, boxes: next };
    dispatch({ type: 'createTemplate', template: copy });
    changeItem(item, 'templateId', copy.id);
    setNotice(`Made an editable copy, “${copy.name}”. Rename it on the right when nothing is selected.`);
  };

  // ----- Objects -----
  const patchBox = (patch: BoxPatch, entryKey: string) => {
    if (!box) return;
    commit(boxes.map((b) => (b.id === box.id ? { ...b, ...patch, style: { ...b.style, ...patch.style } } : b)), `${box.id}:${entryKey}`);
  };

  const toggle = (id: string, field: 'hidden' | 'locked') =>
    commit(boxes.map((b) => (b.id === id ? { ...b, [field]: !b[field] } : b)));

  const addBox = (role: BoxRole) => {
    const firstImage = state.media.find((m) => m.kind === 'image');
    const presets: Record<BoxRole, () => LayoutBox> = {
      text: () => makeBox('text', { x: 25, y: 40, w: 50, h: 14, text: 'New text', style: { size: 3.6 } }),
      title: () => makeBox('title', { x: 6, y: 6, w: 88, h: 10, style: { size: 2.6, uppercase: true } }),
      reference: () => makeBox('reference', { x: 6, y: 87, w: 88, h: 7, style: { size: 2.1, bold: false, uppercase: true, color: '#ffffffbf' } }),
      content: () => makeBox('content', { x: 6, y: 12, w: 88, h: 72 }),
      image: () => makeBox('image', { x: 76, y: 5, w: 18, h: 18, mediaId: firstImage?.id ?? null }),
      shape: () => makeBox('shape', { x: 10, y: 70, w: 80, h: 20, fill: '#000000', opacity: 0.6, radius: 1 })
    };
    const created = presets[role]();
    commit([...boxes, created]);
    setSelectedBox(created.id);
    if (role === 'image' && !firstImage) setNotice('Add a picture in the Media Library, then choose it on the right.');
  };

  const duplicate = () => {
    if (!box) return;
    const copy = freshCopy(box, 2);
    commit([...boxes, copy]);
    setSelectedBox(copy.id);
  };

  const remove = () => {
    if (!box) return;
    if (box.locked) {
      setNotice('That object is locked. Unlock it first.');
      return;
    }
    commit(boxes.filter((b) => b.id !== box.id));
    setSelectedBox(null);
  };

  const moveLayer = (id: string, dir: 1 | -1) => {
    const i = boxes.findIndex((b) => b.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= boxes.length) return;
    const next = [...boxes];
    [next[i], next[j]] = [next[j], next[i]];
    commit(next);
  };

  // ----- Clipboard -----
  const copy = (cut = false) => {
    if (box) {
      clipboard = { kind: 'boxes', boxes: [{ ...box, style: { ...box.style } }] };
      if (cut) remove();
      else setNotice('Copied. Press Ctrl+V to paste, on any slide.');
    } else if (isDeck && page) {
      clipboard = { kind: 'slide', slide: { ...page, boxes: cloneBoxes(page.boxes) } };
      setNotice('Slide copied. Press Ctrl+V to paste it after the current slide.');
    }
    setTick((n) => n + 1);
  };

  const paste = () => {
    if (!clipboard || !item) return;
    if (clipboard.kind === 'boxes') {
      const pasted = clipboard.boxes.map((b) => freshCopy(b, boxes.some((x) => x.id === b.id) ? 2 : 0));
      commit([...boxes, ...pasted]);
      setSelectedBox(pasted[0]?.id ?? null);
    } else if (isDeck) {
      const pasted: DeckSlide = { ...clipboard.slide, id: newBoxId(), boxes: cloneBoxes(clipboard.slide.boxes, true) };
      const next = [...item.deck];
      next.splice(index + 1, 0, pasted);
      setDeck(next);
      setSlideIndex(index + 1);
    }
  };

  // ----- Deck slides -----
  const addSlide = () => {
    if (!item) return;
    const boxesForNew = template ? cloneBoxes(template.boxes, true).map((b) => (b.role === 'content' ? { ...b, role: 'text' as const, text: 'Type here' } : b)) : starterDeckBoxes();
    const next = [...item.deck];
    next.splice(index + 1, 0, newDeckSlide(boxesForNew));
    setDeck(next);
    setSlideIndex(index + 1);
  };
  const duplicateSlide = () => {
    if (!item || !page) return;
    const next = [...item.deck];
    next.splice(index + 1, 0, { ...page, id: newBoxId(), boxes: cloneBoxes(page.boxes, true) });
    setDeck(next);
    setSlideIndex(index + 1);
  };
  const deleteSlide = () => {
    if (!item || item.deck.length <= 1) return;
    setDeck(item.deck.filter((_, i) => i !== index));
    setSlideIndex(Math.max(0, index - 1));
  };
  const moveSlide = (dir: 1 | -1) => {
    if (!item) return;
    const j = index + dir;
    if (j < 0 || j >= item.deck.length) return;
    const next = [...item.deck];
    [next[index], next[j]] = [next[j], next[index]];
    setDeck(next);
    setSlideIndex(j);
  };

  // ----- Templates -----
  const applyTemplate = (templateId: string | null) => {
    if (!item) return;
    if (isDeck) {
      const tpl = findTemplate(state.templates, templateId);
      const before = { templateId: item.templateId, deck: item.deck };
      const after = { templateId, deck: tpl ? item.deck.map((p) => applyTemplateToDeckSlide(p, tpl)) : item.deck };
      setItemField(item.id, after);
      record(null, () => setItemField(item.id, before), () => setItemField(item.id, after));
      if (tpl) setNotice(`Applied “${tpl.name}” to all ${item.deck.length} slides. Your words and pictures were kept.`);
      return;
    }
    if (item.templateId !== templateId) changeItem(item, 'templateId', templateId);
  };

  /** Template for every slide: removes per-slide layouts (text items) */
  const applyToAllSlides = () => {
    if (!item || isDeck) return;
    if (editMode === 'slide' && slideBoxes) {
      // Turn this slide's design into the item's template.
      const tpl: SlideTemplate = { id: newId(), name: `${item.title.trim() || 'Slide'} layout`, background: template?.background ?? null, bgFilter: ownSlideFilter ?? tplFilter, boxes: cloneBoxes(slideBoxes, true).map((b) => (b.role === 'content' ? { ...b, text: '' } : b)) };
      dispatch({ type: 'createTemplate', template: tpl });
      const before = { templateId: item.templateId, slideLayouts: item.slideLayouts, slideFilters: item.slideFilters ?? {} };
      const after = { templateId: tpl.id, slideLayouts: {}, slideFilters: {} };
      setItemField(item.id, after);
      record(null, () => setItemField(item.id, before), () => setItemField(item.id, after));
      setMode('template');
      setNotice(`Every slide now uses this design (saved as template “${tpl.name}”).`);
      return;
    }
    const before = { slideLayouts: item.slideLayouts, slideFilters: item.slideFilters ?? {} };
    const after = { slideLayouts: {}, slideFilters: {} };
    setItemField(item.id, after);
    record(null, () => setItemField(item.id, before), () => setItemField(item.id, after));
    setNotice('Every slide now follows the template.');
  };

  const applyToService = () => {
    if (!item) return;
    const targets = state.items.filter((i) => i.id !== item.id && i.kind === item.kind);
    if (targets.length === 0) {
      setNotice(`There are no other ${KIND_META[item.kind].label.toLowerCase()} items in this service.`);
      return;
    }
    const before = targets.map((i) => ({ id: i.id, templateId: i.templateId }));
    const set = (id: string | null) => targets.forEach((i) => setItemField(i.id, { templateId: id }));
    set(item.templateId);
    record(null, () => before.forEach((b) => setItemField(b.id, { templateId: b.templateId })), () => set(item.templateId));
    setNotice(`Used “${template?.name ?? 'Classic'}” for ${targets.length} more ${KIND_META[item.kind].label.toLowerCase()} item${targets.length === 1 ? '' : 's'} in this service.`);
  };

  const saveAsTemplate = () => {
    if (!item) return;
    const tpl: SlideTemplate = {
      id: newId(),
      name: `${item.title.trim() || 'Slide'} layout`,
      background: page?.background ?? template?.background ?? null,
      bgFilter: bgFilter,
      boxes: cloneBoxes(boxes, true).map((b) => (b.role === 'content' && !isDeck ? { ...b, text: '' } : b))
    };
    dispatch({ type: 'createTemplate', template: tpl });
    if (!isDeck) changeItem(item, 'templateId', tpl.id);
    setNotice(`Saved “${tpl.name}” as a template.`);
  };

  const setBgFilter = (next: PictureFilter | null, entryKey: string) => {
    if (!item || !base) return;
    if (editMode === 'slide') {
      if (isDeck) {
        setDeck(item.deck.map((p, i) => (i === index ? { ...p, bgFilter: next } : p)), `${item.id}:${index}:bgf:${entryKey}`);
      } else {
        const filters = { ...(item.slideFilters ?? {}) };
        if (next) filters[key] = next;
        else delete filters[key];
        changeItem(item, 'slideFilters', filters, `${item.id}:${key}:bgf:${entryKey}`);
      }
      return;
    }
    if (template && !isBuiltInTemplate(template.id)) {
      onTemplateChange({ bgFilter: next }, `bgf:${entryKey}`);
      return;
    }
    const copy: SlideTemplate = { id: newId(), name: `${base.name} (my copy)`, background: base.background, bgFilter: next, boxes: cloneBoxes(base.boxes) };
    dispatch({ type: 'createTemplate', template: copy });
    changeItem(item, 'templateId', copy.id);
    setNotice(`Made an editable copy, “${copy.name}”, with your filter.`);
  };

  const onTemplateChange = (changes: Partial<Pick<SlideTemplate, 'name' | 'background' | 'bgFilter'>>, entryKey: string) => {
    if (!template || isBuiltInTemplate(template.id)) return;
    const before = { name: template.name, background: template.background, bgFilter: template.bgFilter ?? null };
    const after = { ...before, ...changes };
    const set = (c: typeof before) => dispatch({ type: 'updateTemplate', templateId: template.id, changes: c });
    set(after);
    record(`${template.id}:${entryKey}`, () => set(before), () => set(after));
  };

  // ----- Keys (capture phase, so Live shortcuts such as arrows and Esc do not also fire) -----
  const keys = useRef({ nudge: (_dx: number, _dy: number) => {}, remove, duplicate, undo, redo, copy, paste, hasBox: false });
  keys.current = {
    nudge: (dx, dy) => {
      if (!box || box.locked) return;
      commit(boxes.map((b) => (b.id === box.id ? { ...b, x: Math.round((b.x + dx) * 10) / 10, y: Math.round((b.y + dy) * 10) / 10 } : b)), `${box.id}:nudge`);
    },
    remove,
    duplicate,
    undo,
    redo,
    copy,
    paste,
    hasBox: !!box
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = keys.current;
      const mod = e.ctrlKey || e.metaKey;
      if (isTyping(e.target)) return;
      const letter = e.key.toLowerCase();
      if (mod) {
        const actions: Record<string, () => void> = {
          z: () => (e.shiftKey ? k.redo() : k.undo()),
          y: k.redo,
          c: () => k.copy(false),
          x: () => k.copy(true),
          v: k.paste,
          d: k.duplicate
        };
        if (actions[letter]) {
          e.preventDefault();
          actions[letter]();
        }
        return;
      }
      if (!k.hasBox) return;
      const step = e.shiftKey ? 2 : 0.5;
      const moves: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
      if (moves[e.key]) {
        e.preventDefault();
        k.nudge(...moves[e.key]);
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        k.remove();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setSelectedBox(null);
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);

  const layoutItem = useMemo(
    () => (item ? { title: item.title, subtitle: item.subtitle, background: item.background, templateId: item.templateId, slideLayouts: item.slideLayouts } : null),
    [item]
  );

  if (!item || !base || !layoutItem) {
    return (
      <div className="page">
        <div className="page-inner">
          <section className="card">
            <EmptyState icon={LayoutTemplate} title="Nothing to design yet">
              Create a song, scripture passage, announcement or Slides item in Presentation Studio, then come back here to design it.
            </EmptyState>
          </section>
        </div>
      </div>
    );
  }

  const q = query.trim().toLowerCase();
  const matches = (i: ServiceItem) =>
    (kindFilter === 'all' || i.kind === kindFilter) && (!q || matchesQuery(`${i.title} ${i.subtitle} ${i.content}`, q));
  const sorted = (list: ServiceItem[]) =>
    sort === 'order'
      ? list
      : [...list].sort((a, b) =>
          sort === 'kind'
            ? KIND_META[a.kind].label.localeCompare(KIND_META[b.kind].label) || a.title.localeCompare(b.title)
            : (a.title || 'Untitled').localeCompare(b.title || 'Untitled'));
  const kindsPresent = Array.from(new Set(designable.map((i) => i.kind)));
  const filtering = q !== '' || kindFilter !== 'all';
  const shownService = sorted(serviceItems.filter(matches));
  const otherItems = sorted(designable.filter((i) => !serviceItems.includes(i) && matches(i)));
  const matchCount = shownService.length + otherItems.length;
  const currentHidden = !shownService.includes(item) && !otherItems.includes(item);
  const editingName = isDeck ? `Slide ${index + 1} of ${slideCount}` : editMode === 'slide' ? `Slide ${index + 1} only` : template ? template.name : `${base.name} (built-in)`;

  return (
    <div className="ed">
      <aside className="ed-left">
        <div className="ed-item-pick">
          <span className="field-label">Item</span>
          <div className="ed-search">
            <Search size={13} aria-hidden="true" />
            <input className="input" value={query} placeholder="Search titles and words" aria-label="Search items" onChange={(e) => setQuery(e.target.value)} />
            {query && <button type="button" className="icon-btn" aria-label="Clear search" onClick={() => setQuery('')}><X size={12} /></button>}
          </div>
          <div className="ed-item-filters">
            <select className="input" value={kindFilter} aria-label="Show type" onChange={(e) => setKindFilter(e.target.value as 'all' | ItemKind)}>
              <option value="all">All types</option>
              {kindsPresent.map((k) => <option key={k} value={k}>{KIND_META[k].label}</option>)}
            </select>
            <select className="input" value={sort} aria-label="Sort by" onChange={(e) => setSort(e.target.value as typeof sort)}>
              <option value="order">Service order</option>
              <option value="title">A–Z</option>
              <option value="kind">Type</option>
            </select>
          </div>
          {filtering && <span className="help-inline">{matchCount === 0 ? 'No items match.' : `${matchCount} match${matchCount === 1 ? '' : 'es'}`}</span>}
          <select className="input" value={item.id} aria-label="Item" onChange={(e) => dispatch({ type: 'selectItem', itemId: e.target.value })}>
            {currentHidden && (
              <optgroup label="Editing now">
                <option value={item.id}>{KIND_META[item.kind].label}: {item.title || 'Untitled'}</option>
              </optgroup>
            )}
            {shownService.length > 0 && (
              <optgroup label={plan ? plan.name.trim() || 'This service' : 'This service'}>
                {shownService.map((i) => <option key={i.id} value={i.id}>{KIND_META[i.kind].label}: {i.title || 'Untitled'}</option>)}
              </optgroup>
            )}
            {otherItems.length > 0 && (
              <optgroup label="Library">
                {otherItems.map((i) => <option key={i.id} value={i.id}>{KIND_META[i.kind].label}: {i.title || 'Untitled'}</option>)}
              </optgroup>
            )}
          </select>
        </div>
        {isDeck && (
          <div className="ed-slide-tools">
            <button type="button" className="btn btn-sm btn-primary" onClick={addSlide} title="Add a slide after this one"><Plus size={13} aria-hidden="true" />Slide</button>
            <button type="button" className="icon-btn" onClick={duplicateSlide} title="Duplicate slide" aria-label="Duplicate slide"><CopyPlus size={14} /></button>
            <button type="button" className="icon-btn" onClick={() => moveSlide(-1)} disabled={index === 0} title="Move up" aria-label="Move slide up"><ArrowUp size={14} /></button>
            <button type="button" className="icon-btn" onClick={() => moveSlide(1)} disabled={index >= slideCount - 1} title="Move down" aria-label="Move slide down"><ArrowDown size={14} /></button>
            <button type="button" className="icon-btn" onClick={deleteSlide} disabled={slideCount <= 1} title="Delete slide" aria-label="Delete slide"><Trash2 size={14} /></button>
          </div>
        )}
        <div className="ed-slides" role="list" aria-label="Slides">
          {item.slides.length === 0 && <p className="help">This item has no words yet. Add them in Presentation Studio.</p>}
          {item.slides.map((s, i) => (
            <button key={s.id} type="button" role="listitem" className={`ed-slide-thumb${i === index ? ' is-active' : ''}`} onClick={() => setSlideIndex(i)} aria-label={`Slide ${i + 1}`}>
              <SlideView item={item} slide={s} />
              <span className="slide-thumb-meta">
                <span className="slide-thumb-index">{i + 1}</span>
                {s.group && <span>{s.group}</span>}
                {!isDeck && item.slideLayouts[String(i)] && <span className="tag tag-inline ed-own">Own layout</span>}
                {!isDeck && item.slideFilters?.[String(i)] && <span className="tag tag-inline ed-own">Own filter</span>}
              </span>
            </button>
          ))}
        </div>
      </aside>

      <section className="ed-center">
        <div className="ed-toolbar">
          {!isDeck && (
            <div className="segmented segmented-sm" role="radiogroup" aria-label="What to edit">
              <button type="button" role="radio" aria-checked={editMode === 'template'} className={editMode === 'template' ? 'is-active' : undefined} onClick={() => setMode('template')} title="Changes apply to every slide using this template">
                All slides (template)
              </button>
              <button type="button" role="radio" aria-checked={editMode === 'slide'} className={editMode === 'slide' ? 'is-active' : undefined} onClick={() => setMode('slide')} title="Changes apply to this slide only">
                This slide only
              </button>
            </div>
          )}
          <span className="ed-editing" title="What you are changing">{editingName}</span>
          <span className="ed-spacer" />
          <button type="button" className="btn btn-sm" onClick={() => addBox('text')}><Type size={13} aria-hidden="true" />Text</button>
          <button type="button" className="btn btn-sm" onClick={() => addBox('image')}><ImageIcon size={13} aria-hidden="true" />Picture</button>
          <button type="button" className="btn btn-sm" onClick={() => addBox('shape')}><Square size={13} aria-hidden="true" />Shape</button>
          {!isDeck && (
            <select className="input ed-add-more" value="" aria-label="Add another box" onChange={(e) => e.target.value && addBox(e.target.value as BoxRole)}>
              <option value="">More…</option>
              {!boxes.some((b) => b.role === 'content') && <option value="content">Main words</option>}
              <option value="title">Item title</option>
              <option value="reference">Reference / footer</option>
            </select>
          )}
          <span className="ed-divider" />
          <button type="button" className="icon-btn" title="Copy (Ctrl+C)" aria-label="Copy" disabled={!box && !isDeck} onClick={() => copy(false)}><Copy size={15} /></button>
          <button type="button" className="icon-btn" title="Paste (Ctrl+V)" aria-label="Paste" disabled={!clipboard || (clipboard.kind === 'slide' && !isDeck)} onClick={paste}><ClipboardPaste size={15} /></button>
          <button type="button" className="icon-btn" title="Undo (Ctrl+Z)" aria-label="Undo" disabled={undoStack.current.length === 0} onClick={undo}><Undo2 size={15} /></button>
          <button type="button" className="icon-btn" title="Redo (Ctrl+Y)" aria-label="Redo" disabled={redoStack.current.length === 0} onClick={redo}><Redo2 size={15} /></button>
        </div>

        {(notice || (editMode === 'template' && slideBoxes)) && (
          <div className="ed-notice" role="status">
            {notice ?? 'This slide has its own layout, so template changes do not show on it. Switch to “This slide only” to edit it.'}
          </div>
        )}

        <EditorCanvas
          kind={item.kind}
          item={layoutItem}
          slide={slide && isDeck ? { ...slide, lines: [], columns: undefined } : slide}
          background={background}
          bgFilter={bgFilter}
          boxes={boxes}
          selectedId={selectedBox}
          onSelect={setSelectedBox}
          onCommit={(next) => commit(next)}
          onEditText={(id) => {
            setSelectedBox(id);
            window.setTimeout(() => textRef.current?.focus(), 30);
          }}
        />

        <div className="ed-foot">
          {!isDeck && (customCount > 0 || (editMode === 'slide' && slideBoxes)) && (
            <button type="button" className="btn btn-sm" onClick={applyToAllSlides} title={editMode === 'slide' && slideBoxes ? 'Use this slide’s design for every slide of this item' : 'Remove per-slide layouts so every slide follows the template'}>
              <RotateCcw size={13} aria-hidden="true" />
              {editMode === 'slide' && slideBoxes ? 'Use this design on all slides' : `Reset ${customCount} slide${customCount === 1 ? '' : 's'} to template`}
            </button>
          )}
          <button type="button" className="btn btn-sm" onClick={saveAsTemplate} title="Save this layout as a template"><Save size={13} aria-hidden="true" />Save as template</button>
          <button type="button" className="btn btn-sm" onClick={applyToService} title={`Use this item's template for every ${KIND_META[item.kind].label.toLowerCase()} item in the open service`}>
            <ListChecks size={13} aria-hidden="true" />Use template for all {KIND_META[item.kind].label.toLowerCase()} items
          </button>
          <span className="help-inline">Dashed line = safe area. Projector and OBS show exactly this.</span>
        </div>

        <TemplateDrawer
          item={item}
          slide={slide}
          templates={state.templates}
          applyHint={isDeck ? 'Click to apply to all slides (words and pictures are kept)' : undefined}
          onApply={applyTemplate}
          onCreate={() => {
            const tpl: SlideTemplate = { id: newId(), name: 'New template', background: null, boxes: cloneBoxes(starterTemplate(item.kind).boxes, true) };
            dispatch({ type: 'createTemplate', template: tpl });
            applyTemplate(tpl.id);
            setMode('template');
          }}
          onDuplicate={(tpl) => {
            const dup: SlideTemplate = { id: newId(), name: `${tpl.name} copy`, background: tpl.background, bgFilter: tpl.bgFilter ?? null, boxes: cloneBoxes(tpl.boxes, true) };
            dispatch({ type: 'createTemplate', template: dup });
            if (!isDeck) applyTemplate(dup.id);
          }}
          onDelete={(tpl) => dispatch({ type: 'deleteTemplate', templateId: tpl.id })}
          usage={(id) => state.library.filter((i) => i.templateId === id).length}
        />
      </section>

      <aside className="ed-right">
        <Inspector
          box={box}
          mode={editMode}
          template={editMode === 'template' ? template : null}
          media={state.media}
          textRef={textRef}
          onPatch={patchBox}
          onDuplicate={duplicate}
          onDelete={remove}
          onTemplateChange={onTemplateChange}
          bgFilter={bgFilter}
          bgFilterInherited={editMode === 'slide' && !ownSlideFilter}
          onBgFilter={setBgFilter}
          bgIsMedia={background.startsWith('media:')}
        />
        <LayersPanel boxes={boxes} selectedId={selectedBox} onSelect={setSelectedBox} onToggle={toggle} onMove={moveLayer} />
      </aside>
    </div>
  );
}
