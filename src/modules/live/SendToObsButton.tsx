import { Cast, Check, Loader2 } from 'lucide-react';
import { useLyricsSource } from '../../services/obs';

/**
 * One click to also show the live slide in OBS (the projector keeps working as before).
 * Turns on KVLOG in OBS and adds "KVLOG Output" to the current OBS scene.
 */
export function SendToObsButton({ obsConnected }: { obsConnected: boolean }) {
  const lyrics = useLyricsSource();
  const s = lyrics.state;
  if (!s) return null;

  const showing = s.running && s.clients > 0;
  const onClick = async () => {
    if (!s.running && !(await lyrics.save({ enabled: true, port: s.port, mode: s.mode }))) return;
    if (obsConnected) lyrics.addToObs();
  };

  let title = 'Also show the live slide in OBS';
  if (!obsConnected) title = 'Connect OBS first (Broadcast page)';
  if (showing) title = `The live slide is showing in OBS (${s.clients} Browser Source${s.clients === 1 ? '' : 's'}). Click to add it to the current OBS scene too.`;
  if (s.error) title = s.error;
  if (lyrics.error) title = lyrics.error;
  if (lyrics.message) title = lyrics.message;

  return (
    <button
      type="button"
      className={`monitor-action${showing ? ' is-on' : ''}${s.error || lyrics.error ? ' is-error' : ''}`}
      onClick={() => void onClick()}
      disabled={lyrics.busy || !obsConnected}
      title={title}
    >
      {lyrics.busy ? <Loader2 size={12} className="spin" aria-hidden="true" /> : showing ? <Check size={12} aria-hidden="true" /> : <Cast size={12} aria-hidden="true" />}
      {showing ? 'In OBS' : 'Send to OBS'}
    </button>
  );
}
