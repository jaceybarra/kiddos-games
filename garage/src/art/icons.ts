import { ICON_NAMES, type IconName } from './iconNames';
import { P } from './palette';

/**
 * Picture icons for the DOM layer: original inline SVG, viewBox 0 0 100 100,
 * warm ink outlines (about 6 units, round joins), palette fills. Each one is
 * told apart by its silhouette first (they still read in greyscale); colour
 * only supports the shape. No ids inside (an icon may appear many times on a
 * page), no text, nothing external.
 */

const INK: string = P.ink;
const SW = 6;

// ---------------------------------------------------------------- tiny helpers (path data based)

const n = (v: number) => (Math.round(v * 10) / 10).toString();

function dCircle(cx: number, cy: number, r: number): string {
  return `M${n(cx - r)} ${n(cy)} a${n(r)} ${n(r)} 0 1 0 ${n(2 * r)} 0 a${n(r)} ${n(r)} 0 1 0 ${n(-2 * r)} 0 Z`;
}

function dRrect(x: number, y: number, w: number, h: number, r: number): string {
  r = Math.min(r, w / 2, h / 2);
  return `M${n(x + r)} ${n(y)} L${n(x + w - r)} ${n(y)} Q${n(x + w)} ${n(y)} ${n(x + w)} ${n(y + r)} L${n(x + w)} ${n(y + h - r)} Q${n(x + w)} ${n(y + h)} ${n(x + w - r)} ${n(y + h)} L${n(x + r)} ${n(y + h)} Q${n(x)} ${n(y + h)} ${n(x)} ${n(y + h - r)} L${n(x)} ${n(y + r)} Q${n(x)} ${n(y)} ${n(x + r)} ${n(y)} Z`;
}

/** A filled shape with the ink outline. */
function sh(d: string, fill: string, w = SW, extra = ''): string {
  return `<path d="${d}" fill="${fill}" stroke="${INK}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round" ${extra}/>`;
}

/** A plain filled shape (no outline). */
function fl(d: string, fill: string, extra = ''): string {
  return `<path d="${d}" fill="${fill}" ${extra}/>`;
}

/** An open stroke. */
function st(d: string, w: number, color = INK, extra = ''): string {
  return `<path d="${d}" fill="none" stroke="${color}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round" ${extra}/>`;
}

/** A thick coloured stroke with an ink outline around it (chunky arrows, ticks). */
function bar(d: string, w: number, color: string): string {
  return st(d, w + SW * 2, INK) + st(d, w, color);
}

/**
 * Several overlapping shapes outlined as one silhouette: every shape is
 * stroked first, then every fill is laid on top, so inner overlaps vanish.
 */
function uni(ds: string[], fill: string, w = SW): string {
  return ds.map((d) => sh(d, INK, w * 2)).join('') + ds.map((d) => fl(d, fill)).join('');
}

function star(cx: number, cy: number, r: number, inner = 0.46): string {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 === 0 ? r : r * inner;
    pts.push(`${n(cx + Math.cos(a) * rr)} ${n(cy + Math.sin(a) * rr)}`);
  }
  return `M${pts.join(' L')} Z`;
}

function glint(cx: number, cy: number, r: number): string {
  const k = r * 0.22;
  return `M${n(cx)} ${n(cy - r)} Q${n(cx + k)} ${n(cy - k)} ${n(cx + r)} ${n(cy)} Q${n(cx + k)} ${n(cy + k)} ${n(cx)} ${n(cy + r)} Q${n(cx - k)} ${n(cy + k)} ${n(cx - r)} ${n(cy)} Q${n(cx - k)} ${n(cy - k)} ${n(cx)} ${n(cy - r)} Z`;
}

/** Clip a convex polygon to an axis-aligned rectangle (Sutherland–Hodgman). */
function clipPoly(pts: [number, number][], x0: number, y0: number, x1: number, y1: number): [number, number][] {
  const edges: [(p: [number, number]) => boolean, (a: [number, number], b: [number, number]) => [number, number]][] = [
    [(p) => p[0] >= x0, (a, b) => [x0, a[1] + ((b[1] - a[1]) * (x0 - a[0])) / (b[0] - a[0])]],
    [(p) => p[0] <= x1, (a, b) => [x1, a[1] + ((b[1] - a[1]) * (x1 - a[0])) / (b[0] - a[0])]],
    [(p) => p[1] >= y0, (a, b) => [a[0] + ((b[0] - a[0]) * (y0 - a[1])) / (b[1] - a[1]), y0]],
    [(p) => p[1] <= y1, (a, b) => [a[0] + ((b[0] - a[0]) * (y1 - a[1])) / (b[1] - a[1]), y1]],
  ];
  let out = pts;
  for (const [inside, cut] of edges) {
    const src = out;
    out = [];
    for (let i = 0; i < src.length; i++) {
      const a = src[i];
      const b = src[(i + 1) % src.length];
      if (inside(b)) {
        if (!inside(a)) out.push(cut(a, b));
        out.push(b);
      } else if (inside(a)) out.push(cut(a, b));
    }
  }
  return out;
}

const poly = (pts: [number, number][]) => (pts.length ? `M${pts.map(([x, y]) => `${n(x)} ${n(y)}`).join(' L')} Z` : '');

/** A small tyre with treads, centred on (cx, cy). */
function tyre(cx: number, cy: number, r: number, treads = 10): string {
  let t = '';
  const tw = r * 0.42;
  const th = r * 0.32;
  const tsw = Math.min(SW * 0.6, r * 0.14);
  for (let i = 0; i < treads; i++) {
    const a = (i * 360) / treads;
    t += `<rect x="${n(cx - tw / 2)}" y="${n(cy - r - th * 0.45)}" width="${n(tw)}" height="${n(th)}" rx="2" fill="${P.rubber}" stroke="${INK}" stroke-width="${n(tsw)}" stroke-linejoin="round" transform="rotate(${a} ${cx} ${cy})"/>`;
  }
  return (
    t +
    sh(dCircle(cx, cy, r), P.rubber, Math.min(SW, r * 0.3)) +
    fl(dCircle(cx, cy, r * 0.72), P.rubberLight) +
    sh(dCircle(cx, cy, r * 0.44), P.metal, Math.min(SW * 0.75, r * 0.16)) +
    sh(dCircle(cx, cy, r * 0.19), P.yellow, Math.min(SW * 0.6, r * 0.12))
  );
}

/** A filled arrowhead whose tip points along (dx, dy) from the end point (ex, ey). */
function head(ex: number, ey: number, dx: number, dy: number, len: number, half: number, fill: string): string {
  const l = Math.hypot(dx, dy);
  const ux = dx / l;
  const uy = dy / l;
  const nx = -uy;
  const ny = ux;
  return sh(`M${n(ex + nx * half - ux * 2)} ${n(ey + ny * half - uy * 2)} L${n(ex + ux * len)} ${n(ey + uy * len)} L${n(ex - nx * half - ux * 2)} ${n(ey - ny * half - uy * 2)} Z`, fill);
}

/** An open hand (palm towards us, fingers up) in a 100-unit frame. */
function handShapes(): string[] {
  return [
    dRrect(31, 20, 13, 42, 6.5), // index
    dRrect(44.5, 14, 13, 46, 6.5), // middle
    dRrect(58, 19, 13, 42, 6.5), // ring
    dRrect(71, 30, 11, 34, 5.5), // little
    'M36 70 Q22 64 16 50 Q13 43 19 41 Q25 39 29 46 L36 56 Z', // thumb
    dRrect(30, 46, 52, 42, 18), // palm
  ];
}

function hand(fill: string): string {
  return uni(handShapes(), fill) + st('M44.5 46 L44.5 56 M58 46 L58 55 M71 48 L71 56', 3, P.inkSoft, 'opacity="0.7"');
}

/** The little monster truck seen from the side, nose to the right, wheels resting on y=0. */
function miniTruck(paint: string): string {
  return (
    sh('M-34 -14 L-34 -30 Q-34 -33 -31 -33 L-6 -33 L-6 -46 Q-6 -50 -2 -50 L14 -50 Q18 -50 20 -46 L26 -34 L36 -32 Q40 -31 40 -27 L40 -16 Q40 -14 37 -14 Z', paint) +
    sh('M-1 -45 L13 -45 L19 -34 L-1 -34 Z', P.waterLight, SW * 0.6) +
    tyre(-20, -11, 11, 8) +
    tyre(24, -11, 11, 8)
  );
}

// ---------------------------------------------------------------- the icons

const svg = (body: string) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" aria-hidden="true" focusable="false">${body}</svg>`;

const BODIES: Record<IconName, string> = {
  // a chunky arrow that curves up over a wheel (hooked like a jump)
  jump:
    tyre(36, 81, 15, 10) +
    st('M12 98 L60 98', 5) +
    bar('M16 50 L44 50 Q72 50 72 30', 14, P.yellow) +
    head(72, 28, 0, -1, 22, 18, P.yellow),

  // a wheel stopped by a striped barrier
  brake:
    tyre(38, 60, 25, 10) +
    sh(dRrect(70, 14, 20, 76, 7), P.cream) +
    [10, 34, 58].map((y) => fl(poly(clipPoly([[60, y + 22], [100, y], [100, y + 12], [60, y + 34]], 70, 14, 90, 90)), P.red)).join('') +
    sh(dRrect(70, 14, 20, 76, 7), 'none') +
    st('M6 90 L94 90', SW),

  // a green pedal with a big arrow pointing on (go)
  gas:
    sh(dRrect(14, 14, 72, 72, 18), P.grass) +
    st('M24 70 L76 70', 4, P.grassDark, 'opacity="0.55"') +
    sh('M30 34 L56 34 L56 20 L84 50 L56 80 L56 66 L30 66 Z', P.yellow, 6),

  // a red pedal with a big arrow pointing back (slow down, stop, then back up)
  reverse:
    sh(dRrect(14, 14, 72, 72, 18), P.red) +
    st('M24 70 L76 70', 4, P.redDark, 'opacity="0.55"') +
    sh('M70 34 L44 34 L44 20 L16 50 L44 80 L44 66 L70 66 Z', '#ffffff', 6),

  // two thick bars
  pause: sh(dRrect(24, 18, 20, 64, 8), P.blue) + sh(dRrect(56, 18, 20, 64, 8), P.blue) + st('M30 26 L30 46 M62 26 L62 46', 4, '#ffffff', 'opacity="0.55"'),

  // an open hand with a little sparkle: "show me"
  help: hand('#ffffff') + sh(glint(84, 18, 12), P.yellow, 4) + sh(glint(14, 22, 6), P.yellow, 3),

  // a big round-cornered triangle
  play: sh('M32 18 L82 50 L32 82 Z', P.yellow, 7) + st('M38 30 L38 52', 4, '#ffffff', 'opacity="0.6"'),

  // a circular arrow
  replay: bar('M70 26 A30 30 0 1 0 80 54', 11, P.teal) + sh('M58 22 L84 12 L82 40 Z', P.teal),

  // a little garage with a roll-up door
  garage:
    sh('M12 48 L50 16 L88 48 L88 88 L12 88 Z', P.cream) +
    bar('M8 50 L50 15 L92 50', 6, P.red) +
    sh(dRrect(28, 52, 44, 36, 3), '#ec7a68', 5) +
    st('M28 61 L72 61 M28 70 L72 70 M28 79 L72 79', 3.5) +
    st('M44 84 L56 84', 4, P.cream),

  // a big tick in a rounded square
  done: sh(dRrect(12, 12, 76, 76, 20), P.teal) + bar('M28 52 L44 68 L74 34', 10, '#ffffff'),

  // an X
  close: bar('M28 28 L72 72 M72 28 L28 72', 12, P.cream),

  // a chunky left arrow
  back: sh('M12 50 L44 18 L44 36 L86 36 L86 64 L44 64 L44 82 Z', P.blue, 7),

  // a curved arrow going back
  undo: bar('M76 80 Q86 36 52 34 L40 34', 11, P.orange) + sh('M44 16 L16 34 L44 52 Z', P.orange),

  // a sweeping broom with a little dust
  clear:
    bar('M86 10 L50 52', 6, P.wood) +
    sh('M38 46 L60 60 L46 90 L14 78 Z', P.yellow) +
    sh(dRrect(38, 44, 26, 12, 4), P.red, 5, 'transform="rotate(33 51 50)"') +
    st('M24 80 L40 58 M32 84 L46 62 M40 87 L52 64', 3, P.yellowDark) +
    sh(dCircle(10, 92, 4), P.cream, 3) +
    sh(dCircle(22, 94, 3), P.cream, 2.5),

  // the truck with a small flag: "try it"
  test: `<g transform="translate(48 86)">${miniTruck(P.red)}</g>` + st('M18 40 L18 8', 5) + sh('M18 8 L44 15 L18 24 Z', P.yellow, 5),

  // two hands waving hello: "come and help"
  invite:
    `<g transform="translate(26 58) rotate(-14) scale(0.6) translate(-50 -50)">${hand('#ffffff')}</g>` +
    `<g transform="translate(74 50) rotate(14) scale(0.6) translate(-50 -50)">${hand('#ffffff')}</g>` +
    st('M6 46 Q1 36 6 26 M94 20 Q99 30 96 42', 4, P.inkSoft),

  // a paint pot with a drip
  paint:
    st('M24 40 Q50 6 76 40', 5) +
    sh('M20 40 L80 40 L74 88 Q74 92 70 92 L30 92 Q26 92 26 88 Z', P.metal) +
    sh('M20 40 L80 40 L79 50 Q66 54 62 52 Q60 72 54 72 Q48 72 48 54 Q34 56 21 50 Z', P.blue) +
    st('M34 60 L34 82', 4, '#ffffff', 'opacity="0.6"'),

  // a striped swatch
  pattern:
    sh(dRrect(16, 16, 68, 68, 8), P.cream) +
    [0, 26, 52, 78].map((c) => fl(poly(clipPoly([[c - 30, 16], [c - 14, 16], [c + 54, 84], [c + 38, 84]], 16, 16, 84, 84)), P.orange)).join('') +
    sh(dRrect(16, 16, 68, 68, 8), 'none'),

  // a star sticker peeling off at the corner
  decal:
    sh('M16 22 Q16 14 24 14 L78 14 Q86 14 86 22 L86 62 L62 86 L24 86 Q16 86 16 78 Z', '#ffffff') +
    sh(star(48, 48, 26), P.yellow, 5) +
    sh('M86 62 L62 86 Q60 66 86 62 Z', P.metal, 5),

  // a chunky tyre
  wheel: tyre(50, 50, 34, 12),

  // a little wavy road with a flag at the end
  track:
    bar('M8 74 Q26 54 44 68 Q62 82 80 60', 12, P.rubberLight) +
    st('M14 68 L18 64 M30 61 L35 62 M48 70 L53 73 M66 72 L71 68', 3, P.cream) +
    st('M80 60 L80 14', 5) +
    sh('M80 14 L80 38 L96 32 L96 14 Z', '#ffffff', 4) +
    fl('M80 14 L88 14 L88 20 L80 20 Z M88 20 L96 20 L96 26 L88 26 Z M80 26 L88 26 L88 32 L80 34 Z', INK),

  // a box with a down arrow: keep it
  save:
    sh('M12 58 L30 58 L36 68 L64 68 L70 58 L88 58 L88 86 Q88 90 84 90 L16 90 Q12 90 12 86 Z', P.wood) +
    sh('M38 8 L62 8 L62 32 L76 32 L50 60 L24 32 L38 32 Z', P.teal),

  // a bin with a lid
  trash:
    sh('M22 30 L78 30 L72 88 Q72 92 68 92 L32 92 Q28 92 28 88 Z', P.metal) +
    st('M40 42 L41 80 M50 42 L50 80 M60 42 L59 80', 4, P.metalDark) +
    sh(dRrect(14, 18, 72, 12, 5), P.metalDark) +
    sh(dRrect(40, 8, 20, 10, 4), P.metalDark, 5),

  // a cog
  gear: (() => {
    const teeth = 8;
    const pts: string[] = [];
    for (let i = 0; i < teeth; i++) {
      const a0 = (i / teeth) * Math.PI * 2;
      const step = (Math.PI * 2) / teeth;
      const seq: [number, number][] = [
        [a0 - step * 0.22, 30],
        [a0 - step * 0.14, 42],
        [a0 + step * 0.14, 42],
        [a0 + step * 0.22, 30],
      ];
      for (const [a, r] of seq) pts.push(`${n(50 + Math.cos(a) * r)} ${n(50 + Math.sin(a) * r)}`);
    }
    return sh(`M${pts.join(' L')} Z`, P.metal) + sh(dCircle(50, 50, 13), P.cream);
  })(),

  // a tick
  check: bar('M18 54 L40 76 L82 26', 13, P.teal),

  star: sh(star(50, 52, 40), P.yellow, 6) + st('M34 42 L44 41', 4, '#ffffff', 'opacity="0.7"'),

  // a coin with a star
  coin: sh(dCircle(50, 50, 38), P.yellow) + fl(dCircle(50, 50, 26), P.yellowDark, 'opacity="0.35"') + sh(star(50, 52, 18), '#fff7c2', 4),

  // a cloud with a tick: ready without the internet
  offline:
    uni([dCircle(32, 58, 18), dCircle(52, 44, 24), dCircle(72, 58, 17), dRrect(18, 52, 70, 24, 12)], '#ffffff') +
    bar('M36 60 L46 70 L66 48', 6, P.teal),

  // a rounded triangle with a "!"
  warn: sh('M50 12 L90 84 L10 84 Z', P.yellow, 7) + fl(dRrect(44.5, 34, 11, 30, 5.5), INK) + fl(dCircle(50, 73, 6), INK),

  // a tablet turning from tall to wide
  rotate:
    sh(dRrect(10, 12, 30, 46, 6), P.cream, 4, 'stroke-dasharray="7 7" opacity="0.7"') +
    bar('M30 8 Q72 0 80 34', 6, P.orange) +
    sh('M70 30 L92 30 L80 48 Z', P.orange, 5) +
    sh(dRrect(30, 52, 60, 38, 7), P.blue) +
    fl(dRrect(37, 58, 46, 26, 3), P.waterLight),

  // a moon and a star over the garage: time for a rest
  rest:
    sh('M58 8 A22 22 0 1 0 84 36 A17 17 0 1 1 58 8 Z', P.yellow, 5) +
    sh(star(22, 18, 9), '#ffffff', 3.5) +
    sh('M12 66 L44 44 L76 66 L76 92 L12 92 Z', P.cream, 5) +
    sh(dRrect(26, 70, 36, 22, 2), P.purple, 4) +
    st('M26 78 L62 78 M26 85 L62 85', 3),
};

export const ICONS: Record<IconName, string> = Object.fromEntries(ICON_NAMES.map((name) => [name, svg(BODIES[name])])) as Record<IconName, string>;
