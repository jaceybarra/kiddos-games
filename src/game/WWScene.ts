import Phaser from 'phaser';
import { ensureArt, releaseGroup } from '../art/rasterize';
import { COMMON_PIECES } from '../art/common';
import { motion } from '../core/motion';
import { registerSceneForTests } from '../dev/testHooks';
import { showLoading, hideLoading } from '../ui/loading';

export interface Target {
  id: string;
  /** short spoken/accessible label */
  label: string;
  /** world-space hit rectangle (already forgiving) */
  bounds(): Phaser.Geom.Rectangle;
  activate(): void;
  enabled?(): boolean;
  /** lower = checked first when hit areas overlap */
  priority?: number;
}

export interface View {
  /** visible size in world units */
  w: number;
  h: number;
  /** offset of the 1920×1080 safe area inside the visible area */
  ox: number;
  oy: number;
}

/**
 * Base for every Wonderwood scene: safe-area camera, lazy art, forgiving tap
 * targets with keyboard navigation, test hooks, and leak-free teardown.
 */
export abstract class WWScene extends Phaser.Scene {
  protected ready = false;
  view: View = { w: 1920, h: 1080, ox: 0, oy: 0 };
  readonly targets = new Map<string, Target>();
  private focusRing?: Phaser.GameObjects.Graphics;
  private focusId: string | null = null;
  private cleanups: (() => void)[] = [];
  private keyHandler?: (e: KeyboardEvent) => void;
  private downAt = 0;
  /** scenes that scroll horizontally override layoutCamera */
  protected worldWidth = 1920;

  abstract readonly artGroup: string;
  abstract artKeys(): string[];
  abstract build(data: Record<string, unknown>): void | Promise<void>;

  /** Called after build and on every resize. */
  protected layout(): void {}

  create(data: Record<string, unknown>): void {
    this.ready = false;
    this.targets.clear();
    this.focusId = null;
    this.cleanups = [];
    this.computeView();
    this.layoutCamera();
    const onResize = () => {
      this.computeView();
      this.layoutCamera();
      if (this.ready) this.layout();
    };
    this.scale.on('resize', onResize);
    this.onCleanup(() => this.scale.off('resize', onResize));
    this.input.on('pointerdown', () => (this.downAt = this.time.now));
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => this.handleTap(p));
    this.setupKeyboard();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.teardown());
    registerSceneForTests(this);
    const slow = setTimeout(() => showLoading(), 160);
    // shared effect art is always available (it lives in the 'core' group)
    ensureArt(this.textures, COMMON_PIECES.map((p) => p.key))
      .then(() => ensureArt(this.textures, this.artKeys(), this.artGroup))
      .then(async () => {
        clearTimeout(slow);
        if (!this.sys.isActive() && !this.sys.isPaused()) return;
        await this.build(data ?? {});
        this.focusRing = this.add.graphics().setDepth(10000);
        this.ready = true;
        this.layout();
        hideLoading();
        if (!motion.reduced) this.cameras.main.fadeIn(280, 47, 59, 42);
      })
      .catch((e) => {
        clearTimeout(slow);
        hideLoading();
        console.error(e);
        this.onBuildError(e as Error);
      });
  }

  protected onBuildError(_e: Error): void {}

  private computeView(): void {
    const w = this.scale.width;
    const h = this.scale.height;
    this.view = { w, h, ox: (w - 1920) / 2, oy: (h - 1080) / 2 };
  }

  /** Default: a fixed stage centred on the safe area. */
  protected layoutCamera(): void {
    const cam = this.cameras.main;
    cam.setSize(this.view.w, this.view.h);
    cam.setScroll(-this.view.ox, -this.view.oy);
  }

  get isReady(): boolean {
    return this.ready;
  }

  // ---------------------------------------------------------------- targets

  addTarget(t: Target): void {
    this.targets.set(t.id, t);
  }

  removeTarget(id: string): void {
    this.targets.delete(id);
    if (this.focusId === id) this.focusId = null;
  }

  /** Rectangle helper with forgiving padding (kids' fingers are wide). */
  rectAround(x: number, y: number, w: number, h: number, pad = 24): Phaser.Geom.Rectangle {
    return new Phaser.Geom.Rectangle(x - w / 2 - pad, y - h / 2 - pad, w + pad * 2, h + pad * 2);
  }

  enabledTargets(): Target[] {
    return [...this.targets.values()].filter((t) => t.enabled?.() ?? true);
  }

  protected targetAt(x: number, y: number): Target | undefined {
    const hits = this.enabledTargets().filter((t) => t.bounds().contains(x, y));
    hits.sort((a, b) => (a.priority ?? 5) - (b.priority ?? 5) || area(a.bounds()) - area(b.bounds()));
    return hits[0];
  }

  private handleTap(p: Phaser.Input.Pointer): void {
    if (!this.ready || this.inputLocked) return;
    if (p.getDistance() > 34 || this.time.now - this.downAt > 1200) return;
    const t = this.targetAt(p.worldX, p.worldY);
    if (t) {
      this.focusId = null;
      this.drawFocus();
      this.tapPoint = { x: p.worldX, y: p.worldY };
      try {
        t.activate();
      } finally {
        this.tapPoint = null;
      }
    } else this.onGroundTap(p.worldX, p.worldY);
  }

  /** World point of the tap that is activating a target right now (null for keyboard activation). */
  protected tapPoint: { x: number; y: number } | null = null;

  /** Taps that miss every target (e.g. walk there). */
  protected onGroundTap(_x: number, _y: number): void {}

  /** While true, taps/keys are ignored (used during short cutscenes). */
  inputLocked = false;

  // ---------------------------------------------------------------- keyboard

  private setupKeyboard(): void {
    const canvas = this.game.canvas;
    canvas.setAttribute('tabindex', '0');
    canvas.setAttribute('role', 'application');
    canvas.setAttribute('aria-label', 'Game area. Tab moves between things, Enter uses them, arrow keys walk.');
    this.keyHandler = (e: KeyboardEvent) => {
      if (!this.ready || document.activeElement !== canvas) return;
      if (e.key === 'Tab') {
        const list = this.enabledTargets().sort((a, b) => a.bounds().centerX - b.bounds().centerX);
        if (!list.length) return;
        const idx = list.findIndex((t) => t.id === this.focusId);
        const next = e.shiftKey ? idx - 1 : idx + 1;
        if (next < 0 || next >= list.length) {
          this.focusId = null;
          this.drawFocus();
          return; // let focus leave the canvas
        }
        e.preventDefault();
        this.focusId = list[next].id;
        this.drawFocus();
        this.onFocusTarget(list[next]);
      } else if ((e.key === 'Enter' || e.key === ' ') && !this.inputLocked) {
        const t = this.focusId ? this.targets.get(this.focusId) : undefined;
        if (t && (t.enabled?.() ?? true)) {
          e.preventDefault();
          t.activate();
        } else {
          e.preventDefault();
          this.onActionKey();
        }
      } else if (e.key.startsWith('Arrow') && !this.inputLocked) {
        e.preventDefault();
        const dx = e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0;
        const dy = e.key === 'ArrowUp' ? -1 : e.key === 'ArrowDown' ? 1 : 0;
        this.onArrow(dx, dy, e.type === 'keydown');
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.key.startsWith('Arrow') && this.ready) this.onArrow(0, 0, false);
    };
    window.addEventListener('keydown', this.keyHandler);
    window.addEventListener('keyup', up);
    this.onCleanup(() => {
      window.removeEventListener('keydown', this.keyHandler!);
      window.removeEventListener('keyup', up);
    });
  }

  protected onFocusTarget(_t: Target): void {}
  protected onActionKey(): void {}
  protected onArrow(_dx: number, _dy: number, _down: boolean): void {}

  private drawFocus(): void {
    const g = this.focusRing;
    if (!g) return;
    g.clear();
    const t = this.focusId ? this.targets.get(this.focusId) : undefined;
    if (!t) return;
    const r = t.bounds();
    g.lineStyle(14, 0xffffff, 0.95);
    g.strokeRoundedRect(r.x, r.y, r.width, r.height, 28);
    g.lineStyle(7, 0x1f6fd6, 1);
    g.strokeRoundedRect(r.x, r.y, r.width, r.height, 28);
  }

  override update(time: number, delta: number): void {
    if (!this.ready) return;
    if (this.focusId) this.drawFocus();
    this.tick(time, delta);
  }

  /** Per-frame logic once the scene is built. */
  protected tick(_time: number, _delta: number): void {}

  // ---------------------------------------------------------------- hints & lifecycle hooks

  /** HUD "show me" button. */
  hint(): void {}
  /** HUD replay button is handled by app/speech; scenes may add a demo. */
  onPause(): void {}
  onResume(): void {}
  /** Return a plain object describing state (dev inspector / tests). */
  inspect(): Record<string, unknown> {
    return {};
  }

  onCleanup(fn: () => void): void {
    this.cleanups.push(fn);
  }

  private teardown(): void {
    this.ready = false;
    for (const fn of this.cleanups.splice(0)) {
      try {
        fn();
      } catch (e) {
        console.error(e);
      }
    }
    this.input.removeAllListeners();
    this.targets.clear();
    this.tweens.killAll();
    this.time.removeAllEvents();
    releaseGroup(this.textures, this.artGroup);
  }
}

function area(r: Phaser.Geom.Rectangle): number {
  return r.width * r.height;
}
