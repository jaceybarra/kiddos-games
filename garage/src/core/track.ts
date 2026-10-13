import { TUNING, type WheelKind } from '../config/tuning';
import { Terrain, flat, slope, type Segment, type Wall } from './terrain';
import { simulate } from './truck';

/**
 * "My Tiny Track": six slots between a fixed start and finish. Each slot is
 * empty ground or one of three tested pieces. Placement only allows legal
 * connections; a test drive (the same truck physics, both wheels) decides
 * whether a legal layout is actually drivable, and if not, which slot to
 * point at and what would fix it.
 */
export type TrackPiece = 'log' | 'ramp' | 'pond';
export const TRACK_PIECES: TrackPiece[] = ['log', 'ramp', 'pond'];
export const TRACK_SLOTS = 6;
export const SLOT_W = 400;
export const START_LEN = 700;
export const FINISH_LEN = 900;
export type Slots = (TrackPiece | null)[];

const G = TUNING.world.groundY;
/** ramps here launch harder than the missions' gentle ramps: they must clear a whole pond */
export const TRACK_RAMP_LAUNCH = 1350;
export const TRACK_RAMP_RISE = 100;
/** the pond's water inside its slot */
export const POND = { from: 40, to: 360 };
export const LOG = { at: 170, w: 70, h: 72 };

export function emptySlots(): Slots {
  return Array.from({ length: TRACK_SLOTS }, () => null);
}

export function slotX(i: number): number {
  return START_LEN + i * SLOT_W;
}

export function trackLength(): number {
  return START_LEN + TRACK_SLOTS * SLOT_W + FINISH_LEN;
}

export function finishX(): number {
  return START_LEN + TRACK_SLOTS * SLOT_W + 360;
}

/**
 * Legal connections. A pond needs ground on both sides, so it can't sit
 * right after the start line or next to another pond. Everything else
 * connects to everything.
 */
export function legalAt(slots: Slots, i: number, piece: TrackPiece): boolean {
  if (i < 0 || i >= TRACK_SLOTS) return false;
  if (piece !== 'pond') return true;
  if (i === 0) return false;
  if (slots[i - 1] === 'pond') return false;
  if (i + 1 < TRACK_SLOTS && slots[i + 1] === 'pond') return false;
  return true;
}

/** Put a piece in a slot (replacing what's there). Returns null if the connection isn't legal. */
export function place(slots: Slots, i: number, piece: TrackPiece): Slots | null {
  const others = slots.slice();
  others[i] = null;
  if (!legalAt(others, i, piece)) return null;
  others[i] = piece;
  return others;
}

export function clearSlot(slots: Slots, i: number): Slots {
  const s = slots.slice();
  s[i] = null;
  return s;
}

export interface TrackWorld {
  segments: Segment[];
  walls: Wall[];
  length: number;
  finishX: number;
  /** water spans, for drawing */
  ponds: { x0: number; x1: number }[];
}

export function buildTrack(slots: Slots): TrackWorld {
  const segments: Segment[] = [];
  const walls: Wall[] = [];
  const ponds: { x0: number; x1: number }[] = [];
  // ground runs across everything except pond water
  let runFrom = 0;
  for (let i = 0; i < TRACK_SLOTS; i++) {
    const x = slotX(i);
    const p = slots[i];
    if (p === 'pond') {
      segments.push(flat(runFrom, x + POND.from, G));
      ponds.push({ x0: x + POND.from, x1: x + POND.to });
      runFrom = x + POND.to;
    } else if (p === 'log') {
      walls.push({ id: `slot-${i}-log`, x: x + LOG.at, w: LOG.w, top: G - LOG.h });
    } else if (p === 'ramp') {
      segments.push(slope(x + 180, G, x + SLOT_W, G - TRACK_RAMP_RISE, 'ramp', { launch: TRACK_RAMP_LAUNCH, id: `slot-${i}-ramp` }));
    }
  }
  segments.push(flat(runFrom, trackLength(), G));
  return { segments, walls, length: trackLength(), finishX: finishX(), ponds };
}

export function slotAt(x: number): number | null {
  const i = Math.floor((x - START_LEN) / SLOT_W);
  return i >= 0 && i < TRACK_SLOTS ? i : null;
}

export interface TrackCheck {
  playable: boolean;
  /** the slot where the truck got stuck */
  problemSlot: number | null;
  /** where to point, and the piece that would fix it (null: take this piece out) */
  fixSlot: number | null;
  fixPiece: TrackPiece | null;
}

/** Drive the track with both wheels, the way an assisted player would (jump before logs and gaps). */
export function checkTrack(slots: Slots, speedFactor = 1): TrackCheck {
  const world = buildTrack(slots);
  const terrain = new Terrain(world.segments, world.walls);
  for (const wheel of ['chunky', 'spring'] as WheelKind[]) {
    const run = simulate(terrain, 260, world.finishX, { wheel, input: 'auto', speedFactor, maxSec: 60 });
    if (run.reached) continue;
    if (run.fellAt !== null) {
      // the truck dropped into a pond: point at the pond, and suggest a ramp just before it
      const pond = [...world.ponds].reverse().find((p) => p.x0 <= run.fellAt!) ?? world.ponds[0];
      const problem = pond ? (slotAt(pond.x0) ?? 0) : (slotAt(run.fellAt) ?? 0);
      if (problem > 0 && slots[problem - 1] !== 'ramp') return { playable: false, problemSlot: problem, fixSlot: problem - 1, fixPiece: 'ramp' };
      return { playable: false, problemSlot: problem, fixSlot: problem, fixPiece: null };
    }
    const stuck = slotAt(run.x + 150) ?? slotAt(run.x) ?? TRACK_SLOTS - 1;
    return { playable: false, problemSlot: stuck, fixSlot: stuck, fixPiece: null };
  }
  return { playable: true, problemSlot: null, fixSlot: null, fixPiece: null };
}

/**
 * Repair a saved layout: unknown pieces become empty ground and illegal
 * neighbours are removed (left to right). Returns whether anything changed.
 */
export function sanitizeSlots(raw: unknown): { slots: Slots; corrected: boolean } {
  const slots = emptySlots();
  let corrected = !Array.isArray(raw) || raw.length !== TRACK_SLOTS;
  const list = Array.isArray(raw) ? raw : [];
  for (let i = 0; i < TRACK_SLOTS; i++) {
    const v = list[i];
    if (v === null || v === undefined) continue;
    if (typeof v !== 'string' || !(TRACK_PIECES as string[]).includes(v)) {
      corrected = true;
      continue;
    }
    if (!legalAt(slots, i, v as TrackPiece)) {
      corrected = true;
      continue;
    }
    slots[i] = v as TrackPiece;
  }
  return { slots, corrected };
}

export function countPieces(slots: Slots): number {
  return slots.filter(Boolean).length;
}
