import Phaser from 'phaser';
import { addImage, isArtReady, makeImage, setPiece } from '../art/rasterize';

const warned = new Set<string>();
function warnMissing(key: string): void {
  if (warned.has(key)) return;
  warned.add(key);
  console.warn(`[views] art not rasterised (skipped): ${key}`);
}

/** addImage that never throws: a missing or failed art key gives an invisible stand-in (one console warning per key). */
export function safeImage(scene: Phaser.Scene, x: number, y: number, key: string): Phaser.GameObjects.Image {
  if (isArtReady(key)) return addImage(scene, x, y, key);
  warnMissing(key);
  return scene.add.image(x, y, '__DEFAULT').setVisible(false);
}

/** makeImage (not on the display list) that never throws. */
export function safeMake(scene: Phaser.Scene, x: number, y: number, key: string): Phaser.GameObjects.Image {
  if (isArtReady(key)) return makeImage(scene, x, y, key);
  warnMissing(key);
  return new Phaser.GameObjects.Image(scene, x, y, '__DEFAULT').setVisible(false);
}

/** setPiece that never throws. */
export function safeSetPiece(img: Phaser.GameObjects.Image, key: string): void {
  if (isArtReady(key)) setPiece(img, key);
  else warnMissing(key);
}

/**
 * Small, soft effects. Respect reduced motion and lower intensity: fewer
 * particles, shorter or no movement, never a flash, never a camera shake.
 * Every object an effect makes is destroyed when its tween ends.
 */
export const FX_KEYS = ['fx.puff', 'fx.ring', 'fx.drop', 'fx.dust', 'fx.spark', 'fx.star', 'fx.confetti.a', 'fx.confetti.b', 'fx.confetti.c', 'fx.check'] as const;

const DEPTH_FX = 30;

export class Fx {
  private scene: Phaser.Scene;
  private reduced: boolean;
  private low: boolean;
  private live = new Set<Phaser.GameObjects.Image>();
  private seed = 1;
  /** depth used for every effect (default DEPTH.fx) */
  depth = DEPTH_FX;

  constructor(scene: Phaser.Scene, opts: { reduced: boolean; low: boolean }) {
    this.scene = scene;
    this.reduced = opts.reduced;
    this.low = opts.low;
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.clear());
  }

  private rnd(): number {
    // small deterministic jitter (stable screenshots, no Math.random dependence)
    this.seed = (this.seed * 16807) % 2147483647;
    return (this.seed % 10000) / 10000;
  }

  private img(key: string, x: number, y: number): Phaser.GameObjects.Image {
    const im = safeImage(this.scene, x, y, key).setDepth(this.depth);
    this.live.add(im);
    return im;
  }

  private done(im: Phaser.GameObjects.Image): void {
    if (!this.live.has(im)) return;
    this.live.delete(im);
    im.destroy();
  }

  private tween(im: Phaser.GameObjects.Image, cfg: Omit<Phaser.Types.Tweens.TweenBuilderConfig, 'targets'>): void {
    this.scene.tweens.add({ ...cfg, targets: im, onComplete: () => this.done(im) });
  }

  /** soft "boing" puff (a missed jump) */
  puff(x: number, y: number): void {
    const im = this.img('fx.puff', x, y).setScale(0.5).setAlpha(0.95);
    if (this.reduced) {
      im.setScale(0.9);
      this.tween(im, { alpha: 0, duration: 600, ease: 'Sine.easeIn' });
      return;
    }
    this.tween(im, { scale: 1.25, alpha: 0, y: y - 30, duration: 600, ease: 'Quad.easeOut' });
    if (!this.low) {
      for (let i = 0; i < 3; i++) {
        const a = -Math.PI / 2 + (i - 1) * 0.9;
        const d = this.img('fx.dust', x, y).setScale(0.7);
        this.tween(d, { x: x + Math.cos(a) * 80, y: y + Math.sin(a) * 60, alpha: 0, scale: 1, duration: 520, ease: 'Quad.easeOut' });
      }
    }
  }

  /** ring and drops (something lands in water) */
  splash(x: number, y: number): void {
    const ring = this.img('fx.ring', x, y).setScale(0.4, 0.5).setAlpha(0.95);
    this.tween(ring, { scaleX: this.reduced ? 0.8 : 1.5, scaleY: this.reduced ? 0.8 : 1.3, alpha: 0, duration: this.reduced ? 400 : 700, ease: 'Quad.easeOut' });
    if (this.reduced) return;
    const n = this.low ? 3 : 6;
    for (let i = 0; i < n; i++) {
      const dir = i % 2 === 0 ? -1 : 1;
      const spread = 40 + this.rnd() * 70;
      const h = 70 + this.rnd() * 80;
      const d = this.img('fx.drop', x + dir * 10, y);
      const proxy = { t: 0 };
      this.scene.tweens.add({
        targets: proxy,
        t: 1,
        duration: 520 + this.rnd() * 160,
        onUpdate: () => {
          if (!this.live.has(d)) return;
          const t = proxy.t;
          d.setPosition(x + dir * (10 + spread * t), y - h * 4 * t * (1 - t));
          d.setAlpha(1 - Math.max(0, t - 0.7) / 0.3);
        },
        onComplete: () => this.live.has(d) && this.done(d),
      });
    }
  }

  /** little dust clouds on landing, scaled by impact 0..1 */
  land(x: number, y: number, impact: number): void {
    const k = Phaser.Math.Clamp(impact, 0, 1);
    if (k < 0.05) return;
    let n = k < 0.35 ? 1 : k < 0.7 ? 2 : 3;
    if (this.low) n = Math.min(n, 1);
    // dust kicks out at both wheels (the truck's wheels are about 170 apart)
    const spots = n === 1 ? [0] : n === 2 ? [-84, 88] : [-84, 2, 88];
    for (const ox of spots) {
      const d = this.img('fx.dust', x + ox, y - 10).setScale(0.6 + 0.6 * k).setAlpha(0.95);
      if (this.reduced) {
        this.tween(d, { alpha: 0, duration: 380 });
        continue;
      }
      const side = ox < 0 ? -1 : ox > 0 ? 1 : 0;
      this.tween(d, { x: x + ox + side * (30 + 30 * k), y: y - 22 - 18 * k, alpha: 0, scale: (0.6 + 0.6 * k) * 1.5, duration: 480, ease: 'Quad.easeOut' });
    }
  }

  /** a few sparkles (something good happened) */
  sparks(x: number, y: number, n = 5): void {
    let count = this.low ? Math.max(1, Math.ceil(n / 3)) : n;
    if (this.reduced) count = Math.min(count, 3);
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + this.rnd() * 0.6;
      const r = 40 + this.rnd() * 50;
      const sx = x + Math.cos(a) * (this.reduced ? r : r * 0.3);
      const sy = y + Math.sin(a) * (this.reduced ? r : r * 0.3);
      const s = this.img('fx.spark', sx, sy).setScale(0.2).setAlpha(1);
      const delay = i * 50;
      if (this.reduced) {
        s.setScale(0.6);
        s.setAlpha(0);
        this.scene.tweens.add({ targets: s, alpha: 1, duration: 200, delay, yoyo: true, hold: 200, onComplete: () => this.done(s) });
        continue;
      }
      this.scene.tweens.add({
        targets: s,
        x: x + Math.cos(a) * r,
        y: y + Math.sin(a) * r,
        scale: 0.75,
        angle: 90,
        duration: 260,
        delay,
        ease: 'Back.easeOut',
        onComplete: () => this.tween(s, { scale: 0, alpha: 0, angle: 180, duration: 320, ease: 'Sine.easeIn' }),
      });
    }
  }

  /** celebration confetti from a point (1–2 s) */
  confetti(x: number, y: number): void {
    if (this.reduced) {
      // a few stars that fade in place
      const n = this.low ? 2 : 4;
      for (let i = 0; i < n; i++) {
        const st = this.img('fx.star', x + (i - (n - 1) / 2) * 70, y - 30 - (i % 2) * 34).setAlpha(0);
        this.scene.tweens.add({ targets: st, alpha: 1, duration: 300, delay: i * 80, yoyo: true, hold: 700, onComplete: () => this.done(st) });
      }
      return;
    }
    const total = this.low ? 8 : 24;
    const keys = ['fx.confetti.a', 'fx.confetti.b', 'fx.confetti.c', 'fx.star'];
    for (let i = 0; i < total; i++) {
      const key = keys[i % keys.length];
      const im = this.img(key, x, y).setScale(key === 'fx.star' ? 0.7 : 1.2);
      const a = -Math.PI / 2 + (this.rnd() - 0.5) * 2.2;
      const v = 380 + this.rnd() * 420;
      const vx = Math.cos(a) * v;
      const vy = Math.sin(a) * v;
      const spin = (this.rnd() - 0.5) * 12;
      const dur = 1300 + this.rnd() * 400;
      const proxy = { t: 0 };
      this.scene.tweens.add({
        targets: proxy,
        t: 1,
        duration: dur,
        onUpdate: () => {
          if (!this.live.has(im)) return;
          const t = (proxy.t * dur) / 1000;
          // up and out, then a gentle flutter down (air drag keeps it soft)
          const drag = 1 - Math.exp(-2.2 * t);
          im.setPosition(x + (vx / 2.2) * drag + Math.sin(t * 6 + i) * 10, y + (vy / 2.2) * drag + 160 * t * t);
          im.setRotation(spin * t);
          im.setAlpha(proxy.t < 0.7 ? 1 : 1 - (proxy.t - 0.7) / 0.3);
        },
        onComplete: () => this.live.has(im) && this.done(im),
      });
    }
  }

  /** big tick that pops and fades (it worked!) */
  check(x: number, y: number): void {
    const im = this.img('fx.check', x, y).setScale(this.reduced ? 1 : 0.3).setAlpha(this.reduced ? 0 : 1);
    if (this.reduced) {
      this.scene.tweens.add({ targets: im, alpha: 1, duration: 150, yoyo: true, hold: 900, onComplete: () => this.done(im) });
      return;
    }
    this.scene.tweens.add({
      targets: im,
      scale: 1.1,
      duration: 320,
      ease: 'Back.easeOut',
      onComplete: () => this.tween(im, { alpha: 0, scale: 1.2, delay: 900, duration: 320, ease: 'Sine.easeIn' }),
    });
  }

  setOptions(opts: { reduced: boolean; low: boolean }): void {
    this.reduced = opts.reduced;
    this.low = opts.low;
  }

  /** how many effect objects are alive (tests) */
  get liveCount(): number {
    return this.live.size;
  }

  /** remove every effect now */
  clear(): void {
    for (const im of this.live) {
      this.scene.tweens.killTweensOf(im);
      im.destroy();
    }
    this.live.clear();
  }
}
