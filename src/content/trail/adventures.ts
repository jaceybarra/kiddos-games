import type { CastId } from '../../art/cast';
import type { PresetId } from '../../save/schema';

/**
 * Rules for Lantern Trail adventures 2–4, as pure functions so every route
 * can be checked by tests: whatever the child chooses, the adventure can be
 * finished, and nobody's need is mocked or ignored.
 */

// ================================================================== A2. The Picnic Bridge

export type BridgePart = 'plank' | 'stone' | 'log';
/** Snap spots across Whistle Stream: a plank lane, a stepping-stone lane, and the old log bridge upstream. */
export const PLANK_SPOTS = 3;
export const STONE_SPOTS: Record<PresetId, number> = { 'more-help': 3, 'more-exploring': 4 };
export const LOG_SPOTS = 3;

export interface BridgeState {
  planks: boolean[];
  stones: boolean[];
  logs: boolean[];
  /** planks tied with Moss's rope (after one floated away) */
  tied: boolean;
  /** the plank that floated off has been fished back */
  floated: 'no' | 'away' | 'back';
  crossed: CastId[];
}

export function newBridge(preset: PresetId): BridgeState {
  return { planks: Array(PLANK_SPOTS).fill(false), stones: Array(STONE_SPOTS[preset]).fill(false), logs: Array(LOG_SPOTS).fill(false), tied: false, floated: 'no', crossed: [] };
}

export const plankLane = (b: BridgeState) => b.planks.every(Boolean);
export const stoneLane = (b: BridgeState) => b.stones.every(Boolean);
export const logLane = (b: BridgeState) => b.logs.every(Boolean);

/** What each friend needs (shown in their bubble and said out loud). */
export const CROSSERS: { id: CastId; need: 'flat' | 'hop' | 'wide' }[] = [
  { id: 'moss', need: 'flat' },
  { id: 'fizz', need: 'hop' },
  { id: 'rowan', need: 'wide' },
];

export type CrossResult = { ok: true; via: 'planks' | 'stones' | 'logs'; happy: boolean } | { ok: false; reason: 'noFlat' | 'wobbly' | 'gap' };

/**
 * Can this friend cross yet? Moss needs a flat way with no steps; Rowan's
 * wagon needs a wide, steady way (tied planks or logs); Fizz would love to
 * hop, but will walk a flat way too (a preference, not a requirement).
 */
export function canCross(b: BridgeState, who: CastId): CrossResult {
  const flatSteady = (plankLane(b) && b.tied) || logLane(b);
  const flat = plankLane(b) || logLane(b);
  if (who === 'moss') {
    if (logLane(b)) return { ok: true, via: 'logs', happy: true };
    if (plankLane(b)) return { ok: true, via: 'planks', happy: true };
    return { ok: false, reason: 'noFlat' };
  }
  if (who === 'rowan') {
    if (flatSteady) return { ok: true, via: logLane(b) ? 'logs' : 'planks', happy: true };
    if (plankLane(b)) return { ok: false, reason: 'wobbly' };
    return { ok: false, reason: 'gap' };
  }
  // Fizz
  if (stoneLane(b)) return { ok: true, via: 'stones', happy: true };
  if (logLane(b)) return { ok: true, via: 'logs', happy: true };
  if (flat) return { ok: true, via: 'planks', happy: false };
  return { ok: false, reason: 'gap' };
}

export function everyoneAcross(b: BridgeState): boolean {
  return CROSSERS.every((c) => b.crossed.includes(c.id));
}

/** The first plank put down floats away (once); fishing it back and tying the planks solves it. */
export function placePlank(b: BridgeState, spot: number): { b: BridgeState; floatsAway: boolean } {
  if (spot < 0 || spot >= b.planks.length || b.planks[spot]) return { b, floatsAway: false };
  if (b.floated === 'no' && !b.tied) return { b: { ...b, floated: 'away' }, floatsAway: true };
  const planks = [...b.planks];
  planks[spot] = true;
  return { b: { ...b, planks }, floatsAway: false };
}

export function placeStone(b: BridgeState, spot: number): BridgeState {
  if (spot < 0 || spot >= b.stones.length || b.stones[spot]) return b;
  const stones = [...b.stones];
  stones[spot] = true;
  return { ...b, stones };
}

export function rollLog(b: BridgeState, spot: number): BridgeState {
  if (spot < 0 || spot >= b.logs.length || b.logs[spot]) return b;
  const logs = [...b.logs];
  logs[spot] = true;
  return { ...b, logs };
}

export function fishBack(b: BridgeState): BridgeState {
  return b.floated === 'away' ? { ...b, floated: 'back' } : b;
}

export function tie(b: BridgeState): BridgeState {
  return { ...b, tied: true };
}

export function cross(b: BridgeState, who: CastId): { b: BridgeState; r: CrossResult } {
  const r = canCross(b, who);
  if (!r.ok || b.crossed.includes(who)) return { b, r };
  return { b: { ...b, crossed: [...b.crossed, who] }, r };
}

// ================================================================== A3. The Waterwheel Mix-Up

export const DAM_LEAVES: Record<PresetId, number> = { 'more-help': 4, 'more-exploring': 6 };
export const CHANNEL_STONES = 3;

export interface WaterState {
  /** leaves still in Fizz's dam */
  leaves: number;
  /** stones placed to make a side channel (shares water between the pool and the wheel) */
  channel: number;
  /** clues found on the way upstream */
  clues: string[];
  /** Moss measured where a channel should go */
  measured: boolean;
  fizzMet: boolean;
  /** how the child chose to repair it */
  route: 'together' | 'solo' | 'moss' | '';
}

export function newWater(preset: PresetId): WaterState {
  return { leaves: DAM_LEAVES[preset], channel: 0, clues: [], measured: false, fizzMet: false, route: '' };
}

/** Where the water goes: the dam blocks the wheel; a full channel shares it; clearing the dam empties the pool. */
export function flow(w: WaterState): { wheel: boolean; pool: boolean } {
  if (w.channel >= CHANNEL_STONES) return { wheel: true, pool: w.leaves > 0 };
  if (w.leaves <= 0) return { wheel: true, pool: false };
  return { wheel: false, pool: true };
}

export function removeLeaf(w: WaterState): WaterState {
  return { ...w, leaves: Math.max(0, w.leaves - 1) };
}

export function addChannelStone(w: WaterState): WaterState {
  return { ...w, channel: Math.min(CHANNEL_STONES, w.channel + 1) };
}

export const CLUES = ['leaf', 'footprints', 'bucket'] as const;
export function findClue(w: WaterState, clue: string): WaterState {
  return w.clues.includes(clue) ? w : { ...w, clues: [...w.clues, clue] };
}

// ================================================================== A4. The Lantern Launch

export type LaunchRole = 'fold' | 'light' | 'hold' | 'signal' | 'path';
export const ROLES: Record<PresetId, LaunchRole[]> = {
  'more-help': ['fold', 'light', 'signal'],
  'more-exploring': ['fold', 'light', 'hold', 'signal', 'path'],
};
/** Who does the jobs the child doesn't pick (every job gets done; nobody is left out). */
export const ROLE_FRIEND: Record<LaunchRole, CastId> = { fold: 'luma', light: 'rowan', hold: 'moss', signal: 'pip', path: 'fizz' };

export interface LaunchState {
  role: LaunchRole | null;
  /** steps of the child's job done */
  steps: number;
  /** paper weight units; each balloon lifts this much */
  weight: number;
  balloons: number;
  attempts: number;
  fix: 'trim' | 'balloon' | 'swap' | null;
  launched: boolean;
  /** path lanterns lit (the quiet job) */
  pathLit: number;
}

export const ROLE_STEPS: Record<LaunchRole, number> = { fold: 3, light: 2, hold: 3, signal: 3, path: 4 };
export const LIFT_PER_BALLOON = 4;

export function newLaunch(): LaunchState {
  // the first lantern is a little too heavy: a playful wobble, not a failure
  return { role: null, steps: 0, weight: 5, balloons: 1, attempts: 0, fix: null, launched: false, pathLit: 0 };
}

export function lift(l: LaunchState): number {
  return l.balloons * LIFT_PER_BALLOON - l.weight;
}

export function tryLaunch(l: LaunchState): { l: LaunchState; rises: boolean } {
  const rises = lift(l) > 0;
  return { l: { ...l, attempts: l.attempts + 1, launched: rises || l.launched }, rises };
}

/** Each fix makes it light enough; swapping roles means a friend with a lighter touch re-folds it. */
export function applyFix(l: LaunchState, fix: 'trim' | 'balloon' | 'swap'): LaunchState {
  if (fix === 'trim') return { ...l, fix, weight: l.weight - 2 };
  if (fix === 'balloon') return { ...l, fix, balloons: l.balloons + 1 };
  return { ...l, fix, weight: l.weight - 2 };
}

export function doStep(l: LaunchState): LaunchState {
  if (!l.role) return l;
  return { ...l, steps: Math.min(ROLE_STEPS[l.role], l.steps + 1), pathLit: l.role === 'path' ? Math.min(ROLE_STEPS.path, l.pathLit + 1) : l.pathLit };
}

export function roleDone(l: LaunchState): boolean {
  return !!l.role && l.steps >= ROLE_STEPS[l.role];
}
