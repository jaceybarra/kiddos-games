import { P, mix } from '../palette';
import { type ArtPiece, artRng, blobPath, circle, dgrad, ellipse, grain, line, path, piece, rrect, shine, vgrad } from '../svg';

/** Inside the Lantern Oak: the club's cosy round room where creations are displayed. */

export const FLOOR_Y = 930;

const bg = (() => {
  const r = artRng(31);
  let body = '';
  // curved bark walls
  body += `<rect x="-240" y="-180" width="2400" height="1440" fill="url(#wall)"/>`;
  for (let i = 0; i < 26; i++) {
    const x = -240 + i * 96 + r() * 30;
    body += line(`M${x} -180 Q${x + (r() - 0.5) * 60} 400 ${x + (r() - 0.5) * 40} ${FLOOR_Y}`, 4 + r() * 3, mix(P.bark, P.barkDark, 0.5), 'opacity="0.35"');
  }
  // ceiling beams and a big rounded alcove
  body += path(`M-240 -180 L2160 -180 L2160 120 Q960 -60 -240 120 Z`, mix(P.barkDark, P.ink, 0.2), 0, 'opacity="0.6"');
  body += path(`M140 ${FLOOR_Y} L140 300 Q140 80 960 70 Q1780 80 1780 300 L1780 ${FLOOR_Y} Z`, 'url(#alcove)', 6);
  // round window with the festival sky
  body += circle(960, 300, 150, 'url(#sky)', 8) + line('M960 150 L960 450 M810 300 L1110 300', 7, P.woodDark) + circle(960, 300, 150, 'none', 8);
  for (const [x, y] of [[880, 260], [1040, 230], [1000, 360]] as [number, number][]) body += rrect(x - 9, y - 11, 18, 22, 6, P.lantern, 2.5) + circle(x, y, 4, P.glow);
  body += circle(905, 205, 22, P.glow, 0, 'opacity="0.7"');
  // wooden floor
  body += `<rect x="-240" y="${FLOOR_Y - 20}" width="2400" height="${1260 - FLOOR_Y + 20}" fill="url(#floor)"/>`;
  body += line(`M-240 ${FLOOR_Y - 20} L2160 ${FLOOR_Y - 20}`, 6, P.ink, 'opacity="0.8"');
  for (let i = 0; i < 9; i++) body += line(`M-240 ${FLOOR_Y + 30 + i * 40} L2160 ${FLOOR_Y + 30 + i * 40}`, 3, P.woodDark, 'opacity="0.35"');
  for (let i = 0; i < 30; i++) {
    const x = -240 + r() * 2400;
    const y = FLOOR_Y + 30 + Math.floor(r() * 8) * 40;
    body += line(`M${x} ${y} L${x} ${y + 40}`, 3, P.woodDark, 'opacity="0.35"');
  }
  // round rug
  body += ellipse(960, FLOOR_Y + 110, 520, 90, mix(P.berry, P.paper, 0.15), 5) + ellipse(960, FLOOR_Y + 110, 420, 68, mix(P.sun, P.paper, 0.3), 0) + ellipse(960, FLOOR_Y + 110, 300, 48, mix(P.teal, P.paper, 0.25), 0) + ellipse(960, FLOOR_Y + 110, 170, 26, mix(P.berry, P.paper, 0.15), 0);
  // the door back to the map (right)
  body += path(`M1700 ${FLOOR_Y - 20} L1700 560 Q1700 450 1810 450 Q1920 450 1920 560 L1920 ${FLOOR_Y - 20} Z`, P.woodDark, 6) + path(`M1718 ${FLOOR_Y - 20} L1718 566 Q1718 470 1810 470 Q1902 470 1902 566 L1902 ${FLOOR_Y - 20} Z`, 'url(#door)', 0) + circle(1880, 720, 10, P.lantern, 4);
  // a spiral stair going up (left, decorative)
  for (let i = 0; i < 7; i++) body += rrect(-120 + (i % 2) * 40, FLOOR_Y - 60 - i * 110, 200, 26, 8, P.woodLight, 4);
  body += rrect(-30, -180, 30, FLOOR_Y + 160, 10, P.wood, 5);
  // string of lanterns across the ceiling
  body += path('M120 160 Q960 330 1800 160', 'none', 0, `stroke="${P.ink}" stroke-width="4"`);
  for (let i = 1; i < 12; i++) {
    const t = i / 12;
    const x = 120 + 1680 * t;
    const y = 160 + 4 * 170 * t * (1 - t) * 1.0 + 6;
    body += rrect(x - 13, y, 26, 32, 9, [P.lantern, P.berry, P.sea, P.leaf][i % 4], 3.5) + circle(x, y + 16, 6, P.glow, 0, 'opacity="0.9"');
  }
  return piece('club.bg', [-240, -180, 2400, 1440], body,
    vgrad('wall', '#9b6a46', '#6e4a31') + vgrad('alcove', '#c48c5c', '#a06c45') + vgrad('sky', '#6d5f9e', '#f2b98f') + vgrad('floor', '#d9a066', '#a8703f') + vgrad('door', '#c98d55', '#9a6537'), true);
})();

const frame = piece(
  'club.frame',
  [-150, -120, 300, 240],
  rrect(-140, -110, 280, 220, 18, P.woodDark, 6) + rrect(-118, -88, 236, 176, 10, P.paper, 4) + grain(-136, -108, 272, 16, 4, 2, P.wood) + circle(0, -112, 7, P.lantern, 3),
);
const frameEmpty = piece('club.frame.empty', [-110, -80, 220, 160], rrect(-100, -70, 200, 140, 12, 'none', 0, `stroke="${P.woodDark}" stroke-width="5" stroke-dasharray="14 12" opacity="0.6"`));
const shelf = piece('club.shelf', [-210, -24, 420, 60], rrect(-200, -14, 400, 26, 8, 'url(#sh)', 5) + path('M-170 12 L-150 42 L-130 12 Z M130 12 L150 42 L170 12 Z', P.woodDark, 4), dgrad('sh', P.woodLight, P.wood));
const chest = piece(
  'club.chest',
  [-150, -230, 300, 240],
  rrect(-130, -200, 260, 200, 18, 'url(#ch)', 6) +
    line('M0 -196 L0 -4', 5, P.woodDark) +
    circle(-18, -100, 8, P.lantern, 3.5) +
    circle(18, -100, 8, P.lantern, 3.5) +
    path('M-130 -200 Q0 -250 130 -200 L130 -186 Q0 -232 -130 -186 Z', P.berry, 5) +
    // a sleeve peeking out and a hat on top — it's a dress-up chest
    path('M-60 -4 Q-80 30 -50 26 L-40 -4 Z', P.sea, 3.5) +
    path('M40 -232 L60 -282 L80 -232 Z', P.plum, 4) +
    ellipse(60, -232, 30, 7, P.plum, 3.5),
  dgrad('ch', P.woodLight, P.wood),
);
const pot = piece('club.pot', [-60, -90, 120, 96], path('M-44 -70 L44 -70 L34 0 L-34 0 Z', P.pumpkin, 5) + rrect(-50, -84, 100, 18, 6, P.pumpkinDark, 4.5) + shine(-20, -40, 8, 18, -10, 0.3));
const peg = piece('club.peg', [-24, -24, 48, 48], circle(0, 0, 14, P.woodDark, 4) + circle(-4, -4, 4, P.woodLight));
const cushion = piece('club.cushion', [-140, -80, 280, 90], path(blobPath([[-120, 0], [-128, -40], [-80, -66], [0, -72], [80, -66], [128, -40], [120, 0]]), P.lilac, 5) + line('M-80 -30 Q0 -14 80 -30', 4, mix(P.lilac, P.ink, 0.25)) + circle(0, -38, 8, P.plum, 3));
const lamp = piece('club.lamp', [-50, -260, 100, 266], rrect(-6, -200, 12, 200, 5, P.woodDark, 4) + ellipse(0, -4, 40, 10, P.woodDark, 4) + path('M-40 -200 L40 -200 L24 -250 L-24 -250 Z', P.glow, 5) + ellipse(0, -200, 70, 26, P.glow, 0, 'opacity="0.35"'));
const books = piece('club.books', [-90, -110, 180, 116], [P.berry, P.sea, P.sun, P.leaf, P.plum].map((c, i) => rrect(-80 + i * 32, -100 + (i % 2) * 12, 28, 100 - (i % 2) * 12, 5, c, 4)).join('') + line('M-80 -60 L80 -60', 3, '#fff', 'opacity="0.4"'));
const bench = piece(
  'club.bench',
  [-200, -150, 400, 156],
  rrect(-190, -120, 380, 34, 8, 'url(#bn)', 5) + rrect(-170, -90, 24, 90, 6, P.woodDark, 4) + rrect(146, -90, 24, 90, 6, P.woodDark, 4) +
    // a little music box being fixed
    rrect(-60, -168, 110, 50, 10, P.sea, 4.5) + circle(-5, -144, 10, P.lantern, 3.5) + line('M50 -150 L80 -168 L90 -150', 4, P.stone),
  dgrad('bn', P.woodLight, P.wood),
);
const placard = piece('club.placard', [-48, -48, 96, 96], circle(0, 0, 40, P.paper, 5) + circle(0, 0, 30, 'none', 0, `stroke="${P.woodLight}" stroke-width="4"`));
const souvenirSilhouettes: ArtPiece[] = [
  piece('club.sil.kite', [-60, -80, 120, 160], path('M0 -70 L50 -10 L0 70 L-50 -10 Z', 'none', 0, `stroke="${P.woodDark}" stroke-width="5" stroke-dasharray="10 9" opacity="0.55"`)),
  piece('club.sil.flag', [-50, -80, 100, 160], path('M-20 70 L-20 -70 L40 -45 L-20 -20', 'none', 0, `stroke="${P.woodDark}" stroke-width="5" stroke-dasharray="10 9" opacity="0.55"`)),
  piece('club.sil.wheel', [-60, -60, 120, 120], circle(0, 0, 48, 'none', 0, `stroke="${P.woodDark}" stroke-width="5" stroke-dasharray="10 9" opacity="0.55"`) + line('M0 -48 L0 48 M-48 0 L48 0', 4, P.woodDark, 'opacity="0.4" stroke-dasharray="8 8"')),
  piece('club.sil.lantern', [-50, -70, 100, 140], rrect(-34, -50, 68, 100, 24, 'none', 0, `stroke="${P.woodDark}" stroke-width="5" stroke-dasharray="10 9" opacity="0.55"`)),
];
// bigger souvenirs shown once earned (future adventures supply theirs)
const flagSouvenir = piece('club.souv.flag', [-50, -90, 110, 180], line('M-20 80 L-20 -80', 6, P.woodDark) + path('M-18 -78 L48 -50 L-18 -22 Z', P.sea, 5) + circle(8, -50, 9, P.sun, 3));
const wheelSouvenir = piece('club.souv.wheel', [-64, -64, 128, 128], circle(0, 0, 54, P.woodLight, 6) + circle(0, 0, 12, P.woodDark, 4) + [0, 45, 90, 135].map((a) => `<rect x="-5" y="-50" width="10" height="100" rx="4" fill="${P.wood}" stroke="${P.ink}" stroke-width="3" transform="rotate(${a})"/>`).join('') + circle(0, 0, 12, P.woodDark, 4));
const lanternSouvenir = piece('club.souv.lantern', [-50, -90, 100, 180], line('M0 -86 L0 -60', 4) + rrect(-36, -62, 72, 108, 26, P.berry, 5) + ellipse(0, -8, 20, 32, P.glow) + rrect(-22, 44, 44, 14, 5, P.woodDark, 3.5));

export const CLUBHOUSE_PIECES: ArtPiece[] = [
  bg,
  frame,
  frameEmpty,
  shelf,
  chest,
  pot,
  peg,
  cushion,
  lamp,
  books,
  bench,
  placard,
  ...souvenirSilhouettes,
  flagSouvenir,
  wheelSouvenir,
  lanternSouvenir,
];
