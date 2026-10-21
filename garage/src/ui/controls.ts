import './hud.css';
import type { DriveInput, DriveMode } from '../core/truck';
import { button, h, icon, layer } from './dom';

type Which = 'jump' | 'brake' | 'gas';

/**
 * The driving controls.
 *
 * Pedals (he drives): a big green gas pedal in one lower corner; the jump
 * button and the brake (hold to stop, keep holding to back up) in the other.
 * Only one finger is ever needed: let go of the gas and the truck rolls on
 * while the jump is tapped. Two thumbs work too.
 *
 * Drives itself (easier): one big jump button in a lower corner and a smaller
 * brake in the other, as before.
 *
 * `side` is a grown-up setting: which corner the main button (the gas, or the
 * jump when it drives itself) sits in. Everything held is released on
 * pointercancel, blur, tab hidden, rotation and when a modal opens, so a
 * button can never stay stuck down.
 *
 * Keyboard (for grown-ups and development): → / D gas, ← / A brake and back
 * up, ↓ / S / Shift brake, Space / ↑ / W jump.
 */
export class DriveControls {
  readonly root: HTMLElement;
  readonly jumpBtn: HTMLButtonElement;
  readonly brakeBtn: HTMLButtonElement;
  readonly gasBtn: HTMLButtonElement;
  private held: Record<Which, boolean> = { jump: false, brake: false, gas: false };
  private keys: Record<Which, boolean> = { jump: false, brake: false, gas: false };
  private pointers: Record<Which, number | null> = { jump: null, brake: null, gas: null };
  private jumpEdge = false;
  private enabled = false;
  private mode: DriveMode;
  private hands: Record<'jump' | 'gas', HTMLElement>;
  private offs: (() => void)[] = [];
  /** how many jump presses were registered (tests) */
  presses = 0;
  /** how many times the gas went down (tests, and the first gas lesson) */
  gasPresses = 0;
  /** called on the frame the jump button goes down (for immediate visual feedback) */
  onJumpDown: (() => void) | null = null;
  /** called when the gas goes down */
  onGasDown: (() => void) | null = null;

  constructor(side: 'left' | 'right', mode: DriveMode = 'pedals') {
    this.mode = mode;
    this.root = h('div', { class: `drive-controls side-${side} mode-${mode}`, 'data-testid': 'drive-controls' });
    this.jumpBtn = button({ icon: 'jump', label: 'Jump (hold for a little higher)', size: 'xl', variant: 'primary', testid: 'jump', onTap: () => undefined, extraClass: 'jump-btn' });
    this.brakeBtn = button({ icon: 'brake', label: 'Brake (hold to stop)', size: 'lg', variant: 'soft', testid: 'brake', onTap: () => undefined, extraClass: 'brake-btn' });
    this.gasBtn = button({ icon: 'gas', label: 'Gas (hold to go)', size: 'xl', variant: 'plain', testid: 'gas', onTap: () => undefined, extraClass: 'gas-btn' });
    this.hands = { jump: h('div', { class: 'demo-hand', 'aria-hidden': 'true' }), gas: h('div', { class: 'demo-hand', 'aria-hidden': 'true' }) };
    this.jumpBtn.append(this.hands.jump);
    this.gasBtn.append(this.hands.gas);
    this.root.append(this.brakeBtn, this.jumpBtn, this.gasBtn);
    layer('hud').append(this.root);
    for (const w of ['jump', 'brake', 'gas'] as const) this.wireButton(w);
    this.setMode(mode);
    const key = (down: boolean) => (e: KeyboardEvent) => {
      if (e.repeat && down) return;
      const k = e.key;
      let which: Which | null = null;
      if (k === ' ' || k === 'ArrowUp' || k === 'w' || k === 'W') which = 'jump';
      else if (k === 'ArrowRight' || k === 'd' || k === 'D') which = this.mode === 'pedals' ? 'gas' : null;
      else if (k === 'ArrowDown' || k === 's' || k === 'S' || k === 'Shift' || k === 'ArrowLeft' || k === 'a' || k === 'A') which = 'brake';
      if (!which) return;
      e.preventDefault();
      if (down && !this.keys[which] && this.enabled) this.pressed(which);
      this.keys[which] = down && this.enabled;
    };
    const kd = key(true);
    const ku = key(false);
    const clear = () => this.clear();
    const vis = () => document.hidden && this.clear();
    window.addEventListener('keydown', kd);
    window.addEventListener('keyup', ku);
    window.addEventListener('blur', clear);
    window.addEventListener('pagehide', clear);
    window.addEventListener('orientationchange', clear);
    document.addEventListener('visibilitychange', vis);
    this.offs.push(
      () => window.removeEventListener('keydown', kd),
      () => window.removeEventListener('keyup', ku),
      () => window.removeEventListener('blur', clear),
      () => window.removeEventListener('pagehide', clear),
      () => window.removeEventListener('orientationchange', clear),
      () => document.removeEventListener('visibilitychange', vis),
    );
    this.show(false);
  }

  private btn(which: Which): HTMLButtonElement {
    return which === 'jump' ? this.jumpBtn : which === 'brake' ? this.brakeBtn : this.gasBtn;
  }

  private pressed(which: Which): void {
    if (which === 'jump') {
      this.jumpEdge = true;
      this.presses++;
      this.onJumpDown?.();
    } else if (which === 'gas') {
      this.gasPresses++;
      this.onGasDown?.();
    }
  }

  private wireButton(which: Which): void {
    const b = this.btn(which);
    b.addEventListener('pointerdown', (e) => {
      if (!this.enabled || e.button !== 0) return;
      e.preventDefault();
      // a second finger on the same button is ignored
      if (this.pointers[which] !== null) return;
      this.pointers[which] = e.pointerId;
      this.held[which] = true;
      this.pressed(which);
    });
    const release = (e: PointerEvent) => {
      if (e.pointerId !== this.pointers[which]) return;
      this.pointers[which] = null;
      this.held[which] = false;
    };
    b.addEventListener('pointerup', release);
    b.addEventListener('pointercancel', release);
    b.addEventListener('lostpointercapture', release);
    b.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  /** The input for this frame. The jump "pressed" edge is consumed by reading it. */
  read(): DriveInput {
    if (!this.enabled) return { jumpHeld: false, jumpPressed: false, brakeHeld: false, gasHeld: false };
    const pressed = this.jumpEdge;
    this.jumpEdge = false;
    return {
      jumpHeld: this.held.jump || this.keys.jump,
      jumpPressed: pressed,
      brakeHeld: this.held.brake || this.keys.brake,
      gasHeld: this.mode === 'pedals' && (this.held.gas || this.keys.gas),
    };
  }

  /** Are the controls taking input right now? */
  get active(): boolean {
    return this.enabled;
  }

  /** Is the jump button (or key) held right now? */
  get holding(): boolean {
    return this.held.jump || this.keys.jump;
  }

  /** Is the gas held right now? */
  get gasHeld(): boolean {
    return this.mode === 'pedals' && (this.held.gas || this.keys.gas);
  }

  /** Release everything: pointercancel, blur, hidden tab, rotation, a modal opening. */
  clear(): void {
    for (const w of ['jump', 'brake', 'gas'] as const) {
      this.held[w] = this.keys[w] = false;
      this.pointers[w] = null;
      this.btn(w).classList.remove('pressed');
    }
    this.jumpEdge = false;
  }

  /** Show for driving; hide (and release) while building, during encounters and menus. */
  show(on: boolean, opts: { brake?: boolean } = {}): void {
    this.enabled = on;
    if (!on) this.clear();
    this.root.classList.toggle('hidden', !on);
    this.brakeBtn.classList.toggle('hidden', on && opts.brake === false);
  }

  setSide(side: 'left' | 'right'): void {
    this.root.classList.toggle('side-left', side === 'left');
    this.root.classList.toggle('side-right', side === 'right');
  }

  /** Pedals or drives itself (a grown-up setting; changes which buttons show). */
  setMode(mode: DriveMode): void {
    this.mode = mode;
    this.root.classList.toggle('mode-pedals', mode === 'pedals');
    this.root.classList.toggle('mode-auto', mode === 'auto');
    this.gasBtn.classList.toggle('off', mode !== 'pedals');
    const pedals = mode === 'pedals';
    this.brakeBtn.innerHTML = icon(pedals ? 'reverse' : 'brake');
    this.brakeBtn.setAttribute('aria-label', pedals ? 'Brake (hold to stop, keep holding to back up)' : 'Brake (hold to stop)');
    if (!pedals) {
      this.held.gas = this.keys.gas = false;
      this.pointers.gas = null;
    }
  }

  get driveMode(): DriveMode {
    return this.mode;
  }

  /** A gentle "press here" cue: the dashed ring bounces around a button. */
  hint(on: boolean, which: 'jump' | 'gas' = 'jump'): void {
    this.btn(which).classList.toggle('hint', on);
    if (!on && which === 'jump') this.gasBtn.classList.remove('hint');
  }

  /** The example's helper hand presses the jump button once (picture only; no input). */
  demoTap(which: 'jump' | 'gas' = 'jump'): void {
    const hand = this.hands[which];
    hand.classList.remove('tap');
    void hand.offsetWidth;
    hand.classList.add('tap');
  }

  /** Show or hide the helper hand resting on a button. */
  demoHand(on: boolean, which: 'jump' | 'gas' = 'jump'): void {
    const hand = this.hands[which];
    hand.classList.toggle('on', on);
    if (!on) hand.classList.remove('tap');
  }

  destroy(): void {
    this.clear();
    for (const off of this.offs) off();
    this.root.remove();
  }
}
