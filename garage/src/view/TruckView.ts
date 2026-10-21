import Phaser from 'phaser';
import type { Lane } from '../core/terrain';
import type { TruckLook } from '../save/schema';
import { TUNING } from '../config/tuning';
import { PAINTS, hex } from '../art/palette';
import { makeImage, setPiece } from '../art/rasterize';
import { app } from '../app/context';

/**
 * The truck on screen: separate wheels, paint (tinted body), pattern overlay,
 * decal, trim, shadow. Driven by the physics state each frame; lean, squash,
 * wheel spin, suspension bob and the spring coils are visual only.
 *
 * Layout (container at the ground contact point, faces right):
 *   shadow (stays on the ground) · chassis [ wheels · struts/coils · body [ paint · pattern · trim · decal ] ]
 * The chassis tilts with the ground under the two wheels (so both tyres touch
 * it); the body leans, bobs and squashes on its suspension above the hubs.
 */
export interface TruckPose {
  /** ground contact point (world units), as in TruckSim */
  x: number;
  y: number;
  vx: number;
  vy: number;
  slope: number;
  accel: number;
  squash: number;
  rolled: number;
  grounded: boolean;
  /** optional: the height of the ground below the truck (for the shadow while airborne; null = water/no ground) */
  groundY?: number | null;
  /** optional: the body angle from the physics (in the air it spins through flips) */
  angle?: number;
  /** optional: on a boost strip (exhaust flame) */
  boosting?: boolean;
}

const wrapPi = (a: number) => a - Math.PI * 2 * Math.round(a / (Math.PI * 2));
/** in the air the body turns around its middle, this far above the wheels' contact point */
const SPIN_PIVOT = 74;

/** Ground probe: the surface height at x for a truck around height y (null = no ground, e.g. water). */
export type GroundProbe = (x: number, y: number) => number | null;

/** Art keys a TruckView needs rasterised (all looks). */
export const TRUCK_VIEW_KEYS = [
  'truck.shadow',
  'truck.body',
  'truck.trim',
  'truck.pat.stripes',
  'truck.pat.zigzag',
  'truck.pat.dots',
  'truck.pat.stars',
  'truck.pat.checks',
  'decal.bolt',
  'decal.star',
  'decal.paw',
  'decal.leaf',
  'decal.b',
  'wheel.chunky',
  'wheel.spring',
  'spring.coil',
  'chunky.strut',
  'fx.flame',
] as const;

export const WHEEL_X = { rear: -84, front: 88 } as const;
export const WHEEL_R = { chunky: 60, spring: 54 } as const;
/** body pivot above the wheel hubs (spring wheels ride taller so their coils show) */
const BODY_GAP = { chunky: 18, spring: 36 } as const;
const LANE_DROP = 26;
const DEPTH_TRUCK = 10;
const DEPTH_FRONT_TRUCK = 21;

function reducedFromApp(): boolean {
  try {
    return app().reducedMotion();
  } catch {
    return false;
  }
}

export class TruckView {
  readonly container: Phaser.GameObjects.Container;
  private scene: Phaser.Scene;
  private look: TruckLook;
  private ghost: boolean;
  private baseScale: number;
  private baseDepth: number;
  private reducedOpt: boolean | undefined;

  private shadow: Phaser.GameObjects.Image;
  private chassis: Phaser.GameObjects.Container;
  private wheels: Phaser.GameObjects.Image[];
  private supports: Phaser.GameObjects.Image[];
  private body: Phaser.GameObjects.Container;
  private flame: Phaser.GameObjects.Image;
  private flameOn = 0;
  private airK = 0;
  private clock = 0;
  private paint: Phaser.GameObjects.Image;
  private pattern: Phaser.GameObjects.Image;
  private trim: Phaser.GameObjects.Image;
  private decal: Phaser.GameObjects.Image;

  private lane: Lane = 'back';
  private probe: GroundProbe | null = null;
  private lastGroundY = 0;
  private hasPose = false;
  // smoothed visual state
  private chassisAngle = 0;
  private lean = 0;
  private bobPhase = 0;
  private bob = 0;
  private comp = 0; // suspension compression (0..1), damped spring
  private compVel = 0;
  private kickT = 0;
  private cheerLift = 0;
  private stretch = 0;
  private alive = true;

  constructor(scene: Phaser.Scene, look: TruckLook, opts: { ghost?: boolean; scale?: number; depth?: number; reduced?: boolean } = {}) {
    this.scene = scene;
    this.look = { ...look };
    this.ghost = !!opts.ghost;
    this.baseScale = opts.scale ?? 1;
    this.baseDepth = opts.depth ?? DEPTH_TRUCK;
    this.reducedOpt = opts.reduced;

    this.container = scene.add.container(0, 0);
    this.shadow = makeImage(scene, 0, 0, 'truck.shadow');
    this.chassis = new Phaser.GameObjects.Container(scene, 0, 0);
    this.wheels = [makeImage(scene, WHEEL_X.rear, 0, 'wheel.chunky'), makeImage(scene, WHEEL_X.front, 0, 'wheel.chunky')];
    this.supports = [makeImage(scene, WHEEL_X.rear, 0, 'chunky.strut'), makeImage(scene, WHEEL_X.front, 0, 'chunky.strut')];
    this.body = new Phaser.GameObjects.Container(scene, 0, 0);
    this.paint = makeImage(scene, 0, 0, 'truck.body');
    this.pattern = makeImage(scene, 0, 0, 'truck.pat.stripes');
    this.trim = makeImage(scene, 0, 0, 'truck.trim');
    this.decal = makeImage(scene, 40, -40, 'decal.bolt').setScale(0.75);
    this.body.add([this.paint, this.pattern, this.trim, this.decal]);
    this.flame = makeImage(scene, -136, -40, 'fx.flame').setOrigin(1, 0.5).setVisible(false);
    this.chassis.add([this.flame, ...this.wheels, ...this.supports, this.body]);
    this.container.add([this.shadow, this.chassis]);

    this.container.setScale(this.baseScale);
    this.container.setDepth(this.baseDepth);
    if (this.ghost) {
      this.container.setAlpha(0.45);
      this.shadow.setVisible(false);
    }
    this.setLook(look);
    this.layout();
  }

  private get reduced(): boolean {
    return this.reducedOpt ?? reducedFromApp();
  }

  /** Optional: let the view find the ground under each wheel (tilts the chassis exactly onto slopes and lips). */
  setGroundProbe(probe: GroundProbe | null): void {
    this.probe = probe;
  }

  setReduced(on: boolean | undefined): void {
    this.reducedOpt = on;
  }

  /** change paint / pattern / decal / wheels instantly */
  setLook(look: TruckLook): void {
    this.look = { ...look };
    const paint = PAINTS.find((p) => p.id === look.paint) ?? PAINTS[0];
    this.paint.setTint(hex(paint.hex));
    if (look.pattern === 'plain') this.pattern.setVisible(false);
    else {
      setPiece(this.pattern, `truck.pat.${look.pattern}`);
      this.pattern.setVisible(true);
    }
    if (look.decal === 'none') this.decal.setVisible(false);
    else {
      setPiece(this.decal, `decal.${look.decal}`);
      this.decal.setVisible(true);
    }
    const spring = look.wheel === 'spring';
    for (const w of this.wheels) setPiece(w, spring ? 'wheel.spring' : 'wheel.chunky');
    for (const s of this.supports) setPiece(s, spring ? 'spring.coil' : 'chunky.strut');
    this.layout();
  }

  get wheelKind(): 'chunky' | 'spring' {
    return this.look.wheel;
  }

  /** call every frame with the physics state */
  update(p: TruckPose, dtSec: number): void {
    if (!this.alive) return;
    const dt = Math.max(0, Math.min(dtSec, 0.05));
    const reduced = this.reduced;
    const wheel = this.look.wheel;
    const r = WHEEL_R[wheel];
    this.hasPose = true;
    this.container.setPosition(p.x, p.y + this.laneDrop);

    // --- chassis angle: follow the ground under both wheels; tilt gently in the air
    let target: number;
    if (p.grounded) {
      this.lastGroundY = p.y;
      target = Math.atan(p.slope);
      if (this.probe) {
        const yr = this.probe(p.x + WHEEL_X.rear, p.y);
        const yf = this.probe(p.x + WHEEL_X.front, p.y);
        if (yr !== null && yf !== null && Math.abs(yr - p.y) < 90 && Math.abs(yf - p.y) < 90) {
          target = Math.atan2(yf - yr, WHEEL_X.front - WHEEL_X.rear);
        }
      }
    } else if (p.angle !== undefined) {
      // the physics spins the truck (flips); follow it closely
      target = p.angle;
    } else {
      target = Phaser.Math.Clamp(p.vy * 0.00017, -0.18, 0.18);
    }
    const kA = p.grounded ? 22 : p.angle !== undefined ? 30 : 5;
    // turn the short way round (after a flip, a full turn is the same as none)
    if (p.grounded) this.chassisAngle = target + wrapPi(this.chassisAngle - target);
    this.chassisAngle += wrapPi(target - this.chassisAngle) * (1 - Math.exp(-kA * dt));
    // in the air it turns around its middle; on the ground around the wheels
    this.airK += ((p.grounded ? 0 : 1) - this.airK) * (1 - Math.exp(-(p.grounded ? 14 : 6) * dt));
    this.clock += dt;
    this.flameOn += ((p.boosting ? 1 : 0) - this.flameOn) * (1 - Math.exp(-12 * dt));

    // --- body lean from acceleration (visual only)
    const leanT = Phaser.Math.Clamp(-p.accel * TUNING.feel.leanPerAccel, -TUNING.feel.maxLean, TUNING.feel.maxLean);
    this.lean += (leanT - this.lean) * (1 - Math.exp(-8 * dt));

    // --- suspension bob while driving on the ground
    const speedK = Math.min(1.3, Math.abs(p.vx) / TUNING.drive.speed);
    if (p.grounded && !reduced && speedK > 0.05) {
      this.bobPhase += dt * Math.PI * 2 * TUNING.feel.bobHz * (0.6 + 0.4 * speedK);
      this.bob = Math.sin(this.bobPhase) * TUNING.feel.bobAmp * speedK;
    } else this.bob *= Math.exp(-10 * dt);

    // --- landing squash: a damped spring toward the sim's squash (spring wheels rebound a touch)
    const squashT = reduced ? 0 : Math.min(1, p.squash);
    const stiff = 260;
    const damp = wheel === 'spring' ? 16 : 30;
    const acc = stiff * (squashT - this.comp) - damp * this.compVel;
    this.compVel += acc * dt;
    this.comp += this.compVel * dt;
    if (reduced) {
      this.comp = 0;
      this.compVel = 0;
    }
    // coils stretch a little with vertical speed in the air
    const stretchT = p.grounded || reduced ? 0 : Phaser.Math.Clamp(-p.vy / 1400, -0.4, 0.5);
    this.stretch += (stretchT - this.stretch) * (1 - Math.exp(-10 * dt));

    if (this.kickT > 0) this.kickT = Math.max(0, this.kickT - dt);

    // wheels spin with distance rolled
    for (const w of this.wheels) w.setRotation(p.rolled / r);

    // shadow on the ground below
    let gy: number | null | undefined = p.grounded ? p.y : p.groundY;
    if (gy === undefined) gy = this.probe ? this.probe(p.x, p.y) : this.lastGroundY;
    this.placeShadow(p.y, gy ?? null);
    this.layout();
  }

  private placeShadow(truckY: number, groundY: number | null): void {
    if (this.ghost) return;
    if (groundY === null || groundY < truckY - 4) {
      this.shadow.setVisible(false);
      return;
    }
    const h = groundY - truckY;
    const k = Phaser.Math.Clamp(1 - h / 520, 0.35, 1);
    this.shadow.setVisible(true);
    this.shadow.setPosition(0, h + 7);
    this.shadow.setScale(k, 1);
    this.shadow.setAlpha(0.35 + 0.65 * k);
    this.shadow.setRotation(h < 2 ? this.chassisAngle : 0);
  }

  /** place chassis parts from the current visual state */
  private layout(): void {
    const wheel = this.look.wheel;
    const r = WHEEL_R[wheel];
    const gap = BODY_GAP[wheel];
    this.chassis.setRotation(this.chassisAngle);
    const hp = SPIN_PIVOT * this.airK;
    this.chassis.setPosition(-hp * Math.sin(this.chassisAngle), -hp + hp * Math.cos(this.chassisAngle));
    for (const w of this.wheels) w.y = -r;
    const comp = Math.max(-0.4, this.comp);
    const kick = this.kickT > 0 ? -10 * Math.sin((this.kickT / 0.12) * Math.PI * 0.5) : 0;
    const drop = comp * 9 - this.stretch * 6;
    const bodyY = -r - gap + drop + this.bob + kick - this.cheerLift;
    this.body.setPosition(0, bodyY);
    // exhaust flame on a boost strip (flickers; steady with less motion)
    const fl = this.flameOn;
    this.flame.setVisible(fl > 0.05 && !this.ghost);
    if (fl > 0.05) {
      const flick = this.reduced ? 1 : 0.85 + 0.2 * Math.sin(this.clock * 38) + 0.1 * Math.sin(this.clock * 23);
      this.flame.setPosition(-136, bodyY - 34).setScale(fl * flick, fl * (0.9 + 0.1 * flick)).setAlpha(Math.min(1, fl * 1.4));
    }
    this.body.setRotation(this.lean);
    const sq = Math.max(0, comp) * 0.25;
    this.body.setScale(1 + sq * 0.45, 1 - sq);
    // struts / coils from just above each hub up into the chassis rail
    const hubTop = -r - (wheel === 'spring' ? 8 : 12);
    for (let i = 0; i < 2; i++) {
      const s = this.supports[i];
      const x = i === 0 ? WHEEL_X.rear : WHEEL_X.front;
      // where the body's underside is above this hub (body leans around its pivot)
      const under = bodyY + x * Math.sin(this.lean) - 8;
      const len = Math.max(8, hubTop - under);
      s.setPosition(x, hubTop);
      if (wheel === 'spring') s.setScale(1, len / 54);
      else s.setScale(1, len / 36);
    }
  }

  /** how far below the physics point the truck is drawn (front lane: 26 world units, scaled for previews) */
  private get laneDrop(): number {
    return this.lane === 'front' ? LANE_DROP * this.baseScale : 0;
  }

  /** front lane: drawn a little lower and in front of back-lane things */
  setLane(lane: Lane): void {
    const before = this.laneDrop;
    this.lane = lane;
    const dy = this.laneDrop - before;
    this.container.y += dy;
    this.container.setDepth(lane === 'front' ? Math.max(this.baseDepth, DEPTH_FRONT_TRUCK) : this.baseDepth);
  }

  setVisible(on: boolean): void {
    this.container.setVisible(on);
  }

  /** next-frame feedback when jump is pressed: a quick lift of the body */
  kick(): void {
    this.kickT = 0.12;
    this.layout();
  }

  /** soft vanish (miss) / reappear (checkpoint restore) */
  fadeOut(ms: number): Promise<void> {
    return this.fade(0, ms);
  }
  fadeIn(ms: number): Promise<void> {
    return this.fade(this.ghost ? 0.45 : 1, ms);
  }

  private fade(to: number, ms: number): Promise<void> {
    return new Promise((resolve) => {
      if (!this.alive) return resolve();
      this.scene.tweens.killTweensOf(this.container);
      const soft = !this.reduced;
      const out = to === 0;
      if (!out) {
        this.container.setVisible(true);
        if (soft) this.container.setScale(this.baseScale * 0.82);
      }
      const props: Phaser.Types.Tweens.TweenBuilderConfig = {
        targets: this.container,
        alpha: to,
        duration: Math.max(1, ms),
        ease: out ? 'Sine.easeIn' : 'Back.easeOut',
        onComplete: () => resolve(),
      };
      props.scale = soft ? (out ? this.baseScale * 0.8 : this.baseScale) : this.baseScale;
      if (ms <= 0) {
        this.container.setAlpha(to).setScale(this.baseScale);
        return resolve();
      }
      this.scene.tweens.add(props);
    });
  }

  /** a celebratory little bounce in place (wheels stay down) */
  cheer(): void {
    if (!this.alive) return;
    const proxy = { t: 0 };
    const reduced = this.reduced;
    this.scene.tweens.add({
      targets: proxy,
      t: 1,
      duration: reduced ? 240 : 760,
      onUpdate: () => {
        const t = proxy.t;
        // two hops: a bigger one then a smaller one (reduced: one tiny nudge)
        this.cheerLift = reduced ? Math.sin(t * Math.PI) * 4 : t < 0.55 ? Math.sin((t / 0.55) * Math.PI) * 22 : Math.sin(((t - 0.55) / 0.45) * Math.PI) * 10;
        this.layout();
      },
      onComplete: () => {
        this.cheerLift = 0;
        this.layout();
      },
    });
  }

  /** for previews (no physics): place on a flat ground point */
  placeStatic(x: number, y: number): void {
    this.update({ x, y, vx: 0, vy: 0, slope: 0, accel: 0, squash: 0, rolled: 0, grounded: true }, 0);
  }

  get poseApplied(): boolean {
    return this.hasPose;
  }

  destroy(): void {
    this.alive = false;
    this.scene.tweens.killTweensOf(this.container);
    this.container.destroy();
  }
}
