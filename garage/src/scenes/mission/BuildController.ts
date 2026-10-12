import Phaser from 'phaser';
import { addImage } from '../../art/rasterize';
import { TUNING } from '../../config/tuning';
import { canPlace, socketsFor, snapTarget, segmentsFor, type BuildZone, type PieceKind, type Placement, type Socket } from '../../core/build';
import type { Segment } from '../../core/terrain';
import type { CrewView } from '../../view/CrewView';
import type { Fx } from '../../view/fx';
import { drawPiece, drawSocket, drawTrayIcon } from '../../view/pieces';
import { WorldView } from '../../view/WorldView';
import { tweenP, wait, worldToScreen } from '../util';

/**
 * Building at a zone: a tray of at most three big pieces at the bottom of the
 * screen and shaped sockets in the world. Drag a piece onto a socket (it
 * snaps when close), or tap a piece and then a socket. A piece dropped
 * anywhere else glides back. Undo, clear and test live on the HUD.
 *
 * One finger at a time: a second pointer is ignored while one is dragging.
 */
export interface BuildHost {
  scene: Phaser.Scene;
  world: WorldView;
  fx: Fx;
  reduced(): boolean;
  /** called after every change to the layout (placements) */
  changed(): void;
  /** the friend at this zone and whether they were invited to help */
  helper(): { crew: CrewView | null; invited: boolean };
}

type Action = { t: 'place'; p: Placement } | { t: 'remove'; p: Placement } | { t: 'clear'; removed: Placement[] };

interface Tile {
  kind: PieceKind;
  g: Phaser.GameObjects.Graphics;
  rect: { x: number; y: number; w: number; h: number };
}

interface Drag {
  pointerId: number;
  kind: PieceKind;
  /** where it came from: the tray, or a socket it was placed in */
  from: 'tray' | Placement;
  sx: number;
  sy: number;
  moved: boolean;
  snapped: Socket | null;
}

const TILE_W = 230;
const TILE_H = 170;
const TILE_GAP = 34;

export class BuildController {
  placed: Placement[] = [];
  private undoStack: Action[] = [];
  private open = false;
  private tray: Phaser.GameObjects.Container;
  private board: Phaser.GameObjects.Graphics;
  private tiles: Tile[] = [];
  private sockets = new Map<string, Phaser.GameObjects.Graphics>();
  private bobs = new Map<string, Phaser.Tweens.Tween>();
  private ghost: Phaser.GameObjects.Graphics;
  private float: Phaser.GameObjects.Graphics;
  private hand: Phaser.GameObjects.Image | null = null;
  private arrow: Phaser.GameObjects.Image | null = null;
  private drag: Drag | null = null;
  private selected: PieceKind | null = null;
  private hintSocket: string | null = null;
  private demoing = false;
  private offs: (() => void)[] = [];

  constructor(
    private host: BuildHost,
    readonly zone: BuildZone,
  ) {
    const s = host.scene;
    this.tray = s.add.container(0, 0).setScrollFactor(0).setDepth(WorldView.DEPTH.ui).setVisible(false);
    this.board = s.add.graphics();
    this.tray.add(this.board);
    for (const kind of zone.tray.slice(0, TUNING.build.maxTray)) {
      const g = s.add.graphics();
      this.tray.add(g);
      this.tiles.push({ kind, g, rect: { x: 0, y: 0, w: TILE_W, h: TILE_H } });
    }
    for (const sock of zone.sockets) {
      const g = s.add.graphics().setDepth(zone.lane === 'front' ? WorldView.DEPTH.front + 2 : WorldView.DEPTH.pieces + 1).setVisible(false);
      this.sockets.set(sock.id, g);
    }
    this.ghost = s.add.graphics().setDepth(WorldView.DEPTH.front + 5).setVisible(false);
    this.float = s.add.graphics().setScrollFactor(0).setDepth(WorldView.DEPTH.ui + 2).setVisible(false);
    const down = (p: Phaser.Input.Pointer) => this.onDown(p);
    const move = (p: Phaser.Input.Pointer) => this.onMove(p);
    const up = (p: Phaser.Input.Pointer) => this.onUp(p);
    s.input.on('pointerdown', down);
    s.input.on('pointermove', move);
    s.input.on('pointerup', up);
    s.input.on('pointerupoutside', up);
    const resize = () => this.layout();
    s.scale.on('resize', resize);
    this.offs.push(
      () => s.input.off('pointerdown', down),
      () => s.input.off('pointermove', move),
      () => s.input.off('pointerup', up),
      () => s.input.off('pointerupoutside', up),
      () => s.scale.off('resize', resize),
    );
    this.layout();
  }

  // ------------------------------------------------------------ show / hide

  show(): void {
    this.open = true;
    this.tray.setVisible(true);
    for (const g of this.sockets.values()) g.setVisible(true);
    this.layout();
    this.redraw();
    if (!this.host.reduced()) {
      // the tray pieces wiggle once to say "these are yours"
      this.tiles.forEach((t, i) => {
        this.host.scene.tweens.add({ targets: t.g, angle: { from: -4, to: 4 }, duration: 140, yoyo: true, repeat: 2, delay: 200 + i * 120 });
      });
    }
  }

  hide(): void {
    this.cancelDrag();
    this.open = false;
    this.selected = null;
    this.tray.setVisible(false);
    for (const g of this.sockets.values()) g.setVisible(false);
    this.ghost.setVisible(false);
    this.float.setVisible(false);
    this.setArrow(null);
  }

  get isOpen(): boolean {
    return this.open;
  }

  get canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  segments(): Segment[] {
    return segmentsFor(this.zone, this.placed);
  }

  // ------------------------------------------------------------ layout & drawing

  private layout(): void {
    const s = this.host.scene;
    const W = s.scale.width;
    const H = s.scale.height;
    const n = this.tiles.length;
    const total = n * TILE_W + (n - 1) * TILE_GAP;
    const x0 = (W - total) / 2;
    const y0 = H - TILE_H - 34;
    this.tiles.forEach((t, i) => {
      t.rect = { x: x0 + i * (TILE_W + TILE_GAP), y: y0, w: TILE_W, h: TILE_H };
    });
    this.board.clear();
    this.board.fillStyle(0x3a2618, 0.18).fillRoundedRect(x0 - 28, y0 - 16, total + 56, TILE_H + 40, 34);
    this.board.fillStyle(0xd39550, 1).fillRoundedRect(x0 - 24, y0 - 20, total + 48, TILE_H + 36, 32);
    this.board.lineStyle(6, 0x3a2618, 1).strokeRoundedRect(x0 - 24, y0 - 20, total + 48, TILE_H + 36, 32);
    this.drawTiles();
  }

  private isUsed(kind: PieceKind): boolean {
    return this.placed.some((p) => p.piece === kind) || (this.drag !== null && this.drag.kind === kind && this.drag.from === 'tray' && this.drag.moved);
  }

  private drawTiles(): void {
    for (const t of this.tiles) {
      const { x, y, w, h } = t.rect;
      const g = t.g;
      g.clear();
      g.setPosition(0, 0).setAngle(0);
      const used = this.isUsed(t.kind);
      const sel = this.selected === t.kind;
      // tile card
      g.fillStyle(used ? 0xe9c99a : 0xfff6e6, 1).fillRoundedRect(x, y - (sel ? 14 : 0), w, h, 26);
      g.lineStyle(sel ? 8 : 5, 0x3a2618, used ? 0.4 : 1).strokeRoundedRect(x, y - (sel ? 14 : 0), w, h, 26);
      if (used) {
        // an empty dashed spot where the piece was (shape stays, so you can see what's out)
        dashedRect(g, x + 16, y + 16, w - 32, h - 32, 0x3a2618, 0.35);
      } else {
        drawTrayIcon(g, t.kind, x + w / 2, y + h / 2 - (sel ? 14 : 0), w - 36, h - 36);
      }
      if (sel) {
        // selected: a raised card with a dashed ring (shape + motion, not colour)
        dashedRect(g, x - 10, y - 24, w + 20, h + 20, 0x3a2618, 1);
      }
    }
  }

  private redraw(): void {
    const dragKind = this.drag?.moved ? this.drag.kind : this.selected;
    const targets = dragKind ? new Set(socketsFor(this.zone, this.placedExceptDrag(), dragKind).map((s) => s.id)) : new Set<string>();
    for (const sock of this.zone.sockets) {
      const g = this.sockets.get(sock.id)!;
      g.clear();
      const filled = this.placed.some((p) => p.socket === sock.id);
      if (filled) {
        this.setBob(sock.id, false);
        continue;
      }
      const kinds = (Object.keys(sock.fits) as PieceKind[]).filter((k) => this.zone.tray.includes(k));
      if (dragKind) {
        if (targets.has(sock.id)) {
          drawSocket(g, sock, [dragKind], this.drag?.snapped?.id === sock.id ? 'hover' : 'target');
          this.setBob(sock.id, this.drag?.snapped?.id !== sock.id);
        } else this.setBob(sock.id, false);
      } else {
        drawSocket(g, sock, kinds, sock.id === this.hintSocket ? 'target' : 'idle');
        this.setBob(sock.id, sock.id === this.hintSocket);
      }
    }
    this.drawTiles();
  }

  private setBob(id: string, on: boolean): void {
    const g = this.sockets.get(id)!;
    const existing = this.bobs.get(id);
    if (on && !existing && !this.host.reduced()) {
      this.bobs.set(id, this.host.scene.tweens.add({ targets: g, y: -10, duration: 520, yoyo: true, repeat: -1, ease: 'Sine.InOut' }));
    } else if (!on && existing) {
      existing.stop();
      this.bobs.delete(id);
      g.y = 0;
    }
  }

  private setArrow(sock: Socket | null): void {
    if (!sock) {
      this.arrow?.destroy();
      this.arrow = null;
      return;
    }
    if (!this.arrow) {
      this.arrow = addImage(this.host.scene, sock.x, sock.y - 190, 'fx.arrow').setDepth(WorldView.DEPTH.fx);
      if (!this.host.reduced()) this.host.scene.tweens.add({ targets: this.arrow, y: sock.y - 210, duration: 480, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    } else this.arrow.setPosition(sock.x, sock.y - 190);
  }

  /** After a test that didn't work: point at the socket that would help. Cleared when the layout changes. */
  pointAt(socketId: string | null): void {
    this.hintSocket = socketId;
    this.setArrow(socketId ? (this.zone.sockets.find((s) => s.id === socketId) ?? null) : null);
    this.redraw();
  }

  // ------------------------------------------------------------ input

  private tileAt(x: number, y: number): Tile | null {
    for (const t of this.tiles) {
      const r = t.rect;
      if (x >= r.x - 8 && x <= r.x + r.w + 8 && y >= r.y - 22 && y <= r.y + r.h + 8) return t;
    }
    return null;
  }

  private placedAt(wx: number, wy: number): Placement | null {
    let best: Placement | null = null;
    let bestD = 130;
    for (const p of this.placed) {
      const s = this.zone.sockets.find((x) => x.id === p.socket)!;
      const d = Math.hypot(s.x - wx, s.y - wy);
      if (d < bestD) {
        best = p;
        bestD = d;
      }
    }
    return best;
  }

  private placedExceptDrag(): Placement[] {
    const d = this.drag;
    if (d && d.from !== 'tray' && d.moved) return this.placed.filter((p) => p !== d.from);
    return this.placed;
  }

  private onDown(p: Phaser.Input.Pointer): void {
    if (!this.open || this.demoing || this.drag) return;
    const tile = this.tileAt(p.x, p.y);
    if (tile) {
      if (this.isUsed(tile.kind)) return;
      this.drag = { pointerId: p.id, kind: tile.kind, from: 'tray', sx: p.x, sy: p.y, moved: false, snapped: null };
      return;
    }
    const placed = this.placedAt(p.worldX, p.worldY);
    if (placed) {
      this.drag = { pointerId: p.id, kind: placed.piece, from: placed, sx: p.x, sy: p.y, moved: false, snapped: null };
      return;
    }
    if (this.selected) {
      // tap-then-target: the nearest socket that fits, generously
      const sock = snapTarget(this.zone, this.placed, this.selected, p.worldX, p.worldY);
      if (sock) {
        const kind = this.selected;
        this.selected = null;
        this.place({ socket: sock.id, piece: kind }, true);
      } else {
        this.selected = null;
        this.redraw();
      }
    }
  }

  private onMove(p: Phaser.Input.Pointer): void {
    const d = this.drag;
    if (!d || p.id !== d.pointerId) return;
    if (!d.moved) {
      if (Math.hypot(p.x - d.sx, p.y - d.sy) < 14) return;
      d.moved = true;
      this.selected = null;
      if (d.from !== 'tray') this.host.world.removeBuilt(builtId(this.zone, d.from));
    }
    // the piece rides a little above the finger so it stays visible
    d.snapped = snapTarget(this.zone, this.placedExceptDrag(), d.kind, p.worldX, p.worldY - 50);
    this.ghost.clear();
    this.float.clear();
    if (d.snapped) {
      drawPiece(this.ghost, d.kind, d.snapped.fits[d.kind]!, 'ghost');
      this.ghost.setVisible(true);
      this.float.setVisible(false);
    } else {
      this.ghost.setVisible(false);
      drawTrayIcon(this.float, d.kind, p.x, p.y - 60, TILE_W * 0.9, TILE_H * 0.9);
      this.float.setVisible(true);
    }
    this.redraw();
  }

  private onUp(p: Phaser.Input.Pointer): void {
    const d = this.drag;
    if (!d || p.id !== d.pointerId) return;
    this.drag = null;
    this.ghost.setVisible(false);
    if (!d.moved) {
      this.float.setVisible(false);
      if (d.from === 'tray') {
        // tap a tray piece: select it (tap again to put it down)
        this.selected = this.selected === d.kind ? null : d.kind;
        this.redraw();
      } else {
        // tap a placed piece: it goes back to the tray
        this.remove(d.from, true);
      }
      return;
    }
    if (d.snapped) {
      this.float.setVisible(false);
      if (d.from !== 'tray') {
        this.placed = this.placed.filter((x) => x !== d.from);
        this.undoStack.push({ t: 'remove', p: d.from as Placement });
      }
      this.place({ socket: d.snapped.id, piece: d.kind }, true);
      return;
    }
    // dropped somewhere it doesn't fit: glide back to the tray, gently
    if (d.from !== 'tray') {
      this.placed = this.placed.filter((x) => x !== d.from);
      this.undoStack.push({ t: 'remove', p: d.from as Placement });
      this.host.changed();
    }
    void this.glideBack(d.kind, p.x, p.y - 60);
  }

  /** Release whatever is held (interruptions): a dragged piece goes back where it came from. */
  cancelDrag(): void {
    const d = this.drag;
    if (!d) return;
    this.drag = null;
    this.ghost.setVisible(false);
    this.float.setVisible(false);
    if (d.moved && d.from !== 'tray') {
      const from = d.from;
      const sock = this.zone.sockets.find((s) => s.id === from.socket)!;
      this.host.world.addBuilt(builtId(this.zone, from), from.piece, sock.fits[from.piece]!, false);
    }
    this.redraw();
  }

  private async glideBack(kind: PieceKind, x: number, y: number): Promise<void> {
    const tile = this.tiles.find((t) => t.kind === kind);
    if (!tile || this.host.reduced()) {
      this.float.setVisible(false);
      this.redraw();
      return;
    }
    const tx = tile.rect.x + tile.rect.w / 2;
    const ty = tile.rect.y + tile.rect.h / 2 + 60;
    this.float.setVisible(true);
    const o = { x, y };
    await tweenP(this.host.scene, {
      targets: o,
      x: tx,
      y: ty,
      duration: 260,
      ease: 'Sine.Out',
      onUpdate: () => {
        this.float.clear();
        drawTrayIcon(this.float, kind, o.x, o.y - 60, TILE_W * 0.9, TILE_H * 0.9);
      },
    } as Phaser.Types.Tweens.TweenBuilderConfig);
    this.float.setVisible(false);
    this.redraw();
  }

  // ------------------------------------------------------------ layout changes

  private place(p: Placement, record: boolean): void {
    if (!canPlace(this.zone, this.placed, p.socket, p.piece)) {
      this.redraw();
      return;
    }
    this.placed.push(p);
    if (record) this.undoStack.push({ t: 'place', p });
    const sock = this.zone.sockets.find((s) => s.id === p.socket)!;
    this.host.world.addBuilt(builtId(this.zone, p), p.piece, sock.fits[p.piece]!, true);
    this.host.fx.sparks(sock.x, sock.y - 40, 4);
    const { crew, invited } = this.host.helper();
    if (crew && invited) {
      // an invited friend really helps: they come over and steady the piece
      void crew.moveTo(sock.x - 120, () => crew.y, 520).then(() => {
        crew.setPose('help');
        crew.emote('spark');
      });
    } else if (crew) {
      crew.setPose('help');
    }
    this.hintSocket = null;
    this.setArrow(null);
    this.host.changed();
    this.redraw();
  }

  private remove(p: Placement, record: boolean): void {
    if (!this.placed.includes(p)) return;
    this.placed = this.placed.filter((x) => x !== p);
    if (record) this.undoStack.push({ t: 'remove', p });
    this.host.world.removeBuilt(builtId(this.zone, p));
    this.host.changed();
    this.redraw();
  }

  undo(): void {
    const a = this.undoStack.pop();
    if (!a) return;
    if (a.t === 'place') {
      const cur = this.placed.find((x) => x.socket === a.p.socket && x.piece === a.p.piece);
      if (cur) this.remove(cur, false);
    } else if (a.t === 'remove') {
      if (canPlace(this.zone, this.placed, a.p.socket, a.p.piece)) this.place(a.p, false);
    } else {
      for (const p of a.removed) if (canPlace(this.zone, this.placed, p.socket, p.piece)) this.place(p, false);
    }
    this.redraw();
  }

  clear(): void {
    if (!this.placed.length) return;
    const removed = this.placed.slice();
    for (const p of removed) this.remove(p, false);
    this.undoStack.push({ t: 'clear', removed });
  }

  /**
   * Help: a hand carries the example piece from the tray to its socket and
   * shows where it would go (it doesn't place it: the child does).
   */
  async demo(): Promise<void> {
    if (this.demoing || !this.open) return;
    const step = this.zone.example.find((e) => !this.placed.some((p) => p.socket === e.socket) && !this.isUsed(e.piece));
    if (!step) return;
    const sock = this.zone.sockets.find((s) => s.id === step.socket)!;
    const tile = this.tiles.find((t) => t.kind === step.piece);
    if (!tile) return;
    this.cancelDrag();
    this.selected = null;
    this.demoing = true;
    const s = this.host.scene;
    const from = { x: tile.rect.x + tile.rect.w / 2, y: tile.rect.y + tile.rect.h / 2 };
    const to = worldToScreen(s, sock.x, sock.y);
    this.hand?.destroy();
    this.hand = addImage(s, from.x, from.y, 'fx.hand').setScrollFactor(0).setDepth(WorldView.DEPTH.ui + 3);
    if (this.host.reduced()) {
      this.pointAt(sock.id);
      drawPiece(this.ghost, step.piece, sock.fits[step.piece]!, 'ghost');
      this.ghost.setVisible(true);
      await wait(s, 1600);
    } else {
      await tweenP(s, { targets: this.hand, scale: 0.85, duration: 160, yoyo: true });
      const o = { t: 0 };
      this.float.setVisible(true);
      await tweenP(s, {
        targets: o,
        t: 1,
        duration: 1100,
        ease: 'Sine.InOut',
        onUpdate: () => {
          const x = from.x + (to.x - from.x) * o.t;
          const y = from.y + (to.y - from.y) * o.t - Math.sin(o.t * Math.PI) * 160;
          this.hand?.setPosition(x, y + 40);
          this.float.clear();
          drawTrayIcon(this.float, step.piece, x, y - 40, TILE_W * 0.85, TILE_H * 0.85);
        },
      } as Phaser.Types.Tweens.TweenBuilderConfig);
      this.float.setVisible(false);
      drawPiece(this.ghost, step.piece, sock.fits[step.piece]!, 'ghost');
      this.ghost.setVisible(true);
      await wait(s, 900);
    }
    this.ghost.setVisible(false);
    this.hand?.destroy();
    this.hand = null;
    this.demoing = false;
    this.pointAt(sock.id);
  }

  // ------------------------------------------------------------ tests

  testTargets(): { id: string; x: number; y: number; w: number; h: number; space: 'world' | 'screen' }[] {
    const out: { id: string; x: number; y: number; w: number; h: number; space: 'world' | 'screen' }[] = [];
    if (!this.open) return out;
    for (const t of this.tiles) if (!this.isUsed(t.kind)) out.push({ id: `tray-${t.kind}`, x: t.rect.x + t.rect.w / 2, y: t.rect.y + t.rect.h / 2, w: t.rect.w, h: t.rect.h, space: 'screen' });
    for (const s of this.zone.sockets) {
      const filled = this.placed.find((p) => p.socket === s.id);
      out.push({ id: filled ? `placed-${s.id}` : `socket-${s.id}`, x: s.x, y: s.y, w: 120, h: 80, space: 'world' });
    }
    return out;
  }

  inspect(): Record<string, unknown> {
    return {
      zone: this.zone.id,
      open: this.open,
      placed: this.placed.map((p) => `${p.socket}:${p.piece}`),
      selected: this.selected,
      dragging: this.drag?.moved ? this.drag.kind : null,
      hintSocket: this.hintSocket,
      canUndo: this.canUndo,
      demoing: this.demoing,
    };
  }

  destroy(): void {
    for (const off of this.offs) off();
    for (const t of this.bobs.values()) t.stop();
    this.tray.destroy();
    for (const g of this.sockets.values()) g.destroy();
    this.ghost.destroy();
    this.float.destroy();
    this.hand?.destroy();
    this.arrow?.destroy();
  }
}

export function builtId(zone: BuildZone, p: Placement): string {
  return `${zone.id}:${p.socket}:${p.piece}`;
}

function dashedRect(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, color: number, alpha: number): void {
  g.lineStyle(5, color, alpha);
  const dash = 16;
  const gap = 12;
  const edge = (x0: number, y0: number, x1: number, y1: number) => {
    const len = Math.hypot(x1 - x0, y1 - y0);
    for (let d = 0; d < len; d += dash + gap) {
      const a = d / len;
      const b = Math.min(1, (d + dash) / len);
      g.lineBetween(x0 + (x1 - x0) * a, y0 + (y1 - y0) * a, x0 + (x1 - x0) * b, y0 + (y1 - y0) * b);
    }
  };
  edge(x, y, x + w, y);
  edge(x + w, y, x + w, y + h);
  edge(x + w, y + h, x, y + h);
  edge(x, y + h, x, y);
}
