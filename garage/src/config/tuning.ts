/**
 * Every movement and feel number in one place. World units are pixels in a
 * 1920×1080 design space (the camera shows more or less of it per screen).
 * Change these to tune the game; nothing else hard-codes them.
 */
export const TUNING = {
  world: {
    /** baseline ground height in design units */
    groundY: 860,
    /** how far below the lowest ground the truck may fall before it counts as a miss */
    fallDepth: 260,
  },

  drive: {
    /** gentle automatic forward speed (units/s) */
    speed: 340,
    /** "slower driving" parent setting multiplies the speed */
    slowFactor: 0.72,
    /** speeding up and slowing down (units/s²) */
    accel: 520,
    brakeDecel: 1500,
    /** while grounded the truck can step up/down this much without leaving the ground */
    stepUp: 22,
    stepDown: 30,
  },

  jump: {
    gravity: 2500,
    /** a short tap clears every required beginner jump */
    velocity: { chunky: 1060, spring: 1290 },
    /** holding the button adds a little more height for this long */
    holdMaxMs: 170,
    /** upward push while held (less than gravity): a full hold adds about a quarter more height */
    holdBoost: 900,
    /** jump still allowed this long after rolling off an edge */
    coyoteMs: 120,
    /** a tap this long before landing still jumps on landing */
    bufferMs: 150,
    /** after two misses at the same place (or with "more help"): windows multiply by this */
    assistFactor: 2,
    /** chunky wheels land softer: less squash, no tiny rebound */
    landSquash: { chunky: 0.12, spring: 0.2 },
  },

  pieces: {
    /** leaving the top of a ramp launches the truck up this fast */
    rampLaunch: 980,
    /** landing on a bouncy pad sends the truck back up this fast */
    padBounce: 1320,
  },

  recovery: {
    /** a miss shows a soft puff for this long, then the truck is back at the checkpoint */
    restoreMs: 900,
    /** misses at the same obstacle before the example and wider timing appear */
    missesBeforeHelp: 2,
  },

  camera: {
    /** how far ahead of the truck the camera looks */
    lookAhead: 320,
    /** follow smoothing (per second); lower is softer */
    followX: 3.2,
    followY: 2.2,
    /** the truck sits this far below the screen's centre */
    truckBelowCentre: 170,
  },

  build: {
    /** a dragged piece snaps to a socket whose centre is within this distance */
    snapRadius: 150,
    /** the tray never offers more than this many pieces */
    maxTray: 3,
  },

  feel: {
    /** body lean (radians) per unit of acceleration */
    leanPerAccel: 0.00012,
    maxLean: 0.12,
    /** suspension bob while driving */
    bobAmp: 2.2,
    bobHz: 2.4,
  },
} as const;

export type WheelKind = 'chunky' | 'spring';
