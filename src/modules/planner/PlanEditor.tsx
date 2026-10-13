import { useState, type DragEvent } from 'react';
import { ArrowDown, ArrowUp, Copy, GripVertical, ListPlus, MonitorPlay, Pencil, Trash2, X } from 'lucide-react';
import { EmptyState } from '../../components/Panel';
import { ConfirmButton } from '../../components/ConfirmButton';
import { KIND_META } from '../../data/kinds';
import type { EditablePlanFields, ServiceItem, ServicePlan } from '../../types';
import { extrasOf, formatDuration } from '../../../shared/extras';

interface PlanEditorProps {
  plan: ServicePlan;
  library: ServiceItem[];
  isActive: boolean;
  liveItemId: string | null;
  onChange: (changes: Partial<EditablePlanFields>) => void;
  onOpen: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onMove: (from: number, to: number) => void;
  onRemove: (itemId: string) => void;
  onEdit: (itemId: string) => void;
}

export function PlanEditor(props: PlanEditorProps) {
  const { plan, library, isActive, liveItemId, onChange, onOpen, onDuplicate, onDelete, onMove, onRemove, onEdit } = props;
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  /** Insertion position while dragging: 0 = before the first row, n = after the last. */
  const [dropIndex, setDropIndex] = useState<number | null>(null);

  const byId = new Map(library.map((item) => [item.id, item]));
  const rows = plan.itemIds.map((id) => byId.get(id)).filter((i): i is ServiceItem => i !== undefined);
  const slideCount = rows.reduce((total, item) => total + item.slides.length, 0);
  const plannedTotal = rows.reduce((total, item) => total + extrasOf(item).durationSec, 0);
  const startsAt: number[] = [];
  rows.reduce((t, item, i) => {
    startsAt[i] = t;
    return t + extrasOf(item).durationSec;
  }, 0);

  const resetDrag = () => {
    setDragIndex(null);
    setDropIndex(null);
  };

  const onDragOver = (event: DragEvent<HTMLLIElement>, index: number) => {
    if (dragIndex === null) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    const rect = event.currentTarget.getBoundingClientRect();
    setDropIndex(event.clientY > rect.top + rect.height / 2 ? index + 1 : index);
  };

  const onDrop = (event: DragEvent<HTMLLIElement>) => {
    event.preventDefault();
    if (dragIndex !== null && dropIndex !== null) {
      const to = dropIndex > dragIndex ? dropIndex - 1 : dropIndex;
      if (to !== dragIndex) onMove(dragIndex, to);
    }
    resetDrag();
  };

  return (
    <section className="panel plan-editor" aria-label="Service plan">
      <header className="plan-head">
        <input
          className="plan-name"
          value={plan.name}
          placeholder="Service name"
          aria-label="Service name"
          onChange={(e) => onChange({ name: e.target.value })}
        />
        <div className="plan-head-row">
          <label className="inline-field">
            <span>Date</span>
            <input className="input input-date" type="date" value={plan.date} onChange={(e) => onChange({ date: e.target.value })} />
          </label>
          <span className="panel-meta">
            {rows.length} item{rows.length === 1 ? '' : 's'} · {slideCount} slide{slideCount === 1 ? '' : 's'}
            {plannedTotal > 0 && ` · planned ${formatDuration(plannedTotal)}`}
          </span>
          <span className="spacer" />
          {isActive ? (
            <span className="tag tag-next tag-inline" title="This plan is shown in Live Studio">Open in Live Studio</span>
          ) : (
            <button type="button" className="btn btn-sm btn-primary" onClick={onOpen} title="Show this plan in Live Studio">
              <MonitorPlay size={13} aria-hidden="true" />
              Open in Live Studio
            </button>
          )}
          <button type="button" className="btn btn-sm" onClick={onDuplicate}>
            <Copy size={13} aria-hidden="true" />
            Duplicate
          </button>
          <ConfirmButton
            label={<><Trash2 size={13} aria-hidden="true" />Delete</>}
            confirmLabel="Click again to delete plan"
            onConfirm={onDelete}
            title="Deletes this plan. Songs and other items stay in the library."
          />
        </div>
      </header>

      <div className="panel-body">
        {rows.length === 0 ? (
          <EmptyState icon={ListPlus} title="This service is empty">
            Add songs, scripture and announcements from the library on the right.
          </EmptyState>
        ) : (
          <ol className="plan-rows" onDragLeave={(e) => e.currentTarget === e.target && setDropIndex(null)}>
            {rows.map((item, i) => {
              const meta = KIND_META[item.kind];
              const Icon = meta.icon;
              const isLive = item.id === liveItemId && isActive;
              const classes = [
                'plan-row',
                dragIndex === i ? 'is-dragging' : '',
                dropIndex === i && dragIndex !== null ? 'drop-before' : '',
                dropIndex === rows.length && i === rows.length - 1 && dragIndex !== null ? 'drop-after' : ''
              ].filter(Boolean).join(' ');
              return (
                <li
                  key={item.id}
                  className={classes}
                  draggable
                  onDragStart={(e) => {
                    setDragIndex(i);
                    e.dataTransfer.effectAllowed = 'move';
                    e.dataTransfer.setData('text/plain', item.id);
                  }}
                  onDragOver={(e) => onDragOver(e, i)}
                  onDrop={onDrop}
                  onDragEnd={resetDrag}
                  onDoubleClick={() => onEdit(item.id)}
                >
                  <span className="plan-grip" aria-hidden="true"><GripVertical size={14} /></span>
                  <span className="plan-index">{String(i + 1).padStart(2, '0')}</span>
                  <span className={`playlist-icon${isLive ? ' is-live' : ''}`} aria-hidden="true"><Icon size={14} /></span>
                  <span className="playlist-text">
                    <span className="playlist-title">{item.title.trim() || 'Untitled'}</span>
                    <span className="playlist-sub">
                      {meta.label}{item.subtitle ? ` · ${item.subtitle}` : ''} · {item.slides.length} slide{item.slides.length === 1 ? '' : 's'}
                      {extrasOf(item).durationSec > 0 && ` · ${formatDuration(extrasOf(item).durationSec)} (from ${formatDuration(startsAt[i])})`}
                    </span>
                  </span>
                  {isLive && <span className="tag tag-live tag-inline">Live</span>}
                  <span className="plan-actions">
                    <button type="button" className="icon-btn" aria-label={`Move ${item.title} up`} title="Move up" disabled={i === 0} onClick={() => onMove(i, i - 1)}>
                      <ArrowUp size={14} aria-hidden="true" />
                    </button>
                    <button type="button" className="icon-btn" aria-label={`Move ${item.title} down`} title="Move down" disabled={i === rows.length - 1} onClick={() => onMove(i, i + 1)}>
                      <ArrowDown size={14} aria-hidden="true" />
                    </button>
                    <button type="button" className="icon-btn" aria-label={`Edit ${item.title}`} title="Edit in Presentation Studio" onClick={() => onEdit(item.id)}>
                      <Pencil size={14} aria-hidden="true" />
                    </button>
                    <button type="button" className="icon-btn" aria-label={`Remove ${item.title} from this service`} title="Remove from this service (stays in the library)" onClick={() => onRemove(item.id)}>
                      <X size={14} aria-hidden="true" />
                    </button>
                  </span>
                </li>
              );
            })}
          </ol>
        )}
      </div>
      <div className="panel-foot">Drag items to reorder, or use the arrows. Double-click an item to edit it. Changes save automatically.</div>
    </section>
  );
}
