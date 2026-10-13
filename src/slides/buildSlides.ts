import type { ItemSource, Slide } from '../types';
import { deckSlideText } from '../../shared/layout';
import { hasChords, isChordOnlyLine, stripChords } from '../../shared/chords';
import { extrasOf, type Bilingual } from '../../shared/extras';

// Turns the text an operator types into slides.
//
// Songs:
//   - A blank line separates sections.
//   - A line like [Verse 1], [Chorus], "Bridge:" or "Chorus 2" names the section that follows.
//   - A label on its own (with no lyrics) repeats the section with that label.
//   - "---" on its own line forces a new slide.
//   - Each section is split into slides of `linesPerSlide` lines.
// Scripture and announcements:
//   - Each paragraph (separated by a blank line, or by "---") becomes one slide.
// Media: one slide showing the picture or video.
// Presentations: one slide per imported page image.

export const MIN_LINES_PER_SLIDE = 1;
export const MAX_LINES_PER_SLIDE = 4;

const SPLIT_MARKER = '---';
const SECTION_WORDS = 'verse|chorus|pre-chorus|prechorus|bridge|intro|outro|tag|ending|refrain|interlude|vamp';
const LABEL_PATTERN = new RegExp(`^(?:\\[([^\\]]+)\\]|((?:${SECTION_WORDS})(?:\\s*\\d+)?)\\s*:?)$`, 'i');

interface Block {
  label: string | null;
  segments: string[][];
}

type SlideDraft = Omit<Slide, 'id'>;

export function clampLinesPerSlide(value: number): number {
  if (!Number.isFinite(value)) return 2;
  return Math.min(MAX_LINES_PER_SLIDE, Math.max(MIN_LINES_PER_SLIDE, Math.round(value)));
}

export function parseLabel(line: string): string | null {
  // "[G]" or "[G] [C]" on its own is a line of chords, not a section name.
  if (isChordOnlyLine(line)) return null;
  const match = LABEL_PATTERN.exec(line.trim());
  if (!match) return null;
  const raw = (match[1] ?? match[2] ?? '').trim();
  if (!raw) return null;
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

function finishBlock(block: Block | null, blocks: Block[]): null {
  if (block) {
    const segments = block.segments.filter((segment) => segment.length > 0);
    if (segments.length > 0 || block.label) blocks.push({ label: block.label, segments });
  }
  return null;
}

function hasNoLines(block: Block): boolean {
  return block.segments.every((segment) => segment.length === 0);
}

function parseBlocks(content: string, detectLabels: boolean): Block[] {
  const blocks: Block[] = [];
  let current: Block | null = null;

  for (const rawLine of content.replace(/\r\n?/g, '\n').split('\n')) {
    const line = rawLine.trim();

    if (line === '') {
      // Allow a blank line between a label and its lyrics.
      if (current && current.label && hasNoLines(current)) continue;
      current = finishBlock(current, blocks);
      continue;
    }

    const label = detectLabels ? parseLabel(line) : null;
    if (label) {
      finishBlock(current, blocks);
      current = { label, segments: [[]] };
      continue;
    }

    if (!current) current = { label: null, segments: [[]] };
    if (line === SPLIT_MARKER) {
      current.segments.push([]);
      continue;
    }
    current.segments[current.segments.length - 1].push(line);
  }

  finishBlock(current, blocks);
  return blocks;
}

interface Unit {
  /** What the audience sees. */
  text: string;
  /** The line(s) as typed, with chords; a line of only chords is kept with the next words. */
  raw: string[];
}

function toUnits(segment: string[]): Unit[] {
  const units: Unit[] = [];
  let pending: string[] = [];
  for (const raw of segment) {
    const text = stripChords(raw);
    if (!text) {
      pending.push(raw);
      continue;
    }
    units.push({ text, raw: [...pending, raw] });
    pending = [];
  }
  if (pending.length && units.length) units[units.length - 1].raw.push(...pending);
  return units;
}

/** Second-language sections, found by the same labels (or in the same order when unlabelled). */
function secondLookup(blocks: Block[]) {
  const byLabel = new Map<string, string[][]>();
  const unlabelled: string[][][] = [];
  for (const b of blocks) {
    if (b.label) {
      const key = b.label.toLowerCase();
      if (b.segments.length && !byLabel.has(key)) byLabel.set(key, b.segments);
    } else unlabelled.push(b.segments);
  }
  let next = 0;
  return (label: string | null): string[][] => (label ? byLabel.get(label.toLowerCase()) ?? [] : unlabelled[next++] ?? []);
}

function interleave(a: string[], b: string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (i < a.length) out.push(a[i]);
    if (i < b.length) out.push(b[i]);
  }
  return out;
}

function songSlides(blocks: Block[], linesPerSlide: number, second: Block[] | null, mode: Bilingual): SlideDraft[] {
  const remembered = new Map<string, string[][]>();
  const lookup = second ? secondLookup(second) : null;
  const drafts: SlideDraft[] = [];

  for (const block of blocks) {
    let segments = block.segments;
    if (block.label) {
      const key = block.label.toLowerCase();
      if (segments.length === 0) segments = remembered.get(key) ?? [];
      else remembered.set(key, segments);
    }
    const secondSegments = lookup ? lookup(block.label) : [];
    segments.forEach((segment, s) => {
      const units = toUnits(segment);
      const other = (secondSegments[s] ?? []).map(stripChords).filter(Boolean);
      for (let i = 0; i < units.length; i += linesPerSlide) {
        const part = units.slice(i, i + linesPerSlide);
        const isLast = i + linesPerSlide >= units.length;
        const translated = other.slice(i, isLast ? undefined : i + linesPerSlide);
        const primary = part.map((u) => u.text);
        const raw = part.flatMap((u) => u.raw);
        const draft: SlideDraft = { group: block.label ?? undefined, lines: primary };
        if (translated.length && mode === 'stacked') draft.lines = interleave(primary, translated);
        if (translated.length && mode === 'columns') {
          draft.lines = [...primary, ...translated];
          draft.columns = [primary, translated];
        }
        if (raw.some(hasChords)) draft.chords = raw;
        drafts.push(draft);
      }
    });
  }
  return drafts;
}

const COLUMN_MARKER = '||';

/** A line "||" splits a scripture slide into two columns (two translations side by side). */
function paragraphSlides(blocks: Block[], footer?: string, allowColumns = false): SlideDraft[] {
  return blocks.flatMap((block) =>
    block.segments.map((lines) => {
      const split = allowColumns ? lines.indexOf(COLUMN_MARKER) : -1;
      if (split < 0) return { lines, footer };
      const left = lines.slice(0, split);
      const right = lines.slice(split + 1).filter((l) => l !== COLUMN_MARKER);
      return { lines: [...left, ...right], footer, columns: [left, right] as [string[], string[]] };
    })
  );
}

export function buildSlides(item: ItemSource): Slide[] {
  let drafts: SlideDraft[];
  if (item.kind === 'slides') {
    // Free-form slides: the words are only used for the stage display.
    drafts = item.deck.map((page) => ({ lines: deckSlideText(page) }));
  } else if (item.kind === 'media') {
    // One full-screen picture or video (the item's background).
    drafts = [{ lines: [] }];
  } else if (item.kind === 'presentation') {
    drafts = item.pages.map((image) => ({ lines: [], image }));
  } else if (item.kind === 'song') {
    const extra = extrasOf(item);
    const second = extra.bilingual !== 'off' && extra.content2.trim() ? parseBlocks(extra.content2, true) : null;
    drafts = songSlides(parseBlocks(item.content, true), clampLinesPerSlide(item.linesPerSlide), second, extra.bilingual);
  } else if (item.kind === 'scripture') {
    const footer = [item.title.trim(), item.subtitle.trim()].filter(Boolean).join(' · ');
    drafts = paragraphSlides(parseBlocks(item.content, false), footer || undefined, true);
  } else {
    drafts = paragraphSlides(parseBlocks(item.content, false));
  }
  return drafts.map((draft, i) => ({ id: `${item.id}-${i + 1}`, ...draft }));
}

export function countSections(slides: Slide[]): number {
  let count = 0;
  let previous: string | undefined;
  for (const slide of slides) {
    if (slide.group && slide.group !== previous) count += 1;
    previous = slide.group;
  }
  return count;
}
