// The format of KVLOG's saved data. Shared by the Electron main process (which validates and
// writes the file) and the React UI. If you change this format, raise CURRENT_SCHEMA_VERSION
// and add a migration in electron/storage.ts.
import type { DeckSlide, LayoutBox, SlideTemplate } from './layout';
import type { PictureFilter } from './filters';
import type { Overlay } from './overlay';
import type { AppSettings, ItemExtras } from './extras';

export type ItemKind = 'song' | 'scripture' | 'announcement' | 'media' | 'presentation' | 'slides';
/** How a slide replaces the one before it. */
export type Transition = 'fade' | 'cut';
export type BackgroundId = 'black' | 'midnight' | 'slate' | 'dusk';
/** A built-in background, or "media:<id>" for an image from the Media Library. */
export type BackgroundRef = BackgroundId | `media:${string}`;

export const CURRENT_SCHEMA_VERSION = 6;
export const ITEM_KIND_VALUES: readonly ItemKind[] = ['song', 'scripture', 'announcement', 'media', 'presentation', 'slides'];
export const TRANSITION_VALUES: readonly Transition[] = ['fade', 'cut'];
export const MAX_PRESENTATION_PAGES = 500;
export const BACKGROUND_VALUES: readonly BackgroundId[] = ['black', 'midnight', 'slate', 'dusk'];
export const MEDIA_BACKGROUND_PATTERN = /^media:[A-Za-z0-9-]{1,100}$/;

/**
 * An item as stored on disk. Slides are rebuilt from `content` (text items), from `background`
 * (media: one full-screen picture or video) or from `pages` (presentation: one image per slide).
 */
export interface StoredItem {
  id: string;
  kind: ItemKind;
  title: string;
  subtitle: string;
  background: BackgroundRef;
  content: string;
  linesPerSlide: number;
  notes: string;
  transition: Transition;
  /** Presentation items only: slide images (file names in the media folder), in order. */
  pages: string[];
  /** Template for this item's slides. null = KVLOG's classic look. */
  templateId: string | null;
  /** Slides edited on their own (slide number from 0 -> its boxes). Overrides the template. */
  slideLayouts: Record<string, LayoutBox[]>;
  /** Background filters for single slides (slide number from 0). Overrides the template's. */
  slideFilters?: Record<string, PictureFilter>;
  /** "Slides" items only: the slides, each a page of objects. */
  deck: DeckSlide[];
  /** Song key, second language, OBS scene, planned length… Missing in older files. */
  extra?: ItemExtras;
}

export interface ServicePlan {
  id: string;
  name: string;
  /** Local date as YYYY-MM-DD, or '' when not set. */
  date: string;
  /** Library item ids, in running order. */
  itemIds: string[];
}

/** A picture or video copied into KVLOG's media folder. */
export interface MediaItem {
  id: string;
  name: string;
  /** File name inside the media folder, e.g. "3f1c…e2.jpg". */
  fileName: string;
  kind: 'image' | 'video';
  addedAt: string;
}

export interface AppData {
  schemaVersion: number;
  library: StoredItem[];
  plans: ServicePlan[];
  media: MediaItem[];
  /** Templates made by the operator (built-in ones are not saved). */
  templates: SlideTemplate[];
  /** Logo, lower thirds, clock… (whether each is on is not saved). */
  overlays: Overlay[];
  activePlanId: string | null;
  /** Missing in older files. */
  settings?: AppSettings;
}

export interface LoadResult {
  /** null when there is no saved data yet (first launch) or it could not be recovered. */
  data: AppData | null;
  filePath: string;
  /** A message the operator should see, e.g. after recovering from a damaged file. */
  notice: string | null;
  /** True when saving is disabled to protect a file KVLOG cannot safely overwrite. */
  readOnly: boolean;
}

export interface SaveResult {
  savedAt: string;
}

export interface MediaImportResult {
  items: MediaItem[];
  /** Files that could not be imported, with the reason. */
  problems: string[];
}

/** Result of choosing a PowerPoint or PDF file. PDFs are turned into images by the UI, then saved with savePresentationPages. */
export type PresentationImportResult =
  | { status: 'canceled' }
  | { status: 'pages'; name: string; pages: string[] }
  | { status: 'pdf'; name: string; data: Uint8Array };
