import Phaser from 'phaser';
import { WWScene, type Target } from '../../WWScene';
import { Puppet } from '../../rig/Puppet';
import { Walker } from '../../systems/Walker';
import { GhostHand } from '../../systems/GhostHand';
import { Hints } from '../../systems/Hints';
import { sparkle } from '../../systems/fx';
import { addArt, addImage, makeImage } from '../../../art/rasterize';
import { CAST_RIGS, avatarRig, rigArtKeys, type CastId } from '../../../art/cast';
import { HATS } from '../../../art/cast/hats';
import { hex } from '../../../art/palette';
import { TRAIL_W, trailGroundY } from '../../../art/scenes/trailAdventures';
import type { Line } from '../../../content/lineTypes';
import { services, currentProfile, currentPreset, updateProfile } from '../../../app/services';
import { say, instruct, stopSpeech } from '../../../app/speech';
import { audio, type Theme } from '../../../core/audio';
import { motion } from '../../../core/motion';
import type { ChoiceOption } from '../../../ui/choices';
import type { Flag, PresetId, QuestState } from '../../../save/schema';

export const groundY = trailGroundY;

/**
 * Shared machinery for Lantern Trail adventures 2–4: a side-scrolling place
 * to walk around, friends to talk to, carrying things, saving progress at
 * checkpoints, and a calm ending with a souvenir for the clubhouse.
 */
export abstract class TrailScene extends WWScene {
  protected override worldWidth = TRAIL_W;
  protected preset: PresetId = 'more-help';
  protected avatar!: Puppet;
  protected walker!: Walker;
  protected hand!: GhostHand;
  protected hints!: Hints;
  protected friends = new Map<CastId, Puppet>();
  protected busy = false;
  protected carrying: { kind: string; img: Phaser.GameObjects.Image } | null = null;
  /** what the camera should look at instead of the avatar (e.g. a friend crossing) */
  protected camFocus: (() => number) | null = null;
  private camX = 0;
  /** keyboard users: Tab to something off screen and the camera looks at it until the avatar moves */
  private kbFocusX: number | null = null;
  private sky!: Phaser.GameObjects.Graphics;

  abstract readonly questId: string;
  abstract readonly gameTheme: Theme;
  protected abstract readonly skyColors: [string, string];
  protected abstract readonly walkRange: [number, number];
  /** add backdrop layers, props and friends */
  protected abstract buildWorld(): void;
  /** resume from a saved checkpoint (or start fresh) */
  protected abstract startAt(checkpoint: string): void;
  protected abstract demo(): void;
  protected abstract extraArtKeys(): string[];

  artKeys(): string[] {
    const keys = new Set<string>(this.extraArtKeys());
    for (const id of ['pip', 'moss', 'fizz', 'luma', 'rowan'] as CastId[]) for (const k of rigArtKeys(CAST_RIGS[id])) keys.add(k);
    const prof = currentProfile();
    for (const k of rigArtKeys(avatarRig(prof.avatar.species, prof.avatar.color))) keys.add(k);
    for (const h of HATS) keys.add(h.id);
    return [...keys];
  }

  build(): void {
    this.preset = currentPreset('trail');
    this.sky = this.add.graphics().setScrollFactor(0).setDepth(-10);
    this.buildWorld();
    const prof = currentProfile();
    const start = this.walkRange[0] + 160;
    this.avatar = new Puppet(this, start, groundY(start), avatarRig(prof.avatar.species, prof.avatar.color), { hat: prof.avatar.hat, seed: 7 });
    this.avatar.setDepth(50);
    this.walker = new Walker(this.avatar, { groundY, minX: this.walkRange[0], maxX: this.walkRange[1] });
    this.camX = this.avatar.x;
    this.hand = new GhostHand(this);
    this.hints = new Hints(this, this.preset, () => this.demo());
    audio.startMusic(this.gameTheme);
    services.hud.show(['home', 'finish', 'pause', 'replay', 'help']);
    this.onCleanup(() => {
      services.choices.cancel();
      stopSpeech();
    });
    const q = this.quest();
    updateProfile((p) => (p.progress.location = { scene: this.scene.key }));
    this.startAt(q?.status === 'done' ? 'done' : q?.checkpoint ?? 'intro');
  }

  protected override layoutCamera(): void {
    const cam = this.cameras.main;
    cam.setSize(this.view.w, this.view.h);
    cam.setBounds(0, -this.view.oy, TRAIL_W, this.view.h);
    cam.scrollY = -this.view.oy;
  }

  protected override layout(): void {
    const [top, low] = this.skyColors;
    this.sky.clear().fillGradientStyle(hex(top), hex(top), hex(low), hex(low), 1, 1, 1, 1).fillRect(0, 0, this.view.w, this.view.h);
  }

  protected override tick(_t: number, rawDelta: number): void {
    const delta = Math.min(rawDelta, 200);
    this.walker.update(delta);
    const cam = this.cameras.main;
    if (this.kbFocusX !== null && this.walker.moving) this.kbFocusX = null;
    const target = this.camFocus ? this.camFocus() : this.kbFocusX ?? this.avatar.x + this.avatar.facing * 160;
    const k = motion.reduced ? 1 : Math.min(1, (delta / 1000) * 2.4);
    this.camX = Phaser.Math.Linear(this.camX || target, target, k);
    cam.scrollX = Phaser.Math.Clamp(this.camX - this.view.w / 2, 0, TRAIL_W - this.view.w);
    cam.scrollY = -this.view.oy;
    this.onTick(delta);
  }

  protected onTick(_delta: number): void {}

  protected override onFocusTarget(t: Target): void {
    this.kbFocusX = t.bounds().centerX;
  }

  protected override onGroundTap(x: number): void {
    this.hints.poke();
    if (this.busy) return;
    this.walker.walkTo(x);
  }

  protected override onArrow(dx: number, _dy: number, down: boolean): void {
    // letting go of a key always stops walking, even mid-conversation
    if (!down) return this.walker.setHeld(0);
    if (this.busy) return;
    this.walker.setHeld(dx);
  }

  /** Walk next to x, then do something. */
  protected goDo(x: number, fn: () => void, exact = false): void {
    if (this.busy) return;
    this.hints.poke();
    const target = exact ? x : x + (this.avatar.x < x ? -140 : 140);
    this.walker.walkTo(target, () => {
      this.avatar.faceToward(x);
      fn();
    });
  }

  // ---------------------------------------------------------------- world helpers

  protected art(x: number, y: number, key: string, depth: number): Phaser.GameObjects.Image | Phaser.GameObjects.Container {
    return addArt(this, x, y, key).setDepth(depth);
  }

  protected img(x: number, y: number, key: string, depth: number): Phaser.GameObjects.Image {
    return addImage(this, x, y, key).setDepth(depth);
  }

  protected friend(id: CastId, x: number, facing: 1 | -1 = -1): Puppet {
    const p = new Puppet(this, x, groundY(x), CAST_RIGS[id], { seed: id.length * 13 + x });
    p.setDepth(48).setFacing(facing);
    this.friends.set(id, p);
    return p;
  }

  /** A thought bubble above a friend showing what they need (a picture, not words). */
  protected needBubble(id: CastId, art: string): Phaser.GameObjects.Container {
    const p = this.friends.get(id)!;
    const c = this.add.container(p.x, p.y - CAST_RIGS[id].height - 70).setDepth(70);
    c.add(makeImage(this, 0, 0, 'tr.bubble'));
    c.add(makeImage(this, 0, -12, art));
    return c;
  }

  protected walkFriend(id: CastId, x: number, speed = 2.6): Promise<void> {
    const p = this.friends.get(id);
    if (!p) return Promise.resolve();
    return this.walkPuppet(p, x, groundY(x), speed);
  }

  protected walkPuppet(p: Puppet, x: number, y: number, speed = 2.6): Promise<void> {
    return new Promise((resolve) => {
      const dist = Math.abs(x - p.x) + Math.abs(y - p.y);
      if (dist < 6) return resolve();
      p.faceToward(x);
      p.startGait();
      this.tweens.add({
        targets: p,
        x,
        y,
        duration: motion.reduced ? 250 : Math.max(300, dist * speed),
        ease: 'Sine.easeInOut',
        onComplete: () => {
          p.stopGait();
          resolve();
        },
      });
    });
  }

  // ---------------------------------------------------------------- talking

  protected line(l: Line, opts: { instruct?: boolean } = {}): Promise<void> {
    const puppet = l.speaker === 'avatar' ? this.avatar : l.speaker === 'narrator' ? undefined : this.friends.get(l.speaker as CastId);
    if (puppet && l.mood) puppet.setExpression(l.mood);
    return opts.instruct ? instruct(l.speaker, l.text, () => this.demo(), { puppet }) : say(l.speaker, l.text, { puppet });
  }

  protected ask(options: ChoiceOption[]): Promise<string | null> {
    return services.choices.ask(options, { readAloud: true });
  }

  // ---------------------------------------------------------------- carrying

  /** Pick something up (the thing on the ground, if any, disappears into the avatar's hands). */
  protected pickUp(kind: string, artKey: string, from?: Phaser.GameObjects.Image): void {
    this.drop(false);
    const img = makeImage(this, 0, 0, artKey).setScale(0.6);
    this.avatar.hold(img);
    this.carrying = { kind, img };
    audio.play('pickup');
    from?.setVisible(false);
  }

  protected drop(destroy = true): void {
    if (!this.carrying) return;
    this.avatar.hold(null);
    if (destroy) this.carrying.img.destroy();
    this.carrying = null;
  }

  // ---------------------------------------------------------------- progress

  protected quest(): QuestState | undefined {
    return currentProfile().progress.quests[this.questId];
  }

  protected saveQuest(checkpoint: string, flags: Record<string, Flag>): void {
    updateProfile((p) => {
      const prev = p.progress.quests[this.questId];
      p.progress.quests[this.questId] = {
        status: checkpoint === 'done' ? 'done' : 'active',
        checkpoint,
        flags,
        completions: prev?.completions ?? 0,
        firstDoneAt: prev?.firstDoneAt,
      };
    });
  }

  protected readJSON<T>(key: string, valid: (x: unknown) => x is T, fallback: T): T {
    const raw = this.quest()?.flags[key];
    if (typeof raw !== 'string') return fallback;
    try {
      const v = JSON.parse(raw) as unknown;
      return valid(v) ? v : fallback;
    } catch {
      return fallback;
    }
  }

  /** Finish: souvenir, notes for grown-ups, the next place opens, and a calm choice of what to do next. */
  protected async complete(souvenir: { id: string; data: Record<string, Flag> }, log: string, label: string, flags: Record<string, Flag>): Promise<void> {
    const firstTime = this.quest()?.status !== 'done';
    updateProfile((p) => {
      const prev = p.progress.quests[this.questId];
      p.progress.quests[this.questId] = {
        status: 'done',
        checkpoint: 'done',
        flags,
        completions: (prev?.completions ?? 0) + 1,
        firstDoneAt: prev?.firstDoneAt ?? Date.now(),
      };
      // one souvenir per adventure: replays update it rather than piling up
      p.progress.souvenirs[souvenir.id] = { id: souvenir.id, at: Date.now(), data: souvenir.data };
    });
    if (firstTime) {
      services.save.log(services.profileId!, 'trail', log);
      services.session.made.push({ kind: 'souvenir', label });
    }
    sparkle(this, this.avatar.x, this.avatar.y - 200, 14, 90);
    audio.play('success');
  }

  protected async endChoices(): Promise<void> {
    const pick = await this.ask([
      { id: 'stay', icon: 'explore', label: 'Look around' },
      { id: 'map', icon: 'map', label: 'Back to the map' },
    ]);
    if (pick === 'map') services.nav.openMap();
  }

  protected wait(ms: number): Promise<void> {
    return new Promise((r) => this.time.delayedCall(ms, r));
  }

  protected alive(): boolean {
    return this.sys.isActive() || this.sys.isPaused();
  }

  override hint(): void {
    this.hints.request();
  }
}
