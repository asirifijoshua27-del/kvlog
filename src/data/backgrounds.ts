import type { BackgroundId } from '../types';

// Built-in backgrounds. Each id has a matching .slide-bg-<id> class in styles/global.css.
// Image and video backgrounds arrive with the Media Library.
export const BACKGROUNDS: { id: BackgroundId; label: string }[] = [
  { id: 'black', label: 'Black' },
  { id: 'midnight', label: 'Midnight blue' },
  { id: 'slate', label: 'Slate' },
  { id: 'dusk', label: 'Warm dusk' }
];
