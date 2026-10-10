import type Phaser from 'phaser';
import { voiceLog } from '../app/voices';

/**
 * Test hooks for browser automation. Present only in dev/e2e builds
 * (import.meta.env.DEV or VITE_E2E). They expose where things are so tests
 * can click real coordinates; they never change game state.
 */
interface Inspectable extends Phaser.Scene {
  targets: Map<string, { id: string; label: string; bounds(): Phaser.Geom.Rectangle; enabled?(): boolean }>;
  inspect(): Record<string, unknown>;
  isReady: boolean;
}

const enabled = import.meta.env.DEV || import.meta.env.VITE_E2E === '1';
let current: Inspectable | null = null;

export function registerSceneForTests(scene: Phaser.Scene): void {
  if (!enabled) return;
  current = scene as Inspectable;
  const w = window as unknown as { __ww?: Record<string, unknown> };
  w.__ww = {
    ...(w.__ww ?? {}),
    scene: () => (current ? current.scene.key : null),
    /** every line asked to be spoken so far, and whether it had a recording */
    voiceLog: () => voiceLog.slice(),
    ready: () => !!current?.isReady,
    state: () => current?.inspect() ?? {},
    targets: () => {
      if (!current) return [];
      const cam = current.cameras.main;
      const canvas = current.game.canvas.getBoundingClientRect();
      const sx = canvas.width / current.scale.width;
      const sy = canvas.height / current.scale.height;
      return [...current.targets.values()]
        .filter((t) => t.enabled?.() ?? true)
        .map((t) => {
          const b = t.bounds();
          const cx = (b.centerX - cam.scrollX) * cam.zoom;
          const cy = (b.centerY - cam.scrollY) * cam.zoom;
          return { id: t.id, label: t.label, x: canvas.left + cx * sx, y: canvas.top + cy * sy, w: b.width * cam.zoom * sx, h: b.height * cam.zoom * sy };
        });
    },
    worldToClient: (x: number, y: number) => {
      if (!current) return null;
      const cam = current.cameras.main;
      const canvas = current.game.canvas.getBoundingClientRect();
      const sx = canvas.width / current.scale.width;
      const sy = canvas.height / current.scale.height;
      return { x: canvas.left + (x - cam.scrollX) * cam.zoom * sx, y: canvas.top + (y - cam.scrollY) * cam.zoom * sy };
    },
  };
}

export function exposeForTests(key: string, value: unknown): void {
  if (!enabled) return;
  const w = window as unknown as { __ww?: Record<string, unknown> };
  w.__ww = { ...(w.__ww ?? {}), [key]: value };
}
