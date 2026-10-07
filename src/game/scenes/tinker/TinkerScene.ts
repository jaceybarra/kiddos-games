import Phaser from 'phaser';
import { WWScene } from '../../WWScene';
import { Puppet } from '../../rig/Puppet';
import { GhostHand } from '../../systems/GhostHand';
import { Hints } from '../../systems/Hints';
import { dust, sparkle, splash } from '../../systems/fx';
import { addArt, addImage, makeImage, setPiece } from '../../../art/rasterize';
import { registerPieces, pieceSvg, getPiece } from '../../../art/registry';
import { svgDocument } from '../../../art/svg';
import { TINKER_PIECES, partArt } from '../../../art/scenes/tinker';
import { CAST_RIGS, avatarRig, rigArtKeys, type CastId } from '../../../art/cast';
import { rigSvg } from '../../../art/portrait';
import { HATS } from '../../../art/cast/hats';
import { P, hex } from '../../../art/palette';
import {
  BOARD,
  CHALLENGES,
  CHALLENGE_ORDER,
  HAT_ZONE,
  NOTES,
  SNAIL_LIMIT,
  SNAIL_LIMIT_NEGOTIATED,
  type ChallengeId,
  type ChallengeOptions,
  type NoteId,
  type Outcome,
  layoutFor,
} from '../../../content/tinker/challenges';
import { DECOR, PART_SIZE, Sim, type Part, type PartKind, type SimEvent } from '../../../content/tinker/sim';
import { TINKER_LINES, type TinkerLineId } from '../../../content/tinker/tinkerLines';
import { services, currentProfile, currentPreset, updateProfile } from '../../../app/services';
import { say, instruct, stopSpeech, type Speaker } from '../../../app/speech';
import { audio } from '../../../core/audio';
import { motion } from '../../../core/motion';
import { h, trapFocus } from '../../../ui/dom';
import { icon } from '../../../ui/icons';
import { iconDialog, toast } from '../../../ui/overlays';
import type { PresetId, Profile } from '../../../save/schema';
import { displayName } from '../../../ui/screens/profiles';

registerPieces(TINKER_PIECES);

const BX = 300;
const BY = 70;
const BS = 0.925;
const D = { bg: 0, board: 5, scenery: 8, part: 10, body: 20, ghost: 30, handle: 40, npc: 50, fx: 60 };

interface TrayItem {
  kind: PartKind;
  rot?: number;
  note?: number;
  spin?: 1 | -1;
}

interface Draft {
  parts: Part[];
  options: ChallengeOptions;
}

const CHIME_NOTE_SFX = [0, 1, 2, 3, 4];

/**
 * Tinker Grove: a construction sandbox with optional challenges. Parts behave
 * consistently (see content/tinker/sim.ts); every build can be tested with one tap.
 */
export default class TinkerScene extends WWScene {
  readonly artGroup = 'tinker';
  private preset: PresetId = 'more-help';
  private challenge: ChallengeId = 'free';
  private options: ChallengeOptions = {};
  private parts: Part[] = [];
  private partImgs = new Map<string, Phaser.GameObjects.Image>();
  private sceneryObjs: Phaser.GameObjects.GameObject[] = [];
  private selected: string | null = null;
  private inHand: TrayItem | null = null;
  private ghost?: Phaser.GameObjects.Image;
  private undoStack: Part[][] = [];
  private sim: Sim | null = null;
  private bodyImgs: Phaser.GameObjects.Image[] = [];
  private chuteImgs: (Phaser.GameObjects.Image | null)[] = [];
  private eventsSeen = 0;
  private running = false;
  private lastOutcome: Outcome | null = null;
  private boardC!: Phaser.GameObjects.Container;
  private handles: { rot: Phaser.GameObjects.Image; del: Phaser.GameObjects.Image; flip: Phaser.GameObjects.Image } | null = null;
  private moss!: Puppet;
  private host: Puppet | null = null;
  private minis = new Map<string, Puppet>();
  private needle?: Phaser.GameObjects.Image;
  private spawnPreviews: Phaser.GameObjects.Image[] = [];
  private hand!: GhostHand;
  private hints!: Hints;
  private dragging: { id: string; moved: boolean; startX: number; startY: number } | null = null;
  private tray?: HTMLElement;
  private topBar?: HTMLElement;
  private testBtn?: HTMLButtonElement;
  private overlay?: HTMLElement;
  private coBuilder: { name: string; face: string } | null = null;
  private turn = 0;
  private nextId = 1;
  private editingId: string | null = null;

  constructor() {
    super('tinker');
  }

  artKeys(): string[] {
    const keys = new Set<string>(TINKER_PIECES.map((x) => x.key));
    for (const id of ['moss', 'luma', 'pip', 'fizz', 'rowan'] as CastId[]) for (const k of rigArtKeys(CAST_RIGS[id])) keys.add(k);
    for (const hat of HATS) keys.add(hat.id);
    return [...keys];
  }

  // ================================================================ build

  build(data: Record<string, unknown>): void {
    this.preset = currentPreset('tinker');
    addArt(this, 0, 0, 'tk.bg').setDepth(D.bg);
    this.boardC = this.add.container(BX, BY).setScale(BS).setDepth(D.board);
    this.boardC.add(makeImage(this, 0, 0, 'tk.board'));
    this.moss = new Puppet(this, 150, 880, CAST_RIGS.moss, { seed: 31 });
    this.moss.setDepth(D.npc).setFacing(1);
    this.hand = new GhostHand(this);
    this.hints = new Hints(this, this.preset, () => this.demo());
    this.input.on('pointerdown', this.onDown, this);
    this.input.on('pointermove', this.onMove, this);
    this.input.on('pointerup', this.onUp, this);
    this.addTarget({ id: 'moss', label: 'Moss', bounds: () => this.rectAround(150, 780, 150, 220, 10), activate: () => void this.mossTip() });
    this.buildDom();
    audio.startMusic('tinker');
    services.hud.show(['home', 'finish', 'pause', 'replay', 'help']);
    this.onCleanup(() => {
      this.tray?.remove();
      this.topBar?.remove();
      this.overlay?.remove();
      services.hud.setExtras([], []);
      services.hud.setTurnBadge(null);
      stopSpeech();
    });
    const loadId = typeof data.load === 'string' ? data.load : null;
    const fromLoc = currentProfile().progress.location.data?.challenge as ChallengeId | undefined;
    if (loadId) this.loadCreation(loadId, !!data.play);
    else if (fromLoc && CHALLENGES[fromLoc]) this.startChallenge(fromLoc, false);
    else {
      this.startChallenge('free', false);
      this.time.delayedCall(300, () => this.openPicker(true));
    }
  }

  // ================================================================ challenges

  private draftKey(id: ChallengeId): string {
    return `tinker-draft:${id}`;
  }

  private readDraft(id: ChallengeId): Draft | null {
    const q = currentProfile().progress.quests[this.draftKey(id)];
    const raw = q?.flags.draft;
    if (typeof raw !== 'string') return null;
    try {
      const d = JSON.parse(raw) as Draft;
      if (!Array.isArray(d.parts)) return null;
      return { parts: d.parts.filter(validPart).slice(0, 36), options: d.options ?? {} };
    } catch {
      return null;
    }
  }

  private saveDraft(): void {
    const key = this.draftKey(this.challenge);
    const draft = JSON.stringify({ parts: this.parts, options: this.options });
    updateProfile((p) => {
      const prev = p.progress.quests[key];
      p.progress.quests[key] = { status: prev?.status ?? 'active', checkpoint: 'draft', flags: { ...(prev?.flags ?? {}), draft }, completions: prev?.completions ?? 0 };
    });
  }

  private startChallenge(id: ChallengeId, speak = true): void {
    this.stopRun();
    this.challenge = id;
    this.editingId = null;
    const c = CHALLENGES[id];
    const draft = this.readDraft(id);
    this.options = { ...c.defaultOptions(this.preset), ...(draft?.options ?? {}) };
    if (this.preset === 'more-help' && id === 'snail-express') this.options.hatZone = false;
    this.setParts(draft?.parts ?? []);
    this.undoStack = [];
    this.nextId = 1 + this.parts.reduce((m, p) => Math.max(m, Number(p.id.replace(/\D/g, '')) || 0), 0);
    this.buildScenery();
    this.buildTray();
    this.updateTopBar();
    updateProfile((p) => (p.progress.location = { scene: 'tinker', data: { challenge: id } }));
    if (speak) void this.introLines();
  }

  private async introLines(): Promise<void> {
    const id = this.challenge;
    if (id === 'cloud-mail') {
      await this.line('luma.mailIntro');
      await this.line('luma.mailGentle');
    } else if (id === 'snail-express') {
      await this.line('moss.snailIntro');
      await this.line('moss.dotSlow');
      if (this.options.hatZone) await this.line('fizz.hatIntro');
    } else if (id === 'acorn-crossing') await this.line('pip.acornIntro');
    else if (id === 'music-machine') await this.line(this.options.tune?.length ? 'fizz.tuneIntro' : 'fizz.musicIntro');
    else await this.line('moss.freeIntro');
    if (!this.parts.length) void instruct('moss', TINKER_LINES['moss.pickPart'].text, () => this.demo(), { puppet: this.moss });
  }

  private hostId(): CastId {
    return CHALLENGES[this.challenge].host;
  }

  private buildScenery(): void {
    for (const o of this.sceneryObjs) o.destroy();
    this.sceneryObjs = [];
    for (const m of this.minis.values()) m.destroy();
    this.minis.clear();
    this.host?.destroy();
    this.host = null;
    this.needle = undefined;
    for (const id of ['mailbox-pip', 'mailbox-rowan', 'mailbox-fizz', 'dot', 'fizz-hat', 'dropper']) this.removeTarget(id);
    const add = (o: Phaser.GameObjects.GameObject) => {
      this.sceneryObjs.push(o);
      return o;
    };
    const bimg = (x: number, y: number, key: string) => {
      const img = makeImage(this, x, y, key);
      this.boardC.add(img);
      add(img);
      return img;
    };
    const c = CHALLENGES[this.challenge];
    // fixed parts are drawn like real parts but can't be moved
    for (const p of c.fixed) {
      if (p.id.startsWith('floor')) continue;
      if (p.id === 'ledge') bimg(p.x, p.y, 'tk.ledge');
      else bimg(p.x, p.y, partArt(p.kind, p.note)).setRotation(Phaser.Math.DegToRad(p.rot)).setAlpha(0.95);
    }
    // a wooden floor strip
    const floorG = this.add.graphics();
    floorG.fillStyle(hex(P.woodDark), 1).fillRoundedRect(0, 780, 1600, 20, 6);
    this.boardC.add(floorG);
    add(floorG);
    const hostId = this.hostId();
    if (hostId !== 'moss') {
      this.host = new Puppet(this, 1870, 880, CAST_RIGS[hostId], { seed: 41 });
      this.host.setDepth(D.npc).setFacing(-1).setScale(0.95);
      this.addTarget({ id: 'host', label: 'Friend', bounds: () => this.rectAround(1870, 780, 150, 230, 10), activate: () => void this.introLines() });
    } else this.removeTarget('host');

    if (this.challenge === 'cloud-mail') {
      bimg(180, 110, 'tk.cloud');
      const friends: ('pip' | 'rowan' | 'fizz')[] = ['pip', 'rowan', 'fizz'];
      const xs = { pip: 680, rowan: 1080, fizz: 1440 };
      for (const f of friends) {
        bimg(xs[f], 740, 'tk.pad');
        bimg(xs[f] + 110, 790, `tk.mailbox.${f}`).setScale(0.8);
        const mini = new Puppet(this, BX + (xs[f] + 120) * BS, BY + 640 * BS, CAST_RIGS[f], { seed: 50 + xs[f] });
        mini.setScale(0.42).setDepth(D.scenery + 1);
        this.minis.set(f, mini);
        this.addTarget({
          id: `mailbox-${f}`,
          label: `${f} mailbox`,
          bounds: () => this.boardRect(xs[f] + 60, 680, 260, 200),
          enabled: () => !this.running,
          activate: () => this.choosePad(f),
        });
      }
      this.highlightPad();
    } else if (this.challenge === 'snail-express') {
      bimg(1450, 790, 'tk.station');
      bimg(1440, 150, 'tk.gauge').setScale(0.85);
      this.needle = bimg(1440, 150, 'tk.needle').setScale(0.85).setRotation(-1.4);
      this.addTarget({ id: 'dot', label: 'Dot the snail', bounds: () => this.boardRect(120, 200, 140, 120), enabled: () => !this.running, activate: () => void this.negotiateDot() });
      if (this.options.hatZone) {
        bimg(HAT_ZONE.x, HAT_ZONE.y, 'tk.hatzone');
        const fz = new Puppet(this, BX + (HAT_ZONE.x + 170) * BS, BY + (HAT_ZONE.y + 230) * BS, CAST_RIGS.fizz, { seed: 77, hat: 'hat.wizard' });
        fz.setScale(0.5).setDepth(D.scenery + 1);
        this.minis.set('fizz', fz);
        this.addTarget({ id: 'fizz-hat', label: 'Fizz and the big hat', bounds: () => this.boardRect(HAT_ZONE.x + 170, HAT_ZONE.y + 140, 200, 220), enabled: () => !this.running, activate: () => void this.negotiateHat() });
      }
    } else if (this.challenge === 'acorn-crossing') {
      bimg(520, 0, 'tk.water').setScale(520 / 540, 1);
      bimg(260, 600, 'tk.bank').setScale(520 / 400, 1);
      bimg(1320, 600, 'tk.bank').setScale(560 / 400, 1);
      bimg(70, 480, 'tk.tree').setScale(0.7);
    } else if (this.challenge === 'music-machine') {
      bimg(800, 60, 'tk.hopper');
      if (this.options.tune?.length) {
        // the tune card: chimes in order (dots = note)
        this.options.tune.forEach((n, i) => bimg(1180 + i * 130, 70, partArt('chime', n)).setScale(0.75));
      }
    } else {
      // free build: a dropper that cycles what falls (shown as the object itself)
      const drop = bimg(200, 30, this.dropArt()).setScale(0.8).setAlpha(0.9);
      this.addTarget({
        id: 'dropper',
        label: 'Change what drops',
        bounds: () => this.boardRect(200, 90, 120, 120),
        enabled: () => !this.running,
        activate: () => {
          const order = ['acorn', 'parcel', 'snail', 'berry'] as const;
          const i = order.indexOf((this.options.drop ?? 'acorn') as (typeof order)[number]);
          this.options.drop = order[(i + 1) % order.length];
          setPiece(drop, this.dropArt());
          audio.play('pop');
          this.saveDraft();
          this.showSpawns();
        },
      });
    }
    this.showSpawns();
  }

  /** Show what will move (Dot, the acorn…) waiting at its start, so children see where things begin. */
  private showSpawns(): void {
    for (const i of this.spawnPreviews) i.destroy();
    this.spawnPreviews = [];
    if (this.running) return;
    for (const b of CHALLENGES[this.challenge].bodies(this.options)) {
      const img = makeImage(this, b.x, b.y, `tk.${b.kind}`);
      this.boardC.add(img);
      this.spawnPreviews.push(img);
      if (!motion.reduced) this.tweens.add({ targets: img, y: b.y - 8, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
  }

  private dropArt(): string {
    return `tk.${this.options.drop ?? 'acorn'}`;
  }

  private choosePad(f: 'pip' | 'rowan' | 'fizz'): void {
    this.options.pad = f;
    audio.play('confirm');
    this.highlightPad();
    const mini = this.minis.get(f);
    if (mini) void mini.play('wave', { expression: 'excited' });
    void this.line('luma.mailChosen');
    this.saveDraft();
    this.hints.poke();
  }

  private highlightPad(): void {
    for (const [f, m] of this.minis) m.setAlpha(this.options.pad === f ? 1 : 0.65);
  }

  private async negotiateDot(): Promise<void> {
    const opts = [
      { id: 'slow', icon: 'yes', label: '“Slow ride, okay!”' },
      { id: 'faster', icon: 'ask', label: '“Can it be a bit faster?”' },
    ];
    const pick = await services.choices.ask(opts, { readAloud: true });
    if (pick === 'faster') {
      this.options.speedLimit = SNAIL_LIMIT_NEGOTIATED;
      await this.line('moss.fasterOk');
    } else if (pick === 'slow') {
      this.options.speedLimit = SNAIL_LIMIT;
      await this.line('moss.slowOk');
    }
    this.saveDraft();
  }

  private async negotiateHat(): Promise<void> {
    const opts = [
      { id: 'keep', icon: 'yes', label: '“I’ll keep the top clear”' },
      { id: 'small', icon: 'ask', label: '“Could you wear a smaller hat?”' },
    ];
    const pick = await services.choices.ask(opts, { readAloud: true });
    if (pick === 'small') {
      this.options.hatZone = false;
      await this.line('fizz.smallHat');
      this.buildScenery();
    } else if (pick === 'keep') await this.line('fizz.bigHatPlease');
    this.saveDraft();
  }

  // ================================================================ parts

  private boardRect(x: number, y: number, w: number, hgt: number): Phaser.Geom.Rectangle {
    return new Phaser.Geom.Rectangle(BX + (x - w / 2) * BS, BY + (y - hgt / 2) * BS, w * BS, hgt * BS);
  }

  private toBoard(wx: number, wy: number): { x: number; y: number } {
    return { x: (wx - BX) / BS, y: (wy - BY) / BS };
  }

  private snap(v: number): number {
    const grid = this.preset === 'more-help' ? 40 : 20;
    return Math.round(v / grid) * grid;
  }

  private insideBoard(x: number, y: number): boolean {
    return x > 0 && x < BOARD.w && y > 0 && y < BOARD.h;
  }

  private setParts(parts: Part[]): void {
    for (const img of this.partImgs.values()) img.destroy();
    this.partImgs.clear();
    for (const t of [...this.targets.keys()]) if (t.startsWith('part-')) this.removeTarget(t);
    this.parts = parts.map((p) => ({ ...p }));
    for (const p of this.parts) this.drawPart(p);
    this.select(null);
  }

  private drawPart(p: Part): void {
    const img = makeImage(this, p.x, p.y, partArt(p.kind, p.note)).setRotation(Phaser.Math.DegToRad(p.rot));
    if (p.kind === 'wheel' && p.spin === -1) img.setFlipX(true);
    this.boardC.add(img);
    this.partImgs.set(p.id, img);
    this.addTarget({
      id: `part-${p.id}`,
      label: `${p.kind}`,
      bounds: () => {
        const sz = PART_SIZE[p.kind];
        const r = Math.max(sz.w, sz.h);
        return this.boardRect(p.x, p.y, Math.max(110, Math.abs(Math.cos(Phaser.Math.DegToRad(p.rot))) * r + 40), Math.max(100, Math.abs(Math.sin(Phaser.Math.DegToRad(p.rot))) * r + sz.h + 40));
      },
      enabled: () => !this.running && !this.inHand,
      activate: () => this.select(p.id),
      priority: 4,
    });
  }

  private refreshPart(p: Part): void {
    const img = this.partImgs.get(p.id);
    if (!img) return;
    img.setPosition(p.x, p.y).setRotation(Phaser.Math.DegToRad(p.rot));
    if (p.kind === 'wheel') img.setFlipX(p.spin === -1);
    if (p.kind === 'fan') img.setFlipY(false);
  }

  private pushUndo(): void {
    this.undoStack.push(this.parts.map((p) => ({ ...p })));
    if (this.undoStack.length > 30) this.undoStack.shift();
  }

  private place(item: TrayItem, x: number, y: number): void {
    if (this.parts.length >= 36) {
      audio.play('oops');
      return;
    }
    this.pushUndo();
    const p: Part = { id: `p${this.nextId++}`, kind: item.kind, x: this.snap(x), y: this.snap(y), rot: item.rot ?? 0, ...(item.note !== undefined ? { note: item.note } : {}), ...(item.kind === 'wheel' ? { spin: item.spin ?? 1 } : {}) };
    this.parts.push(p);
    this.drawPart(p);
    const img = this.partImgs.get(p.id)!;
    img.setScale(0.6);
    this.tweens.add({ targets: img, scale: 1, duration: motion.reduced ? 1 : 220, ease: 'Back.easeOut' });
    audio.play('place', { pitch: 0.9 + Math.random() * 0.2 });
    dust(this, BX + p.x * BS, BY + (p.y + 10) * BS, 5, D.fx);
    this.saveDraft();
    this.select(p.id);
    this.hints.poke();
    if (this.parts.filter((x) => !DECOR.includes(x.kind)).length === 1 && this.challenge !== 'free') {
      void instruct('moss', TINKER_LINES['moss.test'].text, () => this.testBtn && this.glowTest(), { puppet: this.moss });
    }
  }

  private select(id: string | null): void {
    this.selected = id;
    this.handles?.rot.destroy();
    this.handles?.del.destroy();
    this.handles?.flip.destroy();
    this.handles = null;
    for (const t of ['h-rot', 'h-del', 'h-flip']) this.removeTarget(t);
    for (const [pid, img] of this.partImgs) img.setTint(pid === id ? 0xfff2c4 : 0xffffff);
    if (!id) return;
    const p = this.parts.find((x) => x.id === id);
    if (!p) return;
    const pos = () => {
      const sz = PART_SIZE[p.kind];
      const half = Math.max(sz.w, sz.h) / 2;
      return { rx: BX + (p.x - half - 30) * BS, ry: BY + (p.y - 90) * BS, dx: BX + (p.x + half + 30) * BS, dy: BY + (p.y - 90) * BS, fx: BX + p.x * BS, fy: BY + (p.y + 100) * BS };
    };
    const q = pos();
    const rot = addImage(this, q.rx, q.ry, 'tk.h.rotate').setDepth(D.handle).setScale(1.6);
    const del = addImage(this, q.dx, q.dy, 'tk.h.delete').setDepth(D.handle).setScale(1.6);
    const flip = addImage(this, q.fx, q.fy, 'tk.h.flip').setDepth(D.handle).setScale(1.6).setVisible(p.kind === 'wheel' || p.kind === 'fan' || p.kind === 'ramp' || p.kind === 'plank' || p.kind === 'curve');
    this.handles = { rot, del, flip };
    const placeHandles = () => {
      const r = pos();
      rot.setPosition(r.rx, r.ry);
      del.setPosition(r.dx, r.dy);
      flip.setPosition(r.fx, r.fy);
    };
    rot.setData('place', placeHandles);
    this.addTarget({ id: 'h-rot', label: 'Turn', bounds: () => this.rectAround(rot.x, rot.y, 110, 110, 8), enabled: () => !this.running && !!this.handles, activate: () => this.rotateSelected(), priority: 0 });
    this.addTarget({ id: 'h-del', label: 'Remove', bounds: () => this.rectAround(del.x, del.y, 110, 110, 8), enabled: () => !this.running && !!this.handles, activate: () => this.deleteSelected(), priority: 0 });
    this.addTarget({ id: 'h-flip', label: 'Flip', bounds: () => this.rectAround(flip.x, flip.y, 110, 110, 8), enabled: () => !this.running && !!this.handles && flip.visible, activate: () => this.flipSelected(), priority: 0 });
  }

  private rotateSelected(dir = 1): void {
    const p = this.parts.find((x) => x.id === this.selected);
    if (!p) return;
    this.pushUndo();
    const step = p.kind === 'fan' || p.kind === 'curve' ? 45 : this.preset === 'more-help' ? 45 : 15;
    p.rot = (((p.rot + dir * step) % 360) + 360) % 360;
    if (p.rot > 180) p.rot -= 360;
    this.refreshPart(p);
    audio.play('clack', { pitch: 1.2 });
    (this.handles?.rot.getData('place') as (() => void) | undefined)?.();
    this.saveDraft();
    this.hints.poke();
  }

  private flipSelected(): void {
    const p = this.parts.find((x) => x.id === this.selected);
    if (!p) return;
    this.pushUndo();
    if (p.kind === 'wheel') p.spin = p.spin === -1 ? 1 : -1;
    else if (p.kind === 'fan') p.rot = p.rot >= 0 ? p.rot - 180 : p.rot + 180;
    else if (p.kind === 'curve') p.rot = (p.rot + 90) % 360;
    else p.rot = -p.rot;
    this.refreshPart(p);
    audio.play('swish');
    (this.handles?.rot.getData('place') as (() => void) | undefined)?.();
    this.saveDraft();
  }

  private deleteSelected(): void {
    const id = this.selected;
    if (!id) return;
    const p = this.parts.find((x) => x.id === id);
    if (!p || p.fixed) return;
    this.pushUndo();
    this.parts = this.parts.filter((x) => x.id !== id);
    const img = this.partImgs.get(id);
    this.partImgs.delete(id);
    this.removeTarget(`part-${id}`);
    if (img) this.tweens.add({ targets: img, scale: 0, alpha: 0, duration: 180, onComplete: () => img.destroy() });
    audio.play('pop', { pitch: 0.8 });
    this.select(null);
    this.saveDraft();
  }

  private undo(): void {
    const prev = this.undoStack.pop();
    if (!prev) {
      audio.play('bonk', { pitch: 1.3 });
      return;
    }
    this.stopRun();
    this.setParts(prev);
    audio.play('back');
    this.saveDraft();
  }

  private async resetBoard(): Promise<void> {
    if (!this.parts.length) return;
    const pick = await iconDialog(services.layers.overlay, {
      buttons: [
        { id: 'keep', icon: 'back', label: 'Keep my build', kind: 'go' },
        { id: 'clear', icon: 'trash', label: 'Clear the board', kind: 'danger' },
      ],
      safeId: 'keep',
    });
    if (pick !== 'clear') return;
    this.stopRun();
    this.pushUndo();
    this.setParts([]);
    this.saveDraft();
    void this.line('moss.reset');
  }

  // ================================================================ pointer: place, drag, ghost

  private onDown(p: Phaser.Input.Pointer): void {
    if (!this.ready || this.running || this.inputLocked) return;
    if (this.inHand) return;
    const b = this.toBoard(p.worldX, p.worldY);
    if (!this.insideBoard(b.x, b.y)) return;
    // pick the top-most movable part under the pointer
    const hit = [...this.parts].reverse().find((pt) => !pt.fixed && this.targets.get(`part-${pt.id}`)?.bounds().contains(p.worldX, p.worldY));
    if (hit) this.dragging = { id: hit.id, moved: false, startX: hit.x, startY: hit.y };
  }

  private onMove(p: Phaser.Input.Pointer): void {
    if (!this.ready) return;
    const b = this.toBoard(p.worldX, p.worldY);
    if (this.inHand && this.ghost) {
      const inside = this.insideBoard(b.x, b.y);
      this.ghost.setVisible(inside).setPosition(BX + this.snap(b.x) * BS, BY + this.snap(b.y) * BS);
      return;
    }
    if (!this.dragging || !p.isDown) return;
    const part = this.parts.find((x) => x.id === this.dragging!.id);
    if (!part) return;
    if (!this.dragging.moved && p.getDistance() < 14) return;
    if (!this.dragging.moved) {
      this.dragging.moved = true;
      this.pushUndo();
      this.select(null);
    }
    part.x = Phaser.Math.Clamp(this.snap(b.x), 20, BOARD.w - 20);
    part.y = Phaser.Math.Clamp(this.snap(b.y), 20, BOARD.h - 20);
    this.refreshPart(part);
  }

  private onUp(): void {
    if (this.dragging?.moved) {
      const id = this.dragging.id;
      audio.play('place');
      this.saveDraft();
      this.dragging = null;
      this.select(id);
      this.hints.poke();
      return;
    }
    this.dragging = null;
  }

  protected override onGroundTap(x: number, y: number): void {
    if (this.running) return;
    const b = this.toBoard(x, y);
    if (this.inHand) {
      if (this.insideBoard(b.x, b.y)) {
        const item = this.inHand;
        this.place(item, Phaser.Math.Clamp(b.x, 30, BOARD.w - 30), Phaser.Math.Clamp(b.y, 30, BOARD.h - 30));
        this.dropHand();
      } else this.dropHand();
      return;
    }
    this.select(null);
  }

  private pickUp(item: TrayItem): void {
    if (this.running) this.stopRun();
    this.select(null);
    this.inHand = item;
    this.ghost?.destroy();
    this.ghost = addImage(this, BX + (BOARD.w / 2) * BS, BY + (BOARD.h / 2) * BS, partArt(item.kind, item.note)).setDepth(D.ghost).setAlpha(0.6).setScale(BS).setRotation(Phaser.Math.DegToRad(item.rot ?? 0));
    this.tweens.add({ targets: this.ghost, alpha: 0.35, duration: 500, yoyo: true, repeat: -1 });
    this.tray?.querySelectorAll('[data-part]').forEach((b) => b.setAttribute('aria-pressed', String((b as HTMLElement).dataset.part === trayKey(item))));
    audio.play('pickup');
    this.hints.poke();
  }

  private dropHand(): void {
    this.inHand = null;
    this.ghost?.destroy();
    this.ghost = undefined;
    this.tray?.querySelectorAll('[data-part]').forEach((b) => b.setAttribute('aria-pressed', 'false'));
  }

  // keyboard: arrows nudge the selected part, R turns, Delete removes, Enter tests
  protected override onArrow(dx: number, dy: number, down: boolean): void {
    if (!down || this.running) return;
    const p = this.parts.find((x) => x.id === this.selected);
    if (!p) return;
    this.pushUndo();
    const grid = this.preset === 'more-help' ? 40 : 20;
    p.x = Phaser.Math.Clamp(p.x + dx * grid, 20, BOARD.w - 20);
    p.y = Phaser.Math.Clamp(p.y + dy * grid, 20, BOARD.h - 20);
    this.refreshPart(p);
    (this.handles?.rot.getData('place') as (() => void) | undefined)?.();
    this.saveDraft();
  }

  protected override onActionKey(): void {
    void this.toggleTest();
  }

  // ================================================================ testing

  private glowTest(): void {
    this.testBtn?.classList.add('glow');
  }

  private async toggleTest(): Promise<void> {
    if (this.running || this.sim) {
      this.stopRun();
      return;
    }
    this.dropHand();
    this.select(null);
    this.testBtn?.classList.remove('glow');
    this.running = true;
    this.lastOutcome = null;
    for (const i of this.spawnPreviews) i.destroy();
    this.spawnPreviews = [];
    this.updateTopBar();
    audio.play('confirm');
    const layout = layoutFor(this.challenge, this.parts, this.options);
    this.sim = new Sim(layout);
    this.eventsSeen = 0;
    for (const b of this.sim.bodies) {
      const img = makeImage(this, b.x, b.y, `tk.${b.kind}`);
      this.boardC.add(img);
      this.bodyImgs.push(img);
      let chute: Phaser.GameObjects.Image | null = null;
      if (b.kind === 'parcel') {
        chute = makeImage(this, b.x, b.y - 10, 'tk.parachute');
        this.boardC.add(chute);
      }
      this.chuteImgs.push(chute);
    }
    this.hints.poke();
  }

  private stopRun(): void {
    const had = !!this.sim;
    this.running = false;
    this.sim = null;
    for (const i of this.bodyImgs) i.destroy();
    for (const c of this.chuteImgs) c?.destroy();
    this.bodyImgs = [];
    this.chuteImgs = [];
    this.updateTopBar();
    if (had && this.boardC) this.showSpawns();
  }

  protected override tick(_t: number, delta: number): void {
    if (this.ghost && !this.inHand) this.dropHand();
    const sim = this.sim;
    if (!sim || !this.running) return;
    sim.advance(Math.min(delta, 50) / 1000);
    sim.bodies.forEach((b, i) => {
      const img = this.bodyImgs[i];
      if (!img) return;
      img.setPosition(b.x, b.y).setRotation(b.kind === 'snail' || b.kind === 'parcel' ? 0 : b.angle);
      img.setVisible(b.alive || b.y < BOARD.h + 100);
      const ch = this.chuteImgs[i];
      if (ch) ch.setPosition(b.x, b.y - 6).setVisible(b.alive && !b.touching && b.vy > 0);
    });
    if (this.needle && sim.bodies[0]) {
      const v = Math.min(900, sim.bodies[0].maxSpeed);
      this.needle.setRotation(-1.4 + (v / 900) * 2.8);
    }
    while (this.eventsSeen < sim.events.length) this.onSimEvent(sim.events[this.eventsSeen++]);
    if (sim.done) {
      this.running = false;
      this.finishRun(sim);
    }
  }

  private onSimEvent(e: SimEvent): void {
    const wpos = (x: number, y: number) => ({ x: BX + x * BS, y: BY + y * BS });
    switch (e.type) {
      case 'chime': {
        audio.play('chime', { note: CHIME_NOTE_SFX[e.note] ?? 0 });
        const p = this.parts.find((x) => x.id === e.partId);
        const img = this.partImgs.get(e.partId);
        if (img) this.tweens.add({ targets: img, scaleY: 1.3, duration: 80, yoyo: true });
        if (p) sparkle(this, wpos(p.x, p.y).x, wpos(p.x, p.y).y, 5, D.fx);
        break;
      }
      case 'bounce': {
        audio.play('boing', { pitch: 0.9 + Math.random() * 0.3 });
        const img = this.partImgs.get(e.partId);
        if (img) this.tweens.add({ targets: img, scale: 1.15, duration: 90, yoyo: true });
        this.note('bumper');
        break;
      }
      case 'spring': {
        audio.play('boing', { pitch: 1.5 });
        const img = this.partImgs.get(e.partId);
        if (img) this.tweens.add({ targets: img, scaleY: 0.6, duration: 70, yoyo: true });
        this.note('spring');
        break;
      }
      case 'land':
        audio.play(e.speed > 400 ? 'thud' : 'clack', { vol: Math.min(1, e.speed / 600) });
        if (this.parts.find((x) => x.id === e.partId)?.kind === 'moss') this.note('moss');
        break;
      case 'splash': {
        audio.play('splash');
        const b = this.sim?.bodies[e.body];
        if (b) splash(this, wpos(b.x, 690).x, wpos(b.x, 690).y, D.fx);
        break;
      }
      case 'goal': {
        audio.play('success');
        const b = this.sim?.bodies[e.body];
        if (b) sparkle(this, wpos(b.x, b.y).x, wpos(b.x, b.y).y, 18, D.fx);
        break;
      }
      case 'lost':
        audio.play('whoosh', { pitch: 0.7 });
        break;
    }
  }

  private finishRun(sim: Sim): void {
    const c = CHALLENGES[this.challenge];
    const outcome = c.evaluate(sim.events, this.parts, this.options, this.preset);
    this.lastOutcome = outcome;
    this.updateTopBar();
    const speaker = this.host ?? this.moss;
    if (outcome.status === 'success') {
      void speaker.play('cheer', { expression: 'excited' });
      void this.moss.play('clap');
      this.recordSuccess(outcome);
    } else if (outcome.status === 'partial') {
      void speaker.play('hop', { expression: 'surprised' });
    } else if (outcome.status === 'miss') {
      void speaker.play('think', { expression: 'thinking' });
    }
    if (this.parts.some((p) => p.kind === 'fan')) this.note('fan');
    if (this.parts.some((p) => p.kind === 'wheel')) this.note('log');
    if (this.challenge === 'cloud-mail') this.note('parachute');
    if (sim.bodies.some((b) => b.maxSpeed > 650)) this.note('slope');
    if (outcome.line === 'pip.acornAcross') this.note('bridge');
    void this.line(outcome.line as TinkerLineId);
  }

  private recordSuccess(outcome: Outcome): void {
    const id = this.challenge;
    if (id === 'free') return;
    let first = false;
    updateProfile((p) => {
      first = !p.progress.done[`tinker:${id}`];
      p.progress.done[`tinker:${id}`] = (p.progress.done[`tinker:${id}`] ?? 0) + 1;
    });
    if (first) {
      const names: Record<string, string> = { 'cloud-mail': 'Cloud Mail', 'snail-express': 'Snail Express', 'acorn-crossing': 'Acorn Crossing', 'music-machine': 'Festival Music Machine' };
      const kinds = [...new Set(this.parts.map((p) => p.kind))].join(', ');
      services.save.log(services.profileId!, 'tinker', `Solved ${names[id]} in Tinker Grove using: ${kinds || 'no extra parts'}.${outcome.line === 'luma.mailDelivered' ? ` Sent the parcel to ${this.options.pad}.` : ''}`);
      services.session.made.push({ kind: 'invention', label: names[id], art: pieceSvg(CHALLENGES[id].card) });
    }
  }

  private note(id: NoteId): void {
    const key = `note:${id}`;
    if (currentProfile().progress.done[key]) return;
    updateProfile((p) => (p.progress.done[key] = 1));
    const n = NOTES[id];
    toast(services.layers.toast, n.kind === 'real' ? 'explore' : 'star', n.text, 5000);
  }

  // ================================================================ DOM: tray, top bar, extras

  private buildDom(): void {
    const btn = (ic: string, label: string, fn: () => void, attr: string) =>
      h('button', { class: 'btn-round', type: 'button', 'aria-label': label, title: label, html: icon(ic), [attr]: true, style: '--btn:64px', on: { click: () => { audio.play('tap'); fn(); } } });
    this.testBtn = h('button', {
      class: 'btn go',
      type: 'button',
      'data-test': true,
      'aria-label': 'Test it',
      style: 'min-width:110px;min-height:70px',
      on: { click: () => void this.toggleTest() },
    });
    const pickBtn = h('button', { class: 'btn', type: 'button', 'aria-label': 'Projects', 'data-projects': true, style: 'min-height:70px;padding:4px 10px', on: { click: () => this.openPicker(false) } });
    this.topBar = h(
      'div',
      { class: 'choices', role: 'toolbar', 'aria-label': 'Workshop tools', style: 'top:max(12px, env(safe-area-inset-top));bottom:auto;width:auto;gap:10px;flex-wrap:nowrap;align-items:center;max-width:calc(100vw - 2 * var(--btn) - 200px)' },
      pickBtn,
      this.testBtn,
      h('span', { style: 'width:10px' }),
      btn('undo', 'Undo', () => this.undo(), 'data-undo'),
      btn('reset', 'Clear the board', () => void this.resetBoard(), 'data-reset'),
      btn('save', 'Put on my shelf', () => void this.saveToShelf(), 'data-save'),
      btn('shelf', 'My shelf', () => this.openShelf(), 'data-shelf'),
      btn('swap', 'Pass the tools', () => void this.passTools(), 'data-pass'),
    );
    services.layers.choices.append(this.topBar);
    this.tray = h('div', {
      class: 'choices',
      role: 'toolbar',
      'aria-label': 'Parts',
      style: 'gap:8px;bottom:max(10px, env(safe-area-inset-bottom));flex-wrap:nowrap;overflow-x:auto;justify-content:flex-start;padding:4px 6px;width:auto;max-width:calc(100vw - 2 * var(--btn) - 60px)',
    });
    services.layers.choices.append(this.tray);
    services.captions.setRaised(true);
    this.onCleanup(() => services.captions.setRaised(false));
  }

  private buildTray(): void {
    if (!this.tray) return;
    const items: TrayItem[] = [];
    for (const kind of CHALLENGES[this.challenge].palette[this.preset]) {
      if (kind === 'chime') {
        const notes = this.preset === 'more-help' ? [0, 2, 4] : [0, 1, 2, 3, 4];
        for (const n of notes) items.push({ kind, note: n });
      } else if (kind === 'ramp' && this.preset === 'more-help') {
        items.push({ kind, rot: 20 }, { kind, rot: -20 });
      } else if (kind === 'fan' && this.preset === 'more-help') {
        items.push({ kind, rot: 0 }, { kind, rot: 180 });
      } else if (kind === 'ramp' || kind === 'plank' || kind === 'moss') items.push({ kind, rot: kind === 'plank' ? 0 : 15 });
      else items.push({ kind });
    }
    this.tray.replaceChildren(
      ...items.map((it) => {
        const b = h('button', {
          class: 'tile',
          type: 'button',
          'aria-label': trayLabel(it),
          'aria-pressed': 'false',
          'data-part': trayKey(it),
          style: 'width:86px;min-height:76px;padding:4px;flex:none',
          html: `<span class="part-ico" style="transform:rotate(${trayAngle(it)}deg)${it.kind === 'fan' && it.rot === 180 ? ' scaleX(-1)' : ''}">${trayIcon(it)}</span>`,
          on: { click: () => (this.inHand && trayKey(this.inHand) === trayKey(it) ? this.dropHand() : this.pickUp(it)) },
        });
        return b;
      }),
    );
  }

  private updateTopBar(): void {
    if (!this.testBtn || !this.topBar) return;
    const busy = this.running || !!this.sim;
    this.testBtn.innerHTML = icon(busy ? 'pause' : 'play');
    this.testBtn.setAttribute('aria-label', busy ? 'Stop' : 'Test it');
    this.testBtn.classList.toggle('go', !busy);
    const pick = this.topBar.querySelector('[data-projects]') as HTMLElement;
    pick.innerHTML = `<span style="display:block;width:64px;height:56px">${pieceSvg(CHALLENGES[this.challenge].card)}</span>`;
  }

  private openPicker(first: boolean): void {
    this.overlay?.remove();
    const prof = currentProfile();
    const cards = [...CHALLENGE_ORDER, 'free' as ChallengeId].map((id) => {
      const c = CHALLENGES[id];
      const done = !!prof.progress.done[`tinker:${id}`];
      return h(
        'button',
        {
          class: 'tile',
          type: 'button',
          'data-challenge': id,
          'aria-label': id === 'free' ? 'Free build' : id.replace('-', ' '),
          style: 'width:170px;min-height:190px;position:relative',
          on: {
            click: () => {
              audio.play('confirm');
              close();
              this.startChallenge(id);
            },
          },
        },
        h('span', { html: rigSvg(CAST_RIGS[c.host], { crop: 'head' }), style: 'width:70px;height:70px;display:block' }),
        h('span', { html: pieceSvg(c.card), style: 'width:120px;height:90px;display:block' }),
        done ? h('span', { html: icon('star', 40), style: 'position:absolute;top:6px;right:6px' }) : null,
      );
    });
    const panel = h('div', { class: 'panel', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Projects' }, h('div', { class: 'big-choices' }, ...cards));
    const overlay = h('div', { class: 'overlay' }, panel);
    const release = trapFocus(panel);
    const close = () => {
      release();
      overlay.remove();
      this.overlay = undefined;
    };
    overlay.addEventListener('click', (e) => e.target === overlay && !first && close());
    services.layers.overlay.append(overlay);
    this.overlay = overlay;
    if (first) void this.line('moss.welcome');
  }

  // ================================================================ shelf (saved inventions)

  private snapshotPreview(): Promise<string | undefined> {
    return new Promise((resolve) => {
      const cam = this.cameras.main;
      const x = Math.round(BX - cam.scrollX);
      const y = Math.round(BY - cam.scrollY);
      const w = Math.round(BOARD.w * BS);
      const hh = Math.round(BOARD.h * BS);
      const done = (img: unknown) => {
        try {
          const im = img as HTMLImageElement;
          const c = document.createElement('canvas');
          c.width = 320;
          c.height = 160;
          c.getContext('2d')!.drawImage(im, 0, 0, 320, 160);
          resolve(c.toDataURL('image/jpeg', 0.7));
        } catch {
          resolve(undefined);
        }
      };
      try {
        this.game.renderer.snapshotArea(x, y, w, hh, done as Phaser.Types.Renderer.Snapshot.SnapshotCallback);
      } catch {
        resolve(undefined);
      }
      setTimeout(() => resolve(undefined), 1500);
    });
  }

  private async saveToShelf(): Promise<void> {
    if (!this.parts.length) {
      audio.play('bonk', { pitch: 1.3 });
      return;
    }
    this.select(null);
    this.stopRun();
    const names: Record<ChallengeId, string> = { 'cloud-mail': 'Cloud Mail', 'snail-express': 'Snail Ride', 'acorn-crossing': 'Acorn Crossing', 'music-machine': 'Music Machine', free: 'Invention' };
    const preview = await this.snapshotPreview();
    const pid = services.profileId!;
    const existing = this.editingId && services.save.getCreation(this.editingId)?.profileId === pid ? this.editingId : undefined;
    const count = services.save.listCreations(pid, 'invention').length;
    const res = await services.save.saveCreation({
      id: existing,
      profileId: pid,
      kind: 'invention',
      name: existing ? services.save.getCreation(existing)!.name : `${names[this.challenge]} ${count + 1}`,
      data: { v: 1, challenge: this.challenge, parts: this.parts, options: this.options },
      preview,
    });
    if (res.ok) {
      this.editingId = res.id ?? null;
      audio.play('success');
      void this.line('moss.saved');
      if (!existing) services.session.made.push({ kind: 'invention', label: names[this.challenge], art: preview ? `<img src="${preview}" alt="">` : undefined });
      if (!currentProfile().progress.display.invention && res.id) updateProfile((p) => (p.progress.display.invention = res.id!));
    } else if (res.reason === 'full') {
      void this.line('moss.shelfFull');
      this.openShelf(true);
    } else {
      toast(services.layers.toast, 'gear', 'Couldn’t save just now (see the grown-up area).');
    }
  }

  private openShelf(makeRoom = false): void {
    this.overlay?.remove();
    const pid = services.profileId!;
    const list = services.save.listCreations(pid, 'invention');
    const display = currentProfile().progress.display.invention;
    const grid = h('div', { class: 'shelf-grid' });
    const panel = h('div', { class: 'panel', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'My shelf' });
    const overlay = h('div', { class: 'overlay' }, panel);
    const release = trapFocus(panel);
    const close = () => {
      release();
      overlay.remove();
      this.overlay = undefined;
    };
    const render = () => {
      const items = services.save.listCreations(pid, 'invention');
      grid.replaceChildren(
        ...items.map((c) =>
          h(
            'div',
            { class: 'shelf-item', 'data-creation': c.id },
            h('button', {
              class: 'thumb',
              type: 'button',
              'aria-label': `Play ${c.name}`,
              html: c.preview ? `<img src="${c.preview}" alt="">` : icon('fix', 80),
              on: { click: () => { close(); this.loadCreation(c.id, true); } },
            }),
            h(
              'div',
              { class: 'acts' },
              h('button', { class: 'btn-round', type: 'button', 'aria-label': 'Change it', html: icon('pencil'), on: { click: () => { close(); this.loadCreation(c.id, false); } } }),
              h('button', {
                class: 'btn-round',
                type: 'button',
                'aria-label': 'Show in the clubhouse',
                'aria-pressed': String(display === c.id),
                html: icon('star'),
                style: display === c.id ? 'background:#ffe7a3' : '',
                on: {
                  click: () => {
                    updateProfile((p) => (p.progress.display.invention = c.id));
                    audio.play('sparkle');
                    void this.line('moss.shown');
                    close();
                  },
                },
              }),
              h('button', {
                class: 'btn-round',
                type: 'button',
                'aria-label': 'Throw away',
                html: icon('trash'),
                on: {
                  click: async () => {
                    const pick = await iconDialog(services.layers.overlay, {
                      art: c.preview ? `<img src="${c.preview}" alt="" style="width:240px;border-radius:14px;border:3px solid #3b2a20">` : undefined,
                      buttons: [
                        { id: 'keep', icon: 'back', label: 'Keep it', kind: 'go' },
                        { id: 'delete', icon: 'trash', label: 'Throw away', kind: 'danger' },
                      ],
                      safeId: 'keep',
                    });
                    if (pick === 'delete') {
                      await services.save.deleteCreation(c.id, pid);
                      if (this.editingId === c.id) this.editingId = null;
                      render();
                      if (makeRoom) {
                        close();
                        void this.saveToShelf();
                      }
                    }
                  },
                },
              }),
            ),
          ),
        ),
      );
      if (!items.length) grid.append(h('div', { style: 'padding:30px;text-align:center', html: icon('shelf', 120) }));
    };
    render();
    panel.append(h('div', { style: 'display:flex;justify-content:flex-end;margin-bottom:10px' }, h('button', { class: 'btn-round', type: 'button', 'aria-label': 'Close', html: icon('close'), on: { click: close } })), grid);
    services.layers.overlay.append(overlay);
    this.overlay = overlay;
    void list;
  }

  private loadCreation(id: string, play: boolean): void {
    const c = services.save.getCreation(id);
    if (!c || c.profileId !== services.profileId || c.kind !== 'invention') return;
    const d = c.data as { challenge?: ChallengeId; parts?: Part[]; options?: ChallengeOptions };
    const ch = d.challenge && CHALLENGES[d.challenge] ? d.challenge : 'free';
    this.startChallenge(ch, false);
    this.options = { ...this.options, ...(d.options ?? {}) };
    this.setParts((d.parts ?? []).filter(validPart));
    this.editingId = id;
    this.buildScenery();
    this.saveDraft();
    if (play) this.time.delayedCall(400, () => void this.toggleTest());
  }

  // ================================================================ pass the tools (shared building)

  private async passTools(): Promise<void> {
    if (!this.coBuilder) {
      const others = services.save.listProfiles().filter((p) => p.id !== services.profileId);
      const pick = await iconDialog(services.layers.overlay, {
        title: '',
        buttons: [
          ...others.slice(0, 3).map((o) => ({ id: o.id, icon: 'together', label: displayName(o) })),
          { id: 'friend', icon: 'together', label: 'A friend' },
          { id: 'cancel', icon: 'back', label: 'Not now', kind: 'go' as const },
        ],
        safeId: 'cancel',
      });
      if (pick === 'cancel') return;
      const other = others.find((o) => o.id === pick);
      this.coBuilder = other ? { name: displayName(other), face: faceOf(other) } : { name: 'Friend', face: rigSvg(avatarRig('mouse', 'leaf'), { crop: 'head' }) };
      this.turn = 0;
    }
    this.turn = 1 - this.turn;
    const me = currentProfile();
    const who = this.turn === 0 ? { name: displayName(me), face: faceOf(me) } : this.coBuilder;
    services.hud.setTurnBadge({ face: who.face, label: who.name });
    audio.play('zip');
    void this.line('moss.passTools');
  }

  // ================================================================ hints & misc

  private async mossTip(): Promise<void> {
    if (this.lastOutcome && this.lastOutcome.status !== 'success') await this.line('moss.watchFirst');
    else await this.line('moss.pickPart');
  }

  private demo(): void {
    if (this.overlay) return;
    if (this.challenge === 'cloud-mail' && !this.options.pad) {
      void this.hand.tapAt(BX + 760 * BS, BY + 720 * BS, 2);
      return;
    }
    if (!this.parts.length || !this.inHand) {
      const tile = this.tray?.querySelector('[data-part]') as HTMLElement | null;
      if (tile && !this.parts.length) {
        tile.classList.add('glow');
        setTimeout(() => tile.classList.remove('glow'), 2600);
        // then show where to put it on the board
        const ref = CHALLENGES[this.challenge].references[0]?.parts[0];
        const bx = ref?.x ?? BOARD.w / 2;
        const by = ref?.y ?? BOARD.h / 2;
        void this.hand.tapAt(BX + bx * BS, BY + by * BS, 1);
        return;
      }
    }
    if (this.inHand) {
      void this.hand.tapAt(BX + (BOARD.w / 2) * BS, BY + (BOARD.h / 2) * BS, 1);
      return;
    }
    this.glowTest();
    setTimeout(() => this.testBtn?.classList.remove('glow'), 3000);
  }

  override hint(): void {
    this.hints.request();
  }

  private line(id: TinkerLineId): Promise<void> {
    const l = TINKER_LINES[id];
    const sp = l.speaker as Speaker;
    const puppet = sp === 'moss' ? this.moss : this.host && sp === this.hostId() ? this.host : this.minis.get(sp as string);
    if (puppet && 'mood' in l && l.mood) puppet.setExpression(l.mood);
    return say(sp, l.text, { puppet });
  }

  override inspect(): Record<string, unknown> {
    return {
      challenge: this.challenge,
      preset: this.preset,
      parts: this.parts.map((p) => `${p.kind}@${p.x},${p.y},${p.rot}`),
      selected: this.selected,
      inHand: this.inHand ? trayKey(this.inHand) : null,
      running: this.running,
      outcome: this.lastOutcome,
      options: this.options,
      undo: this.undoStack.length,
      editing: this.editingId,
    };
  }
}

/** Tray icon SVG: long parts are cropped to their middle so they read as chunky at small sizes. */
function trayIcon(it: TrayItem): string {
  const key = partArt(it.kind, it.note);
  const long = it.kind === 'ramp' || it.kind === 'plank' || it.kind === 'moss';
  if (!long) return pieceSvg(key);
  const pc = getPiece(key);
  return svgDocument({ ...pc, box: [-75, -30, 150, 60] });
}

/** Icon angle in the tray: show the placement angle, but tilt long flat parts so they read at small sizes. */
function trayAngle(it: TrayItem): number {
  const long = it.kind === 'ramp' || it.kind === 'plank' || it.kind === 'moss' || it.kind === 'chime';
  if (it.kind === 'fan') return 0;
  if (long) return it.rot ? it.rot * 1.6 : -28;
  return it.rot ?? 0;
}

function trayKey(it: TrayItem): string {
  return `${it.kind}${it.note !== undefined ? `-${it.note}` : ''}${it.rot ? `@${it.rot}` : ''}`;
}

function trayLabel(it: TrayItem): string {
  const names: Partial<Record<PartKind, string>> = { ramp: 'Ramp', plank: 'Long plank', curve: 'Curvy slide', bumper: 'Bouncy mushroom', spring: 'Spring', fan: 'Leaf fan', block: 'Block', basket: 'Basket', moss: 'Slow moss', chime: 'Chime', wheel: 'Spinning log', flag: 'Flag', flower: 'Flower', bell: 'Bell', ribbon: 'Ribbon' };
  return `${names[it.kind] ?? it.kind}${it.note !== undefined ? ` ${it.note + 1} dot${it.note ? 's' : ''}` : ''}`;
}

function validPart(p: unknown): p is Part {
  const x = p as Part;
  return !!x && typeof x.id === 'string' && typeof x.kind === 'string' && Number.isFinite(x.x) && Number.isFinite(x.y) && Number.isFinite(x.rot) && x.kind in PART_SIZE && !x.fixed;
}

function faceOf(p: Profile): string {
  return rigSvg(avatarRig(p.avatar.species, p.avatar.color), { crop: 'head', hat: p.avatar.hat });
}

