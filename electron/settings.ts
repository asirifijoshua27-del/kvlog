// Settings that belong to this computer rather than to the library: which screen is the
// projector, and how to reach OBS. Stored separately from kvlog-data.json.
// The OBS password is encrypted with Windows' own protection (safeStorage) and never logged.
import { app, safeStorage } from 'electron';
import { readFileSync, promises as fs } from 'node:fs';
import * as path from 'node:path';
import type { DisplayAssignment, OutputRole } from '../shared/output-types';
import type { LyricsSourceSettings } from '../shared/obs-types';

export interface ObsStoredSettings {
  host: string;
  port: number;
  autoConnect: boolean;
  /** Base64 of the encrypted password, or null. */
  passwordEncrypted: string | null;
}

interface MachineSettings {
  version: 1;
  assignments: Partial<Record<OutputRole, DisplayAssignment>>;
  obs: ObsStoredSettings;
  lyrics: LyricsSourceSettings;
}

const ROLES: OutputRole[] = ['projector', 'stage'];
export const DEFAULT_OBS: ObsStoredSettings = { host: '127.0.0.1', port: 4455, autoConnect: false, passwordEncrypted: null };

export const DEFAULT_LYRICS: LyricsSourceSettings = { enabled: false, port: 4460, mode: 'full' };

let settings: MachineSettings = { version: 1, assignments: {}, obs: { ...DEFAULT_OBS }, lyrics: { ...DEFAULT_LYRICS } };
/** Used only when encryption is unavailable: the password lives in memory until KVLOG closes. */
let memoryPassword: string | null = null;
let saveTimer: NodeJS.Timeout | null = null;

function settingsPath(): string {
  return path.join(app.getPath('userData'), 'kvlog-settings.json');
}

function isAssignment(value: unknown): value is DisplayAssignment {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.displayId === 'number' && Number.isInteger(v.displayId) && typeof v.label === 'string' && v.label.length <= 200;
}

export function isValidHost(host: unknown): host is string {
  return typeof host === 'string' && host.length > 0 && host.length <= 253 && /^[A-Za-z0-9.\-:[\]]+$/.test(host);
}

export function isValidPort(port: unknown): port is number {
  return typeof port === 'number' && Number.isInteger(port) && port >= 1 && port <= 65535;
}

function readObs(value: unknown): ObsStoredSettings {
  if (typeof value !== 'object' || value === null) return { ...DEFAULT_OBS };
  const v = value as Record<string, unknown>;
  return {
    host: isValidHost(v.host) ? v.host : DEFAULT_OBS.host,
    port: isValidPort(v.port) ? v.port : DEFAULT_OBS.port,
    autoConnect: v.autoConnect === true,
    passwordEncrypted: typeof v.passwordEncrypted === 'string' && v.passwordEncrypted.length < 4096 ? v.passwordEncrypted : null
  };
}

function readLyrics(value: unknown): LyricsSourceSettings {
  if (typeof value !== 'object' || value === null) return { ...DEFAULT_LYRICS };
  const v = value as Record<string, unknown>;
  return {
    enabled: v.enabled === true,
    port: isValidPort(v.port) && v.port >= 1024 ? v.port : DEFAULT_LYRICS.port,
    mode: v.mode === 'overlay' ? 'overlay' : 'full'
  };
}

/** Reads settings once at start-up. A missing or damaged file just means defaults. */
export function loadSettings(): void {
  try {
    const raw: unknown = JSON.parse(readFileSync(settingsPath(), 'utf8'));
    const assignments: MachineSettings['assignments'] = {};
    let obs = { ...DEFAULT_OBS };
    let lyrics = { ...DEFAULT_LYRICS };
    if (typeof raw === 'object' && raw !== null) {
      const r = raw as Record<string, unknown>;
      if (typeof r.assignments === 'object' && r.assignments !== null) {
        for (const role of ROLES) {
          const value = (r.assignments as Record<string, unknown>)[role];
          if (isAssignment(value)) assignments[role] = { displayId: value.displayId, label: value.label };
        }
      }
      obs = readObs(r.obs);
      lyrics = readLyrics(r.lyrics);
    }
    settings = { version: 1, assignments, obs, lyrics };
  } catch {
    settings = { version: 1, assignments: {}, obs: { ...DEFAULT_OBS }, lyrics: { ...DEFAULT_LYRICS } };
  }
}

async function writeSettings(): Promise<void> {
  const file = settingsPath();
  const temp = `${file}.tmp`;
  try {
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(temp, JSON.stringify(settings, null, 2), 'utf8');
    await fs.rename(temp, file);
  } catch (error) {
    console.error('Could not save KVLOG settings:', (error as Error).message);
  }
}

function scheduleSave(): void {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => void writeSettings(), 300);
}

export function getAssignment(role: OutputRole): DisplayAssignment | null {
  return settings.assignments[role] ?? null;
}

export function setAssignment(role: OutputRole, assignment: DisplayAssignment | null): void {
  const assignments = { ...settings.assignments };
  if (assignment) assignments[role] = assignment;
  else delete assignments[role];
  settings = { ...settings, assignments };
  scheduleSave();
}

export function getLyricsSettings(): LyricsSourceSettings {
  return { ...settings.lyrics };
}

export function setLyricsSettings(lyrics: LyricsSourceSettings): void {
  settings = { ...settings, lyrics: { ...lyrics } };
  scheduleSave();
}

export function canEncrypt(): boolean {
  return safeStorage.isEncryptionAvailable();
}

export function getObsSettings(): ObsStoredSettings {
  return { ...settings.obs };
}

export function hasObsPassword(): boolean {
  return settings.obs.passwordEncrypted !== null || memoryPassword !== null;
}

/** Decrypts the saved password for connecting. Returns undefined when none is saved. */
export function getObsPassword(): string | undefined {
  if (memoryPassword !== null) return memoryPassword;
  const stored = settings.obs.passwordEncrypted;
  if (!stored || !canEncrypt()) return undefined;
  try {
    return safeStorage.decryptString(Buffer.from(stored, 'base64'));
  } catch {
    return undefined;
  }
}

export function setObsSettings(input: { host: string; port: number; autoConnect: boolean; password: string | null }): void {
  const obs: ObsStoredSettings = { ...settings.obs, host: input.host, port: input.port, autoConnect: input.autoConnect };
  if (input.password !== null) {
    memoryPassword = null;
    obs.passwordEncrypted = null;
    if (input.password !== '') {
      if (canEncrypt()) obs.passwordEncrypted = safeStorage.encryptString(input.password).toString('base64');
      else memoryPassword = input.password;
    }
  }
  settings = { ...settings, obs };
  scheduleSave();
}
