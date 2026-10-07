import { P, mix } from '../palette';
import { type ArtPiece, artRng, blobPath, circle, ellipse, line, path, piece, rrect, shine, smoothPath, vgrad } from '../svg';
import { roundTree } from './windmill';

/** The illustrated paper map of Wonderwood. */

/** Map destinations (safe-area coordinates). */
export const MAP_PLACES = {
  clubhouse: { x: 960, y: 590 },
  'windmill-kite': { x: 430, y: 330 },
  'lantern-launch': { x: 980, y: 230 },
  tinker: { x: 1520, y: 330 },
  'picnic-bridge': { x: 1180, y: 830 },
  waterwheel: { x: 1700, y: 650 },
  picnic: { x: 1560, y: 900 },
  stage: { x: 420, y: 820 },
} as const;
export type MapPlace = keyof typeof MAP_PLACES;

const bg = (() => {
  const r = artRng(9);
  let body = '';
  // parchment table + map sheet with a wobbly hand-cut edge
  body += `<rect x="-240" y="-180" width="2400" height="1440" fill="url(#tbl)"/>`;
  body += path(blobPath([[40, 30], [960, 10], [1880, 34], [1900, 540], [1884, 1050], [960, 1072], [30, 1050], [16, 540]], 0.6), mix(P.paper, P.cream, 0.4), 6);
  body += path(blobPath([[60, 52], [960, 34], [1860, 56], [1878, 540], [1862, 1030], [960, 1050], [52, 1030], [38, 540]], 0.6), 'url(#paper)', 0);
  // gentle land shapes
  body += path(blobPath([[120, 140], [700, 90], [1300, 120], [1800, 160], [1820, 600], [1700, 980], [1000, 1000], [300, 980], [110, 600]], 0.8), mix(P.grassLight, P.paper, 0.45), 0);
  // the stream: from the top right down past the waterwheel to the meadow and off the bottom
  body += path(smoothPath([[1880, 420], [1740, 520], [1640, 690], [1420, 760], [1180, 830], [960, 940], [860, 1060]]), 'none', 0, `stroke="${P.waterDark}" stroke-width="62" stroke-linecap="round" opacity="0.5"`);
  body += path(smoothPath([[1880, 420], [1740, 520], [1640, 690], [1420, 760], [1180, 830], [960, 940], [860, 1060]]), 'none', 0, `stroke="${P.water}" stroke-width="46" stroke-linecap="round"`);
  body += path(smoothPath([[1840, 446], [1720, 540], [1630, 700]]), 'none', 0, `stroke="#fff" stroke-width="5" stroke-dasharray="14 22" opacity="0.6"`);
  // hills near the windmill and the glade
  for (const [x, y, rx] of [
    [430, 380, 260],
    [980, 300, 230],
    [1500, 400, 220],
  ]) body += ellipse(x, y, rx, rx * 0.36, mix(P.grass, P.paper, 0.35), 0);
  // dotted paths from the clubhouse to every place
  const C = MAP_PLACES.clubhouse;
  const paths: [number, number][][] = [
    [[C.x, C.y], [780, 480], [600, 420], [MAP_PLACES['windmill-kite'].x, MAP_PLACES['windmill-kite'].y + 40]],
    [[C.x, C.y], [990, 420], [MAP_PLACES['lantern-launch'].x, MAP_PLACES['lantern-launch'].y + 50]],
    [[C.x, C.y], [1180, 480], [1380, 400], [MAP_PLACES.tinker.x, MAP_PLACES.tinker.y + 40]],
    [[C.x, C.y], [1050, 720], [MAP_PLACES['picnic-bridge'].x, MAP_PLACES['picnic-bridge'].y - 20]],
    [[MAP_PLACES['picnic-bridge'].x, MAP_PLACES['picnic-bridge'].y], [1380, 880], [MAP_PLACES.picnic.x, MAP_PLACES.picnic.y]],
    [[C.x, C.y], [1260, 640], [1500, 620], [MAP_PLACES.waterwheel.x, MAP_PLACES.waterwheel.y]],
    [[C.x, C.y], [760, 700], [560, 780], [MAP_PLACES.stage.x, MAP_PLACES.stage.y]],
  ];
  for (const pts of paths) {
    body += path(smoothPath(pts), 'none', 0, `stroke="${mix(P.woodLight, P.paper, 0.2)}" stroke-width="22" stroke-linecap="round"`);
    body += path(smoothPath(pts), 'none', 0, `stroke="${P.wood}" stroke-width="5" stroke-dasharray="4 16" stroke-linecap="round"`);
  }
  // little trees and flowers scattered
  for (let i = 0; i < 46; i++) {
    const x = 120 + r() * 1700;
    const y = 120 + r() * 880;
    const near = Object.values(MAP_PLACES).some((p) => Math.hypot(p.x - x, p.y - y) < 160);
    if (near) continue;
    body += roundTree(x, y, 0.32 + r() * 0.14, mix(P.leaf, P.grassDark, r() * 0.4), P.grassDark, P.bark, i, 3);
  }
  for (let i = 0; i < 80; i++) {
    const x = 100 + r() * 1720;
    const y = 100 + r() * 900;
    body += circle(x, y, 3.5, [P.rose, P.sun, '#fff', P.lilac][i % 4]);
  }
  // compass rose (decorative)
  body += circle(1760, 940, 52, P.paper, 4) + path('M1760 884 L1772 940 L1760 996 L1748 940 Z', P.berry, 3) + path('M1704 940 L1760 928 L1816 940 L1760 952 Z', P.sea, 3) + circle(1760, 940, 8, P.lantern, 3);
  return piece('map.bg', [-240, -180, 2400, 1440], body, `<linearGradient id="tbl" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#6b4a32"/><stop offset="1" stop-color="#4a3222"/></linearGradient>` + vgrad('paper', '#fbf3e4', '#f1e1bf'), true);
})();

const landmarks: ArtPiece[] = [
  piece(
    'map.oak',
    [-150, -250, 300, 270],
    path('M-40 0 Q-30 -60 -26 -110 L26 -110 Q30 -60 40 0 Z', P.bark, 5) +
      path(blobPath([[-120, -120], [-90, -200], [0, -236], [96, -200], [124, -120], [60, -86], [-60, -86]]), P.leaf, 5) +
      path('M-18 0 L-18 -44 Q-18 -60 0 -60 Q18 -60 18 -44 L18 0 Z', P.woodDark, 4) +
      circle(0, -150, 18, P.glow, 4) +
      [[-80, -110], [80, -116], [-30, -100]].map(([x, y]) => line(`M${x} ${y - 20} L${x} ${y - 6}`, 3) + rrect(x - 10, y - 8, 20, 24, 7, P.lantern, 3.5)).join(''),
  ),
  piece(
    'map.windmill',
    [-130, -260, 260, 280],
    path('M-50 0 L-34 -150 L34 -150 L50 0 Z', P.woodLight, 5) +
      path('M-40 -150 Q0 -200 40 -150 Z', P.berry, 5) +
      [45, 135, 225, 315].map((d) => `<g transform="translate(0 -150) rotate(${d})">${rrect(-6, -110, 12, 110, 4, P.woodDark, 3.5)}${rrect(6, -104, 30, 80, 4, P.cream, 3.5)}</g>`).join('') +
      circle(0, -150, 12, P.lantern, 4) +
      path('M-14 0 L-14 -36 Q0 -48 14 -36 L14 0 Z', P.woodDark, 3.5),
  ),
  piece(
    'map.glade',
    [-150, -190, 300, 210],
    ellipse(0, -10, 130, 26, mix(P.grass, P.paper, 0.2), 4) +
      [[-90, -40], [-30, -60], [30, -60], [90, -40]].map(([x, y]) => line(`M${x} 0 L${x} ${y}`, 5, P.woodDark) + rrect(x - 16, y - 34, 32, 40, 12, P.lantern, 4.5) + circle(x, y - 14, 8, P.glow)).join('') +
      // a lantern balloon floating up
      ellipse(0, -140, 30, 38, P.berry, 4.5) + line('M-14 -106 L-10 -90 M14 -106 L10 -90', 3) + rrect(-12, -92, 24, 14, 4, P.wood, 3),
  ),
  piece(
    'map.workshop',
    [-140, -250, 280, 270],
    path('M-70 0 Q-80 -120 -40 -190 Q0 -230 40 -190 Q80 -120 70 0 Z', P.bark, 5) +
      path(blobPath([[-110, -170], [-60, -240], [30, -246], [110, -190], [100, -140], [-100, -140]]), mix(P.leaf, P.teal, 0.3), 5) +
      rrect(-34, -96, 68, 96, 24, P.woodDark, 4.5) +
      circle(-40, -130, 22, P.glow, 4) +
      // gear sign
      circle(60, -110, 26, P.stone, 4) + circle(60, -110, 9, P.cream, 3) +
      [0, 45, 90, 135].map((a) => `<rect x="56" y="-142" width="8" height="64" rx="3" fill="${P.stone}" stroke="${P.ink}" stroke-width="3" transform="rotate(${a} 60 -110)"/>`).join('') + circle(60, -110, 20, P.stone, 0) + circle(60, -110, 9, P.cream, 3),
  ),
  piece(
    'map.picnic',
    [-150, -150, 300, 170],
    path('M-120 -10 L-40 -70 L120 -40 L50 10 Z', P.berry, 5) +
      line('M-90 -32 L80 -2 M-60 -54 L100 -24 M-80 -18 L-20 -64 M-20 -6 L40 -52 M40 2 L96 -38', 4, '#fff', 'opacity="0.7"') +
      path('M-20 -70 L30 -70 L24 -100 L-14 -100 Z', P.wood, 4) + path('M-12 -100 Q5 -128 22 -100', 'none', 4) +
      circle(70, -60, 16, P.sun, 3.5) + circle(-60, -24, 12, P.pumpkin, 3),
  ),
  piece(
    'map.theater',
    [-140, -230, 280, 250],
    path('M-110 0 L-100 -150 L100 -150 L110 0 Z', P.bark, 5) +
      rrect(-80, -136, 160, 110, 10, P.plum, 4.5) +
      path('M-80 -136 Q-40 -90 -80 -26 Z M80 -136 Q40 -90 80 -26 Z', P.berry, 4) +
      path('M-120 -150 Q0 -230 120 -150 Z', P.lantern, 5) +
      circle(0, -186, 14, P.berry, 3.5) +
      // star backdrop
      path('M0 -112 L6 -98 L22 -98 L9 -88 L14 -72 L0 -82 L-14 -72 L-9 -88 L-22 -98 L-6 -98 Z', P.glow, 2.5),
  ),
  piece(
    'map.bridge',
    [-110, -90, 220, 110],
    path('M-90 -10 Q0 -80 90 -10', 'none', 0, `stroke="${P.ink}" stroke-width="18" stroke-linecap="round"`) +
      path('M-90 -10 Q0 -80 90 -10', 'none', 0, `stroke="${P.woodLight}" stroke-width="11" stroke-linecap="round"`) +
      line('M-60 -28 L-60 -2 M-20 -42 L-20 -14 M20 -42 L20 -14 M60 -28 L60 -2', 5, P.woodDark),
  ),
  piece(
    'map.waterwheel',
    [-130, -230, 260, 250],
    rrect(-90, -120, 110, 120, 8, P.woodLight, 5) + path('M-100 -120 L-35 -170 L30 -120 Z', P.teal, 5) + circle(-35, -70, 14, P.glow, 3.5) +
      circle(60, -80, 64, 'none', 6) + circle(60, -80, 10, P.woodDark, 4) +
      [0, 30, 60, 90, 120, 150].map((a) => `<rect x="56" y="-150" width="8" height="140" rx="3" fill="${P.wood}" stroke="${P.ink}" stroke-width="3" transform="rotate(${a} 60 -80)"/>`).join('') + circle(60, -80, 10, P.woodDark, 4),
  ),
  piece(
    'map.building',
    [-70, -110, 140, 120],
    // "still being built": scaffold, a hammer and a little cone — honest and friendly
    line('M-50 0 L-50 -90 M50 0 L50 -90 M-50 -30 L50 -30 M-50 -70 L50 -70 M-50 -30 L50 -70', 6, P.woodLight) +
      path('M-10 0 L10 0 L4 -26 L-4 -26 Z', P.pumpkin, 3.5) +
      rrect(14, -60, 40, 14, 4, P.stone, 3.5) + rrect(30, -50, 8, 40, 3, P.wood, 3),
  ),
  piece('map.star', [-22, -22, 44, 44], path('M0 -18 L5 -6 L18 -6 L8 2 L12 16 L0 8 L-12 16 L-8 2 L-18 -6 L-5 -6 Z', P.sun, 3.5) + shine(-4, -6, 4, 3, 0, 0.5)),
];

export const MAP_PIECES: ArtPiece[] = [bg, ...landmarks];

export const MAP_ICON: Record<MapPlace, string> = {
  clubhouse: 'map.oak',
  'windmill-kite': 'map.windmill',
  'lantern-launch': 'map.glade',
  tinker: 'map.workshop',
  'picnic-bridge': 'map.bridge',
  waterwheel: 'map.waterwheel',
  picnic: 'map.picnic',
  stage: 'map.theater',
};

