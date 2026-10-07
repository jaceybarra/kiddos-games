import { h } from './dom';
import { icon } from './icons';

/**
 * Caption bar: who is speaking (portrait) + short text + "hear again".
 * Text can be switched off in the adult area; the portrait still shows who talks.
 */
export class Captions {
  private el: HTMLElement;
  private who: HTMLElement;
  private text: HTMLElement;
  private timer: ReturnType<typeof setTimeout> | null = null;
  showText = true;
  onReplay: () => void = () => {};

  constructor(layer: HTMLElement) {
    this.who = h('div', { class: 'who' });
    this.text = h('div', { class: 'text', 'aria-live': 'polite' });
    const replay = h('button', {
      class: 'btn-round',
      type: 'button',
      'aria-label': 'Hear it again',
      html: icon('replay'),
      on: { click: () => this.onReplay() },
    });
    this.el = h('div', { class: 'captions hidden', role: 'region', 'aria-label': 'Captions' }, this.who, this.text, replay);
    layer.append(this.el);
  }

  show(portrait: string, text: string, ms: number): void {
    if (this.timer) clearTimeout(this.timer);
    this.who.innerHTML = portrait;
    this.text.textContent = this.showText ? text : '';
    this.text.classList.toggle('sr-only', !this.showText);
    this.el.classList.remove('hidden');
    if (ms > 0) this.timer = setTimeout(() => this.hide(), ms);
  }

  hide(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.el.classList.add('hidden');
  }

  /** Lift the caption bar above a bottom toolbar (Tinker tray etc.). */
  setRaised(on: boolean): void {
    this.el.classList.toggle('raised', on);
  }

  get visible(): boolean {
    return !this.el.classList.contains('hidden');
  }
}
