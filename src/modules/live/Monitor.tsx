import type { ReactNode } from 'react';

interface MonitorProps {
  label: string;
  tone: 'live' | 'next' | 'obs';
  caption: string;
  /** Optional control shown at the right of the header. */
  action?: ReactNode;
  children: ReactNode;
}

export function Monitor({ label, tone, caption, action, children }: MonitorProps) {
  return (
    <section className={`monitor monitor-${tone}`} aria-label={label}>
      <header className="monitor-head">
        <span className="monitor-label">
          <span className="monitor-dot" aria-hidden="true" />
          {label}
        </span>
        <span className="monitor-caption">{caption}</span>
        {action}
      </header>
      <div className="monitor-screen">{children}</div>
    </section>
  );
}
