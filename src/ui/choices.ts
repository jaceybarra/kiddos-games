import { h } from './dom';
import { icon } from './icons';
import { audio } from '../core/audio';
import { narration } from '../core/narration';

export interface ChoiceOption {
  id: string;
  icon: string;
  /** short label (also read aloud when a local voice is available) */
  label: string;
  /** optional picture (inline SVG) shown instead of the icon, e.g. the cookie you'd get */
  art?: string;
}

/**
 * Choice tray for dialogue/action choices. Icons carry the meaning so a
 * non-reader can choose; labels are read aloud on focus/hover when possible.
 */
export class Choices {
  private el: HTMLElement;
  private resolver: ((id: string | null) => void) | null = null;
  private returnFocus: HTMLElement | null = null;
  active: ChoiceOption[] = [];

  constructor(layer: HTMLElement) {
    this.el = h('div', { class: 'choices', role: 'group', 'aria-label': 'Choices', hidden: true });
    layer.append(this.el);
  }

  ask(options: ChoiceOption[], opts: { readAloud?: boolean; captionVisible?: boolean } = {}): Promise<string | null> {
    this.cancel();
    this.active = options;
    this.el.hidden = false;
    this.el.classList.toggle('no-caption', opts.captionVisible === false);
    this.el.replaceChildren(
      ...options.map((o, i) =>
        h(
          'button',
          {
            class: 'choice',
            type: 'button',
            'data-choice': o.id,
            ...(i === 0 ? { 'data-autofocus': true } : {}),
            on: {
              click: () => {
                audio.play('confirm');
                this.finish(o.id);
              },
              focus: () => narration.available && void narration.speak(o.label, { pitch: 1.15 }),
              mouseenter: () => narration.available && void narration.speak(o.label, { pitch: 1.15 }),
            },
          },
          h('span', { class: o.art ? 'choice-art' : '', html: o.art ?? icon(o.icon) }),
          h('span', {}, o.label),
        ),
      ),
    );
    // keyboard users: move focus to the first choice so they don't have to hunt for it
    const active = document.activeElement as HTMLElement | null;
    if (active && active.tagName === 'CANVAS') {
      this.returnFocus = active;
      (this.el.querySelector('button') as HTMLButtonElement | null)?.focus({ preventScroll: true });
    }
    if (opts.readAloud && narration.available) {
      void (async () => {
        for (const o of options) {
          if (this.active !== options) return;
          await narration.speak(o.label, { pitch: 1.15 });
        }
      })();
    }
    return new Promise((resolve) => (this.resolver = resolve));
  }

  private finish(id: string | null): void {
    const r = this.resolver;
    this.resolver = null;
    this.active = [];
    const hadFocus = this.el.contains(document.activeElement);
    this.el.hidden = true;
    this.el.replaceChildren();
    if (hadFocus && this.returnFocus && document.contains(this.returnFocus)) this.returnFocus.focus({ preventScroll: true });
    this.returnFocus = null;
    r?.(id);
  }

  /** Remove the tray; a pending ask() resolves with null. */
  cancel(): void {
    if (this.resolver) this.finish(null);
    else {
      this.el.hidden = true;
      this.el.replaceChildren();
    }
  }

  get open(): boolean {
    return !!this.resolver;
  }

  /** Programmatic pick (keyboard shortcuts / tests use the DOM, this is for scripted recovery). */
  pick(id: string): void {
    if (this.active.some((o) => o.id === id)) this.finish(id);
  }
}
