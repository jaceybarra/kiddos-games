import { h, trapFocus } from './dom';
import { icon } from './icons';
import { audio } from '../core/audio';

export interface DialogButton {
  id: string;
  icon: string;
  label: string;
  kind?: 'primary' | 'go' | 'danger' | '';
  /** optional picture (inline SVG) instead of the icon */
  art?: string;
}

/**
 * Child-facing dialog: big icon tiles, no reading required. Escape picks the
 * "stay" option (first non-danger) so nothing destructive happens by accident.
 */
export function iconDialog(layer: HTMLElement, opts: { title?: string; art?: string; buttons: DialogButton[]; safeId: string }): Promise<string> {
  return new Promise((resolve) => {
    let release = () => {};
    const close = (id: string) => {
      release();
      overlay.remove();
      resolve(id);
    };
    const tiles = opts.buttons.map((b, i) =>
      h(
        'button',
        {
          class: `tile ${b.kind ?? ''}`,
          type: 'button',
          'data-dialog': b.id,
          ...(b.id === opts.safeId || (i === 0 && !opts.safeId) ? { 'data-autofocus': true } : {}),
          on: {
            click: () => {
              audio.play(b.kind === 'danger' ? 'back' : 'confirm');
              close(b.id);
            },
          },
        },
        h('span', { class: b.art ? 'dialog-art' : '', html: b.art ?? icon(b.icon, 96) }),
        h('span', {}, b.label),
      ),
    );
    const panel = h(
      'div',
      { class: 'panel', role: 'dialog', 'aria-modal': 'true', 'aria-label': opts.title ?? 'Choose' },
      opts.title ? h('h2', { style: 'text-align:center' }, opts.title) : null,
      opts.art ? h('div', { html: opts.art, style: 'display:grid;place-items:center;margin-bottom:12px' }) : null,
      h('div', { class: 'big-choices' }, ...tiles),
    );
    const overlay = h('div', { class: 'overlay', on: { keydown: (e) => (e as KeyboardEvent).key === 'Escape' && close(opts.safeId) } }, panel);
    layer.append(overlay);
    audio.play('open');
    release = trapFocus(panel);
  });
}

export function toast(layer: HTMLElement, ic: string, text: string, ms = 2600): void {
  const t = h('div', { class: 'toast', role: 'status' }, h('span', { html: icon(ic) }), h('span', {}, text));
  layer.append(t);
  setTimeout(() => t.remove(), ms);
}
