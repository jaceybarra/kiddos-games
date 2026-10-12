import type Phaser from 'phaser';
import { G } from '../content/missions';
import type { Lane, Terrain } from '../core/terrain';

/** Promise helpers on the scene clock, so pausing the scene pauses scripts too. */
export function wait(scene: Phaser.Scene, ms: number): Promise<void> {
  return new Promise((res) => {
    if (ms <= 0) {
      res();
      return;
    }
    scene.time.delayedCall(ms, () => res());
  });
}

export function tweenP(scene: Phaser.Scene, cfg: Phaser.Types.Tweens.TweenBuilderConfig): Promise<void> {
  return new Promise((res) => {
    const duration = typeof cfg.duration === 'number' ? cfg.duration : 300;
    if (duration <= 0) {
      // apply end values immediately
      const targets = (Array.isArray(cfg.targets) ? cfg.targets : [cfg.targets]) as Record<string, unknown>[];
      for (const t of targets) {
        for (const [k, v] of Object.entries(cfg)) {
          if (['targets', 'duration', 'ease', 'delay', 'onComplete', 'yoyo', 'repeat', 'hold'].includes(k)) continue;
          if (typeof v === 'number') t[k] = v;
        }
      }
      res();
      return;
    }
    scene.tweens.add({ ...cfg, onComplete: () => res() });
  });
}

/**
 * The walkable ground at x for friends (they stay on the lower routes, never
 * on the spring-wheel shelves): the highest surface no higher than `ceiling`.
 */
export function groundAt(terrain: Terrain, x: number, lane: Lane = 'back', ceiling = G - 175): number {
  const s = terrain.surfaceBelow(x, ceiling, 0, lane);
  if (s) return s.y;
  const wallTop = terrain.wallTopAt(x, ceiling);
  return wallTop ?? G;
}

/** Points along the ground from x0 to x1, with a hop arc over every gap. */
export function pathAlong(terrain: Terrain, x0: number, x1: number, lane: Lane, ceiling = G - 175, step = 30): { x: number; y: number }[] {
  const pts: { x: number; y: number }[] = [];
  let gapStart: { x: number; y: number } | null = null;
  for (let x = x0; x <= x1; x += step) {
    const s = terrain.surfaceBelow(x, ceiling, 0, lane);
    const top = terrain.wallTopAt(x, ceiling);
    const y = s ? s.y : top;
    if (y === null || y === undefined) {
      if (!gapStart && pts.length) gapStart = pts[pts.length - 1];
      continue;
    }
    if (gapStart) {
      // arc from the last ground point over the gap to here
      const a = gapStart;
      const span = x - a.x;
      const lift = Math.max(90, span * 0.45);
      for (let i = 1; i < 8; i++) {
        const t = i / 8;
        pts.push({ x: a.x + span * t, y: a.y + (y - a.y) * t - lift * 4 * t * (1 - t) });
      }
      gapStart = null;
    }
    pts.push({ x, y });
  }
  return pts;
}

/** Convert a CSS-pixel point (DOM) to game screen units (camera-independent). */
export function cssToGame(scene: Phaser.Scene, p: { x: number; y: number }): { x: number; y: number } {
  const r = scene.game.canvas.getBoundingClientRect();
  return { x: ((p.x - r.left) / r.width) * scene.scale.width, y: ((p.y - r.top) / r.height) * scene.scale.height };
}

/** Convert a world point to game screen units through the main camera. */
export function worldToScreen(scene: Phaser.Scene, x: number, y: number): { x: number; y: number } {
  const cam = scene.cameras.main;
  return { x: (x - cam.scrollX) * cam.zoom, y: (y - cam.scrollY) * cam.zoom };
}
