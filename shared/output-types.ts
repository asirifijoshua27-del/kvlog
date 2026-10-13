// Types for the projector and stage-display windows. Type-only except where noted.
import type { BackgroundRef, ItemKind, Transition } from './data-types';
import type { ResolvedLayout } from './layout';
import type { OutputOverlay } from './overlay';
import type { Margins, StageLayout } from './extras';

export type OutputRole = 'projector' | 'stage';

/** Everything an output window needs to draw one slide. */
export interface OutputSlide {
  itemId: string;
  title: string;
  kind: ItemKind;
  background: BackgroundRef;
  lines: string[];
  footer: string | null;
  group: string | null;
  index: number;
  total: number;
  transition: Transition;
  /** Presentation slide image (file name in the media folder). */
  image: string | null;
  /** Two translations side by side, or null. */
  columns: [string[], string[]] | null;
  /** Template / edited layout, ready to draw. null = classic look. */
  layout: ResolvedLayout | null;
  /** Songs: lines with inline chords, for the stage display. */
  chords?: string[] | null;
  songKey?: string;
  /** Semitones to move the chords on the stage display. */
  transpose?: number;
}

/** The presentation state sent from the main window to every output window. */
export interface OutputSnapshot {
  live: OutputSlide | null;
  next: OutputSlide | null;
  blackout: boolean;
  /** Overlays that are ON, bottom first. Each output keeps the ones meant for it. */
  overlays: OutputOverlay[];
  /** When the live slide went live (ms since 1970). Videos use it to stay in step on every screen. */
  liveSince: number;
  serviceName: string;
  /** Notes for the live item (stage display only). */
  notes: string;
  /** Media id -> file name, for picture/video backgrounds used by `live` and `next`. */
  media: Record<string, string>;
  /** Message for the projector and stage display (nursery call…). */
  alert?: { text: string; since: number } | null;
  /** Live item timing for the stage display. plannedSec 0 = no plan. */
  timing?: { since: number; plannedSec: number } | null;
  /** Show chords on the stage display. */
  stageChords?: boolean;
  /** The live slide drawn with the OBS template. Missing = same as `live`. */
  obsLive?: OutputSlide | null;
  /** Safe margins and stage layout. */
  screens?: { projector: Margins; obs: Margins; stage: Margins; stageLayout: StageLayout; stageTextScale: number };
  /** Show the safe-area guide on every screen (while setting up). */
  guide?: boolean;
}

export interface DisplayAssignment {
  displayId: number;
  label: string;
}

export interface RoleStatus {
  open: boolean;
  fullscreen: boolean;
  /** The display the window is currently on. */
  displayId: number | null;
  /** The display chosen in Display Manager, or null for "window". */
  assignment: DisplayAssignment | null;
  problem: string | null;
}

export type OutputsStatus = Record<OutputRole, RoleStatus>;
