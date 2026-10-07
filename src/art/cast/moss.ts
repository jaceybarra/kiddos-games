import { P } from '../palette';
import { type ArtPiece, blobPath, circle, dgrad, ellipse, line, path, piece, shine } from '../svg';
import type { RigDef } from './rig';

/** Moss — an observant turtle engineer with mossy shell, spectacles, and a striped beanie. */

const body = piece(
  'moss.body',
  [-74, -116, 148, 124],
  // shell
  ellipse(0, -52, 66, 56, 'url(#ms)', 5) +
    path('M-60 -30 Q-66 -52 -56 -76 M60 -30 Q66 -52 56 -76', 'none', 0, `stroke="${P.mossShellDark}" stroke-width="4" stroke-linecap="round" opacity="0.7"`) +
    // moss tufts and a tiny flower on the shell top
    path(blobPath([[-46, -92], [-30, -104], [-10, -108], [8, -104], [-6, -96], [-26, -92]]), P.leaf, 3.5) +
    path(blobPath([[22, -100], [38, -94], [50, -84], [36, -86], [24, -92]]), P.leaf, 3) +
    circle(-18, -108, 5, P.sun, 2.5) +
    circle(-18, -108, 2, P.pumpkin) +
    // plastron
    ellipse(0, -44, 44, 44, 'url(#mp)', 4.5) +
    line('M-40 -58 Q0 -50 40 -58 M-42 -32 Q0 -24 42 -32 M0 -86 L0 -2', 3, P.woodDark, 'opacity="0.35"') +
    shine(-22, -70, 10, 14, -25, 0.25),
  dgrad('ms', '#5fb08c', P.mossShellDark) + dgrad('mp', '#fbe7a8', '#e0bf72'),
);

const head = piece(
  'moss.head',
  [-60, -110, 120, 118],
  path(
    blobPath([
      [0, 2],
      [30, -2],
      [50, -18],
      [54, -42],
      [44, -66],
      [22, -80],
      [0, -83],
      [-22, -80],
      [-44, -66],
      [-54, -42],
      [-50, -18],
      [-30, -2],
    ]),
    'url(#mh)',
    5,
  ) +
    // cheeks
    ellipse(-30, -22, 10, 7, P.mossSkinDark, 0, 'opacity="0.35"') +
    ellipse(30, -22, 10, 7, P.mossSkinDark, 0, 'opacity="0.35"') +
    // nostrils
    circle(-4, -26, 2, P.ink) +
    circle(4, -26, 2, P.ink) +
    // striped beanie
    path('M-48 -60 Q-50 -98 0 -100 Q50 -98 48 -60 Q0 -70 -48 -60 Z', P.teal, 5) +
    path('M-49 -76 Q0 -86 49 -76 L48 -66 Q0 -76 -48 -66 Z', P.pumpkin, 0) +
    path('M-50 -62 Q0 -74 50 -62 L50 -54 Q0 -66 -50 -54 Z', '#2f8f88', 4) +
    circle(0, -102, 10, P.pumpkin, 4) +
    shine(-26, -88, 10, 5, -20, 0.3),
  dgrad('mh', '#bcd98d', P.mossSkinDark),
);

const specs = piece(
  'moss.specs',
  [-44, -18, 88, 36],
  circle(-17, 0, 14, '#dff3f5', 4, 'fill-opacity="0.35"') +
    circle(17, 0, 14, '#dff3f5', 4, 'fill-opacity="0.35"') +
    line('M-3 -2 Q0 -6 3 -2', 4) +
    line('M-31 -2 L-40 -6 M31 -2 L40 -6', 4) +
    line('M-24 -6 L-20 -9', 2.5, '#fff', 'opacity="0.8"') +
    line('M10 -6 L14 -9', 2.5, '#fff', 'opacity="0.8"'),
);

const arm = piece(
  'moss.arm',
  [-14, -10, 28, 50],
  path('M-9 -4 Q0 -8 9 -4 L9 26 Q9 36 0 36 Q-9 36 -9 26 Z', P.mossSkin, 4.5) + line('M-4 30 L-4 35 M4 30 L4 35', 2.5, P.mossSkinDark),
);

const foot = piece('moss.foot', [-22, -8, 44, 26], ellipse(0, 6, 18, 10, P.mossSkinDark, 4.5) + line('M-8 12 L-8 15 M0 13 L0 16 M8 12 L8 15', 2.5, P.ink, 'opacity="0.5"'));

export const MOSS_PIECES: ArtPiece[] = [body, head, specs, arm, foot];

export const MOSS_RIG: RigDef = {
  id: 'moss',
  parts: [
    { id: 'footBack', art: 'moss.foot', parent: null, x: -26, y: -9, z: 1 },
    { id: 'footFront', art: 'moss.foot', parent: null, x: 26, y: -9, z: 1 },
    { id: 'body', art: 'moss.body', parent: null, x: 0, y: -10, z: 2 },
    { id: 'head', art: 'moss.head', parent: 'body', x: 0, y: -94, z: 2 },
    { id: 'specs', art: 'moss.specs', parent: 'head', x: 0, y: -40, z: 7 },
    { id: 'armBack', art: 'moss.arm', parent: 'body', x: -46, y: -70, z: 3, rot: 16 },
    { id: 'armFront', art: 'moss.arm', parent: 'body', x: 46, y: -70, z: 3, rot: -16 },
  ],
  face: {
    head: 'head',
    eyes: [
      [-17, -40],
      [17, -40],
    ],
    eyeScale: 0.85,
    brows: [
      [-18, -58],
      [18, -58],
    ],
    mouth: [0, -12],
    blush: [
      [-32, -20],
      [32, -20],
    ],
  },
  anchors: {
    hat: { part: 'head', x: 0, y: -96, scale: 1 },
    hand: { part: 'armFront', x: 0, y: 36 },
    emote: [52, -230],
  },
  limbs: { armFront: 'armFront', armBack: 'armBack', footFront: 'footFront', footBack: 'footBack' },
  height: 210,
  width: 140,
  gait: 'waddle',
  voice: { pitch: 200, spread: 50, len: 0.11, wave: 'sine', ttsPitch: 0.75, ttsRate: 0.88 },
};
