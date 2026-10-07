import { P } from '../palette';
import { type ArtPiece, blobPath, circle, dgrad, ellipse, line, path, piece, shine } from '../svg';
import type { RigDef } from './rig';

/** Luma — an imaginative moth with moon-patterned wings and a fluffy collar. */

const body = piece(
  'luma.body',
  [-52, -104, 104, 112],
  path(
    blobPath([
      [0, 2],
      [26, -4],
      [40, -24],
      [40, -54],
      [28, -80],
      [0, -88],
      [-28, -80],
      [-40, -54],
      [-40, -24],
      [-26, -4],
    ]),
    'url(#lb)',
    5,
  ) +
    line('M-30 -30 Q0 -22 30 -30 M-26 -14 Q0 -6 26 -14', 3.5, P.lumaBodyDark, 'opacity="0.6"') +
    // fluffy collar
    path(
      'M-42 -80 Q-46 -66 -32 -66 Q-28 -56 -16 -62 Q-8 -52 0 -60 Q8 -52 16 -62 Q28 -56 32 -66 Q46 -66 42 -80 Q20 -94 0 -94 Q-20 -94 -42 -80 Z',
      P.lumaFluff,
      4.5,
    ) +
    shine(-18, -44, 8, 12, -20, 0.25),
  dgrad('lb', '#a597d2', P.lumaBodyDark),
);

const wingUpper = piece(
  'luma.wingUpper',
  [-150, -128, 158, 140],
  path('M0 0 Q-30 -40 -80 -100 Q-110 -126 -136 -110 Q-150 -90 -136 -56 Q-118 -14 -60 0 Q-24 8 0 0 Z', 'url(#lw)', 5) +
    // crescent moon and dots pattern
    path('M-96 -76 Q-112 -62 -100 -44 Q-118 -50 -116 -70 Q-112 -84 -96 -76 Z', P.lumaWing2, 3) +
    circle(-62, -36, 9, P.lumaWing2, 3) +
    circle(-126, -96, 5, P.lumaWing2, 2.5) +
    line('M-6 -6 Q-50 -40 -96 -100', 3, P.wood, 'opacity="0.35"'),
  dgrad('lw', '#fff3c4', '#f0cf73'),
);

const wingLower = piece(
  'luma.wingLower',
  [-112, -18, 120, 104],
  path('M0 0 Q-40 -10 -80 4 Q-108 20 -100 52 Q-90 80 -60 76 Q-26 64 -6 30 Q2 14 0 0 Z', 'url(#lw2)', 5) +
    circle(-62, 40, 12, P.lumaWing, 3) +
    circle(-62, 40, 5, P.plum, 0),
  dgrad('lw2', '#ddd0f0', '#b39ad8'),
);

const head = piece(
  'luma.head',
  [-56, -92, 112, 98],
  path(
    blobPath([
      [0, 2],
      [28, -2],
      [46, -18],
      [50, -42],
      [40, -66],
      [20, -80],
      [0, -83],
      [-20, -80],
      [-40, -66],
      [-50, -42],
      [-46, -18],
      [-28, -2],
    ]),
    'url(#lh)',
    5,
  ) +
    // fuzzy cheeks
    path('M-50 -30 Q-58 -22 -48 -14 M50 -30 Q58 -22 48 -14', 'none', 0, `stroke="${P.lumaFluff}" stroke-width="7" stroke-linecap="round"`) +
    circle(0, -26, 3, P.lumaBodyDark) +
    shine(-20, -62, 12, 7, -25, 0.3),
  dgrad('lh', '#b3a6dc', P.lumaBodyDark),
);

const antenna = piece(
  'luma.antenna',
  [-46, -76, 56, 82],
  line('M0 0 Q-6 -36 -30 -62', 4.5) +
    // feathery side strokes
    line('M-4 -14 L-14 -16 M-6 -26 L-18 -26 M-10 -38 L-22 -36 M-16 -48 L-28 -44 M-2 -18 L4 -26 M-6 -32 L0 -40 M-12 -44 L-6 -54', 3, P.inkSoft) +
    circle(-32, -64, 7, P.glow, 3.5),
);

const arm = piece('luma.arm', [-13, -10, 26, 50], path('M-7 -4 Q0 -8 7 -4 L7 28 Q7 36 0 36 Q-7 36 -7 28 Z', P.lumaBody, 4.5) + circle(0, 35, 7.5, P.lumaFluff, 3.5));
const foot = piece('luma.foot', [-16, -6, 32, 20], ellipse(0, 4, 12, 7, P.lumaBodyDark, 4));

export const LUMA_PIECES: ArtPiece[] = [body, wingUpper, wingLower, head, antenna, arm, foot];

export const LUMA_RIG: RigDef = {
  id: 'luma',
  parts: [
    { id: 'footBack', art: 'luma.foot', parent: null, x: -14, y: -6, z: 1 },
    { id: 'footFront', art: 'luma.foot', parent: null, x: 14, y: -6, z: 1 },
    { id: 'body', art: 'luma.body', parent: null, x: 0, y: -10, z: 2 },
    { id: 'wingUL', art: 'luma.wingUpper', parent: 'body', x: -16, y: -60, z: -2 },
    { id: 'wingLL', art: 'luma.wingLower', parent: 'body', x: -16, y: -48, z: -3 },
    { id: 'wingUR', art: 'luma.wingUpper', parent: 'body', x: 16, y: -60, z: -2, sx: -1 },
    { id: 'wingLR', art: 'luma.wingLower', parent: 'body', x: 16, y: -48, z: -3, sx: -1 },
    { id: 'head', art: 'luma.head', parent: 'body', x: 0, y: -86, z: 2 },
    { id: 'antL', art: 'luma.antenna', parent: 'head', x: -14, y: -76, z: -1 },
    { id: 'antR', art: 'luma.antenna', parent: 'head', x: 14, y: -76, z: -1, sx: -1 },
    { id: 'armBack', art: 'luma.arm', parent: 'body', x: -34, y: -64, z: 3, rot: 14 },
    { id: 'armFront', art: 'luma.arm', parent: 'body', x: 34, y: -64, z: 3, rot: -14 },
  ],
  face: {
    head: 'head',
    eyes: [
      [-17, -44],
      [17, -44],
    ],
    eyeScale: 1.05,
    brows: [
      [-18, -62],
      [18, -62],
    ],
    mouth: [0, -14],
    blush: [
      [-30, -26],
      [30, -26],
    ],
  },
  anchors: {
    hat: { part: 'head', x: 0, y: -80, scale: 0.95 },
    hand: { part: 'armFront', x: 0, y: 36 },
    emote: [50, -250],
  },
  limbs: {
    armFront: 'armFront',
    armBack: 'armBack',
    footFront: 'footFront',
    footBack: 'footBack',
    wings: ['wingUL', 'wingLL', 'wingUR', 'wingLR'],
    antennae: ['antL', 'antR'],
  },
  height: 245,
  width: 120,
  gait: 'float',
  voice: { pitch: 430, spread: 90, len: 0.09, wave: 'sine', ttsPitch: 1.2, ttsRate: 0.94 },
};
