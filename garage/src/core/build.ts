import type { WheelKind } from '../config/tuning';
import { TUNING } from '../config/tuning';
import { Terrain, type Lane, type Segment } from './terrain';
import { simulate } from './truck';

/**
 * Building: a zone has a few sockets; each socket says which pieces fit and
 * exactly what ground each piece makes there (authored, so every layout that
 * fits has been designed and tested). A test is a real run of the same truck
 * physics with no buttons pressed: ramps launch and pads bounce by themselves.
 */
export type PieceKind = 'bridge' | 'ramp' | 'pad';
export const PIECES: PieceKind[] = ['bridge', 'ramp', 'pad'];

export interface Socket {
  id: string;
  /** centre of the socket outline (snap target) in world units */
  x: number;
  y: number;
  /** the ground each fitting piece creates here */
  fits: Partial<Record<PieceKind, Segment>>;
}

export interface BuildZone {
  id: string;
  /** the truck stops here and building begins */
  stopX: number;
  /** a test run succeeds when the truck passes here */
  exitX: number;
  /** camera centre while building */
  focusX: number;
  sockets: Socket[];
  /** pieces offered (at most TUNING.build.maxTray) */
  tray: PieceKind[];
  /** the layout the help animation demonstrates */
  example: Placement[];
  /** the lane the truck uses while building here (a side-by-side route uses the front lane) */
  lane?: Lane;
}

export interface Placement {
  socket: string;
  piece: PieceKind;
}

/** Can this piece go into this socket right now? (fits, socket empty) */
export function canPlace(zone: BuildZone, placed: Placement[], socketId: string, piece: PieceKind): boolean {
  const s = zone.sockets.find((x) => x.id === socketId);
  if (!s || !s.fits[piece]) return false;
  if (placed.some((p) => p.socket === socketId)) return false;
  return zone.tray.includes(piece);
}

/** Which empty sockets would take this piece (to light them up while dragging). */
export function socketsFor(zone: BuildZone, placed: Placement[], piece: PieceKind): Socket[] {
  return zone.sockets.filter((s) => canPlace(zone, placed, s.id, piece));
}

/** The nearest socket that takes the piece, within the snap radius. */
export function snapTarget(zone: BuildZone, placed: Placement[], piece: PieceKind, x: number, y: number): Socket | null {
  let best: Socket | null = null;
  let bestD: number = TUNING.build.snapRadius;
  for (const s of socketsFor(zone, placed, piece)) {
    const d = Math.hypot(s.x - x, s.y - y);
    if (d <= bestD) {
      best = s;
      bestD = d;
    }
  }
  return best;
}

export function segmentsFor(zone: BuildZone, placed: Placement[]): Segment[] {
  const out: Segment[] = [];
  for (const p of placed) {
    const seg = zone.sockets.find((s) => s.id === p.socket)?.fits[p.piece];
    if (seg) out.push({ ...seg, id: `${zone.id}:${p.socket}:${p.piece}` });
  }
  return out;
}

export interface TestResult {
  works: boolean;
  /** the socket to point at when it doesn't work yet */
  hintSocket: string | null;
}

/** Drive the zone with this layout (no buttons pressed) and report whether the truck gets across. */
export function testLayout(base: Terrain, zone: BuildZone, placed: Placement[], wheel: WheelKind, speedFactor = 1): TestResult {
  const terrain = base.with(segmentsFor(zone, placed));
  const run = simulate(terrain, zone.stopX, zone.exitX, { wheel, speedFactor, input: 'none', maxSec: 20, lane: zone.lane });
  if (run.reached) return { works: true, hintSocket: null };
  // point at the first empty socket the example uses (or the first empty one)
  const empty = zone.sockets.filter((s) => !placed.some((p) => p.socket === s.id));
  const hint = zone.example.map((e) => e.socket).find((id) => empty.some((s) => s.id === id)) ?? empty[0]?.id ?? null;
  return { works: false, hintSocket: hint };
}
