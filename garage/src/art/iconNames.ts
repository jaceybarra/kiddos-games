/**
 * Every icon the DOM layer uses. Icons are original inline SVG strings in
 * art/icons.ts (viewBox 0 0 100 100, ink outlines, readable at 40–120 px).
 * Meaning is carried by shape first; colour only supports it.
 */
export const ICON_NAMES = [
  // driving
  'jump', // a chunky up-arc arrow over a wheel
  'brake', // a wheel with two stop bars / a hand-stop shape
  'gas', // a pedal with a big arrow pointing on (go)
  'reverse', // a pedal with a big arrow pointing back (stop, then back up)
  'pause', // two thick bars
  'help', // an open hand with a small sparkle (show me)
  // flow
  'play', // big triangle (start)
  'replay', // circular arrow
  'garage', // little garage with a roll-up door
  'done', // a big tick in a rounded square
  'close', // an X (grown-up panels only)
  'back', // left arrow
  // building
  'undo', // curved arrow back
  'clear', // a sweeping broom
  'test', // the truck with a small flag (try it)
  'invite', // two waving hands (invite a friend to help)
  // garage
  'paint', // a paint pot with a drip
  'pattern', // a striped swatch
  'decal', // a peel-off star sticker
  'wheel', // a tyre
  'track', // a little wavy road with a flag (My Tiny Track)
  'save', // a box with a down arrow (keep it)
  'trash', // a bin (remove a piece)
  'gear', // grown-up settings
  // states
  'check', // a tick
  'star',
  'coin',
  'offline', // a cloud with a tick (ready without internet)
  'warn', // a triangle with !
  'rotate', // a tablet turning sideways (portrait → landscape)
  'rest', // a moon over a garage (time for a break picture)
] as const;

export type IconName = (typeof ICON_NAMES)[number];
