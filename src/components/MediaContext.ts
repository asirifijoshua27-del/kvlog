import { createContext, useContext } from 'react';
import { isVideoFile, mediaUrl } from '../../shared/media';

/** Media id -> file name, plus the ids whose files are missing on disk. */
export interface MediaLookup {
  files: Record<string, string>;
  missing: ReadonlySet<string>;
}

export const MediaContext = createContext<MediaLookup>({ files: {}, missing: new Set() });

/** The picture or video for a background, or null for built-in or missing backgrounds. */
export function useBackgroundMedia(background: string): { url: string; video: boolean } | null {
  const { files, missing } = useContext(MediaContext);
  if (!background.startsWith('media:')) return null;
  const id = background.slice('media:'.length);
  const fileName = files[id];
  return fileName && !missing.has(id) ? { url: mediaUrl(fileName), video: isVideoFile(fileName) } : null;
}

/** Kept for older callers: image URL only. */
export function useBackgroundImage(background: string): string | null {
  const media = useBackgroundMedia(background);
  return media && !media.video ? media.url : null;
}
