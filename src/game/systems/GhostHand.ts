import Phaser from 'phaser';
import { makeImage } from '../../art/rasterize';
import { motion } from '../../core/motion';

/**
 * The demonstration hand: shows exactly what to do (tap here, drag there)
 * without any reading. Used by hints and first-time instructions.
 */
export class GhostHand {
  private hand: Phaser.GameObjects.Image;
  private ring: Phaser.GameObjects.Image;
  private token = 0;

  constructor(private scene: Phaser.Scene) {
    this.ring = makeImage(scene, 0, 0, 'fx.tapring').setDepth(9000).setAlpha(0);
    this.hand = makeImage(scene, 0, 0, 'fx.hand').setDepth(9001).setAlpha(0);
    scene.add.existing(this.ring);
    scene.add.existing(this.hand);
  }

  get busy(): boolean {
    return this.hand.alpha > 0.05;
  }

  async tapAt(x: number, y: number, times = 2): Promise<void> {
    const my = ++this.token;
    const s = this.scene;
    s.tweens.killTweensOf([this.hand, this.ring]);
    this.hand.setPosition(x + 90, y + 120).setAlpha(0).setScale(1);
    await this.tween({ targets: this.hand, x, y, alpha: 1, duration: motion.reduced ? 1 : 420, ease: 'Quad.easeOut' });
    for (let i = 0; i < times; i++) {
      if (my !== this.token) return;
      this.ring.setPosition(x, y).setScale(0.4).setAlpha(1);
      s.tweens.add({ targets: this.ring, scale: 1.5, alpha: 0, duration: 520, ease: 'Quad.easeOut' });
      await this.tween({ targets: this.hand, scale: 0.86, duration: 130, yoyo: true, ease: 'Quad.easeInOut' });
      await this.wait(260);
    }
    if (my !== this.token) return;
    await this.tween({ targets: this.hand, alpha: 0, duration: 300 });
  }

  async dragFrom(x1: number, y1: number, x2: number, y2: number): Promise<void> {
    const my = ++this.token;
    this.hand.setPosition(x1, y1).setAlpha(0).setScale(1);
    await this.tween({ targets: this.hand, alpha: 1, duration: 200 });
    await this.tween({ targets: this.hand, scale: 0.88, duration: 120 });
    if (my !== this.token) return;
    await this.tween({ targets: this.hand, x: x2, y: y2, duration: motion.reduced ? 300 : 800, ease: 'Sine.easeInOut' });
    await this.tween({ targets: this.hand, scale: 1, duration: 120 });
    await this.wait(200);
    if (my !== this.token) return;
    await this.tween({ targets: this.hand, alpha: 0, duration: 250 });
  }

  hide(): void {
    this.token++;
    this.scene.tweens.killTweensOf([this.hand, this.ring]);
    this.hand.setAlpha(0);
    this.ring.setAlpha(0);
  }

  private tween(cfg: Phaser.Types.Tweens.TweenBuilderConfig): Promise<void> {
    return new Promise((r) => this.scene.tweens.add({ ...cfg, onComplete: () => r() }));
  }

  private wait(ms: number): Promise<void> {
    return new Promise((r) => this.scene.time.delayedCall(ms, r));
  }
}
