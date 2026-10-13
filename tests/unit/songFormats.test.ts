import { describe, expect, it } from 'vitest';
import { parseChordPro, parseOpenLyrics, parsePlainText, parseProPresenterXml } from '../../electron/songFormats';
import { labelFromCode, rtfToText } from '../../electron/songText';

describe('song import', () => {
  it('reads plain text with a header', () => {
    const s = parsePlainText('Title: Hello\nAuthor: Me\nCCLI: 12345\n\n[Verse 1]\nLine', 'file');
    expect(s.title).toBe('Hello');
    expect(s.subtitle).toBe('Me');
    expect(s.ccli).toBe('12345');
    expect(s.content).toBe('[Verse 1]\nLine');
  });
  it('uses the file name when there is no title', () => {
    expect(parsePlainText('Just words', 'Great Is Thy Faithfulness').title).toBe('Great Is Thy Faithfulness');
  });
  it('reads ChordPro', () => {
    const s = parseChordPro('{title: Song}\n{key: G}\n{soc}\n[G]Praise\n{eoc}', 'file');
    expect(s.title).toBe('Song');
    expect(s.songKey).toBe('G');
    expect(s.content).toBe('[Chorus]\n[G]Praise');
  });
  it('reads OpenLyrics with two languages', () => {
    const xml = `<?xml version="1.0"?><song xmlns="http://openlyrics.info/namespace/2009/song"><properties><titles><title>Hymn</title></titles>
      <authors><author>A. Writer</author></authors><verseOrder>v1 c v1</verseOrder></properties><lyrics>
      <verse name="v1" lang="en"><lines>Hello<br/>World</lines></verse>
      <verse name="c" lang="en"><lines><chord name="G"/>Sing</lines></verse>
      <verse name="v1" lang="tw"><lines>Akwaaba<br/>Wiase</lines></verse>
      </lyrics></song>`;
    const s = parseOpenLyrics(xml, 'file');
    expect(s.title).toBe('Hymn');
    expect(s.subtitle).toBe('A. Writer');
    expect(s.content).toBe('[Verse 1]\nHello\nWorld\n\n[Chorus]\n[G]Sing\n\n[Verse 1]');
    expect(s.content2).toBe('[Verse 1]\nAkwaaba\nWiase\n\n[Verse 1]');
  });
  it('reads ProPresenter 6 groups', () => {
    const b64 = Buffer.from('Sing to the Lord').toString('base64');
    const xml = `<RVPresentationDocument CCLISongTitle="My Song" CCLIAuthor="Someone"><groups>
      <RVSlideGrouping name="Chorus"><slides><RVDisplaySlide><NSString rvXMLIvarName="PlainText">${b64}</NSString></RVDisplaySlide></slides></RVSlideGrouping>
      </groups></RVPresentationDocument>`;
    const s = parseProPresenterXml(xml, 'file');
    expect(s.title).toBe('My Song');
    expect(s.content).toBe('[Chorus]\nSing to the Lord');
  });
  it('keeps Twi letters in RTF', () => {
    const text = rtfToText('{\\rtf1\\ansi Y\\u603?\\u596? \\par Next}');
    expect(text).toContain('Y\u025B\u0254');
    expect(text).toContain('\nNext');
  });
  it('names sections from OpenLyrics codes', () => {
    expect(labelFromCode('v1')).toBe('Verse 1');
    expect(labelFromCode('c')).toBe('Chorus');
    expect(labelFromCode('p2')).toBe('Pre-chorus 2');
  });
});
