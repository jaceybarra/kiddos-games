import { P } from './palette';
import { type ArtPiece, piece, path, circle, ellipse, rrect, line, g, shine, shadow, artRng, vgrad, blobPath } from './svg';

/**
 * Meadow Motor Park: sky, parallax hills, props, collectibles, flags, the
 * finish arch, route signs and the broken old bridge. Strict side view,
 * light from the upper left, warm ink outlines (6 for big shapes, 5 for props).
 * Ground, water and build pieces are drawn from the level geometry at run
 * time (see view/pieces.ts) so what you see is exactly what you drive on.
 */

const W = 5;

// ---------------------------------------------------------------- backdrop

const sky = piece('bg.sky', [0, 0, 16, 1080], `<rect x="0" y="0" width="16" height="1080" fill="url(#sky-g)"/>`, vgrad('sky-g', P.skyTop, P.skyLow), true);

/** A seamless rolling horizon: sums of sines with whole periods across the tile. */
function rolling(w: number, base: number, amps: [number, number, number], seed: number): [number, number][] {
  const r = artRng(seed);
  const ph = [r() * 6.28, r() * 6.28, r() * 6.28];
  const pts: [number, number][] = [];
  for (let x = 0; x <= w; x += 32) {
    const t = (x / w) * Math.PI * 2;
    pts.push([x, base - amps[0] * Math.sin(t * 2 + ph[0]) - amps[1] * Math.sin(t * 3 + ph[1]) - amps[2] * Math.sin(t * 7 + ph[2])]);
  }
  return pts;
}

function band(pts: [number, number][], bottom: number, fill: string, stroke = 0): string {
  const d = 'M' + pts.map(([x, y]) => `${x} ${y.toFixed(1)}`).join(' L') + ` L${pts[pts.length - 1][0]} ${bottom} L0 ${bottom} Z`;
  return path(d, fill, stroke, stroke ? `stroke-opacity="0.35"` : '');
}

function roundTree(x: number, y: number, s: number, leaf: string, dark: string, outline = 4): string {
  return (
    rrect(x - 7 * s, y - 40 * s, 14 * s, 42 * s, 5 * s, P.woodDark, outline) +
    path(blobPath([[x - 46 * s, y - 50 * s], [x - 40 * s, y - 92 * s], [x, y - 118 * s], [x + 42 * s, y - 94 * s], [x + 48 * s, y - 52 * s], [x, y - 36 * s]]), leaf, outline) +
    ellipse(x + 12 * s, y - 52 * s, 30 * s, 12 * s, dark, 0, 'opacity="0.5"') +
    shine(x - 18 * s, y - 92 * s, 16 * s, 9 * s, -25, 0.25)
  );
}

function pineTree(x: number, y: number, s: number, leaf: string, outline = 4): string {
  return (
    rrect(x - 6 * s, y - 26 * s, 12 * s, 28 * s, 4 * s, P.woodDark, outline) +
    path(`M${x} ${y - 140 * s} L${x + 40 * s} ${y - 24 * s} L${x - 40 * s} ${y - 24 * s} Z`, leaf, outline) +
    path(`M${x} ${y - 140 * s} L${x - 40 * s} ${y - 24 * s} L${x - 12 * s} ${y - 24 * s} Z`, '#ffffff', 0, 'opacity="0.15"')
  );
}

const far = (() => {
  const w = 2048;
  const pts = rolling(w, 250, [36, 22, 8], 11);
  let trees = '';
  const r = artRng(5);
  for (let x = 90; x < w - 60; x += 140 + r() * 140) {
    const yi = pts[Math.round(x / 32)][1];
    trees += r() < 0.5 ? roundTree(x, yi + 14, 0.55, '#9fcf96', '#7fb57a', 0) : pineTree(x, yi + 14, 0.5, '#93c48d', 0);
  }
  return piece('bg.far', [0, 0, w, 420], band(pts, 420, P.hillFar) + trees, '', true);
})();

const mid = (() => {
  const w = 2048;
  const pts = rolling(w, 210, [48, 26, 10], 23);
  let trees = '';
  const r = artRng(9);
  for (let x = 120; x < w - 80; x += 220 + r() * 260) {
    const yi = pts[Math.round(x / 32)][1];
    trees += r() < 0.6 ? roundTree(x, yi + 22, 0.9, P.grassLight, P.grass, 4) : pineTree(x, yi + 22, 0.85, P.leaf, 4);
  }
  return piece('bg.mid', [0, 0, w, 380], band(pts, 380, P.hillMid, 4) + trees, '', true);
})();

const clouds = [
  piece('bg.cloud.1', [-130, -60, 260, 110], path(blobPath([[-114, 30], [-86, -20], [-30, -50], [40, -40], [96, -10], [114, 30]]), '#ffffff', 0, 'opacity="0.95"') + ellipse(0, 34, 114, 14, '#dceef8')),
  piece('bg.cloud.2', [-90, -45, 180, 80], path(blobPath([[-80, 22], [-56, -14], [0, -38], [56, -16], [80, 22]]), '#ffffff', 0, 'opacity="0.95"') + ellipse(0, 26, 78, 10, '#dceef8')),
];

// ---------------------------------------------------------------- props (pivot: bottom centre on the ground)

const props = [
  piece('prop.tree', [-70, -150, 140, 152], roundTree(0, 0, 1.2, P.grassLight, P.grass, W)),
  piece('prop.pine', [-56, -176, 112, 178], pineTree(0, 0, 1.2, P.leaf, W)),
  piece(
    'prop.bush',
    [-76, -64, 152, 66],
    path(blobPath([[-64, -1], [-58, -34], [-23, -55], [21, -53], [56, -32], [64, -1], [0, 1]]), P.grass, W) + shine(-26, -34, 20, 9, -20, 0.25) + circle(-30, -18, 6, P.red, 3) + circle(12, -30, 6, P.red, 3) + circle(38, -12, 6, P.red, 3),
  ),
  piece(
    'prop.flowers',
    [-60, -56, 120, 58],
    [[-40, 0, P.yellow], [-12, 0, P.pink], [16, 0, '#ffffff'], [42, 0, P.orange]]
      .map(([x, , c], i) => line(`M${x} 0 L${x} ${-28 - (i % 2) * 12}`, 4, P.leafDark) + circle(x as number, -30 - (i % 2) * 12, 9, c as string, 3.5) + circle(x as number, -30 - (i % 2) * 12, 3, P.yellowDark))
      .join(''),
  ),
  piece('prop.rock', [-54, -46, 108, 48], path(blobPath([[-46, -2], [-37, -28], [-6, -40], [31, -31], [46, -2]]), '#a9a39a', W) + shine(-14, -26, 16, 7, -15, 0.35)),
  piece(
    'prop.fence',
    [-110, -86, 220, 88],
    rrect(-104, -70, 208, 14, 5, P.woodLight, W) + rrect(-104, -38, 208, 14, 5, P.woodLight, W) + [-86, -30, 30, 86].map((x) => rrect(x - 9, -84, 18, 84, 5, P.wood, W)).join(''),
  ),
  piece(
    'prop.mushroom',
    [-34, -54, 68, 56],
    rrect(-9, -26, 18, 26, 6, P.cream, 4) + path('M-30 -24 Q-30 -52 0 -52 Q30 -52 30 -24 Z', P.red, 4) + circle(-12, -38, 5, '#fff') + circle(10, -42, 4, '#fff'),
  ),
  piece('prop.reeds', [-40, -96, 80, 98], [-22, -6, 10, 26].map((x, i) => line(`M${x} 0 Q${x - 4} -36 ${x + (i % 2 ? 6 : -6)} ${-56 - (i % 2) * 14}`, 5, P.leafDark) + ellipse(x + (i % 2 ? 6 : -6), -64 - (i % 2) * 14, 5, 13, P.woodDark, 3)).join('')),
  piece('prop.lily', [-40, -14, 80, 22], ellipse(0, 0, 36, 10, P.leaf, 4) + path('M0 0 L30 -6 L30 6 Z', P.water)),
  // a pole that marks the spring-wheel route: a little spring on top (shape, not colour)
  piece(
    'prop.springpost',
    [-30, -170, 60, 172],
    rrect(-7, -110, 14, 110, 5, P.metalDark, W) +
      line('M0 -112 L-14 -120 L14 -130 L-14 -140 L14 -150 L0 -158', 9, P.ink) +
      line('M0 -112 L-14 -120 L14 -130 L-14 -140 L14 -150 L0 -158', 5, P.orange) +
      circle(0, -160, 8, P.yellow, 4),
  ),
];

// ---------------------------------------------------------------- obstacles and story objects

const log = piece(
  'obj.log',
  [-8, -84, 96, 86],
  // the log's left face is at x=0 (the wall), its top at y=-72 (the wall top)
  shadow(40, 0, 50, 6) +
    rrect(0, -72, 80, 72, 30, P.wood, 6) +
    ellipse(10, -36, 13, 33, P.woodLight, 6) +
    ellipse(10, -36, 7, 20, 'none', 0, `stroke="${P.woodDark}" stroke-width="3"`) +
    ellipse(10, -36, 3, 7, P.woodDark) +
    line('M30 -60 Q50 -56 70 -60 M34 -18 Q54 -14 72 -20', 3, P.woodDark, 'opacity="0.6"') +
    path('M40 -72 Q46 -84 54 -78 Q50 -72 40 -72 Z', P.leaf, 3),
);

const brokenBridge = piece(
  'obj.oldbridge',
  [-30, -150, 320, 300],
  // two old posts at the stream's edges (x=0 and x=260) and a plank hanging into the water
  rrect(-18, -110, 22, 150, 6, P.woodDark, W) +
    rrect(256, -110, 22, 150, 6, P.woodDark, W) +
    line('M-6 -96 Q30 -40 40 30', 5, P.cardDark) +
    line('M266 -96 Q240 -50 236 10', 5, P.cardDark) +
    `<g transform="rotate(64 34 26)">${rrect(10, 18, 90, 18, 5, P.woodLight, W)}</g>` +
    `<g transform="rotate(-58 232 18)">${rrect(176, 10, 70, 16, 5, P.woodLight, W)}</g>`,
);

const coin = piece(
  'obj.coin',
  [-30, -30, 60, 60],
  circle(0, 0, 25, P.yellow, W) + circle(0, 0, 16, P.yellowDark, 0, 'opacity="0.35"') + path('M0 -11 L3.5 -3.5 L11 -3 L5 2.5 L7 10 L0 6 L-7 10 L-5 2.5 L-11 -3 L-3.5 -3.5 Z', '#fff7c2', 2.5) + shine(-8, -11, 7, 4, -30, 0.6),
);

const acorn = piece(
  'obj.acorn',
  [-40, -50, 80, 96],
  ellipse(0, 12, 26, 30, P.yellow, W) + shine(-9, 6, 8, 12, -15, 0.5) + path('M-30 -8 Q-30 -34 0 -34 Q30 -34 30 -8 Q0 2 -30 -8 Z', P.woodDark, W) + line('M-18 -20 L18 -20 M-22 -12 L22 -12', 2.5, P.wood) + line('M0 -34 Q4 -46 12 -46', 6) +
    // two small glints: it is the golden one
    path('M-26 -44 Q-25 -38 -19 -37 Q-25 -36 -26 -30 Q-27 -36 -33 -37 Q-27 -38 -26 -44 Z', '#fff7c2', 2.5) +
    path('M30 0 Q31 5 36 6 Q31 7 30 12 Q29 7 24 6 Q29 5 30 0 Z', '#fff7c2', 2.5),
);

const pinwheelHead = piece(
  'obj.pinwheel.head',
  [-46, -46, 92, 92],
  [P.red, P.yellow, P.blue, P.teal].map((c, i) => `<g transform="rotate(${i * 90})">${path('M0 0 L0 -40 Q26 -30 18 -6 Z', c, 4)}</g>`).join('') + circle(0, 0, 7, P.cream, 3.5),
);
const pinwheelStick = piece('obj.pinwheel.stick', [-8, -6, 16, 96], rrect(-4, 0, 8, 92, 3, P.woodLight, 3.5));

const ribbon = piece(
  'obj.ribbon',
  [-40, -44, 80, 100],
  path('M-12 6 L-24 52 L-12 44 L-4 54 L2 10 Z', P.blue, 4) + path('M12 6 L24 52 L12 44 L4 54 L-2 10 Z', P.blue, 4) + circle(0, -6, 30, P.yellow, W) + circle(0, -6, 20, P.orange, 3.5) + path('M0 -18 L4 -10 L13 -9 L6 -3 L8 6 L0 1 L-8 6 L-6 -3 L-13 -9 L-4 -10 Z', '#fff7c2', 2.5),
);

const flagDown = piece(
  'obj.flag.down',
  [-20, -190, 90, 192],
  shadow(0, 0, 18, 4) + rrect(-5, -178, 10, 178, 4, P.metal, 4) + circle(0, -181, 7, P.yellow, 4) + path('M5 -60 L44 -48 L5 -36 Z', P.cardDark, 4),
);
const flagUp = piece(
  'obj.flag.up',
  [-20, -190, 110, 192],
  shadow(0, 0, 18, 4) +
    rrect(-5, -178, 10, 178, 4, P.metal, 4) +
    circle(0, -181, 7, P.yellow, 4) +
    path('M5 -176 Q40 -186 82 -170 Q60 -150 82 -128 Q40 -138 5 -128 Z', P.blue, 4) +
    path('M38 -164 L41.5 -156 L50 -155.5 L43.5 -150 L45.5 -142 L38 -146 L30.5 -142 L32.5 -150 L26 -155.5 L34.5 -156 Z', P.yellow, 2.5),
);

const finish = (() => {
  let checks = '';
  for (let r = 0; r < 2; r++) for (let c = 0; c < 12; c++) if ((r + c) % 2 === 0) checks += `<rect x="${-180 + c * 30}" y="${-404 + r * 26}" width="30" height="26" fill="${P.ink}"/>`;
  return piece(
    'obj.finish',
    [-210, -470, 420, 472],
    shadow(-170, 0, 30, 6) +
      shadow(170, 0, 30, 6) +
      rrect(-186, -400, 26, 400, 8, P.red, 6) +
      rrect(160, -400, 26, 400, 8, P.red, 6) +
      rrect(-184, -408, 368, 56, 10, '#ffffff', 6) +
      g(checks, '', `clip-path="url(#finish-clip)"`) +
      rrect(-184, -408, 368, 56, 10, 'none', 6) +
      circle(-173, -430, 20, P.yellow, 5) +
      circle(173, -430, 20, P.yellow, 5) +
      [-120, -40, 40, 120].map((x, i) => path(`M${x - 18} -352 L${x + 18} -352 L${x} -318 Z`, [P.blue, P.orange, P.teal, P.purple][i], 4)).join(''),
    `<clipPath id="finish-clip"><rect x="-184" y="-408" width="368" height="56" rx="10"/></clipPath>`,
  );
})();

const signPost = piece('obj.sign.post', [-14, -150, 28, 152], rrect(-8, -147, 16, 147, 5, P.woodDark, W));
const signHigh = piece(
  'obj.sign.high',
  [-90, -60, 180, 120],
  rrect(-80, -46, 160, 92, 14, P.cream, W) + line('M-56 26 Q-10 -60 44 -6', 9, P.ink) + path('M30 -26 L60 2 L24 10 Z', P.ink) + circle(-56, 28, 9, P.orange, 3),
);
const signLow = piece(
  'obj.sign.low',
  [-90, -60, 180, 120],
  rrect(-80, -46, 160, 92, 14, P.cream, W) + line('M-58 10 Q-40 -10 -22 10 Q-4 30 14 10 Q28 -6 40 6', 9, P.ink) + path('M34 -10 L62 10 L30 24 Z', P.ink) + circle(-58, 10, 9, P.teal, 3),
);

// ---------------------------------------------------------------- things to drive into: crates, mud, boost strips

// a wooden crate, 90 across, bottom centre at (0, 0)
const crate = piece(
  'obj.crate',
  [-52, -96, 104, 102],
  shadow(0, 0, 48, 5) +
    rrect(-45, -90, 90, 90, 9, P.woodLight, 6) +
    line('M-42 -60 L42 -60 M-42 -30 L42 -30', 4, P.woodDark, 'opacity="0.5"') +
    path('M-38 -84 L-24 -84 L38 -10 L24 -10 Z', P.wood, 4) +
    rrect(-45, -90, 90, 90, 9, 'none', 6) +
    [[-34, -80], [34, -80], [-34, -10], [34, -10]].map(([x, y]) => circle(x, y, 3.5, P.woodDark)).join('') +
    shine(-26, -76, 11, 5, -20, 0.5),
);

// a splinter of crate (flies off when it smashes)
const crateBit = piece('obj.crate.bit', [-28, -10, 56, 20], rrect(-24, -7, 48, 14, 5, P.woodLight, 4) + line('M-14 0 L14 0', 2.5, P.woodDark, 'opacity="0.6"'));

// a mud puddle, 240 across at the ground line (y=0), stretched to fit each strip
const mud = piece(
  'obj.mud',
  [-8, -20, 256, 40],
  path(blobPath([[0, 2], [20, -10], [70, -14], [120, -11], [170, -15], [222, -10], [240, 2], [200, 14], [120, 16], [40, 14]]), P.soilDark, 5) +
    ellipse(70, -4, 26, 5, P.soil, 0, 'opacity="0.8"') +
    ellipse(170, -5, 20, 4, P.soil, 0, 'opacity="0.8"') +
    circle(118, -8, 6, P.soil, 3) +
    circle(204, -3, 4, P.soil, 2.5) +
    circle(38, -3, 4, P.soil, 2.5),
);

// a boost strip: bright chevrons pointing on, 120 across at the ground line
const boost = piece(
  'obj.boost',
  [-6, -20, 132, 32],
  rrect(0, -14, 120, 22, 8, P.blueDark, 5) +
    [10, 46, 82].map((x) => path(`M${x} -10 L${x + 14} -10 L${x + 28} -3 L${x + 14} 4 L${x} 4 L${x + 14} -3 Z`, P.yellow, 3)).join('') +
    shine(26, -10, 14, 2.5, 0, 0.45),
);

// ---------------------------------------------------------------- effects and helper cues

const fx = [
  piece('fx.puff', [-60, -50, 120, 100], path(blobPath([[-50, 20], [-40, -20], [0, -42], [40, -22], [52, 18], [0, 40]]), '#ffffff', 4, 'opacity="0.95"') + circle(-18, -6, 6, '#e8eef2')),
  piece('fx.dust', [-24, -20, 48, 40], path(blobPath([[-20, 8], [-12, -12], [8, -16], [20, 4], [6, 16]]), '#f3e6cf', 3)),
  piece('fx.spark', [-30, -30, 60, 60], path('M0 -26 Q4 -4 26 0 Q4 4 0 26 Q-4 4 -26 0 Q-4 -4 0 -26 Z', P.yellow, 3.5)),
  piece('fx.star', [-22, -22, 44, 44], path('M0 -19 L5.5 -6 L19 -5.5 L8.5 3.5 L12 18 L0 10 L-12 18 L-8.5 3.5 L-19 -5.5 L-5.5 -6 Z', P.yellow, 3)),
  piece('fx.confetti.a', [-10, -6, 20, 12], rrect(-9, -5, 18, 10, 3, P.blue, 2.5)),
  piece('fx.confetti.b', [-10, -6, 20, 12], rrect(-9, -5, 18, 10, 3, P.pink, 2.5)),
  piece('fx.confetti.c', [-10, -6, 20, 12], rrect(-9, -5, 18, 10, 3, P.teal, 2.5)),
  piece('fx.ring', [-70, -24, 140, 48], ellipse(0, 0, 64, 18, 'none', 0, `stroke="#ffffff" stroke-width="7" opacity="0.9"`)),
  piece('fx.drop', [-10, -14, 20, 28], path('M0 -12 Q10 2 8 6 Q6 12 0 12 Q-6 12 -8 6 Q-10 2 0 -12 Z', P.waterLight, 2.5)),
  piece('fx.mud', [-12, -12, 24, 24], path(blobPath([[-9, 2], [-4, -9], [7, -7], [9, 4], [0, 9]]), P.soilDark, 2.5)),
  // the exhaust flame behind a boosting truck (points left, its base at x=0)
  piece('fx.flame', [-74, -26, 80, 52], path('M0 -18 Q-30 -22 -70 0 Q-30 22 0 18 Z', P.orange, 4) + path('M0 -9 Q-18 -11 -40 0 Q-18 11 0 9 Z', P.yellow, 0)),
  // a speed line
  piece('fx.speed', [-64, -6, 128, 12], line('M-58 0 L58 0', 6, '#ffffff', 'opacity="0.85"')),
  // a pointing hand (helper cue), fingertip at (0,0)
  piece(
    'fx.hand',
    [-40, -10, 100, 120],
    path('M-6 0 Q0 -6 6 0 L8 44 L30 40 Q46 40 48 56 L48 84 Q48 104 26 106 L4 106 Q-14 104 -20 88 L-30 60 Q-34 50 -24 48 Q-16 48 -10 58 L-8 64 Z', '#ffffff', 5) +
      line('M8 48 L8 66 M22 44 L22 66 M36 46 L36 66', 3, P.inkSoft),
  ),
  piece('fx.arrow', [-40, -60, 80, 120], path('M-16 -54 L16 -54 L16 4 L36 4 L0 52 L-36 4 L-16 4 Z', P.yellow, 6)),
  // thought bubble frame: the contents are drawn on top by the scene
  piece('fx.bubble', [-170, -130, 340, 300], path(blobPath([[-150, 0], [-130, -90], [-50, -120], [50, -118], [130, -92], [152, 0], [120, 90], [0, 110], [-120, 88]]), '#ffffff', 6) + circle(-60, 136, 16, '#ffffff', 5) + circle(-82, 160, 9, '#ffffff', 4)),
  // a frustrated little scribble (Milo, sometimes): grumbly, not angry
  piece('fx.scribble', [-50, -40, 100, 80], line('M-40 10 Q-30 -30 -10 0 Q4 24 14 -6 Q24 -34 38 4', 6, P.inkSoft) + line('M-30 26 L-20 18 M30 26 L22 18', 5, P.inkSoft)),
  piece('fx.check', [-50, -50, 100, 100], circle(0, 0, 44, P.teal, 6) + line('M-22 2 L-6 18 L24 -16', 12, '#ffffff')),
  piece('fx.heart', [-30, -28, 60, 56], path('M0 22 Q-28 4 -24 -12 Q-20 -24 -8 -22 Q-2 -20 0 -12 Q2 -20 8 -22 Q20 -24 24 -12 Q28 4 0 22 Z', P.pink, 4)),
];

export const WORLD_PIECES: ArtPiece[] = [
  sky,
  far,
  mid,
  ...clouds,
  ...props,
  log,
  crate,
  crateBit,
  mud,
  boost,
  brokenBridge,
  coin,
  acorn,
  pinwheelHead,
  pinwheelStick,
  ribbon,
  flagDown,
  flagUp,
  finish,
  signPost,
  signHigh,
  signLow,
  ...fx,
];
