/** Cut-out puppet rig description shared by NPCs, avatars, and Story Stage puppets. */

export interface RigPart {
  id: string;
  /** art key; may be '' for an empty pivot container */
  art: string;
  parent: string | null;
  /** pivot position in the parent's frame (root frame for top-level parts) */
  x: number;
  y: number;
  /** draw order among siblings; the parent's own image is z = 0 */
  z: number;
  /** rest rotation in degrees */
  rot?: number;
  /** mirror horizontally (e.g. right ear reuses the left ear art) */
  sx?: number;
}

export interface FaceLayout {
  head: string;
  eyes: [number, number][];
  eyeScale: number;
  brows: [number, number][];
  mouth: [number, number];
  blush: [number, number][];
  /** draw eyes above everything else on the head (z) */
  z?: number;
}

export interface Anchor {
  part: string;
  x: number;
  y: number;
  scale?: number;
}

export type Gait = 'walk' | 'hop' | 'waddle' | 'float';

export interface VoiceSpec {
  /** base pitch in Hz for babble blips */
  pitch: number;
  /** pitch spread */
  spread: number;
  /** blip length seconds */
  len: number;
  /** oscillator wave */
  wave: OscillatorType;
  /** speech-synthesis pitch/rate when a local voice is used */
  ttsPitch: number;
  ttsRate: number;
}

export interface RigDef {
  id: string;
  parts: RigPart[];
  face: FaceLayout;
  anchors: {
    hat?: Anchor;
    hand: Anchor;
    /** speech bubble/emote point in root frame */
    emote: [number, number];
  };
  limbs: {
    armFront?: string;
    armBack?: string;
    footFront?: string;
    footBack?: string;
    tail?: string;
    ears?: string[];
    wings?: string[];
    antennae?: string[];
  };
  height: number;
  width: number;
  gait: Gait;
  voice: VoiceSpec;
}
