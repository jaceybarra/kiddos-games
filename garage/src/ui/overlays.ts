import { rotatePicture, restPicture } from '../art/pictures';
import { button, h, layer, trapFocus } from './dom';
import './overlays.css';

/**
 * Child-facing overlays: the pause menu, big picture choices, the end-of-
 * mission choices and the turn-your-tablet card. Pictures, no words; every
 * button is big, and each fires once.
 */
function reduced(): boolean {
  return document.documentElement.classList.contains('motion-reduced');
}

export interface PauseMenuOpts {
  onResume: () => void;
  onRetry: () => void;
  onGarage: () => void;
}

/** Opens the pause menu; returns a function that closes it (without firing anything). */
export function showPauseMenu(o: PauseMenuOpts): () => void {
  let done = false;
  let release = () => undefined as void;
  const close = () => {
    if (done) return;
    done = true;
    release();
    window.removeEventListener('keydown', onKey);
    wrap.remove();
  };
  const fire = (fn: () => void) => () => {
    if (done) return;
    close();
    fn();
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
      e.preventDefault();
      fire(o.onResume)();
    }
  };
  const resume = button({ icon: 'play', label: 'Keep playing', size: 'xl', variant: 'primary', testid: 'pause-resume', onTap: fire(o.onResume) });
  resume.setAttribute('data-autofocus', '');
  const panel = h(
    'div',
    { class: 'ov-panel pause-panel', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Paused' },
    h('div', { class: 'pause-row' }, button({ icon: 'replay', label: 'Start this drive again', size: 'lg', variant: 'soft', testid: 'pause-retry', onTap: fire(o.onRetry) }), resume, button({ icon: 'garage', label: 'Back to the garage', size: 'lg', variant: 'soft', testid: 'pause-garage', onTap: fire(o.onGarage) })),
  );
  const wrap = h('div', { class: 'ov-backdrop', 'data-testid': 'pause-menu' }, panel);
  layer('overlay').append(wrap);
  release = trapFocus(panel);
  // a key press already held (Escape) must not instantly resume
  setTimeout(() => window.addEventListener('keydown', onKey), 150);
  return close;
}

export interface PictureChoice {
  id: string;
  /** inline svg (animated pictures use anim-* classes) */
  picture: string;
  /** aria-label for grown-ups */
  label: string;
}

/** Big equal picture cards, no text. Resolves with the tapped id. `close()` removes it early. */
export function showChoice(choices: PictureChoice[], opts: { testid: string }): { picked: Promise<string>; close: () => void } {
  let resolve!: (id: string) => void;
  const picked = new Promise<string>((r) => (resolve = r));
  let done = false;
  let release = () => undefined as void;
  const row = h('div', { class: 'choice-row' });
  const wrap = h('div', { class: 'ov-backdrop soft', 'data-testid': opts.testid, role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Choose one' }, row);
  const close = () => {
    if (!wrap.isConnected) return;
    done = true;
    release();
    wrap.remove();
  };
  choices.forEach((c, i) => {
    const b = button({
      icon: { svg: c.picture },
      label: c.label,
      size: 'lg',
      variant: 'plain',
      testid: `${opts.testid}-${c.id}`,
      extraClass: `choice-card anim-bob ${i === 1 ? 'anim-delay-2' : ''}`,
      onTap: () => {
        if (done) return;
        done = true;
        b.classList.add('chosen');
        for (const other of row.querySelectorAll('.choice-card')) if (other !== b) other.classList.add('faded');
        resolve(c.id);
        setTimeout(() => close(), reduced() ? 0 : 420);
      },
    });
    row.append(b);
  });
  layer('overlay').append(wrap);
  release = trapFocus(wrap);
  return { picked, close };
}

export type EndChoice = 'replay' | 'garage' | 'done';

/** Three equal buttons: Replay, Garage, Done. `reminder` adds the gentle rest picture above them. */
export function showEndChoices(opts: { reminder: boolean }): { picked: Promise<EndChoice>; close: () => void } {
  let resolve!: (c: EndChoice) => void;
  const picked = new Promise<EndChoice>((r) => (resolve = r));
  let done = false;
  let release = () => undefined as void;
  const fire = (c: EndChoice) => () => {
    if (done) return;
    done = true;
    close();
    resolve(c);
  };
  const row = h(
    'div',
    { class: 'end-row' },
    button({ icon: 'replay', label: 'Play this mission again', size: 'lg', variant: 'plain', testid: 'end-replay', extraClass: 'end-btn', onTap: fire('replay') }),
    button({ icon: 'garage', label: 'Go to the garage', size: 'lg', variant: 'plain', testid: 'end-garage', extraClass: 'end-btn', onTap: fire('garage') }),
    button({ icon: 'done', label: 'All done for now', size: 'lg', variant: 'plain', testid: 'end-done', extraClass: 'end-btn', onTap: fire('done') }),
  );
  const wrap = h(
    'div',
    { class: 'end-wrap', 'data-testid': 'end-choices', role: 'group', 'aria-label': 'What next?' },
    opts.reminder ? h('div', { class: 'rest-card', 'data-testid': 'rest-reminder', role: 'img', 'aria-label': 'It might be a good time for a break', html: restPicture() }) : null,
    row,
  );
  const close = () => {
    release();
    wrap.remove();
  };
  layer('overlay').append(wrap);
  release = trapFocus(wrap);
  return { picked, close };
}

/** Shows the turn-your-tablet picture in portrait; calls back on each change. */
export class RotateGuard {
  private el: HTMLElement | null = null;
  private isPortrait = false;
  private readonly onChange = () => this.check(false);
  private mq: MediaQueryList | null = typeof matchMedia === 'function' ? matchMedia('(orientation: portrait)') : null;

  constructor(
    private onPortrait: () => void,
    private onLandscape: () => void,
  ) {
    window.addEventListener('resize', this.onChange);
    window.addEventListener('orientationchange', this.onChange);
    this.mq?.addEventListener?.('change', this.onChange);
    this.check(true);
  }

  get portrait(): boolean {
    return this.isPortrait;
  }

  private check(first: boolean): void {
    const p = window.innerHeight > window.innerWidth * 1.05;
    if (p === this.isPortrait && !first) return;
    const was = this.isPortrait;
    this.isPortrait = p;
    if (p) {
      this.show();
      if (!was || first) this.onPortrait();
    } else {
      this.hide();
      if (was) this.onLandscape();
    }
  }

  private show(): void {
    if (this.el) return;
    this.el = h(
      'div',
      { class: 'rotate-card', 'data-testid': 'rotate', role: 'alert' },
      h('div', { class: 'rotate-pic', html: rotatePicture() }),
      h('p', { class: 'rotate-note' }, 'Turn the tablet sideways to keep playing'),
    );
    layer('rotate').append(this.el);
  }

  private hide(): void {
    this.el?.remove();
    this.el = null;
  }

  destroy(): void {
    window.removeEventListener('resize', this.onChange);
    window.removeEventListener('orientationchange', this.onChange);
    this.mq?.removeEventListener?.('change', this.onChange);
    this.hide();
  }
}
