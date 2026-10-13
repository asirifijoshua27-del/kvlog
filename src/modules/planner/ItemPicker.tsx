import { useMemo, useState } from 'react';
import { Check, Library, Plus, Search } from 'lucide-react';
import { EmptyState, Panel } from '../../components/Panel';
import { ITEM_KINDS, KIND_META } from '../../data/kinds';
import type { ItemKind, ServiceItem, ServicePlan } from '../../types';

interface ItemPickerProps {
  library: ServiceItem[];
  plan: ServicePlan | null;
  onAdd: (itemId: string) => void;
  onCreate: (kind: ItemKind) => void;
  onEdit: (itemId: string) => void;
}

type Filter = ItemKind | 'all';

export function ItemPicker({ library, plan, onAdd, onCreate, onEdit }: ItemPickerProps) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const inPlan = new Set(plan?.itemIds ?? []);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return library
      .filter((item) => filter === 'all' || item.kind === filter)
      .filter((item) => !q || `${item.title}\n${item.subtitle}\n${item.content}`.toLowerCase().includes(q))
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [library, query, filter]);

  return (
    <Panel title="Library" icon={Library} meta={String(library.length)} className="picker-panel">
      <div className="new-grid" role="group" aria-label="Create a new item">
        {ITEM_KINDS.map((kind) => {
          const meta = KIND_META[kind];
          const Icon = meta.icon;
          return (
            <button key={kind} type="button" className="new-tile" title={`${meta.newLabel} and add it to this service`} onClick={() => onCreate(kind)}>
              <span className="new-tile-icon" aria-hidden="true">
                <Plus size={11} />
                <Icon size={14} />
              </span>
              <span>{meta.label}</span>
            </button>
          );
        })}
      </div>

      <div className="picker-tools">
        <label className="search">
          <Search size={14} aria-hidden="true" />
          <input value={query} placeholder="Search titles and lyrics" aria-label="Search the library" onChange={(e) => setQuery(e.target.value)} />
        </label>
        <div className="segmented segmented-sm" role="radiogroup" aria-label="Filter by type">
          {(['all', ...ITEM_KINDS] as Filter[]).map((f) => (
            <button key={f} type="button" role="radio" aria-checked={filter === f} className={filter === f ? 'is-active' : undefined} onClick={() => setFilter(f)}>
              {f === 'all' ? 'All' : KIND_META[f].label}
            </button>
          ))}
        </div>
      </div>

      {results.length === 0 ? (
        <EmptyState icon={Search} title={library.length === 0 ? 'The library is empty' : 'No matches'}>
          {library.length === 0 ? 'Create a song, passage or announcement above.' : 'Try a different word or filter.'}
        </EmptyState>
      ) : (
        <ul className="playlist">
          {results.map((item) => {
            const meta = KIND_META[item.kind];
            const Icon = meta.icon;
            const added = inPlan.has(item.id);
            return (
              <li key={item.id} className="picker-row" onDoubleClick={() => onEdit(item.id)}>
                <span className="playlist-icon" aria-hidden="true"><Icon size={14} /></span>
                <span className="playlist-text">
                  <span className="playlist-title">{item.title.trim() || 'Untitled'}</span>
                  <span className="playlist-sub">{item.subtitle || meta.label}</span>
                </span>
                {added ? (
                  <span className="picker-added"><Check size={13} aria-hidden="true" />Added</span>
                ) : (
                  <button type="button" className="btn btn-sm" disabled={!plan} onClick={() => onAdd(item.id)} aria-label={`Add ${item.title} to this service`}>
                    <Plus size={13} aria-hidden="true" />
                    Add
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
