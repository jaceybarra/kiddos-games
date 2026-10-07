import Phaser from 'phaser';
import { EXPRESSION_SPECS, type Expression, type MouthShape, eyeKey, mouthKey } from '../../art/cast/face';
import type { RigDef } from '../../art/cast/rig';
import { makeImage, setPiece } from '../../art/rasterize';
import { mulberry32 } from '../../core/rng';
import { motion } from '../../core/motion';

export type PuppetAnim =
  | 'wave'
  | 'cheer'
  | 'hop'
  | 'oops'
  | 'think'
  | 'nod'
  | 'shake'
  | 'point'
  | 'bow'
  | 'jump'
  | 'dance'
  | 'sit'
  | 'sleep'
  | 'shrug'
  | 'clap'
  | 'stomp'
  | 'hide'
  | 'pump'
  | 'pull'
  | 'throw'
  | 'reach';

export type EmoteKind = 'speak' | 'think' | 'question' | 'heart' | 'zzz' | 'sparkle' | 'wave' | 'wait';

interface PartNode {
  id: string;
  c: Phaser.GameObjects.Container;
  img?: Phaser.GameObjects.Image;
  rest: { x: number; y: number; rotation: number; scaleX: number; scaleY: number };
}

export interface PuppetOptions {
  seed?: number;
  hat?: string | null;
  scale?: number;
  idle?: boolean;
  shadow?: boolean;
}

/**
 * A cut-out puppet built from a RigDef. Movement in the world (x/y) belongs to
 * whoever owns the puppet; the puppet animates its own parts, face, and gait.
 */
export class Puppet extends Phaser.GameObjects.Container {
  readonly rig: RigDef;
  /** container holding all parts; bob/flip happen here so the shadow stays put */
  readonly inner: Phaser.GameObjects.Container;
  readonly parts = new Map<string, PartNode>();
  private shadowImg?: Phaser.GameObjects.Image;
  private eyes: Phaser.GameObjects.Image[] = [];
  private eyeRest: [number, number][] = [];
  private brows: Phaser.GameObjects.Image[] = [];
  private mouth!: Phaser.GameObjects.Image;
  private blush: Phaser.GameObjects.Image[] = [];
  private hatImg?: Phaser.GameObjects.Image;
  private emoteImg?: Phaser.GameObjects.Image;
  private emoteTimer?: Phaser.Time.TimerEvent;
  private carried?: Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Transform;
  private rng: () => number;
  private idleTweens: Phaser.Tweens.Tween[] = [];
  private animTweens: (Phaser.Tweens.Tween | Phaser.Tweens.TweenChain)[] = [];
  private gaitTweens: Phaser.Tweens.Tween[] = [];
  private blinkTimer?: Phaser.Time.TimerEvent;
  private talkTimer?: Phaser.Time.TimerEvent;
  private animToken = 0;
  private baseScale: number;
  expression: Expression = 'happy';
  facing: 1 | -1 = 1;
  gaitOn = false;
  private look: [number, number] = [0, 0];

  constructor(scene: Phaser.Scene, x: number, y: number, rig: RigDef, opts: PuppetOptions = {}) {
    super(scene, x, y);
    this.rig = rig;
    this.rng = mulberry32(opts.seed ?? hashString(rig.id));
    this.baseScale = opts.scale ?? 1;
    if (opts.shadow !== false) {
      this.shadowImg = makeImage(scene, 0, 0, 'fx.shadow');
      this.shadowImg.setScale((rig.width / 100) * 1.05, 1);
      this.add(this.shadowImg);
    }
    this.inner = scene.make.container({ x: 0, y: 0 }, false);
    this.add(this.inner);
    this.build();
    this.setScale(this.baseScale);
    this.setExpression('happy', true);
    if (opts.hat) this.setHat(opts.hat);
    scene.add.existing(this);
    if (opts.idle !== false) this.startIdle();
    this.once(Phaser.GameObjects.Events.DESTROY, () => this.stopAll());
  }

  // ---------------------------------------------------------------- build

  private build(): void {
    const byParent = new Map<string | null, RigDef['parts']>();
    for (const p of this.rig.parts) {
      const list = byParent.get(p.parent) ?? [];
      list.push(p);
      byParent.set(p.parent, list);
    }
    const faceZ = this.rig.face.z ?? 5;
    const make = (parentId: string | null, into: Phaser.GameObjects.Container, ownImg?: Phaser.GameObjects.Image) => {
      const kids = [...(byParent.get(parentId) ?? [])];
      type Entry = { z: number; obj: Phaser.GameObjects.GameObject };
      const entries: Entry[] = [];
      if (ownImg) entries.push({ z: 0, obj: ownImg });
      if (parentId === this.rig.face.head) entries.push({ z: faceZ, obj: this.buildFace() });
      for (const k of kids) {
        const c = this.scene.make.container({ x: k.x, y: k.y }, false);
        c.rotation = Phaser.Math.DegToRad(k.rot ?? 0);
        let img: Phaser.GameObjects.Image | undefined;
        if (k.art) {
          img = makeImage(this.scene, 0, 0, k.art);
          if (k.sx) img.scaleX = k.sx;
        }
        const node: PartNode = {
          id: k.id,
          c,
          img,
          rest: { x: c.x, y: c.y, rotation: c.rotation, scaleX: 1, scaleY: 1 },
        };
        this.parts.set(k.id, node);
        make(k.id, c, img);
        entries.push({ z: k.z, obj: c });
      }
      entries.sort((a, b) => a.z - b.z);
      for (const e of entries) into.add(e.obj);
    };
    make(null, this.inner);
  }

  private buildFace(): Phaser.GameObjects.Container {
    const f = this.rig.face;
    const c = this.scene.make.container({ x: 0, y: 0 }, false);
    for (const [bx, by] of f.blush) {
      const b = makeImage(this.scene, bx, by, 'face.blush');
      b.alpha = 0;
      this.blush.push(b);
      c.add(b);
    }
    for (const [ex, ey] of f.eyes) {
      const e = makeImage(this.scene, ex, ey, eyeKey('open')).setScale(f.eyeScale);
      this.eyes.push(e);
      this.eyeRest.push([ex, ey]);
      c.add(e);
    }
    f.brows.forEach(([bx, by]) => {
      const b = makeImage(this.scene, bx, by, 'face.brow').setScale(f.eyeScale);
      this.brows.push(b);
      c.add(b);
    });
    this.mouth = makeImage(this.scene, f.mouth[0], f.mouth[1], mouthKey('smile'));
    c.add(this.mouth);
    return c;
  }

  part(id: string): Phaser.GameObjects.Container | undefined {
    return this.parts.get(id)?.c;
  }

  // ---------------------------------------------------------------- face

  setExpression(e: Expression, instant = false): this {
    this.expression = e;
    const s = EXPRESSION_SPECS[e];
    for (const eye of this.eyes) setPiece(eye, eyeKey(s.eye));
    this.setMouth(s.mouth);
    const f = this.rig.face;
    this.brows.forEach((b, i) => {
      const [bx, by] = f.brows[i];
      const sign = i === 0 ? -1 : 1;
      const targetAngle = sign * s.browTilt;
      if (instant || motion.reduced) {
        b.angle = targetAngle;
        b.y = by + s.browY;
        b.x = bx;
      } else {
        this.scene.tweens.add({ targets: b, angle: targetAngle, y: by + s.browY, duration: 140, ease: 'Quad.easeOut' });
      }
    });
    for (const b of this.blush) {
      if (instant) b.alpha = s.blush;
      else this.scene.tweens.add({ targets: b, alpha: s.blush, duration: 220 });
    }
    this.applyLook(s.look ?? this.look, instant);
    return this;
  }

  setMouth(m: MouthShape): void {
    setPiece(this.mouth, mouthKey(m));
  }

  /** Look direction in roughly -1..1 units (x is in the puppet's facing frame). */
  lookAt(dx: number, dy: number): this {
    this.look = [Phaser.Math.Clamp(dx, -1, 1), Phaser.Math.Clamp(dy, -1, 1)];
    this.applyLook(EXPRESSION_SPECS[this.expression].look ?? this.look);
    return this;
  }

  /** Look toward a world point. */
  lookAtWorld(wx: number, wy: number): this {
    const dx = (wx - this.x) * this.facing;
    const dy = wy - (this.y - this.rig.height * 0.7 * this.scaleY);
    const len = Math.hypot(dx, dy) || 1;
    return this.lookAt(dx / len, dy / len);
  }

  private applyLook([lx, ly]: [number, number], instant = false): void {
    const r = 4.5 * this.rig.face.eyeScale;
    this.eyes.forEach((eye, i) => {
      const [ex, ey] = this.eyeRest[i];
      const tx = ex + lx * r;
      const ty = ey + ly * r;
      if (instant || motion.reduced) {
        eye.x = tx;
        eye.y = ty;
      } else this.scene.tweens.add({ targets: eye, x: tx, y: ty, duration: 150, ease: 'Quad.easeOut' });
    });
  }

  blink(): void {
    if (EXPRESSION_SPECS[this.expression].eye !== 'open' && EXPRESSION_SPECS[this.expression].eye !== 'wide') return;
    const sy = this.rig.face.eyeScale;
    this.scene.tweens.add({
      targets: this.eyes,
      scaleY: 0.12 * sy,
      duration: 70,
      yoyo: true,
      ease: 'Quad.easeIn',
      onComplete: () => this.eyes.forEach((e) => (e.scaleY = sy)),
    });
  }

  /** Mouth flaps for the given duration (pairs with babble/narration). */
  talk(ms: number): void {
    this.talkTimer?.remove();
    const base = EXPRESSION_SPECS[this.expression].mouth;
    const open: MouthShape = base === 'frown' || base === 'wobble' ? 'o' : 'grin';
    let flip = false;
    const end = this.scene.time.now + ms;
    this.talkTimer = this.scene.time.addEvent({
      delay: 105,
      loop: true,
      callback: () => {
        if (this.scene.time.now >= end) {
          this.setMouth(EXPRESSION_SPECS[this.expression].mouth);
          this.talkTimer?.remove();
          this.talkTimer = undefined;
          return;
        }
        flip = !flip;
        this.setMouth(flip ? open : EXPRESSION_SPECS[this.expression].mouth);
      },
    });
  }

  stopTalking(): void {
    this.talkTimer?.remove();
    this.talkTimer = undefined;
    this.setMouth(EXPRESSION_SPECS[this.expression].mouth);
  }

  // ---------------------------------------------------------------- facing / props

  setFacing(dir: 1 | -1): this {
    if (dir === this.facing) return this;
    this.facing = dir;
    if (motion.reduced) {
      this.inner.scaleX = dir;
    } else {
      this.scene.tweens.add({ targets: this.inner, scaleX: dir, duration: 160, ease: 'Quad.easeInOut' });
    }
    return this;
  }

  faceToward(wx: number): this {
    if (Math.abs(wx - this.x) > 6) this.setFacing(wx > this.x ? 1 : -1);
    return this;
  }

  setHat(key: string | null): this {
    this.hatImg?.destroy();
    this.hatImg = undefined;
    const a = this.rig.anchors.hat;
    if (!key || !a) return this;
    const host = this.part(a.part);
    if (!host) return this;
    this.hatImg = makeImage(this.scene, a.x, a.y, key).setScale(a.scale ?? 1);
    host.add(this.hatImg);
    return this;
  }

  /** Attach a display object to the hand anchor (it moves with the arm). */
  hold(obj: (Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Transform) | null): void {
    if (this.carried) {
      const c = this.carried;
      this.carried = undefined;
      const hand = this.part(this.rig.anchors.hand.part);
      hand?.remove(c);
    }
    if (!obj) return;
    const a = this.rig.anchors.hand;
    const hand = this.part(a.part);
    if (!hand) return;
    obj.setPosition(a.x, a.y);
    hand.add(obj);
    this.carried = obj;
  }

  get holding(): boolean {
    return !!this.carried;
  }

  /** World position of the hand anchor. */
  handWorld(): Phaser.Math.Vector2 {
    const a = this.rig.anchors.hand;
    const hand = this.part(a.part);
    const out = new Phaser.Math.Vector2();
    if (!hand) return out.set(this.x, this.y - this.rig.height / 2);
    const m = hand.getWorldTransformMatrix();
    m.transformPoint(a.x, a.y, out);
    return out;
  }

  /** Top-of-head world point for emotes/bubbles. */
  emoteWorld(): Phaser.Math.Vector2 {
    const [ex, ey] = this.rig.anchors.emote;
    return new Phaser.Math.Vector2(this.x + ex * this.facing * this.scaleX, this.y + ey * this.scaleY);
  }

  emote(kind: EmoteKind, ms = 1800): void {
    this.emoteTimer?.remove();
    this.emoteImg?.destroy();
    const [ex, ey] = this.rig.anchors.emote;
    const img = makeImage(this.scene, ex * this.facing, ey, `emote.${kind}`);
    img.setScale(0.2);
    this.add(img);
    this.emoteImg = img;
    this.scene.tweens.add({ targets: img, scale: 1.25, duration: motion.reduced ? 1 : 260, ease: 'Back.easeOut' });
    if (!motion.reduced && kind !== 'wait') {
      this.scene.tweens.add({ targets: img, y: ey - 8, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
    if (ms > 0) {
      this.emoteTimer = this.scene.time.delayedCall(ms, () => this.clearEmote());
    }
  }

  clearEmote(): void {
    this.emoteTimer?.remove();
    const img = this.emoteImg;
    this.emoteImg = undefined;
    if (!img) return;
    this.scene.tweens.killTweensOf(img);
    this.scene.tweens.add({ targets: img, scale: 0, alpha: 0, duration: 160, onComplete: () => img.destroy() });
  }

  // ---------------------------------------------------------------- idle / gait

  startIdle(): void {
    this.stopIdle();
    const body = this.part('body');
    const amp = motion.reduced ? 0.4 : 1;
    if (body) {
      this.idleTweens.push(
        this.scene.tweens.add({
          targets: body,
          scaleY: 1 + 0.028 * amp,
          scaleX: 1 - 0.012 * amp,
          duration: 1100 + this.rng() * 500,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        }),
      );
    }
    const head = this.parts.get('head');
    if (head && !motion.reduced) {
      this.idleTweens.push(
        this.scene.tweens.add({
          targets: head.c,
          rotation: head.rest.rotation + 0.035,
          duration: 1700 + this.rng() * 600,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
          delay: this.rng() * 400,
        }),
      );
    }
    const tail = this.rig.limbs.tail && this.parts.get(this.rig.limbs.tail);
    if (tail) {
      this.idleTweens.push(
        this.scene.tweens.add({
          targets: tail.c,
          rotation: tail.rest.rotation + 0.09 * amp,
          duration: 900 + this.rng() * 300,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        }),
      );
    }
    for (const w of this.rig.limbs.wings ?? []) {
      const n = this.parts.get(w);
      if (!n) continue;
      this.idleTweens.push(
        this.scene.tweens.add({
          targets: n.c,
          scaleX: 0.86,
          duration: 380 + this.rng() * 80,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        }),
      );
    }
    for (const a of this.rig.limbs.antennae ?? []) {
      const n = this.parts.get(a);
      if (!n || motion.reduced) continue;
      this.idleTweens.push(
        this.scene.tweens.add({ targets: n.c, rotation: n.rest.rotation + 0.12, duration: 1300, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' }),
      );
    }
    if (this.rig.gait === 'float' && !motion.reduced) {
      this.idleTweens.push(
        this.scene.tweens.add({ targets: this.inner, y: -10, duration: 1300, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' }),
      );
    }
    this.scheduleBlink();
    this.scheduleEarTwitch();
  }

  private scheduleBlink(): void {
    this.blinkTimer?.remove();
    this.blinkTimer = this.scene.time.delayedCall(2400 + this.rng() * 2800, () => {
      this.blink();
      this.scheduleBlink();
    });
  }

  private scheduleEarTwitch(): void {
    const ears = this.rig.limbs.ears ?? [];
    if (!ears.length || motion.reduced) return;
    this.scene.time.delayedCall(3000 + this.rng() * 5000, () => {
      if (!this.active) return;
      const n = this.parts.get(ears[Math.floor(this.rng() * ears.length)]);
      if (n) this.scene.tweens.add({ targets: n.c, rotation: n.rest.rotation - 0.25, duration: 90, yoyo: true, repeat: 1 });
      this.scheduleEarTwitch();
    });
  }

  stopIdle(): void {
    for (const t of this.idleTweens) safeRemove(t);
    this.idleTweens = [];
    this.blinkTimer?.remove();
  }

  /** Locomotion cycle while the owner moves the puppet. */
  startGait(speed = 1): void {
    if (this.gaitOn) return;
    this.gaitOn = true;
    const reduced = motion.reduced;
    const g = this.rig.gait;
    const ff = this.rig.limbs.footFront && this.parts.get(this.rig.limbs.footFront);
    const fb = this.rig.limbs.footBack && this.parts.get(this.rig.limbs.footBack);
    const af = this.rig.limbs.armFront && this.parts.get(this.rig.limbs.armFront);
    const ab = this.rig.limbs.armBack && this.parts.get(this.rig.limbs.armBack);
    const body = this.parts.get('body');
    const step = 150 / speed;
    if (g === 'hop') {
      this.gaitTweens.push(
        this.scene.tweens.add({ targets: this.inner, y: reduced ? -6 : -20, duration: step, yoyo: true, repeat: -1, ease: 'Quad.easeOut' }),
      );
      if (body)
        this.gaitTweens.push(
          this.scene.tweens.add({ targets: body.c, rotation: 0.08, duration: step, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' }),
        );
    } else if (g === 'waddle') {
      this.gaitTweens.push(
        this.scene.tweens.add({ targets: this.inner, rotation: { from: -0.06, to: 0.06 }, duration: step * 1.5, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' }),
        this.scene.tweens.add({ targets: this.inner, y: -5, duration: step * 0.75, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' }),
      );
    } else if (g === 'float') {
      this.gaitTweens.push(
        this.scene.tweens.add({ targets: this.inner, rotation: 0.08, duration: 300, ease: 'Sine.easeOut' }),
      );
    } else {
      this.gaitTweens.push(
        this.scene.tweens.add({ targets: this.inner, y: reduced ? -3 : -9, duration: step, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' }),
      );
    }
    if (ff && fb && g !== 'float') {
      this.gaitTweens.push(
        this.scene.tweens.add({ targets: ff.c, y: ff.rest.y - 7, rotation: -0.2, duration: step, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' }),
        this.scene.tweens.add({ targets: fb.c, y: fb.rest.y - 7, rotation: 0.2, duration: step, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: step }),
      );
    }
    if (af && ab && !this.carried) {
      this.gaitTweens.push(
        this.scene.tweens.add({ targets: af.c, rotation: af.rest.rotation + 0.35, duration: step * 2, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' }),
        this.scene.tweens.add({ targets: ab.c, rotation: ab.rest.rotation - 0.35, duration: step * 2, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' }),
      );
    }
  }

  stopGait(): void {
    if (!this.gaitOn) return;
    this.gaitOn = false;
    for (const t of this.gaitTweens) safeRemove(t);
    this.gaitTweens = [];
    this.scene.tweens.add({ targets: this.inner, y: 0, rotation: 0, duration: 120 });
    this.resetPose(120, ['body', 'head']);
    if (this.carried) this.carryPose();
  }

  /** Arms up holding something. */
  carryPose(): void {
    const af = this.rig.limbs.armFront && this.parts.get(this.rig.limbs.armFront);
    const ab = this.rig.limbs.armBack && this.parts.get(this.rig.limbs.armBack);
    const t = (n: PartNode | undefined | '', r: number) =>
      n && this.scene.tweens.add({ targets: n.c, rotation: r, duration: 140, ease: 'Quad.easeOut' });
    t(af, -2.6);
    t(ab, 2.6);
  }

  resetPose(ms = 160, skip: string[] = []): void {
    for (const [id, n] of this.parts) {
      if (skip.includes(id)) continue;
      this.scene.tweens.killTweensOf(n.c);
      if (ms <= 0) {
        n.c.setPosition(n.rest.x, n.rest.y).setRotation(n.rest.rotation).setScale(n.rest.scaleX, n.rest.scaleY);
      } else {
        this.scene.tweens.add({
          targets: n.c,
          x: n.rest.x,
          y: n.rest.y,
          rotation: n.rest.rotation,
          scaleX: n.rest.scaleX,
          scaleY: n.rest.scaleY,
          duration: ms,
          ease: 'Quad.easeOut',
        });
      }
    }
  }

  // ---------------------------------------------------------------- one-shot animations

  /** Play an expressive animation; resolves when it finishes. */
  play(anim: PuppetAnim, opts: { expression?: Expression; dir?: number } = {}): Promise<void> {
    const token = ++this.animToken;
    for (const t of this.animTweens) safeRemove(t);
    this.animTweens = [];
    if (opts.expression) this.setExpression(opts.expression);
    const wasIdle = this.idleTweens.length > 0;
    this.stopIdle();
    this.resetPose(80);
    return new Promise<void>((resolve) => {
      const done = () => {
        if (token !== this.animToken || !this.active) return resolve();
        this.resetPose(180);
        this.scene.tweens.add({ targets: this.inner, y: 0, scaleY: 1, rotation: 0, duration: 160 });
        this.scene.tweens.add({ targets: this.inner, scaleX: this.facing, duration: 160 });
        if (wasIdle) this.scene.time.delayedCall(200, () => token === this.animToken && this.active && this.startIdle());
        if (this.carried) this.carryPose();
        resolve();
      };
      const seq = this.sequence(anim, opts.dir ?? 0);
      if (!seq.length) return done();
      const chain = this.scene.tweens.chain({ tweens: seq, onComplete: done });
      this.animTweens.push(chain);
    });
  }

  private sequence(anim: PuppetAnim, dir: number): Phaser.Types.Tweens.TweenBuilderConfig[] {
    const R = motion.reduced ? 0.45 : 1;
    const af = this.part(this.rig.limbs.armFront ?? '') ?? this.inner;
    const ab = this.part(this.rig.limbs.armBack ?? '') ?? this.inner;
    const head = this.part('head') ?? this.inner;
    const body = this.part('body') ?? this.inner;
    const inner = this.inner;
    const f = this.facing;
    const sq = (ms = 100) => ({ targets: inner, scaleY: 1 - 0.14 * R, scaleX: f * (1 + 0.08 * R), duration: ms, ease: 'Quad.easeOut' });
    const unsq = (ms = 140) => ({ targets: inner, scaleY: 1, scaleX: f, duration: ms, ease: 'Back.easeOut' });
    switch (anim) {
      case 'wave':
        return [
          { targets: af, rotation: -2.5, duration: 160, ease: 'Back.easeOut' },
          { targets: af, rotation: -2.0, duration: 150, yoyo: true, repeat: 2, ease: 'Sine.easeInOut' },
          { targets: af, rotation: -0.2, duration: 160 },
        ];
      case 'cheer':
        return [
          sq(90),
          { targets: [af], rotation: -2.7, duration: 1, },
          { targets: [ab], rotation: 2.7, duration: 1 },
          { targets: inner, y: -50 * R, scaleY: 1.08, scaleX: f * 0.95, duration: 220, ease: 'Quad.easeOut' },
          { targets: inner, y: 0, duration: 200, ease: 'Bounce.easeOut' },
          sq(80),
          unsq(),
        ];
      case 'hop':
        return [sq(80), { targets: inner, y: -34 * R, scaleY: 1.06, scaleX: f, duration: 170, ease: 'Quad.easeOut' }, { targets: inner, y: 0, duration: 160, ease: 'Quad.easeIn' }, sq(70), unsq()];
      case 'jump':
        return [sq(120), { targets: inner, y: -90 * R, scaleY: 1.1, scaleX: f * 0.94, duration: 260, ease: 'Quad.easeOut' }, { targets: inner, y: 0, duration: 240, ease: 'Quad.easeIn' }, sq(90), unsq(180)];
      case 'oops':
        return [
          { targets: inner, scaleY: 0.9, scaleX: f * 1.06, duration: 90 },
          { targets: [af], rotation: -2.2, duration: 140 },
          { targets: [ab], rotation: 2.2, duration: 1 },
          { targets: head, rotation: -0.15, duration: 120, yoyo: true, repeat: 1 },
          unsq(200),
        ];
      case 'think':
        return [
          { targets: af, rotation: -2.3, duration: 220, ease: 'Quad.easeOut' },
          { targets: head, rotation: 0.16 * (dir || 1), duration: 300, ease: 'Sine.easeInOut' },
          { targets: head, rotation: 0.12, duration: 600, yoyo: true },
        ];
      case 'nod':
        return [{ targets: head, y: '+=6', rotation: 0.08, duration: 140, yoyo: true, repeat: 1, ease: 'Sine.easeInOut' }];
      case 'shake':
        return [{ targets: head, rotation: 0.16, duration: 110, yoyo: true, repeat: 2, ease: 'Sine.easeInOut' }];
      case 'point':
        return [
          { targets: af, rotation: -1.5 + (dir < 0 ? -0.6 : 0), duration: 200, ease: 'Back.easeOut' },
          { targets: af, rotation: -1.55, duration: 600 },
        ];
      case 'bow':
        return [{ targets: body, rotation: 0.35 * R, duration: 260, ease: 'Sine.easeOut' }, { targets: body, rotation: 0.35 * R, duration: 300 }];
      case 'dance':
        return [
          { targets: inner, rotation: 0.15 * R, y: -14 * R, duration: 200, yoyo: true, ease: 'Sine.easeInOut' },
          { targets: inner, rotation: -0.15 * R, y: -14 * R, duration: 200, yoyo: true, ease: 'Sine.easeInOut' },
          { targets: [af], rotation: -2.6, duration: 120 },
          { targets: inner, rotation: 0.15 * R, y: -14 * R, duration: 200, yoyo: true, ease: 'Sine.easeInOut' },
          { targets: inner, rotation: -0.15 * R, y: -14 * R, duration: 200, yoyo: true, ease: 'Sine.easeInOut' },
        ];
      case 'sit':
        return [{ targets: inner, y: 18, scaleY: 0.88, duration: 260, ease: 'Quad.easeOut' }, { targets: inner, y: 18, duration: 600 }];
      case 'sleep':
        return [
          { targets: head, rotation: 0.3, duration: 400, ease: 'Sine.easeInOut' },
          { targets: body, scaleY: 1.03, duration: 900, yoyo: true, repeat: 1, ease: 'Sine.easeInOut' },
        ];
      case 'shrug':
        return [
          { targets: [af], rotation: -1.1, duration: 140 },
          { targets: [ab], rotation: 1.1, duration: 1 },
          { targets: head, y: '+=5', duration: 200, yoyo: true },
        ];
      case 'clap':
        return [
          { targets: [af], rotation: -1.7, duration: 120 },
          { targets: [ab], rotation: 1.7, duration: 1 },
          { targets: [af], rotation: -1.3, duration: 90, yoyo: true, repeat: 3 },
        ];
      case 'stomp':
        return [sq(70), unsq(80), sq(70), unsq(120)];
      case 'hide':
        return [
          { targets: [af], rotation: -2.6, duration: 140 },
          { targets: [ab], rotation: 2.6, duration: 1 },
          { targets: inner, scaleY: 0.86, y: 12, duration: 240 },
          { targets: inner, scaleY: 0.86, duration: 700 },
        ];
      case 'pump':
        return [
          { targets: [af], rotation: -0.6, duration: 1 },
          { targets: [ab], rotation: 0.6, duration: 1 },
          { targets: inner, scaleY: 0.88, y: 8, duration: 160, yoyo: true, repeat: 1, ease: 'Quad.easeInOut' },
        ];
      case 'pull':
        return [
          { targets: [af], rotation: -1.4, duration: 140 },
          { targets: inner, rotation: -0.12 * f, duration: 220, yoyo: true, ease: 'Sine.easeInOut' },
        ];
      case 'throw':
        return [
          { targets: af, rotation: 0.9, duration: 140, ease: 'Quad.easeOut' },
          sq(60),
          { targets: af, rotation: -2.4, duration: 120, ease: 'Back.easeOut' },
          unsq(160),
        ];
      case 'reach':
        return [{ targets: af, rotation: -1.6, duration: 180, ease: 'Back.easeOut' }, { targets: af, rotation: -1.6, duration: 260 }];
    }
    return [];
  }

  // ---------------------------------------------------------------- teardown

  stopAll(): void {
    this.stopIdle();
    for (const t of [...this.animTweens, ...this.gaitTweens]) safeRemove(t);
    this.animTweens = [];
    this.gaitTweens = [];
    this.talkTimer?.remove();
    this.emoteTimer?.remove();
  }
}

/** Remove a tween/chain only if it is still alive (finished chains are already destroyed). */
function safeRemove(t: Phaser.Tweens.Tween | Phaser.Tweens.TweenChain): void {
  try {
    if (!t.isDestroyed() && !t.isPendingRemove()) t.remove();
  } catch {
    /* already gone */
  }
}

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
