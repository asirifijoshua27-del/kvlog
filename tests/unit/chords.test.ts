import { describe, expect, it } from 'vitest';
import { chordSegments, isChordOnlyLine, stripChords, transposeChord, transposeKey } from '../../shared/chords';

describe('chords', () => {
  it('removes chords for the audience', () => {
    expect(stripChords('[G]Amazing [C]grace')).toBe('Amazing grace');
    expect(stripChords('[Verse 1]')).toBe('[Verse 1]');
  });
  it('tells chord lines from section labels', () => {
    expect(isChordOnlyLine('[G] [C]')).toBe(true);
    expect(isChordOnlyLine('[Verse 1]')).toBe(false);
    expect(isChordOnlyLine('[Chorus]')).toBe(false);
  });
  it('splits a line into chord and text pieces', () => {
    expect(chordSegments('[G]Amazing [C]grace')).toEqual([
      { chord: 'G', text: 'Amazing ' },
      { chord: 'C', text: 'grace' }
    ]);
  });
  it('transposes roots and bass notes', () => {
    expect(transposeChord('G', 2, 'G')).toBe('A');
    expect(transposeChord('D/F#', 2, 'D')).toBe('E/G#');
    expect(transposeChord('Cadd9', 2, 'C')).toBe('Dadd9');
    expect(transposeChord('C', 1, 'F')).toBe('Db');
  });
  it('transposes keys', () => {
    expect(transposeKey('G', 2)).toBe('A');
    expect(transposeKey('F', 1)).toBe('Gb');
    expect(transposeKey('Am', 3)).toBe('Cm');
  });
});
