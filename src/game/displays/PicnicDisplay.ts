import Phaser from 'phaser';
import { makeImage } from '../../art/rasterize';
import { registerPieces } from '../../art/registry';
import { PICNIC_DISH_KEYS, PICNIC_PIECES } from '../../art/scenes/picnic';
import { validDish, type Dish } from '../../content/picnic/food';
import { DishView } from './DishView';
import { audio } from '../../core/audio';
import { motion } from '../../core/motion';

registerPieces(PICNIC_PIECES);

export interface PicnicData {
  scenario?: string;
  eaten?: Record<string, unknown>;
  mine?: unknown;
}

/** Art keys the display needs (for a scene's artKeys()). */
export function picnicDisplayKeys(): string[] {
  return [...PICNIC_DISH_KEYS, 'pc.plate.small'];
}

/** The snacks from a saved picnic, each on its own little plate (invalid entries are skipped). */
export function picnicDishes(data: PicnicData): Dish[] {
  const out: Dish[] = [];
  for (const d of Object.values(data.eaten ?? {})) if (validDish(d) && !out.some((x) => x.id === d.id)) out.push(d);
  if (validDish(data.mine)) out.push(data.mine);
  return out.slice(0, 4);
}

/**
 * A saved picnic shown with the real snacks the child made. Tapping makes
 * them wiggle (crunchy ones crunch).
 */
export class PicnicDisplay {
  readonly c: Phaser.GameObjects.Container;
  private views: DishView[] = [];

  constructor(
    private scene: Phaser.Scene,
    x: number,
    y: number,
    spacing: number,
    data: PicnicData,
  ) {
    this.c = scene.add.container(x, y);
    const dishes = picnicDishes(data);
    const x0 = (-(dishes.length - 1) * spacing) / 2;
    dishes.forEach((d, i) => {
      const px = x0 + i * spacing;
      this.c.add(makeImage(scene, px, 6, 'pc.plate.small').setScale(0.8));
      const v = new DishView(scene, px, 4, d).setScale(d.kind === 'sandwich' ? 0.3 : 0.38);
      this.c.add(v);
      this.views.push(v);
    });
  }

  get count(): number {
    return this.views.length;
  }

  play(): void {
    this.views.forEach((v, i) => {
      const d = v.dish;
      audio.play(d.kind === 'juice' ? 'pour' : d.texture === 'crunchy' ? 'crunch' : 'squish', { delay: i * 0.18 });
      if (!motion.reduced) this.scene.tweens.add({ targets: v, y: v.y - 16, duration: 140, yoyo: true, delay: i * 180, ease: 'Quad.easeOut' });
    });
  }
}
