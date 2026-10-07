import Phaser from 'phaser';
import { makeImage } from '../../art/rasterize';
import { partArt } from '../../art/scenes/tinker';
import { P, hex } from '../../art/palette';
import { BOARD, CHALLENGES, layoutFor, type ChallengeId, type ChallengeOptions } from '../../content/tinker/challenges';
import { Sim, type Part } from '../../content/tinker/sim';
import { audio } from '../../core/audio';

export interface InventionData {
  challenge?: ChallengeId;
  parts?: Part[];
  options?: ChallengeOptions;
}

/** Art keys a display needs (for a scene's artKeys()). */
export function inventionArtKeys(): string[] {
  const keys = ['tk.ramp', 'tk.plank', 'tk.curve', 'tk.bumper', 'tk.spring', 'tk.fan', 'tk.block', 'tk.basket', 'tk.moss', 'tk.wheel', 'tk.flag', 'tk.flower', 'tk.bell', 'tk.ribbon', 'tk.acorn', 'tk.parcel', 'tk.snail', 'tk.berry', 'tk.ledge'];
  for (let i = 0; i < 5; i++) keys.push(`tk.chime.${i}`);
  return keys;
}

/**
 * A saved invention shown in miniature with its real parts — and it still
 * works: tapping runs the same deterministic simulation.
 */
export class InventionDisplay {
  readonly c: Phaser.GameObjects.Container;
  private bodies: Phaser.GameObjects.Image[] = [];
  private sim: Sim | null = null;
  private seen = 0;
  private readonly layoutParts: Part[];
  private readonly challenge: ChallengeId;
  private readonly options: ChallengeOptions;

  constructor(
    private scene: Phaser.Scene,
    x: number,
    y: number,
    width: number,
    data: InventionData,
  ) {
    this.challenge = data.challenge && CHALLENGES[data.challenge] ? data.challenge : 'free';
    this.layoutParts = (data.parts ?? []).filter((p) => p && typeof p.x === 'number');
    this.options = data.options ?? {};
    const s = width / BOARD.w;
    this.c = scene.add.container(x - width / 2, y - (BOARD.h * s) / 2).setScale(s);
    const g = scene.make.graphics({}, false);
    g.fillStyle(hex('#e9c99a'), 1).fillRoundedRect(0, 0, BOARD.w, BOARD.h, 30);
    g.fillStyle(hex(P.woodDark), 1).fillRect(0, 780, BOARD.w, 20);
    if (this.challenge === 'acorn-crossing') g.fillStyle(hex(P.water), 1).fillRect(520, 680, 520, 100);
    this.c.add(g);
    for (const p of CHALLENGES[this.challenge].fixed) {
      if (p.id.startsWith('floor')) continue;
      this.c.add(makeImage(scene, p.x, p.y, p.id === 'ledge' ? 'tk.ledge' : partArt(p.kind, p.note)).setRotation(Phaser.Math.DegToRad(p.rot)));
    }
    for (const p of this.layoutParts) {
      const img = makeImage(scene, p.x, p.y, partArt(p.kind, p.note)).setRotation(Phaser.Math.DegToRad(p.rot));
      if (p.kind === 'wheel' && p.spin === -1) img.setFlipX(true);
      this.c.add(img);
    }
    this.resetBodies();
    scene.events.on(Phaser.Scenes.Events.UPDATE, this.update, this);
    this.c.once(Phaser.GameObjects.Events.DESTROY, () => scene.events.off(Phaser.Scenes.Events.UPDATE, this.update, this));
  }

  private resetBodies(): void {
    for (const b of this.bodies) b.destroy();
    this.bodies = [];
    for (const b of CHALLENGES[this.challenge].bodies(this.options)) {
      const img = makeImage(this.scene, b.x, b.y, `tk.${b.kind}`);
      this.c.add(img);
      this.bodies.push(img);
    }
  }

  get running(): boolean {
    return !!this.sim;
  }

  play(): void {
    this.resetBodies();
    this.sim = new Sim(layoutFor(this.challenge, this.layoutParts, this.options));
    this.seen = 0;
    audio.play('clack');
  }

  private update(_t: number, delta: number): void {
    const sim = this.sim;
    if (!sim) return;
    sim.advance(Math.min(delta, 50) / 1000);
    sim.bodies.forEach((b, i) => this.bodies[i]?.setPosition(b.x, b.y).setRotation(b.kind === 'snail' || b.kind === 'parcel' ? 0 : b.angle));
    while (this.seen < sim.events.length) {
      const e = sim.events[this.seen++];
      if (e.type === 'chime') audio.play('chime', { note: e.note, vol: 0.6 });
      else if (e.type === 'bounce' || e.type === 'spring') audio.play('boing', { vol: 0.5 });
      else if (e.type === 'splash') audio.play('splash', { vol: 0.5 });
      else if (e.type === 'goal') audio.play('success', { vol: 0.5 });
    }
    if (sim.done) {
      this.sim = null;
      this.scene.time.delayedCall(1500, () => this.c.active && !this.sim && this.resetBodies());
    }
  }
}
