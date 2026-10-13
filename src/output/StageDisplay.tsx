import { useEffect, useState } from 'react';
import { useClock } from '../services/useClock';
import { chordSegments, transposeChord, transposeKey } from '../../shared/chords';
import { formatDuration } from '../../shared/extras';
import type { OutputSlide, OutputSnapshot } from '../../shared/output-types';
import { ScreenGuide } from '../components/ScreenGuide';

function position(slide: OutputSlide): string {
  return `${slide.group ? `${slide.group} · ` : ''}${slide.index + 1}/${slide.total}`;
}

function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}

function ChordLine({ line, steps, songKey }: { line: string; steps: number; songKey: string }) {
  return (
    <p className="stage-chordline">
      {chordSegments(line).map((seg, i) => (
        <span key={i} className="chord-seg">
          <span className="chord">{seg.chord ? transposeChord(seg.chord, steps, songKey) : '\u00a0'}</span>
          <span className="chord-text">{seg.text || '\u00a0'}</span>
        </span>
      ))}
    </p>
  );
}

function SlideText({ slide, chords, empty }: { slide: OutputSlide; chords: boolean; empty: string }) {
  if (chords && slide.chords?.length) {
    const steps = slide.transpose ?? 0;
    return <>{slide.chords.map((line, i) => <ChordLine key={i} line={line} steps={steps} songKey={slide.songKey ?? ''} />)}</>;
  }
  if (slide.lines.length) return <>{slide.lines.map((line, i) => <p key={i}>{line}</p>)}</>;
  return <p>{empty}</p>;
}

function keyLabel(slide: OutputSlide | null): string | null {
  if (!slide?.songKey && !slide?.transpose) return null;
  const key = slide.songKey ?? '';
  const steps = slide.transpose ?? 0;
  if (!steps) return `Key ${key}`;
  const sign = steps > 0 ? `+${steps}` : String(steps);
  return key ? `Key ${key} → ${transposeKey(key, steps)} (${sign})` : `Capo/transpose ${sign}`;
}

/**
 * Confidence monitor for people on stage: large current text (with chords for the band), the next
 * slide, the time, item timing, alerts and the live item's notes. Never shown to the audience.
 */
export function StageDisplay({ snapshot, connected }: { snapshot: OutputSnapshot; connected: boolean }) {
  const clock = useClock();
  const now = useNow();
  const { live, next, blackout, timing, alert } = snapshot;
  const chords = snapshot.stageChords !== false;

  let state = 'Clear';
  if (blackout) state = 'Blackout';
  else if (live) state = 'Live';

  const elapsed = timing ? Math.max(0, (now - timing.since) / 1000) : 0;
  const over = timing && timing.plannedSec > 0 ? elapsed - timing.plannedSec : null;
  const key = chords ? keyLabel(live) : null;
  const layout = snapshot.screens?.stageLayout ?? 'standard';
  const m = snapshot.screens?.stage;
  const zoom = (snapshot.screens?.stageTextScale ?? 100) / 100;
  const showNotes = layout === 'standard' || layout === 'pastor';
  const showNext = layout !== 'words';

  return (
    <div className={`stage stage-layout-${layout}`} style={m ? { inset: `${m.top}% ${m.right}% ${m.bottom}% ${m.left}%` } : undefined}>
      {snapshot.guide && <ScreenGuide label="KVLOG safe area (stage display)" />}
      <header className="stage-top">
        <span className={`stage-state stage-state-${state.toLowerCase()}`}>{state}</span>
        <span className="stage-service">{snapshot.serviceName}</span>
        {key && <span className="stage-key">{key}</span>}
        {timing && (
          <span className={`stage-timer${over !== null && over > 0 ? ' is-over' : over !== null && over > -60 ? ' is-near' : ''}`}>
            {over === null
              ? formatDuration(elapsed)
              : over > 0
                ? `+${formatDuration(over)} over`
                : `${formatDuration(-over)} left`}
          </span>
        )}
        <time className="stage-clock">{clock}</time>
      </header>

      {alert && <div className="stage-alert" role="status">{alert.text}</div>}

      {layout === 'pastor' && (
        <section className="stage-notes stage-notes-big" aria-label="Notes">
          <div className="stage-label"><span>Notes</span>{live && <span>{live.title}</span>}</div>
          <p className={snapshot.notes ? 'stage-notes-text' : 'stage-empty'}>{snapshot.notes || 'No notes for this item'}</p>
        </section>
      )}

      {layout !== 'pastor' && (
      <section className="stage-current" aria-label="Current slide" style={{ zoom }}>
        <div className="stage-label">
          <span>Now</span>
          {live && <span>{live.title} · {position(live)}</span>}
        </div>
        <div className={`stage-current-text${chords && live?.chords?.length ? ' has-chords' : ''}`}>
          {live ? (
            <SlideText slide={live} chords={chords} empty={`${live.kind === 'media' ? 'Picture / video' : 'Slide'}: ${live.title}`} />
          ) : (
            <p className="stage-empty">{connected ? 'Nothing on screen' : 'Waiting for KVLOG…'}</p>
          )}
        </div>
      </section>
      )}

      {showNext && (
      <div className="stage-bottom" style={{ zoom }}>
        {layout === 'pastor' && (
          <section className="stage-current" aria-label="Current slide">
            <div className="stage-label"><span>On screen</span></div>
            <div className="stage-current-text">{live ? <SlideText slide={live} chords={false} empty={live.title} /> : <p className="stage-empty">Nothing on screen</p>}</div>
          </section>
        )}
        <section className="stage-next" aria-label="Next slide">
          <div className="stage-label">
            <span>Next</span>
            {next && <span>{next.title} · {position(next)}</span>}
          </div>
          <div className="stage-next-text">
            {next ? <SlideText slide={next} chords={chords} empty={`${next.title} · ${position(next)}`} /> : <p className="stage-empty">End of service</p>}
          </div>
        </section>
        {showNotes && layout !== 'pastor' && (
          <section className="stage-notes" aria-label="Notes">
            <div className="stage-label"><span>Notes</span></div>
            <p className={snapshot.notes ? 'stage-notes-text' : 'stage-empty'}>{snapshot.notes || 'No notes'}</p>
          </section>
        )}
      </div>
      )}
    </div>
  );
}
