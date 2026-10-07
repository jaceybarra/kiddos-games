import Phaser from 'phaser';
import { registerPieces } from '../../art/registry';
import { STAGE_PIECES } from '../../art/scenes/stage';
import { rigArtKeys } from '../../art/cast';
import { StagePlayer, rigFor, type StageCast } from './StagePlayer';
import { validStory, type PropId, type PuppetRef, type StageScene, type Story } from '../../content/stage/stageModel';

registerPieces(STAGE_PIECES);

/** The first scene of a saved story, if it's valid (saved data is untrusted). */
export function posterScene(data: unknown): StageScene | null {
  if (!validStory(data)) return null;
  const sc = (data as Story).scenes[0];
  // thought bubbles would poke out of a small poster
  return { ...sc, actors: sc.actors.map((a) => ({ ...a, intent: undefined })) };
}

/** Only the art this poster needs (one backdrop, its props, its puppets). */
export function posterArtKeys(data: unknown, cast: StageCast): string[] {
  const sc = posterScene(data);
  if (!sc) return [];
  const keys = new Set<string>([`st.bg.${sc.backdrop}`]);
  for (const a of sc.actors) {
    if (a.kind === 'prop') {
      keys.add(`st.p.${a.ref as PropId}`);
      keys.add(`st.p.${a.ref as PropId}.on`);
    } else {
      for (const k of rigArtKeys(rigFor(a.ref as PuppetRef, cast))) keys.add(k);
      if (a.ref === 'me' && cast.me.hat) keys.add(cast.me.hat);
    }
  }
  // drop keys that don't exist (props without an "on" look)
  const known = new Set(STAGE_PIECES.map((p) => p.key));
  return [...keys].filter((k) => !k.startsWith('st.') || known.has(k));
}

/**
 * A story poster for the clubhouse wall: the opening scene in miniature, and
 * tapping it plays that scene (quietly — the puppets mouth their lines).
 */
export class StoryPoster {
  private player: StagePlayer;
  private scene0: StageScene;

  constructor(scene: Phaser.Scene, cx: number, cy: number, width: number, sc: StageScene, cast: StageCast) {
    const k = width / 1400;
    this.player = new StagePlayer(scene, cx - width / 2, cy - (720 * k) / 2, k, cast);
    this.player.speak = false;
    this.scene0 = sc;
    this.player.build(sc);
  }

  get container(): Phaser.GameObjects.Container {
    return this.player.c;
  }

  get playing(): boolean {
    return this.player.playing;
  }

  async play(): Promise<void> {
    if (this.player.playing) return;
    await this.player.play(this.scene0);
    this.player.build(this.scene0);
  }

  destroy(): void {
    this.player.destroy();
  }
}
