import Phaser from 'phaser';
import { WWScene } from '../../WWScene';
import { Puppet } from '../../rig/Puppet';
import { GhostHand } from '../../systems/GhostHand';
import { Hints } from '../../systems/Hints';
import { dust, sparkle } from '../../systems/fx';
import { DishView } from '../../displays/DishView';
import { DecorateStation, DoughStation, JuiceStation, StackStation, type StationBase, type StationHost } from './stations';
import { addArt, addImage, makeImage, setPiece } from '../../../art/rasterize';
import { registerPieces, pieceSvg } from '../../../art/registry';
import { PICNIC_PIECES } from '../../../art/scenes/picnic';
import { CAST_RIGS, avatarRig, rigArtKeys, type CastId } from '../../../art/cast';
import { rigSvg } from '../../../art/portrait';
import { P, hex } from '../../../art/palette';
import { exampleDish, matchWish, type Dish, type Shape, type Wish } from '../../../content/picnic/food';
import {
  CORNERS,
  CUTTER_OPTIONS,
  DRUM_OPTIONS,
  DRUM_X,
  FIZZ_OK_SHAPES,
  MIXUP_OPTIONS,
  SCENARIOS,
  SCENARIO_ORDER,
  WEIGHTS,
  WEIGHT_CHOICES,
  WINDBREAKS,
  seatsFor,
  type ScenarioDef,
  type ScenarioId,
  type Station,
  type WeightId,
} from '../../../content/picnic/scenarios';
import {
  LANTERN_SLOTS,
  TRAY_SLOTS,
  addToTray,
  allHappy,
  allSeated,
  applyCutter,
  applyDrum,
  askToTry,
  canParade,
  cornersHeld,
  guestDef,
  guestsOf,
  hangLantern,
  keepForMe,
  looseCorners,
  newDishId,
  newPicnic,
  offerFizzShape,
  placeWeight,
  quietSeat,
  replaceOnTray,
  seatGuest,
  seatSuits,
  serve,
  setWindbreak,
  useLanternCutter,
  validPicnic,
  whoWants,
  wishOf,
  type PicnicState,
} from '../../../content/picnic/picnicState';
import {
  CAST_NAME,
  DECLINE_TRY_LINE,
  FLEX_LINE,
  FULL_LINE,
  GIVE_LINE,
  GUEST_LINES,
  HELPER_LINES,
  HOST_LINES,
  NOBODY_LINE,
  SEAT_LINE,
  SHARED_LINE,
  TAB_LINE,
  TRIED_LINE,
  WISH_LINES,
  YUM_LINES,
  carryLine,
  notQuiteLine,
  otherKindLine,
  type GuestLineId,
  type HostLineId,
} from '../../../content/picnic/picnicLines';
import { services, currentProfile, currentPreset, updateProfile } from '../../../app/services';
import { say, instruct, stopSpeech, portraitFor, type Speaker } from '../../../app/speech';
import { audio } from '../../../core/audio';
import { motion } from '../../../core/motion';
import { h, trapFocus } from '../../../ui/dom';
import { icon } from '../../../ui/icons';
import { iconDialog, toast } from '../../../ui/overlays';
import { openShelf } from '../../../ui/shelf';
import type { ChoiceOption } from '../../../ui/choices';
import type { PresetId, Profile } from '../../../save/schema';
import { displayName } from '../../../ui/screens/profiles';

registerPieces(PICNIC_PIECES);

const D = { sky: 0, meadow: 1, tree: 2, cart: 3, blanket: 4, setup: 6, station: 20, tray: 40, guestBack: 45, guest: 50, plate: 56, bubble: 70, fx: 90 };
const GUEST_SCALE = 0.78;
const AVATAR = { x: 1660, y: 1010 };
const TRAY = { x: 820, y: 942 };
const TRAY_X = [720, 820, 920];
const BELL = { x: 1100, y: 1000 };
const HELPER = { x: 1060, y: 850 };
const MOSS_TREE = { x: 1200, y: 712 };
const LANTERN_X = [1420, 1600, 1780];
const LANTERN_Y = 478;
const WAIT_X = [1250, 1450, 1650];
const WAIT_Y = 668;
const WEIGHT_SPOTS = [
  { x: 180, y: 640 },
  { x: 360, y: 640 },
  { x: 540, y: 640 },
  { x: 720, y: 640 },
  { x: 270, y: 830 },
  { x: 450, y: 830 },
  { x: 630, y: 830 },
];
const CAMERA = { x: 900, y: 660 };
/** The bobbing "tap this button" arrow under a kitchen button (points up at it). */
const TAB_ARROW = '<svg viewBox="-30 -30 60 60" style="width:100%;height:100%"><path d="M0 -26 L24 2 L10 2 L10 26 L-10 26 L-10 2 L-24 2 Z" fill="#f2c84b" stroke="#3b2a20" stroke-width="5" stroke-linejoin="round"/></svg>';
const STATION_TABS: { id: Station; art: string; label: string }[] = [
  { id: 'dough', art: 'pc.ic.cookie', label: 'Make cookies' },
  { id: 'stack', art: 'pc.ic.sandwich', label: 'Make a sandwich' },
  { id: 'juice', art: 'pc.ic.juice', label: 'Make juice' },
  { id: 'decorate', art: 'pc.ic.decorate', label: 'Decorate' },
];

type Role = 'chef' | 'server';

/** What the child should do next while cooking (one clear step at a time). */
type CookStep =
  | { k: 'bell' }
  | { k: 'give'; dish: string; to: CastId | null }
  | { k: 'tab'; station: Station; guest: CastId | null }
  | { k: 'station'; guest: CastId | null }
  | { k: 'none' };

/** Which kitchen makes each kind of dish. */
function stationFor(w: Wish): Station {
  return w.kind === 'cookie' ? 'dough' : w.kind === 'sandwich' ? 'stack' : 'juice';
}
interface Player {
  name: string;
  face: string;
  npc?: CastId;
}

/**
 * Picnic Parade: get a picnic ready with friends. Four hands-on stations
 * (dough, sandwich stacking, juice, decorating), three authored picnics, and a
 * parade at the end. Friends say and show what they'd like; nothing is timed.
 */
export default class PicnicScene extends WWScene {
  readonly artGroup = 'picnic';
  private preset: PresetId = 'more-help';
  private st: PicnicState | null = null;
  private def!: ScenarioDef;
  private puppets = new Map<CastId, Puppet>();
  private avatar!: Puppet;
  private bubbles = new Map<CastId, Phaser.GameObjects.Container>();
  private plateViews = new Map<CastId, DishView>();
  private plateImgs = new Map<CastId, Phaser.GameObjects.Image>();
  private mineView?: DishView;
  private trayViews: DishView[] = [];
  private selected: string | null = null;
  private selRing?: Phaser.GameObjects.Image;
  private station: StationBase | null = null;
  private scn: Phaser.GameObjects.GameObject[] = [];
  private scnTargets: string[] = [];
  private flaps = new Map<number, Phaser.GameObjects.Image>();
  private weightImgs = new Map<WeightId, Phaser.GameObjects.Image>();
  private heldWeight: WeightId | null = null;
  private seatGuestSel: CastId | null = null;
  private windbreakImg?: Phaser.GameObjects.Image;
  private bell?: Phaser.GameObjects.Image;
  private drumTimer?: Phaser.Time.TimerEvent;
  private gustTimer?: Phaser.Time.TimerEvent;
  private topBar?: HTMLElement;
  private overlay?: HTMLElement;
  private closeShelf?: () => void;
  private hand!: GhostHand;
  private hints!: Hints;
  private busy = false;
  private biteAsked = false;
  private mossAsks = 0;
  private together: { players: Record<Role, Player>; turn: Role } | null = null;
  private helperBusy = false;
  /** the last cooking step that was announced (so each step is said once) */
  private lastGuide = '';
  /** the friend whose wish was said most recently */
  private lastWisher: CastId | null = null;
  /** reactions in flight (instructions wait for them instead of cutting them off) */
  private reacting = 0;
  private takePhoto?: () => void;
  private groundHintAt = 0;
  private lanternOff = new Map<number, Phaser.GameObjects.Image>();
  private faces = new Map<CastId, string>();
  private tabMarkKey = '';
  private tabBob?: Animation;

  constructor() {
    super('picnic');
  }

  artKeys(): string[] {
    const keys = new Set<string>(PICNIC_PIECES.map((p) => p.key));
    for (const id of ['pip', 'moss', 'fizz', 'luma', 'rowan'] as CastId[]) for (const k of rigArtKeys(CAST_RIGS[id])) keys.add(k);
    const prof = currentProfile();
    for (const k of rigArtKeys(avatarRig(prof.avatar.species, prof.avatar.color))) keys.add(k);
    if (prof.avatar.hat) keys.add(prof.avatar.hat);
    return [...keys];
  }

  // ================================================================ build

  build(): void {
    this.preset = currentPreset('picnic');
    addArt(this, 0, 0, 'pc.meadow').setDepth(D.meadow);
    addImage(this, 0, 0, 'pc.tree').setDepth(D.tree);
    addImage(this, 0, 0, 'pc.cart').setDepth(D.cart);
    addImage(this, 0, 0, 'pc.blanket').setDepth(D.blanket);
    this.worldChanges();
    const prof = currentProfile();
    this.avatar = new Puppet(this, AVATAR.x, AVATAR.y, avatarRig(prof.avatar.species, prof.avatar.color), { hat: prof.avatar.hat, seed: 6 });
    this.avatar.setDepth(D.guest + 2).setScale(0.82).setFacing(-1);
    addImage(this, AVATAR.x - 110, AVATAR.y + 22, 'pc.plate.small').setDepth(D.plate);
    this.addTarget({ id: 'avatar', label: 'You', bounds: () => this.rectAround(AVATAR.x, AVATAR.y - 80, 140, 180, 10), enabled: () => this.st?.phase === 'cook' || this.st?.phase === 'parade' || this.st?.phase === 'setup', activate: () => void this.onAvatar() });
    addImage(this, TRAY.x, TRAY.y, 'pc.tray').setDepth(D.tray);
    for (let i = 0; i < TRAY_SLOTS; i++) {
      this.addTarget({
        id: `tray-${i}`,
        label: 'Something on the tray',
        bounds: () => this.rectAround(TRAY_X[i], TRAY.y - 60, 96, 130, 6),
        enabled: () => !!this.st && !!this.st.tray[i] && this.st.phase === 'cook',
        activate: () => this.onTray(i),
      });
    }
    this.hand = new GhostHand(this);
    // no hints during a cutscene, a question, or a menu
    this.hints = new Hints(this, this.preset, () => this.demo(), () => !this.busy && !this.overlay && !this.closeShelf && !this.station?.isBusy && !this.helperBusy && (this.st?.phase === 'setup' || this.st?.phase === 'cook' || !!this.takePhoto));
    this.buildDom();
    audio.startMusic('picnic');
    services.hud.show(['home', 'finish', 'pause', 'replay', 'help']);
    this.onCleanup(() => {
      this.topBar?.remove();
      this.overlay?.remove();
      this.closeShelf?.();
      services.choices.cancel();
      services.hud.setTurnBadge(null);
      stopSpeech();
    });
    const id = currentProfile().progress.location.data?.scenario as ScenarioId | undefined;
    const saved = id && SCENARIOS[id] ? this.readSaved(id) : null;
    if (saved && saved.phase !== 'done') this.startScenario(saved);
    else this.time.delayedCall(250, () => this.openPicker(true));
  }

  /** What earlier picnics left behind in the meadow (a visible change, never a reward to chase). */
  private worldChanges(): void {
    const done = currentProfile().progress.done;
    if (done['picnic:windy']) addImage(this, 1010, 760, 'pc.umbrella').setDepth(D.tree + 0.5).setScale(0.55);
    if (done['picnic:music']) addImage(this, 1930, 760, 'pc.drum').setDepth(D.blanket - 0.5).setScale(0.7);
    if (done['picnic:lantern']) for (const x of [1280, 1500, 1720]) addImage(this, x, 300, 'pc.lantern.on').setDepth(D.tree + 0.5).setScale(0.6);
    if (Object.keys(done).some((k) => k.startsWith('picnic:'))) addImage(this, 1040, 190, 'pc.bunting').setDepth(D.tree + 0.6).setScale(0.9);
  }

  private readSaved(id: ScenarioId): PicnicState | null {
    const raw = currentProfile().progress.quests[`picnic:${id}`]?.flags.state;
    if (typeof raw !== 'string') return null;
    try {
      const s = JSON.parse(raw) as unknown;
      return validPicnic(s) && s.scenario === id ? s : null;
    } catch {
      return null;
    }
  }

  private commit(): void {
    const s = this.st;
    if (!s) return;
    const key = `picnic:${s.scenario}`;
    updateProfile((p) => {
      const prev = p.progress.quests[key];
      p.progress.quests[key] = { status: s.phase === 'done' ? 'done' : 'active', checkpoint: s.phase, flags: { state: JSON.stringify(s) }, completions: prev?.completions ?? 0, firstDoneAt: prev?.firstDoneAt };
      p.progress.location = { scene: 'picnic', data: { scenario: s.scenario } };
    });
  }

  // ================================================================ scenarios

  private clearScenario(): void {
    services.choices.cancel();
    this.closeStation();
    this.markTab(null, null);
    this.drumTimer?.remove();
    this.drumTimer = undefined;
    this.gustTimer?.remove();
    for (const o of this.scn) {
      this.tweens.killTweensOf(o);
      o.destroy();
    }
    this.scn = [];
    for (const id of this.scnTargets) this.removeTarget(id);
    this.scnTargets = [];
    for (const p of this.puppets.values()) p.destroy();
    this.puppets.clear();
    this.bubbles.clear();
    this.plateViews.clear();
    this.plateImgs.clear();
    this.flaps.clear();
    this.weightImgs.clear();
    this.lanternOff.clear();
    this.mineView?.destroy();
    this.mineView = undefined;
    for (const v of this.trayViews) v.destroy();
    this.trayViews = [];
    this.selected = null;
    this.selRing?.destroy();
    this.selRing = undefined;
    this.bell = undefined;
    this.takePhoto = undefined;
    this.windbreakImg = undefined;
    this.heldWeight = null;
    this.seatGuestSel = null;
    this.biteAsked = false;
    this.mossAsks = 0;
    this.lastGuide = '';
    this.lastWisher = null;
    this.hand.hide();
    // the child's own animal goes back to its spot by the plate (after a parade)
    this.tweens.killTweensOf(this.avatar);
    this.avatar.setPosition(AVATAR.x, AVATAR.y).setFacing(-1);
  }

  private keep<T extends Phaser.GameObjects.GameObject>(o: T): T {
    this.scn.push(o);
    return o;
  }

  private sTarget(t: Parameters<WWScene['addTarget']>[0]): void {
    this.addTarget(t);
    if (!this.scnTargets.includes(t.id)) this.scnTargets.push(t.id);
  }

  private startScenario(s: PicnicState): void {
    this.clearScenario();
    this.st = s;
    this.def = SCENARIOS[s.scenario];
    const def = this.def;
    this.keep(addArt(this, 0, 0, def.sky === 'dusk' ? 'pc.sky.dusk' : 'pc.sky.day').setDepth(D.sky));
    if (def.sky === 'dusk') this.keep(this.add.rectangle(960, 540, 2400, 1440, hex(P.nightLow), 0.22).setDepth(D.blanket + 0.5));
    // friends
    const guests = guestsOf(s);
    guests.forEach((g, i) => this.addGuest(g.id, i));
    if (!guests.some((g) => g.id === def.host)) {
      const hp = new Puppet(this, DRUM_X, 830, CAST_RIGS[def.host], { seed: 70 });
      hp.setDepth(D.guest).setScale(GUEST_SCALE).setFacing(-1);
      this.puppets.set(def.host, hp);
      this.keep(addImage(this, DRUM_X - 80, 850, 'pc.drum').setDepth(D.guest + 1).setScale(0.8));
      this.sTarget({ id: 'host', label: CAST_NAME[def.host], ambient: true, bounds: () => this.rectAround(DRUM_X, 740, 150, 220, 6), enabled: () => this.st?.phase === 'cook' || this.st?.phase === 'setup', activate: () => void this.talkHost() });
    }
    if (s.scenario === 'lantern' && !s.mossJoined) this.addMossUnderTree();
    this.renderTray();
    if (s.mine) this.showMine(false);
    if (s.scenario === 'windy') this.buildWindy();
    if (s.scenario === 'music') this.buildMusic();
    if (s.scenario === 'lantern') this.buildLanterns();
    this.updateTopBar();
    this.commit();
    if (s.phase === 'intro') void this.runIntro();
    else if (s.phase === 'setup') this.enterSetup(true);
    else this.enterCook();
  }

  private guestSpot(id: CastId, index: number): { x: number; y: number } {
    const s = this.st!;
    if (s.scenario === 'windy' && s.windbreak === 'moss' && id === 'moss') return { x: 1880, y: 960 };
    if (id === 'moss' && s.mossJoined && s.scenario === 'lantern') return { x: AVATAR.x - 260, y: 1000 };
    const seat = s.seats[id];
    if (seat !== undefined) return seatsFor(s.scenario)[seat];
    return { x: WAIT_X[index] ?? WAIT_X[0], y: WAIT_Y };
  }

  private addGuest(id: CastId, index: number): void {
    const s = this.st!;
    const at = this.guestSpot(id, index);
    const p = new Puppet(this, at.x, at.y, CAST_RIGS[id], { seed: 40 + index });
    p.setDepth(D.guest).setScale(GUEST_SCALE).setFacing(at.x > 1500 ? -1 : 1);
    this.puppets.set(id, p);
    const plate = addImage(this, at.x + 64, at.y + 30, 'pc.plate.small').setDepth(D.plate).setVisible(s.seats[id] !== undefined || s.scenario !== 'music');
    this.plateImgs.set(id, plate);
    this.scn.push(plate);
    const eaten = s.eaten[id];
    if (eaten) this.putOnPlate(id, eaten);
    const b = this.makeBubble(id);
    b.setVisible(s.phase !== 'intro' && !s.happy[id]);
    const h = CAST_RIGS[id].height * GUEST_SCALE;
    this.sTarget({
      id: `guest-${id}`,
      label: CAST_NAME[id],
      // the friend and the wish bubble above them
      bounds: () => new Phaser.Geom.Rectangle(p.x - 75, p.y - h - 150, 150, h + 160),
      enabled: () => !!this.st && (this.st.phase === 'cook' || this.st.phase === 'setup' || this.st.phase === 'parade'),
      activate: () => void this.onGuest(id),
    });
  }

  /** Put a friend exactly in their spot (after a walk-in that a slow device may have cut short). */
  private snapGuest(id: CastId, index: number): void {
    const p = this.puppets.get(id);
    if (!p) return;
    const at = this.guestSpot(id, index);
    this.tweens.killTweensOf(p);
    p.stopGait();
    p.setPosition(at.x, at.y).setFacing(at.x > 1500 ? -1 : 1);
    this.placeBubble(id);
  }

  private makeBubble(id: CastId): Phaser.GameObjects.Container {
    this.bubbles.get(id)?.destroy();
    const s = this.st!;
    const w = wishOf(s, id)!;
    const c = this.add.container(0, 0).setDepth(D.bubble);
    c.add(makeImage(this, 0, 0, 'pc.bubble').setScale(0.72));
    const view = new DishView(this, 0, 36, exampleDish(w));
    const fit = w.kind === 'cookie' ? (w.size === 'big' ? 0.42 : 0.56) : w.kind === 'sandwich' ? 0.4 : 0.46;
    view.setScale(fit);
    c.add(view);
    const g = guestDef(s, id);
    if (g?.seat) c.add(makeImage(this, 78, -66, g.seat === 'quiet' ? 'pc.wi.quiet' : 'pc.wi.music').setScale(0.8));
    this.bubbles.set(id, c);
    this.scn.push(c);
    this.placeBubble(id);
    return c;
  }

  private placeBubble(id: CastId): void {
    const p = this.puppets.get(id);
    const b = this.bubbles.get(id);
    if (!p || !b) return;
    b.setPosition(p.x, p.y - CAST_RIGS[id].height * GUEST_SCALE - 92);
  }

  /** The friend's wish bubble bounces so you can see whose turn it is. */
  private bounceBubble(id: CastId): void {
    const b = this.bubbles.get(id);
    if (!b || !b.visible) return;
    this.tweens.killTweensOf(b);
    b.setScale(1);
    this.tweens.add({ targets: b, scale: 1.18, duration: 160, yoyo: true, repeat: 1, ease: 'Quad.easeOut' });
  }

  private putOnPlate(id: CastId, d: Dish): void {
    this.plateViews.get(id)?.destroy();
    const plate = this.plateImgs.get(id);
    if (!plate) return;
    const v = new DishView(this, plate.x, plate.y - 2, d).setScale(d.kind === 'sandwich' ? 0.34 : 0.42).setDepth(D.plate + 1);
    this.plateViews.set(id, v);
    this.scn.push(v);
  }

  private addMossUnderTree(): void {
    const m = new Puppet(this, MOSS_TREE.x, MOSS_TREE.y, CAST_RIGS.moss, { seed: 33 });
    m.setDepth(D.guestBack).setScale(0.7).setFacing(-1);
    this.puppets.set('moss', m);
    for (let i = 0; i < 5; i++) {
      const f = this.keep(addImage(this, MOSS_TREE.x - 120 + i * 50, MOSS_TREE.y - 150 - (i % 2) * 40, 'pc.firefly').setDepth(D.guestBack + 1));
      if (!motion.reduced) this.tweens.add({ targets: f, x: f.x + 30, y: f.y - 20, alpha: 0.4, duration: 1400 + i * 300, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
    // fun to visit, never "the next step"
    this.sTarget({ id: 'moss-tree', label: 'Moss, watching fireflies', ambient: true, bounds: () => this.rectAround(MOSS_TREE.x, MOSS_TREE.y - 70, 130, 160, 6), enabled: () => !!this.st && !this.st.mossJoined && (this.st.phase === 'cook' || this.st.phase === 'setup'), activate: () => void this.talkMoss() });
  }

  /** Friends walk in, the host says what kind of picnic it is, and the first job starts straight away. */
  private async runIntro(): Promise<void> {
    const s = this.st!;
    this.busy = true;
    const introLine: Record<ScenarioId, HostLineId> = { windy: 'windyIntro', music: 'musicIntro', lantern: 'lanternIntro' };
    const guests = guestsOf(s);
    const walks: Promise<void>[] = [];
    for (const g of guests) {
      const p = this.puppets.get(g.id);
      if (!p) continue;
      const tx = p.x;
      p.x = 2120;
      this.bubbles.get(g.id)?.setVisible(false);
      walks.push(this.walk(p, tx, p.y));
    }
    await this.host(introLine[s.scenario]);
    await Promise.race([Promise.all(walks), this.wait(1200)]);
    if (!this.alive() || this.st !== s) return;
    guests.forEach((g, i) => this.snapGuest(g.id, i));
    // every wish bubble pops up (each friend says theirs when it's their turn)
    guests.forEach((g, i) => {
      const b = this.bubbles.get(g.id);
      if (!b) return;
      this.placeBubble(g.id);
      b.setVisible(true).setScale(0.2);
      audio.play('pop', { delay: i * 0.15, pitch: 1 + i * 0.1 });
      this.tweens.add({ targets: b, scale: 1, duration: 280, delay: i * 150, ease: 'Back.easeOut' });
    });
    s.phase = 'setup';
    this.commit();
    this.busy = false;
    this.enterSetup(true);
  }

  private enterSetup(speak: boolean): void {
    const s = this.st!;
    if (s.scenario === 'windy') {
      if (cornersHeld(s)) void this.windyDone();
      else {
        this.showWeights();
        if (speak) void this.host(this.preset === 'more-help' ? 'windyWeightsHelp' : this.heldWeight ? 'windyCorner' : 'windyWeights', true);
      }
    } else if (s.scenario === 'music') {
      if (allSeated(s)) void this.seatsDone();
      else if (speak) this.guideSeat();
    } else if (s.scenario === 'lantern') {
      if (s.lanterns >= LANTERN_SLOTS) void this.lanternsDone();
      else if (speak) void this.host('lanternHang', true);
    }
  }

  private enterCook(): void {
    const s = this.st!;
    if (s.phase !== 'cook') s.phase = 'cook';
    this.commit();
    this.updateTopBar();
    this.updateBell();
    if (s.scenario === 'music' && !this.drumTimer) this.startDrum();
    if (s.scenario === 'windy') this.startGusts();
    this.lastGuide = '';
    void this.guide();
  }

  // ---------------------------------------------------------------- windy picnic

  private buildWindy(): void {
    const s = this.st!;
    const loose = looseCorners(s);
    // the corners nobody needs to hold are pinned by the basket and the cooler
    if (!loose.includes(2)) this.keep(addImage(this, CORNERS[2].x + 30, CORNERS[2].y - 16, 'pc.basket').setDepth(D.setup + 1).setScale(0.7));
    if (!loose.includes(3)) this.keep(addImage(this, CORNERS[3].x - 30, CORNERS[3].y - 16, 'pc.cooler').setDepth(D.setup + 1).setScale(0.7));
    for (const c of loose) {
      const at = CORNERS[c];
      const held = s.weights[c];
      if (held) this.keep(addImage(this, at.x, at.y - 10, `pc.w.${held}`).setDepth(D.setup + 1).setScale(0.8));
      else {
        const f = this.keep(addImage(this, at.x, at.y, 'pc.flap').setDepth(D.setup).setScale(c < 2 ? 0.8 : 1, 1));
        if (!motion.reduced) this.tweens.add({ targets: f, scaleY: { from: 0.3, to: 1.1 }, angle: c % 2 ? -12 : 12, duration: 420 + c * 60, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        this.flaps.set(c, f);
      }
      this.sTarget({
        id: `corner-${c}`,
        label: 'Blanket corner',
        bounds: () => this.rectAround(at.x, at.y - 20, 120, 100, 10),
        enabled: () => this.st?.phase === 'setup' && !this.st.weights[c] && !this.busy,
        activate: () => {
          if (this.heldWeight) void this.dropWeight(c, this.heldWeight);
          else {
            // nothing in hand yet: the corner flaps, and the hand shows what to pick up
            audio.play('flap');
            this.hints.poke();
            this.demo();
          }
        },
      });
    }
    if (s.windbreak) void this.showWindbreak(s.windbreak, false);
  }

  private showWeights(): void {
    const s = this.st!;
    if (this.weightImgs.size || cornersHeld(s)) return;
    WEIGHT_CHOICES[s.preset].forEach((w, i) => {
      const at = WEIGHT_SPOTS[i];
      const im = this.keep(addImage(this, at.x, at.y, `pc.w.${w}`).setDepth(D.station + 1));
      this.weightImgs.set(w, im);
      this.sTarget({ id: `weight-${w}`, label: w, bounds: () => this.rectAround(at.x, at.y - 10, 120, 90, 10), enabled: () => this.st?.phase === 'setup' && this.weightImgs.has(w) && !this.busy, activate: () => this.pickWeight(w) });
    });
  }

  private pickWeight(w: WeightId): void {
    const s = this.st!;
    this.hints.poke();
    if (this.preset === 'more-help') {
      // one tap: it goes straight onto the next flapping corner
      const c = looseCorners(s).find((x) => !s.weights[x]);
      if (c !== undefined) void this.dropWeight(c, w);
      return;
    }
    this.heldWeight = w;
    audio.play('pickup');
    for (const [k, im] of this.weightImgs) {
      this.tweens.killTweensOf(im);
      im.setScale(k === w ? 1.2 : 1);
    }
    const im = this.weightImgs.get(w)!;
    if (!motion.reduced) this.tweens.add({ targets: im, y: im.y - 10, duration: 400, yoyo: true, repeat: -1 });
    void this.host('windyCorner', true);
  }

  private async dropWeight(c: number, w: WeightId): Promise<void> {
    const s = this.st!;
    this.hints.poke();
    this.busy = true;
    this.heldWeight = null;
    const im = this.weightImgs.get(w)!;
    const home = { x: WEIGHT_SPOTS[WEIGHT_CHOICES[s.preset].indexOf(w)].x, y: WEIGHT_SPOTS[WEIGHT_CHOICES[s.preset].indexOf(w)].y };
    this.tweens.killTweensOf(im);
    im.setScale(1).setDepth(D.fx);
    const at = CORNERS[c];
    audio.play('pickup');
    await this.tweenP({ targets: im, x: at.x, y: at.y - 10, scale: 0.8, duration: 420, ease: 'Quad.easeInOut' });
    const r = placeWeight(s, c, w);
    if (r.held) {
      this.st = r.s;
      audio.play('thud');
      dust(this, at.x, at.y, 8, D.fx);
      sparkle(this, at.x, at.y - 30, 10, D.fx);
      const f = this.flaps.get(c);
      if (f) {
        this.tweens.killTweensOf(f);
        f.destroy();
        this.flaps.delete(c);
      }
      im.setDepth(D.setup + 1);
      this.weightImgs.delete(w);
      this.removeTarget(`weight-${w}`);
      this.commit();
      await this.host('windyHeld');
      this.busy = false;
      if (cornersHeld(this.st)) await this.windyDone();
      return;
    }
    // too light: whoosh, off it goes, then it drifts back to the table
    audio.play('whoosh');
    const curl = this.keep(addImage(this, at.x + 120, at.y - 60, 'pc.windcurl').setDepth(D.fx));
    void this.tweenP({ targets: curl, x: at.x - 300, alpha: 0, duration: 700 }).then(() => curl.destroy());
    await this.tweenP({ targets: im, x: at.x - 420, y: at.y - 380, angle: -200, duration: 700, ease: 'Sine.easeOut' });
    this.note('wind');
    await Promise.all([this.host('windyBlown'), this.tweenP({ targets: im, x: home.x, y: home.y, angle: 0, scale: 1, duration: 1100, ease: 'Bounce.easeOut' })]);
    im.setDepth(D.station + 1);
    this.busy = false;
  }

  /** Corners held. More exploring also blocks the wind; More help goes straight to the food. */
  private async windyDone(): Promise<void> {
    const s = this.st!;
    if (s.phase !== 'setup') return;
    for (const im of this.weightImgs.values()) im.destroy();
    this.weightImgs.clear();
    if (this.preset === 'more-exploring' && !s.windbreak) return this.chooseWindbreak();
    await this.windyReady();
  }

  private async chooseWindbreak(): Promise<void> {
    const s = this.st!;
    this.busy = true;
    await this.host('windyBreak');
    if (!this.alive() || this.st !== s) return;
    const art: Record<string, string> = { umbrella: pieceSvg('pc.umbrella'), cushions: pieceSvg('pc.cushwall'), moss: rigSvg(CAST_RIGS.moss, { crop: 'head' }) };
    const labels: Record<string, string> = { umbrella: 'A big umbrella', cushions: 'A wall of cushions', moss: 'Ask Moss' };
    const pick = (await this.ask(WINDBREAKS[s.preset].map((id) => ({ id, icon: 'star', label: labels[id], art: art[id] })))) as 'umbrella' | 'cushions' | 'moss' | null;
    if (!pick || !this.alive() || !this.st) return;
    this.st = setWindbreak(this.st, pick);
    this.commit();
    await this.showWindbreak(pick, true);
    this.busy = false;
    // the windbreak was the happy moment: straight on to the food
    if (!this.alive() || this.st?.phase !== 'setup') return;
    this.enterCook();
  }

  private async showWindbreak(id: 'umbrella' | 'cushions' | 'moss', animate: boolean): Promise<void> {
    if (id === 'moss') {
      const m = this.puppets.get('moss');
      if (m && animate) {
        await this.guestSay('moss', GUEST_LINES['moss.windbreak'].text);
        await this.walk(m, 1880, 960);
        this.plateImgs.get('moss')?.setPosition(1880 - 90, 990);
        this.plateViews.get('moss')?.setPosition(1880 - 90, 988);
      }
      return;
    }
    const key = id === 'umbrella' ? 'pc.umbrella' : 'pc.cushwall';
    const im = this.keep(addImage(this, 1850, 990, key).setDepth(D.guest - 1).setScale(0.75));
    this.windbreakImg = im;
    if (!animate) return;
    im.setScale(0.1);
    audio.play('pop');
    await this.tweenP({ targets: im, scale: 0.75, duration: 320, ease: 'Back.easeOut' });
    if (id === 'umbrella') {
      audio.play('whoosh');
      await this.wait(300);
      setPiece(im, 'pc.umbrella.flip');
      audio.play('boing');
      await this.host('umbrellaFlip');
      // Rowan jumps up and flips it back
      const rowan = this.puppets.get('rowan');
      if (rowan) await rowan.play('jump');
      setPiece(im, 'pc.umbrella');
      audio.play('snap');
      sparkle(this, 1850, 940, 10, D.fx);
    } else {
      sparkle(this, 1850, 940, 10, D.fx);
      await this.host('cushionsWork');
    }
  }

  private async windyReady(): Promise<void> {
    const s = this.st!;
    if (s.phase !== 'setup') return;
    this.busy = true;
    this.cheerAll();
    await this.host('windyReady');
    this.busy = false;
    if (!this.alive() || this.st !== s) return;
    this.enterCook();
  }

  private startGusts(): void {
    this.gustTimer?.remove();
    this.gustTimer = this.time.addEvent({
      delay: 26000,
      loop: true,
      callback: () => {
        if (this.busy || motion.reduced) return;
        audio.play('whoosh', { vol: 0.5 });
        for (let i = 0; i < 3; i++) {
          const c = this.keep(addImage(this, 2000, 640 + i * 110, 'pc.windcurl').setDepth(D.fx));
          this.tweens.add({ targets: c, x: 900, alpha: 0, duration: 1600 + i * 200, delay: i * 150, onComplete: () => c.destroy() });
        }
        if (this.windbreakImg) this.tweens.add({ targets: this.windbreakImg, angle: -6, duration: 200, yoyo: true, repeat: 1 });
      },
    });
  }

  // ---------------------------------------------------------------- music picnic

  private buildMusic(): void {
    const seats = seatsFor('music');
    // how loud each spot is: rings spreading from the drum
    const g = this.keep(this.add.graphics().setDepth(D.setup - 1));
    for (let r = 1; r <= 3; r++) {
      g.lineStyle(10, hex(P.sun), 0.32 - r * 0.07);
      g.strokeEllipse(DRUM_X - 60, 860, r * 300, r * 110);
    }
    seats.forEach((seat, i) => {
      this.keep(addImage(this, seat.x, seat.y + 6, `pc.cushion.${i % 5}`).setDepth(D.setup));
      if (seat.loud !== 1) this.keep(addImage(this, seat.x, seat.y + 50, seat.loud === 0 ? 'pc.wi.quiet' : 'pc.wi.music').setDepth(D.setup + 1).setScale(0.7));
      this.sTarget({ id: `cushion-${i}`, label: seat.loud === 0 ? 'Quiet cushion' : seat.loud === 2 ? 'Cushion by the music' : 'Cushion', bounds: () => this.rectAround(seat.x, seat.y, 160, 80, 12), enabled: () => this.st?.phase === 'setup' && !this.busy, activate: () => void this.chooseSeat(i) });
    });
  }

  /** Who sits down next: the friend you tapped, or the next one still standing. */
  private seatFocus(): CastId | null {
    const s = this.st!;
    if (this.seatGuestSel) return this.seatGuestSel;
    return guestsOf(s).find((g) => s.seats[g.id] === undefined)?.id ?? null;
  }

  /** The cushion that suits this friend (quiet, by the music, or any free one). */
  private seatFor(id: CastId): number {
    const s = this.st!;
    const spots = seatsFor('music');
    const pref = guestDef(s, id)?.seat;
    if (pref === 'quiet') return quietSeat(s);
    if (pref === 'music') return spots.findIndex((x) => x.loud === 2);
    const taken = new Set(Object.values(s.seats));
    const free = spots.findIndex((x, i) => x.loud === 1 && !taken.has(i));
    return free >= 0 ? free : spots.findIndex((_, i) => !taken.has(i));
  }

  private guideSeat(): void {
    const id = this.seatFocus();
    if (!id) return;
    const p = this.puppets.get(id);
    if (p) void p.play('hop');
    this.bounceBubble(id);
    void this.host(SEAT_LINE[id] ?? 'musicSeats', true);
  }

  private selectSeatGuest(id: CastId): void {
    this.hints.poke();
    this.seatGuestSel = id;
    audio.play('pickup');
    this.guideSeat();
  }

  private async chooseSeat(seat: number): Promise<void> {
    const s = this.st!;
    const id = this.seatFocus();
    if (!id) return;
    this.hints.poke();
    this.busy = true;
    this.seatGuestSel = null;
    const before = { ...s.seats };
    this.st = seatGuest(s, id, seat);
    this.commit();
    const spots = seatsFor('music');
    const moves: Promise<void>[] = [];
    for (const g of guestsOf(this.st)) {
      const now = this.st.seats[g.id];
      if (now === before[g.id]) continue;
      const p = this.puppets.get(g.id)!;
      if (now === undefined) {
        // swapped off a cushion: back to waiting
        const i = guestsOf(this.st).findIndex((x) => x.id === g.id);
        moves.push(this.walk(p, WAIT_X[i] ?? WAIT_X[0], WAIT_Y));
        this.plateImgs.get(g.id)?.setVisible(false);
        continue;
      }
      const at = spots[now];
      moves.push(this.walk(p, at.x, at.y).then(() => void p.setFacing(at.x > 1500 ? -1 : 1)));
      const plate = this.plateImgs.get(g.id);
      plate?.setPosition(at.x + 64, at.y + 30).setVisible(true);
      this.plateViews.get(g.id)?.setPosition(at.x + 64, at.y + 28);
    }
    await Promise.all(moves);
    audio.play('squish', { pitch: 1.2 });
    sparkle(this, spots[seat].x, spots[seat].y - 40, 6, D.fx);
    this.busy = false;
    if (allSeated(this.st)) await this.seatsDone();
    else this.guideSeat();
  }

  private async seatsDone(): Promise<void> {
    const s = this.st!;
    if (s.phase !== 'setup') return;
    this.busy = true;
    // the first song starts; anyone whose seat doesn't suit says so
    s.phase = 'cook';
    this.commit();
    this.startDrum();
    this.cheerAll();
    await this.host('musicSeated');
    if (!this.alive() || this.st !== s) return;
    await this.checkSeats();
    if (!this.alive()) return;
    this.busy = false;
    this.enterCook();
  }

  private startDrum(): void {
    this.drumTimer?.remove();
    const beat = () => {
      const s = this.st;
      if (!s || s.phase !== 'cook') return;
      const vol = s.drum === 'loud' ? 0.9 : 0.3;
      [0, 0.25, 0.5, 0.62].forEach((d) => audio.play('drum', { vol, delay: d }));
      const fz = this.puppets.get('fizz');
      if (fz && !motion.reduced) void fz.play('pump');
      if (s.drum === 'loud')
        for (let i = 0; i < 2; i++) {
          const n = this.keep(addImage(this, DRUM_X - 80, 760, 'pc.note').setDepth(D.fx));
          this.tweens.add({ targets: n, x: n.x - 120 - i * 80, y: n.y - 140, alpha: 0, duration: 1600, delay: i * 200, onComplete: () => n.destroy() });
        }
    };
    beat();
    this.drumTimer = this.time.addEvent({ delay: 5200, loop: true, callback: beat });
  }

  /** After the first song: does everyone's seat suit what they said? Only a seat that doesn't suit needs talking about. */
  private async checkSeats(): Promise<void> {
    const s = this.st!;
    if (guestDef(s, 'luma')?.seat === 'quiet') {
      if (seatSuits(s, 'luma')) this.puppets.get('luma')?.emote('heart');
      else await this.drumTalk();
    }
    if (!this.alive()) return;
    const st = this.st!;
    const rowanSeat = st.seats.rowan;
    if (rowanSeat !== undefined && !seatSuits(st, 'rowan')) {
      const loudSeat = seatsFor('music').findIndex((x) => x.loud === 2);
      const there = (Object.keys(st.seats) as CastId[]).find((k) => st.seats[k] === loudSeat);
      if (there === 'luma') return;
      await this.guestSay('rowan', GUEST_LINES['rowan.closer'].text, 'thinking');
      const pick = await this.ask([
        { id: 'move', icon: 'yes', label: 'Move closer' },
        { id: 'stay', icon: 'no', label: 'Stay there' },
      ]);
      if (pick === 'move') {
        await this.moveGuestTo('rowan', loudSeat);
        void this.puppets.get('rowan')?.play('cheer');
        await this.guestSay('rowan', GUEST_LINES['rowan.loudOk'].text, 'excited');
      } else if (pick === 'stay') await this.guestSay('rowan', GUEST_LINES['rowan.hum'].text);
    } else if (rowanSeat !== undefined) this.puppets.get('rowan')?.emote('heart');
  }

  private async moveGuestTo(id: CastId, seat: number): Promise<void> {
    const before = { ...this.st!.seats };
    this.st = seatGuest(this.st!, id, seat);
    this.commit();
    const spots = seatsFor(this.st.scenario);
    const moves: Promise<void>[] = [];
    for (const g of guestsOf(this.st)) {
      const now = this.st.seats[g.id];
      if (now === undefined || now === before[g.id]) continue;
      const p = this.puppets.get(g.id)!;
      const at = spots[now];
      moves.push(this.walk(p, at.x, at.y));
      this.plateImgs.get(g.id)?.setPosition(at.x + 64, at.y + 30);
      this.plateViews.get(g.id)?.setPosition(at.x + 64, at.y + 28);
    }
    await Promise.all(moves);
  }

  private async drumTalk(): Promise<void> {
    const luma = this.puppets.get('luma');
    if (luma) void luma.play('hide', { expression: 'worried' });
    await this.guestSay('luma', GUEST_LINES['luma.loud'].text, 'worried');
    await this.host('helpLuma');
    let opts = DRUM_OPTIONS[this.preset];
    for (let round = 0; round < 2; round++) {
      const labels = { softer: 'Ask Fizz to play softer', move: 'Find Luma a quiet seat', askLuma: 'Ask Luma what would help' };
      const icons = { softer: 'ask', move: 'quiet', askLuma: 'ear' };
      const pick = (await this.ask(opts.map((id) => ({ id, icon: icons[id], label: labels[id] })))) as 'softer' | 'move' | 'askLuma' | null;
      if (!pick || !this.alive()) return;
      if (pick === 'askLuma') {
        await this.guestSay('luma', GUEST_LINES['luma.whatHelps'].text, 'calm');
        opts = opts.filter((o) => o !== 'askLuma');
        continue;
      }
      if (pick === 'softer') {
        this.st = applyDrum(this.st!, 'softer');
        this.commit();
        await this.guestSay('fizz', GUEST_LINES['fizz.softer'].text);
        await this.host('drumSoft');
      } else {
        await this.moveGuestTo('luma', quietSeat(this.st!));
      }
      if (luma) void luma.play('cheer', { expression: 'happy' });
      await this.guestSay('luma', GUEST_LINES['luma.thanks'].text, 'happy');
      return;
    }
  }

  // ---------------------------------------------------------------- lantern picnic

  private buildLanterns(): void {
    const s = this.st!;
    const g = this.keep(this.add.graphics().setDepth(D.tree + 1));
    g.lineStyle(5, hex(P.ink), 0.8);
    const curve = new Phaser.Curves.QuadraticBezier(new Phaser.Math.Vector2(1260, 420), new Phaser.Math.Vector2(1580, 520), new Phaser.Math.Vector2(1900, 404));
    curve.draw(g, 40);
    this.keep(addImage(this, 1900, 760, 'pc.pole').setDepth(D.tree + 1));
    LANTERN_X.forEach((x, i) => {
      if (i < s.lanterns) this.hangLanternArt(i, false);
      else {
        // an unlit lantern waits on the string: tap it to light it
        const off = this.keep(addImage(this, x, LANTERN_Y, 'pc.lantern.off').setDepth(D.tree + 2));
        if (!motion.reduced) this.tweens.add({ targets: off, angle: { from: -3, to: 3 }, duration: 1500 + i * 200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        this.lanternOff.set(i, off);
      }
      this.sTarget({
        id: `lantern-${i}`,
        label: 'Light a lantern',
        bounds: () => this.rectAround(x, LANTERN_Y, 110, 130, 10),
        enabled: () => this.st?.phase === 'setup' && i >= this.st.lanterns && !this.busy,
        activate: () => void this.hang(),
      });
    });
  }

  private hangLanternArt(i: number, animate: boolean): void {
    const x = LANTERN_X[i];
    const off = this.lanternOff.get(i);
    if (off) {
      this.tweens.killTweensOf(off);
      off.destroy();
      this.lanternOff.delete(i);
    }
    const glow = this.keep(addImage(this, x, LANTERN_Y + 10, 'pc.glow').setDepth(D.tree + 1.5).setAlpha(animate ? 0 : 0.9));
    const l = this.keep(addImage(this, x, LANTERN_Y, 'pc.lantern.on').setDepth(D.tree + 2));
    if (animate) {
      l.setScale(0.7);
      this.tweens.add({ targets: l, scale: 1, duration: 420, ease: 'Back.easeOut' });
      this.tweens.add({ targets: glow, alpha: 0.9, duration: 500 });
    }
    if (!motion.reduced) this.tweens.add({ targets: l, angle: { from: -4, to: 4 }, duration: 1600 + i * 200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  /** Any unlit lantern you tap lights the next one along the string. */
  private async hang(): Promise<void> {
    const i = this.st!.lanterns;
    if (i >= LANTERN_SLOTS) return;
    this.hints.poke();
    this.busy = true;
    this.st = hangLantern(this.st!);
    this.commit();
    audio.play('glow');
    audio.play('chime', { pitch: 1 + i * 0.15 });
    this.hangLanternArt(i, true);
    sparkle(this, LANTERN_X[i], LANTERN_Y, 12, D.fx);
    await this.wait(450);
    this.busy = false;
    if (this.st.lanterns >= LANTERN_SLOTS) await this.lanternsDone();
  }

  private async lanternsDone(): Promise<void> {
    const s = this.st;
    if (s?.phase !== 'setup') return;
    this.busy = true;
    this.cheerAll();
    await this.host('lanternLit');
    this.busy = false;
    if (!this.alive() || this.st !== s) return;
    this.enterCook();
  }

  private async talkMoss(): Promise<void> {
    if (this.busy || services.choices.open) return;
    this.hints.poke();
    this.busy = true;
    try {
      const m = this.puppets.get('moss');
      if (m) void m.play('wave');
      await this.host('mossAsk');
      const opts: ChoiceOption[] = [
        { id: 'invite', icon: 'together', label: '“Want to join our picnic?”' },
        { id: 'wave', icon: 'wave', label: 'Wave' },
      ];
      if (this.preset === 'more-exploring') opts.push({ id: 'leave', icon: 'notnow', label: 'Leave Moss be' });
      const pick = await this.ask(opts);
      if (!this.alive() || this.st?.scenario !== 'lantern') return;
      if (pick === 'invite') {
        this.st = { ...this.st, mossInvited: true };
        this.commit();
        void this.avatar.play('wave');
        await this.guestSay('moss', this.mossAsks++ === 0 ? GUEST_LINES['moss.notYet'].text : GUEST_LINES['moss.stillWatching'].text, 'calm');
      } else if (pick === 'wave') {
        void this.avatar.play('wave');
        if (m) await m.play('wave');
      }
    } finally {
      this.busy = false;
    }
    this.reguide();
  }

  /** Moss was invited earlier and is ready now (after someone's been served). */
  private async mossReady(): Promise<void> {
    const s = this.st!;
    if (s.scenario !== 'lantern' || !s.mossInvited || s.mossJoined) return;
    await this.guestSay('moss', GUEST_LINES['moss.ready'].text, 'happy');
    await this.ask([
      { id: 'yes', icon: 'yes', label: '“Yes! Sit with us!”' },
      { id: 'me', icon: 'heart', label: '“Sit next to me!”' },
    ]);
    if (!this.alive()) return;
    this.st = { ...this.st!, mossJoined: true };
    this.commit();
    this.removeTarget('moss-tree');
    const m = this.puppets.get('moss')!;
    const at = { x: AVATAR.x - 260, y: 1000 };
    await this.walk(m, at.x, at.y);
    m.setDepth(D.guest).setScale(GUEST_SCALE);
    const plate = this.keep(addImage(this, at.x + 64, at.y + 30, 'pc.plate.small').setDepth(D.plate));
    this.plateImgs.set('moss', plate);
    this.makeBubble('moss');
    const h = CAST_RIGS.moss.height * GUEST_SCALE;
    this.sTarget({ id: 'guest-moss', label: 'Moss', bounds: () => new Phaser.Geom.Rectangle(m.x - 75, m.y - h - 150, 150, h + 160), enabled: () => this.st?.phase === 'cook' || this.st?.phase === 'parade', activate: () => void this.onGuest('moss') });
    void m.play('cheer');
    await this.guestSay('moss', GUEST_LINES['moss.thanks'].text, 'happy');
    this.updateBell();
  }

  /** The lantern cutter: two friends want it at once. */
  private async cutWith(shape: Shape): Promise<{ forGuest?: string; share: boolean; shape: Shape }> {
    const s = this.st!;
    if (s.scenario !== 'lantern' || shape !== 'lantern') return { share: false, shape };
    if (!s.cutter) await this.cutterTalk();
    if (!this.alive() || !this.st) return { share: false, shape };
    const res = useLanternCutter(this.st);
    this.st = res.s;
    this.commit();
    if (res.share) {
      void this.puppets.get('luma')?.play('clap');
      void this.puppets.get('fizz')?.play('clap');
      await this.guestSay('fizz', GUEST_LINES['fizz.together'].text, 'excited');
    }
    return { forGuest: res.forGuest, share: res.share, shape };
  }

  private async cutterTalk(): Promise<void> {
    const cut = this.keep(addImage(this, 640, 540, 'pc.cutter.lantern').setDepth(D.fx).setScale(0.72));
    await this.tweenP({ targets: cut, x: 1400, y: 560, scale: 1, duration: 500, ease: 'Quad.easeOut' });
    if (!motion.reduced) this.tweens.add({ targets: cut, x: { from: 1360, to: 1460 }, duration: 260, yoyo: true, repeat: 3 });
    void this.puppets.get('luma')?.play('reach');
    await this.guestSay('luma', GUEST_LINES['luma.wantCutter'].text, 'excited');
    void this.puppets.get('fizz')?.play('reach');
    await this.guestSay('fizz', GUEST_LINES['fizz.wantCutter'].text, 'excited');
    await this.host('cutterAsk');
    const labels = { turns: 'Take turns', together: 'Make one together', swap: 'Offer Fizz a different cutter', mine: '“I’d like a turn too!”' };
    const icons = { turns: 'turn', together: 'together', swap: 'swap', mine: 'raisehand' };
    const pick = (await this.ask(CUTTER_OPTIONS[this.preset].map((id) => ({ id, icon: icons[id], label: labels[id] })))) as keyof typeof labels | null;
    if (!pick || !this.alive()) return;
    this.st = applyCutter(this.st!, pick);
    if (pick === 'turns') await this.guestSay('fizz', GUEST_LINES['fizz.wait'].text, 'silly');
    if (pick === 'mine') await this.guestSay('luma', GUEST_LINES['luma.youFirst'].text, 'happy');
    if (pick === 'swap') {
      const others = this.def.cutters[this.preset].filter((x) => x !== 'lantern');
      let tries = others;
      for (let i = 0; i < others.length; i++) {
        await this.host('swapAsk');
        const offer = (await this.dialog(tries.map((x) => ({ id: x, icon: 'star', label: `${x}`, art: pieceSvg(`pc.cutter.${x}`) })), tries[0])) as Shape;
        if (!this.alive()) return;
        const r = offerFizzShape(this.st, offer);
        if (r.accepted) {
          this.st = r.s;
          await this.guestSay('fizz', offer === 'moon' ? GUEST_LINES['fizz.moon'].text : GUEST_LINES['fizz.star'].text, 'excited');
          this.makeBubble('fizz');
          break;
        }
        await this.guestSay('fizz', GUEST_LINES['fizz.notThat'].text, 'thinking');
        tries = tries.filter((t) => t !== offer && (FIZZ_OK_SHAPES.includes(t) || tries.length <= 2));
      }
    }
    this.commit();
    await this.tweenP({ targets: cut, x: 640, y: 540, scale: 0.72, alpha: 0, duration: 400 });
    cut.destroy();
  }

  // ================================================================ stations

  private stationHost(): StationHost {
    return {
      scene: this,
      preset: this.st!.preset,
      def: this.def,
      depth: D.station,
      addTarget: (t) => this.addTarget(t),
      removeTarget: (id) => this.removeTarget(id),
      tapPoint: () => this.tapPoint,
      host: (line, still) => this.host(line, true, still),
      say: (line) => this.host(line),
      wish: () => this.stationWish(),
      trayFull: () => !!this.st && this.st.tray.length >= TRAY_SLOTS,
      deliver: (d, from) => this.deliver(d, from),
      ask: (o) => this.ask(o),
      cutWith: (shape) => this.cutWith(shape),
      poke: () => this.hints.poke(),
      demoTap: (x, y) => void this.hand.tapAt(x, y, 2),
      updateDish: (d) => {
        this.st = replaceOnTray(this.st!, d);
        this.commit();
        this.renderTray();
      },
      decorated: () => void this.guide(true),
    };
  }

  /** What the open kitchen is making, and for whom (it guides the station's steps and markers). */
  private stationWish(): Wish | null {
    const s = this.st;
    if (!s || !this.station) return null;
    if (this.station.id === 'decorate') {
      const d = this.selectedDish();
      const t = d ? this.taker(d) : null;
      return t?.id ? (wishOf(s, t.id) ?? null) : null;
    }
    const g = this.focusGuest();
    const w = g ? wishOf(s, g) : undefined;
    return w && stationFor(w) === this.station.id ? w : null;
  }

  private openStation(id: Station): void {
    const s = this.st;
    if (!s) return;
    this.hints.poke();
    if (s.phase === 'intro' || s.phase === 'setup') {
      audio.play('bonk', { pitch: 1.3 });
      this.enterSetup(true);
      return;
    }
    if (s.phase !== 'cook') return;
    // a question is waiting for an answer (e.g. soft or crunchy?): answer it first
    if (services.choices.open || this.overlay || this.busy) {
      audio.play('bonk', { pitch: 1.4 });
      return;
    }
    if (!this.allowed('chef')) return;
    if (this.station?.id === id) {
      // already open: say this step again
      this.station.announce(true);
      return;
    }
    this.closeStation();
    const host = this.stationHost();
    this.station = id === 'dough' ? new DoughStation(host) : id === 'stack' ? new StackStation(host) : id === 'juice' ? new JuiceStation(host) : new DecorateStation(host);
    this.station.open();
    audio.play('open');
    if (id === 'decorate') {
      const d = this.selectedDish();
      if (d) (this.station as DecorateStation).setDish(d);
    }
    this.updateTopBar();
    this.lastGuide = '';
    void this.guide();
  }

  private closeStation(): void {
    if (!this.station) return;
    if (this.station instanceof DecorateStation) this.station.flush();
    this.station.close();
    this.station = null;
    this.updateTopBar();
  }

  private async deliver(partial: Omit<Dish, 'id'>, from: { x: number; y: number }): Promise<boolean> {
    if (!this.st) return false;
    const n = newDishId(this.st);
    const dish: Dish = { ...partial, id: n.id };
    const r = addToTray(n.s, dish);
    if (!r.ok) {
      void this.host('trayFull');
      return false;
    }
    this.st = r.s;
    this.commit();
    const slot = this.st.tray.length - 1;
    const fly = new DishView(this, from.x, from.y, dish).setDepth(D.fx).setScale(0.9);
    audio.play('whoosh', { pitch: 1.3 });
    await this.tweenP({ targets: fly, x: TRAY_X[slot], y: TRAY.y - 14, scale: this.trayScale(dish), duration: 420, ease: 'Quad.easeInOut' });
    fly.destroy();
    // the new snack is lifted, ready to give: one tap on a friend serves it
    if (!this.selected && !(this.station instanceof DecorateStation)) this.selected = dish.id;
    this.renderTray();
    audio.play('clack');
    sparkle(this, TRAY_X[slot], TRAY.y - 40, 8, D.fx);
    await this.passTurn('server');
    if (this.st.helping) await this.helperDone();
    else if (this.st.scenario === 'windy' && this.preset === 'more-exploring' && this.st.mixup === 'none' && Object.keys(this.st.happy).length >= 1) {
      await this.wait(400);
      await this.mixup();
    }
    void this.guide();
    return true;
  }

  private trayScale(d: Dish): number {
    return d.kind === 'sandwich' ? 0.42 : d.kind === 'juice' ? 0.6 : d.share ? 0.5 : 0.62;
  }

  private renderTray(): void {
    for (const v of this.trayViews) v.destroy();
    this.trayViews = [];
    const s = this.st;
    if (!s) return;
    if (this.selected && !s.tray.some((d) => d.id === this.selected)) this.selected = null;
    s.tray.forEach((d, i) => {
      const v = new DishView(this, TRAY_X[i], TRAY.y - 14 - (d.id === this.selected ? 22 : 0), d).setDepth(D.tray + 1).setScale(this.trayScale(d));
      this.trayViews.push(v);
    });
    if (this.station instanceof DecorateStation && this.station.dishId && !s.tray.some((d) => d.id === (this.station as DecorateStation).dishId)) this.station.forget(this.station.dishId);
    this.drawSelection();
  }

  private drawSelection(): void {
    this.selRing?.destroy();
    this.selRing = undefined;
    const i = this.st?.tray.findIndex((d) => d.id === this.selected) ?? -1;
    if (i < 0) return;
    this.selRing = addImage(this, TRAY_X[i], TRAY.y - 40, 'fx.ring').setDepth(D.tray).setScale(1.1).setAlpha(0.9);
    if (!motion.reduced) this.tweens.add({ targets: this.selRing, scale: 1.25, duration: 600, yoyo: true, repeat: -1 });
  }

  private selectedDish(): Dish | undefined {
    return this.selected ? this.st?.tray.find((d) => d.id === this.selected) : undefined;
  }

  private onTray(i: number): void {
    const s = this.st!;
    const d = s.tray[i];
    if (!d || this.busy) return;
    this.hints.poke();
    if (this.station instanceof DecorateStation) {
      if (!this.allowed('chef')) return;
      this.station.flush();
      this.selected = d.id;
      audio.play('pickup');
      this.renderTray();
      this.station.setDish(this.st!.tray.find((x) => x.id === d.id)!);
      return;
    }
    if (!this.allowed('server')) return;
    this.selected = this.selected === d.id ? null : d.id;
    audio.play(this.selected ? 'pickup' : 'place');
    this.renderTray();
    void this.guide();
  }

  // ================================================================ the cooking guide: one clear step at a time

  /** Who the next snack is for: the friend whose snack the open kitchen makes, else the first friend still waiting. */
  private focusGuest(): CastId | null {
    const s = this.st!;
    const open = guestsOf(s).filter((g) => !s.happy[g.id]);
    if (!open.length) return null;
    const head = s.cutterQueue[0];
    if (head && head !== 'me' && open.some((g) => g.id === head) && (!this.station || this.station.id === 'dough')) return head;
    if (this.station && this.station.id !== 'decorate') {
      const m = open.find((g) => stationFor(wishOf(s, g.id)!) === this.station!.id);
      if (m) return m.id;
    }
    return open[0].id;
  }

  /** Who this snack should go to. `deco`: it only needs its topping first. */
  private taker(d: Dish): { id: CastId | null; needs?: 'deco' } {
    const s = this.st!;
    const exact = whoWants(s, d);
    if (exact) return { id: exact };
    let best: { id: CastId; misses: string[] } | null = null;
    for (const g of guestsOf(s)) {
      if (s.happy[g.id]) continue;
      const m = matchWish(d, wishOf(s, g.id)!);
      if (!m.kindOk) continue;
      const misses = m.misses.filter((a) => !(g.flexible ?? []).includes(a));
      if (!best || misses.length < best.misses.length) best = { id: g.id, misses };
    }
    if (!best) return { id: null };
    if (best.misses.length === 1 && best.misses[0] === 'deco' && this.visibleStations().includes('decorate')) return { id: best.id, needs: 'deco' };
    return { id: best.id };
  }

  private cookStep(): CookStep {
    const s = this.st!;
    if (this.station instanceof DecorateStation && this.station.dishId) return { k: 'station', guest: null };
    const sel = this.selectedDish();
    if (sel) {
      const t = this.taker(sel);
      if (t.needs === 'deco') return this.station?.id === 'decorate' ? { k: 'station', guest: t.id } : { k: 'tab', station: 'decorate', guest: t.id };
      return { k: 'give', dish: sel.id, to: t.id };
    }
    if (allHappy(s)) return this.bell ? { k: 'bell' } : { k: 'none' };
    // a snack on the tray that someone is waiting for: give that first
    const waiting = s.tray.find((d) => this.taker(d).id);
    if (waiting) return { k: 'give', dish: waiting.id, to: this.taker(waiting).id };
    const g = this.focusGuest();
    if (!g) return { k: 'none' };
    const st = stationFor(wishOf(s, g)!);
    if (this.station?.id === st) return { k: 'station', guest: g };
    return { k: 'tab', station: st, guest: g };
  }

  /**
   * Say what to do next, once per step: whose turn it is (their wish, out
   * loud), which kitchen button makes it, who to give it to, or the bell.
   */
  private async guide(force = false): Promise<void> {
    const s = this.st;
    if (!s || s.phase !== 'cook' || this.busy || this.overlay || services.choices.open) return;
    if (this.together && this.together.players[this.together.turn].npc) return;
    let step = this.cookStep();
    if (step.k === 'give' && step.dish !== this.selected) {
      // lift the snack that's waiting so one tap on a friend serves it
      this.selected = step.dish;
      this.renderTray();
    }
    const key = step.k === 'give' ? `give:${step.dish}:${step.to}` : step.k === 'tab' ? `tab:${step.station}:${step.guest}` : step.k === 'station' ? `station:${this.station?.id}:${step.guest}` : step.k;
    this.markTab(step.k === 'tab' ? step.station : null, step.k === 'tab' ? step.guest : null);
    if (!force && key === this.lastGuide) return;
    this.lastGuide = key;
    switch (step.k) {
      case 'bell':
        if (this.bell && !motion.reduced) this.tweens.add({ targets: this.bell, angle: { from: -10, to: 10 }, duration: 240, yoyo: true, repeat: 3 });
        await this.host('picnicTime', true, () => this.lastGuide === key);
        break;
      case 'give':
        if (step.to) {
          const p = this.puppets.get(step.to);
          if (p) void p.play('wave');
          this.bounceBubble(step.to);
        }
        await this.host(step.to ? GIVE_LINE[step.to] : 'keepHow', true, () => this.lastGuide === key);
        break;
      case 'tab':
        if (step.guest && (step.guest !== this.lastWisher || force)) {
          await this.sayWish(step.guest);
          if (!this.alive() || this.busy || this.lastGuide !== key) return;
          step = this.cookStep();
          if (step.k !== 'tab') return void this.guide();
        }
        await this.host(TAB_LINE[step.station], true, () => this.lastGuide === key);
        break;
      case 'station':
        if (step.guest && step.guest !== this.lastWisher) {
          await this.sayWish(step.guest);
          if (!this.alive() || this.lastGuide !== key) return;
        }
        this.station?.announce(true);
        break;
      default:
        break;
    }
  }

  /** Say the right next step again (after a side trip such as talking to Moss). */
  private reguide(): void {
    const s = this.st;
    if (!s || this.busy) return;
    if (s.phase === 'setup') this.enterSetup(true);
    else if (s.phase === 'cook') void this.guide(true);
  }

  /** A friend says what they'd like, and their bubble bounces. */
  private async sayWish(id: CastId): Promise<void> {
    const s = this.st!;
    this.lastWisher = id;
    this.bounceBubble(id);
    const p = this.puppets.get(id);
    if (p) void p.play('hop');
    // lantern turns: the friend whose turn it is with the cutter says so
    const turn = s.scenario === 'lantern' && s.cutter && s.cutterQueue[0] === id && Object.keys(s.happy).length > 0;
    if (turn && id === 'luma') return this.guestSay('luma', GUEST_LINES['luma.turnNext'].text);
    if (turn && id === 'fizz') return this.guestSay('fizz', GUEST_LINES['fizz.turnNext'].text, 'silly');
    await this.guestSay(id, WISH_LINES[s.scenario][id]?.[s.preset] ?? '');
  }

  // ================================================================ serving

  private async onGuest(id: CastId): Promise<void> {
    const s = this.st!;
    if (this.busy) return;
    const p = this.puppets.get(id);
    if (s.phase === 'parade') {
      // parade: every friend you tap jumps for joy
      audio.play('pop', { pitch: 1.2 });
      if (p) {
        sparkle(this, p.x, p.y - 120, 8, D.fx);
        void p.play('jump');
      }
      return;
    }
    if (s.phase === 'setup' && s.scenario === 'music') {
      this.selectSeatGuest(id);
      return;
    }
    this.hints.poke();
    if (this.selected && s.phase === 'cook') {
      if (!this.allowed('server')) return;
      // toppings added but not yet "done" still count
      if (this.station instanceof DecorateStation) this.station.flush();
      await this.serveTo(this.selected, id);
      return;
    }
    if (s.happy[id]) {
      void p?.play('nod');
      await this.guestSay(id, YUM_LINES[id]);
      return;
    }
    await this.sayWish(id);
  }

  private async serveTo(dishId: string, id: CastId): Promise<void> {
    const s = this.st!;
    const dish = s.tray.find((d) => d.id === dishId);
    if (!dish) return;
    this.busy = true;
    this.markTab(null, null);
    const r = serve(s, dishId, id);
    const p = this.puppets.get(id)!;
    switch (r.reaction.type) {
      case 'yum':
      case 'flex':
      case 'shared': {
        this.st = r.s;
        this.selected = null;
        this.commit();
        await this.flyToPlate(dish, id);
        let other: CastId | undefined;
        if (r.reaction.type === 'shared') {
          other = r.reaction.with;
          this.putOnPlate(other, dish);
          this.hideBubble(other);
        }
        this.hideBubble(id);
        await this.celebrate(id, dish, other);
        await this.guestSay(id, r.reaction.type === 'shared' ? SHARED_LINE : r.reaction.type === 'flex' ? FLEX_LINE : YUM_LINES[id], 'excited');
        await this.afterServe();
        break;
      }
      case 'full':
        void p.play('nod');
        await this.guestSay(id, FULL_LINE, 'happy');
        break;
      case 'notQuite':
      case 'otherKind': {
        const w = wishOf(s, id)!;
        void p.play('think', { expression: 'thinking' });
        this.bounceBubble(id);
        await this.guestSay(id, r.reaction.type === 'otherKind' ? otherKindLine(dish.kind, w) : notQuiteLine(w, r.reaction.misses[0]), 'thinking');
        await this.notQuiteChoices(dish, id, r.reaction.type === 'notQuite');
        break;
      }
      default:
        break;
    }
    this.busy = false;
    this.renderTray();
    this.updateBell();
    void this.guide();
  }

  /** A happy friend gets a big moment: sparkles, hearts, a cheer, and everyone claps. */
  private async celebrate(id: CastId, d: Dish, also?: CastId): Promise<void> {
    const p = this.puppets.get(id);
    audio.play('success');
    this.munch(id, d);
    for (const who of [id, also]) {
      const q = who ? this.puppets.get(who) : undefined;
      if (!q) continue;
      sparkle(this, q.x, q.y - 120, 20, D.fx);
      void q.play('cheer', { expression: 'excited' });
    }
    for (const [other, q] of this.puppets) if (other !== id && other !== also && guestsOf(this.st!).some((g) => g.id === other)) void q.play('clap');
    void this.avatar.play('cheer', { expression: 'excited' });
    if (p) {
      for (let i = 0; i < 3; i++) {
        const heart = this.keep(addImage(this, p.x - 40 + i * 40, p.y - 160, 'pc.heart').setDepth(D.fx).setScale(0.6));
        this.tweens.add({ targets: heart, y: heart.y - 120 - i * 20, scale: 1, alpha: 0, duration: 1300, delay: i * 120, onComplete: () => heart.destroy() });
      }
    }
    await this.wait(motion.reduced ? 200 : 600);
  }

  /** The friend explains what they'd like; then a spoken question and a few clear choices. */
  private async notQuiteChoices(dish: Dish, id: CastId, sameKind: boolean): Promise<void> {
    const s = this.st!;
    const other = whoWants(s, dish, id);
    await this.host('whatNow');
    const opts: ChoiceOption[] = [];
    if (other) opts.push({ id: 'offer', icon: 'together', label: `Offer it to ${CAST_NAME[other]}`, art: rigSvg(CAST_RIGS[other], { crop: 'head' }) });
    opts.push({ id: 'remake', icon: 'fix', label: 'Make another one' });
    opts.push({ id: 'keep', icon: 'heart', label: 'Keep it for me', art: portraitFor('avatar', 'happy') });
    if (this.preset === 'more-exploring' && sameKind) opts.push({ id: 'try', icon: 'ask', label: '“Could you try it?”' });
    const pick = await this.ask(opts);
    if (!this.alive() || !pick) return;
    if (pick === 'remake') {
      this.selected = null;
      this.renderTray();
      const station: Station = dish.kind === 'cookie' ? 'dough' : dish.kind === 'sandwich' ? 'stack' : 'juice';
      this.busy = false;
      if (this.station?.id === station) {
        this.lastGuide = '';
        return;
      }
      this.openStation(station);
    } else if (pick === 'offer' && other) {
      this.busy = false;
      await this.serveTo(dish.id, other);
    } else if (pick === 'keep') {
      await this.keepMine(dish.id);
    } else if (pick === 'try') {
      const r = askToTry(this.st!, dish.id, id);
      if (r.tried) {
        this.st = r.s;
        this.selected = null;
        this.commit();
        await this.flyToPlate(dish, id);
        this.hideBubble(id);
        await this.celebrate(id, dish);
        await this.guestSay(id, TRIED_LINE, 'surprised');
        await this.afterServe();
      } else await this.guestSay(id, DECLINE_TRY_LINE, 'calm');
    }
  }

  private async afterServe(): Promise<void> {
    updateProfile((p) => (p.progress.done['picnic:served-once'] = 1));
    await this.passTurn('chef');
    this.updateBell();
    if (this.st && !allHappy(this.st) && this.st.scenario === 'lantern' && this.st.mossInvited && !this.st.mossJoined) await this.mossReady();
  }

  private async flyToPlate(dish: Dish, id: CastId): Promise<void> {
    const plate = this.plateImgs.get(id);
    if (!plate) return;
    const i = this.st!.tray.findIndex((d) => d.id === dish.id);
    const from = { x: TRAY_X[Math.max(0, i)] ?? TRAY.x, y: TRAY.y - 30 };
    const fly = new DishView(this, from.x, from.y, dish).setDepth(D.fx).setScale(this.trayScale(dish));
    this.renderTray();
    audio.play('swish');
    await this.tweenP({ targets: fly, x: plate.x, y: plate.y - 2, scale: dish.kind === 'sandwich' ? 0.34 : 0.42, duration: 520, ease: 'Sine.easeInOut' });
    fly.destroy();
    this.putOnPlate(id, dish);
  }

  private munch(id: CastId | 'avatar', d: Dish): void {
    const plate = id === 'avatar' ? { x: AVATAR.x - 110, y: AVATAR.y + 20 } : this.plateImgs.get(id);
    const sound = d.kind === 'juice' ? 'pour' : d.texture === 'crunchy' ? 'crunch' : 'squish';
    audio.play(sound, { delay: 0.3 });
    if (plate) dust(this, plate.x, plate.y - 20, 5, D.fx);
  }

  private hideBubble(id: CastId): void {
    const b = this.bubbles.get(id);
    if (!b) return;
    this.tweens.killTweensOf(b);
    this.tweens.add({ targets: b, scale: 0, duration: 200, onComplete: () => b.setVisible(false) });
  }

  private async onAvatar(): Promise<void> {
    if (this.busy) return;
    this.hints.poke();
    const s = this.st;
    if (this.selected && s?.phase === 'cook') {
      if (!this.allowed('server')) return;
      if (this.station instanceof DecorateStation) this.station.flush();
      this.busy = true;
      this.markTab(null, null);
      await this.keepMine(this.selected);
      this.busy = false;
      void this.guide();
      return;
    }
    audio.play('chirp');
    sparkle(this, this.avatar.x, this.avatar.y - 120, 5, D.fx);
    void this.avatar.play(s?.phase === 'parade' ? 'jump' : 'wave');
  }

  /** Your own snack is yours. A friend may ask for a bite; "no thanks" is a fine answer. */
  private async keepMine(dishId: string): Promise<void> {
    const dish = this.st!.tray.find((d) => d.id === dishId);
    if (!dish) return;
    this.st = keepForMe(this.st!, dishId);
    this.selected = null;
    this.commit();
    const fly = new DishView(this, TRAY.x, TRAY.y - 30, dish).setDepth(D.fx).setScale(this.trayScale(dish));
    this.renderTray();
    await this.tweenP({ targets: fly, x: AVATAR.x - 110, y: AVATAR.y + 20, scale: 0.42, duration: 480 });
    fly.destroy();
    this.showMine(true);
    await this.guestSay('avatar', GUEST_LINES['avatar.mine'].text, 'happy');
    await this.passTurn('chef');
    this.updateBell();
    const s = this.st!;
    if (!this.biteAsked && guestsOf(s).some((g) => g.id === 'pip') && !s.happy.pip) {
      this.biteAsked = true;
      await this.guestSay('pip', GUEST_LINES['pip.bite'].text, 'excited');
      const pick = await this.ask([
        { id: 'yes', icon: 'yes', label: '“Yes, have some!”' },
        { id: 'no', icon: 'no', label: '“No thanks, it’s mine.”' },
      ]);
      if (pick === 'yes') {
        audio.play('crunch');
        void this.puppets.get('pip')?.play('cheer');
        await this.guestSay('pip', GUEST_LINES['pip.biteYes'].text, 'excited');
      } else if (pick === 'no') await this.guestSay('pip', GUEST_LINES['pip.biteNo'].text, 'happy');
    }
  }

  private showMine(pop: boolean): void {
    this.mineView?.destroy();
    const d = this.st?.mine;
    if (!d) return;
    this.mineView = new DishView(this, AVATAR.x - 110, AVATAR.y + 20, d).setScale(d.kind === 'sandwich' ? 0.34 : 0.42).setDepth(D.plate + 1);
    if (pop) {
      this.munch('avatar', d);
      sparkle(this, AVATAR.x - 60, AVATAR.y - 100, 12, D.fx);
      audio.play('sparkle');
      void this.avatar.play('cheer', { expression: 'excited' });
    }
  }

  private async talkHost(): Promise<void> {
    if (this.busy) return;
    const fz = this.puppets.get(this.def.host);
    void fz?.play('dance');
    audio.play('drum');
    await this.guestSay(this.def.host, GUEST_LINES['fizz.drum'].text, 'excited');
  }

  // ---------------------------------------------------------------- the bumped tray (windy picnic, More exploring)

  private async mixup(): Promise<void> {
    const s = this.st;
    if (!s || s.mixup !== 'none' || !s.tray.length || !this.alive()) return;
    const rowan = this.puppets.get('rowan');
    if (!rowan) return;
    this.busy = true;
    this.markTab(null, null);
    this.st = { ...s, mixup: 'pending' };
    this.commit();
    const napkin = this.keep(addImage(this, rowan.x, rowan.y - 120, 'pc.napkin').setDepth(D.fx));
    audio.play('whoosh');
    const home = { x: rowan.x, y: rowan.y };
    await Promise.all([
      this.guestSay('rowan', GUEST_LINES['rowan.napkin'].text, 'surprised'),
      this.tweenP({ targets: napkin, x: TRAY.x + 60, y: TRAY.y - 120, angle: 360, duration: 900 }),
      this.walk(rowan, TRAY.x + 220, TRAY.y - 30),
    ]);
    // bump!
    audio.play('bonk');
    const last = this.st.tray[this.st.tray.length - 1];
    this.st = replaceOnTray(this.st, { ...last, squished: true });
    this.commit();
    this.cameras.main.shake(motion.reduced ? 0 : 160, 0.004);
    this.renderTray();
    napkin.destroy();
    void rowan.play('oops', { expression: 'embarrassed' });
    await this.guestSay('rowan', GUEST_LINES['rowan.oops'].text, 'embarrassed');
    await this.host('mixupAsk');
    const labels = { remake: 'Make it again together', fine: '“It’s okay! Still yummy.”', cross: '“I feel a bit cross.”' };
    const icons = { remake: 'fix', fine: 'yes', cross: 'sorry' };
    const art = { cross: portraitFor('avatar', 'frustrated') } as Record<string, string | undefined>;
    const pick = (await this.ask(MIXUP_OPTIONS[this.preset].map((id) => ({ id, icon: icons[id], label: labels[id], art: art[id] })))) as keyof typeof labels | null;
    if (!this.alive()) return;
    if (pick === 'fine' || !pick) {
      void rowan.play('cheer');
      await this.guestSay('rowan', GUEST_LINES['rowan.fine'].text, 'happy');
      await this.walk(rowan, home.x, home.y);
    } else {
      if (pick === 'cross') await this.guestSay('rowan', GUEST_LINES['rowan.cross'].text, 'worried');
      else await this.guestSay('rowan', GUEST_LINES['rowan.helpRemake'].text, 'determined');
      this.st = { ...this.st!, helping: true };
      await this.walk(rowan, HELPER.x, HELPER.y);
      rowan.setFacing(-1);
      this.placeBubble('rowan');
    }
    this.st = { ...this.st!, mixup: 'done' };
    this.commit();
    this.busy = false;
  }

  private async helperDone(): Promise<void> {
    const rowan = this.puppets.get('rowan');
    this.st = { ...this.st!, helping: false };
    this.commit();
    if (!rowan) return;
    void rowan.play('clap');
    await this.guestSay('rowan', GUEST_LINES['rowan.didIt'].text, 'excited');
    const seat = this.st.seats.rowan;
    const at = seat !== undefined ? seatsFor(this.st.scenario)[seat] : { x: 1520, y: 800 };
    await this.walk(rowan, at.x, at.y);
  }

  // ================================================================ the parade

  private updateBell(): void {
    const s = this.st;
    if (!s || s.phase !== 'cook' || !canParade(s)) return;
    if (!this.bell) {
      this.bell = this.keep(addImage(this, BELL.x, BELL.y, 'pc.bell').setDepth(D.guest + 3).setScale(0.1));
      this.tweens.add({ targets: this.bell, scale: 1, duration: 300, ease: 'Back.easeOut' });
      audio.play('pop');
      this.sTarget({ id: 'bell', label: 'Ring the picnic bell', bounds: () => this.rectAround(BELL.x, BELL.y - 40, 110, 110, 10), enabled: () => this.st?.phase === 'cook' && !this.busy, activate: () => void this.parade() });
    }
  }

  /** Everyone cheers and jumps (a happy moment, with no words needed). */
  private cheerAll(): void {
    audio.play('success');
    for (const p of [...this.puppets.values(), this.avatar]) {
      if (!p.active) continue;
      void p.play('cheer', { expression: 'excited' });
      sparkle(this, p.x, p.y - 140, 8, D.fx);
    }
  }

  private async parade(): Promise<void> {
    const s = this.st!;
    this.hints.poke();
    this.busy = true;
    this.markTab(null, null);
    audio.play('bell');
    services.choices.cancel();
    this.closeStation();
    this.selected = null;
    this.renderTray();
    this.drumTimer?.remove();
    this.drumTimer = undefined;
    this.gustTimer?.remove();
    this.st = { ...s, phase: 'parade' };
    this.commit();
    this.updateTopBar();
    // hooray first: bunting, party music, everyone jumps
    audio.startMusic('festival');
    const bunt = this.keep(addImage(this, 1040, -120, 'pc.bunting').setDepth(D.fx - 1).setScale(0.9));
    this.tweens.add({ targets: bunt, y: 190, duration: 700, ease: 'Bounce.easeOut' });
    this.cheerAll();
    for (let i = 0; i < 3; i++) this.time.delayedCall(250 + i * 300, () => sparkle(this, 1250 + i * 250, 500, 14, D.fx));
    await this.wait(motion.reduced ? 300 : 1100);
    if (!this.alive()) return;
    if (!allHappy(this.st)) await this.host('share');
    if (this.st.scenario === 'lantern' && !this.st.mossJoined && this.puppets.get('moss')) {
      await this.guestSay('moss', GUEST_LINES['moss.parade'].text, 'happy');
      const m = this.puppets.get('moss')!;
      await this.walk(m, AVATAR.x - 260, 1000);
      m.setScale(GUEST_SCALE).setDepth(D.guest);
    }
    if (!this.alive()) return;
    // the photo, while everyone still has their snack: the child presses the camera
    await this.cameraStep();
    if (!this.alive()) return;
    const preview = await this.photo();
    if (!this.alive()) return;
    await Promise.all([this.showPhoto(preview), this.savePicnic(preview)]);
    if (!this.alive()) return;
    // munch!
    for (const [id, v] of this.plateViews) {
      this.tweens.add({ targets: v, scale: 0, duration: 900, delay: 200 });
      this.munch(id, v.dish);
    }
    if (this.mineView) this.tweens.add({ targets: this.mineView, scale: 0, duration: 900 });
    for (const b of this.bubbles.values()) b.setVisible(false);
    // a short march to the front, a dance, and a big finish (tap anyone to make them jump)
    const marchers = [...this.puppets.values(), this.avatar].filter((p) => p.active);
    const march = async () => {
      if (motion.reduced) {
        await Promise.all(marchers.map((p) => p.play('cheer')));
        return;
      }
      await Promise.all(marchers.map((p, i) => this.walk(p, 1180 + i * 130, 960)));
      await Promise.all(marchers.map((p) => p.play('dance')));
      sparkle(this, 1500, 700, 16, D.fx);
      await Promise.all(marchers.map((p) => p.play('jump')));
    };
    this.busy = false;
    await Promise.all([this.host('parade'), march()]);
    this.busy = true;
    sparkle(this, 1500, 600, 20, D.fx);
    audio.play('success');
    if (!this.alive()) return;
    this.st = { ...this.st!, phase: 'done' };
    this.commit();
    this.busy = false;
    await this.wait(500);
    audio.startMusic('picnic');
    void this.endChoices();
  }

  /** A camera pops up; tapping it takes the picnic photo. */
  private cameraStep(): Promise<void> {
    return new Promise((resolve) => {
      const cam = this.keep(addImage(this, CAMERA.x, CAMERA.y, 'pc.camera').setDepth(D.fx - 2).setScale(0.1));
      audio.play('pop');
      this.tweens.add({ targets: cam, scale: 1.4, duration: 320, ease: 'Back.easeOut' });
      if (!motion.reduced) this.tweens.add({ targets: cam, angle: { from: -5, to: 5 }, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: 320 });
      this.takePhoto = () => {
        this.takePhoto = undefined;
        this.hints.poke();
        this.busy = true;
        this.tweens.killTweensOf(cam);
        cam.setAngle(0);
        void this.tweenP({ targets: cam, scale: 0, alpha: 0, duration: 260 });
        resolve();
      };
      this.sTarget({ id: 'camera', label: 'Take the picnic photo', bounds: () => this.rectAround(CAMERA.x, CAMERA.y, 170, 130, 16), enabled: () => !!this.takePhoto, activate: () => this.takePhoto?.() });
      this.busy = false;
      void this.host('photo', true);
    });
  }

  /** The photo pops up big, then flies into the album button. */
  private async showPhoto(url: string | undefined): Promise<void> {
    if (!url || !this.alive()) return;
    const key = `pc.photo.${Date.now()}`;
    const loaded = await new Promise<boolean>((resolve) => {
      const done = (ok: boolean) => resolve(ok);
      this.textures.once(Phaser.Textures.Events.ADD_KEY + key, () => done(true));
      this.time.delayedCall(900, () => done(false));
      try {
        this.textures.addBase64(key, url);
      } catch {
        done(false);
      }
    });
    if (!loaded || !this.alive() || !this.textures.exists(key)) return;
    const c = this.add.container(1200, 520).setDepth(D.fx + 4).setScale(0.2).setAngle(-4);
    c.add(this.add.rectangle(0, 0, 380, 300, 0xfffdf8).setStrokeStyle(8, hex(P.ink)));
    c.add(this.add.image(0, -10, key).setDisplaySize(340, 255));
    audio.play('paper');
    await this.tweenP({ targets: c, scale: 1, angle: 3, duration: 380, ease: 'Back.easeOut' });
    sparkle(this, 1200, 380, 12, D.fx + 5);
    await this.wait(1000);
    const btn = this.topBar?.querySelector('[data-album]') as HTMLElement | null;
    const to = btn ? this.clientToWorld(btn) : { x: 1500, y: -100 };
    await this.tweenP({ targets: c, x: to.x, y: to.y, scale: 0.08, angle: 0, alpha: 0.4, duration: 600, ease: 'Quad.easeIn' });
    c.destroy();
    if (this.textures.exists(key)) this.textures.remove(key);
    btn?.animate?.([{ transform: 'scale(1)' }, { transform: 'scale(1.25)' }, { transform: 'scale(1)' }], { duration: 420 });
  }

  private photo(): Promise<string | undefined> {
    return new Promise((resolve) => {
      const flash = this.add.rectangle(960, 540, 2400, 1440, 0xffffff, 0).setDepth(D.fx + 5);
      audio.play('pop', { pitch: 0.6 });
      const cam = this.cameras.main;
      const x = Math.round(1080 - cam.scrollX);
      const y = Math.round(360 - cam.scrollY);
      const done = (img: unknown) => {
        try {
          const im = img as HTMLImageElement;
          const c = document.createElement('canvas');
          c.width = 320;
          c.height = 240;
          c.getContext('2d')!.drawImage(im, 0, 0, 320, 240);
          resolve(c.toDataURL('image/jpeg', 0.72));
        } catch {
          resolve(undefined);
        }
        this.tweens.add({ targets: flash, fillAlpha: 0.9, duration: 80, yoyo: true, onComplete: () => flash.destroy() });
      };
      try {
        this.game.renderer.snapshotArea(x, y, 840, 640, done as Phaser.Types.Renderer.Snapshot.SnapshotCallback);
      } catch {
        resolve(undefined);
      }
      setTimeout(() => resolve(undefined), 1800);
    });
  }

  private async savePicnic(preview: string | undefined, retry = false): Promise<void> {
    const s = this.st!;
    const pid = services.profileId!;
    const count = services.save.listCreations(pid, 'picnic').length;
    const res = await services.save.saveCreation({
      profileId: pid,
      kind: 'picnic',
      name: `${this.def.name} ${count + 1}`,
      data: { v: 1, scenario: s.scenario, eaten: s.eaten, mine: s.mine, guests: guestsOf(s).map((g) => g.id) },
      preview,
    });
    if (res.ok) {
      if (!retry) this.recordDone();
      if (!currentProfile().progress.display.picnic && res.id) updateProfile((p) => (p.progress.display.picnic = res.id!));
      services.session.made.push({ kind: 'picnic', label: this.def.name, art: preview ? `<img src="${preview}" alt="">` : undefined });
      toast(services.layers.toast, 'heart', 'Picnic photo saved', 2600);
    } else if (res.reason === 'full') {
      if (!retry) this.recordDone();
      await this.host('albumFull');
      this.openAlbum(() => void this.savePicnic(preview, true));
    } else {
      if (!retry) this.recordDone();
      toast(services.layers.toast, 'gear', 'Couldn’t save the photo just now (see the grown-up area).');
    }
  }

  private recordDone(): void {
    const s = this.st!;
    const key = `picnic:${s.scenario}`;
    updateProfile((p) => {
      p.progress.done[key] = (p.progress.done[key] ?? 0) + 1;
      const q = p.progress.quests[key];
      if (q) {
        q.completions += 1;
        q.firstDoneAt = q.firstDoneAt ?? Date.now();
      }
    });
    const served = (Object.keys(s.eaten) as CastId[]).map((id) => `${CAST_NAME[id]}: ${describe(s.eaten[id]!)}`).join('; ');
    services.save.log(services.profileId!, 'picnic', `Hosted the ${this.def.name}.${served ? ` Served ${served}.` : ' Shared what was made.'}${s.mine ? ` Kept a ${describe(s.mine)} for themselves.` : ''}`);
  }

  private async endChoices(): Promise<void> {
    await this.host('again');
    if (!this.alive()) return;
    const pick = await this.ask([
      { id: 'again', icon: 'play', label: 'Another picnic' },
      { id: 'album', icon: 'film', label: 'My picnic photos', art: pieceSvg('pc.ic.album') },
      { id: 'map', icon: 'map', label: 'Back to the map' },
    ]);
    if (!this.alive()) return;
    if (pick === 'again') this.openPicker(false);
    else if (pick === 'album') this.openAlbum(() => this.openPicker(false), true);
    else if (pick === 'map') services.nav.openMap();
  }

  // ================================================================ picker, album, top bar

  private openPicker(first: boolean): void {
    this.overlay?.remove();
    const prof = currentProfile();
    const cards = SCENARIO_ORDER.map((id) => {
      const def = SCENARIOS[id];
      const done = !!prof.progress.done[`picnic:${id}`];
      const midway = this.readSaved(id);
      return h(
        'button',
        {
          class: 'tile',
          type: 'button',
          'data-scenario': id,
          'aria-label': def.name,
          style: 'width:190px;min-height:200px;position:relative',
          on: {
            click: () => {
              audio.play('confirm');
              close();
              const saved = this.readSaved(id);
              this.startScenario(saved && saved.phase !== 'done' ? saved : newPicnic(id, this.preset));
            },
          },
        },
        h('span', { html: rigSvg(CAST_RIGS[def.host], { crop: 'head' }), style: 'width:70px;height:70px;display:block' }),
        h('span', { html: pieceSvg(def.card), style: 'width:150px;height:105px;display:block' }),
        done ? h('span', { html: icon('star', 40), style: 'position:absolute;top:6px;right:6px' }) : null,
        midway && midway.phase !== 'done' && midway.phase !== 'intro' ? h('span', { html: icon('turn', 36), style: 'position:absolute;top:6px;left:6px', title: 'Carry on' }) : null,
      );
    });
    const panel = h('div', { class: 'panel', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Choose a picnic' }, h('div', { class: 'big-choices' }, ...cards));
    const overlay = h('div', { class: 'overlay' }, panel);
    const release = trapFocus(panel);
    const close = () => {
      release();
      overlay.remove();
      this.overlay = undefined;
    };
    overlay.addEventListener('click', (e) => e.target === overlay && !first && !!this.st && close());
    services.layers.overlay.append(overlay);
    this.overlay = overlay;
    updateProfile((p) => (p.progress.location = { scene: 'picnic' }));
    if (first) void instruct('rowan', GUEST_LINES['rowan.welcome'].text, () => this.pulseCards());
  }

  private openAlbum(after?: () => void, viewOnly = false): void {
    const pid = services.profileId!;
    let removed = false;
    this.closeShelf = openShelf({
      layer: services.layers.overlay,
      label: 'My picnic photos',
      items: () => services.save.listCreations(pid, 'picnic').map((c) => ({ id: c.id, name: c.name, preview: c.preview })),
      displayedId: () => currentProfile().progress.display.picnic,
      emptyIcon: 'heart',
      open: { label: 'Look', run: (id) => this.viewPhoto(id) },
      show: (id) => {
        updateProfile((p) => (p.progress.display.picnic = id));
        void this.host('shown');
      },
      remove: async (id) => {
        await services.save.deleteCreation(id, pid);
        removed = true;
      },
      onRemoved: () => {
        if (!viewOnly && after) {
          this.closeShelf?.();
          after();
          after = undefined;
        }
      },
      onClose: () => {
        this.closeShelf = undefined;
        if (viewOnly && after) after();
        void removed;
      },
    });
  }

  private viewPhoto(id: string): void {
    const c = services.save.getCreation(id);
    if (!c || c.profileId !== services.profileId || !c.preview) return;
    void iconDialog(services.layers.overlay, {
      art: `<img src="${c.preview}" alt="" style="width:min(640px,80vw);border-radius:18px;border:4px solid #3b2a20">`,
      buttons: [{ id: 'ok', icon: 'check', label: 'Done', kind: 'go' }],
      safeId: 'ok',
    });
  }

  private buildDom(): void {
    const tabs = STATION_TABS.map((t) =>
      h(
        'button',
        {
          class: 'tile',
          type: 'button',
          'data-station': t.id,
          'aria-label': t.label,
          'aria-pressed': 'false',
          style: 'width:96px;min-height:84px;padding:4px;flex:none;position:relative;overflow:visible',
          on: {
            click: () => {
              audio.play('tap');
              this.openStation(t.id);
            },
          },
        },
        h('span', { class: 'part-ico', html: pieceSvg(t.art) }),
        // whose snack this button makes right now (a little face in the corner)
        h('span', { 'data-face': true, hidden: true, style: 'position:absolute;top:-14px;right:-14px;width:46px;height:46px;border-radius:50%;background:#fffdf7;border:3px solid #3b2a20;overflow:hidden;pointer-events:none' }),
        // the "tap here" arrow under the button
        h('span', { 'data-mark': true, hidden: true, html: TAB_ARROW, style: 'position:absolute;left:50%;top:calc(100% + 6px);width:54px;height:54px;transform:translateX(-50%);pointer-events:none' }),
      ),
    );
    const btn = (ic: string, label: string, fn: () => void, attr: string, art?: string) =>
      h('button', { class: 'btn-round', type: 'button', 'aria-label': label, title: label, html: art ?? icon(ic), [attr]: true, style: '--btn:68px', on: { click: () => { audio.play('tap'); fn(); } } });
    this.topBar = h(
      'div',
      { class: 'choices', role: 'toolbar', 'aria-label': 'Picnic kitchen', style: 'top:max(12px, env(safe-area-inset-top));bottom:auto;width:auto;gap:10px;flex-wrap:nowrap;align-items:center;max-width:calc(100vw - 2 * var(--btn) - 200px)' },
      ...tabs,
      h('span', { style: 'width:8px' }),
      btn('film', 'My picnic photos', () => this.openAlbum(), 'data-album', `<span style="display:block;width:52px;height:48px">${pieceSvg('pc.ic.album')}</span>`),
      btn('together', 'Play together', () => void this.togetherPressed(), 'data-together'),
      btn('swap', 'Swap jobs', () => this.swapJobs(), 'data-swapjobs'),
      btn('wave', 'My helper left', () => void this.helperLeft(), 'data-left'),
      btn('home', 'Pick a picnic', () => this.openPicker(false), 'data-picker', `<span style="display:block;width:56px;height:40px">${pieceSvg('pc.card.windy')}</span>`),
    );
    services.layers.choices.append(this.topBar);
  }

  /** The kitchens on offer: everything for More exploring; just what the friends asked for on More help. */
  private visibleStations(): Station[] {
    const s = this.st;
    if (!s) return [];
    if (this.preset === 'more-exploring') return STATION_TABS.map((t) => t.id);
    const need = new Set<Station>();
    for (const g of guestsOf(s)) {
      const w = wishOf(s, g.id);
      if (!w) continue;
      need.add(stationFor(w));
      if (w.deco) need.add('decorate');
    }
    return STATION_TABS.map((t) => t.id).filter((id) => need.has(id));
  }

  private updateTopBar(): void {
    const bar = this.topBar;
    if (!bar) return;
    const cook = this.st?.phase === 'cook';
    const show = this.visibleStations();
    for (const b of bar.querySelectorAll<HTMLElement>('[data-station]')) {
      const id = b.dataset.station as Station;
      const on = this.station?.id === id;
      b.setAttribute('aria-pressed', String(on));
      b.style.background = on ? '#ffe7a3' : '';
      // the kitchen buttons appear when it's time to cook
      const wasHidden = b.hidden;
      b.hidden = !cook || !show.includes(id);
      if (wasHidden && !b.hidden && !motion.reduced) b.animate?.([{ transform: 'scale(0.3)' }, { transform: 'scale(1.1)' }, { transform: 'scale(1)' }], { duration: 360, easing: 'ease-out' });
    }
    (bar.querySelector('[data-swapjobs]') as HTMLElement).hidden = !this.together;
    (bar.querySelector('[data-left]') as HTMLElement).hidden = !this.together;
  }

  /** Mark the kitchen button to press next: it glows, an arrow bobs under it, and the friend's face sits on it. */
  private markTab(station: Station | null, guest: CastId | null): void {
    const bar = this.topBar;
    if (!bar) return;
    const key = `${station}:${guest}`;
    if (key === this.tabMarkKey) return;
    this.tabMarkKey = key;
    this.tabBob?.cancel();
    this.tabBob = undefined;
    for (const b of bar.querySelectorAll<HTMLElement>('[data-station]')) {
      const on = b.dataset.station === station;
      b.classList.toggle('glow', on);
      const mark = b.querySelector('[data-mark]') as HTMLElement;
      const face = b.querySelector('[data-face]') as HTMLElement;
      mark.hidden = !on;
      face.hidden = !on || !guest;
      if (on && guest) face.innerHTML = this.faceSvg(guest);
      if (on && !motion.reduced)
        this.tabBob = mark.animate?.([{ transform: 'translate(-50%, 0)' }, { transform: 'translate(-50%, 12px)' }], { duration: 480, direction: 'alternate', iterations: Infinity, easing: 'ease-in-out' });
    }
  }

  private faceSvg(id: CastId): string {
    let f = this.faces.get(id);
    if (!f) {
      f = rigSvg(CAST_RIGS[id], { crop: 'head' }).replace('<svg', '<svg style="width:100%;height:100%"');
      this.faces.set(id, f);
    }
    return f;
  }

  /** Where a DOM element (e.g. a kitchen button) sits in the game world. */
  private clientToWorld(el: HTMLElement): { x: number; y: number } {
    const r = el.getBoundingClientRect();
    const canvas = this.game.canvas.getBoundingClientRect();
    const cam = this.cameras.main;
    const sx = canvas.width / this.scale.width;
    const sy = canvas.height / this.scale.height;
    return { x: cam.scrollX + (r.left + r.width / 2 - canvas.left) / (sx * cam.zoom), y: cam.scrollY + (r.top + r.height / 2 - canvas.top) / (sy * cam.zoom) };
  }

  /** The picker cards wiggle (the picker's "show me"). */
  private pulseCards(): void {
    if (motion.reduced) return;
    this.overlay?.querySelectorAll<HTMLElement>('[data-scenario]').forEach((c, i) => c.animate?.([{ transform: 'scale(1)' }, { transform: 'scale(1.08)' }, { transform: 'scale(1)' }], { duration: 420, delay: i * 180 }));
  }

  // ================================================================ playing together (one device)

  private async togetherPressed(): Promise<void> {
    if (this.together) {
      void this.host('togetherEnd');
      const pick = await this.dialog(
        [
          { id: 'alone', icon: 'hand', label: 'Play on my own' },
          { id: 'keep', icon: 'together', label: 'Keep playing together' },
        ],
        'keep',
      );
      if (pick === 'alone') this.endTogether();
      return;
    }
    void this.host('togetherPick');
    const others = services.save.listProfiles().filter((p) => p.id !== services.profileId);
    const pick = await this.dialog(
      [
        ...others.slice(0, 3).map((o) => ({ id: o.id, icon: 'together', label: displayName(o), art: faceOf(o) })),
        { id: 'friend', icon: 'together', label: 'A friend' },
        { id: 'cancel', icon: 'back', label: 'Not now', kind: 'go' as const },
      ],
      'cancel',
    );
    if (pick === 'cancel' || !this.alive()) return;
    const other = others.find((o) => o.id === pick);
    const me = currentProfile();
    this.together = {
      players: { chef: { name: displayName(me), face: faceOf(me) }, server: other ? { name: displayName(other), face: faceOf(other) } : { name: 'Friend', face: rigSvg(avatarRig('mouse', 'leaf'), { crop: 'head' }) } },
      turn: 'chef',
    };
    this.updateTopBar();
    this.showTurn();
    await this.host('togetherRoles');
    await this.host('chefTurn');
    void this.guide(true);
  }

  private endTogether(): void {
    this.together = null;
    services.hud.setTurnBadge(null);
    this.updateTopBar();
  }

  private showTurn(): void {
    const t = this.together;
    if (!t) return;
    const who = t.players[t.turn];
    services.hud.setTurnBadge({ face: who.face, label: `${t.turn === 'chef' ? 'Chef' : 'Server'}: ${who.name}` });
  }

  /** In sibling mode, is it this job's turn? (Always true when playing alone.) */
  private allowed(role: Role): boolean {
    const t = this.together;
    if (!t || t.turn === role) return true;
    if (t.players[t.turn].npc) return false;
    audio.play('bonk', { pitch: 1.4 });
    void this.host('waitTurn');
    const badge = document.querySelector('.turn-badge') as HTMLElement | null;
    badge?.animate?.([{ transform: 'scale(1)' }, { transform: 'scale(1.15)' }, { transform: 'scale(1)' }], { duration: 400 });
    return false;
  }

  private async passTurn(to: Role): Promise<void> {
    const t = this.together;
    if (!t || !this.st) return;
    // nothing to carry? then it's the chef's turn again
    if (to === 'server' && !this.st.tray.length) to = 'chef';
    if (to === 'chef' && this.st.tray.length >= TRAY_SLOTS) to = 'server';
    if (t.turn === to) return;
    t.turn = to;
    this.showTurn();
    this.lastGuide = '';
    if (t.players[to].npc) this.time.delayedCall(900, () => void this.npcTurn());
    else await this.host(to === 'chef' ? 'chefTurn' : 'serverTurn');
  }

  private swapJobs(): void {
    const t = this.together;
    if (!t) return;
    const c = t.players.chef;
    t.players.chef = t.players.server;
    t.players.server = c;
    audio.play('zip');
    this.showTurn();
    void this.host('swapped');
    if (t.players[t.turn].npc) this.time.delayedCall(900, () => void this.npcTurn());
  }

  /** One player stopped: a friend takes over their job so the picnic carries on. */
  private async helperLeft(): Promise<void> {
    const t = this.together;
    if (!t) return;
    void this.host('whoStays');
    const pick = await this.dialog(
      [
        { id: 'chef', icon: 'hand', label: t.players.chef.name, art: t.players.chef.face },
        { id: 'server', icon: 'hand', label: t.players.server.name, art: t.players.server.face },
      ],
      'chef',
    );
    if (!this.alive() || !this.together) return;
    // the one who is still playing keeps their job; the helper takes the other
    const leaving: Role = pick === 'chef' ? 'server' : 'chef';
    const helper = this.def.helper;
    t.players[leaving] = { name: CAST_NAME[helper], face: rigSvg(CAST_RIGS[helper], { crop: 'head' }), npc: helper };
    this.showTurn();
    let hp = this.puppets.get(helper);
    if (!hp) {
      hp = new Puppet(this, 2100, HELPER.y, CAST_RIGS[helper], { seed: 90 });
      hp.setDepth(D.guest + 1).setScale(GUEST_SCALE);
      this.puppets.set(helper, hp);
      await this.walk(hp, HELPER.x, HELPER.y);
    }
    await say(helper, HELPER_LINES.takeOver.text, { puppet: hp, expression: HELPER_LINES.takeOver.mood });
    if (t.players[t.turn].npc) void this.npcTurn();
  }

  private async npcTurn(): Promise<void> {
    const t = this.together;
    const s = this.st;
    if (!t || !s || this.helperBusy || s.phase !== 'cook') return;
    const helper = t.players[t.turn].npc;
    if (!helper) return;
    const hp = this.puppets.get(helper);
    this.helperBusy = true;
    try {
      if (t.turn === 'server') {
        const d = s.tray[0];
        if (!d) return void (await this.passTurn('chef'));
        const to = whoWants(s, d);
        if (!to) {
          await say(helper, NOBODY_LINE, { puppet: hp });
          return void (await this.passTurn('chef'));
        }
        await say(helper, carryLine(to), { puppet: hp });
        this.selected = d.id;
        await this.serveTo(d.id, to);
        return;
      }
      // chef: the child picks what the helper makes; the helper makes it for someone who wants one
      await say(helper, HELPER_LINES.cook.text, { puppet: hp, expression: HELPER_LINES.cook.mood });
      const pick = (await this.ask([
        { id: 'cookie', icon: 'star', label: 'A cookie', art: pieceSvg('pc.ic.cookie') },
        { id: 'sandwich', icon: 'star', label: 'A sandwich', art: pieceSvg('pc.ic.sandwich') },
        { id: 'juice', icon: 'star', label: 'Some juice', art: pieceSvg('pc.ic.juice') },
      ])) as Dish['kind'] | null;
      if (!pick || !this.alive() || !this.st) return;
      const want = guestsOf(this.st).find((g) => !this.st!.happy[g.id] && wishOf(this.st!, g.id)?.kind === pick);
      const base = exampleDish(want ? wishOf(this.st, want.id)! : { kind: pick });
      if (hp) void hp.play('pump');
      audio.play(pick === 'juice' ? 'whirr' : 'squish');
      await this.wait(900);
      const { id: _id, ...rest } = base;
      void _id;
      await this.deliver(rest, { x: HELPER.x, y: HELPER.y - 120 });
    } finally {
      this.helperBusy = false;
    }
  }

  // ================================================================ hints, talk, helpers

  /** The help hand shows the next step (the same thing the marker points at). */
  private demo(): void {
    const s = this.st;
    if (!s || this.overlay || this.busy) return;
    if (s.phase === 'parade') {
      if (this.takePhoto) void this.hand.tapAt(CAMERA.x, CAMERA.y, 2);
      return;
    }
    if (s.phase === 'cook') {
      const step = this.cookStep();
      if (step.k === 'station') return this.station?.demo();
      if (step.k === 'tab') {
        const tab = this.topBar?.querySelector(`[data-station="${step.station}"]`) as HTMLElement | null;
        if (tab && !tab.hidden) {
          const at = this.clientToWorld(tab);
          void this.hand.tapAt(at.x, at.y + 70, 2);
        }
        return;
      }
    }
    const id = this.beaconTarget();
    const t = id ? this.targets.get(id) : undefined;
    if (!t) return;
    const r = t.bounds();
    void this.hand.tapAt(r.centerX, r.centerY, 2);
  }

  /** The next thing to tap, for the bobbing marker: one clear target per step. */
  protected override beaconTarget(): string | null {
    const s = this.st;
    if (!s || this.busy || this.overlay || this.closeShelf) return null;
    if (this.together && this.together.players[this.together.turn].npc) return null;
    if (s.phase === 'setup') {
      if (s.scenario === 'windy') {
        if (this.heldWeight) {
          const c = looseCorners(s).find((x) => !s.weights[x]);
          return c === undefined ? null : `corner-${c}`;
        }
        // the marker suggests something heavy; light things can still be tried (they blow away)
        const heavy = [...this.weightImgs.keys()].find((w) => WEIGHTS[w].heavy);
        return heavy ? `weight-${heavy}` : null;
      }
      if (s.scenario === 'music') {
        const id = this.seatFocus();
        return id ? `cushion-${this.seatFor(id)}` : null;
      }
      return s.lanterns < LANTERN_SLOTS ? `lantern-${s.lanterns}` : null;
    }
    if (s.phase === 'parade') return this.takePhoto ? 'camera' : null;
    if (s.phase !== 'cook') return null;
    if (this.station?.isBusy) return null;
    const step = this.cookStep();
    if (step.k === 'bell') return 'bell';
    if (step.k === 'give') return step.to ? `guest-${step.to}` : 'avatar';
    if (step.k === 'station') return this.station?.beacon() ?? null;
    return null; // a kitchen button: the arrow under it shows the way
  }

  /** A tap on nothing still answers: a little puff, and the hand shows what to tap. */
  protected override onGroundTap(x: number, y: number): void {
    if (!this.st || this.busy || this.overlay) return;
    audio.play('tap', { vol: 0.4 });
    dust(this, x, y, 3, D.fx);
    if (this.time.now - this.groundHintAt < 3500 || this.hand.busy) return;
    this.groundHintAt = this.time.now;
    this.demo();
  }

  override hint(): void {
    this.hints.request();
  }

  protected override onArrow(dx: number, _dy: number, down: boolean): void {
    if (down && dx) this.station?.onArrow(dx);
  }

  private hostPuppet(): Puppet | undefined {
    return this.puppets.get(this.def?.host ?? 'rowan');
  }

  /**
   * The host speaks. Instructions (the step to do now) wait for any reaction
   * that's still being said, so no line is cut off halfway.
   */
  private async host(id: HostLineId, asInstruction = false, still?: () => boolean): Promise<void> {
    const l = HOST_LINES[id];
    const speaker: Speaker = this.def?.host ?? 'rowan';
    const puppet = this.hostPuppet();
    if (!asInstruction) return this.react(say(speaker, l.text, { puppet, expression: l.mood }));
    await this.untilQuiet();
    // the child already did it while someone was talking: no need to say it
    if (!this.alive() || (still && !still())) return;
    return instruct(speaker, l.text, () => this.demo(), { puppet, expression: l.mood });
  }

  private guestSay(id: CastId | 'avatar', text: string, mood?: GuestLineMood): Promise<void> {
    const puppet = id === 'avatar' ? this.avatar : this.puppets.get(id);
    return this.react(say(id, text, { puppet, expression: mood }));
  }

  private async react(line: Promise<void>): Promise<void> {
    this.reacting++;
    try {
      await line;
    } finally {
      this.reacting--;
    }
  }

  private async untilQuiet(max = 4000): Promise<void> {
    const t0 = Date.now();
    while (this.reacting > 0 && Date.now() - t0 < max) await new Promise((r) => setTimeout(r, 100));
  }

  /** Choices sit at the top, clear of the kitchen, the tray and the friends' feet. The question is always said first. */
  private ask(options: ChoiceOption[]): Promise<string | null> {
    return services.choices.ask(options, { readAloud: true, at: 'top' });
  }

  private dialog(buttons: { id: string; icon: string; label: string; art?: string; kind?: 'go' | 'danger' | 'primary' | '' }[], safeId: string): Promise<string> {
    return iconDialog(services.layers.overlay, { buttons, safeId });
  }

  private note(id: 'wind'): void {
    const key = `note:picnic-${id}`;
    if (currentProfile().progress.done[key]) return;
    updateProfile((p) => (p.progress.done[key] = 1));
    toast(services.layers.toast, 'explore', 'Real world: heavy things are harder for wind to move.', 5000);
  }

  private walk(p: Puppet, x: number, y: number): Promise<void> {
    return new Promise((resolve) => {
      if (!p.active) return resolve();
      const dist = Math.hypot(x - p.x, y - p.y);
      if (dist < 8) return resolve();
      p.faceToward(x);
      p.startGait();
      const id = [...this.puppets.entries()].find(([, v]) => v === p)?.[0];
      this.tweens.add({
        targets: p,
        x,
        y,
        duration: motion.reduced ? 200 : Math.max(300, dist * 2.2),
        ease: 'Sine.easeInOut',
        onUpdate: () => id && this.placeBubble(id),
        onComplete: () => {
          p.stopGait();
          if (id) this.placeBubble(id);
          resolve();
        },
      });
    });
  }

  private tweenP(cfg: Phaser.Types.Tweens.TweenBuilderConfig): Promise<void> {
    return new Promise((r) => {
      if (motion.reduced) cfg.duration = Math.min(Number(cfg.duration ?? 200), 160);
      this.tweens.add({ ...cfg, onComplete: () => r() });
    });
  }

  private wait(ms: number): Promise<void> {
    return new Promise((r) => this.time.delayedCall(ms, r));
  }

  private alive(): boolean {
    return this.sys.isActive() || this.sys.isPaused();
  }

  override inspect(): Record<string, unknown> {
    const s = this.st;
    return {
      scenario: s?.scenario ?? null,
      phase: s?.phase ?? 'picker',
      preset: this.preset,
      station: this.station?.id ?? null,
      step: this.station?.step ?? null,
      tray: s?.tray.map((d) => describe(d)) ?? [],
      trayIds: s?.tray.map((d) => d.id) ?? [],
      selected: this.selected,
      happy: s?.happy ?? {},
      wishes: s?.wishes ?? {},
      mine: s?.mine ? describe(s.mine) : null,
      seats: s?.seats ?? {},
      weights: s?.weights ?? [],
      windbreak: s?.windbreak ?? null,
      cutter: s?.cutter ?? null,
      cutterQueue: s?.cutterQueue ?? [],
      drum: s?.drum ?? null,
      lanterns: s?.lanterns ?? 0,
      mossInvited: s?.mossInvited ?? false,
      mossJoined: s?.mossJoined ?? false,
      mixup: s?.mixup ?? null,
      helping: s?.helping ?? false,
      busy: this.busy,
      beacon: this.ready ? this.beaconTarget() : null,
      guide: this.lastGuide,
      tabs: this.visibleStations(),
      marked: this.tabMarkKey,
      beaconShown: (this as unknown as { beaconRing?: Phaser.GameObjects.Image }).beaconRing?.visible ?? null,
      beaconAt: (() => { const r = (this as unknown as { beaconRing?: Phaser.GameObjects.Image }).beaconRing; return r ? [Math.round(r.x), Math.round(r.y), r.alpha, r.depth] : null; })(),
      together: this.together ? { turn: this.together.turn, chef: this.together.players.chef.name, server: this.together.players.server.name, npc: this.together.players[this.together.turn].npc ?? null } : null,
      overlay: !!this.overlay,
      puppets: Object.fromEntries([...this.puppets].map(([id, p]) => [id, { x: Math.round(p.x), y: Math.round(p.y), visible: p.visible, alpha: p.alpha, depth: p.depth, scale: p.scaleX }])),
    };
  }
}

type GuestLineMood = Parameters<typeof say>[2] extends infer O ? (O extends { expression?: infer E } ? E : never) : never;

/** A short plain description of a dish (activity notes and the inspector). */
export function describe(d: Dish): string {
  if (d.kind === 'cookie') return `${d.share ? 'big ' : ''}${d.texture ?? ''} ${d.shape ?? ''} cookie${d.deco.length ? ' with toppings' : ''}`.replace(/\s+/g, ' ').trim();
  if (d.kind === 'sandwich') return `${(d.layers?.length ?? 0) >= 3 ? 'big' : 'small'} sandwich (${(d.layers ?? []).map((l) => l.f).join(', ') || 'just bread'})`;
  return `${d.cup ?? 'small'} ${(d.fruits ?? []).join(' and ')} juice`;
}

function faceOf(p: Profile): string {
  return rigSvg(avatarRig(p.avatar.species, p.avatar.color), { crop: 'head', hat: p.avatar.hat });
}

export type { GuestLineId };
