import { P, mix } from '../palette';
import { type ArtPiece, artRng, blobPath, circle, dgrad, ellipse, g, grain, line, path, piece, rrect, shine, vgrad } from '../svg';

/** Tinker Grove: Moss's workshop and the toy parts. Part art matches the physics shapes in sim.ts. */

export const CHIME_COLORS = [P.berry, P.sun, P.leaf, P.sea, P.plum];

const bg = (() => {
  const r = artRng(55);
  let body = `<rect x="-240" y="-180" width="2400" height="1440" fill="url(#wall)"/>`;
  for (let i = 0; i < 30; i++) {
    const x = -240 + i * 82;
    body += line(`M${x} -180 L${x + (r() - 0.5) * 30} 1260`, 3, P.barkDark, 'opacity="0.25"');
  }
  // tool pegs on the wall around the board
  const tools = [
    [120, 140, 'saw'],
    [140, 420, 'hammer'],
    [1880, 160, 'wrench'],
    [1900, 420, 'brush'],
  ] as const;
  for (const [x, y, k] of tools) {
    body += circle(x, y - 40, 7, P.woodDark, 3);
    if (k === 'hammer') body += rrect(x - 6, y - 40, 12, 110, 5, P.wood, 4) + rrect(x - 34, y - 52, 68, 28, 6, P.stone, 4);
    if (k === 'saw') body += path(`M${x - 50} ${y - 30} L${x + 50} ${y - 30} L${x + 50} ${y + 10} L${x - 50} ${y + 30} Z`, P.stone, 4) + rrect(x + 44, y - 46, 28, 60, 10, P.berry, 4);
    if (k === 'wrench') body += rrect(x - 6, y - 40, 12, 100, 5, P.stone, 4) + circle(x, y - 46, 16, P.stone, 4) + circle(x, y - 52, 6, P.woodDark);
    if (k === 'brush') body += rrect(x - 6, y - 40, 12, 80, 5, P.woodLight, 4) + path(`M${x - 18} ${y + 40} L${x + 18} ${y + 40} L${x + 14} ${y + 80} L${x - 14} ${y + 80} Z`, P.sea, 4);
  }
  // shelf with jars of nuts and bolts
  body += rrect(-200, 640, 360, 22, 6, P.woodDark, 5);
  for (let i = 0; i < 4; i++) {
    const x = -170 + i * 84;
    body += rrect(x, 560, 60, 80, 14, '#dff3f5', 4, 'fill-opacity="0.6"') + rrect(x + 6, 548, 48, 16, 5, [P.berry, P.sun, P.leaf, P.sea][i], 3.5) + circle(x + 20, 610, 7, P.stone) + circle(x + 38, 618, 6, P.woodLight);
  }
  // floor
  body += `<rect x="-240" y="880" width="2400" height="400" fill="url(#floor)"/>` + line('M-240 880 L2160 880', 6, P.ink, 'opacity="0.7"');
  for (let i = 0; i < 6; i++) body += line(`M-240 ${930 + i * 55} L2160 ${930 + i * 55}`, 3, P.woodDark, 'opacity="0.3"');
  // sawdust and shavings
  for (let i = 0; i < 40; i++) body += path(`M${-200 + r() * 2300} ${900 + r() * 300} q 10 -10 20 0`, 'none', 0, `stroke="${P.woodLight}" stroke-width="4" stroke-linecap="round" opacity="0.7"`);
  return piece('tk.bg', [-240, -180, 2400, 1440], body, vgrad('wall', '#8a6244', '#6b4a33') + vgrad('floor', '#c48c5c', '#946039'), true);
})();

/** The build board: a cork-and-pegboard panel (1600×800 in sim units, drawn at 1:1). */
const board = piece(
  'tk.board',
  [-30, -30, 1660, 860],
  rrect(-24, -24, 1648, 848, 28, P.woodDark, 6) +
    rrect(0, 0, 1600, 800, 14, 'url(#cork)', 0) +
    Array.from({ length: 19 }, (_, i) => Array.from({ length: 9 }, (_, j) => circle(40 + i * 80 + (j % 2 ? 40 : 0) * 0, 40 + j * 80, 4, mix(P.woodDark, '#d8b07c', 0.55))).join('')).join('') +
    grain(-20, -22, 1640, 18, 9, 4, P.wood),
  vgrad('cork', '#e9c99a', '#d9b27e'),
  true,
);

// --------------------------------------------------------------- parts (pivot = centre)

const plankArt = (key: string, w: number, seed: number, fill = P.woodLight) =>
  piece(key, [-w / 2 - 6, -18, w + 12, 36], rrect(-w / 2, -12, w, 24, 10, 'url(#pl)', 4.5) + grain(-w / 2 + 6, -10, w - 12, 20, seed, 3) + circle(-w / 2 + 16, 0, 4, P.stone, 2) + circle(w / 2 - 16, 0, 4, P.stone, 2), dgrad('pl', mix(fill, '#fff', 0.15), P.wood));

const ramp = plankArt('tk.ramp', 240, 1);
const plank = plankArt('tk.plank', 360, 2);
const moss = piece(
  'tk.moss',
  [-126, -24, 252, 48],
  rrect(-120, -6, 240, 22, 9, P.woodDark, 4) +
    path(blobPath([[-118, -2], [-100, -16], [-70, -10], [-40, -18], [-10, -11], [20, -18], [50, -10], [80, -17], [110, -8], [120, 6], [-120, 6]]), P.leaf, 4) +
    [-90, -50, -10, 30, 70, 100].map((x) => circle(x, -8, 4, mix(P.leaf, '#fff', 0.35))).join(''),
);
const curve = (() => {
  // band behind the rolling surface (r = 140 around (70,-70)), matching the collider in sim.ts
  const outer: string[] = [];
  const inner: string[] = [];
  for (let i = 0; i <= 16; i++) {
    const a = Math.PI - (i / 16) * (Math.PI / 2);
    inner.push(`${(70 + Math.cos(a) * 130).toFixed(1)} ${(-70 + Math.sin(a) * 130).toFixed(1)}`);
    outer.unshift(`${(70 + Math.cos(a) * 160).toFixed(1)} ${(-70 + Math.sin(a) * 160).toFixed(1)}`);
  }
  const d = `M${inner.join(' L')} L${outer.join(' L')} Z`;
  return piece('tk.curve', [-100, -80, 180, 180], path(d, 'url(#cv)', 4.5) + line('M-62 -40 Q-50 40 40 66', 3, P.woodDark, 'opacity="0.35"'), dgrad('cv', P.woodLight, P.wood));
})();
const bumper = piece(
  'tk.bumper',
  [-56, -56, 112, 130],
  rrect(-14, 30, 28, 40, 8, P.cream, 4) + circle(0, 0, 46, P.berry, 5) + circle(-18, -16, 10, '#fff', 3) + circle(16, -22, 7, '#fff', 3) + circle(20, 10, 11, '#fff', 3) + circle(-12, 18, 6, '#fff', 2.5) + shine(-20, -26, 14, 7, -30, 0.35),
);
const spring = piece(
  'tk.spring',
  [-66, -26, 132, 70],
  rrect(-58, -16, 116, 18, 7, P.sun, 4.5) +
    path('M-40 2 L40 10 L-40 18 L40 26 L-40 34', 'none', 0, `stroke="${P.stone}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"`) +
    path('M-40 2 L40 10 L-40 18 L40 26 L-40 34', 'none', 0, `stroke="${P.ink}" stroke-width="2" opacity="0.5"`) +
    rrect(-50, 32, 100, 10, 4, P.woodDark, 3.5),
);
const fan = piece(
  'tk.fan',
  [-56, -56, 112, 112],
  rrect(-10, 0, 20, 52, 6, P.woodDark, 4) +
    [0, 72, 144, 216, 288].map((a) => g(path('M0 0 Q14 -16 0 -44 Q-14 -16 0 0 Z', P.leaf, 3.5) + line('M0 -4 L0 -38', 2, P.grassDark), `rotate(${a})`)).join('') +
    circle(0, 0, 9, P.lantern, 3.5) +
    // wind marks on the blowing side (+x)
    line('M40 -24 Q50 -20 58 -24 M42 0 Q52 4 60 0 M40 24 Q50 28 58 24', 4, '#fff', 'opacity="0.9"'),
);
const block = piece('tk.block', [-46, -46, 92, 92], rrect(-40, -40, 80, 80, 10, 'url(#bk)', 5) + path('M0 -22 L6 -6 L22 -6 L9 4 L14 20 L0 10 L-14 20 L-9 4 L-22 -6 L-6 -6 Z', P.wood, 2.5) + shine(-20, -24, 10, 5, 0, 0.35), dgrad('bk', P.woodLight, P.wood));
const basket = piece(
  'tk.basket',
  [-86, -56, 172, 112],
  path('M-75 -45 L-60 45 L60 45 L75 -45', 'none', 0, `stroke="${P.ink}" stroke-width="22" stroke-linejoin="round" stroke-linecap="round"`) +
    path('M-75 -45 L-60 45 L60 45 L75 -45', 'none', 0, `stroke="#d9b56c" stroke-width="14" stroke-linejoin="round" stroke-linecap="round"`) +
    line('M-70 -20 L-58 -20 M-66 10 L-55 10 M58 -20 L70 -20 M55 10 L66 10 M-40 45 L-40 52 M0 45 L0 52 M40 45 L40 52', 3, '#a8823e'),
);
const chimes: ArtPiece[] = CHIME_COLORS.map((c, i) =>
  piece(
    `tk.chime.${i}`,
    [-76, -30, 152, 60],
    line('M-50 -12 L-50 -26 M50 -12 L50 -26', 3, P.inkSoft) +
      rrect(-70, -12, 140, 24, 12, c, 4.5) +
      shine(-30, -6, 30, 4, 0, 0.4) +
      // dots = which note (shape cue, not just colour)
      Array.from({ length: i + 1 }, (_, k) => circle(-((i * 16) / 2) + k * 16, 0, 4.5, '#fff', 2)).join(''),
  ),
);
const wheel = piece(
  'tk.wheel',
  [-66, -66, 132, 132],
  circle(0, 0, 60, '#d9a066', 5) + circle(0, 0, 44, 'none', 0, `stroke="${P.wood}" stroke-width="4"`) + circle(0, 0, 28, 'none', 0, `stroke="${P.wood}" stroke-width="4"`) + circle(0, 0, 10, P.woodDark, 3.5) + path('M-60 -6 L-48 -10 L-48 0 Z M60 6 L48 10 L48 0 Z', P.woodDark),
);
const spinArrow = piece('tk.spin', [-80, -80, 160, 160], path('M0 -72 A72 72 0 0 1 68 -24', 'none', 0, `stroke="${P.lantern}" stroke-width="10" stroke-linecap="round"`) + path('M58 -40 L76 -18 L50 -14 Z', P.lantern, 3));

const flag = piece('tk.flag', [-30, -100, 70, 106], line('M-10 0 L-10 -96', 5, P.woodDark) + path('M-8 -94 L40 -78 L-8 -62 Z', P.berry, 4) + circle(-10, 2, 8, P.stone, 3));
const flower = piece('tk.flower', [-30, -70, 60, 76], line('M0 0 L0 -40', 4, P.grassDark) + path('M0 -20 Q-16 -30 -18 -16 Z', P.leaf, 2.5) + [0, 72, 144, 216, 288].map((a) => circle(Math.cos((a * Math.PI) / 180) * 10, -50 + Math.sin((a * Math.PI) / 180) * 10, 9, P.rose, 3)).join('') + circle(0, -50, 7, P.sun, 3));
const bell = piece('tk.bell', [-30, -70, 60, 76], line('M0 -66 L0 -54', 4, P.inkSoft) + path('M-22 -6 Q-24 -50 0 -54 Q24 -50 22 -6 Z', P.lantern, 4) + rrect(-26, -10, 52, 10, 4, P.wood, 3) + circle(0, 2, 6, P.woodDark, 3));
const ribbon = piece('tk.ribbon', [-64, -24, 128, 48], line('M-56 0 Q-28 -16 0 0 Q28 16 56 0', 10, P.ink) + line('M-56 0 Q-28 -16 0 0 Q28 16 56 0', 5, P.plum));

// --------------------------------------------------------------- moving things

const acorn = piece(
  'tk.acorn',
  [-32, -34, 64, 64],
  ellipse(0, 6, 22, 24, 'url(#ac)', 4) + path('M-26 -4 Q-26 -26 0 -26 Q26 -26 26 -4 Q0 4 -26 -4 Z', P.woodDark, 4) + line('M-18 -12 L18 -12 M-14 -20 L14 -20', 2.5, P.bark) + rrect(-3, -34, 6, 10, 2, P.woodDark, 2.5) + shine(-8, 8, 6, 9, -10, 0.35),
  dgrad('ac', P.woodLight, P.wood),
);
const parcel = piece(
  'tk.parcel',
  [-40, -40, 80, 80],
  rrect(-32, -30, 64, 60, 8, '#d9b27e', 4.5) + line('M0 -30 L0 30 M-32 0 L32 0', 5, P.berry) + path('M0 -30 Q-14 -44 -8 -30 Q14 -44 8 -30', 'none', 0, `stroke="${P.berry}" stroke-width="4"`) + circle(16, 14, 6, P.lantern, 2.5),
);
const parachute = piece('tk.parachute', [-60, -120, 120, 100], path('M-54 -60 Q0 -130 54 -60 Q36 -70 18 -60 Q0 -72 -18 -60 Q-36 -70 -54 -60 Z', P.lilac, 4) + line('M-54 -60 L-20 -30 M54 -60 L20 -30 M0 -64 L0 -30', 2.5, P.inkSoft));
const snail = piece(
  'tk.snail',
  [-46, -64, 92, 100],
  // cart wheel is the collider; the snail rides on top
  circle(0, 0, 32, P.woodDark, 4.5) + circle(0, 0, 10, P.lantern, 3) + line('M0 -26 L0 26 M-26 0 L26 0', 3.5, P.wood) +
    path('M-38 -24 Q-38 -36 -26 -36 L26 -36 Q40 -36 42 -28 L46 -24 Z', '#e7c9a0', 3.5) +
    circle(-6, -50, 18, P.lilac, 4) +
    path('M-6 -50 m-11 0 a11 11 0 1 1 11 11 a7 7 0 1 1 -7 -7', 'none', 2.5) +
    line('M30 -36 L34 -56 M38 -34 L46 -52', 2.5) + circle(34, -58, 3.5, P.ink) + circle(46, -54, 3.5, P.ink),
);
const berry = piece('tk.berry', [-24, -28, 48, 52], circle(0, 2, 19, P.plum, 4) + circle(-6, -4, 5, '#fff', 0, 'opacity="0.5"') + path('M0 -16 Q-8 -28 -14 -22 M0 -16 Q8 -28 14 -22', 'none', 0, `stroke="${P.leaf}" stroke-width="4" stroke-linecap="round"`));

// --------------------------------------------------------------- challenge scenery

const cloud = piece('tk.cloud', [-130, -70, 260, 120], path('M-110 30 Q-120 -10 -80 -14 Q-70 -50 -20 -46 Q10 -70 50 -48 Q100 -54 104 -10 Q130 0 118 30 Z', P.cloud, 5) + circle(-30, 0, 5, P.ink) + circle(10, 0, 5, P.ink) + line('M-18 12 Q-10 18 -2 12', 3));
const mailbox = (key: string, color: string) =>
  piece(key, [-60, -170, 120, 176], rrect(-8, -110, 16, 110, 5, P.woodDark, 4) + path('M-44 -160 L44 -160 L44 -110 L-44 -110 Z', color, 4.5) + path('M-44 -160 Q0 -186 44 -160', color, 4.5) + rrect(-28, -146, 40, 10, 4, P.ink, 0, 'opacity="0.6"') + path('M44 -156 L56 -156 L56 -136 L44 -136', P.berry, 3));
const pad = piece('tk.pad', [-90, -14, 180, 34], rrect(-80, -8, 160, 22, 8, P.paper, 4) + line('M-60 3 L60 3', 3, P.woodLight, 'stroke-dasharray="8 8"'));
const station = piece('tk.station', [-170, -230, 340, 236], rrect(-150, -20, 300, 22, 8, P.woodDark, 4.5) + rrect(-110, -200, 16, 180, 5, P.wood, 4) + rrect(94, -200, 16, 180, 5, P.wood, 4) + path('M-140 -200 L140 -200 L120 -226 L-120 -226 Z', P.teal, 4.5) + circle(0, -150, 30, P.paper, 4) + path('M-6 -150 m-14 0 a14 14 0 1 1 14 14 a9 9 0 1 1 -9 -9', 'none', 3));
const ledge = piece('tk.ledge', [-200, -20, 400, 60], rrect(-180, -12, 360, 24, 8, P.woodDark, 4.5) + path('M-160 12 L-150 40 L-140 12 Z M140 12 L150 40 L160 12 Z', P.woodDark, 3.5));
const water = piece('tk.water', [0, 660, 540, 150], path('M0 680 Q60 664 130 680 T260 680 T390 680 T520 680 L520 800 L0 800 Z', 'url(#wt)', 4) + line('M30 710 Q60 700 90 710 M200 730 Q230 720 260 730 M380 705 Q410 695 440 705', 4, '#fff', 'opacity="0.7"'), vgrad('wt', P.water, P.waterDark));
const bank = piece('tk.bank', [-200, -20, 400, 240], path('M-190 -12 L190 -12 L200 220 L-200 220 Z', 'url(#bn)', 4.5) + path('M-190 -12 L190 -12 L190 6 L-190 6 Z', P.grass, 0) + line('M-150 -12 Q-148 -24 -140 -30 M-60 -12 Q-58 -26 -50 -32 M40 -12 Q42 -24 50 -30 M130 -12 Q132 -26 140 -32', 4, P.grassDark), vgrad('bn', '#b98a5a', '#8a5f3a'));
const tree = piece('tk.tree', [-120, -260, 240, 270], path('M-20 0 L-14 -150 L14 -150 L20 0 Z', P.bark, 4.5) + path(blobPath([[-110, -150], [-80, -230], [0, -256], [90, -220], [110, -150], [40, -120], [-50, -120]]), P.leaf, 5) + [[-50, -170], [20, -200], [60, -150]].map(([x, y]) => ellipse(x, y, 9, 11, P.wood, 3)).join(''));
const hopper = piece('tk.hopper', [-80, -110, 160, 120], path('M-70 -100 L70 -100 L24 -10 L-24 -10 Z', P.sea, 5) + rrect(-24, -14, 48, 20, 6, P.woodDark, 4) + [-30, 0, 30].map((x) => circle(x, -70, 14, P.plum, 3)).join(''));
const gauge = piece(
  'tk.gauge',
  [-110, -110, 220, 130],
  path('M-90 0 A90 90 0 0 1 90 0 Z', P.paper, 5) +
    path('M-90 0 A90 90 0 0 1 -30 -85 L0 0 Z', mix(P.leaf, P.paper, 0.4), 0) +
    path('M30 -85 A90 90 0 0 1 90 0 L0 0 Z', mix(P.berry, P.paper, 0.4), 0) +
    path('M-90 0 A90 90 0 0 1 90 0 Z', 'none', 5) +
    // snail (slow) and rabbit-ear (fast) symbols at each end
    circle(-62, -24, 12, P.lilac, 3) +
    path('M58 -40 Q54 -64 60 -70 Q66 -64 64 -40 Z M70 -40 Q70 -62 76 -66 Q82 -60 76 -40 Z', '#fff', 3),
);
const needle = piece('tk.needle', [-8, -86, 16, 94], path('M-5 0 L0 -82 L5 0 Z', P.ink) + circle(0, 0, 8, P.lantern, 3));
const hatZone = piece('tk.hatzone', [0, 0, 340, 250], rrect(4, 4, 332, 242, 20, mix(P.lilac, '#fff', 0.6), 0, `stroke="${P.plum}" stroke-width="6" stroke-dasharray="18 14" fill-opacity="0.35"`));
const handleRot = piece('tk.h.rotate', [-40, -40, 80, 80], circle(0, 0, 34, P.paper, 5) + path('M-16 8 A18 18 0 1 1 10 16', 'none', 0, `stroke="${P.ink}" stroke-width="6" stroke-linecap="round"`) + path('M2 22 L16 18 L12 4 Z', P.ink));
const handleDel = piece('tk.h.delete', [-40, -40, 80, 80], circle(0, 0, 34, P.paper, 5) + line('M-13 -13 L13 13 M13 -13 L-13 13', 7));
const handleFlip = piece('tk.h.flip', [-40, -40, 80, 80], circle(0, 0, 34, P.paper, 5) + path('M-16 -6 L10 -6 L10 -14 L20 0 L10 14 L10 6 L-16 6 Z', P.sea, 3));
/** The goal star: "get it here". */
const starPts = (r1: number, r2: number) =>
  Array.from({ length: 10 }, (_, i) => {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const r = i % 2 ? r2 : r1;
    return `${(Math.cos(a) * r).toFixed(1)} ${(Math.sin(a) * r).toFixed(1)}`;
  }).join(' L');
const goalStar = piece('tk.star', [-64, -64, 128, 128], path(`M${starPts(58, 26)} Z`, P.lantern, 6) + path(`M${starPts(40, 18)} Z`, P.glow, 0) + circle(-12, -4, 4.5, P.ink) + circle(12, -4, 4.5, P.ink) + line('M-8 10 Q0 17 8 10', 3.5));
/** A paper lantern: shown by each friend's mailbox once their parcel arrives. */
const lanternGift = piece(
  'tk.lantern',
  [-34, -60, 68, 96],
  line('M0 -58 L0 -44', 3, P.inkSoft) + rrect(-14, -46, 28, 8, 3, P.woodDark, 3) + ellipse(0, -8, 28, 34, P.lantern, 4) + ellipse(0, -8, 16, 30, 'none', 0, `stroke="${P.berry}" stroke-width="3" opacity="0.6"`) + ellipse(0, -8, 14, 18, P.glow, 0, 'opacity="0.8"') + rrect(-14, 22, 28, 8, 3, P.woodDark, 3),
);
/** Music Machine: one bubble per note heard (empty, then lit). */
const noteOff = piece('tk.note', [-44, -44, 88, 88], circle(0, 0, 38, P.paper, 5, 'fill-opacity="0.7" stroke-dasharray="10 8"') + path('M-6 14 L-6 -18 L14 -22 L14 8', 'none', 0, `stroke="${P.inkSoft}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" opacity="0.45"`) + circle(-12, 14, 7, P.inkSoft, 0, 'opacity="0.45"') + circle(8, 8, 7, P.inkSoft, 0, 'opacity="0.45"'));
const noteOn = piece('tk.note.on', [-44, -44, 88, 88], circle(0, 0, 38, P.sun, 5) + path('M-6 14 L-6 -18 L14 -22 L14 8', 'none', 0, `stroke="${P.ink}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"`) + circle(-12, 14, 7, P.ink) + circle(8, 8, 7, P.ink) + shine(-14, -18, 12, 6, -30, 0.45));
const ghostRing = piece('tk.ghost', [-70, -70, 140, 140], circle(0, 0, 60, 'none', 0, `stroke="#fff" stroke-width="6" stroke-dasharray="12 10" opacity="0.9"`));
const cards: ArtPiece[] = [
  piece('tk.card.mail', [-80, -70, 160, 140], path('M-60 10 Q-66 -14 -42 -16 Q-36 -40 -8 -36 Q14 -50 36 -34 Q64 -36 64 -8 Q76 0 66 10 Z', P.cloud, 4) + rrect(-18, 20, 36, 32, 5, '#d9b27e', 3.5) + line('M0 20 L0 52 M-18 36 L18 36', 3, P.berry)),
  piece('tk.card.snail', [-80, -70, 160, 140], line('M-70 -40 L70 40', 10, P.wood) + circle(-20, -6, 22, P.woodDark, 4) + circle(-26, -36, 16, P.lilac, 3.5) + circle(46, 40, 10, P.teal, 3)),
  piece('tk.card.acorn', [-80, -70, 160, 140], path('M-80 30 Q-40 18 0 30 T80 30 L80 70 L-80 70 Z', P.water, 3.5) + line('M-60 10 L60 10', 10, P.woodLight) + ellipse(0, -14, 16, 18, P.wood, 3.5) + path('M-20 -22 Q-20 -40 0 -40 Q20 -40 20 -22 Z', P.woodDark, 3.5)),
  piece('tk.card.music', [-80, -70, 160, 140], [0, 1, 2].map((i) => `<g transform="translate(${-40 + i * 40} ${-30 + i * 30}) rotate(${i % 2 ? -15 : 15})">${rrect(-34, -9, 68, 18, 9, CHIME_COLORS[i * 2], 3.5)}</g>`).join('') + circle(-40, -56, 12, P.plum, 3)),
  piece('tk.card.free', [-80, -70, 160, 140], circle(-30, -10, 26, P.berry, 4) + rrect(10, -40, 50, 50, 8, P.woodLight, 4) + line('M-60 40 L60 20', 10, P.wood) + path('M-6 -50 L0 -64 L6 -50 L-8 -58 L8 -58 Z', P.sun, 2)),
];

export const TINKER_PIECES: ArtPiece[] = [
  bg,
  board,
  ramp,
  plank,
  moss,
  curve,
  bumper,
  spring,
  fan,
  block,
  basket,
  ...chimes,
  wheel,
  spinArrow,
  flag,
  flower,
  bell,
  ribbon,
  acorn,
  parcel,
  parachute,
  snail,
  berry,
  cloud,
  mailbox('tk.mailbox.pip', P.pipFur),
  mailbox('tk.mailbox.rowan', P.rowanFur),
  mailbox('tk.mailbox.fizz', P.fizzScarf),
  pad,
  station,
  ledge,
  water,
  bank,
  tree,
  hopper,
  gauge,
  needle,
  hatZone,
  handleRot,
  handleDel,
  handleFlip,
  ghostRing,
  goalStar,
  lanternGift,
  noteOff,
  noteOn,
  ...cards,
];

/** Art key used for a part (chimes vary by note). */
export function partArt(kind: string, note = 0): string {
  return kind === 'chime' ? `tk.chime.${note}` : `tk.${kind}`;
}
