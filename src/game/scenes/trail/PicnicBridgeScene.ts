import Phaser from 'phaser';
import { TrailScene, groundY } from './TrailScene';
import { registerPieces } from '../../../art/registry';
import { STREAM, TRAIL_ADVENTURE_PIECES } from '../../../art/scenes/trailAdventures';
import { splash, sparkle, dust } from '../../systems/fx';
import { CAST_RIGS, type CastId } from '../../../art/cast';
import { audio } from '../../../core/audio';
import { motion } from '../../../core/motion';
import {
  CROSSERS,
  LOG_SPOTS,
  PLANK_SPOTS,
  canCross,
  cross,
  everyoneAcross,
  fishBack,
  logLane,
  newBridge,
  placePlank,
  placeStone,
  plankLane,
  rollLog,
  stoneLane,
  tie,
  type BridgeState,
} from '../../../content/trail/adventures';
import { BRIDGE_LINES } from '../../../content/trail/adventureLines';

registerPieces(TRAIL_ADVENTURE_PIECES);

const L = BRIDGE_LINES;
const PLANK_X = [1420, 1600, 1780];
const PLANK_Y = 836;
const STONE_X: Record<number, number[]> = { 3: [1420, 1600, 1780], 4: [1380, 1520, 1660, 1800] };
const STONE_Y = 950;
const ROCK_X = [1440, 1600, 1760];
const ROCK_Y = 772;
const WAIT_X: Record<string, number> = { rowan: 130, moss: 240, fizz: 345 };
const PICNIC_X: Record<string, number> = { moss: 2380, fizz: 2520, rowan: 2680 };
/** Once a way across exists, friends come and wait near the bank (in view while the child is there). */
const BANK_X: Record<string, number> = { rowan: 500, moss: 610, fizz: 715 };
/** Gathering spots in two rows (front row sits in front of the path) so nothing overlaps. */
const SRC = { shed: 600, logs: 760, leaves: 900, fished: 1000, pile: 1030, rope: 1130, bank: 1200, stick: 1255 };
const FRONT = 70;
const ROW: Record<string, 'front' | 'back'> = { shed: 'front', leaves: 'front', fished: 'front', bank: 'back' };
const NEED_ART: Record<string, string> = { flat: 'br.need.flat', hop: 'br.need.hop', wide: 'br.need.wide' };

type Source = 'shed' | 'leaves' | 'bank' | 'fished';

function validBridge(x: unknown): x is BridgeState {
  const b = x as BridgeState;
  return !!b && Array.isArray(b.planks) && Array.isArray(b.stones) && Array.isArray(b.logs) && typeof b.tied === 'boolean' && ['no', 'away', 'back'].includes(b.floated) && Array.isArray(b.crossed);
}

/** The Picnic Bridge: connect both sides of Whistle Stream for three friends who need different things. */
export default class PicnicBridgeScene extends TrailScene {
  readonly artGroup = 'trail-bridge';
  readonly questId = 'picnic-bridge';
  readonly gameTheme = 'stream' as const;
  protected readonly skyColors: [string, string] = ['#9fd3e6', '#eaf5e6'];
  protected walkRange: [number, number] = [80, 1262];
  private b!: BridgeState;
  private taken: Record<Source, boolean> = { shed: false, leaves: false, bank: false, fished: false };
  private revealed = false;
  private loose = new Map<Source, Phaser.GameObjects.Image>();
  private leavesImg?: Phaser.GameObjects.Image;
  private plankImgs: (Phaser.GameObjects.Image | null)[] = [];
  private stoneImgs: (Phaser.GameObjects.Image | null)[] = [];
  private logImgs: (Phaser.GameObjects.Image | null)[] = [];
  private logPile: Phaser.GameObjects.Image[] = [];
  private ropeImg!: Phaser.GameObjects.Image;
  private stickImg!: Phaser.GameObjects.Image;
  private ties: Phaser.GameObjects.Image[] = [];
  private wagon!: Phaser.GameObjects.Image;
  private bubbles = new Map<CastId, Phaser.GameObjects.Container>();
  private floater?: Phaser.GameObjects.Image;

  constructor() {
    super('picnic-bridge');
  }

  protected extraArtKeys(): string[] {
    return TRAIL_ADVENTURE_PIECES.filter((p) => p.key.startsWith('br.') || p.key.startsWith('tr.')).map((p) => p.key);
  }

  protected buildWorld(): void {
    this.art(0, 0, 'br.far', 1);
    this.art(0, 0, 'br.ground', 2);
    this.b = this.readJSON('bridge', validBridge, newBridge(this.preset));
    const f = this.quest()?.flags ?? {};
    for (const s of ['shed', 'leaves', 'bank', 'fished'] as Source[]) this.taken[s] = f[`taken_${s}`] === true;
    this.revealed = f.revealed === true;
    // the old bridge: broken posts on both banks
    this.img(STREAM.x0 - 10, groundY(STREAM.x0 - 10) + 4, 'br.post', 10);
    this.img(STREAM.x1 + 10, groundY(STREAM.x1 + 10) + 4, 'br.post', 10);
    this.img(SRC.shed - 90, groundY(SRC.shed - 90) + 4, 'br.shed', 8);
    // the far bank's picnic spot
    this.img(2530, groundY(2530) + 40, 'br.blanket', 8);
    this.img(2360, groundY(2360) + 20, 'br.basket', 9);
    // rocks of the old log bridge (upstream) and the logs that rolled off
    ROCK_X.forEach((x) => this.img(x, ROCK_Y, 'br.rock', 6));
    for (let i = 0; i < LOG_SPOTS; i++) {
      if (this.b.logs[i]) continue;
      this.logPile.push(this.img(SRC.logs - 40 + i * 20, groundY(SRC.logs) - 70 - i * 34, 'br.log', 7).setScale(0.6));
    }
    this.addTarget({ id: 'logs', label: 'Old logs', bounds: () => this.rectAround(SRC.logs, groundY(SRC.logs) - 110, 180, 120, 6), enabled: () => !this.busy && !logLane(this.b), activate: () => this.goDo(SRC.logs, () => void this.roll()) });
    // building materials
    this.ropeImg = this.img(SRC.rope, groundY(SRC.rope) + FRONT + 4, 'br.rope', 56);
    this.stickImg = this.img(SRC.stick, groundY(SRC.stick) + 10, 'br.stick', 30);
    this.addTarget({ id: 'rope', label: 'Rope', bounds: () => this.rectAround(SRC.rope, groundY(SRC.rope) + FRONT - 22, 120, 60, 8), enabled: () => !this.busy, activate: () => this.goDo(SRC.rope, () => void this.tieRope()) });
    this.addTarget({ id: 'stick', label: 'Long stick', bounds: () => this.rectAround(SRC.stick + 6, groundY(SRC.stick) - 110, 50, 200, 6), enabled: () => !this.busy, activate: () => this.goDo(SRC.stick, () => void this.fish()) });
    this.img(SRC.pile, groundY(SRC.pile) + 10, 'br.stonepile', 30);
    this.addTarget({ id: 'stones', label: 'Stones', bounds: () => this.rectAround(SRC.pile, groundY(SRC.pile) - 50, 180, 100, 6), enabled: () => !this.busy && !stoneLane(this.b), activate: () => this.goDo(SRC.pile, () => this.takeStone()) });
    this.addLoose('shed', SRC.shed, !this.taken.shed);
    this.addLoose('bank', SRC.bank, !this.taken.bank);
    this.addLoose('leaves', SRC.leaves, !this.taken.leaves && this.revealed);
    this.addLoose('fished', SRC.fished, this.b.floated === 'back' && !this.taken.fished);
    if (!this.revealed) {
      this.leavesImg = this.img(SRC.leaves, groundY(SRC.leaves) + FRONT + 10, 'br.leaves', 57);
      this.addTarget({ id: 'leafpile', label: 'Pile of leaves', bounds: () => this.rectAround(SRC.leaves, groundY(SRC.leaves) + FRONT - 30, 200, 80, 6), enabled: () => !this.busy && !this.revealed, activate: () => this.goDo(SRC.leaves, () => void this.rummage()) });
    }
    // spots across the stream
    PLANK_X.forEach((x, i) => {
      this.plankImgs.push(this.b.planks[i] ? this.img(x, PLANK_Y, 'br.span', 20) : null);
      this.addTarget({ id: `plankspot-${i}`, label: 'Plank spot', bounds: () => this.rectAround(x, PLANK_Y, 170, 50, 14), enabled: () => !this.busy && !this.b.planks[i], activate: () => void this.placeAt('plank', i) });
    });
    const sx = STONE_X[this.b.stones.length] ?? STONE_X[3];
    sx.forEach((x, i) => {
      this.stoneImgs.push(this.b.stones[i] ? this.img(x, STONE_Y, 'br.stone', 22) : null);
      this.addTarget({ id: `stonespot-${i}`, label: 'Stone spot', bounds: () => this.rectAround(x, STONE_Y - 20, 110, 70, 14), enabled: () => !this.busy && !this.b.stones[i], activate: () => void this.placeAt('stone', i) });
    });
    ROCK_X.forEach((_, i) => this.logImgs.push(this.b.logs[i] ? this.img(ROCK_X[0] + i * 160, ROCK_Y - 36, 'br.log', 7).setScale(0.66, 0.8) : null));
    this.drawSpotHints();
    this.drawTies();
    // friends with their picnic things
    for (const c of CROSSERS) {
      const crossed = this.b.crossed.includes(c.id);
      const p = this.friend(c.id, crossed ? PICNIC_X[c.id] : WAIT_X[c.id], 1);
      if (!crossed && this.anyLane()) p.setPosition(BANK_X[c.id], groundY(BANK_X[c.id]));
      this.addTarget({ id: `friend-${c.id}`, label: c.id, priority: 4, bounds: () => this.rectAround(p.x, p.y - 110, 140, 200, 6), enabled: () => !this.busy && !this.b.crossed.includes(c.id), activate: () => void this.tryCross(c.id) });
    }
    this.wagon = this.img(this.friends.get('rowan')!.x - 150, groundY(this.friends.get('rowan')!.x - 150) + 4, 'br.wagon', 47);
    if (everyoneAcross(this.b)) this.walkRange = [80, 3100];
  }

  private addLoose(src: Source, x: number, visible: boolean): void {
    const front = ROW[src] === 'front';
    const y = groundY(x) + (front ? FRONT + 8 : 8);
    const im = this.img(x, y, 'br.plank', front ? 55 : 31).setVisible(visible);
    this.loose.set(src, im);
    this.addTarget({ id: `plank-${src}`, label: 'Plank', bounds: () => this.rectAround(x, y - 10, 200, 44, 8), enabled: () => im.visible && !this.busy, activate: () => this.goDo(x, () => this.takePlank(src)) });
  }

  private drawSpotHints(): void {
    // faint outlines show where things go (shape cue: long for planks, round for stones)
    const g = this.add.graphics().setDepth(19);
    g.lineStyle(5, 0xffffff, 0.55);
    PLANK_X.forEach((x, i) => !this.b.planks[i] && g.strokeRoundedRect(x - 120, PLANK_Y - 16, 240, 30, 10));
    (STONE_X[this.b.stones.length] ?? STONE_X[3]).forEach((x, i) => !this.b.stones[i] && g.strokeEllipse(x, STONE_Y - 18, 96, 40));
    this.spotGfx?.destroy();
    this.spotGfx = g;
  }
  private spotGfx?: Phaser.GameObjects.Graphics;

  private drawTies(): void {
    for (const t of this.ties) t.destroy();
    this.ties = [];
    if (!this.b.tied) return;
    PLANK_X.forEach((x, i) => this.b.planks[i] && this.ties.push(this.img(x - 96, PLANK_Y + 4, 'br.rope', 21).setScale(0.35)));
  }

  private persist(checkpoint = 'build'): void {
    this.saveQuest(checkpoint, {
      bridge: JSON.stringify(this.b),
      revealed: this.revealed,
      taken_shed: this.taken.shed,
      taken_leaves: this.taken.leaves,
      taken_bank: this.taken.bank,
      taken_fished: this.taken.fished,
    });
  }

  // ================================================================ story

  protected startAt(cp: string): void {
    if (cp === 'done' || everyoneAcross(this.b)) {
      this.walkRange = [80, 3100];
      this.walker.setRange(80, 3100);
      for (const c of CROSSERS) this.friends.get(c.id)?.setPosition(PICNIC_X[c.id], groundY(PICNIC_X[c.id]));
      // everyone crossed but the picnic moment was interrupted: finish it (souvenir given once)
      if (cp !== 'done') void this.finish();
      return;
    }
    if (cp === 'build') {
      this.showNeeds();
      void this.line(L['nar.gather'], { instruct: true });
      return;
    }
    void this.intro();
  }

  private async intro(): Promise<void> {
    this.busy = true;
    await this.line(L['rowan.hook']);
    if (!this.alive()) return;
    this.showNeeds();
    await this.line(L['moss.need']);
    await this.line(L['fizz.need']);
    await this.line(L['rowan.need']);
    if (!this.alive()) return;
    this.busy = false;
    this.persist('build');
    void this.line(L['nar.gather'], { instruct: true });
  }

  private showNeeds(): void {
    if (this.anyLane()) this.saidCross = true;
    for (const c of CROSSERS) {
      if (this.b.crossed.includes(c.id) || this.bubbles.has(c.id)) continue;
      this.bubbles.set(c.id, this.needBubble(c.id, NEED_ART[c.need]).setScale(0.8));
    }
  }

  // ================================================================ gathering

  private async rummage(): Promise<void> {
    this.revealed = true;
    audio.play('rustle');
    const im = this.leavesImg!;
    this.tweens.add({ targets: im, alpha: 0, y: im.y + 20, scaleX: 1.3, duration: 400, onComplete: () => im.destroy() });
    for (let i = 0; i < 5; i++) dust(this, SRC.leaves + (i - 2) * 30, im.y - 40, 2, 40);
    this.loose.get('leaves')?.setVisible(true);
    this.persist();
    await this.line(L['nar.found']);
  }

  private takePlank(src: Source): void {
    if (this.carrying) {
      void this.line(L['nar.handsFull']);
      return;
    }
    const im = this.loose.get(src)!;
    this.taken[src] = true;
    this.pickUp(`plank:${src}`, 'br.plank', im);
    this.persist();
    void this.line(L['nar.carryPlank'], { instruct: true });
  }

  private takeStone(): void {
    if (this.carrying) {
      void this.line(L['nar.handsFull']);
      return;
    }
    this.pickUp('stone', 'br.stone');
    void this.line(L['nar.carryStone'], { instruct: true });
  }

  private async placeAt(kind: 'plank' | 'stone', i: number): Promise<void> {
    this.hints.poke();
    const c = this.carrying;
    if (!c) {
      void this.line(L['nar.gather'], { instruct: true });
      return;
    }
    const isPlank = c.kind.startsWith('plank');
    if ((kind === 'plank') !== isPlank) {
      void this.line(L['nar.wrongSpot']);
      return;
    }
    // walk to the bank, then it goes into place
    this.walker.walkTo(this.walkRange[1] - 10, () => void this.finishPlace(kind, i));
  }

  private async finishPlace(kind: 'plank' | 'stone', i: number): Promise<void> {
    if (!this.carrying) return;
    this.busy = true;
    const from = this.avatar.handWorld();
    const src = this.carrying.kind.split(':')[1] as Source | undefined;
    this.drop();
    const x = kind === 'plank' ? PLANK_X[i] : (STONE_X[this.b.stones.length] ?? STONE_X[3])[i];
    const y = kind === 'plank' ? PLANK_Y : STONE_Y;
    const im = this.img(from.x, from.y, kind === 'plank' ? 'br.span' : 'br.stone', kind === 'plank' ? 20 : 22).setScale(0.6);
    await this.tweenP({ targets: im, x, y, scale: 1, duration: 500, ease: 'Quad.easeInOut' });
    audio.play(kind === 'plank' ? 'thud' : 'splash');
    if (kind === 'stone') {
      splash(this, x, y - 20, 40);
      this.b = placeStone(this.b, i);
      this.stoneImgs[i] = im;
    } else {
      const r = placePlank(this.b, i);
      this.b = r.b;
      if (r.floatsAway) {
        await this.floatAway(im, src);
        this.busy = false;
        return;
      }
      this.plankImgs[i] = im;
      if (this.b.tied) this.drawTies();
    }
    this.drawSpotHints();
    this.persist();
    this.busy = false;
    this.afterBuild();
  }

  /** The first plank floats off downstream; Moss has an idea. */
  private async floatAway(im: Phaser.GameObjects.Image, src?: Source): Promise<void> {
    void src;
    this.persist();
    this.floater = im;
    this.tweens.add({ targets: im, x: STREAM.x1 - 120, y: 1000, angle: 25, duration: motion.reduced ? 300 : 2200, ease: 'Sine.easeInOut' });
    await this.line(L['fizz.floats']);
    await this.line(L['moss.tieIdea']);
    this.stickImg.setScale(1.1);
    if (!motion.reduced) this.tweens.add({ targets: this.stickImg, angle: { from: -6, to: 6 }, duration: 300, yoyo: true, repeat: 5, onComplete: () => this.stickImg.setAngle(0) });
    await this.line(L['nar.fishIt'], { instruct: true });
  }

  private async fish(): Promise<void> {
    if (this.b.floated !== 'away') {
      audio.play('swish');
      return;
    }
    this.busy = true;
    void this.avatar.play('reach');
    audio.play('swish');
    const f = this.floater;
    if (f) await this.tweenP({ targets: f, x: SRC.fished, y: groundY(SRC.fished) + FRONT + 8, angle: 0, scale: 1, duration: 800, ease: 'Quad.easeOut' });
    f?.destroy();
    this.floater = undefined;
    this.b = fishBack(this.b);
    this.loose.get('fished')?.setVisible(true);
    this.persist();
    await this.line(L['nar.fished']);
    this.busy = false;
    if (!this.b.tied) void this.line(L['nar.tieIt'], { instruct: true });
  }

  private async tieRope(): Promise<void> {
    if (this.b.tied) {
      audio.play('rustle');
      return;
    }
    this.busy = true;
    this.b = tie(this.b);
    audio.play('stretch');
    this.drawTies();
    this.ropeImg.setAlpha(0.5);
    this.persist();
    await this.line(L['moss.tied']);
    this.busy = false;
    this.afterBuild();
  }

  /** The alternate route: roll the old logs back onto their rocks. */
  private async roll(): Promise<void> {
    const i = this.b.logs.findIndex((x) => !x);
    if (i < 0) return;
    this.busy = true;
    if (this.b.logs.every((x) => !x)) await this.line(L['nar.oldBridge']);
    const pile = this.logPile.pop();
    audio.play('thud');
    const im = this.img(pile?.x ?? SRC.logs, pile?.y ?? 700, 'br.log', 7).setScale(0.6);
    pile?.destroy();
    await this.tweenP({ targets: im, x: ROCK_X[0] + i * 160, y: ROCK_Y - 36, scaleX: 0.66, scaleY: 0.8, angle: 360, duration: 700, ease: 'Quad.easeOut' });
    im.setAngle(0);
    this.logImgs[i] = im;
    this.b = rollLog(this.b, i);
    this.persist();
    this.busy = false;
    if (this.b.logs.filter(Boolean).length === 1 && !logLane(this.b)) void this.line(L['nar.rollLog'], { instruct: true });
    this.afterBuild();
  }

  private anyLane(): boolean {
    return plankLane(this.b) || stoneLane(this.b) || logLane(this.b);
  }

  private afterBuild(): void {
    if (this.anyLane() && !this.saidCross) {
      this.saidCross = true;
      sparkle(this, (STREAM.x0 + STREAM.x1) / 2, PLANK_Y - 40, 12, 60);
      // friends come over to the bank to try it
      for (const c of CROSSERS) {
        if (this.b.crossed.includes(c.id)) continue;
        const p = this.friends.get(c.id)!;
        if (p.x < BANK_X[c.id]) void this.walkFriend(c.id, BANK_X[c.id]);
        const bub = this.bubbles.get(c.id);
        if (bub) this.tweens.add({ targets: bub, x: BANK_X[c.id], duration: motion.reduced ? 10 : Math.abs(BANK_X[c.id] - p.x) * 2.6, ease: 'Sine.easeInOut' });
      }
      void this.line(L['rowan.letsCross'], { instruct: true });
    }
  }
  private saidCross = false;

  // ================================================================ crossing

  private async tryCross(id: CastId): Promise<void> {
    this.hints.poke();
    this.busy = true;
    const p = this.friends.get(id)!;
    const r = canCross(this.b, id);
    if (!r.ok) {
      const lines: Record<string, keyof typeof L> = { noFlat: 'moss.noFlat', wobbly: 'rowan.wobbly', gap: id === 'fizz' ? 'fizz.gap' : 'rowan.gap' };
      void p.play('think');
      await this.line(L[lines[r.reason]]);
      this.busy = false;
      return;
    }
    this.bubbles.get(id)?.destroy();
    this.bubbles.delete(id);
    this.camFocus = () => p.x;
    await this.walkFriend(id, STREAM.x0 - 30);
    if (r.via === 'stones') {
      const xs = STONE_X[this.b.stones.length] ?? STONE_X[3];
      for (const x of xs) {
        audio.play('boing', { pitch: 1.3 });
        await this.tweenP({ targets: p, x, y: STONE_Y - 30, duration: 320, ease: 'Sine.easeOut' });
      }
      await this.line(L['fizz.hop']);
    } else if (r.via === 'logs') {
      await this.walkPuppet(p, STREAM.x0 + 60, ROCK_Y - 40);
      await this.walkPuppet(p, STREAM.x1 - 60, ROCK_Y - 40);
    } else {
      await this.walkPuppet(p, STREAM.x1 - 20, PLANK_Y - 6);
    }
    await this.walkFriend(id, PICNIC_X[id]);
    this.camFocus = null;
    this.b = cross(this.b, id).b;
    this.persist();
    if (id === 'moss') await this.line(L['moss.cross']);
    if (id === 'fizz' && r.via !== 'stones') await this.line(r.happy ? L['fizz.hop'] : L['fizz.walk']);
    if (id === 'rowan') await this.line(L['rowan.cross']);
    this.busy = false;
    if (everyoneAcross(this.b)) void this.finish();
  }

  private async finish(): Promise<void> {
    this.busy = true;
    await this.line(L['rowan.picnic']);
    const style = logLane(this.b) ? 'the old log bridge' : [plankLane(this.b) ? 'a tied plank bridge' : '', stoneLane(this.b) ? 'stepping stones' : ''].filter(Boolean).join(' and ');
    await this.complete({ id: 'bridge-flag', data: { style: logLane(this.b) ? 'logs' : plankLane(this.b) ? 'planks' : 'stones' } }, `Built ${style} across Whistle Stream so Moss, Fizz and Rowan could all cross.`, 'Bridge flag', {
      bridge: JSON.stringify(this.b),
      revealed: this.revealed,
    });
    this.walkRange = [80, 3100];
    this.walker.setRange(80, 3100);
    await this.line(L['nar.flag']);
    this.busy = false;
    void this.endChoices();
  }

  protected override onTick(): void {
    const r = this.friends.get('rowan');
    if (r && this.wagon) {
      this.wagon.setPosition(r.x - 150, Math.min(groundY(r.x - 150) + 4, r.y + 4));
    }
  }

  // ================================================================ help

  protected demo(): void {
    if (this.busy) return;
    const tap = (x: number, y: number) => void this.hand.tapAt(x, y, 2);
    if (this.carrying) {
      if (this.carrying.kind.startsWith('plank')) {
        const i = this.b.planks.findIndex((x) => !x);
        if (i >= 0) return tap(PLANK_X[i], PLANK_Y);
      } else {
        const i = this.b.stones.findIndex((x) => !x);
        if (i >= 0) return tap((STONE_X[this.b.stones.length] ?? STONE_X[3])[i], STONE_Y - 20);
      }
    }
    if (this.b.floated === 'away') return tap(SRC.stick + 6, groundY(SRC.stick) - 110);
    if (this.b.floated === 'back' && !this.b.tied) return tap(SRC.rope, groundY(SRC.rope) + FRONT - 22);
    const ready = CROSSERS.find((c) => !this.b.crossed.includes(c.id) && canCross(this.b, c.id).ok);
    if (ready) {
      const p = this.friends.get(ready.id)!;
      return tap(p.x, p.y - 110);
    }
    if (!plankLane(this.b)) {
      const src = (['shed', 'bank', 'fished', 'leaves'] as Source[]).find((s) => this.loose.get(s)?.visible);
      if (src) {
        const im = this.loose.get(src)!;
        return tap(im.x, im.y - 10);
      }
      if (!this.revealed) return tap(SRC.leaves, groundY(SRC.leaves) + FRONT - 30);
    }
    if (!stoneLane(this.b)) return tap(SRC.pile, groundY(SRC.pile) - 50);
  }

  private tweenP(cfg: Phaser.Types.Tweens.TweenBuilderConfig): Promise<void> {
    return new Promise((r) => {
      if (motion.reduced) cfg.duration = Math.min(Number(cfg.duration ?? 200), 160);
      this.tweens.add({ ...cfg, onComplete: () => r() });
    });
  }

  override inspect(): Record<string, unknown> {
    return {
      checkpoint: this.quest()?.checkpoint ?? 'intro',
      done: this.quest()?.status === 'done',
      planks: this.b.planks,
      stones: this.b.stones,
      logs: this.b.logs,
      tied: this.b.tied,
      floated: this.b.floated,
      crossed: this.b.crossed,
      carrying: this.carrying?.kind ?? null,
      revealed: this.revealed,
      busy: this.busy,
      avatarX: Math.round(this.avatar?.x ?? 0),
    };
  }
}

export const BRIDGE_PLANKS = PLANK_SPOTS;
void CAST_RIGS;
