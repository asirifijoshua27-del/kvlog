import { Info } from 'lucide-react';
import type { ModuleMeta } from './registry';

export function PlannedModule({ meta }: { meta: ModuleMeta }) {
  const Icon = meta.icon;
  return (
    <div className="page">
      <div className="page-inner">
        <header className="page-header">
          <div className="page-icon" aria-hidden="true">
            <Icon size={20} strokeWidth={1.75} />
          </div>
          <div>
            <h2>{meta.label}</h2>
            <p>{meta.description}</p>
          </div>
        </header>

        <div className="notice">
          <Info size={16} aria-hidden="true" />
          <span>
            This module is not active yet. It is scheduled for Milestone {meta.milestone}. KVLOG only shows controls once
            they actually work.
          </span>
        </div>

        {meta.plannedFeatures && (
          <section className="card">
            <header className="card-head">
              <h3>Planned for Milestone {meta.milestone}</h3>
            </header>
            <div className="card-body">
              <ul className="feature-list">
                {meta.plannedFeatures.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
