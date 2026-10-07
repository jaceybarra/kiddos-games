import type { ArtPiece } from './svg';
import { COMMON_PIECES } from './common';
import { FACE_PIECES } from './cast/face';
import { PIP_PIECES } from './cast/pip';
import { MOSS_PIECES } from './cast/moss';
import { FIZZ_PIECES } from './cast/fizz';
import { LUMA_PIECES } from './cast/luma';
import { ROWAN_PIECES } from './cast/rowan';
import { avatarPieces } from './cast/avatars';
import { HAT_PIECES } from './cast/hats';
import { WINDMILL_PIECES } from './scenes/windmill';
import { MAP_PIECES } from './scenes/map';
import { TINKER_PIECES } from './scenes/tinker';
import { CLUBHOUSE_PIECES } from './scenes/clubhouse';
import { PICNIC_PIECES } from './scenes/picnic';
import { STAGE_PIECES } from './scenes/stage';
import { TRAIL_ADVENTURE_PIECES } from './scenes/trailAdventures';

/**
 * Where every asset comes from and under what licence.
 *
 * Only tests and docs import this file (it pulls in every scene's art, which
 * the game itself loads lazily). `tests/unit/art.test.ts` fails if a registered
 * art key is missing here or listed twice.
 */

export const ORIGINAL = 'Original to this repository (code-drawn); private family use';

export interface ArtSource {
  file: string;
  what: string;
  pieces: ArtPiece[];
  licence: string;
}

export const ART_SOURCES: ArtSource[] = [
  { file: 'src/art/common.ts', what: 'shared effects: shadow, glint, dust, sparks, ghost hand', pieces: COMMON_PIECES, licence: ORIGINAL },
  { file: 'src/art/cast/face.ts', what: 'puppet eyes, brows, mouths, emotes', pieces: FACE_PIECES, licence: ORIGINAL },
  { file: 'src/art/cast/pip.ts', what: 'Pip puppet parts', pieces: PIP_PIECES, licence: ORIGINAL },
  { file: 'src/art/cast/moss.ts', what: 'Moss puppet parts', pieces: MOSS_PIECES, licence: ORIGINAL },
  { file: 'src/art/cast/fizz.ts', what: 'Fizz puppet parts', pieces: FIZZ_PIECES, licence: ORIGINAL },
  { file: 'src/art/cast/luma.ts', what: 'Luma puppet parts', pieces: LUMA_PIECES, licence: ORIGINAL },
  { file: 'src/art/cast/rowan.ts', what: 'Rowan puppet parts', pieces: ROWAN_PIECES, licence: ORIGINAL },
  { file: 'src/art/cast/avatars.ts', what: 'player avatars (4 species × colours)', pieces: avatarPieces(), licence: ORIGINAL },
  { file: 'src/art/cast/hats.ts', what: 'avatar hats', pieces: HAT_PIECES, licence: ORIGINAL },
  { file: 'src/art/scenes/windmill.ts', what: 'Lantern Trail: The Windmill Kite', pieces: WINDMILL_PIECES, licence: ORIGINAL },
  { file: 'src/art/scenes/trailAdventures.ts', what: 'Lantern Trail: Picnic Bridge, Waterwheel, Lantern Launch', pieces: TRAIL_ADVENTURE_PIECES, licence: ORIGINAL },
  { file: 'src/art/scenes/map.ts', what: 'hub map and landmarks', pieces: MAP_PIECES, licence: ORIGINAL },
  { file: 'src/art/scenes/tinker.ts', what: 'Tinker Grove parts and workshop', pieces: TINKER_PIECES, licence: ORIGINAL },
  { file: 'src/art/scenes/clubhouse.ts', what: 'clubhouse room and shelves', pieces: CLUBHOUSE_PIECES, licence: ORIGINAL },
  { file: 'src/art/scenes/picnic.ts', what: 'Picnic Parade meadow, food, props', pieces: PICNIC_PIECES, licence: ORIGINAL },
  { file: 'src/art/scenes/stage.ts', what: 'Story Stage theatre, backdrops, props', pieces: STAGE_PIECES, licence: ORIGINAL },
];

/** Assets that are not art pieces. Nothing here is downloaded at runtime. */
export const OTHER_SOURCES: { file: string; what: string; licence: string }[] = [
  { file: 'src/ui/icons.ts', what: 'menu and button icons (inline SVG)', licence: ORIGINAL },
  { file: 'index.html', what: 'lantern favicon (inline SVG data URL)', licence: ORIGINAL },
  { file: 'src/core/audio.ts', what: 'all music and sound effects, synthesised live with Web Audio (no audio files)', licence: ORIGINAL },
  { file: 'src/app/speech.ts', what: 'spoken lines use a browser voice only when it reports itself as local; no voice files ship', licence: 'Voices belong to the device/browser; nothing is bundled' },
  { file: 'src/ui/styles.css', what: 'fonts: the device’s own rounded system fonts; no font files ship', licence: 'Not bundled' },
];

/** Code libraries that end up in the built game (dev-only tools are listed in package.json). */
export const LIBRARIES: { name: string; version: string; licence: string }[] = [
  { name: 'phaser', version: '4.2.1', licence: 'MIT' },
];

export interface ManifestRow {
  key: string;
  file: string;
  licence: string;
}

/** One row per art key. */
export function artManifest(): ManifestRow[] {
  return ART_SOURCES.flatMap((s) => s.pieces.map((p) => ({ key: p.key, file: s.file, licence: s.licence })));
}
