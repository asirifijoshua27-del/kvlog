import { useState, type Dispatch } from 'react';
import { ImagePlus, Images, Info, ListPlus, RefreshCw, Trash2 } from 'lucide-react';
import type { ModuleMeta } from '../registry';
import { ConfirmButton } from '../../components/ConfirmButton';
import { EmptyState } from '../../components/Panel';
import { MediaThumb } from '../../components/MediaThumb';
import { errorMessage } from '../../services/desktopBridge';
import { describeImport, importMediaFiles } from '../../services/mediaImport';
import { createItem } from '../../data/itemFactory';
import type { MediaStatus } from '../../state/useMediaStatus';
import { getActivePlan, type PresentationAction, type PresentationState } from '../../state/presentation';
import type { MediaItem } from '../../types';

interface MediaLibraryProps {
  meta: ModuleMeta;
  state: PresentationState;
  dispatch: Dispatch<PresentationAction>;
  mediaStatus: MediaStatus;
}

export function MediaLibrary({ meta, state, dispatch, mediaStatus }: MediaLibraryProps) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const Icon = meta.icon;
  const available = !!window.kvlog;
  const plan = getActivePlan(state);
  const planName = plan ? plan.name.trim() || 'Untitled service' : null;

  const usage = (mediaId: string) => state.library.filter((item) => item.background === `media:${mediaId}`).length;

  const onImport = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const result = await importMediaFiles();
      if (result.items.length) dispatch({ type: 'addMedia', items: result.items });
      setMessage(describeImport(result));
    } catch (error) {
      setMessage({ tone: 'error', text: errorMessage(error) });
    } finally {
      setBusy(false);
    }
  };

  const onAddToService = (m: MediaItem) => {
    const item = createItem('media', { title: m.name, background: `media:${m.id}` });
    dispatch({ type: 'createItem', item, planId: plan?.id ?? null });
    setMessage({ tone: 'ok', text: planName ? `Added “${m.name}” to the end of “${planName}”.` : `Added “${m.name}” to the library. Open a service to use it live.` });
  };

  const onRemove = async (mediaId: string, fileName: string) => {
    dispatch({ type: 'removeMedia', mediaId });
    try {
      await window.kvlog?.deleteMedia(fileName);
    } catch (error) {
      setMessage({ tone: 'error', text: `Removed from the library, but the file could not be deleted: ${errorMessage(error)}` });
    }
  };

  return (
    <div className="page">
      <div className="page-inner page-wide">
        <header className="page-header">
          <div className="page-icon" aria-hidden="true">
            <Icon size={20} strokeWidth={1.75} />
          </div>
          <div>
            <h2>{meta.label}</h2>
            <p>Pictures and videos for the service, and backgrounds for songs. Files are copied into KVLOG, so moving the original does not break anything.</p>
          </div>
          <div className="page-header-actions">
            <button type="button" className="btn" onClick={mediaStatus.recheck} disabled={!available} title="Check for missing files again">
              <RefreshCw size={14} aria-hidden="true" />
              Check files
            </button>
            <button type="button" className="btn btn-primary" onClick={() => void onImport()} disabled={!available || busy}>
              <ImagePlus size={14} aria-hidden="true" />
              {busy ? 'Copying…' : 'Add pictures or videos'}
            </button>
          </div>
        </header>

        {message && (
          <div className={`notice${message.tone === 'error' ? ' notice-error' : ''}`} role="status">
            <Info size={16} aria-hidden="true" />
            <span>{message.text}</span>
          </div>
        )}

        {state.media.length === 0 ? (
          <section className="card">
            <EmptyState icon={Images} title="No pictures or videos yet">
              Add PNG, JPG, WebP or GIF pictures, or MP4 or WebM videos. 1920 × 1080 looks best.
            </EmptyState>
          </section>
        ) : (
          <div className="media-grid">
            {state.media.map((m) => {
              const isMissing = mediaStatus.missing.has(m.id);
              const used = usage(m.id);
              return (
                <section key={m.id} className={`card media-card${isMissing ? ' is-missing' : ''}`}>
                  <div className="media-thumb"><MediaThumb item={m} missing={isMissing} /></div>
                  <div className="media-info">
                    <span className="media-name" title={m.name}>{m.name}</span>
                    <span className="media-sub">{used ? `Used by ${used} item${used === 1 ? '' : 's'}` : 'Not used'}</span>
                  </div>
                  <div className="media-actions">
                    <button
                      type="button"
                      className="btn btn-sm"
                      disabled={isMissing}
                      title={planName ? `Show full screen as an item in “${planName}”` : 'Add to the library as an item'}
                      onClick={() => onAddToService(m)}
                    >
                      <ListPlus size={13} aria-hidden="true" />
                      Add to service
                    </button>
                    <ConfirmButton
                      className="btn btn-sm"
                      label={<><Trash2 size={13} aria-hidden="true" />Remove</>}
                      confirmLabel={used ? 'Click again: items switch to black' : 'Click again'}
                      onConfirm={() => void onRemove(m.id, m.fileName)}
                    />
                  </div>
                </section>
              );
            })}
          </div>
        )}

        <div className="notice">
          <Info size={16} aria-hidden="true" />
          <span>
            Add to service puts the picture or video in the open service as its own item, shown full screen. To use one behind song lyrics, pick it as the background in Presentation Studio.
            PowerPoint and PDF files are imported in Presentation Studio as a Presentation item. A missing file shows as black; it never stops the service.
          </span>
        </div>
      </div>
    </div>
  );
}
