import { P, mix } from '../palette';
import { type ArtPiece, artRng, blobPath, circle, ellipse, g, grain, hillPath, line, path, piece, rgrad, rrect, shadow, shine, vgrad } from '../svg';
import { roundTree } from './windmill';
import { FRUIT_COLORS, SHAPES, type Filling, type Fruit, type Shape } from '../../content/picnic/food';

/**
 * Picnic Meadow: the kitchen cart, the blanket, the four food stations, and
 * every snack. Big layers are authored in world coordinates (pivot = world
 * origin); small pieces have their pivot at their centre (or base for things
 * that sit on a surface). Gradient ids are prefixed per piece so inline DOM
 * copies never borrow each other's colours.
 */

const ids = (k: string) => (name: string) => `${k.replace(/\./g, '-')}-${name}`;

// ------------------------------------------------------------------ shapes shared by cutters, cookies and icons

function starPts(outer: number, inner: number): [number, number][] {
  const pts: [number, number][] = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const r = i % 2 ? inner : outer;
    pts.push([Math.cos(a) * r, Math.sin(a) * r + 4]);
  }
  return pts;
}

export function shapePath(shape: Shape): string {
  switch (shape) {
    case 'round':
      return 'M-58 0 A58 58 0 1 0 58 0 A58 58 0 1 0 -58 0 Z';
    case 'star':
      return 'M' + starPts(66, 32).map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(' L') + ' Z';
    case 'leaf':
      return 'M0 -64 C42 -40 48 22 0 64 C-48 22 -42 -40 0 -64 Z';
    case 'moon':
      return 'M18 -60 A62 62 0 1 0 18 60 A68 68 0 0 1 18 -60 Z';
    case 'lantern':
      return 'M-22 -62 L22 -62 L26 -48 Q58 0 30 48 L22 62 L-22 62 L-30 48 Q-58 0 -26 -48 Z';
  }
}

// ------------------------------------------------------------------ big layers (world coordinates)

const skyDay = piece(
  'pc.sky.day',
  [-240, -180, 2400, 900],
  `<rect x="-240" y="-180" width="2400" height="900" fill="url(#pc-sky-d)"/>` +
    circle(1640, 150, 70, '#fff3c4', 0, 'opacity="0.6"') +
    circle(1640, 150, 50, P.sun, 4) +
    [
      [300, 160, 1],
      [760, 90, 0.8],
      [1300, 220, 1.1],
      [2000, 120, 0.9],
    ]
      .map(([x, y, s]) => path(blobPath([[x - 90 * s, y + 20 * s], [x - 50 * s, y - 20 * s], [x, y - 36 * s], [x + 60 * s, y - 16 * s], [x + 100 * s, y + 20 * s]]), P.cloud, 4, 'opacity="0.95"'))
      .join(''),
  vgrad('pc-sky-d', P.skyTop, P.skyLow),
  true,
);

const skyDusk = (() => {
  const r = artRng(81);
  let body = `<rect x="-240" y="-180" width="2400" height="900" fill="url(#pc-sky-n)"/>`;
  for (let i = 0; i < 46; i++) body += circle(-200 + r() * 2300, -150 + r() * 560, 2 + r() * 3, '#fff8d8', 0, `opacity="${(0.5 + r() * 0.5).toFixed(2)}"`);
  body += path('M1700 70 A64 64 0 1 0 1764 160 A50 50 0 1 1 1700 70 Z', '#fff2c0', 4);
  return piece('pc.sky.dusk', [-240, -180, 2400, 900], body, vgrad('pc-sky-n', P.duskTop, P.duskLow), true);
})();

const meadow = (() => {
  const r = artRng(17);
  let body = '';
  body += path(hillPath(-240, 2160, 600, 1260, 7, 50, 3), mix(P.farHill, P.duskLow, 0.1));
  body += path(hillPath(-240, 2160, 650, 1260, 9, 34, 9), mix(P.farForest, P.grass, 0.3));
  for (let i = 0; i < 14; i++) body += roundTree(-200 + i * 180 + r() * 60, 670 + r() * 20, 0.45 + r() * 0.2, mix(P.midForest, P.leaf, 0.3), P.deepForest, P.bark, 300 + i);
  body += path(hillPath(-240, 2160, 700, 1260, 6, 18, 4), 'url(#pc-mg)');
  body += line('M-240 700 Q400 690 960 702 Q1500 712 2160 698', 5, P.ink, 'opacity="0.5"');
  // flowers and grass tufts
  for (let i = 0; i < 70; i++) {
    const x = -220 + r() * 2360;
    const y = 730 + r() * 500;
    if (r() < 0.5) body += line(`M${x} ${y} l-6 -16 M${x} ${y} l2 -20 M${x} ${y} l9 -14`, 3, P.grassDark, 'opacity="0.7"');
    else body += circle(x, y, 5 + r() * 3, [P.rose, P.cream, P.lilac, P.sun][i % 4], 2) + circle(x, y, 2, P.sun);
  }
  return piece('pc.meadow', [-240, 520, 2400, 740], body, vgrad('pc-mg', P.grassLight, P.grass), true);
})();

/** The big shady tree that stands between the kitchen and the blanket. */
const tree = piece(
  'pc.tree',
  [880, 40, 560, 720],
  path('M1120 760 Q1130 560 1112 400 L1180 400 Q1170 560 1196 760 Z', 'url(#pc-tr)', 5) +
    path('M1150 470 Q1100 440 1060 450 M1160 430 Q1210 400 1250 410', 'none', 0, `stroke="${P.barkDark}" stroke-width="10" stroke-linecap="round"`) +
    path(blobPath([[900, 330], [940, 190], [1040, 100], [1160, 60], [1300, 100], [1400, 200], [1420, 320], [1340, 420], [1200, 440], [1040, 430], [930, 400]]), P.grass, 5) +
    ellipse(1230, 320, 120, 70, P.grassDark, 0, 'opacity="0.35"') +
    ellipse(1040, 180, 70, 40, '#fff', 0, 'opacity="0.16"') +
    [[980, 260], [1120, 160], [1300, 230], [1210, 360], [1060, 360]].map(([x, y]) => circle(x, y, 9, P.berry, 2.5)).join(''),
  vgrad('pc-tr', P.bark, P.barkDark),
  true,
);

/** The kitchen cart: striped awning, posts, and a big tabletop seen from slightly above. */
const cart = (() => {
  let body = '';
  // posts
  body += rrect(60, 150, 26, 420, 8, P.woodDark, 4) + rrect(1000, 150, 26, 420, 8, P.woodDark, 4);
  // tabletop (back edge y 430, front edge y 1000)
  body += path('M100 430 L990 430 L1066 1000 L18 1000 Z', 'url(#pc-tt)', 6);
  for (let i = 1; i < 8; i++) {
    const xb = 100 + (890 * i) / 8;
    const xf = 18 + (1048 * i) / 8;
    body += line(`M${xb} 434 L${xf} 996`, 3, P.woodDark, 'opacity="0.25"');
  }
  body += grain(140, 520, 800, 400, 7, 6, P.woodDark);
  // front apron and wheels
  body += path('M18 1000 L1066 1000 L1060 1070 L24 1070 Z', P.wood, 6);
  body += circle(160, 1090, 56, P.woodDark, 6) + circle(160, 1090, 18, P.stone, 4) + circle(920, 1090, 56, P.woodDark, 6) + circle(920, 1090, 18, P.stone, 4);
  // awning with scalloped edge
  body += path('M20 40 L1080 40 L1100 150 L0 150 Z', P.cream, 6);
  for (let i = 0; i < 10; i++) body += path(`M${20 + i * 106} 40 L${73 + i * 106} 40 L${70 + i * 110} 150 L${i * 110} 150 Z`, i % 2 ? P.cream : P.berry, 0);
  body += path('M20 40 L1080 40 L1100 150 L0 150 Z', 'none', 6);
  let sc = 'M0 150';
  for (let i = 0; i < 10; i++) sc += ` Q${55 + i * 110} 210 ${110 + i * 110} 150`;
  body += path(sc + ' Z', P.berry, 5);
  body += rrect(380, 0, 340, 60, 26, P.woodLight, 5) + path('M420 30 Q550 -6 680 30', 'none', 0, `stroke="${P.woodDark}" stroke-width="5" stroke-linecap="round"`);
  return piece('pc.cart', [-20, -10, 1140, 1160], body, vgrad('pc-tt', '#e6b67c', '#c98d52'), true);
})();

// ------------------------------------------------------------------ the blanket (world coordinates)

const blanket = (() => {
  let body = '';
  body += path('M1140 728 L1860 728 L1888 1022 L1112 1022 Z', P.cream, 0);
  // checks: 8 columns × 4 rows in perspective
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 8; col++) {
      if ((row + col) % 2) continue;
      const t0 = row / 4;
      const t1 = (row + 1) / 4;
      const lx = (t: number) => 1140 - 28 * t;
      const rx = (t: number) => 1860 + 28 * t;
      const y = (t: number) => 728 + 294 * t;
      const x = (t: number, c: number) => lx(t) + ((rx(t) - lx(t)) * c) / 8;
      body += path(`M${x(t0, col)} ${y(t0)} L${x(t0, col + 1)} ${y(t0)} L${x(t1, col + 1)} ${y(t1)} L${x(t1, col)} ${y(t1)} Z`, P.berry, 0, 'opacity="0.85"');
    }
  }
  body += path('M1140 728 L1860 728 L1888 1022 L1112 1022 Z', 'none', 6);
  body += line('M1112 1022 L1888 1022', 10, mix(P.berry, P.ink, 0.3), 'opacity="0.6"');
  return piece('pc.blanket', [1100, 712, 800, 330], body, '', true);
})();

/** A flapping corner (pivot at the hinge; rotate to flap). */
const flap = piece('pc.flap', [-70, -70, 140, 80], path('M-60 0 L60 0 L0 -60 Z', P.cream, 5) + path('M-30 0 L0 -30 L30 0 Z', P.berry, 0, 'opacity="0.85"') + path('M-60 0 L60 0 L0 -60 Z', 'none', 5));

const CUSHION = [
  [P.sea, 'stripes'],
  [P.sun, 'dots'],
  [P.leaf, 'stars'],
  [P.plum, 'plain'],
  [P.pumpkin, 'flowers'],
] as const;
const cushions: ArtPiece[] = CUSHION.map(([c, pat], i) => {
  let body = shadow(0, 26, 78, 14) + path(blobPath([[-78, 0], [-60, -24], [0, -32], [60, -24], [78, 0], [60, 24], [0, 30], [-60, 24]]), c, 5);
  if (pat === 'stripes') body += line('M-50 -18 L-30 24 M-14 -26 L6 28 M24 -24 L44 22', 6, '#fff', 'opacity="0.7"');
  if (pat === 'dots') body += [[-40, -6], [-10, 10], [22, -10], [48, 8], [0, -18]].map(([x, y]) => circle(x, y, 6, '#fff', 0, 'opacity="0.8"')).join('');
  if (pat === 'stars') body += [[-36, 0], [10, -10], [44, 8]].map(([x, y]) => path(`M${x} ${y - 10} L${x + 3} ${y - 3} L${x + 10} ${y - 3} L${x + 4} ${y + 2} L${x + 6} ${y + 9} L${x} ${y + 5} L${x - 6} ${y + 9} L${x - 4} ${y + 2} L${x - 10} ${y - 3} L${x - 3} ${y - 3} Z`, '#fff', 0, 'opacity="0.85"')).join('');
  if (pat === 'flowers') body += [[-34, -4], [14, 6], [46, -10]].map(([x, y]) => circle(x, y, 8, '#fff', 0, 'opacity="0.8"') + circle(x, y, 3, P.sun)).join('');
  body += circle(0, 0, 5, mix(c, P.ink, 0.35)) + shine(-30, -14, 22, 7, -8, 0.35);
  return piece(`pc.cushion.${i}`, [-86, -40, 172, 84], body);
});

const plateSmall = piece('pc.plate.small', [-74, -26, 148, 52], ellipse(0, 4, 68, 20, P.white, 5) + ellipse(0, 2, 46, 12, 'none', 0, `stroke="${P.stone}" stroke-width="3"`));
const plate = piece('pc.plate', [-140, -36, 280, 72], ellipse(0, 6, 132, 28, P.white, 5) + ellipse(0, 3, 96, 17, 'none', 0, `stroke="${P.stone}" stroke-width="3"`));

// ------------------------------------------------------------------ dough station

const bowl = (() => {
  const k = ids('pc.bowl');
  return piece(
    'pc.bowl',
    [-170, -70, 340, 170],
    shadow(0, 90, 130, 12) + path('M-160 -30 Q-150 90 0 92 Q150 90 160 -30 Z', `url(#${k('g')})`, 6) + ellipse(0, -30, 160, 34, mix(P.sea, '#fff', 0.5), 6) + ellipse(0, -28, 136, 24, mix(P.sea, P.ink, 0.25), 0, 'opacity="0.4"') + shine(-90, 20, 26, 12, -30, 0.3),
    vgrad(k('g'), mix(P.sea, '#fff', 0.2), P.sea),
  );
})();

const dough = (() => {
  const k = ids('pc.dough');
  return piece('pc.dough', [-120, -130, 240, 140], path(blobPath([[-110, 0], [-96, -60], [-40, -110], [30, -118], [90, -80], [112, -20], [110, 0]]), `url(#${k('g')})`, 5) + shine(-36, -80, 30, 14, -20, 0.5), vgrad(k('g'), '#fbedd1', '#efd3a1'));
})();
const doughLumps = piece('pc.dough.lumps', [-120, -130, 240, 140], [[-60, -40, 16], [-10, -84, 12], [44, -54, 18], [70, -20, 11], [-30, -16, 13], [10, -30, 9]].map(([x, y, r]) => circle(x, y, r, '#e3c289', 3, 'opacity="0.9"')).join(''));
const doughSheet = (() => {
  const k = ids('pc.dough.sheet');
  return piece('pc.dough.sheet', [-190, -80, 380, 160], path(blobPath([[-180, 0], [-150, -60], [-40, -72], [80, -68], [176, -40], [184, 20], [140, 64], [0, 72], [-130, 62]]), `url(#${k('g')})`, 5) + shine(-80, -36, 50, 12, -6, 0.4), vgrad(k('g'), '#fbedd1', '#efd3a1'));
})();
const board = piece('pc.board', [-220, -100, 440, 200], rrect(-210, -90, 420, 180, 30, P.woodLight, 6) + rrect(160, -24, 60, 48, 20, P.woodLight, 6) + circle(194, 0, 9, P.woodDark, 3) + grain(-190, -70, 340, 140, 12, 4, P.wood));
const pin = piece('pc.pin', [-210, -30, 420, 60], rrect(-210, -12, 60, 24, 12, P.wood, 4) + rrect(150, -12, 60, 24, 12, P.wood, 4) + rrect(-156, -26, 312, 52, 24, P.woodLight, 5) + grain(-140, -20, 280, 40, 33, 3, P.wood));

const cutters: ArtPiece[] = SHAPES.map((s) =>
  piece(
    `pc.cutter.${s}`,
    [-80, -80, 160, 160],
    shadow(0, 70, 56, 8) + path(shapePath(s), 'none', 0, `stroke="${P.ink}" stroke-width="20" stroke-linejoin="round" transform="scale(1.02)"`) + path(shapePath(s), 'none', 0, `stroke="#dfe7ea" stroke-width="12" stroke-linejoin="round"`) + path(shapePath(s), 'none', 0, `stroke="#ffffff" stroke-width="3" stroke-linejoin="round" opacity="0.8" transform="translate(-2 -3)"`),
  ),
);

/** Cookies: soft ones are pale and puffy with a shine; crunchy ones are golden with cracks (not just a colour change). */
function cookieArt(s: Shape, texture: 'soft' | 'crunchy'): ArtPiece {
  const key = `pc.cookie.${s}.${texture}`;
  const k = ids(key);
  const d = shapePath(s);
  const soft = texture === 'soft';
  let inner = '';
  if (soft) {
    inner += shine(-18, -24, 22, 12, -25, 0.55) + [[-10, 12], [16, -4], [6, 26], [-26, -4]].map(([x, y]) => ellipse(x, y, 5, 3.5, '#f9e9c6', 0, 'opacity="0.9"')).join('');
  } else {
    inner +=
      line('M-40 -10 L-20 -2 L-26 14 L-6 22', 4, '#8c5220', 'opacity="0.8"') +
      line('M10 -36 L18 -16 L36 -12', 4, '#8c5220', 'opacity="0.8"') +
      line('M16 24 L28 8 L44 16', 4, '#8c5220', 'opacity="0.8"') +
      [[-14, -26], [26, 30], [-32, 26]].map(([x, y]) => circle(x, y, 4, '#7a4520')).join('');
  }
  const crumbs = soft ? '' : circle(56, 56, 4, '#c98840', 2) + circle(-50, 60, 3, '#c98840', 2);
  return piece(
    key,
    [-76, -76, 152, 152],
    shadow(0, 62, 50, 7) + path(d, `url(#${k('g')})`, 5) + `<g clip-path="url(#${k('c')})">${inner}</g>` + path(d, 'none', 0, `stroke="${soft ? '#e0b978' : '#a3611f'}" stroke-width="5" opacity="0.6" transform="scale(0.84)"`) + crumbs,
    (soft ? vgrad(k('g'), '#f9e3b4', '#ecc98a') : vgrad(k('g'), '#e6a95c', '#b8732f')) + `<clipPath id="${k('c')}"><path d="${d}"/></clipPath>`,
  );
}
const cookies: ArtPiece[] = SHAPES.flatMap((s) => [cookieArt(s, 'soft'), cookieArt(s, 'crunchy')]);

const oven = (() => {
  const k = ids('pc.oven');
  return piece(
    'pc.oven',
    [-160, -250, 320, 280],
    shadow(0, 20, 150, 12) +
      path('M-150 20 L-150 -90 Q-150 -240 0 -240 Q150 -240 150 -90 L150 20 Z', `url(#${k('g')})`, 6) +
      [[-90, -150], [40, -190], [90, -60], [-110, -40], [-20, -200]].map(([x, y]) => rrect(x, y, 46, 24, 10, mix(P.pumpkinDark, P.stone, 0.4), 3, 'opacity="0.8"')).join('') +
      path('M-80 10 L-80 -60 Q-80 -110 0 -110 Q80 -110 80 -60 L80 10 Z', '#3b2a20', 5) +
      rrect(-30, -276, 60, 50, 8, P.stoneDark, 5),
    vgrad(k('g'), '#e39a6a', '#b9673c'),
  );
})();
const ovenGlow = piece('pc.oven.glow', [-80, -110, 160, 120], path('M-74 6 L-74 -58 Q-74 -104 0 -104 Q74 -104 74 -58 L74 6 Z', 'url(#pc-oven-glow-g)', 0), rgrad('pc-oven-glow-g', '#ffd76a', '#ff8a3a', 1, 0.6));

// ------------------------------------------------------------------ sandwich station

const bread = (top: boolean) => {
  const key = top ? 'pc.bread.top' : 'pc.bread.bottom';
  const k = ids(key);
  const body = top
    ? path('M-118 20 L-118 -6 Q-118 -46 -60 -48 Q0 -50 60 -48 Q118 -46 118 -6 L118 20 Z', `url(#${k('g')})`, 5) + line('M-100 4 Q0 12 100 4', 3, '#c98a4c', 'opacity="0.6"') + shine(-50, -30, 40, 9, -4, 0.4) + [[-60, -22], [-10, -32], [40, -24], [80, -14]].map(([x, y]) => ellipse(x, y, 5, 2.5, '#fff4dc', 0, 'opacity="0.8"')).join('')
    : rrect(-118, -18, 236, 36, 14, `url(#${k('g')})`, 5) + line('M-104 -4 Q0 4 104 -4', 3, '#c98a4c', 'opacity="0.5"');
  return piece(key, top ? [-126, -56, 252, 84] : [-126, -26, 252, 52], body, vgrad(k('g'), '#f4c27c', '#d38e48'));
};

function fillingBody(f: Filling): string {
  switch (f) {
    case 'cheese':
      return path('M-112 -10 L112 -10 L112 6 L90 6 Q84 22 76 6 L-40 6 Q-48 26 -56 6 L-112 6 Z', '#f7cf4a', 4.5) + circle(-70, -2, 5, '#e2a92a') + circle(20, -1, 4, '#e2a92a') + circle(60, -3, 3, '#e2a92a');
    case 'cucumber':
      return [-90, -45, 0, 45, 90].map((x) => ellipse(x, 0, 26, 11, '#9ccf62', 4) + ellipse(x, 0, 16, 6, '#d8efb4', 0)).join('');
    case 'jam':
      return path('M-112 -8 Q-80 -14 -40 -8 Q0 -2 40 -9 Q80 -15 112 -8 L112 6 Q90 12 70 6 Q40 22 20 6 Q-20 10 -60 6 Q-80 18 -100 6 L-112 6 Z', '#c9344a', 4.5) + shine(-30, -4, 22, 3, 0, 0.5);
    case 'lettuce':
      return path('M-118 4 Q-110 -14 -90 -6 Q-80 -20 -60 -8 Q-44 -22 -24 -8 Q-6 -20 12 -8 Q30 -22 48 -8 Q66 -20 84 -8 Q104 -18 118 4 Q100 14 80 8 Q60 16 40 8 Q20 16 0 8 Q-20 16 -40 8 Q-60 16 -80 8 Q-100 14 -118 4 Z', '#7fc05a', 4.5) + line('M-100 0 L100 0', 3, '#b8e08c', 'opacity="0.8"');
    case 'tomato':
      return [-72, 0, 72].map((x) => ellipse(x, 0, 38, 12, '#e8553f', 4) + circle(x - 12, 0, 3, '#f9d08a') + circle(x + 10, -1, 3, '#f9d08a')).join('');
  }
}
const FILL_LIST: Filling[] = ['cheese', 'cucumber', 'jam', 'lettuce', 'tomato'];
const fillings: ArtPiece[] = FILL_LIST.map((f) => piece(`pc.fill.${f}`, [-124, -26, 248, 52], fillingBody(f)));
/** Little serving dishes holding each filling (what the child taps). */
const fillDishes: ArtPiece[] = FILL_LIST.map((f) =>
  piece(`pc.dish.${f}`, [-90, -60, 180, 110], shadow(0, 40, 74, 8) + path('M-80 -6 Q-74 40 0 42 Q74 40 80 -6 Z', P.white, 5) + g(fillingBody(f), 'translate(0 -10) scale(0.6)') + ellipse(0, -6, 80, 12, 'none', 5)),
);

// ------------------------------------------------------------------ juice station

const jug = (() => {
  const k = ids('pc.jug');
  return piece(
    'pc.jug',
    [-110, -300, 220, 320],
    // glass jar (liquid is a separate tinted layer underneath)
    path('M-78 -250 L78 -250 L64 -10 L-64 -10 Z', '#dff3f5', 5, 'fill-opacity="0.35"') +
      line('M-56 -220 L-46 -40', 8, '#fff', 'opacity="0.6"') +
      [-200, -150, -100].map((y) => line(`M48 ${y} L64 ${y}`, 4, P.inkSoft, 'opacity="0.7"')).join('') +
      path('M78 -230 Q130 -220 120 -150 Q112 -100 70 -110', 'none', 0, `stroke="${P.ink}" stroke-width="20" stroke-linecap="round"`) +
      path('M78 -230 Q130 -220 120 -150 Q112 -100 70 -110', 'none', 0, `stroke="#dff3f5" stroke-width="10" stroke-linecap="round"`) +
      rrect(-88, -276, 176, 30, 12, P.plum, 5) +
      rrect(-20, -298, 40, 26, 10, P.plum, 4) +
      // base with the big button
      path('M-96 -14 L96 -14 L110 20 L-110 20 Z', `url(#${k('b')})`, 5),
    vgrad(k('b'), P.stone, P.stoneDark),
  );
})();
const jugLiquid = piece('pc.jug.liquid', [-80, -250, 160, 250], path('M-74 -240 L74 -240 L62 -12 L-62 -12 Z', '#ffffff'));
const blendButton = piece('pc.jug.button', [-46, -46, 92, 92], circle(0, 0, 40, P.berry, 6) + path('M-14 -18 L20 0 L-14 18 Z', '#fff', 3) + shine(-12, -16, 14, 7, -30, 0.45));

function fruitBody(f: Fruit): string {
  const c = FRUIT_COLORS[f];
  switch (f) {
    case 'berry':
      return path('M0 40 Q-40 10 -36 -14 Q-30 -36 0 -30 Q30 -36 36 -14 Q40 10 0 40 Z', c, 5) + [[-14, -12], [10, -16], [0, 6], [-18, 10], [16, 8], [0, 24]].map(([x, y]) => ellipse(x, y, 2.5, 4, '#ffe08a')).join('') + path('M-16 -32 L0 -40 L16 -32 L6 -28 L0 -36 L-6 -28 Z', P.leaf, 3);
    case 'sunfruit':
      return circle(0, 4, 38, c, 5) + [[-12, -6], [14, 10], [-6, 20], [18, -12]].map(([x, y]) => circle(x, y, 2, '#e08a1a')).join('') + path('M0 -34 Q14 -50 30 -44 Q20 -30 0 -34 Z', P.leaf, 3) + shine(-14, -12, 12, 7, -30, 0.4);
    case 'apple':
      return path('M0 -24 Q30 -42 40 -6 Q44 34 14 40 Q4 36 0 38 Q-4 36 -14 40 Q-44 34 -40 -6 Q-30 -42 0 -24 Z', c, 5) + line('M0 -24 Q2 -36 8 -44', 4, P.woodDark) + path('M6 -36 Q22 -50 32 -40 Q20 -30 6 -36 Z', P.leaf, 3) + shine(-18, -8, 10, 14, -10, 0.4);
    case 'plum':
      return ellipse(0, 4, 34, 38, c, 5) + line('M8 -28 Q-6 4 6 38', 3, mix(c, P.ink, 0.35), 'opacity="0.6"') + line('M0 -32 L4 -44', 4, P.woodDark) + shine(-14, -12, 9, 14, -10, 0.4);
  }
}
const FRUIT_LIST: Fruit[] = ['berry', 'sunfruit', 'apple', 'plum'];
const fruits: ArtPiece[] = FRUIT_LIST.map((f) => piece(`pc.fruit.${f}`, [-50, -56, 100, 106], fruitBody(f)));

const cup = (size: 'small' | 'big') => {
  const h = size === 'big' ? 170 : 110;
  const w = size === 'big' ? 56 : 44;
  const key = `pc.cup.${size}`;
  return [
    piece(key, [-w - 14, -h - 20, 2 * w + 28, h + 34], shadow(0, 8, w + 6, 7) + path(`M${-w} ${-h} L${w} ${-h} L${w - 10} 0 L${-w + 10} 0 Z`, '#e6f6f8', 5, 'fill-opacity="0.25"') + line(`M${-w + 12} ${-h + 14} L${-w + 20} -14`, 7, '#fff', 'opacity="0.7"') + line(`M${w - 18} ${-h * 0.5} L${w - 6} ${-h * 0.5}`, 3, P.inkSoft, 'opacity="0.5"')),
    piece(`${key}.fill`, [-w, -h, 2 * w, h], path(`M${-w + 4} ${-h + 4} L${w - 4} ${-h + 4} L${w - 13} -4 L${-w + 13} -4 Z`, '#ffffff')),
  ];
};
const cups = [...cup('small'), ...cup('big')];
const saucer = piece('pc.saucer', [-86, -20, 172, 40], ellipse(0, 4, 80, 14, P.white, 5) + ellipse(0, 2, 50, 7, 'none', 0, `stroke="${P.stone}" stroke-width="3"`));
const straw = piece('pc.straw', [-10, -90, 50, 100], line('M0 0 L10 -60 L34 -84', 12, P.ink) + line('M0 0 L10 -60 L34 -84', 7, P.berry) + line('M2 -10 L6 -34 M11 -60 L22 -71', 7, '#fff', 'opacity="0.8"'));

// ------------------------------------------------------------------ decorate station

const sprinkle = piece('pc.sprinkle', [-12, -6, 24, 12], rrect(-10, -4, 20, 8, 4, '#ffffff', 2.5));
const dotDeco = piece('pc.dotdeco', [-10, -10, 20, 20], circle(0, 0, 7, '#ffffff', 2.5));
const leafDeco = piece('pc.leafdeco', [-16, -10, 32, 20], path('M-13 0 Q0 -12 13 0 Q0 12 -13 0 Z', P.leaf, 2.5) + line('M-9 0 L9 0', 2, P.grassDark));
const toolSprinkles = piece('pc.tool.sprinkles', [-50, -80, 100, 140], rrect(-34, -30, 68, 86, 18, P.cream, 5) + [[-14, 0], [12, 16], [-4, 34], [16, -12]].map(([x, y], i) => rrect(x - 7, y - 3, 14, 6, 3, [P.berry, P.sea, P.sun, P.leaf][i], 2)).join('') + path('M-34 -30 L-26 -64 L26 -64 L34 -30 Z', P.plum, 5) + [-12, 0, 12].map((x) => circle(x, -50, 3, P.ink)).join(''));
const toolDots = piece('pc.tool.dots', [-50, -80, 100, 140], rrect(-12, -70, 24, 70, 10, P.woodLight, 4.5) + rrect(-40, -6, 80, 30, 12, P.sea, 5) + circle(-16, 44, 9, P.berry, 3) + circle(16, 44, 9, P.sun, 3) + circle(0, 52, 6, P.sea, 2.5));
const toolLeaves = piece('pc.tool.leaves', [-50, -80, 100, 140], rrect(-12, -70, 24, 70, 10, P.woodLight, 4.5) + rrect(-40, -6, 80, 30, 12, P.leaf, 5) + path('M-30 44 Q-8 26 14 44 Q-8 60 -30 44 Z', P.leaf, 3) + path('M2 54 Q20 40 38 54 Q20 66 2 54 Z', P.leaf, 3));
const toolSwirl = piece('pc.tool.swirl', [-60, -80, 120, 150], path('M-40 -60 L40 -60 L8 40 L-8 40 Z', P.white, 5) + path('M-40 -60 L40 -60 L30 -30 L-30 -30 Z', P.rose, 0, 'opacity="0.7"') + rrect(-6, 36, 12, 16, 4, P.stone, 3) + line('M-4 58 Q-24 64 -10 70 Q10 76 -6 82', 6, P.rose));

// ------------------------------------------------------------------ serving and wishes

const tray = piece('pc.tray', [-190, -60, 380, 120], shadow(0, 46, 170, 10) + rrect(-180, -40, 360, 80, 22, P.woodLight, 6) + rrect(-160, -26, 320, 52, 14, '#f0c48a', 0) + rrect(-196, -16, 26, 32, 10, P.wood, 4) + rrect(170, -16, 26, 32, 10, P.wood, 4));
const bubble = piece(
  'pc.bubble',
  [-140, -120, 280, 210],
  path('M-120 -60 Q-120 -110 -60 -110 L60 -110 Q120 -110 120 -60 L120 30 Q120 70 70 70 L20 70 L0 96 L-20 70 L-70 70 Q-120 70 -120 30 Z', P.white, 5),
);
const wiQuiet = piece('pc.wi.quiet', [-34, -34, 68, 68], circle(0, 0, 30, P.lilac, 4) + path('M8 -18 A18 18 0 1 0 18 8 A13 13 0 1 1 8 -18 Z', P.white, 3) + line('M-20 -12 L-10 -12 L-20 -2 L-10 -2', 3, P.ink));
const wiMusic = piece('pc.wi.music', [-34, -34, 68, 68], circle(0, 0, 30, P.sun, 4) + line('M-8 12 L-8 -16 L14 -20 L14 8', 4, P.ink) + ellipse(-13, 13, 7, 5, P.ink) + ellipse(9, 9, 7, 5, P.ink));
const heartPop = piece('pc.heart', [-30, -28, 60, 56], path('M0 24 Q-28 4 -22 -12 Q-14 -26 0 -12 Q14 -26 22 -12 Q28 4 0 24 Z', P.berry, 4) + shine(-10, -10, 6, 4, -30, 0.5));

// ------------------------------------------------------------------ windy picnic

const heavyLight = {
  stone: shadow(0, 26, 46, 7) + path(blobPath([[-44, 20], [-38, -10], [-10, -26], [24, -24], [44, 0], [40, 24]]), P.stone, 5) + shine(-14, -10, 14, 6, -10, 0.4),
  teapot: shadow(0, 30, 50, 7) + path('M40 -6 Q66 -16 62 -40', 'none', 0, `stroke="${P.ink}" stroke-width="13" stroke-linecap="round"`) + path('M40 -6 Q66 -16 62 -40', 'none', 0, `stroke="${P.sea}" stroke-width="6" stroke-linecap="round"`) + path('M-36 -2 Q-62 -6 -56 18', 'none', 0, `stroke="${P.ink}" stroke-width="13" stroke-linecap="round"`) + ellipse(0, 0, 44, 32, P.sea, 5) + rrect(-18, -40, 36, 12, 6, P.sea, 4) + circle(0, -44, 6, P.sun, 3) + shine(-16, -10, 12, 7, -20, 0.4),
  book: shadow(0, 28, 50, 7) + rrect(-48, -20, 96, 44, 6, P.berry, 5) + rrect(-44, 10, 88, 10, 3, P.cream, 3) + line('M-30 -6 L20 -6', 4, P.sun),
  pumpkin: shadow(0, 30, 50, 7) + ellipse(-18, 0, 26, 30, P.pumpkin, 5) + ellipse(18, 0, 26, 30, P.pumpkin, 5) + ellipse(0, 0, 22, 32, mix(P.pumpkin, '#fff', 0.15), 5) + rrect(-5, -42, 10, 16, 3, P.woodDark, 3),
  feather: path('M-40 20 Q-10 -30 40 -30 Q10 0 -40 20 Z', P.white, 4) + line('M-44 24 Q0 -6 36 -26', 3, P.inkSoft),
  cup: path('M-24 -26 L24 -26 L18 26 L-18 26 Z', P.white, 4) + line('M-20 -10 L20 -10', 3, P.sea) + line('M-18 4 L18 4', 3, P.berry),
  leaf: path('M-36 10 Q-6 -40 38 -14 Q8 30 -36 10 Z', P.leaf, 4) + line('M-30 8 L30 -12', 3, P.grassDark),
};
const weights: ArtPiece[] = (Object.keys(heavyLight) as (keyof typeof heavyLight)[]).map((w) => piece(`pc.w.${w}`, [-70, -60, 140, 100], heavyLight[w]));
const basket = piece(
  'pc.basket',
  [-90, -110, 180, 150],
  shadow(0, 30, 80, 9) + path('M-60 -30 Q0 -120 60 -30', 'none', 0, `stroke="${P.ink}" stroke-width="16" stroke-linecap="round"`) + path('M-60 -30 Q0 -120 60 -30', 'none', 0, `stroke="${P.woodLight}" stroke-width="8" stroke-linecap="round"`) + rrect(-76, -34, 152, 64, 12, '#d9b56c', 5) + line('M-70 -14 L70 -14 M-70 6 L70 6', 3, '#a8823e') + line('M-50 -32 L-50 28 M-20 -32 L-20 28 M10 -32 L10 28 M40 -32 L40 28', 3, '#a8823e', 'opacity="0.7"') + rrect(-80, -40, 160, 14, 6, P.berry, 4),
);
const cooler = piece('pc.cooler', [-80, -80, 160, 120], shadow(0, 30, 70, 8) + rrect(-66, -50, 132, 80, 12, P.sea, 5) + rrect(-72, -60, 144, 22, 9, P.white, 5) + rrect(-24, -76, 48, 18, 8, P.white, 4));
const umbrella = piece(
  'pc.umbrella',
  [-170, -320, 340, 340],
  line('M0 0 L0 -270', 10, P.ink) + line('M0 0 L0 -270', 5, P.woodLight) + path('M-160 -200 Q-150 -300 0 -310 Q150 -300 160 -200 Q120 -224 80 -200 Q40 -226 0 -200 Q-40 -226 -80 -200 Q-120 -224 -160 -200 Z', P.sun, 6) + path('M-80 -200 Q-60 -290 0 -310 Q-30 -270 -40 -204 Z', P.berry, 0, 'opacity="0.85"') + path('M80 -200 Q60 -290 0 -310 Q30 -270 40 -204 Z', P.berry, 0, 'opacity="0.85"') + circle(0, -312, 8, P.woodDark, 3),
);
const umbrellaFlip = piece(
  'pc.umbrella.flip',
  [-170, -400, 340, 420],
  line('M0 0 L0 -270', 10, P.ink) + line('M0 0 L0 -270', 5, P.woodLight) + path('M-150 -370 Q-110 -300 0 -270 Q110 -300 150 -370 Q100 -330 70 -350 Q30 -300 0 -340 Q-30 -300 -70 -350 Q-100 -330 -150 -370 Z', P.sun, 6) + path('M-70 -350 Q-40 -300 0 -272 Q-20 -310 -30 -318 Z', P.berry, 0, 'opacity="0.85"'),
);
const cushWall = piece(
  'pc.cushwall',
  [-100, -260, 200, 270],
  [0, 1, 2, 3].map((i) => g(path(blobPath([[-80, 0], [-60, -26], [0, -34], [60, -26], [80, 0], [60, 24], [0, 30], [-60, 24]]), [P.sea, P.sun, P.leaf, P.plum][i], 5), `translate(${(i % 2 ? 8 : -6)} ${-26 - i * 56})`)).join(''),
);
const windCurl = piece('pc.windcurl', [-100, -40, 200, 80], line('M90 -20 Q20 -30 -20 -18 Q-60 -6 -50 10 Q-40 22 -26 10', 7, '#fff', 'opacity="0.9"') + line('M80 18 Q30 10 -10 22', 6, '#fff', 'opacity="0.7"'));
const napkin = piece('pc.napkin', [-50, -40, 100, 80], path('M-40 -30 L40 -24 L36 30 L-34 26 Z', P.white, 4) + line('M-30 -14 L30 -10 M-28 2 L30 6', 3, P.sea, 'opacity="0.6"'));

// ------------------------------------------------------------------ music picnic

const drum = piece(
  'pc.drum',
  [-90, -120, 180, 150],
  shadow(0, 20, 80, 10) + path('M-74 -70 L-74 0 Q0 30 74 0 L74 -70 Z', P.berry, 5) + line('M-74 -64 L-40 0 L0 -64 L40 0 L74 -64', 4, P.cream) + ellipse(0, -70, 74, 24, P.cream, 5) + line('M20 -150 L-4 -84', 6, P.woodDark) + circle(22, -152, 9, P.sun, 3),
);
const note = piece('pc.note', [-24, -40, 48, 60], line('M6 12 L6 -30 L18 -22', 5, P.ink) + ellipse(-2, 12, 10, 8, P.ink));

// ------------------------------------------------------------------ lantern picnic

const lantern = (on: boolean) =>
  piece(
    on ? 'pc.lantern.on' : 'pc.lantern.off',
    [-50, -80, 100, 140],
    line('M0 -76 L0 -60', 4, P.ink) +
      rrect(-20, -62, 40, 12, 4, P.woodDark, 3.5) +
      path('M-26 -50 Q-48 0 -26 44 L26 44 Q48 0 26 -50 Z', on ? P.lantern : mix(P.lantern, P.stone, 0.55), 5) +
      line('M-12 -48 Q-20 0 -12 42 M12 -48 Q20 0 12 42', 3, on ? '#e3a032' : P.stoneDark, 'opacity="0.7"') +
      rrect(-16, 44, 32, 10, 4, P.woodDark, 3.5) +
      (on ? shine(-8, -14, 9, 18, 0, 0.5) : ''),
  );
const glow = piece('pc.glow', [-100, -100, 200, 200], circle(0, 0, 96, 'url(#pc-glow-g)'), rgrad('pc-glow-g', '#fff2b0', '#ffd76a', 0.7, 0));
const firefly = piece('pc.firefly', [-16, -16, 32, 32], circle(0, 0, 14, 'url(#pc-ff-g)') + circle(0, 0, 4, '#fff8c8'), rgrad('pc-ff-g', '#fff6a0', '#ffe066', 0.9, 0));
const pole = piece('pc.pole', [-20, -420, 40, 430], rrect(-9, -410, 18, 410, 7, P.woodDark, 4) + circle(0, -414, 10, P.sun, 3));

// ------------------------------------------------------------------ parade and extras

const bunting = piece(
  'pc.bunting',
  [0, -10, 960, 110],
  line('M0 0 Q480 50 960 0', 4, P.ink) + Array.from({ length: 12 }, (_, i) => {
    const x = 40 + i * 78;
    const y = 4 + 50 * (1 - Math.pow((x - 480) / 480, 2)) * 0.95;
    return path(`M${x - 26} ${y} L${x + 26} ${y} L${x} ${y + 52} Z`, [P.berry, P.sun, P.sea, P.leaf, P.plum, P.pumpkin][i % 6], 4);
  }).join(''),
);
const bell = piece('pc.bell', [-60, -90, 120, 110], shadow(0, 16, 46, 7) + rrect(-6, -90, 12, 26, 5, P.woodDark, 3) + path('M-40 6 Q-44 -64 0 -70 Q44 -64 40 6 Z', P.lantern, 5) + rrect(-48, 0, 96, 14, 6, P.woodDark, 4) + circle(0, 20, 9, P.woodDark, 3) + shine(-16, -40, 9, 20, 0, 0.45));
const doneBtn = piece('pc.done', [-56, -56, 112, 112], circle(0, 0, 50, P.leaf, 6) + line('M-22 2 L-6 18 L24 -16', 12, '#fff') + shine(-18, -22, 16, 8, -30, 0.35));
const camera = piece('pc.camera', [-60, -50, 120, 90], rrect(-54, -30, 108, 66, 12, P.inkSoft, 5) + rrect(-30, -44, 34, 18, 6, P.inkSoft, 4) + circle(0, 4, 24, P.sea, 5) + circle(0, 4, 12, P.ink) + circle(-6, -2, 4, '#fff', 0, 'opacity="0.8"') + rrect(30, -24, 16, 10, 3, P.sun, 2.5));

/** Scenario cards for the picker. */
const cardFrame = (k: string, inner: string) => piece(k, [-100, -70, 200, 140], rrect(-96, -66, 192, 132, 18, P.cream, 5) + inner);
const cardWindy = cardFrame('pc.card.windy', path('M-70 40 L70 40 L60 0 L-60 0 Z', P.berry, 4) + line('M60 -40 Q0 -50 -30 -36 Q-60 -22 -50 -6', 6, P.sea) + line('M70 -14 Q30 -20 0 -10', 5, P.sea) + path('M-40 -2 L-20 -40 L0 -2 Z', P.sun, 3));
const cardMusic = cardFrame('pc.card.music', g(drum.body, 'translate(-20 40) scale(0.55)') + g(note.body, 'translate(50 -14)') + g(note.body, 'translate(20 -36) scale(0.8)'));
const cardLantern = cardFrame('pc.card.lantern', `<rect x="-90" y="-60" width="180" height="120" rx="14" fill="${P.duskTop}" opacity="0.8"/>` + g(lantern(true).body, 'translate(-36 6) scale(0.7)') + g(lantern(true).body, 'translate(36 -6) scale(0.7)') + circle(64, -40, 10, '#fff2c0'));

/** Station tab icons (DOM). */
/** Copy a piece under a new key, renaming its gradient/clip ids so inline copies stay independent. */
function alias(src: ArtPiece, key: string, box = src.box): ArtPiece {
  const from = new RegExp(src.key.replace(/\./g, '-'), 'g');
  const to = key.replace(/\./g, '-');
  return piece(key, box, src.body.replace(from, to), (src.defs ?? '').replace(from, to));
}
const icCookie = alias(cookieArt('star', 'crunchy'), 'pc.ic.cookie');
const icSandwich = (() => {
  const top = alias(bread(true), 'pc.ic.sw.top');
  const bot = alias(bread(false), 'pc.ic.sw.bot');
  return piece(
    'pc.ic.sandwich',
    [-130, -110, 260, 200],
    g(bot.body, 'translate(0 60)') + g(fillingBody('lettuce'), 'translate(0 34)') + g(fillingBody('tomato'), 'translate(0 14)') + g(fillingBody('cheese'), 'translate(0 -4)') + g(top.body, 'translate(0 -24)'),
    (top.defs ?? '') + (bot.defs ?? ''),
  );
})();
const icJuice = piece('pc.ic.juice', [-80, -200, 160, 220], path('M-52 -150 L52 -150 L42 0 L-42 0 Z', P.pumpkin, 5) + path('M-56 -170 L56 -170 L46 0 L-46 0 Z', '#e6f6f8', 5, 'fill-opacity="0.25"') + g(straw.body, 'translate(10 -150)') + g(fruitBody('sunfruit'), 'translate(50 -170) scale(0.6)'));
const icDecorate = piece('pc.ic.decorate', [-60, -90, 120, 160], toolSprinkles.body);
const icAlbum = piece('pc.ic.album', [-70, -60, 140, 120], rrect(-60, -50, 120, 100, 10, P.berry, 5) + rrect(-44, -36, 88, 64, 6, P.cream, 4) + path('M-36 20 L-10 -6 L8 12 L20 0 L36 20 Z', P.leaf, 3) + circle(22, -18, 7, P.sun, 2.5));

export const PICNIC_PIECES: ArtPiece[] = [
  skyDay,
  skyDusk,
  meadow,
  tree,
  cart,
  blanket,
  flap,
  ...cushions,
  plateSmall,
  plate,
  bowl,
  dough,
  doughLumps,
  doughSheet,
  board,
  pin,
  ...cutters,
  ...cookies,
  oven,
  ovenGlow,
  bread(false),
  bread(true),
  ...fillings,
  ...fillDishes,
  jug,
  jugLiquid,
  blendButton,
  ...fruits,
  ...cups,
  saucer,
  straw,
  sprinkle,
  dotDeco,
  leafDeco,
  toolSprinkles,
  toolDots,
  toolLeaves,
  toolSwirl,
  tray,
  bubble,
  wiQuiet,
  wiMusic,
  heartPop,
  ...weights,
  basket,
  cooler,
  umbrella,
  umbrellaFlip,
  cushWall,
  windCurl,
  napkin,
  drum,
  note,
  lantern(false),
  lantern(true),
  glow,
  firefly,
  pole,
  bunting,
  bell,
  doneBtn,
  camera,
  cardWindy,
  cardMusic,
  cardLantern,
  icCookie,
  icSandwich,
  icJuice,
  icDecorate,
  icAlbum,
];

/** Pieces the clubhouse needs to redraw a saved picnic (no scenery). */
export const PICNIC_DISH_KEYS: string[] = PICNIC_PIECES.filter((p) => /^pc\.(cookie|bread|fill\.|cup|straw|sprinkle|dotdeco|leafdeco|fruit|plate\.small|cushion)/.test(p.key)).map((p) => p.key);
