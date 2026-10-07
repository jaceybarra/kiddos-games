import { type ArtPiece, svgDocument } from './svg';

/** Pure registry of authored art pieces (no Phaser dependency, usable by DOM UI and tests). */

const registry = new Map<string, ArtPiece>();

export function registerPieces(pieces: ArtPiece[]): void {
  for (const p of pieces) {
    if (registry.has(p.key) && registry.get(p.key) !== p) {
      throw new Error(`Duplicate art key: ${p.key}`);
    }
    registry.set(p.key, p);
  }
}

export function hasPiece(key: string): boolean {
  return registry.has(key);
}

export function getPiece(key: string): ArtPiece {
  const p = registry.get(key);
  if (!p) throw new Error(`Unknown art key: ${key}`);
  return p;
}

export function allPieceKeys(): string[] {
  return [...registry.keys()];
}

export function svgDataUrl(svg: string): string {
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

/** Full SVG markup for DOM use (menus reuse the in-game art). */
export function pieceSvg(key: string, scale = 1): string {
  return svgDocument(getPiece(key), scale);
}
