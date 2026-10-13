import { ListOrdered } from 'lucide-react';
import { EmptyState, Panel } from '../../components/Panel';
import { KIND_META } from '../../data/kinds';
import type { ServiceItem } from '../../types';

interface ServicePlaylistProps {
  items: ServiceItem[];
  planName: string | null;
  selectedId: string | null;
  liveItemId: string | null;
  onSelect: (itemId: string) => void;
  onGoLive: (itemId: string) => void;
  onOpenPlanner: () => void;
}

export function ServicePlaylist({ items, planName, selectedId, liveItemId, onSelect, onGoLive, onOpenPlanner }: ServicePlaylistProps) {
  return (
    <Panel
      title={planName ?? 'Service'}
      icon={ListOrdered}
      meta={`${items.length} item${items.length === 1 ? '' : 's'}`}
      className="playlist-panel"
      actions={
        <button type="button" className="btn btn-sm" onClick={onOpenPlanner} title="Edit the running order">
          Edit
        </button>
      }
      footer="Double-click an item to start it."
    >
      {items.length === 0 ? (
        <EmptyState
          icon={ListOrdered}
          title={planName ? 'This service is empty' : 'No service open'}
          action={
            <button type="button" className="btn" onClick={onOpenPlanner}>
              Open Service Planner
            </button>
          }
        >
          {planName ? 'Add songs, scripture and announcements in Service Planner.' : 'Create or open a service plan to get started.'}
        </EmptyState>
      ) : (
        <ol className="playlist">
          {items.map((item, i) => {
            const Icon = KIND_META[item.kind].icon;
            const isSelected = item.id === selectedId;
            const isLive = item.id === liveItemId;
            return (
              <li key={item.id}>
                <button
                  type="button"
                  className={`playlist-item${isSelected ? ' is-selected' : ''}${isLive ? ' is-live' : ''}`}
                  aria-pressed={isSelected}
                  onClick={() => onSelect(item.id)}
                  onDoubleClick={() => onGoLive(item.id)}
                >
                  <span className="playlist-icon" aria-hidden="true">
                    <Icon size={14} />
                  </span>
                  <span className="playlist-text">
                    <span className="playlist-title">{item.title.trim() || 'Untitled'}</span>
                    <span className="playlist-sub">{item.subtitle || KIND_META[item.kind].label}</span>
                  </span>
                  <span className="playlist-side">
                    {isLive ? <span className="tag tag-live">Live</span> : <span className="playlist-count">{String(i + 1).padStart(2, '0')}</span>}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      )}
    </Panel>
  );
}
