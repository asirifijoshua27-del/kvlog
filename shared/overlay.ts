// Overlays: things drawn on top of the slide (logo, lower third, clock, countdown, ticker,
// reference bar, picture-in-picture). They are saved with KVLOG's data; whether each one is ON
// is live state and resets when KVLOG starts.
import { FONT_CHOICES } from './layout';

export type OverlayKind = 'logo' | 'lowerThird' | 'clock' | 'countdown' | 'ticker' | 'reference' | 'pip';

export const OVERLAY_KINDS: OverlayKind[] = ['logo', 'lowerThird', 'clock', 'countdown', 'ticker', 'reference', 'pip'];

export const OVERLAY_LABELS: Record<OverlayKind, string> = {
  logo: 'Logo / watermark',
  lowerThird: 'Lower third',
  clock: 'Clock',
  countdown: 'Countdown',
  ticker: 'Scrolling ticker',
  reference: 'Song / verse bar',
  pip: 'Picture-in-picture'
};

export interface Overlay {
  id: string;
  name: string;
  kind: OverlayKind;
  /** Where it shows. */
  projector: boolean;
  obs: boolean;
  /** Position and size in percent of the screen. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Lower third: name. Countdown: label above the time. Ticker: the scrolling text. */
  line1: string;
  /** Lower third: title. Countdown: text when time is up. */
  line2: string;
  /** Logo / picture-in-picture: Media Library id. */
  mediaId: string | null;
  font: string;
  /** Percent of screen width. */
  size: number;
  textColor: string;
  bgColor: string;
  bgOpacity: number;
  accentColor: string;
  /** Corner rounding, percent of screen width. */
  radius: number;
  /** Whole overlay transparency, 0–1. */
  alpha: number;
  /** Countdown: to a time of day ("until", e.g. 10:00) or for a number of minutes from when it is turned on. */
  countdownMode: 'until' | 'duration';
  countdownUntil: string;
  countdownMinutes: number;
  clock24: boolean;
  clockSeconds: boolean;
  /** Ticker: screen widths per minute (higher = faster). */
  tickerSpeed: number;
  /** Turn off by itself after this many seconds (0 = stays on). */
  autoHideSeconds: number;
  /** Stay visible during Blackout. */
  keepOnBlackout: boolean;
}

/** An overlay that is ON, ready for an output to draw. */
export interface OutputOverlay extends Overlay {
  /** When it was turned on (ms). */
  since: number;
  /** Media file name for logo / picture-in-picture. */
  file: string | null;
  /** Song / verse bar: the text to show. */
  refText: string;
}

const base = (kind: OverlayKind): Omit<Overlay, 'id'> => ({
  name: OVERLAY_LABELS[kind],
  kind,
  projector: true,
  obs: true,
  x: 5,
  y: 5,
  w: 20,
  h: 10,
  line1: '',
  line2: '',
  mediaId: null,
  font: 'Segoe UI',
  size: 2.2,
  textColor: '#ffffff',
  bgColor: '#0b1222',
  bgOpacity: 0.85,
  accentColor: '#3b82f6',
  radius: 0.4,
  alpha: 1,
  countdownMode: 'duration',
  countdownUntil: '10:00',
  countdownMinutes: 5,
  clock24: true,
  clockSeconds: false,
  tickerSpeed: 12,
  autoHideSeconds: 0,
  keepOnBlackout: false
});

export function makeOverlay(kind: OverlayKind, id: string): Overlay {
  const o = { ...base(kind), id };
  switch (kind) {
    case 'logo':
      return { ...o, x: 86, y: 4, w: 10, h: 10, bgOpacity: 0, alpha: 0.85, keepOnBlackout: false };
    case 'lowerThird':
      return { ...o, x: 5, y: 74, w: 48, h: 14, line1: 'Pastor’s name', line2: 'Senior Pastor', size: 2.6, projector: false, autoHideSeconds: 10 };
    case 'clock':
      return { ...o, x: 86, y: 4, w: 10, h: 6, size: 1.8, radius: 0.6, projector: false };
    case 'countdown':
      return { ...o, x: 30, y: 38, w: 40, h: 24, line1: 'Service starts in', line2: 'Welcome!', size: 6, bgOpacity: 0, radius: 1 };
    case 'ticker':
      return { ...o, x: 0, y: 93, w: 100, h: 7, line1: 'Welcome to our service · Youth meeting on Friday at 6 pm · Visit our website', size: 2, radius: 0, projector: false };
    case 'reference':
      return { ...o, x: 5, y: 88, w: 40, h: 6, size: 1.6, projector: false };
    case 'pip':
      return { ...o, x: 64, y: 6, w: 32, h: 32 * (16 / 9) * (9 / 16), bgOpacity: 0, radius: 0.6 };
  }
}

// ----- Time helpers (also copied into the OBS page) -----

export function formatClock(now: Date, h24: boolean, seconds: boolean): string {
  let h = now.getHours();
  const m = String(now.getMinutes()).padStart(2, '0');
  const s = String(now.getSeconds()).padStart(2, '0');
  let suffix = '';
  if (!h24) {
    suffix = h >= 12 ? ' PM' : ' AM';
    h = h % 12 || 12;
  }
  return `${h24 ? String(h).padStart(2, '0') : h}:${m}${seconds ? `:${s}` : ''}${suffix}`;
}

/** Seconds left, never below 0. */
export function countdownSeconds(o: Pick<Overlay, 'countdownMode' | 'countdownUntil' | 'countdownMinutes'>, since: number, now: number): number {
  if (o.countdownMode === 'duration') return Math.max(0, Math.ceil((since + o.countdownMinutes * 60000 - now) / 1000));
  const match = /^(\d{1,2}):(\d{2})$/.exec(o.countdownUntil);
  if (!match) return 0;
  const target = new Date(now);
  target.setHours(Number(match[1]), Number(match[2]), 0, 0);
  return Math.max(0, Math.ceil((target.getTime() - now) / 1000));
}

export function formatCountdown(total: number): string {
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// ----- Validation of saved data -----

export const MAX_OVERLAYS = 100;
const COLOR = /^#[0-9a-f]{6}$/i;
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const num = (v: unknown, min: number, max: number, fallback: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback);
const str = (v: unknown, max: number, fallback: string) => (typeof v === 'string' ? v.slice(0, max) : fallback);
const col = (v: unknown, fallback: string) => (typeof v === 'string' && COLOR.test(v) ? v : fallback);

export function sanitizeOverlay(value: unknown): Overlay {
  if (!isObj(value)) throw new Error('Invalid overlay.');
  if (typeof value.id !== 'string' || !/^[A-Za-z0-9_-]{1,100}$/.test(value.id)) throw new Error('Invalid overlay id.');
  if (typeof value.kind !== 'string' || !(OVERLAY_KINDS as string[]).includes(value.kind)) throw new Error('Unknown overlay type.');
  const d = makeOverlay(value.kind as OverlayKind, value.id);
  return {
    id: value.id,
    kind: d.kind,
    name: str(value.name, 200, d.name),
    projector: typeof value.projector === 'boolean' ? value.projector : d.projector,
    obs: typeof value.obs === 'boolean' ? value.obs : d.obs,
    x: num(value.x, -50, 150, d.x),
    y: num(value.y, -50, 150, d.y),
    w: num(value.w, 1, 200, d.w),
    h: num(value.h, 1, 200, d.h),
    line1: str(value.line1, 2000, d.line1),
    line2: str(value.line2, 500, d.line2),
    mediaId: typeof value.mediaId === 'string' && /^[A-Za-z0-9-]{1,100}$/.test(value.mediaId) ? value.mediaId : null,
    font: typeof value.font === 'string' && FONT_CHOICES.includes(value.font) ? value.font : d.font,
    size: num(value.size, 0.5, 30, d.size),
    textColor: col(value.textColor, d.textColor),
    bgColor: col(value.bgColor, d.bgColor),
    bgOpacity: num(value.bgOpacity, 0, 1, d.bgOpacity),
    accentColor: col(value.accentColor, d.accentColor),
    radius: num(value.radius, 0, 20, d.radius),
    alpha: num(value.alpha, 0, 1, d.alpha),
    countdownMode: value.countdownMode === 'until' ? 'until' : 'duration',
    countdownUntil: typeof value.countdownUntil === 'string' && /^\d{1,2}:\d{2}$/.test(value.countdownUntil) ? value.countdownUntil : d.countdownUntil,
    countdownMinutes: num(value.countdownMinutes, 0.1, 600, d.countdownMinutes),
    clock24: typeof value.clock24 === 'boolean' ? value.clock24 : d.clock24,
    clockSeconds: value.clockSeconds === true,
    tickerSpeed: num(value.tickerSpeed, 1, 120, d.tickerSpeed),
    autoHideSeconds: num(value.autoHideSeconds, 0, 3600, d.autoHideSeconds),
    keepOnBlackout: value.keepOnBlackout === true
  };
}

export function sanitizeOverlays(value: unknown): Overlay[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.length > MAX_OVERLAYS) throw new Error('The overlay list is invalid.');
  const list = value.map(sanitizeOverlay);
  if (new Set(list.map((o) => o.id)).size !== list.length) throw new Error('Two overlays share the same id.');
  return list;
}
