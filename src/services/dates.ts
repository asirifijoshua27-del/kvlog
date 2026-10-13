const pad = (n: number) => String(n).padStart(2, '0');

/** A local date as YYYY-MM-DD. */
export function toIsoDate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function todayIso(): string {
  return toIsoDate(new Date());
}

/** Today if it is Sunday, otherwise the coming Sunday. */
export function nextSundayIso(): string {
  const date = new Date();
  date.setDate(date.getDate() + ((7 - date.getDay()) % 7));
  return toIsoDate(date);
}

export function formatPlanDate(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return 'No date';
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}
