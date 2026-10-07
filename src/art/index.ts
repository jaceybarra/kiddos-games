import { registerPieces } from './registry';
import { COMMON_PIECES } from './common';
import { CAST_PIECES } from './cast';

let done = false;
/** Register all authored art. Scene-specific art modules register themselves when imported. */
export function registerAllArt(): void {
  if (done) return;
  done = true;
  registerPieces(COMMON_PIECES);
  registerPieces(CAST_PIECES);
}
