import Phaser from 'phaser';
import { app } from '../app/context';
import { BOOT_KEYS, registerAll } from '../art/index';
import { ensureArt, getPiece } from '../art/rasterize';
import { registerSceneForTests } from '../dev/testHooks';

/**
 * Turns the authored SVG art into textures (in small batches so the loading
 * bar moves), then opens the garage with its door closed and the big Play.
 * Large backdrops are left to the scene that shows them.
 */
export default class BootScene extends Phaser.Scene {
  isReady = false;

  constructor() {
    super('boot');
  }

  create(): void {
    registerSceneForTests(this);
    registerAll();
    void this.load_();
  }

  private async load_(): Promise<void> {
    const keys = BOOT_KEYS.filter((k) => !getPiece(k).transient);
    const loading = (window as unknown as { __garageLoading?: { setProgress(p: number): void } }).__garageLoading;
    const batch = 12;
    for (let i = 0; i < keys.length; i += batch) {
      await ensureArt(this.textures, keys.slice(i, i + batch));
      loading?.setProgress(Math.min(1, (i + batch) / keys.length));
    }
    app().go('garage', { entrance: 'cold' });
  }

  inspect(): Record<string, unknown> {
    return { booting: true };
  }
}
