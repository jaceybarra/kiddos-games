import { P } from '../palette';
import { type ArtPiece, circle, ellipse, line, path, piece } from '../svg';

/** Shared face features. Mouth/eye shapes are reused by every character. */

export type EyeShape = 'open' | 'happy' | 'closed' | 'wide' | 'half';
export type MouthShape =
  | 'smile'
  | 'grin'
  | 'o'
  | 'flat'
  | 'frown'
  | 'wobble'
  | 'laugh'
  | 'eek'
  | 'sleepy'
  | 'silly'
  | 'smirk';

export type Expression =
  | 'happy'
  | 'excited'
  | 'calm'
  | 'surprised'
  | 'sad'
  | 'worried'
  | 'frustrated'
  | 'thinking'
  | 'embarrassed'
  | 'sleepy'
  | 'silly'
  | 'determined';

export const EXPRESSIONS: Expression[] = [
  'happy',
  'excited',
  'calm',
  'surprised',
  'sad',
  'worried',
  'frustrated',
  'thinking',
  'embarrassed',
  'sleepy',
  'silly',
  'determined',
];

export interface ExpressionSpec {
  eye: EyeShape;
  mouth: MouthShape;
  /** + = inner ends up (sad/worried), - = inner ends down (cross). Degrees. */
  browTilt: number;
  /** vertical brow offset; negative = raised */
  browY: number;
  blush: number;
  /** pupils look offset (unit-ish) */
  look?: [number, number];
}

export const EXPRESSION_SPECS: Record<Expression, ExpressionSpec> = {
  happy: { eye: 'open', mouth: 'smile', browTilt: 4, browY: -2, blush: 0.25 },
  excited: { eye: 'happy', mouth: 'laugh', browTilt: 6, browY: -6, blush: 0.4 },
  calm: { eye: 'half', mouth: 'smile', browTilt: 0, browY: 0, blush: 0 },
  surprised: { eye: 'wide', mouth: 'o', browTilt: 2, browY: -9, blush: 0 },
  sad: { eye: 'open', mouth: 'frown', browTilt: 16, browY: -2, blush: 0, look: [0, 0.6] },
  worried: { eye: 'open', mouth: 'wobble', browTilt: 14, browY: -5, blush: 0.1 },
  frustrated: { eye: 'open', mouth: 'flat', browTilt: -16, browY: 3, blush: 0.15 },
  thinking: { eye: 'open', mouth: 'smirk', browTilt: -4, browY: -4, blush: 0, look: [0.6, -0.7] },
  embarrassed: { eye: 'happy', mouth: 'wobble', browTilt: 10, browY: -2, blush: 0.8 },
  sleepy: { eye: 'closed', mouth: 'sleepy', browTilt: 4, browY: 2, blush: 0 },
  silly: { eye: 'happy', mouth: 'silly', browTilt: 8, browY: -5, blush: 0.3 },
  determined: { eye: 'open', mouth: 'smile', browTilt: -8, browY: 1, blush: 0 },
};

const eyeOpen = piece(
  'face.eye.open',
  [-14, -16, 28, 32],
  ellipse(0, 0, 9.5, 12, P.ink) + circle(-3, -5, 3.6, '#fff') + circle(3, 4, 1.6, '#fff', 0, 'opacity="0.7"'),
);
const eyeWide = piece(
  'face.eye.wide',
  [-18, -20, 36, 40],
  ellipse(0, 0, 13, 15.5, '#fff', 3) + ellipse(0, 1, 7.5, 9, P.ink) + circle(-2.5, -3, 3, '#fff'),
);
const eyeHappy = piece('face.eye.happy', [-14, -12, 28, 22], line('M-10 5 Q0 -9 10 5', 4.5));
const eyeClosed = piece('face.eye.closed', [-14, -10, 28, 20], line('M-10 -2 Q0 8 10 -2', 4.5));
const eyeHalf = piece(
  'face.eye.half',
  [-14, -16, 28, 32],
  // bead eye with a relaxed upper lid line
  `<clipPath id="c"><rect x="-14" y="-4" width="28" height="20"/></clipPath>` +
    `<g clip-path="url(#c)">${ellipse(0, 0, 9.5, 12, P.ink)}${circle(-3, -1, 3, '#fff')}</g>` +
    line('M-11 -4 Q0 -7 11 -4', 3.5),
);

const brow = piece('face.brow', [-15, -5, 30, 10], line('M-11 0 Q0 -3 11 0', 4.5));
const blush = piece('face.blush', [-14, -8, 28, 16], ellipse(0, 0, 11, 6.5, P.rose, 0, 'opacity="0.85"'));

const mouthRed = '#9b3b3b';
const tongue = '#f08a8a';
const mouths: ArtPiece[] = [
  piece('face.mouth.smile', [-18, -8, 36, 20], line('M-12 -2 Q0 10 12 -2', 4.5)),
  piece(
    'face.mouth.grin',
    [-18, -8, 36, 24],
    path('M-12 -3 Q0 -1 12 -3 Q10 13 0 13 Q-10 13 -12 -3 Z', mouthRed, 4) +
      path('M-6 8 Q0 4 6 8 Q3 12 0 12 Q-3 12 -6 8 Z', tongue),
  ),
  piece('face.mouth.o', [-12, -12, 24, 24], ellipse(0, 0, 6.5, 8, mouthRed, 4)),
  piece('face.mouth.flat', [-16, -6, 32, 12], line('M-10 0 Q0 1.5 10 0', 4.5)),
  piece('face.mouth.frown', [-16, -8, 32, 18], line('M-10 5 Q0 -5 10 5', 4.5)),
  piece('face.mouth.wobble', [-17, -7, 34, 14], line('M-12 1 Q-8 -3 -4 1 Q0 4 4 0 Q8 -3 12 1', 4)),
  piece(
    'face.mouth.laugh',
    [-20, -10, 40, 30],
    path('M-15 -4 Q0 -1 15 -4 Q13 17 0 17 Q-13 17 -15 -4 Z', mouthRed, 4) +
      path('M-8 10 Q0 5 8 10 Q4 15 0 15 Q-4 15 -8 10 Z', tongue),
  ),
  piece(
    'face.mouth.eek',
    [-18, -10, 36, 20],
    path('M-13 -4 L13 -4 Q14 6 0 7 Q-14 6 -13 -4 Z', '#fff', 4) + line('M-4 -4 L-4 6 M4 -4 L4 6', 2.5),
  ),
  piece('face.mouth.sleepy', [-10, -6, 20, 12], line('M-5 0 Q0 2 5 0', 4)),
  piece(
    'face.mouth.silly',
    [-18, -8, 36, 26],
    line('M-12 -2 Q0 8 12 -2', 4.5) + path('M-2 4 Q4 4 6 4 Q8 14 2 15 Q-3 14 -2 4 Z', tongue, 3.5),
  ),
  piece('face.mouth.smirk', [-16, -8, 32, 16], line('M-9 1 Q3 4 11 -4', 4.5)),
];

const tear = piece('face.tear', [-8, -10, 16, 22], path('M0 -8 Q7 4 4 8 Q0 12 -4 8 Q-7 4 0 -8 Z', P.waterLight, 2.5));

/** Speaking indicator, think cloud, zzz, heart, sparkle, question — emotes. */
const emoteSpeak = piece(
  'emote.speak',
  [-34, -30, 68, 60],
  path('M-26 -18 Q-26 -24 -20 -24 L20 -24 Q26 -24 26 -18 L26 6 Q26 12 20 12 L-2 12 L-12 22 L-10 12 L-20 12 Q-26 12 -26 6 Z', P.white, 4) +
    circle(-11, -6, 4, P.ink) +
    circle(0, -6, 4, P.ink) +
    circle(11, -6, 4, P.ink),
);
const emoteThink = piece(
  'emote.think',
  [-36, -36, 72, 72],
  path('M-20 -4 Q-30 -6 -26 -16 Q-24 -28 -10 -24 Q-4 -32 8 -26 Q22 -30 24 -16 Q32 -8 22 0 Q20 10 6 6 Q-4 12 -12 6 Q-24 8 -20 -4 Z', P.white, 4) +
    circle(-14, 14, 5, P.white, 3) +
    circle(-22, 24, 3, P.white, 2.5),
);
const emoteQuestion = piece(
  'emote.question',
  [-22, -34, 44, 68],
  path('M-10 -14 Q-10 -28 2 -28 Q14 -28 14 -16 Q14 -8 4 -4 Q0 -2 0 6', 'none', 0, `stroke="${P.ink}" stroke-width="12" stroke-linecap="round"`) +
    path('M-10 -14 Q-10 -28 2 -28 Q14 -28 14 -16 Q14 -8 4 -4 Q0 -2 0 6', 'none', 0, `stroke="${P.lantern}" stroke-width="6" stroke-linecap="round"`) +
    circle(0, 22, 6, P.lantern, 3.5),
);
const emoteHeart = piece(
  'emote.heart',
  [-24, -22, 48, 44],
  path('M0 16 Q-22 2 -18 -10 Q-14 -20 -4 -16 Q0 -14 0 -10 Q0 -14 4 -16 Q14 -20 18 -10 Q22 2 0 16 Z', P.berry, 4) + circle(-9, -9, 3.5, '#fff', 0, 'opacity="0.6"'),
);
const emoteZzz = piece(
  'emote.zzz',
  [-28, -34, 56, 68],
  line('M-18 4 L-6 4 L-18 18 L-6 18', 4.5) + line('M0 -12 L14 -12 L0 4 L14 4', 4.5) + line('M14 -28 L22 -28 L14 -20 L22 -20', 3.5),
);
const emoteSparkle = piece(
  'emote.sparkle',
  [-20, -20, 40, 40],
  path('M0 -16 Q3 -3 16 0 Q3 3 0 16 Q-3 3 -16 0 Q-3 -3 0 -16 Z', P.glow, 3),
);
const emoteWave = piece(
  'emote.wave',
  [-26, -26, 52, 52],
  line('M-14 -10 Q-20 0 -14 10', 4) + line('M14 -10 Q20 0 14 10', 4) + line('M-6 -18 Q-12 0 -6 18', 3) + line('M6 -18 Q12 0 6 18', 3),
);
const emoteWait = piece(
  'emote.wait',
  [-24, -32, 48, 64],
  // a little acorn-cap hourglass
  path('M-14 -24 L14 -24 L14 -20 Q14 -6 2 0 Q14 6 14 20 L14 24 L-14 24 L-14 20 Q-14 6 -2 0 Q-14 -6 -14 -20 Z', P.white, 4) +
    path('M-8 -16 L8 -16 Q6 -8 0 -4 Q-6 -8 -8 -16 Z', P.lantern) +
    path('M-9 18 Q0 8 9 18 Z', P.lantern) +
    line('M-18 -26 L18 -26 M-18 26 L18 26', 5, P.wood),
);

export const FACE_PIECES: ArtPiece[] = [
  eyeOpen,
  eyeWide,
  eyeHappy,
  eyeClosed,
  eyeHalf,
  brow,
  blush,
  tear,
  ...mouths,
  emoteSpeak,
  emoteThink,
  emoteQuestion,
  emoteHeart,
  emoteZzz,
  emoteSparkle,
  emoteWave,
  emoteWait,
];

export const eyeKey = (s: EyeShape) => `face.eye.${s}`;
export const mouthKey = (s: MouthShape) => `face.mouth.${s}`;
