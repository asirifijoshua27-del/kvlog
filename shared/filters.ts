// Picture filters for slide backgrounds and picture boxes. Pure CSS filters, so the projector,
// OBS and every preview draw exactly the same thing.

export type LookId = 'none' | 'warm' | 'cool' | 'faded' | 'dramatic';

export interface PictureFilter {
  /** Ready-made look, applied before the adjustments below. */
  look: LookId;
  /** Percent, 100 = unchanged. */
  brightness: number;
  contrast: number;
  saturation: number;
  /** 0–100. 100 = about 19 px on a 1920-wide screen. */
  blur: number;
  /** 0–90. Percent of black laid over the picture. */
  darken: number;
  grayscale: boolean;
}

export const NO_FILTER: PictureFilter = { look: 'none', brightness: 100, contrast: 100, saturation: 100, blur: 0, darken: 0, grayscale: false };

export const LOOKS: { id: LookId; label: string }[] = [
  { id: 'none', label: 'None' },
  { id: 'warm', label: 'Warm' },
  { id: 'cool', label: 'Cool' },
  { id: 'faded', label: 'Faded' },
  { id: 'dramatic', label: 'Dramatic' }
];

const LOOK_CSS: Record<LookId, string> = {
  none: '',
  warm: 'sepia(0.22) saturate(1.25) hue-rotate(-8deg)',
  cool: 'saturate(0.9) hue-rotate(12deg) brightness(1.03)',
  faded: 'contrast(0.82) saturate(0.7) brightness(1.08)',
  dramatic: 'contrast(1.35) saturate(1.15) brightness(0.9)'
};

export function isNoFilter(f: PictureFilter | null | undefined): boolean {
  if (!f) return true;
  return f.look === 'none' && f.brightness === 100 && f.contrast === 100 && f.saturation === 100 && f.blur === 0 && f.darken === 0 && !f.grayscale;
}

/**
 * CSS filter value, or undefined for none.
 * darkenAsBrightness: picture boxes darken through the filter, so see-through parts of a logo stay see-through.
 */
export function filterCss(f: PictureFilter | null | undefined, darkenAsBrightness = false): string | undefined {
  if (!f || isNoFilter(f)) return undefined;
  const parts: string[] = [];
  if (LOOK_CSS[f.look]) parts.push(LOOK_CSS[f.look]);
  const brightness = (f.brightness / 100) * (darkenAsBrightness ? 1 - f.darken / 100 : 1);
  if (brightness !== 1) parts.push(`brightness(${brightness.toFixed(3)})`);
  if (f.contrast !== 100) parts.push(`contrast(${(f.contrast / 100).toFixed(3)})`);
  if (f.saturation !== 100) parts.push(`saturate(${(f.saturation / 100).toFixed(3)})`);
  if (f.grayscale) parts.push('grayscale(1)');
  if (f.blur > 0) parts.push(`blur(${(f.blur / 100).toFixed(3)}cqw)`);
  return parts.length ? parts.join(' ') : undefined;
}

/** Blur lets the edges fade; scaling up slightly hides that on full-screen backgrounds. */
export function blurScale(f: PictureFilter | null | undefined): string | undefined {
  return f && f.blur > 0 ? `scale(${(1 + f.blur / 1500).toFixed(3)})` : undefined;
}

const num = (v: unknown, min: number, max: number, fallback: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.round(Math.min(max, Math.max(min, v))) : fallback;

export function sanitizeFilter(value: unknown): PictureFilter | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  const f: PictureFilter = {
    look: LOOKS.some((l) => l.id === v.look) ? (v.look as LookId) : 'none',
    brightness: num(v.brightness, 0, 200, 100),
    contrast: num(v.contrast, 0, 200, 100),
    saturation: num(v.saturation, 0, 200, 100),
    blur: num(v.blur, 0, 100, 0),
    darken: num(v.darken, 0, 90, 0),
    grayscale: v.grayscale === true
  };
  return isNoFilter(f) ? null : f;
}

export function sanitizeSlideFilters(value: unknown): Record<string, PictureFilter> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {};
  const out: Record<string, PictureFilter> = {};
  for (const [key, f] of Object.entries(value).slice(0, 2000)) {
    if (!/^\d{1,4}$/.test(key)) continue;
    const clean = sanitizeFilter(f);
    if (clean) out[key] = clean;
  }
  return out;
}
