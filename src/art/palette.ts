/**
 * Shared palette. Every SVG asset and the DOM UI pull colours from here so the
 * world reads as one handmade set. See ART_DIRECTION.md.
 */
export const P = {
  ink: '#3b2a20',
  inkSoft: '#6b5444',
  paper: '#fbf3e4',
  cream: '#f6e7c8',
  white: '#fffdf8',

  skyTop: '#9fd3e6',
  skyLow: '#eaf5e6',
  duskTop: '#6d5f9e',
  duskLow: '#f2b98f',
  nightTop: '#25284a',
  nightLow: '#4b4a7a',
  cloud: '#fffaf0',

  grassLight: '#b5d67a',
  grass: '#86b85a',
  grassDark: '#4f8a45',
  farHill: '#c7dcc0',
  farForest: '#a9c7b4',
  midForest: '#6c9e7e',
  deepForest: '#3f6e57',

  woodLight: '#e2ad72',
  wood: '#b5773e',
  woodDark: '#7a4a28',
  bark: '#8a5a3b',
  barkDark: '#5c3a26',

  stone: '#b8b2a7',
  stoneDark: '#8a8479',
  water: '#7cc4e0',
  waterDark: '#4f9fc4',
  waterLight: '#c6ecf5',

  lantern: '#f5c04a',
  glow: '#ffe7a3',
  berry: '#d95b4f',
  rose: '#f0a3a0',
  plum: '#8e5ba8',
  lilac: '#c9b6e4',
  sea: '#4f9fd6',
  teal: '#3fa7a0',
  sun: '#f2c84b',
  leaf: '#7cb35a',
  pumpkin: '#ee8a3a',
  pumpkinDark: '#c4632a',

  // Cast
  pipFur: '#e07a3a',
  pipFurDark: '#b85a26',
  pipBelly: '#f8d9b0',
  mossShell: '#4f9a7a',
  mossShellDark: '#2f6e55',
  mossSkin: '#a9c97a',
  mossSkinDark: '#7fa45a',
  fizzFur: '#f3e8da',
  fizzFurDark: '#d9c6b0',
  fizzInner: '#f2a7a7',
  fizzScarf: '#7d6bc2',
  lumaBody: '#8f7fc0',
  lumaBodyDark: '#6c5c9e',
  lumaWing: '#f7e3a1',
  lumaWing2: '#c9b6e4',
  lumaFluff: '#fff4dc',
  rowanFur: '#7d7f86',
  rowanFurDark: '#55575e',
  rowanStripe: '#f2efe9',
  rowanApron: '#c96d4f',
} as const;

export type PaletteKey = keyof typeof P;

/** Convert '#rrggbb' to 0xrrggbb for Phaser APIs. */
export function hex(c: string): number {
  return parseInt(c.slice(1), 16);
}

/** Simple colour mix in sRGB space; t=0 → a, t=1 → b. */
export function mix(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (v: number, s: number) => (v >> s) & 255;
  const m = (s: number) => Math.round(ch(pa, s) + (ch(pb, s) - ch(pa, s)) * t);
  const out = (m(16) << 16) | (m(8) << 8) | m(0);
  return '#' + out.toString(16).padStart(6, '0');
}

export const OUTLINE = { character: 5, prop: 4, detail: 3 } as const;

/**
 * Colour choices offered to children (avatars, kite tails, decorations).
 * Each choice also has a pattern/icon elsewhere so colour is never the only cue.
 */
export const CHOICE_COLORS: { id: string; name: string; hex: string }[] = [
  { id: 'berry', name: 'berry red', hex: P.berry },
  { id: 'sun', name: 'sunny yellow', hex: P.sun },
  { id: 'sea', name: 'sky blue', hex: P.sea },
  { id: 'leaf', name: 'leaf green', hex: P.leaf },
  { id: 'plum', name: 'plum purple', hex: P.plum },
  { id: 'pumpkin', name: 'pumpkin orange', hex: P.pumpkin },
];

export function choiceColor(id: string): string {
  return CHOICE_COLORS.find((c) => c.id === id)?.hex ?? P.sun;
}
