import type { EditableItemFields, EditablePlanFields, ItemSource, MediaItem, ServiceItem, ServicePlan, Slide } from '../types';
import { toSource, withSlides } from '../data/itemFactory';
import { CURRENT_SCHEMA_VERSION, type AppData } from '../../shared/data-types';
import type { SlideTemplate } from '../../shared/layout';
import type { Overlay } from '../../shared/overlay';
import { DEFAULT_SETTINGS, type AppSettings } from '../../shared/extras';

export interface LiveAlert {
  text: string;
  since: number;
}

export interface SlidePointer {
  itemId: string;
  slideIndex: number;
}

export interface PresentationState {
  /** False until saved data has been loaded. */
  loaded: boolean;
  /** Every song, passage and announcement. */
  library: ServiceItem[];
  plans: ServicePlan[];
  /** Images in the Media Library. */
  media: MediaItem[];
  /** Templates made by the operator. */
  templates: SlideTemplate[];
  overlays: Overlay[];
  /** Overlay id -> when it was turned on (ms). Not saved: everything starts off. */
  overlayOn: Record<string, number>;
  /** The plan shown in Live Studio. */
  activePlanId: string | null;
  /** Derived: the active plan's items in running order. Never set directly. */
  items: ServiceItem[];
  selectedItemId: string | null;
  /** Program: what the audience sees. */
  live: SlidePointer | null;
  /** Preview: a slide queued by the operator. "Take" sends it to Program. null = the next slide in order. */
  preview: SlidePointer | null;
  blackout: boolean;
  /** When the current live slide went live (ms). Keeps videos in step on every screen. */
  liveSince: number;
  /** When the current live item went live (ms), for service timing. */
  itemLiveSince: number;
  settings: AppSettings;
  /** Message shown on the projector and stage display. Not saved. */
  alert: LiveAlert | null;
  /** Safe-area guide on every screen, while setting up. Not saved. */
  screenGuide: boolean;
}

export interface LoadedData {
  library: ItemSource[];
  plans: ServicePlan[];
  media: MediaItem[];
  templates?: SlideTemplate[];
  overlays?: Overlay[];
  activePlanId: string | null;
  settings?: AppSettings;
}

export type PresentationAction =
  | { type: 'loadData'; data: LoadedData }
  | { type: 'selectItem'; itemId: string }
  | { type: 'goLive'; itemId: string; slideIndex: number }
  | { type: 'setPreview'; itemId: string; slideIndex: number }
  | { type: 'clearPreview' }
  | { type: 'take' }
  | { type: 'step'; delta: 1 | -1 }
  | { type: 'toggleBlackout' }
  | { type: 'clear' }
  | { type: 'createItem'; item: ServiceItem; planId: string | null }
  | { type: 'updateItem'; itemId: string; changes: Partial<EditableItemFields> }
  | { type: 'deleteItem'; itemId: string }
  | { type: 'addToPlan'; planId: string; itemId: string }
  | { type: 'removeFromPlan'; planId: string; itemId: string }
  | { type: 'movePlanItem'; planId: string; from: number; to: number }
  | { type: 'createPlan'; plan: ServicePlan }
  | { type: 'updatePlan'; planId: string; changes: Partial<EditablePlanFields> }
  | { type: 'deletePlan'; planId: string }
  | { type: 'openPlan'; planId: string }
  | { type: 'addMedia'; items: MediaItem[] }
  | { type: 'removeMedia'; mediaId: string }
  | { type: 'createTemplate'; template: SlideTemplate }
  | { type: 'updateTemplate'; templateId: string; changes: Partial<Omit<SlideTemplate, 'id'>> }
  | { type: 'deleteTemplate'; templateId: string }
  | { type: 'createOverlay'; overlay: Overlay }
  | { type: 'updateOverlay'; overlayId: string; changes: Partial<Omit<Overlay, 'id' | 'kind'>> }
  | { type: 'deleteOverlay'; overlayId: string }
  | { type: 'moveOverlay'; overlayId: string; delta: 1 | -1 }
  | { type: 'setOverlay'; overlayId: string; on: boolean }
  | { type: 'allOverlaysOff' }
  | { type: 'addItems'; items: ServiceItem[] }
  | { type: 'updateSettings'; changes: Partial<AppSettings> }
  | { type: 'showAlert'; text: string }
  | { type: 'hideAlert' }
  | { type: 'setScreenGuide'; on: boolean };

export interface ResolvedSlide {
  item: ServiceItem;
  slide: Slide;
  index: number;
}

export function createInitialState(): PresentationState {
  return { loaded: false, library: [], plans: [], media: [], templates: [], overlays: [], overlayOn: {}, activePlanId: null, items: [], selectedItemId: null, live: null, preview: null, blackout: false, liveSince: 0, itemLiveSince: 0, settings: { ...DEFAULT_SETTINGS }, alert: null, screenGuide: false };
}

/** Every slide in the active service, in running order. */
function runningOrder(items: ServiceItem[]): SlidePointer[] {
  return items.flatMap((item) => item.slides.map((_, slideIndex) => ({ itemId: item.id, slideIndex })));
}

function samePointer(a: SlidePointer | null, b: SlidePointer | null): boolean {
  return !!a && !!b && a.itemId === b.itemId && a.slideIndex === b.slideIndex;
}

/** Keeps the live pointer valid after an item's slides change or it is deleted. */
function clampPointer(library: ServiceItem[], pointer: SlidePointer | null): SlidePointer | null {
  if (!pointer) return null;
  const item = library.find((i) => i.id === pointer.itemId);
  if (!item || item.slides.length === 0) return null;
  if (pointer.slideIndex < item.slides.length) return pointer;
  return { itemId: item.id, slideIndex: item.slides.length - 1 };
}

/** Recomputes derived fields and repairs references after any change. */
function finalize(state: PresentationState): PresentationState {
  const byId = new Map(state.library.map((item) => [item.id, item]));
  const activePlan = state.plans.find((p) => p.id === state.activePlanId) ?? state.plans[0] ?? null;
  const items = (activePlan?.itemIds ?? []).map((id) => byId.get(id)).filter((i): i is ServiceItem => i !== undefined);
  const selectedItemId =
    state.selectedItemId && byId.has(state.selectedItemId) ? state.selectedItemId : items[0]?.id ?? state.library[0]?.id ?? null;
  return {
    ...state,
    activePlanId: activePlan?.id ?? null,
    items,
    selectedItemId,
    live: clampPointer(state.library, state.live),
    preview: clampPointer(state.library, state.preview)
  };
}

function updatePlans(state: PresentationState, planId: string, update: (plan: ServicePlan) => ServicePlan): PresentationState {
  let changed = false;
  const plans = state.plans.map((plan) => {
    if (plan.id !== planId) return plan;
    const next = update(plan);
    if (next !== plan) changed = true;
    return next;
  });
  return changed ? { ...state, plans } : state;
}

function reduce(state: PresentationState, action: PresentationAction): PresentationState {
  switch (action.type) {
    case 'loadData':
      return {
        ...state,
        loaded: true,
        library: action.data.library.map(withSlides),
        plans: action.data.plans.map((p) => ({ ...p, itemIds: [...p.itemIds] })),
        media: [...action.data.media],
        templates: [...(action.data.templates ?? [])],
        overlays: [...(action.data.overlays ?? [])],
        settings: action.data.settings ?? { ...DEFAULT_SETTINGS },
        overlayOn: {},
        activePlanId: action.data.activePlanId,
        selectedItemId: null,
        live: null,
        preview: null,
        blackout: false
      };

    case 'selectItem':
      return state.library.some((i) => i.id === action.itemId) ? { ...state, selectedItemId: action.itemId } : state;

    case 'goLive': {
      const item = state.library.find((i) => i.id === action.itemId);
      if (!item || action.slideIndex < 0 || action.slideIndex >= item.slides.length) return state;
      const live = { itemId: item.id, slideIndex: action.slideIndex };
      return { ...state, selectedItemId: item.id, live, preview: samePointer(state.preview, live) ? null : state.preview, blackout: false };
    }

    case 'setPreview': {
      const item = state.library.find((i) => i.id === action.itemId);
      if (!item || action.slideIndex < 0 || action.slideIndex >= item.slides.length) return state;
      return { ...state, selectedItemId: item.id, preview: { itemId: item.id, slideIndex: action.slideIndex } };
    }

    case 'clearPreview':
      return state.preview ? { ...state, preview: null } : state;

    case 'take': {
      const target = getNextPointer(state);
      if (!target) return state;
      return { ...state, live: target, preview: null, selectedItemId: target.itemId, blackout: false };
    }

    case 'step': {
      const order = runningOrder(state.items);
      if (!state.live) {
        if (action.delta < 0 || order.length === 0) return state;
        const start = order.find((p) => p.itemId === state.selectedItemId) ?? order[0];
        return { ...state, live: start, selectedItemId: start.itemId };
      }
      const current = order.findIndex((p) => samePointer(p, state.live));
      if (current === -1) {
        // The live item is not in the open service (e.g. sent live from the library): move within it.
        const item = state.library.find((i) => i.id === state.live?.itemId);
        const index = state.live.slideIndex + action.delta;
        if (!item || index < 0 || index >= item.slides.length) return state;
        return { ...state, live: { itemId: item.id, slideIndex: index } };
      }
      const target = order[current + action.delta];
      if (!target) return state;
      return { ...state, live: target, selectedItemId: target.itemId };
    }

    case 'toggleBlackout':
      return { ...state, blackout: !state.blackout };

    case 'clear':
      return state.live || state.blackout ? { ...state, live: null, blackout: false } : state;

    case 'createItem': {
      if (state.library.some((i) => i.id === action.item.id)) return state;
      const withItem = { ...state, library: [...state.library, action.item], selectedItemId: action.item.id };
      if (!action.planId) return withItem;
      return updatePlans(withItem, action.planId, (plan) => ({ ...plan, itemIds: [...plan.itemIds, action.item.id] }));
    }

    case 'updateItem': {
      if (!state.library.some((i) => i.id === action.itemId)) return state;
      const library = state.library.map((item) => (item.id === action.itemId ? withSlides({ ...toSource(item), ...action.changes }) : item));
      return { ...state, library };
    }

    case 'deleteItem': {
      if (!state.library.some((i) => i.id === action.itemId)) return state;
      return {
        ...state,
        library: state.library.filter((i) => i.id !== action.itemId),
        plans: state.plans.map((p) => (p.itemIds.includes(action.itemId) ? { ...p, itemIds: p.itemIds.filter((id) => id !== action.itemId) } : p)),
        live: state.live?.itemId === action.itemId ? null : state.live,
        preview: state.preview?.itemId === action.itemId ? null : state.preview,
        selectedItemId: state.selectedItemId === action.itemId ? null : state.selectedItemId
      };
    }

    case 'addToPlan':
      if (!state.library.some((i) => i.id === action.itemId)) return state;
      return updatePlans(state, action.planId, (plan) =>
        plan.itemIds.includes(action.itemId) ? plan : { ...plan, itemIds: [...plan.itemIds, action.itemId] }
      );

    case 'removeFromPlan':
      return updatePlans(state, action.planId, (plan) =>
        plan.itemIds.includes(action.itemId) ? { ...plan, itemIds: plan.itemIds.filter((id) => id !== action.itemId) } : plan
      );

    case 'movePlanItem':
      return updatePlans(state, action.planId, (plan) => {
        const { from, to } = action;
        const n = plan.itemIds.length;
        if (from === to || from < 0 || to < 0 || from >= n || to >= n) return plan;
        const itemIds = [...plan.itemIds];
        const [moved] = itemIds.splice(from, 1);
        itemIds.splice(to, 0, moved);
        return { ...plan, itemIds };
      });

    case 'createPlan':
      if (state.plans.some((p) => p.id === action.plan.id)) return state;
      return { ...state, plans: [...state.plans, action.plan] };

    case 'updatePlan':
      return updatePlans(state, action.planId, (plan) => ({ ...plan, ...action.changes }));

    case 'deletePlan':
      if (!state.plans.some((p) => p.id === action.planId)) return state;
      return {
        ...state,
        plans: state.plans.filter((p) => p.id !== action.planId),
        activePlanId: state.activePlanId === action.planId ? null : state.activePlanId
      };

    case 'openPlan': {
      const plan = state.plans.find((p) => p.id === action.planId);
      if (!plan || plan.id === state.activePlanId) return state;
      return { ...state, activePlanId: plan.id, selectedItemId: plan.itemIds[0] ?? state.selectedItemId };
    }

    case 'addMedia': {
      const known = new Set(state.media.map((m) => m.id));
      const fresh = action.items.filter((m) => !known.has(m.id));
      return fresh.length ? { ...state, media: [...state.media, ...fresh] } : state;
    }

    case 'removeMedia': {
      if (!state.media.some((m) => m.id === action.mediaId)) return state;
      // Items that used this image fall back to a plain black background.
      const ref = `media:${action.mediaId}`;
      return {
        ...state,
        media: state.media.filter((m) => m.id !== action.mediaId),
        library: state.library.map((item) => (item.background === ref ? withSlides({ ...toSource(item), background: 'black' }) : item))
      };
    }

    case 'createTemplate':
      if (state.templates.some((tpl) => tpl.id === action.template.id)) return state;
      return { ...state, templates: [...state.templates, action.template] };

    case 'updateTemplate':
      if (!state.templates.some((tpl) => tpl.id === action.templateId)) return state;
      return { ...state, templates: state.templates.map((tpl) => (tpl.id === action.templateId ? { ...tpl, ...action.changes, id: tpl.id } : tpl)) };

    case 'createOverlay':
      if (state.overlays.some((o) => o.id === action.overlay.id)) return state;
      return { ...state, overlays: [...state.overlays, action.overlay] };

    case 'updateOverlay':
      if (!state.overlays.some((o) => o.id === action.overlayId)) return state;
      return { ...state, overlays: state.overlays.map((o) => (o.id === action.overlayId ? { ...o, ...action.changes, id: o.id, kind: o.kind } : o)) };

    case 'deleteOverlay': {
      if (!state.overlays.some((o) => o.id === action.overlayId)) return state;
      const overlayOn = { ...state.overlayOn };
      delete overlayOn[action.overlayId];
      return { ...state, overlays: state.overlays.filter((o) => o.id !== action.overlayId), overlayOn };
    }

    case 'moveOverlay': {
      const i = state.overlays.findIndex((o) => o.id === action.overlayId);
      const j = i + action.delta;
      if (i < 0 || j < 0 || j >= state.overlays.length) return state;
      const overlays = [...state.overlays];
      [overlays[i], overlays[j]] = [overlays[j], overlays[i]];
      return { ...state, overlays };
    }

    case 'setOverlay': {
      const isOn = action.overlayId in state.overlayOn;
      if (isOn === action.on || !state.overlays.some((o) => o.id === action.overlayId)) return state;
      const overlayOn = { ...state.overlayOn };
      if (action.on) overlayOn[action.overlayId] = Date.now();
      else delete overlayOn[action.overlayId];
      return { ...state, overlayOn };
    }

    case 'allOverlaysOff':
      return Object.keys(state.overlayOn).length ? { ...state, overlayOn: {} } : state;

    case 'addItems': {
      const known = new Set(state.library.map((i) => i.id));
      const fresh = action.items.filter((i) => !known.has(i.id));
      return fresh.length ? { ...state, library: [...state.library, ...fresh] } : state;
    }

    case 'updateSettings':
      return { ...state, settings: { ...state.settings, ...action.changes } };

    case 'showAlert': {
      const text = action.text.trim().slice(0, 300);
      return text ? { ...state, alert: { text, since: Date.now() } } : state;
    }

    case 'hideAlert':
      return state.alert ? { ...state, alert: null } : state;

    case 'setScreenGuide':
      return state.screenGuide === action.on ? state : { ...state, screenGuide: action.on };

    case 'deleteTemplate': {
      if (!state.templates.some((tpl) => tpl.id === action.templateId)) return state;
      return {
        ...state,
        templates: state.templates.filter((tpl) => tpl.id !== action.templateId),
        library: state.library.map((item) => (item.templateId === action.templateId ? withSlides({ ...toSource(item), templateId: null }) : item))
      };
    }

    default:
      return state;
  }
}

export function presentationReducer(state: PresentationState, action: PresentationAction): PresentationState {
  const next = reduce(state, action);
  if (next === state) return state;
  const done = finalize(next);
  const sameLive = (done.live === null && state.live === null) || samePointer(done.live, state.live);
  if (sameLive) return done;
  const now = Date.now();
  const sameItem = done.live?.itemId === state.live?.itemId;
  return { ...done, liveSince: now, itemLiveSince: sameItem ? done.itemLiveSince : now };
}

/** What gets written to disk. */
export function toAppData(state: Pick<PresentationState, 'library' | 'plans' | 'media' | 'templates' | 'overlays' | 'activePlanId' | 'settings'>): AppData {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    library: state.library.map(toSource),
    plans: state.plans,
    media: state.media,
    templates: state.templates,
    overlays: state.overlays,
    activePlanId: state.activePlanId,
    settings: state.settings
  };
}

export function getActivePlan(state: PresentationState): ServicePlan | null {
  return state.plans.find((p) => p.id === state.activePlanId) ?? null;
}

export function resolvePointer(state: PresentationState, pointer: SlidePointer | null): ResolvedSlide | null {
  if (!pointer) return null;
  const item = state.library.find((i) => i.id === pointer.itemId);
  const slide = item?.slides[pointer.slideIndex];
  return item && slide ? { item, slide, index: pointer.slideIndex } : null;
}

/** The slide that Take / Next will send live: the Preview slide if one is queued, otherwise the next in order. */
export function getNextPointer(state: PresentationState): SlidePointer | null {
  if (state.preview) return state.preview;
  const order = runningOrder(state.items);
  if (!state.live) return order.find((p) => p.itemId === state.selectedItemId) ?? order[0] ?? null;
  const current = order.findIndex((p) => samePointer(p, state.live));
  if (current === -1) {
    const item = state.library.find((i) => i.id === state.live?.itemId);
    const index = state.live.slideIndex + 1;
    return item && index < item.slides.length ? { itemId: item.id, slideIndex: index } : null;
  }
  return order[current + 1] ?? null;
}

export function describeSlide(resolved: ResolvedSlide | null): string {
  return resolved ? `${resolved.item.title} · ${resolved.index + 1}/${resolved.item.slides.length}` : '';
}

export function describeLive(state: PresentationState): string {
  if (state.blackout) return 'Blackout';
  return describeSlide(resolvePointer(state, state.live)) || 'Clear';
}
