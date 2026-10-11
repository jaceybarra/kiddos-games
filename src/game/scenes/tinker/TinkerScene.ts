import Phaser from 'phaser';
import { WWScene } from '../../WWScene';
import { Puppet } from '../../rig/Puppet';
import { GhostHand } from '../../systems/GhostHand';
import { Hints } from '../../systems/Hints';
import { dust, sparkle, splash } from '../../systems/fx';
import { addArt, addImage, makeImage, setPiece, textureOf } from '../../../art/rasterize';
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
  MAIL_ROUNDS,
  NOTES,
  SNAIL_LIMIT,
  SNAIL_LIMIT_NEGOTIATED,
  dedupeNotes,
  type ChallengeId,
  type ChallengeOptions,
  type MailFriend,
  type NoteId,
  type Outcome,
  layoutFor,
} from '../../../content/tinker/challenges';
import { DECOR, PART_SIZE, Sim, type Part, type PartKind, type SimEvent } from '../../../content/tinker/sim';
import { TINKER_LINES, type TinkerLineId } from '../../../content/tinker/tinkerLines';
import { services, currentProfile, currentPreset, updateProfile } from '../../../app/services';
import { say, instruct, stopSpeech, replayInstruction, type Speaker } from '../../../app/speech';
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
const D = { bg: 0, board: 5, slot: 6, star: 7, marker: 8, scenery: 8, part: 10, body: 20, ghost: 30, handle: 40, npc: 50, fx: 60 };
/** how close (board units) a dropped part must be to a dotted spot to click into it */
const SNAP_TO_SLOT = 130;
/** friends' mailboxes along the bottom of the Cloud Mail board */
const MAILBOX_X: Record<MailFriend, number> = { pip: 680, rowan: 1080, fizz: 1440 };
const CHIME_NOTE_SFX = [0, 1, 2, 3, 4];

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

/** What the child should do next. Every step has one line, one marker and one demo. */
type Step =
  | { kind: 'pick' | 'place'; slot: number; key: string }
  | { kind: 'move'; slot: number; partId: string; key: string }
  | { kind: 'remove'; partId: string; key: string }
  | { kind: 'play' | 'free' | 'none'; key: string };

/**
 * Tinker Grove: Moss's workshop. Each project shows its goal (a star where
 * the moving thing should end up), then guides one step at a time: tap the
 * glowing part, tap the dotted spot, press the green button. Parts behave
 * consistently (see content/tinker/sim.ts). A try that doesn't work shows
 * where it went (a dotted trail) and suggests one thing to change.
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
  // ---- guidance
  /** dotted spots currently shown (a known-good build to copy) */
  private plan: Part[] = [];
  private slotObjs: Phaser.GameObjects.GameObject[] = [];
  /** tries that didn't work in this round (More exploring gets clues after one) */
  private misses = 0;
  /** More exploring: which part the last tip was about (its dotted spot is shown as a clue) */
  private clueKind: PartKind | null = null;
  private lastStepKey = '';
  /** the step whose instruction is being said right now */
  private speakingStep: string | null = null;
  /** lines are said one after another so none is cut off */
  private lineChain: Promise<void> = Promise.resolve();
  /** bumped when a new run or project starts, so older sequences stop */
  private seq = 0;
  /** true while the goal is being shown or a result is being talked through */
  private busy = false;
  private goalStar?: Phaser.GameObjects.Image;
  private noteBubbles: Phaser.GameObjects.Image[] = [];
  private notesLit = 0;
  private trail?: Phaser.GameObjects.Graphics;
  private trailAt = 0;
  private endMarker?: Phaser.GameObjects.Image;
  private pointer?: HTMLElement;
  private pointerEl: HTMLElement | null = null;
  private pendingNotes: NoteId[] = [];
  private successAt = -1;

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
    this.trail = this.add.graphics();
    this.boardC.add(this.trail);
    this.moss = new Puppet(this, 150, 880, CAST_RIGS.moss, { seed: 31 });
    this.moss.setDepth(D.npc).setFacing(1);
    this.hand = new GhostHand(this);
    this.hints = new Hints(this, this.preset, () => this.demo(), () => !this.busy && !this.running && !this.overlay);
    this.input.on('pointerdown', this.onDown, this);
    this.input.on('pointermove', this.onMove, this);
    this.input.on('pointerup', this.onUp, this);
    this.addTarget({ id: 'moss', label: 'Moss', ambient: true, bounds: () => this.rectAround(150, 780, 150, 220, 10), activate: () => this.mossTip() });
    this.buildDom();
    audio.startMusic('tinker');
    services.hud.show(['home', 'finish', 'pause', 'replay', 'help']);
    this.onCleanup(() => {
      this.tray?.remove();
      this.topBar?.remove();
      this.overlay?.remove();
      this.pointer?.remove();
      this.seq++;
      services.hud.setExtras([], []);
      services.hud.setTurnBadge(null);
      stopSpeech();
    });
    const loadId = typeof data.load === 'string' ? data.load : null;
    const loc = currentProfile().progress.location;
    const fromLoc = loc.scene === 'tinker' ? (loc.data?.challenge as ChallengeId | undefined) : undefined;
    if (loadId) this.loadCreation(loadId, !!data.play);
    else if (fromLoc && CHALLENGES[fromLoc]) this.startChallenge(fromLoc);
    else if (this.firstVisit()) this.startChallenge('cloud-mail');
    else {
      this.startChallenge('free', false);
      this.time.delayedCall(300, () => this.openPicker(true));
    }
  }

  /** Never been here: go straight to the first project instead of a menu. */
  private firstVisit(): boolean {
    const prof = currentProfile();
    const touched = (k: string) => k.startsWith('tinker:') || k.startsWith('tinker-draft:');
    return !Object.keys(prof.progress.done).some(touched) && !Object.keys(prof.progress.quests).some(touched);
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
    this.seq++;
    this.busy = false;
    this.challenge = id;
    this.editingId = null;
    const c = CHALLENGES[id];
    const draft = this.readDraft(id);
    this.options = { ...c.defaultOptions(this.preset), ...(draft?.options ?? {}) };
    if (this.preset === 'more-help' && id === 'snail-express') this.options.hatZone = false;
    let parts = draft?.parts ?? [];
    if (id === 'cloud-mail') {
      const delivered = (this.options.delivered ?? []).filter((f) => MAIL_ROUNDS.includes(f));
      // every friend already has a lantern: start a fresh round of deliveries
      if (delivered.length >= MAIL_ROUNDS.length) {
        this.options.delivered = [];
        parts = [];
      } else this.options.delivered = delivered;
      this.options.pad = MAIL_ROUNDS.find((f) => !this.options.delivered!.includes(f)) ?? 'pip';
    }
    this.setParts(parts);
    this.undoStack = [];
    this.nextId = 1 + this.parts.reduce((m, p) => Math.max(m, Number(p.id.replace(/\D/g, '')) || 0), 0);
    this.misses = 0;
    this.clueKind = null;
    this.lastOutcome = null;
    this.lastStepKey = '';
    this.clearTrail();
    this.buildScenery();
    this.buildTray();
    this.updateTopBar();
    this.refreshPlan();
    updateProfile((p) => (p.progress.location = { scene: 'tinker', data: { challenge: id } }));
    if (speak) void this.introduce();
    else this.guide();
  }

  /** Show the goal (a ghost travels to the star) while the host says what we're making, then the first step. */
  private async introduce(): Promise<void> {
    const my = ++this.seq;
    this.busy = true;
    this.guide();
    const c = CHALLENGES[this.challenge];
    this.showGoal();
    // free build has no goal: its opening line is the step itself
    if (this.challenge !== 'free') await this.line(c.intro(this.options, this.preset));
    if (my !== this.seq) return;
    if (this.challenge === 'snail-express' && this.options.hatZone) await this.line('fizz.hatIntro');
    if (my !== this.seq) return;
    this.busy = false;
    this.guide(true);
  }

  private hostId(): CastId {
    return CHALLENGES[this.challenge].host;
  }

  private buildScenery(): void {
    for (const o of this.sceneryObjs) {
      this.tweens.killTweensOf(o);
      o.destroy();
    }
    this.sceneryObjs = [];
    for (const m of this.minis.values()) m.destroy();
    this.minis.clear();
    this.host?.destroy();
    this.host = null;
    this.needle = undefined;
    this.goalStar = undefined;
    this.noteBubbles = [];
    for (const id of ['mailbox-pip', 'mailbox-rowan', 'mailbox-fizz', 'dot', 'fizz-hat', 'dropper']) this.removeTarget(id);
    const add = <T extends Phaser.GameObjects.GameObject>(o: T): T => {
      this.sceneryObjs.push(o);
      return o;
    };
    const bimg = (x: number, y: number, key: string) => {
      const img = makeImage(this, x, y, key);
      this.boardC.add(img);
      return add(img);
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
      this.host = new Puppet(this, 1850, 880, CAST_RIGS[hostId], { seed: 41 });
      this.host.setDepth(D.npc).setFacing(-1).setScale(0.9);
      this.addTarget({ id: 'host', label: 'Friend', ambient: true, bounds: () => this.rectAround(1850, 780, 150, 230, 10), activate: () => this.hostTap() });
    } else this.removeTarget('host');

    if (this.challenge === 'cloud-mail') {
      bimg(180, 110, 'tk.cloud');
      for (const f of MAIL_ROUNDS) {
        const x = MAILBOX_X[f];
        bimg(x, 740, 'tk.pad');
        bimg(x + 110, 790, `tk.mailbox.${f}`).setScale(0.8);
        if (this.options.delivered?.includes(f)) bimg(x + 175, 700, 'tk.lantern').setScale(0.9);
        const mini = new Puppet(this, BX + (x + 120) * BS, BY + 640 * BS, CAST_RIGS[f], { seed: 50 + x });
        mini.setScale(0.42).setDepth(D.scenery + 1);
        this.minis.set(f, mini);
        this.addTarget({
          id: `mailbox-${f}`,
          label: `${f} mailbox`,
          ambient: true,
          bounds: () => this.boardRect(x + 60, 680, 260, 200),
          enabled: () => !this.running,
          activate: () => {
            audio.play('chirp');
            void mini.play(this.options.pad === f ? 'wave' : 'hop', { expression: 'happy' });
          },
        });
      }
      this.highlightPad();
    } else if (this.challenge === 'snail-express') {
      bimg(1450, 790, 'tk.station');
      bimg(1440, 150, 'tk.gauge').setScale(0.85);
      this.needle = bimg(1440, 150, 'tk.needle').setScale(0.85).setRotation(-1.4);
      this.addTarget({ id: 'dot', label: 'Dot the snail', ambient: true, bounds: () => this.boardRect(120, 200, 140, 120), enabled: () => !this.running, activate: () => void this.negotiateDot() });
      if (this.options.hatZone) {
        bimg(HAT_ZONE.x, HAT_ZONE.y, 'tk.hatzone');
        const fz = new Puppet(this, BX + (HAT_ZONE.x + 170) * BS, BY + (HAT_ZONE.y + 230) * BS, CAST_RIGS.fizz, { seed: 77, hat: 'hat.wizard' });
        fz.setScale(0.5).setDepth(D.scenery + 1);
        this.minis.set('fizz', fz);
        this.addTarget({ id: 'fizz-hat', label: 'Fizz and the big hat', ambient: true, bounds: () => this.boardRect(HAT_ZONE.x + 170, HAT_ZONE.y + 140, 200, 220), enabled: () => !this.running, activate: () => void this.negotiateHat() });
      }
    } else if (this.challenge === 'acorn-crossing') {
      bimg(520, 0, 'tk.water').setScale(520 / 540, 1);
      bimg(260, 600, 'tk.bank').setScale(520 / 400, 1);
      bimg(1320, 600, 'tk.bank').setScale(560 / 400, 1);
      bimg(70, 480, 'tk.tree').setScale(0.7);
    } else if (this.challenge === 'music-machine') {
      bimg(800, 60, 'tk.hopper');
      const tune = this.options.tune ?? [];
      // the tune card: chimes in order (dots = note)
      tune.forEach((n, i) => bimg(1180 + i * 130, 70, partArt('chime', n)).setScale(0.75));
      // one bubble per note to hear: they light up as the chimes ring
      for (let i = 0; i < 3; i++) this.noteBubbles.push(add(addImage(this, BX + (1180 + i * 130) * BS, BY + (tune.length ? 170 : 80) * BS, 'tk.note').setDepth(D.star).setScale(0.9)));
    } else {
      // free build: a dropper that cycles what falls (shown as the object itself)
      const drop = bimg(200, 30, this.dropArt()).setScale(0.8).setAlpha(0.9);
      this.addTarget({
        id: 'dropper',
        label: 'Change what drops',
        ambient: true,
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
    // the goal: a big friendly star where the moving thing should end up
    const goal = c.goal(this.options);
    if (goal) {
      const star = add(addImage(this, BX + goal.x * BS, BY + goal.y * BS, 'tk.star').setDepth(D.star));
      this.goalStar = star;
      if (!motion.reduced) {
        this.tweens.add({ targets: star, y: star.y - 14, duration: 800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        this.tweens.add({ targets: star, angle: { from: -8, to: 8 }, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      }
    }
    this.showSpawns();
  }

  /** Show what will move (Dot, the acorn…) waiting at its start, so children see where things begin. */
  private showSpawns(): void {
    for (const i of this.spawnPreviews) i.destroy();
    this.spawnPreviews = [];
    if (this.running || this.sim) return;
    for (const b of CHALLENGES[this.challenge].bodies(this.options)) {
      const img = makeImage(this, b.x, b.y, `tk.${b.kind}`);
      this.boardC.add(img);
      this.spawnPreviews.push(img);
      if (!motion.reduced) this.tweens.add({ targets: img, y: b.y - 8, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
  }

  /**
   * "Get it from here to there": a dotted path from the start to the star with a
   * ghost of the moving thing travelling along it. Music shows its note bubbles
   * lighting up one, two, three instead.
   */
  private showGoal(): void {
    const c = CHALLENGES[this.challenge];
    const goal = c.goal(this.options);
    const body = c.bodies(this.options)[0];
    if (this.challenge === 'music-machine') {
      this.noteBubbles.forEach((b, i) =>
        this.time.delayedCall(500 + i * 450, () => {
          if (!b.active) return;
          setPiece(b, 'tk.note.on');
          audio.play('chime', { note: [0, 2, 4][i] });
          this.tweens.add({ targets: b, scale: 1.2, duration: 160, yoyo: true });
          this.time.delayedCall(1300 - i * 300, () => b.active && !this.running && setPiece(b, 'tk.note'));
        }),
      );
      return;
    }
    if (!goal || !body) return;
    const w = (x: number, y: number) => ({ x: BX + x * BS, y: BY + y * BS });
    const a = w(body.x, body.y);
    const b = w(goal.x, goal.y);
    const ctl = { x: a.x, y: b.y };
    const at = (t: number) => ({ x: (1 - t) ** 2 * a.x + 2 * (1 - t) * t * ctl.x + t * t * b.x, y: (1 - t) ** 2 * a.y + 2 * (1 - t) * t * ctl.y + t * t * b.y });
    const g = this.add.graphics().setDepth(D.marker);
    const ghost = addImage(this, a.x, a.y, `tk.${body.kind}`).setDepth(D.marker).setAlpha(0.75).setScale(BS);
    const dots = 22;
    const drawTo = (n: number) => {
      g.clear();
      for (let i = 0; i <= n; i++) {
        const p = at(i / dots);
        g.fillStyle(0xffffff, 0.95).fillCircle(p.x, p.y, 8);
        g.lineStyle(3, hex(P.ink), 0.6).strokeCircle(p.x, p.y, 8);
      }
    };
    const finish = () => {
      ghost.destroy();
      if (this.goalStar?.active) {
        sparkle(this, this.goalStar.x, this.goalStar.y, 14, D.fx);
        this.tweens.add({ targets: this.goalStar, scale: 1.35, duration: 200, yoyo: true, ease: 'Quad.easeOut' });
      }
      audio.play('sparkle');
      this.tweens.add({ targets: g, alpha: 0, delay: 1400, duration: 600, onComplete: () => g.destroy() });
    };
    if (motion.reduced) {
      drawTo(dots);
      ghost.setPosition(b.x, b.y);
      this.time.delayedCall(600, finish);
      return;
    }
    const prog = { t: 0 };
    this.tweens.add({
      targets: prog,
      t: 1,
      delay: 300,
      duration: 1800,
      ease: 'Sine.easeInOut',
      onUpdate: () => {
        const p = at(prog.t);
        ghost.setPosition(p.x, p.y - Math.abs(Math.sin(prog.t * Math.PI * 4)) * 18);
        drawTo(Math.floor(prog.t * dots));
      },
      onComplete: finish,
    });
  }

  private dropArt(): string {
    return `tk.${this.options.drop ?? 'acorn'}`;
  }

  private highlightPad(): void {
    for (const [f, m] of this.minis) m.setAlpha(this.options.pad === f || this.options.delivered?.includes(f as MailFriend) ? 1 : 0.65);
  }

  private async negotiateDot(): Promise<void> {
    if (this.busy) return;
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
    this.guide(true);
  }

  private async negotiateHat(): Promise<void> {
    if (this.busy) return;
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
    this.guide(true);
  }

  // ================================================================ the plan (dotted spots) and the next step

  /** Which dotted spots to show: always for More help; for More exploring the first build, then clues after a try that didn't work. */
  private visiblePlan(): Part[] {
    const plan = CHALLENGES[this.challenge].plan(this.options);
    if (!plan.length) return [];
    if (this.preset === 'more-help') return plan;
    if (this.challenge === 'cloud-mail' && this.options.pad === 'pip') return plan;
    if (this.misses >= 2) return plan;
    if (this.misses >= 1 && this.clueKind) {
      const clue = plan.find((p) => p.kind === this.clueKind && !this.fills(p));
      return clue ? [clue] : [];
    }
    return [];
  }

  private refreshPlan(): void {
    this.plan = this.visiblePlan();
    for (const o of this.slotObjs) {
      this.tweens.killTweensOf(o);
      o.destroy();
    }
    this.slotObjs = [];
    for (const t of [...this.targets.keys()]) if (t.startsWith('slot-')) this.removeTarget(t);
    this.plan.forEach((s, i) => {
      const x = BX + s.x * BS;
      const y = BY + s.y * BS;
      const sz = PART_SIZE[s.kind];
      const pic = addImage(this, x, y, partArt(s.kind, s.note)).setDepth(D.slot).setScale(BS).setRotation(Phaser.Math.DegToRad(s.rot)).setAlpha(0.32);
      const ring = addImage(this, x, y, 'tk.ghost').setDepth(D.slot).setScale((Math.max(sz.w, sz.h, 120) / 120) * BS);
      if (!motion.reduced) this.tweens.add({ targets: [ring, pic], alpha: { from: 0.25, to: 0.85 }, duration: 750, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      const show = () => {
        const open = !this.fills(s) && !this.running;
        pic.setVisible(open);
        ring.setVisible(open);
      };
      ring.setData('sync', show);
      show();
      this.slotObjs.push(pic, ring);
      this.addTarget({
        id: `slot-${i}`,
        label: 'Dotted spot',
        bounds: () => this.boardRect(s.x, s.y, Math.max(170, sz.w * 0.8), Math.max(150, sz.h + 60)),
        enabled: () => !this.running && !this.fills(s),
        activate: () => this.tapSlot(i),
        priority: 1,
      });
    });
  }

  private syncSlots(): void {
    for (const o of this.slotObjs) (o.getData('sync') as (() => void) | undefined)?.();
  }

  /** Is this dotted spot taken by a part of the right kind (a fan must also blow the right way)? */
  private fills(s: Part): boolean {
    return this.parts.some((p) => sits(p, s));
  }

  private inAnySlot(p: Part): boolean {
    return this.plan.some((s) => sits(p, s));
  }

  /** The next dotted spot to fill: the one the last tip was about first, then in order. */
  private openSlot(): number {
    const clue = this.clueKind ? this.plan.findIndex((s) => s.kind === this.clueKind && !this.fills(s)) : -1;
    return clue >= 0 ? clue : this.plan.findIndex((s) => !this.fills(s));
  }

  private step(): Step {
    if (this.running || this.sim || this.overlay) return { kind: 'none', key: 'none' };
    const open = this.openSlot();
    if (open >= 0) {
      const s = this.plan[open];
      if (this.inHand && this.inHand.kind === s.kind) return { kind: 'place', slot: open, key: `place-${open}` };
      if (!this.inHand) {
        const spare = this.parts.find((p) => p.kind === s.kind && !this.inAnySlot(p));
        if (spare) return { kind: 'move', slot: open, partId: spare.id, key: `move-${open}` };
      }
      return { kind: 'pick', slot: open, key: `pick-${open}` };
    }
    const extra = this.lastOutcome && this.lastOutcome.status !== 'success' ? this.inTheWay() : undefined;
    if (extra) return { kind: 'remove', partId: extra.id, key: `remove-${extra.id}` };
    if (this.challenge === 'free') return { kind: 'free', key: 'free' };
    if (this.plan.length) return { kind: 'play', key: 'play' };
    return { kind: 'free', key: 'free' };
  }

  /** The whole plan is in place, so if a try didn't work, a part outside the dotted spots is in the way. */
  private inTheWay(): Part | undefined {
    const whole = this.plan.length > 0 && this.plan.length === CHALLENGES[this.challenge].plan(this.options).length;
    if (!whole || this.plan.some((s) => !this.fills(s))) return undefined;
    return this.parts.find((p) => !DECOR.includes(p.kind) && !this.inAnySlot(p));
  }

  private stepLine(st: Step): TinkerLineId | null {
    switch (st.kind) {
      case 'pick':
        return pickLine(this.plan[st.slot]);
      case 'place':
        return 'moss.tapSpot';
      case 'move': {
        const s = this.plan[st.slot];
        const p = this.parts.find((x) => x.id === st.partId);
        // already on the spot but facing the other way: tapping the spot turns it
        if (p && Math.hypot(p.x - s.x, p.y - s.y) <= 30) return 'moss.tapSpot';
        return this.challenge === 'cloud-mail' && this.options.pad === 'rowan' ? 'moss.dragFan' : 'moss.dragPart';
      }
      case 'remove':
        return 'moss.removeExtra';
      case 'play':
        return 'moss.test';
      case 'free':
        return this.challenge === 'free' ? 'moss.freeIntro' : 'moss.yourWay';
      default:
        return null;
    }
  }

  /** After anything changes: point at the next thing, and say it if it's a new step. */
  private guide(force = false): void {
    this.syncSlots();
    if (this.busy || this.overlay) {
      this.pointAt(null);
      return;
    }
    const st = this.step();
    if (st.kind === 'remove' && this.selected !== st.partId) this.select(st.partId);
    this.pointAt(this.stepElement(st));
    if (st.key === this.lastStepKey && !force) return;
    this.lastStepKey = st.key;
    // the child is ahead of us: an instruction for a step they've already done can stop
    if (this.speakingStep && this.speakingStep !== st.key) stopSpeech();
    const id = this.stepLine(st);
    if (!id) return;
    const l = TINKER_LINES[id];
    this.queue(async () => {
      if (this.step().key !== st.key || this.busy) return;
      this.speakingStep = st.key;
      await instruct(l.speaker as Speaker, l.text, () => this.demoFor(this.step()), { puppet: this.moss });
      if (this.speakingStep === st.key) this.speakingStep = null;
    });
  }

  /** The DOM thing to point at for this step (a tray part or the green button). */
  private stepElement(st: Step): HTMLElement | null {
    if (st.kind === 'pick') {
      const s = this.plan[st.slot];
      return (this.tray?.querySelector(`[data-part="${trayKey({ kind: s.kind, note: s.note, rot: this.trayRot(s.kind) })}"]`) as HTMLElement | null) ?? (this.tray?.querySelector(`[data-part^="${s.kind}"]`) as HTMLElement | null) ?? null;
    }
    if (st.kind === 'play') return this.testBtn ?? null;
    if (st.kind === 'free' && this.parts.some((p) => !DECOR.includes(p.kind)) && this.challenge !== 'free') return this.testBtn ?? null;
    return null;
  }

  protected override beaconTarget(): string | null {
    if (this.busy || this.running || this.overlay) return null;
    const st = this.step();
    if (st.kind === 'place' || st.kind === 'move') return `slot-${st.slot}`;
    if (st.kind === 'remove') return this.selected === st.partId && this.handles ? 'h-del' : `part-${st.partId}`;
    return null;
  }

  private demo(): void {
    this.demoFor(this.step());
  }

  private demoFor(st: Step): void {
    if (this.overlay) return;
    const el = this.stepElement(st);
    if (el) {
      el.classList.add('glow');
      setTimeout(() => el !== this.pointerEl && el.classList.remove('glow'), 2600);
      this.bouncePointer();
    }
    if (st.kind === 'place') {
      const s = this.plan[st.slot];
      void this.hand.tapAt(BX + s.x * BS, BY + s.y * BS, 2);
    } else if (st.kind === 'move') {
      const s = this.plan[st.slot];
      const p = this.parts.find((x) => x.id === st.partId);
      if (p && Math.hypot(p.x - s.x, p.y - s.y) <= 30) void this.hand.tapAt(BX + s.x * BS, BY + s.y * BS, 2);
      else if (p) void this.hand.dragFrom(BX + p.x * BS, BY + p.y * BS, BX + s.x * BS, BY + s.y * BS);
    } else if (st.kind === 'remove') {
      const del = this.handles?.del;
      if (del) void this.hand.tapAt(del.x, del.y, 2);
    } else if (st.kind === 'free' && !el) {
      const tile = this.tray?.querySelector('[data-part]') as HTMLElement | null;
      if (tile) {
        tile.classList.add('glow');
        setTimeout(() => tile.classList.remove('glow'), 2600);
      }
    }
  }

  /** Tapping a dotted spot: put the part in hand there, or move the chosen/spare part there. */
  private tapSlot(i: number): void {
    const s = this.plan[i];
    if (!s) return;
    if (this.inHand) {
      const item = this.inHand;
      this.place(item, s.x, s.y, item.kind === s.kind ? s : undefined);
      this.dropHand();
      return;
    }
    const sel = this.parts.find((p) => p.id === this.selected && p.kind === s.kind && !this.inAnySlot(p));
    const spare = sel ?? this.parts.find((p) => p.kind === s.kind && !this.inAnySlot(p));
    if (spare) {
      this.moveIntoSlot(spare, s);
      return;
    }
    // nothing to put there yet: show which part to tap
    audio.play('tap');
    this.lastStepKey = '';
    this.guide(true);
  }

  private moveIntoSlot(p: Part, s: Part): void {
    this.clearResult();
    this.pushUndo();
    p.x = s.x;
    p.y = s.y;
    p.rot = s.rot;
    const img = this.partImgs.get(p.id);
    if (img && !motion.reduced) {
      this.tweens.add({ targets: img, x: p.x, y: p.y, rotation: Phaser.Math.DegToRad(p.rot), duration: 260, ease: 'Back.easeOut', onComplete: () => this.refreshPart(p) });
    } else this.refreshPart(p);
    this.slotClick(s);
    this.select(null);
    this.saveDraft();
    this.hints.poke();
    this.guide();
  }

  private slotClick(s: Part): void {
    audio.play('snap');
    sparkle(this, BX + s.x * BS, BY + s.y * BS, 8, D.fx);
  }

  private nearestOpenSlot(kind: PartKind, x: number, y: number): Part | null {
    let best: Part | null = null;
    let bd = SNAP_TO_SLOT;
    for (const s of this.plan) {
      if (s.kind !== kind || this.fills(s)) continue;
      const d = Math.hypot(s.x - x, s.y - y);
      if (d < bd) {
        bd = d;
        best = s;
      }
    }
    return best;
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
      ambient: true,
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

  /** Put a part on the board; into a dotted spot (exact place and angle) when one is given or close by. */
  private place(item: TrayItem, x: number, y: number, slot?: Part): void {
    if (this.parts.length >= 36) {
      audio.play('oops');
      return;
    }
    this.clearResult();
    const into = slot ?? this.nearestOpenSlot(item.kind, x, y);
    this.pushUndo();
    const p: Part = {
      id: `p${this.nextId++}`,
      kind: item.kind,
      x: into ? into.x : this.snap(x),
      y: into ? into.y : this.snap(y),
      rot: into ? into.rot : (item.rot ?? 0),
      ...(item.note !== undefined ? { note: item.note } : {}),
      ...(item.kind === 'wheel' ? { spin: item.spin ?? 1 } : {}),
    };
    this.parts.push(p);
    this.drawPart(p);
    const img = this.partImgs.get(p.id)!;
    img.setScale(0.6);
    this.tweens.add({ targets: img, scale: 1, duration: motion.reduced ? 1 : 220, ease: 'Back.easeOut' });
    audio.play('place', { pitch: 0.9 + Math.random() * 0.2 });
    dust(this, BX + p.x * BS, BY + (p.y + 10) * BS, 5, D.fx);
    if (into) this.slotClick(into);
    this.saveDraft();
    // straight into a dotted spot: nothing more to adjust, so no handles in the way
    this.select(into ? null : p.id);
    this.hints.poke();
    this.guide();
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
    this.addTarget({ id: 'h-rot', label: 'Turn', ambient: true, bounds: () => this.rectAround(rot.x, rot.y, 110, 110, 8), enabled: () => !this.running && !!this.handles, activate: () => this.rotateSelected(), priority: 0 });
    this.addTarget({ id: 'h-del', label: 'Remove', ambient: true, bounds: () => this.rectAround(del.x, del.y, 110, 110, 8), enabled: () => !this.running && !!this.handles, activate: () => this.deleteSelected(), priority: 0 });
    this.addTarget({ id: 'h-flip', label: 'Flip', ambient: true, bounds: () => this.rectAround(flip.x, flip.y, 110, 110, 8), enabled: () => !this.running && !!this.handles && flip.visible, activate: () => this.flipSelected(), priority: 0 });
  }

  private rotateSelected(dir = 1): void {
    const p = this.parts.find((x) => x.id === this.selected);
    if (!p) return;
    this.clearResult();
    this.pushUndo();
    const step = p.kind === 'fan' || p.kind === 'curve' ? 45 : this.preset === 'more-help' ? 45 : 15;
    p.rot = (((p.rot + dir * step) % 360) + 360) % 360;
    if (p.rot > 180) p.rot -= 360;
    this.refreshPart(p);
    audio.play('clack', { pitch: 1.2 });
    (this.handles?.rot.getData('place') as (() => void) | undefined)?.();
    this.saveDraft();
    this.hints.poke();
    this.guide();
  }

  private flipSelected(): void {
    const p = this.parts.find((x) => x.id === this.selected);
    if (!p) return;
    this.clearResult();
    this.pushUndo();
    if (p.kind === 'wheel') p.spin = p.spin === -1 ? 1 : -1;
    else if (p.kind === 'fan') p.rot = p.rot >= 0 ? p.rot - 180 : p.rot + 180;
    else if (p.kind === 'curve') p.rot = (p.rot + 90) % 360;
    else p.rot = -p.rot;
    this.refreshPart(p);
    audio.play('swish');
    (this.handles?.rot.getData('place') as (() => void) | undefined)?.();
    this.saveDraft();
    this.guide();
  }

  private deleteSelected(): void {
    const id = this.selected;
    if (!id) return;
    const p = this.parts.find((x) => x.id === id);
    if (!p || p.fixed) return;
    this.clearResult();
    this.pushUndo();
    this.parts = this.parts.filter((x) => x.id !== id);
    const img = this.partImgs.get(id);
    this.partImgs.delete(id);
    this.removeTarget(`part-${id}`);
    if (img) this.tweens.add({ targets: img, scale: 0, alpha: 0, duration: 180, onComplete: () => img.destroy() });
    audio.play('pop', { pitch: 0.8 });
    this.select(null);
    this.saveDraft();
    this.guide();
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
    this.guide();
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
    this.lastOutcome = null;
    this.clearTrail();
    this.saveDraft();
    await this.line('moss.reset');
    this.guide(true);
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
      const s = this.nearestOpenSlot(this.inHand.kind, b.x, b.y);
      this.ghost.setVisible(inside).setPosition(BX + (s ? s.x : this.snap(b.x)) * BS, BY + (s ? s.y : this.snap(b.y)) * BS);
      return;
    }
    if (!this.dragging || !p.isDown) return;
    const part = this.parts.find((x) => x.id === this.dragging!.id);
    if (!part) return;
    if (!this.dragging.moved && p.getDistance() < 14) return;
    if (!this.dragging.moved) {
      this.dragging.moved = true;
      this.clearResult();
      this.pushUndo();
      this.select(null);
      this.hand.hide();
    }
    part.x = Phaser.Math.Clamp(this.snap(b.x), 20, BOARD.w - 20);
    part.y = Phaser.Math.Clamp(this.snap(b.y), 20, BOARD.h - 20);
    this.refreshPart(part);
    this.syncSlots();
  }

  private onUp(): void {
    if (this.dragging?.moved) {
      const id = this.dragging.id;
      this.dragging = null;
      const part = this.parts.find((x) => x.id === id);
      const s = part && !this.inAnySlot(part) ? this.nearestOpenSlot(part.kind, part.x, part.y) : null;
      if (part && s) {
        part.x = s.x;
        part.y = s.y;
        part.rot = s.rot;
        this.refreshPart(part);
        this.slotClick(s);
        this.select(null);
      } else {
        audio.play('place');
        this.select(id);
      }
      this.saveDraft();
      this.hints.poke();
      this.guide();
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
    this.guide();
  }

  private pickUp(item: TrayItem): void {
    this.clearResult();
    this.select(null);
    this.inHand = item;
    this.ghost?.destroy();
    this.ghost = addImage(this, BX + (BOARD.w / 2) * BS, BY + (BOARD.h / 2) * BS, partArt(item.kind, item.note)).setDepth(D.ghost).setAlpha(0.6).setScale(BS).setRotation(Phaser.Math.DegToRad(item.rot ?? 0));
    // the part waits over its dotted spot, if there is one
    const s = this.plan.find((x) => x.kind === item.kind && !this.fills(x));
    if (s) this.ghost.setPosition(BX + s.x * BS, BY + s.y * BS).setRotation(Phaser.Math.DegToRad(s.rot));
    else this.ghost.setVisible(false);
    this.tweens.add({ targets: this.ghost, alpha: 0.35, duration: 500, yoyo: true, repeat: -1 });
    this.tray?.querySelectorAll('[data-part]').forEach((b) => b.setAttribute('aria-pressed', String((b as HTMLElement).dataset.part === trayKey(item))));
    audio.play('pickup');
    this.hints.poke();
    this.guide();
  }

  private dropHand(): void {
    this.inHand = null;
    this.ghost?.destroy();
    this.ghost = undefined;
    this.tray?.querySelectorAll('[data-part]').forEach((b) => b.setAttribute('aria-pressed', 'false'));
    this.guide();
  }

  // keyboard: arrows nudge the selected part, R turns, Delete removes, Enter tests
  protected override onArrow(dx: number, dy: number, down: boolean): void {
    if (!down || this.running) return;
    const p = this.parts.find((x) => x.id === this.selected);
    if (!p) return;
    this.clearResult();
    this.pushUndo();
    const grid = this.preset === 'more-help' ? 40 : 20;
    p.x = Phaser.Math.Clamp(p.x + dx * grid, 20, BOARD.w - 20);
    p.y = Phaser.Math.Clamp(p.y + dy * grid, 20, BOARD.h - 20);
    this.refreshPart(p);
    (this.handles?.rot.getData('place') as (() => void) | undefined)?.();
    this.saveDraft();
    this.syncSlots();
  }

  protected override onActionKey(): void {
    void this.toggleTest();
  }

  // ================================================================ testing

  private toggleTest(): void {
    if (this.running) {
      this.stopRun();
      this.seq++;
      this.busy = false;
      this.guide(true);
      return;
    }
    // a finished try is still on show: clear it and go again
    this.stopRun();
    this.seq++;
    this.busy = false;
    this.running = true;
    this.dropHand();
    this.select(null);
    this.hand.hide();
    this.pointAt(null);
    this.lastOutcome = null;
    this.successAt = -1;
    this.clearTrail();
    for (const i of this.spawnPreviews) i.destroy();
    this.spawnPreviews = [];
    this.notesLit = 0;
    for (const b of this.noteBubbles) setPiece(b, 'tk.note');
    this.syncSlots();
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
    this.endMarker?.destroy();
    this.endMarker = undefined;
    this.updateTopBar();
    if (had && this.boardC) this.showSpawns();
    this.syncSlots();
  }

  /** The child changed something while a finished try was on show: put things back to the start. */
  private clearResult(): void {
    if (this.running) {
      this.stopRun();
      this.seq++;
      this.busy = false;
    } else if (this.sim) this.stopRun();
  }

  private clearTrail(): void {
    this.trail?.clear();
    this.trailAt = 0;
  }

  protected override tick(_t: number, delta: number): void {
    if (this.ghost && !this.inHand) this.dropHand();
    this.placePointer();
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
    // a dotted trail shows the path it took
    const b0 = sim.bodies[0];
    if (b0 && this.trail && sim.t - this.trailAt > 0.07 && b0.y < BOARD.h + 40) {
      this.trailAt = sim.t;
      this.trail.fillStyle(0xffffff, 0.85).fillCircle(b0.x, b0.y, 6);
      this.trail.lineStyle(2, hex(P.ink), 0.35).strokeCircle(b0.x, b0.y, 6);
    }
    if (this.needle && b0) {
      const v = Math.min(900, b0.maxSpeed);
      this.needle.setRotation(-1.4 + (v / 900) * 2.8);
    }
    while (this.eventsSeen < sim.events.length) this.onSimEvent(sim.events[this.eventsSeen++]);
    // music: once the song is made, finish soon rather than waiting for the berry to stop
    if (this.challenge === 'music-machine' && this.successAt < 0 && CHALLENGES[this.challenge].evaluate(sim.events, this.parts, this.options, this.preset).status === 'success') this.successAt = sim.t;
    if (sim.done || (this.successAt >= 0 && sim.t - this.successAt > 1.2)) {
      this.running = false;
      this.updateTopBar();
      void this.afterRun(sim);
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
        this.lightNotes();
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

  /** Music: light one bubble per note that counts (any new note; or the next note of the tune). */
  private lightNotes(): void {
    if (!this.sim || !this.noteBubbles.length) return;
    const notes = dedupeNotes(this.sim.events);
    const tune = this.options.tune ?? [];
    let lit = 0;
    if (tune.length) {
      for (const n of notes) if (n === tune[lit]) lit++;
    } else lit = new Set(notes).size;
    lit = Math.min(lit, this.noteBubbles.length);
    while (this.notesLit < lit) {
      const b = this.noteBubbles[this.notesLit++];
      setPiece(b, 'tk.note.on');
      this.tweens.add({ targets: b, scale: 1.25, duration: 160, yoyo: true });
      sparkle(this, b.x, b.y, 6, D.fx);
    }
  }

  // ================================================================ after a try: celebrate, or show what happened and suggest one thing

  private async afterRun(sim: Sim): Promise<void> {
    const my = ++this.seq;
    const c = CHALLENGES[this.challenge];
    const outcome = c.evaluate(sim.events, this.parts, this.options, this.preset);
    this.lastOutcome = outcome;
    this.busy = true;
    this.pointAt(null);
    if (this.parts.some((p) => p.kind === 'fan')) this.note('fan');
    if (this.parts.some((p) => p.kind === 'wheel')) this.note('log');
    if (this.challenge === 'cloud-mail') this.note('parachute');
    if (sim.bodies.some((b) => b.maxSpeed > 650)) this.note('slope');
    if (outcome.line === 'pip.acornAcross') this.note('bridge');
    const speaker = this.host ?? this.moss;
    const still = () => my === this.seq;

    if (outcome.status === 'success') {
      this.misses = 0;
      this.clueKind = null;
      this.celebrate();
      void speaker.play('cheer', { expression: 'excited' });
      if (speaker !== this.moss) void this.moss.play('clap');
      if (this.challenge === 'cloud-mail') {
        await this.deliverLantern(my);
        return;
      }
      await this.line(outcome.line as TinkerLineId);
      if (!still()) return;
      this.flushNotes();
      if (this.challenge === 'free') return this.backToBuilding(my);
      this.recordSuccess(outcome);
      await this.line('moss.nextProject');
      if (!still()) return;
      this.busy = false;
      this.stopRun();
      this.openPicker(false, true);
      return;
    }

    if (outcome.status === 'play') {
      await this.line(outcome.line as TinkerLineId);
      return this.backToBuilding(my, false);
    }

    // didn't work: show where it ended up, say what happened (funny), suggest one thing
    this.misses++;
    const b = sim.bodies[0];
    if (b) this.markEnd(b.x, b.y);
    void speaker.play(outcome.status === 'partial' ? 'hop' : 'think', { expression: outcome.status === 'partial' ? 'surprised' : 'thinking' });
    speaker.emote('question', 2600);
    await this.line(outcome.line as TinkerLineId);
    if (!still()) return;
    // with the whole plan in place, the next step (take the extra part off) says what to change
    const tip = this.inTheWay() ? null : c.tip(outcome, this.options, this.preset);
    if (tip) {
      this.clueKind = tip.kind ?? null;
      this.refreshPlan();
      // the part the tip is about glows in the tray
      if (tip.kind) {
        const tile = this.tray?.querySelector(`[data-part^="${tip.kind}"]`) as HTMLElement | null;
        tile?.classList.add('glow');
        setTimeout(() => tile && tile !== this.pointerEl && tile.classList.remove('glow'), 3000);
      }
      await this.line(tip.line);
      if (!still()) return;
    }
    return this.backToBuilding(my);
  }

  /** Put the moving thing back at its start (the trail stays) and carry on with the next step. */
  private async backToBuilding(my: number, reinstruct = true): Promise<void> {
    await this.wait(400);
    if (my !== this.seq) return;
    this.busy = false;
    this.stopRun();
    if (reinstruct) this.lastStepKey = '';
    this.guide(reinstruct);
  }

  /** Cloud Mail: the friend gets their lantern; then the next friend's parcel, or all done. */
  private async deliverLantern(my: number): Promise<void> {
    const still = () => my === this.seq;
    const f = this.options.pad ?? 'pip';
    const mini = this.minis.get(f);
    if (mini) void mini.play('cheer', { expression: 'excited' });
    this.options.delivered = [...new Set([...(this.options.delivered ?? []), f])];
    this.saveDraft();
    const lantern = addImage(this, BX + (MAILBOX_X[f] + 175) * BS, BY + 700 * BS, 'tk.lantern').setDepth(D.star).setScale(0.2);
    this.tweens.add({ targets: lantern, scale: 0.9 * BS, duration: motion.reduced ? 1 : 500, ease: 'Back.easeOut' });
    this.sceneryObjs.push(lantern);
    await this.line(`${f}.thanks` as TinkerLineId);
    if (!still()) return;
    const next = MAIL_ROUNDS.find((x) => !this.options.delivered!.includes(x));
    if (!next) {
      await this.line('luma.allDelivered');
      if (!still()) return;
      this.flushNotes();
      this.recordSuccess({ status: 'success', line: 'luma.allDelivered' });
      await this.line('moss.nextProject');
      if (!still()) return;
      this.busy = false;
      this.stopRun();
      this.openPicker(false, true);
      return;
    }
    // next parcel: the star moves to the next friend's mailbox
    this.options.pad = next;
    this.saveDraft();
    this.stopRun();
    this.clearTrail();
    this.misses = 0;
    this.clueKind = null;
    this.lastOutcome = null;
    this.buildScenery();
    this.refreshPlan();
    this.busy = false;
    void this.introduce();
  }

  private celebrate(): void {
    audio.play('sparkle');
    const at = this.goalStar ?? null;
    const cx = at?.x ?? BX + (BOARD.w / 2) * BS;
    const cy = at?.y ?? BY + 200 * BS;
    if (at) {
      this.tweens.killTweensOf(at);
      this.tweens.add({ targets: at, scale: 1.8, angle: 360, duration: motion.reduced ? 1 : 600, ease: 'Back.easeOut', yoyo: true, hold: 500 });
    }
    sparkle(this, cx, cy, 24, D.fx);
    this.confetti(cx, cy);
    if (!motion.reduced) {
      this.time.delayedCall(350, () => this.confetti(BX + 400 * BS, BY + 120 * BS));
      this.time.delayedCall(650, () => this.confetti(BX + 1200 * BS, BY + 120 * BS));
      this.cameras.main.flash(220, 255, 244, 200);
    }
    for (const m of this.minis.values()) void m.play('jump', { expression: 'excited' });
  }

  private confetti(x: number, y: number): void {
    const { texture, frame } = textureOf('fx.spark');
    const e = this.add.particles(x, y, texture, {
      frame,
      speed: { min: 260, max: 620 },
      angle: { min: 200, max: 340 },
      scale: { start: 2.2, end: 0.6 },
      rotate: { min: 0, max: 360 },
      lifespan: { min: 900, max: 1500 },
      gravityY: 700,
      tint: [hex(P.berry), hex(P.sun), hex(P.leaf), hex(P.sea), hex(P.plum)],
      emitting: false,
    });
    e.setDepth(D.fx);
    e.explode(motion.reduced ? 10 : 36);
    this.time.delayedCall(1700, () => e.destroy());
  }

  /** Where a try ended up: a pulsing ring around the moving thing, so you can see what happened. */
  private markEnd(bx: number, by: number): void {
    this.endMarker?.destroy();
    const x = BX + Phaser.Math.Clamp(bx, 30, BOARD.w - 30) * BS;
    const y = BY + Phaser.Math.Clamp(by, 30, BOARD.h - 20) * BS;
    const ring = addImage(this, x, y, 'fx.ring').setDepth(D.marker).setTint(hex(P.lantern)).setScale(1.3);
    if (!motion.reduced) this.tweens.add({ targets: ring, scale: 1.7, alpha: 0.4, duration: 500, yoyo: true, repeat: -1 });
    this.endMarker = ring;
    audio.play('wobble');
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
      const extra = id === 'cloud-mail' ? ' Sent a paper lantern to Pip, Rowan and Fizz.' : '';
      services.save.log(services.profileId!, 'tinker', `Solved ${names[id]} in Tinker Grove using: ${kinds || 'no extra parts'}.${extra}`);
      services.session.made.push({ kind: 'invention', label: names[id], art: pieceSvg(CHALLENGES[id].card) });
    }
    void outcome;
  }

  /** Discovery notes wait for a calm moment (after a success) so they never cover a step. */
  private note(id: NoteId): void {
    const key = `note:${id}`;
    if (currentProfile().progress.done[key] || this.pendingNotes.includes(id)) return;
    this.pendingNotes.push(id);
  }

  private flushNotes(): void {
    const id = this.pendingNotes.shift();
    this.pendingNotes = [];
    if (!id) return;
    updateProfile((p) => (p.progress.done[`note:${id}`] = 1));
    const n = NOTES[id];
    toast(services.layers.toast, n.kind === 'real' ? 'explore' : 'star', n.text, 4500);
  }

  // ================================================================ DOM: tray, top bar, the pointing arrow

  private buildDom(): void {
    const btn = (ic: string, label: string, fn: () => void, attr: string) =>
      h('button', { class: 'btn-round', type: 'button', 'aria-label': label, title: label, html: icon(ic), [attr]: true, style: '--btn:64px', on: { click: () => { audio.play('tap'); fn(); } } });
    this.testBtn = h('button', {
      class: 'btn go',
      type: 'button',
      'data-test': true,
      'aria-label': 'Test it',
      style: 'min-width:120px;min-height:76px',
      on: { click: () => this.toggleTest() },
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
    // a big bobbing arrow that points at the next thing to tap when it's a button (a part, the green button, a project card)
    this.pointer = h('div', {
      'aria-hidden': 'true',
      'data-pointer': true,
      style: 'position:absolute;left:0;top:0;width:48px;height:48px;pointer-events:none;display:none;z-index:5;filter:drop-shadow(0 4px 0 rgba(59,42,32,.35))',
      html: '<div style="width:48px;height:48px"><svg viewBox="0 0 64 64" width="48" height="48"><path d="M20 4 H44 V30 H58 L32 60 L6 30 H20 Z" fill="#f5c04a" stroke="#3b2a20" stroke-width="5" stroke-linejoin="round"/></svg></div>',
    });
    services.layers.toast.append(this.pointer);
    if (!motion.reduced) (this.pointer.firstElementChild as HTMLElement).animate([{ transform: 'translateY(0)' }, { transform: 'translateY(-14px)' }, { transform: 'translateY(0)' }], { duration: 900, iterations: Infinity, easing: 'ease-in-out' });
    services.captions.setRaised(true);
    this.onCleanup(() => services.captions.setRaised(false));
  }

  /** Point the arrow at a button (null hides it). The button glows too. */
  private pointAt(el: HTMLElement | null): void {
    if (el === this.pointerEl) return;
    this.pointerEl?.classList.remove('glow');
    this.pointerEl = el;
    el?.classList.add('glow');
    this.placePointer();
  }

  private placePointer(): void {
    const p = this.pointer;
    if (!p) return;
    const el = this.pointerEl;
    const topOverlay = services.layers.overlay.lastElementChild;
    const hidden = !el || !el.isConnected || el.offsetParent === null || (!!topOverlay && !topOverlay.contains(el)) || services.choices.open;
    if (hidden) {
      if (p.style.display !== 'none') p.style.display = 'none';
      return;
    }
    const host = p.parentElement!.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    // near the top of the screen: point up at it from below
    const below = r.top < 150;
    p.style.display = 'block';
    p.style.left = `${Math.round(r.left - host.left + r.width / 2 - 24)}px`;
    p.style.top = `${Math.round(below ? r.bottom - host.top + 4 : r.top - host.top - 46)}px`;
    p.style.transform = below ? 'rotate(180deg)' : '';
  }

  private bouncePointer(): void {
    if (!this.pointer || motion.reduced) return;
    this.pointer.animate([{ transform: `${this.pointer.style.transform} scale(1)` }, { transform: `${this.pointer.style.transform} scale(1.3)` }, { transform: `${this.pointer.style.transform} scale(1)` }], { duration: 500, iterations: 2 });
  }

  override onPause(): void {
    if (this.pointer) this.pointer.style.display = 'none';
  }

  /** Tray rotation of a part kind (More help has one of each, already turned the useful way). */
  private trayRot(kind: PartKind): number | undefined {
    if (kind === 'ramp') return this.preset === 'more-help' ? 20 : 15;
    if (kind === 'moss') return 15;
    return undefined;
  }

  private buildTray(): void {
    if (!this.tray) return;
    const items: TrayItem[] = [];
    for (const kind of CHALLENGES[this.challenge].palette[this.preset]) {
      if (kind === 'chime') {
        const notes = this.preset === 'more-help' ? [0, 2, 4] : [0, 1, 2, 3, 4];
        for (const n of notes) items.push({ kind, note: n });
      } else if (kind === 'fan' && this.preset === 'more-exploring') {
        items.push({ kind, rot: 0 }, { kind, rot: 180 });
      } else if (kind === 'ramp' || kind === 'moss') items.push({ kind, rot: this.trayRot(kind) });
      else items.push({ kind });
    }
    this.tray.replaceChildren(
      ...items.map((it) =>
        h('button', {
          class: 'tile',
          type: 'button',
          'aria-label': trayLabel(it),
          'aria-pressed': 'false',
          'data-part': trayKey(it),
          style: 'width:92px;min-height:80px;padding:4px;flex:none',
          html: `<span class="part-ico" style="transform:rotate(${trayAngle(it)}deg)${it.kind === 'fan' && it.rot === 180 ? ' scaleX(-1)' : ''}">${trayIcon(it)}</span>`,
          on: { click: () => (this.inHand && trayKey(this.inHand) === trayKey(it) ? this.dropHand() : this.pickUp(it)) },
        }),
      ),
    );
    this.pointerEl = null;
  }

  private updateTopBar(): void {
    if (!this.testBtn || !this.topBar) return;
    const busy = this.running;
    this.testBtn.innerHTML = icon(busy ? 'stop' : 'play', 56);
    this.testBtn.setAttribute('aria-label', busy ? 'Stop' : 'Test it');
    this.testBtn.classList.toggle('go', !busy);
    const pick = this.topBar.querySelector('[data-projects]') as HTMLElement;
    pick.innerHTML = `<span style="display:block;width:64px;height:56px">${pieceSvg(CHALLENGES[this.challenge].card)}</span>`;
  }

  private openPicker(first: boolean, quiet = false): void {
    this.overlay?.remove();
    this.stopRun();
    this.seq++;
    this.busy = false;
    this.dropHand();
    this.hand.hide();
    const prof = currentProfile();
    const next = CHALLENGE_ORDER.find((id) => !prof.progress.done[`tinker:${id}`]) ?? null;
    let nextCard: HTMLElement | null = null;
    const cards = [...CHALLENGE_ORDER, 'free' as ChallengeId].map((id) => {
      const c = CHALLENGES[id];
      const done = !!prof.progress.done[`tinker:${id}`];
      const card = h(
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
      if (id === next) nextCard = card;
      return card;
    });
    const panel = h('div', { class: 'panel', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Projects' }, h('div', { class: 'big-choices' }, ...cards));
    const overlay = h('div', { class: 'overlay' }, panel);
    const release = trapFocus(panel);
    const close = () => {
      release();
      overlay.remove();
      this.overlay = undefined;
      this.pointAt(null);
    };
    overlay.addEventListener('click', (e) => {
      if (e.target !== overlay || first) return;
      close();
      this.lastStepKey = '';
      this.guide(true);
    });
    services.layers.overlay.append(overlay);
    this.overlay = overlay;
    this.pointerEl = null;
    this.pointAt(nextCard);
    if (!quiet) void this.queue(() => this.line(next ? 'moss.welcome' : 'moss.welcomeAll'));
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
      void this.queue(() => this.line('moss.saved'));
      if (!existing) services.session.made.push({ kind: 'invention', label: names[this.challenge], art: preview ? `<img src="${preview}" alt="">` : undefined });
      if (!currentProfile().progress.display.invention && res.id) updateProfile((p) => (p.progress.display.invention = res.id!));
    } else if (res.reason === 'full') {
      void this.queue(() => this.line('moss.shelfFull'));
      this.openShelf(true);
    } else {
      toast(services.layers.toast, 'gear', 'Couldn’t save just now (see the grown-up area).');
    }
  }

  private openShelf(makeRoom = false): void {
    this.overlay?.remove();
    this.pointAt(null);
    const pid = services.profileId!;
    const display = currentProfile().progress.display.invention;
    const grid = h('div', { class: 'shelf-grid' });
    const panel = h('div', { class: 'panel', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'My shelf' });
    const overlay = h('div', { class: 'overlay' }, panel);
    const release = trapFocus(panel);
    const close = () => {
      release();
      overlay.remove();
      this.overlay = undefined;
      this.guide();
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
                    void this.queue(() => this.line('moss.shown'));
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
  }

  private loadCreation(id: string, play: boolean): void {
    const c = services.save.getCreation(id);
    if (!c || c.profileId !== services.profileId || c.kind !== 'invention') return;
    const d = c.data as { challenge?: ChallengeId; parts?: Part[]; options?: ChallengeOptions };
    const ch = d.challenge && CHALLENGES[d.challenge] ? d.challenge : 'free';
    this.startChallenge(ch, false);
    this.options = { ...this.options, ...(d.options ?? {}) };
    if (ch === 'cloud-mail' && this.options.pad && !MAIL_ROUNDS.includes(this.options.pad)) this.options.pad = 'pip';
    this.setParts((d.parts ?? []).filter(validPart));
    this.editingId = id;
    this.buildScenery();
    this.refreshPlan();
    this.saveDraft();
    this.guide(true);
    if (play) this.time.delayedCall(400, () => this.toggleTest());
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
    void this.queue(() => this.line('moss.passTools'));
  }

  // ================================================================ hints & misc

  /** Tapping Moss: hear the current step again, and see it. */
  private mossTip(): void {
    void this.moss.play('nod');
    if (!this.busy && !this.running) replayInstruction(() => this.demo());
  }

  /** Tapping the friend: they say what we're making again, and the goal is shown again. */
  private hostTap(): void {
    if (this.busy || this.running) return;
    this.showGoal();
    void this.queue(() => this.line(CHALLENGES[this.challenge].intro(this.options, this.preset)));
  }

  override hint(): void {
    this.hints.request();
  }

  /** Lines play one after another so nothing is cut off. */
  private queue(fn: () => Promise<void>): Promise<void> {
    const run = this.lineChain.then(fn, fn);
    this.lineChain = run.catch(() => undefined);
    return run;
  }

  private line(id: TinkerLineId): Promise<void> {
    const l = TINKER_LINES[id];
    const sp = l.speaker as Speaker;
    const puppet = sp === 'moss' ? this.moss : this.host && sp === this.hostId() ? this.host : this.minis.get(sp as string);
    if (puppet && 'mood' in l && l.mood) puppet.setExpression(l.mood);
    return say(sp, l.text, { puppet });
  }

  private wait(ms: number): Promise<void> {
    return new Promise((r) => this.time.delayedCall(ms, r));
  }

  override inspect(): Record<string, unknown> {
    const st = this.step();
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
      step: st.kind,
      slots: this.plan.map((s) => `${s.kind}@${s.x},${s.y}${this.fills(s) ? ':filled' : ''}`),
      busy: this.busy,
      picker: !!this.overlay && !!this.overlay.querySelector('[data-challenge]'),
      pointing: this.pointerEl?.getAttribute('data-part') ?? (this.pointerEl?.hasAttribute('data-test') ? 'test' : (this.pointerEl?.getAttribute('data-challenge') ?? null)),
    };
  }
}

/** A part sits in a dotted spot: same kind, same place, and a fan blowing the same way. */
function sits(p: Part, s: Part): boolean {
  if (p.kind !== s.kind || Math.abs(p.x - s.x) > 30 || Math.abs(p.y - s.y) > 30) return false;
  return p.kind !== 'fan' || Math.abs(((p.rot - s.rot + 540) % 360) - 180) < 10;
}

/** The step line for picking a part from the tray (names it and its colour). */
function pickLine(s: Part): TinkerLineId {
  switch (s.kind) {
    case 'fan':
      return 'moss.pickFan';
    case 'ramp':
      return 'moss.pickRamp';
    case 'moss':
      return 'moss.pickMoss';
    case 'spring':
      return 'moss.pickSpring';
    case 'chime':
      return s.note === 2 ? 'moss.pickChimeGreen' : s.note === 4 ? 'moss.pickChimePurple' : 'moss.pickChimeRed';
    default:
      return 'moss.pickPlank';
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
