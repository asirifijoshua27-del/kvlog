// Slide layouts and templates. A layout is a list of boxes positioned in percent of the slide,
// so it looks the same on a thumbnail, the projector and in OBS. Font sizes are in percent of the
// slide WIDTH (CSS cqw / vw units).
//
// Shared by the main process (validating saved data) and the UI (editing and drawing slides).
import { BACKGROUND_VALUES, MEDIA_BACKGROUND_PATTERN, type BackgroundRef, type ItemKind } from './data-types';
import { sanitizeFilter, type PictureFilter } from './filters';

export type BoxRole = 'content' | 'title' | 'reference' | 'text' | 'image' | 'shape';
export type HAlign = 'left' | 'center' | 'right';
export type VAlign = 'top' | 'middle' | 'bottom';

export interface TextStyle {
  font: string;
  /** Percent of slide width. */
  size: number;
  /** #rrggbb or #rrggbbaa */
  color: string;
  bold: boolean;
  italic: boolean;
  uppercase: boolean;
  align: HAlign;
  valign: VAlign;
  lineHeight: number;
  /** Outline thickness in percent of slide width. 0 = none. */
  outlineWidth: number;
  outlineColor: string;
  shadow: boolean;
  /** Shrink the text when it does not fit the box. */
  autoFit: boolean;
}

export interface LayoutBox {
  id: string;
  role: BoxRole;
  /** Position and size in percent of the slide. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** "text" boxes: their words. "content" boxes on one slide: replaces the item's words (empty = use them). */
  text: string;
  style: TextStyle;
  /** "image" boxes: Media Library id. */
  mediaId: string | null;
  fit: 'cover' | 'contain';
  /** Box colour behind the text or shape colour. '' = none. */
  fill: string;
  /** 0–1, applies to fill. */
  opacity: number;
  /** Corner rounding in percent of slide width. */
  radius: number;
  borderWidth: number;
  borderColor: string;
  /** Whole-object transparency, 0–1. */
  alpha: number;
  /** Locked objects can be selected but not moved, resized or deleted. */
  locked: boolean;
  /** Hidden objects are kept but not shown on any screen. */
  hidden: boolean;
  /** "image" boxes: picture filter. */
  filter?: PictureFilter | null;
}

/** One slide of a "Slides" item: a free-form page of objects. */
export interface DeckSlide {
  id: string;
  /** null = the template's or the item's background. */
  background: BackgroundRef | null;
  /** null = the template's background filter. */
  bgFilter?: PictureFilter | null;
  boxes: LayoutBox[];
}

export interface SlideTemplate {
  id: string;
  name: string;
  /** null = keep each item's own background. */
  background: BackgroundRef | null;
  /** Filter on the background picture or video, for every slide. */
  bgFilter?: PictureFilter | null;
  boxes: LayoutBox[];
}

/** A box ready to draw: text worked out, font size fitted. */
export interface RenderBox extends Omit<LayoutBox, 'text'> {
  lines: string[];
  columns: [string[], string[]] | null;
  fontSize: number;
}

export interface ResolvedLayout {
  background: BackgroundRef;
  bgFilter?: PictureFilter | null;
  boxes: RenderBox[];
}

export const TEXT_ROLES: readonly BoxRole[] = ['content', 'title', 'reference', 'text'];
export const isTextRole = (role: BoxRole) => (TEXT_ROLES as readonly string[]).includes(role);

export const ROLE_LABELS: Record<BoxRole, string> = {
  content: 'Main words',
  title: 'Item title',
  reference: 'Reference / footer',
  text: 'Text',
  image: 'Picture',
  shape: 'Shape'
};

/** Fonts that come with Windows 10/11. */
export const FONT_CHOICES = [
  'Segoe UI',
  'Segoe UI Semibold',
  'Bahnschrift',
  'Arial',
  'Arial Black',
  'Calibri',
  'Candara',
  'Corbel',
  'Verdana',
  'Tahoma',
  'Trebuchet MS',
  'Franklin Gothic Medium',
  'Impact',
  'Georgia',
  'Cambria',
  'Constantia',
  'Times New Roman',
  'Palatino Linotype',
  'Gabriola',
  'Segoe Script'
];

export const MAX_BOXES = 40;
export const MAX_TEMPLATES = 500;
const MAX_SLIDE_LAYOUTS = 2000;
const COLOR_PATTERN = /^#[0-9a-f]{6}([0-9a-f]{2})?$/i;
const FONT_PATTERN = /^[A-Za-z0-9 \-]{1,60}$/;
const ID_PATTERN = /^[A-Za-z0-9:_-]{1,100}$/;

export const DEFAULT_TEXT_STYLE: TextStyle = {
  font: 'Segoe UI',
  size: 4.6,
  color: '#ffffff',
  bold: true,
  italic: false,
  uppercase: false,
  align: 'center',
  valign: 'middle',
  lineHeight: 1.22,
  outlineWidth: 0,
  outlineColor: '#000000',
  shadow: false,
  autoFit: true
};

let counter = 0;
export function newBoxId(): string {
  counter = (counter + 1) % 1e6;
  return `b${Date.now().toString(36)}${counter.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export function makeBox(role: BoxRole, fields: Partial<Omit<LayoutBox, 'style'>> & { style?: Partial<TextStyle> } = {}): LayoutBox {
  const { style, ...rest } = fields;
  return {
    id: newBoxId(),
    role,
    x: 10,
    y: 10,
    w: 80,
    h: 20,
    text: '',
    mediaId: null,
    fit: 'contain',
    fill: '',
    opacity: 1,
    radius: 0,
    borderWidth: 0,
    borderColor: '#ffffff',
    alpha: 1,
    locked: false,
    hidden: false,
    ...rest,
    style: { ...DEFAULT_TEXT_STYLE, ...style }
  };
}

// ----- Built-in templates (not saved; duplicated when edited) -----

const REF_STYLE: Partial<TextStyle> = { size: 2.1, bold: false, uppercase: true, color: '#ffffffbf', autoFit: true };

function builtIn(id: string, name: string, boxes: LayoutBox[]): SlideTemplate {
  // Stable ids so saved per-item choices and undo keep working.
  boxes.forEach((b, i) => (b.id = `${id}-${i}`));
  return { id: `builtin:${id}`, name, background: null, boxes };
}

export const BUILT_IN_TEMPLATES: SlideTemplate[] = [
  builtIn('default', 'Default', [
    makeBox('content', { x: 6, y: 8, w: 88, h: 76 }),
    makeBox('reference', { x: 6, y: 87, w: 88, h: 7, style: REF_STYLE })
  ]),
  builtIn('big', 'Big Bold', [
    makeBox('content', { x: 4, y: 5, w: 92, h: 82, style: { font: 'Arial Black', size: 7, lineHeight: 1.12 } }),
    makeBox('reference', { x: 4, y: 88, w: 92, h: 7, style: REF_STYLE })
  ]),
  builtIn('outline', 'Outline', [
    makeBox('content', { x: 6, y: 8, w: 88, h: 76, style: { size: 5.2, outlineWidth: 0.22, shadow: true } }),
    makeBox('reference', { x: 6, y: 87, w: 88, h: 7, style: { ...REF_STYLE, shadow: true, color: '#ffffff' } })
  ]),
  builtIn('box', 'Box', [
    makeBox('shape', { x: 8, y: 20, w: 84, h: 60, fill: '#000000', opacity: 0.6, radius: 1.2 }),
    makeBox('content', { x: 10, y: 22, w: 80, h: 48, style: { size: 4.2 } }),
    makeBox('reference', { x: 10, y: 71, w: 80, h: 7, style: REF_STYLE })
  ]),
  builtIn('lower-third', 'Lower Third', [
    makeBox('shape', { x: 0, y: 70, w: 100, h: 26, fill: '#0b1222', opacity: 0.85 }),
    makeBox('content', { x: 5, y: 71, w: 90, h: 17, style: { size: 3.4 } }),
    makeBox('reference', { x: 5, y: 88, w: 90, h: 6, style: { ...REF_STYLE, size: 1.6, color: '#9fb7ff' } })
  ]),
  builtIn('left', 'Left Aligned', [
    makeBox('title', { x: 6, y: 7, w: 88, h: 9, style: { size: 2.4, uppercase: true, color: '#8fb3ff', align: 'left' } }),
    makeBox('content', { x: 6, y: 18, w: 76, h: 68, style: { size: 4.4, align: 'left', valign: 'top' } }),
    makeBox('reference', { x: 6, y: 88, w: 88, h: 6, style: { ...REF_STYLE, align: 'left' } })
  ]),
  builtIn('header', 'Header', [
    makeBox('shape', { x: 0, y: 0, w: 100, h: 15, fill: '#2563eb' }),
    makeBox('title', { x: 5, y: 1.5, w: 90, h: 12, style: { size: 3.2, align: 'left' } }),
    makeBox('content', { x: 6, y: 21, w: 88, h: 66 }),
    makeBox('reference', { x: 6, y: 88, w: 88, h: 6, style: REF_STYLE })
  ]),
  builtIn('scripture', 'Scripture', [
    makeBox('reference', { x: 7, y: 7, w: 86, h: 8, style: { ...REF_STYLE, size: 2.4, color: '#8fb3ff', bold: true } }),
    makeBox('content', { x: 7, y: 17, w: 86, h: 74, style: { size: 3.8, bold: false, align: 'left', lineHeight: 1.35 } })
  ])
];

export const DEFAULT_TEMPLATE = BUILT_IN_TEMPLATES[0];

/** The template shown as the starting point for a kind when an item has none. */
export function starterTemplate(kind: ItemKind): SlideTemplate {
  if (kind === 'scripture') return BUILT_IN_TEMPLATES.find((t) => t.id === 'builtin:scripture') ?? DEFAULT_TEMPLATE;
  return DEFAULT_TEMPLATE;
}

export function isBuiltInTemplate(id: string): boolean {
  return id.startsWith('builtin:');
}

export function findTemplate(templates: readonly SlideTemplate[], id: string | null | undefined): SlideTemplate | null {
  if (!id) return null;
  return BUILT_IN_TEMPLATES.find((t) => t.id === id) ?? templates.find((t) => t.id === id) ?? null;
}

export function cloneBoxes(boxes: readonly LayoutBox[], freshIds = false): LayoutBox[] {
  return boxes.map((b) => ({ ...b, id: freshIds ? newBoxId() : b.id, style: { ...b.style }, filter: b.filter ? { ...b.filter } : b.filter }));
}

// ----- Working out what to draw -----

export interface LayoutItem {
  /** "Slides" items: every slide's objects. */
  deck?: DeckSlide[];
  title: string;
  subtitle: string;
  background: BackgroundRef;
  templateId?: string | null;
  slideLayouts?: Record<string, LayoutBox[]>;
  /** Background filters for single slides (slide number from 0). */
  slideFilters?: Record<string, PictureFilter>;
}

export interface LayoutSlide {
  index?: number;
  lines: string[];
  footer?: string | null;
  columns?: [string[], string[]] | null;
}

const CHAR_WIDTH = 0.53;
const BOX_PADDING = 0.6;

/** Largest font size (≤ style.size) at which the text fits the box. Deterministic, so every screen agrees. */
export function fitFontSize(lines: string[], columns: [string[], string[]] | null, style: TextStyle, w: number, h: number): number {
  if (!style.autoFit) return style.size;
  let width = Math.max(1, w - 2 * BOX_PADDING);
  const height = Math.max(1, h * 0.5625 - 2 * BOX_PADDING);
  let list = lines;
  if (columns) {
    width = Math.max(1, (width - 3) / 2);
    list = columns[0].join(' ').length >= columns[1].join(' ').length ? columns[0] : columns[1];
  }
  if (list.length === 0) return style.size;
  const charWidth = CHAR_WIDTH * (style.bold ? 1.06 : 1) * (style.uppercase ? 1.14 : 1) * (style.font === 'Arial Black' || style.font === 'Impact' ? 1.12 : 1);
  for (let size = style.size; size > 0.8; size -= 0.1) {
    let rows = 0;
    for (const line of list) rows += Math.max(1, Math.ceil((line.length * charWidth * size) / width));
    if (rows * size * style.lineHeight + (list.length - 1) * size * 0.2 <= height) return Math.round(size * 100) / 100;
  }
  return 0.8;
}

export function resolveBoxes(boxes: readonly LayoutBox[], item: LayoutItem, slide: LayoutSlide | null): RenderBox[] {
  return boxes.filter((box) => !box.hidden).map((box) => {
    const { text, ...rest } = box;
    let lines: string[] = [];
    let columns: [string[], string[]] | null = null;
    if (box.role === 'content') {
      if (text.trim()) lines = text.split('\n');
      else if (slide) {
        lines = slide.lines;
        columns = slide.columns ?? null;
      }
    } else if (box.role === 'title') lines = item.title.trim() ? [item.title] : [];
    else if (box.role === 'reference') {
      const ref = slide?.footer || item.subtitle;
      lines = ref ? [ref] : [];
    } else if (box.role === 'text') lines = text ? text.split('\n') : [];
    const fontSize = isTextRole(box.role) ? fitFontSize(lines, columns, box.style, box.w, box.h) : box.style.size;
    return { ...rest, lines, columns, fontSize };
  });
}

/** The layout for one slide, or null when the item uses KVLOG's classic look. */
export function resolveLayout(item: LayoutItem, slide: LayoutSlide | null, templates: readonly SlideTemplate[]): ResolvedLayout | null {
  const template = findTemplate(templates, item.templateId);
  if (item.deck && item.deck.length > 0) {
    const page = slide && slide.index !== undefined ? item.deck[slide.index] : undefined;
    if (!page) return null;
    // Deck pages carry their own words, so the main-words box never repeats the slide text.
    return {
      background: page.background ?? template?.background ?? item.background,
      bgFilter: page.bgFilter ?? template?.bgFilter ?? null,
      boxes: resolveBoxes(page.boxes, item, { ...slide, lines: [], columns: null })
    };
  }
  const custom = slide && slide.index !== undefined ? item.slideLayouts?.[String(slide.index)] : undefined;
  const boxes = custom ?? template?.boxes;
  if (!boxes) return null;
  const own = slide && slide.index !== undefined ? item.slideFilters?.[String(slide.index)] : undefined;
  return { background: template?.background ?? item.background, bgFilter: own ?? template?.bgFilter ?? null, boxes: resolveBoxes(boxes, item, slide) };
}

/** #rrggbb(aa) + opacity -> rgba(). */
export function toRgba(color: string, opacity = 1): string {
  if (!COLOR_PATTERN.test(color)) return 'transparent';
  const r = parseInt(color.slice(1, 3), 16);
  const g = parseInt(color.slice(3, 5), 16);
  const b = parseInt(color.slice(5, 7), 16);
  const a = color.length === 9 ? parseInt(color.slice(7, 9), 16) / 255 : 1;
  return `rgba(${r}, ${g}, ${b}, ${Math.round(a * opacity * 1000) / 1000})`;
}

// ----- Validation of saved data -----

const clamp = (v: unknown, min: number, max: number, fallback: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback;
const pick = <T extends string>(v: unknown, options: readonly T[], fallback: T): T =>
  typeof v === 'string' && (options as readonly string[]).includes(v) ? (v as T) : fallback;
const color = (v: unknown, fallback: string): string => (typeof v === 'string' && COLOR_PATTERN.test(v) ? v : fallback);
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

function sanitizeStyle(value: unknown): TextStyle {
  const v = isObj(value) ? value : {};
  const d = DEFAULT_TEXT_STYLE;
  return {
    font: typeof v.font === 'string' && FONT_PATTERN.test(v.font) ? v.font : d.font,
    size: clamp(v.size, 0.5, 30, d.size),
    color: color(v.color, d.color),
    bold: typeof v.bold === 'boolean' ? v.bold : d.bold,
    italic: v.italic === true,
    uppercase: v.uppercase === true,
    align: pick(v.align, ['left', 'center', 'right'] as const, d.align),
    valign: pick(v.valign, ['top', 'middle', 'bottom'] as const, d.valign),
    lineHeight: clamp(v.lineHeight, 0.8, 3, d.lineHeight),
    outlineWidth: clamp(v.outlineWidth, 0, 2, 0),
    outlineColor: color(v.outlineColor, d.outlineColor),
    shadow: v.shadow === true,
    autoFit: typeof v.autoFit === 'boolean' ? v.autoFit : d.autoFit
  };
}

export function sanitizeBox(value: unknown): LayoutBox {
  if (!isObj(value)) throw new Error('Invalid layout box.');
  if (typeof value.id !== 'string' || !ID_PATTERN.test(value.id)) throw new Error('Invalid layout box id.');
  const role = pick(value.role, ['content', 'title', 'reference', 'text', 'image', 'shape'] as const, 'text');
  const x = clamp(value.x, -50, 150, 10);
  const y = clamp(value.y, -50, 150, 10);
  return {
    id: value.id,
    role,
    x,
    y,
    w: clamp(value.w, 1, 200, 50),
    h: clamp(value.h, 1, 200, 20),
    text: typeof value.text === 'string' ? value.text.slice(0, 5000) : '',
    style: sanitizeStyle(value.style),
    mediaId: typeof value.mediaId === 'string' && /^[A-Za-z0-9-]{1,100}$/.test(value.mediaId) ? value.mediaId : null,
    fit: value.fit === 'cover' ? 'cover' : 'contain',
    fill: value.fill === '' ? '' : color(value.fill, ''),
    opacity: clamp(value.opacity, 0, 1, 1),
    radius: clamp(value.radius, 0, 50, 0),
    borderWidth: clamp(value.borderWidth, 0, 5, 0),
    borderColor: color(value.borderColor, '#ffffff'),
    alpha: clamp(value.alpha, 0, 1, 1),
    locked: value.locked === true,
    hidden: value.hidden === true,
    filter: role === 'image' ? sanitizeFilter(value.filter) : null
  };
}

export function sanitizeBoxes(value: unknown): LayoutBox[] {
  if (!Array.isArray(value) || value.length > MAX_BOXES) throw new Error('Invalid layout.');
  const boxes = value.map(sanitizeBox);
  if (new Set(boxes.map((b) => b.id)).size !== boxes.length) throw new Error('Two layout boxes share the same id.');
  return boxes;
}

export function sanitizeSlideLayouts(value: unknown): Record<string, LayoutBox[]> {
  if (value === undefined || value === null) return {};
  if (!isObj(value)) throw new Error('Invalid slide layouts.');
  const entries = Object.entries(value);
  if (entries.length > MAX_SLIDE_LAYOUTS) throw new Error('Too many slide layouts.');
  const out: Record<string, LayoutBox[]> = {};
  for (const [key, boxes] of entries) {
    if (!/^\d{1,4}$/.test(key)) throw new Error('Invalid slide layout key.');
    out[key] = sanitizeBoxes(boxes);
  }
  return out;
}

export function sanitizeBackground(value: unknown): BackgroundRef | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string' && ((BACKGROUND_VALUES as readonly string[]).includes(value) || MEDIA_BACKGROUND_PATTERN.test(value))) {
    return value as BackgroundRef;
  }
  throw new Error('Invalid template background.');
}

export function sanitizeTemplate(value: unknown): SlideTemplate {
  if (!isObj(value)) throw new Error('Invalid template.');
  if (typeof value.id !== 'string' || !ID_PATTERN.test(value.id) || isBuiltInTemplate(value.id)) throw new Error('Invalid template id.');
  if (typeof value.name !== 'string' || value.name.length > 200) throw new Error('Invalid template name.');
  return { id: value.id, name: value.name, background: sanitizeBackground(value.background), bgFilter: sanitizeFilter(value.bgFilter), boxes: sanitizeBoxes(value.boxes) };
}

// ----- "Slides" items (free-form decks) -----

export const MAX_DECK_SLIDES = 500;

export function starterDeckBoxes(): LayoutBox[] {
  return [
    makeBox('text', { x: 6, y: 8, w: 88, h: 16, text: 'Slide title', style: { size: 4.4 } }),
    makeBox('text', { x: 8, y: 30, w: 84, h: 56, text: 'Type your points here', style: { size: 3, bold: false, align: 'left', valign: 'top', lineHeight: 1.35 } })
  ];
}

export function newDeckSlide(boxes: LayoutBox[] = starterDeckBoxes(), background: BackgroundRef | null = null): DeckSlide {
  return { id: newBoxId(), background, boxes };
}

/** The words on a deck slide, for the stage display and search. */
export function deckSlideText(page: DeckSlide): string[] {
  return page.boxes
    .filter((b) => !b.hidden && (b.role === 'text' || b.role === 'content') && b.text.trim())
    .flatMap((b) => b.text.split('\n'))
    .slice(0, 40);
}

/** Puts a template on a deck slide, moving its words into the template's text boxes and keeping its pictures. */
export function applyTemplateToDeckSlide(page: DeckSlide, template: SlideTemplate): DeckSlide {
  const texts = page.boxes.filter((b) => b.role === 'text' || b.role === 'content').map((b) => b.text);
  let i = 0;
  const boxes = cloneBoxes(template.boxes, true).map((b) => {
    if (b.role !== 'content' && b.role !== 'text') return b;
    const text = texts[i++];
    return { ...b, role: 'text' as const, text: text ?? (b.role === 'text' ? b.text : '') };
  });
  const leftover = texts.slice(i).filter((x) => x.trim());
  const extra = leftover.length ? [makeBox('text', { x: 8, y: 60, w: 84, h: 28, text: leftover.join('\n'), style: { size: 2.6, bold: false } })] : [];
  const pictures = page.boxes.filter((b) => b.role === 'image');
  return { ...page, boxes: [...boxes, ...extra, ...pictures] };
}

export function sanitizeDeck(value: unknown): DeckSlide[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.length > MAX_DECK_SLIDES) throw new Error('Invalid slide list.');
  const deck = value.map((page) => {
    if (!isObj(page) || typeof page.id !== 'string' || !ID_PATTERN.test(page.id)) throw new Error('Invalid slide.');
    return { id: page.id, background: sanitizeBackground(page.background), bgFilter: sanitizeFilter(page.bgFilter), boxes: sanitizeBoxes(page.boxes) };
  });
  if (new Set(deck.map((p) => p.id)).size !== deck.length) throw new Error('Two slides share the same id.');
  return deck;
}
