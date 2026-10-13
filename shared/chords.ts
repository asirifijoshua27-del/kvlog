// Chords are written inline, ChordPro style: "[G]Amazing [C]grace". The audience never sees them;
// the stage display shows them above the words, moved to another key if asked.

const CHORD = /^[A-G](?:#|b)?(?:maj|min|m|M|dim|aug|sus|add|°|ø|\+)?[0-9]*(?:(?:sus|add|maj|b|#)[0-9]+)*(?:\/[A-G](?:#|b)?)?$/;
const INLINE = /\[([^\]\s]{1,16})\]/g;

export function isChord(text: string): boolean {
  return CHORD.test(text.trim());
}

/** True when every bracket on the line is a chord (so "[G] [C]" is chords, "[Verse 1]" is a label). */
export function isChordOnlyLine(line: string): boolean {
  const t = line.trim();
  if (!t.startsWith('[')) return false;
  const rest = t.replace(INLINE, (m, c: string) => (isChord(c) ? '' : m));
  return rest.trim() === '' && t !== '';
}

export function hasChords(line: string): boolean {
  for (const m of line.matchAll(INLINE)) if (isChord(m[1])) return true;
  return false;
}

export function stripChords(line: string): string {
  return line.replace(INLINE, (m, c: string) => (isChord(c) ? '' : m)).replace(/\s{2,}/g, ' ').trim();
}

export interface ChordSegment {
  chord: string | null;
  text: string;
}

/** Splits "[G]Amazing [C]grace" into chord + text pieces. */
export function chordSegments(line: string): ChordSegment[] {
  const out: ChordSegment[] = [];
  let last = 0;
  let chord: string | null = null;
  for (const m of line.matchAll(INLINE)) {
    if (!isChord(m[1])) continue;
    const at = m.index ?? 0;
    if (at > last || chord !== null) out.push({ chord, text: line.slice(last, at) });
    chord = m[1];
    last = at + m[0].length;
  }
  out.push({ chord, text: line.slice(last) });
  return out.filter((s, i) => s.chord !== null || s.text !== '' || i === 0);
}

const SHARPS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLATS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
const INDEX: Record<string, number> = {
  C: 0, 'B#': 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, Fb: 4, F: 5, 'E#': 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11, Cb: 11
};
/** Keys that are normally written with flats. */
const FLAT_KEYS = new Set(['F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Dm', 'Gm', 'Cm', 'Fm', 'Bbm', 'Ebm']);

function moveNote(note: string, steps: number, flats: boolean): string {
  const i = INDEX[note];
  if (i === undefined) return note;
  return (flats ? FLATS : SHARPS)[(((i + steps) % 12) + 12) % 12];
}

export function transposeKey(key: string, steps: number): string {
  const m = /^([A-G](?:#|b)?)(m?)$/.exec(key.trim());
  if (!m || !steps) return key.trim();
  const target = moveNote(m[1], steps, false);
  const flatVersion = moveNote(m[1], steps, true);
  return (FLAT_KEYS.has(flatVersion + m[2]) ? flatVersion : target) + m[2];
}

export function transposeChord(chord: string, steps: number, key = ''): string {
  if (!steps) return chord;
  const flats = FLAT_KEYS.has(transposeKey(key || 'C', steps));
  return chord.replace(/([A-G](?:#|b)?)/g, (note, _n, offset: number) => {
    // Only the root and the bass note (after "/") are notes; other letters belong to words like "add".
    if (offset !== 0 && chord[offset - 1] !== '/') return note;
    return moveNote(note, steps, flats);
  });
}
