import type { ArtPiece } from './svg';
import { registerPieces } from './registry';
import { TRUCK_PIECES } from './truck';
import { CREW_PIECES, CREW_PROPS } from './crew';
import { WORLD_PIECES } from './world';
import { GARAGE_PIECES } from './garage';

/**
 * Every authored art piece in one list, plus the key sets each scene needs
 * rasterised. Pure data: no Phaser import, usable from DOM code and tests.
 */
export const ALL_PIECES: ArtPiece[] = [...TRUCK_PIECES, ...CREW_PIECES, ...CREW_PROPS, ...WORLD_PIECES, ...GARAGE_PIECES];

let registered = false;

/** Register ALL_PIECES with the art registry (safe to call any number of times). */
export function registerAll(): void {
  if (registered) return;
  registerPieces(ALL_PIECES);
  registered = true;
}

const keysOf = (list: ArtPiece[]) => list.map((p) => p.key);
const TRUCK_KEYS = keysOf(TRUCK_PIECES);
const REWARD_KEYS = GARAGE_PIECES.filter((p) => p.key.startsWith('reward.')).map((p) => p.key);
const CONFETTI_KEYS = WORLD_PIECES.filter((p) => p.key.startsWith('fx.confetti.')).map((p) => p.key);

/** What the garage scene draws: the garage itself, rewards, the truck, friends idling/cheering, discoveries and a few effects. */
export const GARAGE_KEYS: string[] = [
  ...GARAGE_PIECES.map((p) => p.key),
  ...TRUCK_KEYS,
  ...CREW_PIECES.filter((p) => p.key.endsWith('.idle') || p.key.endsWith('.cheer')).map((p) => p.key),
  'obj.acorn',
  'obj.pinwheel.head',
  'obj.pinwheel.stick',
  'obj.ribbon',
  'obj.coin',
  'fx.spark',
  'fx.star',
  ...CONFETTI_KEYS,
  'fx.hand',
  'fx.arrow',
];

/** What a mission needs: the truck, every crew pose and prop, the whole meadow and its effects, and the rewards for the end. */
export const MISSION_KEYS: string[] = [...TRUCK_KEYS, ...keysOf(CREW_PIECES), ...keysOf(CREW_PROPS), ...keysOf(WORLD_PIECES), ...REWARD_KEYS];

/** The boot scene rasterises the union. */
export const BOOT_KEYS: string[] = [...new Set([...GARAGE_KEYS, ...MISSION_KEYS])];
