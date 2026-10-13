import type { LucideIcon } from 'lucide-react';
import { BookOpen, Film, LayoutPanelTop, Megaphone, Music, Presentation } from 'lucide-react';
import type { BackgroundId, ItemKind } from '../types';

export interface KindMeta {
  label: string;
  newLabel: string;
  icon: LucideIcon;
  titleLabel: string;
  subtitleLabel: string;
  contentLabel: string;
  placeholder: string;
  help: string;
  defaultTitle: string;
  defaultSubtitle: string;
  defaultBackground: BackgroundId;
}

export const ITEM_KINDS: ItemKind[] = ['song', 'scripture', 'announcement', 'slides', 'media', 'presentation'];

/** Kinds whose slides come from typed text. */
export const isTextKind = (kind: ItemKind) => kind === 'song' || kind === 'scripture' || kind === 'announcement';

/** Kinds the Slide Editor can design. */
export const isDesignable = (kind: ItemKind) => isTextKind(kind) || kind === 'slides';

export const KIND_META: Record<ItemKind, KindMeta> = {
  song: {
    label: 'Song',
    newLabel: 'New song',
    icon: Music,
    titleLabel: 'Title',
    subtitleLabel: 'Author / copyright',
    contentLabel: 'Lyrics',
    placeholder: '[Verse 1]\nFirst line of the verse\nSecond line of the verse\n\n[Chorus]\nFirst line of the chorus\nSecond line of the chorus\n\n[Chorus]',
    help: 'Leave a blank line between sections. Start a section with a label such as [Verse 1], [Chorus] or Bridge:. To repeat a section, type its label again on its own. Type --- on its own line to force a new slide.',
    defaultTitle: 'Untitled song',
    defaultSubtitle: '',
    defaultBackground: 'midnight'
  },
  scripture: {
    label: 'Scripture',
    newLabel: 'New scripture passage',
    icon: BookOpen,
    titleLabel: 'Reference',
    subtitleLabel: 'Translation',
    contentLabel: 'Passage text',
    placeholder: 'Paste the passage here.\n\nLeave a blank line where a new slide should start.',
    help: 'Each paragraph becomes one slide. The reference and translation appear at the bottom of every slide. Check that you may display the translation you use.',
    defaultTitle: 'New passage',
    defaultSubtitle: '',
    defaultBackground: 'dusk'
  },
  announcement: {
    label: 'Announcement',
    newLabel: 'New announcement',
    icon: Megaphone,
    titleLabel: 'Name',
    subtitleLabel: 'Description',
    contentLabel: 'Slide text',
    placeholder: 'Headline\nDetails on the next line\n\nNext slide headline\nMore details',
    help: 'Each paragraph becomes one slide. The first line of each slide is shown large, as the headline.',
    defaultTitle: 'New announcement',
    defaultSubtitle: 'Announcement',
    defaultBackground: 'slate'
  },
  slides: {
    label: 'Slides',
    newLabel: 'New slides (design your own)',
    icon: LayoutPanelTop,
    titleLabel: 'Name',
    subtitleLabel: 'Speaker / description',
    contentLabel: '',
    placeholder: '',
    help: 'Design each slide in the Slide Editor: text, pictures and shapes placed freely, like PowerPoint.',
    defaultTitle: 'New slides',
    defaultSubtitle: '',
    defaultBackground: 'midnight'
  },
  media: {
    label: 'Media',
    newLabel: 'New picture or video',
    icon: Film,
    titleLabel: 'Name',
    subtitleLabel: 'Description',
    contentLabel: '',
    placeholder: '',
    help: 'Shown full screen on the projector and in OBS. Videos loop until you move on. Video sound plays on this PC (projector speakers) and in OBS.',
    defaultTitle: 'New picture or video',
    defaultSubtitle: '',
    defaultBackground: 'black'
  },
  presentation: {
    label: 'Presentation',
    newLabel: 'New presentation (PowerPoint or PDF)',
    icon: Presentation,
    titleLabel: 'Name',
    subtitleLabel: 'Speaker / description',
    contentLabel: '',
    placeholder: '',
    help: 'Each slide becomes a picture, exactly as it looks in PowerPoint. Animations and videos inside slides are not kept; add videos as separate Media items.',
    defaultTitle: 'New presentation',
    defaultSubtitle: '',
    defaultBackground: 'black'
  }
};
