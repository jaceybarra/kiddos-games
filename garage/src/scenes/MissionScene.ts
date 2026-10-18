import Phaser from 'phaser';
import { app, dur, type MissionLaunch } from '../app/context';
import { ensureArt } from '../art/rasterize';
import { CONTENT } from '../config/content';
import { TUNING } from '../config/tuning';
import { testLayout, type BuildZone } from '../core/build';
import { MissionState } from '../core/missionState';
import { Terrain, type Lane } from '../core/terrain';
import { autoInput, TruckSim, type DriveInput } from '../core/truck';
import { missionLevel, trackLevel, type Level } from '../content/levels';
import { G, type CrewId, type MissionId } from '../content/missions';
import { addCoins, addDiscovery, applyMissionResult } from '../save/progress';
import type { ResumePoint } from '../save/schema';
import { DriveControls } from '../ui/controls';
import { Hud } from '../ui/hud';
import { showPauseMenu } from '../ui/overlays';
import { CameraRig } from '../view/camera';
import { CrewView } from '../view/CrewView';
import { Fx } from '../view/fx';
import { TruckView, type TruckPose } from '../view/TruckView';
import { WorldView } from '../view/WorldView';
import { registerSceneForTests } from '../dev/testHooks';
import { askToKeepSaves } from '../app/storage';
import { BuildController } from './mission/BuildController';
import { runEncounter, runResolution } from './mission/stories';
import { cssToGame, groundAt, wait } from './util';

/**
 * One drive: an authored mission or a My Tiny Track layout. The mission state
 * (core/missionState.ts) is the single source of truth for the phase; this
 * scene turns it into pictures and motion, and turns taps into requests.
 *
 * Physics runs at a fixed 120 Hz step so it behaves the same on a fast iPad
 * and a slow one. Recovery is gentle: a missed jump is a soft puff and the
 * truck is back at the last checkpoint in under a second, coins kept.
 */
const STEP = 1 / 120;
const BG_KEYS = ['bg.sky', 'bg.far', 'bg.mid'];

type Hazard = { kind: 'gap' | 'wall'; x0: number; x1: number; key: string };

/** where an invited friend stands to help at each build (on ground, clear of the parked truck) */
const HELPER_SPOT: Record<string, number> = { stream: 2720, 'second-lane': 1240, ledge: 3020 };

export default class MissionScene extends Phaser.Scene {
  launch!: MissionLaunch;
  level!: Level;
  state!: MissionState;
  base!: Terrain;
  terrain!: Terrain;
  sim!: TruckSim;
  truck!: TruckView;
  world!: WorldView;
  cam!: CameraRig;
  fx!: Fx;
  controls!: DriveControls;
  hud!: Hud;
  crew = new Map<CrewId, CrewView>();
  builds = new Map<string, BuildController>();
  build: BuildController | null = null;
  /** a script is running (encounter, resolution, example): the player's input is not used */
  scripted = false;
  /** the truck is held still (encounters, examples, resolutions) */
  held = false;
  /** a test drive of the current build is running */
  testing = false;
  restoring = false;
  isReady = false;
  dead = false;
  /** friends invited to help at each zone */
  invited = new Set<string>();
  buildFails = new Map<string, number>();
  private acc = 0;
  private groundY: number = G;
  private hazards: Hazard[] = [];
  private exampleShown = new Set<string>();
  private teachWall: string | null = null;
  private teachGap = false;
  private waitAtWall = 0;
  private testClock = 0;
  private blockedClock = 0;
  private closePause: (() => void) | null = null;
  private offs: (() => void)[] = [];
  private ghost: { sim: TruckSim; view: TruckView; until: number; clock: number } | null = null;
  private finishing = false;
  /** coins already owned from earlier runs */
  private owned = new Set<string>();

  constructor() {
    super('mission');
  }

  init(data: MissionLaunch): void {
    this.launch = data;
    this.dead = false;
    this.isReady = false;
    this.crew = new Map();
    this.builds = new Map();
    this.build = null;
    this.scripted = this.held = this.testing = this.restoring = this.finishing = false;
    this.invited = new Set();
    this.buildFails = new Map();
    this.exampleShown = new Set();
    this.acc = 0;
    this.ghost = null;
    this.offs = [];
    this.watchers = [];
    // Phaser reuses this scene object for every drive: everything per-run starts fresh here
    this.cameraBusy = false;
    this.groundY = G;
    this.hazards = [];
    this.teachWall = null;
    this.teachGap = false;
    this.waitAtWall = 0;
    this.testClock = 0;
    this.blockedClock = 0;
    this.closePause = null;
    this.controlsWereOn = false;
    this.owned = new Set();
    this.lastRestoreMs = 0;
    this.checkpointY = G;
    this.airBump = null;
    this.jumps = 0;
    this.clockMs = 0;
    this.edgeHold = null;
    this.resolvedZones = new Set();
  }

  create(): void {
    registerSceneForTests(this);
    this.events.once('shutdown', () => this.cleanup());
    this.cameras.main.setBackgroundColor('#8fd0f0');
    void ensureArt(this.textures, BG_KEYS, 'mission-bg').then(() => {
      if (!this.dead) this.setup();
    });
  }

  // ------------------------------------------------------------------ setup

  private get missionId(): MissionId | 'track' {
    return this.launch.kind === 'mission' ? this.launch.missionId : 'track';
  }

  private setup(): void {
    const a = app();
    const save = a.save;
    this.level = this.launch.kind === 'mission' ? missionLevel(this.launch.missionId) : trackLevel(this.launch.slots);
    const L = this.level;
    this.owned = new Set(save.progress.coins);
    this.state = new MissionState(this.missionId, { id: L.checkpoints[0]?.id ?? 'cp-start', x: L.startX }, { moreHelp: a.settings.moreHelp });
    this.base = new Terrain(L.segments, L.walls);
    this.terrain = this.base;
    const missionSpeed = this.launch.kind === 'mission' ? (CONTENT.missions[this.launch.missionId]?.speedFactor ?? 1) : 1;
    const speedFactor = (a.settings.slowDriving ? TUNING.drive.slowFactor : 1) * missionSpeed;
    this.sim = new TruckSim(this.terrain, L.startX, { wheel: save.truck.wheel, speedFactor, assist: this.state.assist });
    this.groundY = this.sim.y;
    this.checkpointY = this.sim.y;

    this.world = new WorldView(
      this,
      {
        length: L.length,
        segments: L.segments,
        walls: L.walls,
        checkpoints: L.checkpoints,
        coins: L.coins,
        discovery: L.discovery,
        finishX: L.finishX,
        upperRoute: L.upperRoute,
        oldBridge: L.oldBridge,
        forkX: L.forkX,
        seed: L.seed,
      },
      { reduced: a.reducedMotion(), low: a.lowIntensity(), ownedCoins: this.owned, ownedDiscovery: !!L.discovery && save.progress.discoveries.includes(L.discovery.id) },
    );
    this.fx = new Fx(this, { reduced: a.reducedMotion(), low: a.lowIntensity() });
    this.cam = new CameraRig(this, { reduced: a.reducedMotion(), worldLength: L.length });
    this.truck = new TruckView(this, save.truck, { depth: WorldView.DEPTH.truck });
    this.truck.update(this.pose(), 0);
    this.cam.snap(this.sim.x, this.groundY);

    for (const [id, spot] of Object.entries(L.crew) as [CrewId, { x: number; y?: number }][]) {
      const prop = id === 'milo' ? 'wagon' : id === 'pip' ? 'kart' : 'scooter';
      const c = new CrewView(this, id, spot.x, spot.y ?? groundAt(this.terrain, spot.x), { facing: 'left', prop: this.missionId === 'track' ? null : prop });
      c.setDepth(WorldView.DEPTH.crew);
      this.crew.set(id, c);
    }
    for (const z of L.zones) this.builds.set(z.id, new BuildController(this.buildHost(z), z));

    this.hazards = this.computeHazards();
    this.controls = new DriveControls(a.settings.jumpSide);
    this.controls.onJumpDown = () => this.truck.kick();
    this.hud = new Hud({
      onPause: () => this.pause(),
      onHelp: () => void this.help(),
      onUndo: () => this.build?.undo(),
      onClear: () => this.build?.clear(),
      onTest: () => void this.testBuild(),
      onInvite: () => this.toggleInvite(),
    });
    this.hud.setCoins(0, L.coins.length);
    // tracks have no coins: no tally
    this.hud.showCoins(L.coins.length > 0);
    // Esc or P pauses (keyboard, for grown-ups and desktop play)
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || this.closePause) return;
      if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') this.pause();
    };
    window.addEventListener('keydown', onKey);
    this.offs.push(() => window.removeEventListener('keydown', onKey));
    this.offs.push(
      a.onInterrupt(() => this.pause()),
      a.onSettings(() => {
        this.controls.setSide(app().settings.jumpSide);
        this.fx.setOptions({ reduced: app().reducedMotion(), low: app().lowIntensity() });
      }),
    );
    // continue from a saved checkpoint, or start fresh (and forget an older resume point for this mission)
    const resume = this.launch.kind === 'mission' ? this.launch.resume : null;
    if (resume && resume.missionId === L.id) this.applyResume(resume);
    else if (this.launch.kind === 'mission' && save.resume?.missionId === L.id) void a.commit({ ...save, resume: null });
    this.enterDriving();
    // a short breath before rolling: the truck bounces once on the start line
    this.held = true;
    this.truck.cheer();
    void wait(this, dur(700, 200)).then(() => {
      if (!this.dead && this.state.phase === 'driving' && !this.scripted) this.held = false;
    });
    this.isReady = true;
    this.offs.push(() => undefined);
  }

  private buildHost(zone: BuildZone) {
    return {
      scene: this as Phaser.Scene,
      world: this.world,
      fx: this.fx,
      reduced: () => app().reducedMotion(),
      changed: () => this.layoutChanged(zone),
      helper: () => ({ crew: this.helperFor(zone), invited: this.invited.has(zone.id) }),
    };
  }

  helperFor(_zone: BuildZone): CrewView | null {
    const who: CrewId | null = this.missionId === 'ramp-we-share' ? 'pip' : this.crew.has('milo') ? 'milo' : null;
    return who ? (this.crew.get(who) ?? null) : null;
  }

  private layoutChanged(zone: BuildZone): void {
    const all = [...this.builds.values()].flatMap((b) => b.segments());
    this.terrain = this.base.with(all);
    this.sim.setTerrain(this.terrain);
    const b = this.builds.get(zone.id);
    this.hud.setEnabled('undo', !!b?.canUndo);
    this.hud.setEnabled('clear', (b?.placed.length ?? 0) > 0);
    this.hud.hint((b?.placed.length ?? 0) > 0 ? 'test' : null);
  }

  /** Gaps and logs the player jumps (not the ones a build zone takes care of). */
  private computeHazards(): Hazard[] {
    const out: Hazard[] = [];
    const zoneSpans = this.level.zones.map((z) => ({ x0: Math.min(...z.sockets.map((s) => s.x)) - 200, x1: Math.max(...z.sockets.map((s) => s.x)) + 200 }));
    for (const g of this.world.gaps) {
      if (zoneSpans.some((s) => g.x0 < s.x1 && g.x1 > s.x0)) continue;
      out.push({ kind: 'gap', x0: g.x0, x1: g.x1, key: `gap@${Math.round(g.x0)}` });
    }
    for (const w of this.base.walls) if (w.w <= 120) out.push({ kind: 'wall', x0: w.x, x1: w.x + w.w, key: `wall@${w.id}` });
    return out.sort((a, b) => a.x0 - b.x0);
  }

  private nextHazard(): Hazard | null {
    const x = this.sim.x;
    return this.hazards.find((h) => h.x1 > x - 40) ?? null;
  }

  // ------------------------------------------------------------------ frame

  override update(_t: number, deltaMs: number): void {
    if (!this.isReady || this.dead) return;
    this.clockMs += deltaMs;
    const dt = Math.min(deltaMs / 1000, 0.1);
    this.world.update(dt);
    for (const c of this.crew.values()) c.update(dt);
    if (this.state.phase === 'complete' && !this.finishing) return;

    // the input for this frame (only while the player is driving)
    const playerDrives = this.state.phase === 'driving' && !this.scripted && !this.held && !this.restoring;
    let input: DriveInput = playerDrives ? this.controls.read() : { jumpHeld: false, jumpPressed: false, brakeHeld: false };
    if (!playerDrives) this.controls.read();

    // after repeated misses at a gap: wait at its edge (hand on the jump button) until jump is pressed
    let edgeStop = false;
    if (this.edgeHold && playerDrives) {
      const h = this.hazards.find((hz) => hz.key === this.edgeHold);
      if (!h || this.sim.x > h.x1) {
        this.edgeHold = null;
        this.controls.demoHand(false);
      } else if (this.sim.x >= h.x0 - 190 && this.sim.grounded) {
        if (input.jumpPressed) {
          this.sim.vx = TUNING.drive.speed * this.sim.speedFactor;
          this.edgeHold = null;
          this.controls.demoHand(false);
          this.controls.hint(false);
        } else {
          edgeStop = true;
          this.controls.hint(true);
          this.controls.demoHand(true);
        }
      }
    }
    this.sim.stopped = this.held || this.restoring || edgeStop;
    this.acc += dt;
    while (this.acc >= STEP) {
      this.acc -= STEP;
      const ev = this.sim.step(STEP, input);
      input = { ...input, jumpPressed: false };
      for (const e of ev) this.onTruckEvent(e);
      if (this.ghost) this.stepGhost(STEP);
      if (this.restoring || this.dead) break;
    }

    if (this.sim.grounded) this.groundY = this.sim.y;
    this.truck.update(this.pose(), dt);
    if (!this.cameraBusy) this.cam.follow(this.ghost ? Math.max(this.sim.x, this.ghost.sim.x - 200) : this.sim.x, this.groundY, dt);

    if (this.state.phase === 'driving' && !this.restoring) {
      this.checkCheckpoints();
      this.checkPickups();
      this.checkBeats();
      this.checkWatchers();
      this.watchWaiting(dt);
    }
    if (this.testing) this.watchTest(dt);
  }

  cameraBusy = false;
  private watchers: { x: number; fn: () => void }[] = [];

  /** Run fn once when the truck passes x (story moments that don't stop the truck). */
  whenPast(x: number, fn: () => void): void {
    this.watchers.push({ x, fn });
  }

  /** Run fn when this drive ends (overlays a story opened). */
  onShutdown(fn: () => void): void {
    this.offs.push(fn);
  }

  private checkWatchers(): void {
    if (!this.watchers.length || !this.sim.grounded) return;
    const due = this.watchers.filter((w) => this.sim.x >= w.x);
    if (!due.length) return;
    this.watchers = this.watchers.filter((w) => this.sim.x < w.x);
    for (const w of due) w.fn();
  }

  private pose(): TruckPose {
    const s = this.sim;
    return { x: s.x, y: s.y, vx: s.vx, vy: s.vy, slope: s.slope, accel: s.accel, squash: s.squash, rolled: s.rolled, grounded: s.grounded };
  }

  private onTruckEvent(e: ReturnType<TruckSim['step']>[number]): void {
    switch (e.type) {
      case 'land':
        if (e.impact > 0.15) this.fx.land(this.sim.x, this.sim.y, e.impact);
        if (this.airBump) {
          // a jump that bumped the log and came down still in front of it: one miss at that log
          const w = this.base.walls.find((ww) => ww.id === this.airBump);
          if (w && this.sim.x + this.sim.halfLength <= w.x + 4 && this.state.phase === 'driving') this.onMiss(`wall@${w.id}`, false);
          this.airBump = null;
        }
        break;
      case 'bounce':
      case 'launch':
        this.fx.sparks(this.sim.x, this.sim.y - 20, 3);
        break;
      case 'blocked':
        if (!this.sim.grounded) this.airBump = e.wallId;
        break;
      case 'fell':
        if (this.testing) void this.testFailed(true);
        else if (!this.restoring) void this.onFall(e.x);
        break;
      case 'jump':
        this.jumps++;
        break;
    }
  }

  // ------------------------------------------------------------------ driving rules

  private enterDriving(): void {
    this.controls.show(true);
    this.hud.setMode('drive');
    this.scripted = false;
  }

  private checkCheckpoints(): void {
    if (!this.sim.grounded) return;
    for (const cp of this.level.checkpoints) {
      if (this.sim.x >= cp.x && cp.x > this.state.checkpointX && this.state.reachCheckpoint(cp.id, cp.x)) {
        this.checkpointY = this.sim.y;
        this.world.raiseFlag(cp.id);
        void this.persistFinds(true);
      }
    }
  }

  /**
   * Coins and the discovery found so far are kept even if the drive is left
   * unfinished. At a checkpoint the place itself is saved too (a resume point),
   * so a reload or relaunch continues from there.
   */
  private async persistFinds(atCheckpoint = false): Promise<void> {
    if (this.launch.kind !== 'mission' || !this.state) return;
    const c = addCoins(app().save, this.state.coins);
    const d = addDiscovery(c.save, this.state.discovery);
    let next = d.save;
    if (atCheckpoint) next = { ...next, resume: this.resumePoint() };
    if (c.added.length || d.added || atCheckpoint) await app().commit(next);
  }

  private resumePoint(): ResumePoint {
    const placed: ResumePoint['placed'] = [];
    for (const z of this.resolvedZones) for (const p of this.builds.get(z)?.placed ?? []) placed.push({ zone: z, socket: p.socket, piece: p.piece });
    return {
      missionId: this.missionId as MissionId,
      checkpoint: this.state.checkpoint,
      x: this.state.checkpointX,
      y: this.checkpointY,
      beat: this.state.beat,
      choice: this.state.choice,
      placed,
      lane: this.sim.lane,
    };
  }

  /** Continue a mission from a saved checkpoint: story so far, choices and solved builds come back. */
  private applyResume(r: ResumePoint): void {
    const L = this.level;
    this.state.beat = r.beat;
    this.state.choice = r.choice;
    this.state.reachCheckpoint(r.checkpoint, r.x);
    this.checkpointY = r.y;
    for (const cp of L.checkpoints) if (cp.x <= r.x && cp.x > L.startX) this.world.raiseFlag(cp.id);
    for (const z of L.zones) {
      const mine = r.placed.filter((p) => p.zone === z.id);
      if (!mine.length) continue;
      this.builds.get(z.id)?.restore(mine.map((p) => ({ socket: p.socket, piece: p.piece })));
      this.state.placed.push(...mine.map((p) => ({ socket: p.socket, piece: p.piece })));
      this.resolvedZones.add(z.id);
    }
    this.terrain = this.base.with([...this.builds.values()].flatMap((b) => b.segments()));
    this.sim.setTerrain(this.terrain);
    this.setLane(r.lane);
    if (L.forkX && (r.choice === 'gentle' || r.choice === 'jump')) this.world.placeSign(r.choice === 'jump' ? 'high' : 'low', false);
    this.sim.placeAt(r.x, r.y);
    this.groundY = this.sim.y;
    this.cam.snap(this.sim.x, this.groundY);
    this.truck.update(this.pose(), 0);
    // friends are where the story left them
    const put = (id: CrewId, x: number, face: 'left' | 'right' = 'left') => {
      const c = this.crew.get(id);
      if (!c) return;
      c.x = x;
      c.y = groundAt(this.terrain, x, 'back', G - 100);
      c.container.setPosition(c.x, c.y);
      c.face(face);
    };
    if (L.id === 'wobbly-bridge' && this.resolvedZones.has('stream')) put('milo', 3330, 'right');
    if (L.id === 'ramp-we-share' && r.choice) put('pip', L.finishX - 200);
    if (L.id === 'everyone-rally' && r.choice) {
      if (this.resolvedZones.has('ledge')) {
        put('pip', 3780);
        put('milo', 3860);
        put('nori', 3940);
      } else {
        put('nori', 2850, 'right');
        put('pip', 2940, 'right');
        put('milo', 3040, 'right');
      }
    }
  }

  private checkPickups(): void {
    const tx = this.sim.x;
    const ty = this.sim.y - 70;
    for (const c of this.level.coins) {
      if (this.owned.has(c.id) || this.state.coins.has(c.id)) continue;
      if (Math.abs(c.x - tx) < 90 && Math.abs(c.y - ty) < 100) {
        this.state.collectCoin(c.id);
        this.world.collectCoin(c.id, cssToGame(this, this.hud.coinTarget()));
        this.hud.setCoins(this.state.coins.size, this.level.coins.length);
      }
    }
    const d = this.level.discovery;
    if (d && !this.state.discovery && Math.abs(d.x - tx) < 100 && Math.abs(d.y - ty) < 110) {
      this.state.findDiscovery(d.id);
      this.world.collectDiscovery(cssToGame(this, this.hud.coinTarget()));
      this.fx.sparks(d.x, d.y, 8);
    }
  }

  private checkBeats(): void {
    const b = this.level.beats[this.state.beat];
    if (!b || this.scripted) return;
    const x = this.sim.x;
    switch (b.kind) {
      case 'teachJump':
        if (x >= b.x) {
          this.state.beat++;
          this.teachWall = b.wallId;
          // first lesson: a see-through truck shows the jump while the hand presses the button
          const h = this.hazards.find((hz) => hz.key === `wall@${b.wallId}`);
          if (h) {
            this.exampleShown.add(h.key);
            void this.example(h, false);
          }
        }
        break;
      case 'encounter':
        if (x >= b.x) {
          this.state.beat++;
          void this.encounter(b.id);
        }
        break;
      case 'build': {
        const zone = this.level.zones.find((z) => z.id === b.zone);
        if (!zone) {
          this.state.beat++;
          break;
        }
        if (x >= zone.stopX - 125) {
          this.held = true;
          if (Math.abs(this.sim.vx) < 1 && this.sim.grounded) {
            this.state.beat++;
            this.startBuild(zone);
          }
        }
        break;
      }
      case 'finish':
        if (x >= b.x) {
          this.state.beat++;
          void this.finish();
        }
        break;
    }
    // the first lesson: the log, then the little gap
    if (this.teachWall) {
      const w = this.base.walls.find((ww) => ww.id === this.teachWall);
      if (!w || x > w.x + w.w + 30) {
        this.teachWall = null;
        this.controls.hint(false);
        this.controls.demoHand(false);
        this.fx.sparks(this.sim.x, this.sim.y - 140, 5);
        this.teachGap = this.missionId === 'wobbly-bridge';
      }
    }
    if (this.teachGap) {
      const h = this.nextHazard();
      if (h && h.kind === 'gap') {
        const near = h.x0 - x < 330 && h.x0 - x > -20;
        this.controls.hint(near);
        if (x > h.x1 + 60) {
          this.teachGap = false;
          this.controls.hint(false);
        }
      }
    }
  }

  /** Waiting in front of a log: after a moment the jump button bounces to say "this one". */
  private watchWaiting(dt: number): void {
    if (this.teachWall) return;
    const blocked = this.sim.grounded && Math.abs(this.sim.vx) < 1 && !this.held && !this.scripted && this.terrain.wallBetween(this.sim.x, this.sim.x + this.sim.halfLength + 8, this.sim.y);
    this.waitAtWall = blocked ? this.waitAtWall + dt : 0;
    if (this.waitAtWall > 2) this.controls.hint(true);
    else if (!this.teachGap) this.controls.hint(false);
  }

  // ------------------------------------------------------------------ misses, recovery, examples

  private obstacleKeyAt(x: number): string {
    const gaps = this.world.gaps.filter((g) => g.x0 <= x + 40);
    const g = gaps[gaps.length - 1];
    return g ? `gap@${Math.round(g.x0)}` : `fall@${Math.round(x / 200) * 200}`;
  }

  private lastRestoreMs = 0;
  /** build zones solved this run (kept in the resume point) */
  private resolvedZones = new Set<string>();
  /** after repeated misses at a gap, the truck waits at its edge until jump is pressed */
  private edgeHold: string | null = null;
  /** ground height where the last checkpoint was reached */
  private checkpointY: number = G;
  /** the log the truck bumped during the current jump (a miss only if it lands short) */
  private airBump: string | null = null;
  private jumps = 0;
  private clockMs = 0;

  private async onFall(x: number): Promise<void> {
    if (this.restoring) return;
    this.restoring = true;
    const t0 = this.clockMs;
    this.controls.clear();
    const key = this.obstacleKeyAt(x);
    const gap = this.world.gaps.find((g) => x >= g.x0 - 80 && x <= g.x1 + 400);
    this.fx.splash(gap ? Math.min(Math.max(this.sim.x, gap.x0 + 30), gap.x1 - 30) : this.sim.x, G + 30);
    this.fx.puff(this.sim.x, Math.min(this.sim.y, G + 40));
    // the whole soft miss (puff, fade, back at the checkpoint) fits in TUNING.recovery.restoreMs
    const fadeOut = dur(180, 100);
    const fadeIn = dur(200, 100);
    await this.truck.fadeOut(fadeOut);
    const n = this.state.miss(key, this.helpAfter, TUNING.jump.assistFactor);
    this.sim.assist = this.state.assist;
    await wait(this, Math.max(0, TUNING.recovery.restoreMs - fadeOut - fadeIn));
    if (this.dead) return;
    this.sim.placeAt(this.state.checkpointX, this.checkpointY);
    this.groundY = this.sim.y;
    this.cam.snap(this.sim.x, this.groundY);
    this.truck.update(this.pose(), 0);
    await this.truck.fadeIn(fadeIn);
    this.restoring = false;
    this.lastRestoreMs = Math.round(this.clockMs - t0); // scene time (what timers and tweens see; equals real time at 60 fps)
    if (key.startsWith('gap@') && n >= 3) this.edgeHold = key;
    this.onMiss(key, true, n);
  }

  private get helpAfter(): number {
    return app().settings.moreHelp ? 1 : TUNING.recovery.missesBeforeHelp;
  }

  /** After two misses at the same place: an animated example, and wider timing from now on. */
  private onMiss(key: string, counted: boolean, n?: number): void {
    const count = counted ? (n ?? this.state.missesAt(key)) : this.state.miss(key, this.helpAfter, TUNING.jump.assistFactor);
    this.sim.assist = this.state.assist;
    if (count >= this.helpAfter && !this.exampleShown.has(key)) {
      this.exampleShown.add(key);
      const h = this.hazards.find((hz) => hz.key === key) ?? this.nextHazard();
      if (h) void this.example(h);
    }
  }

  /**
   * A see-through truck shows how: it drives from here and jumps at the right
   * moment while a helper hand presses the jump button. The real truck waits.
   */
  async example(h: Hazard, askedFor = true): Promise<void> {
    if (this.ghost || this.state.phase !== 'driving') return;
    if (askedFor) this.state.usedHelp = true;
    this.held = true;
    this.controls.show(false);
    const sim = new TruckSim(this.terrain, this.sim.x, { wheel: this.sim.wheel, speedFactor: this.sim.speedFactor, assist: TUNING.jump.assistFactor, lane: this.sim.lane });
    const view = new TruckView(this, app().save.truck, { ghost: true, depth: WorldView.DEPTH.truck + 1 });
    view.setLane(this.sim.lane);
    this.ghost = { sim, view, until: h.x1 + 260, clock: 0 };
    this.controls.show(true);
    this.controls.demoHand(true);
    // while the example runs, the real truck stays put and the buttons only show
    this.scripted = true;
  }

  private stepGhost(dt: number): void {
    const g = this.ghost!;
    g.clock += dt;
    const input = autoInput(g.sim, this.terrain);
    for (const e of g.sim.step(dt, input)) if (e.type === 'jump') this.controls.demoTap();
    g.view.update({ x: g.sim.x, y: g.sim.y, vx: g.sim.vx, vy: g.sim.vy, slope: g.sim.slope, accel: g.sim.accel, squash: g.sim.squash, rolled: g.sim.rolled, grounded: g.sim.grounded }, dt);
    if (g.sim.x >= g.until || g.clock > 7 || g.sim.y > G + 200) {
      this.ghost = null;
      void g.view.fadeOut(dur(300, 100)).then(() => g.view.destroy());
      this.scripted = false;
      this.held = false;
      this.controls.hint(true);
      if (this.teachWall) return; // the lesson keeps the hand and ring until the log is cleared
      this.controls.demoHand(false);
      void wait(this, 1800).then(() => !this.dead && !this.teachWall && this.controls.hint(false));
    }
  }

  /** The help button: show how to do whatever is next. Never changes the reward. */
  async help(): Promise<void> {
    if (!this.isReady || this.state.phase === 'complete') return;
    this.state.usedHelp = true;
    if (this.state.phase === 'building' && this.build && !this.testing) {
      await this.build.demo();
      return;
    }
    if (this.state.phase !== 'driving' || this.scripted || this.restoring) return;
    const h = this.nextHazard();
    if (h && h.x0 - this.sim.x < 900) {
      void this.example(h);
      return;
    }
    // nothing to jump nearby: a bobbing arrow shows the way on
    this.fx.sparks(this.sim.x + 420, this.groundY - 160, 3);
    this.controls.hint(true);
    void wait(this, 1600).then(() => !this.dead && this.controls.hint(false));
  }

  // ------------------------------------------------------------------ encounters & building

  private async encounter(id: string): Promise<void> {
    if (!this.state.go('encounter')) return;
    this.scripted = true;
    this.held = true;
    this.controls.show(false);
    this.hud.setMode('encounter');
    await runEncounter(this, id);
  }

  /** Back to driving after a story moment. */
  resumeDriving(): void {
    if (this.state.phase !== 'driving' && !this.state.go('driving')) return;
    this.held = false;
    this.enterDriving();
  }

  startBuild(zone: BuildZone): void {
    if (!this.state.go('building')) return;
    this.scripted = true;
    this.held = true;
    this.controls.show(false);
    if (zone.lane) this.setLane(zone.lane);
    this.build = this.builds.get(zone.id) ?? null;
    this.hud.setMode('build');
    const helper = this.helperFor(zone);
    this.hud.setInvite(helper ? helper.id : null, this.invited.has(zone.id));
    this.layoutChanged(zone);
    this.cameraBusy = true;
    // the test button only works once the tray is out (no test during the camera pan)
    this.hud.setEnabled('test', false);
    void this.cam.focus(zone.focusX, G - 170, dur(900, 200)).then(() => {
      if (this.dead || this.state.phase !== 'building' || this.testing) return;
      this.build?.show();
      this.hud.setEnabled('test', true);
    });
    if (helper && !this.invited.has(zone.id)) helper.setPose('help');
  }

  setLane(lane: Lane): void {
    this.sim.lane = lane;
    this.truck.setLane(lane);
  }

  private toggleInvite(): void {
    const b = this.build;
    if (!b) return;
    const helper = this.helperFor(b.zone);
    if (!helper) return;
    if (this.invited.has(b.zone.id)) return;
    this.invited.add(b.zone.id);
    this.hud.setInvite(helper.id, true);
    helper.emote('heart');
    // the friend comes to a spot beside the build, clear of the truck
    const spot = HELPER_SPOT[b.zone.id] ?? helper.x;
    void helper.moveTo(spot, (x) => groundAt(this.terrain, x, 'back'), 360).then(() => {
      helper.face('right');
      helper.setPose('help');
    });
  }

  private async testBuild(): Promise<void> {
    const b = this.build;
    if (!b || this.testing || this.state.phase !== 'building' || !b.isOpen) return;
    b.hide();
    this.hud.setMode('encounter');
    this.hud.hint(null);
    this.testing = true;
    this.testClock = 0;
    this.blockedClock = 0;
    this.cameraBusy = false;
    this.held = false;
  }

  private watchTest(dt: number): void {
    const b = this.build;
    if (!b) return;
    this.testClock += dt;
    const stuck = this.sim.grounded && Math.abs(this.sim.vx) < 1;
    this.blockedClock = stuck ? this.blockedClock + dt : 0;
    if (this.sim.x >= b.zone.exitX) void this.testWorked();
    else if (this.blockedClock > 1.2 || this.testClock > 14) void this.testFailed(false);
  }

  private async testWorked(): Promise<void> {
    const b = this.build;
    if (!b || !this.testing) return;
    this.testing = false;
    this.held = true;
    this.state.placed.push(...b.placed.map((p) => ({ socket: p.socket, piece: p.piece })));
    this.resolvedZones.add(b.zone.id);
    this.fx.check(b.zone.focusX, G - 300);
    if (!this.state.go('resolving')) return;
    this.scripted = true;
    await runResolution(this, b.zone);
  }

  private async testFailed(fell: boolean): Promise<void> {
    const b = this.build;
    if (!b || !this.testing) return;
    this.testing = false;
    this.restoring = true;
    if (fell) {
      this.fx.splash(this.sim.x, G + 30);
      this.fx.puff(this.sim.x, G);
    } else this.fx.puff(this.sim.x + 100, this.sim.y - 60);
    await this.truck.fadeOut(dur(220, 100));
    await wait(this, 500);
    if (this.dead) return;
    this.sim.placeAt(b.zone.stopX, G);
    this.groundY = this.sim.y;
    this.truck.update(this.pose(), 0);
    await this.truck.fadeIn(dur(240, 100));
    this.restoring = false;
    this.held = true;
    const n = (this.buildFails.get(b.zone.id) ?? 0) + 1;
    this.buildFails.set(b.zone.id, n);
    this.state.miss(`build@${b.zone.id}`, 99, 1);
    this.cameraBusy = true;
    await this.cam.focus(b.zone.focusX, G - 170, dur(600, 150));
    if (this.dead) return;
    this.hud.setMode('build');
    b.show();
    // no blame: the socket that would help bobs with an arrow
    const others = [...this.builds.values()].filter((x) => x !== b).flatMap((x) => x.segments());
    const r = testLayout(this.base.with(others), b.zone, b.placed, this.sim.wheel, this.sim.speedFactor);
    b.pointAt(r.hintSocket);
    if (n >= this.helpAfter) {
      this.state.usedHelp = true;
      await b.demo();
    }
  }

  /** The resolution is over: drive on (the build stays, the truck continues on its lane). */
  doneResolving(): void {
    this.build?.hide();
    this.build = null;
    this.cameraBusy = false;
    this.resumeDriving();
  }

  // ------------------------------------------------------------------ finish

  private async finish(): Promise<void> {
    if (this.finishing) return;
    this.finishing = true;
    this.held = true;
    this.controls.show(false);
    this.hud.setMode('hidden');
    const summary = this.state.complete();
    if (!summary) {
      this.finishing = false;
      return;
    }
    // everyone gathers at the finish for a short celebration (1–2 s)
    const fx = this.level.finishX;
    this.cameraBusy = true;
    void this.cam.focus(fx, G - 200, dur(700, 150));
    this.fx.confetti(fx, G - 420);
    this.truck.cheer();
    let i = 0;
    for (const c of this.crew.values()) {
      const tx = fx + 200 + i * 120;
      i++;
      const far = Math.abs(c.x - tx) > 1400;
      if (far) {
        c.x = tx - 300;
        c.y = groundAt(this.terrain, c.x, 'back', G - 100);
        c.container.setPosition(c.x, c.y);
      }
      void c.moveTo(tx, (x) => groundAt(this.terrain, x, 'back', G - 100), 700).then(() => c.cheer());
    }
    await wait(this, dur(1700, 900));
    if (this.dead) return;
    if (this.launch.kind === 'track') {
      app().go('creator', { slots: this.launch.slots, slot: this.launch.slot, drove: true });
      return;
    }
    const { save, earned } = applyMissionResult(app().save, summary);
    const saved = await app().commit(save);
    if (saved) void askToKeepSaves();
    if (this.dead) return;
    app().go('result', { launch: this.launch, summary, earned, saved });
  }

  // ------------------------------------------------------------------ pause / exit

  pause(): void {
    if (!this.isReady || this.dead || this.closePause || this.state.phase === 'complete') return;
    this.controls.clear();
    this.controlsWereOn = this.controls.active;
    this.controls.show(false);
    this.build?.cancelDrag();
    this.scene.pause();
    this.closePause = showPauseMenu({
      onResume: () => this.resume(),
      onRetry: () => {
        this.closePause = null;
        void this.persistFinds().then(() => app().go('mission', this.launch));
      },
      onGarage: () => {
        this.closePause = null;
        void this.leave();
      },
    });
  }

  private controlsWereOn = false;

  private resume(): void {
    this.closePause = null;
    if (this.dead) return;
    this.controls.clear();
    if (this.controlsWereOn) this.controls.show(true);
    this.scene.resume();
  }

  private async leave(): Promise<void> {
    await this.persistFinds();
    if (this.launch.kind === 'track') app().go('creator', { slots: this.launch.slots, slot: this.launch.slot });
    else app().go('garage', { entrance: 'return' });
  }

  private cleanup(): void {
    this.dead = true;
    this.isReady = false;
    this.closePause?.();
    this.closePause = null;
    for (const off of this.offs) off();
    this.offs = [];
    this.controls?.destroy();
    this.hud?.destroy();
    for (const b of this.builds.values()) b.destroy();
    this.builds.clear();
    for (const c of this.crew.values()) c.destroy();
    this.crew.clear();
    this.world?.destroy();
    this.ghost?.view.destroy();
    this.ghost = null;
  }

  // ------------------------------------------------------------------ test hooks

  inspect(): Record<string, unknown> {
    if (!this.state) return { loading: true };
    const h = this.nextHazard();
    return {
      mission: this.missionId,
      phase: this.state.phase,
      paused: this.scene.isPaused(),
      x: Math.round(this.sim.x),
      y: Math.round(this.sim.y),
      vx: Math.round(this.sim.vx),
      grounded: this.sim.grounded,
      lane: this.sim.lane,
      wheel: this.sim.wheel,
      held: this.held,
      scripted: this.scripted,
      testing: this.testing,
      restoring: this.restoring,
      checkpoint: this.state.checkpoint,
      coins: [...this.state.coins],
      discovery: this.state.discovery,
      choice: this.state.choice,
      placed: this.state.placed.map((p) => `${p.socket}:${p.piece}`),
      assist: this.state.assist,
      misses: Object.fromEntries(this.state.misses),
      usedHelp: this.state.usedHelp,
      beat: this.state.beat,
      example: !!this.ghost,
      edgeHold: this.edgeHold,
      coinsShown: this.level.coins.length > 0,
      resolved: [...this.resolvedZones],
      hazard: h ? { kind: h.kind, x0: h.x0, x1: h.x1, key: h.key } : null,
      build: this.build?.inspect() ?? null,
      invited: [...this.invited],
      finishX: this.level.finishX,
      jumpHeld: this.controls.holding,
      lastRestoreMs: this.lastRestoreMs,
      fps: Math.round(this.game.loop.actualFps),
      presses: this.controls.presses,
      jumps: this.jumps,
      controlsOn: this.controls.active,
      pauseMenu: !!this.closePause,
    };
  }

  testTargets(): { id: string; x: number; y: number; w: number; h: number; space: 'world' | 'screen' }[] {
    const out = this.build?.testTargets() ?? [];
    out.push({ id: 'truck', x: this.sim?.x ?? 0, y: (this.sim?.y ?? 0) - 70, w: 280, h: 140, space: 'world' });
    for (const c of this.crew.values()) out.push({ id: `crew-${c.id}`, x: c.x, y: c.y - 100, w: 160, h: 200, space: 'world' });
    return out;
  }
}
