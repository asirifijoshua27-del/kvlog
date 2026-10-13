import type { EditableItemFields, ItemKind, ItemSource, ServiceItem, ServicePlan } from '../types';
import { buildSlides, clampLinesPerSlide } from '../slides/buildSlides';
import { KIND_META } from './kinds';
import { todayIso } from '../services/dates';
import { newDeckSlide } from '../../shared/layout';

export function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Kept for older imports. */
export const newItemId = newId;

/** Validates an item and (re)generates its slides from its text. */
export function withSlides(source: ItemSource): ServiceItem {
  const clean: ItemSource = {
    id: source.id,
    kind: source.kind,
    title: source.title,
    subtitle: source.subtitle,
    background: source.background,
    content: source.content,
    linesPerSlide: clampLinesPerSlide(source.linesPerSlide),
    notes: source.notes,
    transition: source.transition === 'cut' ? 'cut' : 'fade',
    pages: [...(source.pages ?? [])],
    templateId: source.templateId ?? null,
    slideLayouts: source.slideLayouts ?? {},
    slideFilters: source.slideFilters ?? {},
    deck: source.deck ?? [],
    ...(source.extra ? { extra: source.extra } : {})
  };
  return { ...clean, slides: buildSlides(clean).map((slide, index) => ({ ...slide, index })) };
}

/** Removes generated slides, leaving only what is saved to disk. */
export function toSource(item: ServiceItem): ItemSource {
  return {
    id: item.id,
    kind: item.kind,
    title: item.title,
    subtitle: item.subtitle,
    background: item.background,
    content: item.content,
    linesPerSlide: item.linesPerSlide,
    notes: item.notes,
    transition: item.transition,
    pages: item.pages,
    templateId: item.templateId,
    slideLayouts: item.slideLayouts,
    slideFilters: item.slideFilters,
    deck: item.deck,
    ...(item.extra ? { extra: item.extra } : {})
  };
}

export function createItem(kind: ItemKind, fields: Partial<EditableItemFields> = {}, id: string = newId()): ServiceItem {
  const meta = KIND_META[kind];
  return withSlides({
    id,
    kind,
    title: meta.defaultTitle,
    subtitle: meta.defaultSubtitle,
    background: meta.defaultBackground,
    content: '',
    linesPerSlide: 2,
    notes: '',
    transition: 'fade',
    pages: [],
    templateId: null,
    slideLayouts: {},
    slideFilters: {},
    deck: kind === 'slides' ? [newDeckSlide()] : [],
    ...fields
  });
}

export function createPlan(fields: Partial<ServicePlan> = {}): ServicePlan {
  return {
    id: newId(),
    name: 'New service',
    date: todayIso(),
    itemIds: [],
    ...fields
  };
}
