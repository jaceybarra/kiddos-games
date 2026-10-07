import Phaser from 'phaser';
import { WWScene } from '../WWScene';
import { Puppet } from '../rig/Puppet';
import { Walker } from '../systems/Walker';
import { GhostHand } from '../systems/GhostHand';
import { Hints } from '../systems/Hints';
import { sparkle } from '../systems/fx';
import { addArt, addImage } from '../../art/rasterize';
import { registerPieces } from '../../art/registry';
import { CLUBHOUSE_PIECES, FLOOR_Y } from '../../art/scenes/clubhouse';
import { WINDMILL_PIECES } from '../../art/scenes/windmill';
import { TINKER_PIECES } from '../../art/scenes/tinker';
import { InventionDisplay, inventionArtKeys, type InventionData } from '../displays/InventionDisplay';
import { PicnicDisplay, picnicDisplayKeys, type PicnicData } from '../displays/PicnicDisplay';
import { PLACES } from '../../content/places';
import { CAST_RIGS, avatarRig, rigArtKeys } from '../../art/cast';
import { AVATAR_SPECIES, type AvatarSpecies } from '../../art/cast/avatars';
import { HATS } from '../../art/cast/hats';
import { CHOICE_COLORS, P, choiceColor, hex } from '../../art/palette';
import { rigSvg } from '../../art/portrait';
import { CLUB_LINES, type ClubLineId } from '../../content/clubhouseLines';
import { services, currentProfile, updateProfile } from '../../app/services';
import { say, instruct, stopSpeech, type Speaker } from '../../app/speech';
import { audio } from '../../core/audio';
import { motion } from '../../core/motion';
import { h, trapFocus } from '../../ui/dom';
import { icon } from '../../ui/icons';
import { pieceSvg } from '../../art/registry';
import type { AvatarLook } from '../../save/schema';

registerPieces(CLUBHOUSE_PIECES);
registerPieces(WINDMILL_PIECES);
registerPieces(TINKER_PIECES);

const D = { bg: 0, wall: 10, prop: 20, npc: 30, avatar: 40, fx: 60 };

/**
 * The clubhouse: shows the child's real creations and souvenirs, a dress-up
 * chest (everyone can wear everything), and a quiet corner.
 */
export default class ClubhouseScene extends WWScene {
  readonly artGroup = 'clubhouse';
  private avatar!: Puppet;
  private walker!: Walker;
  private luma!: Puppet;
  private moss!: Puppet;
  private hand!: GhostHand;
  private hints!: Hints;
  private sitting = false;
  private busy = false;
  private kiteParts: Phaser.GameObjects.GameObject[] = [];
  private pinwheel?: Phaser.GameObjects.Image;
  private wardrobe?: HTMLElement;

  constructor() {
    super('clubhouse');
  }

  artKeys(): string[] {
    const p = currentProfile();
    const keys = new Set<string>(CLUBHOUSE_PIECES.map((x) => x.key));
    for (const k of ['wh.kite', 'kite.bow.stars', 'kite.bow.stripes', 'kite.bow.dots', 'kite.bow.leaves', 'wh.pinwheel', 'wh.pinwheel.stick']) keys.add(k);
    for (const k of inventionArtKeys()) keys.add(k);
    for (const k of picnicDisplayKeys()) keys.add(k);
    for (const sp of AVATAR_SPECIES) for (const c of CHOICE_COLORS) for (const k of rigArtKeys(avatarRig(sp.id, c.id))) keys.add(k);
    for (const k of rigArtKeys(CAST_RIGS.luma)) keys.add(k);
    for (const k of rigArtKeys(CAST_RIGS.moss)) keys.add(k);
    for (const hat of HATS) keys.add(hat.id);
    void p;
    return [...keys];
  }

  build(): void {
    const prof = currentProfile();
    this.sitting = false;
    this.busy = false;
    addArt(this, 0, 0, 'club.bg').setDepth(D.bg);
    // furniture
    addImage(this, 200, FLOOR_Y, 'club.lamp').setDepth(D.prop);
    addImage(this, 380, FLOOR_Y + 6, 'club.cushion').setDepth(D.prop);
    addImage(this, 380, 600, 'club.shelf').setDepth(D.wall);
    addImage(this, 380, 590, 'club.books').setDepth(D.wall);
    const chest = addImage(this, 720, FLOOR_Y + 4, 'club.chest').setDepth(D.prop);
    addImage(this, 1400, FLOOR_Y + 4, 'club.bench').setDepth(D.prop);
    addImage(this, 960, 640, 'club.shelf').setDepth(D.wall);

    this.buildDisplays(prof);

    // friends
    this.luma = new Puppet(this, 380, FLOOR_Y - 30, CAST_RIGS.luma, { seed: 21 });
    this.luma.setDepth(D.npc).setScale(0.95).setFacing(1).setExpression('calm');
    this.moss = new Puppet(this, 1240, FLOOR_Y, CAST_RIGS.moss, { seed: 22 });
    this.moss.setDepth(D.npc).setFacing(1);
    this.makeAvatar(prof.avatar);
    this.hand = new GhostHand(this);
    this.hints = new Hints(this, prof.settings.preset, () => this.demo());

    this.addTarget({ id: 'chest', label: 'Dress-up chest', bounds: () => this.rectAround(chest.x, chest.y - 120, 270, 250, 10), activate: () => this.goDo(720, () => this.openWardrobe()) });
    this.addTarget({ id: 'luma', label: 'Luma', bounds: () => this.rectAround(this.luma.x, this.luma.y - 110, 150, 230, 10), activate: () => this.goDo(this.luma.x + 120, () => void this.talkLuma(), true) });
    this.addTarget({ id: 'moss', label: 'Moss', bounds: () => this.rectAround(this.moss.x, this.moss.y - 100, 150, 210, 10), activate: () => this.goDo(this.moss.x - 140, () => void this.talkMoss(), true) });
    this.addTarget({ id: 'door', label: 'Door to the map', bounds: () => this.rectAround(1810, 690, 200, 460, 0), activate: () => this.goDo(1810, () => services.nav.openMap(), true) });

    services.hud.show(['home', 'finish', 'pause', 'replay', 'help']);
    audio.startMusic('hub');
    updateProfile((p) => (p.progress.location = { scene: 'clubhouse' }));
    this.onCleanup(() => {
      this.wardrobe?.remove();
      stopSpeech();
    });
    this.time.delayedCall(500, () => void instruct('narrator', CLUB_LINES['nar.welcome'].text, () => this.demo()));
  }

  private makeAvatar(look: AvatarLook): void {
    const x = this.avatar?.x ?? 1000;
    this.avatar?.destroy();
    this.avatar = new Puppet(this, x, FLOOR_Y + 40, avatarRig(look.species, look.color), { hat: look.hat, seed: 4 });
    this.avatar.setDepth(D.avatar);
    this.walker = new Walker(this.avatar, { groundY: () => FLOOR_Y + 40, minX: 160, maxX: 1760 });
  }

  // ------------------------------------------------------------ displays (real saved items)

  private buildDisplays(prof: ReturnType<typeof currentProfile>): void {
    // kite tail souvenir — drawn from the saved pattern + colour
    const tail = prof.progress.souvenirs['kite-tail'];
    const kx = 590;
    const ky = 400;
    if (tail) {
      const g = this.add.graphics().setDepth(D.wall);
      const kite = addImage(this, kx, ky, 'wh.kite').setDepth(D.wall + 1).setRotation(-0.15);
      const pattern = String(tail.data.pattern ?? 'stars');
      const color = choiceColor(String(tail.data.color ?? 'berry'));
      const bows = [0, 1, 2].map(() => addImage(this, 0, 0, `kite.bow.${pattern}`).setTint(hex(color)).setDepth(D.wall + 2).setScale(0.8));
      const draw = (t: number) => {
        g.clear();
        const pts: Phaser.Math.Vector2[] = [];
        for (let i = 0; i <= 10; i++) pts.push(new Phaser.Math.Vector2(kx + 10 + Math.sin(t / 700 + i * 0.6) * (6 + i * 2), ky + 70 + i * 24));
        g.lineStyle(10, hex(P.ink), 1).strokePoints(pts);
        g.lineStyle(5, hex(color), 1).strokePoints(pts);
        bows.forEach((b, i) => b.setPosition(pts[3 + i * 3].x, pts[3 + i * 3].y));
      };
      draw(0);
      this.events.on(Phaser.Scenes.Events.UPDATE, (t: number) => draw(motion.reduced ? 0 : t));
      this.kiteParts = [g, kite, ...bows];
      this.addTarget({
        id: 'kite',
        label: 'Your kite tail',
        bounds: () => this.rectAround(kx, ky + 100, 180, 360, 0),
        activate: () => {
          audio.play('flutter');
          this.tweens.add({ targets: kite, rotation: 0.2, duration: 160, yoyo: true, repeat: 2 });
          void this.line('nar.kite');
        },
      });
    } else {
      addImage(this, kx, ky, 'club.sil.kite').setDepth(D.wall);
      this.addTarget({ id: 'kite', label: 'Empty kite hook', bounds: () => this.rectAround(kx, ky, 140, 180, 10), activate: () => void this.line('nar.kiteEmpty') });
    }
    addImage(this, kx, ky - 96, 'club.peg').setDepth(D.wall + 2);

    // secret pinwheel (only appears once found — no hint that it exists)
    if (prof.progress.souvenirs.pinwheel) {
      addImage(this, 1080, 630, 'club.pot').setDepth(D.wall + 1);
      addImage(this, 1080, 560, 'wh.pinwheel.stick').setDepth(D.wall);
      this.pinwheel = addImage(this, 1080, 556, 'wh.pinwheel').setDepth(D.wall + 2);
      if (!motion.reduced) this.tweens.add({ targets: this.pinwheel, rotation: Math.PI * 2, duration: 6000, repeat: -1 });
      this.addTarget({
        id: 'pinwheel',
        label: 'Pinwheel',
        bounds: () => this.rectAround(1080, 590, 120, 160, 10),
        activate: () => {
          audio.play('whirr', { pitch: 1.6 });
          this.tweens.add({ targets: this.pinwheel, rotation: `+=${Math.PI * 6}`, duration: 1200, ease: 'Cubic.easeOut' });
          void this.line('nar.pinwheel');
        },
      });
    }

    // the displayed invention — real parts, and it still runs when tapped
    const invId = prof.progress.display.invention;
    const inv = invId ? services.save.getCreation(invId) : undefined;
    const fx = 1400;
    const fy = 470;
    addImage(this, fx, fy, 'club.frame').setDepth(D.wall).setScale(1.15, 1.05);
    if (inv && inv.profileId === prof.id && inv.kind === 'invention') {
      const disp = new InventionDisplay(this, fx, fy, 270, inv.data as InventionData);
      disp.c.setDepth(D.wall + 1);
      this.addTarget({
        id: 'frame-invention',
        label: 'Your invention',
        bounds: () => this.rectAround(fx, fy, 320, 230, 0),
        activate: () => {
          if (!disp.running) disp.play();
        },
      });
    } else {
      addImage(this, fx, fy, 'club.frame.empty').setDepth(D.wall + 1).setScale(1.15, 1.05);
      this.addTarget({ id: 'frame-invention', label: 'Empty frame', bounds: () => this.rectAround(fx, fy, 320, 230, 0), activate: () => void this.line('nar.frameEmpty') });
    }

    // the displayed picnic: the snacks the child made, on little plates along the shelf
    const picId = prof.progress.display.picnic;
    const pic = picId ? services.save.getCreation(picId) : undefined;
    const picDisp = pic && pic.profileId === prof.id && pic.kind === 'picnic' ? new PicnicDisplay(this, 960, 628, 110, pic.data as PicnicData) : null;
    if (picDisp && picDisp.count) {
      picDisp.c.setDepth(D.wall + 2);
      this.addTarget({
        id: 'shelf-picnic',
        label: 'Your picnic',
        bounds: () => this.rectAround(960, 590, 110 * picDisp.count + 40, 120, 0),
        activate: () => {
          picDisp.play();
          void this.line('nar.picnic');
        },
      });
    }

    // frames for creations from games still being built
    const frames: { id: string; x: number; y: number; ic: string }[] = [{ id: 'story', x: 1240, y: 250, ic: 'film' }];
    if (!picDisp?.count) frames.push({ id: 'picnic', x: 870, y: 600, ic: 'heart' });
    for (const f of frames) {
      const scale = f.id === 'picnic' ? 0.5 : 0.85;
      addImage(this, f.x, f.y, 'club.frame').setDepth(D.wall).setScale(scale);
      addImage(this, f.x, f.y, 'club.frame.empty').setDepth(D.wall + 1).setScale(scale);
      this.addTarget({
        id: `frame-${f.id}`,
        label: 'Empty frame',
        bounds: () => this.rectAround(f.x, f.y, 280 * scale, 220 * scale, 10),
        activate: () => void this.line(PLACES.find((pl) => pl.id === (f.id === 'story' ? 'stage' : 'picnic'))?.built ? 'nar.frameEmpty' : 'nar.frameSoon'),
      });
    }
    // souvenir pegs for adventures still to come
    [
      ['club.sil.flag', 180, 300],
      ['club.sil.wheel', 300, 300],
      ['club.sil.lantern', 420, 300],
    ].forEach(([k, x, y]) => addImage(this, x as number, y as number, k as string).setDepth(D.wall));
  }

  // ------------------------------------------------------------ interactions

  private goDo(x: number, fn: () => void, exact = false): void {
    if (this.busy) return;
    this.hints.poke();
    if (this.sitting) this.standUp();
    const target = exact ? x : x + (this.avatar.x < x ? -150 : 150);
    this.walker.walkTo(target, () => {
      this.avatar.faceToward(x);
      fn();
    });
  }

  protected override onGroundTap(x: number): void {
    this.hints.poke();
    if (this.busy) return;
    if (this.sitting) {
      this.standUp();
      return;
    }
    this.walker.walkTo(x);
  }

  protected override onArrow(dx: number, _dy: number, down: boolean): void {
    if (this.busy || this.sitting) return;
    this.walker.setHeld(down ? dx : 0);
  }

  private async talkLuma(): Promise<void> {
    this.busy = true;
    this.luma.lookAtWorld(this.avatar.x, this.avatar.y - 150);
    await this.line('luma.corner');
    const opts = [
      { id: 'sit', icon: 'quiet', label: 'Sit quietly' },
      { id: 'what', icon: 'ask', label: '“What are you reading?”' },
      { id: 'bye', icon: 'wave', label: '“Bye!”' },
    ];
    const pick = await services.choices.ask(currentProfile().settings.preset === 'more-help' ? [opts[0], opts[2]] : opts, { readAloud: true });
    this.busy = false;
    if (pick === 'sit') {
      this.sitting = true;
      this.walker.place(560);
      this.avatar.setFacing(-1);
      void this.avatar.play('sit', { expression: 'calm' });
      audio.duck(true);
      await this.line('luma.stay');
      this.luma.setExpression('calm');
    } else if (pick === 'what') {
      await this.line('luma.reading');
    } else if (pick === 'bye') {
      void this.avatar.play('wave');
      void this.luma.play('wave');
      await this.line('luma.bye');
    }
  }

  private standUp(): void {
    this.sitting = false;
    audio.duck(false);
    this.avatar.resetPose(120);
    this.avatar.setExpression('happy');
    this.avatar.y = FLOOR_Y + 40;
  }

  private async talkMoss(): Promise<void> {
    this.busy = true;
    await this.line('moss.musicbox');
    void this.moss.play('nod');
    const notes = [0, 2, 4, 2, 5, 4];
    for (let i = 0; i < notes.length; i++) {
      audio.play('chime', { note: notes[i], delay: i * 0.3 });
    }
    sparkle(this, 1390, 760, 8, D.fx);
    await new Promise((r) => this.time.delayedCall(2000, r));
    await this.line('moss.again');
    this.busy = false;
  }

  // ------------------------------------------------------------ wardrobe (DOM, picture-only)

  private openWardrobe(): void {
    if (this.wardrobe) return;
    this.busy = true;
    void this.line('nar.wardrobe');
    audio.play('open');
    const look: AvatarLook = { ...currentProfile().avatar };
    const preview = h('div', { style: 'width:220px;height:240px;display:grid;place-items:center' });
    const draw = () => (preview.innerHTML = rigSvg(avatarRig(look.species, look.color), { hat: look.hat, expression: 'excited' }));
    const group = (label: string, items: HTMLElement[]) => h('div', { role: 'group', 'aria-label': label, style: 'display:flex;gap:10px;flex-wrap:wrap;justify-content:center;margin:6px 0' }, ...items);
    const press = (list: HTMLElement[], el: HTMLElement) => list.forEach((t) => t.setAttribute('aria-pressed', String(t === el)));
    const speciesBtns: HTMLElement[] = AVATAR_SPECIES.map((s) => {
      const b = h('button', { class: 'tile', type: 'button', 'aria-label': s.name, 'aria-pressed': String(s.id === look.species), style: 'width:92px;min-height:92px;padding:4px', html: rigSvg(avatarRig(s.id, look.color), { crop: 'head' }) });
      b.addEventListener('click', () => {
        look.species = s.id as AvatarSpecies;
        press(speciesBtns, b);
        audio.play('pop');
        draw();
      });
      return b;
    });
    const colorBtns: HTMLElement[] = CHOICE_COLORS.map((c) => {
      const b = h('button', { class: 'swatch', type: 'button', 'aria-label': c.name, 'aria-pressed': String(c.id === look.color), style: `background:${c.hex}` });
      b.addEventListener('click', () => {
        look.color = c.id;
        press(colorBtns, b);
        audio.play('tap');
        draw();
      });
      return b;
    });
    const hatBtns: HTMLElement[] = [{ id: '', name: 'No hat' }, ...HATS].map((hat) => {
      const b = h('button', {
        class: 'tile',
        type: 'button',
        'aria-label': hat.name,
        'aria-pressed': String((look.hat ?? '') === hat.id),
        style: 'width:84px;min-height:84px;padding:6px',
        html: hat.id ? pieceSvg(hat.id) : icon('no', 56),
      });
      b.addEventListener('click', () => {
        look.hat = hat.id || null;
        press(hatBtns, b);
        audio.play('pop', { pitch: 1.2 });
        draw();
      });
      return b;
    });
    const done = h('button', { class: 'btn primary', type: 'button', 'aria-label': 'Done', html: icon('check'), 'data-wardrobe-done': true });
    const panel = h(
      'div',
      { class: 'panel', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Dress-up chest', style: 'display:flex;gap:16px;align-items:center;flex-wrap:wrap;justify-content:center;max-width:min(980px,calc(100vw - 24px))' },
      preview,
      h('div', { style: 'flex:1;min-width:280px' }, group('Explorer', speciesBtns), group('Colour', colorBtns), group('Hat', hatBtns)),
      done,
    );
    const overlay = h('div', { class: 'overlay' }, panel);
    services.layers.overlay.append(overlay);
    this.wardrobe = overlay;
    draw();
    const release = trapFocus(panel);
    done.addEventListener('click', () => {
      release();
      overlay.remove();
      this.wardrobe = undefined;
      this.busy = false;
      audio.play('success');
      updateProfile((p) => (p.avatar = { ...look }));
      this.makeAvatar(look);
      sparkle(this, this.avatar.x, this.avatar.y - 120, 14, D.fx);
      void this.avatar.play('cheer', { expression: 'excited' });
    });
  }

  // ------------------------------------------------------------ misc

  private line(id: ClubLineId): Promise<void> {
    const l = CLUB_LINES[id];
    const sp = l.speaker as Speaker;
    const puppet = sp === 'luma' ? this.luma : sp === 'moss' ? this.moss : undefined;
    if (puppet && 'mood' in l && l.mood) puppet.setExpression(l.mood);
    return say(sp, l.text, { puppet });
  }

  private demo(): void {
    void this.hand.tapAt(720, FLOOR_Y - 120, 2);
  }

  override hint(): void {
    this.hints.request();
  }

  protected override tick(_t: number, delta: number): void {
    if (!this.sitting) this.walker.update(delta);
  }

  override inspect(): Record<string, unknown> {
    return { sitting: this.sitting, wardrobe: !!this.wardrobe, hasKite: this.kiteParts.length > 0, hasInvention: this.targets.get('frame-invention')?.label === 'Your invention', hasPicnic: this.targets.has('shelf-picnic'), avatarX: Math.round(this.avatar?.x ?? 0) };
  }
}
