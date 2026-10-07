import Phaser from 'phaser';
import { makeImage } from '../../art/rasterize';
import { hex } from '../../art/palette';
import { CUP_GLUGS, SPRINKLE_COLORS, juiceColor, type Dish, type Topping } from '../../content/picnic/food';

/** Surface (in dish units) where toppings go, relative to the view's origin. */
export interface DecoSurface {
  cx: number;
  cy: number;
  /** half-width and half-height of the decoratable area */
  rx: number;
  ry: number;
}

const CUP = { small: { h: 110, w: 44 }, big: { h: 170, w: 56 } };
const LAYER = 22;

/**
 * Draws a picnic dish from its plain description. The origin is the dish's
 * base (where it sits on a plate or tray), so it can be placed anywhere.
 */
export class DishView extends Phaser.GameObjects.Container {
  dish: Dish;
  private swirl?: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene, x: number, y: number, dish: Dish) {
    super(scene, x, y);
    this.dish = dish;
    scene.add.existing(this);
    this.redraw();
  }

  setDish(d: Dish): this {
    this.dish = d;
    this.redraw();
    return this;
  }

  /** Approximate height above the base (for placing bubbles, hearts, etc.). */
  get dishHeight(): number {
    const d = this.dish;
    if (d.kind === 'cookie') return d.share ? 160 : 120;
    if (d.kind === 'sandwich') return 18 + (d.layers?.length ?? 0) * LAYER + 70;
    return CUP[d.cup ?? 'small'].h + 20;
  }

  surface(): DecoSurface {
    const d = this.dish;
    if (d.kind === 'cookie') {
      const s = d.share ? 1.35 : 1;
      return { cx: 0, cy: -60 * s, rx: 52 * s, ry: 52 * s };
    }
    if (d.kind === 'sandwich') {
      const topY = -18 - (d.layers?.length ?? 0) * LAYER - 14;
      return { cx: 0, cy: topY - 24, rx: 96, ry: 18 };
    }
    const c = CUP[d.cup ?? 'small'];
    return { cx: 0, cy: -c.h / 2, rx: c.w - 12, ry: c.h / 2 - 14 };
  }

  /** Map dish-unit topping coordinates (−60..60) onto this dish's surface. */
  toppingPos(t: { x: number; y: number }): { x: number; y: number } {
    const s = this.surface();
    return { x: s.cx + (t.x / 60) * s.rx, y: s.cy + (t.y / 60) * s.ry };
  }

  /** The reverse: a local point on the view → dish units (clamped to the surface). */
  toDishUnits(lx: number, ly: number): { x: number; y: number } {
    const s = this.surface();
    const clamp = (v: number) => Math.max(-60, Math.min(60, v));
    return { x: clamp(((lx - s.cx) / s.rx) * 60), y: clamp(((ly - s.cy) / s.ry) * 60) };
  }

  private redraw(): void {
    this.removeAll(true);
    this.swirl = undefined;
    const d = this.dish;
    const sc = this.scene;
    if (d.kind === 'cookie') {
      const s = d.share ? 1.35 : 1;
      this.add(makeImage(sc, 0, -60 * s, `pc.cookie.${d.shape ?? 'round'}.${d.texture ?? 'soft'}`).setScale(s));
    } else if (d.kind === 'sandwich') {
      this.add(makeImage(sc, 0, -18, 'pc.bread.bottom'));
      const layers = d.layers ?? [];
      layers.forEach((l, i) => this.add(makeImage(sc, l.dx, -18 - 10 - i * LAYER, `pc.fill.${l.f}`)));
      const top = layers.length ? layers[layers.length - 1].dx : 0;
      this.add(makeImage(sc, top * 0.6, -18 - layers.length * LAYER - 14, 'pc.bread.top'));
    } else {
      const size = d.cup ?? 'small';
      const c = CUP[size];
      const level = Math.max(0, Math.min(1, (d.glugs ?? 0) / CUP_GLUGS[size]));
      if (level > 0) {
        const fill = makeImage(sc, 0, 0, `pc.cup.${size}.fill`).setTint(hex(juiceColor(d.fruits ?? [])));
        fill.setScale(1, level);
        this.add(fill);
      }
      this.add(makeImage(sc, c.w * 0.3, -c.h + 10, 'pc.straw'));
      this.add(makeImage(sc, 0, 0, `pc.cup.${size}`));
      const f = d.fruits?.[0];
      if (f) this.add(makeImage(sc, -c.w + 4, -c.h + 2, `pc.fruit.${f}`).setScale(0.45));
    }
    for (const t of d.deco) this.addTopping(t);
    if (d.squished) this.setScale(this.scaleX * 1.12, this.scaleY * 0.82);
  }

  /** Add one topping image (or swirl stroke) for t. */
  addTopping(t: Topping): void {
    const sc = this.scene;
    if (t.d === 'swirl') {
      if (!this.swirl) {
        this.swirl = sc.add.graphics();
        this.add(this.swirl);
      }
      const pts = t.pts ?? [];
      const at = (i: number) => this.toppingPos({ x: pts[i], y: pts[i + 1] });
      for (const [w, col] of [
        [13, 0x3b2a20],
        [8, 0xfffdf8],
        [3, hex(SPRINKLE_COLORS[(t.c ?? 4) % SPRINKLE_COLORS.length])],
      ] as const) {
        this.swirl.lineStyle(w, col, 1);
        if (pts.length >= 4) {
          this.swirl.beginPath();
          const p0 = at(0);
          this.swirl.moveTo(p0.x, p0.y);
          for (let i = 2; i < pts.length; i += 2) {
            const p = at(i);
            this.swirl.lineTo(p.x, p.y);
          }
          this.swirl.strokePath();
        } else {
          const p = this.toppingPos(t);
          this.swirl.fillStyle(col, 1).fillCircle(p.x, p.y, w * 0.7);
        }
      }
      return;
    }
    const p = this.toppingPos(t);
    const key = t.d === 'sprinkles' ? 'pc.sprinkle' : t.d === 'dots' ? 'pc.dotdeco' : 'pc.leafdeco';
    const img = makeImage(sc, p.x, p.y, key);
    if (t.d !== 'leaves') img.setTint(hex(SPRINKLE_COLORS[(t.c ?? 0) % SPRINKLE_COLORS.length]));
    img.setRotation(((Math.abs(t.x * 7 + t.y * 13) % 180) * Math.PI) / 180);
    this.add(img);
  }
}
