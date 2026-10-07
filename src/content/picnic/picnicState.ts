import type { CastId } from '../../art/cast';
import type { PresetId } from '../../save/schema';
import { type Dish, type Shape, type Wish, type WishAttr, matchWish, validDish } from './food';
import {
  CUTTER_OPTIONS,
  FIZZ_OK_SHAPES,
  LANTERN_LATE_GUEST,
  LOOSE_CORNERS,
  SCENARIOS,
  WEIGHTS,
  type CutterOption,
  type DrumOption,
  type GuestDef,
  type ScenarioId,
  type WeightId,
  type WindbreakId,
  seatsFor,
} from './scenarios';

/**
 * A picnic in progress, as plain data (saved after every step, so a refresh
 * resumes exactly here). All the rules live in these pure functions; the
 * scene only animates what they decide.
 */

export type Phase = 'intro' | 'setup' | 'cook' | 'parade' | 'done';
export type HappyHow = 'yum' | 'flex' | 'shared' | 'tried';
/** who made it onto whose turn label (a guest id or 'me') */
export type TurnOwner = CastId | 'me';

export interface PicnicState {
  v: 1;
  scenario: ScenarioId;
  preset: PresetId;
  phase: Phase;
  wishes: Partial<Record<CastId, Wish>>;
  happy: Partial<Record<CastId, HappyHow>>;
  eaten: Partial<Record<CastId, Dish>>;
  tray: Dish[];
  /** the child's own snack: theirs to keep */
  mine: Dish | null;
  seats: Partial<Record<CastId, number>>;
  /** windy: what sits on each blanket corner */
  weights: (WeightId | null)[];
  windbreak: WindbreakId | null;
  /** lantern: whose turn the lantern cutter is (front of the queue) */
  cutterQueue: TurnOwner[];
  cutter: CutterOption | null;
  drum: 'loud' | 'soft';
  /** lanterns hung on the string (lantern picnic setup) */
  lanterns: number;
  mossInvited: boolean;
  mossJoined: boolean;
  mixup: 'none' | 'pending' | 'done';
  /** a friend is helping in the kitchen after the mix-up */
  helping: boolean;
  nextId: number;
}

export const TRAY_SLOTS = 3;
export const LANTERN_SLOTS = 3;

export function newPicnic(id: ScenarioId, preset: PresetId): PicnicState {
  const def = SCENARIOS[id];
  const guests = def.guests[preset];
  const wishes: Partial<Record<CastId, Wish>> = {};
  const seats: Partial<Record<CastId, number>> = {};
  guests.forEach((g, i) => {
    wishes[g.id] = { ...g.wish };
    if (def.setup !== 'seats') seats[g.id] = i;
  });
  return {
    v: 1,
    scenario: id,
    preset,
    phase: 'intro',
    wishes,
    happy: {},
    eaten: {},
    tray: [],
    mine: null,
    seats,
    weights: [null, null, null, null],
    windbreak: null,
    cutterQueue: [],
    cutter: null,
    drum: 'loud',
    lanterns: 0,
    mossInvited: false,
    mossJoined: false,
    mixup: 'none',
    helping: false,
    nextId: 1,
  };
}

export function guestsOf(s: PicnicState): GuestDef[] {
  const base = SCENARIOS[s.scenario].guests[s.preset];
  return s.mossJoined && !base.some((g) => g.id === 'moss') ? [...base, LANTERN_LATE_GUEST] : base;
}

export function guestDef(s: PicnicState, id: CastId): GuestDef | undefined {
  return guestsOf(s).find((g) => g.id === id);
}

export function wishOf(s: PicnicState, id: CastId): Wish | undefined {
  return s.wishes[id] ?? guestDef(s, id)?.wish;
}

export function newDishId(s: PicnicState): { s: PicnicState; id: string } {
  return { s: { ...s, nextId: s.nextId + 1 }, id: `d${s.nextId}` };
}

// ------------------------------------------------------------------ tray

export function addToTray(s: PicnicState, d: Dish): { s: PicnicState; ok: boolean } {
  if (s.tray.length >= TRAY_SLOTS) return { s, ok: false };
  return { s: { ...s, tray: [...s.tray, d] }, ok: true };
}

export function removeFromTray(s: PicnicState, dishId: string): PicnicState {
  return { ...s, tray: s.tray.filter((d) => d.id !== dishId) };
}

export function replaceOnTray(s: PicnicState, d: Dish): PicnicState {
  return { ...s, tray: s.tray.map((x) => (x.id === d.id ? d : x)) };
}

/** Keep it for yourself. Your own snack is yours: nobody has to be given it. */
export function keepForMe(s: PicnicState, dishId: string): PicnicState {
  const d = s.tray.find((x) => x.id === dishId);
  if (!d) return s;
  return { ...removeFromTray(s, dishId), mine: d };
}

// ------------------------------------------------------------------ serving

export type Reaction =
  | { type: 'yum' }
  | { type: 'flex'; misses: WishAttr[] }
  | { type: 'shared'; with: CastId }
  | { type: 'notQuite'; misses: WishAttr[] }
  | { type: 'otherKind' }
  | { type: 'full' }
  | { type: 'missing' };

/** Offer a dish to a guest. They say honestly whether it's what they wanted; a "not quite" dish stays on the tray. */
export function serve(s: PicnicState, dishId: string, guest: CastId): { s: PicnicState; reaction: Reaction } {
  const d = s.tray.find((x) => x.id === dishId);
  const g = guestDef(s, guest);
  if (!d || !g) return { s, reaction: { type: 'missing' } };
  if (s.happy[guest]) return { s, reaction: { type: 'full' } };
  const w = wishOf(s, guest)!;
  const m = matchWish(d, w);
  if (!m.kindOk) return { s, reaction: { type: 'otherKind' } };
  // a shared cookie (made together) is for two friends who both wanted that cookie
  if (d.share) {
    const partner = guestsOf(s).find((o) => o.id !== guest && !s.happy[o.id] && matchWish(d, wishOf(s, o.id)!).misses.filter((a) => a !== 'size').length === 0 && wishOf(s, o.id)!.kind === d.kind);
    const ownMisses = m.misses.filter((a) => a !== 'size');
    if (partner && ownMisses.length === 0) {
      const next = removeFromTray(s, dishId);
      return {
        s: { ...next, happy: { ...next.happy, [guest]: 'shared', [partner.id]: 'shared' }, eaten: { ...next.eaten, [guest]: d, [partner.id]: d } },
        reaction: { type: 'shared', with: partner.id },
      };
    }
    m.misses = ownMisses;
  }
  const hard = m.misses.filter((a) => !(g.flexible ?? []).includes(a));
  if (hard.length) return { s, reaction: { type: 'notQuite', misses: hard } };
  const next = removeFromTray(s, dishId);
  return {
    s: { ...next, happy: { ...next.happy, [guest]: m.misses.length ? 'flex' : 'yum' }, eaten: { ...next.eaten, [guest]: d } },
    reaction: m.misses.length ? { type: 'flex', misses: m.misses } : { type: 'yum' },
  };
}

/** "Could you try it?" Some friends will, some politely won't. Both are okay. */
export function askToTry(s: PicnicState, dishId: string, guest: CastId): { s: PicnicState; tried: boolean } {
  const d = s.tray.find((x) => x.id === dishId);
  const g = guestDef(s, guest);
  if (!d || !g || s.happy[guest] || !g.willTry || d.kind !== wishOf(s, guest)?.kind) return { s, tried: false };
  const next = removeFromTray(s, dishId);
  return { s: { ...next, happy: { ...next.happy, [guest]: 'tried' }, eaten: { ...next.eaten, [guest]: d } }, tried: true };
}

/** Another guest who'd be glad of this dish (to offer it to instead). */
export function whoWants(s: PicnicState, d: Dish, except?: CastId): CastId | null {
  for (const g of guestsOf(s)) {
    if (g.id === except || s.happy[g.id]) continue;
    const m = matchWish(d, wishOf(s, g.id)!);
    if (m.kindOk && m.misses.every((a) => (g.flexible ?? []).includes(a))) return g.id;
  }
  return null;
}

export function allHappy(s: PicnicState): boolean {
  return guestsOf(s).every((g) => !!s.happy[g.id]);
}

/** The picnic can start whenever at least one friend has something; the others can share. */
export function canParade(s: PicnicState): boolean {
  return Object.keys(s.happy).length > 0 || !!s.mine;
}

// ------------------------------------------------------------------ windy picnic setup

export function looseCorners(s: PicnicState): number[] {
  return s.scenario === 'windy' ? LOOSE_CORNERS[s.preset] : [];
}

/** Put something on a flapping corner. Heavy things hold it down; light things blow away (and drift back). */
export function placeWeight(s: PicnicState, corner: number, item: WeightId): { s: PicnicState; held: boolean } {
  if (!looseCorners(s).includes(corner) || s.weights[corner]) return { s, held: false };
  if (!WEIGHTS[item].heavy) return { s, held: false };
  const weights = [...s.weights];
  weights[corner] = item;
  return { s: { ...s, weights }, held: true };
}

export function cornersHeld(s: PicnicState): boolean {
  return looseCorners(s).every((c) => !!s.weights[c]);
}

export function setWindbreak(s: PicnicState, id: WindbreakId): PicnicState {
  return { ...s, windbreak: id };
}

// ------------------------------------------------------------------ music picnic seats

export function seatGuest(s: PicnicState, guest: CastId, seat: number): PicnicState {
  const spots = seatsFor(s.scenario);
  if (seat < 0 || seat >= spots.length) return s;
  const seats = { ...s.seats };
  const prev = (Object.keys(seats) as CastId[]).find((k) => seats[k] === seat && k !== guest);
  // if someone is already there, they swap places
  if (prev) {
    const mine = seats[guest];
    if (mine === undefined) delete seats[prev];
    else seats[prev] = mine;
  }
  seats[guest] = seat;
  return { ...s, seats };
}

export function allSeated(s: PicnicState): boolean {
  return guestsOf(s).every((g) => s.seats[g.id] !== undefined);
}

/** Does this friend's seat suit what they said? (A quiet seat is far from the drum.) */
export function seatSuits(s: PicnicState, guest: CastId): boolean {
  const g = guestDef(s, guest);
  const seat = s.seats[guest];
  if (!g?.seat || seat === undefined) return true;
  const loud = seatsFor(s.scenario)[seat].loud;
  if (g.seat === 'quiet') return loud === 0 || s.drum === 'soft';
  return loud === 2;
}

export function applyDrum(s: PicnicState, option: DrumOption): PicnicState {
  if (option === 'softer') return { ...s, drum: 'soft' };
  return s; // moving seats happens through seatGuest; asking Luma is talk only
}

/** The quiet seat (furthest from the drum). */
export function quietSeat(s: PicnicState): number {
  return seatsFor(s.scenario).findIndex((x) => x.loud === 0);
}

// ------------------------------------------------------------------ lantern picnic: the cutter

export function applyCutter(s: PicnicState, option: CutterOption): PicnicState {
  if (!CUTTER_OPTIONS[s.preset].includes(option)) return s;
  const queue: TurnOwner[] = option === 'turns' ? ['luma', 'fizz'] : option === 'mine' ? ['me', 'luma', 'fizz'] : [];
  return { ...s, cutter: option, cutterQueue: queue };
}

/** Offer Fizz a different cutter. Fizz can say no to a shape, and that's fine too. */
export function offerFizzShape(s: PicnicState, shape: Shape): { s: PicnicState; accepted: boolean } {
  if (!FIZZ_OK_SHAPES.includes(shape)) return { s, accepted: false };
  const w = s.wishes.fizz;
  if (!w) return { s, accepted: false };
  return { s: { ...s, wishes: { ...s.wishes, fizz: { ...w, shape } } }, accepted: true };
}

/** Cutting a lantern cookie uses up the front of the turn queue; the cookie carries that turn's label. */
export function useLanternCutter(s: PicnicState): { s: PicnicState; forGuest?: TurnOwner; share: boolean } {
  if (s.cutter === 'together' && !Object.values(s.eaten).some((d) => d?.share) && !s.tray.some((d) => d.share)) return { s, share: true };
  if (!s.cutterQueue.length) return { s, share: false };
  const [head, ...rest] = s.cutterQueue;
  return { s: { ...s, cutterQueue: rest }, forGuest: head, share: false };
}

export function hangLantern(s: PicnicState): PicnicState {
  return { ...s, lanterns: Math.min(LANTERN_SLOTS, s.lanterns + 1) };
}

// ------------------------------------------------------------------ saved data is untrusted

export function validPicnic(x: unknown): x is PicnicState {
  const s = x as PicnicState;
  if (!s || s.v !== 1 || !SCENARIOS[s.scenario] || (s.preset !== 'more-help' && s.preset !== 'more-exploring')) return false;
  if (!['intro', 'setup', 'cook', 'parade', 'done'].includes(s.phase)) return false;
  if (!Array.isArray(s.tray) || s.tray.length > TRAY_SLOTS || !s.tray.every(validDish)) return false;
  if (s.mine !== null && !validDish(s.mine)) return false;
  if (!Array.isArray(s.weights) || s.weights.length !== 4) return false;
  if (!s.wishes || !s.happy || !s.eaten || !s.seats || !Array.isArray(s.cutterQueue)) return false;
  return Object.values(s.eaten).every(validDish) && Number.isFinite(s.nextId);
}

export function isComplete(s: PicnicState): boolean {
  return s.phase === 'done';
}
