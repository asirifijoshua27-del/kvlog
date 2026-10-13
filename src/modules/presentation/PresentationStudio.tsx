import { useState } from 'react';
import { FilePlus } from 'lucide-react';
import type { Dispatch } from 'react';
import { LibraryPanel } from './LibraryPanel';
import { SongImportDialog } from './SongImportDialog';
import { ItemEditor } from './ItemEditor';
import { Monitor } from '../live/Monitor';
import { SlideGrid } from '../live/SlideGrid';
import { EmptyState } from '../../components/Panel';
import { TransitionView, liveSlideKey } from '../../components/TransitionView';
import { deletePages } from '../../services/mediaImport';
import { createItem } from '../../data/itemFactory';
import { describeLive, getActivePlan, getNextPointer, resolvePointer, type PresentationAction, type PresentationState } from '../../state/presentation';
import type { ItemKind } from '../../types';

interface PresentationStudioProps {
  state: PresentationState;
  dispatch: Dispatch<PresentationAction>;
  missingMedia: ReadonlySet<string>;
  obsScenes: string[];
}

export function PresentationStudio({ state, dispatch, missingMedia, obsScenes }: PresentationStudioProps) {
  const [focusTitleFor, setFocusTitleFor] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [imported, setImported] = useState<string | null>(null);
  const selected = state.library.find((i) => i.id === state.selectedItemId) ?? null;
  const live = resolvePointer(state, state.live);
  const nextPointer = getNextPointer(state);
  const activePlan = getActivePlan(state);

  const onCreate = (kind: ItemKind) => {
    const item = createItem(kind);
    dispatch({ type: 'createItem', item, planId: activePlan?.id ?? null });
    setFocusTitleFor(item.id);
  };

  return (
    <div className="studio">
      <LibraryPanel
        serviceItems={state.items}
        library={state.library}
        serviceName={activePlan ? activePlan.name.trim() || 'Untitled service' : null}
        selectedId={state.selectedItemId}
        liveItemId={state.blackout ? null : state.live?.itemId ?? null}
        onSelect={(itemId) => dispatch({ type: 'selectItem', itemId })}
        onCreate={onCreate}
        onAddToService={(itemId) => activePlan && dispatch({ type: 'addToPlan', planId: activePlan.id, itemId })}
        onImportSongs={() => setImporting(true)}
      />
      {importing && (
        <SongImportDialog
          library={state.library}
          onClose={() => setImporting(false)}
          onImport={(items) => {
            dispatch({ type: 'addItems', items });
            if (items[0]) dispatch({ type: 'selectItem', itemId: items[0].id });
            setImporting(false);
            setImported(`Added ${items.length} song${items.length === 1 ? '' : 's'} to the library. Find them under All items.`);
          }}
        />
      )}
      {imported && (
        <div className="toast" role="status">
          <p>{imported}</p>
          <button type="button" className="btn btn-sm" onClick={() => setImported(null)}>OK</button>
        </div>
      )}

      {selected ? (
        <ItemEditor
          key={selected.id}
          item={selected}
          isLive={state.live?.itemId === selected.id}
          autoFocusTitle={focusTitleFor === selected.id}
          onChange={(changes) => dispatch({ type: 'updateItem', itemId: selected.id, changes })}
          onDelete={() => {
            const pages = selected.pages;
            dispatch({ type: 'deleteItem', itemId: selected.id });
            deletePages(pages);
          }}
          media={state.media}
          missingMedia={missingMedia}
          onAddMedia={(items) => dispatch({ type: 'addMedia', items })}
          obsScenes={obsScenes}
          defaultScene={state.settings.obsSceneByKind[selected.kind] ?? null}
          obsAuto={state.settings.obsAuto}
        />
      ) : (
        <section className="panel" aria-label="Editor">
          <EmptyState icon={FilePlus} title="Nothing to edit">
            Create a song, scripture passage, announcement, picture/video or presentation to get started.
          </EmptyState>
        </section>
      )}

      <div className="studio-side">
        <Monitor label="Live output" tone="live" caption={describeLive(state)}>
          <TransitionView
            slideKey={liveSlideKey(live?.item.id, live?.index, state.blackout)}
            transition={live?.item.transition ?? 'fade'}
            item={live?.item ?? null}
            slide={live?.slide ?? null}
            blackout={state.blackout}
            playing
            since={state.liveSince}
          />
        </Monitor>
        <SlideGrid
          item={selected}
          live={state.live}
          next={nextPointer}
          onGoLive={(slideIndex) => selected && dispatch({ type: 'goLive', itemId: selected.id, slideIndex })}
        />
      </div>
    </div>
  );
}
