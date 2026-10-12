import './hud.css';
import type { DriveInput } from '../core/truck';
import { button, h, layer } from './dom';

/**
 * The driving controls: one big jump button in a lower corner (side is a
 * grown-up setting) and a smaller brake in the other. Only one finger is ever
 * needed. Everything held is released on pointercancel, blur, tab hidden,
 * rotation and when a modal opens, so a button can never stay stuck down.
 *
 * Keyboard (for grown-ups and development): Space / ArrowUp / W jump,
 * ArrowDown / S / Shift brake.
 */
export class DriveControls {
  readonly root: HTMLElement;
  readonly jumpBtn: HTMLButtonElement;
  readonly brakeBtn: HTMLButtonElement;
  private jumpHeld = false;
  private jumpEdge = false;
  private brakeHeld = false;
  private keyJump = false;
  private keyBrake = false;
  private jumpPointer: number | null = null;
  private brakePointer: number | null = null;
  private enabled = false;
  private hand: HTMLElement;
  private offs: (() => void)[] = [];
  /** called on the frame the jump button goes down (for immediate visual feedback) */
  onJumpDown: (() => void) | null = null;

  constructor(side: 'left' | 'right') {
    this.root = h('div', { class: `drive-controls side-${side}`, 'data-testid': 'drive-controls' });
    this.jumpBtn = button({ icon: 'jump', label: 'Jump (hold for a little higher)', size: 'xl', variant: 'primary', testid: 'jump', onTap: () => undefined, extraClass: 'jump-btn' });
    this.brakeBtn = button({ icon: 'brake', label: 'Brake (hold to stop)', size: 'md', variant: 'soft', testid: 'brake', onTap: () => undefined, extraClass: 'brake-btn' });
    this.hand = h('div', { class: 'demo-hand', 'aria-hidden': 'true' });
    this.jumpBtn.append(this.hand);
    this.root.append(this.brakeBtn, this.jumpBtn);
    layer('hud').append(this.root);
    this.wireButton(this.jumpBtn, 'jump');
    this.wireButton(this.brakeBtn, 'brake');
    const key = (down: boolean) => (e: KeyboardEvent) => {
      if (e.repeat && down) return;
      const k = e.key;
      if (k === ' ' || k === 'ArrowUp' || k === 'w' || k === 'W') {
        if (down && !this.keyJump && this.enabled) {
          this.jumpEdge = true;
          this.onJumpDown?.();
        }
        this.keyJump = down && this.enabled;
        e.preventDefault();
      } else if (k === 'ArrowDown' || k === 's' || k === 'S' || k === 'Shift') {
        this.keyBrake = down && this.enabled;
        e.preventDefault();
      }
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

  private wireButton(b: HTMLButtonElement, which: 'jump' | 'brake'): void {
    b.addEventListener('pointerdown', (e) => {
      if (!this.enabled || e.button !== 0) return;
      e.preventDefault();
      if (which === 'jump') {
        // one finger at a time: a second pointer on the same button is ignored
        if (this.jumpPointer !== null) return;
        this.jumpPointer = e.pointerId;
        this.jumpHeld = true;
        this.jumpEdge = true;
        this.onJumpDown?.();
      } else {
        if (this.brakePointer !== null) return;
        this.brakePointer = e.pointerId;
        this.brakeHeld = true;
      }
    });
    const release = (e: PointerEvent) => {
      if (which === 'jump' && e.pointerId === this.jumpPointer) {
        this.jumpPointer = null;
        this.jumpHeld = false;
      } else if (which === 'brake' && e.pointerId === this.brakePointer) {
        this.brakePointer = null;
        this.brakeHeld = false;
      }
    };
    b.addEventListener('pointerup', release);
    b.addEventListener('pointercancel', release);
    b.addEventListener('lostpointercapture', release);
    b.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  /** The input for this frame. The jump "pressed" edge is consumed by reading it. */
  read(): DriveInput {
    if (!this.enabled) return { jumpHeld: false, jumpPressed: false, brakeHeld: false };
    const pressed = this.jumpEdge;
    this.jumpEdge = false;
    return { jumpHeld: this.jumpHeld || this.keyJump, jumpPressed: pressed, brakeHeld: this.brakeHeld || this.keyBrake };
  }

  /** Is the jump button (or key) held right now? */
  get holding(): boolean {
    return this.jumpHeld || this.keyJump;
  }

  /** Release everything: pointercancel, blur, hidden tab, rotation, a modal opening. */
  clear(): void {
    this.jumpHeld = this.brakeHeld = this.keyJump = this.keyBrake = false;
    this.jumpEdge = false;
    this.jumpPointer = this.brakePointer = null;
    this.jumpBtn.classList.remove('pressed');
    this.brakeBtn.classList.remove('pressed');
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

  /** A gentle "press here" cue: the dashed ring bounces around the jump button. */
  hint(on: boolean): void {
    this.jumpBtn.classList.toggle('hint', on);
  }

  /** The example's helper hand presses the jump button once (picture only; no input). */
  demoTap(): void {
    this.hand.classList.remove('tap');
    void this.hand.offsetWidth;
    this.hand.classList.add('tap');
  }

  /** Show or hide the helper hand resting on the jump button. */
  demoHand(on: boolean): void {
    this.hand.classList.toggle('on', on);
    if (!on) this.hand.classList.remove('tap');
  }

  destroy(): void {
    this.clear();
    for (const off of this.offs) off();
    this.root.remove();
  }
}
