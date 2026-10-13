import { MODULE_GROUPS, MODULES } from '../modules/registry';
import type { ModuleId } from '../types';
import logo from '../assets/kvlog-icon.png';

interface SidebarProps {
  active: ModuleId;
  onSelect: (id: ModuleId) => void;
}

export function Sidebar({ active, onSelect }: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <img className="brand-logo" src={logo} alt="" aria-hidden="true" draggable={false} />
        <div>
          <div className="brand-name">KVLOG</div>
          <div className="brand-sub">Production workspace</div>
        </div>
      </div>
      <nav className="nav" aria-label="Modules">
        {MODULE_GROUPS.map((group) => (
          <div className="nav-group" key={group}>
            <div className="nav-group-label">{group}</div>
            {MODULES.filter((m) => m.group === group).map((m) => {
              const Icon = m.icon;
              const isActive = m.id === active;
              return (
                <button
                  key={m.id}
                  type="button"
                  className={`nav-item${isActive ? ' is-active' : ''}`}
                  aria-current={isActive ? 'page' : undefined}
                  onClick={() => onSelect(m.id)}
                >
                  <Icon size={16} strokeWidth={1.75} aria-hidden="true" />
                  <span className="nav-label">{m.label}</span>
                  {m.status === 'planned' && (
                    <span className="nav-badge" title={`Planned for Milestone ${m.milestone}`}>M{m.milestone}</span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </nav>
    </aside>
  );
}
