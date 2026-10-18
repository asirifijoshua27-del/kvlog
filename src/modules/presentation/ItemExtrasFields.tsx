import { useEffect, useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import { DEFAULT_EXTRAS, extrasOf, formatDuration, parseDuration, type Bilingual, type ItemExtras } from '../../../shared/extras';
import { transposeKey } from '../../../shared/chords';
import type { EditableItemFields, ServiceItem } from '../../types';
import { LyricsTextarea } from '../../components/LyricsTextarea';

interface Props {
  item: ServiceItem;
  onChange: (changes: Partial<EditableItemFields>) => void;
  obsScenes: string[];
  /** Scene used for this type of item when the item has none of its own. */
  defaultScene: string | null;
  obsAuto: boolean;
}

const BILINGUAL: { id: Bilingual; label: string; title: string }[] = [
  { id: 'off', label: 'Off', title: 'Only the main lyrics' },
  { id: 'stacked', label: 'Line by line', title: 'Each line followed by its translation' },
  { id: 'columns', label: 'Side by side', title: 'Main lyrics on the left, translation on the right' }
];

/** Planned length and OBS scene for every item; key, chords, CCLI number and second language for songs. */
export function ItemExtrasFields({ item, onChange, obsScenes, defaultScene, obsAuto }: Props) {
  const extra = extrasOf(item);
  const set = (patch: Partial<ItemExtras>) => onChange({ extra: { ...DEFAULT_EXTRAS, ...item.extra, ...patch } });
  const [length, setLength] = useState(extra.durationSec ? formatDuration(extra.durationSec) : '');
  const [lengthBad, setLengthBad] = useState(false);
  useEffect(() => setLength(extra.durationSec ? formatDuration(extra.durationSec) : ''), [extra.durationSec]);

  const commitLength = () => {
    const sec = parseDuration(length);
    setLengthBad(sec === null);
    if (sec !== null && sec !== extra.durationSec) set({ durationSec: sec });
  };
  const song = item.kind === 'song';
  const sceneMissing = extra.obsScene && extra.obsScene !== '-' && obsScenes.length > 0 && !obsScenes.includes(extra.obsScene);

  return (
    <>
      <div className="field-row">
        <label className="field">
          <span className="field-label">Planned length<span className="field-hint">minutes, e.g. 5 or 4:30</span></span>
          <input className={`input${lengthBad ? ' is-invalid' : ''}`} value={length} placeholder="Not planned" inputMode="numeric"
            onChange={(e) => setLength(e.target.value)} onBlur={commitLength} onKeyDown={(e) => e.key === 'Enter' && commitLength()} />
          {lengthBad && <span className="bad-text">Type minutes (5) or minutes:seconds (4:30).</span>}
        </label>
        <label className="field">
          <span className="field-label">OBS scene<span className="field-hint">{obsAuto ? 'when this goes live' : 'automatic switching is off (Broadcast)'}</span></span>
          <select className="input" value={extra.obsScene} onChange={(e) => set({ obsScene: e.target.value })}>
            <option value="">{defaultScene ? `Default for this type (${defaultScene})` : "Default for this type (don't switch)"}</option>
            <option value="-">Don't switch</option>
            {sceneMissing && <option value={extra.obsScene}>{extra.obsScene} (not in OBS)</option>}
            {obsScenes.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
      </div>

      {song && (
        <div className="field-row">
          <label className="field">
            <span className="field-label">Key<span className="field-hint">e.g. G or Bbm</span></span>
            <input className="input" value={extra.songKey} maxLength={12} onChange={(e) => set({ songKey: e.target.value.trim() })} />
          </label>
          <div className="field">
            <span className="field-label">Band plays in<span className="field-hint">moves the chords on the stage display</span></span>
            <div className="inline-row">
              <button type="button" className="icon-btn" aria-label="Down a semitone" disabled={extra.transpose <= -11} onClick={() => set({ transpose: extra.transpose - 1 })}><Minus size={13} /></button>
              <span className="transpose-val">
                {extra.songKey ? transposeKey(extra.songKey, extra.transpose) : extra.transpose === 0 ? 'Original' : `${extra.transpose > 0 ? '+' : ''}${extra.transpose}`}
                {extra.songKey && extra.transpose !== 0 && <span className="help-inline"> ({extra.transpose > 0 ? '+' : ''}{extra.transpose})</span>}
              </span>
              <button type="button" className="icon-btn" aria-label="Up a semitone" disabled={extra.transpose >= 11} onClick={() => set({ transpose: extra.transpose + 1 })}><Plus size={13} /></button>
              {extra.transpose !== 0 && <button type="button" className="btn btn-sm" onClick={() => set({ transpose: 0 })}>Reset</button>}
            </div>
          </div>
          <label className="field">
            <span className="field-label">CCLI song number</span>
            <input className="input" value={extra.ccli} inputMode="numeric" maxLength={20} onChange={(e) => set({ ccli: e.target.value.replace(/\D/g, '') })} />
          </label>
        </div>
      )}

      {song && (
        <div className="field">
          <span className="field-label">Second language<span className="field-hint">e.g. Twi with English</span></span>
          <div className="segmented" role="radiogroup" aria-label="Second language">
            {BILINGUAL.map((b) => (
              <button key={b.id} type="button" role="radio" aria-checked={extra.bilingual === b.id} className={extra.bilingual === b.id ? 'is-active' : undefined} title={b.title} onClick={() => set({ bilingual: b.id })}>
                {b.label}
              </button>
            ))}
          </div>
          {(extra.bilingual !== 'off' || extra.content2.trim() !== '') && (
            <>
              <LyricsTextarea className="textarea textarea-content2" rows={8} value={extra.content2} aria-label="Second language lyrics"
                placeholder={'[Verse 1]\nFirst line in the second language\nSecond line\n\n[Chorus]\n…'}
                onValueChange={(content2) => set({ content2 })} />
              <p className="help">Use the same section labels as the main lyrics ([Verse 1], [Chorus]…), with the lines in the same order. Each line is shown with the matching line of the main lyrics.</p>
            </>
          )}
        </div>
      )}
    </>
  );
}
