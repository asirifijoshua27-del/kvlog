import { matchesQuery } from '../../services/search';
import { useMemo, useState } from 'react';
import { FileDown, FilePlus, ListOrdered, Plus, Search } from 'lucide-react';
import { EmptyState, Panel } from '../../components/Panel';
import { ITEM_KINDS, KIND_META } from '../../data/kinds';
import type { ItemKind, ServiceItem } from '../../types';

interface LibraryPanelProps {
  serviceItems: ServiceItem[];
  library: ServiceItem[];
  serviceName: string | null;
  selectedId: string | null;
  liveItemId: string | null;
  onSelect: (itemId: string) => void;
  onCreate: (kind: ItemKind) => void;
  onAddToService: (itemId: string) => void;
  onImportSongs: () => void;
}

type Tab = 'service' | 'library';

export function LibraryPanel(props: LibraryPanelProps) {
  const { serviceItems, library, serviceName, selectedId, liveItemId, onSelect, onCreate, onAddToService, onImportSongs } = props;
  const [tab, setTab] = useState<Tab>('service');
  const [query, setQuery] = useState('');
  const inService = new Set(serviceItems.map((i) => i.id));

  const libraryResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...library]
      .filter((item) => !q || matchesQuery(`${item.title}\n${item.subtitle}\n${item.content}`, q))
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [library, query]);

  const list = tab === 'service' ? serviceItems : libraryResults;

  return (
    <Panel
      title={tab === 'service' ? serviceName ?? 'No service open' : 'Library'}
      icon={ListOrdered}
      meta={String(list.length)}
      className="library-panel"
      footer={serviceName ? `New items are added to the end of “${serviceName}”.` : 'New items are added to the library only.'}
    >
      <div className="tabs" role="tablist" aria-label="Item lists">
        <button type="button" role="tab" aria-selected={tab === 'service'} className={`tab${tab === 'service' ? ' is-active' : ''}`} onClick={() => setTab('service')}>
          This service
        </button>
        <button type="button" role="tab" aria-selected={tab === 'library'} className={`tab${tab === 'library' ? ' is-active' : ''}`} onClick={() => setTab('library')}>
          All items
        </button>
      </div>

      <div className="new-grid" role="group" aria-label="Create a new item">
        {ITEM_KINDS.map((kind) => {
          const meta = KIND_META[kind];
          const Icon = meta.icon;
          return (
            <button key={kind} type="button" className="new-tile" title={meta.newLabel} onClick={() => onCreate(kind)}>
              <span className="new-tile-icon" aria-hidden="true">
                <Plus size={11} />
                <Icon size={14} />
              </span>
              <span>{meta.label}</span>
            </button>
          );
        })}
      </div>

      <div className="library-import">
        <button type="button" className="btn btn-sm" onClick={onImportSongs} disabled={!window.kvlog} title="Text, OpenLyrics, OpenLP, EasyWorship, ProPresenter, ChordPro, Word and PowerPoint">
          <FileDown size={13} aria-hidden="true" />
          Import songs
        </button>
      </div>

      {tab === 'library' && (
        <div className="picker-tools">
          <label className="search">
            <Search size={14} aria-hidden="true" />
            <input value={query} placeholder="Search titles and lyrics" aria-label="Search all items" onChange={(e) => setQuery(e.target.value)} />
          </label>
        </div>
      )}

      {list.length === 0 ? (
        <EmptyState icon={FilePlus} title={tab === 'service' ? 'This service is empty' : 'Nothing found'}>
          {tab === 'service' ? 'Create an item above, or add existing ones in Service Planner.' : 'Try a different search.'}
        </EmptyState>
      ) : (
        <ol className="playlist">
          {list.map((item) => {
            const meta = KIND_META[item.kind];
            const Icon = meta.icon;
            const isSelected = item.id === selectedId;
            const isLive = item.id === liveItemId;
            const count = item.slides.length;
            const canAdd = tab === 'library' && serviceName !== null && !inService.has(item.id);
            return (
              <li key={item.id} className="library-row">
                <button
                  type="button"
                  className={`playlist-item${isSelected ? ' is-selected' : ''}${isLive ? ' is-live' : ''}`}
                  aria-pressed={isSelected}
                  onClick={() => onSelect(item.id)}
                >
                  <span className="playlist-icon" aria-hidden="true">
                    <Icon size={14} />
                  </span>
                  <span className="playlist-text">
                    <span className="playlist-title">{item.title.trim() || 'Untitled'}</span>
                    <span className="playlist-sub">
                      {meta.label} · {count} slide{count === 1 ? '' : 's'}
                    </span>
                  </span>
                  <span className="playlist-side">{isLive && <span className="tag tag-live">Live</span>}</span>
                </button>
                {canAdd && (
                  <button type="button" className="icon-btn library-add" title="Add to this service" aria-label={`Add ${item.title} to this service`} onClick={() => onAddToService(item.id)}>
                    <Plus size={14} aria-hidden="true" />
                  </button>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </Panel>
  );
}
