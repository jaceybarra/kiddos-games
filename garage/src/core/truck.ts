import { TUNING, type WheelKind } from '../config/tuning';
import type { Crate, Lane, Patch, Segment, Terrain } from './terrain';

/**
 * Arcade truck physics. The gameplay body is one point where the wheels touch
 * the ground (x, y) plus a length and a body angle; lean, squash and wheel
 * spin are drawn by the view from the values here. Deterministic: the same
 * inputs always give the same run (tests and the track checker rely on that).
 *
 * Two ways to drive:
 * - 'pedals' (the default for the child): gas, a brake that becomes reverse
 *   at a standstill, momentum, hills that pull, faster ramps that throw
 *   higher, and spinning in the air with the pedals (flips; a roof landing is
 *   a soft bounce, never a miss). Only one finger is ever needed: let go of
 *   the gas and the truck rolls on while the jump is tapped.
 * - 'auto' (grown-up setting "drives itself"): the truck cruises on its own;
 *   only jump and brake. Every required jump is designed around this speed.
 */
export type DriveMode = 'pedals' | 'auto';

export interface DriveInput {
  /** the jump button is held right now */
  jumpHeld: boolean;
  /** true on the frame the jump button went down */
  jumpPressed: boolean;
  brakeHeld: boolean;
  /** the gas pedal is held (pedals only; "drives itself" ignores it) */
  gasHeld?: boolean;
}

export type TruckEvent =
  | { type: 'jump' }
  | { type: 'launch' }
  | { type: 'bounce' }
  /** air: seconds in the air; flips: full turns; perfect: a deliberate tilt landed flat */
  | { type: 'land'; impact: number; air: number; flips: number; perfect: boolean }
  /** landed on its roof or side: a soft bounce while it rolls upright */
  | { type: 'tumble' }
  | { type: 'blocked'; wallId: string }
  | { type: 'smash'; crate: Crate }
  /** drove onto a mud or boost strip */
  | { type: 'patch'; patch: Patch }
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
  /** default 'auto' (the build and track checkers drive like that) */
  mode?: DriveMode;
  /** the truck never reverses past this x */
  minX?: number;
}

const TAU = Math.PI * 2;

export class TruckSim {
  x: number;
  y: number;
  vx = 0;
  vy = 0;
  grounded = true;
  /** surface currently ridden (null in the air) */
  surface: Segment | null = null;
  slope = 0;
  /** body angle in radians (clockwise, nose down, is positive); keeps counting through flips */
  angle = 0;
  /** spin speed in the air (radians per second) */
  spin = 0;
  /** time since leaving the ground without jumping (coyote time) */
  private sinceGround = 0;
  /** time since the jump button was pressed (input buffer) */
  private sincePress = Infinity;
  private holdLeft = 0;
  private jumping = false;
  /** horizontal speed kept in the air (ramps and pads throw at full speed even with slower driving) */
  private airSpeed = 0;
  /** a pedal held since take-off doesn't spin the truck until it is pressed again in the air */
  private gasLock = false;
  private brakeLock = false;
  /** how much the player spun the truck during this jump (radians) */
  private spun = 0;
  /** holding the brake at a standstill (reverse starts after a moment) */
  private stillFor = 0;
  /** last acceleration, for the view's lean */
  accel = 0;
  /** how hard the last landing was (0..1), decays for the view's squash */
  squash = 0;
  /** distance rolled, for wheel spin */
  rolled = 0;
  /** held still by the game (story moments): brakes on, pedals ignored */
  stopped = false;
  /** seconds in the air so far */
  airTime = 0;
  /** rolling upright after a roof landing */
  tumbling = false;
  boostLeft = 0;
  /** the mud or boost strip under the wheels */
  patch: Patch | null = null;
  /** crates smashed so far (they stay smashed after a checkpoint restore) */
  readonly smashed = new Set<string>();
  wheel: WheelKind;
  speedFactor: number;
  assist: number;
  lane: Lane;
  mode: DriveMode;
  minX: number;
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
    this.mode = opts.mode ?? 'auto';
    this.minX = opts.minX ?? this.halfLength;
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
    this.slope = s?.slope ?? 0;
    this.vx = 0;
    this.vy = 0;
    this.grounded = true;
    this.jumping = false;
    this.airSpeed = 0;
    this.sinceGround = 0;
    this.sincePress = Infinity;
    this.squash = 0;
    this.angle = Math.atan(this.slope);
    this.spin = 0;
    this.tumbling = false;
    this.boostLeft = 0;
    this.patch = null;
    this.airTime = 0;
    this.stillFor = 0;
  }

  /** cruising speed: "drives itself" speed, and what every required jump is made for */
  get cruise(): number {
    return TUNING.drive.speed * this.speedFactor;
  }

  get targetSpeed(): number {
    return this.stopped ? 0 : this.cruise;
  }

  /** flat-out speed on the gas right now (mud and boost strips change it) */
  get topSpeed(): number {
    const S = TUNING.stuff;
    let top = (this.mode === 'auto' ? TUNING.drive.speed : TUNING.pedals.topSpeed) * this.speedFactor;
    if (this.boostLeft > 0) top = S.boostSpeed * this.speedFactor;
    if (this.patch?.kind === 'mud') top = Math.min(top, S.mudSpeed * this.speedFactor);
    return top;
  }

  /** hitting a ramp or pad faster than cruising throws higher (pedals) */
  private launchK(): number {
    if (this.mode === 'auto') return 1;
    const c = TUNING.drive.speed;
    const k = (Math.abs(this.vx) - c) / (TUNING.pedals.topSpeed - c);
    return 1 + (TUNING.pieces.fastLaunchMax - 1) * Math.max(0, Math.min(1, k));
  }

  step(dtSec: number, input: DriveInput): TruckEvent[] {
    const ev: TruckEvent[] = [];
    const dt = Math.min(dtSec, 0.05);
    const J = TUNING.jump;
    const coyote = (J.coyoteMs / 1000) * this.assist;
    const buffer = (J.bufferMs / 1000) * this.assist;
    const pedals = this.mode === 'pedals';
    const gas = pedals ? !!input.gasHeld && !this.stopped : !this.stopped;
    const brake = input.brakeHeld;

    // mud and boost strips under the wheels
    const patch = this.grounded ? this.terrain.patchAt(this.x, this.y) : null;
    if (patch && patch.id !== this.patch?.id) {
      ev.push({ type: 'patch', patch });
      if (patch.kind === 'boost') this.boostLeft = TUNING.stuff.boostMs / 1000;
    }
    if (this.grounded) this.patch = patch;
    if (this.boostLeft > 0) this.boostLeft = Math.max(0, this.boostLeft - dt);

    // speed
    const prevVx = this.vx;
    if (!pedals) this.driveItself(dt, brake);
    else if (this.grounded) this.pedal(dt, gas, brake);
    this.accel = (this.vx - prevVx) / Math.max(dt, 1e-4);

    // jump input
    if (input.jumpPressed) this.sincePress = 0;
    else this.sincePress += dt;
    const canJump = !this.tumbling && (this.grounded || (!this.jumping && this.sinceGround <= coyote));
    if (this.sincePress <= buffer && canJump) {
      // jumping on a ramp is never weaker than letting the ramp launch you
      const ramp = this.grounded ? this.surface?.launch : undefined;
      this.vy = -Math.max(J.velocity[this.wheel], ramp ? ramp * this.launchK() : 0);
      if (pedals) this.airSpeed = this.vx;
      if (ramp) this.airSpeed = Math.max(this.vx, TUNING.drive.speed);
      // waiting at a log: the jump carries the truck forward over it (not straight up and back down)
      // (with the pedals, a jump close in front of a log means "over it", gas or not)
      const reach = pedals ? 90 : 24;
      if (this.grounded && !brake && this.terrain.wallBetween(this.x, this.x + this.halfLength + reach, this.y)) {
        this.airSpeed = Math.max(this.airSpeed, this.cruise);
      }
      // a jump with the gas held always carries at least cruising speed: every gap is made for it
      if (pedals && gas && TUNING.pedals.jumpCarry) this.airSpeed = Math.max(this.airSpeed, this.cruise);
      if (pedals) this.vx = this.airSpeed;
      this.takeOff(input);
      this.holdLeft = J.holdMaxMs / 1000;
      this.sincePress = Infinity;
      ev.push({ type: 'jump' });
    }
    if (this.jumping && input.jumpHeld && this.holdLeft > 0 && this.vy < 0) {
      this.vy -= J.holdBoost * dt;
      this.holdLeft -= dt;
    } else if (!input.jumpHeld) this.holdLeft = 0;

    if (!this.grounded && this.airSpeed !== 0 && (pedals || !brake)) this.vx = this.airSpeed;

    // horizontal movement: logs block the nose (and the tail when reversing)
    const prevX = this.x;
    let nx = this.x + this.vx * dt;
    // (a one-unit skin: resting against a log it stays put at zero speed, instead of creeping the last half unit)
    if (nx > prevX) {
      const wall = this.terrain.wallBetween(prevX + this.halfLength - 1, nx + this.halfLength + 1, this.y);
      if (wall) {
        nx = wall.x - this.halfLength - 0.5;
        if (this.vx > 0) ev.push({ type: 'blocked', wallId: wall.id });
        this.vx = 0;
      }
    } else if (nx < prevX) {
      const wall = this.terrain.wallBehind(prevX - this.halfLength + 1, nx - this.halfLength - 1, this.y);
      if (wall) {
        nx = wall.x + wall.w + this.halfLength + 0.5;
        this.vx = 0;
        if (!this.grounded) this.airSpeed = 0;
      }
      if (nx < this.minX) {
        nx = this.minX;
        this.vx = 0;
        if (!this.grounded) this.airSpeed = 0;
      }
    }
    const dx = nx - this.x;
    this.x = nx;
    this.rolled += dx;

    if (this.grounded) this.followGround(dt, prevX, ev);
    else this.fly(dt, input, ev);

    // crates smash when the truck drives (or lands) into them
    for (const c of this.terrain.crates) {
      if (this.smashed.has(c.id)) continue;
      const half = c.size / 2;
      if (this.x + this.halfLength > c.x - half && this.x - this.halfLength * 0.9 < c.x + half && this.y > c.y - c.size - 8 && this.y - 120 < c.y) {
        this.smashed.add(c.id);
        if (this.grounded) this.vx *= TUNING.stuff.crateKeep;
        ev.push({ type: 'smash', crate: c });
      }
    }
    this.squash = Math.max(0, this.squash - dt * 3.5);
    return ev;
  }

  /** "Drives itself": cruise on, brake to stop. Strips still matter. */
  private driveItself(dt: number, brake: boolean): void {
    const S = TUNING.stuff;
    let want = brake ? 0 : this.targetSpeed;
    if (want > 0 && this.boostLeft > 0) want = S.boostSpeed * this.speedFactor;
    if (this.patch?.kind === 'mud') want = Math.min(want, S.mudSpeed * this.speedFactor);
    const up = this.boostLeft > 0 ? S.boostAccel : TUNING.drive.accel;
    const down = brake || this.stopped ? TUNING.drive.brakeDecel : this.patch?.kind === 'mud' ? S.mudDrag : TUNING.drive.accel;
    if (this.vx < want) this.vx = Math.min(want, this.vx + up * dt);
    else if (this.vx > want) this.vx = Math.max(want, this.vx - down * dt);
  }

  /** He drives: gas, brake then reverse, rolling on, hills that pull. */
  private pedal(dt: number, gas: boolean, brake: boolean): void {
    const P = TUNING.pedals;
    const S = TUNING.stuff;
    const top = this.topSpeed;
    const mud = this.patch?.kind === 'mud';
    const s = this.slope;
    const pull = P.hillGravity * (s / Math.sqrt(1 + s * s));
    if (this.stopped) {
      // a story moment holds the truck: brakes on, even on a hill
      this.vx = this.vx > 0 ? Math.max(0, this.vx - TUNING.drive.brakeDecel * dt) : Math.min(0, this.vx + TUNING.drive.brakeDecel * dt);
      this.stillFor = 0;
      return;
    }
    if (gas) {
      this.stillFor = 0;
      if (this.vx < -1) this.vx = Math.min(0, this.vx + TUNING.drive.brakeDecel * dt);
      else if (this.vx < top) {
        const v = this.vx + ((this.boostLeft > 0 ? S.boostAccel : P.gasAccel) + pull) * dt;
        // the gas alone stops at top speed (a downhill can carry it past)
        this.vx = pull > 0 ? v : Math.min(top, v);
      } else this.vx = Math.max(top, this.vx - (mud ? S.mudDrag : 2 * P.coastDecel) * dt) + Math.max(0, pull) * dt;
    } else if (brake) {
      if (this.vx > 0) {
        this.vx = Math.max(0, this.vx - (TUNING.drive.brakeDecel - Math.max(0, pull)) * dt);
        this.stillFor = 0;
      } else {
        // stopped with the brake held: a moment later it becomes reverse
        this.stillFor += dt;
        if (this.stillFor >= P.reverseDelayMs / 1000) {
          const back = Math.min(P.reverseSpeed * this.speedFactor, top);
          this.vx = Math.max(-back, this.vx - P.reverseAccel * dt) + (this.vx < 0 ? pull * dt : 0);
        }
      }
    } else {
      // rolling on: gentle rolling resistance, hills pull (a gentle slope holds a parked truck)
      this.stillFor = 0;
      const v = this.vx + pull * dt;
      const fr = (mud ? S.mudDrag * 0.5 : P.coastDecel) * dt;
      this.vx = Math.abs(v) <= fr ? 0 : v - Math.sign(v) * fr;
    }
    if (mud && Math.abs(this.vx) > top) this.vx = Math.sign(this.vx) * Math.max(top, Math.abs(this.vx) - S.mudDrag * dt);
  }

  private takeOff(input: DriveInput): void {
    this.grounded = false;
    this.jumping = true;
    this.surface = null;
    this.patch = null;
    this.angle = Math.atan(this.slope);
    this.spin = 0;
    this.spun = 0;
    this.airTime = 0;
    this.gasLock = !!input.gasHeld;
    this.brakeLock = input.brakeHeld;
  }

  private followGround(dt: number, prevX: number, ev: TruckEvent[]): void {
    const s = this.terrain.surfaceBelow(this.x, this.y, TUNING.drive.stepUp, this.lane);
    const top = this.terrain.wallTopAt(this.x, this.y);
    if (top !== null && (!s || top <= s.y)) {
      this.y = top;
      this.slope = 0;
      this.angle = 0;
      return;
    }
    if (s && s.y - this.y <= TUNING.drive.stepDown) {
      // over a crest at speed the ground drops away faster than the truck can follow: a little hop
      const climb = this.vx * this.slope;
      if (this.vx * (s.slope - this.slope) > TUNING.pedals.crestLift && !s.seg.bounce) {
        this.vy = climb;
        this.y += climb * dt;
        this.airSpeed = this.vx;
        this.sinceGround = 0;
        this.grounded = false;
        this.jumping = true;
        this.surface = null;
        this.patch = null;
        this.angle = Math.atan(this.slope);
        this.spin = 0;
        this.spun = 0;
        this.airTime = 0;
        this.gasLock = true;
        this.brakeLock = true;
        return;
      }
      this.y = s.y;
      this.slope = s.slope;
      this.surface = s.seg;
      this.angle = Math.atan(s.slope);
      if (s.seg.bounce) {
        // driving onto a bouncy pad springs the truck up and forward
        this.vy = -s.seg.bounce * this.launchK();
        this.airSpeed = Math.max(this.vx, TUNING.drive.speed);
        this.vx = this.mode === 'pedals' ? this.airSpeed : this.vx;
        this.grounded = false;
        this.jumping = true;
        this.surface = null;
        this.spin = 0;
        this.spun = 0;
        this.airTime = 0;
        this.gasLock = this.brakeLock = true;
        ev.push({ type: 'bounce' });
      }
      return;
    }
    // rolled off an edge: a ramp's end launches, otherwise start falling (coyote time begins)
    const left = this.surface;
    this.grounded = false;
    this.surface = null;
    this.patch = null;
    this.sinceGround = 0;
    this.spin = 0;
    this.spun = 0;
    this.airTime = 0;
    this.gasLock = this.brakeLock = true;
    if (this.mode === 'pedals') this.airSpeed = this.vx;
    if (left?.launch && prevX <= left.x1 + 1 && this.vx > 0) {
      this.vy = -left.launch * this.launchK();
      this.jumping = true;
      this.airSpeed = Math.max(this.vx, TUNING.drive.speed);
      if (this.mode === 'pedals') this.vx = this.airSpeed;
      ev.push({ type: 'launch' });
    } else this.vy = Math.max(this.vy, 0);
  }

  private fly(dt: number, input: DriveInput, ev: TruckEvent[]): void {
    const A = TUNING.air;
    this.sinceGround += dt;
    this.airTime += dt;

    // spinning: a pedal pressed in the air turns the truck; left alone it eases level
    if (!input.gasHeld) this.gasLock = false;
    if (!input.brakeHeld) this.brakeLock = false;
    const turn = this.mode === 'pedals' && !this.tumbling ? (input.gasHeld && !this.gasLock ? 1 : 0) - (input.brakeHeld && !this.brakeLock ? 1 : 0) : 0;
    if (turn !== 0) {
      this.spin = Math.max(-A.spinMax, Math.min(A.spinMax, this.spin + turn * A.spinAccel * dt));
    } else {
      this.spin *= Math.exp(-8 * dt);
      const k = Math.round(this.angle / TAU);
      const target = k * TAU + Math.max(-0.12, Math.min(0.12, this.vy * 0.00012));
      this.angle += (target - this.angle) * (1 - Math.exp(-(this.tumbling ? 10 : A.levelRate) * dt));
    }
    this.angle += this.spin * dt;
    if (turn !== 0) this.spun += Math.abs(this.spin * dt);

    const prevY = this.y;
    this.vy += TUNING.jump.gravity * dt;
    this.y += this.vy * dt;
    if (this.vy >= 0) {
      // land on the first surface between the old and new height
      const s = this.terrain.surfaceBelow(this.x, prevY - 2, 0, this.lane);
      const top = this.terrain.wallTopAt(this.x, prevY);
      const landY = top !== null && (!s || top < s.y) ? top : s?.y;
      if (landY !== undefined && this.y >= landY) {
        const onSeg = !!s && landY === s.y;
        const impact = Math.min(1, this.vy / 1600);
        this.y = landY;
        if (onSeg && s.seg.bounce) {
          this.vy = -s.seg.bounce * this.launchK();
          this.jumping = true;
          this.airSpeed = Math.max(this.vx, TUNING.drive.speed);
          if (this.mode === 'pedals') this.vx = this.airSpeed;
          ev.push({ type: 'bounce' });
          return;
        }
        const groundA = onSeg ? Math.atan(s.slope) : 0;
        const k = Math.round((this.angle - groundA) / TAU);
        const rel = this.angle - groundA - k * TAU;
        if (!this.tumbling && Math.abs(rel) > A.landTolerance) {
          // on its roof or side: a soft bounce while it rolls upright (no miss, just slower)
          this.vy = -A.tumbleBounce;
          this.airSpeed = this.vx * A.tumbleKeep;
          this.vx = this.airSpeed;
          this.tumbling = true;
          this.spin = 0;
          this.jumping = true;
          this.squash = Math.max(this.squash, impact);
          ev.push({ type: 'tumble' });
          return;
        }
        const perfect = !this.tumbling && this.spun > 0.6 && Math.abs(rel) < A.perfect;
        const flips = this.tumbling ? 0 : Math.abs(k);
        const air = this.airTime;
        this.airSpeed = 0;
        this.vy = 0;
        this.grounded = true;
        this.jumping = false;
        this.tumbling = false;
        this.spin = 0;
        this.angle = groundA;
        this.surface = onSeg ? s.seg : null;
        this.slope = onSeg ? s.slope : 0;
        this.squash = Math.max(this.squash, impact * (TUNING.jump.landSquash[this.wheel] / 0.2));
        if (perfect && this.mode === 'pedals' && this.vx >= 0) this.vx += A.perfectBoost;
        ev.push({ type: 'land', impact, air, flips, perfect });
      }
    }
    if (this.y > this.terrain.floorY + TUNING.world.fallDepth) ev.push({ type: 'fell', x: this.x });
  }
}

/** What an expert-but-assisted player would press: gas on, jump just before any gap or log. */
export function autoInput(t: TruckSim, terrain: Terrain): DriveInput {
  if (!t.grounded) return { jumpHeld: true, jumpPressed: false, brakeHeld: false, gasHeld: true };
  const gap = terrain.gapAhead(t.x, t.y, 70, t.lane);
  const log = terrain.wallBetween(t.x, t.x + t.halfLength + 60, t.y);
  const rampEnd = t.surface?.launch !== undefined;
  const press = (!!gap || !!log) && !rampEnd;
  return { jumpHeld: press, jumpPressed: press, brakeHeld: false, gasHeld: true };
}

/** Run a truck headlessly from x0 until it passes x1, falls, or time runs out. ('none' = gas on, no jumps.) */
export function simulate(
  terrain: Terrain,
  x0: number,
  x1: number,
  opts: TruckOptions & { input?: 'none' | 'auto'; maxSec?: number },
): { reached: boolean; fellAt: number | null; blockedAt: string | null; x: number; events: TruckEvent[] } {
  const t = new TruckSim(terrain, x0, opts);
  const dt = 1 / 60;
  let blockedFor = 0;
  let blockedAt: string | null = null;
  const events: TruckEvent[] = [];
  for (let i = 0; i < (opts.maxSec ?? 40) * 60; i++) {
    const input = opts.input === 'auto' ? autoInput(t, terrain) : { jumpHeld: false, jumpPressed: false, brakeHeld: false, gasHeld: true };
    for (const e of t.step(dt, input)) {
      events.push(e);
      if (e.type === 'fell') return { reached: false, fellAt: e.x, blockedAt: null, x: t.x, events };
      if (e.type === 'blocked') blockedAt = e.wallId;
    }
    blockedFor = t.vx === 0 && t.grounded ? blockedFor + dt : 0;
    if (blockedFor > 2) return { reached: false, fellAt: null, blockedAt, x: t.x, events };
    if (t.x >= x1) return { reached: true, fellAt: null, blockedAt: null, x: t.x, events };
  }
  return { reached: false, fellAt: null, blockedAt, x: t.x, events };
}
