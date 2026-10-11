import Phaser from 'phaser';
import { makeImage } from '../../../../art/rasterize';
import { groundY } from '../../../../content/trail/windmillModel';
import { audio } from '../../../../core/audio';
import { motion } from '../../../../core/motion';

/** The soft landing nest on a little wagon (the "landing pad"). */
export class NestWagon {
  readonly c: Phaser.GameObjects.Container;
  private wheels: Phaser.GameObjects.Image[];
  private chocks: Phaser.GameObjects.Image[];
  loops: Phaser.GameObjects.Image[] = [];
  chocked = false;

  constructor(
    private scene: Phaser.Scene,
    x: number,
    depth: number,
  ) {
    this.c = scene.add.container(x, groundY(x)).setDepth(depth);
    const body = makeImage(scene, 0, -18, 'wh.nest');
    this.wheels = [makeImage(scene, -70, -26, 'wh.wheel'), makeImage(scene, 70, -26, 'wh.wheel')];
    this.chocks = [makeImage(scene, -104, 2, 'wh.chock').setVisible(false), makeImage(scene, 104, 2, 'wh.chock').setVisible(false).setFlipX(true)];
    this.c.add([...this.chocks, body, ...this.wheels]);
    this.updateTilt();
  }

  get x(): number {
    return this.c.x;
  }

  private updateTilt(): void {
    const l = groundY(this.c.x - 70);
    const r = groundY(this.c.x + 70);
    this.c.rotation = Math.atan2(r - l, 140);
    this.c.y = (l + r) / 2;
  }

  /** Put the wagon at x straight away (resuming a saved game). */
  place(x: number): void {
    this.c.x = x;
    this.updateTilt();
  }

  setChocks(on: boolean): void {
    this.chocked = on;
    for (const c of this.chocks) c.setVisible(on);
  }

  /** Move to x. `rolling` = runaway roll (bouncier, faster at the end). */
  moveTo(x: number, rolling = false): Promise<void> {
    const dist = Math.abs(x - this.c.x);
    const dir = Math.sign(x - this.c.x);
    audio.play(rolling ? 'whirr' : 'creak', { pitch: rolling ? 1.2 : 1 });
    return new Promise((resolve) => {
      this.scene.tweens.add({
        targets: this.c,
        x,
        duration: motion.reduced ? Math.min(500, dist * 1.2) : Math.max(500, dist * (rolling ? 1.6 : 2.6)),
        ease: rolling ? 'Quad.easeIn' : 'Sine.easeInOut',
        onUpdate: () => {
          this.updateTilt();
          for (const w of this.wheels) w.rotation += dir * 0.12;
        },
        onComplete: () => {
          this.updateTilt();
          resolve();
        },
      });
    });
  }

  /** Ribbon wraps the wheels: three loops to untangle. Returns their world positions. */
  tangle(): { x: number; y: number }[] {
    this.clearLoops();
    const spots = [
      [-70, -26],
      [70, -26],
      [0, -40],
    ];
    const out: { x: number; y: number }[] = [];
    for (const [lx, ly] of spots) {
      const loop = makeImage(this.scene, lx, ly, 'wh.ribbon.loop').setScale(0.2);
      this.c.add(loop);
      this.loops.push(loop);
      this.scene.tweens.add({ targets: loop, scale: 1, duration: 260, ease: 'Back.easeOut' });
      out.push(this.toWorld(lx, ly));
    }
    return out;
  }

  untangleOne(i: number, toward: { x: number; y: number }): void {
    const loop = this.loops[i];
    if (!loop || !loop.visible) return;
    const w = this.toWorld(loop.x, loop.y);
    this.c.remove(loop);
    this.scene.add.existing(loop);
    loop.setPosition(w.x, w.y).setDepth(this.c.depth + 5);
    audio.play('zip');
    this.scene.tweens.add({
      targets: loop,
      x: toward.x,
      y: toward.y,
      scale: 0.3,
      rotation: 6,
      duration: 520,
      ease: 'Quad.easeIn',
      onComplete: () => loop.setVisible(false),
    });
  }

  loopsLeft(): number {
    return this.loops.filter((l) => l.visible && l.parentContainer === this.c).length;
  }

  clearLoops(): void {
    for (const l of this.loops) l.destroy();
    this.loops = [];
  }

  toWorld(lx: number, ly: number): { x: number; y: number } {
    const m = this.c.getWorldTransformMatrix();
    const v = new Phaser.Math.Vector2();
    m.transformPoint(lx, ly, v);
    return { x: v.x, y: v.y };
  }

  /** world point where a kite sits when caught */
  seat(): { x: number; y: number } {
    return this.toWorld(0, -110);
  }

  /** Squish and spring back (a soft landing). Higher pitch = a bigger, happier boing. */
  bounce(pitch = 0.8): void {
    if (!motion.reduced) this.scene.tweens.add({ targets: this.c, scaleY: 0.8, scaleX: 1.1, duration: 120, yoyo: true, ease: 'Quad.easeOut' });
    audio.play('boing', { pitch, vol: 0.8 });
  }
}
