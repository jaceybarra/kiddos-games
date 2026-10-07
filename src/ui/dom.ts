/** Tiny DOM helper for the accessible UI layer (no framework needed). */

type Child = Node | string | null | undefined | false;
type Props = Record<string, unknown> & {
  class?: string;
  style?: Partial<CSSStyleDeclaration> | string;
  html?: string;
  on?: Record<string, (e: Event) => void>;
};

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, props: Props = {}, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') el.className = String(v);
    else if (k === 'style') {
      if (typeof v === 'string') el.setAttribute('style', v);
      else Object.assign(el.style, v);
    } else if (k === 'html') el.innerHTML = String(v);
    else if (k === 'on') {
      for (const [ev, fn] of Object.entries(v as Record<string, (e: Event) => void>)) el.addEventListener(ev, fn);
    } else if (k in el && typeof v !== 'string') {
      (el as unknown as Record<string, unknown>)[k] = v;
    } else el.setAttribute(k, v === true ? '' : String(v));
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

/** Keep keyboard focus inside a dialog while it's open; returns a release fn. */
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
  queueMicrotask(() => {
    const auto = root.querySelector<HTMLElement>('[data-autofocus]') ?? root.querySelector<HTMLElement>(sel);
    auto?.focus();
  });
  return () => {
    root.removeEventListener('keydown', onKey);
    if (prev && document.contains(prev)) prev.focus();
  };
}

/** Announce a short message to screen readers (polite). */
let live: HTMLElement | null = null;
export function announce(msg: string): void {
  if (!live) {
    live = h('div', { class: 'sr-only', 'aria-live': 'polite', role: 'status' });
    document.body.append(live);
  }
  live.textContent = '';
  setTimeout(() => live && (live.textContent = msg), 30);
}
