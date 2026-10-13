/** An alert (nursery call…) across the top of the projector picture. */
export function AlertBar({ alert }: { alert: { text: string; since: number } | null | undefined }) {
  if (!alert) return null;
  return (
    <div className="alert-bar" role="status" key={alert.since}>
      <span>{alert.text}</span>
    </div>
  );
}
