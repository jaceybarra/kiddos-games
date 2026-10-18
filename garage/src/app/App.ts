import Phaser from 'phaser';
import { installTestHooks } from '../dev/testHooks';
import { startDiagnostics, stopDiagnostics } from '../dev/diagnostics';
import type { SaveData, Settings } from '../save/schema';
import { SaveStore } from '../save/store';
import { RotateGuard } from '../ui/overlays';
import { setApp, type AppContext, type OfflineState, type SceneData, type SceneKey } from './context';
import { Loading } from './loading';
import { startOffline, type Offline } from './offline';

/**
 * The app shell: opens the save, creates the Phaser game, switches scenes,
 * applies grown-up settings, reports interruptions (hidden tab, focus loss,
 * portrait) to the running scene, and owns the offline/update state.
 */
type Loader = () => Promise<{ default: new () => Phaser.Scene }>;

const SCENES: Record<SceneKey, Loader> = {
  boot: () => import('../scenes/BootScene'),
  garage: () => import('../scenes/GarageScene'),
  mission: () => import('../scenes/MissionScene'),
  creator: () => import('../scenes/CreatorScene'),
  result: () => import('../scenes/ResultScene'),
};

type Why = 'hidden' | 'blur' | 'portrait' | 'modal';

export class App implements AppContext {
  game!: Phaser.Game;
  store!: SaveStore;
  private loading = new Loading();
  private offlineApi: Offline | null = null;
  private offlineState: OfflineState = { state: 'installing' };
  private settingsFns = new Set<() => void>();
  private interruptFns = new Set<(why: Why) => void>();
  private loaded = new Set<SceneKey>();
  private switching = false;
  private bootedAt = performance.now();
  private motionQuery = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
  rotateGuard: RotateGuard | null = null;

  async boot(): Promise<void> {
    this.loading.setProgress(0.02);
    this.store = await SaveStore.open();
    setApp(this);
    this.applySettings();
    this.motionQuery?.addEventListener?.('change', () => {
      this.applySettings();
      this.emitSettings();
    });
    this.offlineApi = startOffline((s) => {
      this.offlineState = s;
    });
    this.offlineState = this.offlineApi.state();
    this.game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: 'game-root',
      backgroundColor: '#8fd0f0',
      scale: {
        mode: Phaser.Scale.EXPAND,
        width: 1920,
        height: 1080,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        max: { width: 2560, height: 1600 },
      },
      // one texture per batch: multi-texture batching misbehaved on software WebGL; the art is in atlases
      render: { maxTextures: 1, antialias: true, roundPixels: false },
      audio: { noAudio: true },
      input: { activePointers: 3, keyboard: true },
      disableContextMenu: true,
      banner: false,
      fps: { target: 60, min: 3, smoothStep: true, panicMax: 10 },
      scene: [],
    });
    await new Promise<void>((res) => this.game.events.once(Phaser.Core.Events.READY, () => res()));
    installTestHooks(this);
    this.watchInterruptions();
    if (this.settings.diagnostics || new URLSearchParams(location.search).has('diag')) startDiagnostics(this.game);
    this.go('boot', {});
  }

  // ------------------------------------------------------------------ AppContext

  get save(): SaveData {
    return this.store.data;
  }

  get settings(): Settings {
    return this.store.data.settings;
  }

  async commit(next: SaveData): Promise<boolean> {
    const before = JSON.stringify(this.store.data.settings);
    const ok = await this.store.save(next);
    if (JSON.stringify(next.settings) !== before) {
      this.applySettings();
      this.emitSettings();
    }
    return ok;
  }

  reducedMotion(): boolean {
    const m = this.settings.motion;
    return m === 'reduced' || (m === 'system' && !!this.motionQuery?.matches);
  }

  lowIntensity(): boolean {
    return this.settings.lowIntensity;
  }

  go<K extends SceneKey>(key: K, data: SceneData[K]): void {
    if (this.switching) return;
    this.switching = true;
    const release = setTimeout(() => (this.switching = false), 1500);
    void (async () => {
      try {
        if (!this.loaded.has(key)) {
          const mod = await SCENES[key]();
          if (!this.game.scene.getScene(key)) this.game.scene.add(key, mod.default, false);
          this.loaded.add(key);
        }
        for (const s of this.game.scene.getScenes(false)) {
          if (s.scene.key !== key && (s.sys.isActive() || s.sys.isPaused() || s.sys.isSleeping())) this.game.scene.stop(s.scene.key);
        }
        const scene = this.game.scene.getScene(key)!;
        scene.events.once(Phaser.Scenes.Events.CREATE, () => {
          clearTimeout(release);
          this.switching = false;
          if (key !== 'boot') this.loading.done(this.reducedMotion());
        });
        this.game.scene.start(key, data as object);
      } catch (e) {
        clearTimeout(release);
        this.switching = false;
        throw e;
      }
    })();
  }

  refreshFromStore(): void {
    this.applySettings();
    this.emitSettings();
  }

  sessionMinutes(): number {
    return (performance.now() - this.bootedAt) / 60000;
  }

  get offline(): OfflineState {
    return this.offlineState;
  }

  get updateReady(): boolean {
    return !!this.offlineApi?.updateReady();
  }

  applyUpdate(): void {
    void this.store.flush().then(() => this.offlineApi?.applyUpdate());
  }

  onSettings(fn: () => void): () => void {
    this.settingsFns.add(fn);
    return () => this.settingsFns.delete(fn);
  }

  onInterrupt(fn: (why: Why) => void): () => void {
    this.interruptFns.add(fn);
    return () => this.interruptFns.delete(fn);
  }

  /** Tell the running scene to pause (also used by test hooks to simulate the real events). */
  emitInterrupt(why: Why): void {
    for (const fn of [...this.interruptFns]) fn(why);
  }

  // ------------------------------------------------------------------ internals

  private emitSettings(): void {
    for (const fn of [...this.settingsFns]) fn();
    if (this.settings.diagnostics || new URLSearchParams(location.search).has('diag')) startDiagnostics(this.game);
    else stopDiagnostics();
  }

  private applySettings(): void {
    const html = document.documentElement;
    html.classList.toggle('motion-reduced', this.reducedMotion());
    html.classList.toggle('motion-full', this.settings.motion === 'full');
    html.classList.toggle('jump-left', this.settings.jumpSide === 'left');
  }

  private watchInterruptions(): void {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.emitInterrupt('hidden');
    });
    window.addEventListener('blur', () => this.emitInterrupt('blur'));
    window.addEventListener('pagehide', () => this.emitInterrupt('hidden'));
    this.rotateGuard = new RotateGuard(
      () => this.emitInterrupt('portrait'),
      () => undefined,
    );
  }
}
