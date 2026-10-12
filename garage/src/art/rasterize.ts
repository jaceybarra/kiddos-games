import Phaser from 'phaser';
import { type ArtPiece, originOf, svgDocument } from './svg';
import { getPiece, hasPiece, svgDataUrl } from './registry';

export { registerPieces, hasPiece, getPiece, allPieceKeys, svgDataUrl, pieceSvg } from './registry';

/**
 * Turns authored SVG pieces into Phaser textures at load time.
 * Everything is local: SVG strings → data URLs → <img> → canvas → atlas page.
 *
 * Small pieces are shelf-packed into 2048² atlas pages so a scene binds only a
 * handful of textures (we render with one texture per batch for robustness —
 * multi-texture batching produced artefacts on software WebGL during testing).
 * Wide/tall pieces (backgrounds) get their own textures, tiled if needed.
 */

const PAGE = 2048;
const MAX_TILE = 2048;
const PAD = 3;
const BIG = 900;

interface Placement {
  texture: string;
  frame: string | undefined;
  /** for tiled pieces */
  tiles?: number;
}

const placed = new Map<string, Placement>();
const pagesByGroup = new Map<string, string[]>();
let pageCounter = 0;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('SVG rasterise failed'));
    img.src = src;
  });
}

async function rasterizeBox(p: ArtPiece, sx = 0, sw?: number): Promise<HTMLCanvasElement> {
  const [x, y, w, h] = p.box;
  const width = sw ?? w;
  const slice: ArtPiece = { ...p, box: [x + sx, y, width, h] };
  let img: HTMLImageElement;
  try {
    img = await loadImage(svgDataUrl(svgDocument(slice)));
  } catch {
    throw new Error(`SVG rasterise failed: ${p.key}`);
  }
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(width);
  canvas.height = Math.ceil(h);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas unavailable');
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas;
}

function isBig(p: ArtPiece): boolean {
  return p.box[2] > BIG || p.box[3] > BIG;
}

async function addBig(textures: Phaser.Textures.TextureManager, p: ArtPiece, group: string): Promise<void> {
  const w = p.box[2];
  const tiles = Math.max(1, Math.ceil(w / MAX_TILE));
  const pages = pagesByGroup.get(group) ?? [];
  for (let i = 0; i < tiles; i++) {
    const name = tiles === 1 ? `big:${p.key}` : `big:${p.key}#${i}`;
    if (!textures.exists(name)) {
      const sx = i * MAX_TILE;
      const canvas = await rasterizeBox(p, sx, Math.min(MAX_TILE, w - sx));
      if (!textures.exists(name)) textures.addCanvas(name, canvas);
    }
    pages.push(name);
  }
  pagesByGroup.set(group, pages);
  placed.set(p.key, { texture: tiles === 1 ? `big:${p.key}` : `big:${p.key}#0`, frame: undefined, tiles });
}

async function addPacked(textures: Phaser.Textures.TextureManager, list: ArtPiece[], group: string): Promise<void> {
  if (!list.length) return;
  const canvases = await Promise.all(list.map((p) => rasterizeBox(p)));
  // tallest first for better shelf packing
  const order = list.map((p, i) => ({ p, c: canvases[i] })).sort((a, b) => b.c.height - a.c.height);
  let page: HTMLCanvasElement | null = null;
  let ctx: CanvasRenderingContext2D | null = null;
  let frames: { key: string; x: number; y: number; w: number; h: number }[] = [];
  let cx = 0;
  let cy = 0;
  let rowH = 0;
  let usedH = 0;
  const newPage = () => {
    page = document.createElement('canvas');
    page.width = PAGE;
    page.height = PAGE;
    ctx = page.getContext('2d');
    cx = 0;
    cy = 0;
    rowH = 0;
    usedH = 0;
  };
  const flush = () => {
    const pg = page as HTMLCanvasElement | null;
    if (!pg || !frames.length) return;
    const key = `atlas:${group}:${pageCounter++}`;
    // trim the page height to what was used
    const trimmed = document.createElement('canvas');
    trimmed.width = PAGE;
    trimmed.height = Math.max(4, Math.ceil(usedH));
    trimmed.getContext('2d')!.drawImage(pg, 0, 0);
    const tex = textures.addCanvas(key, trimmed);
    if (!tex) throw new Error('Could not create atlas page ' + key);
    for (const f of frames) {
      tex.add(f.key, 0, f.x, f.y, f.w, f.h);
      placed.set(f.key, { texture: key, frame: f.key });
    }
    const pages = pagesByGroup.get(group) ?? [];
    pages.push(key);
    pagesByGroup.set(group, pages);
    page = null;
    ctx = null;
    frames = [];
  };
  for (const { p, c } of order) {
    if (!page) newPage();
    if (cx + c.width + PAD > PAGE) {
      cx = 0;
      cy += rowH + PAD;
      rowH = 0;
    }
    if (cy + c.height + PAD > PAGE) {
      flush();
      newPage();
    }
    (ctx as CanvasRenderingContext2D | null)!.drawImage(c, cx, cy);
    frames.push({ key: p.key, x: cx, y: cy, w: c.width, h: c.height });
    usedH = Math.max(usedH, cy + c.height + PAD);
    cx += c.width + PAD;
    rowH = Math.max(rowH, c.height);
  }
  flush();
}

const inflight = new Map<string, Promise<void>>();

/**
 * Rasterise any missing pieces. `group` lets a scene release its own pages
 * later (see releaseGroup). Shared art uses the default 'core' group.
 */
export async function ensureArt(
  textures: Phaser.Textures.TextureManager,
  keys: Iterable<string>,
  group = 'core',
): Promise<void> {
  const want = [...new Set(keys)].filter((k) => !placed.has(k));
  // wait for any overlapping in-flight work first
  await Promise.all(want.map((k) => inflight.get(k)).filter(Boolean));
  const todo = want.filter((k) => !placed.has(k)).map(getPiece);
  if (!todo.length) return;
  const job = (async () => {
    const big = todo.filter(isBig);
    const small = todo.filter((p) => !isBig(p));
    for (const b of big) await addBig(textures, b, group);
    await addPacked(textures, small, group);
  })();
  for (const p of todo) inflight.set(p.key, job);
  try {
    await job;
  } finally {
    for (const p of todo) inflight.delete(p.key);
  }
}

export function isArtReady(key: string): boolean {
  return placed.has(key);
}

/** Free a scene group's textures (backgrounds etc.) when leaving a scene. */
export function releaseGroup(textures: Phaser.Textures.TextureManager, group: string): void {
  if (group === 'core') return;
  const pages = pagesByGroup.get(group) ?? [];
  const dead = new Set(pages);
  for (const [k, v] of [...placed]) if (dead.has(v.texture)) placed.delete(k);
  for (const pg of pages) if (textures.exists(pg)) textures.remove(pg);
  pagesByGroup.delete(group);
}

function place(key: string): Placement {
  const pl = placed.get(key);
  if (!pl) {
    if (!hasPiece(key)) throw new Error(`Unknown art key: ${key}`);
    throw new Error(`Art not rasterised yet: ${key}`);
  }
  return pl;
}

/**
 * Add an art piece to a scene with its pivot at (x, y). Wide pieces come back
 * as a Container of tiles; everything else is a plain Image.
 */
export function addArt(
  scene: Phaser.Scene,
  x: number,
  y: number,
  key: string,
): Phaser.GameObjects.Image | Phaser.GameObjects.Container {
  const p = getPiece(key);
  const pl = place(key);
  if (!pl.tiles || pl.tiles === 1) {
    const { ox, oy } = originOf(p);
    return scene.add.image(x, y, pl.texture, pl.frame).setOrigin(ox, oy);
  }
  const c = scene.add.container(x, y);
  const [bx, by] = p.box;
  for (let i = 0; i < pl.tiles; i++) {
    const img = new Phaser.GameObjects.Image(scene, bx + i * MAX_TILE, by, `big:${key}#${i}`).setOrigin(0, 0);
    c.add(img);
  }
  return c;
}

/** Image-only variant (piece must not be tiled). */
export function addImage(scene: Phaser.Scene, x: number, y: number, key: string): Phaser.GameObjects.Image {
  const img = makeImage(scene, x, y, key);
  scene.add.existing(img);
  return img;
}

/** Create an image without adding it to the display list (for containers). */
export function makeImage(scene: Phaser.Scene, x: number, y: number, key: string): Phaser.GameObjects.Image {
  const p = getPiece(key);
  const pl = place(key);
  const { ox, oy } = originOf(p);
  return new Phaser.GameObjects.Image(scene, x, y, pl.texture, pl.frame).setOrigin(ox, oy);
}

/** Swap an image to a different piece while keeping the pivot convention. */
export function setPiece(img: Phaser.GameObjects.Image, key: string): void {
  const p = getPiece(key);
  const pl = place(key);
  const { ox, oy } = originOf(p);
  img.setTexture(pl.texture, pl.frame).setOrigin(ox, oy);
}

/** Texture + frame for Phaser APIs that take them directly (particles etc.). */
export function textureOf(key: string): { texture: string; frame: string | undefined } {
  const pl = place(key);
  return { texture: pl.texture, frame: pl.frame };
}
