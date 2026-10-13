// Song usage log for licence reports (CCLI or similar). One line of JSON per song shown,
// in song-usage.jsonl next to the data file. A song shown again within 4 hours counts once.
import { app, dialog, type BrowserWindow } from 'electron';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import type { UsageEntry, UsageSummaryRow } from '../shared/usage';

const REPEAT_WINDOW_MS = 4 * 3600 * 1000;
let lastShown: Map<string, number> | null = null;
let chain: Promise<unknown> = Promise.resolve();

export function usageFilePath(): string {
  return path.join(app.getPath('userData'), 'song-usage.jsonl');
}

const text = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '');

async function readAll(): Promise<UsageEntry[]> {
  let raw = '';
  try {
    raw = await fs.readFile(usageFilePath(), 'utf8');
  } catch {
    return [];
  }
  const out: UsageEntry[] = [];
  for (const line of raw.split('\n')) {
    if (!line.trim()) continue;
    try {
      const e = JSON.parse(line) as UsageEntry;
      if (typeof e.at === 'string' && typeof e.title === 'string') out.push(e);
    } catch {
      // A damaged line is skipped; the rest of the log is still used.
    }
  }
  return out;
}

export async function logSongUse(input: unknown): Promise<boolean> {
  if (typeof input !== 'object' || input === null) throw new Error('Invalid usage entry.');
  const v = input as Record<string, unknown>;
  const entry: UsageEntry = {
    at: new Date().toISOString(),
    songId: text(v.songId, 100),
    title: text(v.title, 500),
    subtitle: text(v.subtitle, 500),
    ccli: text(v.ccli, 20).replace(/\D/g, ''),
    service: text(v.service, 500)
  };
  if (!entry.songId || !entry.title.trim()) return false;
  if (!lastShown) {
    lastShown = new Map();
    const cutoff = Date.now() - REPEAT_WINDOW_MS;
    for (const e of await readAll()) {
      const t = Date.parse(e.at);
      if (t > cutoff) lastShown.set(e.songId, t);
    }
  }
  const prev = lastShown.get(entry.songId);
  if (prev && Date.now() - prev < REPEAT_WINDOW_MS) return false;
  lastShown.set(entry.songId, Date.now());
  const job = chain.then(() => fs.appendFile(usageFilePath(), `${JSON.stringify(entry)}\n`, 'utf8'));
  chain = job.catch(() => undefined);
  await job;
  return true;
}

function inRange(e: UsageEntry, from: unknown, to: unknown): boolean {
  const day = e.at.slice(0, 10);
  const local = new Date(e.at);
  const localDay = `${local.getFullYear()}-${String(local.getMonth() + 1).padStart(2, '0')}-${String(local.getDate()).padStart(2, '0')}`;
  const d = Number.isNaN(local.getTime()) ? day : localDay;
  return (typeof from !== 'string' || !from || d >= from) && (typeof to !== 'string' || !to || d <= to);
}

export async function usageSummary(from: unknown, to: unknown): Promise<UsageSummaryRow[]> {
  const rows = new Map<string, UsageSummaryRow>();
  for (const e of await readAll()) {
    if (!inRange(e, from, to)) continue;
    const key = e.ccli || e.title.trim().toLowerCase();
    const row = rows.get(key) ?? { title: e.title, subtitle: e.subtitle, ccli: e.ccli, count: 0, last: e.at };
    row.count++;
    if (e.at > row.last) row.last = e.at;
    rows.set(key, row);
  }
  return [...rows.values()].sort((a, b) => b.count - a.count || a.title.localeCompare(b.title));
}

const csv = (v: string | number) => {
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Saves a CSV report (opens in Excel). Returns the file path, or null when cancelled. */
export async function exportUsage(parent: BrowserWindow | null, from: unknown, to: unknown, licence: unknown): Promise<string | null> {
  const entries = (await readAll()).filter((e) => inRange(e, from, to));
  const summary = await usageSummary(from, to);
  const name = `KVLOG song report ${typeof from === 'string' && from ? from : 'start'} to ${typeof to === 'string' && to ? to : 'today'}.csv`;
  const options = { title: 'Save song report', defaultPath: path.join(app.getPath('documents'), name), filters: [{ name: 'CSV (Excel)', extensions: ['csv'] }] };
  const r = parent ? await dialog.showSaveDialog(parent, options) : await dialog.showSaveDialog(options);
  if (r.canceled || !r.filePath) return null;
  const lines: string[] = [];
  lines.push(['Licence number', typeof licence === 'string' ? licence : ''].map(csv).join(','));
  lines.push(['Period', `${from || 'start'} to ${to || 'today'}`].map(csv).join(','));
  lines.push('');
  lines.push(['Song', 'Author / copyright', 'CCLI song number', 'Times used'].map(csv).join(','));
  for (const s of summary) lines.push([s.title, s.subtitle, s.ccli, s.count].map(csv).join(','));
  lines.push('');
  lines.push(['Date', 'Time', 'Service', 'Song', 'Author / copyright', 'CCLI song number'].map(csv).join(','));
  for (const e of entries) {
    const d = new Date(e.at);
    lines.push([d.toLocaleDateString(), d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), e.service, e.title, e.subtitle, e.ccli].map(csv).join(','));
  }
  // The byte-order mark makes Excel read letters such as ɛ and ɔ correctly.
  await fs.writeFile(r.filePath, `\uFEFF${lines.join('\r\n')}\r\n`, 'utf8');
  return r.filePath;
}
