import { h } from './dom';
import { icon } from './icons';
import { audio } from '../core/audio';

export type HudButton = 'home' | 'finish' | 'pause' | 'replay' | 'help';

export interface HudHandlers {
  home(): void;
  finish(): void;
  pause(): void;
  replay(): void;
  help(): void;
}

const LABELS: Record<HudButton, { icon: string; label: string }> = {
  home: { icon: 'map', label: 'Map' },
  finish: { icon: 'moon', label: 'Save and finish' },
  pause: { icon: 'pause', label: 'Pause' },
  replay: { icon: 'ear', label: 'Hear it again' },
  help: { icon: 'pointer', label: 'Show me how' },
};

/**
 * Child HUD. Positions never change between scenes: map top-left, finish and
 * pause top-right, replay bottom-left, help bottom-right.
 */
export class Hud {
  private root: HTMLElement;
  private btns = new Map<HudButton, HTMLButtonElement>();
  private extra: HTMLElement;
  private extraRight: HTMLElement;
  private badge: HTMLElement;

  constructor(layer: HTMLElement, handlers: HudHandlers) {
    const mk = (id: HudButton) => {
      const { icon: ic, label } = LABELS[id];
      const b = h('button', {
        class: 'btn-round',
        type: 'button',
        'aria-label': label,
        title: label,
        'data-hud': id,
        html: icon(ic),
        on: {
          click: () => {
            audio.play('tap');
            handlers[id]();
          },
        },
      });
      this.btns.set(id, b);
      return b;
    };
    this.extra = h('div', { class: 'bl-extra', style: 'display:flex;gap:14px' });
    this.extraRight = h('div', { class: 'br-extra', style: 'display:flex;gap:14px' });
    this.badge = h('div', { class: 'turn-badge', hidden: true, role: 'status' });
    this.root = h(
      'div',
      { class: 'hud', role: 'toolbar', 'aria-label': 'Game controls' },
      h('div', { class: 'tl' }, mk('home')),
      h('div', { class: 'tr' }, mk('finish'), mk('pause')),
      h('div', { class: 'bl' }, mk('replay'), this.extra),
      h('div', { class: 'br' }, this.extraRight, mk('help')),
      this.badge,
    );
    layer.append(this.root);
    this.show([]);
  }

  show(which: HudButton[]): void {
    for (const [id, b] of this.btns) b.hidden = !which.includes(id);
  }

  glow(id: HudButton, on: boolean): void {
    this.btns.get(id)?.classList.toggle('glow', on);
  }

  /** Extra per-game buttons next to replay (kept short). */
  setExtras(nodes: HTMLElement[], right: HTMLElement[] = []): void {
    this.extra.replaceChildren(...nodes);
    this.extraRight.replaceChildren(...right);
  }

  setTurnBadge(content: { face: string; label: string } | null): void {
    if (!content) {
      this.badge.hidden = true;
      return;
    }
    this.badge.hidden = false;
    this.badge.innerHTML = '';
    this.badge.append(h('span', { class: 'face', html: content.face }), h('span', {}, content.label));
  }

  button(id: HudButton): HTMLButtonElement | undefined {
    return this.btns.get(id);
  }
}
