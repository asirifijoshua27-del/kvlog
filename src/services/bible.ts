import { useCallback, useEffect, useState } from 'react';
import { superscript, type BibleInfo, type BibleRef } from '../../shared/bible';
import { errorMessage } from './desktopBridge';

export interface BibleLibrary {
  bibles: BibleInfo[] | null;
  /** Download key, 'import', or a Bible id being renamed/deleted. */
  busy: string | null;
  error: string | null;
  clearError: () => void;
  download: (key: string) => Promise<void>;
  importFile: () => Promise<BibleInfo | null>;
  rename: (id: string, abbrev: string, name: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

export function useBibles(): BibleLibrary {
  const [bibles, setBibles] = useState<BibleInfo[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!window.kvlog) {
      setBibles([]);
      return;
    }
    try {
      setBibles(await window.kvlog.listBibles());
    } catch (e) {
      setError(errorMessage(e));
      setBibles([]);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const run = useCallback(
    async <T,>(label: string, job: () => Promise<T>): Promise<T | null> => {
      setBusy(label);
      setError(null);
      try {
        const result = await job();
        await refresh();
        return result;
      } catch (e) {
        setError(errorMessage(e));
        return null;
      } finally {
        setBusy(null);
      }
    },
    [refresh]
  );

  return {
    bibles,
    busy,
    error,
    clearError: () => setError(null),
    download: async (key) => {
      clearChapterCache(key);
      await run(key, () => window.kvlog!.downloadBible(key));
    },
    importFile: () => run('import', () => window.kvlog!.importBible()),
    rename: async (id, abbrev, name) => {
      await run(id, () => window.kvlog!.renameBible(id, abbrev, name));
    },
    remove: async (id) => {
      clearChapterCache(id);
      await run(id, () => window.kvlog!.deleteBible(id));
    }
  };
}

const chapterCache = new Map<string, Promise<string[]>>();

export function loadChapter(id: string, book: number, chapter: number): Promise<string[]> {
  const key = `${id}:${book}:${chapter}`;
  const hit = chapterCache.get(key);
  if (hit) return hit;
  if (!window.kvlog) return Promise.resolve([]);
  const job = window.kvlog.getBibleChapter(id, book, chapter).catch((e: unknown) => {
    chapterCache.delete(key);
    throw e;
  });
  chapterCache.set(key, job);
  return job;
}

function clearChapterCache(id: string): void {
  for (const key of chapterCache.keys()) if (key.startsWith(`${id}:`)) chapterCache.delete(key);
}

export interface PassageVerse {
  chapter: number;
  verse: number;
  text: string;
}

export async function loadPassage(bible: BibleInfo, ref: BibleRef): Promise<PassageVerse[]> {
  const book = bible.books.find((b) => b.n === ref.book);
  if (!book) return [];
  const out: PassageVerse[] = [];
  const last = Math.min(ref.endChapter, book.verses.length, ref.chapter + 20);
  for (let c = ref.chapter; c <= last; c++) {
    const verses = await loadChapter(bible.id, ref.book, c);
    const from = c === ref.chapter && ref.verse !== null ? ref.verse : 1;
    const to = c === ref.endChapter && ref.endVerse !== null ? ref.endVerse : verses.length;
    for (let v = from; v <= Math.min(to, verses.length); v++) {
      if (verses[v - 1]) out.push({ chapter: c, verse: v, text: verses[v - 1] });
    }
  }
  return out;
}

/**
 * Turns verses into scripture-item text: one slide per `perSlide` verses, one line per verse.
 * With a second translation, a "||" line puts it in a second column.
 */
export function buildScriptureContent(primary: PassageVerse[], secondary: PassageVerse[] | null, perSlide: number, numbers: boolean): string {
  const line = (v: PassageVerse) => (numbers ? `${superscript(v.verse)} ${v.text}` : v.text);
  const byKey = new Map((secondary ?? []).map((v) => [`${v.chapter}:${v.verse}`, v]));
  const slides: string[] = [];
  for (let i = 0; i < primary.length; i += perSlide) {
    const group = primary.slice(i, i + perSlide);
    const left = group.map(line);
    if (!secondary) {
      slides.push(left.join('\n'));
      continue;
    }
    const right = group.map((v) => byKey.get(`${v.chapter}:${v.verse}`)).filter((v): v is PassageVerse => !!v).map(line);
    slides.push([...left, '||', ...right].join('\n'));
  }
  return slides.join('\n\n');
}
