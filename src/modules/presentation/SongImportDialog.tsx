import { useEffect, useMemo, useState } from 'react';
import { FileText, FolderOpen, Loader2, Search, X } from 'lucide-react';
import { createItem } from '../../data/itemFactory';
import { errorMessage } from '../../services/desktopBridge';
import { DEFAULT_EXTRAS } from '../../../shared/extras';
import type { ImportedSong, SongImportMode } from '../../../shared/song-import';
import type { ServiceItem } from '../../types';

interface Props {
  library: ServiceItem[];
  onImport: (items: ServiceItem[]) => void;
  onClose: () => void;
}

const norm = (title: string) => title.toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N}]+/gu, '');
const SHOW_MAX = 1000;

const FORMATS = [
  ['Plain text', '.txt, one song per file. Lines like Title:, Author:, CCLI: and Key: at the top are read.'],
  ['OpenLyrics / OpenLP', '.xml (OpenLP: Tools → Export Song → OpenLyrics), or OpenLP\'s songs.sqlite'],
  ['EasyWorship 6 / 7', '.ewsx export, or Songs.db together with SongWords.db (choose both)'],
  ['ProPresenter', '.pro6, .pro5, .pro4 with sections; ProPresenter 7 .pro (words only)'],
  ['ChordPro', '.cho, .chordpro, .chopro (chords are kept for the stage display)'],
  ['Word', '.docx. Each Heading starts a new song, so one document can hold many'],
  ['PowerPoint', '.pptx, one song per file; each slide becomes a section']
];

export function SongImportDialog({ library, onImport, onClose }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [songs, setSongs] = useState<ImportedSong[] | null>(null);
  const [problems, setProblems] = useState<string[]>([]);
  const [checked, setChecked] = useState<boolean[]>([]);
  const [query, setQuery] = useState('');
  const [linesPerSlide, setLinesPerSlide] = useState(2);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [busy, onClose]);

  const existing = useMemo(() => new Set(library.filter((i) => i.kind === 'song').map((i) => norm(i.title))), [library]);
  const duplicate = useMemo(() => {
    if (!songs) return [];
    const seen = new Set<string>();
    return songs.map((s) => {
      const k = norm(s.title);
      const dup = existing.has(k) || seen.has(k);
      seen.add(k);
      return dup;
    });
  }, [songs, existing]);

  const pick = async (mode: SongImportMode) => {
    const bridge = window.kvlog;
    if (!bridge) return;
    setBusy(true);
    setError(null);
    try {
      const r = await bridge.importSongs(mode);
      if (r.canceled) return;
      if (!r.songs.length && !r.problems.length) {
        setError('No song files were found there.');
        return;
      }
      setSongs(r.songs);
      setProblems(r.problems);
      const seen = new Set<string>();
      setChecked(r.songs.map((s) => {
        const k = norm(s.title);
        const dup = existing.has(k) || seen.has(k);
        seen.add(k);
        return !dup;
      }));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const q = norm(query);
  const visible = (songs ?? []).map((s, i) => ({ s, i })).filter(({ s }) => !q || norm(s.title).includes(q));
  const count = checked.filter(Boolean).length;
  const dupCount = duplicate.filter(Boolean).length;
  const setAll = (value: boolean, onlyVisible = false) => {
    const ids = new Set(onlyVisible ? visible.map((v) => v.i) : (songs ?? []).map((_, i) => i));
    setChecked((c) => c.map((v, i) => (ids.has(i) ? value : v)));
  };

  const doImport = () => {
    if (!songs) return;
    const items = songs
      .filter((_, i) => checked[i])
      .map((s) =>
        createItem('song', {
          title: s.title.slice(0, 500),
          subtitle: s.subtitle.slice(0, 500),
          content: s.content,
          linesPerSlide,
          extra: { ...DEFAULT_EXTRAS, ccli: s.ccli, songKey: s.songKey, content2: s.content2, bilingual: s.content2 ? 'stacked' : 'off' }
        })
      );
    onImport(items);
  };

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <div className="modal modal-wide" role="dialog" aria-modal="true" aria-label="Import songs">
        <header className="modal-head">
          <h2>Import songs</h2>
          {songs && <span className="panel-meta">{songs.length} found · {count} selected</span>}
          <button type="button" className="icon-btn" aria-label="Close" disabled={busy} onClick={onClose}><X size={15} /></button>
        </header>

        {!songs ? (
          <div className="modal-body form-stack">
            <div className="inline-row">
              <button type="button" className="btn btn-primary" disabled={busy || !window.kvlog} onClick={() => void pick('files')}>
                {busy ? <Loader2 size={14} className="spin" aria-hidden="true" /> : <FileText size={14} aria-hidden="true" />}
                Choose files…
              </button>
              <button type="button" className="btn" disabled={busy || !window.kvlog} onClick={() => void pick('folder')}>
                <FolderOpen size={14} aria-hidden="true" />
                Import a whole folder…
              </button>
              {busy && <span className="help-inline">Reading songs… large libraries can take a minute.</span>}
            </div>
            {error && <p className="bad-text" role="alert">{error}</p>}
            <dl className="kv import-formats">
              {FORMATS.map(([name, desc]) => (
                <div className="kv-row" key={name}><dt>{name}</dt><dd>{desc}</dd></div>
              ))}
            </dl>
            <p className="help">You can check every song before anything is added. Songs already in your library are not selected.</p>
          </div>
        ) : (
          <>
            <div className="modal-tools">
              <label className="search">
                <Search size={14} aria-hidden="true" />
                <input value={query} placeholder="Find a song" aria-label="Find a song" onChange={(e) => setQuery(e.target.value)} />
              </label>
              <button type="button" className="btn btn-sm" onClick={() => setAll(true, !!q)}>Select all{q ? ' shown' : ''}</button>
              <button type="button" className="btn btn-sm" onClick={() => setAll(false, !!q)}>Select none</button>
              {dupCount > 0 && <span className="help-inline">{dupCount} already in your library (not selected)</span>}
            </div>
            <div className="modal-body import-list">
              {visible.slice(0, SHOW_MAX).map(({ s, i }) => (
                <label key={i} className="import-row">
                  <input type="checkbox" checked={checked[i] ?? false} onChange={(e) => setChecked((c) => c.map((v, j) => (j === i ? e.target.checked : v)))} />
                  <span className="import-title">{s.title}</span>
                  <span className="import-meta">
                    {duplicate[i] && <span className="tag tag-inline">In library</span>}
                    {s.content2 && <span className="tag tag-inline">2 languages</span>}
                    {/\[[A-G][#b]?[^\]\s]*\]/.test(s.content) && <span className="tag tag-inline">Chords</span>}
                    <span>{s.format} · {s.source}</span>
                  </span>
                </label>
              ))}
              {visible.length > SHOW_MAX && <p className="help">Showing the first {SHOW_MAX} of {visible.length}. Use Find to see others; every selected song is imported.</p>}
              {problems.length > 0 && (
                <details className="import-problems">
                  <summary>{problems.length} file{problems.length === 1 ? '' : 's'} could not be read</summary>
                  <ul>{problems.map((p, i) => <li key={i}>{p}</li>)}</ul>
                </details>
              )}
            </div>
            <footer className="modal-foot">
              <label className="inline-row">
                <span className="help-inline">Lines per slide</span>
                <select className="input" value={linesPerSlide} onChange={(e) => setLinesPerSlide(Number(e.target.value))}>
                  {[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </label>
              <button type="button" className="btn" onClick={() => { setSongs(null); setProblems([]); }}>Choose other files</button>
              <button type="button" className="btn btn-primary" disabled={count === 0} onClick={doImport}>
                Add {count} song{count === 1 ? '' : 's'} to the library
              </button>
            </footer>
          </>
        )}
      </div>
    </div>
  );
}
