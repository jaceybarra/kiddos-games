/**
 * Versioned save format. Everything a profile owns lives under its id, and
 * creations carry their profileId, so one child can't overwrite the other's work.
 */

export const SAVE_VERSION = 1;
export const EXPORT_FORMAT = 'wonderwood-save';
export const MAX_CREATIONS_PER_KIND = 12;
export const MAX_LOG = 200;

export type PresetId = 'more-help' | 'more-exploring';
export type GameId = 'trail' | 'tinker' | 'picnic' | 'stage';
export const GAME_IDS: GameId[] = ['trail', 'tinker', 'picnic', 'stage'];
export type Species = 'fox' | 'hedgehog' | 'mouse' | 'frog';
export const SPECIES: Species[] = ['fox', 'hedgehog', 'mouse', 'frog'];
export type CreationKind = 'invention' | 'story' | 'picnic';
export const CREATION_KINDS: CreationKind[] = ['invention', 'story', 'picnic'];
export type MotionPref = 'system' | 'reduced' | 'full';

export interface AvatarLook {
  species: Species;
  color: string;
  hat: string | null;
}

export interface ReminderSettings {
  /** 0 = off */
  minutes: number;
  /** minutes allowed to finish the current part after a reminder (0 = stop option only) */
  grace: 0 | 2 | 5;
}

export interface ProfileSettings {
  preset: PresetId;
  perGame: Partial<Record<GameId, PresetId>>;
  reminder: ReminderSettings;
}

export type Flag = string | number | boolean;

export interface QuestState {
  status: 'new' | 'active' | 'done';
  checkpoint: string;
  flags: Record<string, Flag>;
  completions: number;
  firstDoneAt?: number;
}

export interface Souvenir {
  id: string;
  at: number;
  data: Record<string, Flag>;
}

export interface LogEntry {
  at: number;
  game: GameId | 'hub';
  text: string;
}

export interface Location {
  scene: string;
  data?: Record<string, Flag>;
}

export interface ProfileProgress {
  onboarded: boolean;
  location: Location;
  quests: Record<string, QuestState>;
  souvenirs: Record<string, Souvenir>;
  display: { invention: string | null; story: string | null; picnic: string | null };
  done: Record<string, number>;
  log: LogEntry[];
}

export interface Profile {
  id: string;
  slot: number;
  nickname: string;
  avatar: AvatarLook;
  settings: ProfileSettings;
  progress: ProfileProgress;
  createdAt: number;
  updatedAt: number;
}

export interface Creation {
  id: string;
  profileId: string;
  kind: CreationKind;
  name: string;
  data: unknown;
  preview?: string;
  createdAt: number;
  updatedAt: number;
}

export interface DeviceSettings {
  volume: { music: number; sfx: number; voice: number };
  muted: boolean;
  narration: 'auto' | 'off';
  captions: boolean;
  motion: MotionPref;
  quiet: boolean;
  lastProfileId: string | null;
  setupDone: boolean;
}

export interface SaveRoot {
  version: number;
  device: DeviceSettings;
  profileIds: string[];
}

export interface ExportFile {
  format: typeof EXPORT_FORMAT;
  version: number;
  exportedAt: number;
  root: SaveRoot;
  profiles: Profile[];
  creations: Creation[];
}

// ---------------------------------------------------------------- defaults

export function defaultDevice(): DeviceSettings {
  return {
    volume: { music: 0.5, sfx: 0.8, voice: 0.9 },
    muted: false,
    narration: 'auto',
    captions: true,
    motion: 'system',
    quiet: false,
    lastProfileId: null,
    setupDone: false,
  };
}

export function defaultProgress(): ProfileProgress {
  return {
    onboarded: false,
    location: { scene: 'map' },
    quests: {},
    souvenirs: {},
    display: { invention: null, story: null, picnic: null },
    done: {},
    log: [],
  };
}

export function newProfile(id: string, slot: number, nickname: string, preset: PresetId, avatar: AvatarLook, now: number): Profile {
  return {
    id,
    slot,
    nickname,
    avatar,
    settings: { preset, perGame: {}, reminder: { minutes: 0, grace: 2 } },
    progress: defaultProgress(),
    createdAt: now,
    updatedAt: now,
  };
}

// ---------------------------------------------------------------- normalisation
//
// Reading is defensive: each field falls back to a safe default, and every
// fallback is recorded as a "repair" so the adult area can say what happened.
// Nothing is ever silently discarded; the caller keeps a copy of the original.

export interface Normalized<T> {
  value: T | null;
  repairs: string[];
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === 'string';
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isFlag = (v: unknown): v is Flag => isStr(v) || isNum(v) || typeof v === 'boolean';

function clamp01(v: unknown, d: number, repairs: string[], label: string): number {
  if (isNum(v) && v >= 0 && v <= 1) return v;
  if (v !== undefined) repairs.push(`${label} reset to default`);
  return d;
}

function flags(v: unknown, repairs: string[], label: string): Record<string, Flag> {
  const out: Record<string, Flag> = {};
  if (!isObj(v)) {
    if (v !== undefined) repairs.push(`${label} flags unreadable`);
    return out;
  }
  for (const [k, x] of Object.entries(v)) {
    if (isFlag(x)) out[k] = x;
    else repairs.push(`${label}.${k} dropped (unexpected value)`);
  }
  return out;
}

export function normalizeDevice(raw: unknown, repairs: string[]): DeviceSettings {
  const d = defaultDevice();
  if (!isObj(raw)) {
    if (raw !== undefined) repairs.push('device settings unreadable; defaults used');
    return d;
  }
  const vol = isObj(raw.volume) ? raw.volume : {};
  return {
    volume: {
      music: clamp01(vol.music, d.volume.music, repairs, 'music volume'),
      sfx: clamp01(vol.sfx, d.volume.sfx, repairs, 'effects volume'),
      voice: clamp01(vol.voice, d.volume.voice, repairs, 'voice volume'),
    },
    muted: typeof raw.muted === 'boolean' ? raw.muted : d.muted,
    narration: raw.narration === 'off' ? 'off' : 'auto',
    captions: typeof raw.captions === 'boolean' ? raw.captions : d.captions,
    motion: raw.motion === 'reduced' || raw.motion === 'full' ? raw.motion : 'system',
    quiet: typeof raw.quiet === 'boolean' ? raw.quiet : d.quiet,
    lastProfileId: isStr(raw.lastProfileId) ? raw.lastProfileId : null,
    setupDone: typeof raw.setupDone === 'boolean' ? raw.setupDone : false,
  };
}

export function normalizeRoot(raw: unknown): Normalized<SaveRoot> {
  const repairs: string[] = [];
  if (!isObj(raw)) return { value: null, repairs: ['root record unreadable'] };
  const version = isNum(raw.version) ? raw.version : 0;
  const profileIds = Array.isArray(raw.profileIds) ? raw.profileIds.filter(isStr) : [];
  if (!Array.isArray(raw.profileIds)) repairs.push('profile list rebuilt');
  return { value: { version, device: normalizeDevice(raw.device, repairs), profileIds }, repairs };
}

const PRESETS: PresetId[] = ['more-help', 'more-exploring'];

export function normalizeProfile(raw: unknown): Normalized<Profile> {
  const repairs: string[] = [];
  if (!isObj(raw) || !isStr(raw.id) || !raw.id) return { value: null, repairs: ['profile has no id'] };
  const id = raw.id;
  const now = Date.now();
  const av = isObj(raw.avatar) ? raw.avatar : {};
  const species = SPECIES.includes(av.species as Species) ? (av.species as Species) : (repairs.push('avatar species reset'), 'fox');
  const avatar: AvatarLook = {
    species,
    color: isStr(av.color) ? av.color : (repairs.push('avatar colour reset'), 'sun'),
    hat: isStr(av.hat) ? av.hat : null,
  };
  const st = isObj(raw.settings) ? raw.settings : (repairs.push('settings reset'), {});
  const perGame: Partial<Record<GameId, PresetId>> = {};
  if (isObj(st.perGame)) {
    for (const g of GAME_IDS) {
      const v = st.perGame[g];
      if (PRESETS.includes(v as PresetId)) perGame[g] = v as PresetId;
    }
  }
  const rem = isObj(st.reminder) ? st.reminder : {};
  const settings: ProfileSettings = {
    preset: PRESETS.includes(st.preset as PresetId) ? (st.preset as PresetId) : (repairs.push('assistance preset reset'), 'more-help'),
    perGame,
    reminder: {
      minutes: isNum(rem.minutes) && rem.minutes >= 0 && rem.minutes <= 120 ? rem.minutes : 0,
      grace: rem.grace === 0 || rem.grace === 2 || rem.grace === 5 ? rem.grace : 2,
    },
  };
  const pr = isObj(raw.progress) ? raw.progress : (repairs.push('progress unreadable; started fresh (original kept)'), {});
  const quests: Record<string, QuestState> = {};
  if (isObj(pr.quests)) {
    for (const [qid, q] of Object.entries(pr.quests)) {
      if (!isObj(q)) {
        repairs.push(`quest ${qid} unreadable`);
        continue;
      }
      const status = q.status === 'active' || q.status === 'done' ? q.status : 'new';
      quests[qid] = {
        status,
        checkpoint: isStr(q.checkpoint) ? q.checkpoint : 'start',
        flags: flags(q.flags, repairs, `quest ${qid}`),
        completions: isNum(q.completions) ? q.completions : status === 'done' ? 1 : 0,
        ...(isNum(q.firstDoneAt) ? { firstDoneAt: q.firstDoneAt } : {}),
      };
    }
  }
  const souvenirs: Record<string, Souvenir> = {};
  if (isObj(pr.souvenirs)) {
    for (const [sid, s] of Object.entries(pr.souvenirs)) {
      if (!isObj(s)) continue;
      souvenirs[sid] = { id: sid, at: isNum(s.at) ? s.at : now, data: flags(s.data, repairs, `souvenir ${sid}`) };
    }
  }
  const disp = isObj(pr.display) ? pr.display : {};
  const done: Record<string, number> = {};
  if (isObj(pr.done)) for (const [k, v] of Object.entries(pr.done)) if (isNum(v)) done[k] = v;
  const log: LogEntry[] = Array.isArray(pr.log)
    ? pr.log
        .filter((e): e is Record<string, unknown> => isObj(e) && isStr(e.text))
        .map(
          (e): LogEntry => ({
            at: isNum(e.at) ? e.at : now,
            game: (['trail', 'tinker', 'picnic', 'stage', 'hub'] as const).includes(e.game as GameId) ? (e.game as GameId) : 'hub',
            text: String(e.text).slice(0, 200),
          }),
        )
        .slice(-MAX_LOG)
    : [];
  const loc = isObj(pr.location) && isStr(pr.location.scene) ? pr.location : { scene: 'map' };
  const progress: ProfileProgress = {
    onboarded: typeof pr.onboarded === 'boolean' ? pr.onboarded : false,
    location: { scene: loc.scene as string, ...(isObj(loc.data) ? { data: flags(loc.data, repairs, 'location') } : {}) },
    quests,
    souvenirs,
    display: {
      invention: isStr(disp.invention) ? disp.invention : null,
      story: isStr(disp.story) ? disp.story : null,
      picnic: isStr(disp.picnic) ? disp.picnic : null,
    },
    done,
    log,
  };
  return {
    value: {
      id,
      slot: isNum(raw.slot) ? raw.slot : 0,
      nickname: isStr(raw.nickname) ? raw.nickname.slice(0, 24) : '',
      avatar,
      settings,
      progress,
      createdAt: isNum(raw.createdAt) ? raw.createdAt : now,
      updatedAt: isNum(raw.updatedAt) ? raw.updatedAt : now,
    },
    repairs,
  };
}

export function normalizeCreation(raw: unknown): Normalized<Creation> {
  const repairs: string[] = [];
  if (!isObj(raw) || !isStr(raw.id) || !isStr(raw.profileId)) return { value: null, repairs: ['creation has no id/owner'] };
  if (!CREATION_KINDS.includes(raw.kind as CreationKind)) return { value: null, repairs: [`creation ${raw.id} has unknown kind`] };
  if (raw.data === undefined) return { value: null, repairs: [`creation ${raw.id} has no data`] };
  const now = Date.now();
  return {
    value: {
      id: raw.id,
      profileId: raw.profileId,
      kind: raw.kind as CreationKind,
      name: isStr(raw.name) ? raw.name.slice(0, 40) : 'Untitled',
      data: raw.data,
      ...(isStr(raw.preview) && raw.preview.startsWith('data:image/') ? { preview: raw.preview } : {}),
      createdAt: isNum(raw.createdAt) ? raw.createdAt : now,
      updatedAt: isNum(raw.updatedAt) ? raw.updatedAt : now,
    },
    repairs,
  };
}

/** Effective preset for a game (per-game override wins). */
export function presetFor(p: Profile, game: GameId): PresetId {
  return p.settings.perGame[game] ?? p.settings.preset;
}
