export type PillTone = 'idle' | 'ok' | 'live' | 'warn';

interface StatusPillProps {
  label: string;
  value: string;
  tone: PillTone;
  title?: string;
}

export function StatusPill({ label, value, tone, title }: StatusPillProps) {
  return (
    <span
      className={`pill pill-${tone}`}
      title={title ? `${label}: ${value}. ${title}` : `${label}: ${value}`}
      aria-label={`${label}: ${value}`}
      role="status"
    >
      <span className="pill-dot" aria-hidden="true" />
      <span className="pill-label">{label}</span>
      <span className="pill-value">{value}</span>
    </span>
  );
}
