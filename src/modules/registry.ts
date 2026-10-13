import type { LucideIcon } from 'lucide-react';
import { BookOpen, Images, Layers2, LayoutTemplate, ListOrdered, Monitor, Presentation, Radio, RadioTower, Settings } from 'lucide-react';
import type { ModuleId } from '../types';

export type ModuleGroup = 'Production' | 'Presentation' | 'System';
export type ModuleStatus = 'ready' | 'partial' | 'planned';

export interface ModuleMeta {
  id: ModuleId;
  label: string;
  group: ModuleGroup;
  icon: LucideIcon;
  description: string;
  status: ModuleStatus;
  milestone?: number;
  plannedFeatures?: string[];
}

export const MODULE_GROUPS: ModuleGroup[] = ['Production', 'Presentation', 'System'];

export const MODULES: ModuleMeta[] = [
  {
    id: 'live',
    label: 'Live Studio',
    group: 'Production',
    icon: Radio,
    description: 'Run the service: send slides live, watch output and production status.',
    status: 'partial'
  },
  {
    id: 'broadcast',
    label: 'Broadcast',
    group: 'Production',
    icon: RadioTower,
    description: 'OBS connection, streaming and recording status.',
    status: 'partial'
  },
  {
    id: 'overlays',
    label: 'Overlays',
    group: 'Production',
    icon: Layers2,
    description: 'Logo, lower thirds, clock, countdown, ticker, song/verse bar and picture-in-picture.',
    status: 'ready'
  },
  {
    id: 'bible',
    label: 'Bible',
    group: 'Presentation',
    icon: BookOpen,
    description: 'Find any verse, show it live, or add it to the service.',
    status: 'ready'
  },
  {
    id: 'edit',
    label: 'Slide Editor',
    group: 'Presentation',
    icon: LayoutTemplate,
    description: 'Design how slides look: move text, add pictures and shapes, make templates.',
    status: 'ready'
  },
  {
    id: 'presentation',
    label: 'Presentation Studio',
    group: 'Presentation',
    icon: Presentation,
    description: 'Write songs, scripture and announcements. Slides update as you type.',
    status: 'partial'
  },
  {
    id: 'planner',
    label: 'Service Planner',
    group: 'Presentation',
    icon: ListOrdered,
    description: 'Build, reorder and open service plans. Everything saves automatically.',
    status: 'ready'
  },
  {
    id: 'media',
    label: 'Media Library',
    group: 'Presentation',
    icon: Images,
    description: 'Pictures and videos for the service, and slide backgrounds.',
    status: 'partial'
  },
  {
    id: 'displays',
    label: 'Display Manager',
    group: 'Presentation',
    icon: Monitor,
    description: 'Projector and stage display screens.',
    status: 'ready'
  },
  {
    id: 'settings',
    label: 'Settings',
    group: 'System',
    icon: Settings,
    description: 'Application information, security and shortcuts.',
    status: 'partial'
  }
];
