// Full backup and restore: the library, services, templates, overlays, media files, Bibles and the
// song usage log, written to an ordinary folder (copy it to a USB stick or another PC).
// OBS passwords are not included: they are encrypted for this Windows account only.
import { app, dialog, type BrowserWindow, type OpenDialogOptions } from 'electron';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { MEDIA_FILE_PATTERN } from '../shared/media';
import type { BackupResult } from '../shared/usage';
import { dataFilePath, readDataFileAt, saveAppData } from './storage';
import { mediaDir } from './media';
import { usageFilePath } from './usage';

const MANIFEST = 'kvlog-backup.json';
const BIBLE_FILE = /^[A-Za-z0-9_-]{1,100}\.json$/;

const biblesDir = () => path.join(app.getPath('userData'), 'bibles');

async function pickFolder(parent: BrowserWindow | null, title: string, create: boolean): Promise<string | null> {
  const options: OpenDialogOptions = { title, properties: create ? ['openDirectory', 'createDirectory', 'promptToCreate'] : ['openDirectory'] };
  const r = parent ? await dialog.showOpenDialog(parent, options) : await dialog.showOpenDialog(options);
  return r.canceled || !r.filePaths[0] ? null : r.filePaths[0];
}

async function list(dir: string, pattern: RegExp): Promise<string[]> {
  try {
    return (await fs.readdir(dir)).filter((n) => pattern.test(n));
  } catch {
    return [];
  }
}

/** Copies files that match; existing files are kept unless overwrite is set. Returns how many were copied. */
async function copyFiles(from: string, to: string, pattern: RegExp, problems: string[], overwrite: boolean): Promise<number> {
  const names = await list(from, pattern);
  if (!names.length) return 0;
  await fs.mkdir(to, { recursive: true });
  let copied = 0;
  for (const name of names) {
    const target = path.join(to, name);
    try {
      if (!overwrite) {
        try {
          await fs.access(target);
          continue;
        } catch {
          // Not there yet: copy it.
        }
      }
      await fs.copyFile(path.join(from, name), target);
      copied++;
    } catch (error) {
      problems.push(`${name}: ${(error as NodeJS.ErrnoException).code ?? 'could not be copied'}`);
    }
  }
  return copied;
}

function stamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}-${p(d.getMinutes())}`;
}

export async function exportBackup(parent: BrowserWindow | null): Promise<BackupResult> {
  const base = await pickFolder(parent, 'Choose where to save the backup (a USB stick works well)', true);
  const empty: BackupResult = { folder: null, items: 0, plans: 0, mediaFiles: 0, bibles: 0, problems: [] };
  if (!base) return empty;
  const current = await readDataFileAt(dataFilePath());
  if (current.kind !== 'ok') throw new Error('There is no saved data to back up yet.');
  const folder = path.join(base, `KVLOG backup ${stamp()}`);
  await fs.mkdir(folder, { recursive: true });
  const problems: string[] = [];
  await fs.copyFile(dataFilePath(), path.join(folder, 'kvlog-data.json'));
  const mediaFiles = await copyFiles(mediaDir(), path.join(folder, 'media'), MEDIA_FILE_PATTERN, problems, true);
  const bibles = await copyFiles(biblesDir(), path.join(folder, 'bibles'), BIBLE_FILE, problems, true);
  try {
    await fs.copyFile(usageFilePath(), path.join(folder, 'song-usage.jsonl'));
  } catch {
    // No usage log yet.
  }
  const result: BackupResult = { folder, items: current.data.library.length, plans: current.data.plans.length, mediaFiles, bibles, problems };
  await fs.writeFile(
    path.join(folder, MANIFEST),
    JSON.stringify({ app: 'KVLOG', appVersion: app.getVersion(), createdAt: new Date().toISOString(), ...result, folder: undefined }, null, 2),
    'utf8'
  );
  return result;
}

/** Restores a backup folder. The current data file is kept as kvlog-data.json.before-restore-<time>. */
export async function restoreBackup(parent: BrowserWindow | null): Promise<BackupResult> {
  const folder = await pickFolder(parent, 'Choose a KVLOG backup folder', false);
  if (!folder) return { folder: null, items: 0, plans: 0, mediaFiles: 0, bibles: 0, problems: [] };
  const read = await readDataFileAt(path.join(folder, 'kvlog-data.json'));
  if (read.kind === 'missing') throw new Error('That folder is not a KVLOG backup (kvlog-data.json is missing). Choose the folder named “KVLOG backup …”.');
  if (read.kind === 'newer') throw new Error(`This backup was made by a newer KVLOG (data version ${read.version}). Update KVLOG first.`);
  if (read.kind !== 'ok') throw new Error(`The backup could not be read: ${read.message}.`);

  const problems: string[] = [];
  try {
    await fs.copyFile(dataFilePath(), `${dataFilePath()}.before-restore-${stamp().replace(' ', '_')}`);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw new Error('Could not keep a copy of the current data, so nothing was restored.');
  }
  // Files first, so nothing in the restored library points at a missing picture.
  const mediaFiles = await copyFiles(path.join(folder, 'media'), mediaDir(), MEDIA_FILE_PATTERN, problems, false);
  const bibles = await copyFiles(path.join(folder, 'bibles'), biblesDir(), BIBLE_FILE, problems, false);
  try {
    const incoming = (await fs.readFile(path.join(folder, 'song-usage.jsonl'), 'utf8')).split('\n').filter((l) => l.trim());
    let existing: string[] = [];
    try {
      existing = (await fs.readFile(usageFilePath(), 'utf8')).split('\n').filter((l) => l.trim());
    } catch {
      // No log on this PC yet.
    }
    const known = new Set(existing);
    const add = incoming.filter((l) => !known.has(l));
    if (add.length) await fs.appendFile(usageFilePath(), `${add.join('\n')}\n`, 'utf8');
  } catch {
    // The backup has no usage log.
  }
  await saveAppData(read.data);
  return { folder, items: read.data.library.length, plans: read.data.plans.length, mediaFiles, bibles, problems };
}
