// Text helpers for song import: XML entities, RTF, file encodings, section labels.

export function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

/** Text of an XML fragment: tags removed, entities decoded. */
export function xmlText(s: string): string {
  return decodeEntities(s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/<[^>]+>/g, ''));
}

export function attr(tag: string, name: string): string | null {
  const m = new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'i').exec(tag);
  return m ? decodeEntities(m[1] ?? m[2] ?? '') : null;
}

/** First <tag>…</tag> text, ignoring namespaces. */
export function firstTag(xml: string, tag: string): string | null {
  const m = new RegExp(`<(?:\\w+:)?${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:\\w+:)?${tag}>`, 'i').exec(xml);
  return m ? xmlText(m[1]).trim() : null;
}

/** Reads a text file saved as UTF-8, UTF-16 or Windows-1252 (Notepad's older default). */
export function decodeText(buf: Buffer): string {
  if (buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) return buf.toString('utf8', 3);
  if (buf[0] === 0xff && buf[1] === 0xfe) return buf.toString('utf16le', 2);
  if (buf[0] === 0xfe && buf[1] === 0xff) {
    const swapped = Buffer.from(buf.subarray(2));
    swapped.swap16();
    return swapped.toString('utf16le');
  }
  const utf8 = buf.toString('utf8');
  if (!utf8.includes('\uFFFD')) return utf8;
  return new TextDecoder('windows-1252').decode(buf);
}

const RTF_SKIP = new Set(['fonttbl', 'colortbl', 'stylesheet', 'info', 'pict', 'header', 'footer', 'listtable', 'listoverridetable', 'generator', 'expandedcolortbl', 'latentstyles', 'themedata', 'datastore', 'xmlnstbl', 'rsidtbl']);

/** Plain text from RTF (EasyWorship and ProPresenter store lyrics as RTF). Keeps Unicode letters such as ɛ and ɔ. */
export function rtfToText(rtf: string): string {
  let out = '';
  let i = 0;
  let skipDepth = 0;
  let depth = 0;
  let ucSkip = 1;
  let pendingSkip = 0;
  const cp1252 = new TextDecoder('windows-1252');
  while (i < rtf.length) {
    const ch = rtf[i];
    if (ch === '{') {
      depth++;
      i++;
      if (rtf.startsWith('\\*', i)) {
        if (!skipDepth) skipDepth = depth;
      }
      continue;
    }
    if (ch === '}') {
      if (skipDepth === depth) skipDepth = 0;
      depth--;
      i++;
      continue;
    }
    if (ch === '\\') {
      const next = rtf[i + 1];
      if (next === '\\' || next === '{' || next === '}') {
        if (!skipDepth) out += next;
        i += 2;
        continue;
      }
      if (next === "'") {
        const hex = rtf.slice(i + 2, i + 4);
        if (pendingSkip > 0) pendingSkip--;
        else if (!skipDepth) out += cp1252.decode(Uint8Array.of(parseInt(hex, 16)));
        i += 4;
        continue;
      }
      const m = /^\\([a-z]+)(-?\d+)? ?/i.exec(rtf.slice(i, i + 40));
      if (!m) {
        i += 2;
        continue;
      }
      i += m[0].length;
      const word = m[1];
      const n = m[2] !== undefined ? Number(m[2]) : null;
      if (RTF_SKIP.has(word) && !skipDepth) skipDepth = depth;
      if (skipDepth) continue;
      if (word === 'par' || word === 'line' || word === 'sect' || word === 'page') out += '\n';
      else if (word === 'tab') out += ' ';
      else if (word === 'uc' && n !== null) ucSkip = n;
      else if (word === 'u' && n !== null) {
        out += String.fromCharCode(n < 0 ? n + 65536 : n);
        pendingSkip = ucSkip;
      }
      continue;
    }
    if (ch === '\r' || ch === '\n') {
      i++;
      continue;
    }
    if (pendingSkip > 0) {
      pendingSkip--;
      i++;
      continue;
    }
    if (!skipDepth) out += ch;
    i++;
  }
  return out.replace(/\u00a0/g, ' ');
}

/** Tidies imported lyrics: trims lines, at most one blank line in a row. */
export function tidyLyrics(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((l) => l.replace(/\s+$/g, '').replace(/^\s+/, ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const TYPE_NAMES: Record<string, string> = {
  v: 'Verse', c: 'Chorus', b: 'Bridge', p: 'Pre-chorus', i: 'Intro', e: 'Ending', o: 'Outro', t: 'Tag', r: 'Refrain'
};

/** "v1" -> "Verse 1", "c" -> "Chorus", "c2" -> "Chorus 2". Unknown names are kept. */
export function labelFromCode(code: string): string {
  const m = /^([a-z])(\d*)([a-z]?)$/i.exec(code.trim());
  if (!m) return code.trim();
  const name = TYPE_NAMES[m[1].toLowerCase()];
  if (!name) return code.trim();
  return m[2] ? `${name} ${m[2]}${m[3]}` : name;
}

/** Builds KVLOG lyrics from labelled sections, following an order (repeats become a label on its own). */
export function assembleSections(sections: { label: string; text: string }[], order: string[] = []): string {
  const byLabel = new Map(sections.map((s) => [s.label.toLowerCase(), s]));
  const sequence = order.length ? order.map((l) => byLabel.get(l.toLowerCase())).filter((s): s is { label: string; text: string } => !!s) : sections;
  // Anything not in the order is added at the end, so no words are lost.
  for (const s of sections) if (!sequence.includes(s)) sequence.push(s);
  const written = new Set<string>();
  const parts: string[] = [];
  for (const s of sequence) {
    const key = s.label.toLowerCase();
    if (written.has(key)) parts.push(`[${s.label}]`);
    else {
      written.add(key);
      parts.push(`[${s.label}]\n${tidyLyrics(s.text)}`);
    }
  }
  return parts.join('\n\n');
}
