import type Phaser from 'phaser';
import type { PieceKind, Socket } from '../core/build';
import type { Segment } from '../core/terrain';
import type { TrackPiece } from '../core/track';
import { TUNING } from '../config/tuning';
import { P, hex } from '../art/palette';

/**
 * Build pieces are drawn from their real segment geometry, so what the child
 * sees is exactly what the truck drives on: the driving surface of every
 * piece is the line from (x0, y0) to (x1, y1).
 *
 * Also exports the small Graphics helpers (round-joined strokes, dashed
 * outlines, colour mixing) that WorldView and CrewView reuse.
 */
export type PieceStyle = 'solid' | 'ghost';

export type Pt = { x: number; y: number };
type G = Phaser.GameObjects.Graphics;

const GROUND: number = TUNING.world.groundY;
export const INK = hex(P.ink);
const WHITE = 0xffffff;

// ------------------------------------------------------------------ colour + primitive helpers

/** Linear mix of two 0xRRGGBB colours (t = 0 → a, 1 → b). */
export function mix(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 255;
  const ag = (a >> 8) & 255;
  const ab = a & 255;
  const br = (b >> 16) & 255;
  const bg = (b >> 8) & 255;
  const bb = b & 255;
  const r = Math.round(ar + (br - ar) * t);
  const gg = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return (r << 16) | (gg << 8) | bl;
}

/** Fill a polygon (concave is fine). */
export function fillPoly(g: G, pts: Pt[], color: number, alpha = 1): void {
  if (pts.length < 3) return;
  g.fillStyle(color, alpha);
  g.beginPath();
  g.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) g.lineTo(pts[i].x, pts[i].y);
  g.closePath();
  g.fillPath();
}

/**
 * Stroke a polyline with round joins and caps (Phaser joins thick lines with
 * bevels; opaque strokes get a dot at each joint so outlines read like the SVG art).
 */
export function strokePoly(g: G, pts: Pt[], width: number, color: number, alpha = 1, closed = false): void {
  if (pts.length < 2 || width <= 0) return;
  g.lineStyle(width, color, alpha);
  g.beginPath();
  g.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) g.lineTo(pts[i].x, pts[i].y);
  if (closed) g.closePath();
  g.strokePath();
  if (alpha >= 0.99 && width >= 3) {
    g.fillStyle(color, alpha);
    const r = width / 2;
    for (let i = 0; i < pts.length; i++) {
      if (!closed && (i === 0 || i === pts.length - 1)) {
        g.fillCircle(pts[i].x, pts[i].y, r);
        continue;
      }
      g.fillCircle(pts[i].x, pts[i].y, r);
    }
  }
}

/** A single round-capped line. */
export function strokeLine(g: G, x0: number, y0: number, x1: number, y1: number, width: number, color: number, alpha = 1): void {
  strokePoly(g, [{ x: x0, y: y0 }, { x: x1, y: y1 }], width, color, alpha);
}

/** Points along a quadratic curve. */
export function quadPts(a: Pt, c: Pt, b: Pt, n = 12): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const u = 1 - t;
    out.push({ x: u * u * a.x + 2 * u * t * c.x + t * t * b.x, y: u * u * a.y + 2 * u * t * c.y + t * t * b.y });
  }
  return out;
}

/** A dashed outline along a polyline (dash pattern runs continuously around corners). */
export function dashPoly(g: G, pts: Pt[], closed: boolean, width: number, color: number, alpha: number, dash = 18, gap = 12): void {
  const path = closed ? [...pts, pts[0]] : pts;
  let on = true;
  let left = dash;
  let cur: Pt[] = [{ ...path[0] }];
  const flush = () => {
    if (cur.length >= 2) strokePoly(g, cur, width, color, alpha);
  };
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i];
    const b = path[i + 1];
    let segLen = Math.hypot(b.x - a.x, b.y - a.y);
    let px = a.x;
    let py = a.y;
    const ux = segLen > 0 ? (b.x - a.x) / segLen : 0;
    const uy = segLen > 0 ? (b.y - a.y) / segLen : 0;
    while (segLen > 0) {
      const step = Math.min(left, segLen);
      px += ux * step;
      py += uy * step;
      segLen -= step;
      left -= step;
      if (on) cur.push({ x: px, y: py });
      if (left <= 1e-6) {
        if (on) flush();
        on = !on;
        left = on ? dash : gap;
        cur = [{ x: px, y: py }];
      }
    }
  }
  if (on) flush();
}

// ------------------------------------------------------------------ drawing context (world or icon scale)

/** Where and how to draw: a point transform (icons are scaled), stroke scale and the ghost look. */
interface Ctx {
  g: G;
  ox: number;
  oy: number;
  s: number;
  /** stroke width multiplier */
  k: number;
  ghost: boolean;
  /** simplify small details (icons) */
  icon: boolean;
}

function worldCtx(g: G, style: PieceStyle): Ctx {
  return { g, ox: 0, oy: 0, s: 1, k: 1, ghost: style === 'ghost', icon: false };
}

const T = (c: Ctx, p: Pt): Pt => ({ x: c.ox + p.x * c.s, y: c.oy + p.y * c.s });
type Color = number | string;
const num = (color: Color): number => (typeof color === 'string' ? hex(color) : color);
const col = (c: Ctx, color: Color) => (c.ghost ? mix(num(color), WHITE, 0.35) : num(color));
const fa = (c: Ctx) => (c.ghost ? 0.5 : 1);
const inkCol = (c: Ctx) => (c.ghost ? mix(INK, WHITE, 0.45) : INK);
const inkA = (c: Ctx) => (c.ghost ? 0.8 : 1);

function cFill(c: Ctx, pts: Pt[], color: Color, alpha = 1): void {
  fillPoly(c.g, pts.map((p) => T(c, p)), col(c, color), alpha * fa(c));
}
function cInk(c: Ctx, pts: Pt[], w: number, closed = true): void {
  strokePoly(c.g, pts.map((p) => T(c, p)), w * c.k, inkCol(c), inkA(c), closed);
}
function cLine(c: Ctx, pts: Pt[], w: number, color: Color, alpha = 1, closed = false): void {
  strokePoly(c.g, pts.map((p) => T(c, p)), w * c.k, col(c, color), alpha * (c.ghost ? 0.6 : 1), closed);
}
function cCircle(c: Ctx, x: number, y: number, r: number, color: Color, inkW = 0): void {
  const p = T(c, { x, y });
  c.g.fillStyle(col(c, color), fa(c));
  c.g.fillCircle(p.x, p.y, r * c.s);
  if (inkW) {
    c.g.lineStyle(inkW * c.k, inkCol(c), inkA(c));
    c.g.strokeCircle(p.x, p.y, r * c.s);
  }
}

const lerpY = (seg: { x0: number; x1: number; y0: number; y1: number }, x: number) =>
  seg.x1 === seg.x0 ? seg.y0 : seg.y0 + ((seg.y1 - seg.y0) * (x - seg.x0)) / (seg.x1 - seg.x0);

// ------------------------------------------------------------------ the pieces

const DECK = 22;
const POST_UP = 74;
const POST_DOWN = 46;

function bridgeGeom(seg: Segment) {
  const L = seg.x1 - seg.x0;
  const pa = { x: seg.x0 + 8, y: seg.y0 };
  const pb = { x: seg.x1 - 8, y: seg.y1 };
  const sag = Math.min(34, L * 0.09);
  const ra = { x: pa.x, y: lerpY(seg, pa.x) - POST_UP + 8 };
  const rb = { x: pb.x, y: lerpY(seg, pb.x) - POST_UP + 8 };
  const rc = { x: (ra.x + rb.x) / 2, y: (ra.y + rb.y) / 2 + sag * 2 };
  return {
    deck: [
      { x: seg.x0, y: seg.y0 },
      { x: seg.x1, y: seg.y1 },
      { x: seg.x1, y: seg.y1 + DECK },
      { x: seg.x0, y: seg.y0 + DECK },
    ],
    posts: [pa, pb].map((p) => {
      const top = lerpY(seg, p.x) - POST_UP;
      const bot = lerpY(seg, p.x) + POST_DOWN;
      return [
        { x: p.x - 8, y: top },
        { x: p.x + 8, y: top },
        { x: p.x + 8, y: bot },
        { x: p.x - 8, y: bot },
      ];
    }),
    rope: quadPts(ra, rc, rb, 16),
  };
}

function drawBridge(c: Ctx, seg: Segment): void {
  const geo = bridgeGeom(seg);
  const L = seg.x1 - seg.x0;
  // posts (behind the deck)
  for (const post of geo.posts) {
    cFill(c, post, P.woodDark);
    cFill(c, [post[0], { x: post[0].x + 5, y: post[0].y }, { x: post[3].x + 5, y: post[3].y }, post[3]], P.wood, 0.7);
    cInk(c, post, 5);
    const top = { x: (post[0].x + post[1].x) / 2, y: post[0].y };
    cCircle(c, top.x, top.y - 2, 10, P.wood, 4);
  }
  // hangers from the rope rail down to the deck
  if (!c.icon) {
    const hangers = Math.max(1, Math.floor(L / 52));
    for (let i = 1; i < hangers; i++) {
      const idx = Math.round((i / hangers) * (geo.rope.length - 1));
      const rp = geo.rope[idx];
      cLine(c, [rp, { x: rp.x, y: lerpY(seg, rp.x) }], 3, P.cardDark);
    }
  }
  // rope rail: ink then a lighter rope colour, sagging between the post tops
  cLine(c, geo.rope, 8, INK);
  cLine(c, geo.rope, 4, hex(P.card));
  // the deck: dark gaps behind lighter plank ends
  cFill(c, geo.deck, P.woodDark);
  const n = Math.max(3, Math.round(L / (c.icon ? 40 : 34)));
  const w = L / n;
  const gapW = c.icon ? 7 : 5;
  for (let i = 0; i < n; i++) {
    const a = seg.x0 + i * w + (i === 0 ? 0 : gapW / 2);
    const b = seg.x0 + (i + 1) * w - (i === n - 1 ? 0 : gapW / 2);
    const ya = lerpY(seg, a);
    const yb = lerpY(seg, b);
    cFill(c, [{ x: a, y: ya }, { x: b, y: yb }, { x: b, y: yb + DECK }, { x: a, y: ya + DECK }], P.woodLight);
    // light from the upper left: a highlight along the top, shade low right
    cFill(c, [{ x: a, y: ya }, { x: b, y: yb }, { x: b, y: yb + 5 }, { x: a, y: ya + 5 }], WHITE, 0.35);
    cFill(c, [{ x: a, y: ya + DECK - 6 }, { x: b, y: yb + DECK - 6 }, { x: b, y: yb + DECK }, { x: a, y: ya + DECK }], hex(P.woodDark), 0.35);
    if (!c.icon) {
      const mx = (a + b) / 2;
      cCircle(c, mx, lerpY(seg, mx) + DECK / 2 + 1, 2.4, P.woodDark);
    }
  }
  cInk(c, geo.deck, 5);
}

function rampGeom(seg: Segment) {
  const base = Math.max(seg.y0, seg.y1);
  const pts: Pt[] = [{ x: seg.x0, y: seg.y0 }, { x: seg.x1, y: seg.y1 }];
  if (seg.y1 < base) pts.push({ x: seg.x1, y: base });
  if (seg.y0 < base) pts.push({ x: seg.x0, y: base });
  return { base, pts };
}

function drawRamp(c: Ctx, seg: Segment): void {
  const { base, pts } = rampGeom(seg);
  const L = seg.x1 - seg.x0;
  const highX = seg.y1 <= seg.y0 ? seg.x1 : seg.x0;
  const dir = highX === seg.x1 ? -1 : 1; // from the high end toward the low end
  // side face
  cFill(c, pts, P.wood);
  // wood grain on the side face (about 40%)
  if (!c.icon) {
    for (let i = 1; i <= 3; i++) {
      const yy = base - i * 18;
      const xs: number[] = [];
      for (let x = seg.x0; x <= seg.x1; x += 6) if (lerpY(seg, x) < yy - 6) xs.push(x);
      if (xs.length > 4) {
        const a = xs[0] + 10;
        const b = xs[xs.length - 1] - 10;
        if (b - a > 20) cLine(c, [{ x: a, y: yy }, { x: (a + b) / 2, y: yy - 3 }, { x: b, y: yy }], 2.5, hex(P.woodDark), 0.45);
      }
    }
  }
  // support brace: a post under the high end and a diagonal back toward the low end
  const hTop = lerpY(seg, highX);
  const tall = base - hTop;
  if (tall > 30) {
    const px = highX + dir * 12;
    const post = [
      { x: px - 7, y: lerpY(seg, px) + 12 },
      { x: px + 7, y: lerpY(seg, px + 7) + 12 },
      { x: px + 7, y: base - 2 },
      { x: px - 7, y: base - 2 },
    ];
    cFill(c, post, P.woodDark);
    cInk(c, post, 3);
    const bx = highX + dir * L * 0.55;
    const by = lerpY(seg, bx);
    if (base - by > 34) {
      cLine(c, [{ x: px, y: base - 8 }, { x: bx, y: by + 16 }], 12, INK);
      cLine(c, [{ x: px, y: base - 8 }, { x: bx, y: by + 16 }], 6, hex(P.woodDark));
    }
  }
  // the top deck: a lighter band of slats along the driving surface
  const band = 14;
  const top: Pt[] = [];
  const bot: Pt[] = [];
  const steps = Math.max(2, Math.ceil(L / 20));
  for (let i = 0; i <= steps; i++) {
    const x = seg.x0 + (L * i) / steps;
    const y = lerpY(seg, x);
    top.push({ x, y });
    bot.push({ x, y: Math.min(base, y + band) });
  }
  cFill(c, [...top, ...bot.reverse()], P.woodLight);
  cFill(c, [top[0], top[top.length - 1], { x: top[top.length - 1].x, y: top[top.length - 1].y + 4 }, { x: top[0].x, y: top[0].y + 4 }], WHITE, 0.4);
  const slat = c.icon ? 44 : 30;
  for (let x = seg.x0 + slat; x < seg.x1 - 6; x += slat) {
    const y = lerpY(seg, x);
    const yb = Math.min(base, y + band);
    if (yb - y > 4) cLine(c, [{ x, y: y + 1 }, { x, y: yb - 1 }], 2.5, hex(P.woodDark), 0.8);
  }
  // shade along the base (light from the upper left)
  const shade: Pt[] = [];
  for (let i = 0; i <= steps; i++) {
    const x = seg.x0 + (L * i) / steps;
    const y = lerpY(seg, x);
    if (base - y > 12) shade.push({ x, y: base - 8 });
  }
  if (shade.length >= 2) cFill(c, [...shade, { x: shade[shade.length - 1].x, y: base }, { x: shade[0].x, y: base }], hex(P.woodDark), 0.3);
  cInk(c, pts, 5);
  // a chevron at the lip pointing the way the truck goes (right)
  if (tall > 46) {
    const cx = highX + dir * 34;
    const cy = lerpY(seg, cx) + band + 16;
    if (base - cy > 10) {
      const s = 11;
      const chev = [
        { x: cx - s, y: cy - s },
        { x: cx - s * 0.2, y: cy - s },
        { x: cx + s * 0.8, y: cy },
        { x: cx - s * 0.2, y: cy + s },
        { x: cx - s, y: cy + s },
        { x: cx, y: cy },
      ];
      cFill(c, chev, P.yellow);
      cInk(c, chev, 3);
    }
  }
}

const CUSHION = 24;

function padGeom(seg: Segment, groundY: number) {
  const low = Math.max(seg.y0, seg.y1);
  const sunk = groundY - low < 44;
  const r = Math.min(8, (seg.x1 - seg.x0) / 5);
  const H = sunk ? 20 : CUSHION;
  const ya = seg.y0;
  const yb = seg.y1;
  const cushion: Pt[] = [
    { x: seg.x0 + r, y: lerpY(seg, seg.x0 + r) },
    { x: seg.x1 - r, y: lerpY(seg, seg.x1 - r) },
    { x: seg.x1, y: yb + r },
    { x: seg.x1, y: yb + H - r },
    { x: seg.x1 - r, y: yb + H },
    { x: seg.x0 + r, y: ya + H },
    { x: seg.x0, y: ya + H - r },
    { x: seg.x0, y: ya + r },
  ];
  const coilTop = low + H;
  const coilBot = sunk ? low + 50 : groundY - 9;
  const w = seg.x1 - seg.x0;
  const plate: Pt[] = [
    { x: seg.x0 + 2, y: coilBot },
    { x: seg.x1 - 2, y: coilBot },
    { x: seg.x1 - 2, y: coilBot + 8 },
    { x: seg.x0 + 2, y: coilBot + 8 },
  ];
  const pit: Pt[] | null = sunk
    ? [
        { x: seg.x0 - 6, y: low + 2 },
        { x: seg.x1 + 6, y: low + 2 },
        { x: seg.x1 + 6, y: low + 60 },
        { x: seg.x0 - 6, y: low + 60 },
      ]
    : null;
  return { cushion, coilTop, coilBot, plate, pit, w, H, low, sunk };
}

function coilPts(cx: number, top: number, bot: number, half: number): Pt[] {
  const turns = Math.max(4, Math.round((bot - top) / 14));
  const pts: Pt[] = [{ x: cx, y: bot }];
  for (let i = 1; i < turns; i++) pts.push({ x: cx + (i % 2 ? -half : half), y: bot - ((bot - top) * i) / turns });
  pts.push({ x: cx, y: top });
  return pts;
}

function drawPad(c: Ctx, seg: Segment, groundY: number): void {
  const geo = padGeom(seg, groundY);
  if (geo.pit) {
    cFill(c, geo.pit, P.soilDark);
    cFill(c, [geo.pit[0], geo.pit[1], { x: geo.pit[1].x, y: geo.pit[1].y + 10 }, { x: geo.pit[0].x, y: geo.pit[0].y + 10 }], INK, 0.25);
    cInk(c, geo.pit, 4);
  }
  // springs (one per ~70 units) on a base plate
  const nCoils = Math.max(1, Math.round(geo.w / 70));
  const half = Math.min(16, geo.w / (nCoils * 2) - 4);
  for (let i = 0; i < nCoils; i++) {
    const cx = seg.x0 + (geo.w * (i + 0.5)) / nCoils;
    const pts = coilPts(cx, geo.coilTop - 2, geo.coilBot + 2, Math.max(6, half));
    cLine(c, pts, 10, INK);
    cLine(c, pts, 5, hex(P.metal));
  }
  cFill(c, geo.plate, P.metalDark);
  cInk(c, geo.plate, 4);
  // the striped cushion
  cFill(c, geo.cushion, P.red);
  const stripeW = 7;
  const r = Math.min(8, geo.w / 5);
  for (let x = seg.x0 + r + 4; x + stripeW < seg.x1 - r; x += 18) {
    const ya = lerpY(seg, x) + 4;
    const yb = lerpY(seg, x + stripeW) + 4;
    cFill(c, [{ x, y: ya }, { x: x + stripeW, y: yb }, { x: x + stripeW, y: yb + geo.H - 8 }, { x, y: ya + geo.H - 8 }], hex(P.cream), 0.95);
  }
  cFill(c, [geo.cushion[0], geo.cushion[1], { x: geo.cushion[1].x, y: geo.cushion[1].y + 5 }, { x: geo.cushion[0].x, y: geo.cushion[0].y + 5 }], WHITE, 0.4);
  cFill(c, [geo.cushion[5], geo.cushion[4], { x: geo.cushion[4].x, y: geo.cushion[4].y - 5 }, { x: geo.cushion[5].x, y: geo.cushion[5].y - 5 }], hex(P.redDark), 0.5);
  cInk(c, geo.cushion, 5);
}

export interface PieceOptions {
  /** the ground under the piece (pads stand on it); default the baseline G */
  groundY?: number;
}

/** Draw a placed (solid) or previewed (ghost, translucent) piece for this segment. */
export function drawPiece(g: Phaser.GameObjects.Graphics, kind: PieceKind, seg: Segment, style: PieceStyle, opts: PieceOptions = {}): void {
  const c = worldCtx(g, style);
  if (kind === 'bridge') drawBridge(c, seg);
  else if (kind === 'ramp') drawRamp(c, seg);
  else drawPad(c, seg, opts.groundY ?? GROUND);
}

/** The outline shapes of a piece on its segment (closed polygons, plus open lines such as the rope). */
export function pieceSilhouette(kind: PieceKind, seg: Segment, groundY = GROUND): { closed: Pt[][]; open: Pt[][] } {
  if (kind === 'bridge') {
    const geo = bridgeGeom(seg);
    return { closed: [geo.deck, ...geo.posts], open: [geo.rope] };
  }
  if (kind === 'ramp') return { closed: [rampGeom(seg).pts], open: [] };
  const geo = padGeom(seg, groundY);
  const cx0 = seg.x0 + 4;
  const cx1 = seg.x1 - 4;
  const column: Pt[] = [
    { x: cx0, y: geo.coilTop },
    { x: cx1, y: geo.coilTop },
    { x: cx1, y: geo.coilBot + 8 },
    { x: cx0, y: geo.coilBot + 8 },
  ];
  return { closed: [geo.cushion, column], open: [] };
}

/** Bounds of a piece's drawing (for culling and drop animations). */
export function pieceBounds(kind: PieceKind, seg: Segment, groundY = GROUND): { x0: number; x1: number; y0: number; y1: number } {
  const s = pieceSilhouette(kind, seg, groundY);
  let x0 = Infinity;
  let x1 = -Infinity;
  let y0 = Infinity;
  let y1 = -Infinity;
  for (const poly of [...s.closed, ...s.open])
    for (const p of poly) {
      x0 = Math.min(x0, p.x);
      x1 = Math.max(x1, p.x);
      y0 = Math.min(y0, p.y);
      y1 = Math.max(y1, p.y);
    }
  return { x0: x0 - 12, x1: x1 + 12, y0: y0 - 14, y1: y1 + 8 };
}

/**
 * Draw an empty socket: a dashed outline in the shape of what fits.
 * `show` = which piece shapes to outline (while dragging, only the dragged
 * kind); `emphasis`: idle (quiet), target (fits what you're holding: thicker,
 * the scene bobs it), hover (the piece would snap here now).
 */
export function drawSocket(g: Phaser.GameObjects.Graphics, socket: Socket, show: PieceKind[], emphasis: 'idle' | 'target' | 'hover'): void {
  const width = emphasis === 'idle' ? 4 : emphasis === 'target' ? 7 : 9;
  const alpha = emphasis === 'idle' ? 0.45 : 1;
  const fillA = emphasis === 'idle' ? 0 : emphasis === 'target' ? 0.32 : 0.55;
  const fillC = emphasis === 'hover' ? hex(P.cream) : WHITE;
  for (const kind of show) {
    const seg = socket.fits[kind];
    if (!seg) continue;
    const sil = pieceSilhouette(kind, seg);
    if (fillA > 0) for (const poly of sil.closed) fillPoly(g, poly, fillC, fillA);
    for (const poly of sil.closed) dashPoly(g, poly, true, width, INK, alpha);
    for (const line of sil.open) dashPoly(g, line, false, width, INK, alpha);
  }
}

// ------------------------------------------------------------------ icons

function fitCtx(g: G, bx0: number, by0: number, bx1: number, by1: number, cx: number, cy: number, w: number, h: number): Ctx {
  const bw = bx1 - bx0;
  const bh = by1 - by0;
  const s = Math.min((w * 0.86) / bw, (h * 0.86) / bh);
  const k = Math.max(0.45, Math.min(1, s * 1.7));
  return { g, s, k, ghost: false, icon: true, ox: cx - ((bx0 + bx1) / 2) * s, oy: cy - ((by0 + by1) / 2) * s };
}

/** A tray icon for a piece, centred at (cx, cy) inside w×h. */
export function drawTrayIcon(g: Phaser.GameObjects.Graphics, kind: PieceKind, cx: number, cy: number, w: number, h: number): void {
  if (kind === 'bridge') {
    const seg: Segment = { x0: -110, x1: 110, y0: 0, y1: 0, kind: 'bridge' };
    drawBridge(fitCtx(g, -120, -POST_UP - 12, 120, POST_DOWN + 3, cx, cy, w, h), seg);
  } else if (kind === 'ramp') {
    const seg: Segment = { x0: -100, x1: 100, y0: 0, y1: -110, kind: 'ramp' };
    drawRamp(fitCtx(g, -103, -113, 103, 3, cx, cy, w, h), seg);
  } else {
    const seg: Segment = { x0: -60, x1: 60, y0: 0, y1: 0, kind: 'pad' };
    drawPad(fitCtx(g, -66, -4, 66, 104, cx, cy, w, h), seg, 100);
  }
}

/** A My Tiny Track piece icon (log / ramp / pond, or empty ground), centred at (cx, cy) inside w×h. */
export function drawTrackIcon(g: Phaser.GameObjects.Graphics, piece: TrackPiece | null, cx: number, cy: number, w: number, h: number): void {
  // local frame: 200 × 140, ground surface at y = 0, grass from -100..100
  const c = fitCtx(g, -100, -96, 100, 44, cx, cy, w, h);
  const ground = (x0: number, x1: number) => {
    cFill(c, [{ x: x0, y: 0 }, { x: x1, y: 0 }, { x: x1, y: 40 }, { x: x0, y: 40 }], P.soil);
    cFill(c, [{ x: x0, y: 0 }, { x: x1, y: 0 }, { x: x1, y: 14 }, { x: x0, y: 14 }], P.grass);
    cFill(c, [{ x: x0, y: 0 }, { x: x1, y: 0 }, { x: x1, y: 5 }, { x: x0, y: 5 }], P.grassLight);
    cInk(c, [{ x: x0, y: 0 }, { x: x1, y: 0 }, { x: x1, y: 40 }, { x: x0, y: 40 }], 5);
  };
  if (piece === 'pond') {
    ground(-100, -52);
    ground(52, 100);
    const pool = [
      { x: -52, y: 10 },
      { x: 52, y: 10 },
      { x: 52, y: 40 },
      { x: -52, y: 40 },
    ];
    cFill(c, pool, P.water);
    cLine(c, [{ x: -50, y: 10 }, { x: 50, y: 10 }], 5, hex(P.waterLight));
    cLine(c, [{ x: -30, y: 24 }, { x: -14, y: 21 }, { x: 2, y: 24 }], 3, hex(P.waterLight));
    cInk(c, pool, 5);
    // a lily pad with a notch, floating
    const lily: Pt[] = [];
    for (let i = 0; i <= 20; i++) {
      const a = 0.35 + (i / 20) * (Math.PI * 2 - 0.7);
      lily.push({ x: 14 + Math.cos(a) * 24, y: 8 + Math.sin(a) * 7 });
    }
    lily.push({ x: 14, y: 8 });
    cFill(c, lily, P.leaf);
    cInk(c, lily, 4);
    cCircle(c, -16, 4, 6, P.pink, 3);
    return;
  }
  ground(-100, 100);
  if (piece === 'log') {
    // a round log end
    cCircle(c, 0, -38, 38, P.wood, 6);
    cCircle(c, 0, -38, 26, P.woodLight, 0);
    const ring: Pt[] = [];
    for (let i = 0; i < 24; i++) ring.push({ x: Math.cos((i / 24) * Math.PI * 2) * 16, y: -38 + Math.sin((i / 24) * Math.PI * 2) * 16 });
    cLine(c, ring, 3, hex(P.woodDark), 0.7, true);
    cCircle(c, 0, -38, 5, P.woodDark);
    cFill(c, [{ x: 2, y: -76 }, { x: 14, y: -92 }, { x: 22, y: -80 }], P.leaf);
    cInk(c, [{ x: 2, y: -76 }, { x: 14, y: -92 }, { x: 22, y: -80 }], 3);
  } else if (piece === 'ramp') {
    drawRamp(c, { x0: -70, x1: 70, y0: 0, y1: -80, kind: 'ramp' });
  } else {
    // flat grass with a flower
    for (const x of [-64, -40, 44, 70]) cLine(c, [{ x: x - 5, y: 0 }, { x, y: -12 }, { x: x + 5, y: 0 }], 3, hex(P.grassDark));
    cLine(c, [{ x: 0, y: 0 }, { x: 0, y: -40 }], 4, hex(P.leafDark));
    cFill(c, [{ x: 0, y: -18 }, { x: 16, y: -30 }, { x: 18, y: -20 }], P.leaf);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
      cCircle(c, Math.cos(a) * 10, -48 + Math.sin(a) * 10, 8, P.yellow, 3);
    }
    cCircle(c, 0, -48, 7, P.orange, 3);
  }
}
