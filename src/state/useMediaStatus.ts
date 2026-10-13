import { useCallback, useEffect, useMemo, useState } from 'react';
import type { MediaLookup } from '../components/MediaContext';
import type { MediaItem } from '../types';

export interface MediaStatus extends MediaLookup {
  /** Re-checks which files exist (e.g. after the user restored a file). */
  recheck: () => void;
}

/** Tracks which Media Library files are missing from disk, so slides and the library can show it. */
export function useMediaStatus(media: MediaItem[]): MediaStatus {
  const [missing, setMissing] = useState<ReadonlySet<string>>(new Set());
  const [checkCount, setCheckCount] = useState(0);
  const fileList = media.map((m) => m.fileName).join('|');

  useEffect(() => {
    const bridge = window.kvlog;
    if (!bridge || media.length === 0) {
      setMissing(new Set());
      return;
    }
    let active = true;
    bridge
      .findMissingMedia(media.map((m) => m.fileName))
      .then((names) => {
        if (!active) return;
        const gone = new Set(names);
        setMissing(new Set(media.filter((m) => gone.has(m.fileName)).map((m) => m.id)));
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
    // fileList captures every change that matters to this check.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileList, checkCount]);

  const files = useMemo(() => Object.fromEntries(media.map((m) => [m.id, m.fileName])), [media]);
  const recheck = useCallback(() => setCheckCount((n) => n + 1), []);
  return { files, missing, recheck };
}
