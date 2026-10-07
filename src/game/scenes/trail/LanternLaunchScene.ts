import Phaser from 'phaser';
import { TrailScene, groundY } from './TrailScene';
import { registerPieces, pieceSvg } from '../../../art/registry';
import { TRAIL_ADVENTURE_PIECES } from '../../../art/scenes/trailAdventures';
import { sparkle } from '../../systems/fx';
import { makeImage } from '../../../art/rasterize';
import { audio } from '../../../core/audio';
import { motion } from '../../../core/motion';
import { artRng } from '../../../art/svg';
import { ROLES, ROLE_FRIEND, ROLE_STEPS, applyFix, doStep, newLaunch, roleDone, tryLaunch, type LaunchRole, type LaunchState } from '../../../content/trail/adventures';
import { LAUNCH_LINES } from '../../../content/trail/adventureLines';
import type { CastId } from '../../../art/cast';

registerPieces(TRAIL_ADVENTURE_PIECES);

const L = LAUNCH_LINES;
const BELL_X = 520;
const TABLE_X = 900;
const LAUNCH_X = 1300;
const SPOOL_X = 1520;
const POST_X = 1760;
const PATH_X = [300, 700, 2020, 2260];
const STATION: Record<CastId, number> = { pip: BELL_X + 120, luma: TABLE_X - 150, moss: SPOOL_X + 120, rowan: POST_X + 110, fizz: 2140 };
const ROLE_ART: Record<LaunchRole, string> = { fold: 'gl.paper', light: 'gl.flame', hold: 'gl.spool', signal: 'gl.bell', path: 'gl.path.on' };
const ROLE_LABEL: Record<LaunchRole, string> = { fold: 'Fold the paper', light: 'Light the lantern', hold: 'Hold the line', signal: 'Ring the countdown bell', path: 'Light the path lanterns (quiet job)' };
const ROLE_LINE: Record<LaunchRole, keyof typeof L> = { fold: 'luma.fold', light: 'rowan.light', hold: 'moss.hold', signal: 'pip.signal', path: 'fizz.path' };

function validLaunch(x: unknown): x is LaunchState {
  const l = x as LaunchState;
  return !!l && (l.role === null || Object.keys(ROLE_STEPS).includes(l.role)) && Number.isFinite(l.steps) && Number.isFinite(l.weight) && Number.isFinite(l.balloons) && Number.isFinite(l.attempts) && typeof l.launched === 'boolean';
}

/** The Lantern Launch: a group project where every job counts, and the first try wobbles. */
export default class LanternLaunchScene extends TrailScene {
  readonly artGroup = 'trail-glade';
  readonly questId = 'lantern-launch';
  readonly gameTheme = 'festival' as const;
  protected readonly skyColors: [string, string] = ['#4b4a7a', '#f2b98f'];
  protected readonly walkRange: [number, number] = [160, 2360];
  private l!: LaunchState;
  private lantern!: Phaser.GameObjects.Container;
  private paperImg!: Phaser.GameObjects.Image;
  private foldLines: Phaser.GameObjects.Graphics[] = [];
  private pathImgs: Phaser.GameObjects.Image[] = [];
  private bellImg!: Phaser.GameObjects.Image;
  private spoolImg!: Phaser.GameObjects.Image;
  private glow?: Phaser.GameObjects.Image;

  constructor() {
    super('lantern-launch');
  }

  protected extraArtKeys(): string[] {
    return TRAIL_ADVENTURE_PIECES.filter((p) => p.key.startsWith('gl.') || p.key.startsWith('tr.') || p.key === 'ml.light').map((p) => p.key);
  }

  protected buildWorld(): void {
    this.l = this.readJSON('launch', validLaunch, newLaunch());
    const finished = this.quest()?.status === 'done';
    this.art(0, 0, 'gl.far', 1);
    this.art(0, 0, 'gl.ground', 2);
    if (finished) this.fillSky(false);
    // stations
    this.bellImg = this.img(BELL_X, groundY(BELL_X) + 6, 'gl.bell', 10);
    this.img(TABLE_X, groundY(TABLE_X) + 6, 'gl.table', 10);
    this.paperImg = this.img(TABLE_X, groundY(TABLE_X) - 130, this.l.role === 'fold' && roleDone(this.l) ? 'gl.paper.folded' : 'gl.paper', 11).setScale(0.8);
    this.img(LAUNCH_X, groundY(LAUNCH_X) + 6, 'gl.table', 10);
    this.lantern = this.add.container(LAUNCH_X, groundY(LAUNCH_X) - 96).setDepth(12);
    this.lantern.add(makeImage(this, 0, 0, 'gl.big').setScale(0.7));
    for (let i = 1; i < this.l.balloons; i++) this.addBalloon();
    if (finished) this.lantern.setVisible(false);
    this.spoolImg = this.img(SPOOL_X, groundY(SPOOL_X) + 6, 'gl.spool', 10);
    this.img(POST_X, groundY(POST_X) + 6, 'gl.post', 10);
    PATH_X.forEach((x, i) => this.pathImgs.push(this.img(x, groundY(x) + 6, i < this.l.pathLit || this.l.launched ? 'gl.path.on' : 'gl.path.off', 9)));
    // friends at their stations
    for (const [id, x] of Object.entries(STATION) as [CastId, number][]) {
      const p = this.friend(id, x, x > LAUNCH_X ? -1 : 1);
      this.addTarget({ id: `friend-${id}`, label: id, bounds: () => this.rectAround(p.x, p.y - 110, 140, 200, 6), enabled: () => !this.busy, activate: () => void this.chat(id) });
    }
    // job targets
    [-55, 0, 55].forEach((dx, i) => {
      const g = this.add.graphics().setDepth(12);
      this.foldLines.push(g);
      this.addTarget({ id: `fold-${i}`, label: 'Fold line', priority: 3, bounds: () => this.rectAround(TABLE_X + dx * 0.8, groundY(TABLE_X) - 130, 40, 90, 14), enabled: () => this.jobIs('fold') && this.l.steps === i && !this.busy, activate: () => this.goDo(TABLE_X, () => void this.fold(i)) });
    });
    this.addTarget({ id: 'flame', label: 'Flame post', bounds: () => this.rectAround(POST_X, groundY(POST_X) - 150, 90, 260, 8), enabled: () => this.jobIs('light') && this.l.steps === 0 && !this.busy, activate: () => this.goDo(POST_X, () => void this.takeFlame()) });
    this.addTarget({ id: 'lantern', label: 'The big lantern', bounds: () => this.rectAround(LAUNCH_X, groundY(LAUNCH_X) - 190, 200, 220, 8), enabled: () => this.jobIs('light') && this.l.steps === 1 && !this.busy, activate: () => this.goDo(LAUNCH_X, () => void this.lightIt()) });
    this.addTarget({ id: 'spool', label: 'Line spool', bounds: () => this.rectAround(SPOOL_X, groundY(SPOOL_X) - 60, 130, 130, 10), enabled: () => this.jobIs('hold') && !this.busy, activate: () => this.goDo(SPOOL_X, () => void this.letOut()) });
    this.addTarget({ id: 'bell', label: 'Bell', bounds: () => this.rectAround(BELL_X, groundY(BELL_X) - 110, 130, 220, 8), enabled: () => this.jobIs('signal') && !this.busy, activate: () => this.goDo(BELL_X, () => void this.ring()) });
    PATH_X.forEach((x, i) => this.addTarget({ id: `path-${i}`, label: 'Path lantern', bounds: () => this.rectAround(x, groundY(x) - 110, 90, 200, 10), enabled: () => this.jobIs('path') && this.l.pathLit === i && !this.busy, activate: () => this.goDo(x, () => void this.lightPath(i)) }));
    this.drawFoldLines();
  }

  private jobIs(r: LaunchRole): boolean {
    return this.l.role === r && !roleDone(this.l) && !this.l.launched;
  }

  private persist(cp: string): void {
    this.saveQuest(cp, { launch: JSON.stringify(this.l) });
  }

  // ================================================================ story

  protected startAt(cp: string): void {
    if (cp === 'done') return;
    // interrupted during the finale: play it again (the souvenir is given once, at the end)
    if (this.l.launched) return void this.rise();
    if (!this.l.role) return void this.intro();
    if (!roleDone(this.l)) return void this.line(L[ROLE_LINE[this.l.role]], { instruct: true });
    if (this.l.attempts === 0) return void this.launchSequence();
    void this.chooseFix();
  }

  private async intro(): Promise<void> {
    this.busy = true;
    await this.line(L['luma.hook']);
    await this.line(L['luma.pick']);
    if (!this.alive()) return;
    const pick = (await this.ask(ROLES[this.preset].map((r) => ({ id: r, icon: 'star', label: ROLE_LABEL[r], art: pieceSvg(ROLE_ART[r]) })))) as LaunchRole | null;
    if (!pick || !this.alive()) return;
    this.l = { ...this.l, role: pick };
    this.persist('job');
    this.busy = false;
    void this.line(L[ROLE_LINE[pick]], { instruct: true });
  }

  private async chat(id: CastId): Promise<void> {
    const role = (Object.keys(ROLE_FRIEND) as LaunchRole[]).find((r) => ROLE_FRIEND[r] === id);
    const p = this.friends.get(id)!;
    void p.play('wave');
    if (this.l.launched) return void this.line(L['luma.thanks']);
    if (role) await this.line(L[ROLE_LINE[role]]);
  }

  private async afterStep(): Promise<void> {
    this.persist('job');
    if (!roleDone(this.l)) return;
    sparkle(this, this.avatar.x, this.avatar.y - 200, 10, 60);
    await this.wait(400);
    void this.launchSequence();
  }

  // ---------------------------------------------------------------- jobs

  private drawFoldLines(): void {
    this.foldLines.forEach((g, i) => {
      g.clear();
      if (this.l.role === 'fold' && roleDone(this.l)) return;
      const x = TABLE_X + [-55, 0, 55][i] * 0.8;
      const y = groundY(TABLE_X) - 130;
      const done = this.l.role === 'fold' && i < this.l.steps;
      g.lineStyle(done ? 8 : 6, done ? 0x3b2a20 : 0xd95b4f, done ? 0.9 : 0.85);
      g.lineBetween(x, y - 36, x, y + 36);
    });
  }

  private async fold(i: number): Promise<void> {
    this.hints.poke();
    if (i !== this.l.steps) return;
    audio.play('paper');
    this.l = doStep(this.l);
    this.drawFoldLines();
    if (!motion.reduced) this.tweens.add({ targets: this.paperImg, scaleX: 0.8 - 0.1 * this.l.steps, duration: 200 });
    if (roleDone(this.l)) {
      this.paperImg.destroy();
      this.paperImg = this.img(TABLE_X, groundY(TABLE_X) - 130, 'gl.paper.folded', 11).setScale(0.7);
      await this.tweenP({ targets: this.paperImg, x: LAUNCH_X, y: groundY(LAUNCH_X) - 200, alpha: 0, duration: 700 });
    }
    await this.afterStep();
  }

  private async takeFlame(): Promise<void> {
    this.hints.poke();
    this.pickUp('flame', 'gl.flame');
    this.l = doStep(this.l);
    this.persist('job');
    audio.play('glow');
    void this.line(L['rowan.light'], { instruct: true });
  }

  private async lightIt(): Promise<void> {
    this.hints.poke();
    if (!this.carrying) return;
    this.drop();
    audio.play('glow');
    this.glow = this.img(LAUNCH_X, groundY(LAUNCH_X) - 190, 'ml.light', 11);
    this.glow.setScale(2);
    this.l = doStep(this.l);
    await this.afterStep();
  }

  private async letOut(): Promise<void> {
    this.hints.poke();
    audio.play('stretch', { pitch: 1 + this.l.steps * 0.15 });
    if (!motion.reduced) this.tweens.add({ targets: this.spoolImg, angle: 30 * (this.l.steps + 1), duration: 200 });
    this.l = doStep(this.l);
    await this.afterStep();
  }

  private async ring(): Promise<void> {
    this.hints.poke();
    audio.play('bell', { pitch: 1 + this.l.steps * 0.1 });
    if (!motion.reduced) this.tweens.add({ targets: this.bellImg, angle: { from: -8, to: 8 }, duration: 120, yoyo: true, repeat: 1, onComplete: () => this.bellImg.setAngle(0) });
    this.l = doStep(this.l);
    await this.afterStep();
  }

  private async lightPath(i: number): Promise<void> {
    this.hints.poke();
    audio.play('glow');
    this.swapPath(i, true);
    this.l = doStep(this.l);
    await this.afterStep();
  }

  private swapPath(i: number, on: boolean): void {
    const old = this.pathImgs[i];
    this.pathImgs[i] = this.img(old.x, old.y, on ? 'gl.path.on' : 'gl.path.off', 9);
    old.destroy();
  }

  // ---------------------------------------------------------------- the launch

  private async launchSequence(): Promise<void> {
    this.busy = true;
    await this.line(L['nar.othersHelp']);
    // everyone else does their part
    for (const [role, who] of Object.entries(ROLE_FRIEND) as [LaunchRole, CastId][]) {
      if (role === this.l.role) continue;
      const p = this.friends.get(who);
      if (p) void p.play(role === 'signal' ? 'pump' : 'nod');
      if (role === 'path') for (let i = 0; i < PATH_X.length; i++) if (this.pathImgs[i].texture.key !== 'gl.path.on') this.time.delayedCall(i * 250, () => this.swapPath(i, true));
      if (role === 'light' && !this.glow) {
        this.glow = this.img(LAUNCH_X, groundY(LAUNCH_X) - 190, 'ml.light', 11).setScale(2);
        audio.play('glow');
      }
    }
    await this.wait(800);
    await this.countdown(L['nar.ready']);
    const r = tryLaunch(this.l);
    this.l = r.l;
    this.persist(r.rises ? 'launch' : 'fix');
    if (r.rises) return void this.rise();
    // a playful wobble: up, wobble, and down onto Pip's head
    await this.tweenP({ targets: [this.lantern, this.glow].filter(Boolean), y: '-=260', duration: 1400, ease: 'Sine.easeOut' });
    void this.line(L['nar.wobble']);
    if (!motion.reduced) await this.tweenP({ targets: this.lantern, angle: { from: -10, to: 10 }, duration: 260, yoyo: true, repeat: 2 });
    this.lantern.setAngle(0);
    const pip = this.friends.get('pip')!;
    this.glow?.setVisible(false);
    await this.tweenP({ targets: this.lantern, x: pip.x, y: pip.y - 230, duration: 1300, ease: 'Sine.easeIn' });
    audio.play('boing');
    void pip.play('oops', { expression: 'silly' });
    await this.line(L['pip.bonk']);
    await this.tweenP({ targets: this.lantern, x: LAUNCH_X, y: groundY(LAUNCH_X) - 96, duration: 900, ease: 'Sine.easeInOut' });
    this.glow?.setVisible(true).setPosition(LAUNCH_X, groundY(LAUNCH_X) - 190);
    await this.chooseFix();
  }

  private async countdown(first: (typeof L)[keyof typeof L]): Promise<void> {
    void this.line(first);
    for (let i = 0; i < 3; i++) {
      audio.play('bell', { pitch: 1 + i * 0.12 });
      if (!motion.reduced) this.tweens.add({ targets: this.bellImg, angle: { from: -8, to: 8 }, duration: 120, yoyo: true, onComplete: () => this.bellImg.setAngle(0) });
      await this.wait(700);
    }
  }

  private async chooseFix(): Promise<void> {
    this.busy = true;
    await this.line(L['luma.fixes']);
    if (!this.alive()) return;
    const pick = (await this.ask([
      { id: 'trim', icon: 'star', label: 'Trim the paper', art: pieceSvg('gl.scissors') },
      { id: 'balloon', icon: 'star', label: 'Add a balloon', art: pieceSvg('gl.balloon') },
      { id: 'swap', icon: 'swap', label: 'Swap jobs' },
    ])) as 'trim' | 'balloon' | 'swap' | null;
    if (!pick || !this.alive()) return;
    this.l = applyFix(this.l, pick);
    if (pick === 'trim') {
      audio.play('swish');
      await this.line(L['luma.trim']);
      this.lantern.setScale(1, 0.9);
    } else if (pick === 'balloon') {
      this.addBalloon();
      audio.play('pop');
      await this.line(L['rowan.balloon']);
    } else {
      audio.play('zip');
      await this.line(L['luma.swap']);
    }
    this.persist('launch');
    await this.countdown(L['nar.again']);
    const r = tryLaunch(this.l);
    this.l = r.l;
    this.persist(r.rises ? 'launch' : 'fix');
    if (r.rises) void this.rise();
    else void this.chooseFix();
  }

  private addBalloon(): void {
    const b = makeImage(this, 70, -150, 'gl.balloon').setScale(0.9);
    this.lantern.add(b);
  }

  private async rise(): Promise<void> {
    this.busy = true;
    audio.startMusic('festival');
    this.camFocus = () => LAUNCH_X;
    await this.line(L['luma.rise']);
    this.tweens.add({ targets: [this.lantern, this.glow].filter(Boolean), y: '-=900', duration: motion.reduced ? 400 : 5000, ease: 'Sine.easeIn' });
    await this.wait(1200);
    this.fillSky(true);
    await this.line(L['nar.sky']);
    for (const p of this.friends.values()) void p.play('cheer');
    await this.line(L['luma.thanks']);
    this.camFocus = null;
    const role = this.l.role ?? 'fold';
    await this.complete({ id: 'festival-lantern', data: { role, fix: this.l.fix ?? '' } }, `Joined the lantern launch as ${ROLE_LABEL[role].toLowerCase()}. The first lantern was too heavy; the group fixed it (${this.l.fix ?? 'no fix needed'}) and tried again.`, 'Festival lantern', { launch: JSON.stringify(this.l) });
    await this.line(L['nar.lantern']);
    this.busy = false;
    void this.endChoices();
  }

  /** The club's lanterns drifting in the evening sky (they stay there afterwards). */
  private fillSky(animate: boolean): void {
    const r = artRng(9);
    for (let i = 0; i < 16; i++) {
      const x = 200 + r() * 2200;
      const y = 120 + r() * 320;
      const im = this.img(x, animate ? groundY(x) - 100 : y, `gl.sky.${i % 5}`, 5).setScale(0.6 + r() * 0.5);
      if (animate) this.tweens.add({ targets: im, y, duration: motion.reduced ? 300 : 3000 + r() * 3000, delay: i * 200, ease: 'Sine.easeOut' });
      if (!motion.reduced) this.tweens.add({ targets: im, x: x + 20, duration: 3000 + r() * 2000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: 3000 });
    }
  }

  protected demo(): void {
    if (this.busy || !this.l.role) return;
    const tap = (x: number, y: number) => void this.hand.tapAt(x, y, 2);
    switch (this.l.role) {
      case 'fold':
        return tap(TABLE_X + [-55, 0, 55][Math.min(2, this.l.steps)] * 0.8, groundY(TABLE_X) - 130);
      case 'light':
        return this.l.steps === 0 ? tap(POST_X, groundY(POST_X) - 150) : tap(LAUNCH_X, groundY(LAUNCH_X) - 190);
      case 'hold':
        return tap(SPOOL_X, groundY(SPOOL_X) - 60);
      case 'signal':
        return tap(BELL_X, groundY(BELL_X) - 110);
      case 'path':
        return tap(PATH_X[Math.min(3, this.l.pathLit)], groundY(PATH_X[0]) - 110);
    }
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
      role: this.l.role,
      steps: this.l.steps,
      attempts: this.l.attempts,
      fix: this.l.fix,
      launched: this.l.launched,
      pathLit: this.l.pathLit,
      carrying: this.carrying?.kind ?? null,
      busy: this.busy,
    };
  }
}
