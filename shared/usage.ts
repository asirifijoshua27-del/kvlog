export interface UsageEntry {
  /** ISO time the song was first shown. */
  at: string;
  songId: string;
  title: string;
  subtitle: string;
  ccli: string;
  service: string;
}

export interface UsageSummaryRow {
  title: string;
  subtitle: string;
  ccli: string;
  count: number;
  /** ISO time it was last shown. */
  last: string;
}

export interface BackupResult {
  /** Folder the backup was written to (export) or read from (restore). null when cancelled. */
  folder: string | null;
  items: number;
  plans: number;
  mediaFiles: number;
  bibles: number;
  /** Files that could not be copied. */
  problems: string[];
}
