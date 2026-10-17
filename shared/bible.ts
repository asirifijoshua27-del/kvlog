// Bible books, reference parsing and shared types. Used by the main process (importing files)
// and the UI (typing "John 3:16-18").

export interface BookDef {
  n: number;
  name: string;
  osis: string;
  /** Extra short forms, written without spaces or dots. */
  short: string[];
}

const B = (n: number, name: string, osis: string, short: string[]): BookDef => ({ n, name, osis, short });

export const BIBLE_BOOKS: BookDef[] = [
  B(1, 'Genesis', 'Gen', ['ge', 'gn']),
  B(2, 'Exodus', 'Exod', ['ex', 'exo']),
  B(3, 'Leviticus', 'Lev', ['le', 'lv']),
  B(4, 'Numbers', 'Num', ['nu', 'nm', 'nb']),
  B(5, 'Deuteronomy', 'Deut', ['dt', 'de', 'deu']),
  B(6, 'Joshua', 'Josh', ['jos', 'jsh']),
  B(7, 'Judges', 'Judg', ['jdg', 'jg', 'jdgs']),
  B(8, 'Ruth', 'Ruth', ['rth', 'ru']),
  B(9, '1 Samuel', '1Sam', ['1sa', '1sm', '1sam', 'isamuel', '1s']),
  B(10, '2 Samuel', '2Sam', ['2sa', '2sm', '2sam', 'iisamuel', '2s']),
  B(11, '1 Kings', '1Kgs', ['1ki', '1kg', '1kin', '1k', 'ikings']),
  B(12, '2 Kings', '2Kgs', ['2ki', '2kg', '2kin', '2k', 'iikings']),
  B(13, '1 Chronicles', '1Chr', ['1ch', '1chr', '1chron', 'ichronicles']),
  B(14, '2 Chronicles', '2Chr', ['2ch', '2chr', '2chron', 'iichronicles']),
  B(15, 'Ezra', 'Ezra', ['ezr']),
  B(16, 'Nehemiah', 'Neh', ['ne']),
  B(17, 'Esther', 'Esth', ['est', 'es']),
  B(18, 'Job', 'Job', ['jb']),
  B(19, 'Psalms', 'Ps', ['psalm', 'psa', 'pss', 'psm', 'pslm']),
  B(20, 'Proverbs', 'Prov', ['pr', 'prv', 'pro']),
  B(21, 'Ecclesiastes', 'Eccl', ['ec', 'ecc', 'eccles', 'qoh']),
  B(22, 'Song of Solomon', 'Song', ['songofsongs', 'sos', 'so', 'sng', 'canticles', 'sg', 'ss']),
  B(23, 'Isaiah', 'Isa', ['is']),
  B(24, 'Jeremiah', 'Jer', ['je', 'jr']),
  B(25, 'Lamentations', 'Lam', ['la']),
  B(26, 'Ezekiel', 'Ezek', ['eze', 'ezk']),
  B(27, 'Daniel', 'Dan', ['da', 'dn']),
  B(28, 'Hosea', 'Hos', ['ho']),
  B(29, 'Joel', 'Joel', ['jl']),
  B(30, 'Amos', 'Amos', ['am']),
  B(31, 'Obadiah', 'Obad', ['ob', 'oba']),
  B(32, 'Jonah', 'Jonah', ['jnh', 'jon']),
  B(33, 'Micah', 'Mic', ['mc']),
  B(34, 'Nahum', 'Nah', ['na']),
  B(35, 'Habakkuk', 'Hab', ['hb']),
  B(36, 'Zephaniah', 'Zeph', ['zep', 'zp']),
  B(37, 'Haggai', 'Hag', ['hg']),
  B(38, 'Zechariah', 'Zech', ['zec', 'zc']),
  B(39, 'Malachi', 'Mal', ['ml']),
  B(40, 'Matthew', 'Matt', ['mt', 'mat']),
  B(41, 'Mark', 'Mark', ['mk', 'mrk', 'mr']),
  B(42, 'Luke', 'Luke', ['lk', 'luk']),
  B(43, 'John', 'John', ['jn', 'jhn', 'joh']),
  B(44, 'Acts', 'Acts', ['ac', 'act']),
  B(45, 'Romans', 'Rom', ['ro', 'rm']),
  B(46, '1 Corinthians', '1Cor', ['1co', '1cor', 'icorinthians']),
  B(47, '2 Corinthians', '2Cor', ['2co', '2cor', 'iicorinthians']),
  B(48, 'Galatians', 'Gal', ['ga']),
  B(49, 'Ephesians', 'Eph', ['ephes']),
  B(50, 'Philippians', 'Phil', ['php', 'pp', 'philip']),
  B(51, 'Colossians', 'Col', ['co']),
  B(52, '1 Thessalonians', '1Thess', ['1th', '1thes', '1thess', 'ithessalonians']),
  B(53, '2 Thessalonians', '2Thess', ['2th', '2thes', '2thess', 'iithessalonians']),
  B(54, '1 Timothy', '1Tim', ['1ti', '1tm', '1tim', 'itimothy']),
  B(55, '2 Timothy', '2Tim', ['2ti', '2tm', '2tim', 'iitimothy']),
  B(56, 'Titus', 'Titus', ['tit', 'ti']),
  B(57, 'Philemon', 'Phlm', ['phm', 'philem', 'phile']),
  B(58, 'Hebrews', 'Heb', ['he']),
  B(59, 'James', 'Jas', ['jm', 'jam', 'jms']),
  B(60, '1 Peter', '1Pet', ['1pe', '1pt', '1p', '1pet', 'ipeter']),
  B(61, '2 Peter', '2Pet', ['2pe', '2pt', '2p', '2pet', 'iipeter']),
  B(62, '1 John', '1John', ['1jn', '1jo', '1jhn', '1joh', 'ijohn']),
  B(63, '2 John', '2John', ['2jn', '2jo', '2jhn', '2joh', 'iijohn']),
  B(64, '3 John', '3John', ['3jn', '3jo', '3jhn', '3joh', 'iiijohn']),
  B(65, 'Jude', 'Jude', ['jud', 'jd']),
  B(66, 'Revelation', 'Rev', ['re', 'rv', 'revelations', 'apocalypse'])
];

export function normalizeBookName(text: string): string {
  return text
    .toLowerCase()
    .replace(/^(first|1st)\s+/, '1')
    .replace(/^(second|2nd)\s+/, '2')
    .replace(/^(third|3rd)\s+/, '3')
    .replace(/^iii\s+/, '3')
    .replace(/^ii\s+/, '2')
    .replace(/^i\s+(?=[a-z])/, '1')
    .replace(/ɔ/g, 'o')
    .replace(/ɛ/g, 'e')
    .replace(/[\s.]+/g, '');
}

/** Asante Twi book names, used for Twi Bibles whose files carry only book numbers. */
export const TWI_BOOK_NAMES: string[] = [
  'Genesis', 'Exodus', 'Leviticus', 'Numeri', 'Deuteronomium', 'Yosua', 'Atemmufoɔ', 'Rut',
  '1 Samuel', '2 Samuel', '1 Ahemfoɔ', '2 Ahemfoɔ', '1 Berɛsosɛm', '2 Berɛsosɛm', 'Esra', 'Nehemia',
  'Ester', 'Hiob', 'Nnwom', 'Mmebusɛm', 'Ɔsɛnkafoɔ', 'Nnwom mu Dwom', 'Yesaia', 'Yeremia',
  'Kwadwom', 'Hesekiel', 'Daniel', 'Hosea', 'Yoel', 'Amos', 'Obadia', 'Yona', 'Mika', 'Nahum',
  'Habakuk', 'Sefania', 'Hagai', 'Sakaria', 'Malaki',
  'Mateo', 'Marko', 'Luka', 'Yohane', 'Asomafoɔ Nnwuma', 'Romafoɔ', '1 Korintofoɔ', '2 Korintofoɔ',
  'Galatifoɔ', 'Efesofoɔ', 'Filipifoɔ', 'Kolosefoɔ', '1 Tesalonikafoɔ', '2 Tesalonikafoɔ',
  '1 Timoteo', '2 Timoteo', 'Tito', 'Filemon', 'Hebrifoɔ', 'Yakobo', '1 Petro', '2 Petro',
  '1 Yohane', '2 Yohane', '3 Yohane', 'Yuda', 'Adiyisɛm'
];

const EXACT = new Map<string, number>();
for (const book of BIBLE_BOOKS) {
  for (const key of [book.name, book.osis, ...book.short]) EXACT.set(normalizeBookName(key), book.n);
}

/**
 * Finds a book by name, abbreviation or OSIS id. `localNames` lets a Bible's own book names
 * (for example Twi names) be typed too. Returns null if unknown or ambiguous.
 */
export function findBook(text: string, localNames?: ReadonlyMap<number, string>): number | null {
  const key = normalizeBookName(text);
  if (!key) return null;
  const exact = EXACT.get(key);
  if (exact) return exact;
  const names: [number, string][] = BIBLE_BOOKS.map((b) => [b.n, normalizeBookName(b.name)]);
  if (localNames) for (const [n, name] of localNames) names.push([n, normalizeBookName(name)]);
  for (const [n, name] of names) if (name === key) return n;
  if (key.length < 2) return null;
  const matches = new Set(names.filter(([, name]) => name.startsWith(key)).map(([n]) => n));
  return matches.size === 1 ? [...matches][0] : null;
}

export interface BibleRef {
  book: number;
  chapter: number;
  /** null = the whole chapter (or chapters). */
  verse: number | null;
  endChapter: number;
  endVerse: number | null;
}

const REF_PATTERN = /^\s*(.+?)\s*(\d+)(?:\s*[:.\s]\s*(\d+))?(?:\s*[-–—]\s*(\d+)(?:\s*[:.]\s*(\d+))?)?\s*$/;

/** Parses "John 3:16-18", "jn 3 16", "1 cor 13:4-7", "Ps 23", "Gen 1:1-2:3" or just "Romans". */
export function parseReference(text: string, localNames?: ReadonlyMap<number, string>): BibleRef | null {
  const match = REF_PATTERN.exec(text);
  if (!match) {
    const book = findBook(text, localNames);
    return book ? { book, chapter: 1, verse: null, endChapter: 1, endVerse: null } : null;
  }
  const book = findBook(match[1], localNames);
  if (!book) {
    // "1 John" alone: the number belongs to the book name.
    const whole = findBook(text, localNames);
    return whole ? { book: whole, chapter: 1, verse: null, endChapter: 1, endVerse: null } : null;
  }
  const chapter = Number(match[2]);
  const verse = match[3] ? Number(match[3]) : null;
  const a = match[4] ? Number(match[4]) : null;
  const b = match[5] ? Number(match[5]) : null;
  if (chapter < 1) return null;
  if (verse === null) return { book, chapter, verse: null, endChapter: a && a > chapter ? a : chapter, endVerse: null };
  if (a !== null && b !== null) return { book, chapter, verse, endChapter: Math.max(a, chapter), endVerse: b };
  return { book, chapter, verse, endChapter: chapter, endVerse: a !== null && a >= verse ? a : verse };
}

export function formatReference(ref: BibleRef, bookName: string): string {
  if (ref.verse === null) return ref.endChapter > ref.chapter ? `${bookName} ${ref.chapter}–${ref.endChapter}` : `${bookName} ${ref.chapter}`;
  if (ref.endChapter > ref.chapter) return `${bookName} ${ref.chapter}:${ref.verse}–${ref.endChapter}:${ref.endVerse ?? ''}`;
  if (ref.endVerse !== null && ref.endVerse > ref.verse) return `${bookName} ${ref.chapter}:${ref.verse}–${ref.endVerse}`;
  return `${bookName} ${ref.chapter}:${ref.verse}`;
}

const SUPERSCRIPT = ['⁰', '¹', '²', '³', '⁴', '⁵', '⁶', '⁷', '⁸', '⁹'];
export function superscript(n: number): string {
  return String(n).split('').map((d) => SUPERSCRIPT[Number(d)] ?? d).join('');
}

// ----- Installed Bibles -----

export interface BibleBook {
  n: number;
  name: string;
  /** verses[i] = number of verses in chapter i + 1. */
  verses: number[];
}

export interface BibleInfo {
  id: string;
  abbrev: string;
  name: string;
  source: string;
  books: BibleBook[];
}

export interface BibleDownload {
  key: string;
  abbrev: string;
  name: string;
  size: string;
}

/** Public-domain translations KVLOG can download. The addresses live in the main process. */
export const BIBLE_DOWNLOADS: BibleDownload[] = [
  { key: 'kjv', abbrev: 'KJV', name: 'King James Version', size: 'about 5 MB' },
  { key: 'web', abbrev: 'WEB', name: 'World English Bible', size: 'about 5 MB' },
  { key: 'asv', abbrev: 'ASV', name: 'American Standard Version (1901)', size: 'about 5 MB' },
  { key: 'bbe', abbrev: 'BBE', name: 'Bible in Basic English', size: 'about 5 MB' }
];

export const BIBLE_ID_PATTERN = /^[a-z0-9-]{1,40}$/;
