import { P } from '../palette';
import { type ArtPiece, blobPath, circle, dgrad, ellipse, line, path, piece, rrect, shine } from '../svg';
import type { RigDef } from './rig';

/** Rowan — a calm badger caretaker with a rust apron full of useful things. */

const fur = P.rowanFur;
const furDark = P.rowanFurDark;

const body = piece(
  'rowan.body',
  [-74, -136, 148, 144],
  path(
    blobPath([
      [0, 2],
      [40, -2],
      [62, -26],
      [64, -66],
      [52, -104],
      [26, -124],
      [0, -128],
      [-26, -124],
      [-52, -104],
      [-64, -66],
      [-62, -26],
      [-40, -2],
    ]),
    'url(#rb)',
    5,
  ) +
    // apron
    path('M-40 -100 Q0 -108 40 -100 L46 -14 Q0 -2 -46 -14 Z', P.rowanApron, 4.5) +
    line('M-40 -100 Q-30 -122 -14 -126 M40 -100 Q30 -122 14 -126', 4, P.ink) +
    // pocket with a trowel and a carrot top
    rrect(-24, -58, 48, 30, 8, '#b35a3f', 4) +
    path('M-12 -58 L-8 -86 L0 -86 L-2 -58 Z', P.stone, 3.5) +
    path('M10 -58 Q8 -76 14 -84 M14 -60 Q16 -74 22 -80', 'none', 0, `stroke="${P.leaf}" stroke-width="5" stroke-linecap="round"`) +
    line('M-18 -44 L18 -44', 2.5, P.cream, 'stroke-dasharray="4 5" opacity="0.8"') +
    shine(-34, -96, 10, 16, -25, 0.2),
  dgrad('rb', '#9a9ca3', furDark),
);

const head = piece(
  'rowan.head',
  [-66, -100, 132, 106],
  path(
    blobPath([
      [0, 2],
      [34, -2],
      [56, -20],
      [60, -46],
      [50, -72],
      [26, -88],
      [0, -91],
      [-26, -88],
      [-50, -72],
      [-60, -46],
      [-56, -20],
      [-34, -2],
    ]),
    P.rowanStripe,
    5,
  ) +
    // dark side stripes through the eyes
    path('M-14 -88 Q-30 -60 -36 -30 Q-40 -16 -52 -18 Q-60 -40 -52 -66 Q-40 -84 -14 -88 Z', '#4b4c53') +
    path('M14 -88 Q30 -60 36 -30 Q40 -16 52 -18 Q60 -40 52 -66 Q40 -84 14 -88 Z', '#4b4c53') +
    // eye rings so the bead eyes read on the dark stripes
    ellipse(-24, -46, 13, 15, P.rowanStripe) +
    ellipse(24, -46, 13, 15, P.rowanStripe) +
    path('M-9 -26 Q0 -32 9 -26 Q6 -18 0 -17 Q-6 -18 -9 -26 Z', P.ink) +
    circle(-3, -26, 2, '#fff', 0, 'opacity="0.6"') +
    shine(-14, -76, 10, 6, -20, 0.35),
);

const ear = piece('rowan.ear', [-18, -22, 36, 30], ellipse(0, -6, 14, 13, fur, 4.5) + ellipse(0, -5, 7, 6, P.rose, 0, 'opacity="0.6"'));

const arm = piece('rowan.arm', [-17, -12, 34, 64], path('M-11 -4 Q0 -10 11 -4 L11 38 Q11 48 0 48 Q-11 48 -11 38 Z', furDark, 4.5) + line('M-5 42 L-5 48 M0 43 L0 49 M5 42 L5 48', 2.5, P.cream));

const foot = piece('rowan.foot', [-24, -8, 48, 26], ellipse(0, 6, 20, 10, '#45464c', 4.5));

export const ROWAN_PIECES: ArtPiece[] = [body, head, ear, arm, foot];

export const ROWAN_RIG: RigDef = {
  id: 'rowan',
  parts: [
    { id: 'footBack', art: 'rowan.foot', parent: null, x: -30, y: -9, z: 1 },
    { id: 'footFront', art: 'rowan.foot', parent: null, x: 30, y: -9, z: 1 },
    { id: 'body', art: 'rowan.body', parent: null, x: 0, y: -12, z: 2 },
    { id: 'head', art: 'rowan.head', parent: 'body', x: 0, y: -120, z: 2 },
    { id: 'earL', art: 'rowan.ear', parent: 'head', x: -44, y: -74, z: -1 },
    { id: 'earR', art: 'rowan.ear', parent: 'head', x: 44, y: -74, z: -1 },
    { id: 'armBack', art: 'rowan.arm', parent: 'body', x: -56, y: -92, z: 3, rot: 14 },
    { id: 'armFront', art: 'rowan.arm', parent: 'body', x: 56, y: -92, z: 3, rot: -14 },
  ],
  face: {
    head: 'head',
    eyes: [
      [-24, -46],
      [24, -46],
    ],
    eyeScale: 0.9,
    brows: [
      [-24, -66],
      [24, -66],
    ],
    mouth: [0, -10],
    blush: [
      [-38, -22],
      [38, -22],
    ],
  },
  anchors: {
    hat: { part: 'head', x: 0, y: -88, scale: 1.15 },
    hand: { part: 'armFront', x: 0, y: 48 },
    emote: [60, -270],
  },
  limbs: { armFront: 'armFront', armBack: 'armBack', footFront: 'footFront', footBack: 'footBack', ears: ['earL', 'earR'] },
  height: 250,
  width: 150,
  gait: 'walk',
  voice: { pitch: 150, spread: 40, len: 0.12, wave: 'sine', ttsPitch: 0.7, ttsRate: 0.86 },
};
