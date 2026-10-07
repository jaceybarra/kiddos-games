import type { CastId } from '../../art/cast';
import type { PresetId } from '../../save/schema';
import type { Deco, Filling, Fruit, Shape, Wish, WishAttr } from './food';

/**
 * The three authored picnics. Wishes are written per picnic, never derived
 * from a character's species or look: the same friend wants different things
 * on different days, and tells you (and shows you in a bubble).
 */

export type ScenarioId = 'windy' | 'music' | 'lantern';
export const SCENARIO_ORDER: ScenarioId[] = ['windy', 'music', 'lantern'];
export type SeatPref = 'quiet' | 'music';
export type Station = 'dough' | 'stack' | 'juice' | 'decorate';
export const STATIONS: Station[] = ['dough', 'stack', 'juice', 'decorate'];

export interface GuestDef {
  id: CastId;
  wish: Wish;
  seat?: SeatPref;
  /** details they don't mind about ("anything soft is lovely") */
  flexible?: WishAttr[];
  /** asked "can you try it?", will they? (both answers are fine) */
  willTry: boolean;
}

export interface SeatSpot {
  x: number;
  y: number;
  /** 0 = quiet (far from the drum), 2 = right by the music */
  loud: 0 | 1 | 2;
}

export interface ScenarioDef {
  id: ScenarioId;
  name: string;
  host: CastId;
  /** who steps in if a second player stops (never one of the guests) */
  helper: CastId;
  sky: 'day' | 'dusk';
  setup: 'weights' | 'seats' | 'lanterns';
  guests: Record<PresetId, GuestDef[]>;
  cutters: Record<PresetId, Shape[]>;
  fillings: Record<PresetId, Filling[]>;
  fruits: Record<PresetId, Fruit[]>;
  decos: Record<PresetId, Deco[]>;
  card: string;
}

const ALL_SHAPES: Shape[] = ['round', 'star', 'leaf', 'moon', 'lantern'];
const ALL_FILLINGS: Filling[] = ['cheese', 'cucumber', 'jam', 'lettuce', 'tomato'];
const ALL_FRUITS: Fruit[] = ['berry', 'sunfruit', 'apple', 'plum'];
const ALL_DECOS: Deco[] = ['sprinkles', 'dots', 'leaves', 'swirl'];

/** Guest seats along the back of the blanket (windy and lantern picnics). */
export const DEFAULT_SEATS: SeatSpot[] = [
  { x: 1290, y: 800, loud: 1 },
  { x: 1520, y: 800, loud: 1 },
  { x: 1750, y: 800, loud: 1 },
];

/** Music picnic: cushions at different distances from Fizz's drum (on the right). */
export const MUSIC_SEATS: SeatSpot[] = [
  { x: 1180, y: 790, loud: 0 },
  { x: 1400, y: 820, loud: 1 },
  { x: 1600, y: 800, loud: 2 },
  { x: 1300, y: 960, loud: 1 },
];
export const DRUM_X = 1800;

export const SCENARIOS: Record<ScenarioId, ScenarioDef> = {
  windy: {
    id: 'windy',
    name: 'Windy Picnic',
    host: 'pip',
    helper: 'luma',
    sky: 'day',
    setup: 'weights',
    guests: {
      'more-help': [
        { id: 'pip', wish: { kind: 'cookie', shape: 'star' }, willTry: true },
        { id: 'rowan', wish: { kind: 'sandwich', size: 'big' }, willTry: true },
      ],
      'more-exploring': [
        { id: 'pip', wish: { kind: 'cookie', shape: 'star', texture: 'crunchy' }, willTry: true },
        { id: 'rowan', wish: { kind: 'sandwich', size: 'big', filling: 'cucumber' }, willTry: true },
        { id: 'moss', wish: { kind: 'juice', size: 'small', flavor: 'apple' }, flexible: ['size'], willTry: false },
      ],
    },
    cutters: { 'more-help': ['round', 'star', 'leaf'], 'more-exploring': ALL_SHAPES },
    fillings: { 'more-help': ['cheese', 'cucumber', 'jam'], 'more-exploring': ALL_FILLINGS },
    fruits: { 'more-help': ['berry', 'sunfruit', 'apple'], 'more-exploring': ALL_FRUITS },
    decos: { 'more-help': ['sprinkles', 'dots'], 'more-exploring': ALL_DECOS },
    card: 'pc.card.windy',
  },
  music: {
    id: 'music',
    name: 'Music Picnic',
    host: 'fizz',
    helper: 'moss',
    sky: 'day',
    setup: 'seats',
    guests: {
      'more-help': [
        { id: 'luma', wish: { kind: 'cookie', texture: 'soft' }, seat: 'quiet', willTry: false },
        { id: 'rowan', wish: { kind: 'juice', flavor: 'berry' }, seat: 'music', willTry: true },
      ],
      'more-exploring': [
        { id: 'luma', wish: { kind: 'cookie', texture: 'soft', shape: 'moon' }, seat: 'quiet', willTry: false },
        { id: 'rowan', wish: { kind: 'juice', size: 'big', flavor: 'berry' }, seat: 'music', willTry: true },
        { id: 'pip', wish: { kind: 'sandwich', size: 'small', filling: 'cheese' }, flexible: ['size'], willTry: true },
      ],
    },
    cutters: { 'more-help': ['round', 'moon', 'star'], 'more-exploring': ALL_SHAPES },
    fillings: { 'more-help': ['cheese', 'tomato', 'lettuce'], 'more-exploring': ALL_FILLINGS },
    fruits: { 'more-help': ['berry', 'sunfruit', 'plum'], 'more-exploring': ALL_FRUITS },
    decos: { 'more-help': ['sprinkles', 'leaves'], 'more-exploring': ALL_DECOS },
    card: 'pc.card.music',
  },
  lantern: {
    id: 'lantern',
    name: 'Lantern Picnic',
    host: 'luma',
    helper: 'rowan',
    sky: 'dusk',
    setup: 'lanterns',
    guests: {
      'more-help': [
        { id: 'luma', wish: { kind: 'cookie', shape: 'lantern' }, willTry: false },
        { id: 'fizz', wish: { kind: 'cookie', shape: 'lantern' }, willTry: true },
      ],
      'more-exploring': [
        { id: 'luma', wish: { kind: 'cookie', shape: 'lantern', texture: 'soft' }, willTry: false },
        { id: 'fizz', wish: { kind: 'cookie', shape: 'lantern', deco: 'sprinkles' }, willTry: true },
        { id: 'pip', wish: { kind: 'juice', flavor: 'plum' }, willTry: true },
      ],
    },
    cutters: { 'more-help': ['lantern', 'star', 'moon'], 'more-exploring': ALL_SHAPES },
    fillings: { 'more-help': ['cheese', 'jam', 'cucumber'], 'more-exploring': ALL_FILLINGS },
    fruits: { 'more-help': ['plum', 'berry', 'sunfruit'], 'more-exploring': ALL_FRUITS },
    decos: { 'more-help': ['sprinkles', 'dots'], 'more-exploring': ALL_DECOS },
    card: 'pc.card.lantern',
  },
};

/** Moss can be invited to the lantern picnic; Moss says "not yet" first and may join later. */
export const LANTERN_LATE_GUEST: GuestDef = { id: 'moss', wish: { kind: 'cookie', texture: 'soft' }, flexible: ['texture', 'shape', 'size', 'deco'], willTry: true };

export function seatsFor(id: ScenarioId): SeatSpot[] {
  return id === 'music' ? MUSIC_SEATS : DEFAULT_SEATS;
}

// ------------------------------------------------------------------ windy picnic: blanket corners and windbreaks

export type WeightId = 'stone' | 'teapot' | 'book' | 'pumpkin' | 'feather' | 'cup' | 'leaf';
export const WEIGHTS: Record<WeightId, { heavy: boolean }> = {
  stone: { heavy: true },
  teapot: { heavy: true },
  book: { heavy: true },
  pumpkin: { heavy: true },
  feather: { heavy: false },
  cup: { heavy: false },
  leaf: { heavy: false },
};
export const WEIGHT_CHOICES: Record<PresetId, WeightId[]> = {
  'more-help': ['stone', 'feather', 'teapot'],
  'more-exploring': ['stone', 'feather', 'teapot', 'cup', 'book', 'leaf', 'pumpkin'],
};
/** Which blanket corners flap in the wind (the others are held by the basket and the cooler). */
export const LOOSE_CORNERS: Record<PresetId, number[]> = { 'more-help': [0, 1], 'more-exploring': [0, 1, 2, 3] };
export const CORNERS: { x: number; y: number }[] = [
  { x: 1140, y: 728 },
  { x: 1860, y: 728 },
  { x: 1112, y: 1022 },
  { x: 1888, y: 1022 },
];

export type WindbreakId = 'umbrella' | 'cushions' | 'moss';
export const WINDBREAKS: Record<PresetId, WindbreakId[]> = {
  'more-help': ['umbrella', 'cushions'],
  'more-exploring': ['umbrella', 'cushions', 'moss'],
};

// ------------------------------------------------------------------ lantern picnic: two friends, one cutter

export type CutterOption = 'turns' | 'together' | 'swap' | 'mine';
export const CUTTER_OPTIONS: Record<PresetId, CutterOption[]> = {
  'more-help': ['turns', 'together'],
  'more-exploring': ['turns', 'together', 'swap', 'mine'],
};
/** Shapes Fizz is happy to switch to (Fizz says "not that one" to the others). */
export const FIZZ_OK_SHAPES: Shape[] = ['star', 'moon'];

// ------------------------------------------------------------------ music picnic: loud and quiet

export type DrumOption = 'softer' | 'move' | 'askLuma';
export const DRUM_OPTIONS: Record<PresetId, DrumOption[]> = {
  'more-help': ['softer', 'move'],
  'more-exploring': ['softer', 'move', 'askLuma'],
};

// ------------------------------------------------------------------ the bumped tray (a mix-up to repair)

export type MixupOption = 'remake' | 'fine' | 'cross';
export const MIXUP_OPTIONS: Record<PresetId, MixupOption[]> = {
  'more-help': ['remake', 'fine'],
  'more-exploring': ['remake', 'fine', 'cross'],
};
