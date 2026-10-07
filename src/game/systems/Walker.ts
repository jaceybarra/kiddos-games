import type { Puppet } from '../rig/Puppet';
import { audio } from '../../core/audio';

export interface WalkerOpts {
  groundY: (x: number) => number;
  minX: number;
  maxX: number;
  /** units per second */
  speed?: number;
}

/**
 * Tap-to-move along a side-view path, plus held arrow keys. Movement is
 * forgiving: no obstacles, just the walkable range, and arrival is generous.
 */
export class Walker {
  private target: number | null = null;
  private onArrive: (() => void) | null = null;
  private held = 0;
  private stepAcc = 0;
  busy = false;
  speed: number;

  constructor(
    readonly puppet: Puppet,
    private opts: WalkerOpts,
  ) {
    this.speed = opts.speed ?? 520;
    puppet.y = opts.groundY(puppet.x);
  }

  setRange(minX: number, maxX: number): void {
    this.opts.minX = minX;
    this.opts.maxX = maxX;
  }

  get x(): number {
    return this.puppet.x;
  }

  get moving(): boolean {
    return this.target !== null || this.held !== 0;
  }

  /** Walk to x, then call onArrive. Replaces any earlier destination. */
  walkTo(x: number, onArrive?: () => void): void {
    if (this.busy) return;
    const tx = Math.max(this.opts.minX, Math.min(this.opts.maxX, x));
    this.onArrive = onArrive ?? null;
    if (Math.abs(tx - this.puppet.x) < 14) {
      this.target = null;
      this.puppet.stopGait();
      const cb = this.onArrive;
      this.onArrive = null;
      cb?.();
      return;
    }
    this.target = tx;
    this.puppet.faceToward(tx);
    this.puppet.startGait();
  }

  /** Teleport (for restores and scripted moves). */
  place(x: number): void {
    this.puppet.x = x;
    this.puppet.y = this.opts.groundY(x);
  }

  setHeld(dx: number): void {
    if (this.busy) dx = 0;
    if (dx !== 0) {
      this.target = null;
      this.onArrive = null;
      this.puppet.setFacing(dx > 0 ? 1 : -1);
      this.puppet.startGait();
    } else if (this.held !== 0 && this.target === null) {
      this.puppet.stopGait();
    }
    this.held = dx;
  }

  stop(): void {
    this.target = null;
    this.onArrive = null;
    this.held = 0;
    this.puppet.stopGait();
  }

  update(deltaMs: number): void {
    const dt = deltaMs / 1000;
    let moved = 0;
    if (this.held !== 0) {
      const nx = Math.max(this.opts.minX, Math.min(this.opts.maxX, this.puppet.x + this.held * this.speed * dt));
      moved = Math.abs(nx - this.puppet.x);
      this.puppet.x = nx;
    } else if (this.target !== null) {
      const d = this.target - this.puppet.x;
      const step = this.speed * dt;
      if (Math.abs(d) <= step) {
        moved = Math.abs(d);
        this.puppet.x = this.target;
        this.target = null;
        this.puppet.stopGait();
        const cb = this.onArrive;
        this.onArrive = null;
        cb?.();
      } else {
        moved = step;
        this.puppet.x += Math.sign(d) * step;
      }
    }
    this.puppet.y = this.opts.groundY(this.puppet.x);
    this.stepAcc += moved;
    if (this.stepAcc > 110) {
      this.stepAcc = 0;
      audio.play('step', { vol: 0.6, pitch: 0.9 + Math.random() * 0.2 });
    }
  }
}
