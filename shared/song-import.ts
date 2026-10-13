// Song import results, shared by the main process and the UI.

export interface ImportedSong {
  title: string;
  /** Author / copyright line (the song's "subtitle"). */
  subtitle: string;
  ccli: string;
  songKey: string;
  /** KVLOG lyrics: [Section] labels, blank lines between sections, chords inline as [G]. */
  content: string;
  /** Second language (e.g. Twi), same section labels. '' when none. */
  content2: string;
  /** File it came from, shown in the import list. */
  source: string;
  format: string;
}

export interface SongImportResult {
  canceled: boolean;
  songs: ImportedSong[];
  /** Files or songs that could not be read, with the reason. */
  problems: string[];
}

export type SongImportMode = 'files' | 'folder';
