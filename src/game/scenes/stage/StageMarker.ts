import { h } from '../../../ui/dom';
import { icon } from '../../../ui/icons';
import { motion } from '../../../core/motion';

/**
 * The next-thing marker for the theatre's page buttons (record, play, the
 * scene strip, drawer tiles, the story picker). It matches the canvas marker
 * that WWScene draws on stage things: a bobbing arrow and a pulsing ring.
 * It also carries a pointing hand for "show me" demos over page buttons,
 * which the canvas ghost hand can't reach (the page sits above the canvas).
 */

const STYLE_ID = 'st-marker-style';
const CSS = `
.st-marker, .st-marker *, .st-hand { pointer-events: none !important; }
.st-marker { position: absolute; left: 0; top: 0; width: 0; height: 0; }
.st-marker[hidden], .st-hand[hidden] { display: none; }
.st-marker .st-ring { position: absolute; border-radius: 50%; border: 7px solid #f5c04a;
  box-shadow: 0 0 0 4px rgba(59,42,32,.55), 0 0 26px 10px rgba(255,231,163,.8); animation: st-pulse 1.1s ease-in-out infinite; }
.st-marker .st-arrow { position: absolute; width: 84px; height: 64px; margin: -32px 0 0 -42px; }
.st-marker .st-arrow > svg { width: 84px; height: 64px; display: block; animation: st-bob .9s ease-in-out infinite; filter: drop-shadow(0 3px 0 rgba(59,42,32,.45)); }
.st-hand { position: absolute; left: 0; top: 0; width: 96px; height: 96px; opacity: 0; filter: drop-shadow(0 4px 2px rgba(0,0,0,.3)); }
.st-hand > svg { width: 96px; height: 96px; display: block; }
@keyframes st-pulse { 0%,100% { transform: scale(1); opacity: .7; } 50% { transform: scale(1.12); opacity: 1; } }
@keyframes st-bob { 0%,100% { transform: translateX(0); } 50% { transform: translateX(-14px); } }
.st-still .st-ring, .st-still .st-arrow > svg { animation: none; }
`;

const ARROW = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-40 -30 80 60" aria-hidden="true"><path d="M-34 -10 L6 -10 L6 -26 L36 0 L6 26 L6 10 L-34 10 Z" fill="#f5c04a" stroke="#3b2a20" stroke-width="4.5" stroke-linejoin="round"/></svg>`;

export class StageMarker {
  private el: HTMLElement;
  private ring: HTMLElement;
  private arrow: HTMLElement;
  private hand: HTMLElement;
  private handAnim?: Animation;
  private target: HTMLElement | null = null;
  private since = 0;

  constructor(private layer: HTMLElement) {
    if (!document.getElementById(STYLE_ID)) document.head.append(h('style', { id: STYLE_ID }, CSS));
    this.ring = h('div', { class: 'st-ring' });
    this.arrow = h('div', { class: 'st-arrow', html: ARROW });
    this.el = h('div', { class: 'st-marker', 'aria-hidden': 'true', hidden: true }, this.ring, this.arrow);
    this.hand = h('div', { class: 'st-hand', 'aria-hidden': 'true', html: icon('pointer', 96), hidden: true });
    layer.append(this.el, this.hand);
  }

  /** Mark this page element as the next thing to tap (null: no marker). Call every frame. */
  point(target: HTMLElement | null): void {
    if (target !== this.target) {
      this.target = target;
      this.since = performance.now();
    }
    const r = target && visible(target) ? target.getBoundingClientRect() : null;
    // wait a moment on a new target so the marker doesn't flicker while things change
    if (!r || performance.now() - this.since < 500) {
      this.el.hidden = true;
      return;
    }
    const L = this.layer.getBoundingClientRect();
    const cx = r.left + r.width / 2 - L.left;
    const cy = r.top + r.height / 2 - L.top;
    const size = Math.max(r.width, r.height) + 26;
    this.el.hidden = false;
    this.el.classList.toggle('st-still', motion.reduced);
    Object.assign(this.ring.style, { left: `${cx - size / 2}px`, top: `${cy - size / 2}px`, width: `${size}px`, height: `${size}px` });
    // the arrow points in from wherever there's room: the side away from a screen edge, or from above
    let ax = cx;
    let ay = cy;
    let rot = 90;
    if (r.right - L.left > L.width - 170) {
      ax = r.left - L.left - 56;
      rot = 0;
    } else if (r.left - L.left < 170) {
      ax = r.right - L.left + 56;
      rot = 180;
    } else if (r.top - L.top > 100) {
      ay = r.top - L.top - 50;
      rot = 90;
    } else {
      ay = r.bottom - L.top + 50;
      rot = -90;
    }
    Object.assign(this.arrow.style, { left: `${ax}px`, top: `${ay}px`, transform: `rotate(${rot}deg)` });
  }

  /** The pointing hand taps this element twice (a "show me" demo). */
  tap(target: HTMLElement | null): void {
    if (!target || !visible(target)) return;
    const r = target.getBoundingClientRect();
    const L = this.layer.getBoundingClientRect();
    // the fingertip is near the top middle of the hand picture
    const x = r.left + r.width / 2 - L.left - 46;
    const y = r.top + r.height / 2 - L.top - 8;
    this.handAnim?.cancel();
    this.hand.hidden = false;
    target.classList.add('glow');
    setTimeout(() => target.classList.remove('glow'), 2600);
    const at = (dx: number, dy: number, s: number, o: number) => ({ transform: `translate(${x + dx}px, ${y + dy}px) scale(${s})`, opacity: o });
    const frames = motion.reduced
      ? [at(0, 0, 1, 1), at(0, 0, 1, 1), at(0, 0, 1, 0)]
      : [at(80, 100, 1, 0), at(0, 0, 1, 1), at(0, 0, 0.84, 1), at(0, 0, 1, 1), at(0, 0, 0.84, 1), at(0, 0, 1, 1), at(0, 0, 1, 0)];
    const anim = this.hand.animate(frames, { duration: motion.reduced ? 1400 : 2000, easing: 'ease-in-out', fill: 'forwards' });
    anim.onfinish = () => (this.hand.hidden = true);
    this.handAnim = anim;
  }

  hide(): void {
    this.target = null;
    this.el.hidden = true;
  }

  destroy(): void {
    this.handAnim?.cancel();
    this.el.remove();
    this.hand.remove();
  }
}

function visible(el: HTMLElement): boolean {
  if (!el.isConnected || el.offsetParent === null) return false;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0;
}
