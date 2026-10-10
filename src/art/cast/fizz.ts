import { P } from '../palette';
import { type ArtPiece, blobPath, circle, dgrad, ellipse, line, path, piece, shine } from '../svg';
import type { RigDef } from './rig';

/** Fizz — an enthusiastic rabbit with one floppy ear, big feet, and a striped scarf. */

const fur = P.fizzFur;
const furDark = P.fizzFurDark;

const body = piece(
  'fizz.body',
  [-56, -104, 112, 112],
  path(
    blobPath([
      [0, 2],
      [32, -2],
      [46, -24],
      [44, -56],
      [32, -84],
      [0, -94],
      [-32, -84],
      [-44, -56],
      [-46, -24],
      [-32, -2],
    ]),
    'url(#fb)',
    5,
  ) +
    ellipse(0, -36, 26, 30, '#fffaf2', 0, 'opacity="0.9"') +
    // scarf
    path('M-38 -88 Q0 -70 38 -88 L40 -74 Q0 -56 -40 -74 Z', P.fizzScarf, 4.5) +
    path('M-20 -80 L-14 -66 M0 -76 L2 -62 M20 -80 L18 -66', 'none', 0, `stroke="${P.lilac}" stroke-width="5" stroke-linecap="round"`) +
    path('M22 -72 Q34 -50 28 -30 L16 -32 Q22 -50 12 -68 Z', P.fizzScarf, 4) +
    line('M18 -48 L28 -46', 4, P.lilac) +
    shine(-22, -60, 9, 14, -20, 0.3),
  dgrad('fb', '#fffaf3', furDark),
);

const tail = piece(
  'fizz.tail',
  [-26, -26, 52, 52],
  path(blobPath([[0, -20], [14, -16], [20, -2], [16, 14], [0, 20], [-16, 14], [-20, -2], [-14, -16]]), '#fff', 4.5) + circle(-5, -6, 6, P.cream, 0, 'opacity="0.6"'),
);

const head = piece(
  'fizz.head',
  [-58, -96, 116, 102],
  path(
    blobPath([
      [0, 2],
      [30, -2],
      [48, -18],
      [52, -44],
      [42, -70],
      [20, -84],
      [0, -87],
      [-20, -84],
      [-42, -70],
      [-52, -44],
      [-48, -18],
      [-30, -2],
    ]),
    'url(#fh)',
    5,
  ) +
    ellipse(0, -22, 26, 17, '#fffdf8') +
    path('M-7 -32 Q0 -36 7 -32 Q4 -25 0 -24 Q-4 -25 -7 -32 Z', P.fizzInner, 3) +
    // whisker dots
    circle(-16, -22, 2, P.inkSoft) +
    circle(-20, -16, 2, P.inkSoft) +
    circle(16, -22, 2, P.inkSoft) +
    circle(20, -16, 2, P.inkSoft) +
    shine(-22, -66, 12, 7, -25, 0.32),
  dgrad('fh', '#fffbf4', furDark),
);

const ear = piece(
  'fizz.ear',
  [-22, -128, 44, 136],
  path('M-14 4 Q-20 -60 -10 -110 Q0 -126 10 -110 Q20 -60 14 4 Z', fur, 5) +
    path('M-7 -6 Q-11 -56 -4 -98 Q0 -106 4 -98 Q11 -56 7 -6 Z', P.fizzInner, 0, 'opacity="0.85"'),
);

const earFlop = piece(
  'fizz.earFlop',
  [-30, -84, 96, 92],
  path('M-14 4 Q-20 -40 -6 -66 Q8 -84 34 -76 Q58 -68 60 -46 Q50 -58 30 -60 Q14 -58 10 -40 Q8 -20 14 4 Z', fur, 5) +
    path('M-6 -4 Q-10 -38 0 -58 Q12 -70 30 -66 Q14 -60 6 -42 Q2 -24 6 -4 Z', P.fizzInner, 0, 'opacity="0.85"'),
);

const arm = piece('fizz.arm', [-14, -10, 28, 54], path('M-8 -4 Q0 -8 8 -4 L8 30 Q8 40 0 40 Q-8 40 -8 30 Z', fur, 4.5) + ellipse(0, 38, 9, 8, '#fff', 3.5));

const foot = piece(
  'fizz.foot',
  [-24, -8, 60, 28],
  ellipse(8, 7, 26, 11, fur, 5) + ellipse(14, 8, 8, 5, P.fizzInner, 0, 'opacity="0.7"') + shine(0, 3, 9, 3, 0, 0.3),
);

export const FIZZ_PIECES: ArtPiece[] = [body, tail, head, ear, earFlop, arm, foot];

export const FIZZ_RIG: RigDef = {
  id: 'fizz',
  parts: [
    { id: 'footBack', art: 'fizz.foot', parent: null, x: -26, y: -10, z: 1, sx: -1 },
    { id: 'footFront', art: 'fizz.foot', parent: null, x: 22, y: -10, z: 1 },
    { id: 'body', art: 'fizz.body', parent: null, x: 0, y: -12, z: 2 },
    { id: 'tail', art: 'fizz.tail', parent: 'body', x: -40, y: -16, z: -1 },
    { id: 'head', art: 'fizz.head', parent: 'body', x: 0, y: -86, z: 2 },
    { id: 'earL', art: 'fizz.ear', parent: 'head', x: -20, y: -76, z: -1, rot: -8 },
    { id: 'earR', art: 'fizz.earFlop', parent: 'head', x: 18, y: -76, z: -1, rot: 4 },
    { id: 'armBack', art: 'fizz.arm', parent: 'body', x: -38, y: -66, z: 3, rot: 14 },
    { id: 'armFront', art: 'fizz.arm', parent: 'body', x: 38, y: -66, z: 3, rot: -14 },
  ],
  face: {
    head: 'head',
    eyes: [
      [-17, -48],
      [17, -48],
    ],
    eyeScale: 1,
    brows: [
      [-18, -66],
      [18, -66],
    ],
    mouth: [0, -12],
    blush: [
      [-30, -28],
      [30, -28],
    ],
  },
  anchors: {
    hat: { part: 'head', x: 0, y: -84, scale: 1.05 },
    hand: { part: 'armFront', x: 0, y: 40 },
    emote: [56, -290],
  },
  limbs: { armFront: 'armFront', armBack: 'armBack', footFront: 'footFront', footBack: 'footBack', tail: 'tail', ears: ['earL', 'earR'] },
  height: 270,
  width: 120,
  gait: 'hop',
  voice: { pitch: 620, spread: 240, len: 0.055, wave: 'triangle' },
};
