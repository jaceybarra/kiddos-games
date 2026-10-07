import { h, trapFocus } from '../dom';
import { icon } from '../icons';

const WORDS = ['eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty-one', 'twenty-three', 'thirty-two', 'forty-five'];
const VALUES = [11, 12, 13, 14, 15, 16, 17, 18, 19, 21, 23, 32, 45];

/**
 * Grown-up gear: press and hold for 2 seconds (or activate by keyboard), then
 * answer two "number written in words" questions. Keeps young children out of
 * settings by accident. It is NOT authentication and the UI says so.
 */
export function adultGateButton(onPass: () => void): HTMLElement {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const wrap = h('div', { class: 'gear-hold' });
  const btn = h('button', {
    class: 'btn-round',
    type: 'button',
    'aria-label': 'Grown-ups: press and hold',
    title: 'Grown-ups: press and hold',
    html: icon('gear'),
    'data-adult-gear': true,
  });
  const ring = h('span', { class: 'ring' });
  wrap.append(btn, ring);
  const cancel = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    wrap.classList.remove('holding');
  };
  btn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    wrap.classList.add('holding');
    timer = setTimeout(() => {
      cancel();
      void askGate().then((ok) => ok && onPass());
    }, 2000);
  });
  for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) btn.addEventListener(ev, cancel);
  btn.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      void askGate().then((ok) => ok && onPass());
    }
  });
  btn.addEventListener('contextmenu', (e) => e.preventDefault());
  return wrap;
}

export function askGate(): Promise<boolean> {
  return new Promise((resolve) => {
    const root = document.getElementById('ui-root')!;
    let step = 0;
    let release = () => {};
    const panel = h('div', { class: 'panel gate adult', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Grown-ups only', style: 'position:relative;inset:auto;max-width:520px' });
    const overlay = h('div', { class: 'overlay', style: 'z-index:45' }, panel);
    const close = (ok: boolean) => {
      release();
      overlay.remove();
      resolve(ok);
    };
    const render = () => {
      const idx = Math.floor(Math.random() * WORDS.length);
      const answer = VALUES[idx];
      const opts = new Set<number>([answer]);
      while (opts.size < 4) opts.add(VALUES[Math.floor(Math.random() * VALUES.length)]);
      const shuffled = [...opts].sort(() => Math.random() - 0.5);
      panel.replaceChildren(
        h('h2', {}, 'For grown-ups'),
        h('p', { class: 'note' }, `Question ${step + 1} of 2. This keeps settings out of reach of little fingers; it is not a password.`),
        h('div', { class: 'q' }, `Tap the number “${WORDS[idx]}”.`),
        h(
          'div',
          { class: 'opts' },
          ...shuffled.map((n) =>
            h('button', {
              type: 'button',
              'data-gate': String(n),
              on: {
                click: () => {
                  if (n !== answer) return close(false);
                  step++;
                  if (step >= 2) close(true);
                  else render();
                },
              },
            }, String(n)),
          ),
        ),
        h('p', {}, h('button', { type: 'button', on: { click: () => close(false) } }, 'Cancel')),
      );
      release();
      release = trapFocus(panel);
    };
    overlay.addEventListener('keydown', (e) => e.key === 'Escape' && close(false));
    root.append(overlay);
    render();
  });
}
