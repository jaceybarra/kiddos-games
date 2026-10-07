/**
 * Windmill Hill — layout and toy physics (pure, deterministic, unit-tested).
 * Art, scene logic, and tests all read these numbers so they can't drift apart.
 *
 * Toy model (not real physics): the wind is a steady sideways push. Puff balls
 * fly in an arc that the wind bends; a freed kite flutters down at a steady
 * speed while the wind carries it sideways.
 */

export const WORLD_W = 4400;

/** Ground height profile: [x, y] control points, smoothed with Catmull-Rom. */
export const GROUND_PTS: [number, number][] = [
  [-400, 700],
  [0, 700],
  [260, 690],
  [520, 720],
  [760, 830],
  [980, 880],
  [1250, 885],
  [1480, 850],
  [1700, 800],
  [1880, 810],
  [2080, 865],
  [2300, 902],
  [2440, 910],
  [2600, 890],
  [2800, 850],
  [3000, 840],
  [3250, 850],
  [3550, 870],
  [3850, 860],
  [4150, 870],
  [4400, 870],
  [4800, 870],
];

export function groundY(x: number): number {
  const pts = GROUND_PTS;
  if (x <= pts[0][0]) return pts[0][1];
  if (x >= pts[pts.length - 1][0]) return pts[pts.length - 1][1];
  let i = 0;
  while (i < pts.length - 2 && x > pts[i + 1][0]) i++;
  const p0 = pts[Math.max(0, i - 1)];
  const p1 = pts[i];
  const p2 = pts[i + 1];
  const p3 = pts[Math.min(pts.length - 1, i + 2)];
  const t = (x - p1[0]) / (p2[0] - p1[0]);
  // Catmull-Rom on y with uniform parameter (x spacing is close enough for a gentle hill)
  const t2 = t * t;
  const t3 = t2 * t;
  return 0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3);
}

// ---------------------------------------------------------------- landmarks

export const L = {
  perchX: 300,
  gliderX: 380,
  landingX: 1080,
  dandelions: [880, 1010, 1180],
  pondX: 1320,
  sockLineX: 820,
  pipX: 1590,
  launcherX: 1700,
  windsockX: 1520,
  nestStartX: 1830,
  spoolX: 2450,
  mushroomX: 2700,
  windmillX: 3000,
  leverX: 3180,
  pumpkinX: 3480,
  rowanX: 3640,
  signX: 4150,
  /** walkable range for the avatar */
  minX: 120,
  maxX: 4250,
} as const;

/** Windmill hub and the kite's tangled sail tip. */
export const HUB = { x: L.windmillX, y: 430 };
export const SAIL_LEN = 250;
/** angle (radians, screen coords) of the sail holding the kite at rest: up-left */
export const KITE_SAIL_ANGLE = (-135 * Math.PI) / 180;
/** after the brake is released the sails turn this far before the kite slips off */
export const SAIL_TURN = (-85 * Math.PI) / 180;

export function sailTip(angle: number, len = SAIL_LEN - 20): { x: number; y: number } {
  return { x: HUB.x + Math.cos(angle) * len, y: HUB.y + Math.sin(angle) * len };
}

export const KITE_HOME = sailTip(KITE_SAIL_ANGLE);
export const KITE_LOW = sailTip(KITE_SAIL_ANGLE + SAIL_TURN);

// ---------------------------------------------------------------- wind

export type WindLevel = 'breezy' | 'gusty';
export const WIND = {
  /** sideways push on puff balls (units/s², negative = toward the left) */
  ballAccel: { breezy: -300, gusty: -390 } as Record<WindLevel, number>,
  /** sideways drift speed of a falling kite (units/s, negative = left) */
  kiteDrift: { breezy: -150, gusty: -205 } as Record<WindLevel, number>,
};

// ---------------------------------------------------------------- launcher

export const LAUNCH = {
  x: L.launcherX + 40,
  y: groundY(L.launcherX) - 120,
  speed: 1350,
  gravity: 900,
  kiteRadius: 125,
};

export interface ArcResult {
  points: { x: number; y: number; t: number }[];
  hit: boolean;
  /** where the ball ended (ground or kite) */
  end: { x: number; y: number };
  endReason: 'kite' | 'windmill' | 'ground' | 'sky';
}

/** Simulate a puff-ball launch at `deg` degrees above horizontal. */
export function simulateLaunch(deg: number, wind: WindLevel | 'none', kite = KITE_HOME, dt = 1 / 60): ArcResult {
  const a = (deg * Math.PI) / 180;
  let x = LAUNCH.x;
  let y = LAUNCH.y;
  let vx = Math.cos(a) * LAUNCH.speed;
  let vy = -Math.sin(a) * LAUNCH.speed;
  const ax = wind === 'none' ? 0 : WIND.ballAccel[wind];
  const points: ArcResult['points'] = [{ x, y, t: 0 }];
  let t = 0;
  for (let i = 0; i < 600; i++) {
    vx += ax * dt;
    vy += LAUNCH.gravity * dt;
    x += vx * dt;
    y += vy * dt;
    t += dt;
    points.push({ x, y, t });
    if (Math.hypot(x - kite.x, y - kite.y) < LAUNCH.kiteRadius) return { points, hit: true, end: { x, y }, endReason: 'kite' };
    // windmill tower body (soft bonk)
    if (x > HUB.x - 70 && x < HUB.x + 70 && y > HUB.y + 40 && y < groundY(x)) return { points, hit: false, end: { x, y }, endReason: 'windmill' };
    if (y >= groundY(x) - 10 && vy > 0) return { points, hit: false, end: { x, y: groundY(x) - 10 }, endReason: 'ground' };
    if (y < -900) return { points, hit: false, end: { x, y }, endReason: 'sky' };
  }
  return { points, hit: false, end: { x, y }, endReason: 'sky' };
}

/** Angles offered by preset. Order is fixed (low → high) so positions are learnable. */
export const ANGLES = {
  'more-help': [46, 62],
  'more-exploring': [28, 46, 62, 74],
} as const;

/** Pip's own (unlucky) practice launches: always angles the wind spoils. */
export const PIP_PRACTICE = [62, 28];

// ---------------------------------------------------------------- kite drift & nest

export const KITE_FALL = 125; // units per second downward while fluttering

export function kiteLanding(from: { x: number; y: number }, wind: WindLevel): { x: number; time: number } {
  // step so landing respects the hill shape
  let x = from.x;
  let y = from.y;
  let t = 0;
  const dt = 1 / 60;
  const drift = WIND.kiteDrift[wind];
  for (let i = 0; i < 2000; i++) {
    x += drift * dt;
    y += KITE_FALL * dt;
    t += dt;
    if (y >= groundY(x) - 30) break;
  }
  return { x, time: t };
}

/** Snap spots for the nest wagon (x positions in the valley). */
export const NEST_SPOTS = [2000, 2170, 2340, 2520];
export const NEST_CATCH = 115;

/** Spots shown with More help: only two, chosen to include the right one for the current route/wind. */
export function spotsFor(preset: 'more-help' | 'more-exploring', route: 'launcher' | 'windmill' | null, wind: WindLevel): number[] {
  if (preset === 'more-exploring') return [...NEST_SPOTS];
  const target = route ? bestSpot(route, wind) : bestSpot('launcher', wind);
  const other = route === 'windmill' ? bestSpot('launcher', wind) : bestSpot('windmill', wind);
  const pair = target === other ? [target, NEST_SPOTS.find((s) => s !== target)!] : [target, other];
  return pair.sort((a, b) => a - b);
}

export function releasePoint(route: 'launcher' | 'windmill'): { x: number; y: number } {
  return route === 'launcher' ? KITE_HOME : KITE_LOW;
}

export function bestSpot(route: 'launcher' | 'windmill', wind: WindLevel): number {
  const land = kiteLanding(releasePoint(route), wind).x;
  return NEST_SPOTS.reduce((best, s) => (Math.abs(s - land) < Math.abs(best - land) ? s : best), NEST_SPOTS[0]);
}

export function catches(nestX: number | null, route: 'launcher' | 'windmill', wind: WindLevel): boolean {
  if (nestX === null) return false;
  return Math.abs(kiteLanding(releasePoint(route), wind).x - nestX) <= NEST_CATCH;
}

/** The nest rolls down to the valley floor the first time it's moved (the mix-up). */
export const VALLEY_X = L.spoolX - 95;
