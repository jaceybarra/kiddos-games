import type { BuildZone } from '../core/build';
import type { Segment, Wall } from '../core/terrain';
import { buildTrack, slotX, TRACK_SLOTS, type Slots } from '../core/track';
import { G, missionById, type Beat, type Checkpoint, type Coin, type CrewId, type DiscoveryId, type MissionId, type RewardId } from './missions';

/**
 * Everything the mission scene drives through: an authored mission, or a
 * track the child built in My Tiny Track (same driving, same recovery).
 */
export interface Level {
  id: MissionId | 'track';
  length: number;
  startX: number;
  segments: Segment[];
  walls: Wall[];
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

export { G };
