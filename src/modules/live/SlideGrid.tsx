import { Layers, ListMusic } from 'lucide-react';
import { EmptyState, Panel } from '../../components/Panel';
import { SlideView } from '../../components/SlideView';
import type { SlidePointer } from '../../state/presentation';
import type { ServiceItem } from '../../types';

interface SlideGridProps {
  item: ServiceItem | null;
  live: SlidePointer | null;
  next: SlidePointer | null;
  /** True when the queued slide was picked by the operator (Preview), not just the next in order. */
  nextIsPreview?: boolean;
  /** 'preview': a click queues the slide; double-click sends it live. */
  clickMode?: 'live' | 'preview';
  onGoLive: (slideIndex: number) => void;
  onPreview?: (slideIndex: number) => void;
}

export function SlideGrid({ item, live, next, nextIsPreview = false, clickMode = 'live', onGoLive, onPreview }: SlideGridProps) {
  const previewFirst = clickMode === 'preview' && !!onPreview;
  if (!item) {
    return (
      <Panel title="Slides" icon={Layers} className="slides-panel">
        <EmptyState icon={ListMusic} title="No item selected">Choose an item in the service list to see its slides.</EmptyState>
      </Panel>
    );
  }

  return (
    <Panel
      title={item.title}
      icon={Layers}
      meta={`${item.slides.length} slide${item.slides.length === 1 ? '' : 's'} · ${previewFirst ? 'click = Preview, double-click = Live' : 'click to send live'}`}
      className="slides-panel"
    >
      {item.slides.length === 0 && (
        <EmptyState icon={ListMusic} title="No slides yet">Add text in Presentation Studio and the slides appear here.</EmptyState>
      )}
      <div className="slide-grid">
        {item.slides.map((slide, i) => {
          const isLive = live?.itemId === item.id && live.slideIndex === i;
          const isNext = !isLive && next?.itemId === item.id && next.slideIndex === i;
          return (
            <button
              key={slide.id}
              type="button"
              className={`slide-thumb${isLive ? ' is-live' : ''}${isNext ? ' is-next' : ''}`}
              aria-label={previewFirst ? `Preview slide ${i + 1}` : `Send slide ${i + 1} live`}
              aria-current={isLive ? 'true' : undefined}
              onClick={() => (previewFirst ? onPreview?.(i) : onGoLive(i))}
              onDoubleClick={() => previewFirst && onGoLive(i)}
            >
              <SlideView item={item} slide={slide} />
              <span className="slide-thumb-meta">
                <span className="slide-thumb-index">{i + 1}</span>
                {slide.group && <span>{slide.group}</span>}
                {isLive && <span className="tag tag-live">Live</span>}
                {isNext && <span className="tag tag-next">{nextIsPreview ? 'Preview' : 'Next'}</span>}
              </span>
            </button>
          );
        })}
      </div>
    </Panel>
  );
}
