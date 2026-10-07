import Phaser from 'phaser';
import { addImage } from '../../../../art/rasterize';
import { LAUNCH, simulateLaunch, groundY, type ArcResult, type WindLevel } from '../../../../content/trail/windmillModel';
import { audio } from '../../../../core/audio';
import { motion } from '../../../../core/motion';

/** Pip's puff launcher: angle tokens, dotted preview, bellows, and the flying puff ball. */
export class Launcher {
  readonly base: Phaser.GameObjects.Image;
  readonly barrel: Phaser.GameObjects.Image;
  readonly bellows: Phaser.GameObjects.Image;
  readonly x: number;
  readonly y: number;
  private buttons: { deg: number; img: Phaser.GameObjects.Image }[] = [];
  private dots: Phaser.GameObjects.Image[] = [];
  angle = 46;
  firing = false;

  constructor(
    private scene: Phaser.Scene,
    x: number,
    depth: number,
  ) {
    this.x = x;
    this.y = groundY(x);
    this.bellows = addImage(scene, x - 92, this.y - 40, 'wh.launcher.bellows').setDepth(depth - 1);
    this.base = addImage(scene, x, this.y, 'wh.launcher.base').setDepth(depth);
    this.barrel = addImage(scene, LAUNCH.x, LAUNCH.y, 'wh.launcher.barrel').setDepth(depth + 1);
    this.setAngle(36, true);
  }

  setAngle(deg: number, instant = false): void {
    this.angle = deg;
    const rot = (-deg * Math.PI) / 180;
    if (instant || motion.reduced) this.barrel.rotation = rot;
    else this.scene.tweens.add({ targets: this.barrel, rotation: rot, duration: 260, ease: 'Back.easeOut' });
  }

  /** Angle tokens placed on an arc around the barrel; returns their positions. */
  static readonly BTN_R = 430;

  showButtons(angles: readonly number[], depth: number): { deg: number; x: number; y: number }[] {
    this.hideButtons();
    const r = Launcher.BTN_R;
    return angles.map((deg) => {
      const a = (-deg * Math.PI) / 180;
      const x = LAUNCH.x + Math.cos(a) * r;
      const y = LAUNCH.y + Math.sin(a) * r;
      const img = addImage(this.scene, x, y, 'wh.anglebtn').setRotation(a).setDepth(depth).setScale(0.2);
      this.scene.tweens.add({ targets: img, scale: 1.35, duration: motion.reduced ? 1 : 260, ease: 'Back.easeOut' });
      this.buttons.push({ deg, img });
      return { deg, x, y };
    });
  }

  highlight(deg: number | null): void {
    for (const b of this.buttons) {
      this.scene.tweens.killTweensOf(b.img);
      b.img.setScale(b.deg === deg ? 1.6 : 1.25).setAlpha(deg === null || b.deg === deg ? 1 : 0.7);
    }
  }

  hideButtons(): void {
    for (const b of this.buttons) b.img.destroy();
    this.buttons = [];
  }

  /** Dotted arc. Without wind it shows only the start (a direction cue); the help button shows the wind-bent path. */
  preview(deg: number, withWind: WindLevel | null, depth: number): void {
    this.clearPreview();
    const res = simulateLaunch(deg, withWind ?? 'none');
    const pts = res.points;
    const upto = withWind ? pts.length : Math.floor(pts.length * 0.32);
    for (let i = 4; i < upto; i += 4) {
      const d = addImage(this.scene, pts[i].x, pts[i].y, 'wh.dot').setDepth(depth).setAlpha(withWind ? 0.95 : 0.85 - (i / upto) * 0.5);
      if (withWind) d.setTint(0xffe7a3);
      this.dots.push(d);
    }
  }

  clearPreview(): void {
    for (const d of this.dots) d.destroy();
    this.dots = [];
  }

  pumpBellows(): void {
    this.scene.tweens.add({ targets: this.bellows, scaleY: 0.72, duration: 120, yoyo: true, ease: 'Quad.easeInOut' });
    audio.play('bellows');
  }

  /** Fire a puff ball; resolves with the result once its flight finishes. */
  fire(deg: number, wind: WindLevel, depth: number, follow?: (x: number, y: number) => void): Promise<ArcResult> {
    this.firing = true;
    this.setAngle(deg, true);
    this.pumpBellows();
    const res = simulateLaunch(deg, wind);
    const ball = addImage(this.scene, res.points[0].x, res.points[0].y, 'wh.puff').setDepth(depth);
    this.scene.tweens.add({ targets: this.barrel, scaleX: 0.85, duration: 70, yoyo: true });
    audio.play('puff', { pitch: 1.2 });
    const total = res.points[res.points.length - 1].t;
    const speedUp = 1.15;
    return new Promise((resolve) => {
      const proxy = { t: 0 };
      this.scene.tweens.add({
        targets: proxy,
        t: total,
        duration: (total * 1000) / speedUp,
        ease: 'Linear',
        onUpdate: () => {
          const i = Math.min(res.points.length - 1, Math.round(proxy.t * 60));
          const p = res.points[i];
          ball.setPosition(p.x, p.y);
          ball.rotation += 0.08;
          follow?.(p.x, p.y);
        },
        onComplete: () => {
          this.firing = false;
          this.scene.tweens.add({ targets: ball, alpha: 0, scale: 0.4, duration: 400, delay: 150, onComplete: () => ball.destroy() });
          resolve(res);
        },
      });
    });
  }

  destroy(): void {
    this.hideButtons();
    this.clearPreview();
  }
}
