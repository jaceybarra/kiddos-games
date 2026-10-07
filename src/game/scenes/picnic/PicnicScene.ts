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
import { exampleDish, type Dish, type Shape } from '../../../content/picnic/food';
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
  GUEST_LINES,
  HOST_LINES,
  NOBODY_LINE,
  SHARED_LINE,
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
const STATION_TABS: { id: Station; art: string; label: string }[] = [
  { id: 'dough', art: 'pc.ic.cookie', label: 'Make cookies' },
  { id: 'stack', art: 'pc.ic.sandwich', label: 'Make a sandwich' },
  { id: 'juice', art: 'pc.ic.juice', label: 'Make juice' },
  { id: 'decorate', art: 'pc.ic.decorate', label: 'Decorate' },
];

type Role = 'chef' | 'server';
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
    this.addTarget({ id: 'avatar', label: 'You', bounds: () => this.rectAround(AVATAR.x, AVATAR.y - 80, 140, 180, 10), enabled: () => this.st?.phase === 'cook', activate: () => void this.onAvatar() });
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
    this.hints = new Hints(this, this.preset, () => this.demo());
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
    this.drumTimer?.remove();
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
    this.mineView?.destroy();
    this.mineView = undefined;
    for (const v of this.trayViews) v.destroy();
    this.trayViews = [];
    this.selected = null;
    this.selRing?.destroy();
    this.selRing = undefined;
    this.bell = undefined;
    this.windbreakImg = undefined;
    this.heldWeight = null;
    this.seatGuestSel = null;
    this.biteAsked = false;
    this.mossAsks = 0;
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
      this.sTarget({ id: 'host', label: CAST_NAME[def.host], bounds: () => this.rectAround(DRUM_X, 740, 150, 220, 6), enabled: () => this.st?.phase === 'cook', activate: () => void this.talkHost() });
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
    else if (s.phase === 'setup') this.enterSetup(false);
    else this.enterCook(false);
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
    this.sTarget({
      id: `guest-${id}`,
      label: CAST_NAME[id],
      bounds: () => this.rectAround(p.x, p.y - 100, 124, 150, 8),
      enabled: () => !!this.st && (this.st.phase === 'cook' || (this.st.phase === 'setup' && this.st.scenario === 'music')),
      activate: () => void this.onGuest(id),
    });
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
    this.sTarget({ id: 'moss-tree', label: 'Moss, watching fireflies', bounds: () => this.rectAround(MOSS_TREE.x, MOSS_TREE.y - 70, 130, 160, 6), enabled: () => !!this.st && !this.st.mossJoined && (this.st.phase === 'cook' || this.st.phase === 'setup'), activate: () => void this.talkMoss() });
  }

  private async runIntro(): Promise<void> {
    const s = this.st!;
    this.busy = true;
    const introLine: Record<ScenarioId, HostLineId> = { windy: 'windyIntro', music: 'musicIntro', lantern: 'lanternIntro' };
    // friends walk in from the right
    const arrivals = [...this.puppets.entries()].filter(([id]) => guestsOf(s).some((g) => g.id === id));
    for (const [id, p] of arrivals) {
      const tx = p.x;
      p.x = 2120;
      this.bubbles.get(id)?.setVisible(false);
      void this.walk(p, tx, p.y);
    }
    await this.host(introLine[s.scenario]);
    if (!this.alive()) return;
    for (const g of guestsOf(s)) {
      const b = this.bubbles.get(g.id);
      if (!b) continue;
      this.placeBubble(g.id);
      b.setVisible(true).setScale(0.2);
      audio.play('pop');
      this.tweens.add({ targets: b, scale: 1, duration: 280, ease: 'Back.easeOut' });
      await this.guestSay(g.id, WISH_LINES[s.scenario][g.id]?.[s.preset] ?? '');
      if (!this.alive()) return;
    }
    s.phase = 'setup';
    this.commit();
    this.busy = false;
    this.enterSetup(true);
  }

  private enterSetup(speak: boolean): void {
    const s = this.st!;
    if (s.scenario === 'windy') {
      if (cornersHeld(s)) void this.chooseWindbreak();
      else {
        this.showWeights();
        if (speak) void this.host('windyWeights', true);
      }
    } else if (s.scenario === 'music') {
      if (allSeated(s)) void this.seatsDone();
      else if (speak) void this.host('musicSeats', true);
    } else if (s.scenario === 'lantern') {
      if (s.lanterns >= LANTERN_SLOTS) void this.lanternsDone();
      else if (speak) void this.host('lanternHang', true);
    }
  }

  private enterCook(speak: boolean): void {
    const s = this.st!;
    if (s.phase !== 'cook' && s.phase !== 'parade') s.phase = 'cook';
    if (s.phase === 'parade') s.phase = 'cook';
    this.commit();
    this.updateTopBar();
    this.updateBell();
    if (s.scenario === 'music') this.startDrum();
    if (s.scenario === 'windy') this.startGusts();
    if (speak) void this.host('pickStation', true);
    this.glowTabs(true);
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
      this.sTarget({ id: `corner-${c}`, label: 'Blanket corner', bounds: () => this.rectAround(at.x, at.y - 20, 120, 100, 10), enabled: () => this.st?.phase === 'setup' && !this.st.weights[c] && !!this.heldWeight && !this.busy, activate: () => void this.dropWeight(c) });
    }
    if (s.windbreak) void this.showWindbreak(s.windbreak, false);
  }

  private showWeights(): void {
    const s = this.st!;
    if (this.weightImgs.size || cornersHeld(s)) return;
    {
      WEIGHT_CHOICES[s.preset].forEach((w, i) => {
        const at = WEIGHT_SPOTS[i];
        const im = this.keep(addImage(this, at.x, at.y, `pc.w.${w}`).setDepth(D.station + 1));
        this.weightImgs.set(w, im);
        this.sTarget({ id: `weight-${w}`, label: w, bounds: () => this.rectAround(at.x, at.y - 10, 120, 90, 10), enabled: () => this.st?.phase === 'setup' && this.weightImgs.has(w) && !this.busy, activate: () => this.pickWeight(w) });
      });
    }
  }

  private pickWeight(w: WeightId): void {
    this.hints.poke();
    this.heldWeight = w;
    audio.play('pickup');
    for (const [k, im] of this.weightImgs) {
      this.tweens.killTweensOf(im);
      im.setScale(k === w ? 1.2 : 1);
    }
    const im = this.weightImgs.get(w)!;
    if (!motion.reduced) this.tweens.add({ targets: im, y: im.y - 10, duration: 400, yoyo: true, repeat: -1 });
  }

  private async dropWeight(c: number): Promise<void> {
    const s = this.st!;
    const w = this.heldWeight;
    if (!w) return;
    this.hints.poke();
    this.busy = true;
    this.heldWeight = null;
    const im = this.weightImgs.get(w)!;
    const home = { x: im.x, y: im.y };
    this.tweens.killTweensOf(im);
    im.setScale(1).setDepth(D.fx);
    const at = CORNERS[c];
    await this.tweenP({ targets: im, x: at.x, y: at.y - 10, scale: 0.8, duration: 420, ease: 'Quad.easeInOut' });
    const r = placeWeight(s, c, w);
    if (r.held) {
      this.st = r.s;
      audio.play('thud');
      dust(this, at.x, at.y, 6, D.fx);
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
      if (cornersHeld(this.st)) void this.chooseWindbreak();
      return;
    }
    // too light: whoosh, off it goes, then it drifts back to the table
    audio.play('whoosh');
    const curl = this.keep(addImage(this, at.x + 120, at.y - 60, 'pc.windcurl').setDepth(D.fx));
    void this.tweenP({ targets: curl, x: at.x - 300, alpha: 0, duration: 700 }).then(() => curl.destroy());
    await this.tweenP({ targets: im, x: at.x - 420, y: at.y - 380, angle: -200, duration: 700, ease: 'Sine.easeOut' });
    void this.host('windyBlown');
    this.note('wind');
    await this.tweenP({ targets: im, x: home.x, y: home.y, angle: 0, scale: 1, duration: 1100, ease: 'Bounce.easeOut' });
    im.setDepth(D.station + 1);
    this.busy = false;
  }

  private async chooseWindbreak(): Promise<void> {
    const s = this.st!;
    if (s.windbreak) return this.windyReady();
    for (const im of this.weightImgs.values()) im.destroy();
    this.weightImgs.clear();
    await this.host('windyBreak');
    if (!this.alive()) return;
    const art: Record<string, string> = { umbrella: pieceSvg('pc.umbrella'), cushions: pieceSvg('pc.cushwall'), moss: rigSvg(CAST_RIGS.moss, { crop: 'head' }) };
    const labels: Record<string, string> = { umbrella: 'A big umbrella', cushions: 'A wall of cushions', moss: 'Ask Moss' };
    const pick = (await this.ask(WINDBREAKS[s.preset].map((id) => ({ id, icon: 'star', label: labels[id], art: art[id] })))) as 'umbrella' | 'cushions' | 'moss' | null;
    if (!pick || !this.alive()) return;
    this.st = setWindbreak(this.st!, pick);
    this.commit();
    await this.showWindbreak(pick, true);
    this.windyReady();
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
      await this.wait(400);
      setPiece(im, 'pc.umbrella.flip');
      audio.play('boing');
      await this.host('umbrellaFlip');
      const rowan = this.puppets.get('rowan');
      if (rowan) {
        void rowan.play('jump');
        await this.guestSay('rowan', GUEST_LINES['rowan.holdUmbrella'].text);
      }
      setPiece(im, 'pc.umbrella');
      audio.play('snap');
    } else {
      await this.host('cushionsWork');
    }
  }

  private windyReady(): void {
    const s = this.st!;
    if (s.phase !== 'setup') return;
    void this.host('windyReady');
    this.enterCook(false);
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
    const s = this.st!;
    const seats = seatsFor('music');
    // how loud each spot is: rings spreading from the drum
    const g = this.keep(this.add.graphics().setDepth(D.setup - 1));
    for (let r = 1; r <= 3; r++) {
      g.lineStyle(10, hex(P.sun), 0.32 - r * 0.07);
      g.strokeEllipse(DRUM_X - 60, 860, r * 300, r * 110);
    }
    seats.forEach((seat, i) => {
      this.keep(addImage(this, seat.x, seat.y + 6, `pc.cushion.${i % 5}`).setDepth(D.setup));
      if (seat.loud !== 1) this.keep(addImage(this, seat.x, seat.y + 50, seat.loud === 0 ? 'pc.wi.quiet' : 'pc.wi.music').setDepth(D.setup + 1).setScale(0.6));
      this.sTarget({ id: `cushion-${i}`, label: seat.loud === 0 ? 'Quiet cushion' : seat.loud === 2 ? 'Cushion by the music' : 'Cushion', bounds: () => this.rectAround(seat.x, seat.y, 160, 80, 12), enabled: () => this.st?.phase === 'setup' && !this.busy, activate: () => void this.chooseSeat(i) });
    });
    void s;
  }

  private selectSeatGuest(id: CastId): void {
    this.hints.poke();
    this.seatGuestSel = id;
    audio.play('pickup');
    const p = this.puppets.get(id)!;
    void p.play('hop');
  }

  private async chooseSeat(seat: number): Promise<void> {
    const s = this.st!;
    let id = this.seatGuestSel;
    if (!id) {
      if (this.preset === 'more-help') id = guestsOf(s).find((g) => s.seats[g.id] === undefined)?.id ?? null;
      if (!id) {
        void this.host('musicSeats', true);
        return;
      }
    }
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
      if (now === undefined || now === before[g.id]) continue;
      const p = this.puppets.get(g.id)!;
      const at = spots[now];
      moves.push(this.walk(p, at.x, at.y).then(() => void p.setFacing(at.x > 1500 ? -1 : 1)));
      const plate = this.plateImgs.get(g.id);
      plate?.setPosition(at.x + 64, at.y + 30).setVisible(true);
      this.plateViews.get(g.id)?.setPosition(at.x + 64, at.y + 28);
    }
    await Promise.all(moves);
    audio.play('squish', { pitch: 1.2 });
    this.busy = false;
    if (allSeated(this.st)) void this.seatsDone();
  }

  private async seatsDone(): Promise<void> {
    const s = this.st!;
    if (s.phase !== 'setup') return;
    await this.host('musicSeated');
    if (!this.alive()) return;
    this.enterCook(false);
    await this.wait(1200);
    await this.checkSeats();
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
      if (s.drum === 'loud') for (let i = 0; i < 2; i++) {
        const n = this.keep(addImage(this, DRUM_X - 80, 760, 'pc.note').setDepth(D.fx));
        this.tweens.add({ targets: n, x: n.x - 120 - i * 80, y: n.y - 140, alpha: 0, duration: 1600, delay: i * 200, onComplete: () => n.destroy() });
      }
    };
    beat();
    this.drumTimer = this.time.addEvent({ delay: 5200, loop: true, callback: beat });
  }

  /** After the first song: does everyone's seat suit what they said? */
  private async checkSeats(): Promise<void> {
    const s = this.st!;
    if (guestDef(s, 'luma')?.seat === 'quiet') {
      if (seatSuits(s, 'luma')) await this.guestSay('luma', GUEST_LINES['luma.quietOk'].text, 'calm');
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
        await this.guestSay('rowan', GUEST_LINES['rowan.loudOk'].text, 'excited');
      } else if (pick === 'stay') await this.guestSay('rowan', GUEST_LINES['rowan.hum'].text);
    } else if (rowanSeat !== undefined) await this.guestSay('rowan', GUEST_LINES['rowan.loudOk'].text, 'excited');
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
      const lit = i < s.lanterns;
      if (lit) this.hangLanternArt(i, false);
      this.sTarget({ id: `lantern-${i}`, label: 'Hang a lantern', bounds: () => this.rectAround(x, LANTERN_Y, 110, 130, 10), enabled: () => this.st?.phase === 'setup' && this.st.lanterns === i && !this.busy, activate: () => void this.hang(i) });
    });
  }

  private hangLanternArt(i: number, animate: boolean): void {
    const x = LANTERN_X[i];
    const glow = this.keep(addImage(this, x, LANTERN_Y + 10, 'pc.glow').setDepth(D.tree + 1.5).setAlpha(animate ? 0 : 0.9));
    const l = this.keep(addImage(this, x, animate ? LANTERN_Y - 200 : LANTERN_Y, 'pc.lantern.on').setDepth(D.tree + 2));
    if (animate) {
      this.tweens.add({ targets: l, y: LANTERN_Y, duration: 500, ease: 'Bounce.easeOut' });
      this.tweens.add({ targets: glow, alpha: 0.9, duration: 600, delay: 400 });
    }
    if (!motion.reduced) this.tweens.add({ targets: l, angle: { from: -4, to: 4 }, duration: 1600 + i * 200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  private async hang(i: number): Promise<void> {
    this.hints.poke();
    this.busy = true;
    this.st = hangLantern(this.st!);
    this.commit();
    audio.play('glow');
    this.hangLanternArt(i, true);
    await this.wait(500);
    sparkle(this, LANTERN_X[i], LANTERN_Y, 8, D.fx);
    this.busy = false;
    if (this.st.lanterns >= LANTERN_SLOTS) void this.lanternsDone();
  }

  private async lanternsDone(): Promise<void> {
    if (this.st?.phase !== 'setup') return;
    await this.host('lanternLit');
    if (!this.alive()) return;
    this.enterCook(false);
  }

  private async talkMoss(): Promise<void> {
    const s = this.st!;
    this.hints.poke();
    const pick = await this.ask([
      { id: 'invite', icon: 'together', label: '“Want to join our picnic?”' },
      { id: 'wave', icon: 'wave', label: 'Wave' },
      { id: 'leave', icon: 'notnow', label: 'Leave Moss be' },
    ]);
    if (!pick || !this.alive()) return;
    const m = this.puppets.get('moss');
    if (pick === 'invite') {
      this.st = { ...s, mossInvited: true };
      this.commit();
      void this.avatar.play('wave');
      await this.guestSay('moss', this.mossAsks++ === 0 ? GUEST_LINES['moss.notYet'].text : GUEST_LINES['moss.stillWatching'].text, 'calm');
    } else if (pick === 'wave') {
      void this.avatar.play('wave');
      if (m) await m.play('wave');
    }
  }

  /** Moss was invited earlier and is ready now (after someone's been served). */
  private async mossReady(): Promise<void> {
    const s = this.st!;
    if (s.scenario !== 'lantern' || !s.mossInvited || s.mossJoined) return;
    await this.guestSay('moss', GUEST_LINES['moss.ready'].text, 'happy');
    const pick = await this.ask([
      { id: 'yes', icon: 'yes', label: '“Yes! Sit with us!”' },
      { id: 'me', icon: 'heart', label: '“Sit next to me!”' },
    ]);
    if (!this.alive()) return;
    void pick;
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
    this.sTarget({ id: 'guest-moss', label: 'Moss', bounds: () => this.rectAround(m.x, m.y - 80, 140, 180, 8), enabled: () => this.st?.phase === 'cook', activate: () => void this.onGuest('moss') });
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
      void this.guestSay('fizz', GUEST_LINES['fizz.together'].text, 'excited');
      void this.puppets.get('luma')?.play('clap');
      void this.puppets.get('fizz')?.play('clap');
    } else if (res.forGuest) {
      const next = this.st.cutterQueue[0];
      if (next === 'luma') this.time.delayedCall(2600, () => void this.guestSay('luma', GUEST_LINES['luma.turnNext'].text));
      if (next === 'fizz') this.time.delayedCall(2600, () => void this.guestSay('fizz', GUEST_LINES['fizz.turnNext'].text, 'silly'));
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
    const labels = { turns: 'Take turns', together: 'Make one together', swap: 'Offer Fizz a different cutter', mine: '“I’d like a turn too!”' };
    const icons = { turns: 'turn', together: 'together', swap: 'swap', mine: 'raisehand' };
    const pick = (await this.ask(CUTTER_OPTIONS[this.preset].map((id) => ({ id, icon: icons[id], label: labels[id] })))) as keyof typeof labels | null;
    if (!pick || !this.alive()) return;
    this.st = applyCutter(this.st!, pick);
    if (pick === 'turns') await this.guestSay('fizz', GUEST_LINES['fizz.wait'].text, 'silly');
    if (pick === 'together') await this.guestSay('luma', GUEST_LINES['luma.together'].text, 'excited');
    if (pick === 'mine') await this.guestSay('luma', GUEST_LINES['luma.youFirst'].text, 'happy');
    if (pick === 'swap') {
      const others = this.def.cutters[this.preset].filter((x) => x !== 'lantern');
      let tries = others;
      for (let i = 0; i < others.length; i++) {
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
      host: (line) => this.host(line, true),
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
    };
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
    if (services.choices.open || this.overlay) {
      audio.play('bonk', { pitch: 1.4 });
      return;
    }
    if (!this.allowed('chef')) return;
    this.glowTabs(false);
    if (this.station?.id === id) return;
    this.closeStation();
    const host = this.stationHost();
    this.station = id === 'dough' ? new DoughStation(host) : id === 'stack' ? new StackStation(host) : id === 'juice' ? new JuiceStation(host) : new DecorateStation(host);
    this.station.open();
    audio.play('open');
    if (id === 'decorate' && this.selected) {
      const d = s.tray.find((x) => x.id === this.selected);
      if (d) (this.station as DecorateStation).setDish(d);
    }
    this.updateTopBar();
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
    this.renderTray();
    audio.play('clack');
    const first = !currentProfile().progress.done['picnic:served-once'];
    if (first && slot === 0 && !Object.keys(this.st.happy).length) void this.host('onTray', true);
    this.passTurn('server');
    if (this.st.helping) void this.helperDone();
    else if (this.st.scenario === 'windy' && this.st.mixup === 'none' && Object.keys(this.st.happy).length >= 1) this.time.delayedCall(900, () => void this.mixup());
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
    s.tray.forEach((d, i) => {
      const v = new DishView(this, TRAY_X[i], TRAY.y - 14 - (d.id === this.selected ? 22 : 0), d).setDepth(D.tray + 1).setScale(this.trayScale(d));
      this.trayViews.push(v);
    });
    if (this.selected && !s.tray.some((d) => d.id === this.selected)) this.selected = null;
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

  private onTray(i: number): void {
    const s = this.st!;
    const d = s.tray[i];
    if (!d) return;
    this.hints.poke();
    if (this.station instanceof DecorateStation) {
      if (!this.allowed('chef')) return;
      this.station.flush();
      this.selected = d.id;
      this.renderTray();
      this.station.setDish(this.st!.tray.find((x) => x.id === d.id)!);
      return;
    }
    if (!this.allowed('server')) return;
    this.selected = this.selected === d.id ? null : d.id;
    audio.play(this.selected ? 'pickup' : 'place');
    this.renderTray();
    if (this.selected && !Object.keys(s.happy).length) void this.host('serveHow', true);
  }

  // ================================================================ serving

  private async onGuest(id: CastId): Promise<void> {
    const s = this.st!;
    if (this.busy) return;
    if (s.phase === 'setup' && s.scenario === 'music') {
      this.selectSeatGuest(id);
      return;
    }
    this.hints.poke();
    if (this.selected) {
      if (!this.allowed('server')) return;
      // toppings added but not yet "done" still count
      if (this.station instanceof DecorateStation) this.station.flush();
      await this.serveTo(this.selected, id);
      return;
    }
    const p = this.puppets.get(id);
    if (s.happy[id]) {
      void p?.play('nod');
      await this.guestSay(id, YUM_LINES[id]);
      return;
    }
    const b = this.bubbles.get(id);
    if (b) this.tweens.add({ targets: b, scale: 1.12, duration: 140, yoyo: true });
    await this.guestSay(id, WISH_LINES[s.scenario][id]?.[s.preset] ?? '');
  }

  private async serveTo(dishId: string, id: CastId): Promise<void> {
    const s = this.st!;
    const dish = s.tray.find((d) => d.id === dishId);
    if (!dish) return;
    this.busy = true;
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
        if (r.reaction.type === 'shared') {
          const other = r.reaction.with;
          this.putOnPlate(other, dish);
          this.hideBubble(other);
          void this.puppets.get(other)?.play('cheer');
        }
        this.hideBubble(id);
        void p.play(r.reaction.type === 'flex' ? 'nod' : 'cheer', { expression: 'excited' });
        this.munch(id, dish);
        await this.guestSay(id, r.reaction.type === 'shared' ? SHARED_LINE : r.reaction.type === 'flex' ? FLEX_LINE : YUM_LINES[id], 'excited');
        this.afterServe();
        break;
      }
      case 'full':
        await this.guestSay(id, FULL_LINE, 'happy');
        break;
      case 'notQuite':
      case 'otherKind': {
        const w = wishOf(s, id)!;
        void p.play('think', { expression: 'thinking' });
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
  }

  private async notQuiteChoices(dish: Dish, id: CastId, sameKind: boolean): Promise<void> {
    const s = this.st!;
    const other = whoWants(s, dish, id);
    const opts: ChoiceOption[] = [{ id: 'remake', icon: 'fix', label: 'Make another one' }];
    if (other) opts.push({ id: 'offer', icon: 'together', label: `Offer it to ${CAST_NAME[other]}`, art: rigSvg(CAST_RIGS[other], { crop: 'head' }) });
    opts.push({ id: 'keep', icon: 'heart', label: 'Keep it for me', art: portraitFor('avatar', 'happy') });
    if (this.preset === 'more-exploring' && sameKind) opts.push({ id: 'try', icon: 'ask', label: '“Could you try it?”' });
    const pick = await this.ask(opts);
    if (!this.alive() || !pick) return;
    if (pick === 'remake') {
      this.selected = null;
      const station: Station = dish.kind === 'cookie' ? 'dough' : dish.kind === 'sandwich' ? 'stack' : 'juice';
      this.busy = false;
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
        this.munch(id, dish);
        await this.guestSay(id, TRIED_LINE, 'surprised');
        this.afterServe();
      } else await this.guestSay(id, DECLINE_TRY_LINE, 'calm');
    }
  }

  private afterServe(): void {
    updateProfile((p) => (p.progress.done['picnic:served-once'] = 1));
    this.passTurn('chef');
    sparkle(this, 1500, 700, 6, D.fx);
    if (this.st && allHappy(this.st)) {
      void this.host('picnicTime', true);
      this.bell?.setScale(1.1);
    } else if (this.st?.scenario === 'lantern' && this.st.mossInvited && !this.st.mossJoined) this.time.delayedCall(1800, () => void this.mossReady());
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

  private munch(id: CastId, d: Dish): void {
    const plate = this.plateImgs.get(id);
    const sound = d.kind === 'juice' ? 'pour' : d.texture === 'crunchy' ? 'crunch' : 'squish';
    audio.play(sound, { delay: 0.3 });
    if (plate) dust(this, plate.x, plate.y - 20, 5, D.fx);
    const heart = this.keep(addImage(this, (this.puppets.get(id)?.x ?? 1500) + 40, (this.puppets.get(id)?.y ?? 800) - 200, 'pc.heart').setDepth(D.fx));
    this.tweens.add({ targets: heart, y: heart.y - 80, alpha: 0, duration: 1400, onComplete: () => heart.destroy() });
  }

  private hideBubble(id: CastId): void {
    const b = this.bubbles.get(id);
    if (b) this.tweens.add({ targets: b, scale: 0, duration: 200, onComplete: () => b.setVisible(false) });
  }

  private async onAvatar(): Promise<void> {
    if (this.busy) return;
    this.hints.poke();
    if (this.selected) {
      if (!this.allowed('server')) return;
      if (this.station instanceof DecorateStation) this.station.flush();
      this.busy = true;
      await this.keepMine(this.selected);
      this.busy = false;
      return;
    }
    void this.avatar.play('wave');
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
    this.passTurn('chef');
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
      this.munch('pip', d);
      void this.avatar.play('cheer', { expression: 'excited' });
    }
  }

  private async talkHost(): Promise<void> {
    if (this.busy) return;
    const fz = this.puppets.get(this.def.host);
    void fz?.play('dance');
    await this.guestSay(this.def.host, GUEST_LINES['fizz.drum'].text, 'excited');
  }

  // ---------------------------------------------------------------- the bumped tray (windy picnic)

  private async mixup(): Promise<void> {
    const s = this.st;
    if (!s || s.mixup !== 'none' || !s.tray.length || this.busy || !this.alive()) return;
    this.busy = true;
    this.st = { ...s, mixup: 'pending' };
    this.commit();
    const rowan = this.puppets.get('rowan');
    if (!rowan) {
      this.busy = false;
      return;
    }
    const napkin = this.keep(addImage(this, rowan.x, rowan.y - 120, 'pc.napkin').setDepth(D.fx));
    audio.play('whoosh');
    void this.guestSay('rowan', GUEST_LINES['rowan.napkin'].text, 'surprised');
    const home = { x: rowan.x, y: rowan.y };
    await Promise.all([this.tweenP({ targets: napkin, x: TRAY.x + 60, y: TRAY.y - 120, angle: 360, duration: 900 }), this.walk(rowan, TRAY.x + 220, TRAY.y - 30)]);
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
    const labels = { remake: 'Make it again together', fine: '“It’s okay! Still yummy.”', cross: '“I feel a bit cross.”' };
    const icons = { remake: 'fix', fine: 'yes', cross: 'sorry' };
    const art = { cross: portraitFor('avatar', 'frustrated') } as Record<string, string | undefined>;
    const pick = (await this.ask(MIXUP_OPTIONS[this.preset].map((id) => ({ id, icon: icons[id], label: labels[id], art: art[id] })))) as keyof typeof labels | null;
    if (!this.alive()) return;
    if (pick === 'fine') {
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
      this.sTarget({ id: 'bell', label: 'Ring the picnic bell', bounds: () => this.rectAround(BELL.x, BELL.y - 40, 110, 110, 10), enabled: () => this.st?.phase === 'cook' && !this.busy, activate: () => void this.parade() });
    }
    if (allHappy(s) && !motion.reduced) this.tweens.add({ targets: this.bell, angle: { from: -10, to: 10 }, duration: 240, yoyo: true, repeat: 3 });
  }

  private async parade(): Promise<void> {
    const s = this.st!;
    this.hints.poke();
    this.busy = true;
    audio.play('bell');
    services.choices.cancel();
    this.closeStation();
    this.selected = null;
    this.renderTray();
    this.drumTimer?.remove();
    this.gustTimer?.remove();
    this.st = { ...s, phase: 'parade' };
    this.commit();
    this.glowTabs(false);
    if (!allHappy(this.st)) await this.host('share');
    if (this.st.scenario === 'lantern' && !this.st.mossJoined && this.puppets.get('moss')) {
      await this.guestSay('moss', GUEST_LINES['moss.parade'].text, 'happy');
      const m = this.puppets.get('moss')!;
      await this.walk(m, AVATAR.x - 260, 1000);
      m.setScale(GUEST_SCALE).setDepth(D.guest);
    }
    if (!this.alive()) return;
    // the photo first, while everyone still has their snack
    await this.host('photo');
    const preview = await this.photo();
    if (!this.alive()) return;
    await this.savePicnic(preview);
    // munch!
    for (const [id, v] of this.plateViews) {
      this.tweens.add({ targets: v, scale: 0, duration: 900, delay: 200 });
      this.munch(id, v.dish);
    }
    if (this.mineView) this.tweens.add({ targets: this.mineView, scale: 0, duration: 900 });
    for (const b of this.bubbles.values()) b.setVisible(false);
    await this.wait(1200);
    // parade around the blanket
    audio.startMusic('festival');
    const bunt = this.keep(addImage(this, 1040, -120, 'pc.bunting').setDepth(D.fx - 1).setScale(0.9));
    this.tweens.add({ targets: bunt, y: 190, duration: 700, ease: 'Bounce.easeOut' });
    void this.host('parade');
    const marchers = [...this.puppets.values(), this.avatar];
    if (motion.reduced) {
      await Promise.all(marchers.map((p) => p.play('cheer')));
    } else {
      const homes = marchers.map((p) => ({ x: p.x, y: p.y }));
      await Promise.all(marchers.map((p, i) => this.walk(p, 1180 + i * 130, 960)));
      await Promise.all(marchers.map((p) => p.play('dance')));
      await Promise.all(marchers.map((p, i) => this.walk(p, 1300 + i * 120, 760)));
      await Promise.all(marchers.map((p) => p.play('jump')));
      await Promise.all(marchers.map((p, i) => this.walk(p, homes[i].x, homes[i].y)));
    }
    sparkle(this, 1500, 600, 16, D.fx);
    audio.play('success');
    if (!this.alive()) return;
    this.st = { ...this.st!, phase: 'done' };
    this.commit();
    this.busy = false;
    await this.wait(600);
    audio.startMusic('picnic');
    void this.endChoices();
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
    if (first) void say('rowan', 'Welcome to the picnic meadow! Pick a picnic.', {});
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
      h('button', {
        class: 'tile',
        type: 'button',
        'data-station': t.id,
        'aria-label': t.label,
        'aria-pressed': 'false',
        style: 'width:96px;min-height:84px;padding:4px;flex:none',
        html: `<span class="part-ico">${pieceSvg(t.art)}</span>`,
        on: { click: () => { audio.play('tap'); this.openStation(t.id); } },
      }),
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

  private updateTopBar(): void {
    const bar = this.topBar;
    if (!bar) return;
    for (const b of bar.querySelectorAll<HTMLElement>('[data-station]')) {
      const on = this.station?.id === b.dataset.station;
      b.setAttribute('aria-pressed', String(on));
      b.style.background = on ? '#ffe7a3' : '';
    }
    const cook = this.st?.phase === 'cook';
    for (const b of bar.querySelectorAll<HTMLElement>('[data-station]')) b.style.opacity = cook ? '1' : '0.55';
    (bar.querySelector('[data-swapjobs]') as HTMLElement).hidden = !this.together;
    (bar.querySelector('[data-left]') as HTMLElement).hidden = !this.together;
  }

  private glowTabs(on: boolean): void {
    const bar = this.topBar;
    if (!bar) return;
    for (const b of bar.querySelectorAll<HTMLElement>('[data-station]')) b.classList.toggle('glow', on && this.preset === 'more-help');
  }

  // ================================================================ playing together (one device)

  private async togetherPressed(): Promise<void> {
    if (this.together) {
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
    void this.host('chefTurn');
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

  private passTurn(to: Role): void {
    const t = this.together;
    if (!t || !this.st) return;
    // nothing to carry? then it's the chef's turn again
    if (to === 'server' && !this.st.tray.length) to = 'chef';
    if (to === 'chef' && this.st.tray.length >= TRAY_SLOTS) to = 'server';
    if (t.turn === to) return;
    t.turn = to;
    this.showTurn();
    if (t.players[to].npc) this.time.delayedCall(900, () => void this.npcTurn());
    else void this.host(to === 'chef' ? 'chefTurn' : 'serverTurn');
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
    await say(helper, HOST_LINES.helperTakeOver.text, { puppet: hp });
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
        if (!d) return this.passTurn('chef');
        const to = whoWants(s, d);
        if (!to) {
          await say(helper, NOBODY_LINE, { puppet: hp });
          return this.passTurn('chef');
        }
        await say(helper, carryLine(to), { puppet: hp });
        this.selected = d.id;
        await this.serveTo(d.id, to);
        return;
      }
      // chef: the child picks what the helper makes; the helper makes it for someone who wants one
      await say(helper, HOST_LINES.helperCook.text, { puppet: hp });
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

  private demo(): void {
    const s = this.st;
    if (!s || this.overlay || this.busy) return;
    if (s.phase === 'setup') {
      if (s.scenario === 'windy') {
        if (!this.heldWeight) {
          const heavy = [...this.weightImgs.entries()].find(([w]) => WEIGHTS[w].heavy);
          if (heavy) void this.hand.tapAt(heavy[1].x, heavy[1].y, 2);
        } else {
          const c = looseCorners(s).find((x) => !s.weights[x]);
          if (c !== undefined) void this.hand.tapAt(CORNERS[c].x, CORNERS[c].y - 20, 2);
        }
      } else if (s.scenario === 'music') {
        const g = guestsOf(s).find((x) => s.seats[x.id] === undefined);
        if (g && !this.seatGuestSel) {
          const p = this.puppets.get(g.id)!;
          void this.hand.tapAt(p.x, p.y - 90, 2);
        } else {
          const spots = seatsFor('music');
          const target = g && guestDef(s, g.id)?.seat === 'quiet' ? quietSeat(s) : spots.findIndex((_, i) => !Object.values(s.seats).includes(i));
          const at = spots[Math.max(0, target)];
          void this.hand.tapAt(at.x, at.y, 2);
        }
      } else if (s.scenario === 'lantern') void this.hand.tapAt(LANTERN_X[Math.min(2, s.lanterns)], LANTERN_Y, 2);
      return;
    }
    if (s.phase !== 'cook') return;
    if (allHappy(s) && this.bell) {
      void this.hand.tapAt(BELL.x, BELL.y - 40, 2);
      return;
    }
    if (this.selected) {
      const d = s.tray.find((x) => x.id === this.selected);
      const to = d ? whoWants(s, d) : null;
      const p = to ? this.puppets.get(to) : undefined;
      if (p) void this.hand.tapAt(p.x, p.y - 90, 2);
      else void this.hand.tapAt(AVATAR.x, AVATAR.y - 80, 2);
      return;
    }
    if (s.tray.length && !(this.station instanceof DecorateStation)) {
      const i = s.tray.findIndex((d) => !!whoWants(s, d));
      if (i >= 0) {
        void this.hand.tapAt(TRAY_X[i], TRAY.y - 50, 2);
        return;
      }
    }
    if (this.station) this.station.demo();
    else this.glowTabs(true);
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

  private host(id: HostLineId, asInstruction = false): Promise<void> {
    const l = HOST_LINES[id];
    const speaker: Speaker = this.def?.host ?? 'rowan';
    const puppet = this.hostPuppet();
    return asInstruction ? instruct(speaker, l.text, () => this.demo(), { puppet, expression: l.mood }) : say(speaker, l.text, { puppet, expression: l.mood });
  }

  private guestSay(id: CastId | 'avatar', text: string, mood?: GuestLineMood): Promise<void> {
    const puppet = id === 'avatar' ? this.avatar : this.puppets.get(id);
    return say(id, text, { puppet, expression: mood });
  }

  private ask(options: ChoiceOption[]): Promise<string | null> {
    return services.choices.ask(options, { readAloud: true });
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
      together: this.together ? { turn: this.together.turn, chef: this.together.players.chef.name, server: this.together.players.server.name, npc: this.together.players[this.together.turn].npc ?? null } : null,
      overlay: !!this.overlay,
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
