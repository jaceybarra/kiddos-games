import { P } from './palette';
import { type ArtPiece, piece, path, circle, ellipse, rrect, line, g, shine } from './svg';

/**
 * The crew: Milo the beaver (builder), Pip the rabbit (racer), Nori the
 * turtle (noticer). Each has four poses: idle, notice, help, cheer.
 * Pivot (0,0) = between the feet; they face LEFT (toward the arriving truck).
 */
export type CrewId = 'milo' | 'pip' | 'nori';
export type Pose = 'idle' | 'notice' | 'help' | 'cheer';
export const POSES: Pose[] = ['idle', 'notice', 'help', 'cheer'];

const W = 6;

function eye(x: number, y: number, pose: Pose, r = 8): string {
  if (pose === 'cheer') return line(`M${x - r} ${y + 2} Q${x} ${y - r} ${x + r} ${y + 2}`, 4.5, P.ink);
  const look = pose === 'notice' ? -3 : -1.5;
  return circle(x, y, r, '#ffffff', 3.5) + circle(x + look, y + (pose === 'help' ? 2 : 0), r * 0.5, P.ink) + circle(x + look - 1.5, y - 2, 1.6, '#fff');
}

function mouth(x: number, y: number, pose: Pose, w = 10): string {
  if (pose === 'cheer') return path(`M${x - w} ${y} Q${x} ${y + w * 1.3} ${x + w} ${y} Z`, P.redDark, 3.5);
  if (pose === 'notice') return ellipse(x, y + 2, w * 0.35, w * 0.45, P.redDark, 3);
  if (pose === 'help') return line(`M${x - w * 0.7} ${y + 1} Q${x} ${y + 5} ${x + w * 0.7} ${y - 1}`, 4, P.ink);
  return line(`M${x - w * 0.7} ${y} Q${x} ${y + w * 0.7} ${x + w * 0.7} ${y}`, 4, P.ink);
}

/** An arm from a shoulder to a hand, with a round paw. */
function arm(sx: number, sy: number, hx: number, hy: number, fill: string, paw: string): string {
  return line(`M${sx} ${sy} L${hx} ${hy}`, 20, P.ink) + line(`M${sx} ${sy} L${hx} ${hy}`, 12, fill) + circle(hx, hy, 10, paw, 4.5);
}

function plank(x: number, y: number): string {
  return rrect(x - 52, y - 9, 104, 18, 5, P.woodLight, 5) + line(`M${x - 40} ${y - 2} L${x + 30} ${y - 2}`, 2.5, P.woodDark, 'opacity="0.5"');
}

// ------------------------------------------------------------------ Milo the beaver

function milo(pose: Pose): string {
  const B = P.beaver;
  const L = P.beaverLight;
  const lift = pose === 'cheer' ? -10 : 0;
  const arms: Record<Pose, string> = {
    idle: arm(-30, -96, -40, -52, B, L) + arm(24, -96, 36, -52, B, L),
    notice: arm(24, -96, 36, -52, B, L) + arm(-30, -100, -88, -132, B, L),
    help: plank(-8, -112) + arm(-30, -96, -50, -112, B, L) + arm(24, -96, 30, -112, B, L),
    cheer: arm(-30, -100, -58, -168, B, L) + arm(24, -100, 50, -168, B, L),
  };
  const back = pose === 'help' ? '' : '';
  return g(
    // tail (paddle with crosshatch)
    g(ellipse(0, 0, 38, 17, P.woodDark, W) + line('M-22 -6 L18 8 M-26 4 L12 14 M-14 -12 L24 0 M-4 -14 L-20 12 M10 -12 L-6 14', 2.5, P.ink, 'opacity="0.35"'), 'translate(54 -28) rotate(-24)') +
      back +
      // feet
      ellipse(-22, -5, 20, 9, P.woodDark, W) +
      ellipse(18, -5, 20, 9, P.woodDark, W) +
      // body and belly
      ellipse(0, -66, 46, 56, B, W) +
      ellipse(-8, -60, 27, 38, P.cream) +
      shine(-22, -92, 14, 8, -30, 0.25) +
      // head
      g(
        circle(14, -176, 10, B, W) +
          circle(-24, -180, 10, B, W) +
          circle(-4, -140, 42, B, W) +
          ellipse(-26, -126, 24, 17, L, W) +
          rrect(-34, -114, 14, 12, 3, '#ffffff', 4) +
          line('M-27 -114 L-27 -102', 2.5, P.ink) +
          ellipse(-44, -134, 7, 6, P.ink) +
          eye(-20, -150, pose) +
          eye(8, -152, pose) +
          mouth(-28, -116, pose === 'cheer' ? 'cheer' : 'idle', 9) +
          // yellow hard hat (he builds)
          path('M-42 -168 Q-40 -200 -4 -202 Q32 -200 34 -168 Z', P.yellow, W) +
          rrect(-50, -172, 92, 10, 5, P.yellowDark, 5) +
          line('M-4 -200 L-4 -172', 4, P.yellowDark),
        `translate(0 ${lift})`,
      ) +
      arms[pose],
  );
}

// ------------------------------------------------------------------ Pip the rabbit

function pip(pose: Pose): string {
  const F = P.bunny;
  const earTilt = pose === 'notice' ? -12 : pose === 'cheer' ? 10 : 0;
  const arms: Record<Pose, string> = {
    idle: arm(-24, -86, -34, -48, F, F) + arm(20, -86, 30, -48, F, F),
    notice: arm(20, -86, 30, -48, F, F) + arm(-24, -90, -80, -122, F, F),
    help: arm(-24, -86, -56, -96, F, F) + arm(20, -86, -18, -98, F, F) + rrect(-78, -110, 30, 26, 6, P.red, 5),
    cheer: arm(-24, -90, -52, -160, F, F) + arm(20, -90, 46, -160, F, F),
  };
  return g(
    // long feet
    ellipse(-24, -5, 24, 9, F, W) +
      ellipse(14, -5, 22, 9, F, W) +
      // fluffy tail
      circle(36, -46, 14, '#ffffff', W) +
      // body
      ellipse(0, -58, 36, 50, F, W) +
      ellipse(-6, -52, 20, 30, '#ffffff') +
      // scarf (racer) with a fluttering end
      path('M-30 -100 Q0 -88 30 -100 L30 -86 Q0 -74 -30 -86 Z', P.orange, 5) +
      path('M24 -92 Q50 -96 62 -84 L48 -76 Q40 -84 22 -82 Z', P.orange, 5) +
      // ears
      g(ellipse(0, 0, 12, 38, F, W) + ellipse(0, 4, 5, 26, P.bunnyInner), `translate(-16 -176) rotate(${-8 + earTilt})`) +
      g(ellipse(0, 0, 12, 36, F, W) + ellipse(0, 4, 5, 24, P.bunnyInner), `translate(14 -172) rotate(${18 + earTilt})`) +
      // head
      circle(-2, -126, 35, F, W) +
      // goggles pushed up on the forehead
      rrect(-34, -158, 64, 12, 6, P.ink) +
      circle(-16, -152, 10, P.blue, 4) +
      circle(10, -152, 10, P.blue, 4) +
      circle(-19, -155, 3, '#ffffff') +
      circle(7, -155, 3, '#ffffff') +
      ellipse(-28, -114, 7, 5, P.bunnyInner) +
      ellipse(16, -112, 7, 5, P.bunnyInner) +
      ellipse(-18, -118, 4, 3, P.pink) +
      eye(-16, -128, pose, 7) +
      eye(8, -130, pose, 7) +
      mouth(-10, -110, pose, 8) +
      arms[pose],
  );
}

// ------------------------------------------------------------------ Nori the turtle

function nori(pose: Pose): string {
  const S = P.turtleSkin;
  const lean = pose === 'notice' ? -8 : 0;
  const arms: Record<Pose, string> = {
    idle: arm(-34, -70, -46, -36, S, S),
    notice: arm(-34, -74, -56, -112, S, S) + circle(-62, -118, 14, 'none', 5) + line('M-52 -108 L-44 -98', 6, P.woodDark),
    help: arm(-34, -70, -78, -84, S, S) + line('M-80 -84 L-80 -150', 7, P.woodDark) + path('M-80 -150 L-30 -150 L-18 -136 L-30 -122 L-80 -122 Z', P.yellow, 5),
    cheer: arm(-34, -74, -60, -150, S, S) + arm(30, -80, 54, -146, S, S),
  };
  const plates = [
    [-8, -86, 18],
    [24, -84, 16],
    [8, -60, 17],
    [-22, -58, 13],
    [38, -58, 12],
  ]
    .map(([x, y, r]) => path(hexagon(x, y, r), P.turtleShellLight, 3.5))
    .join('');
  return g(
    // stubby legs
    ellipse(-28, -8, 18, 10, S, W) +
      ellipse(30, -8, 18, 10, S, W) +
      // little tail
      path('M60 -30 L80 -24 L60 -18 Z', S, 4) +
      // shell
      path('M-52 -34 Q-50 -118 10 -120 Q70 -118 68 -34 Z', P.turtleShell, W) +
      plates +
      rrect(-58, -40, 132, 14, 7, P.turtleShellLight, 5) +
      shine(-20, -100, 18, 9, -25, 0.22) +
      // neck and head (peeking forward)
      g(
        path('M-36 -60 Q-52 -84 -50 -100 L-30 -100 Q-28 -80 -20 -62 Z', S, 5) +
          circle(-50, -124, 30, S, W) +
          // round glasses
          circle(-64, -128, 11, 'none', 4.5) +
          circle(-38, -128, 11, 'none', 4.5) +
          line('M-53 -129 L-49 -129', 4) +
          eye(-64, -128, pose, 6) +
          eye(-38, -128, pose, 6) +
          mouth(-52, -108, pose, 8) +
          ellipse(-74, -112, 6, 4, P.bunnyInner, 0, 'opacity="0.7"'),
        `rotate(${lean} -40 -60)`,
      ) +
      arms[pose],
  );
}

function hexagon(cx: number, cy: number, r: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i + Math.PI / 6;
    pts.push(`${(cx + Math.cos(a) * r).toFixed(1)} ${(cy + Math.sin(a) * r).toFixed(1)}`);
  }
  return `M${pts.join(' L')} Z`;
}

const DRAW: Record<CrewId, (p: Pose) => string> = { milo, pip, nori };

export const CREW_PIECES: ArtPiece[] = (['milo', 'pip', 'nori'] as CrewId[]).flatMap((id) =>
  POSES.map((pose) => piece(`crew.${id}.${pose}`, [-110, -220, 220, 236], DRAW[id](pose))),
);

/** Friends' own vehicles for the missions. */
export const CREW_PROPS: ArtPiece[] = [
  // Milo's picnic wagon (with a basket and a checked cloth)
  piece(
    'prop.wagon',
    [-90, -110, 190, 116],
    line('M66 -40 L96 -64', 7, P.woodDark) +
      rrect(-74, -64, 144, 40, 8, P.red, W) +
      line('M-60 -52 L56 -52', 3, P.redDark, 'opacity="0.6"') +
      path('M-48 -64 Q-40 -104 0 -104 Q40 -104 48 -64 Z', P.woodLight, W) +
      path('M-40 -70 L40 -70 L34 -92 L-34 -92 Z', '#ffffff', 3.5) +
      [-30, -14, 2, 18].map((x, i) => (i % 2 === 0 ? `<rect x="${x}" y="-92" width="14" height="11" fill="${P.red}"/>` : `<rect x="${x}" y="-81" width="14" height="11" fill="${P.red}"/>`)).join('') +
      circle(-46, -18, 18, P.rubber, W) +
      circle(-46, -18, 7, P.yellow, 3.5) +
      circle(44, -18, 18, P.rubber, W) +
      circle(44, -18, 7, P.yellow, 3.5),
  ),
  // Pip's little kart
  piece(
    'prop.kart',
    [-90, -80, 180, 86],
    rrect(-70, -46, 130, 28, 12, P.orange, W) +
      path('M-20 -46 L10 -74 L24 -74 L14 -46 Z', P.orange, W) +
      rrect(-84, -40, 16, 12, 5, P.metalDark, 4) +
      circle(-48, -18, 18, P.rubber, W) +
      circle(-48, -18, 7, P.metal, 3.5) +
      circle(40, -18, 18, P.rubber, W) +
      circle(40, -18, 7, P.metal, 3.5) +
      line('M48 -46 L70 -70', 6) +
      circle(70, -72, 8, P.ink),
  ),
  // Nori's slow scooter
  piece(
    'prop.scooter',
    [-80, -110, 160, 116],
    rrect(-60, -34, 110, 18, 9, P.teal, W) +
      line('M40 -30 L52 -96', 8) +
      line('M38 -96 L66 -96', 8) +
      circle(-44, -16, 15, P.rubber, W) +
      circle(46, -16, 15, P.rubber, W) +
      circle(-44, -16, 5, P.yellow, 3) +
      circle(46, -16, 5, P.yellow, 3),
  ),
];
