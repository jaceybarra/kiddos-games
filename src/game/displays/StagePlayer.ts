import Phaser from 'phaser';
import { addArt, makeImage, setPiece } from '../../art/rasterize';
import { CAST_RIGS, avatarRig, type CastId } from '../../art/cast';
import type { RigDef } from '../../art/cast/rig';
import { rigSvg } from '../../art/portrait';
import { Puppet, type PuppetAnim } from '../rig/Puppet';
import { sparkle } from '../systems/fx';
import { audio } from '../../core/audio';
import { motion } from '../../core/motion';
import { say } from '../../app/speech';
import { lineText } from '../../content/stage/stageLines';
import {
  PROP_TOGGLES,
  duration,
  schedule,
  type ActionId,
  type BackdropId,
  type PropId,
  type PuppetRef,
  type SfxId,
  type StageActor,
  type StageEvent,
  type StageScene,
} from '../../content/stage/stageModel';

export const PUPPET_SCALE = 0.95;
export const NEWT_RIG = (): RigDef => avatarRig('frog', 'plum');

export interface StageCast {
  /** the child's own avatar */
  me: { rig: RigDef; hat: string | null };
}

export interface ActorObj {
  actor: StageActor;
  obj: Puppet | Phaser.GameObjects.Image;
  thought?: Phaser.GameObjects.Container;
}

const ANIMS: Record<ActionId, PuppetAnim> = { wave: 'wave', jump: 'jump', dance: 'dance', bow: 'bow', think: 'think', cheer: 'cheer', hide: 'hide', sleep: 'sleep', point: 'point', shrug: 'shrug', stomp: 'stomp', clap: 'clap' };
const SFX_MAP: Record<SfxId, Parameters<typeof audio.play>[0]> = { drum: 'drum', boing: 'boing', whoosh: 'whoosh', splash: 'splash', sparkle: 'sparkle', pop: 'pop', bell: 'bell', creak: 'creak', chirp: 'chirp', croak: 'croak' };

export function rigFor(ref: PuppetRef, cast: StageCast): RigDef {
  if (ref === 'me') return cast.me.rig;
  if (ref === 'newt') return NEWT_RIG();
  return CAST_RIGS[ref as CastId];
}

/** Portrait for captions and drawers. */
export function puppetPortrait(ref: PuppetRef, cast: StageCast): string {
  return rigSvg(rigFor(ref, cast), { crop: 'head', hat: ref === 'me' ? cast.me.hat : null });
}

/**
 * Draws a stage scene (backdrop, puppets, props) inside a container and can
 * replay its recording. Used by the theatre editor and, in miniature, by the
 * clubhouse poster. Everything is in stage units (1400 × 720).
 */
export class StagePlayer {
  readonly c: Phaser.GameObjects.Container;
  readonly objs = new Map<string, ActorObj>();
  private bg?: Phaser.GameObjects.Image | Phaser.GameObjects.Container;
  private timers: Phaser.Time.TimerEvent[] = [];
  private token = 0;
  playing = false;
  /** speak lines out loud (captions + voice); the clubhouse poster stays quiet */
  speak = true;

  constructor(
    private scene: Phaser.Scene,
    x: number,
    y: number,
    scale: number,
    private cast: StageCast,
  ) {
    this.c = scene.add.container(x, y).setScale(scale);
  }

  build(sc: StageScene): void {
    this.stop();
    for (const o of this.objs.values()) this.destroyObj(o);
    this.objs.clear();
    this.setBackdrop(sc.backdrop);
    for (const a of sc.actors) this.addActor(a);
    this.resort();
  }

  setBackdrop(id: BackdropId): void {
    this.bg?.destroy();
    const bg = addArt(this.scene, 0, 0, `st.bg.${id}`);
    this.c.addAt(bg, 0);
    this.bg = bg;
  }

  addActor(a: StageActor): ActorObj {
    let obj: Puppet | Phaser.GameObjects.Image;
    if (a.kind === 'puppet') {
      const ref = a.ref as PuppetRef;
      const p = new Puppet(this.scene, a.x, a.y, rigFor(ref, this.cast), { seed: hash(a.id), hat: ref === 'me' ? this.cast.me.hat : null });
      p.setScale(PUPPET_SCALE).setFacing(a.facing);
      if (a.face) p.setExpression(a.face, true);
      obj = p;
    } else {
      const ref = a.ref as PropId;
      obj = makeImage(this.scene, a.x, a.y, a.on && PROP_TOGGLES.includes(ref) ? `st.p.${ref}.on` : `st.p.${ref}`).setScale(a.facing, 1);
    }
    this.c.add(obj);
    const ao: ActorObj = { actor: { ...a }, obj };
    this.objs.set(a.id, ao);
    this.setIntent(a.id, a.intent);
    this.resort();
    return ao;
  }

  removeActor(id: string): void {
    const o = this.objs.get(id);
    if (!o) return;
    this.destroyObj(o);
    this.objs.delete(id);
  }

  private destroyObj(o: ActorObj): void {
    this.scene.tweens.killTweensOf(o.obj);
    o.thought?.destroy();
    o.obj.destroy();
  }

  /** Show what a character wants as a little thought bubble (More exploring). */
  setIntent(id: string, intent: StageActor['intent']): void {
    const o = this.objs.get(id);
    if (!o) return;
    o.thought?.destroy();
    o.thought = undefined;
    o.actor.intent = intent;
    if (!intent || o.actor.kind !== 'puppet') return;
    const t = this.scene.add.container(0, 0);
    t.add(makeImage(this.scene, 0, 0, 'st.thought').setScale(0.8));
    t.add(makeImage(this.scene, 0, -8, `st.i.${intent}`));
    this.c.add(t);
    o.thought = t;
    this.placeThought(o);
  }

  private placeThought(o: ActorObj): void {
    if (!o.thought) return;
    const h = o.actor.kind === 'puppet' ? rigFor(o.actor.ref as PuppetRef, this.cast).height * PUPPET_SCALE : 120;
    o.thought.setPosition(o.obj.x + 70, o.obj.y - h - 50);
  }

  /** Move an actor; with `walk`, a puppet walks there with its gait. */
  move(id: string, x: number, y: number, ms = 0, walk = false): void {
    const o = this.objs.get(id);
    if (!o) return;
    o.actor.x = x;
    o.actor.y = y;
    this.scene.tweens.killTweensOf(o.obj);
    const p = o.obj instanceof Puppet ? o.obj : null;
    if (p && Math.abs(x - p.x) > 4) this.turn(id, x > p.x ? 1 : -1, false);
    if (ms <= 0 || motion.reduced) {
      o.obj.setPosition(x, y);
      this.placeThought(o);
      this.resort();
      return;
    }
    if (p && walk) p.startGait();
    this.scene.tweens.add({
      targets: o.obj,
      x,
      y,
      duration: ms,
      ease: walk ? 'Sine.easeInOut' : 'Linear',
      onUpdate: () => this.placeThought(o),
      onComplete: () => {
        if (p && walk) p.stopGait();
        this.resort();
      },
    });
  }

  turn(id: string, facing: 1 | -1, record = true): void {
    const o = this.objs.get(id);
    if (!o) return;
    o.actor.facing = facing;
    if (o.obj instanceof Puppet) o.obj.setFacing(facing);
    else o.obj.setScale(facing * Math.abs(o.obj.scaleX), o.obj.scaleY);
    void record;
  }

  face(id: string, face: NonNullable<StageActor['face']>): void {
    const o = this.objs.get(id);
    if (!o || !(o.obj instanceof Puppet)) return;
    o.actor.face = face;
    o.obj.setExpression(face);
  }

  /** A puppet action, or a prop doing its thing. */
  act(id: string, act: ActionId | 'use'): void {
    const o = this.objs.get(id);
    if (!o) return;
    if (o.obj instanceof Puppet) {
      if (act !== 'use') void o.obj.play(ANIMS[act]);
      if (act === 'jump') audio.play('boing', { pitch: 1.2 });
      return;
    }
    this.useProp(o);
  }

  private useProp(o: ActorObj): void {
    const img = o.obj as Phaser.GameObjects.Image;
    const ref = o.actor.ref as PropId;
    const s = this.scene;
    if (PROP_TOGGLES.includes(ref)) {
      o.actor.on = !o.actor.on;
      setPiece(img, o.actor.on ? `st.p.${ref}.on` : `st.p.${ref}`);
      const snd: Partial<Record<PropId, Parameters<typeof audio.play>[0]>> = { invitation: 'paper', cake: 'glow', chest: 'creak', umbrella: 'flap', lantern: 'glow', map: 'paper', telescope: 'stretch', flower: 'sparkle' };
      audio.play(snd[ref] ?? 'pop');
      if (!motion.reduced) s.tweens.add({ targets: img, scaleY: 1.12, duration: 120, yoyo: true });
      if (o.actor.on && (ref === 'chest' || ref === 'flower' || ref === 'cake')) this.sparkleAt(img.x, img.y - 100);
      return;
    }
    const base = { x: img.x, y: img.y };
    switch (ref) {
      case 'ball':
        audio.play('boing');
        if (!motion.reduced) s.tweens.add({ targets: img, y: base.y - 160, duration: 260, yoyo: true, repeat: 1, ease: 'Quad.easeOut' });
        break;
      case 'drum':
        [0, 0.22, 0.44].forEach((d) => audio.play('drum', { delay: d }));
        if (!motion.reduced) s.tweens.add({ targets: img, scaleY: 0.9, duration: 90, yoyo: true, repeat: 2 });
        break;
      case 'invention':
        audio.play('whirr');
        setPiece(img, 'st.p.invention.on');
        audio.play('puff', { delay: 0.5 });
        if (!motion.reduced) s.tweens.add({ targets: img, angle: { from: -4, to: 4 }, duration: 80, yoyo: true, repeat: 6, onComplete: () => img.setAngle(0) });
        s.time.delayedCall(1400, () => img.active && setPiece(img, 'st.p.invention'));
        break;
      case 'kite':
        audio.play('whoosh');
        if (!motion.reduced) s.tweens.add({ targets: img, y: base.y - 120, angle: 12, duration: 600, yoyo: true, ease: 'Sine.easeInOut' });
        break;
      case 'boat':
        audio.play('splash', { vol: 0.5 });
        if (!motion.reduced) s.tweens.add({ targets: img, angle: { from: -6, to: 6 }, duration: 300, yoyo: true, repeat: 2, onComplete: () => img.setAngle(0) });
        break;
      case 'crown':
        audio.play('sparkle');
        this.sparkleAt(img.x, img.y - 60);
        break;
      default:
        audio.play('pop');
    }
  }

  private sparkleAt(x: number, y: number): void {
    const m = this.c.getWorldTransformMatrix();
    sparkle(this.scene, m.tx + x * m.a, m.ty + y * m.d, 8, (this.c.depth ?? 0) + 50);
  }

  /** Say a curated line in the puppet's own voice. */
  sayLine(id: string, line: string): Promise<void> {
    const o = this.objs.get(id);
    const text = lineText(line);
    if (!o || !text) return Promise.resolve();
    if (!(o.obj instanceof Puppet)) return Promise.resolve();
    if (!this.speak) {
      o.obj.talk(1200);
      return Promise.resolve();
    }
    const ref = o.actor.ref as PuppetRef;
    if (ref === 'newt') return say('narrator', text, { puppet: o.obj, portrait: puppetPortrait('newt', this.cast), voice: { ...NEWT_RIG().voice, id: 'newt' } });
    return say(ref === 'me' ? 'avatar' : (ref as CastId), text, { puppet: o.obj });
  }

  sfx(id: SfxId): void {
    audio.play(SFX_MAP[id]);
  }

  /** Keep things that stand further forward in front. */
  resort(): void {
    const list = this.c.list as Phaser.GameObjects.GameObject[];
    const key = (g: Phaser.GameObjects.GameObject) => {
      if (g === this.bg) return -1e6;
      for (const o of this.objs.values()) if (o.thought === g) return o.obj.y + 1e5;
      return (g as unknown as { y: number }).y ?? 0;
    };
    list.sort((a, b) => key(a) - key(b));
  }

  /** World-space rectangle around an actor (for tap targets). */
  bounds(id: string): Phaser.Geom.Rectangle {
    const o = this.objs.get(id);
    if (!o) return new Phaser.Geom.Rectangle(0, 0, 0, 0);
    const m = this.c.getWorldTransformMatrix();
    const k = this.c.scaleX;
    const h = o.actor.kind === 'puppet' ? rigFor(o.actor.ref as PuppetRef, this.cast).height * PUPPET_SCALE : 150;
    const w = o.actor.kind === 'puppet' ? 150 : 170;
    return new Phaser.Geom.Rectangle(m.tx + (o.obj.x - w / 2) * k, m.ty + (o.obj.y - h) * k, w * k, h * k + 20 * k);
  }

  /** Replay a scene from its starting arrangement. Resolves when it has finished. */
  play(sc: StageScene): Promise<void> {
    this.build(sc);
    const my = ++this.token;
    this.playing = true;
    const evs = schedule(sc);
    // intentions show at the start, then float away
    for (const o of this.objs.values()) if (o.thought) this.timers.push(this.scene.time.delayedCall(2200, () => o.thought && this.scene.tweens.add({ targets: o.thought, alpha: 0, duration: 400 })));
    const lead = [...this.objs.values()].some((o) => o.thought) ? 900 : 300;
    evs.forEach((e, i) => {
      this.timers.push(this.scene.time.delayedCall(lead + e.t, () => my === this.token && this.perform(e, evs, i)));
    });
    const end = lead + duration(sc) + 1600;
    return new Promise((resolve) => {
      this.timers.push(
        this.scene.time.delayedCall(end, () => {
          if (my === this.token) this.playing = false;
          resolve();
        }),
      );
      // a stop() resolves too
      this.stopResolve = resolve;
    });
  }

  private stopResolve: (() => void) | null = null;

  private perform(e: StageEvent, all: StageEvent[], i: number): void {
    switch (e.a) {
      case 'move': {
        const o = this.objs.get(e.id);
        if (!o) return;
        const next = all.slice(i + 1).find((x) => x.a === 'move' && x.id === e.id);
        const dist = Math.hypot(e.x - o.obj.x, e.y - o.obj.y);
        const gap = next ? next.t - e.t : Infinity;
        const walk = dist > 120 && gap > 300;
        this.move(e.id, e.x, e.y, walk ? Math.min(2000, Math.max(300, dist * 2.2)) : Math.min(300, gap), walk);
        break;
      }
      case 'act':
        this.act(e.id, e.act);
        break;
      case 'say':
        void this.sayLine(e.id, e.line);
        break;
      case 'face':
        this.face(e.id, e.face);
        break;
      case 'turn':
        this.turn(e.id, e.facing);
        break;
      case 'sfx':
        this.sfx(e.sfx);
        break;
    }
  }

  stop(): void {
    this.token++;
    for (const t of this.timers) t.remove();
    this.timers = [];
    this.playing = false;
    const r = this.stopResolve;
    this.stopResolve = null;
    r?.();
  }

  destroy(): void {
    this.stop();
    this.c.destroy();
    this.objs.clear();
  }
}

function hash(s: string): number {
  let h = 7;
  for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h;
}
