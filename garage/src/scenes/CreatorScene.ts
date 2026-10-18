import Phaser from 'phaser';
import { app, dur, type CreatorData } from '../app/context';
import { trackThumb } from '../art/pictures';
import { addImage, ensureArt } from '../art/rasterize';
import { checkTrack, emptySlots, legalAt, place, TRACK_PIECES, TRACK_SLOTS, type Slots, type TrackCheck, type TrackPiece } from '../core/track';
import { registerSceneForTests } from '../dev/testHooks';
import { button, h, layer } from '../ui/dom';
import { Hud } from '../ui/hud';
import { Fx } from '../view/fx';
import { drawTrackIcon } from '../view/pieces';
import { TruckView } from '../view/TruckView';
import { TUNING } from '../config/tuning';
import { tweenP, wait } from './util';
import './scenes.css';

/**
 * My Tiny Track: three save slots, each a six-slot track between a fixed
 * start and finish. Drag (or tap, then tap a slot) a log, a ramp or a pond
 * into a slot; only legal connections light up. Test checks the layout with
 * the same truck physics (both wheels); if it can't be driven, the slot that
 * would fix it glows with the piece that fixes it — no blame, no red cross.
 * A drivable track is driven for real with the normal mission controls.
 */
type Mode = 'slots' | 'edit';
const KEYS = ['bg.sky', 'bg.mid'];
const TILE_W = 220;
const TILE_H = 160;

interface Layout {
  ground: number;
  slot: { x: number; w: number }[];
  startX: number;
  finishX: number;
  trayY: number;
  tiles: { piece: TrackPiece; x: number; y: number; w: number; h: number }[];
}

export default class CreatorScene extends Phaser.Scene {
  isReady = false;
  private d!: CreatorData;
  private mode: Mode = 'slots';
  private slot = 0;
  private slots: Slots = emptySlots();
  private undoStack: Slots[] = [];
  private dirty = false;
  private check: TrackCheck | null = null;
  private hud: Hud | null = null;
  private ui: HTMLElement[] = [];
  private objs: Phaser.GameObjects.GameObject[] = [];
  private editorObjs: Phaser.GameObjects.GameObject[] = [];
  private track!: Phaser.GameObjects.Graphics;
  private overlay!: Phaser.GameObjects.Graphics;
  private float!: Phaser.GameObjects.Graphics;
  private arrow: Phaser.GameObjects.Image | null = null;
  private lay!: Layout;
  private fx!: Fx;
  private drag: { id: number; piece: TrackPiece; from: number | null; sx: number; sy: number; moved: boolean; target: number | null } | null = null;
  private selected: TrackPiece | null = null;
  private pulse = 0;
  private dead = false;
  private offs: (() => void)[] = [];

  constructor() {
    super('creator');
  }

  init(d: CreatorData): void {
    this.d = d ?? {};
    this.dead = false;
    this.isReady = false;
    this.ui = [];
    this.objs = [];
    this.editorObjs = [];
    this.trayG = null;
    this.offs = [];
    this.undoStack = [];
    this.check = null;
    this.drag = null;
    this.selected = null;
    this.arrow = null;
  }

  create(): void {
    registerSceneForTests(this);
    this.events.once('shutdown', () => this.cleanup());
    this.cameras.main.setBackgroundColor('#8fd0f0');
    this.fx = new Fx(this, { reduced: app().reducedMotion(), low: app().lowIntensity() });
    void ensureArt(this.textures, KEYS, 'creator-bg').then(() => {
      if (this.dead) return;
      this.backdrop();
      this.track = this.add.graphics().setDepth(5);
      this.overlay = this.add.graphics().setDepth(6);
      this.float = this.add.graphics().setDepth(20);
      this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.onDown(p));
      this.input.on('pointermove', (p: Phaser.Input.Pointer) => this.onMove(p));
      this.input.on('pointerup', (p: Phaser.Input.Pointer) => this.onUp(p));
      this.input.on('pointerupoutside', (p: Phaser.Input.Pointer) => this.onUp(p));
      const onResize = () => {
        this.backdrop();
        this.redraw();
      };
      this.scale.on('resize', onResize);
      this.offs.push(() => this.scale.off('resize', onResize));
      if (this.d.slots) {
        this.slot = this.d.slot ?? 0;
        this.openEditor(this.d.slots, false);
        if (this.d.drove) void this.celebrate();
      } else this.showSlots();
      this.isReady = true;
    });
  }

  private backdrop(): void {
    for (const o of this.objs) o.destroy();
    this.objs = [];
    const W = this.scale.width;
    const H = this.scale.height;
    const ground = H * 0.6;
    this.objs.push(addImage(this, 0, 0, 'bg.sky').setOrigin(0, 0).setDisplaySize(W, H).setDepth(-10));
    for (let x = 0; x < W; x += 2048) this.objs.push(addImage(this, x, ground - 300, 'bg.mid').setOrigin(0, 0).setDepth(-9));
    this.objs.push(this.add.rectangle(0, ground + 20, W, H, 0x8cc47c).setOrigin(0, 0).setDepth(-8));
  }

  private computeLayout(): Layout {
    const W = this.scale.width;
    const H = this.scale.height;
    const left = 130;
    const right = 130;
    const startW = 230;
    const finishW = 230;
    const ground = H * 0.6;
    const slotW = (W - left - right - startW - finishW) / TRACK_SLOTS;
    const slot = Array.from({ length: TRACK_SLOTS }, (_, i) => ({ x: left + startW + i * slotW, w: slotW }));
    const n = TRACK_PIECES.length;
    const gap = 34;
    const total = n * TILE_W + (n - 1) * gap;
    const trayY = H - TILE_H - 34;
    const tiles = TRACK_PIECES.map((piece, i) => ({ piece, x: (W - total) / 2 + i * (TILE_W + gap), y: trayY, w: TILE_W, h: TILE_H }));
    return { ground, slot, startX: left, finishX: W - right - finishW, trayY, tiles };
  }

  // ------------------------------------------------------------------ the three save slots

  private showSlots(): void {
    this.mode = 'slots';
    this.clearUi();
    this.hud?.destroy();
    this.hud = null;
    this.track?.clear();
    this.overlay?.clear();
    this.trayG?.clear();
    this.setArrow(null);
    const box = h('div', { class: 'c-slots', 'data-testid': 'track-slots' });
    app().save.tracks.forEach((t, i) => {
      const empty = !t;
      box.append(
        button({
          icon: { svg: trackThumb(t ? t.slots : emptySlots()) },
          label: empty ? `Empty track slot ${i + 1}: start a new track` : `Saved track ${i + 1}: keep building`,
          size: 'lg',
          variant: 'plain',
          testid: `slot-${i}`,
          extraClass: `c-slot ${empty ? 'empty' : ''}`,
          onTap: () => {
            this.slot = i;
            this.openEditor(t ? t.slots.slice() : emptySlots(), false);
          },
        }),
      );
    });
    this.addUi(box);
    this.addUi(button({ icon: 'garage', label: 'Back to the garage', size: 'md', variant: 'soft', testid: 'creator-garage', extraClass: 'g-corner-tl', onTap: () => app().go('garage', { entrance: 'return' }) }));
  }

  private clearUi(): void {
    for (const el of this.ui) el.remove();
    this.ui = [];
  }

  private addUi(el: HTMLElement): void {
    layer('panel').append(el);
    this.ui.push(el);
  }

  // ------------------------------------------------------------------ the editor

  private openEditor(slots: Slots, dirty: boolean): void {
    this.mode = 'edit';
    this.clearUi();
    this.slots = slots.slice();
    this.dirty = dirty;
    this.undoStack = [];
    this.check = null;
    this.hud?.destroy();
    this.hud = new Hud({
      onPause: () => undefined,
      onHelp: () => void this.help(),
      onUndo: () => this.undo(),
      onClear: () => this.clearTrack(),
      onTest: () => void this.test(),
      onSave: () => void this.saveTrack(true),
      onBack: () => void this.back(),
    });
    this.hud.setMode('creator');
    this.refreshButtons();
    // the start: your own truck waits at the line
    const L = this.computeLayout();
    const t = new TruckView(this, app().save.truck, { scale: 0.5, depth: 7 });
    t.update({ x: L.startX + 90, y: L.ground, vx: 0, vy: 0, slope: 0, accel: 0, squash: 0, rolled: 0, grounded: true }, 0);
    const fin = addImage(this, L.finishX + 120, L.ground, 'obj.finish').setScale(0.42).setDepth(4);
    for (const o of this.editorObjs) o.destroy();
    this.editorObjs = [t.container, fin];
    this.redraw();
  }

  private refreshButtons(): void {
    if (!this.hud) return;
    this.hud.setEnabled('undo', this.undoStack.length > 0);
    this.hud.setEnabled('clear', this.slots.some(Boolean));
    this.hud.setEnabled('test', true);
    this.hud.setEnabled('save', true);
  }

  private redraw(): void {
    if (this.mode !== 'edit' || !this.track) return;
    const L = (this.lay = this.computeLayout());
    const g = this.track;
    g.clear();
    // ground from start to finish
    const x0 = L.startX - 40;
    const x1 = L.finishX + 260;
    g.fillStyle(0xb0743f, 1).fillRect(x0, L.ground, x1 - x0, 70);
    g.fillStyle(0x6db54c, 1).fillRect(x0, L.ground - 6, x1 - x0, 26);
    g.lineStyle(5, 0x3a2618, 1).lineBetween(x0, L.ground - 6, x1, L.ground - 6);
    const dragPiece = this.drag?.moved ? this.drag.piece : this.selected;
    for (let i = 0; i < TRACK_SLOTS; i++) {
      const s = L.slot[i];
      const piece = this.slots[i];
      if (piece && !(this.drag?.moved && this.drag.from === i)) {
        drawSlotPiece(g, piece, s.x, s.w, L.ground);
      } else {
        // an empty slot: a dashed socket; brighter (and bobbing via pulse) where the held piece may go
        const fits = dragPiece ? this.canDrop(i, dragPiece) : false;
        const lift = fits && !app().reducedMotion() ? Math.sin(this.pulse) * 6 : 0;
        dashed(g, s.x + 8, L.ground - 170 - lift, s.w - 16, 176, fits ? 7 : 4, fits ? 1 : 0.4);
        if (this.drag?.target === i) {
          g.fillStyle(0xffffff, 0.35).fillRoundedRect(s.x + 8, L.ground - 170, s.w - 16, 176, 18);
        }
      }
    }
    this.drawHint();
    this.renderTray();
  }

  private drawHint(): void {
    const o = this.overlay;
    o.clear();
    const c = this.check;
    if (!c || c.playable || c.fixSlot === null || !this.lay) {
      this.setArrow(null);
      return;
    }
    const L = this.lay;
    const fix = L.slot[c.fixSlot];
    // the piece that would fix it, see-through, in the slot that needs it
    o.setAlpha(app().reducedMotion() ? 0.8 : 0.72 + 0.2 * Math.sin(this.pulse));
    if (c.fixPiece) drawSlotPiece(o, c.fixPiece, fix.x, fix.w, L.ground);
    dashed(o, fix.x + 4, L.ground - 178, fix.w - 8, 186, 8, 1);
    if (c.problemSlot !== null && c.problemSlot !== c.fixSlot) {
      const p = L.slot[c.problemSlot];
      dashed(o, p.x + 4, L.ground - 178, p.w - 8, 186, 4, 0.7);
    }
    this.setArrow({ x: fix.x + fix.w / 2, y: L.ground - 250 });
  }

  private setArrow(at: { x: number; y: number } | null): void {
    if (!at) {
      this.arrow?.destroy();
      this.arrow = null;
      return;
    }
    if (!this.arrow) {
      this.arrow = addImage(this, at.x, at.y, 'fx.arrow').setDepth(30);
      if (!app().reducedMotion()) this.tweens.add({ targets: this.arrow, y: at.y - 18, duration: 480, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    } else this.arrow.setPosition(at.x, at.y);
  }

  override update(_t: number, dms: number): void {
    if (this.mode !== 'edit') return;
    this.pulse += dms / 260;
    if (this.drag?.moved || this.selected || (this.check && !this.check.playable)) this.redraw();
  }

  // ------------------------------------------------------------------ input

  private canDrop(i: number, piece: TrackPiece): boolean {
    const from = this.drag?.from ?? null;
    const base = this.slots.slice();
    if (from !== null) base[from] = null;
    if (base[i] && i !== from) return false;
    return legalAt(base, i, piece);
  }

  private slotAt(x: number, y: number): number | null {
    const L = this.lay;
    if (!L || y < L.ground - 300 || y > L.ground + 120) return null;
    for (let i = 0; i < TRACK_SLOTS; i++) if (x >= L.slot[i].x && x < L.slot[i].x + L.slot[i].w) return i;
    return null;
  }

  private tileAt(x: number, y: number): TrackPiece | null {
    for (const t of this.lay?.tiles ?? []) if (x >= t.x - 8 && x <= t.x + t.w + 8 && y >= t.y - 12 && y <= t.y + t.h + 8) return t.piece;
    return null;
  }

  private onDown(p: Phaser.Input.Pointer): void {
    if (this.mode !== 'edit' || this.drag) return;
    const tile = this.tileAt(p.x, p.y);
    if (tile) {
      this.drag = { id: p.id, piece: tile, from: null, sx: p.x, sy: p.y, moved: false, target: null };
      return;
    }
    const i = this.slotAt(p.x, p.y);
    if (i !== null && this.slots[i]) {
      this.drag = { id: p.id, piece: this.slots[i]!, from: i, sx: p.x, sy: p.y, moved: false, target: null };
      return;
    }
    if (i !== null && this.selected) {
      const piece = this.selected;
      this.selected = null;
      if (this.canDrop(i, piece)) this.apply(place(this.slots, i, piece));
      this.renderTray();
      this.redraw();
      return;
    }
    if (this.selected) {
      this.selected = null;
      this.renderTray();
      this.redraw();
    }
  }

  private onMove(p: Phaser.Input.Pointer): void {
    const d = this.drag;
    if (!d || d.id !== p.id) return;
    if (!d.moved && Math.hypot(p.x - d.sx, p.y - d.sy) < 14) return;
    d.moved = true;
    this.selected = null;
    const i = this.slotAt(p.x, p.y - 40);
    d.target = i !== null && this.canDrop(i, d.piece) ? i : null;
    this.float.clear();
    const L = this.lay;
    if (d.target !== null) {
      const s = L.slot[d.target];
      this.float.setAlpha(0.6);
      drawSlotPiece(this.float, d.piece, s.x, s.w, L.ground);
    } else {
      this.float.setAlpha(1);
      drawTrackIcon(this.float, d.piece, p.x, p.y - 70, TILE_W * 0.9, TILE_H * 0.9);
    }
    this.redraw();
  }

  private onUp(p: Phaser.Input.Pointer): void {
    const d = this.drag;
    if (!d || d.id !== p.id) return;
    this.drag = null;
    this.float.clear();
    if (!d.moved) {
      if (d.from === null) this.selected = this.selected === d.piece ? null : d.piece;
      else this.apply(withSlot(this.slots, d.from, null)); // tap a placed piece: it goes back
      this.renderTray();
      this.redraw();
      return;
    }
    if (d.target !== null) {
      const base = d.from !== null ? withSlot(this.slots, d.from, null) : this.slots;
      const next = place(base, d.target, d.piece);
      if (next) this.apply(next);
    } else if (d.from !== null) {
      this.apply(withSlot(this.slots, d.from, null));
    }
    this.redraw();
  }

  private apply(next: Slots | null): void {
    if (!next) return;
    if (next.every((v, i) => v === this.slots[i])) return;
    this.undoStack.push(this.slots.slice());
    this.slots = next;
    this.dirty = true;
    this.check = null;
    this.hud?.hint(null);
    this.refreshButtons();
    this.redraw();
  }

  private undo(): void {
    const prev = this.undoStack.pop();
    if (!prev) return;
    this.slots = prev;
    this.dirty = true;
    this.check = null;
    this.refreshButtons();
    this.redraw();
  }

  private clearTrack(): void {
    if (!this.slots.some(Boolean)) return;
    this.apply(emptySlots());
  }

  // ------------------------------------------------------------------ test, save, help

  private async test(): Promise<void> {
    const speed = app().settings.slowDriving ? TUNING.drive.slowFactor : 1;
    const c = checkTrack(this.slots, speed);
    this.check = c;
    if (!c.playable) {
      this.redraw();
      return;
    }
    await this.saveTrack(false);
    if (this.dead) return;
    app().go('mission', { kind: 'track', slots: this.slots.slice(), slot: this.slot });
  }

  private async saveTrack(show: boolean): Promise<boolean> {
    const s = app().save;
    const tracks = s.tracks.slice();
    tracks[this.slot] = { slots: this.slots.slice(), savedAt: Date.now() };
    const ok = await app().commit({ ...s, tracks });
    if (ok) this.dirty = false;
    if (show && !this.dead) {
      const W = this.scale.width;
      if (ok) this.fx.check(W - 240, 220);
      else this.fx.puff(W - 240, 220);
    }
    return ok;
  }

  private async back(): Promise<void> {
    if (this.dirty) await this.saveTrack(false);
    if (this.dead) return;
    for (const o of this.editorObjs) o.destroy();
    this.editorObjs = [];
    this.showSlots();
  }

  private async help(): Promise<void> {
    if (this.check && !this.check.playable) {
      this.redraw();
      return;
    }
    // a hand carries a log to the first empty slot
    const L = this.lay;
    const i = this.slots.findIndex((v) => !v);
    if (i < 0 || !L) {
      this.hud?.hint('test');
      return;
    }
    const tile = L.tiles[0];
    const hand = addImage(this, tile.x + tile.w / 2, tile.y + tile.h / 2, 'fx.hand').setDepth(40);
    const to = { x: L.slot[i].x + L.slot[i].w / 2, y: L.ground - 70 };
    if (!app().reducedMotion()) {
      const o = { t: 0 };
      await tweenP(this, {
        targets: o,
        t: 1,
        duration: 1100,
        ease: 'Sine.InOut',
        onUpdate: () => {
          const x = tile.x + tile.w / 2 + (to.x - tile.x - tile.w / 2) * o.t;
          const y = tile.y + tile.h / 2 + (to.y - tile.y - tile.h / 2) * o.t - Math.sin(o.t * Math.PI) * 140;
          hand.setPosition(x, y + 40);
          this.float.clear();
          this.float.setAlpha(0.8);
          drawTrackIcon(this.float, 'log', x, y - 30, TILE_W * 0.8, TILE_H * 0.8);
        },
      } as Phaser.Types.Tweens.TweenBuilderConfig);
    } else {
      hand.setPosition(to.x, to.y + 40);
      drawSlotPiece(this.float, 'log', L.slot[i].x, L.slot[i].w, L.ground);
    }
    await wait(this, dur(600, 1200));
    this.float.clear();
    hand.destroy();
  }

  private async celebrate(): Promise<void> {
    await wait(this, dur(300, 0));
    if (this.dead || !this.lay) return;
    this.fx.check(this.lay.finishX + 120, this.lay.ground - 260);
    this.fx.confetti(this.lay.finishX + 120, this.lay.ground - 400);
  }

  // ------------------------------------------------------------------ tray drawing (canvas)

  private trayG: Phaser.GameObjects.Graphics | null = null;

  private renderTray(): void {
    if (!this.trayG) this.trayG = this.add.graphics().setDepth(15);
    const g = this.trayG;
    g.clear();
    if (this.mode !== 'edit') return;
    const L = this.lay ?? this.computeLayout();
    const first = L.tiles[0];
    const last = L.tiles[L.tiles.length - 1];
    g.fillStyle(0xd39550, 1).fillRoundedRect(first.x - 24, first.y - 20, last.x + last.w - first.x + 48, TILE_H + 36, 32);
    g.lineStyle(6, 0x3a2618, 1).strokeRoundedRect(first.x - 24, first.y - 20, last.x + last.w - first.x + 48, TILE_H + 36, 32);
    const fixPiece = this.check && !this.check.playable ? this.check.fixPiece : null;
    for (const t of L.tiles) {
      // the piece that would fix the track bobs in the tray
      const lift = fixPiece === t.piece && !app().reducedMotion() ? Math.round(6 + 6 * Math.sin(this.pulse)) : 0;
      const sel = this.selected === t.piece || fixPiece === t.piece;
      const y = t.y - lift - (sel ? 14 : 0);
      g.fillStyle(0xfff6e6, 1).fillRoundedRect(t.x, y, t.w, t.h, 24);
      g.lineStyle(sel ? 8 : 5, 0x3a2618, 1).strokeRoundedRect(t.x, y, t.w, t.h, 24);
      drawTrackIcon(g, t.piece, t.x + t.w / 2, y + t.h / 2, t.w - 30, t.h - 30);
      if (sel) dashed(g, t.x - 10, y - 10, t.w + 20, t.h + 20, 5, 1);
    }
  }

  // ------------------------------------------------------------------ hooks

  inspect(): Record<string, unknown> {
    return { mode: this.mode, slot: this.slot, slots: this.slots.slice(), dirty: this.dirty, check: this.check, selected: this.selected, saved: app().save.tracks.map((t) => (t ? t.slots : null)) };
  }

  testTargets(): { id: string; x: number; y: number; w: number; h: number; space: 'world' | 'screen' }[] {
    if (this.mode !== 'edit' || !this.lay) return [];
    const L = this.lay;
    const out = L.tiles.map((t) => ({ id: `ttray-${t.piece}`, x: t.x + t.w / 2, y: t.y + t.h / 2, w: t.w, h: t.h, space: 'screen' as const }));
    L.slot.forEach((s, i) => out.push({ id: `tslot-${i}`, x: s.x + s.w / 2, y: L.ground - 80, w: s.w - 16, h: 170, space: 'screen' }));
    return out;
  }

  private cleanup(): void {
    this.dead = true;
    this.isReady = false;
    for (const off of this.offs) off();
    this.clearUi();
    this.hud?.destroy();
    this.hud = null;
  }
}

function withSlot(s: Slots, i: number, v: TrackPiece | null): Slots {
  const n = s.slice();
  n[i] = v;
  return n;
}

function dashed(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, width: number, alpha: number): void {
  g.lineStyle(width, 0x3a2618, alpha);
  const dash = 18;
  const gap = 12;
  const edge = (ax: number, ay: number, bx: number, by: number) => {
    const len = Math.hypot(bx - ax, by - ay);
    for (let d = 0; d < len; d += dash + gap) {
      const a = d / len;
      const b = Math.min(1, (d + dash) / len);
      g.lineBetween(ax + (bx - ax) * a, ay + (by - ay) * a, ax + (bx - ax) * b, ay + (by - ay) * b);
    }
  };
  edge(x, y, x + w, y);
  edge(x + w, y, x + w, y + h);
  edge(x + w, y + h, x, y + h);
  edge(x, y + h, x, y);
}

/**
 * A piece as it sits on the track (not an icon): a log on the ground, a
 * wooden ramp rising to the slot's right edge, or a pond cut into the earth.
 * Shapes match the real track (core/track.ts): log in the slot's middle,
 * ramp over its right half, pond across most of it.
 */
function drawSlotPiece(g: Phaser.GameObjects.Graphics, piece: TrackPiece, x: number, w: number, ground: number): void {
  const ink = 0x3a2618;
  if (piece === 'pond') {
    const x0 = x + w * 0.1;
    const x1 = x + w * 0.9;
    g.fillStyle(0x7d4f2a, 1).fillRect(x0 - 6, ground - 6, x1 - x0 + 12, 70);
    g.fillStyle(0x5cb8e6, 1).fillRect(x0, ground + 10, x1 - x0, 54);
    g.fillStyle(0xa9e2fb, 1).fillRect(x0, ground + 10, x1 - x0, 8);
    g.lineStyle(5, ink, 1).strokeRect(x0, ground - 6, x1 - x0, 70);
    g.fillStyle(0x4fa64a, 1).fillEllipse(x0 + (x1 - x0) * 0.62, ground + 16, 34, 10);
    g.lineStyle(3, ink, 1).strokeEllipse(x0 + (x1 - x0) * 0.62, ground + 16, 34, 10);
    return;
  }
  if (piece === 'ramp') {
    const x0 = x + w * 0.42;
    const x1 = x + w - 4;
    const top = ground - 6 - w * 0.26;
    g.fillStyle(0xd39550, 1);
    g.beginPath();
    g.moveTo(x0, ground - 6);
    g.lineTo(x1, top);
    g.lineTo(x1, ground - 6);
    g.closePath();
    g.fillPath();
    g.lineStyle(3, 0x9a5f2c, 0.7);
    for (let i = 1; i < 4; i++) {
      const t = i / 4;
      const sx = x0 + (x1 - x0) * t;
      g.lineBetween(sx, ground - 6 - (ground - 6 - top) * t, sx, ground - 6);
    }
    g.lineStyle(5, ink, 1);
    g.beginPath();
    g.moveTo(x0, ground - 6);
    g.lineTo(x1, top);
    g.lineTo(x1, ground - 6);
    g.closePath();
    g.strokePath();
    // a chevron at the lip: this end throws you up
    g.lineStyle(4, ink, 1).lineBetween(x1 - 26, top + 22, x1 - 14, top + 30).lineBetween(x1 - 26, top + 38, x1 - 14, top + 30);
    return;
  }
  // log: lying across the track, end-on so it reads as "hop over me"
  const cx = x + w * 0.5;
  const r = Math.min(34, w * 0.18);
  g.fillStyle(0xd39550, 1).fillRoundedRect(cx - r, ground - 6 - r * 2, r * 2.3, r * 2, r);
  g.lineStyle(5, ink, 1).strokeRoundedRect(cx - r, ground - 6 - r * 2, r * 2.3, r * 2, r);
  g.fillStyle(0xf0c27f, 1).fillCircle(cx - r * 0.2, ground - 6 - r, r * 0.9);
  g.lineStyle(5, ink, 1).strokeCircle(cx - r * 0.2, ground - 6 - r, r * 0.9);
  g.lineStyle(3, 0x9a5f2c, 0.8).strokeCircle(cx - r * 0.2, ground - 6 - r, r * 0.5);
  g.fillStyle(0x9a5f2c, 1).fillCircle(cx - r * 0.2, ground - 6 - r, r * 0.15);
}
