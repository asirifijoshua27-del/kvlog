import { useContext, useEffect, useRef, useState, type CSSProperties } from 'react';
import { LayoutBoxes } from './LayoutView';
import { TemplatesContext } from './TemplatesContext';
import { resolveLayout, type DeckSlide, type LayoutBox, type ResolvedLayout } from '../../shared/layout';
import { useBackgroundMedia } from './MediaContext';
import { mediaUrl } from '../../shared/media';
import { blurScale, filterCss, type PictureFilter } from '../../shared/filters';
import type { BackgroundRef, ItemKind } from '../types';

/** Anything with a kind and background: a full ServiceItem, or an OutputSlide in an output window. */
export interface SlideStyle {
  kind: ItemKind;
  background: BackgroundRef;
  title?: string;
  subtitle?: string;
  templateId?: string | null;
  slideLayouts?: Record<string, LayoutBox[]>;
  slideFilters?: Record<string, PictureFilter>;
  deck?: DeckSlide[];
}

export interface SlideText {
  lines: string[];
  footer?: string | null;
  /** Presentation slide image (media file name). */
  image?: string | null;
  /** Two translations side by side. */
  columns?: [string[], string[]] | null;
  index?: number;
  /** Already worked out (output windows). undefined = work it out here. */
  layout?: ResolvedLayout | null;
}

export interface SlideViewProps {
  item: SlideStyle | null;
  slide: SlideText | null;
  blackout?: boolean;
  /** Play videos (live monitors and outputs). Thumbnails show a still frame. */
  playing?: boolean;
  /** Play video sound (projector only; only for Media items). */
  sound?: boolean;
  /** When the slide went live, so videos are in step on every screen. */
  since?: number;
}

/** Shrinks text on long slides so it stays on screen. Returns a size in container-width units (cqw). */
function fitTextSize(kind: ItemKind, slide: SlideText): number | undefined {
  if (kind === 'announcement') return undefined;
  const characters = Math.max(1, slide.lines.reduce((total, line) => total + line.length, 0));
  const byLength = 4.6 * Math.sqrt(80 / characters);
  const byLineCount = 30 / (Math.max(1, slide.lines.length) * 1.3);
  return Math.max(2.4, Math.min(5.2, byLength, byLineCount));
}

function fitColumnSize(columns: [string[], string[]]): number {
  const characters = Math.max(1, ...columns.map((c) => c.reduce((t, l) => t + l.length, 0)));
  return Math.max(1.8, Math.min(3.6, 3.2 * Math.sqrt(60 / characters)));
}

function SlideImage({ url, className, style }: { url: string; className: string; style?: CSSProperties }) {
  const [failed, setFailed] = useState<string | null>(null);
  if (failed === url) return null;
  return <img className={className} src={url} alt="" draggable={false} style={style} onError={() => setFailed(url)} />;
}

interface VideoProps {
  url: string;
  playing: boolean;
  sound: boolean;
  since: number;
  className: string;
  style?: CSSProperties;
}

/** Loops. When playing, jumps to the position matching `since`, so all screens show the same frame. */
function SlideVideo({ url, playing, sound, since, className, style }: VideoProps) {
  const ref = useRef<HTMLVideoElement>(null);
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    v.muted = !sound;
    const start = () => {
      if (!playing) {
        v.pause();
        if (v.currentTime < 0.1 && Number.isFinite(v.duration)) v.currentTime = Math.min(0.5, v.duration / 2);
        return;
      }
      if (Number.isFinite(v.duration) && v.duration > 0) v.currentTime = since > 0 ? ((Date.now() - since) / 1000) % v.duration : 0;
      v.play().catch(() => {
        v.muted = true;
        void v.play().catch(() => undefined);
      });
    };
    if (v.readyState >= 1) start();
    else v.addEventListener('loadedmetadata', start, { once: true });
    return () => v.removeEventListener('loadedmetadata', start);
  }, [url, playing, sound, since]);

  if (failed === url) return null;
  return <video ref={ref} className={className} style={style} src={url} loop playsInline muted preload={playing ? 'auto' : 'metadata'} onError={() => setFailed(url)} />;
}

/** Renders one 16:9 slide. Text scales with the slide width, so the same component works for thumbnails and outputs. */
export function SlideView({ item, slide, blackout = false, playing = false, sound = false, since = 0 }: SlideViewProps) {
  const templates = useContext(TemplatesContext);
  const canLayout = !!item && (item.kind === 'song' || item.kind === 'scripture' || item.kind === 'announcement' || item.kind === 'slides');
  const layout: ResolvedLayout | null =
    slide?.layout !== undefined
      ? slide.layout
      : canLayout && item && slide
        ? resolveLayout({ title: item.title ?? '', subtitle: item.subtitle ?? '', background: item.background, templateId: item.templateId, slideLayouts: item.slideLayouts, slideFilters: item.slideFilters, deck: item.deck }, slide, templates)
        : null;
  const background = layout?.background ?? item?.background ?? 'black';
  const bg = useBackgroundMedia(item && !blackout ? background : 'black');
  const builtIn = blackout || !item || background.startsWith('media:') ? 'black' : background;
  const hasText = !!slide && slide.lines.length > 0;
  const size = item && slide && hasText ? fitTextSize(item.kind, slide) : undefined;
  const fullMedia = item?.kind === 'media';
  const bgClass = fullMedia ? 'slide-bg-img slide-contain' : 'slide-bg-img';
  const bgFilter = !blackout ? layout?.bgFilter ?? null : null;
  const bgCss = filterCss(bgFilter);
  const bgStyle: CSSProperties | undefined = bgCss ? { filter: bgCss, transform: blurScale(bgFilter) } : undefined;
  const darken = bgFilter && bgFilter.darken > 0 ? bgFilter.darken / 100 : 0;

  return (
    <div className={`slide slide-bg-${builtIn}${bg && !layout ? ' has-image' : ''}${item ? ` slide-is-${item.kind}` : ''}`}>
      {bg && (bg.video
        ? <SlideVideo url={bg.url} className={bgClass} style={bgStyle} playing={playing} sound={sound && fullMedia} since={since} />
        : <SlideImage url={bg.url} className={bgClass} style={bgStyle} />)}
      {darken > 0 && <div className="slide-darken" style={{ background: `rgba(0, 0, 0, ${darken})` }} />}
      {!blackout && slide?.image && <SlideImage url={mediaUrl(slide.image)} className="slide-bg-img slide-contain" />}
      {!blackout && layout && <LayoutBoxes boxes={layout.boxes} />}
      {!blackout && !layout && item && slide && hasText && (
        <div className={`slide-body slide-kind-${item.kind}`}>
          {slide.columns ? (
            <div className="slide-columns" style={{ fontSize: `${fitColumnSize(slide.columns).toFixed(2)}cqw` }}>
              {slide.columns.map((column, c) => (
                <div key={c} className="slide-column">
                  {column.map((line, i) => (
                    <p key={i}>{line}</p>
                  ))}
                </div>
              ))}
            </div>
          ) : (
            <div className="slide-lines" style={size ? { fontSize: `${size.toFixed(2)}cqw` } : undefined}>
              {slide.lines.map((line, i) => (
                <p key={i}>{line}</p>
              ))}
            </div>
          )}
          {slide.footer && <div className="slide-footer">{slide.footer}</div>}
        </div>
      )}
    </div>
  );
}
