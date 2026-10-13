import { useEffect, useState } from 'react';
import { CircleDot, Loader2, Pause, Play, Radio, Square, X } from 'lucide-react';
import { ConfirmButton } from '../../components/ConfirmButton';
import type { ObsControl } from '../../services/obs';
import type { ObsOutputStatus } from '../../../shared/obs-types';

interface OutputControlsProps {
  obs: ObsControl;
  /** Smaller layout for the Live Studio OBS panel. */
  compact?: boolean;
}

const time = (s: ObsOutputStatus) => s.timecode.split('.')[0];

function statusText(status: ObsOutputStatus | null, flagText: string): string {
  if (!status) return 'Unknown';
  if (!status.active) return 'Off';
  return status.flag ? `${flagText} · ${time(status)}` : `On · ${time(status)}`;
}

/**
 * Start/stop for the OBS stream and recording. Going live and stopping need a second click.
 * The status shown is always what OBS reports, never what KVLOG expects.
 */
export function OutputControls({ obs, compact = false }: OutputControlsProps) {
  const state = obs.state;
  const notice = state?.outputNotice ?? null;
  const [dismissedAt, setDismissedAt] = useState<string | null>(null);

  // Success messages hide after 8 seconds; problems stay until closed.
  useEffect(() => {
    if (!notice || notice.tone !== 'ok') return;
    const timer = window.setTimeout(() => setDismissedAt(notice.at), 8000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  if (!state || state.connection !== 'connected') return null;
  const { stream, record, outputPending } = state;
  const outputNotice = notice && notice.at !== dismissedAt ? notice : null;
  const blocked = obs.busy || outputPending !== null;
  const waiting = (
    <button type="button" className="btn btn-sm" disabled>
      <Loader2 size={13} className="spin" aria-hidden="true" />
      Waiting for OBS…
    </button>
  );

  return (
    <div className={`out-controls${compact ? ' is-compact' : ''}`}>
      <div className={`out-row${stream?.active ? (stream.flag ? ' is-warn' : ' is-live') : ''}`}>
        <Radio size={14} aria-hidden="true" />
        <span className="out-label">Stream</span>
        <span className="out-status">{statusText(stream, 'Reconnecting')}</span>
        <div className="out-actions">
          {outputPending === 'stream' ? waiting : stream?.active ? (
            <ConfirmButton
              label={<><Square size={12} aria-hidden="true" /> Stop stream</>}
              confirmLabel="Click again to stop"
              title="Stop the stream in OBS"
              disabled={blocked}
              onConfirm={() => obs.output('stop-stream')}
            />
          ) : (
            <ConfirmButton
              className="btn btn-sm btn-primary"
              label={<><Play size={12} aria-hidden="true" /> Go live</>}
              confirmLabel="Click again to go live"
              title="Start streaming with the settings in OBS"
              disabled={blocked || !stream}
              onConfirm={() => obs.output('start-stream')}
            />
          )}
        </div>
      </div>

      <div className={`out-row${record?.active ? (record.flag ? ' is-warn' : ' is-live') : ''}`}>
        <CircleDot size={14} aria-hidden="true" />
        <span className="out-label">Recording</span>
        <span className="out-status">{statusText(record, 'Paused')}</span>
        <div className="out-actions">
          {outputPending === 'record' ? waiting : record?.active ? (
            <>
              <button type="button" className="btn btn-sm" disabled={blocked}
                onClick={() => obs.output(record.flag ? 'resume-record' : 'pause-record')}>
                {record.flag ? <Play size={12} aria-hidden="true" /> : <Pause size={12} aria-hidden="true" />}
                {record.flag ? 'Resume' : 'Pause'}
              </button>
              <ConfirmButton
                label={<><Square size={12} aria-hidden="true" /> Stop</>}
                confirmLabel="Click again to stop"
                title="Stop recording and save the file"
                disabled={blocked}
                onConfirm={() => obs.output('stop-record')}
              />
            </>
          ) : (
            <button type="button" className="btn btn-sm" disabled={blocked || !record} onClick={() => obs.output('start-record')}>
              <CircleDot size={12} aria-hidden="true" />
              Record
            </button>
          )}
        </div>
      </div>

      {obs.actionError && !compact && (
        <div className="out-note bad-text" role="alert">
          <span>{obs.actionError}</span>
          <button type="button" className="out-note-close" aria-label="Close message" onClick={obs.clearActionError}><X size={13} /></button>
        </div>
      )}
      {(compact || !obs.actionError) && outputNotice && (
        <div className={`out-note ${outputNotice.tone === 'ok' ? 'ok-text' : 'bad-text'}`} role={outputNotice.tone === 'error' ? 'alert' : 'status'}>
          <span title={outputNotice.message}>{outputNotice.message}</span>
          <button type="button" className="out-note-close" aria-label="Close message" onClick={() => setDismissedAt(outputNotice.at)}><X size={13} /></button>
        </div>
      )}
    </div>
  );
}
