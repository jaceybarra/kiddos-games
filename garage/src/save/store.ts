import { defaultSave, readSave, type SaveData } from './schema';

/**
 * Where the save lives. IndexedDB on the device, with the previous good
 * record kept alongside the current one. If storage is missing (private
 * browsing, blocked) the game still plays from memory and says so to the
 * grown-up; it never claims a save worked when the write failed.
 */
export interface Backend {
  readonly kind: 'indexeddb' | 'memory';
  get(key: string): Promise<unknown>;
  /** write several keys in one transaction; resolves only once committed */
  putAll(entries: [string, unknown][]): Promise<void>;
  clear(): Promise<void>;
}

const DB = 'wonder-garage';
const STORE = 'save';

function req<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((res, rej) => {
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error ?? new Error('IndexedDB request failed'));
  });
}

export class IdbBackend implements Backend {
  readonly kind = 'indexeddb' as const;
  private constructor(private db: IDBDatabase) {}

  static async open(factory: IDBFactory = indexedDB): Promise<IdbBackend> {
    const db = await new Promise<IDBDatabase>((res, rej) => {
      const r = factory.open(DB, 1);
      r.onupgradeneeded = () => {
        if (!r.result.objectStoreNames.contains(STORE)) r.result.createObjectStore(STORE);
      };
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error ?? new Error('IndexedDB open failed'));
      r.onblocked = () => rej(new Error('IndexedDB blocked'));
    });
    return new IdbBackend(db);
  }

  async get(key: string): Promise<unknown> {
    const tx = this.db.transaction(STORE, 'readonly');
    return req(tx.objectStore(STORE).get(key));
  }

  putAll(entries: [string, unknown][]): Promise<void> {
    return new Promise((res, rej) => {
      let tx: IDBTransaction;
      try {
        tx = this.db.transaction(STORE, 'readwrite');
        const st = tx.objectStore(STORE);
        for (const [k, v] of entries) st.put(v, k);
      } catch (e) {
        rej(e);
        return;
      }
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error ?? new Error('IndexedDB write failed'));
      tx.onabort = () => rej(tx.error ?? new Error('IndexedDB write aborted'));
    });
  }

  clear(): Promise<void> {
    return new Promise((res, rej) => {
      const tx = this.db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).clear();
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
  }
}

export class MemoryBackend implements Backend {
  readonly kind = 'memory' as const;
  readonly map = new Map<string, unknown>();
  /** tests: make the next writes fail like a full disk */
  failWrites = false;
  async get(key: string): Promise<unknown> {
    const v = this.map.get(key);
    return v === undefined ? undefined : JSON.parse(JSON.stringify(v));
  }
  async putAll(entries: [string, unknown][]): Promise<void> {
    if (this.failWrites) {
      const e = new Error('The quota has been exceeded.');
      e.name = 'QuotaExceededError';
      throw e;
    }
    for (const [k, v] of entries) this.map.set(k, JSON.parse(JSON.stringify(v)));
  }
  async clear(): Promise<void> {
    this.map.clear();
  }
}

export interface SaveStatus {
  /** where saves go: on the device, or only in memory until the page closes */
  where: 'device' | 'memory-only';
  /** what happened on load */
  loaded: 'fresh' | 'current' | 'previous' | 'repaired';
  /** the last write: 'ok', 'failed' (with a reason), or none yet */
  lastWrite: 'none' | 'ok' | 'failed';
  lastError: string | null;
  /** an unreadable record was set aside (kept, not deleted) */
  setAside: boolean;
}

export class SaveStore {
  data: SaveData;
  readonly status: SaveStatus;
  private chain: Promise<unknown> = Promise.resolve();
  private listeners: (() => void)[] = [];

  private constructor(
    private backend: Backend,
    data: SaveData,
    status: SaveStatus,
  ) {
    this.data = data;
    this.status = status;
  }

  /** Open storage and load the best record available. Never throws. */
  static async open(backend?: Backend): Promise<SaveStore> {
    let b: Backend | undefined = backend;
    if (!b) {
      try {
        if (typeof indexedDB === 'undefined') throw new Error('no IndexedDB');
        b = await IdbBackend.open();
      } catch (e) {
        b = new MemoryBackend();
        const store = new SaveStore(b, defaultSave(), { where: 'memory-only', loaded: 'fresh', lastWrite: 'none', lastError: String((e as Error)?.message ?? e), setAside: false });
        return store;
      }
    }
    const status: SaveStatus = { where: b.kind === 'memory' && !backend ? 'memory-only' : 'device', loaded: 'fresh', lastWrite: 'none', lastError: null, setAside: false };
    let data = defaultSave();
    try {
      const cur = readSave(await b.get('current'));
      if (cur.ok) {
        data = cur.data;
        status.loaded = cur.repaired ? 'repaired' : 'current';
      } else {
        if (cur.reason !== 'empty') {
          // keep the unreadable record where a grown-up can export it
          const raw = await b.get('current');
          await b.putAll([['set-aside', { at: Date.now(), reason: cur.reason, raw }]]).catch(() => undefined);
          status.setAside = true;
        }
        const prev = readSave(await b.get('previous'));
        if (prev.ok) {
          data = prev.data;
          status.loaded = 'previous';
        }
      }
    } catch (e) {
      status.lastError = String((e as Error)?.message ?? e);
    }
    return new SaveStore(b, data, status);
  }

  onChange(fn: () => void): void {
    this.listeners.push(fn);
  }

  private emit(): void {
    for (const l of this.listeners) l();
  }

  /**
   * Save a new record. The previous good record is kept as a fallback in the
   * same transaction. Resolves true only after the write has committed; on a
   * failure the status says so and the in-memory game keeps going.
   */
  save(next: SaveData): Promise<boolean> {
    const record: SaveData = { ...next, savedAt: Date.now() };
    this.data = record;
    const job = this.chain.then(async () => {
      try {
        const prevRaw = await this.backend.get('current');
        const prev = readSave(prevRaw);
        const entries: [string, unknown][] = [['current', record]];
        if (prev.ok) entries.push(['previous', prev.data]);
        await this.backend.putAll(entries);
        this.status.lastWrite = 'ok';
        this.status.lastError = null;
        this.emit();
        return true;
      } catch (e) {
        const err = e as Error;
        this.status.lastWrite = 'failed';
        this.status.lastError = err?.name === 'QuotaExceededError' ? 'Storage is full' : String(err?.message ?? e);
        this.emit();
        return false;
      }
    });
    this.chain = job;
    return job;
  }

  /** Wait for pending writes (tests, and before reloading for an update). */
  flush(): Promise<unknown> {
    return this.chain;
  }

  exportJson(): string {
    return JSON.stringify({ app: 'wonder-garage', exportedAt: new Date().toISOString(), save: this.data }, null, 2);
  }

  /** Read a file a grown-up picked. Nothing changes unless the whole file is valid. */
  async importJson(text: string): Promise<{ ok: true; repaired: boolean } | { ok: false; reason: string }> {
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      return { ok: false, reason: 'This file is not a Wonder Garage save.' };
    }
    const body = typeof parsed === 'object' && parsed !== null && 'save' in parsed ? (parsed as { save: unknown }).save : parsed;
    if (typeof parsed === 'object' && parsed !== null && 'app' in parsed && (parsed as { app: unknown }).app !== 'wonder-garage') {
      return { ok: false, reason: 'This file is from a different app.' };
    }
    const r = readSave(body);
    if (!r.ok) return { ok: false, reason: r.reason === 'newer-version' ? 'This save is from a newer version of the game.' : 'This file is not a Wonder Garage save.' };
    const ok = await this.save(r.data);
    if (!ok) return { ok: false, reason: `The save could not be written (${this.status.lastError}).` };
    return { ok: true, repaired: r.repaired };
  }

  async reset(): Promise<boolean> {
    const fresh = defaultSave();
    fresh.settings = { ...this.data.settings };
    try {
      await this.chain;
      await this.backend.clear();
    } catch {
      /* the write below reports honestly */
    }
    return this.save(fresh);
  }
}
