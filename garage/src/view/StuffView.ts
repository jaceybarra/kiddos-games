import Phaser from 'phaser';
import type { Crate, Patch } from '../core/terrain';
import { safeImage as addImage } from './fx';

/** Art keys a StuffView needs rasterised. */
export const STUFF_VIEW_KEYS = ['obj.crate', 'obj.crate.bit', 'obj.mud', 'obj.boost', 'fx.mud', 'fx.speed', 'fx.dust'] as const;

/**
 * The things on the course to drive into: crates (they burst into splinters),
 * mud puddles (brown splatter when driven through) and boost strips (glowing
 * chevrons; speed lines while boosting). Purely visual: the physics decides
 * (core/truck.ts); the scene calls smash / splatter / speedLines on its events.
 */
export class StuffView {
  private scene: Phaser.Scene;
  private crates = new Map<string, Phaser.GameObjects.Image>();
  private strips: Phaser.GameObjects.Image[] = [];
  private live = new Set<Phaser.GameObjects.Image>();
  private seed = 7;
  private clock = 0;
  reduced: boolean;
  low: boolean;

  constructor(scene: Phaser.Scene, def: { crates: Crate[]; patches: Patch[] }, opts: { reduced: boolean; low: boolean; depth: { ground: number; crate: number; fx: number } }) {
    this.scene = scene;
    this.reduced = opts.reduced;
    this.low = opts.low;
    this.depth = opts.depth;
    for (const p of def.patches) {
      if (p.kind === 'mud') {
        const im = addImage(scene, p.x0 - 6, p.y + 2, 'obj.mud').setOrigin(0, 0.5);
        im.setDisplaySize(p.x1 - p.x0 + 12, 40).setDepth(opts.depth.ground);
        this.strips.push(im);
      } else {
        // chevrons repeat along the strip
        const n = Math.max(1, Math.round((p.x1 - p.x0) / 120));
        const w = (p.x1 - p.x0) / n;
        for (let i = 0; i < n; i++) {
          const im = addImage(scene, p.x0 + i * w, p.y + 3, 'obj.boost').setOrigin(0, 0.5);
          im.setDisplaySize(w, 32).setDepth(opts.depth.ground);
          im.setData('glow', i);
          this.strips.push(im);
        }
      }
    }
    for (const c of def.crates) {
      const im = addImage(scene, c.x, c.y, 'obj.crate').setOrigin(0.5, 1).setScale(c.size / 90).setDepth(opts.depth.crate);
      this.crates.set(c.id, im);
    }
  }

  private depth: { ground: number; crate: number; fx: number };

  private rnd(): number {
    this.seed = (this.seed * 16807) % 2147483647;
    return (this.seed % 10000) / 10000;
  }

  private fx(key: string, x: number, y: number): Phaser.GameObjects.Image {
    const im = addImage(this.scene, x, y, key).setDepth(this.depth.fx);
    this.live.add(im);
    return im;
  }

  private done(im: Phaser.GameObjects.Image): void {
    if (!this.live.delete(im)) return;
    im.destroy();
  }

  /** A crate bursts: splinters fly up and tumble away, a puff of dust. */
  smash(c: Crate, vx: number): void {
    const im = this.crates.get(c.id);
    if (!im) return;
    this.crates.delete(c.id);
    const cy = c.y - c.size / 2;
    if (this.reduced) {
      this.scene.tweens.add({ targets: im, alpha: 0, duration: 260, onComplete: () => im.destroy() });
      return;
    }
    im.destroy();
    const n = this.low ? 3 : 6;
    const dir = vx >= 0 ? 1 : -1;
    for (let i = 0; i < n; i++) {
      const b = this.fx('obj.crate.bit', c.x + (this.rnd() - 0.5) * c.size * 0.6, cy + (this.rnd() - 0.5) * c.size * 0.6);
      const sx = dir * (120 + this.rnd() * 260) + (this.rnd() - 0.5) * 160;
      const sy = -(260 + this.rnd() * 300);
      const spin = (this.rnd() - 0.5) * 16;
      const x0 = b.x;
      const y0 = b.y;
      const proxy = { t: 0 };
      this.scene.tweens.add({
        targets: proxy,
        t: 1,
        duration: 700 + this.rnd() * 200,
        onUpdate: () => {
          if (!this.live.has(b)) return;
          const t = proxy.t * 0.8;
          b.setPosition(x0 + sx * t, y0 + sy * t + 1400 * t * t);
          b.setRotation(spin * t);
          b.setAlpha(proxy.t < 0.75 ? 1 : 1 - (proxy.t - 0.75) / 0.25);
        },
        onComplete: () => this.done(b),
      });
    }
    const d = this.fx('fx.dust', c.x, c.y - 20).setScale(1.2).setAlpha(0.9);
    this.scene.tweens.add({ targets: d, scale: 2, alpha: 0, y: c.y - 50, duration: 420, ease: 'Quad.easeOut', onComplete: () => this.done(d) });
  }

  /** Mud flicks up behind the wheels (called while driving through mud). */
  splatter(x: number, y: number, vx: number): void {
    if (this.reduced || Math.abs(vx) < 40) return;
    const back = vx >= 0 ? -1 : 1;
    for (let i = 0; i < (this.low ? 1 : 2); i++) {
      const m = this.fx('fx.mud', x + back * (60 + this.rnd() * 60), y - 8).setScale(0.8 + this.rnd() * 0.6);
      const sx = back * (80 + this.rnd() * 120);
      const sy = -(140 + this.rnd() * 160);
      const x0 = m.x;
      const y0 = m.y;
      const proxy = { t: 0 };
      this.scene.tweens.add({
        targets: proxy,
        t: 1,
        duration: 420,
        onUpdate: () => {
          if (!this.live.has(m)) return;
          const t = proxy.t * 0.5;
          m.setPosition(x0 + sx * t, y0 + sy * t + 1600 * t * t);
          m.setAlpha(1 - proxy.t * 0.8);
        },
        onComplete: () => this.done(m),
      });
    }
  }

  /** Speed lines streaming past a boosting truck. */
  speedLines(x: number, y: number): void {
    if (this.reduced) return;
    const l = this.fx('fx.speed', x - 160 - this.rnd() * 80, y - 40 - this.rnd() * 110).setAlpha(0.9).setScale(0.6 + this.rnd() * 0.5, 1);
    this.scene.tweens.add({ targets: l, x: l.x - 260, alpha: 0, duration: 260, onComplete: () => this.done(l) });
  }

  setOptions(opts: { reduced: boolean; low: boolean }): void {
    this.reduced = opts.reduced;
    this.low = opts.low;
  }

  update(dt: number): void {
    this.clock += dt;
    if (this.reduced) return;
    // boost chevrons glow in a running wave
    for (const s of this.strips) {
      const i = s.getData('glow') as number | undefined;
      if (i === undefined) continue;
      s.setAlpha(0.8 + 0.2 * Math.sin(this.clock * 9 - i * 1.4));
    }
  }

  /** crates still standing (tests) */
  get standing(): number {
    return this.crates.size;
  }

  destroy(): void {
    for (const im of this.live) {
      this.scene.tweens.killTweensOf(im);
      im.destroy();
    }
    this.live.clear();
    for (const c of this.crates.values()) c.destroy();
    this.crates.clear();
    for (const s of this.strips) s.destroy();
    this.strips = [];
  }
}
