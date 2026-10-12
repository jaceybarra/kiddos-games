import { describe, expect, it } from 'vitest';
import { TUNING, type WheelKind } from '../../src/config/tuning';
import { Terrain, flat } from '../../src/core/terrain';
import { TruckSim, simulate, type DriveInput } from '../../src/core/truck';
import { testLayout, canPlace, segmentsFor, type Placement } from '../../src/core/build';
import type { Lane } from '../../src/core/terrain';
import { MISSIONS, G } from '../../src/content/missions';

const none: DriveInput = { jumpHeld: false, jumpPressed: false, brakeHeld: false };
const WHEELS: WheelKind[] = ['chunky', 'spring'];

function run(t: TruckSim, sec: number, input: (i: number) => DriveInput = () => none) {
  const events: string[] = [];
  for (let i = 0; i < sec * 60; i++) for (const e of t.step(1 / 60, input(i))) events.push(e.type);
  return events;
}

/** highest point reached after a jump, measured from the ground */
function apex(wheel: WheelKind, holdFrames: number): number {
  const t = new TruckSim(new Terrain([flat(0, 99999, G)]), 100, { wheel });
  run(t, 0.5);
  let top = t.y;
  for (let i = 0; i < 120; i++) {
    t.step(1 / 60, { jumpPressed: i === 0, jumpHeld: i < holdFrames, brakeHeld: false });
    top = Math.min(top, t.y);
  }
  return G - top;
}

describe('driving and jumping', () => {
  it('drives forward on its own at a gentle speed, and the brake stops it', () => {
    const t = new TruckSim(new Terrain([flat(0, 9999, G)]), 100, { wheel: 'chunky' });
    run(t, 2);
    expect(t.vx).toBeCloseTo(TUNING.drive.speed, 0);
    run(t, 1, () => ({ ...none, brakeHeld: true }));
    expect(t.vx).toBe(0);
  });

  it('a log makes the truck wait (no miss); a tap hops over it', () => {
    const terrain = new Terrain([flat(0, 4000, G)], [{ id: 'log', x: 800, w: 70, top: G - 72 }]);
    const t = new TruckSim(terrain, 200, { wheel: 'chunky' });
    const ev = run(t, 4);
    expect(ev).toContain('blocked');
    expect(ev).not.toContain('fell');
    expect(t.x).toBeLessThan(800);
    run(t, 2, (i) => ({ ...none, jumpPressed: i === 0, jumpHeld: i < 3 }));
    expect(t.x).toBeGreaterThan(900);
  });

  it('spring wheels jump clearly higher than chunky wheels, and holding adds a little', () => {
    const chunkyTap = apex('chunky', 1);
    const chunkyHold = apex('chunky', 30);
    const springTap = apex('spring', 1);
    expect(springTap).toBeGreaterThan(chunkyTap * 1.3);
    expect(chunkyHold).toBeGreaterThan(chunkyTap * 1.1);
    expect(chunkyHold).toBeLessThan(chunkyTap * 1.4);
  });

  it('coyote time: a jump just after rolling off an edge still works (120 ms), later does not', () => {
    for (const [ms, works] of [[90, true], [220, false]] as const) {
      const terrain = new Terrain([flat(0, 1000, G), flat(1400, 3000, G)]);
      const t = new TruckSim(terrain, 900, { wheel: 'chunky' });
      t.vx = TUNING.drive.speed;
      let left = -1;
      let jumped = false;
      for (let i = 0; i < 240; i++) {
        if (left < 0 && !t.grounded) left = i;
        const press = left >= 0 && i === left + Math.round((ms / 1000) * 60);
        for (const e of t.step(1 / 60, { jumpPressed: press, jumpHeld: press, brakeHeld: false })) if (e.type === 'jump') jumped = true;
      }
      expect(jumped, `${ms} ms`).toBe(works);
    }
  });

  it('input buffer: a tap just before landing jumps on landing (150 ms), earlier does not', () => {
    for (const [ms, works] of [[100, true], [300, false]] as const) {
      const t = new TruckSim(new Terrain([flat(0, 99999, G)]), 100, { wheel: 'chunky' });
      run(t, 0.3);
      // first jump, then find the landing frame
      const frames: number[] = [];
      const probe = new TruckSim(new Terrain([flat(0, 99999, G)]), 100, { wheel: 'chunky' });
      run(probe, 0.3);
      for (let i = 0; i < 120; i++) for (const e of probe.step(1 / 60, { jumpPressed: i === 0, jumpHeld: false, brakeHeld: false })) if (e.type === 'land') frames.push(i);
      const landAt = frames[0];
      const pressAt = landAt - Math.round((ms / 1000) * 60);
      let jumps = 0;
      for (let i = 0; i < landAt + 10; i++) for (const e of t.step(1 / 60, { jumpPressed: i === 0 || i === pressAt, jumpHeld: false, brakeHeld: false })) if (e.type === 'jump') jumps++;
      expect(jumps === 2, `${ms} ms`).toBe(works);
    }
  });

  it('missing a gap is a soft miss (fell), never a crash; the truck can be put back', () => {
    const terrain = new Terrain([flat(0, 1000, G), flat(1300, 3000, G)]);
    const t = new TruckSim(terrain, 600, { wheel: 'chunky' });
    const ev = run(t, 5);
    expect(ev).toContain('fell');
    t.placeAt(600);
    expect(t.grounded).toBe(true);
    expect(t.y).toBe(G);
  });

  it('ramps and pads throw the truck at full speed, even with slower driving', () => {
    for (const m of MISSIONS)
      for (const z of m.zones)
        for (const ex of [z.example]) {
          const base = new Terrain(m.segments, m.walls);
          expect(testLayout(base, z, ex, 'chunky', TUNING.drive.slowFactor).works, `${m.id}/${z.id} slow`).toBe(true);
        }
  });
});

describe('missions', () => {
  for (const m of MISSIONS) {
    const base = new Terrain(m.segments, m.walls);
    for (const wheel of WHEELS) {
      it(`${m.id} (${wheel}): the route to each build zone can be driven`, () => {
        const firstStop = m.zones[0]?.stopX ?? m.length - 100;
        const r = simulate(base, m.startX, firstStop - 5, { wheel, input: 'auto' });
        expect(r, JSON.stringify(r)).toMatchObject({ reached: true });
      });
    }
    for (const z of m.zones) {
      it(`${m.id}/${z.id}: every layout of the offered pieces either works or points at the socket that would help`, () => {
        const layouts: Placement[][] = [[]];
        // all ways to put the offered pieces in the sockets (each socket empty or one fitting piece)
        for (const s of z.sockets) {
          const next: Placement[][] = [];
          for (const l of layouts) {
            next.push(l);
            for (const p of z.tray) if (canPlace(z, l, s.id, p)) next.push([...l, { socket: s.id, piece: p }]);
          }
          layouts.splice(0, layouts.length, ...next);
        }
        let working = 0;
        for (const l of layouts)
          for (const wheel of WHEELS) {
            const r = testLayout(base, z, l, wheel);
            if (r.works) working++;
            else expect(r.hintSocket, `${JSON.stringify(l)} ${wheel}`).not.toBeNull();
          }
        expect(testLayout(base, z, [], 'chunky').works).toBe(false);
        expect(testLayout(base, z, z.example, 'chunky').works).toBe(true);
        expect(testLayout(base, z, z.example, 'spring').works).toBe(true);
        // more than one way to solve it
        expect(working / 2).toBeGreaterThanOrEqual(2);
      });
    }
  }

  it('the stream (mission 1) works with a bridge, a ramp or a bouncy pad, with either wheels', () => {
    const m = MISSIONS[0];
    const base = new Terrain(m.segments, m.walls);
    const z = m.zones[0];
    for (const wheel of WHEELS) {
      expect(testLayout(base, z, [{ socket: 'span', piece: 'bridge' }], wheel).works).toBe(true);
      expect(testLayout(base, z, [{ socket: 'launch', piece: 'ramp' }], wheel).works).toBe(true);
      expect(testLayout(base, z, [{ socket: 'launch', piece: 'pad' }], wheel).works).toBe(true);
    }
  });

  it('the ledge (mission 3) needs both rules: a bridge AND a ramp or pad', () => {
    const m = MISSIONS[2];
    const base = new Terrain(m.segments, m.walls);
    const z = m.zones[0];
    expect(testLayout(base, z, [{ socket: 'span', piece: 'bridge' }], 'chunky')).toEqual({ works: false, hintSocket: 'climb' });
    expect(testLayout(base, z, [{ socket: 'climb', piece: 'ramp' }], 'chunky').works).toBe(false);
    expect(testLayout(base, z, [{ socket: 'span', piece: 'bridge' }, { socket: 'climb', piece: 'ramp' }], 'spring').works).toBe(true);
    expect(testLayout(base, z, [{ socket: 'span', piece: 'bridge' }, { socket: 'climb', piece: 'pad' }], 'chunky').works).toBe(true);
  });

  it('spring wheels can take the higher route; chunky wheels stay on the easy lower route', () => {
    const m = MISSIONS[0];
    const up = m.upperRoute!;
    expect(apex('spring', 1)).toBeGreaterThan(G - up.y + 10);
    expect(apex('chunky', 30)).toBeLessThan(G - up.y);
  });
});

describe('every route variant finishes, with either wheels (acceptance 4 and 5)', () => {
  const finishOf = (m: (typeof MISSIONS)[number]) => (m.beats.find((b) => b.kind === 'finish') as { x: number }).x;
  const drive = (m: (typeof MISSIONS)[number], placed: Placement[], lane: Lane, wheel: WheelKind, from = m.startX) => {
    const extra = m.zones.flatMap((z) => segmentsFor(z, placed.filter((p) => z.sockets.some((s) => s.id === p.socket))));
    return simulate(new Terrain(m.segments, m.walls).with(extra), from, finishOf(m) + 5, { wheel, input: 'auto', lane, maxSec: 60 });
  };
  for (const wheel of WHEELS) {
    it(`mission 1 with a bridge, and with a ramp-and-landing (${wheel})`, () => {
      const m = MISSIONS[0];
      expect(drive(m, [{ socket: 'span', piece: 'bridge' }], 'back', wheel).reached).toBe(true);
      expect(drive(m, [{ socket: 'launch', piece: 'ramp' }], 'back', wheel).reached).toBe(true);
    });
    it(`mission 2: taking turns on the practice ramp, and a second path in front (${wheel})`, () => {
      const m = MISSIONS[1];
      expect(drive(m, [], 'back', wheel).reached).toBe(true);
      expect(drive(m, [{ socket: 'front-span', piece: 'bridge' }], 'front', wheel, 1080).reached).toBe(true);
      expect(drive(m, [{ socket: 'front-launch', piece: 'ramp' }], 'front', wheel, 1080).reached).toBe(true);
    });
    it(`mission 3: the gentle route and the jump route both reach the rally finish (${wheel})`, () => {
      const m = MISSIONS[2];
      const built: Placement[] = [{ socket: 'span', piece: 'bridge' }, { socket: 'climb', piece: 'ramp' }];
      expect(drive(m, built, 'front', wheel).reached).toBe(true);
      expect(drive(m, built, 'back', wheel).reached).toBe(true);
    });
  }
});
