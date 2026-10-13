// Song import: lets the operator pick files (or a whole folder), reads every supported format and
// returns the songs for the UI to preview. Nothing is saved here; the UI adds the chosen songs.
import { dialog, type BrowserWindow, type OpenDialogOptions } from 'electron';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import type { ImportedSong, SongImportMode, SongImportResult } from '../shared/song-import';
import { decodeText } from './songText';
import { parseChordPro, parseDocx, parseOpenLyrics, parsePlainText, parsePptx, parseProPresenter7, parseProPresenterXml } from './songFormats';
import { openDb, readEasyWorship, readOpenLp } from './songDatabases';
import { readZip } from './zip';

const TEXT_EXT = ['txt'];
const CHORDPRO_EXT = ['cho', 'chordpro', 'chopro', 'crd'];
const XML_EXT = ['xml'];
const PRO_EXT = ['pro', 'pro4', 'pro5', 'pro6'];
const OFFICE_EXT = ['docx', 'pptx'];
const DB_EXT = ['ewsx', 'db', 'sqlite'];
const OLD_EXT: Record<string, string> = {
  doc: 'Old Word files (.doc) cannot be read. Open it in Word and save it as .docx.',
  ppt: 'Old PowerPoint files (.ppt) cannot be read. Open it in PowerPoint and save it as .pptx.',
  ews: 'EasyWorship 2009 schedules (.ews) cannot be read. Open the songs in EasyWorship 6 or 7 and export them (.ewsx), or choose Songs.db and SongWords.db.'
};
const ALL_EXT = [...TEXT_EXT, ...CHORDPRO_EXT, ...XML_EXT, ...PRO_EXT, ...OFFICE_EXT, ...DB_EXT];
const MAX_FILES = 20000;
const MAX_FILE_BYTES = 100 * 1024 * 1024;
const MAX_DB_BYTES = 600 * 1024 * 1024;
const MAX_SONGS = 50000;

const ext = (file: string) => path.extname(file).slice(1).toLowerCase();
const baseTitle = (file: string) => path.basename(file, path.extname(file)).replace(/[_]+/g, ' ').trim() || 'Untitled song';

async function walk(dir: string, out: string[], depth = 0): Promise<void> {
  if (depth > 8 || out.length >= MAX_FILES) return;
  let entries: import('node:fs').Dirent[];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    if (out.length >= MAX_FILES) return;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) await walk(full, out, depth + 1);
    else if (e.isFile() && (ALL_EXT.includes(ext(e.name)) || ext(e.name) in OLD_EXT)) out.push(full);
  }
}

async function pickFiles(parent: BrowserWindow | null, mode: SongImportMode): Promise<string[] | null> {
  if (mode === 'folder') {
    const options: OpenDialogOptions = { title: 'Import every song in a folder', properties: ['openDirectory'] };
    const r = parent ? await dialog.showOpenDialog(parent, options) : await dialog.showOpenDialog(options);
    if (r.canceled || !r.filePaths[0]) return null;
    const files: string[] = [];
    await walk(r.filePaths[0], files);
    return files;
  }
  const options: OpenDialogOptions = {
    title: 'Import songs',
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: 'All song files', extensions: ALL_EXT },
      { name: 'Plain text', extensions: TEXT_EXT },
      { name: 'OpenLyrics / OpenLP export', extensions: XML_EXT },
      { name: 'OpenLP database (songs.sqlite)', extensions: ['sqlite'] },
      { name: 'EasyWorship (.ewsx, Songs.db + SongWords.db)', extensions: ['ewsx', 'db'] },
      { name: 'ProPresenter', extensions: PRO_EXT },
      { name: 'ChordPro', extensions: CHORDPRO_EXT },
      { name: 'Word and PowerPoint', extensions: OFFICE_EXT }
    ]
  };
  const r = parent ? await dialog.showOpenDialog(parent, options) : await dialog.showOpenDialog(options);
  return r.canceled ? null : r.filePaths.slice(0, MAX_FILES);
}

type Parsed = Omit<ImportedSong, 'source' | 'format'>;

async function readOne(file: string, buf: Buffer): Promise<{ songs: Parsed[]; format: string }> {
  const e = ext(file);
  const title = baseTitle(file);
  if (TEXT_EXT.includes(e)) {
    const text = decodeText(buf);
    if (/^\s*\{\s*(title|t)\s*:/im.test(text)) return { songs: [parseChordPro(text, title)], format: 'ChordPro' };
    return { songs: [parsePlainText(text, title)], format: 'Text' };
  }
  if (CHORDPRO_EXT.includes(e)) return { songs: [parseChordPro(decodeText(buf), title)], format: 'ChordPro' };
  if (XML_EXT.includes(e)) {
    const xml = decodeText(buf);
    if (/<RVPresentationDocument/i.test(xml)) return { songs: [parseProPresenterXml(xml, title)], format: 'ProPresenter' };
    return { songs: [parseOpenLyrics(xml, title)], format: 'OpenLyrics' };
  }
  if (PRO_EXT.includes(e)) {
    const head = buf.subarray(0, 200).toString('utf8').trimStart();
    if (head.startsWith('<')) return { songs: [parseProPresenterXml(decodeText(buf), title)], format: 'ProPresenter' };
    if (/\{\s*(title|t)\s*:/i.test(buf.subarray(0, 4000).toString('utf8'))) return { songs: [parseChordPro(decodeText(buf), title)], format: 'ChordPro' };
    return { songs: [parseProPresenter7(buf, title)], format: 'ProPresenter 7' };
  }
  if (e === 'docx') return { songs: parseDocx(buf, title), format: 'Word' };
  if (e === 'pptx') return { songs: [parsePptx(buf, title)], format: 'PowerPoint' };
  if (e === 'sqlite') {
    const db = await openDb(buf);
    try {
      return { songs: readOpenLp(db), format: 'OpenLP' };
    } finally {
      db.close();
    }
  }
  if (e === 'ewsx') {
    const dbs = [];
    for (const entry of readZip(buf)) if (/\.db$/i.test(entry.name)) dbs.push(await openDb(entry.read()));
    try {
      return { songs: readEasyWorship(dbs), format: 'EasyWorship' };
    } finally {
      dbs.forEach((d) => d.close());
    }
  }
  throw new Error('this file type is not supported');
}

export async function importSongs(parent: BrowserWindow | null, mode: unknown): Promise<SongImportResult> {
  const files = await pickFiles(parent, mode === 'folder' ? 'folder' : 'files');
  if (!files) return { canceled: true, songs: [], problems: [] };
  const songs: ImportedSong[] = [];
  const problems: string[] = [];
  const add = (list: Parsed[], source: string, format: string) => {
    for (const s of list) {
      if (songs.length >= MAX_SONGS) return;
      if (!s.content.trim()) {
        problems.push(`${source}: “${s.title}” has no words, so it was skipped.`);
        continue;
      }
      songs.push({ ...s, source, format });
    }
  };

  // EasyWorship .db files are read together: the song list and the words are in separate files.
  const dbFiles = files.filter((f) => ext(f) === 'db');
  if (dbFiles.length) {
    try {
      const dbs = [];
      for (const f of dbFiles) {
        if ((await fs.stat(f)).size > MAX_DB_BYTES) throw new Error(`${path.basename(f)} is too large`);
        dbs.push(await openDb(await fs.readFile(f)));
      }
      try {
        add(readEasyWorship(dbs), dbFiles.map((f) => path.basename(f)).join(' + '), 'EasyWorship');
      } finally {
        dbs.forEach((d) => d.close());
      }
    } catch (error) {
      problems.push(`EasyWorship: ${(error as Error).message}.`);
    }
  }

  for (const file of files) {
    const e = ext(file);
    const name = path.basename(file);
    if (e === 'db') continue;
    if (e in OLD_EXT) {
      problems.push(`${name}: ${OLD_EXT[e]}`);
      continue;
    }
    try {
      const size = (await fs.stat(file)).size;
      if (size > (DB_EXT.includes(e) ? MAX_DB_BYTES : MAX_FILE_BYTES)) throw new Error('the file is too large');
      const { songs: found, format } = await readOne(file, await fs.readFile(file));
      add(found, name, format);
    } catch (error) {
      problems.push(`${name}: ${(error as Error).message}.`);
    }
    if (songs.length >= MAX_SONGS) {
      problems.push(`Stopped after ${MAX_SONGS} songs. Import the rest in a second go.`);
      break;
    }
  }
  return { canceled: false, songs, problems: problems.slice(0, 500) };
}
