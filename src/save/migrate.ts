import { SAVE_VERSION } from './schema';

/**
 * Save migrations. Each step takes the raw bundle at version N and returns
 * version N+1. Migrations never drop unknown data; the manager keeps a backup
 * of the pre-migration records before writing anything.
 */
export interface RawBundle {
  root: Record<string, unknown>;
  profiles: unknown[];
  creations: unknown[];
}

type Step = (b: RawBundle) => RawBundle;

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * v0 → v1. "v0" is the pre-release prototype layout (profiles stored `name`,
 * a top-level `preset`, and top-level `quests`). Kept so the migration path is
 * exercised by tests before any real v2 exists.
 */
const v0to1: Step = (b) => ({
  root: { ...b.root, version: 1 },
  profiles: b.profiles.map((p) => {
    if (!isObj(p)) return p;
    const { name, preset, quests, ...rest } = p;
    const settings = isObj(rest.settings) ? rest.settings : {};
    const progress = isObj(rest.progress) ? rest.progress : {};
    return {
      ...rest,
      nickname: typeof rest.nickname === 'string' ? rest.nickname : typeof name === 'string' ? name : '',
      settings: { ...settings, preset: settings.preset ?? preset },
      progress: { ...progress, quests: progress.quests ?? quests ?? {} },
    };
  }),
  creations: b.creations,
});

const STEPS: Record<number, Step> = { 0: v0to1 };

export type MigrationResult =
  | { ok: true; bundle: RawBundle; from: number; migrated: boolean }
  | { ok: false; reason: 'newer' | 'failed'; from: number; message: string };

export function migrateBundle(b: RawBundle): MigrationResult {
  const from = typeof b.root.version === 'number' ? b.root.version : 0;
  if (from > SAVE_VERSION) {
    return { ok: false, reason: 'newer', from, message: `This save was made by a newer version of Wonderwood (format ${from}).` };
  }
  let cur = b;
  try {
    for (let v = from; v < SAVE_VERSION; v++) {
      const step = STEPS[v];
      if (!step) return { ok: false, reason: 'failed', from, message: `No migration from format ${v}.` };
      cur = step(cur);
    }
  } catch (e) {
    return { ok: false, reason: 'failed', from, message: `Migration failed: ${(e as Error).message}` };
  }
  return { ok: true, bundle: cur, from, migrated: from !== SAVE_VERSION };
}
