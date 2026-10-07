import type { BodySpec, Layout, Part, PartKind, SimEvent, Zone } from './sim';
import type { PresetId } from '../../save/schema';
import type { CastId } from '../../art/cast';

/**
 * Tinker Grove challenges. Each has a host with visible preferences, a goal
 * the child can reach in more than one way, and reference solutions that the
 * unit tests run through the simulation.
 */

export type ChallengeId = 'cloud-mail' | 'snail-express' | 'acorn-crossing' | 'music-machine' | 'free';

export const BOARD = { w: 1600, h: 800 };

const floor = (): Part[] => [0, 1, 2, 3, 4].map((i) => ({ id: `floor${i}`, kind: 'plank' as PartKind, x: 180 + i * 360, y: 790, rot: 0, fixed: true }));

export interface ChallengeOptions {
  /** Cloud Mail: whose mailbox the child chose */
  pad?: 'pip' | 'rowan' | 'fizz';
  /** Snail Express: Dot's speed limit (raised if the child negotiates) */
  speedLimit?: number;
  /** Snail Express: Fizz's hat zone active (removed if Fizz agrees to a small hat) */
  hatZone?: boolean;
  /** Music Machine: tune to play */
  tune?: number[];
  /** Free build: what to drop */
  drop?: BodySpec['kind'];
}

export type OutcomeStatus = 'success' | 'partial' | 'miss' | 'play';
export interface Outcome {
  status: OutcomeStatus;
  /** line id describing what happened (specific, not generic praise) */
  line: string;
  detail?: Record<string, number | string | boolean>;
}

export interface Challenge {
  id: ChallengeId;
  host: CastId;
  /** art key of the challenge card */
  card: string;
  fixed: Part[];
  bodies: (o: ChallengeOptions) => BodySpec[];
  zones: Zone[];
  palette: Record<PresetId, PartKind[]>;
  defaultOptions: (preset: PresetId) => ChallengeOptions;
  evaluate: (events: SimEvent[], parts: Part[], o: ChallengeOptions, preset: PresetId) => Outcome;
  /** known-good builds (tests run them) */
  references: { name: string; parts: Part[]; options?: ChallengeOptions }[];
}

export const HAT_ZONE = { x: 1240, y: 380, w: 340, h: 250 };
export const SNAIL_LIMIT = 450;
export const SNAIL_LIMIT_NEGOTIATED = 650;
export const GENTLE_PARCEL = 420;

function partsInRect(parts: Part[], r: { x: number; y: number; w: number; h: number }): Part[] {
  return parts.filter((p) => !p.fixed && p.x > r.x - 40 && p.x < r.x + r.w + 40 && p.y > r.y - 20 && p.y < r.y + r.h + 20);
}

export function dedupeNotes(events: SimEvent[]): number[] {
  const out: number[] = [];
  for (const e of events) if (e.type === 'chime' && out[out.length - 1] !== e.note) out.push(e.note);
  return out;
}

function isSubsequence(target: number[], seq: number[]): boolean {
  let i = 0;
  for (const n of seq) if (n === target[i]) i++;
  return i >= target.length;
}

const ROD = (id: string, kind: PartKind, x: number, y: number, rot = 0, extra: Partial<Part> = {}): Part => ({ id, kind, x, y, rot, ...extra });

export const CHALLENGES: Record<ChallengeId, Challenge> = {
  'cloud-mail': {
    id: 'cloud-mail',
    host: 'luma',
    card: 'tk.card.mail',
    fixed: [...floor()],
    bodies: () => [{ kind: 'parcel', x: 180, y: 120 }],
    zones: [
      { id: 'pip', kind: 'pad', x: 600, y: 730, w: 160, h: 60, label: 'pip' },
      { id: 'rowan', kind: 'pad', x: 1000, y: 730, w: 160, h: 60, label: 'rowan' },
      { id: 'fizz', kind: 'pad', x: 1360, y: 730, w: 160, h: 60, label: 'fizz' },
    ],
    palette: {
      'more-help': ['ramp', 'plank', 'fan', 'moss'],
      'more-exploring': ['ramp', 'plank', 'curve', 'fan', 'moss', 'bumper', 'spring', 'block'],
    },
    defaultOptions: () => ({ pad: 'pip' }),
    evaluate: (events, _parts, o): Outcome => {
      const goal = events.find((e) => e.type === 'goal');
      if (!goal || goal.type !== 'goal') return { status: 'miss', line: 'luma.mailMissed' };
      if (goal.zone !== o.pad) return { status: 'partial', line: 'luma.mailOther', detail: { to: goal.zone } };
      if (goal.speed > GENTLE_PARCEL) return { status: 'partial', line: 'luma.mailBumpy', detail: { speed: Math.round(goal.speed) } };
      return { status: 'success', line: 'luma.mailDelivered', detail: { to: goal.zone } };
    },
    references: [
      { name: 'fan blows it to Pip', parts: [ROD('f1', 'fan', 120, 420, 0)], options: { pad: 'pip' } },
      { name: 'ramp chain to Rowan', parts: [ROD('a', 'ramp', 280, 300, 20), ROD('b', 'ramp', 560, 420, 20), ROD('c', 'ramp', 840, 540, 20)], options: { pad: 'rowan' } },
    ],
  },
  'snail-express': {
    id: 'snail-express',
    host: 'moss',
    card: 'tk.card.snail',
    fixed: [...floor(), ROD('ledge', 'plank', 200, 260, 0, { fixed: true }), ROD('stand', 'block', 1470, 720, 0, { fixed: true })],
    bodies: () => [{ kind: 'snail', x: 120, y: 200, vx: 140 }],
    zones: [{ id: 'station', kind: 'goal', x: 1300, y: 640, w: 300, h: 140 }],
    palette: {
      'more-help': ['ramp', 'plank', 'moss'],
      'more-exploring': ['ramp', 'plank', 'curve', 'moss', 'block', 'bumper', 'wheel'],
    },
    defaultOptions: (preset) => ({ speedLimit: SNAIL_LIMIT, hatZone: preset === 'more-exploring' }),
    evaluate: (events, parts, o): Outcome => {
      const goal = events.find((e) => e.type === 'goal');
      const hatBumped = !!o.hatZone && partsInRect(parts, HAT_ZONE).length > 0;
      if (!goal || goal.type !== 'goal') return { status: 'miss', line: events.some((e) => e.type === 'lost') ? 'moss.snailLost' : 'moss.snailStopped' };
      const tooFast = goal.maxSpeed > (o.speedLimit ?? SNAIL_LIMIT);
      if (tooFast) return { status: 'partial', line: 'moss.snailTooFast', detail: { max: Math.round(goal.maxSpeed) } };
      if (hatBumped) return { status: 'partial', line: 'fizz.hatBumped' };
      return { status: 'success', line: 'moss.snailGentle', detail: { max: Math.round(goal.maxSpeed) } };
    },
    references: [
      { name: 'ramps with moss (gentle)', parts: [ROD('a', 'ramp', 480, 330, 15), ROD('b', 'moss', 720, 400, 15), ROD('c', 'ramp', 960, 470, 15), ROD('d', 'moss', 1200, 540, 15)] },
    ],
  },
  'acorn-crossing': {
    id: 'acorn-crossing',
    host: 'pip',
    card: 'tk.card.acorn',
    fixed: [
      ROD('lb1', 'plank', 180, 600, 0, { fixed: true }),
      ROD('lb2', 'plank', 340, 600, 0, { fixed: true }),
      ROD('rb1', 'plank', 1220, 600, 0, { fixed: true }),
      ROD('rb2', 'plank', 1420, 600, 0, { fixed: true }),
      ROD('start', 'ramp', 139, 541, 22, { fixed: true }),
    ],
    bodies: () => [{ kind: 'acorn', x: 40, y: 440 }],
    zones: [
      { id: 'water', kind: 'water', x: 520, y: 680, w: 520, h: 120 },
      { id: 'bank', kind: 'goal', x: 1100, y: 480, w: 500, h: 120 },
    ],
    palette: {
      'more-help': ['plank', 'spring', 'ramp'],
      'more-exploring': ['plank', 'ramp', 'spring', 'wheel', 'block', 'fan', 'bumper', 'curve'],
    },
    defaultOptions: () => ({}),
    evaluate: (events): Outcome => {
      if (events.some((e) => e.type === 'goal')) return { status: 'success', line: events.some((e) => e.type === 'spring') ? 'pip.acornBoing' : 'pip.acornAcross' };
      if (events.some((e) => e.type === 'splash')) return { status: 'miss', line: 'pip.acornSplash' };
      return { status: 'miss', line: 'pip.acornStopped' };
    },
    references: [
      { name: 'plank bridge', parts: [ROD('p1', 'plank', 700, 600, 0), ROD('p2', 'plank', 940, 600, 0)] },
      { name: 'spring bounce', parts: [ROD('s1', 'spring', 600, 650, 0)] },
      { name: 'spinning logs', parts: [ROD('w1', 'wheel', 600, 640, 0, { spin: 1 }), ROD('w2', 'wheel', 740, 640, 0, { spin: 1 }), ROD('w3', 'wheel', 880, 640, 0, { spin: 1 }), ROD('w4', 'wheel', 1020, 640, 0, { spin: 1 })] },
    ],
  },
  'music-machine': {
    id: 'music-machine',
    host: 'fizz',
    card: 'tk.card.music',
    fixed: [...floor()],
    bodies: () => [{ kind: 'berry', x: 800, y: 80 }],
    zones: [],
    palette: {
      'more-help': ['chime', 'ramp', 'bumper'],
      'more-exploring': ['chime', 'ramp', 'plank', 'bumper', 'spring', 'curve', 'block', 'wheel'],
    },
    defaultOptions: (preset) => ({ tune: preset === 'more-help' ? [] : [0, 2, 4] }),
    evaluate: (events, _parts, o, preset): Outcome => {
      const notes = dedupeNotes(events);
      const distinct = new Set(notes).size;
      if (preset === 'more-help' || !o.tune?.length) {
        if (distinct >= 3) return { status: 'success', line: 'fizz.songMade', detail: { notes: notes.length } };
        if (notes.length >= 1) return { status: 'partial', line: 'fizz.songMore', detail: { notes: notes.length } };
        return { status: 'miss', line: 'fizz.songQuiet' };
      }
      if (isSubsequence(o.tune, notes)) return { status: 'success', line: 'fizz.tunePlayed' };
      if (notes.length >= 1) return { status: 'partial', line: 'fizz.tuneAlmost', detail: { notes: notes.length } };
      return { status: 'miss', line: 'fizz.songQuiet' };
    },
    references: [
      {
        name: 'chime staircase',
        parts: [ROD('c0', 'chime', 800, 220, 20, { note: 0 }), ROD('c1', 'chime', 920, 380, -20, { note: 2 }), ROD('c2', 'chime', 780, 540, 20, { note: 4 })],
      },
    ],
  },
  free: {
    id: 'free',
    host: 'moss',
    card: 'tk.card.free',
    fixed: [...floor()],
    bodies: (o) => [{ kind: o.drop ?? 'acorn', x: 200, y: 100 }],
    zones: [],
    palette: {
      'more-help': ['ramp', 'plank', 'curve', 'bumper', 'spring', 'fan', 'moss', 'chime', 'wheel', 'basket', 'block', 'flag', 'flower', 'bell', 'ribbon'],
      'more-exploring': ['ramp', 'plank', 'curve', 'bumper', 'spring', 'fan', 'moss', 'chime', 'wheel', 'basket', 'block', 'flag', 'flower', 'bell', 'ribbon'],
    },
    defaultOptions: () => ({ drop: 'acorn' }),
    evaluate: (events): Outcome => {
      const notes = dedupeNotes(events).length;
      const bounces = events.filter((e) => e.type === 'bounce' || e.type === 'spring').length;
      return { status: 'play', line: notes ? 'moss.freeMusic' : bounces ? 'moss.freeBouncy' : 'moss.freeTry' };
    },
    references: [],
  },
};

export const CHALLENGE_ORDER: ChallengeId[] = ['cloud-mail', 'snail-express', 'acorn-crossing', 'music-machine'];

/** Build the full sim layout for a challenge + the child's parts. */
export function layoutFor(id: ChallengeId, childParts: Part[], o: ChallengeOptions): Layout {
  const c = CHALLENGES[id];
  return { parts: [...c.fixed, ...childParts], bodies: c.bodies(o), zones: c.zones, bounds: BOARD };
}

/** Discovery notes: real-world facts are marked separately from Wonderwood magic. */
export const NOTES = {
  slope: { kind: 'real', text: 'Real world: things roll faster down steeper slopes.' },
  moss: { kind: 'real', text: 'Real world: soft, bumpy surfaces slow rolling things down.' },
  parachute: { kind: 'real', text: 'Real world: a parachute catches air, so things fall slowly.' },
  bridge: { kind: 'real', text: 'Real world: a bridge needs support at both ends.' },
  spring: { kind: 'real', text: 'Real world: a squashed spring pushes back.' },
  fan: { kind: 'magic', text: 'Wonderwood magic: leaf fans blow all day without batteries!' },
  bumper: { kind: 'magic', text: 'Wonderwood magic: these mushrooms give back extra bounce.' },
  log: { kind: 'magic', text: 'Wonderwood magic: the spinning logs never get tired.' },
} as const;
export type NoteId = keyof typeof NOTES;
