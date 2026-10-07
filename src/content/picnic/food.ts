import type { PresetId } from '../../save/schema';

/**
 * Picnic Parade food model. Pure data and rules (no Phaser) so the
 * preparation mechanics can be tested and the clubhouse can redraw a saved
 * picnic from the same description.
 */

export type DishKind = 'cookie' | 'sandwich' | 'juice';
export const DISH_KINDS: DishKind[] = ['cookie', 'sandwich', 'juice'];

export const SHAPES = ['round', 'star', 'leaf', 'moon', 'lantern'] as const;
export type Shape = (typeof SHAPES)[number];
export type Texture = 'soft' | 'crunchy';
export const FILLINGS = ['cheese', 'cucumber', 'jam', 'lettuce', 'tomato'] as const;
export type Filling = (typeof FILLINGS)[number];
export const FRUITS = ['berry', 'sunfruit', 'apple', 'plum'] as const;
export type Fruit = (typeof FRUITS)[number];
export const DECOS = ['sprinkles', 'dots', 'leaves', 'swirl'] as const;
export type Deco = (typeof DECOS)[number];
export type Size = 'small' | 'big';

export interface Layer {
  f: Filling;
  /** sideways offset from the bread's centre where it landed */
  dx: number;
}

export interface Topping {
  d: Deco;
  /** position on the dish, in dish units (about −60..60) */
  x: number;
  y: number;
  /** colour index for sprinkles and dots */
  c?: number;
  /** swirl: flattened points [x0, y0, x1, y1, ...] */
  pts?: number[];
}

export interface Dish {
  id: string;
  kind: DishKind;
  shape?: Shape;
  texture?: Texture;
  layers?: Layer[];
  fruits?: Fruit[];
  cup?: Size;
  glugs?: number;
  deco: Topping[];
  /** a big two-person cookie, made by pressing a cutter together */
  share?: boolean;
  /** who was meant to get it (a turn label only; anyone can still have it) */
  forGuest?: string;
  /** got bumped and squashed a bit (still tasty) */
  squished?: boolean;
}

export type WishAttr = 'shape' | 'texture' | 'size' | 'filling' | 'flavor' | 'deco';
export const WISH_ATTRS: WishAttr[] = ['shape', 'texture', 'size', 'filling', 'flavor', 'deco'];

export interface Wish {
  kind: DishKind;
  shape?: Shape;
  texture?: Texture;
  size?: Size;
  filling?: Filling;
  flavor?: Fruit;
  deco?: Deco;
}

// ------------------------------------------------------------------ colours (shared with the art)

export const FRUIT_COLORS: Record<Fruit, string> = { berry: '#e0475f', sunfruit: '#f6a531', apple: '#8cc84b', plum: '#8e4fb0' };
export const SPRINKLE_COLORS = ['#e0475f', '#f2c84b', '#4f9fd6', '#7cb35a', '#c9b6e4', '#fffdf8'];

/** Juice colour: the fruits' colours mixed evenly (like paint, not like light). */
export function juiceColor(fruits: readonly Fruit[]): string {
  if (!fruits.length) return '#dff3f5';
  let r = 0;
  let g = 0;
  let b = 0;
  for (const f of fruits) {
    const c = FRUIT_COLORS[f];
    r += parseInt(c.slice(1, 3), 16);
    g += parseInt(c.slice(3, 5), 16);
    b += parseInt(c.slice(5, 7), 16);
  }
  const n = fruits.length;
  const to = (v: number) => Math.round(v / n).toString(16).padStart(2, '0');
  return `#${to(r)}${to(g)}${to(b)}`;
}

/** A mix that comes out a funny muddy colour (still tasty) gets its own reaction. */
export function isMuddy(fruits: readonly Fruit[]): boolean {
  const s = new Set(fruits);
  return (s.has('berry') && s.has('apple')) || (s.has('plum') && s.has('apple')) || s.size >= 4;
}

export function isRainbow(fruits: readonly Fruit[]): boolean {
  return new Set(fruits).size >= 3 && !isMuddy(fruits);
}

// ------------------------------------------------------------------ dish traits and wishes

export function dishSize(d: Dish): Size | undefined {
  if (d.kind === 'sandwich') return (d.layers?.length ?? 0) >= 3 ? 'big' : 'small';
  if (d.kind === 'juice') return d.cup;
  if (d.kind === 'cookie') return d.share ? 'big' : 'small';
  return undefined;
}

export interface WishMatch {
  kindOk: boolean;
  misses: WishAttr[];
}

/** Compare a dish with what a guest asked for. Unmentioned details never count against it. */
export function matchWish(d: Dish, w: Wish): WishMatch {
  if (d.kind !== w.kind) return { kindOk: false, misses: [] };
  const misses: WishAttr[] = [];
  if (w.shape && d.shape !== w.shape) misses.push('shape');
  if (w.texture && d.texture !== w.texture) misses.push('texture');
  if (w.size && dishSize(d) !== w.size) misses.push('size');
  if (w.filling && !(d.layers ?? []).some((l) => l.f === w.filling)) misses.push('filling');
  if (w.flavor && !(d.fruits ?? []).includes(w.flavor)) misses.push('flavor');
  if (w.deco && !d.deco.some((t) => t.d === w.deco)) misses.push('deco');
  return { kindOk: true, misses };
}

/** The picture a guest shows in their wish bubble: the dish they're hoping for. */
export function exampleDish(w: Wish, id = 'wish'): Dish {
  const d: Dish = { id, kind: w.kind, deco: [] };
  if (w.kind === 'cookie') {
    d.shape = w.shape ?? 'round';
    d.texture = w.texture ?? 'soft';
    if (w.size === 'big') d.share = true;
  } else if (w.kind === 'sandwich') {
    const f = w.filling ?? 'cheese';
    const n = w.size === 'big' ? 4 : w.size === 'small' ? 1 : 2;
    const others = FILLINGS.filter((x) => x !== f);
    d.layers = Array.from({ length: n }, (_, i) => ({ f: i === 0 ? f : others[(i - 1) % others.length], dx: 0 }));
  } else {
    d.fruits = [w.flavor ?? 'sunfruit'];
    d.cup = w.size ?? 'small';
    d.glugs = CUP_GLUGS[d.cup];
  }
  if (w.deco) d.deco = demoToppings(w.deco);
  return d;
}

function demoToppings(deco: Deco): Topping[] {
  if (deco === 'swirl') return [{ d: 'swirl', x: 0, y: 0, pts: [-34, 10, -18, -16, 0, 6, 18, -16, 34, 10] }];
  const spots: [number, number][] = [
    [-22, -18],
    [20, -14],
    [-6, 4],
    [24, 18],
    [-26, 20],
    [4, -30],
  ];
  return spots.map(([x, y], i) => ({ d: deco, x, y, c: i % SPRINKLE_COLORS.length }));
}

// ------------------------------------------------------------------ dough

/** Kneads before the dough is smooth enough to roll. */
export const KNEADS: Record<PresetId, number> = { 'more-help': 3, 'more-exploring': 5 };

// ------------------------------------------------------------------ sandwich stacking (a toy balance rule)

export const STACK = {
  /** more fillings than this and the next one slides off the top */
  maxLayers: 6,
  /** a layer landing this far from the one beneath slides off */
  slip: 58,
  /** when the layers' offsets add up past this, the stack leans and the new layer slides off */
  lean: 130,
  /** the furthest from centre a layer can be dropped */
  clamp: 90,
};

export type SlideReason = 'offset' | 'lean' | 'tall';

export interface DropResult {
  layers: Layer[];
  slid: Layer | null;
  reason?: SlideReason;
}

/**
 * Drop a filling onto the stack. More help always lands it in the middle;
 * More exploring lands it where the child tapped, so an off-centre stack can
 * lean and a layer slides off (and can be popped back on).
 */
export function dropLayer(layers: readonly Layer[], f: Filling, dx: number, preset: PresetId): DropResult {
  const x = preset === 'more-help' ? 0 : Math.max(-STACK.clamp, Math.min(STACK.clamp, Math.round(dx)));
  const layer: Layer = { f, dx: x };
  if (layers.length >= STACK.maxLayers) return { layers: [...layers], slid: layer, reason: 'tall' };
  const top = layers.length ? layers[layers.length - 1].dx : 0;
  if (Math.abs(x - top) > STACK.slip) return { layers: [...layers], slid: layer, reason: 'offset' };
  const sum = layers.reduce((s, l) => s + l.dx, 0) + x;
  if (Math.abs(sum) > STACK.lean) return { layers: [...layers], slid: layer, reason: 'lean' };
  return { layers: [...layers, layer], slid: null };
}

/** Popping a fallen layer back on puts it right on top of the one below, so it always stays (unless the stack is full). */
export function popBack(layers: readonly Layer[], f: Filling): DropResult {
  const top = layers.length ? layers[layers.length - 1].dx : 0;
  if (layers.length >= STACK.maxLayers) return { layers: [...layers], slid: { f, dx: top }, reason: 'tall' };
  return { layers: [...layers, { f, dx: top }], slid: null };
}

// ------------------------------------------------------------------ juice

export const CUP_GLUGS: Record<Size, number> = { small: 2, big: 4 };
export const MAX_FRUITS: Record<PresetId, number> = { 'more-help': 2, 'more-exploring': 3 };

/** One tap = one glug. A full cup overflows into the saucer (a little spill, nothing lost). */
export function pourGlug(glugs: number, cup: Size): { glugs: number; spilled: boolean } {
  const cap = CUP_GLUGS[cup];
  if (glugs >= cap) return { glugs: cap, spilled: true };
  return { glugs: glugs + 1, spilled: false };
}

export const MAX_TOPPINGS = 24;

// ------------------------------------------------------------------ validation (saved data is untrusted)

export function validDish(x: unknown): x is Dish {
  const d = x as Dish;
  if (!d || typeof d !== 'object' || typeof d.id !== 'string' || !DISH_KINDS.includes(d.kind) || !Array.isArray(d.deco)) return false;
  if (d.shape !== undefined && !SHAPES.includes(d.shape)) return false;
  if (d.texture !== undefined && d.texture !== 'soft' && d.texture !== 'crunchy') return false;
  if (d.layers !== undefined && (!Array.isArray(d.layers) || d.layers.length > STACK.maxLayers || !d.layers.every((l) => FILLINGS.includes(l?.f) && Number.isFinite(l.dx)))) return false;
  if (d.fruits !== undefined && (!Array.isArray(d.fruits) || d.fruits.length > 4 || !d.fruits.every((f) => FRUITS.includes(f)))) return false;
  if (d.cup !== undefined && d.cup !== 'small' && d.cup !== 'big') return false;
  if (d.glugs !== undefined && !(Number.isFinite(d.glugs) && d.glugs >= 0 && d.glugs <= 4)) return false;
  if (d.deco.length > MAX_TOPPINGS) return false;
  if (d.squished !== undefined && typeof d.squished !== 'boolean') return false;
  return d.deco.every((t) => !!t && DECOS.includes(t.d) && Number.isFinite(t.x) && Number.isFinite(t.y) && (t.pts === undefined || (Array.isArray(t.pts) && t.pts.length <= 80 && t.pts.every(Number.isFinite))));
}
