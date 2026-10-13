import type Phaser from 'phaser';
import type { AppContext } from '../app/context';

/**
 * Test hooks for browser automation, present only in dev and e2e builds
 * (import.meta.env.DEV or VITE_E2E=1). They expose where things are so tests
 * can press real coordinates, and read state; they never change the game
 * (except `interrupt`, which simulates the same event a real interruption
 * would send).
 */
interface Inspectable extends Phaser.Scene {
  isReady?: boolean;
  inspect?(): Record<string, unknown>;
  testTargets?(): { id: string; x: number; y: number; w: number; h: number; space: 'world' | 'screen' }[];
}

const enabled = import.meta.env.DEV || import.meta.env.VITE_E2E === '1';
let current: Inspectable | null = null;

export function registerSceneForTests(scene: Phaser.Scene): void {
  if (!enabled) return;
  current = scene as Inspectable;
}

export function installTestHooks(app: AppContext & { emitInterrupt(why: 'hidden' | 'blur' | 'portrait' | 'modal'): void }): void {
  if (!enabled) return;
  const conv = (x: number, y: number, space: 'world' | 'screen') => {
    const s = current!;
    const cam = s.cameras.main;
    const r = s.game.canvas.getBoundingClientRect();
    const sx = r.width / s.scale.width;
    const sy = r.height / s.scale.height;
    if (space === 'screen') return { x: r.left + x * sx, y: r.top + y * sy, sx, sy };
    // world → camera → canvas (camera zoom is around its centre)
    const zx = (x - cam.scrollX - cam.width / 2) * cam.zoom + cam.width / 2 + cam.x;
    const zy = (y - cam.scrollY - cam.height / 2) * cam.zoom + cam.height / 2 + cam.y;
    return { x: r.left + zx * sx, y: r.top + zy * sy, sx: sx * cam.zoom, sy: sy * cam.zoom };
  };
  (window as unknown as { __garage: unknown }).__garage = {
    ready: () => !!current && current.scene.key !== 'boot' && current.sys.isActive() && !!current.isReady,
    scene: () => (current && (current.sys.isActive() || current.sys.isPaused()) ? current.scene.key : null),
    state: () => current?.inspect?.() ?? {},
    targets: () => {
      if (!current?.testTargets) return [];
      return current.testTargets().map((t) => {
        const p = conv(t.x, t.y, t.space);
        return { id: t.id, x: p.x, y: p.y, w: t.w * p.sx, h: t.h * p.sy };
      });
    },
    worldToClient: (x: number, y: number) => (current ? conv(x, y, 'world') : null),
    save: () => JSON.parse(JSON.stringify(app.save)),
    saveStatus: () => ({ ...app.store.status }),
    offline: () => app.offline,
    interrupt: (why: 'hidden' | 'blur' | 'portrait' | 'modal') => app.emitInterrupt(why),
  };
}
