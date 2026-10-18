import { useRef, useState, type KeyboardEvent, type TextareaHTMLAttributes } from 'react';

// Letters that are hard to type on an English keyboard, grouped by language.
// Windows keyboards (Settings → Time & language → Language) still work for any language.
const SETS: { id: string; label: string; chars: string[] }[] = [
  { id: 'twi', label: 'Twi / Fante', chars: ['ɛ', 'Ɛ', 'ɔ', 'Ɔ', 'ŋ', 'Ŋ'] },
  { id: 'ewe', label: 'Ewe', chars: ['ɛ', 'Ɛ', 'ɔ', 'Ɔ', 'ɖ', 'Ɖ', 'ƒ', 'Ƒ', 'ɣ', 'Ɣ', 'ŋ', 'Ŋ', 'ʋ', 'Ʋ'] },
  { id: 'ga', label: 'Ga / Dangme', chars: ['ɛ', 'Ɛ', 'ɔ', 'Ɔ', 'ŋ', 'Ŋ'] },
  { id: 'yoruba', label: 'Yoruba', chars: ['ẹ', 'Ẹ', 'ọ', 'Ọ', 'ṣ', 'Ṣ', 'á', 'à', 'é', 'è', 'í', 'ì', 'ó', 'ò', 'ú', 'ù'] },
  { id: 'hausa', label: 'Hausa', chars: ['ɓ', 'Ɓ', 'ɗ', 'Ɗ', 'ƙ', 'Ƙ', 'ƴ', 'Ƴ'] },
  { id: 'french', label: 'French', chars: ['é', 'è', 'ê', 'à', 'â', 'ç', 'ô', 'û', 'ù', 'ï', 'ë', 'œ', 'É', 'À', 'Ç'] },
  { id: 'symbols', label: 'Symbols', chars: ['’', '“', '”', '–', '—', '…', '♪', '©'] }
];
const STORE_KEY = 'kvlog.charSet';

// Ctrl+E → ɛ, Ctrl+O → ɔ, Ctrl+N → ŋ; add Shift for capitals. Works in any language set.
const SHORTCUTS: Record<string, [string, string]> = { e: ['ɛ', 'Ɛ'], o: ['ɔ', 'Ɔ'], n: ['ŋ', 'Ŋ'] };

type Props = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'onChange'> & {
  value: string;
  onValueChange: (value: string) => void;
};

/** A lyrics box with one-click buttons and shortcuts for Twi and other African and European letters. */
export function LyricsTextarea({ value, onValueChange, onKeyDown, ...rest }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [setId, setSetId] = useState(() => localStorage.getItem(STORE_KEY) ?? 'twi');
  const set = SETS.find((s) => s.id === setId) ?? SETS[0];

  const insert = (text: string) => {
    const el = ref.current;
    if (!el) return;
    const start = el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? value.length;
    onValueChange(value.slice(0, start) + text + value.slice(end));
    const caret = start + text.length;
    requestAnimationFrame(() => {
      if (!ref.current) return;
      ref.current.focus();
      ref.current.setSelectionRange(caret, caret);
    });
  };

  const handleKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    onKeyDown?.(e);
    if (e.defaultPrevented || !e.ctrlKey || e.altKey || e.metaKey) return;
    const pair = SHORTCUTS[e.key.toLowerCase()];
    if (!pair) return;
    e.preventDefault();
    insert(e.shiftKey ? pair[1] : pair[0]);
  };

  return (
    <>
      <textarea ref={ref} {...rest} value={value} spellCheck={false} lang="mul"
        onChange={(e) => onValueChange(e.target.value)} onKeyDown={handleKey} />
      <div className="charbar" role="toolbar" aria-label="Insert special letters">
        <select className="input charbar-set" value={set.id} aria-label="Letters for language"
          onChange={(e) => { setSetId(e.target.value); localStorage.setItem(STORE_KEY, e.target.value); }}>
          {SETS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
        <div className="charbar-keys">
          {set.chars.map((c) => (
            <button key={c} type="button" className="charbar-key" title={`Insert ${c}`}
              onMouseDown={(e) => e.preventDefault()} onClick={() => insert(c)}>{c}</button>
          ))}
        </div>
        <span className="charbar-hint">Ctrl+E ɛ · Ctrl+O ɔ · Ctrl+N ŋ · add Shift for capitals</span>
      </div>
    </>
  );
}
