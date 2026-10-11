import Phaser from 'phaser';
import { WWScene } from '../../WWScene';
import { Puppet } from '../../rig/Puppet';
import { Walker } from '../../systems/Walker';
import { GhostHand } from '../../systems/GhostHand';
import { Hints } from '../../systems/Hints';
import { dust, seeds, sparkle, splash, windLeaves } from '../../systems/fx';
import { addArt, addImage, setPiece } from '../../../art/rasterize';
import { registerPieces } from '../../../art/registry';
import { WINDMILL_PIECES, TAIL_PATTERNS, bowSvg } from '../../../art/scenes/windmill';
import { CAST_RIGS, avatarRig, rigArtKeys } from '../../../art/cast';
import { HATS } from '../../../art/cast/hats';
import { CHOICE_COLORS, P, choiceColor, hex, mix } from '../../../art/palette';
import { pieceSvg } from '../../../art/registry';
import {
  ANGLES,
  HUB,
  KITE_HOME,
  KITE_LOW,
  KITE_SAIL_ANGLE,
  L,
  LAUNCH,
  NEST_CATCH,
  PIP_PRACTICE,
  SAIL_TURN,
  WORLD_W,
  bestSpot,
  catches,
  groundY,
  kiteLanding,
  missKind,
  releasePoint,
  sailTip,
  simulateLaunch,
  spotsFor,
  KITE_FALL,
  WIND,
  VALLEY_X,
  type WindLevel,
} from '../../../content/trail/windmillModel';
import { type ChoiceSet, type PipEffect, type PipEvent, type PipState, choicesFor, initialPip, pipReduce } from '../../../content/trail/pipEncounter';
import { WINDMILL_CHOICES, WINDMILL_LINES, type WindmillLineId } from '../../../content/trail/windmillLines';
import type { Line } from '../../../content/lineTypes';
import { WINDMILL_QUEST, type WKCheckpoint, type WKFlags, defaultFlags, readFlags, writeFlags } from '../../../content/trail/windmillQuest';
import { services, currentProfile, currentPreset, updateProfile } from '../../../app/services';
import { say, instruct, isSpeaking, stopSpeech, clearInstruction, type Speaker } from '../../../app/speech';
import { audio } from '../../../core/audio';
import { motion } from '../../../core/motion';
import { mulberry32 } from '../../../core/rng';
import { KiteActor } from './windmill/KiteActor';
import { Launcher } from './windmill/Launcher';
import { NestWagon } from './windmill/NestWagon';
import { Windmill } from './windmill/Windmill';
import { h } from '../../../ui/dom';
import { icon } from '../../../ui/icons';
import type { PresetId } from '../../../save/schema';

registerPieces(WINDMILL_PIECES);

type Mode =
  | 'intro'
  | 'glider'
  | 'explore'
  | 'aiming'
  | 'launching'
  | 'falling'
  | 'choosingSpot'
  | 'mixup'
  | 'repair'
  | 'cutscene'
  | 'knots'
  | 'decorate'
  | 'flying'
  | 'done';

const D = {
  sky: 0,
  cloud: 5,
  far: 10,
  mid: 20,
  oak: 25,
  mill: 30,
  ground: 40,
  prop: 50,
  nest: 55,
  npc: 70,
  avatar: 75,
  air: 85,
  fg: 95,
  ui: 600,
};

const WIND_X = -160;
/** camera centre while aiming: the child, the launcher, the nest and the stuck kite all in view */
const AIM_CAM_X = 2150;
/** camera centre while choosing a nest spot: the wagon, every spot, the flag and the kite */
const SPOT_CAM_X = 2300;
/** the paper plane comes to rest at the foot of the windmill, away from the nest spots and the flag */
const GLIDER_REST = 2900;

/**
 * The Windmill Kite — the first Lantern Trail adventure and the quality bar
 * for everything else. See GAME_DESIGN.md §A1 for the beat structure.
 */
export default class WindmillKiteScene extends WWScene {
  readonly artGroup = 'windmill';
  protected override worldWidth = WORLD_W;

  private preset: PresetId = 'more-help';
  private flags: WKFlags = defaultFlags();
  private checkpoint: WKCheckpoint = 'intro';
  private pip: PipState = initialPip();
  private mode: Mode = 'intro';
  private alive = false;
  private rng = mulberry32(1);

  private avatar!: Puppet;
  private walker!: Walker;
  private pipP!: Puppet;
  private rowanP!: Puppet;
  private hand!: GhostHand;
  private hints!: Hints;
  private sky!: Phaser.GameObjects.Graphics;
  private sun!: Phaser.GameObjects.Image;
  private clouds: Phaser.GameObjects.Image[] = [];
  private leaves?: Phaser.GameObjects.Particles.ParticleEmitter;
  private camX = 0;
  private camFollow: (() => { x: number; y: number }) | null = null;

  private kite!: KiteActor;
  private kiteFree = false;
  private launcher!: Launcher;
  private nest!: NestWagon;
  private mill!: Windmill;
  private spool!: Phaser.GameObjects.Image;
  private ribbonTrail?: Phaser.GameObjects.Image;
  private flagImg?: Phaser.GameObjects.Image;
  private pumpkin!: Phaser.GameObjects.Image;
  private pumpkinHome = { x: L.pumpkinX, y: groundY(L.pumpkinX) + 6 };
  private carryingPumpkin = false;
  private pumpkinInBucket = false;
  private glider!: Phaser.GameObjects.Image;
  private gliderVy = 0;
  private rings: Phaser.GameObjects.Image[] = [];
  private dandelions: { img: Phaser.GameObjects.Image; bare: boolean; x: number }[] = [];
  private frog!: Phaser.GameObjects.Image;
  private frogPad = 0;
  private lilies: { x: number; y: number }[] = [];
  private sock!: Phaser.GameObjects.Image;
  private sockTaps = 0;
  private sockOnHead = false;
  private windsock!: Phaser.GameObjects.Image;
  private mushroomCap!: Phaser.GameObjects.Image;
  private bounceLevel = 0;
  private bouncing = false;
  private onMushroom = false;
  private snail?: Phaser.GameObjects.Image;
  private bird!: Phaser.GameObjects.Image;
  private spotMarkers: Phaser.GameObjects.Image[] = [];
  private aimAngle: number | null = null;
  private missCount = 0;
  private pipTimer = 0;
  private pipShot = 0;
  private pipBusy = false;
  private rowanAtLever = false;
  private fallPath?: Phaser.GameObjects.Graphics;
  private knotsLeft = 0;
  private knotImgs: Phaser.GameObjects.Image[] = [];
  private flyTarget = { x: 0, y: 0 };
  private flyPointerDown = false;
  private postImg?: Phaser.GameObjects.Image;
  private decorPanel?: HTMLElement;
  private choiceToken = 0;
  private pipTray: string | null = null;
  /** the line said without waiting (e.g. "You hit it!"); the next line waits for it so nothing gets cut off */
  private talking: Promise<void> = Promise.resolve();
  private steerSaid: Promise<void> = Promise.resolve();
  private kiteGoneSaid: Promise<void> = Promise.resolve();
  private kiteIcon!: Phaser.GameObjects.Image;
  private kiteIconArrow!: Phaser.GameObjects.Image;
  private spotPath?: Phaser.GameObjects.Graphics;
  private bellowsPulse?: Phaser.Tweens.Tween;
  private firstPick = true;
  private lastAngle: number | null = null;
  private lastMiss: 'high' | 'low' | null = null;
  private pipFiring = false;
  private pipSaidThisVisit = false;
  private pipSorrySaid = false;
  private repairSaid: Promise<void> = Promise.resolve();
  private rightAngle = 46;
  private leverTried = false;
  private kiteSnapped = false;

  constructor() {
    super('windmill-kite');
  }

  artKeys(): string[] {
    const p = currentProfile();
    const keys = new Set<string>(WINDMILL_PIECES.map((x) => x.key));
    for (const k of rigArtKeys(avatarRig(p.avatar.species, p.avatar.color))) keys.add(k);
    for (const k of rigArtKeys(CAST_RIGS.pip)) keys.add(k);
    for (const k of rigArtKeys(CAST_RIGS.rowan)) keys.add(k);
    for (const h of HATS) keys.add(h.id);
    for (const k of ['fx.hand', 'fx.tapring', 'fx.spark', 'fx.dust', 'fx.leaf', 'fx.seed', 'fx.splash', 'fx.glint', 'fx.shadow']) keys.add(k);
    return [...keys];
  }

  // ================================================================ build

  build(data: Record<string, unknown>): void {
    this.alive = true;
    this.preset = currentPreset('trail');
    const prof = currentProfile();
    const q = prof.progress.quests[WINDMILL_QUEST];
    this.checkpoint = (q?.checkpoint as WKCheckpoint) ?? 'intro';
    if (!['intro', 'hill', 'caught', 'done'].includes(this.checkpoint)) this.checkpoint = 'intro';
    if (data.replay) this.checkpoint = 'hill';
    this.flags = readFlags(q);
    if (data.replay) {
      const w: WindLevel = this.preset === 'more-exploring' && (q?.completions ?? 0) % 2 === 1 ? 'gusty' : 'breezy';
      this.flags = { ...defaultFlags(w), tailPattern: this.flags.tailPattern, tailColor: this.flags.tailColor };
    }
    this.rng = mulberry32(((q?.completions ?? 0) + 1) * 7919);
    this.pip = { ...initialPip(), mode: this.flags.pipMode, role: this.flags.role || null };

    this.buildBackdrop();
    this.buildProps();
    this.buildCharacters();
    this.hand = new GhostHand(this);
    this.rightAngle = ANGLES[this.preset].find((a) => simulateLaunch(a, this.flags.wind).hit) ?? 46;
    // hints never fire during cutscenes, flights or falls: only when there is something to tap
    this.hints = new Hints(this, this.preset, () => this.demoNext(), () => this.canHintNow());
    this.leaves = windLeaves(this, WIND_X - 40, D.air + 1);
    audio.startMusic('windmill');
    audio.setWind(0.8);
    services.hud.show(['home', 'finish', 'pause', 'replay', 'help']);
    this.onCleanup(() => {
      this.alive = false;
      audio.setWind(0);
      services.choices.cancel();
      stopSpeech();
      clearInstruction();
      this.decorPanel?.remove();
      this.leaves?.destroy();
      this.launcher?.destroy();
      this.kite?.destroy();
    });
    updateProfile((p) => (p.progress.location = { scene: 'windmill-kite' }));
    this.registerTargets();
    this.startFromCheckpoint(!!data.replay);
  }

  private buildBackdrop(): void {
    this.sky = this.add.graphics().setScrollFactor(0).setDepth(D.sky);
    this.sun = addImage(this, 0, 0, 'wh.sun').setScrollFactor(0).setDepth(D.sky + 1);
    for (let i = 0; i < 5; i++) {
      const c = addImage(this, i * 560 + this.rng() * 200, 120 + this.rng() * 220, i % 2 ? 'wh.cloud.a' : 'wh.cloud.b')
        .setScrollFactor(0.12, 1)
        .setDepth(D.cloud)
        .setScale(0.8 + this.rng() * 0.5);
      this.clouds.push(c);
    }
    addArt(this, 0, 0, 'wh.far').setScrollFactor(0.3, 1).setDepth(D.far);
    addArt(this, 0, 0, 'wh.mid').setScrollFactor(0.6, 1).setDepth(D.mid);
    addArt(this, L.perchX - 160, groundY(L.perchX - 160) + 14, 'wh.oak').setDepth(D.oak);
    addArt(this, 0, 0, 'wh.ground').setDepth(D.ground);
    // foreground tufts & flowers along the path edge
    const r = mulberry32(77);
    for (let x = 60; x < WORLD_W; x += 160 + r() * 200) {
      const k = r() < 0.25 ? 'wh.flowers' : r() < 0.6 ? 'wh.tuft.a' : 'wh.tuft.b';
      addImage(this, x, groundY(x) + 70 + r() * 120, k).setDepth(D.fg).setScale(1 + r() * 0.4);
    }
    for (const [x, k] of [
      [640, 'wh.bush'],
      [1960, 'wh.bush'],
      [3850, 'wh.fence'],
      [4060, 'wh.fence'],
      [3330, 'wh.bush'],
    ] as [number, string][]) {
      addImage(this, x, groundY(x) - 4, k).setDepth(D.prop - 2);
    }
  }

  private buildProps(): void {
    // Lantern Oak perch + glider
    addImage(this, L.gliderX, groundY(L.gliderX) + 4, 'wh.stump').setDepth(D.prop);
    this.glider = addImage(this, L.gliderX, groundY(L.gliderX) - 92, 'wh.glider').setDepth(D.prop + 1);
    // meadow toys
    L.dandelions.forEach((x, i) => {
      const img = addImage(this, x, groundY(x) + 30 + (i % 2) * 20, 'wh.dandelion').setDepth(D.prop + 2);
      this.dandelions.push({ img, bare: false, x });
    });
    const py = groundY(L.pondX) + 108;
    this.lilies = [
      { x: L.pondX - 50, y: py - 4 },
      { x: L.pondX + 60, y: py + 6 },
    ];
    for (const l of this.lilies) addImage(this, l.x, l.y, 'wh.lily').setDepth(D.prop - 1);
    this.frog = addImage(this, this.lilies[0].x, this.lilies[0].y - 4, 'wh.frog').setDepth(D.prop);
    const lx = L.sockLineX;
    addImage(this, lx - 120, groundY(lx - 120) + 2, 'wh.post').setDepth(D.prop - 1);
    addImage(this, lx + 120, groundY(lx + 120) + 2, 'wh.post').setDepth(D.prop - 1);
    const rope = this.add.graphics().setDepth(D.prop - 1);
    rope.lineStyle(4, hex(P.ink), 0.9);
    const ra = new Phaser.Math.Vector2(lx - 120, groundY(lx - 120) - 164);
    const rb = new Phaser.Math.Vector2(lx + 120, groundY(lx + 120) - 164);
    new Phaser.Curves.QuadraticBezier(ra, new Phaser.Math.Vector2(lx, (ra.y + rb.y) / 2 + 30), rb).draw(rope, 20);
    this.sock = addImage(this, lx + 10, (ra.y + rb.y) / 2 + 12, 'wh.sock').setDepth(D.prop);
    addImage(this, L.windsockX, groundY(L.windsockX) + 2, 'wh.windsock.pole').setDepth(D.prop - 1);
    this.windsock = addImage(this, L.windsockX, groundY(L.windsockX) - 214, 'wh.windsock.sock').setDepth(D.prop - 1);

    // Pip's launcher, the nest wagon, the ribbon spool
    this.launcher = new Launcher(this, L.launcherX, D.prop + 4);
    this.spool = addImage(this, L.spoolX, groundY(L.spoolX) + 6, 'wh.spool').setDepth(D.prop + 1);
    this.nest = new NestWagon(this, this.flags.nestX || L.nestStartX, D.nest);
    if (this.flags.nestMoved && this.flags.mixup === 'fixed') {
      this.nest.setChocks(true);
      this.spool.setVisible(false);
    }

    // windmill, lever, pumpkins, mushroom
    this.mill = new Windmill(this, D.mill, D.prop + 3);
    this.bird = addImage(this, HUB.x + 70, groundY(L.windmillX) - 340, 'wh.bird').setDepth(D.mill + 2);
    addImage(this, L.pumpkinX - 40, groundY(L.pumpkinX) + 60, 'wh.vine').setDepth(D.prop - 1);
    for (const [dx, dy] of [
      [-210, 74],
      [-120, 140],
      [170, 66],
      [250, 132],
      [60, 142],
    ]) {
      addImage(this, L.pumpkinX + dx, groundY(L.pumpkinX) + dy, 'wh.pumpkin.s').setDepth(D.prop + 1);
    }
    this.pumpkin = addImage(this, this.pumpkinHome.x, this.pumpkinHome.y, 'wh.pumpkin').setDepth(D.prop + 2);
    addImage(this, L.mushroomX, groundY(L.mushroomX) + 4, 'wh.mushroom.stem').setDepth(D.prop + 1);
    this.mushroomCap = addImage(this, L.mushroomX, groundY(L.mushroomX) - 80, 'wh.mushroom.cap').setDepth(D.prop + 2);
    addImage(this, L.signX, groundY(L.signX) + 4, 'wh.sign').setDepth(D.prop);
    if (this.flags.flagX) this.placeFlag(this.flags.flagX, true);

    // golden seed rings along the paper plane's path (and later in the sky for the flying kite)
    for (const [x, y] of [
      [880, 430],
      [1240, 330],
      [1700, 430],
    ]) {
      this.rings.push(addImage(this, x, y, 'wh.seedring').setDepth(D.air).setVisible(false));
    }

    // kite on the windmill sail
    this.kite = new KiteActor(this, KITE_HOME.x, KITE_HOME.y, D.air);
    this.kite.windX = WIND.kiteDrift[this.flags.wind];
    // when the stuck kite (the goal) is off screen, a little kite at the edge shows which way it is
    this.kiteIcon = addImage(this, 0, 0, 'wh.kite').setScrollFactor(0).setDepth(D.ui + 5).setScale(0.42).setVisible(false);
    this.kiteIconArrow = addImage(this, 0, 0, 'fx.arrow').setScrollFactor(0).setDepth(D.ui + 5).setScale(0.9).setVisible(false);
  }

  private buildCharacters(): void {
    const p = currentProfile();
    this.avatar = new Puppet(this, L.perchX - 80, groundY(L.perchX - 80), avatarRig(p.avatar.species, p.avatar.color), { hat: p.avatar.hat, seed: 3 });
    this.avatar.setDepth(D.avatar);
    this.walker = new Walker(this.avatar, { groundY, minX: L.minX, maxX: L.maxX });
    this.pipP = new Puppet(this, L.pipX, groundY(L.pipX), CAST_RIGS.pip, { seed: 11 });
    this.pipP.setDepth(D.npc);
    this.rowanP = new Puppet(this, L.rowanX, groundY(L.rowanX), CAST_RIGS.rowan, { seed: 17 });
    this.rowanP.setDepth(D.npc).setFacing(-1);
  }

  protected override layoutCamera(): void {
    const cam = this.cameras.main;
    cam.setSize(this.view.w, this.view.h);
    cam.setBounds(0, -this.view.oy, WORLD_W, this.view.h);
    cam.scrollY = -this.view.oy;
  }

  protected override layout(): void {
    const { w, h } = this.view;
    this.sky.clear();
    this.sky.fillGradientStyle(hex(P.skyTop), hex(P.skyTop), hex(P.skyLow), hex(P.skyLow), 1, 1, 1, 1);
    this.sky.fillRect(0, 0, w, h);
    this.sun.setPosition(w - 260, 190);
  }

  // ================================================================ checkpoint flow

  private startFromCheckpoint(replay: boolean): void {
    switch (this.checkpoint) {
      case 'intro':
        this.startIntro();
        break;
      case 'hill':
        this.kiteRestOnSail();
        this.glider.setPosition(GLIDER_REST, groundY(GLIDER_REST) - 30).setRotation(0.1);
        this.walker.place(L.landingX);
        this.avatar.setFacing(1);
        this.camX = this.avatar.x;
        this.enterExplore();
        if (this.flags.mixup === 'tangled') {
          // an interrupted untangle picks up right where it was
          this.nest.place(VALLEY_X);
          this.showTangle(false);
          this.spool.setPosition(L.spoolX + 40, groundY(L.spoolX) + 6).setRotation(0.6);
          this.ribbonTrail = addImage(this, L.spoolX - 20, groundY(L.spoolX) - 20, 'wh.ribbon.trail').setDepth(D.prop);
          this.pipP.x = VALLEY_X + 210;
          this.pipP.setFacing(-1);
          this.walker.place(VALLEY_X - 210);
          this.camX = this.avatar.x;
          this.time.delayedCall(600, () => void this.startRepair('pip.tapLoops'));
        } else if (replay) {
          // Pip asks again, straight away
          this.time.delayedCall(500, () => this.alive && this.mode === 'explore' && void this.dispatchPip({ type: 'MEET' }));
        } else {
          this.time.delayedCall(500, () => this.alive && this.mode === 'explore' && void this.promptNext());
        }
        break;
      case 'caught':
        this.walker.place(this.flags.nestX - 160);
        this.camX = this.avatar.x;
        this.kiteFree = true;
        this.kite.setTail(null);
        this.nest.place(this.flags.nestX);
        this.nest.setChocks(true);
        this.spool.setVisible(false);
        this.kite.setPosition(this.nest.seat().x, this.nest.seat().y);
        this.kite.img.setRotation(0.2);
        this.pipP.x = this.flags.nestX + 190;
        this.pipP.setFacing(-1);
        void this.resolutionKnots();
        break;
      case 'done':
        this.walker.place(L.landingX + 200);
        this.camX = this.avatar.x;
        this.glider.setPosition(GLIDER_REST, groundY(GLIDER_REST) - 30).setRotation(0.1);
        this.setupDoneWorld();
        this.enterExplore();
        this.mode = 'done';
        break;
    }
  }

  private persist(): void {
    const pipMode = this.pip.mode === 'elsewhere' ? (this.pip.prevMode ?? 'busy') : this.pip.mode;
    const f: WKFlags = { ...this.flags, pipMode, role: this.pip.role ?? '', approaches: this.pip.approaches.join('; ') };
    this.flags = f;
    updateProfile((p) => {
      const prev = p.progress.quests[WINDMILL_QUEST];
      p.progress.quests[WINDMILL_QUEST] = {
        status: this.checkpoint === 'done' || prev?.status === 'done' ? 'done' : 'active',
        checkpoint: this.checkpoint,
        flags: writeFlags(f),
        completions: prev?.completions ?? 0,
        ...(prev?.firstDoneAt ? { firstDoneAt: prev.firstDoneAt } : {}),
      };
    });
  }

  private setCheckpoint(c: WKCheckpoint): void {
    this.checkpoint = c;
    this.persist();
  }

  // ================================================================ intro: the glider

  private startIntro(): void {
    this.mode = 'intro';
    this.kiteFlyingWithPip();
    this.walker.place(L.perchX - 80);
    this.avatar.setFacing(1);
    this.camX = L.perchX + 500;
    this.cameras.main.scrollX = Phaser.Math.Clamp(this.camX - this.view.w / 2, 0, WORLD_W - this.view.w);
    this.time.delayedCall(700, () => {
      if (this.mode !== 'intro') return;
      void this.step('nar.tapGlider', true);
    });
  }

  private kiteFlyingWithPip(): void {
    // Pip flies the kite on the ridge before the gust snaps the string
    this.kite.setPosition(L.pipX + 160, 300);
    this.kite.stringTo = { x: L.pipX + 30, y: groundY(L.pipX) - 120 };
    this.pipP.setFacing(1).lookAt(0.6, -0.9);
    const bob = this.tweens.add({ targets: this.kite.img, y: 330, x: L.pipX + 190, rotation: 0.15, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.kite.img.setData('bob', bob);
  }

  private async throwGlider(): Promise<void> {
    if (this.mode !== 'intro') return;
    this.mode = 'cutscene';
    this.hand.hide();
    stopSpeech();
    this.hints.poke();
    await this.walkTo(L.gliderX - 70);
    this.avatar.setFacing(1);
    await this.avatar.play('reach');
    audio.play('pickup');
    this.glider.setDepth(D.avatar + 1);
    this.tweens.add({ targets: this.glider, x: this.avatar.x + 50, y: this.avatar.y - 170, duration: 180 });
    await this.wait(200);
    await this.avatar.play('throw', { expression: 'excited' });
    audio.play('whoosh');
    updateProfile((p) => (p.progress.onboarded = true));
    this.flyGlider();
  }

  private flyGlider(): void {
    this.mode = 'glider';
    this.glider.setDepth(D.air).setRotation(-0.25);
    this.gliderVy = -120;
    for (const r of this.rings) r.setVisible(true).setScale(0.9).setAlpha(1);
    this.camFollow = () => ({ x: this.glider.x + 220, y: this.glider.y });
    this.time.delayedCall(600, () => {
      if (this.mode !== 'glider') return;
      // the flight is a toy: any tap lifts the plane. Six-year-olds hear how; four-year-olds just see the hand.
      if (this.preset === 'more-exploring') this.steerSaid = this.step('nar.steer', true);
      else void this.hand.tapAt(this.glider.x + 300, this.glider.y - 170, 1);
    });
    this.inputLocked = false;
  }

  private gliderTick(dt: number): void {
    const g = this.glider;
    const cruise = 400 + Math.sin(this.time.now / 600) * 30;
    this.gliderVy += ((cruise - g.y) * 0.9 - this.gliderVy * 0.6) * dt;
    // a gentle flight past Pip, then the gust carries it quickly on to the windmill (where the kite ends up too)
    g.x += (g.x > L.pipX - 120 ? 560 : 330) * dt;
    g.y += this.gliderVy * dt;
    g.y = Phaser.Math.Clamp(g.y, 180, groundY(g.x) - 40);
    g.rotation = Phaser.Math.Clamp(this.gliderVy / 900, -0.5, 0.5);
    for (const r of this.rings) {
      if (r.visible && r.alpha === 1 && Math.hypot(r.x - g.x, r.y - g.y) < 85) {
        r.setAlpha(0.99);
        const idx = this.rings.indexOf(r);
        audio.play('chime', { note: 4 + idx * 2 });
        sparkle(this, r.x, r.y, 14, D.air + 2);
        this.tweens.add({ targets: r, scale: 1.4, alpha: 0, duration: 400, onComplete: () => r.setVisible(false) });
      }
    }
    // the gust: Pip's kite string snaps as the glider passes
    if (!this.kiteSnapped && g.x > L.pipX - 120 && this.checkpoint === 'intro') {
      this.kiteSnapped = true;
      this.kiteFree = true;
      void this.kiteSnaps();
    }
    if (g.x > GLIDER_REST) {
      this.mode = 'cutscene';
      this.tweens.add({ targets: g, y: groundY(GLIDER_REST) - 30, rotation: 0.1, duration: 500, ease: 'Quad.easeIn' });
      audio.play('paper');
      for (const r of this.rings) r.setVisible(false);
      void this.afterGlider();
    }
  }

  private async kiteSnaps(): Promise<void> {
    const bob = this.kite.img.getData('bob') as Phaser.Tweens.Tween | undefined;
    bob?.remove();
    this.kite.stringTo = null;
    audio.play('snap');
    this.pipP.setExpression('surprised');
    // the steering tip finishes first, so neither line is cut off
    this.kiteGoneSaid = this.steerSaid.then(() => (this.alive ? this.sayLine('pip.kiteGone') : undefined));
    const start = new Phaser.Math.Vector2(this.kite.x, this.kite.y);
    const curve = new Phaser.Curves.CubicBezier(start, new Phaser.Math.Vector2(start.x + 300, 100), new Phaser.Math.Vector2(KITE_HOME.x - 300, 80), new Phaser.Math.Vector2(KITE_HOME.x, KITE_HOME.y));
    const prox = { t: 0 };
    await this.tweenP({
      targets: prox,
      t: 1,
      duration: 2600,
      ease: 'Sine.easeInOut',
      onUpdate: () => {
        const v = curve.getPoint(prox.t);
        this.kite.setPosition(v.x, v.y);
        this.kite.img.rotation = Math.sin(prox.t * 18) * 0.6;
      },
    });
    audio.play('rustle');
    this.kiteRestOnSail();
  }

  private kiteRestOnSail(): void {
    this.kiteFree = false;
    this.kite.setPosition(KITE_HOME.x, KITE_HOME.y);
    this.kite.img.setRotation(KITE_SAIL_ANGLE + Math.PI / 2 + 0.3);
    this.kite.stringTo = null;
    if (!this.kite.tail) this.kite.setTail('plain');
  }

  private async afterGlider(): Promise<void> {
    await this.wait(400);
    // show the stuck kite (Pip points at it) while the avatar runs over to Pip
    this.camFollow = () => ({ x: HUB.x - 300, y: HUB.y });
    this.pipP.setFacing(1);
    this.pipP.setExpression('worried');
    void this.pipP.play('point');
    this.setCheckpoint('hill');
    this.walker.speed = 900;
    const run = this.walkTo(L.landingX);
    await this.kiteGoneSaid;
    await this.sayLine('pip.kiteStuck');
    await run;
    this.walker.speed = 520;
    this.avatar.setFacing(1);
    this.pipP.setExpression('happy');
    this.pipP.faceToward(this.avatar.x);
    this.enterExplore();
    // Pip asks for help right away: the question, then the answer cards
    await this.dispatchPip({ type: 'MEET' });
  }

  // ================================================================ exploring

  private enterExplore(): void {
    this.mode = 'explore';
    this.inputLocked = false;
    this.camFollow = null;
    this.hints.poke();
  }

  /** The child has started on the windmill way (lever, pumpkin, or Rowan), so that is what the marker follows. */
  private onWindmillWay(): boolean {
    return this.carryingPumpkin || this.pumpkinInBucket || this.rowanAtLever || this.leverTried || (this.flags.route === 'windmill' && !this.launcherIsMine());
  }

  /** What the child should do next while exploring, and the line that says so. */
  private nextGoal(): { target: string; line: WindmillLineId } | null {
    if (this.checkpoint !== 'hill' || this.kiteFree || this.flags.mixup === 'tangled') return null;
    if (this.onWindmillWay()) {
      if (this.carryingPumpkin) return { target: 'lever', line: 'nar.toBucket' };
      // after a landing, the nest goes to the flag first
      if (this.flags.flagX && this.nestNeeded()) return { target: 'nest', line: 'pip.flag' };
      if (this.rowanAtLever) return { target: 'lever', line: 'nar.tapLever' };
      return { target: 'pumpkin', line: 'nar.stiff' };
    }
    if (!this.launcherIsMine()) return { target: 'pip', line: this.pip.mode === 'resting' ? 'nar.pipLater' : 'nar.tapPip' };
    if (this.nestNeeded()) return { target: 'nest', line: this.flags.flagX ? 'pip.flag' : 'pip.nestFirst' };
    return { target: 'launcher', line: this.flags.mixup === 'fixed' ? 'pip.nestReady' : 'pip.tapLauncher' };
  }

  /** The nest isn't where the kite will come down (never moved, or not by the flag). */
  private nestNeeded(): boolean {
    if (this.flags.mixup === 'tangled') return false;
    if (!this.flags.nestMoved) return true;
    if (this.flags.flagX) return Math.abs(this.flags.flagX - this.nest.x) > NEST_CATCH;
    return false;
  }

  /** Say what to do next (and show it, for More help). */
  private async promptNext(): Promise<void> {
    const g = this.nextGoal();
    if (g) await this.step(g.line);
  }

  protected override onGroundTap(x: number, y: number): void {
    this.hints.poke();
    if (this.mode === 'intro') {
      // tapping anything else: the plane wiggles and the hand shows it again
      this.tweens.add({ targets: this.glider, rotation: { from: -0.25, to: 0.25 }, duration: 120, yoyo: true, repeat: 1, onComplete: () => this.glider.setRotation(0) });
      audio.play('paper', { vol: 0.6 });
      if (!this.hand.busy) void this.hand.tapAt(this.glider.x, this.glider.y, 1);
      return;
    }
    if (this.mode === 'glider') {
      this.gliderVy += y < this.glider.y ? -340 : 340;
      audio.play('swish', { pitch: y < this.glider.y ? 1.2 : 0.8 });
      return;
    }
    if (this.mode === 'flying') return;
    if (!this.canWalk()) return;
    if (this.sockOnHead) this.sockFliesHome();
    this.leaveMushroom();
    this.walker.walkTo(x);
  }

  protected override onArrow(dx: number, dy: number, down: boolean): void {
    this.hints.poke();
    if (this.mode === 'glider' && down && dy) {
      this.gliderVy += dy * 340;
      return;
    }
    if (this.mode === 'flying') {
      if (down) this.flyTarget.y = Phaser.Math.Clamp(this.flyTarget.y + dy * 90, 120, 640);
      return;
    }
    // letting go of a key always stops walking, even mid-conversation
    if (!down) return this.walker.setHeld(0);
    if (!this.canWalk()) return;
    this.walker.setHeld(dx);
  }

  private canWalk(): boolean {
    return ['explore', 'aiming', 'choosingSpot', 'done'].includes(this.mode) && !this.walker.busy;
  }

  /** Scripted walk. Always resolves (even if the walk is interrupted, e.g. by pausing), so a cutscene can't get stuck. */
  private walkTo(x: number): Promise<void> {
    return new Promise((r) => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        r();
      };
      const ms = (Math.abs(x - this.avatar.x) / this.walker.speed) * 1000 + 900;
      const wasBusy = this.walker.busy;
      this.walker.busy = false;
      this.walker.walkTo(x, finish);
      this.walker.busy = wasBusy;
      this.time.delayedCall(ms, finish);
    });
  }

  /** Walk next to something (standing `gap` away so it stays in view), then do it. */
  private goDo(x: number, fn: () => void, side?: number, gap = 95): void {
    if (!this.canWalk() && this.mode !== 'explore') return;
    this.hints.poke();
    if (this.sockOnHead) this.sockFliesHome();
    this.leaveMushroom();
    const s = side ?? (this.avatar.x < x ? -1 : 1);
    this.walker.walkTo(x + s * gap, () => {
      this.avatar.faceToward(x);
      fn();
    });
  }

  // ================================================================ targets

  private registerTargets(): void {
    const gy = (x: number) => groundY(x);
    this.addTarget({
      id: 'glider',
      label: 'Paper glider',
      bounds: () => this.rectAround(this.glider.x, this.glider.y, 150, 90, 40),
      enabled: () => this.mode === 'intro' || ((this.mode === 'explore' || this.mode === 'done') && this.checkpoint !== 'intro'),
      activate: () => (this.mode === 'intro' ? void this.throwGlider() : this.goDo(this.glider.x, () => void this.rethrowGlider())),
      priority: 1,
      ambient: true,
    });
    this.dandelions.forEach((d, i) =>
      this.addTarget({
        id: `dandelion-${i}`,
        label: 'Dandelion',
        bounds: () => this.rectAround(d.x, d.img.y - 120, 90, 120, 26),
        enabled: () => this.exploring(),
        activate: () => this.goDo(d.x, () => this.puffDandelion(i)),
        ambient: true,
      }),
    );
    this.addTarget({
      id: 'frog',
      label: 'Frog',
      bounds: () => this.rectAround(this.frog.x, this.frog.y - 30, 100, 70, 34),
      enabled: () => this.exploring(),
      activate: () => this.goDo(this.frog.x, () => this.frogHop(), -1),
      ambient: true,
    });
    this.addTarget({
      id: 'sock',
      label: 'Sock on the washing line',
      bounds: () => this.rectAround(this.sock.x, this.sock.y + 50, 70, 110, 30),
      enabled: () => this.exploring() && !this.sockOnHead,
      activate: () => this.goDo(this.sock.x, () => this.flapSock()),
      ambient: true,
    });
    this.addTarget({
      id: 'windsock',
      label: 'Wind sock',
      bounds: () => this.rectAround(L.windsockX - 60, gy(L.windsockX) - 200, 160, 90, 20),
      enabled: () => this.exploring(),
      activate: () => this.goDo(L.windsockX, () => this.flutterWindsock()),
      ambient: true,
    });
    this.addTarget({
      id: 'pip',
      label: 'Pip',
      bounds: () => this.rectAround(this.pipP.x, this.pipP.y - 110, 120, 220, 20),
      enabled: () => this.exploring() && !this.walker.busy,
      activate: () => this.goDo(this.pipP.x, () => this.talkToPip(), undefined, 170),
      priority: 3,
    });
    this.addTarget({
      id: 'launcher',
      label: 'Launcher',
      bounds: () => this.rectAround(L.launcherX, gy(L.launcherX) - 80, 230, 160, 10),
      enabled: () => this.exploring() && this.launcherIsMine() && this.mode !== 'aiming',
      activate: () => this.goToLauncher(),
      priority: 4,
    });
    this.addTarget({
      id: 'bellows',
      label: 'Red pump',
      bounds: () => this.rectAround(this.launcher.bellows.x, this.launcher.bellows.y - 60, 110, 140, 24),
      enabled: () => this.mode === 'aiming' && this.aimAngle !== null && !this.launcher.firing && !this.pipPumps(),
      activate: () => void this.childFire(),
      priority: 1,
    });
    for (const deg of ANGLES['more-exploring']) {
      this.addTarget({
        id: `angle-${deg}`,
        label: `Aim arrow ${deg}`,
        bounds: () => {
          const a = (-deg * Math.PI) / 180;
          return this.rectAround(L.launcherX + 40 + Math.cos(a) * Launcher.BTN_R, gy(L.launcherX) - 120 + Math.sin(a) * Launcher.BTN_R, 120, 120, 8);
        },
        enabled: () => this.mode === 'aiming' && (ANGLES[this.preset] as readonly number[]).includes(deg) && !this.launcher.firing && !this.pipFiring,
        activate: () => this.pickAngle(deg),
        priority: 0,
      });
    }
    this.addTarget({
      id: 'nest',
      label: 'Nest wagon',
      bounds: () => this.rectAround(this.nest.x, this.nest.c.y - 70, 240, 130, 16),
      enabled: () => this.exploring() && this.flags.mixup !== 'tangled' && !this.kiteFree,
      // straight to the spots: no walk, no wait
      activate: () => this.chooseSpot(),
      priority: 4,
    });
    for (const sx of [2000, 2170, 2340, 2520]) {
      this.addTarget({
        id: `spot-${sx}`,
        label: `Nest spot`,
        bounds: () => this.rectAround(sx, gy(sx) - 10, 150, 120, 10),
        enabled: () => this.mode === 'choosingSpot' && this.spotsShown().includes(sx),
        activate: () => void this.placeNest(sx),
        priority: 0,
      });
    }
    for (let i = 0; i < 3; i++) {
      this.addTarget({
        id: `loop-${i}`,
        label: 'Ribbon loop',
        bounds: () => {
          const l = this.nest.loops[i];
          const w = l ? this.nest.toWorld(l.x, l.y) : { x: -999, y: -999 };
          return this.rectAround(w.x, w.y, 80, 80, 30);
        },
        enabled: () => this.mode === 'repair' && !!this.nest.loops[i] && this.nest.loops[i].visible && this.nest.loops[i].parentContainer === this.nest.c,
        activate: () => this.untangle(i),
        priority: 0,
      });
    }
    this.addTarget({
      id: 'mushroom',
      label: 'Bouncy mushroom',
      bounds: () => this.rectAround(L.mushroomX, gy(L.mushroomX) - 90, 210, 180, 10),
      enabled: () => this.exploring() && !this.carryingPumpkin,
      activate: () => (this.onMushroom ? this.bounce() : this.goDo(L.mushroomX, () => this.hopOnMushroom(), -1)),
      ambient: true,
    });
    this.addTarget({
      id: 'lever',
      label: 'Windmill brake lever',
      bounds: () => {
        const b = this.mill.bucketWorld();
        return new Phaser.Geom.Rectangle(L.leverX - 60, b.y - 140, b.x - L.leverX + 140, 260);
      },
      enabled: () => this.exploring() && !this.kiteFree && !this.mill.leverDown,
      activate: () => this.goDo(L.leverX, () => void this.useLever(), -1),
      priority: 3,
    });
    this.addTarget({
      id: 'pumpkin',
      label: 'Pumpkin',
      bounds: () => this.rectAround(this.pumpkin.x, this.pumpkin.y - 45, 130, 100, 20),
      enabled: () => this.exploring() && !this.carryingPumpkin && !this.pumpkinInBucket && !this.kiteFree,
      activate: () => this.goDo(this.pumpkin.x, () => this.pickPumpkin()),
      priority: 2,
    });
    this.addTarget({
      id: 'rowan',
      label: 'Rowan',
      bounds: () => this.rectAround(this.rowanP.x, this.rowanP.y - 125, 150, 250, 10),
      enabled: () => this.exploring() && !this.rowanAtLever,
      activate: () => this.goDo(this.rowanP.x, () => void this.talkToRowan(), undefined, 150),
      priority: 3,
    });
    this.addTarget({
      id: 'sign',
      label: 'Signpost to the map',
      bounds: () => this.rectAround(L.signX + 20, gy(L.signX) - 130, 190, 110, 20),
      enabled: () => this.exploring(),
      activate: () => this.goDo(L.signX, () => services.nav.openMap(), -1),
      ambient: true,
    });
    this.addTarget({
      id: 'snail',
      label: 'Snail',
      bounds: () => (this.snail ? this.rectAround(this.snail.x, this.snail.y - 30, 110, 80, 20) : new Phaser.Geom.Rectangle(-9, -9, 1, 1)),
      enabled: () => !!this.snail && this.exploring(),
      activate: () => audio.play('squeak'),
      ambient: true,
    });
  }

  private exploring(): boolean {
    return this.mode === 'explore' || this.mode === 'done' || this.mode === 'aiming';
  }

  // ================================================================ little toys

  private puffDandelion(i: number): void {
    const d = this.dandelions[i];
    if (d.bare) {
      audio.play('rustle', { vol: 0.5 });
      return;
    }
    d.bare = true;
    this.avatar.play('hop');
    seeds(this, d.x, d.img.y - 128, WIND_X, 16, D.air);
    audio.play('puff');
    audio.play('rustle');
    setPiece(d.img, 'wh.dandelion.bare');
    this.time.delayedCall(12000, () => {
      if (!this.alive) return;
      d.bare = false;
      setPiece(d.img, 'wh.dandelion');
      this.tweens.add({ targets: d.img, scaleY: { from: 0.6, to: 1 }, duration: 400, ease: 'Back.easeOut' });
    });
  }

  private frogHop(): void {
    const next = (this.frogPad + 1) % this.lilies.length;
    const to = this.lilies[next];
    this.frogPad = next;
    audio.play('croak');
    const from = { x: this.frog.x, y: this.frog.y };
    const prox = { t: 0 };
    this.tweens.add({
      targets: prox,
      t: 1,
      duration: 520,
      ease: 'Sine.easeInOut',
      onUpdate: () => {
        this.frog.x = Phaser.Math.Linear(from.x, to.x, prox.t);
        this.frog.y = Phaser.Math.Linear(from.y, to.y - 4, prox.t) - Math.sin(prox.t * Math.PI) * 120;
        this.frog.setFlipX(to.x < from.x);
      },
      onComplete: () => {
        splash(this, this.frog.x, this.frog.y, D.prop + 1);
        audio.play('splash', { vol: 0.7 });
      },
    });
    this.avatar.setExpression('excited');
    this.time.delayedCall(900, () => this.alive && this.avatar.setExpression('happy'));
  }

  private flapSock(): void {
    this.sockTaps++;
    audio.play('flap');
    if (this.sockTaps < 3) {
      this.tweens.add({ targets: this.sock, rotation: { from: -0.7, to: 0.7 }, duration: 120, yoyo: true, repeat: 2, onComplete: () => this.sock.setRotation(0) });
      return;
    }
    // the wind steals the sock… and drops it right on your head
    this.sockTaps = 0;
    audio.play('whoosh');
    const start = { x: this.sock.x, y: this.sock.y };
    const prox = { t: 0 };
    this.tweens.add({
      targets: prox,
      t: 1,
      duration: 900,
      ease: 'Sine.easeInOut',
      onUpdate: () => {
        const tx = this.avatar.x;
        const ty = this.avatar.y - 190;
        this.sock.x = Phaser.Math.Linear(start.x, tx, prox.t);
        this.sock.y = Phaser.Math.Linear(start.y, ty, prox.t) - Math.sin(prox.t * Math.PI) * 160;
        this.sock.rotation = prox.t * 8;
      },
      onComplete: () => {
        this.sock.setVisible(false);
        this.avatar.setHat('wh.sock');
        this.sockOnHead = true;
        this.avatar.setExpression('silly');
        audio.play('pop');
      },
    });
  }

  private sockFliesHome(): void {
    this.sockOnHead = false;
    this.avatar.setHat(currentProfile().avatar.hat);
    this.avatar.setExpression('happy');
    this.sock.setVisible(true).setPosition(this.avatar.x, this.avatar.y - 200).setRotation(0);
    audio.play('whoosh', { pitch: 1.2 });
    this.tweens.add({ targets: this.sock, x: L.sockLineX + 10, y: groundY(L.sockLineX) - 150, rotation: 0, duration: 800, ease: 'Sine.easeInOut' });
  }

  private flutterWindsock(): void {
    audio.play('flap');
    this.tweens.add({ targets: this.windsock, scaleY: 0.6, duration: 90, yoyo: true, repeat: 3 });
  }

  private async rethrowGlider(): Promise<void> {
    if (this.mode !== 'explore' && this.mode !== 'done') return;
    this.mode = 'cutscene';
    await this.avatar.play('reach');
    audio.play('pickup');
    this.glider.setPosition(this.avatar.x + 40, this.avatar.y - 170);
    await this.avatar.play('throw', { expression: 'excited' });
    audio.play('whoosh');
    const dir = this.avatar.facing;
    const sx = this.glider.x;
    const endX = Phaser.Math.Clamp(sx + dir * 700, L.minX, L.maxX);
    const prox = { t: 0 };
    this.glider.setFlipX(dir < 0);
    await this.tweenP({
      targets: prox,
      t: 1,
      duration: 1500,
      ease: 'Sine.easeOut',
      onUpdate: () => {
        this.glider.x = Phaser.Math.Linear(sx, endX, prox.t);
        this.glider.y = Phaser.Math.Linear(this.avatar.y - 170, groundY(endX) - 30, prox.t) - Math.sin(prox.t * Math.PI) * 220;
        this.glider.rotation = Math.cos(prox.t * Math.PI) * -0.4 * dir;
      },
    });
    audio.play('paper');
    this.mode = this.checkpoint === 'done' ? 'done' : 'explore';
  }

  private hopOnMushroom(): void {
    this.onMushroom = true;
    this.walker.busy = true;
    this.avatar.x = L.mushroomX;
    this.bounceLevel = 0;
    this.bounce();
  }

  private bounce(): void {
    if (this.bouncing) return;
    this.bouncing = true;
    this.hints.poke();
    this.bounceLevel = Math.min(3, this.bounceLevel + 1);
    const heights = [0, 230, 380, 520];
    const top = groundY(L.mushroomX) - 150 - heights[this.bounceLevel];
    const base = groundY(L.mushroomX) - 150;
    this.tweens.add({ targets: this.mushroomCap, scaleY: 0.7, scaleX: 1.12, duration: 110, yoyo: true, ease: 'Quad.easeOut' });
    audio.play('boing', { pitch: 0.8 + this.bounceLevel * 0.15 });
    if (this.bounceLevel === 3 && !this.flags.secret) {
      void this.secretBalcony();
      return;
    }
    this.avatar.setExpression(this.bounceLevel >= 2 ? 'excited' : 'happy');
    this.tweens.add({
      targets: this.avatar,
      y: top,
      duration: 360 + this.bounceLevel * 60,
      ease: 'Quad.easeOut',
      yoyo: true,
      onComplete: () => {
        this.avatar.y = base;
        this.bouncing = false;
        dust(this, L.mushroomX, base + 20, 5, D.prop + 3);
        this.time.delayedCall(1600, () => {
          if (this.onMushroom && !this.bouncing) this.leaveMushroom();
        });
      },
    });
    this.avatar.y = base;
  }

  private leaveMushroom(): void {
    if (!this.onMushroom || this.bouncing) return;
    this.onMushroom = false;
    this.bounceLevel = 0;
    this.walker.busy = false;
    this.tweens.add({ targets: this.avatar, x: L.mushroomX - 130, y: groundY(L.mushroomX - 130), duration: 300, ease: 'Quad.easeOut' });
  }

  private async secretBalcony(): Promise<void> {
    this.mode = 'cutscene';
    const ledge = { x: L.windmillX - 40, y: groundY(L.windmillX) - 300 };
    this.avatar.setExpression('excited');
    const from = { x: this.avatar.x, y: this.avatar.y };
    const prox = { t: 0 };
    await this.tweenP({
      targets: prox,
      t: 1,
      duration: 900,
      ease: 'Sine.easeOut',
      onUpdate: () => {
        this.avatar.x = Phaser.Math.Linear(from.x, ledge.x, prox.t);
        this.avatar.y = Phaser.Math.Linear(from.y, ledge.y, prox.t) - Math.sin(prox.t * Math.PI) * 260;
      },
    });
    this.avatar.setDepth(D.mill + 3);
    this.snail = addImage(this, ledge.x + 80, ledge.y + 2, 'wh.snail').setDepth(D.mill + 3).setScale(0.2);
    this.tweens.add({ targets: this.snail, scale: 1, duration: 300, ease: 'Back.easeOut' });
    audio.play('squeak');
    await say('narrator', WINDMILL_LINES['nar.secret'].text);
    const pw = addImage(this, ledge.x + 60, ledge.y - 60, 'wh.pinwheel').setDepth(D.mill + 4);
    this.tweens.add({ targets: pw, rotation: Math.PI * 4, duration: 1600 });
    sparkle(this, pw.x, pw.y, 12, D.ui);
    audio.play('sparkle');
    this.flags.secret = true;
    updateProfile((p) => {
      if (!p.progress.souvenirs.pinwheel) p.progress.souvenirs.pinwheel = { id: 'pinwheel', at: Date.now(), data: { from: 'windmill' } };
    });
    this.persist();
    await this.wait(900);
    this.avatar.hold(pw);
    pw.setPosition(0, 0);
    // float down holding the pinwheel
    await this.tweenP({ targets: this.avatar, x: L.windmillX - 220, y: groundY(L.windmillX - 220), duration: 1600, ease: 'Sine.easeInOut' });
    this.avatar.hold(null);
    pw.destroy();
    this.avatar.setDepth(D.avatar);
    this.onMushroom = false;
    this.bouncing = false;
    this.walker.busy = false;
    this.walker.place(this.avatar.x);
    this.enterExplore();
    if (this.checkpoint === 'done') this.mode = 'done';
  }

  // ================================================================ Pip: the social encounter

  private dispatchPip(e: PipEvent): Promise<void> {
    const { state, effects } = pipReduce(this.pip, e);
    this.pip = state;
    this.persist();
    return this.runPipEffects(effects);
  }

  /** Effects run in order: each line finishes before the next thing happens. */
  private async runPipEffects(effects: PipEffect[]): Promise<void> {
    for (let i = 0; i < effects.length; i++) {
      const fx = effects[i];
      if (!this.alive) return;
      switch (fx.kind) {
        case 'say':
          // a line right before a choice tray is the question: "hear it again" repeats it
          if (effects[i + 1]?.kind === 'choices') await this.step(fx.line, false);
          // "one more go": Pip shoots while saying it (the next line waits for this one)
          else if (effects[i + 1]?.kind === 'launch') this.talking = this.sayLine(fx.line);
          else await this.sayLine(fx.line);
          break;
        case 'launch':
          await this.pipLaunch(true);
          break;
        case 'handOver':
        case 'together':
          await this.handOver();
          break;
        case 'emote':
          if (fx.emote === 'wait') this.avatar.emote('wait', 2200);
          else this.pipP.emote(fx.emote === 'wave' ? 'wave' : fx.emote, 1600);
          if (fx.emote === 'wave') void this.pipP.play('wave');
          break;
        case 'choices':
          void this.offerPipChoices(fx.set);
          break;
        case 'waitThenHandOver':
          break;
      }
    }
  }

  private async offerPipChoices(set: ChoiceSet): Promise<void> {
    const opts = choicesFor(set, this.preset);
    if (!opts.length) return;
    // never re-pop or swap a tray the child is already looking at, and never open one over another step
    if (this.pipTray === set || this.mode !== 'explore' || !this.alive) return;
    const my = ++this.choiceToken;
    this.pipTray = set;
    const pick = await services.choices.ask(opts, { readAloud: true });
    if (this.pipTray === set) this.pipTray = null;
    if (!pick || my !== this.choiceToken || !this.alive) return;
    this.hints.poke();
    if (pick === 'WAVE') void this.avatar.play('wave');
    else {
      this.avatar.emote('speak', 1000);
      this.avatar.talk(700);
    }
    await this.dispatchPip({ type: pick } as PipEvent);
    // saying "not now" is fine: the storyteller says what else there is to do
    if (pick === 'DECLINE' && this.mode === 'explore') await this.promptNext();
  }

  /** Close a Pip tray that is open (another step is starting). */
  private closePipTray(): void {
    if (!this.pipTray) return;
    this.choiceToken++;
    this.pipTray = null;
    services.choices.cancel();
  }

  private talkToPip(): void {
    if (this.checkpoint === 'done') {
      void this.doneTalk();
      return;
    }
    if (this.flags.mixup === 'tangled') return;
    this.pipP.faceToward(this.avatar.x);
    // already your turn: Pip says what to do next
    if (this.launcherIsMine()) {
      if (this.mode === 'aiming') {
        if (!this.pipPumps() || this.aimAngle === null) void this.step(this.aimAngle === null ? 'pip.pickArrow' : 'pip.pump');
      } else void this.promptNext();
      return;
    }
    if (this.pipTray) return;
    if (this.pip.mode === 'offered') void this.askPip('pip.invite', 'invite');
    else if (this.pip.mode === 'notYet') void this.askPip('pip.notYetMid', 'notYet');
    else void this.askPip('nar.whatSay', 'approach');
  }

  /** The question first, then the cards. */
  private async askPip(line: WindmillLineId, set: ChoiceSet): Promise<void> {
    this.pipTray = set;
    await this.step(line, false);
    this.pipTray = null;
    await this.offerPipChoices(set);
  }

  private launcherIsMine(): boolean {
    return this.pip.mode === 'childTurn' || this.pip.mode === 'together';
  }

  /** Working together: the child picks the arrow and Pip pushes the pump. */
  private pipPumps(): boolean {
    return this.pip.mode === 'together' && this.pip.role === 'aim';
  }

  private async pipLaunch(force = false): Promise<void> {
    if (this.pipBusy || !this.alive || this.kiteFree || this.launcher.firing) return;
    if (!force && (this.pipTray || services.choices.open)) return; // Pip notices the child and waits while they choose
    if (this.pip.mode !== 'busy' && this.pip.mode !== 'resting' && this.pip.mode !== 'notYet' && this.pip.mode !== 'offered') return;
    this.pipBusy = true;
    void this.dispatchPip({ type: 'PIP_LAUNCH_START' });
    const deg = PIP_PRACTICE[this.pipShot++ % PIP_PRACTICE.length];
    this.pipP.setFacing(1);
    this.launcher.setAngle(deg);
    await this.wait(400);
    void this.pipP.play('pump', { expression: 'determined' });
    const res = await this.launcher.fire(deg, this.flags.wind, D.air);
    const near = Math.abs(this.avatar.x - L.launcherX) < 450;
    this.onBallLanded(res, near);
    this.pipP.setExpression(res.endReason === 'windmill' ? 'silly' : 'surprised');
    this.pipBusy = false;
    const wasMode = this.pip.mode;
    // after "one more go", this hands over the turn (once Pip has finished saying it)
    if (wasMode === 'notYet') await this.talking;
    await this.dispatchPip({ type: 'PIP_LAUNCH_DONE' });
    // ordinary practice: one short line, only to a child standing close by, once per visit
    const practising = wasMode === 'busy' || wasMode === 'resting';
    if (practising && near && this.mode === 'explore' && !services.choices.open && !isSpeaking() && !this.pipSaidThisVisit) {
      this.pipSaidThisVisit = true;
      await this.sayLine(res.endReason === 'windmill' ? 'pip.whoaLow' : 'pip.whoa');
      await this.wait(400);
      if (this.alive && this.mode === 'explore' && !this.pipTray && !services.choices.open && (this.pip.mode === 'busy' || this.pip.mode === 'resting'))
        await this.dispatchPip({ type: 'WATCHED_LAUNCH' });
    }
    this.pipP.setExpression('happy');
  }

  private onBallLanded(res: ReturnType<typeof simulateLaunch>, near: boolean): void {
    if (res.endReason === 'windmill') {
      audio.play('bonk');
      this.birdFlutter();
    } else if (res.endReason === 'ground') {
      audio.play('puff', { vol: near ? 1 : 0.4 });
      dust(this, res.end.x, res.end.y, 6, D.air);
    }
  }

  private birdFlutter(): void {
    audio.play('chirp');
    const home = { x: this.bird.x, y: this.bird.y };
    this.tweens.chain({
      targets: this.bird,
      tweens: [
        { x: home.x + 220, y: home.y - 200, duration: 700, ease: 'Sine.easeOut' },
        { x: home.x - 60, y: home.y - 260, duration: 700, ease: 'Sine.easeInOut' },
        { x: home.x, y: home.y, duration: 700, ease: 'Sine.easeIn' },
      ],
    });
  }

  /** The launcher is the child's now: Pip points the way and says what to do first. */
  private async handOver(): Promise<void> {
    this.closePipTray();
    this.pipP.setFacing(1);
    void this.pipP.play('point');
    this.hints.poke();
    await this.wait(250);
    if (this.alive && this.mode === 'explore') await this.promptNext();
  }

  private goToLauncher(): void {
    if (!this.launcherIsMine() || this.kiteFree) return;
    this.hints.poke();
    if (this.preset === 'more-help' && this.nestNeeded()) {
      // one obvious path for four-year-olds: the nest comes first (Pip says so, the marker shows it)
      void this.promptNext();
      return;
    }
    if (this.sockOnHead) this.sockFliesHome();
    this.leaveMushroom();
    this.pipStepAside();
    this.walker.walkTo(L.aimStandX, () => {
      this.avatar.setFacing(1);
      this.enterAiming();
    });
  }

  /** Pip makes room at the launcher (never takes over). */
  private pipStepAside(): void {
    if (this.pip.mode === 'elsewhere' || Math.abs(this.pipP.x - L.pipAsideX) < 20) return;
    this.tweens.killTweensOf(this.pipP);
    this.pipP.startGait();
    this.pipP.faceToward(L.pipAsideX);
    this.tweens.add({
      targets: this.pipP,
      x: L.pipAsideX,
      duration: motion.reduced ? 1 : 500,
      onComplete: () => {
        this.pipP.stopGait();
        this.pipP.setFacing(1);
      },
    });
  }

  private enterAiming(): void {
    if (this.mode !== 'explore' || !this.launcherIsMine() || this.kiteFree) return;
    this.closePipTray();
    this.hand.hide();
    this.mode = 'aiming';
    // frame the child, the launcher, the nest and the stuck kite together, and keep it so through the shot
    this.camFollow = () => ({ x: AIM_CAM_X, y: 0 });
    this.aimAngle = null;
    this.firstPick = true;
    this.launcher.showButtons(ANGLES[this.preset], D.ui - 10);
    // the red pump draws in front of the child so it is never hidden
    this.launcher.bellows.setDepth(D.avatar + 2);
    void this.step('pip.pickArrow');
  }

  private exitAiming(): void {
    if (this.mode !== 'aiming') return;
    this.clearAimingProps();
    this.camFollow = null;
    this.mode = 'explore';
  }

  private clearAimingProps(): void {
    this.launcher.hideButtons();
    this.launcher.clearPreview();
    this.pulseBellows(false);
    this.launcher.bellows.setDepth(D.prop + 3);
  }

  private pulseBellows(on: boolean): void {
    this.bellowsPulse?.remove();
    this.bellowsPulse = undefined;
    this.launcher.bellows.setScale(1);
    if (on && !motion.reduced) this.bellowsPulse = this.tweens.add({ targets: this.launcher.bellows, scale: 1.25, duration: 420, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  private pickAngle(deg: number): void {
    if (this.mode !== 'aiming' || this.pipFiring) return;
    this.hints.poke();
    this.hand.hide();
    this.aimAngle = deg;
    this.lastAngle = deg;
    audio.play('clack');
    this.launcher.setAngle(deg);
    this.launcher.highlight(deg);
    // More help always sees the wind-bent path; More exploring sees it once the wind has surprised them
    const showWind = this.preset === 'more-help' || this.missCount > 0;
    this.launcher.preview(deg, showWind ? this.flags.wind : null, D.air - 1);
    if (this.pipPumps()) {
      void this.pipPumpsForChild(deg);
      return;
    }
    this.pulseBellows(true);
    if (this.firstPick) {
      this.firstPick = false;
      void this.step('pip.pump');
    }
  }

  private async pipPumpsForChild(deg: number): Promise<void> {
    this.pipFiring = true;
    await this.sayLine('pip.readyGo');
    this.pipFiring = false;
    if (this.mode === 'aiming' && this.aimAngle === deg) await this.childFire();
  }

  private async childFire(): Promise<void> {
    if (this.aimAngle === null || this.launcher.firing || this.mode !== 'aiming') return;
    this.hints.poke();
    this.hand.hide();
    this.mode = 'launching';
    this.pulseBellows(false);
    this.launcher.clearPreview();
    const deg = this.aimAngle;
    if (this.pipPumps()) void this.pipP.play('pump');
    else void this.avatar.play('pump');
    // the camera stays on the launcher and the kite: you see where your shot goes
    const res = await this.launcher.fire(deg, this.flags.wind, D.air);
    this.onBallLanded(res, true);
    if (res.hit) {
      this.clearAimingProps();
      audio.play('pop');
      audio.play('boing', { pitch: 1.3 });
      sparkle(this, KITE_HOME.x, KITE_HOME.y, 16, D.air + 2);
      this.tweens.add({ targets: this.kite.img, scaleX: 1.25, scaleY: 0.8, duration: 120, yoyo: true, repeat: 1 });
      this.pipP.setExpression('excited');
      void this.pipP.play('cheer');
      this.flags.route = 'launcher';
      const willCatch = catches(this.flags.nestX || null, 'launcher', this.flags.wind);
      this.talking = this.sayLine(willCatch ? 'pip.hitNest' : 'pip.hit');
      await this.dropKite('launcher');
      return;
    }
    this.missCount++;
    this.lastMiss = missKind(res);
    this.aimAngle = null;
    this.firstPick = this.preset === 'more-help';
    this.launcher.highlight(null);
    this.pipP.setExpression('thinking');
    this.mode = 'aiming';
    // the line says what to change, and the hint shows it
    await this.step(this.preset === 'more-help' ? 'pip.missOther' : this.lastMiss === 'high' ? 'pip.missHigh' : 'pip.missLow');
  }

  // ================================================================ the nest (landing pad)

  private spotsShown(): number[] {
    return spotsFor(this.preset, this.flags.route || null, this.flags.wind);
  }

  /** Which way the kite will be freed next (for More help's dotted path). */
  private expectedRoute(): 'launcher' | 'windmill' {
    if (this.onWindmillWay()) return 'windmill';
    if (this.flags.route) return this.flags.route;
    return this.launcherIsMine() || this.pip.mode !== 'resting' ? 'launcher' : 'windmill';
  }

  /** The spot the marker points at: by the flag, or (More help) where the dots end. */
  private suggestedSpot(): number | null {
    const spots = this.spotsShown();
    const near = (x: number) => spots.reduce((b, s) => (Math.abs(s - x) < Math.abs(b - x) ? s : b));
    if (this.flags.flagX) return near(this.flags.flagX);
    if (this.preset === 'more-help') return near(bestSpot(this.expectedRoute(), this.flags.wind));
    return null;
  }

  private chooseSpot(): void {
    if (this.flags.mixup === 'tangled' || this.kiteFree || this.mode === 'choosingSpot') return;
    this.hints.poke();
    this.hand.hide();
    this.closePipTray();
    this.exitAiming();
    this.mode = 'choosingSpot';
    this.camFollow = () => ({ x: SPOT_CAM_X, y: 0 });
    for (const m of this.spotMarkers) m.destroy();
    this.spotMarkers = this.spotsShown().flatMap((x) => {
      const ghost = addImage(this, x, groundY(x) - 14, 'wh.nest').setDepth(D.ui - 21).setAlpha(0.45).setScale(0.62);
      const ring = addImage(this, x, groundY(x) - 6, 'fx.tapring').setDepth(D.ui - 20).setScale(1.7, 0.9);
      if (!motion.reduced) this.tweens.add({ targets: ring, scaleX: 1.95, scaleY: 1.05, alpha: 0.6, duration: 700, yoyo: true, repeat: -1 });
      return [ghost, ring];
    });
    // More help sees where the kite will float down (an honest clue); a flag is its own clue
    if (this.preset === 'more-help' && !this.flags.flagX) this.spotPath = this.drawFallPath(this.expectedRoute());
    const line: WindmillLineId = this.flags.flagX ? 'pip.spotFlag' : this.preset === 'more-help' ? 'pip.spotDots' : 'pip.pickSpot';
    void this.step(line);
  }

  private clearSpots(): void {
    for (const m of this.spotMarkers) m.destroy();
    this.spotMarkers = [];
    this.spotPath?.destroy();
    this.spotPath = undefined;
  }

  private async placeNest(x: number): Promise<void> {
    if (this.mode !== 'choosingSpot') return;
    this.clearSpots();
    this.hand.hide();
    this.hints.poke();
    this.mode = 'cutscene';
    this.flags.nestX = x;
    this.camFollow = () => ({ x: this.nest.x + 250, y: 0 });
    // the child runs to the wagon and gives it a push
    const dir = x >= this.nest.x ? 1 : -1;
    this.walker.busy = false;
    const speed = this.walker.speed;
    this.walker.speed = Math.max(speed, 800);
    await this.walkTo(this.nest.x - dir * 170);
    this.walker.speed = speed;
    this.avatar.setFacing(dir);
    void this.avatar.play('pull');
    if (!this.flags.nestMoved) {
      // the mix-up: the wagon gets away down the slope, right into Pip's ribbon spool (nobody's fault)
      this.flags.nestMoved = true;
      audio.play('creak');
      await this.wait(250);
      this.avatar.setExpression('surprised');
      await this.nest.moveTo(VALLEY_X, true);
      audio.play('thud');
      this.nest.bounce(1.2);
      dust(this, VALLEY_X + 80, groundY(VALLEY_X), 10, D.prop + 3);
      this.tweens.add({ targets: this.spool, rotation: 0.6, x: L.spoolX + 40, duration: 260, ease: 'Quad.easeOut' });
      this.ribbonTrail = addImage(this, L.spoolX - 20, groundY(L.spoolX) - 20, 'wh.ribbon.trail').setDepth(D.prop);
      this.flags.mixup = 'tangled';
      this.showTangle(true);
      this.persist();
      await this.mixupScene();
      return;
    }
    this.persist();
    void this.walkTo(x - dir * 170);
    await this.nest.moveTo(x);
    this.nest.setChocks(true);
    audio.play('place');
    this.avatar.setExpression('happy');
    this.camFollow = null;
    this.enterExplore();
    await this.promptNext();
  }

  private showTangle(animate: boolean): void {
    this.nest.tangle();
    if (!animate) this.nest.loops.forEach((l) => l.setScale(1));
  }

  private async mixupScene(): Promise<void> {
    this.mode = 'mixup';
    // the wagon sits at the side of the screen, clear of the choice cards
    this.camFollow = () => ({ x: VALLEY_X + (this.preset === 'more-help' ? 300 : 640), y: 0 });
    // Pip runs over from the launcher, laughing it off
    if (this.pip.mode !== 'elsewhere') void this.dispatchPip({ type: 'LEAVE_LAUNCHER' });
    this.clearAimingProps();
    this.tweens.killTweensOf(this.pipP);
    this.pipP.startGait();
    this.pipP.faceToward(VALLEY_X + 180);
    const run = this.tweenP({ targets: this.pipP, x: VALLEY_X + 210, duration: motion.reduced ? 300 : 1000 }).then(() => {
      this.pipP.stopGait();
      this.pipP.setFacing(-1);
      void this.pipP.play('oops', { expression: 'silly' });
    });
    if (this.preset === 'more-help') {
      // four-year-olds go straight to the fixing: one obvious thing to tap
      await this.sayLine('pip.eep');
      await run;
      this.persist();
      await this.startRepair('pip.tapLoops');
      return;
    }
    this.walker.busy = false;
    void this.walkTo(VALLEY_X - 210);
    await Promise.all([run, this.step('pip.eepAsk', false)]);
    const pick = (await services.choices.ask([...WINDMILL_CHOICES.mixupExplore], { readAloud: true })) ?? 'fix';
    this.avatar.emote('speak', 900);
    this.avatar.talk(600);
    let line: WindmillLineId = 'pip.goodIdea';
    if (pick === 'sorry') {
      line = 'pip.thanksSorry';
      this.pip.approaches = [...this.pip.approaches, 'said sorry after the wagon rolled'];
    } else if (pick === 'help') {
      line = 'pip.sureHelp';
      this.pip.approaches = [...this.pip.approaches, 'asked Pip for help fixing the ribbon'];
    } else {
      this.pip.approaches = [...this.pip.approaches, 'offered to fix the ribbon'];
    }
    this.pipP.setExpression('happy');
    this.persist();
    await this.startRepair(line);
  }

  private async startRepair(line: WindmillLineId): Promise<void> {
    this.mode = 'repair';
    this.camFollow = () => ({ x: VALLEY_X + 120, y: 0 });
    if (!this.nest.loops.length) this.showTangle(true);
    this.walker.busy = false;
    this.walker.walkTo(VALLEY_X - 210, () => this.avatar.setFacing(1));
    this.hand.hide();
    this.pipSorrySaid = false;
    this.hints.poke();
    // the red loops can be tapped while Pip is still talking
    this.repairSaid = this.step(line);
    await this.repairSaid;
  }

  private untangle(i: number): void {
    if (this.mode !== 'repair') return;
    this.hints.poke();
    this.hand.hide();
    void this.avatar.play('pull');
    this.nest.untangleOne(i, { x: this.pipP.x - 20, y: this.pipP.y - 90 });
    void this.pipP.play('pump');
    audio.play('zip', { pitch: 1 + (3 - this.nest.loopsLeft()) * 0.15, delay: 0.1 });
    sparkle(this, this.nest.x, this.nest.c.y - 40, 5, D.ui);
    if (!this.pipSorrySaid && this.nest.loopsLeft() > 0) {
      // Pip owns their part too: repair goes both ways
      this.pipSorrySaid = true;
      this.talking = this.repairSaid.then(() => (this.alive ? this.sayLine('pip.myPart') : undefined));
    }
    this.time.delayedCall(560, () => {
      if (this.nest.loopsLeft() === 0 && this.mode === 'repair') void this.repaired();
    });
  }

  private async repaired(): Promise<void> {
    this.mode = 'cutscene';
    this.nest.clearLoops();
    this.ribbonTrail?.destroy();
    this.flags.mixup = 'fixed';
    this.persist();
    this.pipP.setExpression('excited');
    void this.pipP.play('cheer');
    void this.avatar.play('hop', { expression: 'excited' });
    sparkle(this, this.nest.x, this.nest.c.y - 60, 14, D.ui);
    audio.play('success');
    await this.talking;
    // Pip scoops up the spool while cheering, so nothing rolls into it again
    const grab = this.tweenP({ targets: this.pipP, x: L.spoolX + 20, duration: 400 }).then(() => this.spool.setVisible(false));
    await this.sayLine('pip.fixed');
    await grab;
    // the nest rolls to the chosen spot and gets its wheel wedges; the child steps out of the way
    const x = this.flags.nestX;
    this.walker.busy = false;
    void this.walkTo(Math.min(x, this.nest.x) - 220);
    void this.pipP.play('pull');
    await this.nest.moveTo(x);
    this.nest.setChocks(true);
    audio.play('place');
    this.persist();
    // Pip heads back to the launcher (the child can go straight on)
    void this.dispatchPip({ type: 'BACK_TO_LAUNCHER' });
    this.pipP.startGait();
    this.pipP.faceToward(L.pipX);
    this.tweens.add({
      targets: this.pipP,
      x: L.pipX,
      duration: motion.reduced ? 300 : 1300,
      onComplete: () => {
        this.pipP.stopGait();
        this.pipP.setFacing(1);
        this.pipP.setExpression('happy');
      },
    });
    this.enterExplore();
    await this.promptNext();
  }

  private placeFlag(x: number, instant = false): void {
    this.flagImg?.destroy();
    this.flagImg = addImage(this, x, groundY(x) + 4, 'wh.flag').setDepth(D.prop + 6);
    if (!instant) {
      this.flagImg.setScale(1, 0.1);
      this.tweens.add({ targets: this.flagImg, scaleY: 1, duration: 300, ease: 'Back.easeOut' });
    }
  }

  // ================================================================ the windmill route

  private async useLever(): Promise<void> {
    if (this.mill.leverDown || this.kiteFree) return;
    if (this.carryingPumpkin) {
      await this.putPumpkinInBucket();
      return;
    }
    if (this.rowanAtLever) {
      await this.pullWithRowan();
      return;
    }
    this.leverTried = true;
    void this.avatar.play('pull', { expression: 'determined' });
    this.mill.wiggleLever();
    await this.wait(600);
    this.avatar.setExpression('thinking');
    this.avatar.emote('think', 2200);
    this.tweens.add({ targets: this.mill.bucket, scale: 1.15, duration: 300, yoyo: true, repeat: 2 });
    await this.step('nar.stiff');
    this.avatar.setExpression('happy');
  }

  private pickPumpkin(): void {
    if (this.carryingPumpkin) return;
    this.hints.poke();
    void this.avatar.play('reach');
    audio.play('pickup', { pitch: 0.7 });
    this.time.delayedCall(220, () => {
      this.carryingPumpkin = true;
      this.pumpkin.setDepth(D.avatar + 1);
      this.avatar.hold(this.pumpkin);
      this.pumpkin.setPosition(this.avatar.rig.anchors.hand.x - 20, this.avatar.rig.anchors.hand.y + 30);
      this.avatar.carryPose();
      this.walker.speed = 320;
      this.avatar.setExpression('determined');
      // show where it goes
      this.tweens.add({ targets: this.mill.bucket, scale: 1.15, duration: 300, yoyo: true, repeat: 2 });
      void this.step('nar.toBucket');
    });
  }

  private async putPumpkinInBucket(): Promise<void> {
    if (!this.carryingPumpkin) return;
    this.mode = 'cutscene';
    this.carryingPumpkin = false;
    this.walker.speed = 520;
    this.avatar.hold(null);
    this.pumpkinInBucket = true;
    this.mill.loadBucket(this.pumpkin);
    this.pumpkin.setDepth(D.prop + 4);
    audio.play('thud');
    audio.play('boing', { pitch: 0.7, delay: 0.1 });
    this.avatar.setExpression('excited');
    await this.releaseWindmill();
  }

  private async talkToRowan(): Promise<void> {
    this.mode = 'cutscene';
    this.rowanP.faceToward(this.avatar.x);
    await this.step('rowan.hello', false);
    const pick = await services.choices.ask([...(this.preset === 'more-help' ? WINDMILL_CHOICES.rowanHelp : WINDMILL_CHOICES.rowanExplore)], { readAloud: true });
    this.avatar.emote('speak', 800);
    if (pick === 'help' && !this.kiteFree && this.checkpoint !== 'done') {
      this.flags.rowanHelping = true;
      this.rowanAtLever = true;
      this.pip.approaches = [...this.pip.approaches, 'asked Rowan for help with the brake'];
      this.persist();
      // Rowan walks over to stand beside the bucket (not in front of the lever) while saying what to do
      this.rowanP.startGait();
      this.rowanP.faceToward(L.leverX + 260);
      const walk = this.tweenP({ targets: this.rowanP, x: L.leverX + 260, duration: 1100 }).then(() => {
        this.rowanP.stopGait();
        this.rowanP.setFacing(-1);
        void this.rowanP.play('reach');
        this.tweens.add({ targets: this.mill.leverArm, scale: 1.08, duration: 300, yoyo: true, repeat: 2 });
      });
      this.enterExplore();
      await this.step('rowan.help');
      await walk;
      return;
    }
    if (pick === 'help') await this.sayLine('rowan.handled');
    else if (pick === 'what') await this.sayLine('rowan.whatDoing');
    else {
      void this.avatar.play('wave');
      void this.rowanP.play('wave');
      await this.sayLine('rowan.bye');
    }
    this.enterExplore();
  }

  private async pullWithRowan(): Promise<void> {
    this.mode = 'cutscene';
    void this.avatar.play('pull', { expression: 'determined' });
    void this.rowanP.play('pull', { expression: 'calm' });
    await this.wait(500);
    await this.releaseWindmill();
  }

  private async releaseWindmill(): Promise<void> {
    this.mode = 'cutscene';
    this.exitAiming();
    this.mode = 'cutscene';
    this.camFollow = () => ({ x: HUB.x - 250, y: HUB.y });
    this.talking = this.sayLine('nar.turning');
    // the kite rides the turning sail
    const prox = { a: 0 };
    const turn = this.mill.releaseAndTurn(SAIL_TURN);
    await this.wait(motion.reduced ? 100 : 900);
    await this.tweenP({
      targets: prox,
      a: SAIL_TURN,
      duration: motion.reduced ? 600 : 2200,
      ease: 'Sine.easeInOut',
      onUpdate: () => {
        const tip = sailTip(KITE_SAIL_ANGLE + prox.a);
        this.kite.setPosition(tip.x, tip.y);
        this.kite.img.rotation = KITE_SAIL_ANGLE + prox.a + Math.PI / 2 + 0.3;
      },
    });
    await turn;
    this.flags.route = 'windmill';
    this.kite.setPosition(KITE_LOW.x, KITE_LOW.y);
    await this.dropKite('windmill');
  }

  // ================================================================ the falling kite

  private async dropKite(route: 'launcher' | 'windmill'): Promise<void> {
    this.mode = 'falling';
    this.kiteFree = true;
    this.inputLocked = true;
    this.walker.stop();
    this.hand.hide();
    this.closePipTray();
    services.choices.cancel();
    this.clearAimingProps();
    const from = releasePoint(route);
    const land = kiteLanding(from, this.flags.wind);
    const drift = WIND.kiteDrift[this.flags.wind];
    this.kite.setPosition(from.x, from.y);
    audio.play('flutter');
    this.camFollow = () => ({ x: this.kite.x, y: this.kite.y });
    // its shadow on the grass shows where it is heading, and grows as it gets close
    const shadow = addImage(this, from.x, groundY(from.x) + 8, 'wh.kiteshadow').setDepth(D.prop + 5).setAlpha(0.6).setScale(0.6);
    const prox = { t: 0 };
    let x = from.x;
    let y = from.y;
    await this.tweenP({
      targets: prox,
      t: land.time,
      duration: land.time * 1000,
      ease: 'Linear',
      onUpdate: () => {
        const t = prox.t;
        x = from.x + drift * t;
        y = Math.min(from.y + KITE_FALL * t, groundY(x) - 30);
        const flutter = Math.sin(t * 5) * 26;
        this.kite.setPosition(x + flutter, y);
        this.kite.img.rotation = Math.sin(t * 5) * 0.35 - 0.2;
        const k = t / land.time;
        shadow.setPosition(x + flutter, groundY(x + flutter) + 8).setScale(0.6 + k * 0.6).setAlpha(0.6 + k * 0.4);
        if (Math.floor(t * 4) !== Math.floor((t - 0.016) * 4)) audio.play('flutter', { vol: 0.3 });
      },
    });
    shadow.destroy();
    const caught = catches(this.flags.nestX || null, route, this.flags.wind);
    if (caught) {
      const seat = this.nest.seat();
      await this.tweenP({ targets: this.kite.img, x: seat.x, y: seat.y, rotation: 0.2, duration: 300, ease: 'Quad.easeOut' });
      await this.celebrate();
      this.inputLocked = false;
      await this.talking;
      await this.resolutionCaught(route);
      return;
    }
    // missed the nest: it touches down, a flag marks the spot, then the windmill breeze lifts it back
    audio.play('thud', { vol: 0.5 });
    dust(this, land.x, groundY(land.x) - 10, 8, D.air);
    this.kite.img.rotation = 1.2;
    this.flags.flagX = Math.round(land.x);
    this.placeFlag(land.x);
    this.persist();
    this.pipP.setExpression('surprised');
    await this.talking;
    const said = this.sayLine('pip.missNest');
    await this.wait(900);
    await this.bounceBack();
    await said;
    if (route === 'windmill') {
      const reset = this.mill.reset();
      if (this.pumpkinInBucket) {
        // the pumpkin tumbles out and rolls home (boing!)
        this.mill.loadBucket(null);
        this.pumpkinInBucket = false;
        this.add.existing(this.pumpkin);
        this.pumpkin.setPosition(L.leverX + 170, groundY(L.leverX + 170)).setDepth(D.prop + 2);
        audio.play('thud');
        audio.play('boing', { pitch: 0.6, delay: 0.2 });
        await this.tweenP({ targets: this.pumpkin, x: this.pumpkinHome.x, rotation: Math.PI * 4, duration: motion.reduced ? 300 : 1200, ease: 'Quad.easeOut' });
        this.pumpkin.rotation = 0;
      }
      await reset;
      if (this.rowanAtLever) void this.rowanP.play('nod');
    }
    this.inputLocked = false;
    this.kiteFree = false;
    this.enterExplore();
    // show the flag and the nest together while Pip says what to do; never straight back to aiming
    const both = () => ({ x: (this.flags.flagX + this.nest.x) / 2, y: 0 });
    this.camFollow = both;
    await this.promptNext();
    if (this.camFollow === both) this.camFollow = null;
  }

  /** The squishy "you did it" moment: the nest bounces, sparkles, a happy chime, everyone cheers. */
  private async celebrate(): Promise<void> {
    const seat = this.nest.seat();
    audio.play('success');
    void this.pipP.play('cheer', { expression: 'excited' });
    void this.avatar.play('jump', { expression: 'excited' });
    for (let i = 0; i < 3; i++) {
      this.nest.bounce(0.8 + i * 0.2);
      if (!motion.reduced) this.tweens.add({ targets: this.kite.img, scaleY: 0.82, scaleX: 1.12, duration: 110, yoyo: true });
      sparkle(this, seat.x + (i - 1) * 70, seat.y - 20, 10, D.ui);
      audio.play('chime', { note: 4 + i * 2 });
      await this.wait(motion.reduced ? 120 : 280);
    }
  }

  private async bounceBack(): Promise<void> {
    audio.play('whoosh');
    const start = new Phaser.Math.Vector2(this.kite.x, this.kite.y);
    const curve = new Phaser.Curves.QuadraticBezier(start, new Phaser.Math.Vector2((start.x + KITE_HOME.x) / 2, 120), new Phaser.Math.Vector2(KITE_HOME.x, KITE_HOME.y));
    const prox = { t: 0 };
    seeds(this, start.x, start.y, 260, 10, D.air);
    await this.tweenP({
      targets: prox,
      t: 1,
      duration: motion.reduced ? 500 : 1800,
      ease: 'Sine.easeInOut',
      onUpdate: () => {
        const v = curve.getPoint(prox.t);
        this.kite.setPosition(v.x, v.y);
        this.kite.img.rotation = Math.sin(prox.t * 20) * 0.5;
      },
    });
    audio.play('rustle');
    this.kiteRestOnSail();
    this.kiteFree = true;
  }

  // ================================================================ resolution

  private async resolutionCaught(route: 'launcher' | 'windmill'): Promise<void> {
    this.mode = 'cutscene';
    this.hints.poke();
    this.launcher.hideButtons();
    this.camFollow = () => ({ x: this.nest.x + 80, y: 0 });
    // Pip runs to the nest while saying thank you
    this.tweens.killTweensOf(this.pipP);
    this.pipP.startGait();
    this.pipP.faceToward(this.nest.x + 190);
    const run = this.tweenP({ targets: this.pipP, x: this.nest.x + 190, duration: motion.reduced ? 300 : 1300 }).then(() => {
      this.pipP.stopGait();
      this.pipP.setFacing(-1);
    });
    this.walker.busy = false;
    this.walker.walkTo(this.nest.x - 190, () => this.avatar.setFacing(1));
    await this.sayLine(route === 'launcher' ? 'pip.caught' : 'pip.otherWay');
    await run;
    this.flags.route = route;
    this.setCheckpoint('caught');
    await this.resolutionKnots();
  }

  private async resolutionKnots(): Promise<void> {
    this.mode = 'cutscene';
    this.camFollow = () => ({ x: this.nest.x + 80, y: 0 });
    if (this.kite.tail) {
      // the old tail tumbles off in the landing
      this.kite.setTail(null);
      audio.play('paper');
      seeds(this, this.kite.x, this.kite.y + 60, -60, 6, D.air);
    }
    this.pipP.setExpression('excited');
    this.knotsLeft = 3;
    const seat = this.nest.seat();
    this.knotImgs = [0, 1, 2].map((i) => {
      const img = addImage(this, seat.x + (i - 1) * 70, seat.y + 96 + (i % 2) * 18, 'wh.ribbon.loop').setDepth(D.ui - 5).setScale(0.75);
      if (!motion.reduced) this.tweens.add({ targets: img, scale: 0.9, duration: 500, yoyo: true, repeat: -1 });
      this.addTarget({
        id: `knot-${i}`,
        label: 'Tie a knot',
        bounds: () => this.rectAround(img.x, img.y, 70, 70, 34),
        enabled: () => this.mode === 'knots' && img.visible,
        activate: () => this.tieKnot(i),
        priority: 0,
      });
      return img;
    });
    // the loops can be tapped while Pip is still talking
    this.mode = 'knots';
    await this.step('pip.newTail');
  }

  private tieKnot(i: number): void {
    const img = this.knotImgs[i];
    if (!img?.visible) return;
    this.hints.poke();
    this.hand.hide();
    this.tweens.killTweensOf(img);
    void this.avatar.play('reach');
    void this.pipP.play('nod');
    audio.play('zip');
    audio.play('snap', { delay: 0.2 });
    this.tweens.add({ targets: img, scale: 0, rotation: 3, duration: 280, onComplete: () => img.setVisible(false) });
    sparkle(this, img.x, img.y, 6, D.ui);
    this.knotsLeft--;
    if (this.knotsLeft === 0) {
      for (let k = 0; k < 3; k++) this.removeTarget(`knot-${k}`);
      this.kite.setTail({ pattern: this.flags.tailPattern || 'stars', color: this.flags.tailColor || 'berry' });
      this.time.delayedCall(500, () => void this.decorate());
    }
  }

  private async decorate(): Promise<void> {
    this.mode = 'decorate';
    // the picker opens while Pip asks, so there is no wait
    const askPattern = this.step('pip.pickTail');
    const pattern = await this.pickFromPanel(
      TAIL_PATTERNS.map((p) => ({ id: p, label: p[0].toUpperCase() + p.slice(1), art: pieceSvg(`kite.bow.${p}`) })),
      'pattern',
    );
    this.flags.tailPattern = pattern;
    this.kite.setTail({ pattern, color: this.flags.tailColor || 'berry' });
    audio.play('pop');
    await askPattern;
    const askColor = this.step('pip.pickColor');
    const color = await this.pickFromPanel(
      CHOICE_COLORS.map((c) => ({ id: c.id, label: c.name, art: bowSvg(pattern, '#ffffff'), color: c.hex })),
      'color',
      (id) => this.kite.setTail({ pattern, color: id }),
    );
    this.flags.tailColor = color;
    this.kite.setTail({ pattern, color });
    audio.play('sparkle');
    sparkle(this, this.kite.x, this.kite.y + 80, 14, D.ui);
    await askColor;
    // record the souvenir (one per profile; replays update it rather than duplicating)
    updateProfile((p) => {
      p.progress.souvenirs['kite-tail'] = { id: 'kite-tail', at: Date.now(), data: { pattern, color } };
    });
    this.persist();
    await this.flyKite();
  }

  /**
   * Big-tile picker in the DOM (no reading needed: patterns/colours are shown).
   * A tap shows it on the kite; it is kept a moment later on its own (the tick
   * is there for anyone who wants to say "done" straight away).
   */
  private pickFromPanel(items: { id: string; label: string; art: string; color?: string }[], kind: 'pattern' | 'color', onPreview?: (id: string) => void): Promise<string> {
    return new Promise((resolve) => {
      this.decorPanel?.remove();
      let chosen: string | null = null;
      let timer: Phaser.Time.TimerEvent | undefined;
      let finished = false;
      const finish = () => {
        if (!chosen || finished) return;
        finished = true;
        timer?.remove();
        audio.play('confirm');
        panel.remove();
        this.decorPanel = undefined;
        resolve(chosen);
      };
      const done = h('button', { class: 'btn-round', type: 'button', 'aria-label': 'Done', html: icon('check'), disabled: true, 'data-decor-done': true });
      const tiles = items.map((it) => {
        const b = h(
          'button',
          {
            class: 'tile',
            type: 'button',
            'aria-pressed': 'false',
            'aria-label': it.label,
            'data-decor': it.id,
            style: `width:${kind === 'color' ? 104 : 124}px;min-height:${kind === 'color' ? 104 : 124}px;padding:6px;${it.color ? `background:${it.color}` : ''}`,
            on: {
              click: () => {
                chosen = it.id;
                audio.play('tap');
                tiles.forEach((t) => t.setAttribute('aria-pressed', String(t === b)));
                done.disabled = false;
                done.classList.add('glow');
                onPreview?.(it.id);
                if (kind === 'pattern') this.kite.setTail({ pattern: it.id, color: this.flags.tailColor || 'berry' });
                this.hints.poke();
                timer?.remove();
                timer = this.time.delayedCall(2200, finish);
              },
            },
          },
          h('span', { html: it.art, style: `display:block;width:88px;height:62px;${it.color ? '' : 'background:' + mix(P.sea, '#ffffff', 0.1) + ';border-radius:16px'}` }),
          kind === 'pattern' ? h('span', {}, it.label) : null,
        );
        return b;
      });
      done.addEventListener('click', finish);
      const panel = h(
        'div',
        { class: 'choices', style: 'display:flex;align-items:center;gap:14px', role: 'group', 'aria-label': kind === 'pattern' ? 'Tail pattern' : 'Tail colour' },
        ...tiles,
        done,
      );
      services.layers.choices.append(panel);
      this.decorPanel = panel;
      tiles[0].focus();
    });
  }

  private async flyKite(): Promise<void> {
    this.mode = 'cutscene';
    this.camFollow = null;
    // the kite lifts while Pip says so
    const said = this.sayLine('pip.run');
    this.walker.busy = false;
    this.kite.stringTo = this.avatar.handWorld();
    this.avatar.setFacing(-1);
    this.walker.speed = 600;
    const runTo = Math.max(L.minX + 200, this.avatar.x - 380);
    this.flyTarget = { x: runTo + 120, y: 300 };
    void this.walkTo(runTo);
    await this.tweenP({ targets: this.kite.img, x: this.avatar.x + 100, y: 320, rotation: -0.1, duration: 1400, ease: 'Sine.easeOut' });
    await said;
    this.walker.speed = 520;
    this.mode = 'flying';
    this.inputLocked = false;
    void this.avatar.play('cheer', { expression: 'excited' });
    void this.pipP.play('clap');
    this.input.on('pointerdown', this.flyDown, this);
    this.input.on('pointermove', this.flyMove, this);
    this.input.on('pointerup', this.flyUp, this);
    this.showSkyRings(runTo);
    const flying = this.step('pip.flying', true);
    await this.completeQuest();
    await flying;
    // free flying for a while before anyone asks anything
    await this.wait(6000);
    if (!this.alive) return;
    await this.endChoices();
  }

  /** Golden rings in the sky to swoop the kite through (no count, no score). */
  private showSkyRings(x0: number): void {
    const spots = [
      [x0 - 260, 250],
      [x0 + 120, 470],
      [x0 + 430, 230],
    ];
    this.rings.forEach((r, i) => {
      r.setPosition(spots[i][0], spots[i][1]).setVisible(true).setAlpha(1).setScale(0.2);
      this.tweens.add({ targets: r, scale: 1, duration: 300, delay: i * 120, ease: 'Back.easeOut' });
    });
  }

  private hideSkyRings(): void {
    for (const r of this.rings) {
      this.tweens.killTweensOf(r);
      r.setVisible(false);
    }
  }

  private flyDown(p: Phaser.Input.Pointer): void {
    if (this.mode !== 'flying') return;
    this.flyPointerDown = true;
    this.flyTarget.y = Phaser.Math.Clamp(p.worldY, 120, 640);
    this.hints.poke();
  }
  private flyMove(p: Phaser.Input.Pointer): void {
    if (this.mode !== 'flying' || !this.flyPointerDown) return;
    this.flyTarget.y = Phaser.Math.Clamp(p.worldY, 120, 640);
    this.flyTarget.x = Phaser.Math.Clamp(p.worldX, this.avatar.x - 500, this.avatar.x + 500);
  }
  private flyUp(): void {
    this.flyPointerDown = false;
  }

  private flyTick(dt: number): void {
    const t = this.time.now / 1000;
    const tx = this.flyPointerDown ? this.flyTarget.x : this.avatar.x + 140 + Math.sin(t * 0.7) * 160;
    const ty = this.flyTarget.y + Math.sin(t * 1.3) * 30;
    const k = this.kite.img;
    const vx = (tx - k.x) * 2.2;
    const vy = (ty - k.y) * 2.2;
    k.x += vx * dt;
    k.y += vy * dt;
    k.rotation = Phaser.Math.Linear(k.rotation, Phaser.Math.Clamp(vx / 700, -0.7, 0.7), 0.1);
    if (Math.abs(vy) > 600 && Math.random() < 0.05) audio.play('swish', { vol: 0.4 });
    this.kite.stringTo = this.avatar.handWorld();
    // swooping through a ring: a chime and sparkles; the ring comes back a moment later
    this.rings.forEach((r, i) => {
      if (!r.visible || r.alpha < 1 || Math.hypot(r.x - k.x, r.y - k.y) > 90) return;
      r.setAlpha(0.99);
      audio.play('chime', { note: 4 + i * 2 });
      sparkle(this, r.x, r.y, 14, D.air + 2);
      this.tweens.add({
        targets: r,
        scale: 1.5,
        alpha: 0,
        duration: 400,
        onComplete: () =>
          this.time.delayedCall(2500, () => {
            if (this.mode !== 'flying') return;
            r.setScale(0.2).setAlpha(1);
            this.tweens.add({ targets: r, scale: 1, duration: 300, ease: 'Back.easeOut' });
          }),
      });
    });
  }

  private async completeQuest(): Promise<void> {
    const route = this.flags.route || 'launcher';
    const approaches = this.pip.approaches.length ? ` (${this.pip.approaches.join(', ')})` : '';
    let first = false;
    updateProfile((p) => {
      const prev = p.progress.quests[WINDMILL_QUEST];
      first = !prev || prev.status !== 'done';
      p.progress.quests[WINDMILL_QUEST] = {
        status: 'done',
        checkpoint: 'done',
        flags: writeFlags({ ...this.flags, pipMode: 'busy', role: '' }),
        completions: (prev?.completions ?? 0) + 1,
        firstDoneAt: prev?.firstDoneAt ?? Date.now(),
      };
      p.progress.done['windmill-kite'] = (p.progress.done['windmill-kite'] ?? 0) + 1;
    });
    this.checkpoint = 'done';
    services.save.log(
      services.profileId!,
      'trail',
      `${first ? 'Completed' : 'Replayed'} The Windmill Kite using the ${route === 'launcher' ? 'launcher' : 'windmill brake'}${approaches}. Chose a ${this.flags.tailPattern} kite tail.`,
    );
    services.session.made.push({ kind: 'souvenir', label: 'Kite tail', art: bowSvg(this.flags.tailPattern || 'stars', choiceColor(this.flags.tailColor || 'berry')) });
    await services.save.flush();
  }

  private async endChoices(): Promise<void> {
    await this.step('nar.whatNext', false);
    const pick = await services.choices.ask([...WINDMILL_CHOICES.end], { readAloud: true });
    this.hideSkyRings();
    this.input.off('pointerdown', this.flyDown, this);
    this.input.off('pointermove', this.flyMove, this);
    this.input.off('pointerup', this.flyUp, this);
    if (pick === 'again') {
      this.scene.restart({ replay: true });
      return;
    }
    if (pick === 'map') {
      services.nav.openMap();
      return;
    }
    await this.sayLine('pip.tieIt');
    this.setupDoneWorld();
    this.enterExplore();
    this.mode = 'done';
  }

  /** After completion the kite flies from a post over Windmill Hill. */
  private setupDoneWorld(): void {
    this.mode = 'done';
    const postX = 2200;
    this.postImg?.destroy();
    this.postImg = addImage(this, postX, groundY(postX) + 4, 'wh.post').setDepth(D.prop);
    this.kiteFree = true;
    if (this.flags.tailPattern) this.kite.setTail({ pattern: this.flags.tailPattern, color: this.flags.tailColor || 'berry' });
    this.kite.setPosition(postX + 180, 260);
    this.kite.stringTo = { x: postX, y: groundY(postX) - 160 };
    this.tweens.add({ targets: this.kite.img, x: postX + 260, y: 300, rotation: 0.25, duration: 2600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.nest.place(this.flags.nestX || L.nestStartX);
    this.nest.setChocks(true);
    this.spool.setVisible(false);
    this.pipP.x = postX - 120;
    this.pipP.setFacing(1);
    this.camFollow = null;
  }

  private async doneTalk(): Promise<void> {
    if (services.choices.open) return;
    await this.step('pip.welcomeBack', false);
    const pick = await services.choices.ask([...WINDMILL_CHOICES.doneTalk], { readAloud: true });
    if (pick === 'again') this.scene.restart({ replay: true });
    else void this.pipP.play('wave');
  }

  // ================================================================ per-frame

  protected override tick(_time: number, rawDelta: number): void {
    // physics-like motion takes steps no bigger than 200 ms, however slow the frame
    const delta = Math.min(rawDelta, 200);
    const dt = delta / 1000;
    if (this.mode === 'glider') this.gliderTick(dt);
    if (this.mode === 'flying') this.flyTick(dt);
    this.walker.update(delta);
    this.kite.update(delta);
    this.mill.breeze(this.time.now);
    for (const c of this.clouds) {
      c.x -= 14 * dt;
      if (c.x < -400) c.x += 2800;
    }
    this.windsock.rotation = Math.sin(this.time.now / 260) * 0.05;
    this.updateCamera(dt);
    this.updateKiteIcon();
    this.updateProximity(delta);
  }

  private updateCamera(dt: number): void {
    const cam = this.cameras.main;
    const target = this.camFollow ? this.camFollow() : { x: this.exploreCamX(), y: 0 };
    // reduced motion: the camera cuts instead of gliding
    const k = motion.reduced ? 1 : Math.min(1, dt * (this.camFollow ? 3 : 2.4));
    this.camX = Phaser.Math.Linear(this.camX || target.x, target.x, k);
    cam.scrollX = Phaser.Math.Clamp(this.camX - this.view.w / 2, 0, WORLD_W - this.view.w);
    cam.scrollY = -this.view.oy;
  }

  /** While exploring, the camera leans toward the stuck kite so the goal stays on screen. */
  private exploreCamX(): number {
    const ax = this.avatar.x + this.avatar.facing * 100;
    if (this.kiteFree || this.checkpoint !== 'hill') return ax;
    const reach = this.view.w / 2 - 170;
    const lean = ax + 0.5 * (KITE_HOME.x - ax);
    return Phaser.Math.Clamp(lean, this.avatar.x - reach, this.avatar.x + reach);
  }

  /** A little kite at the screen edge points to the stuck kite when it is off screen. */
  private updateKiteIcon(): void {
    const v = this.cameras.main.worldView;
    const show = !this.kiteFree && this.checkpoint === 'hill' && (this.mode === 'explore' || this.mode === 'aiming');
    const side = KITE_HOME.x > v.right - 30 ? 1 : KITE_HOME.x < v.x + 30 ? -1 : 0;
    if (!show || !side) {
      this.kiteIcon.setVisible(false);
      this.kiteIconArrow.setVisible(false);
      return;
    }
    const bob = motion.reduced ? 0 : Math.sin(this.time.now / 260) * 10;
    const x = side > 0 ? this.view.w - 120 : 120;
    const y = this.view.oy + 250;
    this.kiteIcon.setVisible(true).setPosition(x, y).setRotation(side * 0.2);
    this.kiteIconArrow
      .setVisible(true)
      .setPosition(x + side * (70 + bob), y)
      .setRotation(side > 0 ? 0 : Math.PI);
  }

  private updateProximity(delta: number): void {
    if (this.mode === 'intro' || this.mode === 'glider' || this.checkpoint === 'done') return;
    const dPip = Math.abs(this.avatar.x - this.pipP.x);
    if (this.mode === 'explore' && !this.kiteFree && this.flags.mixup !== 'tangled') {
      const lingering = dPip < 320 && !this.walker.moving;
      // coming back after "look around": Pip saved your turn
      if (lingering && this.pip.owedTurn && !this.pip.midLaunch) void this.dispatchPip({ type: 'CHILD_RETURNED' });
      // standing at the launcher starts aiming, but never straight after a landing that needs the nest moved
      if (this.launcherIsMine() && !this.nestNeeded() && Math.abs(this.avatar.x - L.aimStandX) < 60 && !this.walker.moving && !this.walker.busy) {
        this.pipStepAside();
        this.enterAiming();
      }
    }
    if (dPip > 700) {
      // walking away is a fine answer (only the child walking counts, not Pip heading home)
      if (this.walker.moving && this.pipTray && services.choices.open && ['busy', 'resting', 'offered', 'notYet'].includes(this.pip.mode)) this.closePipTray();
      this.pipSaidThisVisit = false;
    }
    if (this.mode === 'aiming' && Math.abs(this.avatar.x - L.launcherX) > 320) this.exitAiming();
    if (this.mode === 'choosingSpot' && Math.abs(this.avatar.x - SPOT_CAM_X) > 1100) {
      this.clearSpots();
      this.camFollow = null;
      this.mode = 'explore';
    }
    // Pip practises (never succeeds alone), but only while the child is free to watch:
    // never during another step, a choice, or someone talking
    if (
      this.mode === 'explore' &&
      !this.kiteFree &&
      (this.pip.mode === 'busy' || this.pip.mode === 'resting') &&
      !this.pipBusy &&
      !services.choices.open &&
      !isSpeaking() &&
      Math.abs(this.avatar.x - L.launcherX) < 1400
    ) {
      this.pipTimer += delta;
      const every = this.pip.mode === 'busy' ? 15000 : 20000;
      if (this.pipTimer > every) {
        this.pipTimer = 0;
        void this.pipLaunch();
      }
    }
  }

  // ================================================================ hints & the "next thing" marker

  override hint(): void {
    this.hints.request();
  }

  /** Hints only when there is something to tap: never in a cutscene, flight, or fall. */
  private canHintNow(): boolean {
    if (this.inputLocked || this.walker.moving) return false;
    return ['intro', 'explore', 'aiming', 'choosingSpot', 'repair', 'knots', 'decorate', 'flying'].includes(this.mode);
  }

  protected override beaconTarget(): string | null {
    switch (this.mode) {
      case 'intro':
        return 'glider';
      case 'explore': {
        const g = this.nextGoal();
        return g ? g.target : null;
      }
      case 'aiming':
        if (this.aimAngle === null) return this.preset === 'more-help' ? `angle-${this.rightAngle}` : null;
        return this.pipPumps() ? null : 'bellows';
      case 'choosingSpot': {
        const s = this.suggestedSpot();
        return s ? `spot-${s}` : null;
      }
      case 'repair': {
        const i = this.nest.loops.findIndex((l) => l.visible && l.parentContainer === this.nest.c);
        return i >= 0 ? `loop-${i}` : null;
      }
      case 'knots': {
        const i = this.knotImgs.findIndex((k) => k.visible);
        return i >= 0 ? `knot-${i}` : null;
      }
      default:
        return null;
    }
  }

  /** Show exactly the current step with the ghost hand. */
  private demoNext(): void {
    switch (this.mode) {
      case 'intro':
        void this.hand.tapAt(this.glider.x, this.glider.y, 2);
        return;
      case 'glider':
        void this.hand.tapAt(this.glider.x + 260, this.glider.y - 170, 1);
        return;
      case 'aiming':
        this.demoAim();
        return;
      case 'choosingSpot':
        this.demoSpot();
        return;
      case 'repair':
      case 'knots':
      case 'explore': {
        const id = this.beaconTarget();
        const t = id ? this.targets.get(id) : undefined;
        if (!t) return;
        const r = t.bounds();
        this.tapToward(r.centerX, r.centerY);
        return;
      }
      case 'decorate':
        this.flashTiles();
        return;
      case 'flying':
        void this.hand.dragFrom(this.kite.x, this.kite.y, this.kite.x - 60, this.kite.y + 220);
        return;
      default:
        return;
    }
  }

  /** Tap a world point, or (when it's off screen) tap the ground on the way there. */
  private tapToward(x: number, y: number): void {
    const v = this.cameras.main.worldView;
    if (x > v.x + 60 && x < v.right - 60) {
      void this.hand.tapAt(x, y, 2);
      return;
    }
    const dir = Math.sign(x - this.avatar.x) || 1;
    const px = Phaser.Math.Clamp(this.avatar.x + dir * 420, v.x + 140, v.right - 140);
    void this.hand.tapAt(px, groundY(px) - 60, 2);
  }

  private angleButtonPos(deg: number): { x: number; y: number } {
    const a = (-deg * Math.PI) / 180;
    return { x: LAUNCH.x + Math.cos(a) * Launcher.BTN_R, y: LAUNCH.y + Math.sin(a) * Launcher.BTN_R };
  }

  private demoAim(): void {
    const angles = ANGLES[this.preset] as readonly number[];
    if (this.aimAngle === null) {
      let deg = this.preset === 'more-help' ? this.rightAngle : angles[0];
      if (this.preset === 'more-exploring' && this.lastAngle !== null && this.lastMiss) {
        // one arrow the way Pip said: lower after "too high", higher after "too low"
        const i = angles.indexOf(this.lastAngle) + (this.lastMiss === 'high' ? -1 : 1);
        deg = angles[Phaser.Math.Clamp(i, 0, angles.length - 1)];
      }
      const p = this.angleButtonPos(deg);
      void this.hand.tapAt(p.x, p.y, 2);
      return;
    }
    // an arrow is picked: show its wind-bent path, then the red pump
    this.launcher.preview(this.aimAngle, this.flags.wind, D.air - 1);
    if (!this.pipPumps()) void this.hand.tapAt(this.launcher.bellows.x, this.launcher.bellows.y - 60, 2);
  }

  /** Dotted path from where the kite lets go to where the wind will set it down. */
  private drawFallPath(route: 'launcher' | 'windmill'): Phaser.GameObjects.Graphics {
    const from = releasePoint(route);
    const land = kiteLanding(from, this.flags.wind);
    const g = this.add.graphics().setDepth(D.air - 2);
    const drift = WIND.kiteDrift[this.flags.wind];
    for (let t = 0; t < land.time; t += 0.12) {
      const x = from.x + drift * t;
      const y = from.y + KITE_FALL * t;
      g.fillStyle(0x2f3b2a, 0.35);
      g.fillCircle(x + 2, Math.min(y, groundY(x) - 30) + 3, 8);
      g.fillStyle(0xffffff, 0.95);
      g.fillCircle(x, Math.min(y, groundY(x) - 30), 7);
    }
    return g;
  }

  private demoSpot(): void {
    const best = this.suggestedSpot();
    if (best !== null) {
      if (!this.spotPath) {
        // show where the kite would drift down (a strong but honest clue)
        this.fallPath?.destroy();
        const g = this.drawFallPath(this.flags.route || this.expectedRoute());
        this.fallPath = g;
        this.time.delayedCall(4000, () => g.destroy());
      }
      void this.hand.tapAt(best, groundY(best) - 10, 2);
    } else {
      const s = this.spotsShown()[0];
      void this.hand.tapAt(s, groundY(s) - 10, 2);
    }
  }

  /** The tail picker is DOM (above the canvas), so the "hand" there is a gentle flash on the tiles. */
  private flashTiles(): void {
    const tiles = this.decorPanel ? [...this.decorPanel.querySelectorAll<HTMLElement>('[data-decor]')] : [];
    tiles.forEach((t, i) =>
      this.time.delayedCall(i * 160, () => {
        t.style.outline = '6px solid #f2b63d';
        t.style.outlineOffset = '3px';
        this.time.delayedCall(500, () => (t.style.outline = ''));
      }),
    );
  }

  // ================================================================ helpers

  private puppetFor(sp: Speaker): Puppet | undefined {
    return sp === 'pip' ? this.pipP : sp === 'rowan' ? this.rowanP : sp === 'avatar' ? this.avatar : undefined;
  }

  private sayLine(id: WindmillLineId): Promise<void> {
    const line = WINDMILL_LINES[id] as Line;
    const puppet = this.puppetFor(line.speaker);
    if (puppet && line.mood) puppet.setExpression(line.mood);
    return say(line.speaker, line.text, { puppet });
  }

  /**
   * Begin a step: say what to tap (remembered for "hear it again" and the
   * idle hints) and, for More help, show it with the hand while it's said.
   */
  private step(id: WindmillLineId, show = this.preset === 'more-help'): Promise<void> {
    const line = WINDMILL_LINES[id] as Line;
    const puppet = this.puppetFor(line.speaker);
    if (puppet && line.mood) puppet.setExpression(line.mood);
    if (show) this.time.delayedCall(450, () => this.alive && this.demoNext());
    return instruct(line.speaker, line.text, () => this.demoNext(), { puppet });
  }

  private wait(ms: number): Promise<void> {
    return new Promise((r) => this.time.delayedCall(ms, r));
  }

  private tweenP(cfg: Phaser.Types.Tweens.TweenBuilderConfig): Promise<void> {
    return new Promise((r) => this.tweens.add({ ...cfg, onComplete: () => r() }));
  }

  override onPause(): void {
    this.walker.stop();
  }

  override inspect(): Record<string, unknown> {
    return {
      mode: this.mode,
      checkpoint: this.checkpoint,
      preset: this.preset,
      pip: this.pip.mode,
      flags: { ...this.flags },
      kiteFree: this.kiteFree,
      avatarX: Math.round(this.avatar?.x ?? 0),
      aimAngle: this.aimAngle,
      nestX: Math.round(this.nest?.x ?? 0),
      carrying: this.carryingPumpkin,
      rowanAtLever: this.rowanAtLever,
      next: this.ready ? this.beaconTarget() : null,
    };
  }
}
