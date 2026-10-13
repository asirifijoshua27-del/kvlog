import { useEffect, useState } from 'react';
import { FileUp, ImagePlus, Loader2, Trash2 } from 'lucide-react';
import { BACKGROUNDS } from '../../data/backgrounds';
import { isTextKind, KIND_META } from '../../data/kinds';
import { countSections, MAX_LINES_PER_SLIDE, MIN_LINES_PER_SLIDE } from '../../slides/buildSlides';
import { MediaThumb } from '../../components/MediaThumb';
import { deletePages, describeImport, importMediaFiles, importPresentationFile } from '../../services/mediaImport';
import { errorMessage } from '../../services/desktopBridge';
import { mediaUrl } from '../../../shared/media';
import type { EditableItemFields, MediaItem, ServiceItem } from '../../types';
import type { Transition } from '../../../shared/data-types';
import { ItemExtrasFields } from './ItemExtrasFields';

interface ItemEditorProps {
  item: ServiceItem;
  isLive: boolean;
  autoFocusTitle: boolean;
  onChange: (changes: Partial<EditableItemFields>) => void;
  onDelete: () => void;
  /** Pictures and videos from the Media Library. */
  media: MediaItem[];
  missingMedia: ReadonlySet<string>;
  /** Adds newly imported pictures/videos to the Media Library. */
  onAddMedia: (items: MediaItem[]) => void;
  obsScenes: string[];
  defaultScene: string | null;
  obsAuto: boolean;
}

const LINE_OPTIONS = Array.from(
  { length: MAX_LINES_PER_SLIDE - MIN_LINES_PER_SLIDE + 1 },
  (_, i) => MIN_LINES_PER_SLIDE + i
);

const TRANSITIONS: { id: Transition; label: string }[] = [
  { id: 'fade', label: 'Fade' },
  { id: 'cut', label: 'Cut' }
];

type Message = { tone: 'ok' | 'error' | 'busy'; text: string } | null;

export function ItemEditor({ item, isLive, autoFocusTitle, onChange, onDelete, media, missingMedia, onAddMedia, obsScenes, defaultScene, obsAuto }: ItemEditorProps) {
  const meta = KIND_META[item.kind];
  const Icon = meta.icon;
  const textKind = isTextKind(item.kind);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [message, setMessage] = useState<Message>(null);
  const busy = message?.tone === 'busy';

  // The delete button needs a second click within 3 seconds.
  useEffect(() => {
    if (!confirmingDelete) return;
    const timer = window.setTimeout(() => setConfirmingDelete(false), 3000);
    return () => window.clearTimeout(timer);
  }, [confirmingDelete]);

  const slideCount = item.slides.length;
  const sections = item.kind === 'song' ? countSections(item.slides) : 0;
  const summary =
    `${slideCount} slide${slideCount === 1 ? '' : 's'}` +
    (item.kind === 'song' && sections > 0 ? ` · ${sections} section${sections === 1 ? '' : 's'}` : '');

  const isDefaultTitle = item.title.trim() === '' || item.title === meta.defaultTitle;

  const onImportMedia = async () => {
    setMessage({ tone: 'busy', text: 'Copying files into KVLOG…' });
    try {
      const result = await importMediaFiles();
      if (result.items.length) onAddMedia(result.items);
      // A Media item with nothing chosen yet uses the first new file.
      if (item.kind === 'media' && result.items.length && !item.background.startsWith('media:')) {
        const first = result.items[0];
        onChange({ background: `media:${first.id}`, ...(isDefaultTitle ? { title: first.name } : {}) });
      }
      const described = describeImport(result);
      setMessage(described);
    } catch (error) {
      setMessage({ tone: 'error', text: errorMessage(error) });
    }
  };

  const onImportPresentation = async () => {
    const oldPages = item.pages;
    try {
      const result = await importPresentationFile((text) => setMessage({ tone: 'busy', text }));
      if (!result) {
        setMessage(null);
        return;
      }
      onChange({ pages: result.pages, ...(isDefaultTitle ? { title: result.name } : {}) });
      deletePages(oldPages);
      setMessage({ tone: 'ok', text: `Imported ${result.pages.length} slide${result.pages.length === 1 ? '' : 's'}.` });
    } catch (error) {
      setMessage({ tone: 'error', text: errorMessage(error) });
    }
  };

  const pick = (m: MediaItem) => onChange({ background: `media:${m.id}`, ...(isDefaultTitle ? { title: m.name } : {}) });

  const status = message && (
    <span className={message.tone === 'error' ? 'bad-text' : message.tone === 'ok' ? 'ok-text' : 'help-inline'} role={message.tone === 'error' ? 'alert' : 'status'}>
      {message.tone === 'busy' && <Loader2 size={13} className="spin" aria-hidden="true" />}
      {message.text}
    </span>
  );

  const transitionField = (
    <div className="field">
      <span className="field-label">Transition</span>
      <div className="segmented" role="radiogroup" aria-label="Transition">
        {TRANSITIONS.map((tr) => (
          <button
            key={tr.id}
            type="button"
            role="radio"
            aria-checked={item.transition === tr.id}
            className={item.transition === tr.id ? 'is-active' : undefined}
            title={tr.id === 'fade' ? 'Slides blend into each other' : 'Slides change instantly'}
            onClick={() => onChange({ transition: tr.id })}
          >
            {tr.label}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <section className="panel editor-panel" aria-label={`${meta.label} editor`}>
      <header className="panel-head">
        <Icon size={14} aria-hidden="true" />
        <h2>{meta.label}</h2>
        {isLive && <span className="tag tag-live tag-inline">Live</span>}
        <span className="panel-meta">Changes save automatically</span>
        <div className="panel-actions">
          <button
            type="button"
            className={`btn btn-sm${confirmingDelete ? ' btn-danger' : ''}`}
            onClick={() => (confirmingDelete ? onDelete() : setConfirmingDelete(true))}
          >
            <Trash2 size={13} aria-hidden="true" />
            {confirmingDelete ? 'Click again: delete from library and all services' : 'Delete'}
          </button>
        </div>
      </header>

      <div className="panel-body editor-body">
        <div className="field-row">
          <label className="field">
            <span className="field-label">{meta.titleLabel}</span>
            <input
              className="input"
              value={item.title}
              autoFocus={autoFocusTitle}
              onFocus={(e) => autoFocusTitle && e.currentTarget.select()}
              onChange={(e) => onChange({ title: e.target.value })}
            />
          </label>
          <label className="field">
            <span className="field-label">{meta.subtitleLabel}</span>
            <input className="input" value={item.subtitle} onChange={(e) => onChange({ subtitle: e.target.value })} />
          </label>
        </div>

        {item.kind === 'media' && (
          <>
            <div className="field">
              <span className="field-label">
                Picture or video
                <span className="field-hint">From the Media Library</span>
              </span>
              {media.length === 0 ? (
                <p className="help">The Media Library is empty. Add pictures or videos to choose one.</p>
              ) : (
                <div className="media-pick-grid" role="radiogroup" aria-label="Picture or video">
                  {media.map((m) => {
                    const active = item.background === `media:${m.id}`;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        className={`media-pick${active ? ' is-active' : ''}`}
                        title={m.name}
                        onClick={() => pick(m)}
                      >
                        <span className="media-thumb"><MediaThumb item={m} missing={missingMedia.has(m.id)} /></span>
                        <span className="media-pick-name">{m.name}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="form-actions">
              <button type="button" className="btn" onClick={() => void onImportMedia()} disabled={busy || !window.kvlog}>
                <ImagePlus size={14} aria-hidden="true" />
                Add pictures or videos
              </button>
              {status}
            </div>
            <div className="field-row">{transitionField}</div>
            <p className="help">{meta.help}</p>
          </>
        )}

        {item.kind === 'slides' && (
          <p className="help">
            {item.deck.length} slide{item.deck.length === 1 ? '' : 's'}. {meta.help} Open <strong>Slide Editor</strong> in the sidebar to add and design slides.
          </p>
        )}

        {item.kind === 'presentation' && (
          <>
            <div className="field">
              <span className="field-label">
                Slides
                <span className="field-hint">{item.pages.length ? summary : 'None yet'}</span>
              </span>
              <div className="form-actions">
                <button type="button" className={`btn${item.pages.length ? '' : ' btn-primary'}`} onClick={() => void onImportPresentation()} disabled={busy || !window.kvlog}>
                  <FileUp size={14} aria-hidden="true" />
                  {item.pages.length ? 'Replace with another file' : 'Import PowerPoint or PDF'}
                </button>
                {status}
              </div>
              {item.pages.length > 0 && (
                <div className="page-strip">
                  {item.pages.slice(0, 60).map((p, i) => (
                    <img key={p} src={mediaUrl(p)} alt={`Slide ${i + 1}`} draggable={false} loading="lazy" />
                  ))}
                  {item.pages.length > 60 && <span className="help-inline">+{item.pages.length - 60} more</span>}
                </div>
              )}
            </div>
            <div className="field-row">{transitionField}</div>
            <p className="help">
              {meta.help} PowerPoint files need Microsoft PowerPoint on this PC. Without it, export the file as PDF (File → Export) and import the PDF.
            </p>
          </>
        )}

        {textKind && (
          <>
            <div className="field-row">
              <div className="field">
                <span className="field-label">Background</span>
                <div className="swatches" role="radiogroup" aria-label="Background">
                  {BACKGROUNDS.map((bg) => (
                    <button
                      key={bg.id}
                      type="button"
                      role="radio"
                      aria-checked={item.background === bg.id}
                      aria-label={bg.label}
                      title={bg.label}
                      className={`swatch-btn${item.background === bg.id ? ' is-active' : ''}`}
                      onClick={() => onChange({ background: bg.id })}
                    >
                      <span className={`swatch slide-bg-${bg.id}`} />
                    </button>
                  ))}
                  {media.map((m) => {
                    const ref = `media:${m.id}` as const;
                    const missing = missingMedia.has(m.id);
                    const label = `${m.name}${m.kind === 'video' ? ' (moving background)' : ''}`;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        role="radio"
                        aria-checked={item.background === ref}
                        aria-label={label}
                        title={missing ? `${m.name} (file missing)` : label}
                        className={`swatch-btn${item.background === ref ? ' is-active' : ''}${missing ? ' is-missing' : ''}`}
                        onClick={() => onChange({ background: ref })}
                      >
                        {missing ? (
                          <span className="swatch swatch-missing">!</span>
                        ) : m.kind === 'video' ? (
                          <video className="swatch swatch-img" src={`${mediaUrl(m.fileName)}#t=0.5`} muted preload="metadata" />
                        ) : (
                          <img className="swatch swatch-img" src={mediaUrl(m.fileName)} alt="" draggable={false} />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
              {item.kind === 'song' && (
                <div className="field">
                  <span className="field-label">Lines per slide</span>
                  <div className="segmented" role="radiogroup" aria-label="Lines per slide">
                    {LINE_OPTIONS.map((n) => (
                      <button
                        key={n}
                        type="button"
                        role="radio"
                        aria-checked={item.linesPerSlide === n}
                        className={item.linesPerSlide === n ? 'is-active' : undefined}
                        onClick={() => onChange({ linesPerSlide: n })}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {transitionField}
            </div>

            <label className="field field-grow">
              <span className="field-label">
                {meta.contentLabel}
                <span className="field-hint">{summary}</span>
              </span>
              <textarea
                className="textarea textarea-content"
                value={item.content}
                placeholder={meta.placeholder}
                onChange={(e) => onChange({ content: e.target.value })}
              />
            </label>
            <p className="help">{meta.help}{item.kind === 'song' && ' Chords can be typed in the lyrics, e.g. [G]Amazing [C]grace. Only the stage display shows them.'}</p>
          </>
        )}

        <ItemExtrasFields item={item} onChange={onChange} obsScenes={obsScenes} defaultScene={defaultScene} obsAuto={obsAuto} />

        <label className="field">
          <span className="field-label">Notes</span>
          <textarea
            className="textarea"
            rows={3}
            value={item.notes}
            placeholder="Private notes for the team. Never shown to the audience; shown on the stage display."
            onChange={(e) => onChange({ notes: e.target.value })}
          />
        </label>
      </div>
    </section>
  );
}
