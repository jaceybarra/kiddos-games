/**
 * Wonder Garage palette: a backyard toy set. Saturated toy colours up front,
 * softer and lighter behind. Every important state also has a shape cue.
 */
export const P = {
  ink: '#3a2618',
  inkSoft: '#6b4a36',
  white: '#ffffff',
  cream: '#fff6e6',
  paper: '#fbefd9',
  // wood and cardboard
  woodLight: '#f0c27f',
  wood: '#d39550',
  woodDark: '#9a5f2c',
  card: '#e9c99a',
  cardDark: '#c9a06a',
  // meadow
  skyTop: '#8fd0f0',
  skyLow: '#e4f6ff',
  hillFar: '#b9dbb0',
  hillMid: '#8cc47c',
  grass: '#6db54c',
  grassLight: '#9bd46a',
  grassDark: '#3f8a3a',
  soil: '#b0743f',
  soilDark: '#7d4f2a',
  water: '#5cb8e6',
  waterLight: '#a9e2fb',
  leaf: '#4fa64a',
  leafDark: '#2f7a35',
  // toy accents
  red: '#e2493b',
  redDark: '#a92c22',
  orange: '#f28c28',
  yellow: '#ffd23f',
  yellowDark: '#d9a400',
  blue: '#3f8fe0',
  blueDark: '#2a62a8',
  purple: '#8a5cc7',
  teal: '#2fb3a5',
  pink: '#f27ba5',
  rubber: '#2e2a2b',
  rubberLight: '#4a4446',
  metal: '#b8c2cc',
  metalDark: '#7d8893',
  // crew
  beaver: '#a5683a',
  beaverLight: '#c98b55',
  bunny: '#f3ece2',
  bunnyInner: '#f5b8c6',
  turtleShell: '#4f9b5a',
  turtleShellLight: '#79c27b',
  turtleSkin: '#b9d77e',
} as const;

/** Truck paint colours: each also has a named pattern option so colour is never the only difference. */
export const PAINTS = [
  { id: 'red', hex: P.red, name: 'Red' },
  { id: 'blue', hex: P.blue, name: 'Blue' },
  { id: 'yellow', hex: P.yellow, name: 'Yellow' },
  { id: 'green', hex: P.grass, name: 'Green' },
  { id: 'purple', hex: P.purple, name: 'Purple' },
  { id: 'orange', hex: P.orange, name: 'Orange' },
] as const;

export function hex(c: string): number {
  return parseInt(c.slice(1), 16);
}
