import { P, mix } from '../palette';
import { type ArtPiece, artRng, blobPath, circle, dgrad, ellipse, g, grain, line, path, piece, rrect, shine, vgrad } from '../svg';
import { WORLD_W, groundY, L, SAIL_LEN } from '../../content/trail/windmillModel';

/** Windmill Hill: layered paper scenery and every prop used by The Windmill Kite. */

// ------------------------------------------------------------------ helpers

function groundPathD(x0: number, x1: number, offset: number, bottom: number, step = 20): string {
  let d = `M${x0} ${(groundY(x0) + offset).toFixed(1)}`;
  for (let x = x0 + step; x <= x1; x += step) d += ` L${x} ${(groundY(x) + offset).toFixed(1)}`;
  d += ` L${x1} ${(groundY(x1) + offset).toFixed(1)} L${x1} ${bottom} L${x0} ${bottom} Z`;
  return d;
}

function edgeD(x0: number, x1: number, offset: number, step = 20): string {
  let d = `M${x0} ${(groundY(x0) + offset).toFixed(1)}`;
  for (let x = x0 + step; x <= x1; x += step) d += ` L${x} ${(groundY(x) + offset).toFixed(1)}`;
  return d;
}

export function roundTree(x: number, y: number, s: number, leaf: string, leafDark: string, trunk: string, seed: number, outline = 0): string {
  const r = artRng(seed);
  const pts: [number, number][] = [];
  const n = 9;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const rr = (0.85 + r() * 0.3) * 70 * s;
    pts.push([x + Math.cos(a) * rr * 1.05, y - 120 * s + Math.sin(a) * rr * 0.92]);
  }
  return (
    path(`M${x - 9 * s} ${y} L${x - 6 * s} ${y - 90 * s} L${x + 6 * s} ${y - 90 * s} L${x + 9 * s} ${y} Z`, trunk, outline) +
    path(blobPath(pts), leaf, outline) +
    ellipse(x + 18 * s, y - 100 * s, 40 * s, 30 * s, leafDark, 0, 'opacity="0.45"') +
    ellipse(x - 22 * s, y - 150 * s, 26 * s, 18 * s, '#fff', 0, 'opacity="0.18"')
  );
}

function pineTree(x: number, y: number, s: number, c: string, seed: number): string {
  const r = artRng(seed);
  const h = (150 + r() * 50) * s;
  return path(`M${x} ${y - h} L${x + 42 * s} ${y - 30 * s} L${x + 12 * s} ${y - 30 * s} L${x + 12 * s} ${y} L${x - 12 * s} ${y} L${x - 12 * s} ${y - 30 * s} L${x - 42 * s} ${y - 30 * s} Z`, c);
}

// ------------------------------------------------------------------ big layers

const far = (() => {
  const W = 3000;
  let body = '';
  // distant hills
  body += path(`M0 820 Q300 640 640 740 Q980 840 1300 700 Q1640 560 1980 720 Q2300 860 2620 690 Q2820 600 3000 680 L3000 1280 L0 1280 Z`, P.farHill);
  const r = artRng(11);
  for (let i = 0; i < 40; i++) {
    const x = r() * W;
    const y = 760 + r() * 120;
    body += pineTree(x, y, 0.35 + r() * 0.25, mix(P.farForest, P.farHill, 0.3), i);
  }
  body += path(`M0 900 Q400 780 800 860 Q1200 940 1600 840 Q2000 760 2400 860 Q2700 930 3000 850 L3000 1280 L0 1280 Z`, mix(P.farForest, P.farHill, 0.15));
  // a far-off village of lantern houses
  for (let i = 0; i < 6; i++) {
    const x = 1500 + i * 46;
    body += rrect(x, 820 - (i % 2) * 14, 36, 30, 4, mix(P.woodLight, P.farHill, 0.5)) + path(`M${x - 4} ${820 - (i % 2) * 14} L${x + 18} ${800 - (i % 2) * 14} L${x + 40} ${820 - (i % 2) * 14} Z`, mix(P.berry, P.farHill, 0.55)) + circle(x + 18, 834 - (i % 2) * 14, 4, P.glow);
  }
  return piece('wh.far', [0, 540, W, 740], body, '', true);
})();

const mid = (() => {
  const W = 3600;
  let body = path(`M0 900 Q260 820 560 870 Q900 930 1200 850 Q1500 790 1840 860 Q2200 930 2520 850 Q2860 780 3200 860 Q3420 900 3600 860 L3600 1280 L0 1280 Z`, P.midForest);
  const r = artRng(23);
  for (let i = 0; i < 26; i++) {
    const x = 40 + i * 140 + r() * 60;
    const y = 880 + r() * 40;
    body += roundTree(x, y, 0.75 + r() * 0.45, mix(P.midForest, P.leaf, 0.25 + r() * 0.2), P.deepForest, mix(P.bark, P.midForest, 0.4), i + 100);
  }
  body += path(`M0 960 Q300 900 640 950 Q1000 1000 1360 930 Q1700 880 2060 950 Q2420 1010 2800 930 Q3200 880 3600 950 L3600 1280 L0 1280 Z`, mix(P.midForest, P.grass, 0.45));
  return piece('wh.mid', [0, 640, W, 640], body, '', true);
})();

const groundLayer = (() => {
  const W = WORLD_W;
  const r = artRng(5);
  let body = '';
  // back edge shadow (paper-cut depth)
  body += path(groundPathD(0, W, -18, 1300), mix(P.grassDark, P.ink, 0.25), 0, 'opacity="0.35"');
  body += path(groundPathD(0, W, -26, 1300), 'url(#gg)', 0);
  body += line(edgeD(0, W, -26), 5, P.ink, 'opacity="0.85"');
  body += line(edgeD(0, W, -20), 5, P.grassLight, 'opacity="0.9"');
  // dirt path band around the standing line
  let pd = edgeD(0, W, -14);
  for (let x = W; x >= 0; x -= 20) pd += ` L${x} ${(groundY(x) + 16).toFixed(1)}`;
  body += path(pd + ' Z', '#dcc08f', 0, 'opacity="0.9"');
  body += line(edgeD(0, W, 16), 3, '#b8986a', 'opacity="0.6"');
  // pebbles on the path
  for (let i = 0; i < 90; i++) {
    const x = r() * W;
    body += ellipse(x, groundY(x) + (r() - 0.5) * 18, 4 + r() * 5, 2.5 + r() * 2, '#c7a878', 0, 'opacity="0.8"');
  }
  // grass blades along the top edge
  for (let x = 6; x < W; x += 14 + r() * 10) {
    const y = groundY(x) - 26;
    const h = 8 + r() * 14;
    body += line(`M${x} ${y + 2} Q${x + 2} ${y - h / 2} ${x + (r() - 0.4) * 8} ${y - h}`, 3, P.grassDark);
  }
  // meadow details below the path: clover, flowers, darker patches, stones
  for (let i = 0; i < 70; i++) {
    const x = r() * W;
    const y = groundY(x) + 60 + r() * 260;
    body += ellipse(x, y, 30 + r() * 60, 10 + r() * 12, P.grassDark, 0, 'opacity="0.18"');
  }
  for (let i = 0; i < 160; i++) {
    const x = r() * W;
    const y = groundY(x) + 40 + r() * 280;
    const c = [P.white, P.sun, P.rose, P.lilac][Math.floor(r() * 4)];
    body += circle(x, y, 3 + r() * 3, c, 0, 'opacity="0.95"') + circle(x, y, 1.6, P.sun);
  }
  for (let i = 0; i < 30; i++) {
    const x = r() * W;
    const y = groundY(x) + 90 + r() * 220;
    body += path(blobPath([[x - 18, y], [x - 8, y - 12], [x + 10, y - 13], [x + 20, y - 2], [x + 6, y + 6], [x - 10, y + 5]]), P.stone, 3) + shine(x - 6, y - 6, 6, 3, 0, 0.35);
  }
  // pond at the meadow
  body += ellipse(L.pondX, groundY(L.pondX) + 110, 150, 42, mix(P.grassDark, P.ink, 0.2), 0, 'opacity="0.6"');
  body += ellipse(L.pondX, groundY(L.pondX) + 108, 140, 36, 'url(#pw)', 4);
  body += line(`M${L.pondX - 90} ${groundY(L.pondX) + 104} Q${L.pondX - 40} ${groundY(L.pondX) + 98} ${L.pondX + 10} ${groundY(L.pondX) + 104}`, 3, '#fff', 'opacity="0.6"');
  for (const dx of [-150, -138, 140, 152]) {
    const x = L.pondX + dx;
    const y = groundY(L.pondX) + 100;
    body += line(`M${x} ${y} Q${x - 4} ${y - 40} ${x + 2} ${y - 70}`, 4, P.grassDark) + ellipse(x + 2, y - 74, 5, 14, P.woodDark, 2.5);
  }
  // pumpkin patch soil rows
  for (let row = 0; row < 2; row++) {
    const y = groundY(L.pumpkinX) + 70 + row * 70;
    body += path(blobPath([[L.pumpkinX - 260, y], [L.pumpkinX, y - 18], [L.pumpkinX + 280, y], [L.pumpkinX, y + 22]]), '#9b7048', 3.5, 'opacity="0.9"');
  }
  return piece('wh.ground', [0, 600, W, 700], body, dgrad('gg', P.grassLight, mix(P.grass, P.grassDark, 0.5)) + vgrad('pw', P.waterLight, P.water), true);
})();

/** The Lantern Oak (clubhouse tree) at the start of the trail. */
const oak = (() => {
  let body = '';
  body += path('M-150 0 Q-130 -200 -110 -420 Q-100 -520 -150 -620 L150 -620 Q100 -520 110 -420 Q130 -200 170 0 Z', 'url(#bark)', 5);
  body += path('M-150 0 Q-200 -10 -230 4 M170 0 Q220 -8 250 6', 'none', 0, `stroke="${P.barkDark}" stroke-width="16" stroke-linecap="round"`);
  // bark grooves
  body += line('M-80 -40 Q-70 -200 -86 -380 M30 -30 Q40 -160 24 -330 M90 -90 Q96 -250 80 -420', 5, P.barkDark, 'opacity="0.55"');
  // door + round window
  body += path('M-50 0 L-50 -130 Q-50 -186 0 -186 Q50 -186 50 -130 L50 0 Z', P.woodDark, 5) + path('M-38 0 L-38 -126 Q-38 -172 0 -172 Q38 -172 38 -126 L38 0 Z', P.wood, 0) + circle(26, -84, 6, P.lantern, 3);
  body += circle(0, -300, 52, P.glow, 5) + line('M0 -352 L0 -248 M-52 -300 L52 -300', 5, P.woodDark) + circle(0, -300, 52, 'none', 5);
  // canopy
  const r = artRng(42);
  const blobs: [number, number, number][] = [
    [-260, -720, 170],
    [-60, -820, 210],
    [180, -760, 190],
    [-200, -560, 120],
    [220, -580, 130],
    [20, -620, 150],
  ];
  for (const [x, y, rr] of blobs) {
    const pts: [number, number][] = [];
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const k = 0.85 + r() * 0.3;
      pts.push([x + Math.cos(a) * rr * k, y + Math.sin(a) * rr * 0.8 * k]);
    }
    body += path(blobPath(pts), mix(P.leaf, P.grassDark, 0.25 + r() * 0.2), 5);
  }
  for (let i = 0; i < 14; i++) body += ellipse(-320 + r() * 640, -900 + r() * 360, 26 + r() * 20, 16, '#fff', 0, 'opacity="0.15"');
  // lanterns hanging from branches
  for (const [x, y] of [
    [-230, -480],
    [190, -500],
    [-60, -520],
  ] as [number, number][]) {
    body += line(`M${x} ${y - 50} L${x} ${y - 14}`, 3) + rrect(x - 14, y - 16, 28, 34, 9, P.lantern, 4) + rrect(x - 8, y - 22, 16, 8, 3, P.woodDark, 2.5) + circle(x, y + 1, 7, P.glow);
  }
  return piece('wh.oak', [-380, -1000, 760, 1012], body, dgrad('bark', '#a87650', P.barkDark));
})();

// ------------------------------------------------------------------ windmill

const towerH = groundY(L.windmillX) - 430;
const tower = piece(
  'wh.mill.tower',
  [-160, -towerH - 110, 320, towerH + 124],
  // stone base
  path(`M-120 0 L-112 -60 L112 -60 L120 0 Z`, P.stone, 5) +
    line('M-80 -30 L-60 -30 M-20 -46 L10 -46 M40 -24 L80 -24', 3, P.stoneDark, 'opacity="0.7"') +
    // wooden tower
    path(`M-104 -58 L-70 ${-towerH + 30} L70 ${-towerH + 30} L104 -58 Z`, 'url(#tw)', 5) +
    [0.2, 0.38, 0.56, 0.74].map((f) => line(`M${-104 + 34 * f * 1.1} ${-58 - (towerH - 88) * f} L${104 - 34 * f * 1.1} ${-58 - (towerH - 88) * f}`, 3, P.woodDark, 'opacity="0.45"')).join('') +
    // door and window
    path('M-30 -60 L-30 -130 Q-30 -160 0 -160 Q30 -160 30 -130 L30 -60 Z', P.woodDark, 4.5) +
    circle(16, -104, 4, P.lantern) +
    circle(0, -230, 26, P.waterLight, 4.5) +
    line('M0 -256 L0 -204 M-26 -230 L26 -230', 3.5) +
    // balcony
    rrect(-96, -298, 192, 14, 4, P.woodDark, 4) +
    line('M-88 -298 L-88 -330 M-56 -298 L-56 -330 M-24 -298 L-24 -330 M8 -298 L8 -330 M40 -298 L40 -330 M72 -298 L72 -330', 4) +
    line('M-92 -330 L92 -330', 5) +
    // cap
    path(`M-86 ${-towerH + 34} Q-90 ${-towerH - 70} 0 ${-towerH - 92} Q90 ${-towerH - 70} 86 ${-towerH + 34} Z`, P.berry, 5) +
    path(`M-70 ${-towerH - 10} Q0 ${-towerH - 40} 70 ${-towerH - 10}`, 'none', 0, `stroke="#fff" stroke-width="4" opacity="0.35"`) +
    shine(-30, -towerH - 40, 20, 10, -20, 0.3),
  dgrad('tw', P.woodLight, P.wood),
);

const sails = (() => {
  let body = '';
  for (const deg of [45, 135, 225, 315]) {
    const blade =
      rrect(-8, -SAIL_LEN, 16, SAIL_LEN, 6, P.woodDark, 4) +
      rrect(8, -SAIL_LEN + 6, 56, SAIL_LEN - 60, 6, P.cream, 4) +
      line(`M8 ${-SAIL_LEN + 50} L64 ${-SAIL_LEN + 50} M8 ${-SAIL_LEN + 100} L64 ${-SAIL_LEN + 100} M8 ${-SAIL_LEN + 150} L64 ${-SAIL_LEN + 150} M36 ${-SAIL_LEN + 6} L36 -54`, 3, P.wood);
    body += g(blade, `rotate(${deg})`);
  }
  body += circle(0, 0, 30, P.woodDark, 5) + circle(0, 0, 12, P.lantern, 4);
  return piece('wh.mill.sails', [-SAIL_LEN - 30, -SAIL_LEN - 30, SAIL_LEN * 2 + 60, SAIL_LEN * 2 + 60], body);
})();

const vane = piece(
  'wh.vane',
  [-70, -60, 140, 70],
  line('M0 0 L0 -40', 5) +
    // arrow points LEFT: the way the wind blows things
    path('M-62 -40 L-36 -54 L-36 -46 L30 -46 L30 -34 L-36 -34 L-36 -26 Z', P.lantern, 4) +
    path('M30 -54 Q60 -60 58 -40 Q60 -20 30 -26 Z', P.leaf, 4),
);

const leverPost = piece('wh.lever.post', [-30, -176, 60, 182], rrect(-14, -170, 28, 170, 8, P.woodDark, 4.5) + circle(0, -150, 12, P.stone, 4) + rrect(-28, -10, 56, 14, 5, P.stoneDark, 4));
const leverArm = piece(
  'wh.lever.arm',
  [-60, -22, 240, 44],
  rrect(-50, -11, 210, 22, 10, 'url(#la)', 4.5) + circle(0, 0, 13, P.stone, 4) + circle(-40, 0, 16, P.berry, 4) + circle(178, 0, 7, P.ink),
  dgrad('la', P.woodLight, P.wood),
);
const bucket = piece(
  'wh.lever.bucket',
  [-56, -14, 112, 104],
  line('M-38 30 L0 -6 L38 30', 3.5) + path('M-44 30 L44 30 L36 90 L-36 90 Z', P.stone, 5) + line('M-42 46 L42 46 M-40 66 L40 66', 3, P.stoneDark, 'opacity="0.7"'),
);

// ------------------------------------------------------------------ launcher, kite, nest

const launcherBase = piece(
  'wh.launcher.base',
  [-130, -130, 260, 140],
  rrect(-110, -86, 220, 40, 10, 'url(#lb)', 5) +
    grain(-104, -84, 208, 36, 3) +
    path('M-40 -86 L-10 -120 L10 -120 L40 -86 Z', P.woodDark, 4.5) +
    circle(-70, -30, 32, P.woodDark, 5) +
    circle(-70, -30, 10, P.lantern, 3.5) +
    line('M-70 -58 L-70 -2 M-98 -30 L-42 -30', 4, P.wood) +
    circle(70, -30, 32, P.woodDark, 5) +
    circle(70, -30, 10, P.lantern, 3.5) +
    line('M70 -58 L70 -2 M42 -30 L98 -30', 4, P.wood),
  dgrad('lb', P.woodLight, P.wood),
);
const launcherBarrel = piece(
  'wh.launcher.barrel',
  [-60, -40, 230, 80],
  rrect(-50, -26, 170, 52, 20, 'url(#br)', 5) +
    path('M110 -34 L160 -40 L160 40 L110 34 Z', P.sea, 5) +
    rrect(-4, -30, 12, 60, 4, P.lantern, 3.5) +
    rrect(60, -30, 12, 60, 4, P.lantern, 3.5) +
    circle(0, 0, 13, P.stone, 4) +
    shine(30, -14, 50, 6, 0, 0.3),
  dgrad('br', '#9bd36d', P.grassDark),
);
const bellows = piece(
  'wh.launcher.bellows',
  [-60, -126, 120, 132],
  path('M-46 0 L-36 -70 L36 -70 L46 0 Z', P.berry, 5) +
    line('M-42 -18 L42 -18 M-40 -36 L40 -36 M-38 -54 L38 -54', 3.5, mix(P.berry, P.ink, 0.35)) +
    rrect(-40, -82, 80, 14, 5, P.woodDark, 4) +
    rrect(-8, -118, 16, 40, 5, P.wood, 4) +
    rrect(-26, -124, 52, 16, 8, P.lantern, 4),
);
const puff = piece(
  'wh.puff',
  [-30, -30, 60, 60],
  path(blobPath([[0, -24], [10, -20], [22, -10], [24, 4], [16, 18], [2, 24], [-12, 20], [-22, 8], [-22, -8], [-12, -20]]), '#fffdf6', 4) +
    line('M-10 -4 L-16 -12 M2 -8 L4 -18 M10 0 L18 -6 M-2 8 L-6 16 M8 8 L14 14', 2.5, P.lilac) +
    circle(0, 0, 5, P.lilac, 2.5),
);
const kite = piece(
  'wh.kite',
  [-70, -88, 140, 176],
  path('M0 -80 L60 -10 L0 80 L-60 -10 Z', P.sun, 5) +
    path('M0 -80 L60 -10 L0 -10 Z', P.berry) +
    path('M0 -10 L-60 -10 L0 80 Z', P.sea) +
    path('M0 -80 L60 -10 L0 80 L-60 -10 Z', 'none', 5) +
    line('M0 -80 L0 80 M-60 -10 L60 -10', 3.5, P.woodDark) +
    // sunny face Pip painted
    circle(0, -10, 22, P.glow, 3.5) +
    circle(-7, -14, 2.8, P.ink) +
    circle(7, -14, 2.8, P.ink) +
    line('M-8 -4 Q0 3 8 -4', 3),
);
const nest = piece(
  'wh.nest',
  [-130, -132, 260, 140],
  rrect(-110, -54, 220, 30, 8, 'url(#nc)', 5) +
    path('M-104 -54 Q-112 -120 -60 -124 Q0 -130 60 -124 Q112 -120 104 -54 Z', '#d9b56c', 5) +
    path('M-90 -60 Q-94 -108 -50 -112 Q0 -116 50 -112 Q94 -108 90 -60 Z', '#f2dc9a', 0) +
    line('M-96 -70 Q0 -84 96 -70 M-100 -90 Q0 -104 100 -90 M-88 -108 Q0 -120 88 -108', 3, '#a8823e', 'opacity="0.7"') +
    line('M-80 -60 L-74 -112 M-40 -58 L-36 -118 M0 -58 L0 -120 M40 -58 L36 -118 M80 -60 L74 -112', 2.5, '#a8823e', 'opacity="0.5"') +
    // soft moss lining
    path('M-70 -100 Q0 -88 70 -100 Q50 -80 0 -78 Q-50 -80 -70 -100 Z', P.leaf, 3),
  dgrad('nc', P.woodLight, P.wood),
);
const wheel = piece(
  'wh.wheel',
  [-34, -34, 68, 68],
  circle(0, 0, 28, P.woodDark, 5) + circle(0, 0, 9, P.lantern, 3.5) + line('M0 -24 L0 24 M-24 0 L24 0 M-17 -17 L17 17 M17 -17 L-17 17', 3.5, P.wood),
);
const spool = piece(
  'wh.spool',
  [-62, -126, 124, 132],
  rrect(-50, -14, 100, 14, 5, P.woodDark, 4) +
    line('M-30 -14 L-20 -70 M30 -14 L20 -70', 6, P.woodDark) +
    ellipse(0, -76, 40, 44, P.woodLight, 4.5) +
    ellipse(0, -76, 28, 32, P.berry, 4) +
    line('M-24 -90 Q0 -96 24 -90 M-26 -76 Q0 -82 26 -76 M-24 -62 Q0 -68 24 -62', 3, '#f6b0a8', 'opacity="0.8"') +
    circle(0, -76, 8, P.woodDark, 3.5),
);
const ribbonLoop = piece('wh.ribbon.loop', [-40, -40, 80, 80], path('M-28 8 Q-36 -30 0 -30 Q36 -30 28 8 Q20 30 0 22 Q-20 30 -28 8 Z', 'none', 0, `stroke="${P.ink}" stroke-width="13" stroke-linecap="round"`) + path('M-28 8 Q-36 -30 0 -30 Q36 -30 28 8 Q20 30 0 22 Q-20 30 -28 8 Z', 'none', 0, `stroke="${P.berry}" stroke-width="7" stroke-linecap="round"`));
const ribbonTrail = piece('wh.ribbon.trail', [-120, -30, 240, 60], line('M-110 10 Q-70 -24 -30 6 Q10 30 50 0 Q80 -20 110 4', 12, P.ink) + line('M-110 10 Q-70 -24 -30 6 Q10 30 50 0 Q80 -20 110 4', 6, P.berry));
const chock = piece('wh.chock', [-34, -40, 68, 46], path('M-28 0 L28 0 L-20 -34 Z', P.woodLight, 4.5) + line('M-14 -6 L10 -6', 3, P.woodDark, 'opacity="0.5"'));
const flag = piece('wh.flag', [-10, -110, 70, 116], line('M0 0 L0 -104', 5) + path('M2 -102 L58 -86 L2 -68 Z', P.sun, 4) + path('M18 -86 L26 -94 L34 -86 L26 -78 Z', P.berry, 2.5));

// ------------------------------------------------------------------ meadow things

const mushroomStem = piece('wh.mushroom.stem', [-34, -96, 68, 102], path('M-24 0 Q-30 -50 -18 -90 L18 -90 Q30 -50 24 0 Z', P.cream, 5) + line('M-14 -20 Q0 -14 14 -20 M-16 -44 Q0 -38 16 -44 M-16 -68 Q0 -62 16 -68', 3, P.woodLight, 'opacity="0.8"'));
const mushroomCap = piece(
  'wh.mushroom.cap',
  [-110, -96, 220, 104],
  path('M-100 0 Q-104 -84 0 -90 Q104 -84 100 0 Q50 12 0 10 Q-50 12 -100 0 Z', P.berry, 5) +
    circle(-50, -40, 15, '#fff', 3) +
    circle(10, -64, 12, '#fff', 3) +
    circle(56, -30, 17, '#fff', 3) +
    circle(-8, -24, 9, '#fff', 3) +
    shine(-46, -66, 26, 9, -20, 0.3),
);
const dandelion = piece(
  'wh.dandelion',
  [-50, -170, 100, 176],
  line('M0 0 Q6 -60 0 -120', 5, P.grassDark) +
    path('M0 -40 Q-26 -50 -30 -30 Q-14 -24 0 -40 Z', P.leaf, 3) +
    circle(0, -128, 38, '#fffdf6', 4, 'opacity="0.97"') +
    [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((a) => {
      const r = (a * Math.PI) / 180;
      return line(`M0 -128 L${(Math.cos(r) * 30).toFixed(1)} ${(-128 + Math.sin(r) * 30).toFixed(1)}`, 1.8, P.lilac);
    }).join('') +
    circle(0, -128, 6, P.wood, 2.5),
);
const dandelionBare = piece('wh.dandelion.bare', [-50, -150, 100, 156], line('M0 0 Q6 -60 0 -120', 5, P.grassDark) + path('M0 -40 Q-26 -50 -30 -30 Q-14 -24 0 -40 Z', P.leaf, 3) + circle(0, -124, 8, P.wood, 3));
const frog = piece(
  'wh.frog',
  [-46, -64, 92, 70],
  path('M-36 0 Q-42 -40 -20 -46 Q0 -50 20 -46 Q42 -40 36 0 Z', '#7cc06a', 4.5) +
    circle(-16, -50, 11, '#7cc06a', 4) +
    circle(16, -50, 11, '#7cc06a', 4) +
    circle(-16, -51, 5, P.ink) +
    circle(16, -51, 5, P.ink) +
    circle(-17, -53, 1.6, '#fff') +
    circle(15, -53, 1.6, '#fff') +
    line('M-14 -28 Q0 -20 14 -28', 3.5) +
    ellipse(0, -14, 18, 9, '#eaf3b6', 0, 'opacity="0.9"'),
);
const lily = piece('wh.lily', [-70, -22, 140, 44], path('M-62 0 Q-60 -18 0 -18 Q60 -18 62 0 Q60 18 0 18 Q-20 18 -6 2 L-12 -6 Q-50 16 -62 0 Z', '#6fae5a', 4) + line('M0 0 L40 -8 M0 0 L44 6 M0 0 L-30 -10', 2.5, P.grassDark, 'opacity="0.6"'));
const postPiece = piece('wh.post', [-14, -176, 28, 182], rrect(-9, -170, 18, 170, 6, P.woodDark, 4) + circle(0, -166, 6, P.wood, 3));
const sock = piece(
  'wh.sock',
  [-30, -8, 60, 110],
  rrect(-6, -6, 12, 12, 3, P.woodLight, 3) +
    path('M-16 4 L16 4 L16 60 Q16 76 30 82 Q36 96 20 98 L-4 94 Q-16 90 -16 74 Z', '#fff', 4.5) +
    path('M-16 18 L16 18 L16 30 L-16 30 Z M-16 42 L16 42 L16 54 L-16 54 Z', P.sea) +
    path('M-16 4 L16 4 L16 60 Q16 76 30 82 Q36 96 20 98 L-4 94 Q-16 90 -16 74 Z', 'none', 4.5),
);
const windsockPole = piece('wh.windsock.pole', [-10, -230, 20, 236], rrect(-6, -224, 12, 224, 5, P.woodDark, 3.5) + circle(0, -226, 7, P.lantern, 3));
const windsockSock = piece(
  'wh.windsock.sock',
  [-150, -30, 160, 60],
  // attached at (0,0), streams to the LEFT with the wind
  path('M0 -22 L-140 -10 L-140 12 L0 22 Z', P.berry, 4.5) + path('M-40 -18 L-80 -15 L-80 16 L-40 19 Z M-110 -12 L-140 -10 L-140 12 L-110 14 Z', '#fff'),
);
const glider = piece(
  'wh.glider',
  [-70, -36, 140, 64],
  path('M64 0 L-60 -30 L-30 0 L-60 24 Z', '#fffdf6', 4.5) + path('M64 0 L-30 0 L-60 24 Z', P.cream, 4) + line('M64 0 L-30 0', 3, P.sea) + circle(-40, -14, 5, P.lantern, 2.5),
);
const stump = piece('wh.stump', [-80, -96, 160, 104], path('M-64 0 L-56 -76 L56 -76 L64 0 Z', 'url(#st)', 5) + ellipse(0, -76, 56, 16, P.woodLight, 5) + ellipse(0, -76, 34, 9, 'none', 0, `stroke="${P.wood}" stroke-width="3"`) + ellipse(0, -76, 14, 4, 'none', 0, `stroke="${P.wood}" stroke-width="2.5"`), dgrad('st', P.bark, P.barkDark));
const sign = piece(
  'wh.sign',
  [-80, -180, 200, 186],
  rrect(-8, -150, 16, 150, 5, P.woodDark, 4) +
    path('M-60 -170 L80 -170 L110 -136 L80 -102 L-60 -102 Z', P.woodLight, 5) +
    // basket icon (Picnic Meadow) rather than words
    path('M-20 -146 L40 -146 L32 -114 L-12 -114 Z', P.wood, 3.5) +
    path('M-14 -146 Q10 -168 34 -146', 'none', 3.5) +
    line('M-8 -138 L28 -138 M-4 -126 L26 -126', 2.5, P.woodDark),
);
const pumpkin = piece(
  'wh.pumpkin',
  [-66, -100, 132, 106],
  path(blobPath([[-58, -36], [-48, -70], [-20, -82], [0, -78], [20, -82], [48, -70], [58, -36], [48, -6], [20, 2], [0, 0], [-20, 2], [-48, -6]]), 'url(#pk)', 5) +
    line('M-20 -78 Q-34 -40 -20 0 M20 -78 Q34 -40 20 0 M0 -78 L0 0', 3.5, P.pumpkinDark, 'opacity="0.8"') +
    rrect(-6, -96, 12, 22, 4, P.woodDark, 3.5) +
    path('M6 -86 Q30 -100 40 -84 Q24 -78 6 -86 Z', P.leaf, 3) +
    shine(-32, -54, 12, 18, -20, 0.3),
  dgrad('pk', '#f7a14c', P.pumpkinDark),
);
const pumpkinSmall = piece(
  'wh.pumpkin.s',
  [-44, -66, 88, 70],
  path(blobPath([[-38, -24], [-30, -46], [-12, -54], [0, -50], [12, -54], [30, -46], [38, -24], [30, -4], [12, 1], [0, 0], [-12, 1], [-30, -4]]), P.pumpkin, 4) +
    line('M-12 -52 Q-22 -26 -12 0 M12 -52 Q22 -26 12 0', 3, P.pumpkinDark, 'opacity="0.7"') +
    rrect(-4, -62, 8, 14, 3, P.woodDark, 3),
);
const vine = piece('wh.vine', [-160, -40, 320, 70], line('M-150 10 Q-90 -30 -30 6 Q30 34 90 0 Q130 -20 150 6', 5, P.grassDark) + [[-90, -18], [10, 22], [110, -12]].map(([x, y]) => path(`M${x} ${y} q-20 -24 0 -30 q20 6 0 30 z`, P.leaf, 3)).join(''));

// ------------------------------------------------------------------ sky, plants, misc

const sun = piece('wh.sun', [-110, -110, 220, 220], circle(0, 0, 100, P.glow, 0, 'opacity="0.35"') + circle(0, 0, 70, P.sun, 0) + circle(0, 0, 70, 'none', 0, `stroke="#fff" stroke-width="6" opacity="0.4"`));
const cloudA = piece('wh.cloud.a', [-180, -80, 360, 120], path('M-160 30 Q-170 -10 -120 -16 Q-110 -60 -50 -54 Q-20 -86 30 -64 Q80 -80 104 -36 Q160 -36 160 14 Q160 34 130 34 L-140 34 Q-160 34 -160 30 Z', P.cloud, 0, 'opacity="0.95"'));
const cloudB = piece('wh.cloud.b', [-130, -60, 260, 90], path('M-110 20 Q-120 -8 -80 -12 Q-70 -44 -20 -40 Q10 -62 46 -40 Q90 -46 100 -6 Q120 0 112 20 Z', P.cloud, 0, 'opacity="0.9"'));
const tuftA = piece('wh.tuft.a', [-40, -50, 80, 56], [-22, -8, 6, 20].map((x, i) => line(`M${x} 2 Q${x + 2} -20 ${x + (i % 2 ? 8 : -8)} -44`, 5, i % 2 ? P.grassDark : P.grass)).join(''));
const tuftB = piece('wh.tuft.b', [-46, -60, 92, 66], [-30, -14, 0, 14, 30].map((x, i) => line(`M${x} 2 Q${x} -26 ${x + (i % 2 ? 10 : -10)} -54`, 5, i % 2 ? P.grass : P.grassDark)).join('') + circle(16, -50, 7, P.sun, 3));
const flowers = piece('wh.flowers', [-50, -70, 100, 76], [[-26, -40, P.rose], [0, -58, '#fff'], [24, -36, P.lilac]].map(([x, y, c]) => line(`M${x} 2 L${x} ${y}`, 4, P.grassDark) + [0, 72, 144, 216, 288].map((a) => circle((x as number) + Math.cos((a * Math.PI) / 180) * 8, (y as number) + Math.sin((a * Math.PI) / 180) * 8, 7, c as string, 2.5)).join('') + circle(x as number, y as number, 5, P.sun, 2)).join(''));
const bush = piece('wh.bush', [-110, -100, 220, 106], path(blobPath([[-100, 0], [-96, -46], [-60, -86], [-10, -92], [40, -86], [90, -54], [100, 0]]), mix(P.grass, P.grassDark, 0.35), 5) + ellipse(-30, -60, 26, 14, '#fff', 0, 'opacity="0.15"') + circle(-40, -30, 6, P.berry, 2.5) + circle(30, -50, 6, P.berry, 2.5) + circle(60, -20, 6, P.berry, 2.5));
const fence = piece('wh.fence', [-110, -100, 220, 106], rrect(-100, -70, 200, 14, 5, P.woodLight, 4) + rrect(-100, -36, 200, 14, 5, P.woodLight, 4) + [-90, -30, 30, 90].map((x) => path(`M${x - 10} 0 L${x - 10} -86 L${x} -96 L${x + 10} -86 L${x + 10} 0 Z`, P.wood, 4)).join(''));
const angleBtn = piece('wh.anglebtn', [-46, -46, 92, 92], circle(0, 0, 40, P.cream, 5) + circle(0, 0, 32, P.woodLight, 0, 'opacity="0.5"') + path('M-22 -8 L8 -8 L8 -20 L28 0 L8 20 L8 8 L-22 8 Z', P.berry, 4));
const dot = piece('wh.dot', [-10, -10, 20, 20], circle(0, 0, 7, '#fff', 3));
const seedRing = piece('wh.seedring', [-80, -80, 160, 160], Array.from({ length: 14 }, (_, i) => {
  const a = (i / 14) * Math.PI * 2;
  return circle(Math.cos(a) * 64, Math.sin(a) * 64, 9, '#fffdf6', 3);
}).join('') + circle(0, 0, 64, 'none', 0, `stroke="${P.glow}" stroke-width="5" opacity="0.6"`));
const snail = piece(
  'wh.snail',
  [-60, -70, 120, 76],
  path('M-50 0 Q-50 -16 -30 -16 L30 -16 Q46 -16 50 -6 L56 0 Z', '#e7c9a0', 4) +
    circle(-6, -36, 30, P.lilac, 4.5) +
    path('M-6 -36 m-18 0 a18 18 0 1 1 18 18 a12 12 0 1 1 -12 -12 a6 6 0 1 1 6 6', 'none', 3) +
    line('M40 -16 L46 -40 M48 -14 L58 -36', 3) +
    circle(46, -42, 4, P.ink) +
    circle(58, -38, 4, P.ink),
);
const pinwheel = piece(
  'wh.pinwheel',
  [-50, -50, 100, 100],
  [P.berry, P.sun, P.sea, P.leaf].map((c, i) => g(path('M0 0 L0 -44 Q30 -40 0 0 Z', c, 4), `rotate(${i * 90})`)).join('') + circle(0, 0, 7, P.cream, 3),
);
const pinwheelStick = piece('wh.pinwheel.stick', [-8, -6, 16, 120], rrect(-5, 0, 10, 110, 4, P.wood, 3));
const bird = piece(
  'wh.bird',
  [-40, -40, 80, 56],
  path('M-30 0 Q-30 -30 0 -30 Q24 -30 30 -12 L40 -8 L30 -2 Q24 10 0 10 Q-26 10 -30 0 Z', P.sea, 4) + path('M-6 -16 Q10 -30 20 -12 Q6 -6 -6 -16 Z', '#8fc6ea', 3) + circle(18, -18, 3, P.ink) + path('M-30 -4 L-40 -14 L-38 2 Z', P.sea, 3),
);

/** Kite tail bows, drawn light so a tint gives them their chosen colour. Shape = pattern. */
export const TAIL_PATTERNS = ['stars', 'stripes', 'dots', 'leaves'] as const;
export type TailPattern = (typeof TAIL_PATTERNS)[number];
const PAT = '#5c5c5c';
const bowBase = (inner: string) =>
  path('M0 0 Q-20 -26 -36 -20 Q-42 0 -36 20 Q-20 26 0 0 Z', '#fff', 4) +
  path('M0 0 Q20 -26 36 -20 Q42 0 36 20 Q20 26 0 0 Z', '#fff', 4) +
  inner +
  circle(0, 0, 8, '#fff', 3.5);
const star = (x: number, y: number, r: number) => {
  let d = '';
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.45 : r;
    d += `${i ? 'L' : 'M'}${(x + Math.cos(a) * rr).toFixed(1)} ${(y + Math.sin(a) * rr).toFixed(1)} `;
  }
  return path(d + 'Z', PAT);
};
const bows: ArtPiece[] = [
  piece('kite.bow.stars', [-44, -30, 88, 60], bowBase(star(-22, -1, 9) + star(22, -1, 9))),
  piece('kite.bow.stripes', [-44, -30, 88, 60], bowBase(line('M-30 -12 L-30 12 M-20 -17 L-20 17 M20 -17 L20 17 M30 -12 L30 12', 5, PAT))),
  piece('kite.bow.dots', [-44, -30, 88, 60], bowBase(circle(-24, -7, 4.5, PAT) + circle(-18, 8, 4.5, PAT) + circle(-31, 5, 3.5, PAT) + circle(24, -7, 4.5, PAT) + circle(18, 8, 4.5, PAT) + circle(31, 5, 3.5, PAT))),
  piece('kite.bow.leaves', [-44, -30, 88, 60], bowBase(path('M-34 0 Q-24 -13 -12 0 Q-24 13 -34 0 Z M12 0 Q24 -13 34 0 Q24 13 12 0 Z', PAT) + line('M-33 0 L-13 0 M13 0 L33 0', 2, '#fff'))),
];

export const WINDMILL_PIECES: ArtPiece[] = [
  far,
  mid,
  groundLayer,
  oak,
  tower,
  sails,
  vane,
  leverPost,
  leverArm,
  bucket,
  launcherBase,
  launcherBarrel,
  bellows,
  puff,
  kite,
  nest,
  wheel,
  spool,
  ribbonLoop,
  ribbonTrail,
  chock,
  flag,
  mushroomStem,
  mushroomCap,
  dandelion,
  dandelionBare,
  frog,
  lily,
  postPiece,
  sock,
  windsockPole,
  windsockSock,
  glider,
  stump,
  sign,
  pumpkin,
  pumpkinSmall,
  vine,
  sun,
  cloudA,
  cloudB,
  tuftA,
  tuftB,
  flowers,
  bush,
  fence,
  angleBtn,
  dot,
  seedRing,
  snail,
  pinwheel,
  pinwheelStick,
  bird,
  ...bows,
];

/** Shared by the clubhouse (souvenir display). */
export const KITE_KEYS = ['wh.kite', ...bows.map((b) => b.key)];

