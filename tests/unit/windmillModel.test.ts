import { describe, expect, it } from 'vitest';
import {
  ANGLES,
  NEST_SPOTS,
  PIP_PRACTICE,
  L,
  bestSpot,
  catches,
  missKind,
  kiteLanding,
  releasePoint,
  simulateLaunch,
  spotsFor,
  type WindLevel,
} from '../../src/content/trail/windmillModel';

const winds: WindLevel[] = ['breezy', 'gusty'];
const routes = ['launcher', 'windmill'] as const;

describe('Windmill Kite puzzle guarantees', () => {
  it('every preset offers exactly one launcher angle that frees the kite, in every wind', () => {
    for (const w of winds) {
      for (const preset of ['more-help', 'more-exploring'] as const) {
        const hits = ANGLES[preset].filter((a) => simulateLaunch(a, w).hit);
        expect(hits, `${preset} ${w}`).toHaveLength(1);
      }
    }
  });

  it('a correct choice works the first time (no forced failure)', () => {
    for (const w of winds) expect(simulateLaunch(46, w).hit).toBe(true);
  });

  it('More help offers two clearly different arrows (far apart, easy to tell apart)', () => {
    const [a, b] = ANGLES['more-help'];
    expect(b - a).toBeGreaterThanOrEqual(25);
  });

  it('a missed shot tells you which way to change the arrow', () => {
    for (const w of winds) {
      expect(missKind(simulateLaunch(28, w))).toBe('low');
      expect(missKind(simulateLaunch(62, w))).toBe('high');
      expect(missKind(simulateLaunch(74, w))).toBe('high');
    }
  });

  it('the avatar aims from beside the red pump, not on top of it', () => {
    // the pump sits 92 units left of the launcher and is about 120 wide
    expect(L.launcherX - 92 - L.aimStandX).toBeGreaterThanOrEqual(110);
    expect(L.aimStandX - L.pipAsideX).toBeGreaterThanOrEqual(150);
  });

  it("Pip's practice shots miss in a way that shows the wind", () => {
    for (const w of winds) {
      for (const a of PIP_PRACTICE) expect(simulateLaunch(a, w).hit).toBe(false);
      // the high shot is bent back by the wind: it lands left of where it would without wind
      const windy = simulateLaunch(62, w).end.x;
      const calm = simulateLaunch(62, 'none').end.x;
      expect(windy).toBeLessThan(calm);
    }
  });

  it('for each route and wind, exactly one nest spot catches the kite', () => {
    for (const w of winds) {
      for (const r of routes) {
        const catchers = NEST_SPOTS.filter((s) => catches(s, r, w));
        expect(catchers, `${r} ${w}`).toEqual([bestSpot(r, w)]);
      }
    }
  });

  it('the two routes need different nest spots (so watching where it lands matters)', () => {
    for (const w of winds) expect(bestSpot('launcher', w)).not.toBe(bestSpot('windmill', w));
  });

  it('More help always shows two spots that include the right one', () => {
    for (const w of winds) {
      for (const r of routes) {
        const spots = spotsFor('more-help', r, w);
        expect(spots).toHaveLength(2);
        expect(spots).toContain(bestSpot(r, w));
      }
    }
  });

  it('kite flutter takes a watchable amount of time', () => {
    for (const w of winds) for (const r of routes) {
      const t = kiteLanding(releasePoint(r), w).time;
      expect(t).toBeGreaterThan(1.8);
      expect(t).toBeLessThan(6);
    }
  });
});
