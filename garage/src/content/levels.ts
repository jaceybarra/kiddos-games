import type { BuildZone } from '../core/build';
import { flat, slope, type Crate, type Patch, type Segment, type Wall } from '../core/terrain';
import { buildTrack, slotX, TRACK_SLOTS, type Slots } from '../core/track';
import { G, missionById, type Beat, type Checkpoint, type Coin, type CrewId, type DiscoveryId, type MissionId, type RewardId } from './missions';

/**
 * Everything the mission scene drives through: an authored mission, or a
 * track the child built in My Tiny Track (same driving, same recovery).
 */
export interface Level {
  id: MissionId | 'track' | 'playground';
  length: number;
  startX: number;
  segments: Segment[];
  walls: Wall[];
  crates: Crate[];
  patches: Patch[];
  checkpoints: Checkpoint[];
  coins: Coin[];
  discovery: { id: DiscoveryId; x: number; y: number } | null;
  zones: BuildZone[];
  beats: Beat[];
  crew: Partial<Record<CrewId, { x: number; y?: number }>>;
  reward: RewardId | null;
  finishX: number;
  upperRoute?: { x0: number; x1: number; y: number };
  oldBridge?: { x0: number; x1: number };
  forkX?: number;
  seed: number;
}

/** Story decorations that belong to one mission's look. */
const EXTRAS: Record<MissionId, Partial<Level>> = {
  'wobbly-bridge': { oldBridge: { x0: 3000, x1: 3260 }, seed: 101 },
  'ramp-we-share': { seed: 202 },
  'everyone-rally': { forkX: 1440, seed: 303 },
};

export function missionLevel(id: MissionId): Level {
  const m = missionById(id);
  if (!m) throw new Error(`Unknown mission ${id}`);
  const finish = m.beats.find((b): b is Extract<Beat, { kind: 'finish' }> => b.kind === 'finish');
  return {
    id: m.id,
    length: m.length,
    startX: m.startX,
    segments: m.segments,
    walls: m.walls,
    crates: m.crates ?? [],
    patches: m.patches ?? [],
    checkpoints: m.checkpoints,
    coins: m.coins,
    discovery: m.discovery,
    zones: m.zones,
    beats: m.beats,
    crew: m.crew,
    reward: m.reward,
    finishX: finish ? finish.x : m.length - 400,
    upperRoute: m.upperRoute,
    seed: 1,
    ...EXTRAS[m.id],
  };
}

/** A My Tiny Track layout as a level: a checkpoint before every slot, the crew cheering at the finish. */
export function trackLevel(slots: Slots): Level {
  const w = buildTrack(slots);
  const checkpoints: Checkpoint[] = [{ id: 'cp-start', x: 260 }];
  for (let i = 0; i < TRACK_SLOTS; i++) checkpoints.push({ id: `cp-slot-${i}`, x: slotX(i) - 20 });
  return {
    id: 'track',
    length: w.length,
    startX: 260,
    segments: w.segments,
    walls: w.walls,
    crates: [],
    patches: [],
    checkpoints,
    coins: [],
    discovery: null,
    zones: [],
    beats: [{ kind: 'finish', x: w.finishX }],
    crew: { milo: { x: w.finishX + 180 }, pip: { x: w.finishX + 300 }, nori: { x: w.finishX + 420 } },
    reward: null,
    finishX: w.finishX,
    seed: 404 + slots.map((s, i) => (s ? (i + 1) * s.length : 0)).reduce((a, b) => a + b, 0),
  };
}

/**
 * The Test Track: free driving in the garage's back yard. No story and no
 * build, nothing to lose: crates to smash, boost strips, a big jump over a
 * ditch, bumpy hills, a mud pit, a log, a bouncy pad up to a high deck, and a
 * kicker ramp for flips before the finish. Every jump can be made at cruising
 * speed ("drives itself") and flat out.
 */
export function playgroundLevel(): Level {
  const crates: Crate[] = [];
  const box = (x: number, y: number = G, stack = 1) => {
    for (let i = 0; i < stack; i++) crates.push({ id: `pg-k${crates.length + 1}`, x, y: y - i * 90, size: 90 });
  };
  box(640);
  box(760, G, 2);
  box(2050, G, 2);
  box(3640);
  box(4700, G - 260);
  box(4800, G - 260, 2);
  box(4720);
  box(4880, G, 3);
  box(6500, G, 2);
  box(6620);
  const finishX = 6800;
  return {
    id: 'playground',
    length: 7300,
    startX: 260,
    segments: [
      flat(0, 1120, G),
      // the big jump over a ditch, landing on a long downhill run
      slope(1120, G, 1350, G - 120, 'ramp', { launch: 1100 }),
      flat(1560, 1900, G),
      // bumpy hills: fast over the tops gives little hops
      slope(2200, G, 2380, G - 90),
      slope(2380, G - 90, 2560, G),
      slope(2620, G, 2800, G - 110),
      slope(2800, G - 110, 2980, G),
      slope(3040, G, 3200, G - 80),
      slope(3200, G - 80, 3360, G),
      flat(1900, 4300, G),
      // a bouncy pad up to the high deck (or stay on the ground below)
      flat(4300, 4360, G - 2, 'pad', { bounce: 1320 }),
      flat(4360, 7300, G),
      flat(4520, 5050, G - 260, 'platform'),
      // the kicker: a long throw for flips, onto flat ground
      slope(5700, G, 5920, G - 150, 'ramp', { launch: 1200 }),
    ],
    walls: [{ id: 'pg-log', x: 4000, w: 70, top: G - 72 }],
    crates,
    patches: [
      { id: 'pg-boost-1', kind: 'boost', x0: 860, x1: 980, y: G },
      { id: 'pg-mud', kind: 'mud', x0: 3480, x1: 3800, y: G },
      { id: 'pg-boost-2', kind: 'boost', x0: 5380, x1: 5500, y: G },
    ],
    checkpoints: [
      { id: 'cp-start', x: 260 },
      { id: 'cp-hills', x: 1980 },
      { id: 'cp-mud', x: 3420 },
      { id: 'cp-pad', x: 4150 },
      { id: 'cp-kicker', x: 5200 },
    ],
    coins: [],
    discovery: null,
    zones: [],
    beats: [{ kind: 'finish', x: finishX }],
    crew: { milo: { x: finishX + 200 }, pip: { x: finishX + 320 }, nori: { x: finishX + 440 } },
    reward: null,
    finishX,
    seed: 505,
  };
}

export { G };
