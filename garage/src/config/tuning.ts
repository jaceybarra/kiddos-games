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
    fallDepth: 90,
  },

  drive: {
    /** cruising speed (units/s): "drive itself" mode drives at this; every required jump is designed around it */
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

  /** He drives (the default): gas, brake that becomes reverse, momentum, hills */
  pedals: {
    /** flat-out speed on the gas */
    topSpeed: 560,
    gasAccel: 640,
    /** letting go of every pedal: the truck rolls on and slows gently */
    coastDecel: 150,
    /** holding the brake at a standstill this long starts reversing */
    reverseDelayMs: 220,
    reverseSpeed: 230,
    reverseAccel: 520,
    /** pull of a hill along its slope (less than the gas, so every authored hill can be climbed from a standstill) */
    hillGravity: 900,
    /** a jump with the gas held always carries at least cruising speed (gaps are made for it) */
    jumpCarry: true,
    /** over a crest, when the ground's fall-away (units/s) is faster than this, the truck takes off for a little hop */
    crestLift: 120,
  },

  /** mud, boost strips and crates */
  stuff: {
    mudSpeed: 210,
    mudDrag: 1100,
    boostSpeed: 820,
    boostAccel: 2600,
    boostMs: 1100,
    /** smashing a crate keeps this much speed */
    crateKeep: 0.88,
  },

  /** in the air (pedals): the gas spins forward, the brake spins back; left alone the truck levels itself */
  air: {
    spinMax: 7,
    spinAccel: 22,
    /** how quickly a truck left alone eases level (per second) */
    levelRate: 4,
    /** a landing tilted less than this from the ground is fine (radians, about 75°) */
    landTolerance: 1.3,
    /** a deliberate tilt that lands this close to the ground is a perfect landing */
    perfect: 0.3,
    /** a perfect landing gives this little push */
    perfectBoost: 90,
    /** landing on its roof: a soft bounce, the truck rolls upright, no miss */
    tumbleBounce: 520,
    tumbleKeep: 0.5,
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
    /** hitting a ramp or pad faster than cruising throws higher, up to this much */
    fastLaunchMax: 1.22,
  },

  recovery: {
    /** a miss shows a soft puff for this long, then the truck is back at the checkpoint */
    restoreMs: 800,
    /** misses at the same obstacle before the example and wider timing appear */
    missesBeforeHelp: 2,
  },

  camera: {
    /** how far ahead of the truck the camera looks (at cruising speed; more when faster, behind when reversing) */
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
