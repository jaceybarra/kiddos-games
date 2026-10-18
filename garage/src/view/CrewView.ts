import Phaser from 'phaser';
import type { CrewId } from '../content/missions';
import type { Pose } from '../art/crew';
import { P, hex } from '../art/palette';
import { makeImage, setPiece } from '../art/rasterize';
import { app } from '../app/context';
import type { Segment } from '../core/terrain';
import { INK, drawPiece, dashPoly, fillPoly, strokePoly, strokeLine, type Pt } from './pieces';

/**
 * A crew member: pose swaps, idle breathing, walking/riding, hops, pointing,
 * a thought bubble with a picture, little emotes. Never sad, never lonely.
 * Everything runs on the scene's tweens and update(), so pausing the scene
 * pauses the friend too.
 */
export type BubbleContent = 'wagon-gap' | 'ramp' | 'two-paths' | 'bumpy-high' | 'gentle-low' | 'ledge';
export type Emote = 'scribble' | 'spark' | 'heart' | 'check' | 'zzz-no';
type Prop = 'wagon' | 'kart' | 'scooter';

const CREW_IDS: CrewId[] = ['milo', 'pip', 'nori'];
const POSE_IDS: Pose[] = ['idle', 'notice', 'help', 'cheer'];

/** Art keys a CrewView needs rasterised. */
export const CREW_VIEW_KEYS: string[] = [
  ...CREW_IDS.flatMap((id) => POSE_IDS.map((p) => `crew.${id}.${p}`)),
  'prop.wagon',
  'prop.kart',
  'prop.scooter',
  'fx.bubble',
  'fx.scribble',
  'fx.spark',
  'fx.heart',
  'fx.check',
  'fx.arrow',
];

/** top of each friend's head (container units, feet at 0) and the head's x when facing left */
const HEAD: Record<CrewId, { top: number; x: number }> = {
  milo: { top: -206, x: -4 },
  pip: { top: -216, x: -2 },
  nori: { top: -158, x: -50 },
};
/** how far a ridden prop lifts the friend */
const RIDE_LIFT: Record<Prop, number> = { wagon: 0, kart: 30, scooter: 28 };
const OVER_DEPTH = 29;
/** how far behind the friend the pulled wagon's centre sits */
const WAGON_GAP = 128;

function reducedFromApp(): boolean {
  try {
    return app().reducedMotion();
  } catch {
    return false;
  }
}

export class CrewView {
  readonly id: CrewId;
  readonly container: Phaser.GameObjects.Container;
  x: number;
  y: number;
  private scene: Phaser.Scene;
  private reducedOpt: boolean | undefined;
  /** flips with facing */
  private inner: Phaser.GameObjects.Container;
  /** bob/hop offset */
  private lift: Phaser.GameObjects.Container;
  private figure: Phaser.GameObjects.Image;
  private propImg: Phaser.GameObjects.Image | null = null;
  private prop: Prop | null = null;
  /** bubbles, emotes and the pointing arrow: above the gameplay, never flipped */
  private over: Phaser.GameObjects.Container;
  private bubble: Phaser.GameObjects.Container | null = null;
  private bubbleTimer: Phaser.Time.TimerEvent | null = null;
  private arrow: Phaser.GameObjects.Image | null = null;
  private moveTween: Phaser.Tweens.Tween | null = null;
  private hopTween: Phaser.Tweens.Tween | null = null;
  private facing: 'left' | 'right' = 'left';
  private pose: Pose = 'idle';
  private t = Math.random() * 3;
  private moving = false;
  private hopY = 0;
  private bobY = 0;
  private alive = true;
  private wagonGap: number;

  constructor(
    scene: Phaser.Scene,
    id: CrewId,
    x: number,
    y: number,
    opts: { facing?: 'left' | 'right'; prop?: 'wagon' | 'kart' | 'scooter' | null; reduced?: boolean; depth?: number; wagonGap?: number } = {},
  ) {
    this.id = id;
    this.x = x;
    this.y = y;
    this.scene = scene;
    this.reducedOpt = opts.reduced;
    this.wagonGap = opts.wagonGap ?? WAGON_GAP;
    this.container = scene.add.container(x, y);
    this.inner = new Phaser.GameObjects.Container(scene, 0, 0);
    this.lift = new Phaser.GameObjects.Container(scene, 0, 0);
    this.figure = makeImage(scene, 0, 0, `crew.${id}.idle`);
    this.lift.add(this.figure);
    this.inner.add(this.lift);
    this.container.add(this.inner);
    this.container.setDepth(opts.depth ?? 9);
    this.over = scene.add.container(x, y).setDepth(OVER_DEPTH);
    this.face(opts.facing ?? 'left');
    this.setProp(opts.prop ?? null);
  }

  private get reduced(): boolean {
    return this.reducedOpt ?? reducedFromApp();
  }

  setReduced(on: boolean | undefined): void {
    this.reducedOpt = on;
  }

  private sync(): void {
    this.container.setPosition(this.x, this.y);
    this.over.setPosition(this.x, this.y);
    const ride = this.prop === 'kart' || this.prop === 'scooter' ? RIDE_LIFT[this.prop] : 0;
    this.lift.y = -ride + this.hopY + this.bobY;
    if (this.propImg && ride) this.propImg.y = this.hopY + this.bobY * 0.5;
  }

  setPose(p: Pose): void {
    if (!this.alive) return;
    this.pose = p;
    setPiece(this.figure, `crew.${this.id}.${p}`);
    if (p !== 'notice') this.stopPointing();
  }

  get currentPose(): Pose {
    return this.pose;
  }

  face(dir: 'left' | 'right'): void {
    if (!this.alive) return;
    this.facing = dir;
    this.inner.setScale(dir === 'left' ? 1 : -1, 1);
  }

  /** show or hide the friend's vehicle (wagon is pulled behind, kart/scooter ridden) */
  setProp(prop: 'wagon' | 'kart' | 'scooter' | null): void {
    if (!this.alive) return;
    if (this.propImg) {
      this.propImg.destroy();
      this.propImg = null;
    }
    this.prop = prop;
    if (prop) {
      // the prop art faces right; in the friend's (facing-left) frame it is mirrored
      const img = makeImage(this.scene, prop === 'wagon' ? this.wagonGap : prop === 'kart' ? 6 : -4, 0, `prop.${prop}`);
      img.setScale(-1, 1);
      this.propImg = img;
      if (prop === 'kart') this.inner.add(img); // the kart's tub hides the legs
      else this.inner.addAt(img, 0); // wagon behind, scooter deck under the feet
    }
    this.sync();
  }

  /** distance from the friend to the pulled wagon's centre (the wagon is about 190 long) */
  setWagonGap(dx: number): void {
    this.wagonGap = dx;
    if (this.prop === 'wagon' && this.propImg) this.propImg.x = dx;
  }

  /** move along the ground to x at `speed` units/s; groundY(x) gives the height. Resolves on arrival. */
  moveTo(x: number, groundY: (x: number) => number, speed: number): Promise<void> {
    if (!this.alive) return Promise.resolve();
    this.moveTween?.stop();
    const from = this.x;
    const dist = Math.abs(x - from);
    if (dist < 1 || speed <= 0) {
      this.x = x;
      this.y = groundY(x);
      this.sync();
      return Promise.resolve();
    }
    this.face(x > from ? 'right' : 'left');
    const riding = this.prop === 'kart' || this.prop === 'scooter';
    const reduced = this.reduced;
    return new Promise((resolve) => {
      const proxy = { t: 0 };
      this.moving = true;
      this.moveTween = this.scene.tweens.add({
        targets: proxy,
        t: 1,
        duration: (dist / speed) * 1000,
        ease: 'Linear',
        onUpdate: () => {
          const cx = from + (x - from) * proxy.t;
          this.x = cx;
          this.y = groundY(cx);
          const d = dist * proxy.t;
          this.bobY = reduced ? 0 : riding ? Math.sin(d / 18) * 2 : -Math.abs(Math.sin((d / 46) * Math.PI)) * 7;
          this.sync();
        },
        onComplete: () => this.endMove(resolve),
        onStop: () => this.endMove(resolve),
      });
    });
  }

  private endMove(resolve: () => void): void {
    this.moving = false;
    this.moveTween = null;
    this.bobY = 0;
    this.sync();
    resolve();
  }

  /** follow a path of points (jumps, ramps), riding the prop */
  followPath(points: { x: number; y: number }[], speed: number): Promise<void> {
    if (!this.alive) return Promise.resolve();
    this.moveTween?.stop();
    if (points.length === 0) return Promise.resolve();
    const pts = [{ x: this.x, y: this.y }, ...points];
    const lens = [0];
    for (let i = 1; i < pts.length; i++) lens.push(lens[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
    const total = lens[lens.length - 1];
    if (total < 1 || speed <= 0) {
      const last = pts[pts.length - 1];
      this.x = last.x;
      this.y = last.y;
      this.sync();
      return Promise.resolve();
    }
    const end = pts[pts.length - 1];
    if (Math.abs(end.x - this.x) > 1) this.face(end.x > this.x ? 'right' : 'left');
    return new Promise((resolve) => {
      const proxy = { d: 0 };
      this.moving = true;
      let seg = 1;
      this.moveTween = this.scene.tweens.add({
        targets: proxy,
        d: total,
        duration: (total / speed) * 1000,
        ease: 'Linear',
        onUpdate: () => {
          while (seg < lens.length - 1 && lens[seg] < proxy.d) seg++;
          const a = pts[seg - 1];
          const b = pts[seg];
          const span = lens[seg] - lens[seg - 1];
          const t = span > 0 ? (proxy.d - lens[seg - 1]) / span : 1;
          this.x = a.x + (b.x - a.x) * t;
          this.y = a.y + (b.y - a.y) * t;
          if (Math.abs(b.x - a.x) > 2) this.face(b.x > a.x ? 'right' : 'left');
          this.sync();
        },
        onComplete: () => this.endMove(resolve),
        onStop: () => this.endMove(resolve),
      });
    });
  }

  hop(height = 60): Promise<void> {
    if (!this.alive) return Promise.resolve();
    this.hopTween?.stop();
    const reduced = this.reduced;
    const h = reduced ? Math.min(10, height * 0.2) : height;
    return new Promise((resolve) => {
      const proxy = { t: 0 };
      this.hopTween = this.scene.tweens.add({
        targets: proxy,
        t: 1,
        duration: reduced ? 200 : 460,
        onUpdate: () => {
          this.hopY = -h * 4 * proxy.t * (1 - proxy.t);
          this.sync();
        },
        onComplete: () => {
          this.hopY = 0;
          this.hopTween = null;
          this.sync();
          resolve();
        },
        onStop: () => {
          this.hopY = 0;
          this.hopTween = null;
          this.sync();
          resolve();
        },
      });
    });
  }

  /** a thought bubble with a picture, for `ms` (stays until hideThought if ms = 0) */
  think(content: BubbleContent, ms: number): Promise<void> {
    if (!this.alive) return Promise.resolve();
    this.hideThought(true);
    const head = HEAD[this.id];
    const hx = this.facing === 'left' ? head.x : -head.x;
    const b = new Phaser.GameObjects.Container(this.scene, hx + 64, head.top - 160);
    b.add(makeImage(this.scene, 0, 0, 'fx.bubble'));
    const g = new Phaser.GameObjects.Graphics(this.scene);
    drawThought(this.scene, b, g, content);
    this.over.add(b);
    this.bubble = b;
    const S = 0.85;
    const reduced = this.reduced;
    return new Promise((resolve) => {
      if (reduced) {
        b.setScale(S).setAlpha(0);
        this.scene.tweens.add({ targets: b, alpha: 1, duration: 160 });
      } else {
        b.setScale(S * 0.4).setAlpha(0.2);
        this.scene.tweens.add({ targets: b, scale: S, alpha: 1, duration: 280, ease: 'Back.easeOut' });
      }
      if (ms > 0) {
        this.bubbleTimer = this.scene.time.delayedCall(ms, () => {
          this.bubbleTimer = null;
          this.hideThought();
          this.scene.time.delayedCall(220, () => resolve());
        });
      } else this.scene.time.delayedCall(reduced ? 160 : 280, () => resolve());
    });
  }

  hideThought(instant = false): void {
    this.bubbleTimer?.remove(false);
    this.bubbleTimer = null;
    const b = this.bubble;
    if (!b) return;
    this.bubble = null;
    this.scene.tweens.killTweensOf(b);
    if (instant || !this.alive) {
      b.destroy();
      return;
    }
    this.scene.tweens.add({ targets: b, alpha: 0, scale: b.scale * 0.9, duration: 200, onComplete: () => b.destroy() });
  }

  emote(kind: Emote): void {
    if (!this.alive) return;
    if (kind === 'zzz-no') return;
    const key = kind === 'scribble' ? 'fx.scribble' : kind === 'spark' ? 'fx.spark' : kind === 'heart' ? 'fx.heart' : 'fx.check';
    const head = HEAD[this.id];
    const hx = this.facing === 'left' ? head.x : -head.x;
    const im = makeImage(this.scene, hx + (kind === 'scribble' ? 0 : 30), head.top - 46, key);
    this.over.add(im);
    const S = kind === 'check' ? 0.6 : 0.85;
    const done = () => im.destroy();
    if (this.reduced) {
      im.setScale(S).setAlpha(0);
      this.scene.tweens.add({ targets: im, alpha: 1, duration: 160, yoyo: true, hold: 900, onComplete: done });
      return;
    }
    im.setScale(0.1);
    this.scene.tweens.add({
      targets: im,
      scale: S,
      y: im.y - 18,
      duration: 260,
      ease: 'Back.easeOut',
      onComplete: () => {
        if (kind === 'scribble') this.scene.tweens.add({ targets: im, angle: { from: -8, to: 8 }, duration: 160, yoyo: true, repeat: 2 });
        this.scene.tweens.add({ targets: im, alpha: 0, y: im.y - 14, delay: 900, duration: 300, onComplete: done });
      },
    });
  }

  /** notice pose and a pointing arm/arrow toward a world x */
  pointAt(x: number): void {
    if (!this.alive) return;
    const dir = x >= this.x ? 1 : -1;
    this.face(dir > 0 ? 'right' : 'left');
    this.setPose('notice');
    this.stopPointing();
    const head = HEAD[this.id];
    const ax = dir * 120;
    const ay = head.top + 40;
    const a = makeImage(this.scene, ax, ay, 'fx.arrow').setScale(0.62).setRotation(dir > 0 ? -Math.PI / 2 : Math.PI / 2);
    this.over.add(a);
    this.arrow = a;
    if (!this.reduced) this.scene.tweens.add({ targets: a, x: ax + dir * 14, duration: 420, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  /** remove the pointing arrow (also happens on any other pose) */
  stopPointing(): void {
    if (!this.arrow) return;
    this.scene.tweens.killTweensOf(this.arrow);
    this.arrow.destroy();
    this.arrow = null;
  }

  /** cheer pose with a hop, then back to idle */
  async cheer(): Promise<void> {
    if (!this.alive) return;
    this.setPose('cheer');
    if (this.reduced) await new Promise<void>((r) => this.scene.time.delayedCall(900, () => r()));
    else {
      await this.hop(50);
      if (!this.alive) return;
      await new Promise<void>((r) => this.scene.time.delayedCall(380, () => r()));
    }
    if (this.alive && this.pose === 'cheer') this.setPose('idle');
  }

  update(dtSec: number): void {
    if (!this.alive) return;
    this.t += Math.max(0, Math.min(dtSec, 0.1));
    // idle breathing: a subtle 1 → 1.02 stretch from the feet (still when motion is reduced)
    const breathe = this.reduced || this.moving ? 0 : 0.01 * (1 - Math.cos((this.t * Math.PI * 2) / 2.2));
    this.figure.setScale(1, 1 + breathe);
  }

  setDepth(d: number): void {
    this.container.setDepth(d);
  }

  destroy(): void {
    this.alive = false;
    this.moveTween?.stop();
    this.hopTween?.stop();
    this.hideThought(true);
    this.stopPointing();
    this.scene.tweens.killTweensOf(this.over.list);
    this.container.destroy();
    this.over.destroy();
  }
}

// ------------------------------------------------------------------ thought pictures

const GRASS = hex(P.grass);
const GRASS_L = hex(P.grassLight);
const SOIL = hex(P.soil);
const WATER = hex(P.water);
const WATER_L = hex(P.waterLight);
const WOOD = hex(P.wood);
const WOOD_L = hex(P.woodLight);
const WOOD_D = hex(P.woodDark);

/** a little block of ground (grass on soil) from x0 to x1 with its top at y */
function groundBlock(g: Phaser.GameObjects.Graphics, x0: number, x1: number, y: number, bottom = 70): void {
  const box: Pt[] = [
    { x: x0, y },
    { x: x1, y },
    { x: x1, y: bottom },
    { x: x0, y: bottom },
  ];
  fillPoly(g, box, SOIL);
  fillPoly(g, [{ x: x0, y }, { x: x1, y }, { x: x1, y: y + 14 }, { x: x0, y: y + 14 }], GRASS);
  fillPoly(g, [{ x: x0, y }, { x: x1, y }, { x: x1, y: y + 5 }, { x: x0, y: y + 5 }], GRASS_L);
  strokePoly(g, box, 5, INK, 1, true);
}

/** a plank rotated around its centre */
function plank(g: Phaser.GameObjects.Graphics, cx: number, cy: number, len: number, angle: number): void {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const pts = [
    [-len / 2, -7],
    [len / 2, -7],
    [len / 2, 7],
    [-len / 2, 7],
  ].map(([x, y]) => ({ x: cx + x * c - y * s, y: cy + x * s + y * c }));
  fillPoly(g, pts, WOOD_L);
  strokePoly(g, pts, 4, INK, 1, true);
}

function bumpyPath(x0: number, x1: number, y: number, amp: number, bumps: number): Pt[] {
  const pts: Pt[] = [];
  for (let i = 0; i <= 48; i++) {
    const x = x0 + ((x1 - x0) * i) / 48;
    pts.push({ x, y: y - (0.5 - 0.5 * Math.cos((i / 48) * Math.PI * 2 * bumps)) * amp });
  }
  return pts;
}

/**
 * Draws the picture for `content` into the bubble container. The safe area
 * inside the bubble outline is about x ±112, y -80..72 (bubble units).
 */
function drawThought(scene: Phaser.Scene, b: Phaser.GameObjects.Container, g: Phaser.GameObjects.Graphics, content: BubbleContent): void {
  b.add(g);
  const seg = (x0: number, y0: number, x1: number, y1: number): Segment => ({ x0, y0, x1, y1, kind: 'ramp' });
  switch (content) {
    case 'wagon-gap': {
      groundBlock(g, -112, -14, 14);
      groundBlock(g, 46, 112, 14);
      const water: Pt[] = [
        { x: -14, y: 40 },
        { x: 46, y: 40 },
        { x: 46, y: 70 },
        { x: -14, y: 70 },
      ];
      fillPoly(g, water, WATER);
      strokeLine(g, -12, 40, 44, 40, 5, WATER_L);
      strokePoly(g, water, 4, INK, 1, true);
      // the broken plank: two halves hanging into the gap
      plank(g, -6, 34, 44, 1.1);
      plank(g, 40, 36, 36, -1.2);
      // a little crack mark over the gap
      strokePoly(g, [{ x: 10, y: -40 }, { x: 20, y: -26 }, { x: 12, y: -16 }, { x: 22, y: -2 }], 5, INK);
      b.add(makeImage(scene, -64, 14, 'prop.wagon').setScale(0.52));
      break;
    }
    case 'ramp': {
      groundBlock(g, -112, 112, 40);
      drawPiece(g, 'ramp', seg(-96, 40, 24, -34), 'solid');
      // the jump it makes: a dotted arc off the lip
      const arc: Pt[] = [];
      for (let i = 0; i <= 16; i++) {
        const t = i / 16;
        arc.push({ x: 32 + t * 72, y: -40 - Math.sin(t * Math.PI) * 34 + t * 64 });
      }
      dashPoly(g, arc, false, 5, INK, 0.85, 10, 9);
      break;
    }
    case 'two-paths': {
      groundBlock(g, -112, 112, 40);
      drawPiece(g, 'ramp', seg(-104, 40, -14, -16), 'solid');
      drawPiece(g, 'ramp', seg(10, 40, 100, -16), 'solid');
      break;
    }
    case 'bumpy-high': {
      groundBlock(g, -112, 112, 46);
      const path = bumpyPath(-104, 104, -16, 16, 4);
      // posts holding the high path up
      for (const x of [-70, 0, 70]) {
        const post: Pt[] = [
          { x: x - 7, y: -6 },
          { x: x + 7, y: -6 },
          { x: x + 7, y: 46 },
          { x: x - 7, y: 46 },
        ];
        fillPoly(g, post, WOOD_D);
        strokePoly(g, post, 4, INK, 1, true);
      }
      const band = [...path, ...path.map((p) => ({ x: p.x, y: p.y + 16 })).reverse()];
      fillPoly(g, band, WOOD);
      strokePoly(g, band, 5, INK, 1, true);
      // wobble marks
      for (const [x, d] of [
        [-58, -1],
        [-46, -1],
        [46, 1],
        [58, 1],
      ] as const) {
        strokePoly(g, [{ x: x + d * 4, y: -76 }, { x: x - d * 4, y: -64 }, { x: x + d * 4, y: -52 }], 4, INK);
      }
      break;
    }
    case 'gentle-low': {
      const top = bumpyPath(-112, 112, 34, 12, 2);
      const block = [...top, { x: 112, y: 70 }, { x: -112, y: 70 }];
      fillPoly(g, block, SOIL);
      const grass = [...top, ...top.map((p) => ({ x: p.x, y: p.y + 14 })).reverse()];
      fillPoly(g, grass, GRASS);
      strokePoly(g, block, 5, INK, 1, true);
      // a calm little flower
      strokeLine(g, -8, 26, -8, -6, 4, hex(P.leafDark));
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
        g.fillStyle(hex(P.yellow), 1);
        g.fillCircle(-8 + Math.cos(a) * 8, -14 + Math.sin(a) * 8, 7);
        g.lineStyle(3, INK, 1);
        g.strokeCircle(-8 + Math.cos(a) * 8, -14 + Math.sin(a) * 8, 7);
      }
      g.fillStyle(hex(P.orange), 1);
      g.fillCircle(-8, -14, 6);
      break;
    }
    case 'ledge': {
      groundBlock(g, -112, 14, 46);
      groundBlock(g, 14, 112, -34);
      // the ramp that would fit, as a dashed outline
      dashPoly(g, [{ x: -66, y: 46 }, { x: 14, y: -34 }, { x: 14, y: 46 }], true, 5, INK, 0.9, 12, 9);
      break;
    }
  }
}
