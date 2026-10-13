import { ICONS } from '../art/icons';
import type { IconName } from '../art/iconNames';

/**
 * A tiny DOM toolkit for the UI layer over the game canvas (no framework).
 * Every child-facing control is a real <button> at least 64 CSS px, with an
 * icon and an aria-label for grown-ups and screen readers. Presses show on
 * the next frame (pointerdown adds .pressed); the action fires on release
 * inside the button, so a finger can slide off to cancel.
 */
type Child = Node | string | null | undefined | false;
type Props = Record<string, unknown> & {
  class?: string;
  style?: string;
  html?: string;
  on?: Record<string, (e: Event) => void>;
};

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, props: Props = {}, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') el.className = String(v);
    else if (k === 'style') el.setAttribute('style', String(v));
    else if (k === 'html') el.innerHTML = String(v);
    else if (k === 'on') for (const [ev, fn] of Object.entries(v as Record<string, (e: Event) => void>)) el.addEventListener(ev, fn);
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    el.append(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return el;
}

export function clear(el: Element): void {
  while (el.firstChild) el.removeChild(el.firstChild);
}

export function icon(name: IconName): string {
  return ICONS[name];
}

export interface ButtonOpts {
  /** an icon name, or raw SVG markup for a picture button */
  icon: IconName | { svg: string };
  /** for grown-ups and screen readers; never needed by the child */
  label: string;
  /** xl 128px (jump, Play), lg 96px (end choices, cards), md 72px (pause, help, tools) */
  size?: 'xl' | 'lg' | 'md';
  variant?: 'primary' | 'plain' | 'go' | 'soft';
  /** data-testid for browser tests */
  testid?: string;
  onTap: () => void;
  extraClass?: string;
}

/** A big picture button. Fires on release inside, on Enter/Space, never twice for one press. */
export function button(o: ButtonOpts): HTMLButtonElement {
  const b = h('button', {
    type: 'button',
    class: `gbtn gbtn-${o.size ?? 'md'} gbtn-${o.variant ?? 'plain'} ${o.extraClass ?? ''}`,
    'aria-label': o.label,
    'data-testid': o.testid,
    html: typeof o.icon === 'string' ? ICONS[o.icon] : o.icon.svg,
  });
  let down = false;
  b.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    down = true;
    b.classList.add('pressed');
    try {
      b.setPointerCapture?.(e.pointerId);
    } catch {
      /* synthetic or already-ended pointer */
    }
  });
  const up = (e: PointerEvent, fire: boolean) => {
    if (!down) return;
    down = false;
    b.classList.remove('pressed');
    if (!fire || b.disabled) return;
    const r = b.getBoundingClientRect();
    const inside = e.clientX >= r.left - 8 && e.clientX <= r.right + 8 && e.clientY >= r.top - 8 && e.clientY <= r.bottom + 8;
    if (inside) o.onTap();
  };
  b.addEventListener('pointerup', (e) => up(e, true));
  b.addEventListener('pointercancel', (e) => up(e, false));
  b.addEventListener('lostpointercapture', () => {
    down = false;
    b.classList.remove('pressed');
  });
  // keyboard (and assistive tech): click without a preceding pointer press
  b.addEventListener('click', (e) => {
    if ((e as MouseEvent).detail === 0 && !b.disabled) o.onTap();
  });
  return b;
}

const LAYERS = ['hud', 'panel', 'overlay', 'gate', 'rotate'] as const;
export type LayerName = (typeof LAYERS)[number];

/** A full-screen layer inside #ui-root (z-order: hud < panel < overlay < gate < rotate). */
export function layer(name: LayerName): HTMLElement {
  const root = document.getElementById('ui-root');
  if (!root) throw new Error('#ui-root missing');
  let el = root.querySelector<HTMLElement>(`:scope > .layer-${name}`);
  if (!el) {
    el = h('div', { class: `layer layer-${name}`, style: `z-index:${10 + LAYERS.indexOf(name) * 10}` });
    root.append(el);
  }
  return el;
}

/** Keep keyboard focus inside a dialog while it's open; returns a release function. */
export function trapFocus(root: HTMLElement): () => void {
  const prev = document.activeElement as HTMLElement | null;
  const sel = 'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';
  const onKey = (e: KeyboardEvent) => {
    if (e.key !== 'Tab') return;
    const items = [...root.querySelectorAll<HTMLElement>(sel)].filter((x) => x.offsetParent !== null);
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };
  root.addEventListener('keydown', onKey);
  queueMicrotask(() => (root.querySelector<HTMLElement>('[data-autofocus]') ?? root.querySelector<HTMLElement>(sel))?.focus({ preventScroll: true }));
  return () => {
    root.removeEventListener('keydown', onKey);
    if (prev && document.contains(prev)) prev.focus({ preventScroll: true });
  };
}

let live: HTMLElement | null = null;
/** Polite screen-reader announcement (grown-ups using assistive tech; the child never needs it). */
export function announce(msg: string): void {
  if (!live) {
    live = h('div', { class: 'sr-only', 'aria-live': 'polite', role: 'status' });
    document.body.append(live);
  }
  live.textContent = '';
  setTimeout(() => live && (live.textContent = msg), 30);
}
