import Phaser from 'phaser';
import { TrailScene, groundY } from './TrailScene';
import { registerPieces } from '../../../art/registry';
import { GROUND_Y, MILL, TRAIL_ADVENTURE_PIECES } from '../../../art/scenes/trailAdventures';
import { splash, sparkle } from '../../systems/fx';
import { audio } from '../../../core/audio';
import { motion } from '../../../core/motion';
import { CHANNEL_STONES, addChannelStone, findClue, flow, newWater, removeLeaf, type WaterState } from '../../../content/trail/adventures';
import { WATER_LINES } from '../../../content/trail/adventureLines';

registerPieces(TRAIL_ADVENTURE_PIECES);

const L = WATER_LINES;
const HOUSE_X = 520;
const ROWAN_X = 1060;
const MOSS_X = 2380;
const PILE_X = 2480;
const CHAN_X = [2600, 2700, 2800];
const CHAN_Y = GROUND_Y + 150;
const CLUE_AT: Record<string, { x: number; y: number; key: string }> = {
  leaf: { x: 1400, y: GROUND_Y + 66, key: 'ml.cluleaf' },
  footprints: { x: 1820, y: GROUND_Y + 36, key: 'ml.feet' },
  bucket: { x: 2230, y: GROUND_Y + 20, key: 'ml.bucket' },
};

function validWater(x: unknown): x is WaterState {
  const w = x as WaterState;
  return !!w && Number.isFinite(w.leaves) && Number.isFinite(w.channel) && Array.isArray(w.clues) && typeof w.fizzMet === 'boolean' && ['together', 'solo', 'moss', ''].includes(w.route);
}

/** The Waterwheel Mix-Up: the wheel stopped; follow the clues upstream and repair the result of a mistake together. */
export default class WaterwheelScene extends TrailScene {
  readonly artGroup = 'trail-mill';
  readonly questId = 'waterwheel';
  readonly gameTheme = 'stream' as const;
  protected readonly skyColors: [string, string] = ['#a9d8ea', '#f0f5e2'];
  protected readonly walkRange: [number, number] = [80, 3100];
  private w!: WaterState;
  private wheel!: Phaser.GameObjects.Image;
  private water!: Phaser.GameObjects.Image | Phaser.GameObjects.Container;
  private pool!: Phaser.GameObjects.Image;
  private millLights: Phaser.GameObjects.Image[] = [];
  private leafImgs: Phaser.GameObjects.Image[] = [];
  private chanImgs: (Phaser.GameObjects.Image | null)[] = [];
  private marks: Phaser.GameObjects.Image[] = [];
  private spinning = false;
  private focus = { x: 0 };

  constructor() {
    super('waterwheel');
  }

  protected extraArtKeys(): string[] {
    return TRAIL_ADVENTURE_PIECES.filter((p) => p.key.startsWith('ml.') || p.key.startsWith('tr.') || p.key === 'br.stonepile').map((p) => p.key);
  }

  protected buildWorld(): void {
    this.w = this.readJSON('water', validWater, newWater(this.preset));
    this.art(0, 0, 'ml.far', 1);
    this.art(0, 0, 'ml.ground', 2);
    this.water = this.art(0, 0, 'ml.water', 3).setAlpha(flow(this.w).wheel ? 1 : 0);
    this.img(HOUSE_X, groundY(HOUSE_X) + 6, 'ml.house', 8);
    for (const [dx, dy] of [
      [-115, -215],
      [135, -215],
    ])
      this.millLights.push(this.img(HOUSE_X + dx, groundY(HOUSE_X) + dy, 'ml.light', 9).setAlpha(0));
    this.wheel = this.img(MILL.wheelX, groundY(MILL.wheelX) - 150, 'ml.wheel', 10);
    this.addTarget({ id: 'wheel', label: 'Waterwheel', bounds: () => this.rectAround(MILL.wheelX, groundY(MILL.wheelX) - 150, 300, 300, 0), enabled: () => !this.busy, activate: () => this.goDo(MILL.wheelX, () => void this.inspectWheel()) });
    // the dam and the pool behind it
    this.pool = this.img(MILL.poolX, GROUND_Y + 80, 'ml.pool', 4);
    this.img(MILL.damX, GROUND_Y + 90, 'ml.dam', 11);
    for (let i = 0; i < this.w.leaves; i++) this.addDamLeaf(i);
    // clues on the way upstream
    for (const [clue, at] of Object.entries(CLUE_AT)) {
      const im = this.img(at.x, at.y, at.key, 12);
      this.addTarget({ id: `clue-${clue}`, label: clue, bounds: () => this.rectAround(at.x, at.y - 30, 150, 90, 12), enabled: () => !this.busy, activate: () => this.goDo(at.x, () => void this.clue(clue, im)) });
    }
    // stones for a side channel
    this.img(PILE_X, groundY(PILE_X) + 14, 'br.stonepile', 12);
    this.addTarget({ id: 'stones', label: 'Stones', bounds: () => this.rectAround(PILE_X, groundY(PILE_X) - 50, 200, 120, 10), enabled: () => !this.busy && this.channelOpen(), activate: () => this.goDo(PILE_X, () => this.takeStone()) });
    CHAN_X.forEach((x, i) => {
      this.chanImgs.push(i < this.w.channel ? this.img(x, CHAN_Y, 'ml.stone', 14) : null);
      this.addTarget({ id: `channel-${i}`, label: 'Channel spot', bounds: () => this.rectAround(x, CHAN_Y - 20, 100, 70, 14), enabled: () => !this.busy && this.channelOpen() && i === this.w.channel, activate: () => void this.placeStone(i) });
    });
    if (this.w.measured) this.showMarks();
    // friends
    this.friend('rowan', ROWAN_X, -1);
    this.friend('moss', MOSS_X, -1);
    const fz = this.friend('fizz', MILL.poolX, -1);
    fz.y = GROUND_Y + 60;
    this.addTarget({ id: 'friend-rowan', label: 'Rowan', bounds: () => this.rectAround(this.friends.get('rowan')!.x, groundY(ROWAN_X) - 110, 140, 200, 6), enabled: () => !this.busy, activate: () => void this.line(flow(this.w).wheel ? L['rowan.turning'] : L['rowan.why']) });
    this.addTarget({ id: 'friend-moss', label: 'Moss', bounds: () => this.rectAround(this.friends.get('moss')!.x, groundY(MOSS_X) - 100, 140, 180, 6), enabled: () => !this.busy && this.w.fizzMet && !this.w.measured && !flow(this.w).wheel, activate: () => this.goDo(this.friends.get('moss')!.x, () => void this.askMoss()) });
    this.addTarget({ id: 'friend-fizz', label: 'Fizz', bounds: () => this.rectAround(this.friends.get('fizz')!.x, this.friends.get('fizz')!.y - 110, 140, 200, 6), enabled: () => !this.busy, activate: () => this.goDo(this.friends.get('fizz')!.x, () => void this.meetFizz()) });
    if (flow(this.w).wheel) this.setRunning(false);
    this.updatePool();
  }

  private addDamLeaf(i: number): void {
    const x = MILL.damX - 60 + (i % 3) * 60;
    const y = GROUND_Y + 10 - Math.floor(i / 3) * 40;
    const im = this.img(x, y, 'ml.leaf', 13).setAngle((i * 37) % 50 - 25);
    this.leafImgs.push(im);
    const idx = this.leafImgs.length - 1;
    this.addTarget({ id: `damleaf-${idx}`, label: 'Leaf in the dam', bounds: () => this.rectAround(x, y, 80, 60, 10), enabled: () => im.visible && !this.busy && this.w.route === 'solo', activate: () => void this.pullLeaf(im) });
  }

  private channelOpen(): boolean {
    return this.w.route === 'together' || this.w.route === 'moss';
  }

  private persist(cp: string): void {
    this.saveQuest(cp, { water: JSON.stringify(this.w) });
  }

  // ================================================================ story

  protected startAt(cp: string): void {
    if (cp === 'done') {
      this.focus.x = MILL.wheelX;
      return;
    }
    // interrupted while the water was coming back: finish that moment (souvenir given once, at the end)
    if (flow(this.w).wheel) return void this.waterReturns();
    if (cp === 'repair') {
      void this.repairInstruction();
      return;
    }
    if (cp === 'explore') {
      void this.line(L['nar.explore'], { instruct: true });
      return;
    }
    void this.intro();
  }

  private async intro(): Promise<void> {
    this.busy = true;
    this.walker.place(ROWAN_X - 260);
    await this.line(L['rowan.hook']);
    await this.line(L['rowan.why']);
    if (!this.alive()) return;
    this.busy = false;
    this.persist('explore');
    void this.line(L['nar.explore'], { instruct: true });
  }

  private async inspectWheel(): Promise<void> {
    if (flow(this.w).wheel) {
      audio.play('splash', { vol: 0.5 });
      return;
    }
    audio.play('creak');
    await this.line(L['nar.dryWheel']);
  }

  private async clue(clue: string, im: Phaser.GameObjects.Image): Promise<void> {
    this.w = findClue(this.w, clue);
    this.persist(this.quest()?.checkpoint === 'repair' ? 'repair' : 'explore');
    if (!motion.reduced) this.tweens.add({ targets: im, scale: 1.2, duration: 160, yoyo: true });
    audio.play('sparkle', { pitch: 1.2 });
    const lines: Record<string, keyof typeof L> = { leaf: 'nar.clueLeaf', footprints: 'nar.clueFeet', bucket: 'nar.clueBucket' };
    await this.line(L[lines[clue]]);
  }

  protected override onTick(delta: number): void {
    if (this.spinning) this.wheel.rotation -= (delta / 1000) * (motion.reduced ? 0.4 : 1.2);
    // getting close to the pool is how the cause is discovered (no clue is required)
    if (!this.w.fizzMet && !this.busy && this.avatar.x > MILL.damX - 260) void this.meetFizz();
  }

  private async meetFizz(): Promise<void> {
    if (this.busy) return;
    const fz = this.friends.get('fizz')!;
    if (this.w.fizzMet) {
      if (flow(this.w).wheel) {
        void fz.play('cheer');
        await this.line(L['fizz.both']);
      } else void this.repairInstruction();
      return;
    }
    this.busy = true;
    this.walker.walkTo(this.avatar.x);
    void fz.play('jump');
    splash(this, fz.x, fz.y - 10, 30);
    await this.line(L['fizz.splash']);
    await this.line(L['fizz.oh']);
    await this.line(L['fizz.sorry']);
    this.w = { ...this.w, fizzMet: true };
    this.persist('explore');
    await this.chooseRoute();
  }

  private async chooseRoute(): Promise<void> {
    const opts = [
      { id: 'together', icon: 'together', label: '“Let’s fix it together.”' },
      { id: 'solo', icon: 'hand', label: '“I’ll do it. You can watch.”' },
    ];
    if (this.preset === 'more-exploring') {
      opts.push({ id: 'moss', icon: 'ask', label: '“Let’s ask Moss where the water should go.”' });
      opts.push({ id: 'feel', icon: 'heart', label: '“How are you feeling?”' });
    }
    let pick = await this.ask(opts);
    if (!this.alive()) return;
    if (pick === 'feel') {
      await this.line(L['fizz.feel']);
      await this.line(L['fizz.didntThink']);
      pick = await this.ask(opts.filter((o) => o.id !== 'feel'));
      if (!this.alive()) return;
    }
    if (pick === 'together') {
      this.w = { ...this.w, route: 'together' };
      await this.line(L['fizz.together']);
    } else if (pick === 'solo') {
      this.w = { ...this.w, route: 'solo' };
      await this.line(L['fizz.okAlone']);
    } else if (pick === 'moss') {
      this.w = { ...this.w, route: 'moss' };
    } else {
      this.busy = false;
      return;
    }
    this.persist('repair');
    this.busy = false;
    if (pick === 'moss') void this.askMoss();
    else void this.repairInstruction();
  }

  private async repairInstruction(): Promise<void> {
    if (this.w.route === '') return void this.chooseRoute();
    if (this.w.route === 'solo') return void this.line(L['nar.leaves'], { instruct: true });
    if (this.w.route === 'moss' && !this.w.measured) return void this.askMoss();
    void this.line(L['nar.channel'], { instruct: true });
  }

  private async askMoss(): Promise<void> {
    if (this.w.measured) return void this.repairInstruction();
    this.busy = true;
    if (this.w.route !== 'moss') this.w = { ...this.w, route: 'moss' };
    const moss = this.friends.get('moss')!;
    await this.walkFriend('moss', CHAN_X[0] - 120);
    const stick = this.img(moss.x + 40, moss.y, 'ml.measure', 49);
    await this.line(L['moss.measure']);
    stick.destroy();
    this.w = { ...this.w, measured: true };
    this.showMarks();
    await this.line(L['moss.marked']);
    this.persist('repair');
    this.busy = false;
    void this.line(L['nar.channel'], { instruct: true });
  }

  private showMarks(): void {
    for (const m of this.marks) m.destroy();
    this.marks = CHAN_X.map((x, i) => this.img(x, CHAN_Y - 8, 'ml.mark', 13).setVisible(i >= this.w.channel));
  }

  // ================================================================ repairing

  private takeStone(): void {
    if (this.carrying) return;
    this.pickUp('stone', 'ml.stone');
    // Fizz carries the other end when you're doing it together
    if (this.w.route !== 'solo') void this.walkFriend('fizz', this.avatar.x + 120);
    void this.line(L['nar.channel'], { instruct: true });
  }

  private async placeStone(i: number): Promise<void> {
    this.hints.poke();
    if (!this.carrying) {
      void this.line(L['nar.channel'], { instruct: true });
      return;
    }
    this.busy = true;
    await new Promise<void>((r) => this.walker.walkTo(CHAN_X[i] - 110, () => r()));
    if (this.w.route !== 'solo') {
      await this.walkFriend('fizz', CHAN_X[i] + 110);
      if (this.w.channel === 0) await this.line(L['fizz.heave']);
    }
    const from = this.avatar.handWorld();
    this.drop();
    const im = this.img(from.x, from.y, 'ml.stone', 14);
    await this.tweenP({ targets: im, x: CHAN_X[i], y: CHAN_Y, duration: 400, ease: 'Quad.easeIn' });
    audio.play('thud');
    splash(this, CHAN_X[i], CHAN_Y - 20, 30);
    this.chanImgs[i] = im;
    this.marks[i]?.setVisible(false);
    this.w = addChannelStone(this.w);
    this.persist('repair');
    this.busy = false;
    if (this.w.channel >= CHANNEL_STONES) void this.waterReturns();
  }

  private async pullLeaf(im: Phaser.GameObjects.Image): Promise<void> {
    this.hints.poke();
    if (Math.abs(this.avatar.x - im.x) > 260) {
      this.goDo(im.x, () => void this.pullLeaf(im));
      return;
    }
    audio.play('rustle', { pitch: 1.2 });
    this.tweens.add({ targets: im, y: im.y - 80, x: im.x + 60, alpha: 0, angle: 90, duration: 500, onComplete: () => im.setVisible(false) });
    this.w = removeLeaf(this.w);
    this.persist('repair');
    if (this.w.leaves <= 0) void this.waterReturns();
  }

  private updatePool(): void {
    const f = flow(this.w);
    this.pool.setScale(f.pool ? 1 : 0.35, f.pool ? 1 : 0.4).setAlpha(f.pool ? 1 : 0.6);
  }

  /** The water finds its way back down to the wheel. */
  private async waterReturns(): Promise<void> {
    this.busy = true;
    const f = flow(this.w);
    audio.play('splash');
    this.updatePool();
    this.focus.x = MILL.damX;
    this.camFocus = () => this.focus.x;
    this.water.setAlpha(0);
    this.tweens.add({ targets: this.water, alpha: 1, duration: 1400 });
    await this.tweenP({ targets: this.focus, x: MILL.wheelX + 200, duration: motion.reduced ? 10 : 2200, ease: 'Sine.easeInOut' });
    this.setRunning(true);
    await this.line(L['rowan.turning']);
    if (this.w.route === 'solo' && !f.pool) await this.line(L['fizz.poolGone']);
    if (this.w.route !== 'solo') await this.line(L['fizz.both']);
    await this.line(this.w.route === 'solo' ? L['rowan.lightsSolo'] : L['rowan.lights']);
    const how = this.w.route === 'solo' ? 'cleared the leaf dam' : this.w.route === 'moss' ? 'asked Moss to measure, then built a side channel' : 'built a side channel with Fizz';
    await this.complete({ id: 'mill-wheel', data: { route: this.w.route } }, `Found out why the waterwheel stopped (Fizz’s leaf dam) and ${how}.`, 'Paddle wheel', { water: JSON.stringify(this.w) });
    await this.line(L['nar.wheel']);
    this.busy = false;
    // keep the turning wheel in view until the child decides what's next
    void this.endChoices().then(() => (this.camFocus = null));
  }

  private setRunning(animate: boolean): void {
    this.spinning = true;
    for (const l of this.millLights) {
      if (animate && !motion.reduced) this.tweens.add({ targets: l, alpha: 1, duration: 800, delay: 400 });
      else l.setAlpha(1);
    }
    if (animate) sparkle(this, HOUSE_X, groundY(HOUSE_X) - 260, 14, 60);
  }

  protected demo(): void {
    if (this.busy) return;
    const tap = (x: number, y: number) => void this.hand.tapAt(x, y, 2);
    if (!this.w.fizzMet) {
      const next = Object.entries(CLUE_AT).find(([c]) => !this.w.clues.includes(c));
      if (next) return tap(next[1].x, next[1].y - 30);
      return tap(MILL.poolX, GROUND_Y - 40);
    }
    if (this.w.route === 'solo') {
      const leaf = this.leafImgs.find((l) => l.visible);
      if (leaf) return tap(leaf.x, leaf.y);
    }
    if (this.channelOpen()) {
      if (this.w.route === 'moss' && !this.w.measured) return tap(this.friends.get('moss')!.x, groundY(MOSS_X) - 100);
      if (!this.carrying) return tap(PILE_X, groundY(PILE_X) - 50);
      return tap(CHAN_X[this.w.channel], CHAN_Y - 20);
    }
    const fz = this.friends.get('fizz')!;
    tap(fz.x, fz.y - 110);
  }

  private tweenP(cfg: Phaser.Types.Tweens.TweenBuilderConfig): Promise<void> {
    return new Promise((r) => {
      if (motion.reduced) cfg.duration = Math.min(Number(cfg.duration ?? 200), 160);
      this.tweens.add({ ...cfg, onComplete: () => r() });
    });
  }

  override inspect(): Record<string, unknown> {
    const f = flow(this.w);
    return {
      checkpoint: this.quest()?.checkpoint ?? 'intro',
      done: this.quest()?.status === 'done',
      leaves: this.w.leaves,
      channel: this.w.channel,
      clues: this.w.clues,
      fizzMet: this.w.fizzMet,
      measured: this.w.measured,
      route: this.w.route,
      wheel: f.wheel,
      pool: f.pool,
      spinning: this.spinning,
      carrying: this.carrying?.kind ?? null,
      busy: this.busy,
      avatarX: Math.round(this.avatar?.x ?? 0),
    };
  }
}
