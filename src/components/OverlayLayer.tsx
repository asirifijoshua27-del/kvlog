import { useEffect, useState, type CSSProperties } from 'react';
import { isVideoFile, mediaUrl } from '../../shared/media';
import { toRgba } from '../../shared/layout';
import { countdownSeconds, formatClock, formatCountdown, type OutputOverlay } from '../../shared/overlay';

interface OverlayLayerProps {
  overlays: OutputOverlay[];
  /** Which screen this is. 'all' shows every overlay (editor previews). */
  target: 'projector' | 'obs' | 'all';
  blackout?: boolean;
  /** Play videos (outputs). Previews show a still frame. */
  playing?: boolean;
  /** Fixed time for previews. */
  now?: number;
}

function useNow(enabled: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!enabled) return;
    const tick = () => setNow(Date.now());
    tick();
    const timer = window.setInterval(tick, 500);
    return () => window.clearInterval(timer);
  }, [enabled]);
  return now;
}

function Media({ file, cover, playing, radius }: { file: string; cover: boolean; playing: boolean; radius?: string }) {
  const style: CSSProperties = { width: '100%', height: '100%', objectFit: cover ? 'cover' : 'contain', display: 'block', borderRadius: radius };
  return isVideoFile(file)
    ? <video src={mediaUrl(file)} style={style} muted loop playsInline autoPlay={playing} preload={playing ? 'auto' : 'metadata'} />
    : <img src={mediaUrl(file)} style={style} alt="" draggable={false} />;
}

function OverlayBox({ o, now, playing }: { o: OutputOverlay; now: number; playing: boolean }) {
  const frame: CSSProperties = {
    position: 'absolute',
    left: `${o.x}%`,
    top: `${o.y}%`,
    width: `${o.w}%`,
    height: `${o.h}%`,
    opacity: o.alpha,
    fontFamily: `'${o.font}', 'Segoe UI', sans-serif`,
    color: o.textColor
  };
  const bg = o.bgOpacity > 0 ? toRgba(o.bgColor, o.bgOpacity) : undefined;
  const radius = o.radius ? `${o.radius}cqw` : undefined;
  const size = `${o.size}cqw`;

  switch (o.kind) {
    case 'logo':
    case 'pip':
      if (!o.file) return null;
      return (
        <div className={`ovl-item ovl-${o.kind}`} style={{ ...frame, background: bg, borderRadius: radius, overflow: 'hidden' }}>
          <Media file={o.file} cover={o.kind === 'pip'} playing={playing} />
        </div>
      );
    case 'lowerThird':
      return (
        <div className="ovl-item ovl-lt" style={{ ...frame, display: 'flex', alignItems: 'stretch' }}>
          <span style={{ width: '0.45cqw', flexShrink: 0, background: o.accentColor, borderRadius: radius }} />
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '0.25em', padding: '0 1.4cqw', background: bg, borderRadius: radius }}>
            <span style={{ fontSize: size, fontWeight: 700, lineHeight: 1.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{o.line1}</span>
            {o.line2 && <span style={{ fontSize: `${o.size * 0.62}cqw`, opacity: 0.85, lineHeight: 1.15, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{o.line2}</span>}
          </div>
        </div>
      );
    case 'clock':
      return (
        <div className="ovl-item" style={{ ...frame, display: 'grid', placeItems: 'center', background: bg, borderRadius: radius, fontSize: size, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
          {formatClock(new Date(now), o.clock24, o.clockSeconds)}
        </div>
      );
    case 'countdown': {
      const left = countdownSeconds(o, o.since, now);
      const done = left === 0 && !!o.line2;
      return (
        <div className="ovl-item" style={{ ...frame, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.4cqw', background: bg, borderRadius: radius, textAlign: 'center' }}>
          {o.line1 && !done && <span style={{ fontSize: `${o.size * 0.32}cqw`, letterSpacing: '0.08em', textTransform: 'uppercase', opacity: 0.85 }}>{o.line1}</span>}
          <span style={{ fontSize: done ? `${o.size * 0.6}cqw` : size, fontWeight: 700, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{done ? o.line2 : formatCountdown(left)}</span>
        </div>
      );
    }
    case 'ticker': {
      // Time to cross the band and the text itself, at tickerSpeed screen widths per minute.
      const textScreens = (o.line1.length * 0.55 * o.size) / 100;
      const seconds = Math.max(4, ((o.w / 100 + textScreens) * 60) / o.tickerSpeed);
      return (
        <div className="ovl-item ovl-ticker" style={{ ...frame, background: bg, borderRadius: radius, overflow: 'hidden', borderTop: `0.25cqw solid ${o.accentColor}` }}>
          <span key={o.line1 + seconds} className="ovl-marquee" style={{ fontSize: size, animationDuration: `${seconds}s` }}>{o.line1}</span>
        </div>
      );
    }
    case 'reference':
      if (!o.refText) return null;
      return (
        <div className="ovl-item" style={{ ...frame, display: 'flex', alignItems: 'center', gap: '0.8cqw', padding: '0 1.2cqw', background: bg, borderRadius: radius, boxSizing: 'border-box', borderLeft: `0.35cqw solid ${o.accentColor}` }}>
          <span style={{ fontSize: size, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{o.refText}</span>
        </div>
      );
  }
}

/** Draws the overlays that are on, above the slide. Not affected by slide transitions. */
export function OverlayLayer({ overlays, target, blackout = false, playing = false, now: fixedNow }: OverlayLayerProps) {
  const shown = overlays.filter((o) => (target === 'all' || (target === 'projector' ? o.projector : o.obs)) && (!blackout || o.keepOnBlackout));
  const ticking = fixedNow === undefined && shown.some((o) => o.kind === 'clock' || o.kind === 'countdown');
  const now = useNow(ticking);
  if (shown.length === 0) return null;
  return (
    <div className="ovl" aria-hidden="true">
      {shown.map((o) => <OverlayBox key={o.id} o={o} now={fixedNow ?? now} playing={playing} />)}
    </div>
  );
}
