import { P } from '../palette';
import { type ArtPiece, blobPath, circle, dgrad, ellipse, g, line, path, piece, rrect, shine } from '../svg';
import type { RigDef } from './rig';

/** Pip — an inventive squirrel with a huge curly tail and brass goggles. */

const fur = P.pipFur;
const furDark = P.pipFurDark;
const belly = P.pipBelly;

const body = piece(
  'pip.body',
  [-56, -112, 112, 122],
  path(
    blobPath([
      [0, 2],
      [30, 0],
      [46, -14],
      [44, -46],
      [36, -76],
      [26, -98],
      [0, -106],
      [-26, -98],
      [-36, -76],
      [-44, -46],
      [-46, -14],
      [-30, 0],
    ]),
    'url(#pb)',
    5,
  ) +
    path(blobPath([[0, -8], [22, -16], [26, -44], [18, -74], [0, -82], [-18, -74], [-26, -44], [-22, -16]]), belly) +
    // tool belt
    path('M-44 -36 Q0 -26 44 -36 L44 -24 Q0 -14 -44 -24 Z', P.woodDark, 4) +
    rrect(-9, -36, 18, 14, 3, P.lantern, 3) +
    // little wrench tucked in belt
    g(rrect(-3, -18, 6, 22, 3, P.stone, 3) + circle(0, -20, 7, P.stone, 3) + circle(0, -22, 3, P.woodDark), 'translate(30 -30) rotate(18)') +
    shine(-20, -80, 10, 16, -25, 0.25),
  dgrad('pb', '#f29a5c', furDark),
);

const head = piece(
  'pip.head',
  [-62, -104, 124, 112],
  path(
    blobPath([
      [0, 0],
      [28, -4],
      [50, -18],
      [56, -40],
      [48, -70],
      [26, -92],
      [0, -97],
      [-26, -92],
      [-48, -70],
      [-56, -40],
      [-50, -18],
      [-28, -4],
    ]),
    'url(#ph)',
    5,
  ) +
    // cheek fluff muzzle
    path(blobPath([[0, -6], [20, -10], [34, -24], [26, -38], [10, -40], [0, -36], [-10, -40], [-26, -38], [-34, -24], [-20, -10]]), belly) +
    // nose
    path('M-7 -33 Q0 -38 7 -33 Q5 -26 0 -25 Q-5 -26 -7 -33 Z', P.ink) +
    circle(-2, -33, 1.8, '#fff', 0, 'opacity="0.7"') +
    // forehead tuft
    path('M-8 -94 Q-2 -110 6 -96 Q12 -106 14 -92', fur, 4) +
    shine(-24, -74, 12, 8, -30, 0.28),
  dgrad('ph', '#f39a5a', furDark),
);

const ear = piece(
  'pip.ear',
  [-24, -46, 44, 54],
  path('M-14 4 Q-20 -18 -10 -34 Q-6 -42 0 -40 Q10 -24 12 4 Z', fur, 5) +
    path('M-8 -2 Q-12 -16 -6 -28 Q2 -18 4 -2 Z', P.rose, 0, 'opacity="0.8"') +
    // tuft
    path('M-10 -34 Q-18 -44 -12 -46 Q-6 -46 -4 -40', furDark, 3.5),
);

const goggles = piece(
  'pip.goggles',
  [-46, -18, 92, 36],
  path('M-44 0 Q0 -10 44 0', 'none', 0, `stroke="${P.woodDark}" stroke-width="7"`) +
    circle(-17, 0, 14, P.lantern, 4) +
    circle(-17, 0, 8.5, P.sea, 3) +
    circle(17, 0, 14, P.lantern, 4) +
    circle(17, 0, 8.5, P.sea, 3) +
    circle(-20, -3, 3, '#fff', 0, 'opacity="0.8"') +
    circle(14, -3, 3, '#fff', 0, 'opacity="0.8"'),
);

const arm = piece(
  'pip.arm',
  [-14, -10, 28, 58],
  path('M-8 -4 Q0 -8 8 -4 L8 32 Q8 40 0 40 Q-8 40 -8 32 Z', fur, 4.5) + ellipse(0, 38, 10, 9, furDark, 4),
);

const foot = piece('pip.foot', [-20, -6, 44, 24], ellipse(4, 6, 17, 9, furDark, 4.5) + shine(0, 3, 7, 3, 0, 0.25));

const tail = piece(
  'pip.tail',
  [-104, -206, 128, 214],
  path(
    blobPath([
      [12, 2],
      [-8, -18],
      [-40, -40],
      [-66, -76],
      [-80, -118],
      [-74, -158],
      [-50, -190],
      [-14, -200],
      [14, -188],
      [18, -164],
      [4, -150],
      [-18, -152],
      [-34, -138],
      [-34, -112],
      [-20, -86],
      [2, -62],
      [18, -34],
      [22, -10],
    ]),
    'url(#pt)',
    5,
  ) +
    line('M-10 -20 Q-46 -60 -56 -110 Q-58 -160 -24 -180', 7, belly, 'opacity="0.55"') +
    line('M-30 -50 Q-44 -70 -50 -96', 3, furDark, 'opacity="0.6"') +
    line('M-62 -130 Q-60 -150 -48 -164', 3, furDark, 'opacity="0.6"'),
  dgrad('pt', '#f4a468', furDark),
);

export const PIP_PIECES: ArtPiece[] = [body, head, ear, goggles, arm, foot, tail];

export const PIP_RIG: RigDef = {
  id: 'pip',
  parts: [
    { id: 'footBack', art: 'pip.foot', parent: null, x: -20, y: -9, z: 1 },
    { id: 'footFront', art: 'pip.foot', parent: null, x: 16, y: -9, z: 1 },
    { id: 'body', art: 'pip.body', parent: null, x: 0, y: -12, z: 2 },
    { id: 'tail', art: 'pip.tail', parent: 'body', x: -30, y: -18, z: -1 },
    { id: 'head', art: 'pip.head', parent: 'body', x: 0, y: -94, z: 2 },
    { id: 'earL', art: 'pip.ear', parent: 'head', x: -30, y: -78, z: -1 },
    { id: 'earR', art: 'pip.ear', parent: 'head', x: 30, y: -78, z: -1, sx: -1 },
    { id: 'goggles', art: 'pip.goggles', parent: 'head', x: 0, y: -80, z: 6 },
    { id: 'armBack', art: 'pip.arm', parent: 'body', x: -38, y: -72, z: 1, rot: 12 },
    { id: 'armFront', art: 'pip.arm', parent: 'body', x: 38, y: -72, z: 3, rot: -12 },
  ],
  face: {
    head: 'head',
    eyes: [
      [-18, -52],
      [18, -52],
    ],
    eyeScale: 1,
    brows: [
      [-19, -68],
      [19, -68],
    ],
    mouth: [0, -16],
    blush: [
      [-32, -28],
      [32, -28],
    ],
  },
  anchors: {
    hat: { part: 'head', x: 0, y: -92, scale: 1 },
    hand: { part: 'armFront', x: 0, y: 40 },
    emote: [44, -230],
  },
  limbs: {
    armFront: 'armFront',
    armBack: 'armBack',
    footFront: 'footFront',
    footBack: 'footBack',
    tail: 'tail',
    ears: ['earL', 'earR'],
  },
  height: 215,
  width: 120,
  gait: 'hop',
  voice: { pitch: 520, spread: 160, len: 0.065, wave: 'triangle', ttsPitch: 1.45, ttsRate: 1.08 },
};
