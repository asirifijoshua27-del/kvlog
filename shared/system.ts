// Updates and automatic backups. Type-only.

export type UpdateStatus = 'disabled' | 'idle' | 'checking' | 'none' | 'available' | 'downloading' | 'ready' | 'error';

export interface UpdateState {
  status: UpdateStatus;
  /** Version on this PC. */
  current: string;
  /** Newer version found, when there is one. */
  version: string | null;
  /** Download progress, 0–100. */
  percent: number;
  message: string | null;
  checkedAt: string | null;
}

export interface AutoBackupInfo {
  /** Folder name: the date, YYYY-MM-DD. */
  name: string;
  createdAt: string;
  items: number;
  plans: number;
}
