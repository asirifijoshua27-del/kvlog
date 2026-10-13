import { Copy, Plus, Trash2 } from 'lucide-react';
import { ConfirmButton } from '../../components/ConfirmButton';
import { SlideView } from '../../components/SlideView';
import { BUILT_IN_TEMPLATES, type SlideTemplate } from '../../../shared/layout';
import type { ServiceItem, Slide } from '../../types';

interface TemplateDrawerProps {
  item: ServiceItem;
  slide: Slide | null;
  templates: SlideTemplate[];
  applyHint?: string;
  onApply: (templateId: string | null) => void;
  onCreate: () => void;
  onDuplicate: (template: SlideTemplate) => void;
  onDelete: (template: SlideTemplate) => void;
  usage: (templateId: string) => number;
}

/** Template picker under the slide. Each card previews the current slide with that template. */
export function TemplateDrawer({ item, slide, templates, applyHint, onApply, onCreate, onDuplicate, onDelete, usage }: TemplateDrawerProps) {
  const sample = slide ? { ...slide, index: undefined } : { id: 'sample', lines: ['Amazing grace, how sweet the sound', 'That saved a wretch like me'] };
  const card = (tpl: SlideTemplate | null, own: boolean) => {
    const id = tpl?.id ?? null;
    const active = item.templateId === id;
    const used = tpl && own ? usage(tpl.id) : 0;
    return (
      <div key={id ?? 'classic'} className={`tpl-card${active ? ' is-active' : ''}`}>
        <button type="button" className="tpl-pick" onClick={() => onApply(id)} aria-pressed={active} title={tpl ? `Use “${tpl.name}” for this item` : 'Use KVLOG’s classic look'}>
          <SlideView item={{ ...item, templateId: id, slideLayouts: {}, slideFilters: {}, deck: undefined }} slide={sample} />
          <span className="tpl-name">{tpl ? tpl.name : 'Classic'}</span>
        </button>
        {tpl && (
          <div className="tpl-tools">
            <button type="button" className="icon-btn" title="Duplicate" aria-label={`Duplicate ${tpl.name}`} onClick={() => onDuplicate(tpl)}><Copy size={12} /></button>
            {own && (
              <ConfirmButton
                className="icon-btn"
                label={<Trash2 size={12} aria-label={`Delete ${tpl.name}`} />}
                confirmLabel={used ? `Delete? ${used} item${used === 1 ? '' : 's'} go back to Classic` : 'Delete?'}
                onConfirm={() => onDelete(tpl)}
              />
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <section className="tpl-drawer" aria-label="Templates">
      <header className="tpl-head">
        <h3>Templates</h3>
        <span className="panel-meta">{applyHint ?? `Click to use for “${item.title || 'this item'}”`}</span>
        <button type="button" className="btn btn-sm tpl-new" onClick={onCreate}><Plus size={13} aria-hidden="true" />New template</button>
      </header>
      <div className="tpl-grid">
        {card(null, false)}
        {BUILT_IN_TEMPLATES.map((tpl) => card(tpl, false))}
        {templates.map((tpl) => card(tpl, true))}
      </div>
    </section>
  );
}
