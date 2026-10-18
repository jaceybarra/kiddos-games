import Phaser from 'phaser';
import { app, dur, type ResultData } from '../app/context';
import { recapPanel, rewardPicture, trackCardPicture } from '../art/pictures';
import { addImage, ensureArt } from '../art/rasterize';
import { G, REWARD_OF, type CrewId } from '../content/missions';
import { registerSceneForTests } from '../dev/testHooks';
import { chapterComplete } from '../save/progress';
import { REWARD_IDS } from '../save/schema';
import { h, icon, layer } from '../ui/dom';
import { showEndChoices } from '../ui/overlays';
import { CrewView } from '../view/CrewView';
import { Fx } from '../view/fx';
import { TruckView } from '../view/TruckView';
import { tweenP, wait } from './util';
import './scenes.css';

/**
 * The end of a mission: the garage reward pops and heads for the garage, a
 * silent three-panel recap tells the story back in pictures, then three equal
 * choices: Replay, Garage, Done. Nothing starts by itself. After the third
 * mission the whole chapter is shown complete (and My Tiny Track opens) —
 * no teaser for anything else.
 */
const KEYS = ['bg.sky', 'bg.mid'];

export default class ResultScene extends Phaser.Scene {
  isReady = false;
  private d!: ResultData;
  private dead = false;
  private ui: HTMLElement[] = [];
  private closeEnd: (() => void) | null = null;
  private crew: CrewView[] = [];
  private stage = 'reward';
  private rewardImg: Phaser.GameObjects.Image | null = null;

  constructor() {
    super('result');
  }

  init(d: ResultData): void {
    this.d = d;
    this.dead = false;
    this.isReady = false;
    this.ui = [];
    this.crew = [];
    this.stage = 'reward';
    this.rewardImg = null;
  }

  create(): void {
    registerSceneForTests(this);
    this.events.once('shutdown', () => this.cleanup());
    this.cameras.main.setBackgroundColor('#8fd0f0');
    void ensureArt(this.textures, KEYS, 'result-bg').then(() => {
      if (!this.dead) void this.run();
    });
  }

  private async run(): Promise<void> {
    const W = this.scale.width;
    const H = this.scale.height;
    // the celebration stands in the middle band: clear of the recap above and the end choices below
    const ground = Math.round(H * 0.66);
    addImage(this, 0, 0, 'bg.sky').setOrigin(0, 0).setDisplaySize(W, H);
    for (let x = 0; x < W; x += 2048) addImage(this, x, ground - 330, 'bg.mid').setOrigin(0, 0);
    this.add.rectangle(0, ground, W, H - ground, 0x6db54c).setOrigin(0, 0);
    this.add.rectangle(0, ground, W, 14, 0x9bd46a).setOrigin(0, 0);
    const fx = new Fx(this, { reduced: app().reducedMotion(), low: app().lowIntensity() });
    const truck = new TruckView(this, app().save.truck, { scale: 1 });
    truck.update({ x: W * 0.3, y: ground, vx: 0, vy: 0, slope: 0, accel: 0, squash: 0, rolled: 0, grounded: true }, 0);
    const ids: CrewId[] = ['milo', 'pip', 'nori'];
    ids.forEach((id, i) => {
      const c = new CrewView(this, id, W * 0.55 + i * 170, ground, { facing: 'left' });
      this.crew.push(c);
    });
    this.isReady = true;
    truck.cheer();
    for (const c of this.crew) void c.cheer();
    fx.confetti(W / 2, H * 0.25);

    const reward = this.d.launch.kind === 'mission' ? REWARD_OF[this.d.launch.missionId] : null;
    let plate: HTMLElement | null = null;
    if (reward && this.d.earned.newReward) {
      // a milestone card with his name: this one goes on HIS garage shelf
      plate = h('div', { class: 'r-name', 'data-testid': 'name-plate' }, (app().settings.childName || 'Bentley').toUpperCase());
      layer('panel').append(plate);
      this.ui.push(plate);
    }
    if (reward) {
      const img = addImage(this, W / 2, ground - 300, `reward.${reward}`).setScale(1.25);
      this.rewardImg = img;
      if (this.d.earned.newReward && !app().reducedMotion()) {
        img.setScale(0.01);
        await tweenP(this, { targets: img, scale: 1.25, duration: 600, ease: 'Back.Out' });
        fx.sparks(img.x, img.y - 120, 8);
        await wait(this, 700);
        // off to the garage shelf
        await tweenP(this, { targets: img, x: W - 140, y: 160, scale: 0.35, duration: 750, ease: 'Sine.In' });
        img.setVisible(false);
      } else if (this.d.earned.newReward) {
        await wait(this, 900);
        img.setVisible(false);
      } else {
        // already on the shelf from before: shown small with a tick
        img.setScale(0.7);
        fx.check(img.x + 120, img.y - 140);
      }
    }
    if (this.dead) return;
    plate?.remove();
    this.rewardImg?.setVisible(false);
    this.stage = 'recap';
    await this.recap();
    if (this.dead) return;
    if (this.d.earned.newReward === 'crew-banner' && chapterComplete(app().save)) {
      this.stage = 'chapter';
      await this.chapter();
      if (this.dead) return;
    }
    this.stage = 'choices';
    this.endChoices();
  }

  private async recap(): Promise<void> {
    const id = this.d.launch.kind === 'mission' ? this.d.launch.missionId : 'track';
    const row = h('div', { class: 'r-recap', 'data-testid': 'recap', role: 'img', 'aria-label': 'What happened, in three pictures' });
    layer('panel').append(row);
    this.ui.push(row);
    const parts: HTMLElement[] = [];
    for (const i of [0, 1, 2] as const) {
      if (i > 0) {
        const arrow = h('div', { class: 'r-arrow', html: icon('back').replace('<svg', '<svg style="transform:scaleX(-1)"') });
        row.append(arrow);
        parts.push(arrow);
      }
      const p = h('div', { class: 'r-panel', html: recapPanel(id, i, { placed: this.d.summary.placed, choice: this.d.summary.choice }, app().save.truck) });
      row.append(p);
      parts.push(p);
    }
    for (const p of parts) {
      await wait(this, dur(380, 0));
      if (this.dead) return;
      p.classList.add('in');
    }
    await wait(this, dur(1200, 400));
  }

  private async chapter(): Promise<void> {
    for (const el of this.ui) el.remove();
    this.ui = [];
    const name = (app().settings.childName || 'Bentley').toUpperCase();
    const card = h('div', { class: 'r-chapter', 'data-testid': 'chapter', role: 'img', 'aria-label': `All three missions done: the pennant, the twin ramp and the crew banner are in ${name}'s garage, and My Tiny Track is open` });
    const row = h('div', { class: 'r-chapter-row' });
    for (const r of REWARD_IDS) row.append(h('div', { class: 'item', html: rewardPicture(r) }));
    // a still picture (not a button): My Tiny Track is waiting in the garage
    row.append(h('div', { class: 'item', html: trackCardPicture() }));
    card.append(h('div', { class: 'r-name in-card' }, name), row);
    layer('panel').append(card);
    this.ui.push(card);
    await wait(this, dur(2200, 1200));
  }

  private endChoices(): void {
    const s = app().settings;
    const reminder = s.reminderMinutes > 0 && app().sessionMinutes() >= s.reminderMinutes;
    const end = showEndChoices({ reminder });
    this.closeEnd = end.close;
    if (!this.d.saved) {
      const warn = h('div', { class: 'g-warn g-corner-tr', role: 'img', 'aria-label': 'This result could not be saved. Open the grown-up settings for details.', html: icon('warn'), 'data-testid': 'save-warning' });
      layer('panel').append(warn);
      this.ui.push(warn);
    }
    void end.picked.then((c) => {
      this.closeEnd = null;
      if (this.dead) return;
      const highlight = this.d.earned.newReward ?? this.d.earned.newDiscovery ?? null;
      if (c === 'replay') app().go('mission', this.d.launch);
      else if (c === 'garage') app().go('garage', { entrance: 'return', highlight });
      else app().go('garage', { entrance: 'done' });
    });
  }

  inspect(): Record<string, unknown> {
    return { stage: this.stage, earned: this.d.earned, saved: this.d.saved, mission: this.d.launch.kind === 'mission' ? this.d.launch.missionId : 'track', ground: G };
  }

  testTargets(): { id: string; x: number; y: number; w: number; h: number; space: 'world' | 'screen' }[] {
    return [];
  }

  private cleanup(): void {
    this.dead = true;
    this.isReady = false;
    this.closeEnd?.();
    this.closeEnd = null;
    for (const el of this.ui) el.remove();
    this.ui = [];
    for (const c of this.crew) c.destroy();
  }
}
