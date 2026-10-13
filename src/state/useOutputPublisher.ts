import { useEffect, useRef } from 'react';
import { getActivePlan, getNextPointer, resolvePointer, type PresentationState, type ResolvedSlide } from './presentation';
import type { OutputSlide, OutputSnapshot } from '../../shared/output-types';
import type { MediaItem } from '../types';
import { resolveLayout, type SlideTemplate } from '../../shared/layout';
import type { OutputOverlay } from '../../shared/overlay';
import { extrasOf } from '../../shared/extras';

/** obsTemplate: draw with this template instead of the item's own ('classic' = no template). */
function toOutputSlide(resolved: ResolvedSlide | null, templates: SlideTemplate[], obsTemplate?: string): OutputSlide | null {
  if (!resolved) return null;
  const { item, slide, index } = resolved;
  const source = obsTemplate && item.kind !== 'slides'
    ? { ...item, templateId: obsTemplate === 'classic' ? null : obsTemplate, slideLayouts: {}, slideFilters: {} }
    : item;
  const layout = resolveLayout(source, { ...slide, index }, templates);
  return {
    itemId: item.id,
    title: item.title,
    kind: item.kind,
    background: layout?.background ?? item.background,
    lines: slide.lines,
    footer: slide.footer ?? null,
    group: slide.group ?? null,
    index,
    total: item.slides.length,
    transition: item.transition,
    image: slide.image ?? null,
    columns: slide.columns ?? null,
    layout,
    chords: slide.chords ?? null,
    songKey: extrasOf(item).songKey,
    transpose: extrasOf(item).transpose
  };
}

export function buildSnapshot(state: PresentationState, media: MediaItem[]): OutputSnapshot {
  const liveResolved = resolvePointer(state, state.live);
  const live = toOutputSlide(liveResolved, state.templates);
  const next = toOutputSlide(resolvePointer(state, getNextPointer(state)), state.templates);
  const obsTemplate = state.settings.screens.obsTemplate;
  const obsLive = obsTemplate !== 'same' ? toOutputSlide(liveResolved, state.templates, obsTemplate) : undefined;
  const files: Record<string, string> = {};
  const addFile = (id: string | null) => {
    const found = id ? media.find((m) => m.id === id) : undefined;
    if (found) files[found.id] = found.fileName;
  };
  for (const slide of [live, next, obsLive ?? null]) {
    if (!slide) continue;
    if (slide.background.startsWith('media:')) addFile(slide.background.slice('media:'.length));
    for (const box of slide.layout?.boxes ?? []) if (box.role === 'image') addFile(box.mediaId);
  }
  const refText = liveResolved
    ? [liveResolved.item.title, liveResolved.slide.footer || liveResolved.item.subtitle].filter((s) => s && s.trim()).join(' · ')
    : '';
  const overlays: OutputOverlay[] = state.overlays
    .filter((o) => o.id in state.overlayOn)
    .map((o) => {
      const found = o.mediaId ? media.find((m) => m.id === o.mediaId) : undefined;
      if (found) files[found.id] = found.fileName;
      return { ...o, since: state.overlayOn[o.id], file: found?.fileName ?? null, refText };
    });
  const plan = getActivePlan(state);
  return {
    overlays,
    live,
    next,
    blackout: state.blackout,
    liveSince: state.liveSince,
    serviceName: plan ? plan.name.trim() || 'Untitled service' : '',
    notes: liveResolved?.item.notes ?? '',
    media: files,
    alert: state.alert,
    timing: liveResolved && !state.blackout ? { since: state.itemLiveSince, plannedSec: extrasOf(liveResolved.item).durationSec } : null,
    stageChords: state.settings.stageChords,
    ...(obsLive !== undefined ? { obsLive } : {}),
    screens: (({ projector, obs, stage, stageLayout, stageTextScale }) => ({ projector, obs, stage, stageLayout, stageTextScale }))(state.settings.screens),
    guide: state.screenGuide
  };
}

/** Sends the presentation state to the projector and stage windows whenever it changes. */
export function useOutputPublisher(state: PresentationState): void {
  const lastSent = useRef<string | null>(null);
  const snapshot = buildSnapshot(state, state.media);
  const json = JSON.stringify(snapshot);

  useEffect(() => {
    const bridge = window.kvlog;
    if (!bridge || !state.loaded || json === lastSent.current) return;
    lastSent.current = json;
    bridge.publishOutput(JSON.parse(json) as OutputSnapshot).catch((error: unknown) => {
      lastSent.current = null;
      console.warn('Could not update output windows:', error);
    });
  }, [json, state.loaded]);
}
