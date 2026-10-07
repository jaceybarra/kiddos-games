import type { ArtPiece } from '../svg';
import { FACE_PIECES } from './face';
import { PIP_PIECES, PIP_RIG } from './pip';
import { MOSS_PIECES, MOSS_RIG } from './moss';
import { FIZZ_PIECES, FIZZ_RIG } from './fizz';
import { LUMA_PIECES, LUMA_RIG } from './luma';
import { ROWAN_PIECES, ROWAN_RIG } from './rowan';
import { avatarPieces, avatarRig, type AvatarSpecies } from './avatars';
import { HAT_PIECES } from './hats';
import type { RigDef } from './rig';

export type CastId = 'pip' | 'moss' | 'fizz' | 'luma' | 'rowan';
export const CAST_IDS: CastId[] = ['pip', 'moss', 'fizz', 'luma', 'rowan'];

export const CAST_RIGS: Record<CastId, RigDef> = {
  pip: PIP_RIG,
  moss: MOSS_RIG,
  fizz: FIZZ_RIG,
  luma: LUMA_RIG,
  rowan: ROWAN_RIG,
};

export const CAST_PIECES: ArtPiece[] = [
  ...FACE_PIECES,
  ...PIP_PIECES,
  ...MOSS_PIECES,
  ...FIZZ_PIECES,
  ...LUMA_PIECES,
  ...ROWAN_PIECES,
  ...avatarPieces(),
  ...HAT_PIECES,
];

/** Every art key a rig needs (parts + face + emotes). */
export function rigArtKeys(rig: RigDef): string[] {
  const keys = new Set<string>(['fx.shadow', 'face.brow', 'face.blush']);
  for (const p of rig.parts) if (p.art) keys.add(p.art);
  for (const p of FACE_PIECES) keys.add(p.key);
  return [...keys];
}

export { avatarRig, type AvatarSpecies };
