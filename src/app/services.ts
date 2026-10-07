import type Phaser from 'phaser';
import type { SaveManager } from '../save/SaveManager';
import type { Layers } from '../ui/shell';
import type { Hud } from '../ui/hud';
import type { Captions } from '../ui/captions';
import type { Choices } from '../ui/choices';
import type { GameId, PresetId, Profile } from '../save/schema';
import { presetFor } from '../save/schema';

/**
 * Shared app services. Filled in once at boot (see app/App.ts) so scenes and
 * UI modules can reach them without import cycles.
 */
export interface Services {
  save: SaveManager;
  layers: Layers;
  hud: Hud;
  captions: Captions;
  choices: Choices;
  game: Phaser.Game;
  profileId: string | null;
  /** navigation entry points provided by the App */
  nav: {
    goTo(scene: string, data?: Record<string, unknown>): void;
    finish(): void;
    openMap(): void;
  };
  /** things made or completed this session (for the closing sequence) */
  session: { made: { kind: string; label: string; art?: string }[]; startedAt: number };
}

export const services = {} as Services;

export function currentProfile(): Profile {
  const id = services.profileId;
  const p = id ? services.save.getProfile(id) : undefined;
  if (!p) throw new Error('No active profile');
  return p;
}

export function currentPreset(game: GameId): PresetId {
  return presetFor(currentProfile(), game);
}

export function updateProfile(fn: (p: Profile) => void): void {
  if (services.profileId) services.save.updateProfile(services.profileId, fn);
}
