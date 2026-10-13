import { useEffect, useRef, useState } from 'react';
import { SlideView, type SlideViewProps } from './SlideView';
import type { Transition } from '../../shared/data-types';

interface TransitionViewProps extends SlideViewProps {
  /** Changes when a different slide goes live (or on clear/blackout). */
  slideKey: string;
  /** How the incoming slide appears. */
  transition: Transition;
}

interface Shown {
  key: string;
  props: SlideViewProps;
}

const FADE_MS = 450;

export function liveSlideKey(itemId: string | null | undefined, index: number | null | undefined, blackout: boolean): string {
  if (blackout) return 'blackout';
  return itemId ? `${itemId}:${index ?? 0}` : 'clear';
}

/** A live slide that fades (or cuts) to the next one. The outgoing slide keeps playing underneath. */
export function TransitionView({ slideKey, transition, ...props }: TransitionViewProps) {
  const current = useRef<Shown>({ key: slideKey, props });
  const [outgoing, setOutgoing] = useState<Shown | null>(null);

  if (current.current.key !== slideKey) {
    const old = current.current;
    current.current = { key: slideKey, props };
    if (transition === 'fade') setOutgoing(old);
    else if (outgoing) setOutgoing(null);
  } else {
    current.current = { key: slideKey, props };
  }

  useEffect(() => {
    if (!outgoing) return;
    const timer = window.setTimeout(() => setOutgoing(null), FADE_MS);
    return () => window.clearTimeout(timer);
  }, [outgoing]);

  const out = outgoing && outgoing.key !== slideKey ? outgoing : null;
  return (
    <div className="tv">
      {out && (
        <div key={out.key} className="tv-layer">
          <SlideView {...out.props} />
        </div>
      )}
      <div key={slideKey} className={`tv-layer${out ? ' tv-in' : ''}`}>
        <SlideView {...props} />
      </div>
    </div>
  );
}
