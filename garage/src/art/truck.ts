import { P } from './palette';
import { type ArtPiece, piece, path, circle, rrect, line, g, shine, ink, ellipse } from './svg';

/**
 * The monster truck, in layers so it can be personalised:
 *  truck.body   paintable panels drawn in light neutral tones (tinted to the chosen paint)
 *  truck.trim   windows, lights, bumpers, roll bar (never tinted)
 *  truck.pat.*  pattern overlays clipped to the panels
 *  decal.*      a badge on the door
 *  wheel.*      chunky or spring wheels; spring.coil between hub and body
 * Pivot (0,0) = bottom centre of the chassis; the truck faces right.
 */

const PANEL =
  'M-128 -14 L-128 -58 Q-128 -66 -120 -66 L-18 -66 L-18 -104 Q-18 -118 -4 -118 L54 -118 Q68 -118 76 -106 L94 -70 L132 -64 Q142 -62 142 -50 L142 -24 Q142 -14 132 -14 Z';
const BOX: [number, number, number, number] = [-140, -132, 296, 132];

const body = piece(
  'truck.body',
  BOX,
  // panels (neutral, take the paint tint), with simple highlight and shade
  path(PANEL, '#f4f4f4', 6) +
    path('M-124 -22 L138 -22 L138 -16 L-124 -16 Z', '#c9c9c9') +
    path('M-14 -110 Q-12 -114 -4 -114 L52 -114 Q60 -114 66 -106 L60 -106 Q56 -110 50 -110 L0 -110 Q-8 -110 -10 -104 Z', '#ffffff', 0, 'opacity="0.9"') +
    // door seam and fender flares
    line('M18 -66 L18 -20 M18 -66 L64 -66', 4, '#a9a9a9') +
    path('M-128 -14 Q-82 -64 -36 -14 Z', '#d9d9d9', 5) +
    path('M38 -14 Q84 -64 130 -14 Z', '#d9d9d9', 5),
);

const trim = piece(
  'truck.trim',
  BOX,
  // window
  path('M-8 -108 L50 -108 Q58 -108 63 -100 L78 -72 L-8 -72 Z', P.waterLight, 5) +
    path('M-2 -102 L18 -102 L6 -78 L-2 -78 Z', '#ffffff', 0, 'opacity="0.55"') +
    // roll bar over the bed
    line('M-118 -66 L-108 -100 L-34 -100 L-26 -66', 9, P.ink) +
    line('M-118 -66 L-108 -100 L-34 -100 L-26 -66', 4, P.metal) +
    // headlight, tail light (shape + colour), door handle, exhaust
    path('M128 -58 L142 -56 L142 -42 L128 -44 Z', P.yellow, 4) +
    rrect(-134, -60, 10, 20, 3, P.red, 4) +
    rrect(30, -58, 18, 6, 3, P.ink) +
    rrect(-6, -146 + 18, 10, 26, 4, P.metalDark, 4) +
    // bumpers
    rrect(132, -26, 18, 16, 6, P.metalDark, 5) +
    rrect(-140, -26, 16, 16, 6, P.metalDark, 5) +
    // chassis rail
    rrect(-120, -12, 240, 14, 7, P.rubber, 4),
);

/** Pattern overlays: drawn in white/ink on top of the paint, clipped to the panels. */
function pattern(key: string, content: string): ArtPiece {
  const id = key.replace(/\./g, '-');
  return piece(key, BOX, g(content, '', `clip-path="url(#${id}-clip)"`), `<clipPath id="${id}-clip"><path d="${PANEL}"/></clipPath>`);
}

const STAR = (cx: number, cy: number, r: number, fill: string) => {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 === 0 ? r : r * 0.45;
    pts.push(`${(cx + Math.cos(a) * rr).toFixed(1)} ${(cy + Math.sin(a) * rr).toFixed(1)}`);
  }
  return `<path d="M${pts.join(' L')} Z" fill="${fill}" ${ink(3)}/>`;
};

const patterns = [
  pattern('truck.pat.stripes', rrect(-140, -54, 290, 9, 3, '#ffffff', 0, 'opacity="0.92"') + rrect(-140, -40, 290, 9, 3, '#ffffff', 0, 'opacity="0.92"')),
  pattern(
    'truck.pat.zigzag',
    path('M-140 -40 L-100 -58 L-60 -36 L-20 -58 L20 -36 L60 -58 L100 -36 L150 -56 L150 -40 L100 -20 L60 -42 L20 -20 L-20 -42 L-60 -20 L-100 -42 L-140 -24 Z', '#ffffff', 0, 'opacity="0.9"'),
  ),
  pattern('truck.pat.dots', [[-110, -44], [-76, -30], [-48, -50], [2, -88], [36, -34], [0, -40], [70, -44], [108, -32], [40, -96]].map(([x, y]) => circle(x, y, 9, '#ffffff', 0, 'opacity="0.92"')).join('')),
  pattern('truck.pat.stars', [[-104, -40, 13], [-56, -42, 10], [10, -90, 11], [44, -40, 13], [104, -38, 11]].map(([x, y, r]) => STAR(x, y, r, '#ffffff')).join('')),
  pattern(
    'truck.pat.checks',
    Array.from({ length: 30 }, (_, i) => {
      const col = i % 15;
      const row = Math.floor(i / 15);
      return (col + row) % 2 === 0 ? `<rect x="${-140 + col * 20}" y="${-34 + row * 10}" width="20" height="10" fill="${P.ink}" opacity="0.85"/>` : '';
    }).join(''),
  ),
];

/** Decals: a badge on the door (centre at 0,0, about 56 across). */
const decals = [
  piece('decal.bolt', [-30, -30, 60, 60], circle(0, 0, 26, P.ink) + path('M6 -20 L-12 4 L0 4 L-6 20 L12 -4 L0 -4 Z', P.yellow, 3)),
  piece('decal.star', [-30, -30, 60, 60], circle(0, 0, 26, P.blue, 4) + STAR(0, 1, 18, P.yellow)),
  piece(
    'decal.paw',
    [-30, -30, 60, 60],
    circle(0, 0, 26, P.cream, 4) + ellipse(0, 7, 10, 8, P.inkSoft) + [[-12, -6], [-4, -13], [5, -13], [13, -6]].map(([x, y]) => circle(x, y, 4.5, P.inkSoft)).join(''),
  ),
  piece('decal.leaf', [-30, -30, 60, 60], circle(0, 0, 26, P.cream, 4) + path('M-14 12 Q-14 -14 14 -14 Q14 12 -14 12 Z', P.leaf, 3) + line('M-12 10 L8 -8', 3, P.leafDark)),
  piece(
    'decal.b',
    [-30, -30, 60, 60],
    circle(0, 0, 26, P.orange, 4) + path('M-8 -15 L4 -15 Q13 -15 13 -7 Q13 -1 7 0 Q15 2 15 8 Q15 16 5 16 L-8 16 Z M-1 -8 L-1 -3 L3 -3 Q6 -3 6 -5.5 Q6 -8 3 -8 Z M-1 4 L-1 9 L4 9 Q8 9 8 6.5 Q8 4 4 4 Z', P.cream, 2.5),
  ),
];

function treads(r: number, n: number, depth: number, w: number): string {
  let out = '';
  for (let i = 0; i < n; i++) {
    const a = (i * 360) / n;
    out += rrect(-w / 2, -r - depth * 0.35, w, depth, 3, P.rubber, 3, `transform="rotate(${a})"`);
  }
  return out;
}

const chunky = piece(
  'wheel.chunky',
  [-72, -72, 144, 144],
  treads(60, 14, 16, 18) +
    circle(0, 0, 60, P.rubber, 6) +
    circle(0, 0, 46, P.rubberLight, 0) +
    circle(0, 0, 26, P.metal, 5) +
    circle(0, 0, 13, P.yellow, 4) +
    [0, 72, 144, 216, 288].map((a) => circle(18 * Math.cos((a * Math.PI) / 180), 18 * Math.sin((a * Math.PI) / 180), 3.2, P.metalDark)).join('') +
    shine(-18, -22, 18, 8, -30, 0.18),
);

const springWheel = piece(
  'wheel.spring',
  [-64, -64, 128, 128],
  treads(54, 12, 12, 14) +
    circle(0, 0, 54, P.rubber, 6) +
    circle(0, 0, 40, P.rubberLight, 0) +
    circle(0, 0, 24, P.metal, 5) +
    // a spiral hub: the "spring" wheel reads differently even without colour
    line('M0 0 Q6 -2 6 -8 Q4 -16 -4 -14 Q-14 -10 -12 0 Q-10 12 2 13 Q15 12 16 -2', 4, P.orange) +
    shine(-16, -20, 16, 7, -30, 0.18),
);

/** Coil between a spring wheel's hub and the body (drawn stretched by the view). */
const coil = piece(
  'spring.coil',
  [-16, -60, 32, 64],
  line('M0 0 L-12 -6 L12 -14 L-12 -22 L12 -30 L-12 -38 L12 -46 L0 -54', 9, P.ink) + line('M0 0 L-12 -6 L12 -14 L-12 -22 L12 -30 L-12 -38 L12 -46 L0 -54', 5, P.orange),
);

const strut = piece('chunky.strut', [-10, -40, 20, 44], rrect(-6, -36, 12, 38, 5, P.metalDark, 4));

const shadowPiece = piece('truck.shadow', [-150, -16, 300, 32], ellipse(0, 0, 140, 12, P.ink, 0, 'opacity="0.22"'));

export const TRUCK_PIECES: ArtPiece[] = [body, trim, ...patterns, ...decals, chunky, springWheel, coil, strut, shadowPiece];

export const PATTERN_IDS = ['plain', 'stripes', 'zigzag', 'dots', 'stars', 'checks'] as const;
export const DECAL_IDS = ['none', 'bolt', 'star', 'paw', 'leaf', 'b'] as const;
export type PatternId = (typeof PATTERN_IDS)[number];
export type DecalId = (typeof DECAL_IDS)[number];
