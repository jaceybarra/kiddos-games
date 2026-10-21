import type { WheelKind } from '../config/tuning';
import type { CrewId, DiscoveryId, MissionId, RewardId } from '../content/missions';
import type { Choice } from '../core/missionState';
import type { Slots, TrackPiece } from '../core/track';
import type { DecalId, PaintId, PatternId, TruckLook } from '../save/schema';
import { P, PAINTS } from './palette';
import { type ArtPiece, vgrad, blobPath } from './svg';
import { TRUCK_PIECES } from './truck';
import { CREW_PIECES, CREW_PROPS, type Pose } from './crew';
import { WORLD_PIECES } from './world';
import { GARAGE_PIECES, faceArt, starPath, glintPath } from './garage';

/**
 * Picture builders for the DOM layer: each returns a complete inline <svg>
 * string (scalable viewBox, no fixed width/height, aria-hidden, not
 * focusable). They reuse the in-game art pieces as plain data (no runtime
 * registry needed). Animated parts use the anim-* classes from ui/styles.css,
 * each on its own <g> (with no transform attribute of its own), so reduced
 * motion stops them. No text: meaning is carried by pictures, position,
 * shape and motion.
 */
export type ChoicePicture = 'turns' | 'path' | 'gentle' | 'jump';
export type GateShape = 'star' | 'moon' | 'heart' | 'triangle';

// ---------------------------------------------------------------- composition kit

const LIB = new Map<string, ArtPiece>([...TRUCK_PIECES, ...CREW_PIECES, ...CREW_PROPS, ...WORLD_PIECES, ...GARAGE_PIECES].map((p) => [p.key, p]));
const INK: string = P.ink;
const NS = 'http://www.w3.org/2000/svg';

let DEFS = new Map<string, string>();
let picCount = 0;

/** Suffix every id (and its references) so many pictures can share one page. */
function uniquify(markup: string): string {
  const ids = new Set<string>();
  for (const m of markup.matchAll(/\sid="([^"]+)"/g)) ids.add(m[1]);
  if (!ids.size) return markup;
  const suffix = `-wp${(picCount++).toString(36)}`;
  let out = markup;
  for (const id of ids) {
    const esc = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    out = out
      .replace(new RegExp(`id="${esc}"`, 'g'), `id="${id}${suffix}"`)
      .replace(new RegExp(`url\\(#${esc}\\)`, 'g'), `url(#${id}${suffix})`)
      .replace(new RegExp(`href="#${esc}"`, 'g'), `href="#${id}${suffix}"`);
  }
  return out;
}

/** Build one picture: the body may call use()/def() to pull in shared definitions. */
function pic(viewBox: string, build: () => string): string {
  const prev = DEFS;
  DEFS = new Map();
  const body = build();
  const defs = [...DEFS.values()].join('');
  DEFS = prev;
  return uniquify(`<svg xmlns="${NS}" viewBox="${viewBox}" aria-hidden="true" focusable="false">${defs ? `<defs>${defs}</defs>` : ''}${body}</svg>`);
}

function def(key: string, markup: string): void {
  DEFS.set(key, markup);
}

function art(key: string): ArtPiece {
  const p = LIB.get(key);
  if (!p) throw new Error(`Unknown art key: ${key}`);
  return p;
}

/** Place an art piece with its pivot at (x, y). */
function use(key: string, x: number, y: number, s = 1, flip = false, body?: string): string {
  const p = art(key);
  if (p.defs) def(`piece:${key}`, p.defs);
  return `<g transform="translate(${r1(x)} ${r1(y)}) scale(${flip ? -s : s} ${s})">${body ?? p.body}</g>`;
}

const r1 = (v: number) => (Math.round(v * 10) / 10).toString();
const at = (x: number, y: number, s: number, inner: string, extra = '') => `<g transform="translate(${r1(x)} ${r1(y)}) scale(${s})" ${extra}>${inner}</g>`;
/** An animated group: the class sits on its own <g>, positioned by the parent. */
const anim = (cls: string, inner: string) => `<g class="${cls}">${inner}</g>`;

const sw = (w: number) => `stroke="${INK}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"`;
const sh = (d: string, fill: string, w = 3, extra = '') => `<path d="${d}" fill="${fill}" ${w ? sw(w) : ''} ${extra}/>`;
const st = (d: string, w: number, color = INK, extra = '') => `<path d="${d}" fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" ${extra}/>`;
const rr = (x: number, y: number, w: number, h: number, r: number, fill: string, strokeW = 3, extra = '') =>
  `<rect x="${r1(x)}" y="${r1(y)}" width="${r1(w)}" height="${r1(h)}" rx="${r}" fill="${fill}" ${strokeW ? sw(strokeW) : ''} ${extra}/>`;
const ci = (cx: number, cy: number, r: number, fill: string, strokeW = 3, extra = '') => `<circle cx="${r1(cx)}" cy="${r1(cy)}" r="${r1(r)}" fill="${fill}" ${strokeW ? sw(strokeW) : ''} ${extra}/>`;
const el = (cx: number, cy: number, rx: number, ry: number, fill: string, strokeW = 0, extra = '') =>
  `<ellipse cx="${r1(cx)}" cy="${r1(cy)}" rx="${r1(rx)}" ry="${r1(ry)}" fill="${fill}" ${strokeW ? sw(strokeW) : ''} ${extra}/>`;

function hexRgb(h: string): [number, number, number] {
  const v = parseInt(h.slice(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}
function rgbHex([r, g, b]: [number, number, number]): string {
  return '#' + [r, g, b].map((c) => Math.max(0, Math.min(255, Math.round(c))).toString(16).padStart(2, '0')).join('');
}
function mix(a: string, b: string, t: number): string {
  const A = hexRgb(a);
  const B = hexRgb(b);
  return rgbHex([A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t]);
}
function paintHex(id: PaintId): string {
  return PAINTS.find((p) => p.id === id)?.hex ?? P.red;
}

/**
 * The truck body's neutral panels take the paint the way the game's tint does
 * (multiply), with the white highlight kept a little lighter.
 */
function tintBody(body: string, paint: string): string {
  const pc = hexRgb(paint);
  return body.replace(/(fill|stroke)="#([0-9a-fA-F]{6})"/g, (m, attr: string, hx: string) => {
    const [r, g, b] = hexRgb('#' + hx);
    if (!(r === g && g === b) || r < 0x90) return m;
    if (r === 255) return `${attr}="${mix(paint, '#ffffff', 0.4)}"`;
    return `${attr}="${rgbHex([pc[0] * (r / 255), pc[1] * (r / 255), pc[2] * (r / 255)])}"`;
  });
}

// ---------------------------------------------------------------- the truck

const WHEEL_X = [-82, 84];

/** The personalised truck with its wheels resting on (x, y). Full size is about 300 × 210. */
function truck(look: TruckLook, x: number, y: number, s: number): string {
  const r = look.wheel === 'spring' ? 54 : 60;
  const lift = look.wheel === 'spring' ? 40 : 16;
  const bodyY = -r - lift;
  const paint = paintHex(look.paint);
  let inner = use('truck.shadow', 0, 2, 1);
  for (const wx of WHEEL_X) inner += use(look.wheel === 'spring' ? 'wheel.spring' : 'wheel.chunky', wx, -r, 1);
  for (const wx of WHEEL_X) {
    inner +=
      look.wheel === 'spring'
        ? `<g transform="translate(${wx} ${-r}) scale(1 ${r1((lift + 6) / 54)})">${art('spring.coil').body}</g>`
        : `<g transform="translate(${wx} ${-r}) scale(1 0.6)">${art('chunky.strut').body}</g>`;
  }
  let bodyLayer = use('truck.body', 0, 0, 1, false, tintBody(art('truck.body').body, paint));
  if (look.pattern !== 'plain') bodyLayer += use(`truck.pat.${look.pattern}`, 0, 0, 1);
  bodyLayer += use('truck.trim', 0, 0, 1);
  if (look.decal !== 'none') bodyLayer += use(`decal.${look.decal}`, 41, -42, 0.62);
  inner += `<g transform="translate(0 ${bodyY})">${bodyLayer}</g>`;
  return at(x, y, s, inner);
}

const DEFAULT_LOOK: TruckLook = { paint: 'red', pattern: 'stripes', decal: 'bolt', wheel: 'chunky' };
/** the child's own truck, for the story pictures (set per call; the default is only a fallback) */
let LOOK: TruckLook = DEFAULT_LOOK;
function withLook<T>(look: TruckLook | undefined, fn: () => T): T {
  const prev = LOOK;
  LOOK = look ?? DEFAULT_LOOK;
  try {
    return fn();
  } finally {
    LOOK = prev;
  }
}

/** A crew member standing at (x, y), facing left (or right when flipped). */
const crew = (id: CrewId, pose: Pose, x: number, y: number, s: number, faceRight = false) => use(`crew.${id}.${pose}`, x, y, s, faceRight);

/** Pip driving her kart (her face peeks over the kart). Wheels rest on (x, y), facing right. */
function pipKart(x: number, y: number, s: number, flip = false): string {
  const inner = at(30, -66, 0.5, faceArt('pip')) + art('prop.kart').body;
  return `<g transform="translate(${r1(x)} ${r1(y)}) scale(${flip ? -s : s} ${s})">${inner}</g>`;
}

// ---------------------------------------------------------------- little scenery helpers (picture scale)

/** Sky (rounded), then anything that sits behind the ground (hills), then the ground band. */
function skyBg(w: number, h: number, ground: number, r = 18, night = false, behind = ''): string {
  def(night ? 'sky-night' : 'sky', night ? vgrad('pic-sky-night', '#3d4f8f', '#7b86c2') : vgrad('pic-sky', P.skyTop, P.skyLow));
  return rr(0, 0, w, h, r, `url(#${night ? 'pic-sky-night' : 'pic-sky'})`, 0) + behind + (ground < h ? groundBand(0, w, ground, h, r) : '');
}

function groundBand(x0: number, x1: number, y: number, bottom: number, r = 18): string {
  return (
    `<path d="M${x0} ${y} L${x1} ${y} L${x1} ${bottom - r} Q${x1} ${bottom} ${x1 - r} ${bottom} L${x0 + r} ${bottom} Q${x0} ${bottom} ${x0} ${bottom - r} Z" fill="${P.soil}"/>` +
    `<rect x="${x0}" y="${y}" width="${x1 - x0}" height="${Math.min(10, bottom - y)}" fill="${P.grass}"/>` +
    st(`M${x0} ${y} L${x1} ${y}`, 3)
  );
}

function hills(w: number, y: number, seed = 1): string {
  const a = 14 + (seed % 3) * 4;
  return sh(`M0 ${y} Q${w * 0.2} ${y - a} ${w * 0.42} ${y - a * 0.4} Q${w * 0.66} ${y + a * 0.2} ${w * 0.82} ${y - a * 0.8} Q${w * 0.92} ${y - a} ${w} ${y - a * 0.6} L${w} ${y + 40} L0 ${y + 40} Z`, P.hillFar, 0);
}

function cloud(x: number, y: number, s: number): string {
  return at(x, y, s, sh(blobPath([[-40, 10], [-30, -8], [-8, -18], [14, -14], [34, -4], [40, 10]]), '#ffffff', 0, 'opacity="0.95"'));
}

function water(x0: number, x1: number, y: number, depth: number): string {
  return (
    sh(`M${x0} ${y} L${x0} ${y + depth} L${x1} ${y + depth} L${x1} ${y} Z`, P.water, 0) +
    st(`M${x0 + 6} ${y + 6} Q${(x0 + x1) / 4 + x0 * 0.5} ${y + 2} ${(x0 + x1) / 2} ${y + 6} T${x1 - 6} ${y + 6}`, 2.5, P.waterLight) +
    st(`M${x0} ${y + 1} L${x1} ${y + 1}`, 2, '#ffffff', 'opacity="0.5"')
  );
}

/** A gap in the ground filled with water: banks drawn with the ink edge. */
function stream(w: number, h: number, gx0: number, gx1: number, ground: number): string {
  return (
    water(gx0, gx1, ground + 8, h - ground - 8) +
    `<path d="M0 ${ground} L${gx0} ${ground} L${gx0} ${h} L0 ${h} Z" fill="${P.soil}"/>` +
    `<path d="M${gx1} ${ground} L${w} ${ground} L${w} ${h} L${gx1} ${h} Z" fill="${P.soil}"/>` +
    rr(0, ground, gx0, 9, 0, P.grass, 0) +
    rr(gx1, ground, w - gx1, 9, 0, P.grass, 0) +
    st(`M0 ${ground} L${gx0} ${ground} L${gx0} ${h}`, 3) +
    st(`M${w} ${ground} L${gx1} ${ground} L${gx1} ${h}`, 3)
  );
}

/** A plank bridge spanning (x0..x1) at deck height y. */
function bridgeArt(x0: number, x1: number, y: number): string {
  const n = Math.max(3, Math.round((x1 - x0) / 14));
  let planks = '';
  for (let i = 0; i < n; i++) {
    const px = x0 + ((x1 - x0) * i) / n;
    planks += rr(px + 0.8, y - 4, (x1 - x0) / n - 1.6, 9, 2, i % 2 ? P.woodLight : P.wood, 2);
  }
  return (
    st(`M${x0 + 4} ${y - 20} Q${(x0 + x1) / 2} ${y - 10} ${x1 - 4} ${y - 20}`, 2.5, P.woodDark) +
    rr(x0 - 3, y - 26, 7, 30, 2, P.woodDark, 2.5) +
    rr(x1 - 4, y - 26, 7, 30, 2, P.woodDark, 2.5) +
    planks
  );
}

/** A wooden ramp rising to the right: base on y, high end at (x1, top). */
function rampArt(x0: number, x1: number, y: number, top: number, fill: string = P.orange, light = '#ffc27a', w = 3): string {
  const lip = 3;
  const cx = x0 + (x1 - x0) * 0.62;
  return (
    sh(`M${x0} ${y} L${x0} ${y - lip} Q${r1(cx)} ${y - lip} ${x1} ${top} L${x1} ${y} Z`, fill, w) +
    st(`M${x0 + 6} ${y - lip + 3} Q${r1(cx)} ${y - lip + 3} ${x1 - 3} ${top + 6}`, 2.5, light, 'opacity="0.85"') +
    rr(x1 - 4, top, 6, y - top, 2, P.woodDark, 2)
  );
}

/** A bouncy pad: a springy cushion with an up chevron. Centre-bottom at (x, y). */
function padArt(x: number, y: number, s = 1): string {
  return at(
    x,
    y,
    s,
    rr(-20, -6, 40, 6, 2, P.metalDark, 2.5) +
      st('M-10 -6 L-14 -10 L-6 -13 L-14 -16 L-10 -19 M10 -6 L14 -10 L6 -13 L14 -16 L10 -19', 2.5, INK) +
      sh('M-22 -19 Q-22 -27 -14 -27 L14 -27 Q22 -27 22 -19 L22 -17 L-22 -17 Z', P.pink, 2.5) +
      st('M-14 -23 L8 -23', 2, '#ffffff', 'opacity="0.7"') +
      sh('M-8 -33 L0 -41 L8 -33', 'none', 0) +
      st('M-8 -34 L0 -42 L8 -34', 3, INK),
  );
}

function logArt(x: number, y: number, s: number): string {
  return use('obj.log', x, y, s);
}

function sparkles(pts: [number, number, number][]): string {
  return pts.map(([x, y, r]) => sh(glintPath(x, y, r), P.yellow, 1.8)).join('');
}

function arrowCurve(d: string, head: [number, number, number], color: string = INK, dashed = false): string {
  const [hx, hy, ang] = head;
  const a = (ang * Math.PI) / 180;
  const p = (dx: number, dy: number) => `${r1(hx + dx * Math.cos(a) - dy * Math.sin(a))} ${r1(hy + dx * Math.sin(a) + dy * Math.cos(a))}`;
  return st(d, 4, color, dashed ? 'stroke-dasharray="7 7"' : '') + sh(`M${p(0, 0)} L${p(-12, -8)} L${p(-12, 8)} Z`, color, 2.5);
}

/** Order dots (one dot, two dots): who goes first, shown by count and position. */
function orderDots(x: number, y: number, count: number): string {
  let out = '';
  for (let i = 0; i < count; i++) out += ci(x + (i - (count - 1) / 2) * 13, y, 4.5, INK, 0);
  return rr(x - count * 6.5 - 6, y - 10, count * 13 + 12, 20, 7, '#ffffff', 2.5) + out;
}

/** A small route sign on a post: 'high' (up arc) or 'low' (wavy). Post bottom at (x, y). */
function routeSign(kind: 'high' | 'low', x: number, y: number, s: number): string {
  return use('obj.sign.post', x, y, s) + use(kind === 'high' ? 'obj.sign.high' : 'obj.sign.low', x, y - 150 * s, s);
}

function frame(w: number, h: number, inner: string): string {
  def(`frame-${w}x${h}`, `<clipPath id="pic-frame-${w}x${h}"><rect x="6" y="6" width="${w - 12}" height="${h - 12}" rx="14"/></clipPath>`);
  return (
    `<g clip-path="url(#pic-frame-${w}x${h})">${inner}</g>` +
    rr(5, 5, w - 10, h - 10, 15, 'none', 0, `stroke="${INK}" stroke-width="12"`) +
    rr(5, 5, w - 10, h - 10, 15, 'none', 0, `stroke="${P.wood}" stroke-width="6"`) +
    st(`M14 9 L${w * 0.45} 9`, 2, '#ffffff', 'opacity="0.45"')
  );
}

// ---------------------------------------------------------------- choice scenes (300 × 180)

const CW = 300;
const CH = 180;
const CG = 156;

function choiceTurns(): string {
  return (
    skyBg(CW, CH, CG, 18, false, hills(CW, CG - 6, 2)) +
    cloud(60, 32, 0.6) +
    // the one ramp
    rampArt(150, 214, CG, CG - 34) +
    // 1: the truck goes first (ahead, hopping off the ramp)
    at(258, CG - 24, 1, anim('anim-hop', truck(LOOK, 0, 0, 0.22))) +
    orderDots(258, 34, 1) +
    // 2: Pip waits her turn, then goes
    pipKart(70, CG, 0.42) +
    orderDots(70, 70, 2) +
    arrowCurve('M96 96 Q150 52 202 92', [206, 96, 45], INK, true)
  );
}

function speedLines(x: number, y: number): string {
  return st(`M${x} ${y} L${x + 22} ${y} M${x + 8} ${y + 9} L${x + 26} ${y + 9}`, 3, '#ffffff', 'opacity="0.9"');
}

function choicePath(): string {
  const back = CG - 40;
  return (
    skyBg(CW, CH, CG, 18, false, hills(CW, back - 18, 1)) +
    cloud(240, 30, 0.6) +
    // the back lane (Pip's ramp) and the new front lane ramp, side by side
    `<rect x="-4" y="${back}" width="${CW + 8}" height="${CG - back}" fill="${P.grassLight}"/>` +
    st(`M0 ${back} L${CW} ${back}`, 2.5, INK, 'opacity="0.55"') +
    rampArt(206, 262, back, back - 30, P.teal, '#8fe0d6') +
    rampArt(214, 274, CG, CG - 32) +
    // both go at the same time, each on its own path
    at(0, 0, 1, anim('anim-slide', speedLines(98, back - 26) + pipKart(160, back, 0.36) + speedLines(30, CG - 26) + truck(LOOK, 92, CG, 0.2)))
  );
}

function softHills(x0: number, x1: number, y: number, n: number, amp: number): string {
  let d = `M${x0} ${y}`;
  const w = (x1 - x0) / n;
  for (let i = 0; i < n; i++) d += ` Q${r1(x0 + w * (i + 0.5))} ${y - amp * 2} ${r1(x0 + w * (i + 1))} ${y}`;
  return d;
}

function choiceGentle(): string {
  return (
    skyBg(CW, CH, CH) +
    cloud(230, 34, 0.7) +
    hills(CW, 110, 3) +
    sh(softHills(-10, CW + 10, CG, 3, 10) + ` L${CW + 10} ${CH} L-10 ${CH} Z`, P.grass, 3) +
    st(softHills(-10, CW + 10, CG + 8, 3, 10), 3, P.grassLight, 'opacity="0.8"') +
    [40, 120, 220].map((x, i) => use('prop.flowers', x, CG + 14, 0.32 + (i % 2) * 0.06)).join('') +
    routeSign('low', 34, CG - 6, 0.34) +
    // Nori takes the gentle way, slowly
    at(150, CG - 2, 1, anim('anim-roll', crew('nori', 'idle', 0, 0, 0.42, true)))
  );
}

function choiceJump(): string {
  const hi = 82;
  return (
    skyBg(CW, CH, CG) +
    cloud(70, 28, 0.55) +
    // a high wooden path with a bouncy pad, reached by a ramp
    sh(`M40 ${CG} Q92 ${CG} 112 ${hi} L300 ${hi} L300 ${hi + 14} L126 ${hi + 14} L120 ${CG} Z`, P.wood, 3) +
    st(`M52 ${CG - 4} Q94 ${CG - 4} 114 ${hi + 6}`, 2.5, P.woodLight) +
    rr(160, hi + 14, 8, CG - hi - 14, 2, P.woodDark, 2.5) +
    rr(268, hi + 14, 8, CG - hi - 14, 2, P.woodDark, 2.5) +
    padArt(206, hi, 1.1) +
    st(`M140 ${hi - 40} Q206 ${hi - 130} 272 ${hi - 34}`, 3.5, INK, 'stroke-dasharray="6 8"') +
    use('prop.springpost', 286, hi, 0.26) +
    routeSign('high', 32, CG, 0.28) +
    // the truck bounces high
    at(146, hi, 1, anim('anim-hop', truck(LOOK, 0, 0, 0.2)))
  );
}

const CHOICE: Record<ChoicePicture, () => string> = { turns: choiceTurns, path: choicePath, gentle: choiceGentle, jump: choiceJump };

export function choicePicture(id: ChoicePicture, look?: TruckLook): string {
  return withLook(look, () => pic(`0 0 ${CW} ${CH}`, CHOICE[id]));
}

// ---------------------------------------------------------------- mission cards (240 × 160)

const MW = 240;
const MH = 160;
const MG = 122;

function cardWobbly(): string {
  return frame(
    MW,
    MH,
    skyBg(MW, MH, MH, 0, false, hills(MW, 96, 1)) +
      cloud(190, 30, 0.5) +
      stream(MW, MH, 126, 206, MG) +
      use('obj.oldbridge', 126, MG, 80 / 260) +
      use('prop.wagon', 38, MG, 0.34) +
      crew('milo', 'notice', 96, MG, 0.36, true),
  );
}

function cardShare(): string {
  return frame(
    MW,
    MH,
    skyBg(MW, MH, MH, 0, false, hills(MW, 96, 2)) +
      cloud(60, 28, 0.5) +
      stream(MW, MH, 150, 214, MG) +
      use('prop.lily', 182, MG + 14, 0.3) +
      rampArt(96, 150, MG, MG - 30) +
      pipKart(52, MG, 0.36) +
      sparkles([[176, 62, 7]]),
  );
}

function rallyBanner(x0: number, x1: number, y: number): string {
  const cols = [P.red, P.yellow, P.blue, P.teal, P.orange];
  const n = 9;
  let flags = '';
  for (let i = 0; i < n; i++) {
    const x = x0 + ((x1 - x0) * (i + 0.5)) / n;
    const t = (i + 0.5) / n;
    const yy = y + 16 * 4 * t * (1 - t);
    flags += sh(`M${r1(x - 9)} ${r1(yy)} L${r1(x + 9)} ${r1(yy)} L${r1(x)} ${r1(yy + 16)} Z`, cols[i % cols.length], 2);
  }
  return st(`M${x0} ${y} Q${(x0 + x1) / 2} ${y + 32} ${x1} ${y}`, 2.5, P.inkSoft) + flags;
}

function cardRally(): string {
  return frame(
    MW,
    MH,
    skyBg(MW, MH, MG, 0, false, hills(MW, MG - 8, 3)) +
      use('obj.flag.up', 22, MG, 0.42) +
      use('obj.flag.up', 206, MG, 0.42) +
      rallyBanner(24, 214, 30) +
      crew('milo', 'cheer', 66, MG, 0.34, true) +
      crew('pip', 'cheer', 120, MG, 0.34) +
      crew('nori', 'cheer', 176, MG, 0.34),
  );
}

const CARD: Record<MissionId, () => string> = { 'wobbly-bridge': cardWobbly, 'ramp-we-share': cardShare, 'everyone-rally': cardRally };

export function missionCardPicture(id: MissionId): string {
  return pic(`0 0 ${MW} ${MH}`, CARD[id]);
}

// ---------------------------------------------------------------- My Tiny Track

function checkFlag(x: number, y: number, s: number): string {
  let checks = '';
  for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) if ((r + c) % 2 === 0) checks += `<rect x="${3 + c * 7}" y="${-60 + r * 7}" width="7" height="7" fill="${INK}"/>`;
  return at(x, y, s, rr(-2.5, -64, 5, 64, 2, P.metal, 2.5) + rr(3, -60, 28, 21, 2, '#ffffff', 2.5) + checks + rr(3, -60, 28, 21, 2, 'none', 2.5) + ci(0, -66, 4, P.yellow, 2));
}

export function trackCardPicture(): string {
  return pic(`0 0 ${MW} ${MH}`, () =>
    frame(
      MW,
      MH,
      skyBg(MW, MH, MH, 0, false, hills(MW, 92, 2)) +
        cloud(70, 30, 0.45) +
        // a little wavy track: log, ramp, pond, finish
        sh(`M-4 ${MG} L84 ${MG} Q96 ${MG - 6} 104 ${MG} L132 ${MG} L132 ${MH} L-4 ${MH} Z`, P.soil, 0) +
        sh(`M190 ${MG} L250 ${MG} L250 ${MH} L190 ${MH} Z`, P.soil, 0) +
        water(132, 190, MG + 8, MH - MG) +
        rr(-4, MG, 136, 8, 0, P.grass, 0) +
        rr(190, MG, 60, 8, 0, P.grass, 0) +
        st(`M-4 ${MG} L84 ${MG} Q96 ${MG - 6} 104 ${MG} L132 ${MG} L132 ${MH}`, 3) +
        st(`M250 ${MG} L190 ${MG} L190 ${MH}`, 3) +
        logArt(38, MG, 0.32) +
        rampArt(98, 132, MG, MG - 22) +
        checkFlag(218, MG, 0.9),
    ),
  );
}

// ---------------------------------------------------------------- the Test Track (free driving)

export function playgroundCardPicture(look: TruckLook = DEFAULT_LOOK): string {
  return pic(`0 0 ${MW} ${MH}`, () =>
    frame(
      MW,
      MH,
      skyBg(MW, MH, MH, 0, false, hills(MW, 96, 3)) +
        cloud(200, 26, 0.45) +
        rr(-4, MG, MW + 8, MH - MG + 4, 0, P.soil, 0) +
        rr(-4, MG, MW + 8, 8, 0, P.grass, 0) +
        st(`M-4 ${MG} L${MW + 4} ${MG}`, 3) +
        // a boost strip, a kicker ramp, crates waiting on the far side
        rr(8, MG - 6, 44, 9, 3, P.blueDark, 2.5) +
        sh(`M14 ${MG - 4} L22 ${MG - 4} L28 ${MG - 1.5} L22 ${MG + 1} L14 ${MG + 1} L20 ${MG - 1.5} Z`, P.yellow, 1.5) +
        sh(`M32 ${MG - 4} L40 ${MG - 4} L46 ${MG - 1.5} L40 ${MG + 1} L32 ${MG + 1} L38 ${MG - 1.5} Z`, P.yellow, 1.5) +
        rampArt(56, 100, MG, MG - 26) +
        use('obj.crate', 186, MG, 0.36) +
        use('obj.crate', 218, MG, 0.36) +
        use('obj.crate', 202, MG - 32, 0.36) +
        // the truck flying, tipped back, with speed lines
        st('M70 54 L96 54 M64 70 L92 70 M74 86 L98 86', 4, '#ffffff', 'opacity="0.9"') +
        `<g transform="translate(140 92) rotate(-14)">${truck(look, 0, 0, 0.26)}</g>` +
        sparkles([[118, 30, 7], [176, 40, 5]]),
    ),
  );
}

// ---------------------------------------------------------------- recap panels (240 × 200)

const RW = 240;
const RH = 200;
const RG = 152;

type Summary = { placed: { socket: string; piece: string }[]; choice: Choice };

function recapProblem(m: MissionId | 'track'): string {
  if (m === 'wobbly-bridge')
    return (
      skyBg(RW, RH, RH, 0, false, hills(RW, 120, 1)) +
      stream(RW, RH, 120, 210, RG) +
      use('obj.oldbridge', 120, RG, 90 / 260) +
      use('prop.wagon', 36, RG, 0.38) +
      crew('milo', 'notice', 92, RG, 0.4, true)
    );
  if (m === 'ramp-we-share')
    return (
      skyBg(RW, RH, RH, 0, false, hills(RW, 120, 2)) +
      stream(RW, RH, 176, 240, RG) +
      rampArt(124, 176, RG, RG - 34) +
      truck(LOOK, 46, RG, 0.21) +
      pipKart(100, RG, 0.34) +
      // both would like the one ramp
      sh(glintPath(166, 84, 10), P.yellow, 2) +
      arrowCurve('M46 82 Q100 48 150 96', [154, 102, 60], INK, true) +
      arrowCurve('M100 92 Q128 70 146 100', [149, 106, 65], INK, true)
    );
  if (m === 'everyone-rally') {
    const hi = 84;
    return (
      skyBg(RW, RH, RH, 0) +
      cloud(200, 28, 0.45) +
      hills(RW, 130, 3) +
      // the fork: a high wooden path up and away, and a low wavy path below
      sh(`M104 ${RG} Q140 ${RG} 160 ${hi} L246 ${hi} L246 ${hi + 12} L168 ${hi + 12} L136 ${RG} Z`, P.wood, 3) +
      rr(222, hi + 12, 7, 60, 2, P.woodDark, 2.5) +
      sh(`M-4 ${RG} L96 ${RG} ` + softHills(96, 250, RG, 2, 7).replace(/^M[^Q]*/, '') + ` L250 ${RH} L-4 ${RH} Z`, P.grass, 3) +
      routeSign('low', 190, RG + 2, 0.24) +
      crew('milo', 'idle', 26, RG, 0.32, true) +
      crew('pip', 'idle', 60, RG, 0.32, true) +
      crew('nori', 'idle', 112, RG, 0.34, true) +
      arrowCurve(`M140 ${RG - 44} Q176 ${RG - 40} 182 ${RG - 6} Q186 ${RG + 18} 204 ${RG + 24}`, [210, RG + 26, 15], P.orange)
    );
  }
  // the track: an empty strip between a start post and a finish flag
  let slots = '';
  for (let i = 0; i < 6; i++) slots += rr(36 + i * 28, RG - 24, 24, 24, 5, '#ffffff', 2.5, 'stroke-dasharray="5 5" fill-opacity="0.55"');
  return skyBg(RW, RH, RG, 0, false, hills(RW, RG - 20, 3)) + rr(16, RG - 50, 8, 50, 3, P.red, 2.5) + slots + checkFlag(214, RG, 0.8);
}

function pieceTile(piece: string, cx: number, cy: number, size: number): string {
  const s = size / 80;
  const G = 14;
  const groundAll = `<path d="M-37 ${G} L37 ${G} L37 34 Q37 37 34 37 L-34 37 Q-37 37 -37 34 Z" fill="${P.soil}"/>` + rr(-37, G, 74, 4, 0, P.grass, 0) + st(`M-37 ${G} L37 ${G}`, 2.5);
  let inner = '';
  if (piece === 'bridge')
    inner =
      water(-24, 24, G + 4, 20) +
      `<path d="M-37 ${G} L-24 ${G} L-24 37 L-34 37 Q-37 37 -37 34 Z M37 ${G} L24 ${G} L24 37 L34 37 Q37 37 37 34 Z" fill="${P.soil}"/>` +
      st(`M-37 ${G} L-24 ${G} L-24 37 M37 ${G} L24 ${G} L24 37`, 2.5) +
      bridgeArt(-28, 28, G);
  else if (piece === 'ramp') inner = groundAll + rampArt(-30, 26, G, G - 40);
  else if (piece === 'pad') inner = groundAll + padArt(0, G, 1.15);
  else if (piece === 'log') inner = groundAll + logArt(-20, G, 0.5);
  else if (piece === 'pond')
    inner =
      water(-26, 26, G + 3, 20) +
      `<path d="M-37 ${G} L-26 ${G} L-26 37 L-34 37 Q-37 37 -37 34 Z M37 ${G} L26 ${G} L26 37 L34 37 Q37 37 37 34 Z" fill="${P.soil}"/>` +
      st(`M-37 ${G} L-26 ${G} L-26 37 M37 ${G} L26 ${G} L26 37`, 2.5) +
      use('prop.lily', 2, G + 6, 0.3);
  else inner = groundAll + sh(glintPath(0, -6, 20), P.yellow, 3);
  def('tile-clip', `<clipPath id="pic-tile-clip"><rect x="-37" y="-37" width="74" height="74" rx="14"/></clipPath>`);
  return at(cx, cy, s, rr(-38, -38, 76, 76, 15, P.skyLow, 0) + `<g clip-path="url(#pic-tile-clip)">${inner}</g>` + rr(-38, -38, 76, 76, 15, 'none', 3));
}

function recapDid(m: MissionId | 'track', s: Summary): string {
  const placed = s.placed.map((p) => p.piece);
  const base = skyBg(RW, RH, RH, 0) + cloud(200, 30, 0.45);
  if (placed.length) {
    const n = Math.min(placed.length, 3);
    const size = n === 1 ? 120 : n === 2 ? 96 : 70;
    const gap = (RW - n * size) / (n + 1);
    let tiles = '';
    const cy = s.choice === 'gentle' || s.choice === 'jump' ? 118 : 104;
    for (let i = 0; i < n; i++) tiles += at(gap + size / 2 + i * (size + gap), cy, 1, anim(`anim-pulse${i ? ` anim-delay-${Math.min(i, 2)}` : ''}`, pieceTile(placed[i], 0, 0, size)));
    const extra = s.choice === 'gentle' || s.choice === 'jump' ? routeSign(s.choice === 'gentle' ? 'low' : 'high', 44, 52, 0.2) : '';
    return base + tiles + extra;
  }
  if (s.choice === 'turns' || s.choice === 'path') {
    def('choice-clip', `<clipPath id="pic-choice-clip"><rect x="0" y="0" width="${CW}" height="${CH}" rx="18"/></clipPath>`);
    return base + at(18, 38, 0.68, `<g clip-path="url(#pic-choice-clip)">${s.choice === 'turns' ? choiceTurns() : choicePath()}</g>` + rr(0, 0, CW, CH, 18, 'none', 4));
  }
  if (s.choice === 'gentle' || s.choice === 'jump')
    return base + groundBand(0, RW, RG, RH, 0) + routeSign(s.choice === 'gentle' ? 'low' : 'high', RW / 2, RG, 0.62);
  if (m === 'track') return base + pieceTile('log', 50, 104, 64) + pieceTile('ramp', 120, 104, 64) + pieceTile('pond', 190, 104, 64);
  return base + groundBand(0, RW, RG, RH, 0) + truck(LOOK, RW / 2, RG, 0.4) + sparkles([[60, 60, 10], [190, 54, 8]]);
}

function recapResult(m: MissionId | 'track', s: Summary): string {
  if (m === 'wobbly-bridge') {
    // the wagon is across, by whatever the child built: bridge, or a hop off the ramp / bouncy pad
    const bridge = s.placed.some((p) => p.piece === 'bridge');
    const ramp = s.placed.some((p) => p.piece === 'ramp');
    const way = bridge
      ? bridgeArt(70, 160, RG + 2)
      : (ramp ? rampArt(26, 70, RG, RG - 26) : padArt(52, RG, 0.9)) + st(`M64 ${RG - 34} Q118 ${RG - 120} 186 ${RG - 26}`, 3.5, INK, 'stroke-dasharray="6 8"');
    return (
      skyBg(RW, RH, RH, 0, false, hills(RW, 120, 1)) +
      stream(RW, RH, 70, 160, RG) +
      way +
      use('prop.wagon', 198, RG, 0.34) +
      crew('milo', 'cheer', bridge ? 38 : 222, RG, 0.38, bridge) +
      sparkles([[30, 50, 9], [210, 46, 11], [150, 34, 7]])
    );
  }
  if (m === 'ramp-we-share')
    return (
      skyBg(RW, RH, RG, 18, false, hills(RW, 128, 2)) +
      checkFlag(214, RG, 0.9) +
      truck(LOOK, 70, RG, 0.26) +
      pipKart(158, RG, 0.38, true) +
      use('fx.heart', 116, 60, 0.5) +
      sparkles([[40, 44, 9], [196, 40, 10]])
    );
  if (m === 'everyone-rally') {
    const top = 118;
    return (
      skyBg(RW, RH, RH, 0, false, hills(RW, 150, 3)) +
      // low ground on the left, a ramp, and everyone together up on the ledge
      sh(`M-4 176 L24 176 L70 ${top} L244 ${top} L244 ${RH} L-4 ${RH} Z`, P.soil, 0) +
      sh(`M-4 176 L24 176 L70 ${top} L244 ${top} L244 ${top + 8} L72 ${top + 8} L28 184 L-4 184 Z`, P.grass, 0) +
      st(`M-4 176 L24 176 L70 ${top} L244 ${top}`, 3) +
      rallyBanner(20, 222, 22) +
      truck(LOOK, 96, top, 0.19) +
      crew('milo', 'cheer', 142, top, 0.25) +
      crew('pip', 'cheer', 172, top, 0.25) +
      crew('nori', 'cheer', 204, top, 0.25) +
      sparkles([[30, 70, 8], [124, 56, 6], [222, 64, 7]])
    );
  }
  return (
    skyBg(RW, RH, RG, 18, false, hills(RW, 128, 1)) +
    use('obj.finish', 150, RG, 0.27) +
    truck(LOOK, 150, RG, 0.26) +
    [[40, 40, 'a', 20], [70, 70, 'b', -30], [196, 36, 'c', 35], [214, 92, 'a', -15], [30, 104, 'c', 50]].map(([x, y, k, rot]) => `<g transform="translate(${x} ${y}) rotate(${rot}) scale(0.7)">${art(`fx.confetti.${k}`).body}</g>`).join('') +
    sparkles([[46, 130, 9], [206, 130, 9]])
  );
}

export function recapPanel(missionId: MissionId | 'track', index: 0 | 1 | 2, s: { placed: { socket: string; piece: string }[]; choice: Choice }, look?: TruckLook): string {
  return withLook(look, () => pic(`0 0 ${RW} ${RH}`, () => frame(RW, RH, index === 0 ? recapProblem(missionId) : index === 1 ? recapDid(missionId, s) : recapResult(missionId, s))));
}

// ---------------------------------------------------------------- rewards and discoveries

const REWARD_KEY: Record<RewardId, string> = { pennant: 'reward.pennant', 'twin-ramp': 'reward.twin-ramp', 'crew-banner': 'reward.crew-banner' };

function padded(p: ArtPiece, pad: number): string {
  const [x, y, w, h] = p.box;
  return `${x - pad} ${y - pad} ${w + pad * 2} ${h + pad * 2}`;
}

export function rewardPicture(id: RewardId): string {
  const p = art(REWARD_KEY[id]);
  return pic(padded(p, 12), () => use(p.key, 0, 0, 1));
}

export function discoveryPicture(id: DiscoveryId): string {
  if (id === 'pinwheel')
    return pic('-50 -54 100 150', () => use('obj.pinwheel.stick', 0, 0, 1) + at(0, 0, 1, anim('anim-spin', use('obj.pinwheel.head', 0, 0, 1))));
  const p = art(id === 'golden-acorn' ? 'obj.acorn' : 'obj.ribbon');
  return pic(padded(p, 6), () => at(0, 0, 1, anim('anim-bob', use(p.key, 0, 0, 1))));
}

// ---------------------------------------------------------------- rotate, rest

export function rotatePicture(): string {
  const turn =
    `<style>@keyframes wg-turn{0%,22%{transform:rotate(-90deg)}48%,88%{transform:rotate(0deg)}100%{transform:rotate(-90deg)}}` +
    `.anim-turn{animation:wg-turn 3.2s ease-in-out infinite;transform-box:fill-box;transform-origin:center}</style>`;
  const tablet = rr(-56, -36, 112, 72, 12, P.blue, 4) + rr(-46, -27, 92, 54, 5, P.waterLight, 0) + ci(50, 0, 3, P.blueDark, 0) + truckMini(0, 16, 0.12);
  return pic('0 0 200 160', () =>
    turn +
    // where it starts: tall (dashed ghost)
    rr(64, 24, 72, 112, 12, 'none', 0, `stroke="${INK}" stroke-width="3.5" stroke-dasharray="8 7" opacity="0.45"`) +
    // the turning tablet ends wide
    at(100, 84, 1, anim('anim-turn', tablet)) +
    arrowCurve('M40 52 Q46 14 92 12', [100, 12, 0], P.orange) +
    arrowCurve('M160 108 Q154 146 108 148', [100, 148, 180], P.orange),
  );
}

function truckMini(x: number, y: number, s: number): string {
  return truck({ paint: 'red', pattern: 'plain', decal: 'none', wheel: 'chunky' }, x, y, s);
}

export function restPicture(): string {
  return pic('0 0 240 160', () => {
    const stars = [
      [26, 26, 5],
      [70, 46, 3.5],
      [120, 20, 4],
      [150, 54, 3],
      [204, 70, 3.5],
      [96, 70, 3],
    ]
      .map(([x, y, r], i) => at(x, y, 1, anim(i % 2 ? 'anim-pulse anim-delay-2' : 'anim-pulse', sh(starPath(0, 0, r * 1.6), '#fff7c2', 1.5))))
      .join('');
    return (
      skyBg(240, 160, 160, 18, true) +
      stars +
      // a smiling crescent moon
      sh('M196 14 A26 26 0 1 0 222 52 A20 20 0 1 1 196 14 Z', '#fff1a8', 3) +
      st('M196 40 Q200 44 204 41', 2) +
      sh(`M-4 128 Q60 112 120 122 Q180 132 244 118 L244 164 L-4 164 Z`, '#4f7a5a', 0) +
      // the closed garage with a warm window glow
      sh('M64 136 L64 88 L120 60 L176 88 L176 136 Z', '#e9d3a6', 3) +
      st('M58 90 L120 58 L182 90', 9) +
      st('M58 90 L120 58 L182 90', 4.5, '#b8473c') +
      rr(84, 98, 72, 38, 2, '#c96b5d', 3) +
      st('M84 107 L156 107 M84 116 L156 116 M84 125 L156 125', 2) +
      ci(120, 80, 7, '#ffd97a', 2.5) +
      ci(120, 80, 13, '#ffd97a', 0, 'opacity="0.35"') +
      el(120, 137, 70, 3, INK, 0, 'opacity="0.25"') +
      sh(blobPath([[30, 138], [34, 124], [48, 118], [62, 126], [64, 138]]), '#3f6b4a', 2.5) +
      sh(blobPath([[178, 138], [182, 124], [196, 118], [210, 126], [212, 138]]), '#3f6b4a', 2.5) +
      rr(-4, 136, 248, 28, 0, '#3f6b4a', 0) +
      st('M-4 136 L244 136', 2.5)
    );
  });
}

// ---------------------------------------------------------------- wheels

export function wheelPreview(kind: WheelKind): string {
  return pic('0 0 160 120', () => {
    const g0 = 104;
    let s = skyBg(160, 120, g0, 14);
    if (kind === 'chunky') {
      s += sh(`M112 ${g0} Q124 ${g0 - 9} 136 ${g0} Z`, P.soil, 2.5);
      s += st(`M14 ${g0 - 46} L106 ${g0 - 46} Q124 ${g0 - 54} 142 ${g0 - 46} L150 ${g0 - 46}`, 2.5, '#ffffff', 'stroke-dasharray="4 6" opacity="0.9"');
      const wheel = anim('anim-spin', use('wheel.chunky', 0, 0, 0.36));
      s += at(64, g0 - 22, 1, anim('anim-roll', anim('anim-bob', wheel)));
    } else {
      s += st(`M14 ${g0 - 30} Q34 ${g0 - 104} 56 ${g0 - 30} Q80 ${g0 - 104} 104 ${g0 - 30} Q126 ${g0 - 104} 148 ${g0 - 30}`, 2.5, '#ffffff', 'stroke-dasharray="4 6" opacity="0.9"');
      const coil = at(0, 0, 0.62, art('spring.coil').body + `<rect x="-18" y="-62" width="36" height="9" rx="4" fill="${P.metalDark}" ${sw(4)}/>`);
      const hop = `<rect x="-30" y="-150" width="60" height="150" fill="none" stroke="none"/>` + coil + anim('anim-spin', use('wheel.spring', 0, 0, 0.36)) ;
      s += at(80, g0 - 20, 1, anim('anim-hop', hop));
    }
    return s;
  });
}

// ---------------------------------------------------------------- paint, pattern, decal swatches

export function paintSwatch(id: PaintId): string {
  const c = paintHex(id);
  const dark = mix(c, INK, 0.3);
  return pic('0 0 100 100', () =>
    st('M24 40 Q50 8 76 40', 4) +
    sh('M20 40 L80 40 L75 86 Q75 92 69 92 L31 92 Q25 92 25 86 Z', P.metal, 4) +
    st('M30 58 L30 80', 3, '#ffffff', 'opacity="0.6"') +
    sh('M18 40 L82 40 L81 48 Q70 52 64 50 Q63 70 57 70 Q51 70 51 52 Q36 54 19 48 Z', c, 4) +
    el(50, 40, 32, 5, mix(c, '#ffffff', 0.3), 0) +
    st('M18 40 L82 40', 4) +
    el(58, 95, 10, 3, dark, 0, 'opacity="0.5"'),
  );
}

export function patternSwatch(id: PatternId, paint: PaintId): string {
  return pic('-146 -138 308 144', () => {
    let s = use('truck.body', 0, 0, 1, false, tintBody(art('truck.body').body, paintHex(paint)));
    if (id !== 'plain') s += use(`truck.pat.${id}`, 0, 0, 1);
    else s += `<path d="M-110 -56 L-40 -56" stroke="#ffffff" stroke-width="8" stroke-linecap="round" opacity="0.7"/><path d="M-6 -100 L40 -100" stroke="#ffffff" stroke-width="6" stroke-linecap="round" opacity="0.6"/>`;
    s += use('truck.trim', 0, 0, 1);
    return s;
  });
}

export function decalSwatch(id: DecalId): string {
  if (id === 'none') return pic('-34 -34 68 68', () => ci(0, 0, 25, '#ffffff', 0, `fill-opacity="0.5" stroke="${INK}" stroke-width="4" stroke-dasharray="7 6" stroke-linecap="round"`));
  return pic('-34 -34 68 68', () => use(`decal.${id}`, 0, 0, 1));
}

// ---------------------------------------------------------------- My Tiny Track: thumbnails and slot icons

/** One slot's content drawn in a 40 × 40 cell whose ground line is at y = 0, x from 0 to 40. */
function slotArt(p: TrackPiece | null): string {
  if (p === 'log') return logArt(12, 0, 0.22);
  if (p === 'ramp') return rampArt(4, 36, 0, -16, P.orange, '#ffc27a', 2.5);
  if (p === 'pond') return '';
  return '';
}

export function trackThumb(slots: Slots): string {
  const W = 320;
  const H = 84;
  const G = 58;
  const x0 = 40;
  const cell = 40;
  return pic(`0 0 ${W} ${H}`, () => {
    let ground = `M0 ${G}`;
    let water0 = '';
    let deco = '';
    for (let i = 0; i < 6; i++) {
      const x = x0 + i * cell;
      const p = slots[i] ?? null;
      if (p === 'pond') {
        ground += ` L${x + 4} ${G} L${x + 4} ${G + 18} L${x + cell - 4} ${G + 18} L${x + cell - 4} ${G}`;
        water0 += water(x + 4, x + cell - 4, G + 4, 14);
      } else deco += at(x, G, 1, slotArt(p));
      if (i > 0) deco += st(`M${x} ${G + 8} L${x} ${G + 14}`, 2, INK, 'opacity="0.3"');
    }
    ground += ` L${W} ${G}`;
    return (
      skyBg(W, H, H, 14) +
      `<path d="${ground} L${W} ${H} L0 ${H} Z" fill="${P.soil}"/>` +
      water0 +
      st(ground, 3) +
      deco +
      rr(14, G - 34, 7, 34, 2.5, P.red, 2.5) +
      sh(`M21 ${G - 34} L36 ${G - 28} L21 ${G - 22} Z`, P.yellow, 2) +
      checkFlag(296, G, 0.62)
    );
  });
}

export function trackPieceIcon(p: TrackPiece | null): string {
  return pic('0 0 100 100', () => {
    const G = 68;
    let s = rr(4, 4, 92, 92, 18, P.skyLow, 0);
    if (p === 'pond') {
      s += `<path d="M4 ${G} L16 ${G} L16 ${G + 20} L84 ${G + 20} L84 ${G} L96 ${G} L96 82 Q96 96 82 96 L18 96 Q4 96 4 82 Z" fill="${P.soil}"/>`;
      s += water(16, 84, G + 6, 14) + use('prop.lily', 50, G + 10, 0.4);
      s += st(`M4 ${G} L16 ${G} L16 ${G + 20} L84 ${G + 20} L84 ${G} L96 ${G}`, 3.5);
    } else {
      s += `<path d="M4 ${G} L96 ${G} L96 82 Q96 96 82 96 L18 96 Q4 96 4 82 Z" fill="${P.soil}"/>` + rr(4, G, 92, 8, 0, P.grass, 0) + st(`M4 ${G} L96 ${G}`, 3.5);
      if (p === 'log') s += logArt(32, G, 0.46);
      else if (p === 'ramp') s += rampArt(16, 84, G, G - 36, P.orange, '#ffc27a', 3.5);
      else s += st(`M26 ${G} L22 ${G - 10} M30 ${G} L30 ${G - 12} M34 ${G} L38 ${G - 9} M66 ${G} L62 ${G - 9} M70 ${G} L71 ${G - 12} M74 ${G} L78 ${G - 8}`, 3, P.grassDark);
    }
    return s + rr(4, 4, 92, 92, 18, 'none', 4);
  });
}

// ---------------------------------------------------------------- the personalised truck

export function truckPicture(look: TruckLook): string {
  return pic('-160 -228 330 244', () => truck(look, 0, 0, 1));
}

// ---------------------------------------------------------------- grown-up gate shapes

export function gatePicture(shape: GateShape): string {
  return pic('0 0 100 100', () => {
    if (shape === 'star') return sh(starPath(50, 54, 42), P.yellow, 6) + st('M34 44 L44 43', 4, '#ffffff', 'opacity="0.7"');
    if (shape === 'moon') return sh('M58 8 A42 42 0 1 0 92 66 A32 32 0 1 1 58 8 Z', P.blue, 6) + st('M30 40 Q28 54 34 66', 4, '#ffffff', 'opacity="0.5"');
    if (shape === 'heart') return sh('M50 88 Q10 62 10 36 Q10 14 30 12 Q44 12 50 26 Q56 12 70 12 Q90 14 90 36 Q90 62 50 88 Z', P.pink, 6) + st('M24 32 Q24 24 32 22', 4, '#ffffff', 'opacity="0.7"');
    return sh('M50 10 L92 86 L8 86 Z', P.teal, 6) + st('M42 34 L28 62', 4, '#ffffff', 'opacity="0.5"');
  });
}

// ---------------------------------------------------------------- friend portraits

const FACE_BG: Record<CrewId, string> = { milo: '#cfe9f7', pip: '#ffe6b8', nori: '#d9efd0' };

export function crewFace(id: CrewId): string {
  return pic('0 0 100 100', () => {
    def('face-clip', `<clipPath id="pic-face-clip"><circle cx="50" cy="50" r="44"/></clipPath>`);
    const dy = id === 'pip' ? 64 : id === 'nori' ? 52 : 58;
    return ci(50, 50, 44, FACE_BG[id], 0) + `<g clip-path="url(#pic-face-clip)">${at(50, dy, 0.82, faceArt(id))}</g>` + ci(50, 50, 44, 'none', 5);
  });
}
