import { useEffect, useRef, type Dispatch } from 'react';
import type { PresentationAction } from './presentation';

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

interface ShortcutOptions {
  onPresent: () => void;
}

/**
 * Global presentation shortcuts:
 * arrows / Space / Page keys = slides, Enter = take Preview to Program, B = blackout, Esc = clear, F5 = full-screen output.
 * Ignored while typing in a text field (except F5).
 */
export function usePresentationShortcuts(dispatch: Dispatch<PresentationAction>, options: ShortcutOptions): void {
  const presentRef = useRef(options.onPresent);
  presentRef.current = options.onPresent;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      // The Slide Editor handles keys first (nudging boxes) and marks them as used.
      if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.key === 'F5') {
        event.preventDefault();
        presentRef.current();
        return;
      }
      if (isTypingTarget(event.target)) return;

      let action: PresentationAction | null = null;
      switch (event.key) {
        case 'ArrowRight':
        case 'ArrowDown':
        case 'PageDown':
        case ' ':
          action = { type: 'step', delta: 1 };
          break;
        case 'ArrowLeft':
        case 'ArrowUp':
        case 'PageUp':
          action = { type: 'step', delta: -1 };
          break;
        case 'b':
        case 'B':
          action = { type: 'toggleBlackout' };
          break;
        case 'Escape':
          action = { type: 'clear' };
          break;
        case 'Enter':
          // Enter on a focused button presses that button instead.
          if (event.target instanceof HTMLElement && ['BUTTON', 'A'].includes(event.target.tagName)) return;
          action = { type: 'take' };
          break;
      }
      if (action) {
        event.preventDefault();
        dispatch(action);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [dispatch]);
}
