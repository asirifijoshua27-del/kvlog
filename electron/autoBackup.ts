// Automatic daily backups of the library and services (kvlog-data.json) and the song usage log,
// in AppData\Roaming\KVLOG\backups\<date>. The last KEEP_DAYS days are kept.
// Pictures and videos are not copied every day: they are only ever added, never changed.
// "Back up now" in Settings makes a full copy including them.
import { app, shell } from 'electron';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import type { AutoBackupInfo } from '../shared/system';
import { dataFilePath, readDataFileAt, saveAppData } from './storage';
import { usageFilePath } from './usage';

export const KEEP_DAYS = 14;
const NAME = /^\d{4}-\d{2}-\d{2}$/;
const FIRST_RUN_DELAY_MS = 2 * 60 * 1000;
const CHECK_EVERY_MS = 60 * 60 * 1000;
let timer: NodeJS.Timeout | null = null;
let running: Promise<void> | null = null;

export function autoBackupDir(): string {
  return path.join(app.getPath('userData'), 'backups');
}

function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

async function folders(): Promise<string[]> {
  try {
    return (await fs.readdir(autoBackupDir(), { withFileTypes: true })).filter((e) => e.isDirectory() && NAME.test(e.name)).map((e) => e.name).sort().reverse();
  } catch {
    return [];
  }
}

async function backupToday(): Promise<void> {
  const name = today();
  const target = path.join(autoBackupDir(), name);
  try {
    await fs.access(path.join(target, 'kvlog-data.json'));
    return;
  } catch {
    // Not done yet today.
  }
  const current = await readDataFileAt(dataFilePath());
  if (current.kind !== 'ok') return;
  const temp = `${target}.tmp`;
  await fs.rm(temp, { recursive: true, force: true });
  await fs.mkdir(temp, { recursive: true });
  await fs.copyFile(dataFilePath(), path.join(temp, 'kvlog-data.json'));
  try {
    await fs.copyFile(usageFilePath(), path.join(temp, 'song-usage.jsonl'));
  } catch {
    // No usage log yet.
  }
  await fs.writeFile(
    path.join(temp, 'kvlog-backup.json'),
    JSON.stringify({ app: 'KVLOG', appVersion: app.getVersion(), createdAt: new Date().toISOString(), automatic: true, items: current.data.library.length, plans: current.data.plans.length }, null, 2),
    'utf8'
  );
  await fs.rm(target, { recursive: true, force: true });
  await fs.rename(temp, target);
  for (const old of (await folders()).slice(KEEP_DAYS)) await fs.rm(path.join(autoBackupDir(), old), { recursive: true, force: true });
}

export function runAutoBackup(): Promise<void> {
  if (!running) {
    running = backupToday()
      .catch((error: unknown) => console.error('Automatic backup failed:', (error as Error).message))
      .finally(() => {
        running = null;
      });
  }
  return running;
}

/** First backup two minutes after start (so a damaged start is not backed up straight away), then a check every hour. */
export function startAutoBackups(): void {
  if (timer) return;
  setTimeout(() => void runAutoBackup(), FIRST_RUN_DELAY_MS);
  timer = setInterval(() => void runAutoBackup(), CHECK_EVERY_MS);
}

export async function listAutoBackups(): Promise<AutoBackupInfo[]> {
  const out: AutoBackupInfo[] = [];
  for (const name of await folders()) {
    try {
      const m = JSON.parse(await fs.readFile(path.join(autoBackupDir(), name, 'kvlog-backup.json'), 'utf8')) as Record<string, unknown>;
      out.push({ name, createdAt: String(m.createdAt ?? ''), items: Number(m.items) || 0, plans: Number(m.plans) || 0 });
    } catch {
      out.push({ name, createdAt: '', items: 0, plans: 0 });
    }
  }
  return out;
}

/** Puts a daily backup back. The current data is kept as kvlog-data.json.before-restore-<time>. */
export async function restoreAutoBackup(name: unknown): Promise<AutoBackupInfo> {
  if (typeof name !== 'string' || !NAME.test(name)) throw new Error('Unknown backup.');
  const read = await readDataFileAt(path.join(autoBackupDir(), name, 'kvlog-data.json'));
  if (read.kind !== 'ok') throw new Error('That backup could not be read.');
  try {
    await fs.copyFile(dataFilePath(), `${dataFilePath()}.before-restore-${new Date().toISOString().replace(/[:.]/g, '-')}`);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw new Error('Could not keep a copy of the current data, so nothing was restored.');
  }
  await saveAppData(read.data);
  return { name, createdAt: '', items: read.data.library.length, plans: read.data.plans.length };
}

export async function openAutoBackups(): Promise<void> {
  await fs.mkdir(autoBackupDir(), { recursive: true });
  await shell.openPath(autoBackupDir());
}
