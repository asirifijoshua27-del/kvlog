import { RotateCcw } from 'lucide-react';
import { LOOKS, NO_FILTER, filterCss, isNoFilter, type PictureFilter } from '../../../shared/filters';

interface FilterControlsProps {
  value: PictureFilter | null;
  /** null = no filter. */
  onChange: (next: PictureFilter | null, key: string) => void;
  /** Shown as the swatch behind each look (a CSS background). */
  sample?: string;
  /** Picture boxes darken without a black layer, so logos keep their see-through parts. */
  darkenLabel?: string;
}

const SLIDERS: { key: 'brightness' | 'contrast' | 'saturation' | 'blur' | 'darken'; label: string; min: number; max: number }[] = [
  { key: 'brightness', label: 'Brightness', min: 0, max: 200 },
  { key: 'contrast', label: 'Contrast', min: 0, max: 200 },
  { key: 'saturation', label: 'Colour', min: 0, max: 200 },
  { key: 'blur', label: 'Blur', min: 0, max: 100 },
  { key: 'darken', label: 'Darken', min: 0, max: 90 }
];

const DEFAULT_SAMPLE = 'linear-gradient(135deg, #f2b45a 0%, #c2557a 45%, #3b5bdb 100%)';

/** Ready-made looks plus adjustment sliders. */
export function FilterControls({ value, onChange, sample = DEFAULT_SAMPLE, darkenLabel = 'Darken' }: FilterControlsProps) {
  const f = value ?? NO_FILTER;
  const set = (patch: Partial<PictureFilter>, key: string) => {
    const next = { ...f, ...patch };
    onChange(isNoFilter(next) ? null : next, key);
  };

  return (
    <>
      <div className="flt-looks" role="radiogroup" aria-label="Look">
        {LOOKS.map((look) => (
          <button
            key={look.id}
            type="button"
            role="radio"
            aria-checked={f.look === look.id}
            className={`flt-look${f.look === look.id ? ' is-active' : ''}`}
            onClick={() => set({ look: look.id }, 'look')}
          >
            <span className="flt-swatch" style={{ background: sample, filter: filterCss({ ...NO_FILTER, look: look.id }) }} />
            <span>{look.label}</span>
          </button>
        ))}
      </div>
      {SLIDERS.map((s) => (
        <label key={s.key} className="ins-row">
          <span className="ins-label">{s.key === 'darken' ? darkenLabel : s.label}</span>
          <span className="ins-control">
            <input
              className="ins-range"
              type="range"
              min={s.min}
              max={s.max}
              step={1}
              value={f[s.key]}
              onChange={(e) => set({ [s.key]: Number(e.target.value) }, s.key)}
              onDoubleClick={() => set({ [s.key]: NO_FILTER[s.key] }, s.key)}
            />
            <span className="ins-suffix flt-val">{f[s.key]}{s.key === 'blur' ? '' : '%'}</span>
          </span>
        </label>
      ))}
      <div className="flt-foot">
        <label className="check">
          <input type="checkbox" checked={f.grayscale} onChange={(e) => set({ grayscale: e.target.checked }, 'gray')} />
          <span>Black &amp; white</span>
        </label>
        <button type="button" className="btn btn-sm" disabled={isNoFilter(value)} onClick={() => onChange(null, 'reset')} title="Remove all filters">
          <RotateCcw size={12} aria-hidden="true" />Reset
        </button>
      </div>
    </>
  );
}
