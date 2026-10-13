import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

interface PanelProps {
  title: string;
  icon?: LucideIcon;
  meta?: ReactNode;
  actions?: ReactNode;
  className?: string;
  footer?: ReactNode;
  children: ReactNode;
}

export function Panel({ title, icon: Icon, meta, actions, className, footer, children }: PanelProps) {
  return (
    <section className={`panel${className ? ` ${className}` : ''}`} aria-label={title}>
      <header className="panel-head">
        {Icon && <Icon size={14} aria-hidden="true" />}
        <h2>{title}</h2>
        {meta && <span className="panel-meta">{meta}</span>}
        {actions && <div className="panel-actions">{actions}</div>}
      </header>
      <div className="panel-body">{children}</div>
      {footer && <div className="panel-foot">{footer}</div>}
    </section>
  );
}

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  children: ReactNode;
  action?: ReactNode;
}

export function EmptyState({ icon: Icon, title, children, action }: EmptyStateProps) {
  return (
    <div className="empty">
      <Icon size={22} strokeWidth={1.5} aria-hidden="true" />
      <h3>{title}</h3>
      <p>{children}</p>
      {action}
    </div>
  );
}
