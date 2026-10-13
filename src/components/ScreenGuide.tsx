/** Dashed frame, centre lines and a label, shown while adjusting the safe margins. */
export function ScreenGuide({ label }: { label: string }) {
  return (
    <div className="screen-guide" aria-hidden="true">
      <span className="screen-guide-v" />
      <span className="screen-guide-h" />
      <span className="screen-guide-label">{label}</span>
    </div>
  );
}
