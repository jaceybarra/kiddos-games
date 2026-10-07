import Phaser from 'phaser';
import { addImage, makeImage } from '../../../../art/rasterize';
import { HUB, L, groundY } from '../../../../content/trail/windmillModel';
import { audio } from '../../../../core/audio';
import { motion } from '../../../../core/motion';

/** Windmill tower, turning sails, weathervane, and the brake lever with its bucket. */
export class Windmill {
  readonly tower: Phaser.GameObjects.Image;
  readonly sails: Phaser.GameObjects.Image;
  readonly vane: Phaser.GameObjects.Image;
  readonly leverPost: Phaser.GameObjects.Image;
  readonly leverArm: Phaser.GameObjects.Container;
  readonly bucket: Phaser.GameObjects.Image;
  private bucketHolder: Phaser.GameObjects.Container;
  leverDown = false;
  /** sail rotation offset from rest (radians) */
  turned = 0;
  private restRotation = 0;
  private bucketLoad: Phaser.GameObjects.Image | null = null;

  constructor(
    private scene: Phaser.Scene,
    depth: number,
    propDepth: number,
  ) {
    const gx = L.windmillX;
    this.tower = addImage(scene, gx, groundY(gx) + 12, 'wh.mill.tower').setDepth(depth);
    this.sails = addImage(scene, HUB.x, HUB.y, 'wh.mill.sails').setDepth(depth + 1);
    this.restRotation = 0;
    const capTop = groundY(gx) + 12 - (groundY(gx) - 430) - 92;
    this.vane = addImage(scene, gx, capTop, 'wh.vane').setDepth(depth - 1);
    const lx = L.leverX;
    const ly = groundY(lx);
    this.leverPost = addImage(scene, lx, ly, 'wh.lever.post').setDepth(propDepth);
    this.leverArm = scene.add.container(lx, ly - 150).setDepth(propDepth + 1);
    this.leverArm.add(makeImage(scene, 0, 0, 'wh.lever.arm'));
    this.bucketHolder = scene.make.container({ x: 178, y: 0 }, false);
    this.bucket = makeImage(scene, 0, 0, 'wh.lever.bucket');
    this.bucketHolder.add(this.bucket);
    this.leverArm.add(this.bucketHolder);
    this.setLever(false, true);
  }

  private setLever(down: boolean, instant = false): void {
    this.leverDown = down;
    const rot = down ? 0.42 : -0.32;
    if (instant || motion.reduced) {
      this.leverArm.rotation = rot;
      this.bucketHolder.rotation = -rot;
    } else {
      this.scene.tweens.add({ targets: this.leverArm, rotation: rot, duration: down ? 1100 : 500, ease: down ? 'Sine.easeInOut' : 'Back.easeOut' });
      this.scene.tweens.add({ targets: this.bucketHolder, rotation: -rot, duration: down ? 1100 : 500 });
    }
  }

  /** World position of the bucket (for carrying a pumpkin into it). */
  bucketWorld(): { x: number; y: number } {
    const m = this.bucketHolder.getWorldTransformMatrix();
    const v = new Phaser.Math.Vector2();
    m.transformPoint(0, 60, v);
    return { x: v.x, y: v.y };
  }

  wiggleLever(): void {
    audio.play('creak');
    this.scene.tweens.add({ targets: this.leverArm, rotation: this.leverArm.rotation + 0.05, duration: 80, yoyo: true, repeat: 2 });
  }

  loadBucket(img: Phaser.GameObjects.Image | null): void {
    if (this.bucketLoad) {
      this.bucketHolder.remove(this.bucketLoad);
      this.bucketLoad = null;
    }
    if (img) {
      img.setPosition(0, 82).setRotation(0);
      this.bucketHolder.add(img);
      this.bucketLoad = img;
    }
  }

  /** Release the brake and turn the sails by `by` radians. */
  async releaseAndTurn(by: number): Promise<void> {
    this.setLever(true);
    audio.play('creak', { pitch: 0.8 });
    await wait(this.scene, motion.reduced ? 100 : 900);
    audio.play('whirr', { pitch: 0.7 });
    await new Promise<void>((r) =>
      this.scene.tweens.add({
        targets: this.sails,
        rotation: this.restRotation + by,
        duration: motion.reduced ? 600 : 2200,
        ease: 'Sine.easeInOut',
        onComplete: () => r(),
      }),
    );
    this.turned = by;
  }

  /** Brake back on: sails swing back to rest. */
  async reset(): Promise<void> {
    this.setLever(false);
    await new Promise<void>((r) =>
      this.scene.tweens.add({ targets: this.sails, rotation: this.restRotation, duration: motion.reduced ? 300 : 1400, ease: 'Sine.easeInOut', onComplete: () => r() }),
    );
    this.turned = 0;
  }

  /** Little idle wobble so the sails feel alive in the breeze. */
  breeze(time: number): void {
    if (this.turned === 0 && !motion.reduced) this.sails.rotation = this.restRotation + Math.sin(time / 900) * 0.015;
    this.vane.rotation = Math.sin(time / 700) * 0.04;
  }
}

function wait(scene: Phaser.Scene, ms: number): Promise<void> {
  return new Promise((r) => scene.time.delayedCall(ms, r));
}
