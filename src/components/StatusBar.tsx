import { Check, Info, Monitor, Save } from 'lucide-react';
import { resolvePointer, type PresentationState } from '../state/presentation';
import type { DisplaysState } from '../services/desktopBridge';
import type { SaveStatus } from '../state/usePersistence';

interface StatusBarProps {
  state: PresentationState;
  displays: DisplaysState;
  saveStatus: SaveStatus;
  version?: string;
}

function SaveIndicator({ status }: { status: SaveStatus }) {
  switch (status.kind) {
    case 'loading':
      return <span className="statusbar-item"><Save size={12} aria-hidden="true" />Loading…</span>;
    case 'saving':
      return <span className="statusbar-item"><Save size={12} aria-hidden="true" />Saving…</span>;
    case 'saved':
      return (
        <span className="statusbar-item is-ok" title={status.at ? `Last saved ${status.at.toLocaleTimeString()}` : 'Loaded from disk'}>
          <Check size={12} aria-hidden="true" />All changes saved
        </span>
      );
    case 'error':
      return (
        <span className="statusbar-item is-error" role="alert" title={status.message}>
          <Info size={12} aria-hidden="true" />Save failed: {status.message}
        </span>
      );
    case 'readonly':
      return <span className="statusbar-item is-error"><Info size={12} aria-hidden="true" />Saving is turned off</span>;
    case 'unavailable':
      return <span className="statusbar-item"><Info size={12} aria-hidden="true" />Not saved (browser preview)</span>;
  }
}

export function StatusBar({ state, displays, saveStatus, version }: StatusBarProps) {
  const live = resolvePointer(state, state.live);
  const output = state.blackout
    ? 'Output: blackout'
    : live
      ? `Live: ${live.item.title} · ${live.index + 1}/${live.item.slides.length}`
      : 'Output: clear';

  const displayText = displays.displays
    ? `${displays.displays.length} display${displays.displays.length === 1 ? '' : 's'} detected`
    : displays.error
      ? 'Display info unavailable'
      : 'Detecting displays…';

  return (
    <footer className="statusbar">
      <span className={`statusbar-item${live && !state.blackout ? ' is-live' : ''}`}>{output}</span>
      <SaveIndicator status={saveStatus} />
      <span className="statusbar-item">
        <Monitor size={12} aria-hidden="true" />
        {displayText}
      </span>
      <span className="statusbar-spacer" />
      <span className="statusbar-item statusbar-keys">
        <span className="kbd">←</span><span className="kbd">→</span> slides
        <span className="kbd">B</span> blackout
        <span className="kbd">Esc</span> clear
        <span className="kbd">F5</span> present
      </span>
      {version && <span className="statusbar-item">v{version}</span>}
    </footer>
  );
}
