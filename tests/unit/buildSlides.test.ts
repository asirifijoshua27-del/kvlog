import { describe, expect, it } from 'vitest';
import { buildSlides } from '../../src/slides/buildSlides';
import { DEFAULT_EXTRAS, type ItemExtras } from '../../shared/extras';
import type { ItemSource } from '../../src/types';

function song(content: string, linesPerSlide = 2, extra?: Partial<ItemExtras>): ItemSource {
  return {
    id: 't', kind: 'song', title: 'Test', subtitle: '', background: 'black', content, linesPerSlide, notes: '', transition: 'fade',
    pages: [], templateId: null, slideLayouts: {}, slideFilters: {}, deck: [],
    ...(extra ? { extra: { ...DEFAULT_EXTRAS, ...extra } } : {})
  };
}

describe('buildSlides (songs)', () => {
  it('splits sections and repeats a label on its own', () => {
    const slides = buildSlides(song('[Verse 1]\nA\nB\nC\n\n[Chorus]\nX\nY\n\n[Chorus]'));
    expect(slides.map((s) => s.lines)).toEqual([['A', 'B'], ['C'], ['X', 'Y'], ['X', 'Y']]);
    expect(slides.map((s) => s.group)).toEqual(['Verse 1', 'Verse 1', 'Chorus', 'Chorus']);
  });
  it('hides chords from the audience and keeps them for the stage', () => {
    const [slide] = buildSlides(song('[Verse 1]\n[G]Amazing [C]grace\nHow sweet'));
    expect(slide.lines).toEqual(['Amazing grace', 'How sweet']);
    expect(slide.chords).toEqual(['[G]Amazing [C]grace', 'How sweet']);
  });
  it('treats a line of chords as chords, not a section', () => {
    const [slide] = buildSlides(song('[G]\nWords'));
    expect(slide.group).toBeUndefined();
    expect(slide.lines).toEqual(['Words']);
    expect(slide.chords).toEqual(['[G]', 'Words']);
  });
  it('has no chords field when there are no chords', () => {
    expect(buildSlides(song('Plain\nLines'))[0].chords).toBeUndefined();
  });
  it('shows a second language line by line', () => {
    const [slide] = buildSlides(song('[Verse 1]\nA\nB', 2, { bilingual: 'stacked', content2: '[Verse 1]\nA2\nB2' }));
    expect(slide.lines).toEqual(['A', 'A2', 'B', 'B2']);
  });
  it('shows a second language side by side', () => {
    const [slide] = buildSlides(song('[Verse 1]\nA\nB', 2, { bilingual: 'columns', content2: '[Verse 1]\nA2\nB2' }));
    expect(slide.columns).toEqual([['A', 'B'], ['A2', 'B2']]);
  });
  it('matches the second language by section label', () => {
    const slides = buildSlides(song('[Verse 1]\nA\n\n[Chorus]\nC', 2, { bilingual: 'stacked', content2: '[Chorus]\nC2\n\n[Verse 1]\nA2' }));
    expect(slides.map((s) => s.lines)).toEqual([['A', 'A2'], ['C', 'C2']]);
  });
});
