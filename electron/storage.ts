// Local data storage for KVLOG.
//
// Data lives in one JSON file in the user's app-data folder
// (usually C:\Users\<you>\AppData\Roaming\KVLOG\kvlog-data.json).
// - Every save is validated, written to a temporary file, then swapped in, so a crash
//   mid-save cannot leave a half-written file.
// - The previous version is kept as kvlog-data.json.bak.
// - A damaged file is never deleted: it is renamed to kvlog-data.json.corrupt-<time>.
// - Files carry a schemaVersion and are upgraded step by step by MIGRATIONS.
//
// SQLite will replace this file format when the library grows large enough to need it.
// The validation and migration rules here will carry over.
import { app } from 'electron';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { MEDIA_FILE_PATTERN } from '../shared/media';
import { sanitizeOverlays } from '../shared/overlay';
import { MAX_TEMPLATES, isBuiltInTemplate, sanitizeDeck, sanitizeSlideLayouts, sanitizeTemplate } from '../shared/layout';
import { sanitizeSlideFilters } from '../shared/filters';
import { sanitizeExtras, sanitizeSettings } from '../shared/extras';
import {
  BACKGROUND_VALUES,
  CURRENT_SCHEMA_VERSION,
  ITEM_KIND_VALUES,
  MAX_PRESENTATION_PAGES,
  MEDIA_BACKGROUND_PATTERN,
  TRANSITION_VALUES,
  type AppData,
  type BackgroundRef,
  type ItemKind,
  type LoadResult,
  type MediaItem,
  type SaveResult,
  type ServicePlan,
  type StoredItem,
  type Transition
} from '../shared/data-types';

const FILE_NAME = 'kvlog-data.json';
const MAX_FILE_BYTES = 50 * 1024 * 1024;
const MAX_ITEMS = 20000;
const MAX_PLANS = 5000;
const MAX_ID = 100;
const MAX_SHORT_TEXT = 500;
const MAX_LONG_TEXT = 200000;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

type Json = Record<string, unknown>;
type Migration = (data: Json) => Json;

/**
 * Each entry upgrades data FROM that version to the next one.
 * Example for a future change: 1: (data) => ({ ...data, newField: [] })
 * Never edit an existing entry once released; always add a new one.
 */
const MIGRATIONS: Record<number, Migration> = {
  // Version 2 added the Media Library.
  1: (data) => ({ ...data, media: [] }),
  // Version 3 added pictures/videos/presentations as items, and transitions.
  2: (data) => ({
    ...data,
    library: Array.isArray(data.library)
      ? data.library.map((item) => (isRecord(item) ? { ...item, transition: 'fade', pages: [] } : item))
      : data.library
  }),
  // Version 4 added templates and per-slide layouts.
  3: (data) => ({
    ...data,
    templates: [],
    library: Array.isArray(data.library)
      ? data.library.map((item) => (isRecord(item) ? { ...item, templateId: null, slideLayouts: {} } : item))
      : data.library
  }),
  // Version 5 added "Slides" items (free-form decks), and lock/hide/transparency on objects.
  4: (data) => ({
    ...data,
    library: Array.isArray(data.library) ? data.library.map((item) => (isRecord(item) ? { ...item, deck: [] } : item)) : data.library
  }),
  // Version 6 added overlays.
  5: (data) => ({ ...data, overlays: [] })
};

let readOnly = false;
let writeChain: Promise<unknown> = Promise.resolve();

export function dataFilePath(): string {
  return path.join(app.getPath('userData'), FILE_NAME);
}

function backupFilePath(): string {
  return `${dataFilePath()}.bak`;
}

function isRecord(value: unknown): value is Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isText(value: unknown, max: number): value is string {
  return typeof value === 'string' && value.length <= max;
}

function isId(value: unknown): value is string {
  return isText(value, MAX_ID) && value.length > 0;
}

function validateItem(value: unknown, where: string): StoredItem {
  if (!isRecord(value)) throw new Error(`${where} is not a valid item.`);
  const { id, kind, title, subtitle, background, content, linesPerSlide, notes, transition, pages, templateId, slideLayouts, slideFilters, deck, extra } = value;
  if (!isId(id)) throw new Error(`${where} has an invalid id.`);
  if (typeof kind !== 'string' || !(ITEM_KIND_VALUES as readonly string[]).includes(kind)) {
    throw new Error(`${where} has an unknown type.`);
  }
  const isBuiltIn = typeof background === 'string' && (BACKGROUND_VALUES as readonly string[]).includes(background);
  const isMedia = typeof background === 'string' && MEDIA_BACKGROUND_PATTERN.test(background);
  if (!isBuiltIn && !isMedia) throw new Error(`${where} has an unknown background.`);
  if (!isText(title, MAX_SHORT_TEXT) || !isText(subtitle, MAX_SHORT_TEXT)) throw new Error(`${where} has an invalid title.`);
  if (!isText(content, MAX_LONG_TEXT) || !isText(notes, MAX_LONG_TEXT)) throw new Error(`${where} has text that is too long.`);
  if (typeof linesPerSlide !== 'number' || !Number.isInteger(linesPerSlide) || linesPerSlide < 1 || linesPerSlide > 4) {
    throw new Error(`${where} has an invalid lines-per-slide value.`);
  }
  if (typeof transition !== 'string' || !(TRANSITION_VALUES as readonly string[]).includes(transition)) {
    throw new Error(`${where} has an unknown transition.`);
  }
  if (!Array.isArray(pages) || pages.length > MAX_PRESENTATION_PAGES || !pages.every((p) => typeof p === 'string' && MEDIA_FILE_PATTERN.test(p))) {
    throw new Error(`${where} has an invalid slide list.`);
  }
  if (templateId !== null && !isId(templateId)) throw new Error(`${where} has an invalid template.`);
  let layouts: StoredItem['slideLayouts'];
  let pagesDeck: StoredItem['deck'];
  try {
    layouts = sanitizeSlideLayouts(slideLayouts);
    pagesDeck = sanitizeDeck(deck);
  } catch (error) {
    throw new Error(`${where}: ${(error as Error).message}`);
  }
  return {
    id,
    kind: kind as ItemKind,
    title,
    subtitle,
    background: background as BackgroundRef,
    content,
    linesPerSlide,
    notes,
    transition: transition as Transition,
    pages: [...(pages as string[])],
    templateId: templateId as string | null,
    slideLayouts: layouts,
    slideFilters: sanitizeSlideFilters(slideFilters),
    deck: pagesDeck,
    extra: sanitizeExtras(extra)
  };
}

function validatePlan(value: unknown, where: string): ServicePlan {
  if (!isRecord(value)) throw new Error(`${where} is not a valid service plan.`);
  const { id, name, date, itemIds } = value;
  if (!isId(id)) throw new Error(`${where} has an invalid id.`);
  if (!isText(name, MAX_SHORT_TEXT)) throw new Error(`${where} has an invalid name.`);
  if (typeof date !== 'string' || (date !== '' && !DATE_PATTERN.test(date))) throw new Error(`${where} has an invalid date.`);
  if (!Array.isArray(itemIds) || itemIds.length > MAX_ITEMS || !itemIds.every(isId)) {
    throw new Error(`${where} has an invalid item list.`);
  }
  return { id, name, date, itemIds: [...itemIds] };
}

function validateMedia(value: unknown, where: string): MediaItem {
  if (!isRecord(value)) throw new Error(`${where} is not a valid media item.`);
  const { id, name, fileName, kind, addedAt } = value;
  if (!isId(id) || !/^[A-Za-z0-9-]+$/.test(id)) throw new Error(`${where} has an invalid id.`);
  if (!isText(name, MAX_SHORT_TEXT)) throw new Error(`${where} has an invalid name.`);
  if (typeof fileName !== 'string' || !MEDIA_FILE_PATTERN.test(fileName)) throw new Error(`${where} has an invalid file name.`);
  if (kind !== 'image' && kind !== 'video') throw new Error(`${where} has an unknown media type.`);
  if (!isText(addedAt, 40)) throw new Error(`${where} has an invalid date.`);
  return { id, name, fileName, kind, addedAt };
}

/** Checks the whole data structure and repairs harmless inconsistencies (unknown or repeated item references). */
export function validateAppData(value: unknown): AppData {
  if (!isRecord(value)) throw new Error('The data is not a KVLOG data object.');
  if (value.schemaVersion !== CURRENT_SCHEMA_VERSION) throw new Error('The data has an unexpected version.');
  if (!Array.isArray(value.library) || value.library.length > MAX_ITEMS) throw new Error('The library is invalid.');
  if (!Array.isArray(value.plans) || value.plans.length > MAX_PLANS) throw new Error('The service plan list is invalid.');
  if (!Array.isArray(value.media) || value.media.length > MAX_ITEMS) throw new Error('The media list is invalid.');

  if (!Array.isArray(value.templates) || value.templates.length > MAX_TEMPLATES) throw new Error('The template list is invalid.');
  const templates = value.templates.map((tpl, i) => {
    try {
      return sanitizeTemplate(tpl);
    } catch (error) {
      throw new Error(`Template ${i + 1}: ${(error as Error).message}`);
    }
  });
  const templateIds = new Set(templates.map((tpl) => tpl.id));
  if (templateIds.size !== templates.length) throw new Error('Two templates share the same id.');

  const library = value.library.map((item, i) => {
    const valid = validateItem(item, `Library item ${i + 1}`);
    // A deleted template falls back to the classic look.
    if (valid.templateId && !isBuiltInTemplate(valid.templateId) && !templateIds.has(valid.templateId)) valid.templateId = null;
    return valid;
  });
  const itemIds = new Set<string>();
  for (const item of library) {
    if (itemIds.has(item.id)) throw new Error('Two library items share the same id.');
    itemIds.add(item.id);
  }

  const plans = value.plans.map((plan, i) => {
    const valid = validatePlan(plan, `Service plan ${i + 1}`);
    valid.itemIds = [...new Set(valid.itemIds)].filter((id) => itemIds.has(id));
    return valid;
  });
  const planIds = new Set<string>();
  for (const plan of plans) {
    if (planIds.has(plan.id)) throw new Error('Two service plans share the same id.');
    planIds.add(plan.id);
  }

  const media = value.media.map((item, i) => validateMedia(item, `Media item ${i + 1}`));
  if (new Set(media.map((m) => m.id)).size !== media.length) throw new Error('Two media items share the same id.');

  let overlays: AppData['overlays'];
  try {
    overlays = sanitizeOverlays(value.overlays);
  } catch (error) {
    throw new Error(`Overlays: ${(error as Error).message}`);
  }

  const active = value.activePlanId;
  const activePlanId = typeof active === 'string' && planIds.has(active) ? active : plans[0]?.id ?? null;

  return { schemaVersion: CURRENT_SCHEMA_VERSION, library, plans, media, templates, overlays, activePlanId, settings: sanitizeSettings(value.settings) };
}

export type ReadOutcome =
  | { kind: 'missing' }
  | { kind: 'ok'; data: AppData }
  | { kind: 'newer'; version: number }
  | { kind: 'invalid'; message: string };

function upgrade(raw: Json): Json {
  let version = typeof raw.schemaVersion === 'number' ? raw.schemaVersion : 0;
  let data = raw;
  while (version < CURRENT_SCHEMA_VERSION) {
    const migration = MIGRATIONS[version];
    if (!migration) throw new Error(`There is no upgrade path from data version ${version}.`);
    data = { ...migration(data), schemaVersion: version + 1 };
    version += 1;
  }
  return data;
}

export async function readDataFileAt(filePath: string): Promise<ReadOutcome> {
  return readDataFile(filePath);
}

async function readDataFile(filePath: string): Promise<ReadOutcome> {
  let text: string;
  try {
    const stat = await fs.stat(filePath);
    if (stat.size > MAX_FILE_BYTES) return { kind: 'invalid', message: 'the file is too large' };
    text = await fs.readFile(filePath, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { kind: 'missing' };
    return { kind: 'invalid', message: 'the file could not be opened' };
  }

  try {
    const raw: unknown = JSON.parse(text);
    if (!isRecord(raw)) return { kind: 'invalid', message: 'the file is not KVLOG data' };
    if (typeof raw.schemaVersion === 'number' && raw.schemaVersion > CURRENT_SCHEMA_VERSION) {
      return { kind: 'newer', version: raw.schemaVersion };
    }
    return { kind: 'ok', data: validateAppData(upgrade(raw)) };
  } catch (error) {
    const detail = error instanceof SyntaxError ? 'the file is damaged' : (error as Error).message;
    return { kind: 'invalid', message: detail };
  }
}

function timestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

export async function loadAppData(): Promise<LoadResult> {
  const filePath = dataFilePath();
  readOnly = false;

  const main = await readDataFile(filePath);
  if (main.kind === 'ok') return { data: main.data, filePath, notice: null, readOnly: false };

  if (main.kind === 'newer') {
    readOnly = true;
    return {
      data: null,
      filePath,
      readOnly: true,
      notice: `Your saved data was created by a newer version of KVLOG (data version ${main.version}). To protect it, this version will not save any changes. Please update KVLOG.`
    };
  }

  const backup = await readDataFile(backupFilePath());

  if (main.kind === 'missing') {
    if (backup.kind === 'ok') {
      return { data: backup.data, filePath, readOnly: false, notice: 'The data file was missing, so KVLOG restored the most recent backup.' };
    }
    return { data: null, filePath, notice: null, readOnly: false };
  }

  // The main file exists but cannot be used. Keep it aside rather than overwrite it.
  const keptAs = `${filePath}.corrupt-${timestamp()}`;
  let keptName = path.basename(keptAs);
  try {
    await fs.rename(filePath, keptAs);
  } catch {
    readOnly = true;
    keptName = '';
  }
  const kept = keptName ? ` The unreadable file was kept as ${keptName}.` : ' Saving is disabled so the file is not overwritten.';

  if (backup.kind === 'ok' && !readOnly) {
    return {
      data: backup.data,
      filePath,
      readOnly: false,
      notice: `Your data file could not be read (${main.message}). KVLOG restored the most recent backup.${kept}`
    };
  }
  return {
    data: null,
    filePath,
    readOnly,
    notice: `Your data file could not be read (${main.message}). KVLOG started with sample content.${kept}`
  };
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function writeAtomically(json: string): Promise<void> {
  const filePath = dataFilePath();
  const tempPath = `${filePath}.tmp`;
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(tempPath, json, 'utf8');

  try {
    await fs.copyFile(filePath, backupFilePath());
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }

  // Antivirus or backup tools on Windows can briefly lock the file, so retry a few times.
  for (let attempt = 1; ; attempt++) {
    try {
      await fs.rename(tempPath, filePath);
      return;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (attempt >= 5 || (code !== 'EPERM' && code !== 'EBUSY' && code !== 'EACCES')) throw error;
      await delay(100 * attempt);
    }
  }
}

export async function saveAppData(input: unknown): Promise<SaveResult> {
  if (readOnly) throw new Error('Saving is turned off to protect your existing data file.');
  const data = validateAppData(input);
  const json = JSON.stringify(data, null, 2);
  if (Buffer.byteLength(json, 'utf8') > MAX_FILE_BYTES) throw new Error('The data is too large to save.');

  // Saves run one at a time, in order.
  const job = writeChain.then(() => writeAtomically(json));
  writeChain = job.catch(() => undefined);
  try {
    await job;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    throw new Error(code ? `Could not write the data file (${code}).` : 'Could not write the data file.');
  }
  return { savedAt: new Date().toISOString() };
}
