import Phaser from 'phaser';
import { WWScene } from '../../WWScene';
import { GhostHand } from '../../systems/GhostHand';
import { Hints } from '../../systems/Hints';
import { sparkle } from '../../systems/fx';
import { StagePlayer, puppetPortrait, rigFor, type StageCast } from '../../displays/StagePlayer';
import { StageMarker } from './StageMarker';
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
  SIMPLE_PROPS,
  SIMPLE_SFX,
  SIMPLE_TEMPLATES,
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
  pristine,
  record,
  refreshScene,
  removeActor,
  removeEnding,
  removeScene,
  setMode,
  showScenes,
  starActor,
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
import { ASK_AGAIN, ASK_REMOVE, ASK_THROW, ENDING_CHOICES, STAGE_LINES, STAGE_TALK, TAP_PUPPET, YOUR_TURN, type StageChoice, type StageLineId } from '../../../content/stage/stageLines';
import type { Line } from '../../../content/lineTypes';
import { services, currentProfile, currentPreset, updateProfile } from '../../../app/services';
import { say, instruct, stopSpeech, isSpeaking } from '../../../app/speech';
import { audio } from '../../../core/audio';
import { motion } from '../../../core/motion';
import { h, trapFocus } from '../../../ui/dom';
import { icon } from '../../../ui/icons';
import { toast } from '../../../ui/overlays';
import { openShelf } from '../../../ui/shelf';
import type { Expression } from '../../../art/cast/face';

registerPieces(STAGE_PIECES);

/** Where the stage window sits in the world (stage units are 1:1 with world units). */
const SX = 260;
const SY = 100;
const D = { room: 0, stage: 5, curtain: 30, frame: 35, dim: 36, fx: 60, ui: 70 };

const ACTION_ICON: Record<ActionId, string> = { wave: 'wave', jump: 'jump', dance: 'music', bow: 'bow', think: 'thought', cheer: 'star', hide: 'hide', sleep: 'zzz', point: 'next', shrug: 'ask', stomp: 'foot', clap: 'hand' };
const SFX_ICON: Record<SfxId, string> = { drum: 'music', boing: 'jump', whoosh: 'swap', splash: 'explore', sparkle: 'star', pop: 'plus', bell: 'turn', creak: 'home', chirp: 'wave', croak: 'speaker' };
const TEMPLATE_NAME: Record<TemplateId, string> = { 'wrong-house': 'The wrong house', 'two-explorers': 'Two explorers', invention: 'The invention', 'join-game': 'Can I play?', blank: 'Empty stage' };

/** A stage event before it gets its time stamp. */
type EventInput = StageEvent extends infer E ? (E extends StageEvent ? Omit<E, 't'> : never) : never;

type Drawer = 'backdrop' | 'puppets' | 'props' | 'sounds' | 'lines' | 'faces' | 'intents' | null;

/** The current step of making a show: what to say, and what to mark (a page button or a thing on the stage). */
interface Step {
  id: string;
  line: Line | null;
  /** CSS selector of the page button to mark */
  dom?: string;
  /** canvas target id to mark */
  actor?: string;
  /** said instead of `line` right after the applause */
  bravo?: Line;
}

/**
 * Story Stage: a puppet theatre. Put puppets and props on the stage, press
 * the red button and act it out; the stage remembers what happened (game
 * events only, no microphone or camera) and plays it back as a show.
 *
 * Rowan, who runs the theatre, always says the one next thing to do and the
 * marker sits on it: pick a story → watch how it starts → your turn (red
 * button, then a friend, then a move) → stop → watch it (curtains, applause,
 * a bow) → the next picture → the whole show → keep it on the shelf.
 */
export default class StageScene extends WWScene {
  readonly artGroup = 'stage';
  private story: Story = newStory('blank', 'simple');
  private sceneIx = 0;
  /** -1 = a regular scene; 0/1 = editing an alternate ending */
  private endingIx = -1;
  private player!: StagePlayer;
  private cast!: StageCast;
  /** "More help": fewer tools and choices at once */
  private little = false;
  private selected: string | null = null;
  private selRing?: Phaser.GameObjects.Ellipse;
  private rec: { start: number; offset: number; last: number } | null = null;
  private recLight?: Phaser.GameObjects.Image;
  private tape?: Phaser.GameObjects.Graphics;
  private curtains: Phaser.GameObjects.Image[] = [];
  private dim?: Phaser.GameObjects.Graphics;
  private showing = false;
  /** a spoken question with a choice tray is open */
  private asking = false;
  /** busy for a moment (taking the poster picture): no coaching */
  private busy = false;
  /** a story start's little example is playing */
  private inOpening = false;
  /** the story picker was opened as the very first thing (not from "New story") */
  private pickerFirst = true;
  private editingId: string | null = null;
  private drag: { id: string; sx: number; sy: number; moved: boolean; ox: number; oy: number } | null = null;
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
  private marker!: StageMarker;
  // ---- coaching
  /** pictures watched since they were last acted ('s0', 'e1', ...) */
  private watched = new Set<string>();
  private showSeen = false;
  /** on the shelf and not changed since */
  private savedClean = false;
  /** tools that have already said what they do this visit */
  private toolSaid = new Set<string>();
  /** said for the child's first turn after a story start (names the friend to tap) */
  private turnLine: Line | null = null;
  private lastStep: string | null = null;
  /** coaching starts with the first step (the picker, or a restored draft) */
  private coaching = false;
  private talkToken = 0;
  private coachCheck = 0;

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
    this.little = currentPreset('stage') === 'more-help';
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
    // "lights down" for a show: everything around the stage window dims (the footlights stay lit)
    this.dim = this.add.graphics().setDepth(D.dim).setAlpha(0);
    this.dim
      .fillStyle(0x120c08, 1)
      .fillRect(-3000, -3000, 9000, 3000 + SY)
      .fillRect(-3000, SY + 780, 9000, 4000)
      .fillRect(-3000, SY, 3000 + SX, 780)
      .fillRect(SX + STAGE.w, SY, 4000, 780);
    this.recLight = addImage(this, SX + STAGE.w - 90, SY + 50, 'st.rec').setDepth(D.fx).setVisible(false);
    this.tape = this.add.graphics().setDepth(D.fx);
    this.selRing = this.add.ellipse(0, 0, 170, 40, 0xffe7a3, 0.55).setDepth(D.stage).setVisible(false).setStrokeStyle(5, 0x3b2a20);
    this.hand = new GhostHand(this);
    this.marker = new StageMarker(services.layers.toast);
    this.hints = new Hints(this, currentPreset('stage'), () => this.demo(), () => !this.showing && !this.asking && !this.closeShelf);
    this.input.on('pointerdown', this.onDown, this);
    this.input.on('pointermove', this.onMove, this);
    this.input.on('pointerup', this.onUp, this);
    this.addTarget({
      id: 'floor',
      label: 'Stage floor',
      priority: 9,
      ambient: true,
      bounds: () => new Phaser.Geom.Rectangle(SX, SY + STAGE.floorMin - 80, STAGE.w, STAGE.floorMax - STAGE.floorMin + 110),
      enabled: () => !!this.selected && !this.showing && !this.drawer,
      activate: () => {
        const tp = this.tapPoint;
        if (tp) this.walkSelected(tp.x - SX, tp.y - SY);
      },
    });
    this.buildDom();
    services.captions.setRaised(true);
    audio.startMusic('stage');
    services.hud.show(['home', 'finish', 'pause', 'replay', 'help']);
    this.onCleanup(() => {
      this.player.destroy();
      for (const el of [this.left, this.right, this.strip, this.bar, this.drawerEl, this.overlay]) el?.remove();
      this.marker.destroy();
      this.closeShelf?.();
      services.captions.setRaised(false);
      services.choices.cancel();
      stopSpeech();
    });
    const draft = this.readDraft();
    if (draft) {
      this.story = draft.story;
      this.sceneIx = Math.min(draft.scene, this.story.scenes.length - 1);
      this.editingId = draft.editingId;
      // what's already made has been seen
      this.story.scenes.forEach((s, i) => s.events.length && this.watched.add(`s${i}`));
      this.story.endings.forEach((s, i) => s.events.length && this.watched.add(`e${i}`));
      this.loadScene();
      this.time.delayedCall(600, () => this.react());
    } else {
      // the curtains wait closed while a story is picked
      this.closeCurtainsNow();
      this.loadScene();
      this.time.delayedCall(250, () => this.openPicker(true));
    }
  }

  // ================================================================ story data

  private current(): SceneData {
    return this.endingIx >= 0 ? this.story.endings[this.endingIx] : this.story.scenes[this.sceneIx];
  }

  private sceneKey(): string {
    return this.endingIx >= 0 ? `e${this.endingIx}` : `s${this.sceneIx}`;
  }

  private setCurrent(scIn: SceneData): void {
    // any change makes a scene the child's own: it stops following the scene before
    const { fresh: _fresh, ...sc } = scIn;
    void _fresh;
    if (this.endingIx >= 0) {
      const endings = [...this.story.endings];
      endings[this.endingIx] = sc;
      this.story = { ...this.story, endings };
    } else {
      const scenes = [...this.story.scenes];
      scenes[this.sceneIx] = sc;
      this.story = { ...this.story, scenes };
    }
    this.savedClean = false;
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
    this.stopRecording();
    this.story = this.endingIx >= 0 ? refreshScene(this.story, this.endingIx, true) : refreshScene(this.story, this.sceneIx);
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
          this.hints.poke();
          this.select(this.selected === id ? null : id);
          this.react();
        },
      });
    }
  }

  // ================================================================ picking a story start

  private hasStories(): boolean {
    return !!services.profileId && services.save.listCreations(services.profileId, 'story').length > 0;
  }

  private openPicker(first: boolean): void {
    this.overlay?.remove();
    this.pickerFirst = first;
    const preset = currentPreset('stage');
    const cards = (this.little ? SIMPLE_TEMPLATES : TEMPLATES).map((t) => {
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
              this.resetCoach();
              this.saveDraft();
              this.loadScene();
              void this.startStory();
            },
          },
        },
        h('span', { html: pieceSvg(`st.bg.${sc.backdrop}`), style: 'width:160px;height:82px;display:block;border-radius:10px;overflow:hidden;border:3px solid #3b2a20' }),
        h('span', { style: 'display:flex;gap:2px;height:52px' }, ...heads.slice(0, 3).map((f) => h('span', { html: f, style: 'width:50px;height:50px;display:block' }))),
      );
    });
    const extra: HTMLElement[] = [];
    if (this.hasStories()) extra.push(h('button', { class: 'tile', type: 'button', 'data-mystories': true, 'aria-label': 'My stories', style: 'width:190px;min-height:170px', html: icon('shelf', 96), on: { click: () => { audio.play('tap'); close(); this.openStories({ back: () => this.openPicker(first) }); } } }));
    if (!first) extra.push(h('button', { class: 'tile', type: 'button', 'data-picker-close': true, 'aria-label': 'Back to my story', style: 'width:190px;min-height:170px', html: icon('back', 96), on: { click: () => { audio.play('back'); close(); this.react(); } } }));
    const panel = h('div', { class: 'panel', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Start a story', style: 'max-width:min(1100px, calc(100vw - 32px))' }, h('div', { class: 'big-choices' }, ...cards, ...extra));
    const overlay = h('div', { class: 'overlay' }, panel);
    const release = trapFocus(panel);
    const close = () => {
      release();
      overlay.remove();
      this.overlay = undefined;
      this.marker.hide();
    };
    overlay.addEventListener('click', (e) => {
      if (e.target !== overlay) return;
      if (first) this.hints.request();
      else {
        close();
        this.react();
      }
    });
    services.layers.overlay.append(overlay);
    this.overlay = overlay;
    this.lastStep = null;
    this.react();
  }

  /** A story start plays once as a tiny show (never how it ends); then it's the child's turn on the next picture. */
  private async startStory(): Promise<void> {
    const sc = this.current();
    if (!sc.events.length) {
      this.openCurtains();
      audio.play('swish');
      this.react();
      return;
    }
    this.setShowing(true);
    this.inOpening = true;
    stopSpeech();
    if (this.curtains[0].scaleX < 0.9) await this.closeCurtains();
    this.player.build(sc);
    await this.openCurtainsP();
    await this.player.play(sc);
    await this.waitQuiet();
    if (!this.alive() || !this.showing || !this.inOpening) return;
    this.setShowing(false);
    this.firstTurn();
  }

  /** After a story start's example: the child's turn on the next picture, with the same friends where they ended up. */
  private firstTurn(): void {
    this.inOpening = false;
    this.watched.add('s0');
    if (this.story.scenes.length < 2) this.story = addScene(this.story, 0);
    this.sceneIx = 1;
    this.saveDraft();
    this.loadScene();
    audio.play('paper');
    const star = starActor(this.current());
    this.turnLine = star?.kind === 'puppet' ? YOUR_TURN[star.ref as PuppetRef] : null;
    this.react();
  }

  /** "New story" (only offered once this one is safe on the shelf, or nothing has been made yet). */
  private canStartNew(): boolean {
    return this.savedClean || pristine(this.story);
  }

  // ================================================================ DOM: tools, strip, drawers, action bar

  private btn(ic: string, label: string, fn: () => void, attr: string, extra: Record<string, unknown> = {}): HTMLButtonElement {
    return h('button', { class: 'btn-round', type: 'button', 'aria-label': label, title: label, html: icon(ic), [attr]: true, ...extra, on: { click: () => { audio.play('tap'); this.hints.poke(); fn(); } } });
  }

  /** Tools that put things on the stage wait while acting (the stage remembers how a picture starts). */
  private stageTool(fn: () => void): () => void {
    return () => {
      if (this.rec) {
        audio.play('oops');
        this.marker.tap(this.right?.querySelector<HTMLElement>('[data-record]') ?? null);
        void this.talk(STAGE_TALK.stopFirst);
        return;
      }
      fn();
    };
  }

  private buildDom(): void {
    this.left = h(
      'div',
      { class: 'stage-tools left', role: 'toolbar', 'aria-label': 'Put things on the stage' },
      this.btn('picture', 'Backdrop', this.stageTool(() => this.openDrawer('backdrop')), 'data-tool-backdrop'),
      this.btn('puppet', 'Puppets', this.stageTool(() => this.openDrawer('puppets')), 'data-tool-puppets'),
      this.btn('chest', 'Props', this.stageTool(() => this.openDrawer('props')), 'data-tool-props'),
      this.btn('speaker', 'Sounds', () => this.openDrawer('sounds'), 'data-tool-sounds'),
    );
    this.right = h(
      'div',
      { class: 'stage-tools right', role: 'toolbar', 'aria-label': 'Show' },
      this.btn('record', 'Act it out', () => void this.toggleRecord(), 'data-record', { style: '--btn:84px' }),
      this.btn('play', 'Watch this picture', () => void this.playScene(), 'data-play'),
      this.btn('film', 'Watch the whole show', () => void this.playShow(), 'data-show'),
      this.btn('heart', 'Keep it on my shelf', () => void this.saveStory(), 'data-save'),
      this.btn('shelf', 'My stories', () => this.openStories(), 'data-stories'),
      this.btn('scenes3', 'Simple or big stage', () => this.toggleMode(), 'data-mode'),
      this.btn('pencil', 'New story', () => this.openPicker(false), 'data-new'),
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
    // "More help" sees only what the next steps need
    const recorded = this.story.scenes.filter((s) => s.events.length).length;
    const show: Record<string, boolean> = {
      'data-tool-backdrop': !this.little,
      'data-play': !this.little || this.current().events.length > 0,
      'data-show': !this.little || recorded >= 2,
      'data-stories': !this.little,
      'data-mode': !this.little,
      'data-new': this.canStartNew() && !this.rec,
    };
    for (const el of [this.left, this.right]) {
      for (const b of el?.querySelectorAll<HTMLButtonElement>('button') ?? []) {
        const attr = [...b.attributes].find((a) => a.name in show)?.name;
        b.hidden = attr ? !show[attr] : false;
        // putting things on the stage waits while acting: dimmed, and a tap says why
        const waits = !!this.rec && el === this.left && !b.hasAttribute('data-tool-sounds');
        b.style.opacity = waits ? '0.45' : '';
        b.setAttribute('aria-disabled', String(waits));
      }
    }
    for (const el of [this.left, this.right]) if (el) el.hidden = this.showing;
    this.layoutBottom();
  }

  /** The bottom of the screen holds one thing at a time: an open drawer, else the puppet's bar, else the scene strip. */
  private layoutBottom(): void {
    if (this.drawerEl) this.drawerEl.hidden = this.showing;
    if (this.bar) this.bar.hidden = this.showing || !!this.drawer;
    if (this.strip) this.strip.hidden = this.showing || !!this.drawer || !!this.bar;
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

  private goScene(i: number, ending: boolean, react = true): void {
    if (this.showing) return;
    this.hints.poke();
    this.closeDrawer();
    this.stopRecording();
    this.turnLine = null;
    this.sceneIx = ending ? this.sceneIx : i;
    this.endingIx = ending ? i : -1;
    audio.play('paper');
    this.saveDraft();
    this.loadScene();
    if (react) this.react();
  }

  private newScene(): void {
    this.story = addScene(this.story, this.endingIx >= 0 ? this.story.scenes.length - 1 : this.sceneIx);
    const at = this.endingIx >= 0 ? this.story.scenes.length - 1 : this.sceneIx + 1;
    this.goScene(Math.min(at, this.story.scenes.length - 1), false);
  }

  private newEnding(): void {
    this.story = addEnding(this.story);
    this.goScene(this.story.endings.length - 1, true, false);
    this.react({ first: this.toolOnce('ending', STAGE_TALK.toolEnding) });
  }

  private async deleteScene(): Promise<void> {
    const sc = this.current();
    if (sc.events.length || sc.actors.length) {
      if ((await this.ask(STAGE_TALK.askThrow, ASK_THROW)) !== 'delete') return this.react();
    }
    if (this.endingIx >= 0) {
      this.watched.delete(`e${this.endingIx}`);
      this.story = removeEnding(this.story, this.endingIx);
      this.endingIx = -1;
    } else {
      const gone = this.sceneIx;
      this.story = removeScene(this.story, gone);
      this.sceneIx = Math.max(0, gone - 1);
      // the pictures after it move up one place
      this.watched = new Set(
        [...this.watched].flatMap((k) => {
          const n = Number(k.slice(1));
          if (k.startsWith('e') || n < gone) return [k];
          return n > gone ? [`s${n - 1}`] : [];
        }),
      );
    }
    this.savedClean = false;
    audio.play('swish');
    this.saveDraft();
    this.loadScene();
    this.react();
  }

  private toggleMode(): void {
    const to = this.story.mode === 'simple' ? 'full' : 'simple';
    this.story = setMode(this.story, to);
    this.endingIx = -1;
    this.sceneIx = Math.min(this.sceneIx, this.story.scenes.length - 1);
    this.watched = new Set([...this.watched].filter((k) => k.startsWith('s') && Number(k.slice(1)) < this.story.scenes.length));
    audio.play('zip');
    this.saveDraft();
    this.loadScene();
    this.react({ first: to === 'simple' ? STAGE_TALK.toolSimple : STAGE_TALK.toolBig });
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
    let toolLine: Line | null = null;
    if (kind === 'backdrop') {
      for (const b of BACKDROPS) tiles.push(tile('data-backdrop', b, b, `<span style="display:block;width:100px;height:52px;border-radius:8px;overflow:hidden;border:3px solid #3b2a20">${pieceSvg(`st.bg.${b}`)}</span>`, () => this.setBackdrop(b), 'wide'));
      toolLine = this.toolOnce('backdrop', STAGE_TALK.toolBackdrop);
    } else if (kind === 'puppets') {
      const on = new Set(this.current().actors.map((a) => a.ref));
      for (const p of PUPPET_REFS) tiles.push(tile('data-puppet', p, p === 'me' ? 'You' : p, puppetPortrait(p, this.cast), () => this.addThing('puppet', p), on.has(p) ? 'used' : ''));
      toolLine = this.toolOnce('puppets', STAGE_TALK.pickPuppet);
    } else if (kind === 'props') {
      for (const p of this.little ? SIMPLE_PROPS : PROPS) tiles.push(tile('data-prop', p, p, pieceSvg(`st.p.${p}`), () => this.addThing('prop', p)));
      toolLine = this.toolOnce('props', STAGE_TALK.toolProps);
    } else if (kind === 'sounds') {
      for (const s of this.simple() ? SIMPLE_SFX : SFX) tiles.push(tile('data-sfx', s, s, icon(SFX_ICON[s], 70), () => this.playSfx(s)));
      toolLine = this.toolOnce('sounds', STAGE_TALK.toolSounds);
    } else if (kind === 'lines') {
      const lines = Object.entries(STAGE_LINES).filter(([, l]) => !this.simple() || ('simple' in l && l.simple));
      for (const [id, l] of lines) tiles.push(h('button', { class: 'tile line', type: 'button', 'aria-label': l.text, 'data-line': id, on: { click: () => { this.hints.poke(); void this.sayLine(id as StageLineId); } } }, h('span', { html: icon(l.icon) }), h('span', {}, l.text)));
      toolLine = this.toolOnce('lines', STAGE_TALK.toolSay);
    } else if (kind === 'faces') {
      const a = this.selectedActor();
      if (!a) {
        this.drawer = null;
        return;
      }
      for (const f of this.simple() ? SIMPLE_FACES : FACES) tiles.push(tile('data-face', f, f, rigSvg(rigFor(a.ref as PuppetRef, this.cast), { crop: 'head', expression: f, hat: a.ref === 'me' ? this.cast.me.hat : null }), () => this.setFace(f)));
      toolLine = this.toolOnce('faces', STAGE_TALK.toolFaces);
    } else if (kind === 'intents') {
      tiles.push(tile('data-intent', 'none', 'Nothing in particular', icon('close', 60), () => this.setIntent(undefined)));
      for (const i of INTENTS) tiles.push(tile('data-intent', i, i, `<span style="display:block;width:70px;height:70px">${pieceSvg(`st.i.${i}`)}</span>`, () => this.setIntent(i)));
      toolLine = this.toolOnce('intents', STAGE_TALK.toolIntents);
    }
    const close = h('button', { class: 'btn-round close', type: 'button', 'aria-label': 'Close', html: icon('close'), 'data-drawer-close': true, on: { click: () => { audio.play('close'); this.closeDrawer(); this.react(); } } });
    this.drawerEl = h('div', { class: 'drawer', role: 'dialog', 'aria-label': kind, on: { keydown: (e) => (e as KeyboardEvent).key === 'Escape' && this.closeDrawer() } }, ...tiles, close);
    services.layers.choices.append(this.drawerEl);
    this.layoutBottom();
    audio.play('open');
    (this.drawerEl.querySelector('button') as HTMLButtonElement | null)?.focus({ preventScroll: true });
    this.react({ tool: toolLine });
  }

  private closeDrawer(): void {
    this.drawerEl?.remove();
    this.drawerEl = undefined;
    this.drawer = null;
    if (this.selected && !this.showing) this.renderBar();
    else this.layoutBottom();
  }

  private renderBar(): void {
    this.bar?.remove();
    this.bar = undefined;
    const a = this.selectedActor();
    if (!a) return this.layoutBottom();
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
    // "More help": the simple moves only (dragging still turns a puppet to face where it goes)
    if (!this.little) items.push(this.btn('flip', 'Turn around', () => this.turnSelected(), 'data-turn'));
    items.push(this.btn('trash', 'Take off the stage', () => void this.removeSelected(), 'data-remove'));
    items.push(this.btn('close', 'Done', () => { this.select(null); this.react(); }, 'data-deselect'));
    this.bar = h('div', { class: 'stage-bar', role: 'toolbar', 'aria-label': 'Puppet actions' }, ...items);
    services.layers.choices.append(this.bar);
    this.layoutBottom();
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
    this.react();
  }

  private addThing(kind: 'puppet' | 'prop', ref: PuppetRef | PropId): void {
    const sc = this.current();
    if (kind === 'puppet' && sc.actors.some((a) => a.ref === ref)) {
      const existing = sc.actors.find((a) => a.ref === ref)!;
      this.closeDrawer();
      this.select(existing.id);
      this.react({ first: STAGE_TALK.alreadyOn });
      return;
    }
    if (sc.actors.length >= LIMITS.actors) {
      this.closeDrawer();
      this.react({ first: STAGE_TALK.stageFull });
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
    sparkle(this, SX + a.x, SY + a.y - 120, 8, D.fx);
    this.closeDrawer();
    this.select(r.id);
    this.renderStrip();
    this.updateTools();
    this.react();
  }

  private async removeSelected(): Promise<void> {
    const id = this.selected;
    if (!id) return;
    const sc = this.current();
    if (sc.events.some((e) => e.a !== 'sfx' && e.id === id)) {
      if ((await this.ask(STAGE_TALK.askRemove, ASK_REMOVE)) !== 'delete') return this.react();
      if (!this.player.objs.has(id)) return;
    }
    this.setCurrent(removeActor(this.current(), id));
    this.player.removeActor(id);
    this.select(null);
    this.syncTargets();
    this.renderStrip();
    this.updateTools();
    audio.play('swish');
    this.react({ tool: this.toolOnce('remove', STAGE_TALK.toolRemove) });
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
    const first = this.current().events.length === 0;
    const res = record(this.current().events, { ...(e as StageEvent), t: Math.round(t) });
    this.setCurrent({ ...this.current(), events: res.events });
    if (res.full) {
      this.stopRecording();
      this.react({ step: STAGE_TALK.full });
      return;
    }
    if (first && res.events.length) this.firstMove(e);
  }

  /** The very first thing acted in a picture: a little cheer, then what to do next. */
  private firstMove(e: EventInput): void {
    const o = e.a === 'sfx' ? undefined : this.player.objs.get(e.id);
    sparkle(this, o ? SX + o.obj.x : SX + STAGE.w / 2, o ? SY + o.obj.y - 160 : SY + 300, 10, D.fx);
    audio.play('sparkle', { delay: 0.15 });
    // a puppet's spoken line is heard first (sayLine reacts when it's done)
    if (e.a !== 'say') this.react();
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

  private async sayLine(line: StageLineId): Promise<void> {
    const id = this.selected;
    this.closeDrawer();
    if (!id) return;
    const said = this.player.sayLine(id, line);
    this.recordEvent({ a: 'say', id, line });
    await said;
    if (this.alive()) this.react();
  }

  private setFace(f: Expression): void {
    const id = this.selected;
    this.closeDrawer();
    if (!id) return;
    this.player.face(id, f);
    audio.play('pop');
    if (this.rec) this.recordEvent({ a: 'face', id, face: f });
    else this.setCurrent(updateActor(this.current(), id, { face: f }));
    this.react();
  }

  private setIntent(i: IntentId | undefined): void {
    const id = this.selected;
    this.closeDrawer();
    if (!id) return;
    this.player.setIntent(id, i);
    this.setCurrent(updateActor(this.current(), id, { intent: i }));
    audio.play('pop');
    this.react();
  }

  private turnSelected(): void {
    const id = this.selected;
    if (!id) return;
    const a = this.player.objs.get(id)!.actor;
    const f = (a.facing === 1 ? -1 : 1) as 1 | -1;
    this.player.turn(id, f);
    audio.play('swish');
    if (this.rec) this.recordEvent({ a: 'turn', id, facing: f });
    else this.setCurrent(updateActor(this.current(), id, { facing: f }));
    this.react({ tool: this.toolOnce('turn', STAGE_TALK.toolTurn) });
  }

  private playSfx(s: SfxId): void {
    this.closeDrawer();
    this.player.sfx(s);
    this.recordEvent({ a: 'sfx', sfx: s });
    this.react();
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
    audio.play('step');
    this.commitMove(id, p.x, p.y);
  }

  private commitMove(id: string, x: number, y: number): void {
    if (this.rec) this.recordEvent({ a: 'move', id, x, y });
    else this.setCurrent(placeActor(this.current(), id, x, y));
  }

  /** A tap on the stage that missed everything: show what to tap. */
  protected override onGroundTap(x: number, y: number): void {
    if (this.showing || this.drawer || this.overlay || this.asking) return;
    if (x < SX || x > SX + STAGE.w || y < SY || y > SY + STAGE.h) return;
    if (this.selected) return this.walkSelected(x - SX, y - SY);
    this.hints.poke();
    audio.play('hint');
    const star = starActor(this.current());
    if (star) {
      const r = this.player.bounds(star.id);
      void this.hand.tapAt(r.centerX, r.centerY, 1);
      if (!isSpeaking()) void this.talk(STAGE_TALK.tapPuppetFirst);
    } else {
      this.marker.tap(this.left?.querySelector<HTMLElement>('[data-tool-puppets]') ?? null);
      if (!isSpeaking()) void this.talk(STAGE_TALK.addPuppet);
    }
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
    const o = id ? this.player.objs.get(id) : undefined;
    // keep the grab point under the finger (no jumping when picked up by the head)
    if (id && o) this.drag = { id, sx: p.worldX, sy: p.worldY, moved: false, ox: o.obj.x - (p.worldX - SX), oy: o.obj.y - (p.worldY - SY) };
  }

  private onMove(p: Phaser.Input.Pointer): void {
    const d = this.drag;
    if (!d || !p.isDown) return;
    if (!d.moved && Math.hypot(p.worldX - d.sx, p.worldY - d.sy) < 30) return;
    if (!d.moved) {
      d.moved = true;
      if (this.selected !== d.id) this.select(d.id);
    }
    const pos = clampToStage(p.worldX - SX + d.ox, p.worldY - SY + d.oy);
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
    this.react();
  }

  // ================================================================ acting it out (recording) and watching

  private async toggleRecord(): Promise<void> {
    if (this.showing) return;
    if (this.rec) {
      this.stopRecording();
      this.react();
      return;
    }
    const sc = this.current();
    if (!sc.actors.length) {
      // nobody to act yet: show where the friends are
      audio.play('hint');
      this.marker.tap(this.left?.querySelector<HTMLElement>('[data-tool-puppets]') ?? null);
      void this.talk(STAGE_TALK.addPuppet);
      return;
    }
    if (sc.events.length) {
      if ((await this.ask(STAGE_TALK.askAgain, ASK_AGAIN)) !== 'again') return this.react();
      if (this.rec || this.showing) return;
    }
    this.closeDrawer();
    this.turnLine = null;
    this.watched.delete(this.sceneKey());
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
    this.renderStrip();
    this.react();
  }

  private stopRecording(): void {
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
  }

  /** Watch this picture as a little performance: curtains, the acting, then applause and a bow. */
  private async playScene(): Promise<void> {
    if (this.showing) return;
    const sc = this.current();
    if (!sc.events.length) {
      audio.play('oops');
      this.marker.tap(this.right?.querySelector<HTMLElement>('[data-record]') ?? null);
      void this.talk(STAGE_TALK.nothingYet);
      return;
    }
    this.stopRecording();
    this.closeDrawer();
    this.select(null);
    this.setShowing(true);
    stopSpeech();
    await this.closeCurtains();
    this.player.build(sc);
    await this.openCurtainsP();
    await this.player.play(sc);
    await this.waitQuiet();
    if (!this.alive() || !this.showing) return;
    this.watched.add(this.sceneKey());
    await this.curtainCall(sc, false);
    if (!this.alive() || !this.showing) return;
    this.setShowing(false);
    this.player.build(this.current());
    this.syncTargets();
    // after the applause, the next step is always said (even if it's the same as before)
    this.lastStep = null;
    this.react({ bravo: true });
  }

  /** The whole show: lights down, curtains between pictures, the audience picks an ending, then a curtain call. */
  private async playShow(): Promise<void> {
    if (this.showing) return;
    const scenes = showScenes(this.story);
    if (!scenes.some((s) => s.events.length)) {
      audio.play('oops');
      this.marker.tap(this.right?.querySelector<HTMLElement>('[data-record]') ?? null);
      void this.talk(STAGE_TALK.nothingYet);
      return;
    }
    this.stopRecording();
    this.closeDrawer();
    this.select(null);
    this.setShowing(true);
    stopSpeech();
    this.houseLights(true);
    await this.closeCurtains();
    // a title typed by a grown-up (optional) is read out first
    if (this.story.title) await say('narrator', this.story.title);
    if (this.showing) await this.talk(STAGE_TALK.showTime);
    for (let i = 0; i < scenes.length && this.showing; i++) {
      if (i > 0) await this.closeCurtains();
      if (!this.showing) break;
      this.player.build(scenes[i]);
      await this.openCurtainsP();
      await this.player.play(scenes[i]);
      await this.waitQuiet();
    }
    let last = scenes[scenes.length - 1];
    if (this.showing && this.story.endings.length) {
      await this.closeCurtains();
      const choices = this.story.endings.map((e, i) => ({ ...(ENDING_CHOICES[i] ?? ENDING_CHOICES[0]), art: `<span style="display:block;width:120px;height:62px;border:3px solid #3b2a20;border-radius:10px;overflow:hidden">${pieceSvg(`st.bg.${e.backdrop}`)}</span>` }));
      // the audience picks when there are two endings; one ending just plays
      const pick = this.showing && choices.length > 1 ? await this.ask(STAGE_TALK.pickEnding, choices) : '0';
      const e = this.story.endings[Number(pick)] ?? this.story.endings[0];
      if (this.showing) {
        this.player.build(e);
        await this.openCurtainsP();
        await this.player.play(e);
        await this.waitQuiet();
        last = e;
      }
    }
    if (this.showing) {
      await this.curtainCall(last, true);
      updateProfile((p) => (p.progress.done['stage:show'] = (p.progress.done['stage:show'] ?? 0) + 1));
      this.showSeen = true;
      // the show counts as watching every picture in it
      this.story.scenes.forEach((sc, i) => sc.events.length && this.watched.add(`s${i}`));
      if (last !== scenes[scenes.length - 1]) this.watched.add(`e${this.story.endings.indexOf(last)}`);
    }
    if (!this.alive() || !this.showing) return;
    this.houseLights(false);
    this.setShowing(false);
    this.loadScene();
    this.lastStep = null;
    this.react();
  }

  /** Everyone bows where they ended up, to applause. The big one (end of the show) opens the curtains again for it. */
  private async curtainCall(sc: SceneData, big: boolean): Promise<void> {
    const final = { ...sc, actors: finalActors(sc), events: [] };
    if (big) {
      await this.closeCurtains();
      if (!this.showing) return;
      this.player.build(final);
      this.applause(true);
      await this.openCurtainsP();
    } else {
      this.player.build(final);
      this.applause(false);
    }
    if (!this.showing) return;
    const puppets = [...this.player.objs].filter(([, o]) => o.actor.kind === 'puppet').map(([id]) => id);
    puppets.forEach((id, i) => this.time.delayedCall(i * 160, () => this.showing && this.player.act(id, 'bow')));
    const bursts = big ? 6 : 3;
    for (let i = 0; i < bursts; i++) this.time.delayedCall(i * 240, () => sparkle(this, SX + 200 + Math.random() * 1000, SY + 200 + Math.random() * 260, big ? 16 : 10, D.fx));
    if (big) {
      audio.play('success', { delay: 0.3 });
      await this.talk(STAGE_TALK.bow);
      await this.wait(400);
    } else await this.wait(1500);
  }

  /** A clapping audience (lots of little claps, spread out), plus a happy chord. */
  private applause(big: boolean): void {
    const n = big ? 64 : 34;
    const span = big ? 2.6 : 1.5;
    for (let i = 0; i < n; i++) {
      const d = Math.random() * span;
      audio.play('flap', { delay: d, pitch: 1.5 + Math.random() * 1.2, vol: (0.55 + Math.random() * 0.45) * (1 - (d / span) * 0.5), pan: Math.random() * 1.6 - 0.8 });
    }
    audio.play(big ? 'sparkle' : 'confirm');
  }

  private setShowing(on: boolean): void {
    this.showing = on;
    this.selRing?.setVisible(false);
    this.hand.hide();
    this.updateTools();
    services.hud.setExtras([], on ? [this.stopShowBtn()] : []);
  }

  private stopShowBtn(): HTMLElement {
    return h('button', { class: 'btn-round', type: 'button', 'aria-label': 'Stop the show', 'data-stopshow': true, html: icon('stop'), on: { click: () => this.stopShow() } });
  }

  private stopShow(): void {
    if (!this.showing) return;
    this.player.stop();
    stopSpeech();
    services.choices.cancel();
    this.showing = false;
    this.openCurtains(true);
    this.houseLights(false);
    services.hud.setExtras([], []);
    this.updateTools();
    if (this.inOpening) return this.firstTurn();
    this.loadScene();
    this.lastStep = null;
    this.react();
  }

  private houseLights(down: boolean): void {
    const g = this.dim;
    if (!g) return;
    this.tweens.killTweensOf(g);
    if (motion.reduced) g.setAlpha(down ? 0.6 : 0);
    else this.tweens.add({ targets: g, alpha: down ? 0.6 : 0, duration: 500 });
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

  private closeCurtainsNow(): void {
    const [l, r] = this.curtains;
    l.setScale(1, 1);
    r.setScale(-1, 1);
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
    if (this.showing || this.busy) return;
    this.stopRecording();
    this.select(null);
    this.busy = true;
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
    this.busy = false;
    const pid = services.profileId!;
    const existing = this.editingId && services.save.getCreation(this.editingId)?.profileId === pid ? this.editingId : undefined;
    const count = services.save.listCreations(pid, 'story').length;
    const res = await services.save.saveCreation({
      id: existing,
      profileId: pid,
      kind: 'story',
      name: existing ? services.save.getCreation(existing)!.name : `${TEMPLATE_NAME[this.story.template]} ${count + 1}`,
      // keep a title a grown-up typed in the meantime
      data: { ...this.story, title: this.story.title ?? (existing ? (services.save.getCreation(existing)!.data as Story).title : undefined) },
      preview,
    });
    if (res.ok) {
      this.editingId = res.id ?? null;
      this.savedClean = true;
      this.saveDraft();
      // a happy moment: everyone cheers, sparkles, a chord
      audio.play('success');
      sparkle(this, SX + STAGE.w / 2, SY + 260, 18, D.fx);
      for (const [id, o] of this.player.objs) if (o.actor.kind === 'puppet') this.player.act(id, 'cheer');
      this.updateTools();
      this.react({ first: STAGE_TALK.saved });
      if (!existing) {
        services.session.made.push({ kind: 'story', label: TEMPLATE_NAME[this.story.template], art: preview ? `<img src="${preview}" alt="">` : undefined });
        services.save.log(pid, 'stage', `Made a ${this.story.scenes.length}-scene puppet story (${TEMPLATE_NAME[this.story.template].toLowerCase()})${this.story.endings.length ? ` with ${this.story.endings.length} alternate ending${this.story.endings.length > 1 ? 's' : ''}` : ''}.`);
      }
      if (!currentProfile().progress.display.story && res.id) updateProfile((p) => (p.progress.display.story = res.id!));
    } else if (res.reason === 'full') {
      await this.talk(STAGE_TALK.shelfFull);
      this.openStories({ afterRemove: () => void this.saveStory() });
    } else {
      toast(services.layers.toast, 'gear', 'Couldn’t save just now (see the grown-up area).');
    }
  }

  /** The shelf. `back`: where to go if it's closed without picking a story; `afterRemove`: what to do once one is thrown away. */
  private openStories(o: { back?: () => void; afterRemove?: () => void } = {}): void {
    const pid = services.profileId!;
    let afterRemove = o.afterRemove;
    let chosen = false;
    this.closeShelf = openShelf({
      layer: services.layers.overlay,
      label: 'My stories',
      items: () => services.save.listCreations(pid, 'story').map((c) => ({ id: c.id, name: c.name, preview: c.preview })),
      displayedId: () => currentProfile().progress.display.story,
      emptyIcon: 'film',
      open: { label: 'Watch', run: (id) => { chosen = true; void this.loadStory(id, true); } },
      edit: { label: 'Change it', run: (id) => { chosen = true; void this.loadStory(id, false); } },
      show: (id) => {
        updateProfile((p) => (p.progress.display.story = id));
        void this.talk(STAGE_TALK.shown);
      },
      remove: async (id) => {
        await services.save.deleteCreation(id, pid);
        if (this.editingId === id) {
          this.editingId = null;
          this.savedClean = false;
        }
      },
      onRemoved: () => {
        if (afterRemove) {
          this.closeShelf?.();
          const fn = afterRemove;
          afterRemove = undefined;
          fn();
        }
      },
      onClose: () => {
        this.closeShelf = undefined;
        if (!chosen && o.back) o.back();
        else this.react();
      },
    });
    void this.talk(STAGE_TALK.toolStories);
  }

  private async loadStory(id: string, watch: boolean): Promise<void> {
    const c = services.save.getCreation(id);
    if (!c || c.profileId !== services.profileId || c.kind !== 'story' || !validStory(c.data)) return;
    this.closeShelf?.();
    this.closeShelf = undefined;
    this.overlay?.remove();
    this.overlay = undefined;
    this.story = c.data;
    this.sceneIx = 0;
    this.endingIx = -1;
    this.editingId = id;
    this.resetCoach();
    this.story.scenes.forEach((s, i) => s.events.length && this.watched.add(`s${i}`));
    this.story.endings.forEach((s, i) => s.events.length && this.watched.add(`e${i}`));
    this.savedClean = true;
    this.openCurtains(true);
    this.saveDraft();
    this.loadScene();
    if (watch) await this.playShow();
    else this.react();
  }

  // ================================================================ coaching: the one next thing, said and marked

  private resetCoach(): void {
    this.inOpening = false;
    this.watched.clear();
    this.showSeen = false;
    this.savedClean = false;
    this.turnLine = null;
    this.lastStep = null;
  }

  /** What to do next, from what's on the stage right now. */
  private computeStep(): Step | null {
    if (this.showing || this.asking || this.busy || this.closeShelf || !this.player) return null;
    if (this.overlay) return { id: 'pick', line: this.pickerFirst ? STAGE_TALK.pick : STAGE_TALK.pickNew, dom: '[data-template]' };
    const sc = this.current();
    const key = this.sceneKey();
    if (this.rec) {
      if (sc.events.length) return { id: `stop-${key}`, line: STAGE_TALK.stop, dom: '[data-record]' };
      const a = this.selectedActor();
      if (a) return a.kind === 'puppet' ? { id: `wave-${key}`, line: STAGE_TALK.wave, dom: '[data-act="wave"]' } : { id: `use-${key}`, line: STAGE_TALK.useProp, dom: '[data-act="use"]' };
      const star = starActor(sc);
      if (!star) return { id: `stop-${key}`, line: STAGE_TALK.stopFirst, dom: '[data-record]' };
      return { id: `tap-${key}-${star.id}`, line: star.kind === 'puppet' ? TAP_PUPPET[star.ref as PuppetRef] : STAGE_TALK.tapProp, actor: `actor-${star.id}` };
    }
    if (this.drawer === 'puppets' && !sc.actors.length) return { id: 'pickPuppet', line: STAGE_TALK.pickPuppet, dom: '[data-puppet]' };
    if (this.drawer) return null;
    if (!sc.actors.length) return { id: `add-${key}`, line: STAGE_TALK.addPuppet, dom: '[data-tool-puppets]' };
    if (!sc.events.length) return { id: `record-${key}`, line: this.turnLine ?? (key === 's0' ? STAGE_TALK.record : STAGE_TALK.recordNext), dom: '[data-record]' };
    if (!this.watched.has(key)) return { id: `watch-${key}`, line: STAGE_TALK.watchIt, dom: '[data-play]' };
    // this picture is made: what's next for the story (two acted pictures make a show)
    const recorded = this.story.scenes.filter((s) => s.events.length).length;
    if (recorded < 2) {
      const i = this.story.scenes.findIndex((s) => !s.events.length);
      if (i >= 0) return { id: `next-${i}`, line: STAGE_TALK.nextPicture, bravo: STAGE_TALK.nextPictureBravo, dom: `[data-scene="${i}"]` };
      if (!this.simple() && this.story.scenes.length < maxScenes(this.story)) return { id: 'more', line: STAGE_TALK.addPicture, bravo: STAGE_TALK.addPictureBravo, dom: '[data-add-scene]' };
    }
    if (!this.showSeen) return { id: 'show', line: STAGE_TALK.wholeShow, bravo: STAGE_TALK.wholeShowBravo, dom: '[data-show]' };
    if (!this.savedClean) return { id: 'keep', line: STAGE_TALK.keep, dom: '[data-save]' };
    return { id: 'free', line: null };
  }

  /**
   * After anything the child does: if the next step changed, say it (once) and
   * mark it; otherwise a tool may say what it does. `first` is said before the
   * step; `step` replaces the step's own line. Never two lines on top of each other.
   */
  private react(o: { tool?: Line | null; first?: Line | null; step?: Line; bravo?: boolean } = {}): void {
    this.coaching = true;
    const st = this.computeStep();
    const changed = !!st && st.id !== this.lastStep;
    if (changed) this.lastStep = st!.id;
    const stepLine = changed ? (o.step ?? (o.bravo ? st!.bravo : undefined) ?? st!.line) : null;
    const lead = o.first ?? (stepLine ? null : (o.tool ?? null));
    if (!lead && !stepLine) return;
    const my = ++this.talkToken;
    void (async () => {
      if (lead) await say(lead.speaker, lead.text);
      if (!stepLine || my !== this.talkToken || !this.alive() || this.computeStep()?.id !== st!.id) return;
      void instruct(stepLine.speaker, stepLine.text, () => this.demo());
      // "More help": the hand shows it straight away too
      if (this.little) this.time.delayedCall(350, () => this.demo());
    })();
  }

  /** Say something now (a step line still waiting its turn is dropped). */
  private talk(line: Line): Promise<void> {
    ++this.talkToken;
    return say(line.speaker, line.text);
  }

  /** A tool says what it does the first time it's used in a visit. */
  private toolOnce(key: string, line: Line): Line | null {
    if (this.toolSaid.has(key)) return null;
    this.toolSaid.add(key);
    return line;
  }

  /** A spoken question, then the choices (each read aloud as it lights up). */
  private async ask(q: Line, options: (StageChoice & { art?: string })[]): Promise<string | null> {
    this.asking = true;
    this.marker.hide();
    await this.talk(q);
    const pick = await services.choices.ask(options, { readAloud: true, at: 'top' });
    this.asking = false;
    return pick;
  }

  /** The page element for a step's marker (the "Done" button when the bar covers the scene strip). */
  private markerEl(st: Step | null): HTMLElement | null {
    if (!st?.dom) return null;
    const el = document.querySelector<HTMLElement>(st.dom);
    if (el && el.offsetParent !== null && !el.hidden) return el;
    if (this.bar && !this.bar.hidden) return this.bar.querySelector<HTMLElement>('[data-deselect]');
    return null;
  }

  protected override beaconTarget(): string | null {
    return this.coaching ? (this.computeStep()?.actor ?? null) : null;
  }

  /** Show the current step with the hand (on the stage) or the pointing hand over the page button. */
  private demo(): void {
    if (this.showing) return;
    const st = this.computeStep();
    if (st?.actor) {
      const t = this.targets.get(st.actor);
      if (t) {
        const r = t.bounds();
        void this.hand.tapAt(r.centerX, r.centerY, 2);
      }
      return;
    }
    const el = this.markerEl(st);
    if (el) return this.marker.tap(el);
    if (this.drawer) this.marker.tap(this.drawerEl?.querySelector<HTMLElement>('.tile') ?? null);
  }

  override hint(): void {
    // during a show the stage does the talking (the stop button is there to stop it)
    if (this.showing || this.asking) return audio.play('tap');
    this.hints.request();
  }

  private wait(ms: number): Promise<void> {
    return new Promise((r) => this.time.delayedCall(ms, r));
  }

  /** Let a puppet finish its line before anything else is said. */
  private async waitQuiet(maxMs = 6000): Promise<void> {
    const t0 = Date.now();
    while (isSpeaking() && Date.now() - t0 < maxMs && this.alive()) await new Promise((r) => setTimeout(r, 120));
  }

  private alive(): boolean {
    return this.sys.isActive() || this.sys.isPaused();
  }

  protected override tick(time: number): void {
    if (this.rec && this.tape) {
      const used = Math.min(1, (this.time.now - this.rec.start - this.rec.offset) / LIMITS.duration);
      this.tape.clear().fillStyle(0x3b2a20, 0.7).fillRoundedRect(SX + STAGE.w - 200, SY + 90, 180, 16, 8).fillStyle(0xd95b4f, 1).fillRoundedRect(SX + STAGE.w - 198, SY + 92, 176 * used, 12, 6);
      if (used >= 1) {
        this.stopRecording();
        this.react({ step: STAGE_TALK.full });
      }
    }
    if (this.drag || this.player?.playing) this.drawSelection();
    const st = this.coaching ? this.computeStep() : null;
    this.marker.point(st && !st.actor && !services.choices.open ? this.markerEl(st) : null);
    // a step that changed without a tap (rare) is still said, once nobody is talking
    if (st && st.id !== this.lastStep && !isSpeaking() && time - this.coachCheck > 700) {
      this.coachCheck = time;
      this.react();
    }
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
      asking: this.asking,
      step: this.computeStep()?.id ?? null,
      watched: [...this.watched],
      showSeen: this.showSeen,
      saved: this.savedClean,
    };
  }
}
