import type { BackgroundId, BackgroundRef, ItemKind, MediaItem, ServicePlan, StoredItem } from '../shared/data-types';

export type { BackgroundId, BackgroundRef, ItemKind, MediaItem, ServicePlan };

export type ModuleId = 'live' | 'overlays' | 'bible' | 'edit' | 'presentation' | 'displays' | 'planner' | 'media' | 'broadcast' | 'settings';

export interface Slide {
  id: string;
  /** Position in the item (0 = first). */
  index?: number;
  group?: string;
  lines: string[];
  footer?: string;
  /** Presentation slide image (media file name). */
  image?: string;
  /** Two translations side by side (scripture). `lines` still holds all the text. */
  columns?: [string[], string[]];
  /** Songs with chords: the lines with inline [G] chords, for the stage display. */
  chords?: string[];
}

/** An item as stored: the raw text the operator typed, without generated slides. */
export type ItemSource = StoredItem;

/** An item in memory: stored fields plus slides generated from `content`. Never edit slides directly. */
export interface ServiceItem extends StoredItem {
  slides: Slide[];
}

export type EditableItemFields = Pick<ServiceItem, 'title' | 'subtitle' | 'background' | 'content' | 'linesPerSlide' | 'notes' | 'transition' | 'pages' | 'templateId' | 'slideLayouts' | 'slideFilters' | 'deck' | 'extra'>;

export type EditablePlanFields = Pick<ServicePlan, 'name' | 'date'>;
