import { P, mix } from '../palette';
import { type ArtPiece, artRng, blobPath, circle, ellipse, g, grain, hillPath, line, path, piece, rgrad, rrect, shadow, shine, vgrad } from '../svg';
import { roundTree } from './windmill';

/**
 * Art for Lantern Trail adventures 2–4: Whistle Stream (the Picnic Bridge),
 * the Mill (the Waterwheel Mix-Up) and the Festival Glade (the Lantern Launch).
 * Wide layers are in world coordinates; props have their pivot at the base.
 */

export const TRAIL_W = 3200;
export const GROUND_Y = 830;
/** Gentle rolling ground used by every adventure (feet line). */
export function trailGroundY(x: number): number {
  return GROUND_Y + Math.sin(x / 420) * 10 + Math.sin(x / 160) * 3;
}

const id = (k: string) => (n: string) => `${k.replace(/\./g, '-')}-${n}`;

// ------------------------------------------------------------------ shared layers

function farLayer(key: string, tint: string, seed: number): ArtPiece {
  const r = artRng(seed);
  let b = path(hillPath(0, TRAIL_W, 560, 1100, 9, 70, seed), mix(P.farHill, tint, 0.25));
  b += path(hillPath(0, TRAIL_W, 610, 1100, 12, 40, seed + 1), mix(P.farForest, tint, 0.25));
  for (let i = 0; i < 24; i++) b += roundTree(60 + i * 135 + r() * 40, 650 + r() * 20, 0.5 + r() * 0.25, mix(P.midForest, tint, 0.3), mix(P.deepForest, tint, 0.2), P.bark, seed * 10 + i);
  return piece(key, [0, 420, TRAIL_W, 680], b, '', true);
}

function groundLayer(key: string, opts: { water?: [number, number]; dusk?: boolean; seed: number }): ArtPiece {
  const k = id(key);
  const r = artRng(opts.seed);
  let d = `M0 ${trailGroundY(0) - 16}`;
  for (let x = 0; x <= TRAIL_W; x += 40) d += ` L${x} ${(trailGroundY(x) - 16).toFixed(1)}`;
  d += ` L${TRAIL_W} 1260 L0 1260 Z`;
  let b = path(d, `url(#${k('g')})`, 0);
  let edge = `M0 ${trailGroundY(0) - 16}`;
  for (let x = 0; x <= TRAIL_W; x += 40) edge += ` L${x} ${(trailGroundY(x) - 16).toFixed(1)}`;
  b += line(edge, 6, P.ink, 'opacity="0.75"') + line(edge.replace(/(\d+\.?\d*)$/, '$1'), 3, P.grassLight, 'opacity="0.6" transform="translate(0 6)"');
  for (let i = 0; i < 90; i++) {
    const x = r() * TRAIL_W;
    const y = trailGroundY(x) + 30 + r() * 300;
    if (opts.water && x > opts.water[0] - 30 && x < opts.water[1] + 30) continue;
    b += r() < 0.55 ? line(`M${x} ${y} l-6 -16 M${x} ${y} l2 -20 M${x} ${y} l9 -14`, 3, P.grassDark, 'opacity="0.6"') : circle(x, y, 5 + r() * 3, [P.rose, P.cream, P.lilac, P.sun][i % 4], 2);
  }
  if (opts.water) {
    const [x0, x1] = opts.water;
    // the stream runs from the back of the meadow to the front
    b += path(`M${x0 + 60} ${GROUND_Y - 40} Q${(x0 + x1) / 2} ${GROUND_Y - 60} ${x1 - 60} ${GROUND_Y - 40} L${x1 + 20} 1260 L${x0 - 20} 1260 Z`, `url(#${k('w')})`, 6);
    for (let i = 0; i < 10; i++) b += line(`M${x0 + 40 + r() * (x1 - x0 - 80)} ${GROUND_Y + r() * 380} q20 -8 40 0`, 4, '#fff', 'opacity="0.55"');
    // muddy banks
    b += path(`M${x0 + 60} ${GROUND_Y - 40} L${x0 - 20} 1260 L${x0 - 70} 1260 L${x0 + 20} ${GROUND_Y - 40} Z`, P.woodDark, 0, 'opacity="0.45"');
    b += path(`M${x1 - 60} ${GROUND_Y - 40} L${x1 + 20} 1260 L${x1 + 70} 1260 L${x1 - 20} ${GROUND_Y - 40} Z`, P.woodDark, 0, 'opacity="0.45"');
  }
  const top = opts.dusk ? mix(P.grass, P.duskTop, 0.3) : P.grassLight;
  const bot = opts.dusk ? mix(P.grassDark, P.nightLow, 0.35) : P.grass;
  return piece(key, [0, 700, TRAIL_W, 560], b, vgrad(k('g'), top, bot) + vgrad(k('w'), P.water, P.waterDark), true);
}

// ------------------------------------------------------------------ A2. Whistle Stream

export const STREAM = { x0: 1300, x1: 1900 };

const brFar = farLayer('br.far', P.skyLow, 21);
const brGround = groundLayer('br.ground', { water: [STREAM.x0, STREAM.x1], seed: 22 });
const shed = piece('br.shed', [-160, -300, 320, 306], shadow(0, 0, 150, 12) + rrect(-140, -200, 280, 200, 8, P.wood, 6) + grain(-130, -190, 260, 180, 4, 5) + path('M-160 -190 L0 -300 L160 -190 Z', P.berry, 6) + rrect(-40, -120, 80, 120, 6, P.woodDark, 5) + circle(24, -60, 6, P.lantern, 3));
const leafPile = piece('br.leaves', [-110, -90, 220, 96], path(blobPath([[-100, 0], [-80, -50], [-30, -80], [20, -84], [70, -60], [100, 0]]), mix(P.pumpkin, P.leaf, 0.35), 5) + [[-60, -30], [-10, -60], [40, -40], [10, -20], [70, -20]].map(([x, y], i) => path(`M${x - 14} ${y} Q${x} ${y - 16} ${x + 14} ${y} Q${x} ${y + 12} ${x - 14} ${y} Z`, [P.pumpkin, P.sun, P.berry, P.leaf, P.pumpkinDark][i], 3)).join(''));
const plankLoose = piece('br.plank', [-120, -30, 240, 40], shadow(0, 6, 110, 6) + rrect(-110, -22, 220, 26, 8, P.woodLight, 5) + grain(-100, -20, 200, 22, 9, 3) + circle(-90, -9, 4, P.stone, 2) + circle(90, -9, 4, P.stone, 2));
const plankSpan = piece('br.span', [-130, -24, 260, 48], rrect(-124, -18, 248, 32, 9, P.woodLight, 5) + grain(-116, -16, 232, 28, 13, 4) + circle(-104, -2, 5, P.stone, 2) + circle(104, -2, 5, P.stone, 2));
const stone = piece('br.stone', [-60, -50, 120, 60], shadow(0, 4, 54, 7) + path(blobPath([[-52, 0], [-44, -30], [-10, -44], [30, -40], [52, -14], [48, 0]]), P.stone, 5) + shine(-14, -26, 16, 7, -10, 0.4));
const stonePile = piece('br.stonepile', [-110, -110, 220, 116], shadow(0, 0, 100, 10) + [[-50, -20], [40, -18], [-5, -56], [20, -90]].map(([x, y]) => g(path(blobPath([[-46, 0], [-40, -26], [-8, -38], [26, -34], [46, -12], [42, 0]]), P.stone, 5), `translate(${x} ${y + 20})`)).join(''));
const rope = piece('br.rope', [-70, -60, 140, 66], shadow(0, 0, 60, 8) + [0, 1, 2].map((i) => ellipse(0, -16 - i * 10, 56 - i * 6, 18, 'none', 0, `stroke="${P.ink}" stroke-width="12"`) + ellipse(0, -16 - i * 10, 56 - i * 6, 18, 'none', 0, `stroke="#d9b56c" stroke-width="7"`)).join(''));
const stick = piece('br.stick', [-20, -230, 60, 236], line('M0 0 Q6 -110 20 -220', 12, P.ink) + line('M0 0 Q6 -110 20 -220', 7, P.woodLight) + line('M18 -210 Q34 -200 30 -186', 5, P.ink));
const wagon = piece('br.wagon', [-130, -150, 260, 156], shadow(0, 2, 120, 10) + rrect(-110, -100, 220, 70, 10, P.berry, 6) + line('M-90 -84 L90 -84', 4, P.cream, 'opacity="0.7"') + circle(-70, -22, 26, P.woodDark, 5) + circle(70, -22, 26, P.woodDark, 5) + circle(-70, -22, 8, P.stone, 3) + circle(70, -22, 8, P.stone, 3) + line('M110 -80 Q150 -110 160 -140', 7, P.ink) + rrect(-80, -146, 70, 50, 10, '#d9b56c', 5) + rrect(0, -136, 60, 40, 8, P.cream, 5));
const basket = piece('br.basket', [-60, -80, 120, 86], shadow(0, 0, 50, 7) + path('M-36 -40 Q0 -86 36 -40', 'none', 0, `stroke="${P.ink}" stroke-width="10" stroke-linecap="round"`) + rrect(-46, -44, 92, 44, 8, '#d9b56c', 5) + line('M-40 -26 L40 -26 M-40 -12 L40 -12', 3, '#a8823e'));
const blanketSmall = piece('br.blanket', [-200, -50, 400, 100], path('M-180 -30 L180 -30 L200 40 L-200 40 Z', P.cream, 5) + [0, 1, 2, 3, 4].map((i) => path(`M${-180 + i * 80} -30 L${-140 + i * 80} -30 L${-136 + i * 80 + 4} 40 L${-180 + i * 80 - 8} 40 Z`, P.sea, 0, 'opacity="0.75"')).join(''));
const brokenPost = piece('br.post', [-24, -110, 48, 116], rrect(-14, -100, 28, 100, 6, P.woodDark, 5) + path('M-14 -100 L-4 -110 L4 -98 L14 -106 L14 -96 L-14 -96 Z', P.woodDark, 4));
const rock = piece('br.rock', [-80, -40, 160, 60], path(blobPath([[-70, 10], [-60, -24], [-10, -34], [40, -30], [70, -6], [64, 12]]), P.stoneDark, 5) + shine(-20, -18, 20, 6, 0, 0.3));
const log = piece('br.log', [-140, -40, 280, 80], rrect(-130, -30, 260, 60, 30, P.bark, 5) + ellipse(126, 0, 22, 30, '#d9a066', 5) + ellipse(126, 0, 10, 14, 'none', 0, `stroke="${P.wood}" stroke-width="3"`) + line('M-100 -10 L80 -12 M-90 12 L60 10', 3, P.barkDark, 'opacity="0.6"'));
const flagPennant = piece('br.flag', [-14, -150, 110, 156], line('M0 0 L0 -144', 7, P.woodDark) + path('M4 -140 L90 -116 L4 -92 Z', P.berry, 5) + path('M24 -122 l8 -8 l8 8 l-8 8 z', P.sun, 3));
// friends' needs, shown in bubbles
const needFlat = piece('br.need.flat', [-40, -30, 80, 60], line('M-30 6 L30 6', 8, P.ink) + path('M-30 6 L-30 -6 M30 6 L30 -6', 'none', 0, `stroke="${P.ink}" stroke-width="5" stroke-linecap="round"`) + circle(0, -12, 8, P.mossShell, 3));
const needHop = piece('br.need.hop', [-40, -36, 80, 66], [-24, 0, 24].map((x) => ellipse(x, 18, 12, 6, P.stone, 3)).join('') + path('M-24 10 Q-12 -26 0 10 Q12 -26 24 10', 'none', 0, `stroke="${P.berry}" stroke-width="4" stroke-dasharray="6 5" stroke-linecap="round"`));
const needWide = piece('br.need.wide', [-44, -34, 88, 64], rrect(-34, -18, 68, 26, 6, P.berry, 4) + circle(-20, 14, 9, P.woodDark, 3) + circle(20, 14, 9, P.woodDark, 3) + path('M-42 -26 L-34 -20 M42 -26 L34 -20', 'none', 0, `stroke="${P.ink}" stroke-width="4" stroke-linecap="round"`));
const bubble = piece('tr.bubble', [-70, -70, 140, 130], path('M-60 -30 Q-60 -60 -30 -60 L30 -60 Q60 -60 60 -30 L60 10 Q60 40 30 40 L12 40 L0 58 L-12 40 L-30 40 Q-60 40 -60 10 Z', P.white, 5));

// ------------------------------------------------------------------ A3. The Mill

export const MILL = { wheelX: 900, damX: 2700, poolX: 2950 };

const mlFar = farLayer('ml.far', P.skyLow, 31);
const mlGround = (() => {
  // the streambed: dry in the middle, a pool behind the dam (drawn as separate tinted layers)
  const k = id('ml.ground');
  const base = groundLayer('ml.ground', { seed: 32 });
  let bed = '';
  bed += path(`M980 ${GROUND_Y + 40} Q1800 ${GROUND_Y + 10} ${MILL.damX} ${GROUND_Y + 40} L${MILL.damX} ${GROUND_Y + 100} Q1800 ${GROUND_Y + 80} 980 ${GROUND_Y + 110} Z`, '#c9a678', 4);
  return piece('ml.ground', base.box, base.body + bed, (base.defs ?? '').replace(/br-ground/g, 'ml-ground') + vgrad(k('x'), '#fff', '#fff'), true);
})();
const streamWater = piece('ml.water', [980, GROUND_Y + 10, MILL.damX - 980, 100], path(`M980 ${GROUND_Y + 40} Q1800 ${GROUND_Y + 10} ${MILL.damX} ${GROUND_Y + 40} L${MILL.damX} ${GROUND_Y + 100} Q1800 ${GROUND_Y + 80} 980 ${GROUND_Y + 110} Z`, P.water, 0) + [1200, 1500, 1800, 2100, 2400].map((x) => line(`M${x} ${GROUND_Y + 60} q20 -6 40 0`, 4, '#fff', 'opacity="0.7"')).join(''), '', true);
const pool = piece('ml.pool', [-200, -60, 400, 120], ellipse(0, 0, 190, 50, P.water, 5) + ellipse(-40, -10, 60, 12, '#fff', 0, 'opacity="0.4"') + ellipse(60, 10, 40, 8, '#fff', 0, 'opacity="0.35"'));
const millHouse = (() => {
  const k = id('ml.house');
  return piece(
    'ml.house',
    [-260, -520, 520, 526],
    shadow(0, 0, 240, 16) + rrect(-230, -360, 460, 360, 12, `url(#${k('w')})`, 6) + grain(-220, -350, 440, 340, 7, 6) + path('M-260 -350 L0 -520 L260 -350 Z', P.woodDark, 6) + rrect(-50, -150, 100, 150, 10, P.woodDark, 5) + [[-150, -250], [100, -250]].map(([x, y]) => rrect(x, y, 70, 70, 8, '#3b3f5a', 5) + line(`M${x + 35} ${y} L${x + 35} ${y + 70} M${x} ${y + 35} L${x + 70} ${y + 35}`, 4, P.woodDark)).join(''),
    vgrad(k('w'), P.woodLight, P.wood),
  );
})();
const millLight = piece('ml.light', [-60, -60, 120, 120], circle(0, 0, 56, 'url(#ml-light-g)'), rgrad('ml-light-g', '#fff2b0', '#ffd76a', 0.85, 0));
const wheel = piece('ml.wheel', [-180, -180, 360, 360], circle(0, 0, 160, 'none', 0, `stroke="${P.ink}" stroke-width="22"`) + circle(0, 0, 160, 'none', 0, `stroke="${P.wood}" stroke-width="14"`) + Array.from({ length: 12 }, (_, i) => g(rrect(-14, -176, 28, 60, 6, P.woodLight, 5) + line('M0 -116 L0 -20', 8, P.woodDark), `rotate(${i * 30})`)).join('') + circle(0, 0, 30, P.woodDark, 6) + circle(0, 0, 10, P.stone, 3));
const flume = piece('ml.flume', [0, -40, 260, 60], path('M0 -20 L260 -30 L260 10 L0 18 Z', P.wood, 5) + line('M20 -18 L240 -26', 3, P.woodDark, 'opacity="0.5"'));
const damLeaves = piece('ml.dam', [-90, -140, 180, 146], path(blobPath([[-80, 0], [-70, -70], [-30, -120], [20, -128], [64, -80], [80, 0]]), mix(P.leaf, P.pumpkin, 0.4), 5) + rrect(-6, -126, 12, 30, 4, P.woodDark, 3));
const damLeaf = piece('ml.leaf', [-40, -26, 80, 52], path('M-34 0 Q0 -26 34 0 Q0 26 -34 0 Z', P.pumpkin, 4) + line('M-28 0 L28 0', 3, P.pumpkinDark));
const footprints = piece('ml.feet', [-90, -30, 180, 60], [[-60, 0], [-20, -10], [20, 2], [60, -8]].map(([x, y]) => ellipse(x, y, 12, 8, '#7a5a3a', 0, 'opacity="0.7"') + circle(x - 8, y - 9, 3.5, '#7a5a3a', 0, 'opacity="0.7"') + circle(x + 8, y - 9, 3.5, '#7a5a3a', 0, 'opacity="0.7"')).join(''));
const bucket = piece('ml.bucket', [-50, -90, 100, 96], shadow(0, 0, 44, 6) + path('M-36 -60 L36 -60 L28 0 L-28 0 Z', P.sea, 5) + path('M-36 -60 Q0 -100 36 -60', 'none', 0, `stroke="${P.ink}" stroke-width="5"`) + [[-14, -66], [10, -70], [0, -62]].map(([x, y], i) => path(`M${x - 12} ${y} Q${x} ${y - 12} ${x + 12} ${y} Q${x} ${y + 8} ${x - 12} ${y} Z`, [P.pumpkin, P.leaf, P.sun][i], 3)).join(''));
const looseLeaf = piece('ml.cluleaf', [-40, -20, 80, 40], path('M-30 0 Q0 -22 30 0 Q0 18 -30 0 Z', P.leaf, 4) + line('M-24 0 L24 0', 2.5, P.grassDark));
const chanStone = piece('ml.stone', [-56, -46, 112, 56], shadow(0, 4, 50, 6) + path(blobPath([[-50, 0], [-40, -28], [-6, -40], [30, -34], [50, -10], [44, 0]]), P.stone, 5) + shine(-12, -24, 14, 6, -10, 0.4));
const mark = piece('ml.mark', [-40, -20, 80, 40], ellipse(0, 0, 34, 12, 'none', 0, `stroke="${P.berry}" stroke-width="5" stroke-dasharray="8 7"`));
const measure = piece('ml.measure', [-20, -200, 40, 206], rrect(-8, -196, 16, 196, 4, P.sun, 4) + Array.from({ length: 9 }, (_, i) => line(`M-8 ${-20 - i * 20} L4 ${-20 - i * 20}`, 3, P.ink)).join(''));
const paddleToy = piece('ml.toy', [-60, -120, 120, 126], line('M0 0 L0 -60', 6, P.woodDark) + g(wheel.body, 'translate(0 -80) scale(0.25)'));

// ------------------------------------------------------------------ A4. The Festival Glade (dusk)

const glFar = (() => {
  const base = farLayer('gl.far', P.duskTop, 41);
  return piece('gl.far', base.box, base.body, base.defs, true);
})();
const glGround = groundLayer('gl.ground', { dusk: true, seed: 42 });
const bigLantern = piece(
  'gl.big',
  [-130, -300, 260, 306],
  line('M0 -300 L0 -270', 5, P.ink) + rrect(-60, -276, 120, 24, 8, P.woodDark, 4) + path('M-80 -252 Q-130 -140 -80 -30 L80 -30 Q130 -140 80 -252 Z', P.lantern, 6) + line('M-36 -250 Q-56 -140 -36 -32 M36 -250 Q56 -140 36 -32 M0 -252 L0 -30', 4, '#e3a032', 'opacity="0.7"') + rrect(-50, -32, 100, 20, 8, P.woodDark, 4) + shine(-30, -180, 16, 40, 0, 0.45),
);
const balloon = piece('gl.balloon', [-40, -110, 80, 116], line('M0 0 Q6 -30 0 -50', 3, P.ink) + ellipse(0, -76, 30, 36, P.rose, 5) + shine(-10, -88, 7, 12, -20, 0.5));
const paper = piece('gl.paper', [-120, -60, 240, 120], rrect(-110, -50, 220, 100, 8, P.cream, 5) + [-55, 0, 55].map((x) => line(`M${x} -46 L${x} 46`, 4, P.inkSoft, 'stroke-dasharray="10 8"')).join(''));
const paperFolded = piece('gl.paper.folded', [-60, -60, 120, 120], path('M-50 50 L-30 -50 L30 -50 L50 50 Z', P.cream, 5) + line('M-10 -50 L-14 50 M10 -50 L14 50', 3, P.inkSoft, 'opacity="0.6"'));
const table = piece('gl.table', [-150, -110, 300, 116], rrect(-140, -100, 280, 24, 8, P.wood, 5) + rrect(-120, -76, 20, 76, 6, P.woodDark, 4) + rrect(100, -76, 20, 76, 6, P.woodDark, 4));
const flamePost = piece('gl.post', [-40, -240, 80, 246], rrect(-10, -200, 20, 200, 6, P.woodDark, 4) + rrect(-28, -230, 56, 34, 8, P.stoneDark, 4) + path('M0 -270 Q16 -246 0 -232 Q-16 -246 0 -270 Z', P.lantern, 3));
const flame = piece('gl.flame', [-24, -50, 48, 56], path('M0 -46 Q22 -14 0 0 Q-22 -14 0 -46 Z', P.lantern, 4) + path('M0 -26 Q8 -10 0 -4 Q-8 -10 0 -26 Z', '#fff4c0', 0));
const spool = piece('gl.spool', [-60, -110, 120, 116], shadow(0, 0, 50, 7) + rrect(-40, -100, 80, 20, 6, P.wood, 4) + rrect(-28, -80, 56, 60, 6, P.cream, 4) + rrect(-40, -20, 80, 20, 6, P.wood, 4) + line('M-28 -70 L28 -64 M-28 -52 L28 -46 M-28 -34 L28 -28', 3, P.berry));
const bell = piece('gl.bell', [-60, -200, 120, 206], rrect(-50, -190, 100, 16, 6, P.woodDark, 4) + rrect(-44, -180, 10, 180, 4, P.woodDark, 4) + rrect(34, -180, 10, 180, 4, P.woodDark, 4) + path('M-26 -100 Q-28 -160 0 -164 Q28 -160 26 -100 Z', P.lantern, 5) + rrect(-32, -104, 64, 10, 4, P.woodDark, 3) + circle(0, -88, 8, P.woodDark, 3));
const pathLantern = (lit: boolean) =>
  piece(lit ? 'gl.path.on' : 'gl.path.off', [-40, -170, 80, 176], (lit ? circle(0, -128, 44, P.glow, 0, 'opacity="0.5"') : '') + rrect(-5, -110, 10, 110, 4, P.woodDark, 3) + path('M-22 -150 Q-34 -126 -22 -104 L22 -104 Q34 -126 22 -150 Z', lit ? P.lantern : mix(P.lantern, P.stone, 0.55), 4) + rrect(-14, -160, 28, 10, 4, P.woodDark, 3));
const skyLantern = (c: string, n: number) => piece(`gl.sky.${n}`, [-40, -70, 80, 90], circle(0, -30, 36, P.glow, 0, 'opacity="0.4"') + path('M-20 -60 Q-34 -30 -20 0 L20 0 Q34 -30 20 -60 Z', c, 4) + rrect(-12, 0, 24, 10, 4, P.woodDark, 3));
const skyLanterns = [P.lantern, P.berry, P.sea, P.leaf, P.plum].map((c, i) => skyLantern(c, i));
const scissors = piece('gl.scissors', [-50, -50, 100, 100], circle(-20, 24, 14, 'none', 0, `stroke="${P.berry}" stroke-width="8"`) + circle(20, 24, 14, 'none', 0, `stroke="${P.berry}" stroke-width="8"`) + line('M-12 12 L24 -40 M12 12 L-24 -40', 7, P.stone) + line('M-12 12 L24 -40 M12 12 L-24 -40', 2, P.ink));
const lanternToy = piece('gl.toy', [-40, -110, 80, 116], g(bigLantern.body, 'translate(0 -6) scale(0.32)'));

export const TRAIL_ADVENTURE_PIECES: ArtPiece[] = [
  brFar,
  brGround,
  shed,
  leafPile,
  plankLoose,
  plankSpan,
  stone,
  stonePile,
  rope,
  stick,
  wagon,
  basket,
  blanketSmall,
  brokenPost,
  rock,
  log,
  flagPennant,
  needFlat,
  needHop,
  needWide,
  bubble,
  mlFar,
  mlGround,
  streamWater,
  pool,
  millHouse,
  millLight,
  wheel,
  flume,
  damLeaves,
  damLeaf,
  footprints,
  bucket,
  looseLeaf,
  chanStone,
  mark,
  measure,
  paddleToy,
  glFar,
  glGround,
  bigLantern,
  balloon,
  paper,
  paperFolded,
  table,
  flamePost,
  flame,
  spool,
  bell,
  pathLantern(false),
  pathLantern(true),
  ...skyLanterns,
  scissors,
  lanternToy,
];

/** Souvenir art for the clubhouse pegs. */
export const SOUVENIR_ART: Record<string, string> = { 'bridge-flag': 'br.flag', 'mill-wheel': 'ml.toy', 'festival-lantern': 'gl.toy' };
