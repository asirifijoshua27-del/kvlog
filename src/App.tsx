import { useCallback, useEffect, useReducer, useState } from 'react';
import { Info, X } from 'lucide-react';
import { Sidebar } from './components/Sidebar';
import { Toolbar } from './components/Toolbar';
import { StatusBar } from './components/StatusBar';
import { OutputView } from './components/OutputView';
import { LiveStudio } from './modules/live/LiveStudio';
import { PresentationStudio } from './modules/presentation/PresentationStudio';
import { ServicePlanner } from './modules/planner/ServicePlanner';
import { DisplayManager } from './modules/displays/DisplayManager';
import { MediaLibrary } from './modules/media/MediaLibrary';
import { BiblePage } from './modules/bible/BiblePage';
import { MediaContext } from './components/MediaContext';
import { TemplatesContext } from './components/TemplatesContext';
import { SlideEditor } from './modules/edit/SlideEditor';
import { OverlaysPage } from './modules/overlays/OverlaysPage';
import { useOverlayAutoHide } from './state/useOverlayAutoHide';
import { useLiveAutomation } from './state/useLiveAutomation';
import { useOutputs } from './services/outputs';
import { useOutputPublisher } from './state/useOutputPublisher';
import { useMediaStatus } from './state/useMediaStatus';
import { useObs } from './services/obs';
import { useUpdates } from './services/updates';
import { BroadcastManager } from './modules/broadcast/BroadcastManager';
import { SettingsView } from './modules/settings/SettingsView';
import { PlannedModule } from './modules/PlannedModule';
import { MODULES } from './modules/registry';
import { createInitialState, presentationReducer } from './state/presentation';
import { usePresentationShortcuts } from './state/usePresentationShortcuts';
import { usePersistence } from './state/usePersistence';
import { setWindowFullScreen, useAppInfo, useDisplays } from './services/desktopBridge';
import type { ModuleId } from './types';

const NAV_HIDDEN_KEY = 'kvlog.navHidden';

function readNavHidden(): boolean {
  try {
    return localStorage.getItem(NAV_HIDDEN_KEY) === '1';
  } catch {
    return false;
  }
}

export default function App() {
  const [activeModule, setActiveModule] = useState<ModuleId>('live');
  const [navHidden, setNavHidden] = useState(readNavHidden);
  const toggleNav = useCallback(() => {
    setNavHidden((hidden) => {
      try {
        localStorage.setItem(NAV_HIDDEN_KEY, hidden ? '0' : '1');
      } catch {
        // Only kept for this session.
      }
      return !hidden;
    });
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === '\\') {
        e.preventDefault();
        toggleNav();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggleNav]);
  const [presentation, dispatch] = useReducer(presentationReducer, undefined, createInitialState);
  const [outputOpen, setOutputOpen] = useState(false);
  const displays = useDisplays();
  const appInfo = useAppInfo();
  const persistence = usePersistence(presentation, dispatch);
  const outputs = useOutputs();
  const obs = useObs();
  const updates = useUpdates();
  const [updateSeen, setUpdateSeen] = useState<string | null>(null);
  const mediaStatus = useMediaStatus(presentation.media);
  useOutputPublisher(presentation);
  useOverlayAutoHide(presentation, dispatch);
  useLiveAutomation(presentation, obs);

  const projectorOn = outputs.status?.projector.open ?? outputOpen;
  const { toggle: toggleOutput } = outputs;
  const hasOutputWindows = outputs.status !== null;

  // In the desktop app, Present opens the projector window. In a browser, it shows the output in this window.
  const openOutput = useCallback(() => {
    if (hasOutputWindows) {
      toggleOutput('projector');
      return;
    }
    setOutputOpen(true);
    void setWindowFullScreen(true);
  }, [hasOutputWindows, toggleOutput]);
  const closeOutput = useCallback(() => {
    setOutputOpen(false);
    void setWindowFullScreen(false);
  }, []);

  const editItem = useCallback((itemId: string) => {
    dispatch({ type: 'selectItem', itemId });
    setActiveModule('presentation');
  }, []);

  usePresentationShortcuts(dispatch, { onPresent: openOutput });

  if (!presentation.loaded) {
    return (
      <div className="splash" role="status">
        <div className="brand-mark" aria-hidden="true">KV</div>
        <span>Loading your library…</span>
      </div>
    );
  }

  const meta = MODULES.find((m) => m.id === activeModule) ?? MODULES[0];

  let content: JSX.Element;
  switch (meta.id) {
    case 'live':
      content = <LiveStudio state={presentation} dispatch={dispatch} onNavigate={setActiveModule} obs={obs} />;
      break;
    case 'overlays':
      content = <OverlaysPage meta={meta} state={presentation} dispatch={dispatch} />;
      break;
    case 'bible':
      content = <BiblePage state={presentation} dispatch={dispatch} />;
      break;
    case 'edit':
      content = <SlideEditor state={presentation} dispatch={dispatch} />;
      break;
    case 'presentation':
      content = <PresentationStudio state={presentation} dispatch={dispatch} missingMedia={mediaStatus.missing} obsScenes={obs.state?.scenes.map((s) => s.name) ?? []} />;
      break;
    case 'planner':
      content = <ServicePlanner state={presentation} dispatch={dispatch} onEditItem={editItem} />;
      break;
    case 'displays':
      content = <DisplayManager meta={meta} displays={displays} outputs={outputs} state={presentation} dispatch={dispatch} />;
      break;
    case 'broadcast':
      content = <BroadcastManager meta={meta} obs={obs} state={presentation} dispatch={dispatch} />;
      break;
    case 'media':
      content = <MediaLibrary meta={meta} state={presentation} dispatch={dispatch} mediaStatus={mediaStatus} />;
      break;
    case 'settings':
      content = (
        <SettingsView
          meta={meta}
          appInfo={appInfo}
          persistence={persistence}
          state={presentation}
          dispatch={dispatch}
          counts={{ items: presentation.library.length, plans: presentation.plans.length }}
          updates={updates}
        />
      );
      break;
    default:
      content = <PlannedModule meta={meta} />;
  }

  return (
    <MediaContext.Provider value={mediaStatus}>
    <TemplatesContext.Provider value={presentation.templates}>
    <div className={`app${navHidden ? ' nav-hidden' : ''}`}>
      {!navHidden && <Sidebar active={activeModule} onSelect={setActiveModule} />}
      <Toolbar title={meta.label} description={meta.description} state={presentation} dispatch={dispatch} onPresent={openOutput} presenting={projectorOn} obs={obs.state} navHidden={navHidden} onToggleNav={toggleNav} />
      <main className="workspace">{content}</main>
      <StatusBar state={presentation} displays={displays} saveStatus={persistence.status} version={appInfo.info?.version} />
      {persistence.notice && (
        <div className="toast" role="alert">
          <Info size={16} aria-hidden="true" />
          <p>{persistence.notice}</p>
          <button type="button" className="icon-btn" aria-label="Dismiss" onClick={persistence.dismissNotice}>
            <X size={14} aria-hidden="true" />
          </button>
        </div>
      )}
      {updates?.status === 'ready' && updates.version !== updateSeen && (
        <div className="toast toast-update" role="status">
          <Info size={16} aria-hidden="true" />
          <p>KVLOG {updates.version} is ready. It installs when you close KVLOG after the service.</p>
          <button type="button" className="btn btn-sm" onClick={() => setActiveModule('settings')}>Details</button>
          <button type="button" className="icon-btn" aria-label="Dismiss" onClick={() => setUpdateSeen(updates.version)}>
            <X size={14} aria-hidden="true" />
          </button>
        </div>
      )}
      {outputOpen && <OutputView state={presentation} onClose={closeOutput} />}
    </div>
    </TemplatesContext.Provider>
    </MediaContext.Provider>
  );
}
