import Phaser from 'phaser';
import { addImage, makeImage } from '../../../../art/rasterize';
import { hex, P } from '../../../../art/palette';
import { choiceColor } from '../../../../art/palette';

export type TailLook = { pattern: string; color: string } | 'plain' | null;

/**
 * Pip's kite with a rope-simulated tail (Verlet) that streams in the wind,
 * and an optional string to a holder.
 */
export class KiteActor {
  readonly img: Phaser.GameObjects.Image;
  private g: Phaser.GameObjects.Graphics;
  private stringG: Phaser.GameObjects.Graphics;
  private nodes: { x: number; y: number; px: number; py: number }[] = [];
  private bows: Phaser.GameObjects.Image[] = [];
  private look: TailLook = 'plain';
  stringTo: { x: number; y: number } | null = null;
  windX = -150;
  private readonly segLen = 22;
  private readonly count = 11;

  constructor(
    private scene: Phaser.Scene,
    x: number,
    y: number,
    depth: number,
  ) {
    this.stringG = scene.add.graphics().setDepth(depth - 2);
    this.g = scene.add.graphics().setDepth(depth - 1);
    this.img = addImage(scene, x, y, 'wh.kite').setDepth(depth);
    this.resetTail();
  }

  get x(): number {
    return this.img.x;
  }
  get y(): number {
    return this.img.y;
  }

  setPosition(x: number, y: number): void {
    this.img.setPosition(x, y);
  }

  private anchor(): { x: number; y: number } {
    const a = this.img.rotation;
    return { x: this.img.x - Math.sin(a) * 78 * this.img.scaleY, y: this.img.y + Math.cos(a) * 78 * this.img.scaleY };
  }

  resetTail(): void {
    const a = this.anchor();
    this.nodes = Array.from({ length: this.count }, (_, i) => ({ x: a.x, y: a.y + i * this.segLen, px: a.x, py: a.y + i * this.segLen }));
  }

  setTail(look: TailLook): void {
    this.look = look;
    for (const b of this.bows) b.destroy();
    this.bows = [];
    if (look && look !== 'plain') {
      for (let i = 0; i < 3; i++) {
        const b = makeImage(this.scene, 0, 0, `kite.bow.${look.pattern}`).setTint(hex(choiceColor(look.color))).setDepth(this.img.depth - 0.5);
        this.scene.add.existing(b);
        this.bows.push(b);
      }
    }
    this.resetTail();
  }

  get tail(): TailLook {
    return this.look;
  }

  update(deltaMs: number): void {
    const dt = Math.min(0.033, deltaMs / 1000);
    const a = this.anchor();
    if (this.look) {
      const gx = this.windX * 3.2;
      const gy = 700;
      for (let i = 1; i < this.nodes.length; i++) {
        const n = this.nodes[i];
        const vx = (n.x - n.px) * 0.96;
        const vy = (n.y - n.py) * 0.96;
        n.px = n.x;
        n.py = n.y;
        n.x += vx + gx * dt * dt;
        n.y += vy + gy * dt * dt;
      }
      this.nodes[0].x = a.x;
      this.nodes[0].y = a.y;
      for (let k = 0; k < 4; k++) {
        for (let i = 1; i < this.nodes.length; i++) {
          const p = this.nodes[i - 1];
          const n = this.nodes[i];
          const dx = n.x - p.x;
          const dy = n.y - p.y;
          const d = Math.hypot(dx, dy) || 1;
          const diff = (d - this.segLen) / d;
          if (i === 1) {
            n.x -= dx * diff;
            n.y -= dy * diff;
          } else {
            p.x += dx * diff * 0.5;
            p.y += dy * diff * 0.5;
            n.x -= dx * diff * 0.5;
            n.y -= dy * diff * 0.5;
          }
        }
        this.nodes[0].x = a.x;
        this.nodes[0].y = a.y;
      }
    }
    this.draw();
  }

  private draw(): void {
    const g = this.g;
    g.clear();
    if (this.look) {
      const color = this.look === 'plain' ? hex(P.cream) : hex(choiceColor(this.look.color));
      g.lineStyle(11, hex(P.ink), 1);
      g.strokePoints(this.nodes as unknown as Phaser.Math.Vector2[], false);
      g.lineStyle(6, color, 1);
      g.strokePoints(this.nodes as unknown as Phaser.Math.Vector2[], false);
      this.bows.forEach((b, i) => {
        const n = this.nodes[3 + i * 3];
        if (n) b.setPosition(n.x, n.y).setRotation(Math.sin(this.scene.time.now / 300 + i) * 0.3);
      });
    }
    const s = this.stringG;
    s.clear();
    if (this.stringTo) {
      s.lineStyle(3, hex(P.ink), 0.85);
      const mx = (this.img.x + this.stringTo.x) / 2;
      const my = Math.max(this.img.y, this.stringTo.y) - 40;
      const curve = new Phaser.Curves.QuadraticBezier(new Phaser.Math.Vector2(this.img.x, this.img.y + 10), new Phaser.Math.Vector2(mx, my + 80), new Phaser.Math.Vector2(this.stringTo.x, this.stringTo.y));
      curve.draw(s, 24);
    }
  }

  destroy(): void {
    this.img.destroy();
    this.g.destroy();
    this.stringG.destroy();
    for (const b of this.bows) b.destroy();
  }
}
