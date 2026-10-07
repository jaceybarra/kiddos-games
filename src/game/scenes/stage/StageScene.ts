import Phaser from 'phaser';
import { WWScene } from '../../WWScene';
import { GhostHand } from '../../systems/GhostHand';
import { Hints } from '../../systems/Hints';
import { sparkle } from '../../systems/fx';
import { StagePlayer, puppetPortrait, rigFor, type StageCast } from '../../displays/StagePlayer';
import { addArt, addImage } from '../../../art/rasterize';
import { registerPieces, pieceSvg } from '../../../art/registry';
import { STAGE_PIECES } from '../../../art/scenes/stage';
import { CAST_RIGS, avatarRig, rigArtKeys, type CastId } from '../../../art/cast';
import { rigSvg } from '../../../art/portrait';
import { HATS } from '../../../art/cast/hats';
import {
  ACTIONS,
  BACKDROPS,
  FACES,
  INTENTS,
  LIMITS,
  PROPS,
  PUPPET_REFS,
  SFX,
  SIMPLE_ACTIONS,
  SIMPLE_FACES,
  SIMPLE_SFX,
  STAGE,
  TEMPLATES,
  addActor,
  addEnding,
  addScene,
  clampToStage,
  finalActors,
  maxScenes,
  newStory,
  placeActor,
  record,
  removeActor,
  removeEnding,
  removeScene,
  setMode,
  templateOpening,
  updateActor,
  validStory,
  type ActionId,
  type BackdropId,
  type IntentId,
  type PropId,
  type PuppetRef,
  type SfxId,
  type StageEvent,
  type StageScene as SceneData,
  type Story,
  type TemplateId,
} from '../../../content/stage/stageModel';
import { STAGE_GUIDE, STAGE_LINES, type StageLineId } from '../../../content/stage/stageLines';
import { services, currentProfile, currentPreset, updateProfile } from '../../../app/services';
import { say, instruct, stopSpeech } from '../../../app/speech';
import { audio } from '../../../core/audio';
import { motion } from '../../../core/motion';
import { h, trapFocus } from '../../../ui/dom';
import { icon } from '../../../ui/icons';
import { iconDialog, toast } from '../../../ui/overlays';
import { openShelf } from '../../../ui/shelf';
import type { Expression } from '../../../art/cast/face';

registerPieces(STAGE_PIECES);

/** Where the stage window sits in the world (stage units are 1:1 with world units). */
const SX = 260;
const SY = 100;
const D = { room: 0, stage: 5, curtain: 30, frame: 35, fx: 60, ui: 70 };

const ACTION_ICON: Record<ActionId, string> = { wave: 'wave', jump: 'jump', dance: 'music', bow: 'bow', think: 'thought', cheer: 'star', hide: 'hide', sleep: 'zzz', point: 'next', shrug: 'ask', stomp: 'foot', clap: 'hand' };
const SFX_ICON: Record<SfxId, string> = { drum: 'music', boing: 'jump', whoosh: 'swap', splash: 'explore', sparkle: 'star', pop: 'plus', bell: 'turn', creak: 'home', chirp: 'wave', croak: 'speaker' };
const TEMPLATE_NAME: Record<TemplateId, string> = { 'wrong-house': 'The wrong house', 'two-explorers': 'Two explorers', invention: 'The invention', 'join-game': 'Can I play?', blank: 'Empty stage' };

/** A stage event before it gets its time stamp. */
type EventInput = StageEvent extends infer E ? (E extends StageEvent ? Omit<E, 't'> : never) : never;

type Drawer = 'backdrop' | 'puppets' | 'props' | 'sounds' | 'lines' | 'faces' | 'intents' | null;

/**
 * Story Stage: a puppet theatre. Put puppets and props on the stage, press
 * the red button and act it out; the stage remembers what happened (game
 * events only, no microphone or camera) and plays it back as a show.
 */
export default class StageScene extends WWScene {
  readonly artGroup = 'stage';
  private story: Story = newStory('blank', 'simple');
  private sceneIx = 0;
  /** -1 = a regular scene; 0/1 = editing an alternate ending */
  private endingIx = -1;
  private player!: StagePlayer;
  private cast!: StageCast;
  private selected: string | null = null;
  private selRing?: Phaser.GameObjects.Ellipse;
  private rec: { start: number; offset: number; last: number } | null = null;
  private recLight?: Phaser.GameObjects.Image;
  private tape?: Phaser.GameObjects.Graphics;
  private curtains: Phaser.GameObjects.Image[] = [];
  private showing = false;
  private editingId: string | null = null;
  private drag: { id: string; sx: number; sy: number; moved: boolean } | null = null;
  private justDragged = false;
  private left?: HTMLElement;
  private right?: HTMLElement;
  private strip?: HTMLElement;
  private bar?: HTMLElement;
  private drawerEl?: HTMLElement;
  private drawer: Drawer = null;
  private overlay?: HTMLElement;
  private closeShelf?: () => void;
  private hand!: GhostHand;
  private hints!: Hints;

  constructor() {
    super('stage');
  }

  artKeys(): string[] {
    const keys = new Set<string>(STAGE_PIECES.map((p) => p.key));
    for (const id of ['pip', 'moss', 'fizz', 'luma', 'rowan'] as CastId[]) for (const k of rigArtKeys(CAST_RIGS[id])) keys.add(k);
    const prof = currentProfile();
    for (const k of rigArtKeys(avatarRig(prof.avatar.species, prof.avatar.color))) keys.add(k);
    for (const k of rigArtKeys(avatarRig('frog', 'plum'))) keys.add(k);
    for (const hat of HATS) keys.add(hat.id);
    return [...keys];
  }

  // ================================================================ build

  build(): void {
    const prof = currentProfile();
    this.cast = { me: { rig: avatarRig(prof.avatar.species, prof.avatar.color), hat: prof.avatar.hat } };
    addArt(this, 0, 0, 'st.room').setDepth(D.room);
    this.player = new StagePlayer(this, SX, SY, 1, this.cast);
    this.player.c.setDepth(D.stage);
    // no mask needed: the opaque frame is drawn on top and hides anything past the window
    addImage(this, 0, 0, 'st.frame').setDepth(D.frame);
    const cl = addImage(this, SX, SY, 'st.curtain').setDepth(D.curtain);
    const cr = addImage(this, SX + STAGE.w, SY, 'st.curtain').setDepth(D.curtain).setScale(-1, 1);
    this.curtains = [cl, cr];
    this.openCurtains(true);
    addImage(this, SX, SY, 'st.valance').setDepth(D.curtain + 1);
    this.recLight = addImage(this, SX + STAGE.w - 90, SY + 50, 'st.rec').setDepth(D.fx).setVisible(false);
    this.tape = this.add.graphics().setDepth(D.fx);
    this.selRing = this.add.ellipse(0, 0, 170, 40, 0xffe7a3, 0.55).setDepth(D.stage).setVisible(false).setStrokeStyle(5, 0x3b2a20);
    this.hand = new GhostHand(this);
    this.hints = new Hints(this, currentPreset('stage'), () => this.demo());
    this.input.on('pointerdown', this.onDown, this);
    this.input.on('pointermove', this.onMove, this);
    this.input.on('pointerup', this.onUp, this);
    this.addTarget({
      id: 'floor',
      label: 'Stage floor',
      priority: 9,
      bounds: () => new Phaser.Geom.Rectangle(SX, SY + STAGE.floorMin - 80, STAGE.w, STAGE.floorMax - STAGE.floorMin + 110),
      enabled: () => !!this.selected && !this.showing && !this.drawer,
      activate: () => {
        const tp = this.tapPoint;
        if (tp) this.walkSelected(tp.x - SX, tp.y - SY);
      },
    });
    this.buildDom();
    audio.startMusic('stage');
    services.hud.show(['home', 'finish', 'pause', 'replay', 'help']);
    this.onCleanup(() => {
      this.player.destroy();
      for (const el of [this.left, this.right, this.strip, this.bar, this.drawerEl, this.overlay]) el?.remove();
      this.closeShelf?.();
      services.choices.cancel();
      stopSpeech();
    });
    const draft = this.readDraft();
    if (draft) {
      this.story = draft.story;
      this.sceneIx = Math.min(draft.scene, this.story.scenes.length - 1);
      this.editingId = draft.editingId;
      this.loadScene();
    } else {
      this.loadScene();
      this.time.delayedCall(250, () => this.openPicker(true));
    }
  }

  // ================================================================ story data

  private current(): SceneData {
    return this.endingIx >= 0 ? this.story.endings[this.endingIx] : this.story.scenes[this.sceneIx];
  }

  private setCurrent(sc: SceneData): void {
    if (this.endingIx >= 0) {
      const endings = [...this.story.endings];
      endings[this.endingIx] = sc;
      this.story = { ...this.story, endings };
    } else {
      const scenes = [...this.story.scenes];
      scenes[this.sceneIx] = sc;
      this.story = { ...this.story, scenes };
    }
    this.saveDraft();
  }

  private readDraft(): { story: Story; scene: number; editingId: string | null } | null {
    const raw = currentProfile().progress.quests['stage-draft']?.flags.draft;
    if (typeof raw !== 'string') return null;
    try {
      const d = JSON.parse(raw) as { story: unknown; scene: number; editingId: string | null };
      return validStory(d.story) ? { story: d.story, scene: Number(d.scene) || 0, editingId: typeof d.editingId === 'string' ? d.editingId : null } : null;
    } catch {
      return null;
    }
  }

  private saveDraft(): void {
    const draft = JSON.stringify({ story: this.story, scene: this.sceneIx, editingId: this.editingId });
    updateProfile((p) => {
      p.progress.quests['stage-draft'] = { status: 'active', checkpoint: 'draft', flags: { draft }, completions: p.progress.quests['stage-draft']?.completions ?? 0 };
      p.progress.location = { scene: 'stage' };
    });
  }

  private loadScene(): void {
    this.stopRecording(false);
    this.select(null);
    this.player.build(this.current());
    this.syncTargets();
    this.renderStrip();
    this.updateTools();
  }

  /** One tap target per actor (keyboard users can Tab to each one). */
  private syncTargets(): void {
    for (const t of [...this.targets.keys()]) if (t.startsWith('actor-')) this.removeTarget(t);
    for (const [id, o] of this.player.objs) {
      this.addTarget({
        id: `actor-${id}`,
        label: o.actor.kind === 'puppet' ? `${o.actor.ref} puppet` : `${o.actor.ref}`,
        priority: 4,
        bounds: () => this.player.bounds(id),
        enabled: () => !this.showing && !this.drawer,
        activate: () => {
          if (this.justDragged) return;
          this.select(this.selected === id ? null : id);
        },
      });
    }
  }

  // ================================================================ picking a story start

  private openPicker(first: boolean): void {
    this.overlay?.remove();
    const preset = currentPreset('stage');
    const cards = TEMPLATES.map((t) => {
      const sc = templateOpening(t);
      const heads = sc.actors.filter((a) => a.kind === 'puppet').map((a) => puppetPortrait(a.ref as PuppetRef, this.cast));
      return h(
        'button',
        {
          class: 'tile',
          type: 'button',
          'data-template': t,
          'aria-label': TEMPLATE_NAME[t],
          style: 'width:190px;min-height:170px;position:relative',
          on: {
            click: () => {
              audio.play('confirm');
              close();
              this.story = newStory(t, preset === 'more-help' ? 'simple' : 'full');
              this.sceneIx = 0;
              this.endingIx = -1;
              this.editingId = null;
              this.saveDraft();
              this.loadScene();
              void this.showOpening();
            },
          },
        },
        h('span', { html: pieceSvg(`st.bg.${sc.backdrop}`), style: 'width:160px;height:82px;display:block;border-radius:10px;overflow:hidden;border:3px solid #3b2a20' }),
        h('span', { style: 'display:flex;gap:2px;height:52px' }, ...heads.slice(0, 3).map((f) => h('span', { html: f, style: 'width:50px;height:50px;display:block' }))),
      );
    });
    const shelfBtn = h('button', { class: 'tile', type: 'button', 'data-mystories': true, 'aria-label': 'My stories', style: 'width:190px;min-height:170px', html: icon('shelf', 96), on: { click: () => { close(); this.openStories(); } } });
    const panel = h('div', { class: 'panel', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Start a story', style: 'max-width:min(1100px, calc(100vw - 32px))' }, h('div', { class: 'big-choices' }, ...cards, shelfBtn));
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
    if (first) void this.guide('welcome');
  }

  /** A template's first scene plays once so the child sees how the story starts (never how it ends). */
  private async showOpening(): Promise<void> {
    if (!this.current().events.length) {
      void this.guide('arrange', true);
      return;
    }
    await this.playScene();
    void this.guide('nextScene', true);
  }

  // ================================================================ DOM: tools, strip, drawers, action bar

  private btn(ic: string, label: string, fn: () => void, attr: string, extra: Record<string, unknown> = {}): HTMLButtonElement {
    return h('button', { class: 'btn-round', type: 'button', 'aria-label': label, title: label, html: icon(ic), [attr]: true, ...extra, on: { click: () => { audio.play('tap'); this.hints.poke(); fn(); } } });
  }

  private buildDom(): void {
    this.left = h(
      'div',
      { class: 'stage-tools left', role: 'toolbar', 'aria-label': 'Put things on the stage' },
      this.btn('picture', 'Backdrop', () => this.openDrawer('backdrop'), 'data-tool-backdrop'),
      this.btn('puppet', 'Puppets', () => this.openDrawer('puppets'), 'data-tool-puppets'),
      this.btn('chest', 'Props', () => this.openDrawer('props'), 'data-tool-props'),
      this.btn('speaker', 'Sounds', () => this.openDrawer('sounds'), 'data-tool-sounds'),
    );
    this.right = h(
      'div',
      { class: 'stage-tools right', role: 'toolbar', 'aria-label': 'Show' },
      this.btn('record', 'Act it out', () => void this.toggleRecord(), 'data-record'),
      this.btn('play', 'Watch this scene', () => void this.playScene(), 'data-play'),
      this.btn('film', 'Watch the whole show', () => void this.playShow(), 'data-show'),
      this.btn('save', 'Put on my shelf', () => void this.saveStory(), 'data-save'),
      this.btn('shelf', 'My stories', () => this.openStories(), 'data-stories'),
      this.btn('scenes3', 'Simple or big stage', () => this.toggleMode(), 'data-mode'),
    );
    this.strip = h('div', { class: 'stage-strip', role: 'toolbar', 'aria-label': 'Scenes' });
    services.layers.choices.append(this.left, this.right, this.strip);
  }

  private updateTools(): void {
    const recBtn = this.right?.querySelector('[data-record]') as HTMLElement | null;
    if (recBtn) {
      recBtn.innerHTML = icon(this.rec ? 'stop' : 'record');
      recBtn.classList.toggle('rec-on', !!this.rec);
      recBtn.setAttribute('aria-label', this.rec ? 'Cut! Stop acting' : 'Act it out');
    }
    const mode = this.right?.querySelector('[data-mode]') as HTMLElement | null;
    if (mode) mode.innerHTML = icon(this.story.mode === 'simple' ? 'scenes3' : 'scenes6');
    for (const b of this.left?.querySelectorAll<HTMLButtonElement>('button') ?? []) b.disabled = !!this.rec && !b.hasAttribute('data-tool-sounds');
    const hidden = this.showing;
    for (const el of [this.left, this.right, this.strip, this.bar]) if (el) el.hidden = hidden;
  }

  private renderStrip(): void {
    const strip = this.strip;
    if (!strip) return;
    const card = (sc: SceneData, i: number, ending: boolean) => {
      const current = ending ? this.endingIx === i : this.endingIx < 0 && this.sceneIx === i;
      return h(
        'button',
        {
          class: `scene-card${ending ? ' ending' : ''}`,
          type: 'button',
          'aria-current': String(current),
          'aria-label': ending ? `Ending ${i + 1}` : `Scene ${i + 1}`,
          [ending ? 'data-ending' : 'data-scene']: String(i),
          on: { click: () => this.goScene(i, ending) },
        },
        h('span', { html: pieceSvg(`st.bg.${sc.backdrop}`), style: 'display:block;width:100%;height:100%' }),
        h('span', { class: 'num' }, ...Array.from({ length: i + 1 }, () => h('i', {}))),
        sc.events.length ? h('span', { class: 'rec' }) : null,
        ending ? h('span', { class: 'badge', html: icon('branch') }) : null,
      );
    };
    const items: HTMLElement[] = this.story.scenes.map((sc, i) => card(sc, i, false));
    if (this.story.mode === 'full') {
      if (this.story.scenes.length < maxScenes(this.story)) items.push(h('button', { class: 'scene-card add', type: 'button', 'aria-label': 'Add a scene', 'data-add-scene': true, html: icon('plus'), on: { click: () => this.newScene() } }));
      this.story.endings.forEach((sc, i) => items.push(card(sc, i, true)));
      if (this.story.endings.length < LIMITS.endings) items.push(h('button', { class: 'scene-card add ending', type: 'button', 'aria-label': 'Add another ending', 'data-add-ending': true, html: icon('branch'), on: { click: () => this.newEnding() } }));
      const canDelete = this.endingIx >= 0 || this.story.scenes.length > 1;
      if (canDelete) items.push(h('button', { class: 'btn-round', type: 'button', 'aria-label': 'Throw away this scene', 'data-del-scene': true, html: icon('trash'), style: '--btn:58px', on: { click: () => void this.deleteScene() } }));
    }
    strip.replaceChildren(...items);
  }

  private goScene(i: number, ending: boolean): void {
    if (this.showing) return;
    this.hints.poke();
    this.closeDrawer();
    this.stopRecording(true);
    this.sceneIx = ending ? this.sceneIx : i;
    this.endingIx = ending ? i : -1;
    audio.play('paper');
    this.saveDraft();
    this.loadScene();
  }

  private newScene(): void {
    this.story = addScene(this.story, this.endingIx >= 0 ? this.story.scenes.length - 1 : this.sceneIx);
    const at = this.endingIx >= 0 ? this.story.scenes.length - 1 : this.sceneIx + 1;
    this.goScene(Math.min(at, this.story.scenes.length - 1), false);
  }

  private newEnding(): void {
    this.story = addEnding(this.story);
    this.goScene(this.story.endings.length - 1, true);
  }

  private async deleteScene(): Promise<void> {
    const sc = this.current();
    if (sc.events.length || sc.actors.length) {
      const pick = await iconDialog(services.layers.overlay, {
        art: `<span style="display:block;width:240px;height:124px;border:3px solid #3b2a20;border-radius:12px;overflow:hidden">${pieceSvg(`st.bg.${sc.backdrop}`)}</span>`,
        buttons: [
          { id: 'keep', icon: 'back', label: 'Keep it', kind: 'go' },
          { id: 'delete', icon: 'trash', label: 'Throw away', kind: 'danger' },
        ],
        safeId: 'keep',
      });
      if (pick !== 'delete') return;
    }
    if (this.endingIx >= 0) {
      this.story = removeEnding(this.story, this.endingIx);
      this.endingIx = -1;
    } else {
      this.story = removeScene(this.story, this.sceneIx);
      this.sceneIx = Math.max(0, this.sceneIx - 1);
    }
    this.saveDraft();
    this.loadScene();
  }

  private toggleMode(): void {
    const to = this.story.mode === 'simple' ? 'full' : 'simple';
    this.story = setMode(this.story, to);
    this.endingIx = -1;
    this.sceneIx = Math.min(this.sceneIx, this.story.scenes.length - 1);
    audio.play('zip');
    this.saveDraft();
    this.loadScene();
  }

  private simple(): boolean {
    return this.story.mode === 'simple';
  }

  private openDrawer(kind: Exclude<Drawer, null>): void {
    if (this.showing) return;
    if (this.drawer === kind) return this.closeDrawer();
    this.closeDrawer();
    this.drawer = kind;
    const tiles: HTMLElement[] = [];
    const tile = (attr: string, value: string, label: string, art: string, fn: () => void, cls = '') =>
      h('button', { class: `tile ${cls}`, type: 'button', 'aria-label': label, title: label, [attr]: value, html: art, on: { click: () => { audio.play('tap'); this.hints.poke(); fn(); } } });
    if (kind === 'backdrop') {
      for (const b of BACKDROPS) tiles.push(tile('data-backdrop', b, b, `<span style="display:block;width:100px;height:52px;border-radius:8px;overflow:hidden;border:3px solid #3b2a20">${pieceSvg(`st.bg.${b}`)}</span>`, () => this.setBackdrop(b), 'wide'));
    } else if (kind === 'puppets') {
      const on = new Set(this.current().actors.map((a) => a.ref));
      for (const p of PUPPET_REFS) tiles.push(tile('data-puppet', p, p === 'me' ? 'You' : p, puppetPortrait(p, this.cast), () => this.addThing('puppet', p), on.has(p) ? 'used' : ''));
    } else if (kind === 'props') {
      for (const p of PROPS) tiles.push(tile('data-prop', p, p, pieceSvg(`st.p.${p}`), () => this.addThing('prop', p)));
    } else if (kind === 'sounds') {
      for (const s of this.simple() ? SIMPLE_SFX : SFX) tiles.push(tile('data-sfx', s, s, icon(SFX_ICON[s], 70), () => this.playSfx(s)));
    } else if (kind === 'lines') {
      const lines = Object.entries(STAGE_LINES).filter(([, l]) => !this.simple() || ('simple' in l && l.simple));
      for (const [id, l] of lines) tiles.push(h('button', { class: 'tile line', type: 'button', 'aria-label': l.text, 'data-line': id, on: { click: () => { this.hints.poke(); this.sayLine(id as StageLineId); } } }, h('span', { html: icon(l.icon) }), h('span', {}, l.text)));
    } else if (kind === 'faces') {
      const a = this.selectedActor();
      if (!a) return;
      for (const f of this.simple() ? SIMPLE_FACES : FACES) tiles.push(tile('data-face', f, f, rigSvg(rigFor(a.ref as PuppetRef, this.cast), { crop: 'head', expression: f, hat: a.ref === 'me' ? this.cast.me.hat : null }), () => this.setFace(f)));
    } else if (kind === 'intents') {
      tiles.push(tile('data-intent', 'none', 'Nothing in particular', icon('close', 60), () => this.setIntent(undefined)));
      for (const i of INTENTS) tiles.push(tile('data-intent', i, i, `<span style="display:block;width:70px;height:70px">${pieceSvg(`st.i.${i}`)}</span>`, () => this.setIntent(i)));
    }
    const close = h('button', { class: 'btn-round close', type: 'button', 'aria-label': 'Close', html: icon('close'), 'data-drawer-close': true, on: { click: () => this.closeDrawer() } });
    this.drawerEl = h('div', { class: 'drawer', role: 'dialog', 'aria-label': kind }, ...tiles, close);
    services.layers.choices.append(this.drawerEl);
    if (this.strip) this.strip.hidden = true;
    if (this.bar) this.bar.hidden = true;
    (this.drawerEl.querySelector('button') as HTMLButtonElement | null)?.focus({ preventScroll: true });
  }

  private closeDrawer(): void {
    this.drawerEl?.remove();
    this.drawerEl = undefined;
    this.drawer = null;
    if (!this.showing) {
      if (this.selected) this.renderBar();
      else if (this.strip) this.strip.hidden = false;
    }
  }

  private renderBar(): void {
    this.bar?.remove();
    this.bar = undefined;
    const a = this.selectedActor();
    if (!a) {
      if (this.strip) this.strip.hidden = this.showing || !!this.drawer;
      return;
    }
    if (this.strip) this.strip.hidden = true;
    const items: HTMLElement[] = [];
    const who = a.kind === 'puppet' ? puppetPortrait(a.ref as PuppetRef, this.cast) : pieceSvg(`st.p.${a.ref}`);
    items.push(h('span', { class: 'who', html: who }));
    if (a.kind === 'puppet') {
      for (const act of this.simple() ? SIMPLE_ACTIONS : ACTIONS) items.push(this.btn(ACTION_ICON[act], act, () => this.doAction(act), 'data-act', { 'data-act': act }));
      items.push(h('span', { class: 'sep' }));
      items.push(this.btn('ask', 'Say something', () => this.openDrawer('lines'), 'data-say'));
      items.push(this.btn('smile', 'Make a face', () => this.openDrawer('faces'), 'data-faces'));
      if (!this.simple()) items.push(this.btn('thought', 'What do they want?', () => this.openDrawer('intents'), 'data-intents'));
    } else {
      items.push(this.btn('star', 'Use it', () => this.doAction('use'), 'data-act', { 'data-act': 'use' }));
    }
    items.push(this.btn('flip', 'Turn around', () => this.turnSelected(), 'data-turn'));
    items.push(this.btn('trash', 'Take off the stage', () => void this.removeSelected(), 'data-remove'));
    items.push(this.btn('close', 'Done', () => this.select(null), 'data-deselect'));
    this.bar = h('div', { class: 'stage-bar', role: 'toolbar', 'aria-label': 'Puppet actions' }, ...items);
    this.bar.hidden = this.showing || !!this.drawer;
    services.layers.choices.append(this.bar);
  }

  // ================================================================ editing the stage

  private selectedActor() {
    return this.selected ? this.player.objs.get(this.selected)?.actor ?? null : null;
  }

  private select(id: string | null): void {
    this.selected = id && this.player.objs.has(id) ? id : null;
    if (this.selected) audio.play('pickup');
    this.drawSelection();
    this.renderBar();
  }

  private drawSelection(): void {
    const o = this.selected ? this.player.objs.get(this.selected) : undefined;
    if (!o || this.showing) {
      this.selRing?.setVisible(false);
      return;
    }
    this.selRing?.setVisible(true).setPosition(SX + o.obj.x, SY + o.obj.y + 4);
  }

  private setBackdrop(b: BackdropId): void {
    this.setCurrent({ ...this.current(), backdrop: b });
    this.player.setBackdrop(b);
    this.closeDrawer();
    this.renderStrip();
    audio.play('whoosh');
  }

  private addThing(kind: 'puppet' | 'prop', ref: PuppetRef | PropId): void {
    const sc = this.current();
    if (kind === 'puppet' && sc.actors.some((a) => a.ref === ref)) {
      const existing = sc.actors.find((a) => a.ref === ref)!;
      this.closeDrawer();
      this.select(existing.id);
      void this.guide('alreadyOn');
      return;
    }
    if (sc.actors.length >= LIMITS.actors) {
      this.closeDrawer();
      void this.guide('stageFull');
      return;
    }
    // spread new arrivals across the stage so they don't pile up
    const n = sc.actors.length;
    const x = 260 + ((n * 230) % 900);
    const y = kind === 'puppet' ? 640 - (n % 2) * 40 : 660;
    const r = addActor(sc, kind, ref, x, y);
    if (!r.id) return;
    this.setCurrent(r.scene);
    const a = r.scene.actors.find((q) => q.id === r.id)!;
    const o = this.player.addActor(a);
    this.syncTargets();
    audio.play('pop');
    if (!motion.reduced) {
      o.obj.setAlpha(0).y -= 60;
      this.tweens.add({ targets: o.obj, alpha: 1, y: a.y, duration: 300, ease: 'Back.easeOut' });
    }
    this.closeDrawer();
    this.select(r.id);
    this.renderStrip();
  }

  private async removeSelected(): Promise<void> {
    const id = this.selected;
    if (!id) return;
    const sc = this.current();
    if (sc.events.some((e) => e.a !== 'sfx' && e.id === id)) {
      const a = this.selectedActor()!;
      const pick = await iconDialog(services.layers.overlay, {
        art: `<span style="display:block;width:120px;height:120px">${a.kind === 'puppet' ? puppetPortrait(a.ref as PuppetRef, this.cast) : pieceSvg(`st.p.${a.ref}`)}</span>`,
        buttons: [
          { id: 'keep', icon: 'back', label: 'Keep them', kind: 'go' },
          { id: 'delete', icon: 'trash', label: 'Take them off', kind: 'danger' },
        ],
        safeId: 'keep',
      });
      if (pick !== 'delete') return;
    }
    this.setCurrent(removeActor(this.current(), id));
    this.player.removeActor(id);
    this.select(null);
    this.syncTargets();
    this.renderStrip();
    audio.play('swish');
  }

  // ---------------------------------------------------------------- performing (recorded while acting)

  private recordEvent(e: EventInput): void {
    const r = this.rec;
    if (!r) return;
    let t = this.time.now - r.start - r.offset;
    // long pauses are shortened so the show never drags
    if (t - r.last > 2000) {
      r.offset += t - r.last - 2000;
      t = this.time.now - r.start - r.offset;
    }
    r.last = t;
    const res = record(this.current().events, { ...(e as StageEvent), t: Math.round(t) });
    this.setCurrent({ ...this.current(), events: res.events });
    if (res.full) {
      void this.guide('full');
      this.stopRecording(true);
    }
  }

  private doAction(act: ActionId | 'use'): void {
    const id = this.selected;
    if (!id) return;
    this.player.act(id, act);
    this.recordEvent({ a: 'act', id, act });
    if (act === 'use' && !this.rec) {
      // outside acting, using a toggling prop sets how it starts
      const a = this.player.objs.get(id)!.actor;
      this.setCurrent(updateActor(this.current(), id, { on: a.on }));
    }
  }

  private sayLine(line: StageLineId): void {
    const id = this.selected;
    this.closeDrawer();
    if (!id) return;
    void this.player.sayLine(id, line);
    this.recordEvent({ a: 'say', id, line });
  }

  private setFace(f: Expression): void {
    const id = this.selected;
    this.closeDrawer();
    if (!id) return;
    this.player.face(id, f);
    if (this.rec) this.recordEvent({ a: 'face', id, face: f });
    else this.setCurrent(updateActor(this.current(), id, { face: f }));
  }

  private setIntent(i: IntentId | undefined): void {
    const id = this.selected;
    this.closeDrawer();
    if (!id) return;
    this.player.setIntent(id, i);
    this.setCurrent(updateActor(this.current(), id, { intent: i }));
    audio.play('pop');
  }

  private turnSelected(): void {
    const id = this.selected;
    if (!id) return;
    const a = this.player.objs.get(id)!.actor;
    const f = (a.facing === 1 ? -1 : 1) as 1 | -1;
    this.player.turn(id, f);
    if (this.rec) this.recordEvent({ a: 'turn', id, facing: f });
    else this.setCurrent(updateActor(this.current(), id, { facing: f }));
  }

  private playSfx(s: SfxId): void {
    this.player.sfx(s);
    this.recordEvent({ a: 'sfx', sfx: s });
  }

  /** Tap an empty spot on the floor: the selected puppet walks there (no dragging needed). */
  private walkSelected(x: number, y: number): void {
    const id = this.selected;
    if (!id) return;
    this.hints.poke();
    const p = clampToStage(x, y);
    const o = this.player.objs.get(id)!;
    const dist = Math.hypot(p.x - o.obj.x, p.y - o.obj.y);
    this.player.move(id, p.x, p.y, Math.min(1800, Math.max(250, dist * 2.2)), o.actor.kind === 'puppet');
    this.time.delayedCall(Math.min(1800, Math.max(250, dist * 2.2)) + 20, () => this.drawSelection());
    this.selRing?.setVisible(false);
    this.commitMove(id, p.x, p.y);
  }

  private commitMove(id: string, x: number, y: number): void {
    if (this.rec) this.recordEvent({ a: 'move', id, x, y });
    else this.setCurrent(placeActor(this.current(), id, x, y));
  }

  protected override onArrow(dx: number, dy: number, down: boolean): void {
    if (!down || !this.selected || this.showing) return;
    const o = this.player.objs.get(this.selected)!;
    const p = clampToStage(o.obj.x + dx * 40, o.obj.y + dy * 25);
    this.player.move(this.selected, p.x, p.y, 120);
    this.commitMove(this.selected, p.x, p.y);
    this.time.delayedCall(140, () => this.drawSelection());
  }

  // ---------------------------------------------------------------- dragging (one way to move; tapping the floor is the other)

  private actorAt(wx: number, wy: number): string | null {
    let best: { id: string; y: number } | null = null;
    for (const [id, o] of this.player.objs) {
      if (!this.player.bounds(id).contains(wx, wy)) continue;
      if (!best || o.obj.y > best.y) best = { id, y: o.obj.y };
    }
    return best?.id ?? null;
  }

  private onDown(p: Phaser.Input.Pointer): void {
    this.justDragged = false;
    if (this.showing || this.drawer || !this.ready) return;
    const id = this.actorAt(p.worldX, p.worldY);
    if (id) this.drag = { id, sx: p.worldX, sy: p.worldY, moved: false };
  }

  private onMove(p: Phaser.Input.Pointer): void {
    const d = this.drag;
    if (!d || !p.isDown) return;
    if (!d.moved && Math.hypot(p.worldX - d.sx, p.worldY - d.sy) < 30) return;
    if (!d.moved) {
      d.moved = true;
      if (this.selected !== d.id) this.select(d.id);
    }
    const pos = clampToStage(p.worldX - SX, p.worldY - SY + 40);
    this.player.move(d.id, pos.x, pos.y);
    this.drawSelection();
    if (this.rec) this.recordEvent({ a: 'move', id: d.id, x: pos.x, y: pos.y });
  }

  private onUp(): void {
    const d = this.drag;
    this.drag = null;
    if (!d?.moved) return;
    this.justDragged = true;
    const o = this.player.objs.get(d.id);
    if (o && !this.rec) this.setCurrent(placeActor(this.current(), d.id, o.obj.x, o.obj.y));
    audio.play('place');
  }

  // ================================================================ acting it out (recording) and watching

  private async toggleRecord(): Promise<void> {
    if (this.showing) return;
    if (this.rec) return this.stopRecording(true);
    const sc = this.current();
    if (sc.events.length) {
      const pick = await iconDialog(services.layers.overlay, {
        buttons: [
          { id: 'keep', icon: 'back', label: 'Keep what I made', kind: 'go' },
          { id: 'again', icon: 'record', label: 'Act it again' },
        ],
        safeId: 'keep',
      });
      if (pick !== 'again') return;
    }
    this.closeDrawer();
    // start from the scene's starting positions
    this.setCurrent({ ...this.current(), events: [] });
    const sel = this.selected;
    this.player.build(this.current());
    this.syncTargets();
    this.selected = sel && this.player.objs.has(sel) ? sel : null;
    this.renderBar();
    this.drawSelection();
    this.rec = { start: this.time.now, offset: 0, last: 0 };
    audio.play('ding');
    this.recLight?.setVisible(true);
    if (!motion.reduced) this.tweens.add({ targets: this.recLight, alpha: 0.4, duration: 600, yoyo: true, repeat: -1 });
    this.updateTools();
    if (!this.current().actors.length) void this.guide('arrange', true);
    else void this.guide('recording');
  }

  private stopRecording(announce: boolean): void {
    if (!this.rec) return;
    this.rec = null;
    this.tweens.killTweensOf(this.recLight!);
    this.recLight?.setVisible(false).setAlpha(1);
    this.tape?.clear();
    audio.play('clack');
    // back to the starting positions, ready to watch
    const sel = this.selected;
    this.player.build(this.current());
    this.syncTargets();
    this.selected = sel && this.player.objs.has(sel) ? sel : null;
    this.drawSelection();
    this.renderBar();
    this.renderStrip();
    this.updateTools();
    if (announce) void this.guide('cut', true);
  }

  private async playScene(): Promise<void> {
    if (this.showing) return;
    this.stopRecording(false);
    this.closeDrawer();
    this.select(null);
    this.setShowing(true);
    await this.player.play(this.current());
    if (!this.alive()) return;
    this.setShowing(false);
    this.player.build(this.current());
    this.syncTargets();
  }

  /** The whole show: curtains between scenes, then the audience picks an ending, then a bow. */
  private async playShow(): Promise<void> {
    if (this.showing) return;
    this.stopRecording(false);
    this.closeDrawer();
    this.select(null);
    this.setShowing(true);
    await this.guide('showTime');
    const scenes = this.story.scenes;
    for (let i = 0; i < scenes.length && this.showing; i++) {
      await this.closeCurtains();
      this.player.build(scenes[i]);
      await this.openCurtainsP();
      await this.player.play(scenes[i]);
    }
    let last = scenes[scenes.length - 1];
    if (this.showing && this.story.endings.length) {
      await this.guide('pickEnding');
      const pick = await iconDialog(services.layers.overlay, {
        buttons: this.story.endings.map((e, i) => ({ id: String(i), icon: 'branch', label: `Ending ${i + 1}`, art: `<span style="display:block;width:150px;height:78px;border:3px solid #3b2a20;border-radius:10px;overflow:hidden">${pieceSvg(`st.bg.${e.backdrop}`)}</span>` })),
        safeId: '0',
      });
      const e = this.story.endings[Number(pick)] ?? this.story.endings[0];
      if (this.showing) {
        await this.closeCurtains();
        this.player.build(e);
        await this.openCurtainsP();
        await this.player.play(e);
        last = e;
      }
    }
    if (this.showing) {
      // everyone takes a bow where they ended up
      this.player.build({ ...last, actors: finalActors(last), events: [] });
      for (const [id, o] of this.player.objs) if (o.actor.kind === 'puppet') this.player.act(id, 'bow');
      audio.play('success');
      sparkle(this, SX + STAGE.w / 2, SY + 300, 18, D.fx);
      updateProfile((p) => (p.progress.done['stage:show'] = (p.progress.done['stage:show'] ?? 0) + 1));
      await this.guide('bow');
    }
    if (!this.alive()) return;
    this.setShowing(false);
    this.loadScene();
  }

  private setShowing(on: boolean): void {
    this.showing = on;
    this.selRing?.setVisible(false);
    if (on) this.hints.stop();
    this.updateTools();
    if (this.drawerEl) this.drawerEl.hidden = on;
    services.hud.setExtras(on ? [] : [], on ? [this.stopShowBtn()] : []);
  }

  private stopShowBtn(): HTMLElement {
    return h('button', { class: 'btn-round', type: 'button', 'aria-label': 'Stop the show', 'data-stopshow': true, html: icon('stop'), on: { click: () => this.stopShow() } });
  }

  private stopShow(): void {
    if (!this.showing) return;
    this.player.stop();
    stopSpeech();
    this.showing = false;
    this.openCurtains(true);
    services.hud.setExtras([], []);
    this.updateTools();
    this.loadScene();
  }

  private openCurtains(instant = false): void {
    const [l, r] = this.curtains;
    if (instant || motion.reduced) {
      l.setScale(0.22, 1);
      r.setScale(-0.22, 1);
      return;
    }
    this.tweens.add({ targets: l, scaleX: 0.22, duration: 600, ease: 'Sine.easeInOut' });
    this.tweens.add({ targets: r, scaleX: -0.22, duration: 600, ease: 'Sine.easeInOut' });
  }

  private openCurtainsP(): Promise<void> {
    this.openCurtains();
    audio.play('swish');
    return this.wait(motion.reduced ? 50 : 650);
  }

  private closeCurtains(): Promise<void> {
    const [l, r] = this.curtains;
    audio.play('swish');
    if (motion.reduced) {
      l.setScale(1, 1);
      r.setScale(-1, 1);
      return this.wait(150);
    }
    this.tweens.add({ targets: l, scaleX: 1, duration: 500, ease: 'Sine.easeInOut' });
    this.tweens.add({ targets: r, scaleX: -1, duration: 500, ease: 'Sine.easeInOut' });
    return this.wait(600);
  }

  // ================================================================ saving

  private snapshot(): Promise<string | undefined> {
    return new Promise((resolve) => {
      const cam = this.cameras.main;
      const done = (img: unknown) => {
        try {
          const im = img as HTMLImageElement;
          const c = document.createElement('canvas');
          c.width = 320;
          c.height = 165;
          c.getContext('2d')!.drawImage(im, 0, 0, 320, 165);
          resolve(c.toDataURL('image/jpeg', 0.72));
        } catch {
          resolve(undefined);
        }
      };
      try {
        this.game.renderer.snapshotArea(Math.round(SX - cam.scrollX), Math.round(SY - cam.scrollY), STAGE.w, 720, done as Phaser.Types.Renderer.Snapshot.SnapshotCallback);
      } catch {
        resolve(undefined);
      }
      setTimeout(() => resolve(undefined), 1500);
    });
  }

  private async saveStory(): Promise<void> {
    if (this.showing) return;
    this.stopRecording(false);
    this.select(null);
    // the poster shows the first scene
    const wasScene = this.sceneIx;
    const wasEnding = this.endingIx;
    this.sceneIx = 0;
    this.endingIx = -1;
    this.player.build(this.story.scenes[0]);
    this.selRing?.setVisible(false);
    await this.wait(80);
    const preview = await this.snapshot();
    this.sceneIx = wasScene;
    this.endingIx = wasEnding;
    this.loadScene();
    const pid = services.profileId!;
    const existing = this.editingId && services.save.getCreation(this.editingId)?.profileId === pid ? this.editingId : undefined;
    const count = services.save.listCreations(pid, 'story').length;
    const res = await services.save.saveCreation({
      id: existing,
      profileId: pid,
      kind: 'story',
      name: existing ? services.save.getCreation(existing)!.name : `${TEMPLATE_NAME[this.story.template]} ${count + 1}`,
      data: this.story,
      preview,
    });
    if (res.ok) {
      this.editingId = res.id ?? null;
      this.saveDraft();
      audio.play('success');
      void this.guide('saved');
      if (!existing) {
        services.session.made.push({ kind: 'story', label: TEMPLATE_NAME[this.story.template], art: preview ? `<img src="${preview}" alt="">` : undefined });
        services.save.log(pid, 'stage', `Made a ${this.story.scenes.length}-scene puppet story (${TEMPLATE_NAME[this.story.template].toLowerCase()})${this.story.endings.length ? ` with ${this.story.endings.length} alternate ending${this.story.endings.length > 1 ? 's' : ''}` : ''}.`);
      }
      if (!currentProfile().progress.display.story && res.id) updateProfile((p) => (p.progress.display.story = res.id!));
    } else if (res.reason === 'full') {
      await this.guide('shelfFull');
      this.openStories(() => void this.saveStory());
    } else {
      toast(services.layers.toast, 'gear', 'Couldn’t save just now (see the grown-up area).');
    }
  }

  private openStories(afterRemove?: () => void): void {
    const pid = services.profileId!;
    this.closeShelf = openShelf({
      layer: services.layers.overlay,
      label: 'My stories',
      items: () => services.save.listCreations(pid, 'story').map((c) => ({ id: c.id, name: c.name, preview: c.preview })),
      displayedId: () => currentProfile().progress.display.story,
      emptyIcon: 'film',
      open: { label: 'Watch', run: (id) => void this.loadStory(id, true) },
      edit: { label: 'Change it', run: (id) => void this.loadStory(id, false) },
      show: (id) => {
        updateProfile((p) => (p.progress.display.story = id));
        void this.guide('shown');
      },
      remove: async (id) => {
        await services.save.deleteCreation(id, pid);
        if (this.editingId === id) this.editingId = null;
      },
      onRemoved: () => {
        if (afterRemove) {
          this.closeShelf?.();
          const fn = afterRemove;
          afterRemove = undefined;
          fn();
        }
      },
      onClose: () => (this.closeShelf = undefined),
    });
  }

  private async loadStory(id: string, watch: boolean): Promise<void> {
    const c = services.save.getCreation(id);
    if (!c || c.profileId !== services.profileId || c.kind !== 'story' || !validStory(c.data)) return;
    this.overlay?.remove();
    this.overlay = undefined;
    this.story = c.data;
    this.sceneIx = 0;
    this.endingIx = -1;
    this.editingId = id;
    this.saveDraft();
    this.loadScene();
    if (watch) await this.playShow();
  }

  // ================================================================ help and talk

  private demo(): void {
    if (this.showing || this.overlay) return;
    const sc = this.current();
    const tool = (sel: string) => {
      const el = document.querySelector(sel) as HTMLElement | null;
      el?.classList.add('glow');
      setTimeout(() => el?.classList.remove('glow'), 2600);
    };
    if (this.drawer) {
      const first = this.drawerEl?.querySelector('.tile') as HTMLElement | null;
      first?.classList.add('glow');
      setTimeout(() => first?.classList.remove('glow'), 2600);
      return;
    }
    if (!sc.actors.length) return tool('[data-tool-puppets]');
    if (!this.selected) {
      const first = [...this.player.objs.keys()][0];
      const r = this.player.bounds(first);
      void this.hand.tapAt(r.centerX, r.centerY, 2);
      return;
    }
    if (!this.rec && !sc.events.length) return tool('[data-record]');
    if (this.rec) {
      const b = this.bar?.querySelector('[data-act]') as HTMLElement | null;
      b?.classList.add('glow');
      setTimeout(() => b?.classList.remove('glow'), 2600);
      return;
    }
    tool('[data-play]');
  }

  override hint(): void {
    this.hints.request();
  }

  private guide(key: keyof typeof STAGE_GUIDE, asInstruction = false): Promise<void> {
    const text = STAGE_GUIDE[key];
    return asInstruction ? instruct('rowan', text, () => this.demo()) : say('rowan', text);
  }

  private wait(ms: number): Promise<void> {
    return new Promise((r) => this.time.delayedCall(ms, r));
  }

  private alive(): boolean {
    return this.sys.isActive() || this.sys.isPaused();
  }

  protected override tick(): void {
    if (this.rec && this.tape) {
      const used = Math.min(1, (this.time.now - this.rec.start - this.rec.offset) / LIMITS.duration);
      this.tape.clear().fillStyle(0x3b2a20, 0.7).fillRoundedRect(SX + STAGE.w - 200, SY + 90, 180, 16, 8).fillStyle(0xd95b4f, 1).fillRoundedRect(SX + STAGE.w - 198, SY + 92, 176 * used, 12, 6);
      if (used >= 1) {
        void this.guide('full');
        this.stopRecording(true);
      }
    }
    if (this.drag || this.player?.playing) this.drawSelection();
  }

  override inspect(): Record<string, unknown> {
    const sc = this.current();
    return {
      template: this.story.template,
      mode: this.story.mode,
      scenes: this.story.scenes.length,
      endings: this.story.endings.length,
      scene: this.sceneIx,
      ending: this.endingIx,
      backdrop: sc.backdrop,
      actors: sc.actors.map((a) => `${a.kind}:${a.ref}@${a.x},${a.y}`),
      events: sc.events.length,
      eventKinds: sc.events.map((e) => e.a),
      selected: this.selected,
      recording: !!this.rec,
      showing: this.showing,
      playing: this.player?.playing ?? false,
      drawer: this.drawer,
      editing: this.editingId,
      overlay: !!this.overlay,
    };
  }
}
