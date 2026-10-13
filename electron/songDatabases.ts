// Song databases: EasyWorship (Songs.db + SongWords.db, or a .ewsx export) and OpenLP (songs.sqlite).
// Read with sql.js (SQLite compiled to WebAssembly), so nothing needs installing on the PC.
import * as path from 'node:path';
import type { ImportedSong } from '../shared/song-import';
import { assembleSections, attr, labelFromCode, rtfToText, tidyLyrics } from './songText';

type Song = Omit<ImportedSong, 'source' | 'format'>;
type Row = Record<string, unknown>;

interface SqlDb {
  exec(sql: string): { columns: string[]; values: unknown[][] }[];
  close(): void;
}
interface SqlJs {
  Database: new (data: Uint8Array) => SqlDb;
}

let sqlPromise: Promise<SqlJs> | null = null;

function loadSql(): Promise<SqlJs> {
  if (!sqlPromise) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const init = require('sql.js') as (config: { locateFile: (file: string) => string }) => Promise<SqlJs>;
    const dir = path.dirname(require.resolve('sql.js/dist/sql-wasm.wasm'));
    sqlPromise = init({ locateFile: (file) => path.join(dir, file) });
  }
  return sqlPromise;
}

export async function openDb(data: Uint8Array): Promise<SqlDb> {
  const SQL = await loadSql();
  return new SQL.Database(data);
}

function rows(db: SqlDb, sql: string): Row[] {
  const res = db.exec(sql)[0];
  if (!res) return [];
  return res.values.map((v) => Object.fromEntries(res.columns.map((c, i) => [c.toLowerCase(), v[i]])));
}

function tables(db: SqlDb): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const t of rows(db, "SELECT name FROM sqlite_master WHERE type='table'")) {
    const name = String(t.name);
    out.set(name.toLowerCase(), rows(db, `PRAGMA table_info("${name.replace(/"/g, '""')}")`).map((c) => String(c.name).toLowerCase()));
  }
  return out;
}

const s = (v: unknown): string => (v === null || v === undefined ? '' : v instanceof Uint8Array ? Buffer.from(v).toString('utf8') : String(v));

/** EasyWorship 6/7. The song list and the words can be in one database or two (Songs.db + SongWords.db). */
export function readEasyWorship(dbs: SqlDb[]): Song[] {
  let songDb: SqlDb | null = null;
  let wordDb: SqlDb | null = null;
  for (const db of dbs) {
    const t = tables(db);
    if (t.get('song')?.includes('title')) songDb = db;
    if (t.get('word')?.includes('words')) wordDb = db;
  }
  if (!songDb) throw new Error('no EasyWorship song list was found (choose Songs.db, or a .ewsx export)');
  if (!wordDb) throw new Error('no EasyWorship words were found (choose SongWords.db together with Songs.db)');
  const songCols = tables(songDb).get('song') ?? [];
  const words = new Map<string, string>();
  for (const w of rows(wordDb, 'SELECT song_id, words FROM word')) words.set(s(w.song_id), s(w.words));
  const pick = (r: Row, ...names: string[]) => names.map((n) => (songCols.includes(n) ? s(r[n]).trim() : '')).find(Boolean) ?? '';
  return rows(songDb, 'SELECT rowid AS kvlog_id, * FROM song').map((r) => {
    const rtf = words.get(s(r.kvlog_id)) ?? words.get(s(r.id)) ?? '';
    const text = rtf.trimStart().startsWith('{\\rtf') ? rtfToText(rtf) : rtf;
    return {
      title: pick(r, 'title') || 'Untitled song',
      subtitle: [pick(r, 'author'), pick(r, 'copyright')].filter(Boolean).join(' · '),
      ccli: pick(r, 'reference_number', 'ccli_number').replace(/\D/g, ''),
      songKey: pick(r, 'song_key', 'key'),
      content: tidyLyrics(text),
      content2: ''
    };
  });
}

/** OpenLP's own lyrics format: <verse type="v" label="1"><![CDATA[…]]></verse>. Formatting tags are removed. */
function openLpLyrics(xml: string, verseOrder: string): { content: string; content2: string } {
  const byLang = new Map<string, { label: string; text: string }[]>();
  for (const m of xml.matchAll(/<verse(\s[^>]*)>([\s\S]*?)<\/verse>/gi)) {
    const code = `${attr(m[1], 'type') ?? 'v'}${attr(m[1], 'label') ?? ''}`;
    const lang = (attr(m[1], 'lang') ?? '').toLowerCase();
    const text = m[2]
      .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
      .replace(/\{\/?[a-z0-9]+\}/gi, '')
      .replace(/\[---\]/g, '---');
    const list = byLang.get(lang) ?? [];
    list.push({ label: labelFromCode(code), text });
    byLang.set(lang, list);
  }
  const order = verseOrder.split(/\s+/).filter(Boolean).map(labelFromCode);
  const langs = [...byLang.keys()].sort((a, b) => (a.startsWith('en') ? -1 : b.startsWith('en') ? 1 : 0));
  return {
    content: assembleSections(byLang.get(langs[0] ?? '') ?? [], order),
    content2: langs[1] ? assembleSections(byLang.get(langs[1]) ?? [], order) : ''
  };
}

/** OpenLP 2.x / 3.x songs.sqlite (in OpenLP's data folder, under "songs"). */
export function readOpenLp(db: SqlDb): Song[] {
  const t = tables(db);
  if (!t.get('songs')?.includes('lyrics')) throw new Error('this is not an OpenLP song database');
  const authors = new Map<string, string[]>();
  if (t.has('authors') && t.has('authors_songs')) {
    for (const a of rows(db, 'SELECT s.song_id AS song_id, a.display_name AS name FROM authors_songs s JOIN authors a ON a.id = s.author_id')) {
      const list = authors.get(s(a.song_id)) ?? [];
      list.push(s(a.name));
      authors.set(s(a.song_id), list);
    }
  }
  return rows(db, 'SELECT * FROM songs').map((r) => {
    const lyrics = openLpLyrics(s(r.lyrics), s(r.verse_order));
    const copyright = s(r.copyright).trim();
    return {
      title: s(r.title).trim() || 'Untitled song',
      subtitle: [(authors.get(s(r.id)) ?? []).join(', '), copyright ? `© ${copyright.replace(/^©\s*/, '')}` : ''].filter(Boolean).join(' · '),
      ccli: s(r.ccli_number).replace(/\D/g, ''),
      songKey: '',
      ...lyrics
    };
  });
}
