import Phaser from 'phaser';
import { TUNING } from '../config/tuning';

/**
 * A steady side-view camera: looks ahead of the truck, follows ground height
 * (not every jump), pans smoothly to frame a build or an encounter.
 *
 * Works in terms of the camera centre (Phaser zooms around the centre), and
 * reads the view size every call, so Scale.EXPAND resizes are handled.
 * Never shakes, never flashes.
 */
const LEFT_MARGIN = 120;
/** soil is drawn down to G + 700; the view's bottom edge never goes below this */
const BOTTOM_LIMIT = TUNING.world.groundY + 680;

export class CameraRig {
  private scene: Phaser.Scene;
  private cam: Phaser.Cameras.Scene2D.Camera;
  private reduced: boolean;
  private worldLength: number;
  private cx = 0;
  private cy = 0;
  private focusing: Phaser.Tweens.Tween | null = null;
  private zooming: Phaser.Tweens.Tween | null = null;
  private placed = false;

  constructor(scene: Phaser.Scene, opts: { reduced: boolean; worldLength: number }) {
    this.scene = scene;
    this.cam = scene.cameras.main;
    this.reduced = opts.reduced;
    this.worldLength = opts.worldLength;
    this.cx = this.cam.scrollX + this.cam.width / 2;
    this.cy = this.cam.scrollY + this.cam.height / 2;
  }

  private get viewW(): number {
    return this.cam.width / this.cam.zoom;
  }
  private get viewH(): number {
    return this.cam.height / this.cam.zoom;
  }

  private clampX(x: number): number {
    const half = this.viewW / 2;
    const lo = half - LEFT_MARGIN;
    const hi = this.worldLength - half;
    if (hi < lo) return this.worldLength / 2;
    return Phaser.Math.Clamp(x, lo, hi);
  }

  private clampY(y: number): number {
    // keep the bottom edge above the end of the drawn soil (never hides the ground: that is far above)
    return Math.min(y, BOTTOM_LIMIT - this.viewH / 2);
  }

  private apply(): void {
    this.cam.setScroll(this.cx - this.cam.width / 2, this.cy - this.cam.height / 2);
  }

  /** how far ahead the camera looks right now (eases with speed: further when fast, behind when reversing) */
  private lead: number = TUNING.camera.lookAhead;

  private targetFor(x: number, groundY: number): { x: number; y: number } {
    return {
      x: this.clampX(x + this.lead),
      y: this.clampY(groundY - TUNING.camera.truckBelowCentre),
    };
  }

  /** every frame while driving: x = truck x, groundY = height of the ground the truck last stood on */
  follow(x: number, groundY: number, dtSec: number, vx: number = TUNING.drive.speed): void {
    if (this.focusing) return;
    if (!this.placed) return this.snap(x, groundY);
    const dt = Math.max(0, Math.min(dtSec, 0.1));
    const k = vx / TUNING.drive.speed;
    const want = TUNING.camera.lookAhead * Math.max(-0.7, Math.min(1.6, 0.55 + (k >= 0 ? 0.45 : 1.8) * k));
    this.lead += (want - this.lead) * (1 - Math.exp(-1.6 * dt));
    const t = this.targetFor(x, groundY);
    this.cx += (t.x - this.cx) * (1 - Math.exp(-TUNING.camera.followX * dt));
    this.cy += (t.y - this.cy) * (1 - Math.exp(-TUNING.camera.followY * dt));
    // a resize can change the clamp range: stay inside it
    this.cx = this.clampX(this.cx);
    this.cy = this.clampY(this.cy);
    this.apply();
  }

  /** smoothly frame a point (centre) — build zones, friends; resolves when there */
  focus(x: number, y: number, ms: number): Promise<void> {
    this.focusing?.stop();
    const to = { x: this.clampX(x), y: this.clampY(y) };
    const duration = this.reduced ? Math.min(ms, 160) : ms;
    if (duration <= 0) {
      this.cx = to.x;
      this.cy = to.y;
      this.placed = true;
      this.apply();
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      const from = { x: this.cx, y: this.cy };
      const proxy = { t: 0 };
      this.focusing = this.scene.tweens.add({
        targets: proxy,
        t: 1,
        duration,
        ease: 'Sine.easeInOut',
        onUpdate: () => {
          this.cx = from.x + (to.x - from.x) * proxy.t;
          this.cy = from.y + (to.y - from.y) * proxy.t;
          this.apply();
        },
        onComplete: () => {
          this.focusing = null;
          this.placed = true;
          resolve();
        },
        onStop: () => {
          this.focusing = null;
          resolve();
        },
      });
    });
  }

  /** jump straight to following (scene start, checkpoint restore) */
  snap(x: number, groundY: number): void {
    this.focusing?.stop();
    this.focusing = null;
    this.lead = TUNING.camera.lookAhead;
    const t = this.targetFor(x, groundY);
    this.cx = t.x;
    this.cy = t.y;
    this.placed = true;
    this.apply();
  }

  /** zoom (creator overview zooms out); 1 = normal */
  setZoom(z: number, ms: number): Promise<void> {
    this.zooming?.stop();
    const duration = this.reduced ? Math.min(ms, 160) : ms;
    if (duration <= 0) {
      this.cam.setZoom(z);
      this.cx = this.clampX(this.cx);
      this.cy = this.clampY(this.cy);
      this.apply();
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      this.zooming = this.scene.tweens.add({
        targets: this.cam,
        zoom: z,
        duration,
        ease: 'Sine.easeInOut',
        onUpdate: () => {
          if (!this.focusing) {
            this.cx = this.clampX(this.cx);
            this.cy = this.clampY(this.cy);
            this.apply();
          }
        },
        onComplete: () => {
          this.zooming = null;
          resolve();
        },
        onStop: () => {
          this.zooming = null;
          resolve();
        },
      });
    });
  }

  /** the current camera centre (world units) */
  get centre(): { x: number; y: number } {
    return { x: this.cx, y: this.cy };
  }

  setReduced(on: boolean): void {
    this.reduced = on;
  }

  setWorldLength(len: number): void {
    this.worldLength = len;
  }

  /** world point → game-unit screen point (for DOM overlays / HUD targets) */
  toScreen(x: number, y: number): { x: number; y: number } {
    const z = this.cam.zoom;
    return {
      x: (x - this.cam.scrollX - this.cam.width / 2) * z + this.cam.width / 2,
      y: (y - this.cam.scrollY - this.cam.height / 2) * z + this.cam.height / 2,
    };
  }
}
