import type Phaser from 'phaser';
import type { DiscoveryId, MissionId, RewardId } from '../content/missions';
import type { MissionSummary } from '../core/missionState';
import type { Slots } from '../core/track';
import type { Earned } from '../save/progress';
import type { ResumePoint, SaveData, Settings } from '../save/schema';
import type { SaveStore } from '../save/store';

/**
 * The contract every scene and UI module uses to reach the app: the save,
 * settings, motion preferences, navigation and the offline state. One
 * instance, created by App at boot (see app/App.ts) and read with `app()`.
 */
export type SceneKey = 'boot' | 'garage' | 'mission' | 'creator' | 'result';

/** What to drive: an authored mission, or a track from My Tiny Track. */
export type MissionLaunch = { kind: 'mission'; missionId: MissionId; resume?: ResumePoint | null } | { kind: 'track'; slots: Slots; slot: number | null };

export interface GarageData {
  /**
   * cold: app just opened (closed door, name sign, big Play);
   * return: back from a mission or the creator (door open, interior);
   * done: the child chose Done (calm closed door, Play to start again)
   */
  entrance: 'cold' | 'return' | 'done';
  /** a reward or discovery to sparkle on the shelf (just earned) */
  highlight?: RewardId | DiscoveryId | null;
}

export interface ResultData {
  launch: MissionLaunch;
  summary: MissionSummary;
  /** what was new this time (empty on a replay) */
  earned: Earned;
  /** did the save write commit? (false: the grown-up status says so; the child sees no blame) */
  saved: boolean;
}

export interface CreatorData {
  /** came back from test-driving this layout */
  slots?: Slots;
  slot?: number | null;
  /** the test drive reached the finish */
  drove?: boolean;
}

export type SceneData = { boot: Record<string, never>; garage: GarageData; mission: MissionLaunch; creator: CreatorData; result: ResultData };

export type OfflineState =
  | { state: 'unsupported'; reason: 'no-service-worker' | 'insecure-address' | 'dev-build' }
  | { state: 'installing' }
  | { state: 'ready'; version: string; files: number }
  | { state: 'failed'; reason: string };

export interface AppContext {
  readonly game: Phaser.Game;
  readonly store: SaveStore;
  /** the current save (read-only view; change it through commit) */
  readonly save: SaveData;
  /** Save a change. Resolves true only once the write has committed. */
  commit(next: SaveData): Promise<boolean>;
  readonly settings: Settings;
  /** reduce motion: from the parent setting, or the device setting when set to follow it */
  reducedMotion(): boolean;
  lowIntensity(): boolean;
  /** start a scene (stops the others). Never call mid-transition twice: the app ignores repeats while switching. */
  go<K extends SceneKey>(key: K, data: SceneData[K]): void;
  /** minutes since the app was opened (session reminder; local only) */
  sessionMinutes(): number;
  readonly offline: OfflineState;
  /** an app update is installed and waiting; applied only at a garage/restart boundary */
  readonly updateReady: boolean;
  /** apply a waiting update now (reloads); only call at a boundary (garage entrance, Done) */
  applyUpdate(): void;
  /** the save was replaced underneath (import, start over): re-apply settings and tell listeners */
  refreshFromStore(): void;
  /** a grown-up changed a setting: re-read settings everywhere */
  onSettings(fn: () => void): () => void;
  /** pause requests from outside the scene (rotation, backgrounding, focus loss) */
  onInterrupt(fn: (why: 'hidden' | 'blur' | 'portrait' | 'modal') => void): () => void;
}

let ctx: AppContext | null = null;

export function setApp(c: AppContext): void {
  ctx = c;
}

export function app(): AppContext {
  if (!ctx) throw new Error('App not booted');
  return ctx;
}

/** Duration helper: shorter (or zero) when motion is reduced. */
export function dur(ms: number, reducedMs = 0): number {
  return ctx?.reducedMotion() ? reducedMs : ms;
}
