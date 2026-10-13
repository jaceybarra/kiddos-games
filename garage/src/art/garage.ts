import { P } from './palette';
import { type ArtPiece, piece, path, circle, ellipse, rrect, line, g, shine, shadow, artRng, vgrad, blobPath, grain, rgrad } from './svg';

/**
 * Bentley's garage: the cosy inside (with the lift, shelves and coin jar), the
 * outside with its roll-up door and blank name sign, and the three mission
 * rewards. Same toy-set language as the truck, crew and meadow: warm ink
 * outlines (6 big shapes, 5 props, 3–4 details), light from the upper left,
 * wood grain at about 40%, softer colours behind.
 *
 * Text is never drawn here: the scene writes the child's name on the blank sign.
 */

// ---------------------------------------------------------------- shared helpers

const WALL_A = '#f3d29c';
const WALL_B = '#eccb92';
const WALL_SEAM = '#c79558';
const DOOR_RED = '#ec7a68';
const DOOR_RED_LIGHT = '#f8a593';
const DOOR_RED_DARK = '#c95a4b';
const GLASS = '#dff3fb';

/** A five-point star path centred on (cx, cy). */
export function starPath(cx: number, cy: number, r: number, inner = 0.45): string {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 === 0 ? r : r * inner;
    pts.push(`${(cx + Math.cos(a) * rr).toFixed(1)} ${(cy + Math.sin(a) * rr).toFixed(1)}`);
  }
  return `M${pts.join(' L')} Z`;
}

/** Soft four-point glint (sparkle) path. */
export function glintPath(cx: number, cy: number, r: number): string {
  const k = r * 0.22;
  return `M${cx} ${cy - r} Q${cx + k} ${cy - k} ${cx + r} ${cy} Q${cx + k} ${cy + k} ${cx} ${cy + r} Q${cx - k} ${cy + k} ${cx - r} ${cy} Q${cx - k} ${cy - k} ${cx} ${cy - r} Z`;
}

/** Vertical wooden planks with seams and grain (no outline: it is a backdrop). */
function planks(x0: number, x1: number, y0: number, y1: number, w: number, seed: number, a = WALL_A, b = WALL_B): string {
  let out = '';
  let i = 0;
  for (let x = x0; x < x1; x += w, i++) {
    const ww = Math.min(w, x1 - x);
    out += `<rect x="${x}" y="${y0}" width="${ww}" height="${y1 - y0}" fill="${i % 2 ? a : b}"/>`;
    // grain runs along the plank (vertical), drawn as gentle curves at 40%
    const r = artRng(seed + i * 7);
    for (let k = 0; k < 3; k++) {
      const gx = x + ww * (0.22 + 0.56 * ((k + r() * 0.5) / 3));
      const gy0 = y0 + (y1 - y0) * (0.05 + r() * 0.3);
      const gy1 = gy0 + (y1 - y0) * (0.25 + r() * 0.35);
      const bend = (r() - 0.5) * ww * 0.35;
      out += line(`M${gx.toFixed(1)} ${gy0.toFixed(1)} Q${(gx + bend).toFixed(1)} ${((gy0 + gy1) / 2).toFixed(1)} ${gx.toFixed(1)} ${gy1.toFixed(1)}`, 2.5, WALL_SEAM, 'opacity="0.4"');
    }
    // a knot now and then
    if (r() < 0.35) {
      const kx = x + ww * (0.3 + r() * 0.4);
      const ky = y0 + (y1 - y0) * (0.2 + r() * 0.6);
      out += ellipse(kx, ky, 6, 10, 'none', 0, `stroke="${WALL_SEAM}" stroke-width="2.5" opacity="0.4"`);
    }
    if (x > x0) out += line(`M${x} ${y0} L${x} ${y1}`, 3, WALL_SEAM, 'opacity="0.55"');
  }
  return out;
}

// ---------------------------------------------------------------- crew faces (front view)

export type FaceId = 'milo' | 'pip' | 'nori';

/**
 * A friend's face, front view, drawn in a 100-unit frame centred on (0,0)
 * (head radius about 36). Used by the crew banner and the DOM portraits.
 */
export function faceArt(id: FaceId): string {
  if (id === 'milo') {
    const B = P.beaver;
    return (
      circle(-30, -26, 11, B, 5) +
      circle(30, -26, 11, B, 5) +
      circle(-30, -26, 5, P.beaverLight) +
      circle(30, -26, 5, P.beaverLight) +
      circle(0, 0, 36, B, 6) +
      shine(-16, -16, 10, 6, -30, 0.22) +
      ellipse(0, 15, 21, 15, P.beaverLight, 4) +
      rrect(-7, 20, 14, 12, 3, '#ffffff', 3.5) +
      line('M0 20 L0 32', 2.5) +
      ellipse(0, 8, 7, 5, P.ink) +
      circle(-14, -6, 7, '#ffffff', 3.5) +
      circle(14, -6, 7, '#ffffff', 3.5) +
      circle(-13, -5, 3.6, P.ink) +
      circle(15, -5, 3.6, P.ink) +
      circle(-14, -7, 1.4, '#ffffff') +
      circle(14, -7, 1.4, '#ffffff') +
      ellipse(-25, 10, 5, 3.5, P.pink, 0, 'opacity="0.6"') +
      ellipse(25, 10, 5, 3.5, P.pink, 0, 'opacity="0.6"') +
      // yellow hard hat
      path('M-33 -16 Q-32 -50 0 -51 Q32 -50 33 -16 Z', P.yellow, 5) +
      rrect(-41, -21, 82, 10, 5, P.yellowDark, 4.5) +
      line('M0 -49 L0 -22', 3.5, P.yellowDark) +
      shine(-16, -36, 8, 4, -30, 0.45)
    );
  }
  if (id === 'pip') {
    const F = P.bunny;
    return (
      g(ellipse(0, 0, 11, 30, F, 5) + ellipse(0, 4, 5, 20, P.bunnyInner), 'translate(-15 -50) rotate(-10)') +
      g(ellipse(0, 0, 11, 30, F, 5) + ellipse(0, 4, 5, 20, P.bunnyInner), 'translate(16 -50) rotate(12)') +
      circle(0, 0, 34, F, 6) +
      shine(-15, -14, 9, 5, -30, 0.5) +
      // goggles pushed up on the forehead
      rrect(-34, -27, 68, 10, 5, P.ink) +
      circle(-13, -22, 10, P.blue, 4) +
      circle(13, -22, 10, P.blue, 4) +
      circle(-16, -25, 3, '#ffffff') +
      circle(10, -25, 3, '#ffffff') +
      circle(-13, 0, 6.5, '#ffffff', 3.5) +
      circle(13, 0, 6.5, '#ffffff', 3.5) +
      circle(-12, 1, 3.3, P.ink) +
      circle(14, 1, 3.3, P.ink) +
      path('M-5 11 L5 11 L0 16 Z', P.pink, 2.5) +
      line('M0 16 Q-5 22 -10 19 M0 16 Q5 22 10 19', 3) +
      ellipse(-23, 12, 6, 4, P.bunnyInner) +
      ellipse(23, 12, 6, 4, P.bunnyInner)
    );
  }
  // nori: peeking out of a green shell, round glasses
  const plates = [
    [-24, 26, 10],
    [0, 30, 11],
    [24, 26, 10],
  ]
    .map(([x, y, r]) => path(hexPath(x, y, r), P.turtleShellLight, 3))
    .join('');
  return (
    path('M-46 40 Q-46 2 0 2 Q46 2 46 40 Z', P.turtleShell, 5) +
    plates +
    circle(0, -6, 31, P.turtleSkin, 6) +
    shine(-14, -20, 9, 5, -30, 0.4) +
    circle(-13, -9, 11, '#ffffff', 4) +
    circle(13, -9, 11, '#ffffff', 4) +
    line('M-2 -10 L2 -10', 3.5) +
    circle(-12, -8, 4, P.ink) +
    circle(14, -8, 4, P.ink) +
    circle(-13, -10, 1.4, '#ffffff') +
    circle(13, -10, 1.4, '#ffffff') +
    line('M-9 8 Q0 15 9 8', 3.5) +
    ellipse(-22, 5, 5, 3.5, P.bunnyInner, 0, 'opacity="0.75"') +
    ellipse(22, 5, 5, 3.5, P.bunnyInner, 0, 'opacity="0.75"')
  );
}

function hexPath(cx: number, cy: number, r: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i + Math.PI / 6;
    pts.push(`${(cx + Math.cos(a) * r).toFixed(1)} ${(cy + Math.sin(a) * r).toFixed(1)}`);
  }
  return `M${pts.join(' L')} Z`;
}

// ---------------------------------------------------------------- small reusable props

/** A little round tree for windows and the meadow outside. */
function tree(x: number, y: number, s: number, leaf: string, dark: string, ow = 4): string {
  return (
    rrect(x - 7 * s, y - 40 * s, 14 * s, 42 * s, 5 * s, P.woodDark, ow) +
    path(blobPath([[x - 46 * s, y - 50 * s], [x - 40 * s, y - 92 * s], [x, y - 118 * s], [x + 42 * s, y - 94 * s], [x + 48 * s, y - 52 * s], [x, y - 36 * s]]), leaf, ow) +
    ellipse(x + 12 * s, y - 52 * s, 30 * s, 12 * s, dark, 0, 'opacity="0.45"') +
    shine(x - 18 * s, y - 92 * s, 16 * s, 9 * s, -25, 0.25)
  );
}

function bush(x: number, y: number, s: number, berries = true): string {
  return (
    path(blobPath([[x - 70 * s, y], [x - 62 * s, y - 36 * s], [x - 24 * s, y - 58 * s], [x + 22 * s, y - 56 * s], [x + 60 * s, y - 34 * s], [x + 70 * s, y]]), P.grass, 5) +
    shine(x - 26 * s, y - 36 * s, 20 * s, 9 * s, -20, 0.25) +
    ellipse(x + 14 * s, y - 10 * s, 44 * s, 9 * s, P.grassDark, 0, 'opacity="0.25"') +
    (berries ? circle(x - 30 * s, y - 20 * s, 6, P.red, 3) + circle(x + 12 * s, y - 32 * s, 6, P.red, 3) + circle(x + 38 * s, y - 14 * s, 6, P.red, 3) : '')
  );
}

function flowers(x: number, y: number, n: number, seed: number): string {
  const r = artRng(seed);
  const cols = [P.yellow, P.pink, '#ffffff', P.orange, P.purple];
  let out = '';
  for (let i = 0; i < n; i++) {
    const fx = x + i * 26 + r() * 8;
    const h = 18 + r() * 22;
    const c = cols[Math.floor(r() * cols.length)];
    out += line(`M${fx.toFixed(1)} ${y} L${fx.toFixed(1)} ${(y - h).toFixed(1)}`, 4, P.leafDark) + circle(fx, y - h, 8, c, 3.5) + circle(fx, y - h, 2.8, P.yellowDark);
  }
  return out;
}

function cloud(x: number, y: number, s: number): string {
  return (
    path(blobPath([[x - 120 * s, y + 30 * s], [x - 90 * s, y - 20 * s], [x - 30 * s, y - 50 * s], [x + 40 * s, y - 40 * s], [x + 100 * s, y - 10 * s], [x + 120 * s, y + 30 * s]]), '#ffffff', 0, 'opacity="0.95"') +
    ellipse(x, y + 34 * s, 118 * s, 14 * s, '#dceef8')
  );
}

// ---------------------------------------------------------------- garage.interior

const interior = (() => {
  const defs =
    vgrad('gi-sky', P.skyTop, P.skyLow) +
    vgrad('gi-floor', '#d7c2a2', '#c8ad88') +
    rgrad('gi-glow', '#fff8e6', '#fff8e6', 0.55, 0) +
    `<clipPath id="gi-win-clip"><circle cx="300" cy="226" r="70"/></clipPath>` +
    `<clipPath id="gi-door-clip"><rect x="1500" y="260" width="400" height="620"/></clipPath>`;

  let s = '';
  // back wall
  s += planks(0, 1920, 0, 880, 120, 31);
  // a warm pool of light behind the lift (calm, no detail)
  s += ellipse(960, 640, 520, 300, 'url(#gi-glow)');
  // ceiling beam + bunting
  s += rrect(-10, -10, 1940, 70, 0, P.wood) + rrect(-10, 50, 1940, 14, 0, P.woodDark, 0, 'opacity="0.55"');
  s += grain(0, 4, 1920, 44, 3, 6);
  s += line('M-10 60 L1930 60', 5);
  const nails = [24, 492, 960, 1428, 1896];
  for (let i = 0; i < nails.length - 1; i++) {
    const a = nails[i];
    const b = nails[i + 1];
    s += line(`M${a} 74 Q${(a + b) / 2} 110 ${b} 74`, 3, P.inkSoft);
    const cols = [P.red, P.yellow, P.blue, P.teal, P.orange];
    for (let k = 1; k < 9; k++) {
      const t = k / 9;
      const fx = a + (b - a) * t;
      const fy = 74 + 72 * t * (1 - t); // follows the sag; the flags stay above the name band (y 120)
      s += path(`M${(fx - 16).toFixed(1)} ${fy.toFixed(1)} L${(fx + 16).toFixed(1)} ${fy.toFixed(1)} L${fx.toFixed(1)} ${(fy + 25).toFixed(1)} Z`, cols[(i * 8 + k) % cols.length], 3);
    }
  }
  for (const n of nails) s += circle(n, 74, 6, P.metalDark, 3);

  // round window with sky and a tree
  s += circle(300, 226, 86, P.wood, 5);
  s += grain(226, 146, 148, 36, 77, 2);
  s += g(
    `<rect x="220" y="146" width="160" height="160" fill="url(#gi-sky)"/>` +
      cloud(272, 184, 0.3) +
      path('M220 272 Q262 244 318 262 Q356 250 380 262 L380 310 L220 310 Z', P.hillMid) +
      tree(336, 290, 0.56, P.grassLight, P.grass, 3),
    '',
    'clip-path="url(#gi-win-clip)"',
  );
  s += circle(300, 226, 70, 'none', 5);
  s += line('M300 156 L300 296 M230 226 L370 226', 7, P.wood) + line('M300 156 L300 296 M230 226 L370 226', 2.5, P.woodDark, 'opacity="0.5"');
  s += shine(266, 192, 20, 9, -35, 0.35);

  // pegboard with tool silhouettes (generic tools, no brands)
  let peg = '';
  peg += rrect(84, 320, 432, 290, 14, '#e7bd80', 5);
  for (let y = 344; y < 600; y += 28) for (let x = 108; x < 510; x += 28) s += circle(x, y, 3.2, P.woodDark, 0, 'opacity="0.35"');
  const outline = (d: string) => path(d, '#fff6e6', 0, 'opacity="0.55" transform="translate(5 5)"');
  // wrench
  const wrench = 'M150 352 Q138 352 136 368 L136 378 L146 386 L146 520 Q134 528 136 544 Q140 562 160 562 Q180 562 184 544 Q186 528 174 520 L174 386 L184 378 L184 368 Q182 352 170 352 L170 372 L150 372 Z';
  peg += outline(wrench) + path(wrench, P.metal, 4) + circle(160, 542, 8, '#e7bd80', 3) + line('M152 400 L152 506', 3, '#ffffff', 'opacity="0.6"');
  // hammer
  const hammerHandle = 'M240 398 L258 398 L262 576 Q249 584 236 576 Z';
  const hammerHead = 'M206 364 L282 364 Q292 364 292 374 L292 396 Q292 404 282 404 L206 404 Q196 402 194 390 L200 376 Z';
  peg += outline(hammerHandle) + outline(hammerHead) + path(hammerHandle, P.wood, 4) + path(hammerHead, P.metalDark, 4) + line('M212 374 L278 374', 3, '#ffffff', 'opacity="0.5"');
  // saw
  const sawBlade = 'M328 410 L394 410 L404 584 L338 584 Z';
  const sawHandle = 'M318 350 Q318 336 334 336 L388 336 Q404 336 404 352 L404 404 Q404 414 394 414 L328 414 Q318 414 318 404 Z';
  let teeth = '';
  for (let y = 420; y < 582; y += 14) teeth += `L${404 - ((584 - y) / 174) * 10 + 9} ${y + 7} L${404 - ((584 - (y + 14)) / 174) * 10} ${y + 14} `;
  peg += outline(sawBlade) + outline(sawHandle) + path(sawBlade, '#d7dee5', 4) + path(`M394 410 ${teeth} L404 584`, 'none', 3) + path(sawHandle, P.red, 4) + rrect(338, 352, 46, 30, 12, '#e7bd80', 3.5);
  peg += circle(348, 420, 3, P.metalDark) + circle(372, 420, 3, P.metalDark);
  // screwdriver
  const sdHandle = 'M450 354 Q450 342 462 342 L478 342 Q490 342 490 354 L490 418 Q490 428 480 428 L460 428 Q450 428 450 418 Z';
  peg += outline(sdHandle) + outline('M465 428 L475 428 L475 556 L470 566 L465 556 Z') + path('M465 428 L475 428 L475 556 L470 566 L465 556 Z', P.metal, 3.5) + path(sdHandle, P.yellow, 4) + line('M462 356 L462 414 M478 356 L478 414', 3, P.yellowDark);
  // pegs
  for (const [x, y] of [[160, 344], [250, 352], [361, 330], [470, 336]] as const) s += circle(x, y, 5, P.metalDark, 3);

  s += g(peg, 'translate(0 16)');

  // workbench (left)
  s += shadow(296, 880, 260, 10, 0.16);
  s += rrect(78, 690, 34, 190, 6, P.woodDark, 5) + rrect(480, 690, 34, 190, 6, P.woodDark, 5);
  s += rrect(96, 796, 404, 22, 6, P.wood, 5);
  // lower shelf: a blue paint tin with a drip and a crate
  s += rrect(140, 730, 70, 66, 8, P.blue, 5) + ellipse(175, 732, 35, 8, P.blueDark, 4) + path('M150 738 Q150 760 156 762 Q162 760 162 740 Z', P.blueDark) + rrect(166, 760, 28, 18, 4, '#ffffff', 3, 'opacity="0.8"');
  s += rrect(300, 740, 130, 56, 6, P.card, 5) + line('M300 768 L430 768', 3, P.cardDark) + grain(300, 740, 130, 56, 5, 2, P.cardDark);
  // bench top
  s += rrect(48, 640, 496, 34, 8, P.wood, 6) + rrect(62, 674, 468, 24, 4, P.woodDark, 5);
  s += grain(60, 642, 470, 30, 12, 3) + line('M60 648 L360 648', 3, '#ffffff', 'opacity="0.35"');
  // on the bench: a little vise, a jar of brushes, a potted plant
  s += rrect(96, 610, 80, 30, 6, P.metalDark, 4) + rrect(104, 586, 30, 26, 4, P.metal, 4) + rrect(138, 586, 30, 26, 4, P.metal, 4) + line('M120 600 L150 600', 4) + circle(186, 624, 8, P.red, 3.5) + line('M176 624 L196 624', 3);
  s += line('M292 600 L280 556 M304 598 L306 548 M316 600 L330 560', 6, P.woodDark) + path('M276 556 L284 544 L290 560 Z', P.red, 2.5) + path('M300 548 L306 534 L312 548 Z', P.yellow, 2.5) + path('M326 562 L336 548 L340 566 Z', P.blue, 2.5);
  s += path('M276 594 L332 594 L326 640 L282 640 Z', GLASS, 4, 'fill-opacity="0.85"') + shine(290, 610, 5, 12, 0, 0.6);
  s += path('M430 604 L486 604 L478 640 L438 640 Z', P.orange, 4) + path(blobPath([[434, 604], [440, 574], [458, 560], [478, 572], [484, 604]]), P.leaf, 4) + line('M458 600 L458 574', 3, P.leafDark);

  // a crayon drawing pinned to the wall: a truck under a sun
  s += g(
    rrect(-56, -50, 112, 100, 4, '#ffffff', 4) +
      circle(30, -26, 12, P.yellow) +
      line('M30 -46 L30 -42 M50 -26 L46 -26 M44 -40 L41 -37', 3, P.yellowDark) +
      path('M-36 14 L-36 -2 L-8 -2 L-2 -14 L14 -14 L22 -2 L34 2 L34 14 Z', P.red, 0) +
      circle(-24, 18, 9, P.ink) +
      circle(22, 18, 9, P.ink) +
      line('M-46 30 Q0 24 46 30', 3, P.grass) +
      rrect(-14, -58, 28, 14, 2, '#f6efc2', 0, 'opacity="0.85"'),
    'translate(1412 350) rotate(4)',
  );
  // Bentley's helmet hanging on a peg
  s += g(
    line('M0 -8 L0 10', 4, P.inkSoft) +
      circle(0, -10, 6, P.metalDark, 3) +
      path('M-46 60 Q-50 8 -2 6 Q44 6 50 48 L50 66 Q50 72 44 72 L-40 72 Q-46 72 -46 66 Z', P.orange, 5) +
      path('M6 26 Q36 24 46 46 L46 58 L8 58 Q2 58 2 52 L2 32 Q2 26 6 26 Z', '#5b86a8', 4) +
      line('M12 32 L22 32', 4, '#ffffff', 'opacity="0.6"') +
      path('M-44 44 Q-20 36 2 38 L2 50 Q-22 48 -45 56 Z', P.cream, 0, 'opacity="0.9"') +
      shine(-22, 22, 16, 7, -20, 0.35),
    'translate(1408 520)',
  );

  // the open roll-up doorway on the right: the bright meadow outside
  s += g(
    `<rect x="1500" y="260" width="400" height="620" fill="url(#gi-sky)"/>` +
      circle(1820, 340, 36, '#fff3b0', 0, 'opacity="0.9"') +
      cloud(1640, 360, 0.45) +
      path('M1500 640 Q1600 590 1700 620 Q1800 586 1900 616 L1900 880 L1500 880 Z', P.hillFar) +
      path('M1500 720 Q1620 680 1740 712 Q1830 690 1900 704 L1900 880 L1500 880 Z', P.hillMid) +
      tree(1800, 760, 0.95, P.grassLight, P.grass, 4) +
      rrect(1490, 800, 420, 90, 0, P.grass) +
      line('M1490 800 Q1700 792 1910 800', 4, P.grassDark, 'opacity="0.35"') +
      bush(1580, 806, 0.55, false) +
      flowers(1640, 836, 6, 41),
    '',
    'clip-path="url(#gi-door-clip)"',
  );
  // door posts and the rolled-up door drum
  s += rrect(1478, 262, 28, 622, 6, P.wood, 5) + rrect(1896, 262, 34, 622, 6, P.wood, 5);
  s += grain(1478, 300, 28, 560, 21, 2);
  s += rrect(1470, 214, 470, 56, 26, DOOR_RED, 6) + rrect(1486, 222, 440, 12, 6, DOOR_RED_LIGHT) + line('M1500 248 L1920 248', 3, DOOR_RED_DARK) + rrect(1450, 228, 30, 28, 8, P.metalDark, 4);

  // skirting board and floor
  s += rrect(-10, 852, 1490, 30, 0, P.woodDark, 0) + line('M-10 852 L1480 852', 4);
  s += `<rect x="-10" y="880" width="1940" height="210" fill="url(#gi-floor)"/>`;
  s += rrect(-10, 880, 1940, 16, 0, P.ink, 0, 'opacity="0.12"');
  s += line('M-10 880 L1930 880', 5);
  for (const x of [240, 680, 1240, 1700]) s += line(`M${x} 900 L${x - 30} 1080`, 3, '#a88e6c', 'opacity="0.4"');
  // daylight spilling in from the doorway
  s += path('M1500 882 L1900 882 L1760 1080 L1200 1080 Z', '#fff6d8', 0, 'opacity="0.35"');
  s += ellipse(960, 930, 420, 40, '#fff6d8', 0, 'opacity="0.25"');

  return piece('garage.interior', [0, 0, 1920, 1080], s, defs, true);
})();

// ---------------------------------------------------------------- garage.exterior

const exterior = (() => {
  const defs =
    vgrad('gx-sky', P.skyTop, P.skyLow) +
    vgrad('gx-dark', '#3f2b20', '#6a4a36') +
    `<clipPath id="gx-dark-clip"><rect x="610" y="330" width="700" height="550"/></clipPath>`;
  let s = '';
  s += `<rect x="0" y="0" width="1920" height="1080" fill="url(#gx-sky)"/>`;
  // soft sun from the upper left
  s += circle(170, 150, 90, '#fff6c8', 0, 'opacity="0.45"') + circle(170, 150, 62, '#ffe99a');
  s += cloud(420, 190, 0.7) + cloud(1640, 150, 0.85) + cloud(1210, 70, 0.4);
  // far and mid hills (softer behind)
  s += path('M0 640 Q240 560 480 600 Q760 650 1000 590 Q1300 520 1560 590 Q1760 640 1920 590 L1920 880 L0 880 Z', P.hillFar);
  s += tree(140, 650, 0.6, '#9fcf96', '#7fb57a', 0) + tree(1610, 640, 0.55, '#9fcf96', '#7fb57a', 0) + tree(1790, 650, 0.5, '#9fcf96', '#7fb57a', 0);
  s += path('M0 760 Q200 700 420 730 Q700 770 960 740 Q1240 700 1520 744 Q1740 776 1920 730 L1920 880 L0 880 Z', P.hillMid, 4, 'stroke-opacity="0.35"');
  // big trees either side
  s += tree(190, 884, 1.9, P.grassLight, P.grass, 5) + tree(1760, 884, 1.75, P.grassLight, P.grass, 5);
  // a little fence on the left
  s += g(rrect(-104, -70, 208, 14, 5, P.woodLight, 5) + rrect(-104, -38, 208, 14, 5, P.woodLight, 5) + [-86, -30, 30, 86].map((x) => rrect(x - 9, -84, 18, 84, 5, P.wood, 5)).join(''), 'translate(1580 880) scale(0.9)');

  // ---- the garage building
  s += shadow(960, 884, 560, 14, 0.2);
  // facade (house shape) in painted planks
  const facade = 'M480 320 L960 120 L1440 320 L1440 880 L480 880 Z';
  s += path(facade, '#f6dfae', 6);
  s += g(planks(480, 1440, 110, 880, 80, 57, '#f8e4b8', '#f2d9a6'), '', `clip-path="url(#gx-facade-clip)"`);
  s += path(facade, 'none', 6);
  // corner posts and base
  s += rrect(462, 336, 42, 548, 8, P.wood, 6) + rrect(1416, 336, 42, 548, 8, P.wood, 6);
  s += grain(462, 320, 42, 540, 61, 2) + grain(1416, 320, 42, 540, 63, 2);
  s += rrect(470, 852, 980, 30, 6, '#c9b9a3', 5);
  // roof: two thick boards with a scalloped edge, overhanging the gable
  const roofL = 'M416 344 L960 104 L960 148 L436 376 Z';
  const roofR = 'M1504 344 L960 104 L960 148 L1484 376 Z';
  s += path(roofL, P.red, 6) + path(roofR, P.red, 6);
  let scallops = '';
  for (let i = 0; i < 9; i++) {
    const t0 = i / 9;
    const t1 = (i + 1) / 9;
    const ax = 436 + (960 - 436) * t0;
    const ay = 376 + (148 - 376) * t0;
    const bx = 436 + (960 - 436) * t1;
    const by = 376 + (148 - 376) * t1;
    scallops += line(`M${ax.toFixed(1)} ${ay.toFixed(1)} Q${((ax + bx) / 2 + 6).toFixed(1)} ${((ay + by) / 2 + 14).toFixed(1)} ${bx.toFixed(1)} ${by.toFixed(1)}`, 4, P.redDark);
    scallops += line(`M${(1920 - ax).toFixed(1)} ${ay.toFixed(1)} Q${(1920 - (ax + bx) / 2 - 6).toFixed(1)} ${((ay + by) / 2 + 14).toFixed(1)} ${(1920 - bx).toFixed(1)} ${by.toFixed(1)}`, 4, P.redDark);
  }
  s += scallops;
  s += line('M430 342 L960 112', 4, '#ffffff', 'opacity="0.35"');
  s += rrect(940, 96, 40, 30, 10, P.redDark, 5);
  // weather vane: a pole, a pointing arrow and a tiny truck
  s += line('M960 98 L960 22', 6) + line('M960 98 L960 22', 2.5, P.metal);
  s += path('M900 50 L1006 50 L1006 42 L1030 54 L1006 66 L1006 58 L900 58 Z', P.metalDark, 4) + path('M890 40 L912 54 L890 68 L900 54 Z', P.metalDark, 4);
  s += g(path('M-24 0 L-24 -12 L-4 -12 L0 -22 L14 -22 L20 -12 L26 -10 L26 0 Z', P.metalDark, 4) + circle(-14, 2, 6, P.metalDark, 3.5) + circle(16, 2, 6, P.metalDark, 3.5), 'translate(944 40)');
  s += circle(960, 18, 7, P.yellow, 4);

  // the blank sign (the scene writes the name on it)
  s += rrect(680, 195, 560, 110, 20, P.wood, 6);
  s += grain(690, 200, 540, 22, 71, 3);
  s += rrect(698, 211, 524, 78, 12, '#fbe7c0', 4);
  s += [[694, 209], [1226, 209], [694, 291], [1226, 291]].map(([x, y]) => circle(x, y, 4.5, P.metalDark, 2.5)).join('');

  // door frame and the dark inside (the door itself is a separate piece)
  s += rrect(586, 310, 748, 576, 10, P.wood, 6);
  s += grain(590, 312, 740, 18, 81, 3);
  s += g(
    `<rect x="610" y="330" width="700" height="550" fill="url(#gx-dark)"/>` +
      // faint shapes of the garage inside: a shelf, a workbench, the lift
      rrect(660, 470, 220, 12, 4, '#7a5640', 0, 'opacity="0.6"') +
      rrect(1060, 600, 200, 16, 4, '#7a5640', 0, 'opacity="0.6"') +
      rrect(1080, 616, 14, 150, 3, '#7a5640', 0, 'opacity="0.5"') +
      rrect(1226, 616, 14, 150, 3, '#7a5640', 0, 'opacity="0.5"') +
      ellipse(960, 868, 240, 18, '#7a5640', 0, 'opacity="0.6"'),
    '',
    'clip-path="url(#gx-dark-clip)"',
  );
  s += rrect(610, 330, 700, 550, 0, 'none', 5);
  // two little wall lanterns (shape + soft glow)
  for (const x of [545, 1375]) {
    s += circle(x, 470, 34, '#fff3b0', 0, 'opacity="0.45"');
    s += rrect(x - 4, 420, 8, 18, 3, P.ink) + path(`M${x - 22} 438 L${x + 22} 438 L${x + 14} 448 L${x - 14} 448 Z`, P.rubberLight, 4) + rrect(x - 14, 448, 28, 36, 6, P.yellow, 4) + line(`M${x} 452 L${x} 480`, 3, P.yellowDark) + rrect(x - 16, 484, 32, 8, 4, P.rubberLight, 3.5);
  }

  // ---- ground: grass lip, soil, and a smooth apron in front of the door
  s += `<rect x="-10" y="880" width="1940" height="210" fill="${P.soil}"/>`;
  s += rrect(-10, 880, 1940, 34, 0, P.grass);
  s += path('M-10 914 ' + Array.from({ length: 49 }, (_, i) => `Q${-10 + i * 40 + 20} ${i % 2 ? 930 : 924} ${30 + i * 40} 914`).join(' ') + ' L1930 880 L-10 880 Z', P.grass);
  s += rrect(586, 880, 748, 26, 0, '#d8c8b0') + line('M586 906 L1334 906', 4, '#b9a68a');
  s += line('M-10 880 L1930 880', 5);
  const r = artRng(97);
  for (let i = 0; i < 40; i++) s += ellipse(r() * 1920, 950 + r() * 120, 6 + r() * 8, 4 + r() * 4, P.soilDark, 0, 'opacity="0.35"');
  // bushes and flowers along the building
  s += bush(420, 884, 0.95) + bush(1500, 884, 0.95);
  s += flowers(330, 882, 3, 13) + flowers(1350, 882, 3, 17) + flowers(1630, 882, 4, 19);

  return piece('garage.exterior', [0, 0, 1920, 1080], s, defs + `<clipPath id="gx-facade-clip"><path d="${facade}"/></clipPath>`, true);
})();

// ---------------------------------------------------------------- garage.door

const door = (() => {
  let s = rrect(3, 3, 694, 544, 14, P.cream, 6);
  const top = 16;
  const h = 58;
  for (let i = 0; i < 9; i++) {
    const y = top + i * h;
    s += `<rect x="22" y="${y}" width="656" height="${h}" fill="${DOOR_RED}"/>`;
    s += `<rect x="22" y="${y + 3}" width="656" height="7" fill="${DOOR_RED_LIGHT}" opacity="0.8"/>`;
    s += `<rect x="22" y="${y + h - 9}" width="656" height="9" fill="${DOOR_RED_DARK}" opacity="0.7"/>`;
    if (i > 0) s += line(`M22 ${y} L678 ${y}`, 3.5, P.ink, 'opacity="0.7"');
  }
  // a row of little windows
  for (let k = 0; k < 4; k++) {
    const x = 58 + k * 152;
    s += rrect(x, top + h + 10, 128, 38, 12, '#7da7c4', 4) + line(`M${x + 16} ${top + h + 40} L${x + 40} ${top + h + 16}`, 5, '#ffffff', 'opacity="0.5"');
  }
  s += rrect(22, top, 656, 9 * h, 4, 'none', 4);
  // handle and bottom seal
  s += rrect(300, 470, 100, 22, 11, P.cream, 5) + rrect(306, 488, 10, 14, 3, P.metalDark, 3) + rrect(384, 488, 10, 14, 3, P.metalDark, 3);
  s += rrect(8, 530, 684, 16, 7, P.rubber, 4);
  s += shine(120, 40, 70, 10, -4, 0.3);
  return piece('garage.door', [0, 0, 700, 550], s);
})();

// ---------------------------------------------------------------- garage.lift

const lift = (() => {
  const side = 'M-266 0 L-266 30 A266 22 0 0 0 266 30 L266 0 Z';
  let chev = '';
  for (let x = -300; x < 300; x += 48) chev += path(`M${x} 8 L${x + 18} 8 L${x + 34} 26 L${x + 18} 44 L${x} 44 L${x + 16} 26 Z`, P.yellow, 0);
  const s =
    ellipse(0, 52, 250, 6, P.ink, 0, 'opacity="0.18"') +
    path(side, P.blue, 6) +
    g(chev, '', 'clip-path="url(#glift-clip)"') +
    path(side, 'none', 6) +
    ellipse(0, 0, 266, 20, P.metal, 6) +
    ellipse(0, 0, 214, 13, '#cfd7de', 3.5) +
    [-240, -150, -50, 50, 150, 240].map((x) => circle(x, x === -240 || x === 240 ? 0 : 13 * Math.sqrt(1 - (x / 266) ** 2) * 1.05, 4.5, P.metalDark, 2.5)).join('') +
    line('M-190 -8 Q-120 -14 -40 -14', 4, '#ffffff', 'opacity="0.6"');
  return piece('garage.lift', [-280, -30, 560, 90], s, `<clipPath id="glift-clip"><path d="${side}"/></clipPath>`);
})();

// ---------------------------------------------------------------- garage.shelf

const shelf = piece(
  'garage.shelf',
  [-320, -12, 640, 70],
  ellipse(0, 34, 280, 8, P.ink, 0, 'opacity="0.12"') +
    path('M-232 20 L-232 54 L-206 54 Q-206 30 -178 26 L-178 20 Z', P.woodDark, 5) +
    path('M232 20 L232 54 L206 54 Q206 30 178 26 L178 20 Z', P.woodDark, 5) +
    rrect(-312, 0, 624, 24, 7, P.wood, 5) +
    grain(-300, 2, 600, 20, 101, 3) +
    line('M-296 6 L180 6', 3, '#ffffff', 'opacity="0.4"') +
    circle(-219, 40, 3, P.metalDark) +
    circle(219, 40, 3, P.metalDark),
);

// ---------------------------------------------------------------- garage.spot (an empty display place)

const spot = piece(
  'garage.spot',
  [-70, -150, 140, 152],
  rrect(-60, -144, 120, 122, 26, '#fff6e6', 0, 'opacity="0.45"') +
    rrect(-60, -144, 120, 122, 26, 'none', 0, `stroke="${P.ink}" stroke-width="5" stroke-dasharray="14 12" stroke-linecap="round" opacity="0.5"`) +
    path(glintPath(0, -84, 26), '#ffffff', 0, 'opacity="0.55"') +
    path(glintPath(-26, -112, 9), '#ffffff', 0, 'opacity="0.45"') +
    path(glintPath(28, -58, 7), '#ffffff', 0, 'opacity="0.45"') +
    rrect(-50, -18, 100, 16, 7, P.woodLight, 4) +
    line('M-40 -11 L30 -11', 2.5, P.woodDark, 'opacity="0.45"'),
);

// ---------------------------------------------------------------- the coin jar

const JAR = 'M-40 -124 L40 -124 L40 -116 Q54 -112 54 -96 L54 -22 Q54 -2 34 -2 L-34 -2 Q-54 -2 -54 -22 L-54 -96 Q-54 -112 -40 -116 Z';
const JAR_IN = 'M-45 -104 Q-45 -110 -36 -110 L36 -110 Q45 -110 45 -104 L45 -24 Q45 -10 32 -10 L-32 -10 Q-45 -10 -45 -24 Z';

const jar = piece(
  'garage.jar',
  [-60, -150, 120, 152],
  shadow(0, 0, 50, 4, 0.18) +
    path(JAR, GLASS, 0, 'opacity="0.55"') +
    path(JAR, 'none', 6) +
    // lid
    rrect(-46, -146, 92, 24, 7, P.red, 5) +
    line('M-34 -142 L-34 -126 M-20 -142 L-20 -126 M-6 -142 L-6 -126 M8 -142 L8 -126 M22 -142 L22 -126 M36 -142 L36 -126', 2.5, P.redDark, 'opacity="0.7"') +
    // glass highlights (light from the upper left)
    line('M-42 -94 L-42 -36', 8, '#ffffff', 'opacity="0.75"') +
    line('M-30 -98 L-30 -82', 5, '#ffffff', 'opacity="0.6"') +
    line('M44 -60 L44 -26', 4, '#9cc7d9', 'opacity="0.6"'),
);

const jarFill = (() => {
  const r = artRng(211);
  let coins = '';
  for (let y = -12; y > -118; y -= 11) {
    const off = r() * 10;
    for (let x = -54 + off; x < 56; x += 20 + r() * 4) {
      const rx = 12;
      const ry = 4 + r() * 8;
      const rot = (r() - 0.5) * 50;
      const shade = r() < 0.3 ? P.yellowDark : P.yellow;
      coins += `<ellipse cx="${x.toFixed(1)}" cy="${(y + (r() - 0.5) * 4).toFixed(1)}" rx="${rx}" ry="${ry.toFixed(1)}" transform="rotate(${rot.toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)})" fill="${shade}" stroke="${P.ink}" stroke-width="2.5"/>`;
      if (r() < 0.25) coins += path(glintPath(x - 3, y - 2, 4), '#fff7c2');
    }
  }
  return piece(
    'garage.jar.fill',
    [-60, -150, 120, 152],
    g(`<rect x="-50" y="-120" width="100" height="116" fill="${P.yellowDark}"/>` + coins, '', 'clip-path="url(#gjar-fill-clip)"'),
    `<clipPath id="gjar-fill-clip"><path d="${JAR_IN}"/></clipPath>`,
  );
})();

// ---------------------------------------------------------------- toolbox and tyres

const toolbox = piece(
  'garage.toolbox',
  [-104, -126, 208, 128],
  shadow(0, 0, 96, 6) +
    path('M-38 -92 L-38 -110 Q-38 -118 -30 -118 L30 -118 Q38 -118 38 -110 L38 -92', 'none', 0, `stroke="${P.ink}" stroke-width="14" stroke-linejoin="round"`) +
    path('M-38 -92 L-38 -110 Q-38 -118 -30 -118 L30 -118 Q38 -118 38 -110 L38 -92', 'none', 0, `stroke="${P.metal}" stroke-width="6" stroke-linejoin="round"`) +
    rrect(-94, -78, 188, 76, 10, P.blue, 6) +
    rrect(-98, -96, 196, 24, 8, P.blueDark, 6) +
    line('M-80 -40 L80 -40', 4, P.ink, 'opacity="0.6"') +
    rrect(-20, -50, 40, 12, 5, P.metal, 3.5) +
    rrect(-74, -76, 16, 18, 4, P.metal, 3.5) +
    rrect(58, -76, 16, 18, 4, P.metal, 3.5) +
    shine(-56, -64, 22, 6, -10, 0.35),
);

const tires = (() => {
  let s = shadow(0, 0, 76, 6);
  const tyre = (y: number, dx: number) => {
    let t = rrect(-68 + dx, y - 50, 136, 50, 24, P.rubber, 6);
    for (let x = -48; x <= 48; x += 16) t += line(`M${x + dx} ${y - 42} L${x + dx} ${y - 8}`, 4, P.rubberLight);
    t += line(`M${-50 + dx} ${y - 40} L${10 + dx} ${y - 40}`, 4, '#ffffff', 'opacity="0.18"');
    return t;
  };
  s += tyre(0, 0) + tyre(-50, 4) + tyre(-100, -2);
  s += ellipse(-2, -150, 64, 15, P.rubberLight, 5) + ellipse(-2, -150, 28, 6, P.rubber, 3.5);
  return piece('garage.tires', [-80, -172, 160, 174], s);
})();

// ---------------------------------------------------------------- rewards

/** A little arched plank bridge emblem centred on (0,0), about 80 wide. */
function bridgeEmblem(fill: string): string {
  return (
    path('M-44 18 L-44 6 Q0 -30 44 6 L44 18 Q0 -12 -44 18 Z', fill, 4) +
    line('M-26 -2 L-26 -16 M-13 -9 L-13 -23 M0 -12 L0 -26 M13 -9 L13 -23 M26 -2 L26 -16', 4, P.ink) +
    line('M-32 -12 Q0 -36 32 -12', 4, P.ink)
  );
}

const pennant = piece(
  'reward.pennant',
  [-90, -232, 180, 234],
  shadow(0, 0, 64, 5) +
    rrect(-62, -26, 124, 24, 8, P.wood, 5) +
    grain(-58, -24, 116, 20, 131, 2) +
    rrect(-49, -216, 12, 192, 5, P.woodLight, 4.5) +
    circle(-43, -218, 9, P.yellow, 4) +
    path('M-37 -206 Q20 -192 82 -170 Q20 -150 -37 -128 Z', P.blue, 5) +
    path('M-30 -196 Q16 -184 66 -170 Q16 -156 -30 -138', 'none', 0, `stroke="#ffffff" stroke-width="2.5" stroke-dasharray="6 6" opacity="0.7"`) +
    g(bridgeEmblem(P.woodLight), 'translate(10 -166) scale(0.72)') +
    shine(-14, -186, 16, 5, 12, 0.3),
);

function rampShape(x0: number, x1: number, base: number, top: number, fill: string, light: string, ow = 5): string {
  const lip = 8;
  const cx = x0 + (x1 - x0) * 0.62;
  const cy = base - lip;
  const at = (t: number): [number, number] => [
    (1 - t) * (1 - t) * x0 + 2 * (1 - t) * t * cx + t * t * x1,
    (1 - t) * (1 - t) * (base - lip) + 2 * (1 - t) * t * cy + t * t * top,
  ];
  let slats = '';
  for (let k = 1; k < 5; k++) {
    const [x, y] = at(k / 5);
    slats += line(`M${x.toFixed(1)} ${base - 4} L${x.toFixed(1)} ${(y + 5).toFixed(1)}`, 3, P.ink, 'opacity="0.3"');
  }
  return (
    path(`M${x0} ${base} L${x0} ${base - lip} Q${cx} ${cy} ${x1} ${top} L${x1} ${base} Z`, fill, ow) +
    slats +
    line(`M${x0 + 10} ${base - lip + 5} Q${cx} ${cy + 5} ${x1 - 6} ${top + 10}`, 4, light, 'opacity="0.85"')
  );
}

const twinRamp = piece(
  'reward.twin-ramp',
  [-130, -152, 260, 154],
  shadow(0, 0, 120, 5) +
    // back lane: a raised plank with its own ramp (softer colour, behind)
    rrect(-80, -52, 200, 16, 6, P.woodLight, 4) +
    rampShape(-56, 104, -52, -140, P.teal, '#8fe0d6', 5) +
    rrect(96, -140, 12, 90, 4, P.woodDark, 4) +
    line('M102 -140 L102 -150', 4) +
    path('M102 -150 L120 -146 L102 -140 Z', P.blue, 3) +
    // front lane ramp
    rampShape(-116, 30, -24, -100, P.orange, '#ffc27a', 5) +
    rrect(22, -100, 12, 76, 4, P.woodDark, 4) +
    // a little flag on each top: one each, shared fairly
    line('M28 -100 L28 -128', 4) +
    path('M28 -128 L48 -122 L28 -114 Z', P.yellow, 3) +
    // base plank
    rrect(-124, -26, 248, 24, 8, P.wood, 5) +
    grain(-118, -24, 236, 20, 141, 2),
);

const crewBanner = (() => {
  let s = shadow(-138, 0, 22, 4) + shadow(138, 0, 22, 4);
  s += rrect(-146, -228, 14, 226, 5, P.woodDark, 5) + rrect(132, -228, 14, 226, 5, P.woodDark, 5);
  s += circle(-139, -230, 9, P.yellow, 4) + circle(139, -230, 9, P.yellow, 4);
  s += rrect(-156, -14, 34, 14, 5, P.wood, 4) + rrect(122, -14, 34, 14, 5, P.wood, 4);
  // banner cloth with a pennant (zigzag) bottom edge
  let zig = '';
  const n = 8;
  for (let i = n - 1; i >= 0; i--) {
    const x0 = -128 + (256 * i) / n;
    const x1 = -128 + (256 * (i + 1)) / n;
    zig += ` L${((x0 + x1) / 2).toFixed(1)} -84 L${x0.toFixed(1)} -102`;
  }
  s += path(`M-128 -206 L128 -206 L128 -102${zig} Z`, P.cream, 5);
  const teethCols = [P.yellow, P.blue, P.orange, P.teal];
  let teeth = '';
  for (let i = 0; i < n; i++) {
    const x0 = -128 + (256 * i) / n;
    teeth += path(`M${x0 + 3} -104 L${x0 + 29} -104 L${x0 + 16} -89 Z`, teethCols[i % 4]);
  }
  s += teeth + line(`M128 -102${zig}`, 5);
  s += line('M-120 -112 L120 -112', 3, P.cardDark, 'opacity="0.5"');
  s += rrect(-128, -206, 256, 16, 4, P.red, 4);
  s += line('M-132 -200 L-146 -200 M132 -200 L146 -200 M-132 -110 L-146 -116 M132 -110 L146 -116', 4, P.inkSoft);
  // three friends
  s += g(faceArt('milo'), 'translate(-84 -140) scale(0.7)');
  s += g(faceArt('pip'), 'translate(0 -136) scale(0.7)');
  s += g(faceArt('nori'), 'translate(84 -140) scale(0.7)');
  return piece('reward.crew-banner', [-160, -244, 320, 246], s);
})();

// ---------------------------------------------------------------- garage.signboard

const signboard = piece(
  'garage.signboard',
  [-300, -60, 600, 120],
  ellipse(6, 52, 270, 6, P.ink, 0, 'opacity="0.12"') +
    rrect(-292, -52, 584, 102, 22, P.wood, 6) +
    grain(-284, -50, 568, 18, 151, 3) +
    grain(-284, 30, 568, 18, 153, 3) +
    rrect(-272, -36, 544, 70, 14, '#fbe7c0', 4) +
    line('M-258 -26 L120 -26', 3, '#ffffff', 'opacity="0.55"') +
    [[-280, -40], [280, -40], [-280, 38], [280, 38]].map(([x, y]) => circle(x, y, 5, P.metalDark, 3)).join(''),
);

export const GARAGE_PIECES: ArtPiece[] = [
  interior,
  exterior,
  door,
  lift,
  shelf,
  spot,
  jar,
  jarFill,
  toolbox,
  tires,
  pennant,
  twinRamp,
  crewBanner,
  signboard,
];

/** Keys of the three mission rewards, in mission order. */
export const REWARD_KEYS = ['reward.pennant', 'reward.twin-ramp', 'reward.crew-banner'] as const;
