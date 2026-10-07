import Phaser from 'phaser';
import type { Target } from '../../WWScene';
import { makeImage } from '../../../art/rasterize';
import { pieceSvg } from '../../../art/registry';
import { hex } from '../../../art/palette';
import { DishView } from '../../displays/DishView';
import { dust, sparkle, splash } from '../../systems/fx';
import { audio } from '../../../core/audio';
import { motion } from '../../../core/motion';
import {
  CUP_GLUGS,
  KNEADS,
  MAX_FRUITS,
  MAX_TOPPINGS,
  STACK,
  dropLayer,
  isMuddy,
  isRainbow,
  juiceColor,
  popBack,
  pourGlug,
  type Deco,
  type Dish,
  type Filling,
  type Fruit,
  type Layer,
  type Shape,
  type Size,
  type Topping,
} from '../../../content/picnic/food';
import type { ScenarioDef, Station } from '../../../content/picnic/scenarios';
import type { HostLineId } from '../../../content/picnic/picnicLines';
import type { PresetId } from '../../../save/schema';
import type { ChoiceOption } from '../../../ui/choices';

/** What a station needs from the picnic scene. */
export interface StationHost {
  scene: Phaser.Scene;
  preset: PresetId;
  def: ScenarioDef;
  depth: number;
  addTarget(t: Target): void;
  removeTarget(id: string): void;
  tapPoint(): { x: number; y: number } | null;
  host(line: HostLineId): Promise<void>;
  /** true when there's no room on the tray for another dish (stations check before starting one) */
  trayFull(): boolean;
  /** put a finished dish on the tray (false if the tray is full) */
  deliver(dish: Omit<Dish, 'id'>, from: { x: number; y: number }): Promise<boolean>;
  ask(options: ChoiceOption[]): Promise<string | null>;
  /** lantern picnic: may pause for the friends' cutter talk; returns the cut's label */
  cutWith(shape: Shape): Promise<{ forGuest?: string; share: boolean; shape: Shape }>;
  poke(): void;
  demoTap(x: number, y: number): void;
  /** decorate: the dish being decorated has changed */
  updateDish(d: Dish): void;
}

export abstract class StationBase {
  abstract readonly id: Station;
  step = '';
  protected objs: Phaser.GameObjects.GameObject[] = [];
  protected ids: string[] = [];
  protected busy = false;
  private listeners: [string, (...a: never[]) => void][] = [];

  constructor(protected h: StationHost) {}

  abstract open(): void;
  /** the next thing to tap (for the help hand) */
  abstract demo(): void;
  onArrow(_dx: number): void {}

  close(): void {
    for (const id of this.ids) this.h.removeTarget(id);
    this.ids = [];
    for (const o of this.objs) {
      this.h.scene.tweens.killTweensOf(o);
      o.destroy();
    }
    this.objs = [];
    for (const [ev, fn] of this.listeners) this.h.scene.input.off(ev, fn as never);
    this.listeners = [];
  }

  protected img(x: number, y: number, key: string, depthOffset = 0): Phaser.GameObjects.Image {
    const im = makeImage(this.h.scene, x, y, key).setDepth(this.h.depth + depthOffset);
    this.h.scene.add.existing(im);
    this.objs.push(im);
    return im;
  }

  protected target(t: Target): void {
    this.h.addTarget(t);
    if (!this.ids.includes(t.id)) this.ids.push(t.id);
  }

  protected untarget(id: string): void {
    this.h.removeTarget(id);
    this.ids = this.ids.filter((x) => x !== id);
  }

  protected full(): void {
    audio.play('bonk', { pitch: 1.3 });
    void this.h.host('trayFull');
  }

  protected rect(x: number, y: number, w: number, hh: number, pad = 16): Phaser.Geom.Rectangle {
    return new Phaser.Geom.Rectangle(x - w / 2 - pad, y - hh / 2 - pad, w + pad * 2, hh + pad * 2);
  }

  protected listen(ev: string, fn: (p: Phaser.Input.Pointer) => void): void {
    this.h.scene.input.on(ev, fn);
    this.listeners.push([ev, fn as never]);
  }

  protected tween(cfg: Phaser.Types.Tweens.TweenBuilderConfig): Promise<void> {
    return new Promise((r) => {
      if (motion.reduced && !cfg.yoyo && !cfg.repeat) cfg.duration = Math.min(Number(cfg.duration ?? 200), 120);
      this.h.scene.tweens.add({ ...cfg, onComplete: () => r() });
    });
  }

  protected wait(ms: number): Promise<void> {
    return new Promise((r) => this.h.scene.time.delayedCall(ms, r));
  }

  /** a gentle bob that says "tap me" */
  protected bob(o: Phaser.GameObjects.Image | Phaser.GameObjects.Container): void {
    if (motion.reduced) return;
    this.h.scene.tweens.add({ targets: o, y: o.y - 8, duration: 500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }
}

// ================================================================== dough: knead, cut, bake

const BOWL = { x: 300, y: 820 };
const OVEN = { x: 850, y: 720 };

export class DoughStation extends StationBase {
  readonly id = 'dough';
  private kneads = 0;
  private dough?: Phaser.GameObjects.Image;
  private lumps?: Phaser.GameObjects.Image;
  private cutterImgs = new Map<Shape, Phaser.GameObjects.Image>();

  open(): void {
    this.img(OVEN.x, OVEN.y, 'pc.oven', -1);
    this.startDough();
  }

  private startDough(): void {
    this.step = 'knead';
    this.kneads = 0;
    this.dough = this.img(BOWL.x, BOWL.y - 20, 'pc.dough', 0);
    this.lumps = this.img(BOWL.x, BOWL.y - 20, 'pc.dough.lumps', 1);
    const bowl = this.img(BOWL.x, BOWL.y, 'pc.bowl', 2);
    this.target({
      id: 'dough',
      label: 'Squish the dough',
      bounds: () => this.rect(BOWL.x, BOWL.y - 70, 300, 200),
      enabled: () => this.step === 'knead' && !this.busy,
      activate: () => void this.knead(bowl),
    });
  }

  private async knead(bowl: Phaser.GameObjects.Image): Promise<void> {
    const d = this.dough!;
    this.h.poke();
    if (this.kneads === 0 && this.h.trayFull()) return this.full();
    this.kneads++;
    audio.play('squish', { pitch: 0.9 + this.kneads * 0.06 });
    this.h.scene.tweens.killTweensOf(d);
    d.setScale(1);
    this.h.scene.tweens.add({ targets: [d, this.lumps], scaleY: 0.66, scaleX: 1.28, duration: 90, yoyo: true, ease: 'Quad.easeOut' });
    this.lumps!.setAlpha(Math.max(0, 1 - this.kneads / KNEADS[this.h.preset]));
    if (this.kneads === 2) void this.h.host('kneadMore');
    if (this.kneads < KNEADS[this.h.preset]) return;
    this.busy = true;
    this.untarget('dough');
    sparkle(this.h.scene, BOWL.x, BOWL.y - 90, 8, this.h.depth + 5);
    await this.wait(250);
    // roll it flat on the board
    await this.tween({ targets: [d, this.lumps, bowl], alpha: 0, duration: 220 });
    const boardImg = this.img(BOWL.x + 30, BOWL.y - 30, 'pc.board', 0);
    const sheet = this.img(BOWL.x + 30, BOWL.y - 40, 'pc.dough.sheet', 1).setScale(0.4, 0.7);
    const pinImg = this.img(BOWL.x - 170, BOWL.y - 60, 'pc.pin', 2).setScale(0.8);
    audio.play('stretch');
    await Promise.all([this.tween({ targets: pinImg, x: BOWL.x + 230, duration: 700, ease: 'Sine.easeInOut' }), this.tween({ targets: sheet, scaleX: 1, scaleY: 1, duration: 700, ease: 'Sine.easeOut' })]);
    await this.tween({ targets: pinImg, alpha: 0, duration: 200 });
    this.busy = false;
    this.step = 'cut';
    this.showCutters(sheet, boardImg);
    void this.h.host('kneaded');
  }

  private showCutters(sheet: Phaser.GameObjects.Image, boardImg: Phaser.GameObjects.Image): void {
    const shapes = this.h.def.cutters[this.h.preset];
    this.cutterImgs.clear();
    shapes.forEach((s, i) => {
      const x = 150 + i * 120;
      const y = 540;
      const im = this.img(x, y, `pc.cutter.${s}`, 3).setScale(0.72);
      this.cutterImgs.set(s, im);
      this.target({
        id: `cutter-${s}`,
        label: `${s} cutter`,
        bounds: () => this.rect(x, y, 110, 110, 10),
        enabled: () => this.step === 'cut' && !this.busy,
        activate: () => void this.cut(s, sheet, boardImg),
      });
    });
  }

  private async cut(shape: Shape, sheet: Phaser.GameObjects.Image, boardImg: Phaser.GameObjects.Image): Promise<void> {
    this.h.poke();
    this.busy = true;
    const res = await this.h.cutWith(shape);
    if (!this.active()) return;
    const cutter = this.cutterImgs.get(res.shape)!;
    const ox = cutter.x;
    const oy = cutter.y;
    audio.play('pickup');
    await this.tween({ targets: cutter, x: BOWL.x + 30, y: BOWL.y - 120, scale: res.share ? 1.3 : 1, duration: 320, ease: 'Quad.easeOut' });
    await this.tween({ targets: cutter, y: BOWL.y - 50, duration: 140, ease: 'Quad.easeIn' });
    audio.play('squish', { pitch: 0.8 });
    const raw = this.img(BOWL.x + 30, BOWL.y - 50, `pc.cookie.${res.shape}.soft`, 2).setTint(0xfff3dc).setScale(res.share ? 1.35 : 1);
    await this.tween({ targets: cutter, y: BOWL.y - 140, duration: 200, ease: 'Quad.easeOut' });
    void this.tween({ targets: cutter, x: ox, y: oy, scale: 0.72, duration: 300 });
    await this.tween({ targets: [sheet, boardImg], alpha: 0, duration: 260 });
    for (const s of this.cutterImgs.keys()) this.untarget(`cutter-${s}`);
    for (const im of this.cutterImgs.values()) void this.tween({ targets: im, alpha: 0, duration: 200 });
    // bake: a little (soft) or a long time (crunchy)
    this.step = 'bake';
    void this.h.host('bake');
    const pick = await this.h.ask([
      { id: 'soft', icon: 'wait', label: 'A little bake (soft)', art: pieceSvg(`pc.cookie.${res.shape}.soft`) },
      { id: 'crunchy', icon: 'wait', label: 'A long bake (crunchy)', art: pieceSvg(`pc.cookie.${res.shape}.crunchy`) },
    ]);
    if (!this.active()) return;
    const texture = pick === 'crunchy' ? 'crunchy' : 'soft';
    await this.tween({ targets: raw, x: OVEN.x, y: OVEN.y - 60, scale: 0.6, duration: 380, ease: 'Quad.easeInOut' });
    const glow = this.img(OVEN.x, OVEN.y, 'pc.oven.glow', -1).setAlpha(0);
    raw.setDepth(this.h.depth - 2);
    audio.play('whirr', { pitch: 0.7, vol: 0.5 });
    await this.tween({ targets: glow, alpha: 1, duration: 300, yoyo: true, repeat: texture === 'crunchy' ? 2 : 0 });
    audio.play('ding');
    const cooked = this.img(OVEN.x, OVEN.y - 60, `pc.cookie.${res.shape}.${texture}`, 4).setScale(res.share ? 0.8 : 0.6);
    raw.destroy();
    await this.tween({ targets: cooked, y: OVEN.y - 140, scale: res.share ? 1.35 : 1, duration: 360, ease: 'Back.easeOut' });
    void this.h.host('baked');
    const ok = await this.h.deliver({ kind: 'cookie', shape: res.shape, texture, deco: [], share: res.share || undefined, forGuest: res.forGuest }, { x: cooked.x, y: cooked.y });
    cooked.destroy();
    this.busy = false;
    if (ok && this.active()) {
      glow.destroy();
      this.startDough();
    }
  }

  private active(): boolean {
    return this.objs.length > 0;
  }

  demo(): void {
    if (this.step === 'knead') this.h.demoTap(BOWL.x, BOWL.y - 80);
    else if (this.step === 'cut') {
      const first = this.cutterImgs.values().next().value;
      if (first) this.h.demoTap(first.x, first.y);
    }
  }
}

// ================================================================== sandwich: stack and balance

const STACKX = 360;
const PLATE_Y = 870;
const BREAD_Y = PLATE_Y - 24;
const LAYER_H = 22;

export class StackStation extends StationBase {
  readonly id = 'stack';
  private layers: Layer[] = [];
  private layerImgs: Phaser.GameObjects.Image[] = [];
  private inHand: Filling | null = null;
  private hover?: Phaser.GameObjects.Image;
  private hoverDx = 0;
  private fallen: { f: Filling; img: Phaser.GameObjects.Image; tall: boolean } | null = null;
  private dishImgs = new Map<Filling, Phaser.GameObjects.Image>();

  open(): void {
    this.img(STACKX, PLATE_Y, 'pc.plate', 0);
    this.startSandwich();
    const list = this.h.def.fillings[this.h.preset];
    list.forEach((f, i) => {
      const x = list.length > 3 ? 150 + i * 150 : 200 + i * 180;
      const y = 520;
      const im = this.img(x, y, `pc.dish.${f}`, 1);
      this.dishImgs.set(f, im);
      this.target({ id: `filling-${f}`, label: f, bounds: () => this.rect(x, y, 160, 100, 10), enabled: () => !this.busy, activate: () => this.pick(f) });
    });
    const tb = this.img(800, 790, 'pc.bread.top', 1).setScale(0.9);
    this.target({ id: 'topbread', label: 'Top bread: finish the sandwich', bounds: () => this.rect(800, 780, 230, 90, 14), enabled: () => !this.busy, activate: () => void this.finish(tb) });
    this.target({
      id: 'stackzone',
      label: 'Drop it here',
      priority: 6,
      bounds: () => new Phaser.Geom.Rectangle(STACKX - 200, 610, 400, Math.max(80, this.topY() - 610 + 20)),
      enabled: () => !!this.inHand && !this.busy,
      activate: () => {
        const tp = this.h.tapPoint();
        void this.drop(tp ? tp.x - STACKX : this.hoverDx);
      },
    });
    void this.h.host(this.h.preset === 'more-help' ? 'stackStart' : 'stackWhere');
  }

  private startSandwich(): void {
    this.step = 'stack';
    this.layers = [];
    for (const im of this.layerImgs) im.destroy();
    this.layerImgs = [this.img(STACKX, BREAD_Y, 'pc.bread.bottom', 2)];
  }

  private topY(): number {
    return BREAD_Y - 18 - this.layers.length * LAYER_H;
  }

  private pick(f: Filling): void {
    this.h.poke();
    if (!this.layers.length && this.h.trayFull()) return this.full();
    if (this.fallen) this.returnFallen();
    if (this.h.preset === 'more-help') {
      void this.drop(0, f);
      return;
    }
    if (this.inHand === f) {
      void this.drop(this.hoverDx);
      return;
    }
    this.inHand = f;
    audio.play('pickup');
    for (const [k, im] of this.dishImgs) im.setScale(k === f ? 1.12 : 1);
    this.hover?.destroy();
    this.hoverDx = 0;
    this.hover = this.img(STACKX, this.topY() - 110, `pc.fill.${f}`, 6);
    this.bob(this.hover);
  }

  override onArrow(dx: number): void {
    if (!this.inHand || !this.hover) return;
    this.hoverDx = Math.max(-STACK.clamp, Math.min(STACK.clamp, this.hoverDx + dx * 20));
    this.hover.x = STACKX + this.hoverDx;
  }

  private async drop(dx: number, f = this.inHand): Promise<void> {
    if (!f || this.busy) return;
    this.busy = true;
    this.inHand = null;
    for (const im of this.dishImgs.values()) im.setScale(1);
    this.hover?.destroy();
    this.hover = undefined;
    const from = this.dishImgs.get(f)!;
    const r = dropLayer(this.layers, f, dx, this.h.preset);
    const landX = STACKX + (r.slid ? r.slid.dx : r.layers[r.layers.length - 1].dx);
    const im = this.img(from.x, from.y - 20, `pc.fill.${f}`, 3 + this.layers.length);
    audio.play('swish');
    await this.tween({ targets: im, x: landX, y: this.topY() - 90, duration: 260, ease: 'Quad.easeOut' });
    await this.tween({ targets: im, y: this.topY() - 10, duration: 160, ease: 'Quad.easeIn' });
    if (!r.slid) {
      this.layers = r.layers;
      this.layerImgs.push(im);
      audio.play('squish', { pitch: 1.1 + this.layers.length * 0.05 });
      this.wobble();
      this.busy = false;
      if (this.layers.length === 2) void this.h.host('stackDone');
      return;
    }
    // it slides off and bounces onto the table (tap it to pop it back on)
    const side = r.slid.dx >= 0 ? 1 : -1;
    audio.play('wobble');
    this.wobble(true);
    await this.tween({ targets: im, x: STACKX + side * 250, y: 930, angle: side * 30, duration: 420, ease: 'Bounce.easeOut' });
    this.fallen = { f, img: im, tall: r.reason === 'tall' };
    this.target({
      id: 'fallen',
      label: 'Pop it back on',
      priority: 1,
      bounds: () => this.rect(im.x, im.y, 200, 60, 20),
      enabled: () => !this.busy,
      activate: () => void this.popFallen(),
    });
    void this.h.host(r.reason === 'tall' ? 'stackTall' : r.reason === 'lean' ? 'stackLean' : 'stackSlid');
    this.busy = false;
  }

  private async popFallen(): Promise<void> {
    const fl = this.fallen;
    if (!fl) return;
    this.h.poke();
    this.untarget('fallen');
    this.fallen = null;
    this.busy = true;
    if (fl.tall) {
      const home = this.dishImgs.get(fl.f)!;
      await this.tween({ targets: fl.img, x: home.x, y: home.y - 10, angle: 0, alpha: 0, duration: 380 });
      fl.img.destroy();
      this.busy = false;
      return;
    }
    const r = popBack(this.layers, fl.f);
    const top = this.layers.length ? this.layers[this.layers.length - 1].dx : 0;
    audio.play('boing');
    await this.tween({ targets: fl.img, x: STACKX + top, y: this.topY() - 10, angle: 0, duration: 380, ease: 'Back.easeOut' });
    this.layers = r.layers;
    fl.img.setDepth(this.h.depth + 3 + this.layers.length);
    this.layerImgs.push(fl.img);
    this.wobble();
    this.busy = false;
  }

  private returnFallen(): void {
    if (!this.fallen) return;
    const im = this.fallen.img;
    this.untarget('fallen');
    this.fallen = null;
    void this.tween({ targets: im, alpha: 0, duration: 200 }).then(() => im.destroy());
  }

  private wobble(big = false): void {
    if (motion.reduced) return;
    const amt = big ? 4 : 1.5;
    this.layerImgs.forEach((im, i) => {
      if (i === 0) return;
      this.h.scene.tweens.add({ targets: im, angle: { from: -amt, to: amt }, duration: 90, yoyo: true, repeat: 2, onComplete: () => im.setAngle(0) });
    });
  }

  private async finish(tb: Phaser.GameObjects.Image): Promise<void> {
    if (this.busy) return;
    this.h.poke();
    if (this.h.trayFull()) return this.full();
    this.returnFallen();
    this.inHand = null;
    this.hover?.destroy();
    this.busy = true;
    const top = this.layers.length ? this.layers[this.layers.length - 1].dx : 0;
    const ox = tb.x;
    const oy = tb.y;
    await this.tween({ targets: tb, x: STACKX + top * 0.6, y: this.topY() - 70, scale: 1, duration: 300, ease: 'Quad.easeOut' });
    await this.tween({ targets: tb, y: this.topY() - 14, duration: 140, ease: 'Quad.easeIn' });
    audio.play('squish', { pitch: 0.7 });
    const all = [...this.layerImgs, tb];
    await this.tween({ targets: all, scaleY: 0.85, duration: 100, yoyo: true });
    if (!this.layers.length) void this.h.host('breadOnly');
    const ok = await this.h.deliver({ kind: 'sandwich', layers: this.layers, deco: [] }, { x: STACKX, y: this.topY() });
    if (!this.objs.length) return;
    if (ok) {
      for (const im of this.layerImgs) im.destroy();
      this.layerImgs = [];
      tb.setPosition(ox, oy).setScale(0.9);
      this.startSandwich();
    } else {
      tb.setPosition(ox, oy).setScale(0.9);
    }
    this.busy = false;
  }

  demo(): void {
    if (this.inHand) this.h.demoTap(STACKX, this.topY() - 80);
    else if (this.fallen) this.h.demoTap(this.fallen.img.x, this.fallen.img.y);
    else if (this.layers.length >= 2) this.h.demoTap(800, 780);
    else {
      const first = this.dishImgs.values().next().value;
      if (first) this.h.demoTap(first.x, first.y);
    }
  }
}

// ================================================================== juice: combine, blend, pour

const JUG = { x: 300, y: 890 };
const CUPS: Record<Size, { x: number; y: number }> = { small: { x: 690, y: 890 }, big: { x: 840, y: 890 } };
const POUR = { x: 560, y: 900 };

export class JuiceStation extends StationBase {
  readonly id = 'juice';
  private fruits: Fruit[] = [];
  private chunks: Phaser.GameObjects.Image[] = [];
  private liquid?: Phaser.GameObjects.Image;
  private jug?: Phaser.GameObjects.Image;
  private cup: Size | null = null;
  private glugs = 0;
  private cupImgs = new Map<Size, Phaser.GameObjects.Image>();
  private cupFill?: Phaser.GameObjects.Image;
  private saucer?: Phaser.GameObjects.Image;

  open(): void {
    this.liquid = this.img(JUG.x, JUG.y, 'pc.jug.liquid', 0).setScale(1, 0.001).setAlpha(0);
    this.jug = this.img(JUG.x, JUG.y, 'pc.jug', 2);
    this.img(JUG.x + 170, JUG.y - 40, 'pc.jug.button', 2);
    const list = this.h.def.fruits[this.h.preset];
    list.forEach((f, i) => {
      const x = 160 + i * 140;
      const y = 530;
      this.img(x, y, `pc.fruit.${f}`, 1).setScale(1.1);
      this.target({ id: `fruit-${f}`, label: `${f}`, bounds: () => this.rect(x, y, 110, 110, 8), enabled: () => this.step === 'fruit' && !this.busy, activate: () => void this.addFruit(f, x, y) });
    });
    this.target({ id: 'blend', label: 'Blend', bounds: () => this.rect(JUG.x + 170, JUG.y - 40, 92, 92, 18), enabled: () => this.step === 'fruit' && this.fruits.length > 0 && !this.busy, activate: () => void this.blend() });
    for (const size of ['small', 'big'] as Size[]) {
      const c = CUPS[size];
      this.cupImgs.set(size, this.img(c.x, c.y, `pc.cup.${size}`, 3));
      this.target({ id: `cup-${size}`, label: `${size} cup`, bounds: () => this.rect(c.x, c.y - (size === 'big' ? 85 : 55), 120, size === 'big' ? 180 : 120, 10), enabled: () => this.step === 'cup' && !this.busy, activate: () => void this.chooseCup(size) });
    }
    this.target({ id: 'jug', label: 'Pour', bounds: () => this.rect(JUG.x, JUG.y - 150, 200, 300, 6), enabled: () => this.step === 'pour' && !this.busy, activate: () => void this.pour() });
    this.target({ id: 'cup', label: 'Put the juice on the tray', priority: 2, bounds: () => this.rect(POUR.x, POUR.y - 80, 130, 180, 10), enabled: () => this.step === 'pour' && this.glugs > 0 && !this.busy, activate: () => void this.finish() });
    this.reset();
    void this.h.host('juiceStart');
  }

  private reset(): void {
    this.step = 'fruit';
    this.fruits = [];
    this.cup = null;
    this.glugs = 0;
    for (const c of this.chunks) c.destroy();
    this.chunks = [];
    this.liquid?.setScale(1, 0.001).setAlpha(0);
    this.cupFill?.destroy();
    this.cupFill = undefined;
    this.saucer?.destroy();
    this.saucer = undefined;
    for (const [size, im] of this.cupImgs) im.setPosition(CUPS[size].x, CUPS[size].y).setAlpha(1);
  }

  private async addFruit(f: Fruit, x: number, y: number): Promise<void> {
    this.h.poke();
    if (!this.fruits.length && this.h.trayFull()) return this.full();
    if (this.fruits.length >= MAX_FRUITS[this.h.preset]) {
      audio.play('bonk', { pitch: 1.3 });
      void this.h.host('juiceBlend');
      return;
    }
    this.busy = true;
    this.fruits.push(f);
    const n = this.fruits.length;
    const chunk = this.img(x, y, `pc.fruit.${f}`, 1).setScale(1.1);
    this.chunks.push(chunk);
    await this.tween({ targets: chunk, x: JUG.x + (n % 2 ? -26 : 26), y: JUG.y - 230, scale: 0.6, duration: 300, ease: 'Quad.easeOut' });
    await this.tween({ targets: chunk, y: JUG.y - 40 - n * 46, duration: 260, ease: 'Bounce.easeOut' });
    audio.play('pop', { pitch: 0.8 + n * 0.1 });
    this.busy = false;
    if (n === 1) void this.h.host('juiceBlend');
  }

  private async blend(): Promise<void> {
    this.h.poke();
    this.busy = true;
    audio.play('whirr', { pitch: 1.4 });
    if (!motion.reduced) this.h.scene.tweens.add({ targets: [this.jug, ...this.chunks], x: '+=6', duration: 50, yoyo: true, repeat: 9 });
    await this.tween({ targets: this.chunks, angle: 720, scale: 0.1, alpha: 0, duration: 900 });
    const color = juiceColor(this.fruits);
    this.liquid!.setTint(hex(color)).setAlpha(1);
    await this.tween({ targets: this.liquid, scaleY: 0.75, duration: 400, ease: 'Quad.easeOut' });
    this.step = 'cup';
    this.busy = false;
    if (isMuddy(this.fruits)) await this.h.host('juiceMuddy');
    else if (isRainbow(this.fruits)) {
      sparkle(this.h.scene, JUG.x, JUG.y - 200, 12, this.h.depth + 6);
      await this.h.host('juiceRainbow');
    }
    void this.h.host('juiceCup');
  }

  private async chooseCup(size: Size): Promise<void> {
    this.h.poke();
    this.busy = true;
    this.cup = size;
    audio.play('clack');
    const other = this.cupImgs.get(size === 'big' ? 'small' : 'big')!;
    void this.tween({ targets: other, alpha: 0.25, duration: 200 });
    this.saucer = this.img(POUR.x, POUR.y + 6, 'pc.saucer', 2);
    await this.tween({ targets: this.cupImgs.get(size), x: POUR.x, y: POUR.y, duration: 300, ease: 'Quad.easeOut' });
    this.cupFill = this.img(POUR.x, POUR.y, `pc.cup.${size}.fill`, 2).setTint(hex(juiceColor(this.fruits))).setScale(1, 0.001);
    this.step = 'pour';
    this.busy = false;
    void this.h.host('juicePour');
  }

  private async pour(): Promise<void> {
    if (!this.cup) return;
    this.h.poke();
    this.busy = true;
    const r = pourGlug(this.glugs, this.cup);
    const jug = this.jug!;
    const color = hex(juiceColor(this.fruits));
    await this.tween({ targets: [jug, this.liquid], x: POUR.x - 150, angle: 38, duration: 260, ease: 'Quad.easeOut' });
    const top = POUR.y - (this.cup === 'big' ? 170 : 110);
    const stream = this.h.scene.add.rectangle(POUR.x - 26, top - 70, 14, POUR.y - top + 60, color).setOrigin(0.5, 0).setDepth(this.h.depth + 4).setStrokeStyle(3, 0x3b2a20).setScale(1, 0.05);
    this.objs.push(stream);
    audio.play('pour');
    await this.tween({ targets: stream, scaleY: 1, duration: 200 });
    this.glugs = r.glugs;
    const cap = CUP_GLUGS[this.cup];
    await this.tween({ targets: this.cupFill, scaleY: this.glugs / cap, duration: 260, ease: 'Sine.easeOut' });
    void this.tween({ targets: this.liquid, scaleY: Math.max(0.15, 0.75 - (this.glugs / 4) * 0.5), duration: 260 });
    if (r.spilled) {
      splash(this.h.scene, POUR.x + 40, POUR.y - 10, this.h.depth + 6);
      const drip = this.h.scene.add.ellipse(POUR.x + 44, POUR.y + 4, 44, 12, color).setDepth(this.h.depth + 3).setStrokeStyle(3, 0x3b2a20);
      this.objs.push(drip);
      void this.h.host('juiceSpill');
    }
    stream.destroy();
    this.objs = this.objs.filter((o) => o !== stream);
    await this.tween({ targets: [jug, this.liquid], x: JUG.x, angle: 0, duration: 240 });
    this.busy = false;
  }

  private async finish(): Promise<void> {
    if (!this.cup || !this.glugs) return;
    this.h.poke();
    this.busy = true;
    const ok = await this.h.deliver({ kind: 'juice', fruits: [...this.fruits], cup: this.cup, glugs: this.glugs, deco: [] }, { x: POUR.x, y: POUR.y - 80 });
    if (!this.objs.length) return;
    if (ok) this.reset();
    this.busy = false;
  }

  demo(): void {
    if (this.step === 'fruit' && !this.fruits.length) this.h.demoTap(160, 530);
    else if (this.step === 'fruit') this.h.demoTap(JUG.x + 170, JUG.y - 40);
    else if (this.step === 'cup') this.h.demoTap(CUPS.small.x, CUPS.small.y - 60);
    else if (this.step === 'pour' && this.glugs < CUP_GLUGS[this.cup ?? 'small']) this.h.demoTap(JUG.x, JUG.y - 150);
    else this.h.demoTap(POUR.x, POUR.y - 70);
  }

}

// ================================================================== decorate

const DECO_AT = { x: 380, y: 900 };
const TOOL_SPOTS = [
  { x: 720, y: 520 },
  { x: 880, y: 520 },
  { x: 720, y: 690 },
  { x: 880, y: 690 },
];

export class DecorateStation extends StationBase {
  readonly id = 'decorate';
  private view?: DishView;
  private dish: Dish | null = null;
  private tool: Deco | null = null;
  private toolImgs = new Map<Deco, Phaser.GameObjects.Image>();
  private stroke: number[] | null = null;
  private placed = 0;

  open(): void {
    this.step = 'pick';
    const tools = this.h.def.decos[this.h.preset];
    tools.forEach((d, i) => {
      const s = TOOL_SPOTS[i];
      const im = this.img(s.x, s.y, `pc.tool.${d}`, 1);
      this.toolImgs.set(d, im);
      this.target({ id: `tool-${d}`, label: d, bounds: () => this.rect(s.x, s.y, 110, 140, 8), enabled: () => this.step === 'deco', activate: () => this.pickTool(d) });
    });
    this.img(800, 840, 'pc.done', 2);
    this.target({ id: 'deco-done', label: 'Finished decorating', bounds: () => this.rect(800, 840, 104, 104, 12), enabled: () => this.step === 'deco' && !this.busy, activate: () => void this.done() });
    this.target({
      id: 'decozone',
      label: 'Decorate here',
      priority: 6,
      bounds: () => this.zone(),
      enabled: () => this.step === 'deco' && !!this.tool && !this.busy,
      activate: () => this.place(this.h.tapPoint()),
    });
    this.listen('pointerdown', (p) => {
      if (this.step === 'deco' && this.tool === 'swirl' && this.zone().contains(p.worldX, p.worldY)) this.stroke = [p.worldX, p.worldY];
    });
    this.listen('pointermove', (p) => {
      if (!this.stroke || !p.isDown) return;
      const n = this.stroke.length;
      if (Math.hypot(p.worldX - this.stroke[n - 2], p.worldY - this.stroke[n - 1]) > 14 && n < 80) this.stroke.push(p.worldX, p.worldY);
    });
    this.listen('pointerup', () => {
      const s = this.stroke;
      this.stroke = null;
      if (s && s.length >= 8) this.addSwirl(s);
    });
    void this.h.host('decoratePick');
  }

  /** Called by the scene when the child picks a dish from the tray. */
  setDish(d: Dish): void {
    this.view?.destroy();
    this.objs = this.objs.filter((o) => o !== this.view);
    this.dish = { ...d, deco: [...d.deco] };
    const scale = d.kind === 'sandwich' ? 1.6 : 2;
    this.view = new DishView(this.h.scene, DECO_AT.x, DECO_AT.y, this.dish).setScale(scale).setDepth(this.h.depth + 3);
    this.objs.push(this.view);
    this.step = 'deco';
    this.placed = 0;
    if (!this.tool) this.pickTool(this.h.def.decos[this.h.preset][0], true);
    void this.h.host('decorate');
  }

  get dishId(): string | null {
    return this.dish?.id ?? null;
  }

  private zone(): Phaser.Geom.Rectangle {
    if (!this.view) return new Phaser.Geom.Rectangle(0, 0, 0, 0);
    const s = this.view.surface();
    const k = this.view.scaleX;
    return new Phaser.Geom.Rectangle(DECO_AT.x + (s.cx - s.rx) * k - 20, DECO_AT.y + (s.cy - s.ry) * this.view.scaleY - 20, 2 * s.rx * k + 40, 2 * s.ry * this.view.scaleY + 40);
  }

  private pickTool(d: Deco, quiet = false): void {
    this.h.poke();
    this.tool = d;
    if (!quiet) audio.play('pickup');
    for (const [k, im] of this.toolImgs) {
      this.h.scene.tweens.killTweensOf(im);
      im.setScale(k === d ? 1.15 : 1).setAngle(k === d ? -8 : 0);
    }
  }

  private toUnits(wx: number, wy: number): { x: number; y: number } {
    const v = this.view!;
    return v.toDishUnits((wx - DECO_AT.x) / v.scaleX, (wy - DECO_AT.y) / v.scaleY);
  }

  private place(tp: { x: number; y: number } | null): void {
    if (!this.dish || !this.view || !this.tool) return;
    this.h.poke();
    if (this.dish.deco.length >= MAX_TOPPINGS) {
      audio.play('bonk', { pitch: 1.3 });
      return;
    }
    // keyboard: a gentle spiral of spots across the dish
    const k = this.placed++;
    const u = tp ? this.toUnits(tp.x, tp.y) : { x: Math.cos(k * 2.4) * (12 + k * 5) % 50, y: Math.sin(k * 2.4) * (12 + k * 5) % 50 };
    const add: Topping[] = [];
    if (this.tool === 'sprinkles') {
      for (let i = 0; i < 4; i++) add.push({ d: 'sprinkles', x: clamp60(u.x + Math.cos(i * 1.7 + k) * 10), y: clamp60(u.y + Math.sin(i * 1.7 + k) * 10), c: (k + i) % 6 });
      audio.play('rustle', { pitch: 1.5 });
    } else if (this.tool === 'swirl') {
      const pts: number[] = [];
      for (let i = 0; i < 6; i++) pts.push(clamp60(u.x - 12 + i * 5), clamp60(u.y + (i % 2 ? -6 : 6)));
      add.push({ d: 'swirl', x: u.x, y: u.y, pts, c: k % 6 });
      audio.play('squish', { pitch: 1.6 });
    } else {
      add.push({ d: this.tool, x: u.x, y: u.y, c: k % 6 });
      audio.play('pop', { pitch: 1.2 });
    }
    for (const t of add) {
      if (this.dish.deco.length >= MAX_TOPPINGS) break;
      this.dish.deco.push(t);
      this.view.addTopping(t);
    }
  }

  private addSwirl(worldPts: number[]): void {
    if (!this.dish || !this.view || this.dish.deco.length >= MAX_TOPPINGS) return;
    const pts: number[] = [];
    for (let i = 0; i < worldPts.length; i += 2) {
      const u = this.toUnits(worldPts[i], worldPts[i + 1]);
      pts.push(Math.round(u.x), Math.round(u.y));
    }
    const t: Topping = { d: 'swirl', x: pts[0], y: pts[1], pts, c: this.placed++ % 6 };
    this.dish.deco.push(t);
    this.view.addTopping(t);
    audio.play('squish', { pitch: 1.4 });
  }

  private async done(): Promise<void> {
    if (!this.dish) return;
    this.h.poke();
    this.busy = true;
    this.h.updateDish(this.dish);
    sparkle(this.h.scene, DECO_AT.x, DECO_AT.y - 120, 10, this.h.depth + 6);
    audio.play('sparkle');
    void this.h.host('decorateDone');
    await this.tween({ targets: this.view, alpha: 0, scale: 0.6, duration: 260 });
    this.view?.destroy();
    this.objs = this.objs.filter((o) => o !== this.view);
    this.view = undefined;
    this.dish = null;
    this.step = 'pick';
    this.busy = false;
  }

  /** The dish left the tray (served or kept): stop showing it here. */
  forget(dishId: string): void {
    if (this.dish?.id !== dishId) return;
    this.view?.destroy();
    this.objs = this.objs.filter((o) => o !== this.view);
    this.view = undefined;
    this.dish = null;
    this.step = 'pick';
  }

  /** Save toppings back to the tray when the child switches away mid-decoration. */
  flush(): void {
    if (this.dish && this.dish.deco.length) this.h.updateDish(this.dish);
  }

  demo(): void {
    if (this.step === 'pick') this.h.demoTap(820, 930);
    else if (this.view && this.dish && this.dish.deco.length < 3) {
      const z = this.zone();
      this.h.demoTap(z.centerX, z.centerY);
    } else this.h.demoTap(800, 840);
  }
}

function clamp60(v: number): number {
  return Math.max(-60, Math.min(60, v));
}

export function crumbs(scene: Phaser.Scene, x: number, y: number, depth: number): void {
  dust(scene, x, y, 6, depth);
}
