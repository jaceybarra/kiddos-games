import Phaser from 'phaser';
import type { PieceKind } from '../core/build';
import { Terrain, heightOn, type Lane, type Segment, type Wall } from '../core/terrain';
import type { Coin, Checkpoint, DiscoveryId } from '../content/missions';
import { TUNING } from '../config/tuning';
import { P, hex } from '../art/palette';
import { artRng } from '../art/svg';
import { addArt, isArtReady } from '../art/rasterize';
import { Fx, FX_KEYS, safeImage as addImage, safeMake as makeImage, safeSetPiece as setPiece } from './fx';
import { INK, drawPiece, fillPoly, mix, pieceBounds, strokePoly, type Pt } from './pieces';

/**
 * Draws a level: sky, parallax hills and clouds, ground and water from the
 * real segments, logs and ledges from walls, platforms and stumps, coins,
 * checkpoint flags, the discovery, the finish arch and scattered props.
 *
 * Parallax layers live in screen space and are placed after the scene's
 * update each frame (so they follow the camera however the scene moves it,
 * and survive Scale.EXPAND resizes and zoom).
 */
export interface WorldDef {
  length: number;
  segments: Segment[];
  walls: Wall[];
  checkpoints: Checkpoint[];
  coins: Coin[];
  discovery: { id: DiscoveryId; x: number; y: number } | null;
  finishX: number;
  upperRoute?: { x0: number; x1: number; y: number };
  /** a broken old bridge drawn over this water span (mission 1's story) */
  oldBridge?: { x0: number; x1: number };
  /** where a route sign can stand (mission 3's fork) */
  forkX?: number;
  /** seed for prop scatter (stable per level) */
  seed: number;
  /** optional: spans kept free of scattered props (build zones, friends' spots) */
  keepClear?: { x0: number; x1: number }[];
  /** optional: draw the finish arch (default true) */
  showFinish?: boolean;
}

export interface WorldOptions {
  reduced: boolean;
  low: boolean;
  /** coins already owned from earlier runs: drawn as faint outlines, not collectable */
  ownedCoins: Set<string>;
  /** the discovery was found before: drawn faint */
  ownedDiscovery: boolean;
}

/** Art keys a WorldView needs rasterised. */
export const WORLD_VIEW_KEYS: string[] = [
  'bg.sky',
  'bg.far',
  'bg.mid',
  'bg.cloud.1',
  'bg.cloud.2',
  'prop.tree',
  'prop.pine',
  'prop.bush',
  'prop.flowers',
  'prop.rock',
  'prop.fence',
  'prop.mushroom',
  'prop.reeds',
  'prop.lily',
  'prop.springpost',
  'obj.log',
  'obj.oldbridge',
  'obj.coin',
  'obj.acorn',
  'obj.pinwheel.head',
  'obj.pinwheel.stick',
  'obj.ribbon',
  'obj.flag.down',
  'obj.flag.up',
  'obj.finish',
  'obj.sign.post',
  'obj.sign.high',
  'obj.sign.low',
  ...FX_KEYS,
];

const G: number = TUNING.world.groundY;
const SOIL_BOTTOM = G + 700;
const GRASS_BAND = 26;
const LANE_DROP = 26;
const WATER_DROP = 60;
const POOL_DEPTH = 150;
const WATER_DEPTH = 11;
const CHUNK = 900;
const SEAM = 4;
const SOIL_BANDS = [
  [230, 0.1],
  [430, 0.12],
] as const;
const EDGE_EXTEND = 2200;

const C = {
  soil: hex(P.soil),
  soilDark: hex(P.soilDark),
  grass: hex(P.grass),
  grassLight: hex(P.grassLight),
  grassDark: hex(P.grassDark),
  water: hex(P.water),
  waterLight: hex(P.waterLight),
  wood: hex(P.wood),
  woodLight: hex(P.woodLight),
  woodDark: hex(P.woodDark),
  leaf: hex(P.leaf),
  metal: hex(P.metal),
  metalDark: hex(P.metalDark),
  hillFar: hex(P.hillFar),
  hillMid: hex(P.hillMid),
  white: 0xffffff,
};

const isGroundKind = (k: Segment['kind']) => k === 'grass' || k === 'landing';
const yAt = (pts: Pt[], x: number): number => {
  if (x <= pts[0].x) return pts[0].y;
  for (let i = 1; i < pts.length; i++) {
    if (x <= pts[i].x) {
      const a = pts[i - 1];
      const b = pts[i];
      return b.x === a.x ? b.y : a.y + ((b.y - a.y) * (x - a.x)) / (b.x - a.x);
    }
  }
  return pts[pts.length - 1].y;
};
/** the part of a polyline between x0 and x1 (with interpolated end points) */
function clipPts(pts: Pt[], x0: number, x1: number): Pt[] {
  const out: Pt[] = [{ x: x0, y: yAt(pts, x0) }];
  for (const p of pts) if (p.x > x0 && p.x < x1) out.push(p);
  out.push({ x: x1, y: yAt(pts, x1) });
  return out;
}
const offset = (pts: Pt[], dy: number): Pt[] => pts.map((p) => ({ x: p.x, y: p.y + dy }));

interface Chain {
  pts: Pt[];
  lane?: Lane;
  /** real ends (false where the chain was extended past the world edge) */
  leftFace: boolean;
  rightFace: boolean;
}

interface CullItem {
  obj: Phaser.GameObjects.Components.Visible & Phaser.GameObjects.GameObject;
  x0: number;
  x1: number;
}

interface Layer {
  box: Phaser.GameObjects.Container;
  tiles: Phaser.GameObjects.GameObject[];
  key: string;
  tileW: number;
  tileH: number;
  f: number;
  /** bottom of the tile relative to the ground line at rest (screen units) */
  d: number;
  fill: Phaser.GameObjects.Graphics;
}

interface CloudItem {
  img: Phaser.GameObjects.Image;
  bx: number;
  y: number;
  f: number;
  v: number;
}

interface CoinItem {
  coin: Coin;
  img: Phaser.GameObjects.Image;
  owned: boolean;
  gone: boolean;
  phase: number;
}

interface Pool {
  x0: number;
  x1: number;
  left: number;
  right: number;
  wy: number;
  bottom: number;
}

interface WaterItem {
  x0: number;
  x1: number;
  y: number;
  waves: Phaser.GameObjects.Graphics;
}

export class WorldView {
  private scene: Phaser.Scene;
  private def: WorldDef;
  private opts: WorldOptions;
  private cam: Phaser.Cameras.Scene2D.Camera;
  private terrain: Terrain;
  private groundTerrain: Terrain;
  private fx: Fx;
  private objects: Phaser.GameObjects.GameObject[] = [];
  private cull: CullItem[] = [];
  private sky!: Phaser.GameObjects.Image;
  private layers: Layer[] = [];
  private cloudBox!: Phaser.GameObjects.Container;
  private clouds: CloudItem[] = [];
  private coins = new Map<string, CoinItem>();
  private flags = new Map<string, { img: Phaser.GameObjects.Image; x: number; y: number; up: boolean }>();
  private waters: WaterItem[] = [];
  private gapList: { x0: number; x1: number }[] = [];
  private pools: Pool[] = [];
  private built = new Map<string, Phaser.GameObjects.Graphics>();
  private discovery: Phaser.GameObjects.Container | null = null;
  private discoveryHead: Phaser.GameObjects.Image | null = null;
  private discoveryGone = false;
  private sign: { post: Phaser.GameObjects.Image; board: Phaser.GameObjects.Image } | null = null;
  private time = 0;
  private alive = true;
  private readonly onPost = () => this.layoutScreenLayers();

  /** a depth for things that should sit in front of the back lane but behind front-lane pieces */
  static readonly DEPTH = { back: 0, sky: -100, far: -90, mid: -80, decorBack: -10, ground: 0, pieces: 5, truck: 10, crew: 9, front: 20, fx: 30, ui: 100 };

  constructor(scene: Phaser.Scene, def: WorldDef, opts: WorldOptions) {
    this.scene = scene;
    this.def = def;
    this.opts = opts;
    this.cam = scene.cameras.main;
    this.terrain = new Terrain(def.segments, def.walls);
    this.groundTerrain = new Terrain(def.segments.filter((s) => isGroundKind(s.kind) && s.lane !== 'front'));
    this.fx = new Fx(scene, { reduced: opts.reduced, low: opts.low });

    this.buildBackdrop();
    const chains = this.groundChains();
    this.gapList = this.computeGaps();
    this.pools = this.gapList.map((gp) => {
      const left = this.groundTerrain.surfaceBelow(gp.x0 - 1, -Infinity)?.y ?? G;
      const right = this.groundTerrain.surfaceBelow(gp.x1 + 1, -Infinity)?.y ?? G;
      const wy = Math.max(left, right) + WATER_DROP;
      return { ...gp, left, right, wy, bottom: wy + POOL_DEPTH };
    });
    for (const ch of chains) this.drawChain(ch);
    this.drawWater();
    this.drawWalls();
    this.drawWood();
    this.drawPlatforms();
    this.drawAuthoredPieces();
    this.drawOldBridge();
    this.scatterProps(chains);
    this.drawFrontDecor(chains);
    this.placeFlags();
    this.placeCoins();
    this.placeDiscovery();
    this.placeFinish();

    scene.events.on(Phaser.Scenes.Events.POST_UPDATE, this.onPost);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy());
    this.layoutScreenLayers();
  }

  // ---------------------------------------------------------------- helpers

  private add<T extends Phaser.GameObjects.GameObject>(o: T): T {
    this.objects.push(o);
    return o;
  }

  private graphics(depth: number, x0?: number, x1?: number): Phaser.GameObjects.Graphics {
    const g = this.add(this.scene.add.graphics()).setDepth(depth);
    if (x0 !== undefined && x1 !== undefined) this.cull.push({ obj: g, x0, x1 });
    return g;
  }

  /** the highest surface at x (any route), as the game's checkpoints use it */
  private surfaceTop(x: number): number {
    return this.terrain.surfaceBelow(x, -Infinity)?.y ?? G;
  }

  /** the ground (grass) below height y at x; G when there is none */
  groundBelow(x: number, y = -Infinity): number {
    return this.groundTerrain.surfaceBelow(x, y)?.y ?? G;
  }

  private nearAny(x: number, spans: { x0: number; x1: number }[], pad: number): boolean {
    return spans.some((s) => x > s.x0 - pad && x < s.x1 + pad);
  }

  private get reduced(): boolean {
    return this.opts.reduced;
  }

  // ---------------------------------------------------------------- backdrop (screen space)

  private buildBackdrop(): void {
    const D = WorldView.DEPTH;
    this.sky = this.add(addImage(this.scene, 0, 0, 'bg.sky')).setOrigin(0, 0).setScrollFactor(0).setDepth(D.sky);
    this.layers.push(this.makeLayer('bg.far', 2048, 420, 0.2, -120, D.far, C.hillFar));
    this.layers.push(this.makeLayer('bg.mid', 2048, 380, 0.45, 40, D.mid, C.hillMid));
    this.cloudBox = this.add(this.scene.add.container(0, 0)).setScrollFactor(0).setDepth(D.far - 1);
    const rng = artRng(this.def.seed * 7 + 3);
    const n = 5;
    for (let i = 0; i < n; i++) {
      const img = makeImage(this.scene, 0, 0, i % 2 === 0 ? 'bg.cloud.1' : 'bg.cloud.2');
      img.setScale(0.8 + rng() * 0.5);
      this.cloudBox.add(img);
      this.clouds.push({ img, bx: (i + rng() * 0.6) * 620, y: 70 + rng() * 230, f: 0.1 + rng() * 0.2, v: 6 + rng() * 9 });
    }
  }

  private makeLayer(key: string, tileW: number, tileH: number, f: number, d: number, depth: number, fillColor: number): Layer {
    const box = this.add(this.scene.add.container(0, 0)).setScrollFactor(0).setDepth(depth);
    const fill = new Phaser.GameObjects.Graphics(this.scene);
    fill.fillStyle(fillColor, 1);
    // extends below the tile so a rising camera never opens a gap under the hills
    fill.fillRect(-tileW, tileH - 2, tileW * 8, 1400);
    box.add(fill);
    return { box, tiles: [], key, tileW, tileH, f, d, fill };
  }

  private ensureTiles(layer: Layer, count: number): void {
    if (!isArtReady(layer.key)) return;
    while (layer.tiles.length < count) {
      // tiles are cropped by SEAM at each side and overlap, so outline strokes on the tile edges never show
      const t = addArt(this.scene, layer.tiles.length * (layer.tileW - 2 * SEAM) - SEAM, 0, layer.key);
      if (t instanceof Phaser.GameObjects.Image) t.setOrigin(0, 0).setCrop(SEAM, 0, layer.tileW - 2 * SEAM, layer.tileH);
      // addArt puts it on the display list; move it into the layer container
      this.scene.children.remove(t);
      layer.box.add(t);
      layer.tiles.push(t);
    }
    // keep the fill under all tiles
    layer.fill.clear();
    layer.fill.fillStyle(layer.key === 'bg.far' ? C.hillFar : C.hillMid, 1);
    layer.fill.fillRect(-4, layer.tileH - 2, layer.tiles.length * layer.tileW + 8, 1400);
  }

  /** place sky, hills and clouds for the camera as it is right now */
  private layoutScreenLayers(): void {
    if (!this.alive) return;
    const cam = this.cam;
    const W = cam.width;
    const H = cam.height;
    const z = cam.zoom || 1;
    // the screen-space rectangle that is visible after the camera zooms around its centre
    const left = W / 2 - W / (2 * z);
    const top = H / 2 - H / (2 * z);
    const vw = W / z;
    const vh = H / z;
    this.sky.setPosition(left - 2, top - 2).setDisplaySize(vw + 4, vh + 4);
    const cx = cam.scrollX + W / 2;
    const cy = cam.scrollY + H / 2;
    const cy0 = G - TUNING.camera.truckBelowCentre;
    const groundRest = H / 2 + TUNING.camera.truckBelowCentre;
    for (const L of this.layers) {
      const count = Math.ceil(vw / (L.tileW - 2 * SEAM)) + 2;
      this.ensureTiles(L, count);
      const period = L.tileW - 2 * SEAM;
      const shift = (((cx * L.f) % period) + period) % period;
      L.box.x = Math.floor(left - shift);
      L.box.y = groundRest + L.d - (cy - cy0) * L.f - L.tileH;
      // the fill must also reach the bottom of the view
      L.fill.y = 0;
    }
    const span = vw + 700;
    for (const c of this.clouds) {
      let x = c.bx - cx * c.f + (this.reduced ? 0 : this.time * c.v);
      x = ((((x - left + 350) % span) + span) % span) + left - 350;
      c.img.setPosition(x, top + c.y - (cy - cy0) * c.f * 0.5);
    }
    // cull level graphics outside the view
    const vx0 = cx - vw / 2 - 260;
    const vx1 = cx + vw / 2 + 260;
    for (const it of this.cull) it.obj.setVisible(it.x1 >= vx0 && it.x0 <= vx1);
  }

  // ---------------------------------------------------------------- ground

  private groundChains(): Chain[] {
    const groups = new Map<string, Segment[]>();
    for (const s of this.def.segments) {
      if (!isGroundKind(s.kind)) continue;
      const k = s.lane ?? '';
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k)!.push(s);
    }
    const out: Chain[] = [];
    for (const [k, segs] of groups) {
      segs.sort((a, b) => a.x0 - b.x0);
      let cur: Pt[] | null = null;
      for (const s of segs) {
        if (cur && Math.abs(cur[cur.length - 1].x - s.x0) < 1.5 && Math.abs(cur[cur.length - 1].y - s.y0) < 1.5) {
          cur.push({ x: s.x1, y: s.y1 });
        } else {
          if (cur) out.push({ pts: cur, lane: (k || undefined) as Lane | undefined, leftFace: true, rightFace: true });
          cur = [
            { x: s.x0, y: s.y0 },
            { x: s.x1, y: s.y1 },
          ];
        }
      }
      if (cur) out.push({ pts: cur, lane: (k || undefined) as Lane | undefined, leftFace: true, rightFace: true });
    }
    for (const ch of out) {
      if (ch.pts[0].x <= 0.5) {
        ch.pts.unshift({ x: ch.pts[0].x - EDGE_EXTEND, y: ch.pts[0].y });
        ch.leftFace = false;
      }
      const last = ch.pts[ch.pts.length - 1];
      if (last.x >= this.def.length - 0.5) {
        ch.pts.push({ x: last.x + EDGE_EXTEND, y: last.y });
        ch.rightFace = false;
      }
    }
    return out;
  }

  /** water spans: x ranges in [0, length] with no shared/back ground (grass, landing or authored bridge) */
  private computeGaps(): { x0: number; x1: number }[] {
    const cover = this.def.segments
      .filter((s) => (isGroundKind(s.kind) || s.kind === 'bridge') && s.lane !== 'front')
      .map((s) => ({ x0: s.x0, x1: s.x1 }))
      .sort((a, b) => a.x0 - b.x0);
    const gaps: { x0: number; x1: number }[] = [];
    let x = 0;
    for (const c of cover) {
      if (c.x0 > x + 1) gaps.push({ x0: x, x1: c.x0 });
      x = Math.max(x, c.x1);
    }
    if (x < this.def.length - 1) gaps.push({ x0: x, x1: this.def.length });
    return gaps.filter((g) => g.x1 - g.x0 >= 8);
  }

  /** soil body, strata, pebbles, grass band, ink surface line, end faces and tufts, in chunks */
  private drawChain(ch: Chain, depthOverride?: number): void {
    const D = WorldView.DEPTH;
    const front = ch.lane === 'front';
    const depth = depthOverride ?? (front ? D.front : D.ground);
    const dy = front ? LANE_DROP : 0;
    const x0 = ch.pts[0].x;
    const x1 = ch.pts[ch.pts.length - 1].x;
    const rng = artRng(Math.round(this.def.seed * 131 + x0 * 7 + x1));
    for (let c0 = x0; c0 < x1; c0 += CHUNK) {
      const c1 = Math.min(x1, c0 + CHUNK);
      const g = this.graphics(depth, c0 - 40, c1 + 40);
      g.y = dy;
      const top = clipPts(ch.pts, c0, c1);
      const fillTop = clipPts(ch.pts, c0, Math.min(x1, c1 + 1));
      // soil, a little darker with depth (two soft bands with wavy edges)
      const bottomEdge = [{ x: fillTop[fillTop.length - 1].x, y: SOIL_BOTTOM }, { x: c0, y: SOIL_BOTTOM }];
      fillPoly(g, [...fillTop, ...bottomEdge], C.soil);
      for (const [depthBelow, a] of SOIL_BANDS) {
        const wav = this.soilBand(c0, Math.min(x1, c1 + 1), (x) => yAt(ch.pts, x), depthBelow);
        fillPoly(g, [...wav, ...bottomEdge], C.soilDark, a);
        strokePoly(g, wav, 5, C.soilDark, 0.16);
      }
      this.pebbles(g, c0, c1, (x) => yAt(ch.pts, x) + 48, rng);
      // end faces (bank walls): shade on the right-facing side, light on the left-facing side
      const lb = this.faceBottom(x0, ch.pts[0].y, -1);
      const rb = this.faceBottom(x1, ch.pts[ch.pts.length - 1].y, 1);
      if (ch.leftFace && c0 === x0) {
        const ty = ch.pts[0].y;
        fillPoly(g, [{ x: x0, y: ty }, { x: x0 + 16, y: ty }, { x: x0 + 16, y: lb }, { x: x0, y: lb }], 0xffffff, 0.12);
      }
      if (ch.rightFace && c1 === x1) {
        const ty = ch.pts[ch.pts.length - 1].y;
        fillPoly(g, [{ x: x1 - 18, y: ty }, { x: x1, y: ty }, { x: x1, y: rb }, { x: x1 - 18, y: rb }], C.soilDark, 0.35);
      }
      // grass band with a scalloped lower fringe
      const fringe: Pt[] = [];
      for (let x = c0, i = 0; x <= c1 + 0.01; x += 14, i++) fringe.push({ x: Math.min(x, c1), y: yAt(ch.pts, Math.min(x, c1)) + GRASS_BAND + (i % 2 ? 6 : 0) });
      if (fringe[fringe.length - 1].x < c1) fringe.push({ x: c1, y: yAt(ch.pts, c1) + GRASS_BAND });
      fillPoly(g, [...fillTop, ...[...fringe].reverse()], C.grass);
      strokePoly(g, fringe, 3, C.grassDark, 0.55);
      fillPoly(g, [...fillTop, ...[...offset(fillTop, 8)].reverse()], C.grassLight);
      // ink: along the surface line, and down the bank faces
      strokePoly(g, top, 6, INK);
      if (ch.leftFace && c0 === x0) strokePoly(g, [ch.pts[0], { x: x0, y: lb }], 6, INK);
      if (ch.rightFace && c1 === x1) strokePoly(g, [ch.pts[ch.pts.length - 1], { x: x1, y: rb }], 6, INK);
      // little tufts standing on the surface
      for (let x = c0 + 20 + rng() * 40; x < c1 - 16; x += 60 + rng() * 90) {
        if (!front && this.nearAny(x, this.gapList, 30)) continue;
        const y = yAt(ch.pts, x) + 2;
        const h = 9 + rng() * 6;
        strokePoly(g, [{ x: x - 7, y: y - h * 0.7 }, { x: x - 2, y }, { x, y: y - h }, { x: x + 2, y }, { x: x + 7, y: y - h * 0.7 }], 3.5, C.grassDark);
      }
    }
  }

  /** where a bank face ends: the pool bottom beside water, the lower ground beside a step, else the soil bottom */
  private faceBottom(x: number, top: number, side: -1 | 1): number {
    const pool = this.pools.find((p) => (side < 0 ? Math.abs(p.x1 - x) < 2 : Math.abs(p.x0 - x) < 2));
    if (pool) return pool.bottom + 8;
    const below = this.groundTerrain.surfaceBelow(x + side * 3, top + 6);
    return below ? below.y + 2 : SOIL_BOTTOM;
  }

  /** pebbles in the soil below `top(x)` (darker ones, and a few light ones with a highlight) */
  private pebbles(g: Phaser.GameObjects.Graphics, x0: number, x1: number, top: (x: number) => number, rng: () => number): void {
    const n = Math.round((x1 - x0) / 46);
    for (let i = 0; i < n; i++) {
      const px = x0 + 8 + rng() * Math.max(0, x1 - x0 - 16);
      const py = top(px) + Math.pow(rng(), 1.4) * 520;
      const r = 5 + rng() * 9;
      if (py > SOIL_BOTTOM - 10) continue;
      if (rng() < 0.7) {
        g.fillStyle(C.soilDark, 0.42);
        g.fillEllipse(px, py, r * 2, r * 1.4);
      } else {
        g.fillStyle(mix(C.soil, 0xfff6e6, 0.35), 0.8);
        g.fillEllipse(px, py, r * 2, r * 1.4);
        g.fillStyle(0xffffff, 0.35);
        g.fillEllipse(px - r * 0.3, py - r * 0.25, r * 0.8, r * 0.5);
      }
    }
  }

  /** a soft wavy line `depthBelow` under a surface; the same function everywhere so chunks and pools join seamlessly */
  private soilBand(x0: number, x1: number, surface: (x: number) => number, depthBelow: number): Pt[] {
    const f = (x: number) => surface(x) + depthBelow + Math.sin(x / 90 + depthBelow) * 9;
    const pts: Pt[] = [];
    for (let x = x0; x < x1; x += 40) pts.push({ x, y: f(x) });
    pts.push({ x: x1, y: f(x1) });
    return pts;
  }

  // ---------------------------------------------------------------- water

  private drawWater(): void {
    const D = WorldView.DEPTH;
    for (const pool of this.pools) {
      const a = pool.x0;
      const b = pool.x1;
      const { left, right, wy, bottom } = pool;
      // the basin floor: a gentle sag between the banks
      const bed: Pt[] = [];
      const steps = Math.max(2, Math.ceil((b - a) / 24));
      for (let i = 0; i <= steps; i++) {
        const u = i / steps;
        bed.push({ x: a + (b - a) * u, y: bottom + Math.sin(u * Math.PI) * 14 });
      }
      // behind: the pool's back wall above the water, then ordinary soil below the basin
      const back = this.graphics(D.ground, a - 10, b + 10);
      // (only up to the lower bank: above it the gap is open air)
      const lowBank = Math.max(left, right);
      fillPoly(back, [{ x: a + 3, y: lowBank - 2 }, { x: b - 3, y: lowBank - 2 }, { x: b - 3, y: bottom + 20 }, { x: a + 3, y: bottom + 20 }], mix(C.soilDark, C.soil, 0.4));
      fillPoly(back, [{ x: a + 3, y: wy - 22 }, { x: b - 3, y: wy - 22 }, { x: b - 3, y: wy }, { x: a + 3, y: wy }], C.soilDark, 0.45);
      const under = [...bed, { x: b, y: SOIL_BOTTOM }, { x: a, y: SOIL_BOTTOM }];
      fillPoly(back, under, C.soil);
      const bank = (x: number) => left + ((right - left) * (x - a)) / Math.max(1, b - a);
      this.pebbles(back, a, b, () => bottom + 40, artRng(Math.round(a * 13 + this.def.seed)));
      for (const [depthBelow, al] of SOIL_BANDS) {
        const wav = this.soilBand(a, b, bank, depthBelow);
        if (wav.every((p) => p.y > bottom + 16)) {
          fillPoly(back, [...wav, { x: b, y: SOIL_BOTTOM }, { x: a, y: SOIL_BOTTOM }], C.soilDark, al);
          strokePoly(back, wav, 5, C.soilDark, 0.16);
        }
      }
      // the water body (in front of a falling truck, behind front-lane pieces)
      const w = this.graphics(WATER_DEPTH, a - 10, b + 10);
      fillPoly(w, [{ x: a, y: wy }, { x: b, y: wy }, ...[...bed].reverse()], C.water, 0.94);
      fillPoly(w, [{ x: a, y: wy + 70 }, { x: b, y: wy + 70 }, ...[...bed].reverse()], hex(P.blueDark), 0.18);
      // banks and floor seen through the water
      strokePoly(w, [{ x: a, y: wy - 3 }, ...bed, { x: b, y: wy - 3 }], 6, INK);
      // surface line
      w.lineStyle(7, C.waterLight, 1);
      w.lineBetween(a + 3, wy, b - 3, wy);
      w.lineStyle(2.5, 0xffffff, 0.8);
      w.lineBetween(a + 8, wy - 2, b - 8, wy - 2);
      const waves = this.graphics(WATER_DEPTH + 0.5, a - 10, b + 10);
      const item: WaterItem = { x0: a, x1: b, y: wy, waves };
      this.waters.push(item);
      this.drawWaves(item);
      // lily pads and reeds
      if (b - a >= 120) {
        const lily = this.add(addImage(this.scene, a + (b - a) * 0.3, wy + 4, 'prop.lily')).setDepth(WATER_DEPTH + 1).setScale(0.8);
        void lily;
        if (b - a >= 220) this.add(addImage(this.scene, a + (b - a) * 0.72, wy + 5, 'prop.lily')).setDepth(WATER_DEPTH + 1).setScale(0.65).setFlipX(true);
      }
      const reedsL = this.add(addImage(this.scene, a - 34, left + 14, 'prop.reeds')).setDepth(D.decorBack + 1);
      const reedsR = this.add(addImage(this.scene, b + 30, right + 14, 'prop.reeds')).setDepth(D.decorBack + 1).setFlipX(true);
      void reedsL;
      void reedsR;
    }
  }

  private drawWaves(w: WaterItem): void {
    const g = w.waves;
    g.clear();
    const t = this.reduced ? 0 : this.time;
    const width = w.x1 - w.x0;
    const rows = [26, 62, 100];
    rows.forEach((dy, r) => {
      const count = Math.max(1, Math.floor(width / 110));
      for (let i = 0; i < count; i++) {
        const base = w.x0 + ((i + 0.5 + (r % 2) * 0.4) * width) / count;
        const x = base + Math.sin(t * 0.8 + i * 1.7 + r) * 10;
        const y = w.y + dy;
        const half = Math.min(22, width / (count * 2) - 6);
        if (half < 6 || x - half < w.x0 + 6 || x + half > w.x1 - 6) continue;
        const pts: Pt[] = [];
        for (let k = 0; k <= 8; k++) {
          const u = k / 8;
          pts.push({ x: x - half + u * half * 2, y: y - Math.sin(u * Math.PI) * 5 });
        }
        strokePoly(g, pts, 4, C.waterLight, 0.8 - r * 0.15);
      }
    });
  }

  // ---------------------------------------------------------------- walls (logs and ledges)

  private drawWalls(): void {
    const D = WorldView.DEPTH;
    for (const wall of this.def.walls) {
      if (wall.w <= 120) {
        if (isArtReady('obj.log')) this.add(addImage(this.scene, wall.x, wall.top + 72, 'obj.log')).setDepth(D.pieces);
        else this.drawLogWall(wall);
        continue;
      }
      // a wide wall is a raised block of ground (skip if a ground segment already draws it)
      const covered = this.def.segments.some((s) => isGroundKind(s.kind) && s.x0 <= wall.x + 2 && s.x1 >= wall.x + wall.w - 2 && Math.abs(heightOn(s, wall.x + wall.w / 2) - wall.top) < 4);
      if (covered) continue;
      this.drawChain({ pts: [{ x: wall.x, y: wall.top }, { x: wall.x + wall.w, y: wall.top }], leftFace: true, rightFace: true }, D.ground + 1);
    }
  }

  /** fallback when the log art is unavailable: the same log shape from Graphics */
  private drawLogWall(wall: Wall): void {
    const g = this.graphics(WorldView.DEPTH.pieces, wall.x - 20, wall.x + wall.w + 20);
    const h = this.groundBelow(wall.x + wall.w / 2, wall.top) - wall.top;
    g.fillStyle(C.wood, 1).fillRoundedRect(wall.x, wall.top, wall.w + 10, h, 28);
    g.lineStyle(6, INK, 1).strokeRoundedRect(wall.x, wall.top, wall.w + 10, h, 28);
    g.fillStyle(C.woodLight, 1).fillEllipse(wall.x + 4, wall.top + h / 2, 44, h - 4);
    g.lineStyle(6, INK, 1).strokeEllipse(wall.x + 4, wall.top + h / 2, 44, h - 4);
    g.lineStyle(3, C.woodDark, 0.8).strokeEllipse(wall.x + 4, wall.top + h / 2, 22, (h - 4) * 0.55);
  }

  // ---------------------------------------------------------------- wood: stumps and logs

  private drawWood(): void {
    const segs = this.def.segments.filter((s) => s.kind === 'wood').sort((a, b) => a.x0 - b.x0);
    const chains: Segment[][] = [];
    for (const s of segs) {
      const last = chains[chains.length - 1];
      const prev = last?.[last.length - 1];
      if (prev && (prev.lane ?? '') === (s.lane ?? '') && Math.abs(prev.x1 - s.x0) < 1.5 && Math.abs(prev.y1 - s.y0) < 1.5) last.push(s);
      else chains.push([s]);
    }
    for (const ch of chains) {
      const single = ch.length === 1 && ch[0].y0 === ch[0].y1 && ch[0].x1 - ch[0].x0 <= 200;
      if (single) this.drawStump(ch[0]);
      else ch.forEach((s, i) => this.drawLog(s, i === 0, i === ch.length - 1));
    }
  }

  private woodDepth(s: Segment): number {
    return s.lane === 'front' ? WorldView.DEPTH.front : WorldView.DEPTH.ground - 1;
  }

  private drawStump(s: Segment): void {
    const g = this.graphics(this.woodDepth(s), s.x0 - 40, s.x1 + 40);
    if (s.lane === 'front') g.y = LANE_DROP;
    const top = s.y0;
    const mid = (s.x0 + s.x1) / 2;
    const gy = this.groundBelow(mid, top + 10);
    const flare = 16;
    const rootTop = gy - 34;
    const body: Pt[] = [
      { x: s.x0, y: top },
      { x: s.x1, y: top },
      { x: s.x1, y: rootTop },
      { x: s.x1 + flare, y: gy + 6 },
      { x: s.x1 + flare, y: gy + 24 },
      { x: s.x0 - flare, y: gy + 24 },
      { x: s.x0 - flare, y: gy + 6 },
      { x: s.x0, y: rootTop },
    ];
    fillPoly(g, body, C.wood);
    // light from the upper left
    fillPoly(g, [{ x: s.x0, y: top }, { x: s.x0 + 22, y: top }, { x: s.x0 + 22, y: gy + 24 }, { x: s.x0 - flare, y: gy + 24 }, { x: s.x0, y: rootTop }], 0xffffff, 0.16);
    fillPoly(g, [{ x: s.x1 - 26, y: top }, { x: s.x1, y: top }, { x: s.x1, y: rootTop }, { x: s.x1 + flare, y: gy + 6 }, { x: s.x1 + flare, y: gy + 24 }, { x: s.x1 - 26, y: gy + 24 }], C.woodDark, 0.32);
    // bark: wavy vertical grooves (about 40%)
    const rng = artRng(Math.round(s.x0));
    for (let x = s.x0 + 18; x < s.x1 - 10; x += 22 + rng() * 8) {
      const pts: Pt[] = [];
      for (let y = top + 18; y < gy; y += 16) pts.push({ x: x + Math.sin(y / 14 + x) * 3, y });
      strokePoly(g, pts, 3, C.woodDark, 0.45);
    }
    // the cut top: a lighter rim with a ring
    fillPoly(g, [{ x: s.x0, y: top }, { x: s.x1, y: top }, { x: s.x1, y: top + 12 }, { x: s.x0, y: top + 12 }], C.woodLight);
    strokePoly(g, [{ x: s.x0 + 6, y: top + 12 }, { x: s.x1 - 6, y: top + 12 }], 3, C.woodDark, 0.6);
    strokePoly(g, body, 6, INK, 1, true);
    strokePoly(g, [{ x: s.x0, y: top }, { x: s.x1, y: top }], 6, INK);
    // a little sprout
    const sx = s.x1 - 30;
    fillPoly(g, [{ x: sx, y: top + 40 }, { x: sx + 22, y: top + 28 }, { x: sx + 26, y: top + 46 }], C.leaf);
    strokePoly(g, [{ x: sx, y: top + 40 }, { x: sx + 22, y: top + 28 }, { x: sx + 26, y: top + 46 }], 3, INK, 1, true);
  }

  private drawLog(s: Segment, first: boolean, last: boolean): void {
    void first;
    const g = this.graphics(this.woodDepth(s), s.x0 - 60, s.x1 + 60);
    if (s.lane === 'front') g.y = LANE_DROP;
    const H = 62;
    const at = (x: number) => heightOn(s, x);
    const L = s.x1 - s.x0;
    // posts under the log down to the ground, with a cross brace when they are tall
    const posts: { x: number; top: number; bottom: number }[] = [];
    for (const u of [0.18, 0.82]) {
      const px = s.x0 + L * u;
      const yb = at(px) + H - 8;
      const gy = this.groundBelow(px, yb);
      if (gy - yb < 12) continue;
      posts.push({ x: px, top: yb, bottom: gy + 22 });
    }
    if (posts.length === 2 && posts[0].bottom - posts[0].top > 70 && posts[1].bottom - posts[1].top > 70) {
      const [a, b] = posts;
      const brace = [
        { x: a.x, y: a.top + 14 },
        { x: b.x, y: b.bottom - 34 },
      ];
      strokePoly(g, brace, 16, INK);
      strokePoly(g, brace, 8, C.woodDark);
    }
    for (const p of posts) {
      const post: Pt[] = [
        { x: p.x - 12, y: p.top },
        { x: p.x + 12, y: p.top },
        { x: p.x + 12, y: p.bottom },
        { x: p.x - 12, y: p.bottom },
      ];
      fillPoly(g, post, C.woodDark);
      fillPoly(g, [post[0], { x: p.x - 4, y: p.top }, { x: p.x - 4, y: p.bottom }, post[3]], 0xffffff, 0.16);
      strokePoly(g, post, 5, INK, 1, true);
    }
    // the log: a cylinder on its side; its top edge is the driving surface
    const steps = Math.max(2, Math.ceil(L / 40));
    const band: Pt[] = [];
    for (let i = 0; i <= steps; i++) {
      const x = s.x0 + (L * i) / steps;
      band.push({ x, y: at(x) });
    }
    const lower = offset(band, H);
    const shape: Pt[] = [...band];
    if (last) {
      // rounded far end
      for (let i = 1; i < 8; i++) {
        const a = -Math.PI / 2 + (i / 8) * Math.PI;
        shape.push({ x: s.x1 + Math.cos(a) * 16, y: at(s.x1) + H / 2 + Math.sin(a) * (H / 2) });
      }
    }
    shape.push(...[...lower].reverse());
    fillPoly(g, shape, C.wood);
    fillPoly(g, [...band, ...offset(band, 12).reverse()], C.woodLight);
    fillPoly(g, [...offset(lower, -16), ...[...lower].reverse()], C.woodDark, 0.38);
    // bark: short strokes in rows, and a knot or two
    const rng = artRng(Math.round(s.x0 * 3 + s.y0));
    for (let row = 0; row < 3; row++) {
      for (let x = s.x0 + 24 + rng() * 30; x < s.x1 - 30; x += 56 + rng() * 50) {
        const len = 22 + rng() * 34;
        const y0 = at(x) + 20 + row * 12;
        const y1 = at(x + len) + 20 + row * 12;
        strokePoly(g, [{ x, y: y0 }, { x: x + len / 2, y: (y0 + y1) / 2 + 2 }, { x: x + len, y: y1 }], 3, C.woodDark, 0.45);
      }
    }
    if (L > 160) {
      const kx = s.x0 + L * (0.35 + rng() * 0.3);
      const ky = at(kx) + H * 0.55;
      g.fillStyle(C.woodDark, 0.55).fillEllipse(kx, ky, 18, 11);
      g.lineStyle(2.5, INK, 0.5).strokeEllipse(kx, ky, 18, 11);
    }
    strokePoly(g, shape, 6, INK, 1, true);
    // the cut end facing us on the left (each log in a row shows its own, so a chain reads as logs end to end)
    const cy = at(s.x0) + H / 2;
    g.fillStyle(C.woodLight, 1).fillEllipse(s.x0, cy, 32, H);
    g.lineStyle(6, INK, 1).strokeEllipse(s.x0, cy, 32, H);
    g.lineStyle(2.5, C.woodDark, 0.7).strokeEllipse(s.x0, cy, 18, H * 0.58);
    g.fillStyle(C.woodDark, 0.8).fillEllipse(s.x0, cy, 6, 10);
  }

  // ---------------------------------------------------------------- toy-block platforms

  private drawPlatforms(): void {
    const D = WorldView.DEPTH;
    const colors = [hex(P.blue), hex(P.yellow), hex(P.red), hex(P.teal)];
    for (const s of this.def.segments.filter((x) => x.kind === 'platform')) {
      const g = this.graphics(s.lane === 'front' ? D.front : D.ground - 1, s.x0 - 60, s.x1 + 60);
      if (s.lane === 'front') g.y = LANE_DROP;
      const H = 40;
      const at = (x: number) => heightOn(s, x);
      const L = s.x1 - s.x0;
      // poles to the ground
      const poles = L > 300 ? [0.25, 0.75] : [0.5];
      for (const u of poles) {
        const px = s.x0 + L * u;
        const yb = at(px) + H;
        const gy = this.groundBelow(px, yb);
        const pole: Pt[] = [
          { x: px - 6, y: yb - 4 },
          { x: px + 6, y: yb - 4 },
          { x: px + 6, y: gy + 20 },
          { x: px - 6, y: gy + 20 },
        ];
        fillPoly(g, pole, C.metal);
        fillPoly(g, [{ x: px + 1, y: yb - 4 }, { x: px + 6, y: yb - 4 }, { x: px + 6, y: gy + 20 }, { x: px + 1, y: gy + 20 }], C.metalDark, 0.8);
        strokePoly(g, pole, 4, INK, 1, true);
        const plate: Pt[] = [
          { x: px - 24, y: gy - 10 },
          { x: px + 24, y: gy - 10 },
          { x: px + 28, y: gy + 4 },
          { x: px - 28, y: gy + 4 },
        ];
        fillPoly(g, plate, C.metalDark);
        strokePoly(g, plate, 4, INK, 1, true);
      }
      // blocks
      const n = Math.max(2, Math.round(L / 90));
      const bw = L / n;
      for (let i = 0; i < n; i++) {
        const a = s.x0 + i * bw;
        const b = a + bw;
        const color = colors[(i + Math.round(s.x0 / 90)) % colors.length];
        // studs on top (the far row: wheels roll in front of them)
        for (const u of [0.28, 0.72]) {
          const sx = a + bw * u;
          const stud: Pt[] = [
            { x: sx - 12, y: at(sx) + 1 },
            { x: sx - 10, y: at(sx) - 7 },
            { x: sx + 10, y: at(sx) - 7 },
            { x: sx + 12, y: at(sx) + 1 },
          ];
          fillPoly(g, stud, color);
          strokePoly(g, stud, 3.5, INK, 1, false);
        }
        const blk: Pt[] = [
          { x: a, y: at(a) },
          { x: b, y: at(b) },
          { x: b, y: at(b) + H },
          { x: a, y: at(a) + H },
        ];
        fillPoly(g, blk, color);
        fillPoly(g, [blk[0], blk[1], { x: b, y: at(b) + 8 }, { x: a, y: at(a) + 8 }], 0xffffff, 0.35);
        fillPoly(g, [{ x: a, y: at(a) + H - 9 }, { x: b, y: at(b) + H - 9 }, blk[2], blk[3]], 0x000000, 0.14);
        if (i > 0) strokePoly(g, [{ x: a, y: at(a) }, { x: a, y: at(a) + H }], 4, INK);
      }
      strokePoly(g, [{ x: s.x0, y: at(s.x0) }, { x: s.x1, y: at(s.x1) }, { x: s.x1, y: at(s.x1) + H }, { x: s.x0, y: at(s.x0) + H }], 6, INK, 1, true);
      // the spring-wheel route marker at the left end
      const ur = this.def.upperRoute;
      if (ur && s.x0 < ur.x1 && s.x1 > ur.x0) {
        const px = s.x0 - 46;
        this.add(addImage(this.scene, px, this.groundBelow(px) + 14, 'prop.springpost')).setDepth(D.decorBack + 2);
      }
    }
  }

  // ---------------------------------------------------------------- authored ramps, pads and bridges

  private drawAuthoredPieces(): void {
    const D = WorldView.DEPTH;
    for (const s of this.def.segments) {
      if (s.kind !== 'ramp' && s.kind !== 'pad' && s.kind !== 'bridge') continue;
      const kind = s.kind as PieceKind;
      const groundY = this.groundBelow((s.x0 + s.x1) / 2, Math.max(s.y0, s.y1) + 4);
      const b = pieceBounds(kind, s, groundY);
      const g = this.graphics(s.lane === 'front' ? D.front : D.pieces, b.x0, b.x1);
      if (s.lane === 'front') g.y = LANE_DROP;
      drawPiece(g, kind, s, 'solid', { groundY });
    }
  }

  private drawOldBridge(): void {
    const ob = this.def.oldBridge;
    if (!ob) return;
    const s = (ob.x1 - ob.x0) / 260;
    const gy = this.groundBelow(ob.x0 - 2);
    this.add(addImage(this.scene, ob.x0, gy, 'obj.oldbridge'))
      .setScale(s, Phaser.Math.Clamp(s, 0.8, 1.2))
      .setDepth(WorldView.DEPTH.pieces - 1);
  }

  // ---------------------------------------------------------------- props

  private scatterProps(chains: Chain[]): void {
    const D = WorldView.DEPTH;
    const rng = artRng(this.def.seed * 977 + 13);
    const keep: { x0: number; x1: number }[] = [...(this.def.keepClear ?? [])];
    keep.push({ x0: this.def.finishX - 300, x1: this.def.finishX + 300 });
    for (const w of this.def.walls) keep.push({ x0: w.x - 90, x1: w.x + Math.min(w.w, 120) + 90 });
    for (const s of this.def.segments) if (s.kind !== 'grass' && s.kind !== 'landing') keep.push({ x0: s.x0 - 50, x1: s.x1 + 50 });
    for (const c of this.def.checkpoints) keep.push({ x0: c.x - 70, x1: c.x + 90 });
    if (this.def.discovery) keep.push({ x0: this.def.discovery.x - 90, x1: this.def.discovery.x + 90 });
    if (this.def.forkX !== undefined) keep.push({ x0: this.def.forkX - 140, x1: this.def.forkX + 140 });
    if (this.def.oldBridge) keep.push({ x0: this.def.oldBridge.x0 - 60, x1: this.def.oldBridge.x1 + 60 });
    const kinds: [string, number, number][] = [
      ['prop.tree', 0.22, 70],
      ['prop.pine', 0.18, 56],
      ['prop.bush', 0.2, 76],
      ['prop.flowers', 0.14, 60],
      ['prop.rock', 0.1, 54],
      ['prop.mushroom', 0.08, 34],
      ['prop.fence', 0.08, 110],
    ];
    const back = chains.filter((c) => c.lane !== 'front');
    let x = 60 + rng() * 120;
    while (x < this.def.length - 40) {
      let roll = rng();
      let pick = kinds[0];
      for (const k of kinds) {
        if (roll < k[1]) {
          pick = k;
          break;
        }
        roll -= k[1];
      }
      const [key, , half] = pick;
      const ch = back.find((c) => x - half >= c.pts[0].x && x + half <= c.pts[c.pts.length - 1].x);
      const ok = ch && !this.nearAny(x, this.gapList, half + 80) && !keep.some((k) => x + half > k.x0 && x - half < k.x1);
      if (ch && ok) {
        const yl = yAt(ch.pts, x - half);
        const yr = yAt(ch.pts, x + half);
        if (Math.abs(yl - yr) < 40) {
          const y = Math.max(yl, yr);
          const big = key === 'prop.tree' || key === 'prop.pine';
          const sc = big ? 0.85 + rng() * 0.35 : 0.85 + rng() * 0.3;
          const im = this.add(addImage(this.scene, x, y + 16, key)).setDepth(D.decorBack).setScale(rng() < 0.5 ? -sc : sc, sc);
          void im;
        }
      }
      x += 150 + rng() * 230;
    }
  }

  /** low tufts and tiny flowers along the front edge of the grass (in front of the back lane, below the wheels) */
  private drawFrontDecor(chains: Chain[]): void {
    if (this.opts.low && this.reduced) return;
    const D = WorldView.DEPTH;
    const keep = [...(this.def.keepClear ?? []), ...this.def.segments.filter((s) => s.kind !== 'grass' && s.kind !== 'landing').map((s) => ({ x0: s.x0, x1: s.x1 }))];
    for (const ch of chains) {
      if (ch.lane === 'front') continue;
      const x0 = Math.max(ch.pts[0].x, -400);
      const x1 = Math.min(ch.pts[ch.pts.length - 1].x, this.def.length + 400);
      const rng = artRng(Math.round(this.def.seed * 17 + x0));
      for (let c0 = x0; c0 < x1; c0 += CHUNK) {
        const c1 = Math.min(x1, c0 + CHUNK);
        const g = this.graphics(D.front - 1, c0 - 30, c1 + 30);
        for (let x = c0 + 30 + rng() * 80; x < c1 - 30; x += 110 + rng() * 170) {
          if (this.nearAny(x, this.gapList, 50) || this.nearAny(x, keep, 40)) continue;
          if (x < ch.pts[0].x + 30 || x > ch.pts[ch.pts.length - 1].x - 30) continue;
          const y = yAt(ch.pts, x) + GRASS_BAND + 4;
          // a clump of blades that tops out below the surface line
          for (let k = -2; k <= 2; k++) {
            const bx = x + k * 6;
            const h = 14 + (2 - Math.abs(k)) * 4;
            strokePoly(g, [{ x: bx, y }, { x: bx + k * 2.5, y: y - h }], 4, C.grassDark);
            strokePoly(g, [{ x: bx, y: y - 1 }, { x: bx + k * 2.5, y: y - h + 2 }], 2, C.grassLight);
          }
          if (rng() < 0.4) {
            const fx = x + 12;
            const fy = y - 20;
            g.fillStyle(rng() < 0.5 ? hex(P.yellow) : 0xffffff, 1);
            g.fillCircle(fx, fy, 6);
            g.lineStyle(2.5, INK, 1);
            g.strokeCircle(fx, fy, 6);
            g.fillStyle(hex(P.orange), 1);
            g.fillCircle(fx, fy, 2.2);
          }
        }
      }
    }
  }

  // ---------------------------------------------------------------- checkpoints, coins, discovery, finish

  private placeFlags(): void {
    const D = WorldView.DEPTH;
    this.def.checkpoints.forEach((cp, i) => {
      if (i === 0) return;
      const y = this.surfaceTop(cp.x) + 10;
      const img = this.add(addImage(this.scene, cp.x, y, 'obj.flag.down')).setDepth(D.decorBack + 2);
      this.flags.set(cp.id, { img, x: cp.x, y, up: false });
    });
  }

  /** the checkpoint flag goes up (shape + colour change) */
  raiseFlag(id: string): void {
    const f = this.flags.get(id);
    if (!f || f.up) return;
    f.up = true;
    setPiece(f.img, 'obj.flag.up');
    if (!this.reduced) {
      f.img.setScale(1, 0.86);
      this.scene.tweens.add({ targets: f.img, scaleY: 1, duration: 420, ease: 'Back.easeOut' });
    }
    if (!this.opts.low) this.fx.sparks(f.x + 44, f.y - 160, 4);
  }

  private placeCoins(): void {
    let i = 0;
    for (const coin of this.def.coins) {
      const owned = this.opts.ownedCoins.has(coin.id);
      const img = this.add(addImage(this.scene, coin.x, coin.y, 'obj.coin')).setDepth(WorldView.DEPTH.pieces + 3);
      if (owned) img.setAlpha(0.25);
      this.coins.set(coin.id, { coin, img, owned, gone: false, phase: i++ * 0.6 });
    }
  }

  /** a coin pops and flies in one arc to a screen point (game units, camera-independent: the HUD tally), then is gone. False if already gone. */
  collectCoin(id: string, screenTarget: { x: number; y: number }): boolean {
    const c = this.coins.get(id);
    if (!c || c.gone || c.owned) return false;
    c.gone = true;
    const img = c.img;
    this.scene.tweens.killTweensOf(img);
    img.setScale(1, 1).setAlpha(1);
    if (this.reduced) {
      this.scene.tweens.add({ targets: img, alpha: 0, y: img.y - 24, duration: 260, onComplete: () => img.destroy() });
      return true;
    }
    this.flyToScreen(img, screenTarget, 70, 120, 560, 0.55);
    return true;
  }

  /** move a world image into screen space where it is, then pop and fly along one arc to a screen point */
  private flyToScreen(img: Phaser.GameObjects.Image | Phaser.GameObjects.Container, target: { x: number; y: number }, pop: number, popMs: number, flyMs: number, endScale: number): void {
    const cam = this.cam;
    const W = cam.width;
    const H = cam.height;
    const z = cam.zoom || 1;
    const sx = img.x - cam.scrollX;
    const sy = img.y - cam.scrollY;
    img.setScrollFactor(0).setDepth(WorldView.DEPTH.ui);
    if (img instanceof Phaser.GameObjects.Container) img.each((ch: Phaser.GameObjects.Components.ScrollFactor) => ch.setScrollFactor?.(0));
    img.setPosition(sx, sy);
    // a scrollFactor-0 point p shows at centre + (p - centre)·zoom: invert that for the target
    const tx = W / 2 + (target.x - W / 2) / z;
    const ty = H / 2 + (target.y - H / 2) / z;
    const s0 = img.scaleX;
    this.scene.tweens.add({
      targets: img,
      y: sy - pop,
      scale: s0 * 1.3,
      duration: popMs,
      ease: 'Quad.easeOut',
      onComplete: () => {
        const p0 = { x: img.x, y: img.y };
        const ctrl = { x: (p0.x + tx) / 2, y: Math.min(p0.y, ty) - 160 };
        const proxy = { t: 0 };
        this.scene.tweens.add({
          targets: proxy,
          t: 1,
          duration: flyMs,
          ease: 'Sine.easeIn',
          onUpdate: () => {
            const t = proxy.t;
            const u = 1 - t;
            img.setPosition(u * u * p0.x + 2 * u * t * ctrl.x + t * t * tx, u * u * p0.y + 2 * u * t * ctrl.y + t * t * ty);
            img.setScale(s0 * (1.3 + (endScale - 1.3) * t));
          },
          onComplete: () => img.destroy(),
        });
      },
    });
  }

  private placeDiscovery(): void {
    const d = this.def.discovery;
    if (!d) return;
    const D = WorldView.DEPTH;
    const box = this.add(this.scene.add.container(d.x, d.y)).setDepth(d.id === 'pinwheel' ? D.ground - 2 : D.pieces + 3);
    if (d.id === 'golden-acorn') box.add(makeImage(this.scene, 0, 0, 'obj.acorn'));
    else if (d.id === 'rally-ribbon') box.add(makeImage(this.scene, 0, 0, 'obj.ribbon'));
    else {
      box.add(makeImage(this.scene, 0, 0, 'obj.pinwheel.stick'));
      this.discoveryHead = makeImage(this.scene, 0, 0, 'obj.pinwheel.head');
      box.add(this.discoveryHead);
    }
    if (this.opts.ownedDiscovery) box.setAlpha(0.35);
    if (!this.reduced && d.id !== 'pinwheel') this.scene.tweens.add({ targets: box, y: d.y - 10, duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.discovery = box;
  }

  /** the discovery lifts, sparkles and flies to a screen point (game units, camera-independent) */
  collectDiscovery(screenTarget: { x: number; y: number }): void {
    const box = this.discovery;
    if (!box || this.discoveryGone) return;
    this.discoveryGone = true;
    this.scene.tweens.killTweensOf(box);
    box.setAlpha(1);
    this.fx.sparks(box.x, box.y, 6);
    if (this.reduced) {
      this.scene.tweens.add({ targets: box, alpha: 0, y: box.y - 30, duration: 420, delay: 200, onComplete: () => box.destroy() });
      return;
    }
    box.setDepth(WorldView.DEPTH.fx);
    this.scene.tweens.add({
      targets: box,
      y: box.y - 70,
      scale: 1.35,
      duration: 420,
      ease: 'Back.easeOut',
      onComplete: () => this.flyToScreen(box, screenTarget, 0, 1, 700, 0.6),
    });
  }

  private placeFinish(): void {
    if (this.def.showFinish === false) return;
    const x = this.def.finishX;
    this.add(addImage(this.scene, x, this.surfaceTop(x) + 12, 'obj.finish')).setDepth(WorldView.DEPTH.decorBack + 2);
  }

  // ---------------------------------------------------------------- built pieces and the sign

  /** add a built piece (drops in with a small bounce when animate) and return its graphics */
  addBuilt(id: string, kind: PieceKind, seg: Segment, animate: boolean): Phaser.GameObjects.Graphics {
    this.removeBuilt(id);
    const D = WorldView.DEPTH;
    const front = seg.lane === 'front';
    const groundY = this.groundBelow((seg.x0 + seg.x1) / 2, Math.max(seg.y0, seg.y1) + 4);
    const g = this.add(this.scene.add.graphics()).setDepth(front ? D.front : D.pieces);
    drawPiece(g, kind, seg, 'solid', { groundY });
    const baseY = front ? LANE_DROP : 0;
    g.y = baseY;
    this.built.set(id, g);
    if (animate && !this.reduced) {
      g.y = baseY - 120;
      g.setAlpha(0.6);
      this.scene.tweens.add({ targets: g, alpha: 1, duration: 120 });
      this.scene.tweens.add({ targets: g, y: baseY, duration: 520, ease: 'Bounce.easeOut' });
      this.scene.time.delayedCall(190, () => {
        if (!g.active) return;
        const y = Math.max(seg.y0, seg.y1) + baseY;
        this.fx.land(seg.x0 + 20, y, 0.5);
        this.fx.land(seg.x1 - 20, y, 0.5);
      });
    } else if (animate) {
      g.setAlpha(0);
      this.scene.tweens.add({ targets: g, alpha: 1, duration: 160 });
    }
    return g;
  }

  removeBuilt(id: string): void {
    const g = this.built.get(id);
    if (!g) return;
    this.scene.tweens.killTweensOf(g);
    g.destroy();
    this.built.delete(id);
  }

  /** put up the route sign at the fork, pointing high (jump route) or low (gentle route) */
  placeSign(which: 'high' | 'low', animate: boolean): void {
    const x = this.def.forkX;
    if (x === undefined) return;
    const D = WorldView.DEPTH;
    const y = this.groundBelow(x) + 10;
    if (!this.sign) {
      const post = this.add(addImage(this.scene, x, y, 'obj.sign.post')).setDepth(D.decorBack + 3);
      const board = this.add(addImage(this.scene, x, y - 176, `obj.sign.${which}`)).setDepth(D.decorBack + 4);
      this.sign = { post, board };
    } else setPiece(this.sign.board, `obj.sign.${which}`);
    const { post, board } = this.sign;
    this.scene.tweens.killTweensOf([post, board]);
    post.setScale(1).setAlpha(1);
    board.setScale(1).setAlpha(1);
    if (animate && !this.reduced) {
      post.setScale(1, 0.2);
      board.setScale(0.2);
      this.scene.tweens.add({ targets: post, scaleY: 1, duration: 260, ease: 'Back.easeOut' });
      this.scene.tweens.add({ targets: board, scale: 1, duration: 420, delay: 120, ease: 'Back.easeOut' });
    } else if (animate) {
      board.setAlpha(0);
      this.scene.tweens.add({ targets: board, alpha: 1, duration: 160 });
    }
  }

  /** water spans (gaps in the ground on a lane), for drawing and for naming misses */
  get gaps(): { x0: number; x1: number }[] {
    return this.gapList.map((g) => ({ ...g }));
  }

  /** the water surface height over a gap (for splashes); null if x is not over water */
  waterYAt(x: number): number | null {
    const w = this.waters.find((it) => x >= it.x0 && x <= it.x1);
    return w ? w.y : null;
  }

  /** a coin's world position (null once collected) */
  coinPos(id: string): { x: number; y: number } | null {
    const c = this.coins.get(id);
    return c && !c.gone ? { x: c.coin.x, y: c.coin.y } : null;
  }

  setOptions(opts: Partial<Pick<WorldOptions, 'reduced' | 'low'>>): void {
    if (opts.reduced !== undefined) this.opts.reduced = opts.reduced;
    if (opts.low !== undefined) this.opts.low = opts.low;
    this.fx.setOptions({ reduced: this.opts.reduced, low: this.opts.low });
  }

  /** every frame: parallax, cloud drift, coin spin */
  update(dtSec: number): void {
    if (!this.alive) return;
    const dt = Math.max(0, Math.min(dtSec, 0.1));
    this.time += dt;
    if (!this.reduced) {
      for (const c of this.coins.values()) {
        if (c.gone || c.owned) continue;
        const s = Math.cos(this.time * 2.6 + c.phase);
        c.img.setScale(Math.max(0.12, Math.abs(s)), 1);
      }
      if (this.discoveryHead && !this.discoveryGone) this.discoveryHead.rotation += dt * 2.2;
      for (const w of this.waters) if (w.waves.visible) this.drawWaves(w);
    }
    this.layoutScreenLayers();
  }

  destroy(): void {
    if (!this.alive) return;
    this.alive = false;
    this.scene.events.off(Phaser.Scenes.Events.POST_UPDATE, this.onPost);
    for (const o of this.objects) {
      this.scene.tweens.killTweensOf(o);
      o.destroy();
    }
    for (const g of this.built.values()) g.destroy();
    this.built.clear();
    this.objects = [];
    this.cull = [];
    this.fx.clear();
  }
}
