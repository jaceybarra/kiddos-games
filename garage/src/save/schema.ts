import { CONTENT } from '../config/content';
import type { WheelKind } from '../config/tuning';
import { MISSIONS, MISSION_ORDER, REWARD_OF, type DiscoveryId, type MissionId, type RewardId } from '../content/missions';
import { sanitizeSlots, type Slots } from '../core/track';

/**
 * The saved record, versioned. Everything read from storage goes through
 * `readSave`, which migrates old versions, repairs what it can (unknown ids
 * are dropped, duplicates removed) and refuses what it can't.
 */
export const SAVE_VERSION = 1;

export const PAINT_IDS = ['red', 'blue', 'yellow', 'green', 'purple', 'orange'] as const;
export const PATTERN_IDS = ['plain', 'stripes', 'zigzag', 'dots', 'stars', 'checks'] as const;
export const DECAL_IDS = ['none', 'bolt', 'star', 'paw', 'leaf', 'b'] as const;
export type PaintId = (typeof PAINT_IDS)[number];
export type PatternId = (typeof PATTERN_IDS)[number];
export type DecalId = (typeof DECAL_IDS)[number];

export const REWARD_IDS: RewardId[] = ['pennant', 'twin-ramp', 'crew-banner'];
export const DISCOVERY_IDS: DiscoveryId[] = ['golden-acorn', 'pinwheel', 'rally-ribbon'];
export const COIN_IDS: string[] = MISSIONS.flatMap((m) => m.coins.map((c) => c.id));

export interface TruckLook {
  paint: PaintId;
  pattern: PatternId;
  decal: DecalId;
  wheel: WheelKind;
}

export interface Settings {
  /** shown on the garage sign; local only */
  childName: string;
  /** 'system' follows the device's Reduce Motion setting */
  motion: 'system' | 'reduced' | 'full';
  /** calmer celebrations, fewer particles */
  lowIntensity: boolean;
  jumpSide: 'left' | 'right';
  slowDriving: boolean;
  /** wider jump timing from the start and examples sooner */
  moreHelp: boolean;
  /** 0 = off; a gentle picture appears at the end of a mission after this long */
  reminderMinutes: number;
  /** open every mission and My Tiny Track without playing in order */
  openAll: boolean;
  /** local frame-rate meter for grown-ups; nothing leaves the device */
  diagnostics: boolean;
}

export interface SavedTrack {
  slots: Slots;
  savedAt: number;
}

export interface SaveData {
  version: typeof SAVE_VERSION;
  progress: {
    completed: MissionId[];
    rewards: RewardId[];
    discoveries: DiscoveryId[];
    /** unique coin ids (a coin counts once, forever) */
    coins: string[];
    /** has the garage door ever been opened (first launch goes straight to mission 1) */
    started: boolean;
  };
  truck: TruckLook;
  settings: Settings;
  /** three save slots for My Tiny Track */
  tracks: (SavedTrack | null)[];
  savedAt: number;
}

export function defaultSettings(): Settings {
  return {
    childName: CONTENT.childName,
    motion: 'system',
    lowIntensity: false,
    jumpSide: CONTENT.jumpSide,
    slowDriving: false,
    moreHelp: CONTENT.startingAssist === 'more',
    reminderMinutes: CONTENT.reminderMinutes,
    openAll: false,
    diagnostics: false,
  };
}

export function defaultSave(): SaveData {
  return {
    version: SAVE_VERSION,
    progress: { completed: [], rewards: [], discoveries: [], coins: [], started: false },
    truck: { paint: 'red', pattern: 'plain', decal: 'star', wheel: 'chunky' },
    settings: defaultSettings(),
    tracks: [null, null, null],
    savedAt: 0,
  };
}

// ---------------------------------------------------------------- migrations

type Raw = Record<string, unknown>;

/**
 * Older formats → newer, one step at a time. Version 1 is the first released
 * format. Version 0 is the unversioned shape used before saves were
 * versioned (a flat record); it stays here so the migration path is tested.
 */
const MIGRATIONS: Record<number, (r: Raw) => Raw> = {
  0: (r) => ({
    version: 1,
    progress: {
      completed: r.completed,
      rewards: r.rewards,
      discoveries: [],
      coins: r.coins,
      started: Array.isArray(r.completed) && r.completed.length > 0,
    },
    truck: r.truck,
    settings: { childName: r.childName },
    tracks: [null, null, null],
    savedAt: r.savedAt,
  }),
};

export type ReadResult = { ok: true; data: SaveData; repaired: boolean } | { ok: false; reason: 'empty' | 'not-a-save' | 'newer-version' | 'unreadable' };

function isObj(v: unknown): v is Raw {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function idList<T extends string>(v: unknown, allowed: readonly T[], note: () => void): T[] {
  if (!Array.isArray(v)) {
    if (v !== undefined) note();
    return [];
  }
  const out: T[] = [];
  for (const x of v) {
    if (typeof x === 'string' && (allowed as readonly string[]).includes(x) && !out.includes(x as T)) out.push(x as T);
    else note();
  }
  return out;
}

function pick<T extends string>(v: unknown, allowed: readonly T[], fallback: T, note: () => void): T {
  if (typeof v === 'string' && (allowed as readonly string[]).includes(v)) return v as T;
  if (v !== undefined) note();
  return fallback;
}

function bool(v: unknown, fallback: boolean, note: () => void): boolean {
  if (typeof v === 'boolean') return v;
  if (v !== undefined) note();
  return fallback;
}

/** A name for the sign: letters, spaces, a few marks, at most 16 characters. */
export function cleanName(v: unknown): string {
  if (typeof v !== 'string') return CONTENT.childName;
  const s = v.replace(/[^\p{L}\p{M}' .-]/gu, '').trim().slice(0, 16);
  return s || CONTENT.childName;
}

/** Migrate, validate and repair a stored record. Never throws. */
export function readSave(raw: unknown): ReadResult {
  try {
    if (raw === undefined || raw === null) return { ok: false, reason: 'empty' };
    if (!isObj(raw)) return { ok: false, reason: 'not-a-save' };
    let r = raw;
    let version = typeof r.version === 'number' ? r.version : 0;
    if (version > SAVE_VERSION) return { ok: false, reason: 'newer-version' };
    let repaired = false;
    while (version < SAVE_VERSION) {
      const step = MIGRATIONS[version];
      if (!step) return { ok: false, reason: 'unreadable' };
      r = step(r);
      version = typeof r.version === 'number' ? r.version : version + 1;
    }
    if (!isObj(r.progress) || !isObj(r.truck)) return { ok: false, reason: 'not-a-save' };
    const note = () => {
      repaired = true;
    };
    const d = defaultSave();
    const p = r.progress;
    const t = r.truck;
    const s = isObj(r.settings) ? r.settings : {};
    if (!isObj(r.settings)) note();
    const completed = idList(p.completed, MISSION_ORDER, note);
    const data: SaveData = {
      version: SAVE_VERSION,
      progress: {
        // keep the story order
        completed: MISSION_ORDER.filter((m) => completed.includes(m)),
        rewards: idList(p.rewards, REWARD_IDS, note),
        discoveries: idList(p.discoveries, DISCOVERY_IDS, note),
        coins: idList(p.coins, COIN_IDS, note),
        started: bool(p.started, completed.length > 0, note),
      },
      truck: {
        paint: pick(t.paint, PAINT_IDS, d.truck.paint, note),
        pattern: pick(t.pattern, PATTERN_IDS, d.truck.pattern, note),
        decal: pick(t.decal, DECAL_IDS, d.truck.decal, note),
        wheel: pick(t.wheel, ['chunky', 'spring'] as const, d.truck.wheel, note),
      },
      settings: {
        childName: s.childName === undefined ? d.settings.childName : cleanName(s.childName),
        motion: pick(s.motion, ['system', 'reduced', 'full'] as const, d.settings.motion, note),
        lowIntensity: bool(s.lowIntensity, d.settings.lowIntensity, note),
        jumpSide: pick(s.jumpSide, ['left', 'right'] as const, d.settings.jumpSide, note),
        slowDriving: bool(s.slowDriving, d.settings.slowDriving, note),
        moreHelp: bool(s.moreHelp, d.settings.moreHelp, note),
        reminderMinutes:
          typeof s.reminderMinutes === 'number' && [0, 10, 15, 20, 30, 45].includes(s.reminderMinutes) ? s.reminderMinutes : (s.reminderMinutes !== undefined && note(), d.settings.reminderMinutes),
        openAll: bool(s.openAll, d.settings.openAll, note),
        diagnostics: bool(s.diagnostics, d.settings.diagnostics, note),
      },
      tracks: [0, 1, 2].map((i) => {
        const list = Array.isArray(r.tracks) ? r.tracks : [];
        const tr = list[i];
        if (tr === null || tr === undefined) return null;
        if (!isObj(tr)) {
          note();
          return null;
        }
        const { slots, corrected } = sanitizeSlots(tr.slots);
        if (corrected) note();
        return { slots, savedAt: typeof tr.savedAt === 'number' ? tr.savedAt : 0 };
      }),
      savedAt: typeof r.savedAt === 'number' ? r.savedAt : 0,
    };
    // rewards follow completed missions (a reward without its mission is dropped)
    const allowedRewards = data.progress.completed.map((m) => REWARD_OF[m]);
    const rewards = data.progress.rewards.filter((x) => allowedRewards.includes(x));
    if (rewards.length !== data.progress.rewards.length) note();
    data.progress.rewards = rewards;
    return { ok: true, data, repaired };
  } catch {
    return { ok: false, reason: 'unreadable' };
  }
}
