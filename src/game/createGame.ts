import Phaser from 'phaser';

/**
 * Scene registry: each scene module is loaded only when first visited
 * (lazy-loading keeps the first playable experience small).
 */
type Loader = () => Promise<{ default: new () => Phaser.Scene }>;

export const SCENES: Record<string, Loader> = {
  map: () => import('./scenes/MapScene'),
  clubhouse: () => import('./scenes/ClubhouseScene'),
  'windmill-kite': () => import('./scenes/trail/WindmillKiteScene'),
  tinker: () => import('./scenes/tinker/TinkerScene'),
};

class IdleScene extends Phaser.Scene {
  constructor() {
    super('idle');
  }
}

export function createGame(parent: HTMLElement): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    backgroundColor: '#2f3b2a',
    scale: {
      mode: Phaser.Scale.EXPAND,
      width: 1920,
      height: 1080,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      max: { width: 2400, height: 1440 },
    },
    // One texture per batch: multi-texture batching showed artefacts on
    // software WebGL in testing; atlases keep the draw-call cost small.
    render: { maxTextures: 1, antialias: true, roundPixels: false },
    audio: { noAudio: true },
    input: { activePointers: 3, keyboard: true },
    disableContextMenu: true,
    banner: false,
    fps: { target: 60, smoothStep: true, panicMax: 10 },
    scene: [IdleScene],
  });
}

const loaded = new Set<string>();

/** Start a scene by key, loading its module first if needed. Stops other scenes. */
export async function startScene(game: Phaser.Game, key: string, data: Record<string, unknown> = {}): Promise<void> {
  const loader = SCENES[key];
  if (!loader) throw new Error(`Unknown scene ${key}`);
  if (!loaded.has(key)) {
    const mod = await loader();
    if (!game.scene.getScene(key)) game.scene.add(key, mod.default, false);
    loaded.add(key);
  }
  for (const s of liveScenes(game)) if (s.scene.key !== key) game.scene.stop(s.scene.key);
  game.scene.start(key, data);
}

/** Scenes that are running OR paused (paused scenes still own UI and listeners). */
function liveScenes(game: Phaser.Game): Phaser.Scene[] {
  return game.scene.getScenes(false).filter((x) => x.scene.key !== 'idle' && (x.sys.isActive() || x.sys.isPaused()));
}

export function activeSceneKey(game: Phaser.Game): string | null {
  const s = liveScenes(game)[0];
  return s ? s.scene.key : null;
}
