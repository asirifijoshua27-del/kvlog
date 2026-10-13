import { useState, type Dispatch } from 'react';
import { ListOrdered } from 'lucide-react';
import { PlanList } from './PlanList';
import { PlanEditor } from './PlanEditor';
import { ItemPicker } from './ItemPicker';
import { EmptyState } from '../../components/Panel';
import { createItem, createPlan } from '../../data/itemFactory';
import type { PresentationAction, PresentationState } from '../../state/presentation';
import type { ItemKind } from '../../types';

interface ServicePlannerProps {
  state: PresentationState;
  dispatch: Dispatch<PresentationAction>;
  onEditItem: (itemId: string) => void;
}

export function ServicePlanner({ state, dispatch, onEditItem }: ServicePlannerProps) {
  const [viewedId, setViewedId] = useState<string | null>(state.activePlanId);
  const viewed = state.plans.find((p) => p.id === viewedId) ?? state.plans.find((p) => p.id === state.activePlanId) ?? state.plans[0] ?? null;

  const onNewPlan = () => {
    const plan = createPlan();
    dispatch({ type: 'createPlan', plan });
    setViewedId(plan.id);
  };

  const onDuplicate = () => {
    if (!viewed) return;
    const plan = createPlan({ name: `${viewed.name} (copy)`, date: viewed.date, itemIds: [...viewed.itemIds] });
    dispatch({ type: 'createPlan', plan });
    setViewedId(plan.id);
  };

  const onCreateItem = (kind: ItemKind) => {
    const item = createItem(kind);
    dispatch({ type: 'createItem', item, planId: viewed?.id ?? null });
    onEditItem(item.id);
  };

  return (
    <div className="planner">
      <PlanList plans={state.plans} viewedId={viewed?.id ?? null} activeId={state.activePlanId} onView={setViewedId} onNew={onNewPlan} />

      {viewed ? (
        <PlanEditor
          plan={viewed}
          library={state.library}
          isActive={viewed.id === state.activePlanId}
          liveItemId={state.blackout ? null : state.live?.itemId ?? null}
          onChange={(changes) => dispatch({ type: 'updatePlan', planId: viewed.id, changes })}
          onOpen={() => dispatch({ type: 'openPlan', planId: viewed.id })}
          onDuplicate={onDuplicate}
          onDelete={() => dispatch({ type: 'deletePlan', planId: viewed.id })}
          onMove={(from, to) => dispatch({ type: 'movePlanItem', planId: viewed.id, from, to })}
          onRemove={(itemId) => dispatch({ type: 'removeFromPlan', planId: viewed.id, itemId })}
          onEdit={onEditItem}
        />
      ) : (
        <section className="panel" aria-label="Service plan">
          <EmptyState
            icon={ListOrdered}
            title="No service plans"
            action={
              <button type="button" className="btn btn-primary" onClick={onNewPlan}>
                Create a service plan
              </button>
            }
          >
            A service plan is the running order for one service or event.
          </EmptyState>
        </section>
      )}

      <ItemPicker
        library={state.library}
        plan={viewed}
        onAdd={(itemId) => viewed && dispatch({ type: 'addToPlan', planId: viewed.id, itemId })}
        onCreate={onCreateItem}
        onEdit={onEditItem}
      />
    </div>
  );
}
