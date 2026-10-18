import Phaser from 'phaser';
import { app, dur, type GarageData } from '../app/context';
import { decalSwatch, missionCardPicture, paintSwatch, patternSwatch, trackCardPicture, wheelPreview } from '../art/pictures';
import { addImage, ensureArt } from '../art/rasterize';
import { MISSION_ORDER, type DiscoveryId, type MissionId, type RewardId } from '../content/missions';
import { registerSceneForTests } from '../dev/testHooks';
import { chapterComplete, creatorUnlocked, unlockedMissions, nextMission } from '../save/progress';
import { COIN_IDS, DECAL_IDS, DISCOVERY_IDS, PAINT_IDS, PATTERN_IDS, REWARD_IDS, type SaveData, type TruckLook } from '../save/schema';
import { button, h, icon, layer } from '../ui/dom';
import { closeParentSettings, openParentGate, openParentSettings } from '../ui/parent';
import { Fx } from '../view/fx';
import { TruckView } from '../view/TruckView';
import { tweenP, wait } from './util';
import './scenes.css';

/**
 * Bentley's garage. On opening: the closed door with the name on the sign
 * and one big Play. The very first time, the door rolls up and the truck
 * drives straight out into Mission 1. Afterwards the inside: the truck on its
 * turntable to paint and dress up, the shelf of things earned, mission cards
 * and Play. A grown-up gear (behind a hold-to-open gate) sits in the corner.
 * App updates are applied here, never in the middle of a drive.
 */
type Tab = 'paint' | 'pattern' | 'decal' | 'wheel';
const KEYS = ['garage.interior', 'garage.exterior', 'bg.sky'];
const FONT = "ui-rounded, 'SF Pro Rounded', 'Arial Rounded MT Bold', 'Nunito', 'Trebuchet MS', system-ui, sans-serif";

export default class GarageScene extends Phaser.Scene {
  isReady = false;
  private data_!: GarageData;
  private mode: 'exterior' | 'interior' | 'leaving' = 'exterior';
  private ui: HTMLElement[] = [];
  private objs: Phaser.GameObjects.GameObject[] = [];
  private truck: TruckView | null = null;
  private fx!: Fx;
  private tab: Tab | null = null;
  private options: HTMLElement | null = null;
  private saveTimer: Phaser.Time.TimerEvent | null = null;
  private pendingLook: TruckLook | null = null;
  private rolled = 0;
  private dead = false;
  private offs: (() => void)[] = [];

  constructor() {
    super('garage');
  }

  init(data: GarageData): void {
    this.data_ = data ?? { entrance: 'cold' };
    this.dead = false;
    this.isReady = false;
    this.ui = [];
    this.objs = [];
    this.truck = null;
    this.tab = null;
    this.options = null;
    this.offs = [];
  }

  create(): void {
    registerSceneForTests(this);
    this.events.once('shutdown', () => this.cleanup());
    // a waiting app update is applied here: a boundary, never mid-drive
    if (this.data_.entrance !== 'return' && app().updateReady) {
      app().applyUpdate();
      return;
    }
    this.cameras.main.setBackgroundColor('#8fd0f0');
    this.fx = new Fx(this, { reduced: app().reducedMotion(), low: app().lowIntensity() });
    void ensureArt(this.textures, KEYS, 'garage-bg').then(() => {
      if (this.dead) return;
      if (this.data_.entrance === 'return') this.showInterior(true);
      else this.showExterior();
      this.offs.push(app().onSettings(() => this.refreshName()));
      const onResize = () => this.relayout();
      this.scale.on('resize', onResize);
      this.offs.push(() => this.scale.off('resize', onResize));
      this.isReady = true;
    });
  }

  private get save(): SaveData {
    return app().save;
  }

  private clearAll(): void {
    for (const el of this.ui) el.remove();
    this.ui = [];
    this.options?.remove();
    this.options = null;
    for (const o of this.objs) o.destroy();
    this.objs = [];
    this.truck?.destroy();
    this.truck = null;
  }

  private relayout(): void {
    if (this.dead) return;
    if (this.mode === 'exterior') this.showExterior();
    else if (this.mode === 'interior') this.showInterior(false);
  }

  /**
   * The 1920×1080 art is centred horizontally. On taller screens (4:3 iPad) it
   * sits a little above the middle so the floor stays clear of the bottom row
   * of buttons; the extra space is sky/ceiling above and floor/ground below.
   */
  private origin(): { x: number; y: number } {
    return { x: Math.round((this.scale.width - 1920) / 2), y: Math.round(Math.max(0, this.scale.height - 1080) * 0.3) };
  }

  private backdrop(key: string, groundColor: number, ceilingColor?: number): void {
    const W = this.scale.width;
    const H = this.scale.height;
    const o = this.origin();
    const sky = ceilingColor === undefined ? addImage(this, 0, 0, 'bg.sky').setOrigin(0, 0).setDisplaySize(W, H) : this.add.rectangle(0, 0, W, H, ceilingColor).setOrigin(0, 0);
    const ground = this.add.rectangle(0, o.y + 1060, W, Math.max(40, H - o.y - 1060), groundColor).setOrigin(0, 0);
    const art = addImage(this, o.x, o.y, key).setOrigin(0, 0);
    this.objs.push(sky, ground, art);
  }

  private nameText(x: number, y: number, maxW: number): Phaser.GameObjects.Text {
    const name = (this.save.settings.childName || 'Bentley').toUpperCase();
    const t = this.add
      .text(x, y, name, { fontFamily: FONT, fontSize: '92px', fontStyle: 'bold', color: '#3a2618', stroke: '#fff6e6', strokeThickness: 12 })
      .setOrigin(0.5)
      .setName('name-sign');
    if (t.width > maxW) t.setScale(maxW / t.width);
    this.objs.push(t);
    return t;
  }

  private refreshName(): void {
    const t = this.objs.find((o) => o.name === 'name-sign') as Phaser.GameObjects.Text | undefined;
    if (!t) return;
    t.setText((this.save.settings.childName || 'Bentley').toUpperCase()).setScale(1);
    const maxW = this.mode === 'exterior' ? 500 : 520;
    if (t.width > maxW) t.setScale(maxW / t.width);
  }

  private gear(): void {
    const g = button({
      icon: 'gear',
      label: 'Grown-up settings (press and hold to open)',
      size: 'md',
      variant: 'soft',
      testid: 'parent',
      extraClass: 'g-gear g-corner-tl',
      onTap: () => {
        void openParentGate().then((ok) => {
          if (ok && !this.dead) openParentSettings();
        });
      },
    });
    this.addUi(g);
    if (app().store.status.lastWrite === 'failed' || app().store.status.where === 'memory-only') {
      // a grown-up cue only: the details are in the settings
      this.addUi(h('div', { class: 'g-warn g-corner-tr', role: 'img', 'aria-label': 'Saving is not working right now. Open the grown-up settings for details.', html: icon('warn'), 'data-testid': 'save-warning' }));
    }
  }

  private addUi(el: HTMLElement): HTMLElement {
    layer('panel').append(el);
    this.ui.push(el);
    return el;
  }

  // ------------------------------------------------------------------ outside: the closed door

  private showExterior(): void {
    this.clearAll();
    this.mode = 'exterior';
    this.backdrop('garage.exterior', 0x6db54c);
    const o = this.origin();
    // the roll-up door: as it rises, only its lower part stays visible below the top of the opening
    const door = addImage(this, o.x + 610, o.y + 330, 'garage.door').setOrigin(0, 0);
    this.objs.push(door);
    this.nameText(o.x + 960, o.y + 250, 500);
    // after "Done" the garage rests: Play is there, but it doesn't call for attention
    const calm = this.data_.entrance === 'done';
    const play = button({ icon: 'play', label: 'Play', size: 'xl', variant: 'primary', testid: 'play', extraClass: `g-play-center ${calm ? '' : 'hint'}`, onTap: () => void this.openDoor(door) });
    this.addUi(play);
    this.gear();
  }

  private async openDoor(door: Phaser.GameObjects.Image): Promise<void> {
    if (this.mode !== 'exterior') return;
    this.mode = 'leaving';
    for (const el of this.ui) el.remove();
    this.ui = [];
    const top = door.y;
    const roll = { d: 0 };
    await tweenP(this, {
      targets: roll,
      d: door.height,
      duration: dur(1100, 250),
      ease: 'Sine.InOut',
      onUpdate: () => {
        const d = Math.min(door.height - 1, roll.d);
        door.setCrop(0, d, door.width, door.height - d);
        door.y = top - d;
      },
    } as Phaser.Types.Tweens.TweenBuilderConfig);
    door.setVisible(false);
    if (this.dead) return;
    if (!this.save.progress.started && !this.save.settings.openAll) {
      // first time ever: the truck rolls straight out into the first mission
      const s = { ...this.save, progress: { ...this.save.progress, started: true } };
      void app().commit(s);
      await this.driveOut();
      if (!this.dead) app().go('mission', { kind: 'mission', missionId: 'wobbly-bridge' });
      return;
    }
    const resume = this.save.resume;
    if (resume) {
      // a mission was left part-way (a reload, the app closed): straight back to that checkpoint
      await this.driveOut();
      if (!this.dead) app().go('mission', { kind: 'mission', missionId: resume.missionId, resume });
      return;
    }
    if (!app().reducedMotion()) {
      this.cameras.main.fadeOut(220, 255, 246, 230);
      await wait(this, 230);
    }
    if (this.dead) return;
    this.showInterior(true);
    if (!app().reducedMotion()) this.cameras.main.fadeIn(260, 255, 246, 230);
  }

  private async driveOut(): Promise<void> {
    const o = this.origin();
    const t = new TruckView(this, this.save.truck, { scale: 1 });
    this.truck = t;
    const pose = { x: o.x + 900, y: o.y + 880, vx: 0, vy: 0, slope: 0, accel: 0, squash: 0, rolled: 0, grounded: true };
    t.update(pose, 0);
    await wait(this, dur(250, 50));
    const target = this.scale.width + 340;
    const dist = target - pose.x;
    const ms = dur(1300, 500);
    const start = this.time.now;
    await new Promise<void>((res) => {
      const ev = this.time.addEvent({
        delay: 16,
        loop: true,
        callback: () => {
          const k = Math.min(1, (this.time.now - start) / ms);
          const e = k * k;
          const nx = o.x + 900 + dist * e;
          pose.vx = (nx - pose.x) / 0.016;
          pose.rolled += nx - pose.x;
          pose.x = nx;
          t.update(pose, 0.016);
          if (k >= 1) {
            ev.remove();
            res();
          }
        },
      });
    });
  }

  // ------------------------------------------------------------------ inside: the truck, the shelf, the cards

  private showInterior(fresh: boolean): void {
    this.clearAll();
    this.mode = 'interior';
    this.backdrop('garage.interior', 0xcdb38c, 0xd39550);
    const o = this.origin();
    const W = this.scale.width;
    // name sign
    const board = addImage(this, W / 2, o.y + 170, 'garage.signboard');
    this.objs.push(board);
    this.nameText(W / 2, o.y + 170, 520);
    // turntable and truck
    const floor = o.y + 880;
    const lift = addImage(this, W / 2 + 40, floor, 'garage.lift');
    this.objs.push(lift);
    this.truck = new TruckView(this, this.save.truck, { scale: 1.15 });
    this.truck.update(this.restPose(), 0);
    this.shelf(o);
    this.jar(o);
    this.cards();
    this.tabs();
    const next = this.save.resume?.missionId ?? nextMission(this.save);
    const play = button({
      icon: 'play',
      label: 'Play the next mission',
      size: 'xl',
      variant: 'primary',
      testid: 'play',
      // once the chapter is done, only My Tiny Track is highlighted (no competing cue)
      extraClass: `g-play ${chapterComplete(this.save) ? '' : 'hint'}`,
      onTap: () => this.startMission(next),
    });
    this.addUi(play);
    this.gear();
    if (fresh && this.data_.highlight) void this.celebrate(this.data_.highlight);
  }

  private restPose() {
    const o = this.origin();
    return { x: this.scale.width / 2 + 40, y: o.y + 880 - 28, vx: 0, vy: 0, slope: 0, accel: 0, squash: 0, rolled: this.rolled, grounded: true };
  }

  private shelfSpots(o: { x: number; y: number }): { id: RewardId | DiscoveryId; x: number; y: number; scale: number }[] {
    const out: { id: RewardId | DiscoveryId; x: number; y: number; scale: number }[] = [];
    REWARD_IDS.forEach((id, i) => out.push({ id, x: o.x + 760 + i * 240, y: o.y + 405, scale: 0.68 }));
    DISCOVERY_IDS.forEach((id, i) => out.push({ id, x: o.x + 800 + i * 200, y: o.y + 565, scale: 0.8 }));
    return out;
  }

  private shelf(o: { x: number; y: number }): void {
    const s1 = addImage(this, o.x + 1000, o.y + 405, 'garage.shelf');
    const s2 = addImage(this, o.x + 1000, o.y + 565, 'garage.shelf').setScale(0.9, 1);
    this.objs.push(s1, s2);
    for (const spot of this.shelfSpots(o)) {
      const owned = (REWARD_IDS as string[]).includes(spot.id) ? this.save.progress.rewards.includes(spot.id as RewardId) : this.save.progress.discoveries.includes(spot.id as DiscoveryId);
      const key = owned ? ((REWARD_IDS as string[]).includes(spot.id) ? `reward.${spot.id}` : discoveryKey(spot.id as DiscoveryId)) : 'garage.spot';
      const img = addImage(this, spot.x, spot.y, key).setScale(owned ? spot.scale : spot.scale * 0.8).setName(`shelf-${spot.id}`);
      this.objs.push(img);
    }
  }

  private jar(o: { x: number; y: number }): void {
    const x = o.x + 1330;
    const y = o.y + 880;
    const total = COIN_IDS.length;
    const have = this.save.progress.coins.length;
    const fill = addImage(this, x, y, 'garage.jar.fill');
    const frac = total ? have / total : 0;
    // crop from the top so the coins fill up from the bottom
    const fh = fill.height;
    fill.setCrop(0, fh * (1 - frac), fill.width, fh * frac);
    const glass = addImage(this, x, y, 'garage.jar');
    const n = this.add.text(x, y - 175, String(have), { fontFamily: FONT, fontSize: '44px', fontStyle: 'bold', color: '#3a2618', stroke: '#fff6e6', strokeThickness: 8 }).setOrigin(0.5);
    this.objs.push(fill, glass, n);
  }

  private cards(): void {
    const row = h('div', { class: 'g-row', style: 'left: calc(var(--edge) + var(--safe-l) + 8px); bottom: calc(var(--edge) + var(--safe-b) + 8px);' });
    const open = unlockedMissions(this.save);
    const next = nextMission(this.save);
    for (const id of MISSION_ORDER) {
      if (!open.includes(id)) {
        row.append(h('div', { class: 'g-silhouette', 'aria-hidden': 'true' }));
        continue;
      }
      const done = this.save.progress.completed.includes(id);
      const b = button({
        icon: { svg: missionCardPicture(id) },
        label: `Mission: ${titleOf(id)}${done ? ' (done)' : ''}`,
        size: 'lg',
        variant: 'plain',
        testid: `mission-${id}`,
        extraClass: `g-card ${id === next && !done ? 'hint' : ''}`,
        onTap: () => this.startMission(id),
      });
      if (done) b.append(h('span', { class: 'badge', html: icon('check') }));
      if (this.save.resume?.missionId === id) b.append(h('span', { class: 'badge left', 'data-testid': `resume-${id}`, html: icon('play') }));
      row.append(b);
    }
    if (creatorUnlocked(this.save)) {
      row.append(
        button({
          icon: { svg: trackCardPicture() },
          label: 'My Tiny Track: build your own track',
          size: 'lg',
          variant: 'plain',
          testid: 'creator',
          extraClass: `g-card ${this.save.progress.completed.length === MISSION_ORDER.length && !this.save.tracks.some(Boolean) ? 'hint' : ''}`,
          onTap: () => this.leave(() => app().go('creator', {})),
        }),
      );
    }
    this.addUi(row);
  }

  private tabs(): void {
    const col = h('div', { class: 'g-tabs' });
    const tabs: [Tab, string][] = [
      ['paint', 'Paint colour'],
      ['pattern', 'Pattern'],
      ['decal', 'Sticker'],
      ['wheel', 'Wheels'],
    ];
    for (const [t, label] of tabs) {
      const b = button({ icon: t, label, size: 'md', variant: 'soft', testid: `tab-${t}`, extraClass: this.tab === t ? 'selected' : '', onTap: () => this.openTab(this.tab === t ? null : t) });
      col.append(b);
    }
    // the tabs sit just under the gear
    this.addUi(col);
    if (this.tab) this.openTab(this.tab);
  }

  private openTab(t: Tab | null): void {
    this.tab = t;
    this.options?.remove();
    this.options = null;
    for (const el of this.ui) for (const b of el.querySelectorAll<HTMLButtonElement>('[data-testid^="tab-"]')) b.classList.toggle('selected', b.dataset.testid === `tab-${t}`);
    if (!t) return;
    const look = this.pendingLook ?? this.save.truck;
    const box = h('div', { class: `g-options ${t === 'wheel' ? 'wheels' : ''}`, 'data-testid': `options-${t}` });
    const add = (svg: string, label: string, id: string, selected: boolean, apply: () => TruckLook) => {
      box.append(button({ icon: { svg }, label, size: 'md', variant: 'plain', testid: `opt-${t}-${id}`, extraClass: selected ? 'selected' : '', onTap: () => this.setLook(apply()) }));
    };
    if (t === 'paint') for (const p of PAINT_IDS) add(paintSwatch(p), `${p} paint`, p, look.paint === p, () => ({ ...look, paint: p }));
    if (t === 'pattern') for (const p of PATTERN_IDS) add(patternSwatch(p, look.paint), `${p} pattern`, p, look.pattern === p, () => ({ ...look, pattern: p }));
    if (t === 'decal') for (const d of DECAL_IDS) add(decalSwatch(d), d === 'none' ? 'no sticker' : `${d} sticker`, d, look.decal === d, () => ({ ...look, decal: d }));
    if (t === 'wheel') for (const w of ['chunky', 'spring'] as const) add(wheelPreview(w), w === 'chunky' ? 'Chunky wheels: steady landings' : 'Spring wheels: higher jumps', w, look.wheel === w, () => ({ ...look, wheel: w }));
    this.options = box;
    layer('panel').append(box);
  }

  private setLook(look: TruckLook): void {
    this.pendingLook = look;
    if (this.truck) {
      this.truck.setLook(look);
      this.truck.cheer();
      this.rolled += 120;
      this.truck.update(this.restPose(), 0.016);
      const p = this.restPose();
      this.fx.sparks(p.x, p.y - 160, 5);
    }
    if (this.tab) this.openTab(this.tab);
    // save after a moment (a meaningful change), and right away when leaving
    this.saveTimer?.remove();
    this.saveTimer = this.time.delayedCall(500, () => void this.flushLook());
  }

  private async flushLook(): Promise<boolean> {
    this.saveTimer?.remove();
    this.saveTimer = null;
    const look = this.pendingLook;
    if (!look) return true;
    this.pendingLook = null;
    return app().commit({ ...this.save, truck: look });
  }

  private async celebrate(id: RewardId | DiscoveryId): Promise<void> {
    const img = this.objs.find((o) => o.name === `shelf-${id}`) as Phaser.GameObjects.Image | undefined;
    if (!img) return;
    await wait(this, dur(350, 0));
    if (this.dead) return;
    const s = img.scale;
    if (!app().reducedMotion()) {
      img.setScale(0.01);
      await tweenP(this, { targets: img, scale: s, duration: 520, ease: 'Back.Out' });
    }
    this.fx.sparks(img.x, img.y - 90, 8);
  }

  private startMission(id: MissionId): void {
    // a mission left part-way continues from its last checkpoint
    const resume = this.save.resume?.missionId === id ? this.save.resume : null;
    this.leave(() => app().go('mission', { kind: 'mission', missionId: id, resume }));
  }

  private leave(go: () => void): void {
    if (this.mode === 'leaving') return;
    this.mode = 'leaving';
    void this.flushLook().then(() => {
      if (!this.dead) go();
    });
  }

  inspect(): Record<string, unknown> {
    return {
      mode: this.mode,
      entrance: this.data_.entrance,
      tab: this.tab,
      look: this.pendingLook ?? this.save.truck,
      unlocked: unlockedMissions(this.save),
      creator: creatorUnlocked(this.save),
      name: this.save.settings.childName,
      rewards: this.save.progress.rewards,
      coins: this.save.progress.coins.length,
    };
  }

  testTargets(): { id: string; x: number; y: number; w: number; h: number; space: 'world' | 'screen' }[] {
    return [];
  }

  private cleanup(): void {
    this.dead = true;
    closeParentSettings();
    this.isReady = false;
    if (this.pendingLook) void this.flushLook();
    for (const off of this.offs) off();
    this.clearAll();
  }
}

function discoveryKey(id: DiscoveryId): string {
  return id === 'golden-acorn' ? 'obj.acorn' : id === 'pinwheel' ? 'obj.pinwheel.head' : 'obj.ribbon';
}

function titleOf(id: MissionId): string {
  return id === 'wobbly-bridge' ? 'The Wobbly Bridge' : id === 'ramp-we-share' ? 'The Ramp We Share' : 'The Everyone Rally';
}
