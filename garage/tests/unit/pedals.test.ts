import { describe, expect, it } from 'vitest';
import { TUNING, type WheelKind } from '../../src/config/tuning';
import { Terrain, flat, slope, type Crate, type Patch } from '../../src/core/terrain';
import { TruckSim, simulate, type DriveInput, type TruckEvent } from '../../src/core/truck';
import { segmentsFor, type Placement } from '../../src/core/build';
import type { Lane } from '../../src/core/terrain';
import { MISSIONS, G } from '../../src/content/missions';
import { missionLevel, playgroundLevel } from '../../src/content/levels';

/**
 * "He drives": gas, brake that becomes reverse, momentum, hills, faster ramps,
 * spinning in the air, crates, mud and boost strips.
 */
const WHEELS: WheelKind[] = ['chunky', 'spring'];
const idle: DriveInput = { jumpHeld: false, jumpPressed: false, brakeHeld: false, gasHeld: false };
const gas: DriveInput = { ...idle, gasHeld: true };
const brake: DriveInput = { ...idle, brakeHeld: true };
const P = TUNING.pedals;

function truck(terrain: Terrain, x = 300, wheel: WheelKind = 'chunky'): TruckSim {
  return new TruckSim(terrain, x, { wheel, mode: 'pedals' });
}
function run(t: TruckSim, sec: number, input: DriveInput | ((i: number) => DriveInput)): TruckEvent[] {
  const out: TruckEvent[] = [];
  for (let i = 0; i < Math.round(sec * 120); i++) out.push(...t.step(1 / 120, typeof input === 'function' ? input(i) : input));
  return out;
}
const flatWorld = () => new Terrain([flat(0, 99999, G)]);

describe('pedals: gas, rolling on, brake, reverse', () => {
  it('stands still until the gas is pressed', () => {
    const t = truck(flatWorld());
    run(t, 1, idle);
    expect(t.vx).toBe(0);
    expect(t.x).toBe(300);
  });

  it('the gas speeds up to top speed, faster than "drives itself"', () => {
    const t = truck(flatWorld());
    run(t, 0.3, gas);
    const early = t.vx;
    run(t, 2, gas);
    expect(early).toBeGreaterThan(100);
    expect(early).toBeLessThan(t.vx);
    expect(t.vx).toBeCloseTo(P.topSpeed, 0);
    expect(t.vx).toBeGreaterThan(TUNING.drive.speed * 1.4);
  });

  it('letting go, the truck rolls on and slows gently (momentum)', () => {
    const t = truck(flatWorld());
    run(t, 2, gas);
    run(t, 1, idle);
    expect(t.vx).toBeGreaterThan(P.topSpeed - P.coastDecel - 5);
    expect(t.vx).toBeLessThan(P.topSpeed);
    run(t, 6, idle);
    expect(t.vx).toBe(0);
  });

  it('the brake stops quickly; holding it at a standstill becomes reverse; gas brakes a reversing truck first', () => {
    const t = truck(flatWorld(), 2000);
    run(t, 2, gas);
    const ev = run(t, 0.5, brake);
    expect(ev).toEqual([]);
    expect(t.vx).toBeLessThanOrEqual(0);
    run(t, 1.5, brake);
    expect(t.vx).toBeCloseTo(-P.reverseSpeed, 0);
    const x = t.x;
    run(t, 0.1, gas);
    expect(t.vx).toBeGreaterThan(-P.reverseSpeed);
    expect(t.x).toBeLessThan(x);
    run(t, 1, gas);
    expect(t.vx).toBeGreaterThan(0);
  });

  it('a quick brake tap never starts reversing', () => {
    const t = truck(flatWorld());
    run(t, 0.1, (i) => (i < 6 ? brake : idle));
    expect(t.vx).toBe(0);
  });

  it('reversing stops at the start of the world and at the back of a log', () => {
    const t = truck(new Terrain([flat(0, 4000, G)], [{ id: 'log', x: 600, w: 70, top: G - 72 }]), 900);
    run(t, 4, brake);
    expect(t.x).toBeCloseTo(600 + 70 + t.halfLength, 0);
    const u = truck(flatWorld(), 400);
    run(u, 4, brake);
    expect(u.x).toBe(u.minX);
  });

  it('slower driving lowers top speed too', () => {
    const t = new TruckSim(flatWorld(), 300, { wheel: 'chunky', mode: 'pedals', speedFactor: TUNING.drive.slowFactor });
    run(t, 3, gas);
    expect(t.vx).toBeCloseTo(P.topSpeed * TUNING.drive.slowFactor, 0);
  });
});

describe('pedals: hills and momentum', () => {
  const hill = () => new Terrain([flat(0, 1000, G), slope(1000, G, 1400, G - 200), flat(1400, 1800, G - 200), slope(1800, G - 200, 2200, G), flat(2200, 9000, G)]);

  it('rolling up a hill without gas slows the truck and it rolls back down', () => {
    const t = truck(hill(), 300);
    run(t, 1.6, gas);
    // let go at the foot of the hill
    while (t.x < 1000) run(t, 0.01, idle);
    let maxX = t.x;
    let back = false;
    for (let i = 0; i < 600; i++) {
      run(t, 0.01, idle);
      maxX = Math.max(maxX, t.x);
      if (t.vx < -5) back = true;
    }
    expect(back).toBe(true);
    expect(maxX).toBeLessThan(1400);
  });

  it('downhill picks up speed past top speed', () => {
    const t = truck(hill(), 1420);
    t.placeAt(1420, G - 200);
    let fastest = 0;
    for (let i = 0; i < 400 && t.x < 2200; i++) {
      run(t, 0.01, gas);
      fastest = Math.max(fastest, t.vx);
    }
    expect(fastest).toBeGreaterThan(P.topSpeed + 20);
  });

  it('the gas climbs every authored slope from a standstill, and a parked truck stays put on gentle ones', () => {
    for (const m of MISSIONS)
      for (const s of m.segments) {
        // uphill going forward (downhills only matter when reversing: they roll back down, which is fine)
        if (s.y1 >= s.y0 || s.kind === 'ramp') continue;
        const k = Math.abs((s.y1 - s.y0) / (s.x1 - s.x0));
        const pull = P.hillGravity * (k / Math.sqrt(1 + k * k));
        expect(pull, `${m.id} slope at ${s.x0}`).toBeLessThan(P.gasAccel * 0.95);
      }
    const gentle = new Terrain([slope(0, G, 3000, G - 300)]);
    const t = truck(gentle, 800);
    t.placeAt(800);
    run(t, 2, idle);
    expect(Math.abs(t.x - 800)).toBeLessThan(1);
  });

  it('a fast crest gives a little hop; a slow one does not', () => {
    const crest = () => new Terrain([flat(0, 800, G), slope(800, G, 1100, G - 150), flat(1100, 4000, G - 150)]);
    const fast = truck(crest(), 200);
    const evFast = run(fast, 3, gas);
    expect(evFast.some((e) => e.type === 'land')).toBe(true);
    const slow = new TruckSim(crest(), 200, { wheel: 'chunky', mode: 'pedals', speedFactor: 0.3 });
    const evSlow = run(slow, 8, gas);
    expect(evSlow.some((e) => e.type === 'land')).toBe(false);
  });
});

describe('pedals: jumps and ramps', () => {
  it('a jump with the gas held always carries cruising speed (so every gap made for "drives itself" is clearable)', () => {
    const t = truck(new Terrain([flat(0, 1000, G), flat(1200, 4000, G)]), 960);
    // from a near standstill right at the edge
    run(t, 0.05, gas);
    expect(t.vx).toBeLessThan(TUNING.drive.speed / 2);
    const ev = run(t, 2, (i) => ({ ...gas, jumpPressed: i === 0, jumpHeld: i < 10 }));
    expect(ev.map((e) => e.type)).not.toContain('fell');
    expect(t.x).toBeGreaterThan(1250);
  });

  it('without gas, a jump from a standstill goes straight up and down', () => {
    const t = truck(flatWorld(), 500);
    run(t, 2, (i) => ({ ...idle, jumpPressed: i === 0, jumpHeld: i < 10 }));
    expect(t.x).toBe(500);
  });

  it('hitting a ramp faster throws higher and farther', () => {
    const world = () => new Terrain([flat(0, 1300, G), slope(1300, G, 1500, G - 110, 'ramp', { launch: 1000 }), flat(1700, 9000, G)]);
    const apex = (speed: number) => {
      const t = truck(world(), 1300 - 400);
      t.vx = speed;
      let top = G;
      let landX = 0;
      for (let i = 0; i < 600; i++) {
        for (const e of t.step(1 / 120, speed > TUNING.drive.speed ? gas : idle)) if (e.type === 'land' && !landX) landX = t.x;
        if (t.vx < speed - 1 && t.grounded) t.vx = speed; // hold the speed for the comparison
        top = Math.min(top, t.y);
      }
      return { height: G - top, landX };
    };
    const slow = apex(TUNING.drive.speed);
    const fast = apex(P.topSpeed);
    expect(fast.height).toBeGreaterThan(slow.height * 1.15);
    expect(fast.landX).toBeGreaterThan(slow.landX + 150);
  });
});

describe('pedals: in the air', () => {
  const jumpThen = (t: TruckSim, air: (i: number) => DriveInput) => run(t, 3, (i) => (i === 0 ? { ...idle, jumpPressed: true, jumpHeld: true } : air(i)));

  it('holding the gas from the ground does not spin the truck; left alone it lands level', () => {
    const t = truck(flatWorld());
    run(t, 1.5, gas);
    const ev = run(t, 2, (i) => ({ ...gas, jumpPressed: i === 0, jumpHeld: i < 20 }));
    const land = ev.find((e) => e.type === 'land');
    expect(land).toMatchObject({ type: 'land', flips: 0, perfect: false });
    expect(ev.map((e) => e.type)).not.toContain('tumble');
  });

  it('the gas pressed in the air spins forward (nose down), the brake spins back', () => {
    for (const [input, sign] of [[gas, 1], [brake, -1]] as const) {
      const t = new TruckSim(flatWorld(), 300, { wheel: 'spring', mode: 'pedals' });
      t.step(1 / 120, { ...idle, jumpPressed: true, jumpHeld: true });
      run(t, 0.25, input);
      expect(Math.sign(t.angle)).toBe(sign);
      expect(Math.abs(t.angle)).toBeGreaterThan(0.4);
    }
  });

  it('spinning too far lands on the roof: a soft tumble, then it lands on its wheels (never a miss)', () => {
    let tumbled = 0;
    for (let hold = 20; hold <= 110; hold += 6) {
      const t = truck(flatWorld());
      run(t, 1, gas);
      const ev = jumpThen(t, (i) => (i < hold ? gas : idle));
      const types = ev.map((e) => e.type);
      expect(types).not.toContain('fell');
      expect(t.grounded).toBe(true);
      if (types.includes('tumble')) {
        tumbled++;
        // after the tumble it comes down on its wheels
        expect(types.lastIndexOf('land')).toBeGreaterThan(types.indexOf('tumble'));
        expect(ev.find((e) => e.type === 'land')).toMatchObject({ flips: 0 });
      }
    }
    expect(tumbled).toBeGreaterThan(0);
  });

  it('a full spin landed on the wheels counts as a flip', () => {
    // a big pad throw gives the air time for a flip
    const world = new Terrain([flat(0, 1000, G), flat(1000, 1060, G - 2, 'pad', { bounce: 1600 }), flat(1060, 9000, G)]);
    let best: TruckEvent | undefined;
    for (const hold of [40, 50, 60, 70, 80, 90]) {
      const t = truck(world, 500, 'spring');
      run(t, 1.2, gas);
      let bounced = -1;
      const ev = run(t, 3, (i) => {
        if (bounced < 0 && !t.grounded) bounced = i;
        // release the gas at take-off, then press it in the air for `hold` steps
        return bounced >= 0 && i > bounced + 2 && i < bounced + 2 + hold ? gas : idle;
      });
      const land = ev.find((e) => e.type === 'land');
      if (land && land.type === 'land' && land.flips >= 1) best = land;
    }
    expect(best).toMatchObject({ type: 'land', flips: 1 });
  });

  it('a deliberate tilt that lands flat is a perfect landing with a little push', () => {
    const t = truck(flatWorld(), 300, 'spring');
    run(t, 1.5, gas);
    // jump, tilt back a little, then let it settle level
    t.step(1 / 120, { ...idle, jumpPressed: true, jumpHeld: true });
    let land: TruckEvent | undefined;
    let before = 0;
    for (let i = 0; i < 400 && !land; i++) {
      before = t.vx;
      land = t.step(1 / 120, i < 30 ? brake : idle).find((e) => e.type === 'land');
    }
    expect(land).toMatchObject({ perfect: true, flips: 0 });
    expect(t.vx).toBeCloseTo(before + TUNING.air.perfectBoost, 0);
  });
});

describe('crates, mud and boost strips', () => {
  const crate: Crate = { id: 'c1', x: 1000, y: G, size: 90 };
  const mud: Patch = { id: 'mud', kind: 'mud', x0: 1000, x1: 1600, y: G };
  const boost: Patch = { id: 'zoom', kind: 'boost', x0: 1000, x1: 1100, y: G };

  it('crates smash (no block), once, and take a little speed', () => {
    const t = truck(new Terrain([flat(0, 9999, G)], [], { crates: [crate] }));
    run(t, 1.1, gas);
    const ev = run(t, 1, gas);
    expect(ev.filter((e) => e.type === 'smash')).toHaveLength(1);
    expect(t.x).toBeGreaterThan(1200);
    // "drives itself" smashes them too
    const auto = simulate(new Terrain([flat(0, 9999, G)], [], { crates: [crate] }), 300, 1500, { wheel: 'chunky' });
    expect(auto.events.filter((e) => e.type === 'smash')).toHaveLength(1);
  });

  it('mud slows the truck right down; out of the mud it speeds up again', () => {
    const t = truck(new Terrain([flat(0, 9999, G)], [], { patches: [mud] }));
    const ev = run(t, 1.4, gas);
    expect(ev.filter((e) => e.type === 'patch')).toHaveLength(0);
    run(t, 1.5, gas);
    expect(t.x).toBeGreaterThan(1000);
    expect(t.x).toBeLessThan(1600);
    expect(t.vx).toBeLessThanOrEqual(TUNING.stuff.mudSpeed + 1);
    run(t, 6, gas);
    expect(t.x).toBeGreaterThan(1700);
    expect(t.vx).toBeCloseTo(P.topSpeed, 0);
  });

  it('a boost strip zooms past top speed for a moment, then eases back', () => {
    const t = truck(new Terrain([flat(0, 9999, G)], [], { patches: [boost] }));
    let fastest = 0;
    const ev = run(t, 2.4, (i) => {
      fastest = Math.max(fastest, t.vx);
      return i >= 0 ? gas : idle;
    });
    expect(ev.filter((e) => e.type === 'patch')).toHaveLength(1);
    expect(fastest).toBeGreaterThan(P.topSpeed + 150);
    run(t, 4, gas);
    expect(t.vx).toBeCloseTo(P.topSpeed, 0);
  });
});

describe('every mission and the test track can be driven flat out with the pedals (both wheels)', () => {
  // the drive goes in legs, as in the game: story moments and builds stop the truck, then it drives on from there
  const leg = (id: (typeof MISSIONS)[number]['id'], placed: Placement[], lane: Lane, wheel: WheelKind, from: number, to: number) => {
    const m = MISSIONS.find((mm) => mm.id === id)!;
    const L = missionLevel(id);
    const extra = m.zones.flatMap((z) => segmentsFor(z, placed.filter((p) => z.sockets.some((s) => s.id === p.socket))));
    const terrain = new Terrain(L.segments, L.walls, { crates: L.crates, patches: L.patches }).with(extra);
    return simulate(terrain, from, to, { wheel, input: 'auto', lane, maxSec: 60, mode: 'pedals' });
  };
  const finish = (id: string) => missionLevel(id as never).finishX + 5;
  for (const wheel of WHEELS) {
    it(`mission 1: to Milo, then over the stream with a bridge, a ramp or a pad (${wheel})`, () => {
      expect(leg('wobbly-bridge', [], 'back', wheel, 260, 2250)).toMatchObject({ reached: true });
      for (const p of [{ socket: 'span', piece: 'bridge' }, { socket: 'launch', piece: 'ramp' }, { socket: 'launch', piece: 'pad' }] as Placement[])
        expect(leg('wobbly-bridge', [p], 'back', wheel, 2300, finish('wobbly-bridge')), p.piece).toMatchObject({ reached: true });
    });
    it(`mission 2, both ways (${wheel})`, () => {
      expect(leg('ramp-we-share', [], 'back', wheel, 260, 760)).toMatchObject({ reached: true });
      expect(leg('ramp-we-share', [], 'back', wheel, 800, finish('ramp-we-share'))).toMatchObject({ reached: true });
      expect(leg('ramp-we-share', [{ socket: 'front-span', piece: 'bridge' }], 'front', wheel, 880, finish('ramp-we-share'))).toMatchObject({ reached: true });
      expect(leg('ramp-we-share', [{ socket: 'front-launch', piece: 'ramp' }], 'front', wheel, 880, finish('ramp-we-share'))).toMatchObject({ reached: true });
    });
    it(`mission 3, both routes (${wheel})`, () => {
      expect(leg('everyone-rally', [], 'back', wheel, 260, 760)).toMatchObject({ reached: true });
      for (const lane of ['front', 'back'] as const) {
        expect(leg('everyone-rally', [], lane, wheel, 1300, 3250), lane).toMatchObject({ reached: true });
        for (const climb of ['ramp', 'pad'] as const)
          expect(leg('everyone-rally', [{ socket: 'span', piece: 'bridge' }, { socket: 'climb', piece: climb }], 'back', wheel, 3050, finish('everyone-rally')), `${climb} ${lane}`).toMatchObject({ reached: true });
      }
    });
    it(`the test track, start to finish (${wheel})`, () => {
      const L = playgroundLevel();
      const terrain = new Terrain(L.segments, L.walls, { crates: L.crates, patches: L.patches });
      for (const mode of ['pedals', 'auto'] as const) {
        const r = simulate(terrain, L.startX, L.finishX + 5, { wheel, input: 'auto', maxSec: 90, mode });
        expect(r, `${mode}`).toMatchObject({ reached: true });
        expect(r.events.filter((e) => e.type === 'smash').length, mode).toBeGreaterThan(3);
      }
    });
  }
});
