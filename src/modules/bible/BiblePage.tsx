import { useEffect, useMemo, useRef, useState, type Dispatch, type FormEvent, type MouseEvent } from 'react';
import { BookOpen, Check, Download, FileUp, Library, ListPlus, Loader2, Play, Search, Settings2, Trash2, X } from 'lucide-react';
import { EmptyState, Panel } from '../../components/Panel';
import { ConfirmButton } from '../../components/ConfirmButton';
import { SlideView } from '../../components/SlideView';
import { createItem } from '../../data/itemFactory';
import { buildScriptureContent, loadChapter, loadPassage, useBibles, type BibleLibrary, type PassageVerse } from '../../services/bible';
import { getActivePlan, type PresentationAction, type PresentationState } from '../../state/presentation';
import { BIBLE_DOWNLOADS, formatReference, parseReference, type BibleInfo, type BibleRef } from '../../../shared/bible';

/** The library item that "Show live" reuses, so quick look-ups do not fill the library. */
const QUICK_ID = 'bible-live';
const PER_SLIDE_OPTIONS = [1, 2, 3, 4];

function usePersisted<T extends string | number | boolean>(key: string, initial: T): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return initial;
      const parsed: unknown = JSON.parse(raw);
      return typeof parsed === typeof initial ? (parsed as T) : initial;
    } catch {
      return initial;
    }
  });
  const set = (next: T) => {
    setValue(next);
    try {
      localStorage.setItem(key, JSON.stringify(next));
    } catch {
      // Not saved; the choice still applies until KVLOG closes.
    }
  };
  return [value, set];
}

interface BiblePageProps {
  state: PresentationState;
  dispatch: Dispatch<PresentationAction>;
}

export function BiblePage({ state, dispatch }: BiblePageProps) {
  const lib = useBibles();
  const bibles = lib.bibles ?? [];
  const [manageOpen, setManageOpen] = useState(false);
  const [primaryId, setPrimaryId] = usePersisted<string>('kvlog.bible.primary', '');
  const [secondaryId, setSecondaryId] = usePersisted<string>('kvlog.bible.secondary', '');
  const [perSlide, setPerSlide] = usePersisted<number>('kvlog.bible.perSlide', 2);
  const [numbers, setNumbers] = usePersisted<boolean>('kvlog.bible.verseNumbers', true);
  const [ref, setRef] = useState<BibleRef>({ book: 43, chapter: 3, verse: 16, endChapter: 3, endVerse: 16 });
  const [query, setQuery] = useState('');
  const [queryError, setQueryError] = useState<string | null>(null);
  const [chapterText, setChapterText] = useState<{ key: string; primary: string[]; secondary: string[] | null }>({ key: '', primary: [], secondary: null });
  const [passage, setPassage] = useState<{ key: string; primary: PassageVerse[]; secondary: PassageVerse[] | null }>({ key: '', primary: [], secondary: null });
  const [pendingLive, setPendingLive] = useState(false);
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const versesRef = useRef<HTMLDivElement>(null);

  const primary = bibles.find((b) => b.id === primaryId) ?? bibles[0] ?? null;
  const secondary = secondaryId && secondaryId !== primary?.id ? bibles.find((b) => b.id === secondaryId) ?? null : null;
  const book = primary?.books.find((b) => b.n === ref.book) ?? null;
  const localNames = useMemo(() => new Map(primary?.books.map((b) => [b.n, b.name]) ?? []), [primary]);
  const passageKey = JSON.stringify([primary?.id, secondary?.id, ref]);
  const chapterKey = JSON.stringify([primary?.id, secondary?.id, ref.book, ref.chapter]);

  // If the chosen book is not in this Bible (e.g. a New Testament only file), go to its first book.
  useEffect(() => {
    if (primary && !book && primary.books[0]) setRef({ book: primary.books[0].n, chapter: 1, verse: null, endChapter: 1, endVerse: null });
  }, [primary, book]);

  useEffect(() => {
    if (!primary) return;
    let active = true;
    Promise.all([loadChapter(primary.id, ref.book, ref.chapter), secondary ? loadChapter(secondary.id, ref.book, ref.chapter) : Promise.resolve(null)])
      .then(([p, s]) => active && setChapterText({ key: chapterKey, primary: p, secondary: s }))
      .catch((e: unknown) => active && setMessage({ tone: 'error', text: String((e as Error).message ?? e) }));
    return () => {
      active = false;
    };
  }, [primary, secondary, ref.book, ref.chapter, chapterKey]);

  useEffect(() => {
    if (!primary) return;
    let active = true;
    Promise.all([loadPassage(primary, ref), secondary ? loadPassage(secondary, ref) : Promise.resolve(null)])
      .then(([p, s]) => active && setPassage({ key: passageKey, primary: p, secondary: s }))
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [primary, secondary, ref, passageKey]);

  // Keep the first selected verse in view.
  useEffect(() => {
    const box = versesRef.current;
    if (!box || ref.verse === null || chapterText.key !== chapterKey) return;
    const el = box.querySelector<HTMLElement>(`[data-verse="${ref.verse}"]`);
    if (!el) return;
    const top = el.offsetTop - box.offsetTop;
    if (top < box.scrollTop || top > box.scrollTop + box.clientHeight - 60) box.scrollTop = Math.max(0, top - 40);
  }, [ref.verse, chapterText.key, chapterKey]);

  const refLabel = book ? formatReference(ref, book.name) : '';
  const subtitle = [primary?.abbrev, secondary?.abbrev].filter(Boolean).join(' | ');
  const ready = passage.key === passageKey && passage.primary.length > 0;
  const content = ready ? buildScriptureContent(passage.primary, passage.secondary, perSlide, numbers) : '';
  const preview = useMemo(() => createItem('scripture', { title: refLabel, subtitle, content }, 'bible-preview'), [refLabel, subtitle, content]);

  const quick = state.library.find((i) => i.id === QUICK_ID);
  const quickIsThis = !!quick && quick.title === refLabel && quick.subtitle === subtitle && quick.content === content;
  const liveIndex = !state.blackout && state.live?.itemId === QUICK_ID && quickIsThis ? state.live.slideIndex : null;

  const showLive = (slideIndex = 0) => {
    if (!ready) return;
    const fields = { title: refLabel, subtitle, content };
    if (quick) dispatch({ type: 'updateItem', itemId: QUICK_ID, changes: fields });
    else dispatch({ type: 'createItem', item: createItem('scripture', fields, QUICK_ID), planId: null });
    dispatch({ type: 'goLive', itemId: QUICK_ID, slideIndex });
    setMessage(null);
  };

  // Double-click / Enter: go live as soon as the passage has loaded.
  useEffect(() => {
    if (pendingLive && ready) {
      setPendingLive(false);
      showLive(0);
    }
  });

  const addToService = () => {
    if (!ready) return;
    const plan = getActivePlan(state);
    const item = createItem('scripture', { title: refLabel, subtitle, content });
    dispatch({ type: 'createItem', item, planId: plan?.id ?? null });
    setMessage({ tone: 'ok', text: plan ? `Added ${refLabel} to the end of “${plan.name.trim() || 'Untitled service'}”.` : `Added ${refLabel} to the library. Open a service to add it there.` });
  };

  const clampRef = (r: BibleRef): BibleRef | null => {
    const b = primary?.books.find((x) => x.n === r.book);
    if (!b) return null;
    const chapters = b.verses.length;
    if (r.chapter > chapters) return null;
    const endChapter = Math.min(r.endChapter, chapters);
    const maxVerse = b.verses[r.chapter - 1] ?? 0;
    if (r.verse !== null && r.verse > maxVerse) return null;
    const endMax = b.verses[endChapter - 1] ?? 0;
    return { ...r, endChapter, endVerse: r.endVerse === null ? null : Math.min(r.endVerse, endMax) };
  };

  const onFind = (event: FormEvent) => {
    event.preventDefault();
    const parsed = parseReference(query, localNames);
    const clamped = parsed ? clampRef(parsed) : null;
    if (!clamped) {
      setQueryError(parsed ? 'That chapter or verse is not in this Bible.' : 'Type a book and chapter, e.g. John 3:16-18 or Ps 23.');
      return;
    }
    setQueryError(null);
    // Pressing Enter again on the same passage sends it live.
    if (JSON.stringify(clamped) === JSON.stringify(ref)) {
      setPendingLive(true);
      return;
    }
    setRef(clamped);
  };

  const onVerse = (verse: number, event: MouseEvent) => {
    const anchor = ref.verse !== null && ref.chapter === ref.endChapter ? ref.verse : verse;
    const [from, to] = event.shiftKey ? [Math.min(anchor, verse), Math.max(anchor, verse)] : [verse, verse];
    setRef({ book: ref.book, chapter: ref.chapter, verse: from, endChapter: ref.chapter, endVerse: to });
  };

  const isSelected = (verse: number) => {
    if (ref.verse === null) return false;
    if (ref.chapter === ref.endChapter) return verse >= ref.verse && verse <= (ref.endVerse ?? ref.verse);
    return verse >= ref.verse;
  };

  if (lib.bibles === null) {
    return (
      <div className="bible bible-loading" role="status">
        <Loader2 size={18} className="spin" aria-hidden="true" /> Loading Bibles…
      </div>
    );
  }

  if (bibles.length === 0 || manageOpen) {
    return (
      <div className="bible">
        <BibleManager lib={lib} onClose={bibles.length ? () => setManageOpen(false) : null} />
      </div>
    );
  }

  const ot = primary?.books.filter((b) => b.n <= 39) ?? [];
  const nt = primary?.books.filter((b) => b.n >= 40) ?? [];

  return (
    <div className="bible">
      <form className="bible-bar" onSubmit={onFind}>
        <div className="bible-ref">
          <label className="search bible-search">
            <Search size={15} aria-hidden="true" />
            <input
              value={query}
              autoFocus
              placeholder="Type a reference: John 3:16-18, Ps 23, 1 Cor 13:4-7"
              aria-label="Bible reference"
              onChange={(e) => {
                setQuery(e.target.value);
                setQueryError(null);
              }}
            />
          </label>
          <button type="submit" className="btn">Find</button>
        </div>
        <label className="bible-select">
          <span>Bible</span>
          <select className="input" value={primary?.id ?? ''} onChange={(e) => setPrimaryId(e.target.value)}>
            {bibles.map((b) => <option key={b.id} value={b.id}>{b.abbrev} · {b.name}</option>)}
          </select>
        </label>
        <label className="bible-select">
          <span>Side by side</span>
          <select className="input" value={secondary?.id ?? ''} onChange={(e) => setSecondaryId(e.target.value)}>
            <option value="">None</option>
            {bibles.filter((b) => b.id !== primary?.id).map((b) => <option key={b.id} value={b.id}>{b.abbrev}</option>)}
          </select>
        </label>
        <div className="bible-select">
          <span>Verses per slide</span>
          <div className="segmented segmented-sm" role="radiogroup" aria-label="Verses per slide">
            {PER_SLIDE_OPTIONS.map((n) => (
              <button key={n} type="button" role="radio" aria-checked={perSlide === n} className={perSlide === n ? 'is-active' : undefined} onClick={() => setPerSlide(n)}>
                {n}
              </button>
            ))}
          </div>
        </div>
        <label className="check">
          <input type="checkbox" checked={numbers} onChange={(e) => setNumbers(e.target.checked)} />
          <span>Verse numbers</span>
        </label>
        <button type="button" className="btn btn-sm bible-manage-btn" onClick={() => setManageOpen(true)}>
          <Settings2 size={13} aria-hidden="true" />
          Translations
        </button>
        {queryError && <p className="bad-text bible-bar-note" role="alert">{queryError}</p>}
      </form>

      <div className="bible-main">
        <Panel title="Books" icon={Library} className="bible-books-panel">
          <div className="bible-books">
            {[['Old Testament', ot], ['New Testament', nt]].map(([label, list]) =>
              (list as BibleInfo['books']).length ? (
                <div key={label as string}>
                  <div className="bible-group">{label as string}</div>
                  {(list as BibleInfo['books']).map((b) => (
                    <button
                      key={b.n}
                      type="button"
                      className={`bible-book${b.n === ref.book ? ' is-active' : ''}`}
                      onClick={() => setRef({ book: b.n, chapter: 1, verse: null, endChapter: 1, endVerse: null })}
                    >
                      {b.name}
                    </button>
                  ))}
                </div>
              ) : null
            )}
          </div>
        </Panel>

        <Panel title={book ? `${book.name} ${ref.chapter}` : 'Chapter'} icon={BookOpen} meta={subtitle} className="bible-text-panel">
          <div className="bible-chapters" role="group" aria-label="Chapters">
            {book?.verses.map((_, i) => (
              <button
                key={i}
                type="button"
                className={`bible-ch${i + 1 === ref.chapter ? ' is-active' : ''}`}
                onClick={() => setRef({ book: ref.book, chapter: i + 1, verse: null, endChapter: i + 1, endVerse: null })}
              >
                {i + 1}
              </button>
            ))}
          </div>
          <div className="bible-verses" ref={versesRef}>
            {chapterText.primary.map((text, i) => {
              const verse = i + 1;
              const second = chapterText.secondary?.[i];
              return (
                <button
                  key={verse}
                  type="button"
                  data-verse={verse}
                  className={`bible-verse${chapterText.secondary ? ' has-2' : ''}${isSelected(verse) ? ' is-selected' : ''}`}
                  onClick={(e) => onVerse(verse, e)}
                  onDoubleClick={() => setPendingLive(true)}
                  title="Click to choose · Shift+click to choose several · Double-click to show live"
                >
                  <span className="bible-vn">{verse}</span>
                  <span>{text || '—'}</span>
                  {chapterText.secondary && <span className="bible-second">{second || '—'}</span>}
                </button>
              );
            })}
          </div>
        </Panel>

        <Panel
          title={refLabel || 'Passage'}
          icon={Play}
          meta={ready ? `${preview.slides.length} slide${preview.slides.length === 1 ? '' : 's'}` : ''}
          className="bible-preview-panel"
          footer="Enter twice or double-click a verse to show it live. Then use ← → as usual."
        >
          <div className="bible-actions">
            <button type="button" className="btn btn-primary" disabled={!ready} onClick={() => showLive(0)}>
              <Play size={14} aria-hidden="true" />
              {liveIndex !== null ? 'Showing live' : 'Show live'}
            </button>
            <button type="button" className="btn" disabled={!ready} onClick={addToService}>
              <ListPlus size={14} aria-hidden="true" />
              Add to service
            </button>
          </div>
          {message && (
            <div className={`bible-msg ${message.tone === 'ok' ? 'ok-text' : 'bad-text'}`} role="status">
              <span>{message.text}</span>
              <button type="button" className="out-note-close" aria-label="Close message" onClick={() => setMessage(null)}><X size={13} /></button>
            </div>
          )}
          {!ready ? (
            <EmptyState icon={BookOpen} title="Choose a passage">Type a reference above, or pick a book, chapter and verse.</EmptyState>
          ) : (
            <div className="slide-grid bible-slides">
              {preview.slides.map((slide, i) => (
                <button
                  key={slide.id}
                  type="button"
                  className={`slide-thumb${liveIndex === i ? ' is-live' : ''}`}
                  onClick={() => showLive(i)}
                  aria-label={`Show slide ${i + 1} live`}
                >
                  <SlideView item={preview} slide={slide} />
                  <span className="slide-thumb-meta">
                    <span className="slide-thumb-index">{i + 1}</span>
                    {liveIndex === i && <span className="tag tag-live">Live</span>}
                  </span>
                </button>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}

function BibleManager({ lib, onClose }: { lib: BibleLibrary; onClose: (() => void) | null }) {
  const bibles = lib.bibles ?? [];
  const installed = new Set(bibles.map((b) => b.id));
  const available = BIBLE_DOWNLOADS.filter((d) => !installed.has(d.key));

  return (
    <div className="page bible-manage">
      <div className="page-inner">
        <header className="page-header">
          <div className="page-icon" aria-hidden="true"><BookOpen size={20} strokeWidth={1.75} /></div>
          <div>
            <h2>Bible translations</h2>
            <p>Bibles are stored on this computer, so they work without internet during the service.</p>
          </div>
          {onClose && (
            <div className="page-header-actions">
              <button type="button" className="btn" onClick={onClose}><Check size={14} aria-hidden="true" />Done</button>
            </div>
          )}
        </header>

        {lib.error && (
          <div className="notice notice-error" role="alert">
            <span>{lib.error}</span>
            <button type="button" className="out-note-close" aria-label="Close message" onClick={lib.clearError}><X size={13} /></button>
          </div>
        )}

        {bibles.length > 0 && (
          <section className="card">
            <header className="card-head"><h3>On this computer</h3></header>
            <div className="card-body bible-rows">
              {bibles.map((b) => <InstalledRow key={b.id} bible={b} lib={lib} />)}
            </div>
          </section>
        )}

        <section className="card">
          <header className="card-head"><h3>Download (free, public domain)</h3><span className="panel-meta">Needs internet once</span></header>
          <div className="card-body bible-rows">
            {available.length === 0 && <p className="help">All free translations are installed.</p>}
            {available.map((d) => (
              <div key={d.key} className="bible-row">
                <span className="bible-abbrev">{d.abbrev}</span>
                <span className="bible-row-name">{d.name}<span className="media-sub"> · {d.size}</span></span>
                <button type="button" className="btn btn-sm" disabled={lib.busy !== null} onClick={() => void lib.download(d.key)}>
                  {lib.busy === d.key ? <Loader2 size={13} className="spin" aria-hidden="true" /> : <Download size={13} aria-hidden="true" />}
                  {lib.busy === d.key ? 'Downloading…' : 'Download'}
                </button>
              </div>
            ))}
          </div>
        </section>

        <section className="card">
          <header className="card-head"><h3>Import a Bible file</h3></header>
          <div className="card-body">
            <div className="form-actions">
              <button type="button" className="btn" disabled={lib.busy !== null} onClick={() => void lib.importFile()}>
                {lib.busy === 'import' ? <Loader2 size={14} className="spin" aria-hidden="true" /> : <FileUp size={14} aria-hidden="true" />}
                {lib.busy === 'import' ? 'Importing…' : 'Choose file…'}
              </button>
            </div>
            <p className="help help-gap">
              KVLOG reads Zefania XML, OSIS XML and common JSON Bible files. NIV, NKJV, ESV and the Twi Bible are copyrighted:
              import them only if your church has permission from the publisher (for Twi, the Bible Society of Ghana). After importing,
              give the translation a short name such as “Twi” above.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}

function InstalledRow({ bible, lib }: { bible: BibleInfo; lib: BibleLibrary }) {
  const [abbrev, setAbbrev] = useState(bible.abbrev);
  const [name, setName] = useState(bible.name);
  const dirty = abbrev.trim() !== bible.abbrev || name.trim() !== bible.name;
  const verses = bible.books.reduce((t, b) => t + b.verses.reduce((x, y) => x + y, 0), 0);

  return (
    <div className="bible-row">
      <input className="input bible-abbrev-input" value={abbrev} maxLength={12} aria-label="Short name" onChange={(e) => setAbbrev(e.target.value)} />
      <span className="bible-row-name">
        <input className="input" value={name} maxLength={120} aria-label="Full name" onChange={(e) => setName(e.target.value)} />
        <span className="media-sub">{bible.books.length} books · {verses.toLocaleString()} verses · {bible.source}</span>
      </span>
      {dirty && (
        <button type="button" className="btn btn-sm btn-primary" disabled={!abbrev.trim() || lib.busy !== null} onClick={() => void lib.rename(bible.id, abbrev, name)}>
          Save
        </button>
      )}
      <ConfirmButton
        className="btn btn-sm"
        label={<><Trash2 size={13} aria-hidden="true" />Delete</>}
        confirmLabel="Click again to delete"
        disabled={lib.busy !== null}
        onConfirm={() => void lib.remove(bible.id)}
      />
    </div>
  );
}
