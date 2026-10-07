import { P } from './palette';
import { type ArtPiece, ellipse, path, piece, circle, line, rrect as rrectRaw } from './svg';

/** Small shared pieces: shadows, interaction glints, demo hand, focus ring. */

const shadow = piece('fx.shadow', [-52, -12, 104, 24], ellipse(0, 0, 50, 10, P.ink, 0, 'opacity="0.2"'));

const glint = piece(
  'fx.glint',
  [-18, -18, 36, 36],
  path('M0 -15 Q2.5 -2.5 15 0 Q2.5 2.5 0 15 Q-2.5 2.5 -15 0 Q-2.5 -2.5 0 -15 Z', '#fff', 0, 'opacity="0.95"'),
);

const dust = piece('fx.dust', [-14, -14, 28, 28], circle(0, 0, 12, P.cream, 0, 'opacity="0.85"'));
const leafBit = piece('fx.leaf', [-12, -8, 24, 16], path('M-10 0 Q0 -9 10 0 Q0 9 -10 0 Z', P.leaf, 2.5) + line('M-8 0 L8 0', 1.5, P.grassDark));
const seed = piece(
  'fx.seed',
  [-14, -16, 28, 32],
  line('M0 14 L0 -2', 1.8, P.inkSoft) + path('M0 -2 Q-10 -12 -12 -6 M0 -2 Q10 -12 12 -6 M0 -2 Q-4 -16 0 -14 Q4 -16 0 -2', 'none', 0, `stroke="${P.white}" stroke-width="2" stroke-linecap="round"`) + circle(0, 14, 2.5, P.wood),
);
const spark = piece('fx.spark', [-10, -10, 20, 20], path('M0 -8 Q1.5 -1.5 8 0 Q1.5 1.5 0 8 Q-1.5 1.5 -8 0 Q-1.5 -1.5 0 -8 Z', P.glow));
const ring = piece('fx.ring', [-60, -60, 120, 120], circle(0, 0, 54, 'none', 0, `stroke="#fff" stroke-width="6" opacity="0.9"`));
const splash = piece('fx.splash', [-10, -10, 20, 20], circle(0, 0, 8, P.waterLight, 2, ''));

/** Demonstration hand (the "ghost hand" that shows what to do). */
const hand = piece(
  'fx.hand',
  [-46, -14, 96, 118],
  path(
    'M-9 8 Q-9 -9 0 -9 Q9 -9 9 8 L9 38 Q16 30 24 34 Q31 38 29 46 Q36 42 41 49 Q45 56 39 61 Q44 66 41 74 Q36 86 24 90 L24 100 L-20 100 L-20 90 Q-30 84 -33 72 L-40 52 Q-42 41 -33 39 Q-25 38 -21 48 L-9 60 Z',
    P.white,
    5,
  ) +
    rrectRaw(-24, 92, 52, 12, 5, P.lantern) +
    path('M9 38 Q11 46 9 52 M29 46 Q31 52 29 58 M39 61 Q40 66 38 70', 'none', 0, `stroke="${P.inkSoft}" stroke-width="3" stroke-linecap="round" opacity="0.55"`),
);
const tapRing = piece('fx.tapring', [-46, -46, 92, 92], circle(0, 0, 40, 'none', 0, `stroke="${P.lantern}" stroke-width="7"`));

const arrow = piece(
  'fx.arrow',
  [-40, -30, 80, 60],
  path('M-34 -10 L6 -10 L6 -26 L36 0 L6 26 L6 10 L-34 10 Z', P.lantern, 4.5),
);

export const COMMON_PIECES: ArtPiece[] = [shadow, glint, dust, leafBit, seed, spark, ring, splash, hand, tapRing, arrow];
