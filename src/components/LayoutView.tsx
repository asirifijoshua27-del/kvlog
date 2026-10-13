import { useContext, type CSSProperties } from 'react';
import { MediaContext, useBackgroundMedia } from './MediaContext';
import { isVideoFile, mediaUrl } from '../../shared/media';
import { toRgba, type RenderBox, type ResolvedLayout } from '../../shared/layout';
import { filterCss } from '../../shared/filters';

const JUSTIFY = { top: 'flex-start', middle: 'center', bottom: 'flex-end' } as const;

function boxFrame(box: RenderBox): CSSProperties {
  return {
    position: 'absolute',
    left: `${box.x}%`,
    top: `${box.y}%`,
    width: `${box.w}%`,
    height: `${box.h}%`,
    background: box.fill ? toRgba(box.fill, box.opacity) : undefined,
    borderRadius: box.radius ? `${box.radius}cqw` : undefined,
    border: box.borderWidth ? `${box.borderWidth}cqw solid ${toRgba(box.borderColor)}` : undefined,
    boxSizing: 'border-box',
    overflow: 'hidden',
    opacity: box.alpha < 1 ? box.alpha : undefined
  };
}

export function textCss(box: RenderBox): CSSProperties {
  const s = box.style;
  return {
    width: '100%',
    fontFamily: `'${s.font}', 'Segoe UI', sans-serif`,
    fontSize: `${box.fontSize}cqw`,
    color: toRgba(s.color),
    fontWeight: s.bold ? 700 : 400,
    fontStyle: s.italic ? 'italic' : 'normal',
    textTransform: s.uppercase ? 'uppercase' : 'none',
    letterSpacing: s.uppercase ? '0.06em' : undefined,
    textAlign: s.align,
    lineHeight: s.lineHeight,
    WebkitTextStroke: s.outlineWidth ? `${s.outlineWidth}cqw ${toRgba(s.outlineColor)}` : undefined,
    paintOrder: 'stroke fill',
    textShadow: s.shadow ? '0 0.15cqw 0.6cqw rgba(0,0,0,0.85), 0 0 0.2cqw rgba(0,0,0,0.6)' : undefined,
    overflowWrap: 'anywhere',
    textWrap: 'balance'
  } as CSSProperties;
}

function BoxContent({ box }: { box: RenderBox }) {
  const { files, missing } = useContext(MediaContext);
  if (box.role === 'shape') return null;
  if (box.role === 'image') {
    const file = box.mediaId && !missing.has(box.mediaId) ? files[box.mediaId] : undefined;
    if (!file) return null;
    const style: CSSProperties = { width: '100%', height: '100%', objectFit: box.fit, display: 'block', pointerEvents: 'none', filter: filterCss(box.filter, true) };
    return isVideoFile(file)
      ? <video src={mediaUrl(file)} style={style} muted loop autoPlay playsInline />
      : <img src={mediaUrl(file)} style={style} alt="" draggable={false} />;
  }
  if (box.lines.length === 0) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: JUSTIFY[box.style.valign], height: '100%', padding: '0.6cqw', boxSizing: 'border-box' }}>
      {box.columns ? (
        <div style={{ ...textCss(box), display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: '3cqw' }}>
          {box.columns.map((col, c) => (
            <div key={c}>{col.map((line, i) => <p key={i} style={{ margin: '0 0 0.2em' }}>{line}</p>)}</div>
          ))}
        </div>
      ) : (
        <div style={textCss(box)}>
          {box.lines.map((line, i) => <p key={i} style={{ margin: i ? '0.2em 0 0' : 0 }}>{line}</p>)}
        </div>
      )}
    </div>
  );
}

/** Draws template boxes on top of a background. Used by every slide preview and output. */
export function LayoutBoxes({ boxes }: { boxes: RenderBox[] }) {
  return (
    <>
      {boxes.map((box) => (
        <div key={box.id} style={boxFrame(box)}>
          <BoxContent box={box} />
        </div>
      ))}
    </>
  );
}

export function useLayoutBackground(layout: ResolvedLayout | null) {
  return useBackgroundMedia(layout ? layout.background : 'black');
}
