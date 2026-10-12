import { TUNING } from '../config/tuning';
import { flat, slope, type Segment, type Wall } from '../core/terrain';
import type { BuildZone } from '../core/build';

/**
 * The three authored missions of Meadow Motor Park, as data. Ids are stable:
 * saves refer to them. Geometry is in world units (ground at G).
 */
export type MissionId = 'wobbly-bridge' | 'ramp-we-share' | 'everyone-rally';
export type CrewId = 'milo' | 'pip' | 'nori';
export type RewardId = 'pennant' | 'twin-ramp' | 'crew-banner';
export type DiscoveryId = 'golden-acorn' | 'pinwheel' | 'rally-ribbon';

export const G: number = TUNING.world.groundY;
const RAMP = TUNING.pieces.rampLaunch;
const PAD = TUNING.pieces.padBounce;

export interface Coin {
  id: string;
  x: number;
  y: number;
}

export interface Checkpoint {
  id: string;
  x: number;
}

/** Story beats happen in order as the truck reaches each x. */
export type Beat =
  | { kind: 'teachJump'; x: number; wallId: string }
  | { kind: 'encounter'; id: string; x: number }
  | { kind: 'build'; zone: string }
  | { kind: 'finish'; x: number };

/** How help unfolds (the scene implements these steps for every mission). */
export type HelpStep =
  | { when: 'two-misses-at-an-obstacle' | 'help-button-while-driving'; show: 'see-through-truck-demonstrates-the-jump' }
  | { when: 'help-button-while-building' | 'two-tests-that-do-not-work'; show: 'hand-carries-the-example-piece-to-its-socket' }
  | { when: 'a-test-that-does-not-work'; show: 'the-socket-that-would-help-bobs-with-an-arrow' };

const HELP: HelpStep[] = [
  { when: 'two-misses-at-an-obstacle', show: 'see-through-truck-demonstrates-the-jump' },
  { when: 'help-button-while-driving', show: 'see-through-truck-demonstrates-the-jump' },
  { when: 'a-test-that-does-not-work', show: 'the-socket-that-would-help-bobs-with-an-arrow' },
  { when: 'two-tests-that-do-not-work', show: 'hand-carries-the-example-piece-to-its-socket' },
  { when: 'help-button-while-building', show: 'hand-carries-the-example-piece-to-its-socket' },
];

export interface MissionDef {
  id: MissionId;
  /** the visible primary objective, in grown-up words */
  goal: string;
  /** the safe ways through (each is tested end to end) */
  variants: { id: string; how: string }[];
  help: HelpStep[];
  /** for grown-ups and screen readers only; the child never needs to read it */
  title: string;
  /** world length */
  length: number;
  startX: number;
  segments: Segment[];
  walls: Wall[];
  checkpoints: Checkpoint[];
  coins: Coin[];
  discovery: { id: DiscoveryId; x: number; y: number };
  zones: BuildZone[];
  beats: Beat[];
  crew: Partial<Record<CrewId, { x: number; y?: number }>>;
  reward: RewardId;
  /** where spring wheels can climb (decor marks the higher route) */
  upperRoute?: { x0: number; x1: number; y: number };
}

// ------------------------------------------------------------------ Mission 1

const wobbly: MissionDef = {
  id: 'wobbly-bridge',
  title: 'The Wobbly Bridge',
  goal: "Get Milo's picnic wagon across the stream, then drive to the finish flags.",
  variants: [
    { id: 'bridge', how: 'Put the bridge across the stream; Milo pulls the wagon over it.' },
    { id: 'ramp', how: 'Put the ramp (or the bouncy pad) before the stream; the truck and the wagon hop over to the far bank.' },
  ],
  help: HELP,
  length: 4500,
  startX: 260,
  segments: [
    flat(0, 1900, G),
    // a small practice gap, with a wide landing
    flat(2050, 3000, G),
    // the stream (3000–3260) needs a bridge, a ramp or a bouncy pad
    flat(3260, 4500, G),
    // higher route for spring wheels (too high for chunky wheels; nobody needs it)
    flat(1460, 1820, G - 290, 'platform'),
    // a stump to hop onto for the golden acorn (any wheels)
    flat(2380, 2560, G - 190, 'wood'),
  ],
  walls: [{ id: 'log-1', x: 1150, w: 70, top: G - 72 }],
  checkpoints: [
    { id: 'cp-start', x: 260 },
    { id: 'cp-log', x: 980 },
    { id: 'cp-gap', x: 1640 },
    { id: 'cp-milo', x: 2300 },
    { id: 'cp-across', x: 3420 },
  ],
  coins: [
    { id: 'm1-c1', x: 600, y: G - 90 },
    { id: 'm1-c2', x: 700, y: G - 90 },
    { id: 'm1-c3', x: 800, y: G - 90 },
    { id: 'm1-c4', x: 1190, y: G - 210 },
    { id: 'm1-c5', x: 1270, y: G - 240 },
    { id: 'm1-c6', x: 1350, y: G - 210 },
    { id: 'm1-c7', x: 1560, y: G - 370 },
    { id: 'm1-c8', x: 1660, y: G - 370 },
    { id: 'm1-c9', x: 1760, y: G - 370 },
    { id: 'm1-c10', x: 1975, y: G - 230 },
    { id: 'm1-c11', x: 3520, y: G - 90 },
    { id: 'm1-c12', x: 3620, y: G - 90 },
    { id: 'm1-c13', x: 3720, y: G - 90 },
  ],
  discovery: { id: 'golden-acorn', x: 2470, y: G - 250 },
  zones: [
    {
      id: 'stream',
      stopX: 2690,
      exitX: 3440,
      focusX: 3000,
      sockets: [
        { id: 'span', x: 3130, y: G - 10, fits: { bridge: flat(3000, 3260, G, 'bridge') } },
        {
          id: 'launch',
          x: 2920,
          y: G - 40,
          fits: {
            ramp: slope(2820, G, 3000, G - 80, 'ramp', { launch: RAMP }),
            pad: flat(2945, 3000, G - 2, 'pad', { bounce: PAD }),
          },
        },
      ],
      tray: ['bridge', 'ramp', 'pad'],
      example: [{ socket: 'span', piece: 'bridge' }],
    },
  ],
  beats: [
    { kind: 'teachJump', x: 900, wallId: 'log-1' },
    { kind: 'encounter', id: 'milo-gap', x: 2560 },
    { kind: 'build', zone: 'stream' },
    { kind: 'finish', x: 4080 },
  ],
  crew: { milo: { x: 2880 } },
  reward: 'pennant',
  upperRoute: { x0: 1460, x1: 1820, y: G - 290 },
};

// ------------------------------------------------------------------ Mission 2

const share: MissionDef = {
  id: 'ramp-we-share',
  title: 'The Ramp We Share',
  goal: 'Pip wants the practice ramp too: share it or make a second path, then drive to the finish.',
  variants: [
    { id: 'turns', how: 'Take turns: the truck jumps the pond on the ramp first, then Pip has a quick go while the drive continues.' },
    { id: 'path', how: 'Make another path: build a second way over the pond in front; the truck and Pip cross side by side.' },
  ],
  help: HELP,
  length: 4300,
  startX: 260,
  segments: [
    flat(0, 1500, G),
    // the practice ramp over the pond (back lane: the one Pip wants)
    slope(1300, G, 1500, G - 110, 'ramp', { launch: 1000, lane: 'back', id: 'practice-ramp' }),
    // pond 1500–1700
    flat(1700, 4300, G),
    // a branch to hop onto for the pinwheel (any wheels)
    flat(2360, 2660, G - 190, 'wood'),
    // higher route for spring wheels
    flat(2760, 3140, G - 300, 'platform'),
  ],
  walls: [],
  checkpoints: [
    { id: 'cp-start', x: 260 },
    { id: 'cp-pip', x: 950 },
    { id: 'cp-pond', x: 1900 },
    { id: 'cp-branch', x: 2250 },
    { id: 'cp-end', x: 3300 },
  ],
  coins: [
    { id: 'm2-c1', x: 560, y: G - 90 },
    { id: 'm2-c2', x: 660, y: G - 90 },
    { id: 'm2-c3', x: 760, y: G - 90 },
    { id: 'm2-c4', x: 1600, y: G - 330 },
    { id: 'm2-c5', x: 2000, y: G - 90 },
    { id: 'm2-c6', x: 2100, y: G - 90 },
    { id: 'm2-c7', x: 2860, y: G - 380 },
    { id: 'm2-c8', x: 2960, y: G - 380 },
    { id: 'm2-c9', x: 3060, y: G - 380 },
    { id: 'm2-c10', x: 3450, y: G - 90 },
    { id: 'm2-c11', x: 3550, y: G - 90 },
  ],
  discovery: { id: 'pinwheel', x: 2560, y: G - 250 },
  zones: [
    {
      // "make another path": a second route over the pond, in front of the practice ramp
      id: 'second-lane',
      stopX: 1080,
      exitX: 1880,
      focusX: 1500,
      sockets: [
        { id: 'front-span', x: 1600, y: G + 20, fits: { bridge: flat(1480, 1720, G, 'bridge', { lane: 'front' }) } },
        {
          id: 'front-launch',
          x: 1420,
          y: G - 20,
          fits: {
            ramp: slope(1320, G, 1500, G - 80, 'ramp', { launch: RAMP, lane: 'front' }),
            pad: flat(1440, 1500, G - 2, 'pad', { bounce: PAD, lane: 'front' }),
          },
        },
      ],
      tray: ['bridge', 'ramp', 'pad'],
      example: [{ socket: 'front-span', piece: 'bridge' }],
      lane: 'front',
    },
  ],
  beats: [
    { kind: 'encounter', id: 'pip-ramp', x: 1000 },
    { kind: 'finish', x: 3900 },
  ],
  crew: { pip: { x: 1180 } },
  reward: 'twin-ramp',
  upperRoute: { x0: 2760, x1: 3140, y: G - 300 },
};

// ------------------------------------------------------------------ Mission 3

const LEDGE = G - 150;

const rally: MissionDef = {
  id: 'everyone-rally',
  title: 'The Everyone Rally',
  goal: 'Put up the route sign, drive the gentle or the jumpy route, build the way up the last step, and meet everyone at the rally finish.',
  variants: [
    { id: 'gentle', how: 'The low gentle path with Nori (no jumps needed).' },
    { id: 'jump', how: 'The high jump path with Pip (a hop and a bouncy pad), rejoining before the last build.' },
  ],
  help: HELP,
  length: 4700,
  startX: 260,
  segments: [
    flat(0, 1500, G),
    // gentle route: soft little hills (shared ground, so a missed jump up high just lands here)
    slope(1500, G, 1750, G - 40),
    slope(1750, G - 40, 2000, G),
    flat(2000, 2300, G),
    slope(2300, G, 2550, G - 40),
    slope(2550, G - 40, 2800, G),
    flat(2800, 3000, G),
    // jump route (back lane only): up a ramp, along a high path with a bouncy pad, back down
    slope(1500, G, 1700, G - 160, 'wood', { lane: 'back' }),
    flat(1700, 2050, G - 160, 'wood', { lane: 'back' }),
    flat(2200, 2420, G - 160, 'wood', { lane: 'back' }),
    flat(2420, 2480, G - 162, 'pad', { lane: 'back', bounce: PAD }),
    flat(2700, 2850, G - 160, 'wood', { lane: 'back' }),
    slope(2850, G - 160, 3000, G, 'wood', { lane: 'back' }),
    // back together
    flat(3000, 3400, G),
    // the last build: a gap (3400–3640) and a high ledge
    flat(3640, 4700, LEDGE),
    // the rally ribbon sits on a stump (any wheels, either route)
    flat(3100, 3260, G - 190, 'wood'),
  ],
  walls: [{ id: 'ledge', x: 3640, w: 1060, top: LEDGE }],
  checkpoints: [
    { id: 'cp-start', x: 260 },
    { id: 'cp-nori', x: 1000 },
    { id: 'cp-fork', x: 1400 },
    { id: 'cp-join', x: 3060 },
    { id: 'cp-top', x: 3900 },
  ],
  coins: [
    { id: 'm3-c1', x: 560, y: G - 90 },
    { id: 'm3-c2', x: 660, y: G - 90 },
    { id: 'm3-c3', x: 1800, y: G - 250 },
    { id: 'm3-c4', x: 1900, y: G - 250 },
    { id: 'm3-c5', x: 2125, y: G - 330 },
    { id: 'm3-c6', x: 2580, y: G - 480 },
    { id: 'm3-c7', x: 1850, y: G - 120 },
    { id: 'm3-c8', x: 2400, y: G - 130 },
    { id: 'm3-c9', x: 2650, y: G - 130 },
    { id: 'm3-c10', x: 4100, y: LEDGE - 90 },
  ],
  discovery: { id: 'rally-ribbon', x: 3180, y: G - 250 },
  zones: [
    {
      id: 'ledge',
      stopX: 3250,
      exitX: 3960,
      focusX: 3560,
      sockets: [
        { id: 'span', x: 3500, y: G - 10, fits: { bridge: flat(3400, 3640, G, 'bridge') } },
        {
          id: 'climb',
          x: 3560,
          y: G - 80,
          fits: {
            ramp: slope(3490, G, 3640, LEDGE, 'ramp', { clears: 'ledge' }),
            // the pad sits early enough that the truck bounces before its nose reaches the ledge
            pad: flat(3460, 3520, G - 2, 'pad', { bounce: PAD }),
          },
        },
      ],
      tray: ['bridge', 'ramp', 'pad'],
      example: [
        { socket: 'span', piece: 'bridge' },
        { socket: 'climb', piece: 'ramp' },
      ],
    },
  ],
  beats: [
    { kind: 'encounter', id: 'nori-fork', x: 1000 },
    { kind: 'build', zone: 'ledge' },
    { kind: 'finish', x: 4350 },
  ],
  crew: { nori: { x: 1180 }, pip: { x: 1060 }, milo: { x: 940 } },
  reward: 'crew-banner',
};

export const MISSIONS: MissionDef[] = [wobbly, share, rally];
export const MISSION_ORDER: MissionId[] = MISSIONS.map((m) => m.id);

export function missionById(id: string): MissionDef | undefined {
  return MISSIONS.find((m) => m.id === id);
}

export const REWARD_OF: Record<MissionId, RewardId> = {
  'wobbly-bridge': 'pennant',
  'ramp-we-share': 'twin-ramp',
  'everyone-rally': 'crew-banner',
};
