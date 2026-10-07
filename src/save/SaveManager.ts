import { type Backend, type QuarantineEntry, isQuotaError } from './backends';
import { migrateBundle } from './migrate';
import {
  type AvatarLook,
  type Creation,
  type CreationKind,
  type DeviceSettings,
  type ExportFile,
  type GameId,
  type PresetId,
  type Profile,
  type SaveRoot,
  EXPORT_FORMAT,
  MAX_CREATIONS_PER_KIND,
  MAX_LOG,
  SAVE_VERSION,
  defaultDevice,
  defaultProgress,
  newProfile,
  normalizeCreation,
  normalizeDevice,
  normalizeProfile,
  normalizeRoot,
} from './schema';

export interface SaveStatus {
  backend: Backend['kind'];
  /** true when the stored save is from a newer app version: we never overwrite it */
  readOnly: boolean;
  quotaFull: boolean;
  lastError: string | null;
  /** plain-language notes for the adult area (repairs, quarantined records…) */
  notices: string[];
  pendingWrites: number;
  lastSavedAt: number | null;
}

export type SaveResult = { ok: true } | { ok: false; reason: 'full' | 'readonly' | 'error'; message?: string };

export interface ImportPreview {
  ok: true;
  file: ExportFile;
  summary: { profiles: { nickname: string; creations: number }[]; creations: number; exportedAt: number; fromVersion: number };
}
export interface ImportFailure {
  ok: false;
  errors: string[];
}

const uid = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

/**
 * Owns all persisted data. Callers mutate profiles through updateProfile();
 * writes are debounced and flushed on page hide. Every read is validated and
 * nothing is silently reset — damaged originals go to a quarantine store.
 */
export class SaveManager {
  private root: SaveRoot = { version: SAVE_VERSION, device: defaultDevice(), profileIds: [] };
  private profiles = new Map<string, Profile>();
  private creations = new Map<string, Creation>();
  private dirtyProfiles = new Set<string>();
  private dirtyRoot = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private listeners = new Set<(s: SaveStatus) => void>();
  private writing: Promise<void> = Promise.resolve();
  readonly status: SaveStatus;
  now: () => number = () => Date.now();
  debounceMs = 400;

  constructor(private backend: Backend) {
    this.status = { backend: backend.kind, readOnly: false, quotaFull: false, lastError: null, notices: [], pendingWrites: 0, lastSavedAt: null };
    if (backend.kind === 'memory') {
      this.status.notices.push('This browser is not letting Wonderwood save to the device, so progress lasts only until the page is closed. Use "Export saves" to keep work.');
    }
  }

  // ---------------------------------------------------------------- loading

  async init(): Promise<void> {
    let rawRoot: unknown;
    let rawProfiles: unknown[] = [];
    let rawCreations: unknown[] = [];
    try {
      rawRoot = await this.backend.getRoot();
      rawProfiles = await this.backend.getAll('profiles');
      rawCreations = await this.backend.getAll('creations');
    } catch (e) {
      this.status.lastError = `Could not read saves: ${(e as Error).message}`;
      this.status.readOnly = true;
      this.status.notices.push('Saved games could not be read right now. Nothing has been changed. Try reloading; if this keeps happening, export from another browser profile.');
      this.emit();
      return;
    }
    if (rawRoot === undefined && rawProfiles.length === 0 && rawCreations.length === 0) {
      this.root = { version: SAVE_VERSION, device: defaultDevice(), profileIds: [] };
      return;
    }
    const rootObj = (typeof rawRoot === 'object' && rawRoot !== null ? rawRoot : {}) as Record<string, unknown>;
    const mig = migrateBundle({ root: rootObj, profiles: rawProfiles, creations: rawCreations });
    if (!mig.ok) {
      this.status.readOnly = true;
      this.status.notices.push(`${mig.message} To protect it, this copy of the game will not change your saves.`);
      // still show what we can read so children aren't locked out entirely
      this.loadNormalized(rootObj, rawProfiles, rawCreations, false);
      this.emit();
      return;
    }
    if (mig.migrated) {
      await this.quarantine('all', 'pre-migration', `Backup made before updating saves from format ${mig.from}`, {
        root: rawRoot,
        profiles: rawProfiles,
        creations: rawCreations,
      });
      this.status.notices.push(`Saves were updated from an older format (${mig.from} → ${SAVE_VERSION}). A backup of the old data was kept.`);
    }
    await this.loadNormalized(mig.bundle.root, mig.bundle.profiles, mig.bundle.creations, mig.migrated);
    this.emit();
  }

  private async loadNormalized(rootRaw: unknown, profs: unknown[], crs: unknown[], persistAll: boolean): Promise<void> {
    const r = normalizeRoot(rootRaw);
    const root = r.value ?? { version: SAVE_VERSION, device: defaultDevice(), profileIds: [] };
    root.version = SAVE_VERSION;
    if (r.repairs.length) this.status.notices.push(`Settings: ${r.repairs.join('; ')}.`);
    for (const raw of profs) {
      const n = normalizeProfile(raw);
      const key = String((raw as { id?: unknown })?.id ?? 'unknown');
      if (!n.value) {
        await this.quarantine('profiles', key, n.repairs.join('; '), raw);
        this.status.notices.push(`A saved profile could not be read and was set aside safely (export includes it). Reason: ${n.repairs.join('; ')}.`);
        continue;
      }
      if (n.repairs.length) {
        await this.quarantine('profiles', key, `repaired: ${n.repairs.join('; ')}`, raw);
        this.status.notices.push(`Profile "${n.value.nickname || 'unnamed'}" had damaged details that were repaired (${n.repairs.join('; ')}). The original was kept.`);
        this.dirtyProfiles.add(n.value.id);
      }
      if (persistAll) this.dirtyProfiles.add(n.value.id);
      this.profiles.set(n.value.id, n.value);
    }
    for (const raw of crs) {
      const n = normalizeCreation(raw);
      const key = String((raw as { id?: unknown })?.id ?? 'unknown');
      if (!n.value || !this.profiles.has(n.value.profileId)) {
        await this.quarantine('creations', key, n.value ? 'owner profile missing' : n.repairs.join('; '), raw);
        this.status.notices.push('A saved creation could not be matched to a profile and was set aside safely.');
        continue;
      }
      this.creations.set(n.value.id, n.value);
      if (persistAll) void this.persistCreation(n.value);
    }
    // keep every profile we found, even if the root's list was stale
    const ids = new Set(root.profileIds.filter((id) => this.profiles.has(id)));
    for (const id of this.profiles.keys()) ids.add(id);
    if (ids.size !== root.profileIds.length) this.dirtyRoot = true;
    root.profileIds = [...ids];
    this.root = root;
    if (persistAll) this.dirtyRoot = true;
    if (this.dirtyRoot || this.dirtyProfiles.size) this.schedule();
  }

  private async quarantine(store: string, key: string, reason: string, raw: unknown): Promise<void> {
    const e: QuarantineEntry = { at: this.now(), store, key, reason, raw };
    try {
      await this.backend.addQuarantine(e);
    } catch {
      /* if even this fails, the original is still untouched in its store */
    }
  }

  // ---------------------------------------------------------------- status

  onStatus(cb: (s: SaveStatus) => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  private emit(): void {
    this.status.pendingWrites = this.dirtyProfiles.size + (this.dirtyRoot ? 1 : 0);
    for (const l of this.listeners) l(this.status);
  }

  // ---------------------------------------------------------------- device

  get device(): DeviceSettings {
    return this.root.device;
  }

  updateDevice(fn: (d: DeviceSettings) => void): void {
    fn(this.root.device);
    this.root.device = normalizeDevice(this.root.device, []);
    this.dirtyRoot = true;
    this.schedule();
  }

  // ---------------------------------------------------------------- profiles

  listProfiles(): Profile[] {
    return this.root.profileIds
      .map((id) => this.profiles.get(id))
      .filter((p): p is Profile => !!p)
      .sort((a, b) => a.slot - b.slot);
  }

  getProfile(id: string): Profile | undefined {
    return this.profiles.get(id);
  }

  createProfile(opts: { nickname: string; preset: PresetId; avatar: AvatarLook }): Profile {
    const slot = this.listProfiles().reduce((m, p) => Math.max(m, p.slot + 1), 0);
    const p = newProfile(uid(), slot, opts.nickname.trim().slice(0, 24), opts.preset, opts.avatar, this.now());
    this.profiles.set(p.id, p);
    this.root.profileIds.push(p.id);
    this.dirtyRoot = true;
    this.dirtyProfiles.add(p.id);
    this.schedule();
    return p;
  }

  /** Mutate a profile in place; the change is saved shortly after. */
  updateProfile(id: string, fn: (p: Profile) => void): Profile | undefined {
    const p = this.profiles.get(id);
    if (!p) return undefined;
    fn(p);
    p.updatedAt = this.now();
    if (p.progress.log.length > MAX_LOG) p.progress.log.splice(0, p.progress.log.length - MAX_LOG);
    this.dirtyProfiles.add(id);
    this.schedule();
    return p;
  }

  /** Factual activity note for the adult area ("Completed The Windmill Kite"). */
  log(id: string, game: GameId | 'hub', text: string): void {
    this.updateProfile(id, (p) => p.progress.log.push({ at: this.now(), game, text }));
  }

  /** Reset progress and creations for one profile (nickname/avatar/settings kept). A backup is kept. */
  async resetProfile(id: string): Promise<SaveResult> {
    if (this.status.readOnly) return { ok: false, reason: 'readonly' };
    const p = this.profiles.get(id);
    if (!p) return { ok: false, reason: 'error', message: 'No such profile' };
    const mine = this.listCreations(id);
    await this.quarantine('profiles', id, 'backup before profile reset', { profile: structuredClone(p), creations: structuredClone(mine) });
    p.progress = defaultProgress();
    p.updatedAt = this.now();
    for (const c of mine) {
      this.creations.delete(c.id);
      try {
        await this.backend.remove('creations', c.id);
      } catch (e) {
        this.handleError(e);
      }
    }
    this.dirtyProfiles.add(id);
    await this.flush();
    return { ok: true };
  }

  // ---------------------------------------------------------------- creations

  listCreations(profileId: string, kind?: CreationKind): Creation[] {
    return [...this.creations.values()]
      .filter((c) => c.profileId === profileId && (!kind || c.kind === kind))
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }

  getCreation(id: string): Creation | undefined {
    return this.creations.get(id);
  }

  canAddCreation(profileId: string, kind: CreationKind): boolean {
    return this.listCreations(profileId, kind).length < MAX_CREATIONS_PER_KIND;
  }

  /** Create or update a creation. New ones respect the per-kind shelf limit. */
  async saveCreation(c: Omit<Creation, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): Promise<SaveResult & { id?: string }> {
    if (this.status.readOnly) return { ok: false, reason: 'readonly' };
    if (!this.profiles.has(c.profileId)) return { ok: false, reason: 'error', message: 'Unknown profile' };
    const existing = c.id ? this.creations.get(c.id) : undefined;
    if (existing && existing.profileId !== c.profileId) return { ok: false, reason: 'error', message: 'Creation belongs to another profile' };
    if (!existing && !this.canAddCreation(c.profileId, c.kind)) return { ok: false, reason: 'full' };
    const now = this.now();
    const rec: Creation = {
      id: existing?.id ?? c.id ?? uid(),
      profileId: c.profileId,
      kind: c.kind,
      name: c.name.slice(0, 40),
      data: structuredClone(c.data),
      ...(c.preview ? { preview: c.preview } : {}),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    this.creations.set(rec.id, rec);
    const ok = await this.persistCreation(rec);
    if (!ok) return { ok: false, reason: this.status.quotaFull ? 'full' : 'error', message: this.status.lastError ?? undefined, id: rec.id };
    return { ok: true, id: rec.id };
  }

  async deleteCreation(id: string, profileId: string): Promise<SaveResult> {
    if (this.status.readOnly) return { ok: false, reason: 'readonly' };
    const c = this.creations.get(id);
    if (!c || c.profileId !== profileId) return { ok: false, reason: 'error', message: 'Not found' };
    this.creations.delete(id);
    this.updateProfile(profileId, (p) => {
      const d = p.progress.display;
      if (d.invention === id) d.invention = null;
      if (d.story === id) d.story = null;
      if (d.picnic === id) d.picnic = null;
    });
    try {
      await this.backend.remove('creations', id);
      return { ok: true };
    } catch (e) {
      this.handleError(e);
      return { ok: false, reason: 'error' };
    }
  }

  private async persistCreation(c: Creation): Promise<boolean> {
    if (this.status.readOnly) return false;
    try {
      await this.backend.put('creations', c);
      this.status.lastSavedAt = this.now();
      if (this.status.quotaFull) {
        this.status.quotaFull = false;
        this.emit();
      }
      return true;
    } catch (e) {
      this.handleError(e);
      return false;
    }
  }

  // ---------------------------------------------------------------- writing

  private schedule(): void {
    if (this.status.readOnly) return;
    this.emit();
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.flush(), this.debounceMs);
  }

  /** Write everything pending now (called on pause, finish, page hide). */
  async flush(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.status.readOnly) return;
    const next = this.writing.then(() => this.writePending());
    this.writing = next.catch(() => undefined);
    return next;
  }

  private async writePending(): Promise<void> {
    const ids = [...this.dirtyProfiles];
    const root = this.dirtyRoot;
    this.dirtyProfiles.clear();
    this.dirtyRoot = false;
    let failed = false;
    for (const id of ids) {
      const p = this.profiles.get(id);
      if (!p) continue;
      try {
        await this.backend.put('profiles', p);
      } catch (e) {
        failed = true;
        this.dirtyProfiles.add(id);
        this.handleError(e);
      }
    }
    if (root) {
      try {
        await this.backend.putRoot(this.root);
      } catch (e) {
        failed = true;
        this.dirtyRoot = true;
        this.handleError(e);
      }
    }
    if (!failed && (ids.length || root)) {
      this.status.lastSavedAt = this.now();
      if (this.status.quotaFull || this.status.lastError) {
        this.status.quotaFull = false;
        this.status.lastError = null;
      }
    }
    this.emit();
  }

  private handleError(e: unknown): void {
    if (isQuotaError(e)) {
      this.status.quotaFull = true;
      this.status.lastError = 'The device storage for this browser is full. Export your saves, then free some space.';
    } else {
      this.status.lastError = `Saving failed: ${(e as Error)?.message ?? String(e)}`;
    }
    this.emit();
  }

  // ---------------------------------------------------------------- export / import

  exportFile(): ExportFile {
    return {
      format: EXPORT_FORMAT,
      version: SAVE_VERSION,
      exportedAt: this.now(),
      root: structuredClone(this.root),
      profiles: structuredClone(this.listProfiles()),
      creations: structuredClone([...this.creations.values()]),
    };
  }

  exportJSON(): string {
    return JSON.stringify(this.exportFile());
  }

  /** Validate an import without changing anything. */
  parseImport(text: string): ImportPreview | ImportFailure {
    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch {
      return { ok: false, errors: ['This file is not a Wonderwood save (it is not readable JSON).'] };
    }
    if (typeof raw !== 'object' || raw === null || (raw as { format?: unknown }).format !== EXPORT_FORMAT) {
      return { ok: false, errors: ['This file is not a Wonderwood save.'] };
    }
    const f = raw as Record<string, unknown>;
    const version = typeof f.version === 'number' ? f.version : 0;
    const mig = migrateBundle({
      root: { ...(typeof f.root === 'object' && f.root ? (f.root as Record<string, unknown>) : {}), version },
      profiles: Array.isArray(f.profiles) ? f.profiles : [],
      creations: Array.isArray(f.creations) ? f.creations : [],
    });
    if (!mig.ok) return { ok: false, errors: [mig.message] };
    const errors: string[] = [];
    const profiles: Profile[] = [];
    for (const p of mig.bundle.profiles) {
      const n = normalizeProfile(p);
      if (!n.value) errors.push(`A profile in the file is unreadable (${n.repairs.join('; ')}).`);
      else profiles.push(n.value);
    }
    const ids = new Set(profiles.map((p) => p.id));
    const creations: Creation[] = [];
    for (const c of mig.bundle.creations) {
      const n = normalizeCreation(c);
      if (!n.value) errors.push(`A creation in the file is unreadable (${n.repairs.join('; ')}).`);
      else if (!ids.has(n.value.profileId)) errors.push(`A creation in the file belongs to no profile.`);
      else creations.push(n.value);
    }
    if (!profiles.length) errors.push('The file contains no profiles.');
    if (errors.length) return { ok: false, errors };
    const r = normalizeRoot(mig.bundle.root);
    const file: ExportFile = {
      format: EXPORT_FORMAT,
      version: SAVE_VERSION,
      exportedAt: typeof f.exportedAt === 'number' ? f.exportedAt : 0,
      root: { version: SAVE_VERSION, device: r.value?.device ?? defaultDevice(), profileIds: profiles.map((p) => p.id) },
      profiles,
      creations,
    };
    return {
      ok: true,
      file,
      summary: {
        profiles: profiles.map((p) => ({ nickname: p.nickname, creations: creations.filter((c) => c.profileId === p.id).length })),
        creations: creations.length,
        exportedAt: file.exportedAt,
        fromVersion: version,
      },
    };
  }

  /**
   * Replace all saves with an imported file. The current data is backed up to
   * the quarantine store first, so an import can never silently destroy work.
   */
  async applyImport(file: ExportFile): Promise<SaveResult> {
    if (this.status.readOnly) return { ok: false, reason: 'readonly' };
    await this.quarantine('all', 'pre-import', 'Backup made before importing a save file', this.exportFile());
    try {
      for (const id of this.profiles.keys()) await this.backend.remove('profiles', id);
      for (const id of this.creations.keys()) await this.backend.remove('creations', id);
      this.profiles.clear();
      this.creations.clear();
      for (const p of file.profiles) {
        this.profiles.set(p.id, structuredClone(p));
        await this.backend.put('profiles', p);
      }
      for (const c of file.creations) {
        this.creations.set(c.id, structuredClone(c));
        await this.backend.put('creations', c);
      }
      const device = this.root.device;
      this.root = { version: SAVE_VERSION, device: { ...device, setupDone: true, lastProfileId: null }, profileIds: file.profiles.map((p) => p.id) };
      await this.backend.putRoot(this.root);
      this.status.lastSavedAt = this.now();
      this.emit();
      return { ok: true };
    } catch (e) {
      this.handleError(e);
      return { ok: false, reason: 'error', message: this.status.lastError ?? undefined };
    }
  }

  async listBackups(): Promise<QuarantineEntry[]> {
    try {
      return await this.backend.listQuarantine();
    } catch {
      return [];
    }
  }

  async clearBackups(): Promise<void> {
    await this.backend.clearQuarantine();
  }
}
