import { h, trapFocus } from './dom';
import { icon } from './icons';
import { iconDialog } from './overlays';
import { audio } from '../core/audio';

export interface ShelfItem {
  id: string;
  name: string;
  preview?: string;
}

export interface ShelfOptions {
  layer: HTMLElement;
  label: string;
  items: () => ShelfItem[];
  displayedId: () => string | null;
  /** icon for the thumbnail when there's no preview, and for an empty shelf */
  emptyIcon: string;
  open: { label: string; run: (id: string) => void };
  edit?: { label: string; run: (id: string) => void };
  show: (id: string) => void;
  remove: (id: string) => Promise<void>;
  /** called after something was removed (e.g. to retry a save that was waiting for room) */
  onRemoved?: () => void;
  onClose?: () => void;
}

/**
 * A child's shelf of saved creations: open, change, show in the clubhouse,
 * or throw away (always asks first, with "keep it" as the safe choice).
 */
export function openShelf(o: ShelfOptions): () => void {
  const grid = h('div', { class: 'shelf-grid' });
  const panel = h('div', { class: 'panel', role: 'dialog', 'aria-modal': 'true', 'aria-label': o.label });
  const overlay = h('div', { class: 'overlay' }, panel);
  let release = () => {};
  const close = () => {
    release();
    overlay.remove();
    o.onClose?.();
  };
  const btn = (ic: string, label: string, run: () => void, extra: Record<string, unknown> = {}) =>
    h('button', { class: 'btn-round', type: 'button', 'aria-label': label, title: label, html: icon(ic), ...extra, on: { click: () => { audio.play('tap'); run(); } } });
  const render = () => {
    const items = o.items();
    const shown = o.displayedId();
    grid.replaceChildren(
      ...items.map((c) =>
        h(
          'div',
          { class: 'shelf-item', 'data-creation': c.id },
          h('button', {
            class: 'thumb',
            type: 'button',
            'aria-label': `${o.open.label}: ${c.name}`,
            html: c.preview ? `<img src="${c.preview}" alt="">` : icon(o.emptyIcon, 80),
            on: { click: () => { close(); o.open.run(c.id); } },
          }),
          h(
            'div',
            { class: 'acts' },
            o.edit ? btn('pencil', o.edit.label, () => { close(); o.edit!.run(c.id); }, { 'data-edit': true }) : null,
            btn('star', 'Show in the clubhouse', () => { o.show(c.id); audio.play('sparkle'); close(); }, { 'aria-pressed': String(shown === c.id), 'data-show': true, style: shown === c.id ? 'background:#ffe7a3' : '' }),
            btn('trash', 'Throw away', async () => {
              const pick = await iconDialog(o.layer, {
                art: c.preview ? `<img src="${c.preview}" alt="" style="width:240px;border-radius:14px;border:3px solid #3b2a20">` : undefined,
                buttons: [
                  { id: 'keep', icon: 'back', label: 'Keep it', kind: 'go' },
                  { id: 'delete', icon: 'trash', label: 'Throw away', kind: 'danger' },
                ],
                safeId: 'keep',
              });
              if (pick !== 'delete') return;
              await o.remove(c.id);
              render();
              o.onRemoved?.();
            }, { 'data-delete': true }),
          ),
        ),
      ),
    );
    if (!items.length) grid.append(h('div', { style: 'padding:30px;text-align:center', html: icon(o.emptyIcon, 120) }));
  };
  render();
  panel.append(h('div', { style: 'display:flex;justify-content:flex-end;margin-bottom:10px' }, h('button', { class: 'btn-round', type: 'button', 'aria-label': 'Close', 'data-shelf-close': true, html: icon('close'), on: { click: close } })), grid);
  overlay.addEventListener('click', (e) => e.target === overlay && close());
  overlay.addEventListener('keydown', (e) => (e as KeyboardEvent).key === 'Escape' && close());
  o.layer.append(overlay);
  release = trapFocus(panel);
  return close;
}
