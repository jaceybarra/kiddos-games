import { describe, expect, it } from 'vitest';
import {
  CUP_GLUGS,
  FRUIT_COLORS,
  STACK,
  dropLayer,
  exampleDish,
  juiceColor,
  matchWish,
  popBack,
  pourGlug,
  validDish,
  type Dish,
  type Wish,
} from '../../src/content/picnic/food';
import {
  CUTTER_OPTIONS,
  SCENARIOS,
  SCENARIO_ORDER,
  WEIGHT_CHOICES,
  WEIGHTS,
  LOOSE_CORNERS,
  DRUM_OPTIONS,
  MIXUP_OPTIONS,
  WINDBREAKS,
} from '../../src/content/picnic/scenarios';
import {
  addToTray,
  allHappy,
  applyCutter,
  applyDrum,
  askToTry,
  canParade,
  cornersHeld,
  guestsOf,
  keepForMe,
  newPicnic,
  offerFizzShape,
  placeWeight,
  quietSeat,
  seatGuest,
  seatSuits,
  serve,
  useLanternCutter,
  validPicnic,
  whoWants,
  wishOf,
  type PicnicState,
} from '../../src/content/picnic/picnicState';
import { GUEST_LINES, HOST_LINES, WISH_LINES, notQuiteLine, otherKindLine } from '../../src/content/picnic/picnicLines';

const PRESETS = ['more-help', 'more-exploring'] as const;

function dishFor(w: Wish, id: string, extra: Partial<Dish> = {}): Dish {
  return { ...exampleDish(w, id), ...extra };
}

/** Serve every guest the dish they asked for (cutting lantern cookies through the turn rules). */
function feedEveryone(s0: PicnicState): PicnicState {
  let s = s0;
  let n = 0;
  for (const g of guestsOf(s)) {
    if (s.happy[g.id]) continue;
    const w = wishOf(s, g.id)!;
    let extra: Partial<Dish> = {};
    if (w.kind === 'cookie' && w.shape === 'lantern') {
      const cut = useLanternCutter(s);
      s = cut.s;
      extra = { share: cut.share, forGuest: cut.forGuest };
      if (cut.forGuest === 'me') {
        // the child's own turn: their cookie, theirs to keep
        const mine = dishFor(w, `m${n++}`, extra);
        s = keepForMe(addToTray(s, mine).s, mine.id);
        const again = useLanternCutter(s);
        s = again.s;
        extra = { share: again.share, forGuest: again.forGuest };
      }
    }
    const d = dishFor(w, `x${n++}`, extra);
    s = addToTray(s, d).s;
    s = serve(s, d.id, g.id).s;
  }
  return s;
}

describe('Picnic Parade food rules', () => {
  it('a dish that matches the wish is a yes; details nobody mentioned never count', () => {
    const w: Wish = { kind: 'cookie', shape: 'star' };
    expect(matchWish(dishFor(w, 'a'), w)).toEqual({ kindOk: true, misses: [] });
    expect(matchWish(dishFor(w, 'b', { texture: 'crunchy' }), w).misses).toEqual([]);
    expect(matchWish(dishFor(w, 'c', { shape: 'moon' }), w).misses).toEqual(['shape']);
    expect(matchWish(dishFor({ kind: 'juice' }, 'd'), w).kindOk).toBe(false);
  });

  it('juice colours mix evenly and predictably', () => {
    expect(juiceColor(['berry'])).toBe(FRUIT_COLORS.berry);
    expect(juiceColor(['berry', 'sunfruit'])).toBe(juiceColor(['sunfruit', 'berry']));
    expect(juiceColor(['berry', 'sunfruit'])).not.toBe(FRUIT_COLORS.berry);
  });

  it('More help: fillings always land in the middle and never slide (until the stack is full)', () => {
    let layers: ReturnType<typeof dropLayer>['layers'] = [];
    for (let i = 0; i < STACK.maxLayers; i++) {
      const r = dropLayer(layers, 'cheese', 999 * (i % 2 ? 1 : -1), 'more-help');
      expect(r.slid).toBeNull();
      layers = r.layers;
    }
    expect(layers.every((l) => l.dx === 0)).toBe(true);
    expect(dropLayer(layers, 'jam', 0, 'more-help').reason).toBe('tall');
  });

  it('More exploring: an off-centre drop slides off, a leaning stack sheds its top, and popping back on always works', () => {
    expect(dropLayer([], 'cheese', 80, 'more-exploring').reason).toBe('offset');
    let layers = dropLayer([], 'cheese', 40, 'more-exploring').layers;
    layers = dropLayer(layers, 'jam', 80, 'more-exploring').layers;
    const lean = dropLayer(layers, 'tomato', 90, 'more-exploring');
    expect(lean.reason).toBe('lean');
    expect(lean.layers).toHaveLength(2);
    expect(popBack(lean.layers, 'tomato').slid).toBeNull();
  });

  it('pouring: one tap is one glug, and a full cup overflows into the saucer without going over', () => {
    let g = 0;
    for (let i = 0; i < CUP_GLUGS.small; i++) g = pourGlug(g, 'small').glugs;
    expect(g).toBe(CUP_GLUGS.small);
    const over = pourGlug(g, 'small');
    expect(over).toEqual({ glugs: CUP_GLUGS.small, spilled: true });
  });

  it('saved dishes are validated', () => {
    expect(validDish(exampleDish({ kind: 'sandwich', size: 'big' }))).toBe(true);
    expect(validDish({ id: 'x', kind: 'pizza', deco: [] })).toBe(false);
    expect(validDish({ id: 'x', kind: 'juice', fruits: ['rock'], deco: [] })).toBe(false);
    expect(validDish(null)).toBe(false);
  });
});

describe('Picnic Parade scenarios', () => {
  for (const id of SCENARIO_ORDER) {
    const def = SCENARIOS[id];
    it(`${id}: More help has two friends, More exploring three`, () => {
      expect(def.guests['more-help']).toHaveLength(2);
      expect(def.guests['more-exploring']).toHaveLength(3);
    });
    for (const preset of PRESETS) {
      it(`${id} (${preset}): every wish can be made with the ingredients on offer`, () => {
        for (const g of def.guests[preset]) {
          const w = g.wish;
          if (w.shape) expect(def.cutters[preset]).toContain(w.shape);
          if (w.filling) expect(def.fillings[preset]).toContain(w.filling);
          if (w.flavor) expect(def.fruits[preset]).toContain(w.flavor);
          if (w.deco) expect(def.decos[preset]).toContain(w.deco);
          expect(matchWish(exampleDish(w), w).misses).toEqual([]);
        }
      });
      it(`${id} (${preset}): every friend says what they want, out loud and in words`, () => {
        for (const g of def.guests[preset]) expect(WISH_LINES[id][g.id]?.[preset], `${g.id}`).toBeTruthy();
      });
      it(`${id} (${preset}): serving everyone what they asked for finishes the picnic`, () => {
        let s = newPicnic(id, preset);
        if (id === 'lantern') s = applyCutter(s, 'turns');
        s = feedEveryone(s);
        expect(allHappy(s)).toBe(true);
      });
    }
  }

  it('wishes come from the day, not the character: friends who visit twice want different things', () => {
    const seen = new Map<string, string[]>();
    for (const id of SCENARIO_ORDER) for (const g of SCENARIOS[id].guests['more-exploring']) seen.set(g.id, [...(seen.get(g.id) ?? []), JSON.stringify(g.wish)]);
    for (const [who, wishes] of seen) if (wishes.length > 1) expect(new Set(wishes).size, who).toBe(wishes.length);
  });

  it('a dish that isn’t quite right stays on the tray, and can go to someone who wants it', () => {
    const s0 = newPicnic('windy', 'more-exploring');
    const soft = dishFor({ kind: 'cookie', shape: 'star' }, 'a', { texture: 'soft' });
    let s = addToTray(s0, soft).s;
    const r = serve(s, 'a', 'pip');
    expect(r.reaction).toEqual({ type: 'notQuite', misses: ['texture'] });
    expect(r.s.tray).toHaveLength(1);
    expect(whoWants(r.s, soft, 'pip')).toBeNull();
    const juice = dishFor({ kind: 'juice', flavor: 'apple' }, 'b', { cup: 'big', glugs: 4 });
    s = addToTray(s, juice).s;
    // Moss doesn't mind the cup size
    expect(serve(s, 'b', 'moss').reaction.type).toBe('flex');
  });

  it('asking a friend to try something: some will, some politely won’t, and the dish stays yours either way', () => {
    let s = newPicnic('music', 'more-exploring');
    const crunchy = dishFor({ kind: 'cookie', texture: 'crunchy' }, 'a');
    s = addToTray(s, crunchy).s;
    const luma = askToTry(s, 'a', 'luma');
    expect(luma.tried).toBe(false);
    expect(luma.s.tray).toHaveLength(1);
    const kept = keepForMe(luma.s, 'a');
    expect(kept.mine?.id).toBe('a');
    expect(kept.tray).toHaveLength(0);
    expect(canParade(kept)).toBe(true);
  });

  it('lantern picnic: every way of sharing the cutter still lets everyone have a cookie', () => {
    for (const preset of PRESETS) {
      for (const opt of CUTTER_OPTIONS[preset]) {
        let s = applyCutter(newPicnic('lantern', preset), opt);
        if (opt === 'swap') s = offerFizzShape(s, 'star').s;
        s = feedEveryone(s);
        expect(allHappy(s), `${preset}/${opt}`).toBe(true);
      }
    }
  });

  it('lantern picnic: pressing the cutter together makes one big cookie that both friends share', () => {
    let s = applyCutter(newPicnic('lantern', 'more-help'), 'together');
    const cut = useLanternCutter(s);
    expect(cut.share).toBe(true);
    s = cut.s;
    const d = dishFor({ kind: 'cookie', shape: 'lantern' }, 'big', { share: true });
    s = addToTray(s, d).s;
    const r = serve(s, 'big', 'fizz');
    expect(r.reaction).toEqual({ type: 'shared', with: 'luma' });
    expect(allHappy(r.s)).toBe(true);
  });

  it('lantern picnic: Fizz can say no to a cutter, and yes to another', () => {
    const s = applyCutter(newPicnic('lantern', 'more-exploring'), 'swap');
    expect(offerFizzShape(s, 'round').accepted).toBe(false);
    const ok = offerFizzShape(s, 'moon');
    expect(ok.accepted).toBe(true);
    expect(wishOf(ok.s, 'fizz')?.shape).toBe('moon');
  });

  it('windy picnic: heavy things hold the corners down; light things blow away', () => {
    for (const preset of PRESETS) {
      let s = newPicnic('windy', preset);
      const light = WEIGHT_CHOICES[preset].find((w) => !WEIGHTS[w].heavy)!;
      expect(placeWeight(s, LOOSE_CORNERS[preset][0], light).held).toBe(false);
      const heavy = WEIGHT_CHOICES[preset].filter((w) => WEIGHTS[w].heavy);
      LOOSE_CORNERS[preset].forEach((c, i) => (s = placeWeight(s, c, heavy[i % heavy.length]).s));
      expect(cornersHeld(s)).toBe(true);
    }
  });

  it('music picnic: a quiet seat suits Luma, and so does a softer drum', () => {
    let s = newPicnic('music', 'more-exploring');
    s = seatGuest(s, 'luma', 2);
    expect(seatSuits(s, 'luma')).toBe(false);
    expect(seatSuits(applyDrum(s, 'softer'), 'luma')).toBe(true);
    s = seatGuest(s, 'luma', quietSeat(s));
    expect(seatSuits(s, 'luma')).toBe(true);
    // taking someone's cushion swaps places instead of pushing anyone off
    s = seatGuest(s, 'rowan', 2);
    s = seatGuest(s, 'rowan', quietSeat(s));
    expect(s.seats.luma).toBe(2);
  });

  it('every choice point offers at least two options, and the simpler preset never has more than the other', () => {
    for (const table of [CUTTER_OPTIONS, DRUM_OPTIONS, MIXUP_OPTIONS, WINDBREAKS, WEIGHT_CHOICES]) {
      expect(table['more-help'].length).toBeGreaterThanOrEqual(2);
      expect(table['more-help'].length).toBeLessThanOrEqual(table['more-exploring'].length);
    }
  });

  it('a saved picnic is validated before it is resumed', () => {
    expect(validPicnic(newPicnic('music', 'more-help'))).toBe(true);
    expect(validPicnic({ v: 1, scenario: 'volcano' })).toBe(false);
    expect(validPicnic({ ...newPicnic('windy', 'more-help'), tray: [{ id: 1 }] })).toBe(false);
  });
});

describe('Picnic Parade lines', () => {
  it('every wish detail has a kind “here’s what I’d like” line', () => {
    for (const id of SCENARIO_ORDER)
      for (const preset of PRESETS)
        for (const g of SCENARIOS[id].guests[preset]) {
          const w = g.wish;
          for (const attr of ['shape', 'texture', 'size', 'filling', 'flavor', 'deco'] as const) if (w[attr === 'flavor' ? 'flavor' : attr]) expect(notQuiteLine(w, attr)).not.toMatch(/undefined/);
          expect(otherKindLine(w.kind === 'juice' ? 'cookie' : 'juice', w)).not.toMatch(/undefined/);
        }
  });

  it('lines are short enough to hear in one go', () => {
    for (const l of [...Object.values(HOST_LINES), ...Object.values(GUEST_LINES)]) expect(l.text.length, l.text).toBeLessThanOrEqual(80);
  });
});
