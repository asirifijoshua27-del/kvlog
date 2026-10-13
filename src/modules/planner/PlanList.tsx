import { CalendarDays, Plus } from 'lucide-react';
import { Panel } from '../../components/Panel';
import { formatPlanDate } from '../../services/dates';
import type { ServicePlan } from '../../types';

interface PlanListProps {
  plans: ServicePlan[];
  viewedId: string | null;
  activeId: string | null;
  onView: (planId: string) => void;
  onNew: () => void;
}

export function PlanList({ plans, viewedId, activeId, onView, onNew }: PlanListProps) {
  // Newest date first; plans without a date at the end.
  const sorted = [...plans].sort((a, b) => (b.date || '0000').localeCompare(a.date || '0000'));

  return (
    <Panel
      title="Service plans"
      icon={CalendarDays}
      meta={String(plans.length)}
      className="plan-list-panel"
      actions={
        <button type="button" className="btn btn-sm" onClick={onNew}>
          <Plus size={13} aria-hidden="true" />
          New
        </button>
      }
    >
      <ol className="playlist">
        {sorted.map((plan) => {
          const isViewed = plan.id === viewedId;
          const isActive = plan.id === activeId;
          const count = plan.itemIds.length;
          return (
            <li key={plan.id}>
              <button
                type="button"
                className={`playlist-item plan-item${isViewed ? ' is-selected' : ''}`}
                aria-pressed={isViewed}
                onClick={() => onView(plan.id)}
              >
                <span className="playlist-text">
                  <span className="playlist-title">{plan.name.trim() || 'Untitled service'}</span>
                  <span className="playlist-sub">
                    {formatPlanDate(plan.date)} · {count} item{count === 1 ? '' : 's'}
                  </span>
                </span>
                <span className="playlist-side">{isActive && <span className="tag tag-next">Open</span>}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </Panel>
  );
}
