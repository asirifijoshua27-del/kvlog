// Song formats that are text or XML: plain text, ChordPro, OpenLyrics (OpenLP, and many others),
// ProPresenter 4–6 (.pro4/.pro5/.pro6), ProPresenter 7 (.pro, words only), Word (.docx), PowerPoint (.pptx).
import type { ImportedSong } from '../shared/song-import';
import { readZip, zipText } from './zip';
import { assembleSections, attr, decodeEntities, firstTag, labelFromCode, rtfToText, tidyLyrics, xmlText } from './songText';

type Song = Omit<ImportedSong, 'source' | 'format'>;

const empty = (title: string): Song => ({ title, subtitle: '', ccli: '', songKey: '', content: '', content2: '' });

/** Plain text: one song per file. "Title:", "Author:", "CCLI:" and "Key:" lines at the top are read if present. */
export function parsePlainText(text: string, fileTitle: string): Song {
  const song = empty(fileTitle);
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  let start = 0;
  for (; start < lines.length && start < 8; start++) {
    const m = /^\s*(title|author|copyright|ccli(?: number)?|key)\s*:\s*(.*)$/i.exec(lines[start]);
    if (!m) break;
    const field = m[1].toLowerCase();
    if (field === 'title') song.title = m[2].trim() || song.title;
    else if (field === 'author' || field === 'copyright') song.subtitle = [song.subtitle, m[2].trim()].filter(Boolean).join(' · ');
    else if (field.startsWith('ccli')) song.ccli = m[2].replace(/\D/g, '');
    else song.songKey = m[2].trim();
  }
  song.content = tidyLyrics(lines.slice(start).join('\n'));
  return song;
}

/** ChordPro (.cho, .chordpro, .chopro, .pro when it is text). */
export function parseChordPro(text: string, fileTitle: string): Song {
  const song = empty(fileTitle);
  const out: string[] = [];
  let counter: Record<string, number> = {};
  const section = (name: string, label?: string) => {
    counter[name] = (counter[name] ?? 0) + 1;
    out.push('', `[${label?.trim() || (name === 'Verse' ? `Verse ${counter[name]}` : name)}]`);
  };
  for (const raw of text.replace(/\r\n?/g, '\n').split('\n')) {
    const d = /^\s*\{\s*([a-z_]+)\s*(?::\s*(.*?))?\s*\}\s*$/i.exec(raw);
    if (!d) {
      if (raw.trim().startsWith('#')) continue;
      out.push(raw);
      continue;
    }
    const key = d[1].toLowerCase();
    const value = (d[2] ?? '').trim();
    if (key === 'title' || key === 't') song.title = value || song.title;
    else if (key === 'artist' || key === 'composer' || key === 'lyricist' || key === 'copyright' || key === 'subtitle' || key === 'st') song.subtitle = [song.subtitle, value].filter(Boolean).join(' · ');
    else if (key === 'key') song.songKey = value;
    else if (key === 'ccli') song.ccli = value.replace(/\D/g, '');
    else if (key === 'start_of_chorus' || key === 'soc') section('Chorus', value);
    else if (key === 'start_of_verse' || key === 'sov') section('Verse', value);
    else if (key === 'start_of_bridge' || key === 'sob') section('Bridge', value);
    else if (key === 'chorus') out.push('', '[Chorus]');
    else if (key === 'comment' || key === 'c' || key === 'ci') {
      if (/^(verse|chorus|bridge|pre-?chorus|intro|outro|tag|ending)/i.test(value)) out.push('', `[${value}]`);
    } else if (key.startsWith('end_of') || key.startsWith('eo')) out.push('');
  }
  counter = {};
  song.content = tidyLyrics(out.join('\n'));
  return song;
}

/** OpenLyrics lines: <br/> = new line, chords become [G], comments are dropped. */
function openLyricsLines(xml: string): string {
  return decodeEntities(
    xml
      .replace(/<comment>[\s\S]*?<\/comment>/gi, '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<chord\s[^>]*?(?:name|root)="([^"]+)"[^>]*\/?>/gi, (_m, c: string) => `[${c}]`)
      .replace(/<\/lines>\s*<lines[^>]*>/gi, '\n---\n')
      .replace(/<[^>]+>/g, '')
  );
}

/** OpenLyrics XML. Verses in a second language (lang="tw" next to lang="en") go into the second-language lyrics. */
export function parseOpenLyrics(xml: string, fileTitle: string): Song {
  if (!/<song[\s>]/i.test(xml) || !/<lyrics[\s>]/i.test(xml)) throw new Error('not an OpenLyrics song');
  const song = empty(firstTag(xml, 'title') ?? fileTitle);
  const authors = [...xml.matchAll(/<author[^>]*>([\s\S]*?)<\/author>/gi)].map((m) => xmlText(m[1]).trim()).filter(Boolean);
  const copyright = firstTag(xml, 'copyright');
  song.subtitle = [authors.join(', '), copyright ? `© ${copyright.replace(/^©\s*/, '')}` : ''].filter(Boolean).join(' · ');
  song.ccli = (firstTag(xml, 'ccliNo') ?? '').replace(/\D/g, '');
  song.songKey = firstTag(xml, 'key') ?? '';
  const order = (firstTag(xml, 'verseOrder') ?? '').split(/\s+/).filter(Boolean).map(labelFromCode);

  const byLang = new Map<string, { label: string; text: string }[]>();
  for (const m of xml.matchAll(/<verse(\s[^>]*)?>([\s\S]*?)<\/verse>/gi)) {
    const tag = m[1] ?? '';
    const lang = (attr(tag, 'lang') ?? '').toLowerCase();
    const label = labelFromCode(attr(tag, 'name') ?? `v${(byLang.get(lang)?.length ?? 0) + 1}`);
    const list = byLang.get(lang) ?? [];
    list.push({ label, text: openLyricsLines(m[2]) });
    byLang.set(lang, list);
  }
  const langs = [...byLang.keys()];
  if (!langs.length) throw new Error('the song has no words');
  // English first when there is a choice, so English + Twi shows English on top.
  langs.sort((a, b) => (a.startsWith('en') ? -1 : b.startsWith('en') ? 1 : 0));
  song.content = assembleSections(byLang.get(langs[0]) ?? [], order);
  if (langs[1]) song.content2 = assembleSections(byLang.get(langs[1]) ?? [], order);
  return song;
}

/** ProPresenter 4–6: XML with groups ("Verse 1") and slides whose words are base64 RTF or plain text. */
export function parseProPresenterXml(xml: string, fileTitle: string): Song {
  const root = /<RVPresentationDocument[^>]*>/i.exec(xml)?.[0] ?? '';
  const song = empty(attr(root, 'CCLISongTitle') || fileTitle);
  song.subtitle = [attr(root, 'CCLIAuthor'), attr(root, 'CCLIPublisher'), attr(root, 'CCLICopyrightYear') || attr(root, 'CCLICopyrightInfo')]
    .filter((s) => s && s.trim())
    .join(' · ');
  song.ccli = (attr(root, 'CCLISongNumber') ?? '').replace(/\D/g, '');
  const sections: { label: string; text: string }[] = [];
  const groupRe = /<RVSlideGrouping(\s[^>]*)>([\s\S]*?)<\/RVSlideGrouping>/gi;
  let n = 0;
  for (const g of xml.matchAll(groupRe)) {
    n++;
    const label = (attr(g[1], 'name') ?? '').trim() || `Part ${n}`;
    const slides: string[] = [];
    for (const s of g[2].matchAll(/<RVDisplaySlide[\s\S]*?<\/RVDisplaySlide>/gi)) {
      const texts: string[] = [];
      for (const el of s[0].matchAll(/<NSString[^>]*rvXMLIvarName="(PlainText|RTFData)"[^>]*>([^<]*)<\/NSString>/gi)) {
        if (el[1] === 'PlainText') texts.push(Buffer.from(el[2], 'base64').toString('utf8'));
      }
      if (!texts.length) {
        for (const el of s[0].matchAll(/<NSString[^>]*rvXMLIvarName="RTFData"[^>]*>([^<]*)<\/NSString>/gi)) texts.push(rtfToText(Buffer.from(el[1], 'base64').toString('latin1')));
        for (const el of s[0].matchAll(/\sRTFData="([^"]*)"/gi)) texts.push(rtfToText(Buffer.from(el[1], 'base64').toString('latin1')));
      }
      const words = tidyLyrics(texts.join('\n'));
      if (words) slides.push(words);
    }
    if (slides.length) sections.push({ label, text: slides.join('\n---\n') });
  }
  if (!sections.length) throw new Error('no words were found');
  // Two groups can have the same name; keep both.
  const seen = new Map<string, number>();
  for (const s of sections) {
    const k = s.label.toLowerCase();
    const c = (seen.get(k) ?? 0) + 1;
    seen.set(k, c);
    if (c > 1) s.label = `${s.label} (${c})`;
  }
  song.content = assembleSections(sections);
  return song;
}

/** ProPresenter 7 (.pro) is a binary file; the words of each slide are stored as RTF, which can be found and read. */
export function parseProPresenter7(buf: Buffer, fileTitle: string): Song {
  const text = buf.toString('latin1');
  const slides: string[] = [];
  let at = text.indexOf('{\\rtf');
  while (at >= 0) {
    let depth = 0;
    let end = at;
    for (; end < text.length; end++) {
      if (text[end] === '\\') {
        end++;
        continue;
      }
      if (text[end] === '{') depth++;
      else if (text[end] === '}' && --depth === 0) break;
    }
    const rtf = text.slice(at, end + 1);
    // RTF here is 8-bit; turn UTF-8 bytes back into letters before reading it.
    const words = tidyLyrics(rtfToText(Buffer.from(rtf, 'latin1').toString('utf8')));
    if (words && slides[slides.length - 1] !== words) slides.push(words);
    at = text.indexOf('{\\rtf', end + 1);
  }
  if (!slides.length) throw new Error('no words were found');
  const song = empty(fileTitle);
  song.content = slides.join('\n\n');
  return song;
}

function paragraphs(xml: string, para: string, run: string, br: string): { text: string; style: string }[] {
  const out: { text: string; style: string }[] = [];
  for (const p of xml.matchAll(new RegExp(`<${para}[\\s>][\\s\\S]*?</${para}>|<${para}/>`, 'g'))) {
    const body = p[0];
    const style = /<w:pStyle\s+w:val="([^"]+)"/.exec(body)?.[1] ?? '';
    const token = new RegExp(`<${run}(?:\\s[^>]*)?>([^<]*)</${run}>|<${br}(?:\\s[^>]*)?/>|<w:tab(?:\\s[^>]*)?/>`, 'g');
    let text = '';
    for (const t of body.matchAll(token)) {
      if (t[1] !== undefined) text += decodeEntities(t[1]);
      else text += t[0].startsWith('<w:tab') ? ' ' : '\n';
    }
    out.push({ text, style });
  }
  return out;
}

/** Word (.docx). Headings (or the "Title" style) start a new song, so one document can hold many songs. */
export function parseDocx(buf: Buffer, fileTitle: string): Song[] {
  const entries = readZip(buf);
  const xml = zipText(entries, 'word/document.xml');
  if (!xml) throw new Error('this Word file has no document text');
  const paras = paragraphs(xml, 'w:p', 'w:t', 'w:br');
  const isHeading = (style: string) => /^(heading|title|berschrift|titre|t[ií]tulo)/i.test(style) || /^Heading\d$/.test(style);
  const songs: Song[] = [];
  let current: Song | null = null;
  let body: string[] = [];
  const finish = () => {
    if (current && body.join('').trim()) {
      current.content = tidyLyrics(body.join('\n'));
      songs.push(current);
    }
  };
  const hasHeadings = paras.some((p) => isHeading(p.style) && p.text.trim());
  if (!hasHeadings) current = empty(fileTitle);
  for (const p of paras) {
    if (hasHeadings && isHeading(p.style) && p.text.trim()) {
      finish();
      current = empty(p.text.trim());
      body = [];
      continue;
    }
    if (current) body.push(p.text);
  }
  finish();
  if (!songs.length) throw new Error('no words were found');
  return songs;
}

/** PowerPoint (.pptx): one song; each slide becomes a section of its own. */
export function parsePptx(buf: Buffer, fileTitle: string): Song {
  const entries = readZip(buf);
  const pres = zipText(entries, 'ppt/presentation.xml') ?? '';
  const rels = zipText(entries, 'ppt/_rels/presentation.xml.rels') ?? '';
  const target = new Map<string, string>();
  for (const r of rels.matchAll(/<Relationship\s[^>]*>/g)) {
    const id = attr(r[0], 'Id');
    const t = attr(r[0], 'Target');
    if (id && t) target.set(id, `ppt/${t.replace(/^\/?ppt\//, '')}`);
  }
  let order = [...pres.matchAll(/<p:sldId\s[^>]*>/g)].map((m) => target.get(attr(m[0], 'r:id') ?? '')).filter((x): x is string => !!x);
  if (!order.length) {
    order = entries
      .map((e) => e.name)
      .filter((n) => /^ppt\/slides\/slide\d+\.xml$/i.test(n))
      .sort((a, b) => Number(/(\d+)\.xml$/.exec(a)?.[1]) - Number(/(\d+)\.xml$/.exec(b)?.[1]));
  }
  const slides: string[] = [];
  for (const name of order) {
    const xml = zipText(entries, name);
    if (!xml) continue;
    const words = tidyLyrics(paragraphs(xml, 'a:p', 'a:t', 'a:br').map((p) => p.text).join('\n'));
    if (words) slides.push(words);
  }
  if (!slides.length) throw new Error('no words were found on the slides');
  const song = empty(fileTitle);
  // A first slide with only a line or two is usually the title.
  if (slides.length > 1 && slides[0].split('\n').length <= 2) {
    song.title = slides[0].split('\n')[0].trim() || fileTitle;
    slides.shift();
  }
  song.content = slides.join('\n\n');
  return song;
}
