import { Film } from 'lucide-react';
import { mediaUrl } from '../../shared/media';
import type { MediaItem } from '../types';

/** A still preview of a picture or video from the Media Library. */
export function MediaThumb({ item, missing }: { item: MediaItem; missing: boolean }) {
  if (missing) return <span className="media-missing">File missing</span>;
  const url = mediaUrl(item.fileName);
  if (item.kind === 'video') {
    return (
      <>
        <video src={`${url}#t=0.5`} muted playsInline preload="metadata" />
        <span className="media-badge"><Film size={11} aria-hidden="true" />Video</span>
      </>
    );
  }
  return <img src={url} alt="" draggable={false} />;
}
