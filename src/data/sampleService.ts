import type { ItemSource, MediaItem, ServicePlan } from '../types';
import { createItem, toSource } from './itemFactory';
import { nextSundayIso } from '../services/dates';

export interface SampleData {
  library: ItemSource[];
  plans: ServicePlan[];
  media: MediaItem[];
  activePlanId: string;
}

// Starter content for the very first launch. All texts are public domain.
// After that, KVLOG loads whatever you saved.
export function createSampleData(): SampleData {
  const library = [
    createItem(
      'announcement',
      { title: 'Welcome', content: "Welcome\nWe're glad you're here today\n\nService begins shortly\nPlease find a seat" },
      'welcome'
    ),
    createItem(
      'song',
      {
        title: 'Amazing Grace',
        subtitle: 'John Newton · Public domain',
        linesPerSlide: 2,
        content: [
          '[Verse 1]',
          'Amazing grace! How sweet the sound',
          'That saved a wretch like me!',
          'I once was lost, but now am found;',
          'Was blind, but now I see.',
          '',
          '[Verse 2]',
          "'Twas grace that taught my heart to fear,",
          'And grace my fears relieved;',
          'How precious did that grace appear',
          'The hour I first believed.',
          '',
          '[Verse 3]',
          'Through many dangers, toils and snares,',
          'I have already come;',
          "'Tis grace hath brought me safe thus far,",
          'And grace will lead me home.'
        ].join('\n')
      },
      'amazing-grace'
    ),
    createItem(
      'scripture',
      {
        title: 'Psalm 23:1–3',
        subtitle: 'KJV',
        content: [
          'The LORD is my shepherd; I shall not want.',
          '',
          'He maketh me to lie down in green pastures: he leadeth me beside the still waters.',
          '',
          "He restoreth my soul: he leadeth me in the paths of righteousness for his name's sake."
        ].join('\n'),
        notes: 'Read slowly. Pause after verse 1.'
      },
      'psalm-23'
    ),
    createItem(
      'song',
      {
        title: 'Holy, Holy, Holy',
        subtitle: 'Reginald Heber · Public domain',
        linesPerSlide: 2,
        content: [
          '[Verse 1]',
          'Holy, holy, holy! Lord God Almighty!',
          'Early in the morning our song shall rise to Thee;',
          'Holy, holy, holy, merciful and mighty!',
          'God in three Persons, blessed Trinity!'
        ].join('\n')
      },
      'holy-holy-holy'
    ),
    createItem('announcement', { title: 'Community Lunch', content: 'Community Lunch\nToday after the service in the main hall' }, 'lunch')
  ];

  const plan: ServicePlan = {
    id: 'sunday-service',
    name: 'Sunday Service',
    date: nextSundayIso(),
    itemIds: library.map((item) => item.id)
  };

  return { library: library.map(toSource), plans: [plan], media: [], activePlanId: plan.id };
}
