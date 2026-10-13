import { TUNING, type WheelKind } from '../config/tuning';
import type { Lane, Segment, Terrain } from './terrain';

/**
 * Arcade truck physics. The gameplay body is one point where the wheels touch
 * the ground (x, y) plus a length; lean, squash and wheel spin are drawn by
 * the view from the values here. Deterministic: the same inputs always give
 * the same run (tests and the track checker rely on that).
 */
export interface DriveInput {
  /** the jump button is held right now */
  jumpHeld: boolean;
  /** true on the frame the jump button went down */
  jumpPressed: boolean;
  brakeHeld: boolean;
}

export type TruckEvent =
  | { type: 'jump' }
  | { type: 'launch' }
  | { type: 'bounce' }
  | { type: 'land'; impact: number }
  | { type: 'blocked'; wallId: string }
  | { type: 'fell'; x: number };

export interface TruckOptions {
  wheel: WheelKind;
  /** speed multiplier (slower driving, per-mission setting) */
  speedFactor?: number;
  /** multiplies coyote and buffer windows (help after misses, "more help") */
  assist?: number;
  /** half the truck's length: its nose reaches this far ahead of x */
  halfLength?: number;
  lane?: Lane;
}

export class TruckSim {
  x: number;
  y: number;
  vx = 0;
  vy = 0;
  grounded = true;
  /** surface currently ridden (null in the air) */
  surface: Segment | null = null;
  slope = 0;
  /** time since leaving the ground without jumping (coyote time) */
  private sinceGround = 0;
  /** time since the jump button was pressed (input buffer) */
  private sincePress = Infinity;
  private holdLeft = 0;
  private jumping = false;
  /** ramps and pads throw the truck forward at full speed even with slower driving */
  private airSpeed = 0;
  /** last acceleration, for the view's lean */
  accel = 0;
  /** how hard the last landing was (0..1), decays for the view's squash */
  squash = 0;
  /** distance rolled, for wheel spin */
  rolled = 0;
  stopped = false;
  wheel: WheelKind;
  speedFactor: number;
  assist: number;
  lane: Lane;
  readonly halfLength: number;

  constructor(
    private terrain: Terrain,
    x: number,
    opts: TruckOptions,
  ) {
    this.wheel = opts.wheel;
    this.speedFactor = opts.speedFactor ?? 1;
    this.assist = opts.assist ?? 1;
    this.halfLength = opts.halfLength ?? 150;
    this.lane = opts.lane ?? 'back';
    this.x = x;
    const s = terrain.surfaceBelow(x, -Infinity, 0, this.lane);
    this.y = s ? s.y : TUNING.world.groundY;
    this.surface = s?.seg ?? null;
  }

  setTerrain(t: Terrain): void {
    this.terrain = t;
  }

  /** Put the truck on the ground at x (checkpoint restore), standing still. */
  placeAt(x: number, y?: number): void {
    this.x = x;
    const s = this.terrain.surfaceBelow(x, (y ?? -Infinity) - 40, 0, this.lane);
    this.y = s ? s.y : (y ?? TUNING.world.groundY);
    this.surface = s?.seg ?? null;
    this.vx = 0;
    this.vy = 0;
    this.grounded = true;
    this.jumping = false;
    this.airSpeed = 0;
    this.sinceGround = 0;
    this.sincePress = Infinity;
    this.squash = 0;
  }

  get targetSpeed(): number {
    return this.stopped ? 0 : TUNING.drive.speed * this.speedFactor;
  }

  step(dtSec: number, input: DriveInput): TruckEvent[] {
    const ev: TruckEvent[] = [];
    const dt = Math.min(dtSec, 0.05);
    const J = TUNING.jump;
    const coyote = (J.coyoteMs / 1000) * this.assist;
    const buffer = (J.bufferMs / 1000) * this.assist;

    // speed
    const want = input.brakeHeld ? 0 : this.targetSpeed;
    const prevVx = this.vx;
    if (this.vx < want) this.vx = Math.min(want, this.vx + TUNING.drive.accel * dt);
    else if (this.vx > want) this.vx = Math.max(want, this.vx - (input.brakeHeld ? TUNING.drive.brakeDecel : TUNING.drive.accel) * dt);
    this.accel = (this.vx - prevVx) / Math.max(dt, 1e-4);

    // jump input
    if (input.jumpPressed) this.sincePress = 0;
    else this.sincePress += dt;
    const canJump = this.grounded || (!this.jumping && this.sinceGround <= coyote);
    if (this.sincePress <= buffer && canJump) {
      // jumping on a ramp is never weaker than letting the ramp launch you
      const ramp = this.grounded ? this.surface?.launch : undefined;
      this.vy = -Math.max(J.velocity[this.wheel], ramp ?? 0);
      if (ramp) this.airSpeed = Math.max(this.vx, TUNING.drive.speed);
      this.grounded = false;
      this.jumping = true;
      this.surface = null;
      this.holdLeft = J.holdMaxMs / 1000;
      this.sincePress = Infinity;
      ev.push({ type: 'jump' });
    }
    if (this.jumping && input.jumpHeld && this.holdLeft > 0 && this.vy < 0) {
      this.vy -= J.holdBoost * dt;
      this.holdLeft -= dt;
    } else if (!input.jumpHeld) this.holdLeft = 0;

    if (!this.grounded && this.airSpeed > 0 && !input.brakeHeld) this.vx = this.airSpeed;
    // horizontal movement, with logs blocking the nose
    const prevX = this.x;
    let nx = this.x + this.vx * dt;
    const wall = this.terrain.wallBetween(prevX + this.halfLength, nx + this.halfLength, this.y);
    if (wall) {
      nx = wall.x - this.halfLength - 0.5;
      if (this.vx > 0) ev.push({ type: 'blocked', wallId: wall.id });
      this.vx = 0;
    }
    const dx = nx - this.x;
    this.x = nx;
    this.rolled += dx;

    if (this.grounded) {
      const s = this.terrain.surfaceBelow(this.x, this.y, TUNING.drive.stepUp, this.lane);
      const top = this.terrain.wallTopAt(this.x, this.y);
      if (top !== null && (!s || top <= s.y)) {
        this.y = top;
        this.slope = 0;
      } else if (s && s.y - this.y <= TUNING.drive.stepDown) {
        this.y = s.y;
        this.slope = s.slope;
        this.surface = s.seg;
        if (s.seg.bounce) {
          // driving onto a bouncy pad springs the truck up and forward
          this.vy = -s.seg.bounce;
          this.grounded = false;
          this.jumping = true;
          this.surface = null;
          this.airSpeed = Math.max(this.vx, TUNING.drive.speed);
          ev.push({ type: 'bounce' });
        }
      } else {
        // rolled off an edge: a ramp's end launches, otherwise start falling (coyote time begins)
        const left = this.surface;
        this.grounded = false;
        this.surface = null;
        this.sinceGround = 0;
        if (left?.launch && prevX <= left.x1 + 1) {
          this.vy = -left.launch;
          this.jumping = true;
          this.airSpeed = Math.max(this.vx, TUNING.drive.speed);
          ev.push({ type: 'launch' });
        } else this.vy = Math.max(this.vy, 0);
      }
    } else {
      this.sinceGround += dt;
      const prevY = this.y;
      this.vy += J.gravity * dt;
      this.y += this.vy * dt;
      if (this.vy >= 0) {
        // land on the first surface between the old and new height
        const s = this.terrain.surfaceBelow(this.x, prevY - 2, 0, this.lane);
        const top = this.terrain.wallTopAt(this.x, prevY);
        const landY = top !== null && (!s || top < s.y) ? top : s?.y;
        if (landY !== undefined && this.y >= landY) {
          const impact = Math.min(1, this.vy / 1600);
          this.y = landY;
          if (s && landY === s.y && s.seg.bounce) {
            this.vy = -s.seg.bounce;
            this.jumping = true;
            this.airSpeed = Math.max(this.vx, TUNING.drive.speed);
            ev.push({ type: 'bounce' });
          } else {
            this.airSpeed = 0;
            this.vy = 0;
            this.grounded = true;
            this.jumping = false;
            this.surface = s && landY === s.y ? s.seg : null;
            this.slope = s && landY === s.y ? s.slope : 0;
            this.squash = Math.max(this.squash, impact * (TUNING.jump.landSquash[this.wheel] / 0.2));
            ev.push({ type: 'land', impact });
          }
        }
      }
      if (this.y > this.terrain.floorY + TUNING.world.fallDepth) ev.push({ type: 'fell', x: this.x });
    }
    this.squash = Math.max(0, this.squash - dt * 3.5);
    return ev;
  }
}

/** What an expert-but-assisted player would press: jump just before any gap or log. */
export function autoInput(t: TruckSim, terrain: Terrain): DriveInput {
  if (!t.grounded) return { jumpHeld: true, jumpPressed: false, brakeHeld: false };
  const gap = terrain.gapAhead(t.x, t.y, 70, t.lane);
  const log = terrain.wallBetween(t.x, t.x + t.halfLength + 60, t.y);
  const rampEnd = t.surface?.launch !== undefined;
  const press = (!!gap || !!log) && !rampEnd;
  return { jumpHeld: press, jumpPressed: press, brakeHeld: false };
}

/** Run a truck headlessly from x0 until it passes x1, falls, or time runs out. */
export function simulate(
  terrain: Terrain,
  x0: number,
  x1: number,
  opts: TruckOptions & { input?: 'none' | 'auto'; maxSec?: number },
): { reached: boolean; fellAt: number | null; blockedAt: string | null; x: number } {
  const t = new TruckSim(terrain, x0, opts);
  const dt = 1 / 60;
  let blockedFor = 0;
  let blockedAt: string | null = null;
  for (let i = 0; i < (opts.maxSec ?? 40) * 60; i++) {
    const input = opts.input === 'auto' ? autoInput(t, terrain) : { jumpHeld: false, jumpPressed: false, brakeHeld: false };
    for (const e of t.step(dt, input)) {
      if (e.type === 'fell') return { reached: false, fellAt: e.x, blockedAt: null, x: t.x };
      if (e.type === 'blocked') blockedAt = e.wallId;
    }
    blockedFor = t.vx === 0 && t.grounded ? blockedFor + dt : 0;
    if (blockedFor > 2) return { reached: false, fellAt: null, blockedAt, x: t.x };
    if (t.x >= x1) return { reached: true, fellAt: null, blockedAt: null, x: t.x };
  }
  return { reached: false, fellAt: null, blockedAt, x: t.x };
}
