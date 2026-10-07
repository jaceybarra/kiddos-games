import { P } from '../palette';
import { type ArtPiece, circle, ellipse, line, path, piece, shine } from '../svg';

/** Costume hats. Pivot = bottom centre, which sits on a rig's hat anchor. Everyone can wear everything. */

export const HATS: { id: string; name: string }[] = [
  { id: 'hat.explorer', name: 'Explorer hat' },
  { id: 'hat.flowers', name: 'Flower crown' },
  { id: 'hat.beanie', name: 'Cosy beanie' },
  { id: 'hat.crown', name: 'Paper crown' },
  { id: 'hat.wizard', name: 'Star hat' },
  { id: 'hat.propeller', name: 'Propeller cap' },
  { id: 'hat.bow', name: 'Big bow' },
  { id: 'hat.leaf', name: 'Leaf umbrella' },
  { id: 'hat.pot', name: 'Soup pot' },
];

const flower = (x: number, y: number, c: string) =>
  [0, 72, 144, 216, 288]
    .map((a) => {
      const r = (a * Math.PI) / 180;
      return circle(x + Math.cos(r) * 6.5, y + Math.sin(r) * 6.5, 5.5, c, 2.5);
    })
    .join('') + circle(x, y, 4, P.sun, 2);

export const HAT_PIECES: ArtPiece[] = [
  piece(
    'hat.explorer',
    [-70, -60, 140, 70],
    ellipse(0, -6, 64, 12, '#d9b77a', 4.5) +
      path('M-38 -8 Q-40 -50 0 -52 Q40 -50 38 -8 Z', '#e8c98c', 4.5) +
      path('M-38 -18 Q0 -10 38 -18 L38 -8 Q0 0 -38 -8 Z', P.woodDark, 0) +
      shine(-16, -36, 10, 6, -20, 0.35),
  ),
  piece(
    'hat.flowers',
    [-62, -34, 124, 42],
    path('M-54 -2 Q0 -22 54 -2', 'none', 0, `stroke="${P.leaf}" stroke-width="9" stroke-linecap="round"`) +
      path('M-54 -2 Q0 -22 54 -2', 'none', 0, `stroke="${P.ink}" stroke-width="2.5" stroke-dasharray="3 9"`) +
      flower(-40, -10, P.rose) +
      flower(-14, -18, '#fff') +
      flower(14, -18, P.lilac) +
      flower(40, -10, P.sun),
  ),
  piece(
    'hat.beanie',
    [-56, -74, 112, 82],
    path('M-50 0 Q-54 -56 0 -58 Q54 -56 50 0 Q0 -10 -50 0 Z', P.berry, 5) +
      path('M-52 -2 Q0 -14 52 -2 L52 8 Q0 -4 -52 8 Z', '#b8433a', 4.5) +
      line('M-30 -40 L-30 -10 M-10 -48 L-10 -12 M10 -48 L10 -12 M30 -40 L30 -10', 3, '#b8433a', 'opacity="0.6"') +
      circle(0, -62, 11, P.cream, 4),
  ),
  piece(
    'hat.crown',
    [-50, -58, 100, 66],
    path('M-42 0 L-44 -44 L-22 -22 L0 -52 L22 -22 L44 -44 L42 0 Z', P.sun, 5) +
      line('M-40 -10 L40 -10', 3, P.lantern, 'opacity="0.8"') +
      circle(-22, -12, 5, P.berry, 2.5) +
      circle(0, -14, 5, P.sea, 2.5) +
      circle(22, -12, 5, P.leaf, 2.5) +
      circle(-44, -46, 5, P.lantern, 3) +
      circle(0, -54, 5, P.lantern, 3) +
      circle(44, -46, 5, P.lantern, 3),
  ),
  piece(
    'hat.wizard',
    [-56, -150, 130, 158],
    ellipse(0, -4, 52, 11, '#6e4590', 4.5) +
      path('M-36 -6 Q-20 -60 6 -110 Q22 -136 56 -134 Q30 -118 26 -96 Q20 -50 36 -6 Z', P.plum, 5) +
      path('M-10 -50 L-6 -60 L-2 -50 L-12 -56 L0 -56 Z', P.sun, 1.5) +
      path('M12 -86 L15 -94 L18 -86 L10 -91 L20 -91 Z', P.sun, 1.5) +
      circle(56, -134, 7, P.sun, 3.5),
  ),
  piece(
    'hat.propeller',
    [-60, -84, 120, 92],
    path('M-46 0 Q-48 -44 0 -46 Q48 -44 46 0 Z', P.sea, 5) +
      path('M-46 0 Q0 -8 46 0 L60 6 Q0 -2 -46 6 Z', '#3f82b5', 4) +
      path('M-46 0 Q-48 -44 0 -46 L0 0 Z', P.sun, 0, 'opacity="0.7"') +
      line('M0 -46 L0 -60', 5) +
      path('M0 -62 Q-26 -74 -40 -64 Q-26 -56 0 -62 Z', P.berry, 3.5) +
      path('M0 -62 Q26 -50 40 -60 Q26 -68 0 -62 Z', P.leaf, 3.5) +
      circle(0, -62, 5, P.lantern, 3),
  ),
  piece(
    'hat.bow',
    [-58, -50, 116, 58],
    path('M0 -18 Q-30 -48 -50 -32 Q-56 -12 -40 0 Q-20 4 0 -18 Z', P.rose, 5) +
      path('M0 -18 Q30 -48 50 -32 Q56 -12 40 0 Q20 4 0 -18 Z', P.rose, 5) +
      circle(0, -18, 10, '#e98c8c', 4.5) +
      line('M-34 -28 Q-26 -18 -30 -8 M34 -28 Q26 -18 30 -8', 3, '#c96a6a', 'opacity="0.7"'),
  ),
  piece(
    'hat.leaf',
    [-80, -118, 160, 126],
    line('M0 0 L0 -60', 6, P.woodDark) +
      path('M-74 -54 Q-60 -110 0 -112 Q60 -110 74 -54 Q50 -66 36 -54 Q18 -70 0 -56 Q-18 -70 -36 -54 Q-50 -66 -74 -54 Z', P.leaf, 5) +
      line('M0 -110 L0 -58 M-30 -96 L-14 -64 M30 -96 L14 -64', 3, P.grassDark, 'opacity="0.7"'),
  ),
  piece(
    'hat.pot',
    [-60, -66, 120, 72],
    path('M-40 0 L-44 -46 L44 -46 L40 0 Z', P.stone, 5) +
      ellipse(0, -46, 46, 10, '#d2cdc4', 4.5) +
      path('M-44 -36 Q-60 -36 -56 -24 Q-52 -18 -42 -22', 'none', 5) +
      path('M44 -36 Q60 -36 56 -24 Q52 -18 42 -22', 'none', 5) +
      shine(-22, -28, 8, 12, -10, 0.35) +
      path('M-8 -54 Q-12 -62 -6 -64 Q0 -60 2 -54 Z', P.leaf, 2.5),
  ),
];
