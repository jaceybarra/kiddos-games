/**
 * Side-view ground made of authored straight segments. The truck rides on
 * the nearest surface below it, so upper platforms (one-way, landed on from
 * above) can sit over the lower route. Logs are short walls: the truck waits
 * in front of one until it jumps.
 */
export type SurfaceKind = 'grass' | 'wood' | 'bridge' | 'ramp' | 'pad' | 'platform' | 'landing';

export interface Segment {
  id?: string;
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  kind: SurfaceKind;
  /** leaving this segment's right end launches the truck upward (ramps) */
  launch?: number;
  /** landing here bounces the truck back up (bouncy pads) */
  bounce?: number;
  /** side-by-side routes: a segment on one lane is invisible to trucks on the other (none = shared) */
  lane?: Lane;
  /** a ramp that leads up a wall's face makes that wall drivable (wall id) */
  clears?: string;
}

export type Lane = 'back' | 'front';

export interface Wall {
  id: string;
  /** left face of the log */
  x: number;
  w: number;
  /** top of the log (smaller y is higher) */
  top: number;
}

export interface Surface {
  seg: Segment;
  y: number;
  slope: number;
}

export function heightOn(seg: Segment, x: number): number {
  if (seg.x1 === seg.x0) return seg.y0;
  return seg.y0 + ((seg.y1 - seg.y0) * (x - seg.x0)) / (seg.x1 - seg.x0);
}

export class Terrain {
  readonly segments: Segment[];
  readonly walls: Wall[];
  /** every wall, including ones a ramp has made drivable (for drawing) */
  readonly allWalls: Wall[];
  /** lowest ground (largest y), used to decide when a fall is a miss */
  readonly floorY: number;

  constructor(segments: Segment[], walls: Wall[] = []) {
    this.segments = [...segments].sort((a, b) => a.x0 - b.x0);
    this.walls = walls.filter((w) => !segments.some((s) => s.clears === w.id)).sort((a, b) => a.x - b.x);
    this.allWalls = walls;
    this.floorY = Math.max(...this.segments.map((s) => Math.max(s.y0, s.y1)), 0);
  }

  /**
   * The highest surface at x that is at or below y (y grows downward), so a
   * truck at height y would land on it. `tolerance` lets a grounded truck
   * climb small rises.
   */
  surfaceBelow(x: number, y: number, tolerance = 0, lane: Lane = 'back'): Surface | null {
    let best: Surface | null = null;
    for (const seg of this.segments) {
      if (x < seg.x0 || x > seg.x1) continue;
      if (seg.lane && seg.lane !== lane) continue;
      const sy = heightOn(seg, x);
      if (sy < y - tolerance) continue;
      if (!best || sy < best.y) {
        best = { seg, y: sy, slope: (seg.y1 - seg.y0) / Math.max(1, seg.x1 - seg.x0) };
      }
    }
    return best;
  }

  /** A log whose left face lies between x0 and x1 and stands above height y. */
  wallBetween(x0: number, x1: number, y: number): Wall | null {
    for (const w of this.walls) {
      if (w.x >= x0 && w.x < x1 && y > w.top + 2) return w;
    }
    return null;
  }

  /** Logs also have a top you can land on. */
  wallTopAt(x: number, y: number): number | null {
    for (const w of this.walls) if (x >= w.x && x <= w.x + w.w && y <= w.top + 6) return w.top;
    return null;
  }

  /** Is there any ground to ride on between x0 and x1 at the truck's height? (used to look ahead for gaps) */
  gapAhead(x: number, y: number, distance: number, lane: Lane = 'back'): number | null {
    for (let d = 0; d <= distance; d += 12) {
      const s = this.surfaceBelow(x + d, y - 4, 30, lane);
      if (!s || s.y - y > 60) return x + d;
    }
    return null;
  }

  with(extra: Segment[]): Terrain {
    return new Terrain([...this.segments, ...extra], this.allWalls);
  }
}

/** Convenience: a flat run of ground. */
export function flat(x0: number, x1: number, y: number, kind: SurfaceKind = 'grass', extra: Partial<Segment> = {}): Segment {
  return { x0, x1, y0: y, y1: y, kind, ...extra };
}

/** Convenience: a slope from (x0, y0) to (x1, y1). */
export function slope(x0: number, y0: number, x1: number, y1: number, kind: SurfaceKind = 'grass', extra: Partial<Segment> = {}): Segment {
  return { x0, x1, y0, y1, kind, ...extra };
}
