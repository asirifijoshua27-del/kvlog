// Extra item fields (song key, second language, OBS scene, planned length…) and app-wide
// settings. Both are optional in saved data, so older files load without a migration.
import { ITEM_KIND_VALUES, type ItemKind } from './data-types';

export type Bilingual = 'off' | 'stacked' | 'columns';

export interface ItemExtras {
  /** OBS scene to switch to when this item goes live. '' = use the default for its type. '-' = never switch. */
  obsScene: string;
  /** Planned length in seconds. 0 = not planned. */
  durationSec: number;
  /** Songs: original key, e.g. "G" or "Bbm". */
  songKey: string;
  /** Songs: semitones to move the chords on the stage display (-11 to 11). */
  transpose: number;
  /** Songs: CCLI song number. */
  ccli: string;
  /** Songs: the same lyrics in a second language, with the same section labels. */
  content2: string;
  bilingual: Bilingual;
}

export const DEFAULT_EXTRAS: ItemExtras = { obsScene: '', durationSec: 0, songKey: '', transpose: 0, ccli: '', content2: '', bilingual: 'off' };

const str = (v: unknown, max: number): string => (typeof v === 'string' ? v.slice(0, max) : '');
const int = (v: unknown, min: number, max: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.round(Math.min(max, Math.max(min, v))) : 0;

export function sanitizeExtras(value: unknown): ItemExtras | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined;
  const v = value as Record<string, unknown>;
  return {
    obsScene: str(v.obsScene, 512),
    durationSec: int(v.durationSec, 0, 6 * 3600),
    songKey: str(v.songKey, 12),
    transpose: int(v.transpose, -11, 11),
    ccli: str(v.ccli, 20).replace(/[^\d]/g, ''),
    content2: str(v.content2, 200000),
    bilingual: v.bilingual === 'stacked' || v.bilingual === 'columns' ? v.bilingual : 'off'
  };
}

export function extrasOf(item: { extra?: ItemExtras }): ItemExtras {
  return item.extra ?? DEFAULT_EXTRAS;
}

/** Percent of the screen kept empty on each side (TVs and projectors often cut off the edges). */
export interface Margins {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export type StageLayout = 'standard' | 'band' | 'pastor' | 'words';

export interface ScreenSetup {
  projector: Margins;
  obs: Margins;
  stage: Margins;
  /** Template used in OBS instead of each item's own: 'same' = like the projector, 'classic' = KVLOG's classic look, or a template id. */
  obsTemplate: string;
  stageLayout: StageLayout;
  /** Stage display text size, percent (100 = normal). */
  stageTextScale: number;
}

export const NO_MARGINS: Margins = { top: 0, right: 0, bottom: 0, left: 0 };
export const STAGE_LAYOUTS: { id: StageLayout; label: string; help: string }[] = [
  { id: 'standard', label: 'Standard', help: 'Current and next slide, notes, clock and timer.' },
  { id: 'band', label: 'Band', help: 'Big words with chords and the key, then the next slide. No notes.' },
  { id: 'pastor', label: 'Pastor', help: 'Big clock and timer, large notes, the current slide smaller.' },
  { id: 'words', label: 'Words only', help: 'Only the current words, as large as possible (for singers).' }
];
export const DEFAULT_SCREENS: ScreenSetup = {
  projector: { ...NO_MARGINS },
  obs: { ...NO_MARGINS },
  stage: { ...NO_MARGINS },
  obsTemplate: 'same',
  stageLayout: 'standard',
  stageTextScale: 100
};
export const MAX_MARGIN = 25;

function sanitizeMargins(value: unknown): Margins {
  if (typeof value !== 'object' || value === null) return { ...NO_MARGINS };
  const v = value as Record<string, unknown>;
  const m = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) ? Math.round(Math.min(MAX_MARGIN, Math.max(0, x)) * 10) / 10 : 0);
  return { top: m(v.top), right: m(v.right), bottom: m(v.bottom), left: m(v.left) };
}

export function sanitizeScreens(value: unknown): ScreenSetup {
  if (typeof value !== 'object' || value === null) return { ...DEFAULT_SCREENS };
  const v = value as Record<string, unknown>;
  const layout = STAGE_LAYOUTS.some((l) => l.id === v.stageLayout) ? (v.stageLayout as StageLayout) : 'standard';
  const scale = typeof v.stageTextScale === 'number' && Number.isFinite(v.stageTextScale) ? Math.round(Math.min(200, Math.max(50, v.stageTextScale))) : 100;
  return {
    projector: sanitizeMargins(v.projector),
    obs: sanitizeMargins(v.obs),
    stage: sanitizeMargins(v.stage),
    obsTemplate: typeof v.obsTemplate === 'string' && v.obsTemplate ? v.obsTemplate.slice(0, 100) : 'same',
    stageLayout: layout,
    stageTextScale: scale
  };
}

/**
 * Where a 16:9 picture goes inside the margins, keeping its shape: scale (0–1) and the top-left
 * corner in percent of the screen's width (x) and height (y).
 */
export function pictureFrame(m: Margins | null | undefined): { scale: number; x: number; y: number } {
  if (!m) return { scale: 1, x: 0, y: 0 };
  const w = 100 - m.left - m.right;
  const h = 100 - m.top - m.bottom;
  const scale = Math.max(0.3, Math.min(w, h) / 100);
  return { scale, x: m.left + (w - scale * 100) / 2, y: m.top + (h - scale * 100) / 2 };
}

export function hasMargins(m: Margins | null | undefined): boolean {
  return !!m && (m.top > 0 || m.right > 0 || m.bottom > 0 || m.left > 0);
}

export interface AppSettings {
  /** CCLI (or similar) licence number, printed on usage reports. */
  ccliLicence: string;
  /** Record every song shown, for licence reports. */
  logUsage: boolean;
  /** Show chords on the stage display. */
  stageChords: boolean;
  /** Ready-made alert messages. */
  alertPresets: string[];
  /** Switch OBS scenes automatically when an item goes live. */
  obsAuto: boolean;
  /** Default OBS scene per item type. */
  obsSceneByKind: Partial<Record<ItemKind, string>>;
  /** Safe margins per screen, the OBS template and the stage display layout. */
  screens: ScreenSetup;
}

export const DEFAULT_SETTINGS: AppSettings = {
  ccliLicence: '',
  logUsage: false,
  stageChords: true,
  alertPresets: ['Parent of child at the nursery, please come to the nursery.', 'A car is blocking the gate. Please move it.', 'Please silence your phones.'],
  obsAuto: false,
  obsSceneByKind: {},
  screens: DEFAULT_SCREENS
};

export function sanitizeSettings(value: unknown): AppSettings {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return { ...DEFAULT_SETTINGS };
  const v = value as Record<string, unknown>;
  const byKind: Partial<Record<ItemKind, string>> = {};
  if (typeof v.obsSceneByKind === 'object' && v.obsSceneByKind !== null) {
    for (const kind of ITEM_KIND_VALUES) {
      const scene = (v.obsSceneByKind as Record<string, unknown>)[kind];
      if (typeof scene === 'string' && scene) byKind[kind] = scene.slice(0, 512);
    }
  }
  return {
    ccliLicence: str(v.ccliLicence, 40),
    logUsage: v.logUsage === true,
    stageChords: v.stageChords !== false,
    alertPresets: Array.isArray(v.alertPresets)
      ? v.alertPresets.filter((p): p is string => typeof p === 'string' && p.trim() !== '').slice(0, 30).map((p) => p.slice(0, 300))
      : [...DEFAULT_SETTINGS.alertPresets],
    obsAuto: v.obsAuto === true,
    obsSceneByKind: byKind,
    screens: sanitizeScreens(v.screens)
  };
}

/** "m:ss" or "h:mm:ss". */
export function formatDuration(totalSec: number): string {
  const s = Math.max(0, Math.round(Math.abs(totalSec)));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}

/** Reads "5", "5:30" or "1:05:00" as seconds. "5" means 5 minutes. null when it can't be read. */
export function parseDuration(text: string): number | null {
  const t = text.trim();
  if (!t) return 0;
  if (!/^\d{1,3}(:\d{1,2}){0,2}$/.test(t)) return null;
  const parts = t.split(':').map(Number);
  if (parts.length === 1) return parts[0] * 60;
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0] * 3600 + parts[1] * 60 + parts[2];
}
