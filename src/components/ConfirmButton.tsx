import { useEffect, useState, type ReactNode } from 'react';

interface ConfirmButtonProps {
  label: ReactNode;
  confirmLabel: ReactNode;
  onConfirm: () => void;
  className?: string;
  title?: string;
  disabled?: boolean;
}

/** A button that needs a second click within 3 seconds. Used for destructive actions. */
export function ConfirmButton({ label, confirmLabel, onConfirm, className = 'btn btn-sm', title, disabled = false }: ConfirmButtonProps) {
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    if (disabled) setArmed(false);
  }, [disabled]);

  useEffect(() => {
    if (!armed) return;
    const timer = window.setTimeout(() => setArmed(false), 3000);
    return () => window.clearTimeout(timer);
  }, [armed]);

  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      className={`${className}${armed ? ' btn-danger' : ''}`}
      onClick={() => {
        if (armed) {
          setArmed(false);
          onConfirm();
        } else {
          setArmed(true);
        }
      }}
    >
      {armed ? confirmLabel : label}
    </button>
  );
}
