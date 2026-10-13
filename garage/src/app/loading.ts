import { h, icon } from '../ui/dom';

/**
 * The loading screen: the garage icon and a chunky progress bar (no words
 * needed). Exposed as window.__garageLoading so the boot scene can move it.
 */
export class Loading {
  private el: HTMLElement;
  private bar: HTMLElement;
  private track: HTMLElement;

  constructor() {
    this.bar = h('div', { class: 'loading-fill' });
    this.track = h('div', { class: 'loading-track', role: 'progressbar', 'aria-label': 'Loading the garage', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': '0' }, this.bar);
    this.el = h('div', { class: 'loading', 'data-testid': 'loading' }, h('div', { class: 'loading-icon anim-pulse', html: icon('garage') }), this.track);
    document.body.append(this.el);
    (window as unknown as { __garageLoading?: Loading }).__garageLoading = this;
  }

  setProgress(p: number): void {
    const v = Math.max(0, Math.min(1, p));
    this.bar.style.width = `${Math.round(8 + v * 92)}%`;
    this.track.setAttribute('aria-valuenow', String(Math.round(v * 100)));
  }

  done(reduced: boolean): void {
    if (!this.el.isConnected) return;
    if (reduced) {
      this.el.remove();
      return;
    }
    this.el.classList.add('out');
    setTimeout(() => this.el.remove(), 320);
  }
}
