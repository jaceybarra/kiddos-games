/**
 * Tinker Grove toy physics — a small, deterministic, bounded model.
 *
 * This is a TOY model chosen to be consistent and readable, not a scientific
 * simulator: round things fall, roll along planks, bounce, get pushed by fans,
 * and lose speed on moss. Fixed 120 Hz steps, no randomness, at most 8 moving
 * bodies and 40 parts, so results are identical on every device and in tests.
 */

export type PartKind =
  | 'ramp'
  | 'plank'
  | 'curve'
  | 'bumper'
  | 'spring'
  | 'fan'
  | 'block'
  | 'basket'
  | 'moss'
  | 'chime'
  | 'wheel'
  | 'flag'
  | 'flower'
  | 'bell'
  | 'ribbon';

export const DECOR: PartKind[] = ['flag', 'flower', 'bell', 'ribbon'];

export interface Part {
  id: string;
  kind: PartKind;
  x: number;
  y: number;
  /** degrees, clockwise */
  rot: number;
  /** chime note 0..4 (pentatonic) */
  note?: number;
  /** wheel spin direction */
  spin?: 1 | -1;
  /** fixed scenery parts can't be moved by the child */
  fixed?: boolean;
}

export type BodyKind = 'acorn' | 'parcel' | 'snail' | 'berry';

export interface BodySpec {
  kind: BodyKind;
  x: number;
  y: number;
  vx?: number;
  vy?: number;
}

export interface Zone {
  id: string;
  kind: 'goal' | 'water' | 'pad';
  x: number;
  y: number;
  w: number;
  h: number;
  /** for pads: which friend's mailbox */
  label?: string;
}

export interface Layout {
  parts: Part[];
  bodies: BodySpec[];
  zones: Zone[];
  bounds: { w: number; h: number };
}

export interface Body {
  kind: BodyKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  restitution: number;
  friction: number;
  drag: number;
  angle: number;
  alive: boolean;
  maxSpeed: number;
  /** time spent slow inside a goal/pad */
  restTime: number;
  touching: boolean;
}

export type SimEvent =
  | { t: number; type: 'chime'; note: number; partId: string }
  | { t: number; type: 'bounce'; partId: string; speed: number }
  | { t: number; type: 'spring'; partId: string }
  | { t: number; type: 'splash'; body: number }
  | { t: number; type: 'goal'; body: number; zone: string; speed: number; maxSpeed: number }
  | { t: number; type: 'lost'; body: number }
  | { t: number; type: 'land'; body: number; partId: string; speed: number };

export const SIM = {
  dt: 1 / 120,
  gravity: 1100,
  maxBodies: 8,
  maxParts: 40,
  maxTime: 14,
  maxSpeed: 2400,
};

/** friction = rolling slow-down per second on wood (toy value) */
const BODY_PROPS: Record<BodyKind, { r: number; restitution: number; friction: number; drag: number }> = {
  acorn: { r: 26, restitution: 0.32, friction: 0.12, drag: 0.02 },
  parcel: { r: 34, restitution: 0.12, friction: 1.6, drag: 0.9 },
  snail: { r: 34, restitution: 0.08, friction: 0.16, drag: 0.05 },
  berry: { r: 20, restitution: 0.5, friction: 0.1, drag: 0.02 },
};

/** Moss is a simple, readable rule: things on moss slow to a gentle crawl. */
export const MOSS_CRAWL = 150;

// ---------------------------------------------------------------- part geometry

export interface Segment {
  ax: number;
  ay: number;
  bx: number;
  by: number;
  /** half thickness */
  t: number;
  partId: string;
  surface: 'wood' | 'moss' | 'spring' | 'chime' | 'basket';
}

export interface CircleCollider {
  x: number;
  y: number;
  r: number;
  partId: string;
  kind: 'bumper' | 'wheel';
  spin?: number;
}

export interface FanZone {
  cx: number;
  cy: number;
  /** unit direction */
  dx: number;
  dy: number;
  len: number;
  width: number;
  partId: string;
}

export const PART_SIZE: Record<PartKind, { w: number; h: number }> = {
  ramp: { w: 240, h: 24 },
  plank: { w: 360, h: 24 },
  curve: { w: 160, h: 160 },
  bumper: { w: 100, h: 100 },
  spring: { w: 120, h: 50 },
  fan: { w: 90, h: 90 },
  block: { w: 80, h: 80 },
  basket: { w: 150, h: 100 },
  moss: { w: 240, h: 30 },
  chime: { w: 140, h: 24 },
  wheel: { w: 130, h: 130 },
  flag: { w: 60, h: 100 },
  flower: { w: 60, h: 70 },
  bell: { w: 60, h: 70 },
  ribbon: { w: 120, h: 40 },
};

const rad = (deg: number) => (deg * Math.PI) / 180;

function rotPt(px: number, py: number, deg: number): [number, number] {
  const c = Math.cos(rad(deg));
  const s = Math.sin(rad(deg));
  return [px * c - py * s, px * s + py * c];
}

function seg(p: Part, x1: number, y1: number, x2: number, y2: number, t: number, surface: Segment['surface']): Segment {
  const [ax, ay] = rotPt(x1, y1, p.rot);
  const [bx, by] = rotPt(x2, y2, p.rot);
  return { ax: p.x + ax, ay: p.y + ay, bx: p.x + bx, by: p.y + by, t, partId: p.id, surface };
}

export interface Colliders {
  segments: Segment[];
  circles: CircleCollider[];
  fans: FanZone[];
}

/** Turn parts into colliders. Shapes are deliberately simple and readable. */
export function buildColliders(parts: Part[]): Colliders {
  const segments: Segment[] = [];
  const circles: CircleCollider[] = [];
  const fans: FanZone[] = [];
  for (const p of parts) {
    switch (p.kind) {
      case 'ramp':
        segments.push(seg(p, -120, 0, 120, 0, 12, 'wood'));
        break;
      case 'plank':
        segments.push(seg(p, -180, 0, 180, 0, 12, 'wood'));
        break;
      case 'moss':
        segments.push(seg(p, -120, 0, 120, 0, 15, 'moss'));
        break;
      case 'chime':
        segments.push(seg(p, -70, 0, 70, 0, 12, 'chime'));
        break;
      case 'spring':
        segments.push(seg(p, -55, 0, 55, 0, 14, 'spring'));
        break;
      case 'block': {
        const h = 40;
        segments.push(seg(p, -h, -h, h, -h, 4, 'wood'), seg(p, h, -h, h, h, 4, 'wood'), seg(p, h, h, -h, h, 4, 'wood'), seg(p, -h, h, -h, -h, 4, 'wood'));
        break;
      }
      case 'basket':
        segments.push(seg(p, -75, -45, -60, 45, 8, 'basket'), seg(p, -60, 45, 60, 45, 8, 'basket'), seg(p, 60, 45, 75, -45, 8, 'basket'));
        break;
      case 'curve': {
        // quarter pipe (concave, opening up-right): from the top-left wall down to the bottom-right floor
        const r = 140;
        const n = 7;
        let prev: [number, number] | null = null;
        for (let i = 0; i <= n; i++) {
          const a = Math.PI - (i / n) * (Math.PI / 2);
          const q: [number, number] = [70 + Math.cos(a) * r, -70 + Math.sin(a) * r];
          if (prev) segments.push(seg(p, prev[0], prev[1], q[0], q[1], 10, 'wood'));
          prev = q;
        }
        break;
      }
      case 'bumper':
        circles.push({ x: p.x, y: p.y, r: 46, partId: p.id, kind: 'bumper' });
        break;
      case 'wheel':
        circles.push({ x: p.x, y: p.y, r: 60, partId: p.id, kind: 'wheel', spin: p.spin ?? 1 });
        break;
      case 'fan': {
        const [dx, dy] = rotPt(1, 0, p.rot);
        fans.push({ cx: p.x + dx * 200, cy: p.y + dy * 200, dx, dy, len: 340, width: 170, partId: p.id });
        break;
      }
      default:
        break; // decorations have no physics
    }
  }
  return { segments, circles, fans };
}

// ---------------------------------------------------------------- simulation

export class Sim {
  readonly bodies: Body[] = [];
  readonly events: SimEvent[] = [];
  readonly col: Colliders;
  t = 0;
  done = false;
  private chimeCooldown = new Map<string, number>();
  private landed = new Set<string>();

  constructor(readonly layout: Layout) {
    const parts = layout.parts.slice(0, SIM.maxParts);
    this.col = buildColliders(parts);
    // the board has side walls so nothing flies away; the bottom stays open
    const { w, h } = layout.bounds;
    this.col.segments.push(
      { ax: -10, ay: -400, bx: -10, by: h + 100, t: 10, partId: 'wall-left', surface: 'wood' },
      { ax: w + 10, ay: -400, bx: w + 10, by: h + 100, t: 10, partId: 'wall-right', surface: 'wood' },
    );
    for (const b of layout.bodies.slice(0, SIM.maxBodies)) {
      const props = BODY_PROPS[b.kind];
      this.bodies.push({ kind: b.kind, x: b.x, y: b.y, vx: b.vx ?? 0, vy: b.vy ?? 0, ...props, angle: 0, alive: true, maxSpeed: 0, restTime: 0, touching: false });
    }
  }

  /** Advance by real seconds (internally fixed steps). */
  advance(seconds: number): void {
    const steps = Math.min(240, Math.round(seconds / SIM.dt));
    for (let i = 0; i < steps && !this.done; i++) this.step();
  }

  runToEnd(): this {
    while (!this.done) this.step();
    return this;
  }

  step(): void {
    const dt = SIM.dt;
    this.t += dt;
    let moving = false;
    this.bodies.forEach((b, bi) => {
      if (!b.alive) return;
      b.vy += SIM.gravity * dt;
      // fans push
      for (const f of this.col.fans) {
        const rx = b.x - f.cx;
        const ry = b.y - f.cy;
        const along = rx * f.dx + ry * f.dy;
        const across = -rx * f.dy + ry * f.dx;
        if (Math.abs(along) < f.len / 2 && Math.abs(across) < f.width / 2) {
          const k = 1500 * (b.kind === 'parcel' ? 1.15 : 1);
          b.vx += f.dx * k * dt;
          b.vy += f.dy * k * dt;
        }
      }
      // air drag (parcels float down gently)
      const drag = 1 - b.drag * dt;
      b.vx *= drag;
      // the parcel has a little parachute: it floats down gently (only while in the air)
      b.vy *= b.kind === 'parcel' && !b.touching ? 1 - 3 * dt : drag;
      // speed cap keeps everything stable
      const sp = Math.hypot(b.vx, b.vy);
      if (sp > SIM.maxSpeed) {
        b.vx *= SIM.maxSpeed / sp;
        b.vy *= SIM.maxSpeed / sp;
      }
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.touching = false;
      for (let it = 0; it < 2; it++) {
        for (const s of this.col.segments) this.collideSegment(b, s);
        for (const c of this.col.circles) this.collideCircle(b, c);
      }
      b.angle += (b.vx * dt) / b.r;
      const speed = Math.hypot(b.vx, b.vy);
      if (b.touching || this.t > 0.5) b.maxSpeed = Math.max(b.maxSpeed, b.touching ? speed : b.maxSpeed);
      // zones
      for (const z of this.layout.zones) {
        const inside = b.x > z.x && b.x < z.x + z.w && b.y > z.y && b.y < z.y + z.h;
        if (!inside) continue;
        if (z.kind === 'water') {
          b.alive = false;
          this.events.push({ t: this.t, type: 'splash', body: bi });
        } else {
          b.restTime += speed < 140 ? dt : 0;
          if (b.restTime > 0.25 || (z.kind === 'pad' && b.touching)) {
            b.alive = false;
            this.events.push({ t: this.t, type: 'goal', body: bi, zone: z.id, speed, maxSpeed: b.maxSpeed });
          }
        }
      }
      if (b.alive && (b.y > this.layout.bounds.h + 200 || b.x < -300 || b.x > this.layout.bounds.w + 300)) {
        b.alive = false;
        this.events.push({ t: this.t, type: 'lost', body: bi });
      }
      if (b.alive && speed > 6) moving = true;
    });
    if (!this.bodies.some((b) => b.alive) || this.t >= SIM.maxTime) this.done = true;
    // everything settled for a while → done
    if (!moving && this.t > 1.5) this.settle += SIM.dt;
    else this.settle = 0;
    if (this.settle > 1.0) this.done = true;
  }

  private settle = 0;

  private collideSegment(b: Body, s: Segment): void {
    const ex = s.bx - s.ax;
    const ey = s.by - s.ay;
    const len2 = ex * ex + ey * ey || 1;
    let u = ((b.x - s.ax) * ex + (b.y - s.ay) * ey) / len2;
    u = Math.max(0, Math.min(1, u));
    const px = s.ax + ex * u;
    const py = s.ay + ey * u;
    let nx = b.x - px;
    let ny = b.y - py;
    const d = Math.hypot(nx, ny);
    const minD = b.r + s.t;
    if (d >= minD || d === 0) return;
    nx /= d;
    ny /= d;
    // push out
    b.x += nx * (minD - d);
    b.y += ny * (minD - d);
    const vn = b.vx * nx + b.vy * ny;
    if (vn >= 0) return;
    b.touching = true;
    const tx = -ny;
    const ty = nx;
    let vt = b.vx * tx + b.vy * ty;
    let e = b.restitution;
    const fr = b.friction;
    if (s.surface === 'moss') e = 0.02;
    if (s.surface === 'basket') e = 0.05;
    let newVn = -vn * e;
    if (Math.abs(vn) < 60) newVn = 0; // resting contact: no jitter
    if (s.surface === 'spring' && ny < -0.6) {
      newVn = Math.max(1050, -vn * 0.9);
      this.events.push({ t: this.t, type: 'spring', partId: s.partId });
    }
    if (s.surface === 'chime' && -vn > 90) {
      const last = this.chimeCooldown.get(s.partId) ?? -1;
      if (this.t - last > 0.25) {
        this.chimeCooldown.set(s.partId, this.t);
        const part = this.layout.parts.find((p) => p.id === s.partId);
        this.events.push({ t: this.t, type: 'chime', note: part?.note ?? 0, partId: s.partId });
      }
    }
    if (-vn > 140 && !this.landed.has(`${s.partId}`)) {
      this.landed.add(s.partId);
      this.events.push({ t: this.t, type: 'land', body: this.bodies.indexOf(b), partId: s.partId, speed: -vn });
    }
    // rolling slow-down on wood; moss eases things down to a crawl
    vt *= Math.exp(-fr * SIM.dt);
    if (s.surface === 'moss' && Math.abs(vt) > MOSS_CRAWL) vt = Math.sign(vt) * Math.max(MOSS_CRAWL, Math.abs(vt) * 0.93);
    b.vx = vt * tx + newVn * nx;
    b.vy = vt * ty + newVn * ny;
  }

  private collideCircle(b: Body, c: CircleCollider): void {
    let nx = b.x - c.x;
    let ny = b.y - c.y;
    const d = Math.hypot(nx, ny);
    const minD = b.r + c.r;
    if (d >= minD || d === 0) return;
    nx /= d;
    ny /= d;
    b.x += nx * (minD - d);
    b.y += ny * (minD - d);
    const vn = b.vx * nx + b.vy * ny;
    if (vn >= 0) return;
    b.touching = true;
    const tx = -ny;
    const ty = nx;
    let vt = b.vx * tx + b.vy * ty;
    let newVn: number;
    if (c.kind === 'bumper') {
      newVn = Math.min(1100, -vn * 1.12 + 120);
      this.events.push({ t: this.t, type: 'bounce', partId: c.partId, speed: -vn });
    } else {
      newVn = -vn * 0.2;
      // the spinning log carries things along its surface
      vt = vt * 0.6 + (c.spin ?? 1) * 380 * 0.4;
    }
    b.vx = vt * tx + newVn * nx;
    b.vy = vt * ty + newVn * ny;
  }
}

/** Run a layout to completion (used by tests, previews and the clubhouse). */
export function simulate(layout: Layout): { events: SimEvent[]; bodies: Body[]; time: number } {
  const s = new Sim(layout).runToEnd();
  return { events: s.events, bodies: s.bodies, time: s.t };
}
