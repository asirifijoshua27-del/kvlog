// Bible translations stored on this computer, one file per translation in
// %APPDATA%\KVLOG\bibles. Downloads come only from the fixed addresses below; imported files
// (JSON, Zefania XML or OSIS XML) are converted to KVLOG's own simple format.
import { app, dialog, net, type BrowserWindow, type OpenDialogOptions } from 'electron';
import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { BIBLE_BOOKS, BIBLE_DOWNLOADS, BIBLE_ID_PATTERN, findBook, type BibleInfo } from '../shared/bible';

const MAX_FILE_BYTES = 80 * 1024 * 1024;
const DOWNLOAD_TIMEOUT_MS = 3 * 60 * 1000;
const MIN_FULL_BIBLE_VERSES = 30000;

// Several mirrors per translation, tried in order. All are public-domain texts.
const LEGACY = 'https://raw.githubusercontent.com/scrollmapper/bible_databases';
const SOURCES: Record<string, string[]> = {
  kjv: [
    `${LEGACY}/2024/json/t_kjv.json`,
    `${LEGACY}/258c8b386894245bc2e8bfbd96d3600f0c2de8ae/json/t_kjv.json`,
    'https://raw.githubusercontent.com/thiagobodruk/bible/master/json/en_kjv.json'
  ],
  web: [`${LEGACY}/2024/json/t_web.json`, `${LEGACY}/258c8b386894245bc2e8bfbd96d3600f0c2de8ae/json/t_web.json`],
  asv: [
    `${LEGACY}/2024/json/t_asv.json`,
    `${LEGACY}/258c8b386894245bc2e8bfbd96d3600f0c2de8ae/json/t_asv.json`,
    `${LEGACY}/master/formats/json/ASV.json`
  ],
  bbe: [
    `${LEGACY}/2024/json/t_bbe.json`,
    `${LEGACY}/258c8b386894245bc2e8bfbd96d3600f0c2de8ae/json/t_bbe.json`,
    'https://raw.githubusercontent.com/thiagobodruk/bible/master/json/en_bbe.json',
    `${LEGACY}/master/formats/json/BBE.json`
  ]
};

interface StoredBible {
  format: 'kvlog-bible';
  version: 1;
  abbrev: string;
  name: string;
  source: string;
  books: { n: number; name: string; chapters: string[][] }[];
}

const cache = new Map<string, StoredBible>();

function biblesDir(): string {
  return path.join(app.getPath('userData'), 'bibles');
}

function fileFor(id: string): string {
  if (!BIBLE_ID_PATTERN.test(id)) throw new Error('Invalid Bible id.');
  return path.join(biblesDir(), `${id}.json`);
}

function toInfo(id: string, bible: StoredBible): BibleInfo {
  return {
    id,
    abbrev: bible.abbrev,
    name: bible.name,
    source: bible.source,
    books: bible.books.map((b) => ({ n: b.n, name: b.name, verses: b.chapters.map((c) => c.length) }))
  };
}

function isStored(value: unknown): value is StoredBible {
  const v = value as StoredBible;
  return !!v && v.format === 'kvlog-bible' && typeof v.abbrev === 'string' && typeof v.name === 'string' && Array.isArray(v.books);
}

async function load(id: string): Promise<StoredBible> {
  const hit = cache.get(id);
  if (hit) return hit;
  const raw: unknown = JSON.parse(await fs.readFile(fileFor(id), 'utf8'));
  if (!isStored(raw)) throw new Error('This Bible file is damaged. Delete it and download or import it again.');
  cache.set(id, raw);
  return raw;
}

async function save(id: string, bible: StoredBible): Promise<void> {
  await fs.mkdir(biblesDir(), { recursive: true });
  const file = fileFor(id);
  const temp = `${file}.tmp`;
  await fs.writeFile(temp, JSON.stringify(bible), 'utf8');
  await fs.rename(temp, file);
  cache.set(id, bible);
}

export async function listBibles(): Promise<BibleInfo[]> {
  let names: string[];
  try {
    names = await fs.readdir(biblesDir());
  } catch {
    return [];
  }
  const result: BibleInfo[] = [];
  for (const name of names) {
    const id = name.replace(/\.json$/, '');
    if (!name.endsWith('.json') || !BIBLE_ID_PATTERN.test(id)) continue;
    try {
      result.push(toInfo(id, await load(id)));
    } catch {
      // A damaged file is skipped rather than breaking the whole page.
    }
  }
  return result.sort((a, b) => a.abbrev.localeCompare(b.abbrev));
}

export async function getChapter(id: unknown, book: unknown, chapter: unknown): Promise<string[]> {
  if (typeof id !== 'string' || !BIBLE_ID_PATTERN.test(id)) throw new Error('Invalid Bible.');
  if (!Number.isInteger(book) || !Number.isInteger(chapter)) throw new Error('Invalid reference.');
  const bible = await load(id);
  return bible.books.find((b) => b.n === book)?.chapters[(chapter as number) - 1] ?? [];
}

export async function renameBible(id: unknown, abbrev: unknown, name: unknown): Promise<BibleInfo> {
  if (typeof id !== 'string' || !BIBLE_ID_PATTERN.test(id)) throw new Error('Invalid Bible.');
  if (typeof abbrev !== 'string' || !abbrev.trim() || abbrev.length > 12) throw new Error('The short name must be 1 to 12 characters.');
  if (typeof name !== 'string' || name.length > 120) throw new Error('The name is too long.');
  const bible = { ...(await load(id)), abbrev: abbrev.trim(), name: name.trim() || abbrev.trim() };
  await save(id, bible);
  return toInfo(id, bible);
}

export async function deleteBible(id: unknown): Promise<void> {
  if (typeof id !== 'string' || !BIBLE_ID_PATTERN.test(id)) throw new Error('Invalid Bible.');
  cache.delete(id);
  try {
    await fs.unlink(fileFor(id));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw new Error('Could not delete the Bible file.');
  }
}

// ----- Converting the many Bible file formats -----

type Collected = Map<number, { name: string | null; chapters: Map<number, Map<number, string>> }>;

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

function cleanText(text: string): string {
  return text
    .replace(/<(note|title|rf|fn)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, code: string) => {
      if (code[0] === '#') {
        const n = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
        return Number.isFinite(n) ? String.fromCodePoint(n) : m;
      }
      return ENTITIES[code.toLowerCase()] ?? m;
    })
    .replace(/\{[HG]\d+\}|\[[HG]\d+\]/g, '')
    .replace(/[{}¶]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function put(out: Collected, book: number | null, name: string | null, chapter: number, verse: number, text: unknown): void {
  if (!book || book < 1 || book > 66 || !Number.isInteger(chapter) || !Number.isInteger(verse) || chapter < 1 || verse < 1) return;
  if (typeof text !== 'string') return;
  const clean = cleanText(text);
  if (!clean) return;
  let entry = out.get(book);
  if (!entry) {
    entry = { name: null, chapters: new Map() };
    out.set(book, entry);
  }
  if (name && !entry.name) entry.name = name.trim().slice(0, 60);
  let ch = entry.chapters.get(chapter);
  if (!ch) {
    ch = new Map();
    entry.chapters.set(chapter, ch);
  }
  ch.set(verse, ch.has(verse) ? `${ch.get(verse)} ${clean}` : clean);
}

/** A book number from a number, a name, or (last resort) its position in the file. */
function resolveBook(id: unknown, position: number, total: number): number | null {
  const asNumber = typeof id === 'number' ? id : typeof id === 'string' && /^\d+$/.test(id.trim()) ? Number(id) : NaN;
  if (Number.isInteger(asNumber) && asNumber >= 1 && asNumber <= 66) return asNumber;
  if (typeof id === 'string') {
    const found = findBook(id);
    if (found) return found;
  }
  if (total === 27) return 40 + position;
  return position < 66 ? position + 1 : null;
}

const num = (v: unknown): number => (typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN);

function collectJson(raw: unknown, out: Collected): void {
  const r = raw as Record<string, unknown>;
  // scrollmapper (2024): { resultset: { row: [ { field: [id, book, chapter, verse, text] } ] } }
  const rows = (r?.resultset as Record<string, unknown> | undefined)?.row;
  if (Array.isArray(rows)) {
    for (const row of rows) {
      const f = (row as { field?: unknown[] }).field;
      if (Array.isArray(f)) put(out, num(f[1]), null, num(f[2]), num(f[3]), f[4]);
    }
    return;
  }
  // { books: [...] } (scrollmapper 2025 and similar)
  const books = Array.isArray(r?.books) ? (r.books as unknown[]) : Array.isArray(raw) ? (raw as unknown[]) : null;
  if (books) {
    const first = books[0] as Record<string, unknown> | undefined;
    // A flat list of verses: [{ book, chapter, verse, text }]
    if (first && ('verse' in first || 'v' in first) && ('text' in first || 't' in first)) {
      for (const v of books as Record<string, unknown>[]) {
        const bookId = v.book_id ?? v.book ?? v.b ?? v.book_name;
        put(out, resolveBook(bookId, -1, 0), typeof v.book_name === 'string' ? v.book_name : null, num(v.chapter ?? v.c), num(v.verse ?? v.v), v.text ?? v.t);
      }
      return;
    }
    books.forEach((bk, position) => {
      const b = bk as Record<string, unknown>;
      const name = typeof b.name === 'string' ? b.name : typeof b.book === 'string' ? b.book : null;
      const book = resolveBook(b.number ?? b.book_id ?? b.id ?? name ?? b.abbrev, position, books.length);
      const chapters = Array.isArray(b.chapters) ? (b.chapters as unknown[]) : [];
      chapters.forEach((ch, ci) => {
        if (Array.isArray(ch)) {
          ch.forEach((text, vi) => put(out, book, name, ci + 1, vi + 1, typeof text === 'string' ? text : (text as Record<string, unknown>)?.text));
          return;
        }
        const c = ch as Record<string, unknown>;
        const chapterNo = Number.isFinite(num(c.chapter)) ? num(c.chapter) : ci + 1;
        const verses = Array.isArray(c.verses) ? (c.verses as unknown[]) : [];
        verses.forEach((vv, vi) => {
          if (typeof vv === 'string') return put(out, book, name, chapterNo, vi + 1, vv);
          const v = vv as Record<string, unknown>;
          put(out, book, name, chapterNo, Number.isFinite(num(v.verse)) ? num(v.verse) : vi + 1, v.text);
        });
      });
    });
    return;
  }
  // { "Genesis": { "1": { "1": "text" } } } or { "Genesis": [["v1", "v2"]] }
  if (r && typeof r === 'object') {
    const keys = Object.keys(r);
    keys.forEach((key, position) => {
      const book = resolveBook(key, position, keys.length);
      const chapters = r[key];
      if (Array.isArray(chapters)) {
        chapters.forEach((ch, ci) => Array.isArray(ch) && ch.forEach((t, vi) => put(out, book, key, ci + 1, vi + 1, t)));
      } else if (chapters && typeof chapters === 'object') {
        for (const [c, verses] of Object.entries(chapters as Record<string, unknown>)) {
          if (verses && typeof verses === 'object') {
            for (const [v, t] of Object.entries(verses as Record<string, unknown>)) put(out, book, key, Number(c), Number(v), t);
          }
        }
      }
    });
  }
}

function attr(attrs: string, name: string): string | null {
  const m = new RegExp(`\\b${name}\\s*=\\s*"([^"]*)"`, 'i').exec(attrs) ?? new RegExp(`\\b${name}\\s*=\\s*'([^']*)'`, 'i').exec(attrs);
  return m ? m[1] : null;
}

function collectXml(xml: string, out: Collected): { name: string | null } {
  // Zefania: <XMLBIBLE biblename="…"><BIBLEBOOK bnumber bname><CHAPTER cnumber><VERS vnumber>
  if (/<XMLBIBLE\b/i.test(xml)) {
    const head = /<XMLBIBLE\b([^>]*)>/i.exec(xml);
    const books = [...xml.matchAll(/<BIBLEBOOK\b([^>]*)>([\s\S]*?)<\/BIBLEBOOK>/gi)];
    books.forEach((bm, position) => {
      const bname = attr(bm[1], 'bname');
      const book = resolveBook(attr(bm[1], 'bnumber') ?? bname, position, books.length);
      for (const cm of bm[2].matchAll(/<CHAPTER\b([^>]*)>([\s\S]*?)<\/CHAPTER>/gi)) {
        const c = num(attr(cm[1], 'cnumber'));
        for (const vm of cm[2].matchAll(/<VERS\b([^>]*)>([\s\S]*?)<\/VERS>/gi)) put(out, book, bname, c, num(attr(vm[1], 'vnumber')), vm[2]);
      }
    });
    return { name: head ? attr(head[1], 'biblename') : null };
  }
  // OSIS: <verse osisID="Gen.1.1">…</verse> or milestones <verse sID="Gen.1.1"/>…<verse eID="Gen.1.1"/>
  const osis = (id: string, text: string) => {
    const m = /^([1-3]?[A-Za-z]+)\.(\d+)\.(\d+)/.exec(id.split(/\s+/)[0]);
    if (m) put(out, findBook(m[1]), null, Number(m[2]), Number(m[3]), text);
  };
  for (const m of xml.matchAll(/<verse\b[^>]*\bosisID="([^"]+)"[^>]*[^/]>([\s\S]*?)<\/verse>/g)) osis(m[1], m[2]);
  for (const m of xml.matchAll(/<verse\b[^>]*\bsID="([^"]+)"[^>]*\/>([\s\S]*?)<verse\b[^>]*\beID="\1"[^>]*\/>/g)) {
    const id = /osisID="([^"]+)"/.exec(m[0])?.[1] ?? m[1];
    osis(id, m[2]);
  }
  const title = /<work\b[^>]*>[\s\S]*?<title>([\s\S]*?)<\/title>/i.exec(xml);
  return { name: title ? cleanText(title[1]) : null };
}

function finish(out: Collected): { books: StoredBible['books']; verses: number } {
  let verses = 0;
  const books = [...out.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([n, entry]) => {
      const lastChapter = Math.max(...entry.chapters.keys());
      const chapters: string[][] = [];
      for (let c = 1; c <= lastChapter; c++) {
        const ch = entry.chapters.get(c);
        if (!ch) {
          chapters.push([]);
          continue;
        }
        const lastVerse = Math.max(...ch.keys());
        const list: string[] = [];
        for (let v = 1; v <= lastVerse; v++) list.push(ch.get(v) ?? '');
        verses += ch.size;
        chapters.push(list);
      }
      return { n, name: entry.name ?? BIBLE_BOOKS[n - 1].name, chapters };
    });
  return { books, verses };
}

function convert(text: string): { books: StoredBible['books']; verses: number; name: string | null } {
  const body = text.replace(/^\uFEFF/, '').trim();
  const out: Collected = new Map();
  let name: string | null = null;
  if (body.startsWith('<')) {
    name = collectXml(body, out).name;
  } else {
    let raw: unknown;
    try {
      raw = JSON.parse(body);
    } catch {
      throw new Error('The file is not valid JSON or XML.');
    }
    collectJson(raw, out);
  }
  const result = finish(out);
  if (result.verses === 0) {
    throw new Error('No verses were found. KVLOG reads Zefania XML, OSIS XML and common JSON Bible files.');
  }
  return { ...result, name };
}

function abbrevFrom(name: string): string {
  const words = name.replace(/[^\p{L}\p{N}\s]/gu, ' ').trim().split(/\s+/).filter(Boolean);
  const initials = words.map((w) => w[0]).join('').toUpperCase();
  return (initials.length >= 2 ? initials : name.replace(/\s+/g, '')).slice(0, 8) || 'BIBLE';
}

export async function downloadBible(key: unknown): Promise<BibleInfo> {
  const entry = BIBLE_DOWNLOADS.find((d) => d.key === key);
  const urls = typeof key === 'string' ? SOURCES[key] : undefined;
  if (!entry || !urls) throw new Error('Unknown translation.');
  const problems: string[] = [];
  for (const url of urls) {
    try {
      const response = await net.fetch(url, { signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS) });
      if (!response.ok) {
        problems.push(`${response.status}`);
        continue;
      }
      const length = Number(response.headers.get('content-length') ?? 0);
      if (length > MAX_FILE_BYTES) throw new Error('too large');
      const text = await response.text();
      if (text.length > MAX_FILE_BYTES) throw new Error('too large');
      const converted = convert(text);
      if (converted.verses < MIN_FULL_BIBLE_VERSES) {
        problems.push('incomplete');
        continue;
      }
      const bible: StoredBible = {
        format: 'kvlog-bible',
        version: 1,
        abbrev: entry.abbrev,
        name: entry.name,
        source: 'Public domain · downloaded from GitHub',
        books: converted.books
      };
      await save(entry.key, bible);
      return toInfo(entry.key, bible);
    } catch (error) {
      problems.push((error as Error).name === 'TimeoutError' ? 'timed out' : (error as Error).message.slice(0, 80));
    }
  }
  throw new Error(
    `Could not download ${entry.abbrev} (${problems.join(', ')}). Check the internet connection and try again, or import a Bible file instead.`
  );
}

export async function importBible(parent: BrowserWindow | null): Promise<BibleInfo | null> {
  const options: OpenDialogOptions = {
    title: 'Import a Bible file',
    properties: ['openFile'],
    filters: [{ name: 'Bible files (Zefania/OSIS XML, JSON)', extensions: ['xml', 'osis', 'json'] }]
  };
  const result = parent ? await dialog.showOpenDialog(parent, options) : await dialog.showOpenDialog(options);
  if (result.canceled || result.filePaths.length === 0) return null;
  const file = result.filePaths[0];
  const stat = await fs.stat(file);
  if (!stat.isFile()) throw new Error('That is not a file.');
  if (stat.size > MAX_FILE_BYTES) throw new Error('Bible files must be smaller than 80 MB.');
  const converted = convert(await fs.readFile(file, 'utf8'));
  const name = (converted.name || path.basename(file, path.extname(file))).slice(0, 120);
  const bible: StoredBible = {
    format: 'kvlog-bible',
    version: 1,
    abbrev: abbrevFrom(name),
    name,
    source: `Imported from ${path.basename(file)}`.slice(0, 200),
    books: converted.books
  };
  const id = `import-${randomUUID().slice(0, 8)}`;
  await save(id, bible);
  return toInfo(id, bible);
}
