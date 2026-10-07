import { describe, expect, it } from 'vitest';
import {
  CHANNEL_STONES,
  CROSSERS,
  DAM_LEAVES,
  LOG_SPOTS,
  PLANK_SPOTS,
  ROLES,
  ROLE_STEPS,
  addChannelStone,
  applyFix,
  canCross,
  cross,
  doStep,
  everyoneAcross,
  fishBack,
  flow,
  newBridge,
  newLaunch,
  newWater,
  placePlank,
  placeStone,
  removeLeaf,
  roleDone,
  rollLog,
  tie,
  tryLaunch,
  type BridgeState,
  type LaunchState,
} from '../../src/content/trail/adventures';

const PRESETS = ['more-help', 'more-exploring'] as const;

function buildPlanks(b0: BridgeState): BridgeState {
  let b = b0;
  for (let i = 0; i < PLANK_SPOTS; i++) {
    const r = placePlank(b, i);
    b = r.b;
    if (r.floatsAway) b = placePlank(tie(fishBack(b)), i).b;
  }
  return b;
}

describe('The Picnic Bridge', () => {
  it('the first plank floats away once; fishing it back and tying fixes it for good', () => {
    let b = newBridge('more-help');
    const r = placePlank(b, 0);
    expect(r.floatsAway).toBe(true);
    expect(r.b.planks[0]).toBe(false);
    b = tie(fishBack(r.b));
    expect(placePlank(b, 0).floatsAway).toBe(false);
  });

  it('each friend says what they need: Moss needs flat, Rowan needs steady, Fizz would rather hop', () => {
    let b = newBridge('more-exploring');
    for (const c of CROSSERS) expect(canCross(b, c.id).ok).toBe(false);
    // stones only: Fizz hops over happily; Moss can't (steps)
    for (let i = 0; i < b.stones.length; i++) b = placeStone(b, i);
    expect(canCross(b, 'fizz')).toEqual({ ok: true, via: 'stones', happy: true });
    expect(canCross(b, 'moss')).toEqual({ ok: false, reason: 'noFlat' });
  });

  it('a plank bridge before tying is too wobbly for the wagon; tied, it carries everyone', () => {
    let b = newBridge('more-help');
    b = { ...b, floated: 'back' };
    for (let i = 0; i < PLANK_SPOTS; i++) b = placePlank(b, i).b;
    expect(canCross(b, 'rowan')).toEqual({ ok: false, reason: 'wobbly' });
    expect(canCross(b, 'moss').ok).toBe(true);
    b = tie(b);
    expect(canCross(b, 'rowan').ok).toBe(true);
    // Fizz can walk it, but would rather hop (a preference, still okay)
    expect(canCross(b, 'fizz')).toEqual({ ok: true, via: 'planks', happy: false });
  });

  for (const preset of PRESETS) {
    it(`${preset}: both routes get everyone across (planks + stones, or the old log bridge)`, () => {
      let b = buildPlanks(newBridge(preset));
      for (let i = 0; i < b.stones.length; i++) b = placeStone(b, i);
      for (const c of CROSSERS) b = cross(b, c.id).b;
      expect(everyoneAcross(b)).toBe(true);

      let logs = newBridge(preset);
      for (let i = 0; i < LOG_SPOTS; i++) logs = rollLog(logs, i);
      for (const c of CROSSERS) logs = cross(logs, c.id).b;
      expect(everyoneAcross(logs)).toBe(true);
    });
  }
});

describe('The Waterwheel Mix-Up', () => {
  it('the leaf dam keeps water from the wheel', () => {
    expect(flow(newWater('more-help'))).toEqual({ wheel: false, pool: true });
  });

  it('a stone channel shares the water: the wheel turns and the pool stays', () => {
    let w = newWater('more-exploring');
    for (let i = 0; i < CHANNEL_STONES; i++) w = addChannelStone(w);
    expect(flow(w)).toEqual({ wheel: true, pool: true });
  });

  for (const preset of PRESETS) {
    it(`${preset}: clearing the dam alone also works (the pool empties)`, () => {
      let w = newWater(preset);
      for (let i = 0; i < DAM_LEAVES[preset]; i++) w = removeLeaf(w);
      expect(flow(w)).toEqual({ wheel: true, pool: false });
    });
  }
});

describe('The Lantern Launch', () => {
  it('the first launch is a little too heavy, and every fix lets it rise', () => {
    const l = newLaunch();
    const first = tryLaunch(l);
    expect(first.rises).toBe(false);
    for (const fix of ['trim', 'balloon', 'swap'] as const) expect(tryLaunch(applyFix(first.l, fix)).rises).toBe(true);
  });

  for (const preset of PRESETS) {
    it(`${preset}: every job can be finished, and there is a quiet one on More exploring`, () => {
      for (const role of ROLES[preset]) {
        let l: LaunchState = { ...newLaunch(), role };
        for (let i = 0; i < ROLE_STEPS[role]; i++) l = doStep(l);
        expect(roleDone(l), role).toBe(true);
      }
      expect(ROLES[preset].length).toBeGreaterThanOrEqual(3);
    });
  }
  it('More exploring includes the quiet job of lighting the path lanterns', () => {
    expect(ROLES['more-exploring']).toContain('path');
  });
});
