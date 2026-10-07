/**
 * Storage backends. IndexedDB is preferred (structured data, larger quota).
 * localStorage is a fallback; memory-only is the last resort and is announced
 * to the adult so nobody assumes work is being kept.
 */

export type StoreName = 'profiles' | 'creations';

export interface QuarantineEntry {
  id?: number;
  at: number;
  store: string;
  key: string;
  reason: string;
  raw: unknown;
}

export interface Backend {
  readonly kind: 'indexeddb' | 'localstorage' | 'memory';
  getRoot(): Promise<unknown | undefined>;
  putRoot(v: unknown): Promise<void>;
  getAll(store: StoreName): Promise<unknown[]>;
  put(store: StoreName, v: { id: string }): Promise<void>;
  remove(store: StoreName, id: string): Promise<void>;
  addQuarantine(e: QuarantineEntry): Promise<void>;
  listQuarantine(): Promise<QuarantineEntry[]>;
  clearQuarantine(): Promise<void>;
}

const DB_NAME = 'wonderwood';
const DB_VERSION = 1;

function req<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

export class IdbBackend implements Backend {
  readonly kind = 'indexeddb' as const;
  private constructor(private db: IDBDatabase) {}

  static async open(factory: IDBFactory = indexedDB): Promise<IdbBackend> {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const r = factory.open(DB_NAME, DB_VERSION);
      r.onupgradeneeded = () => {
        const d = r.result;
        if (!d.objectStoreNames.contains('meta')) d.createObjectStore('meta');
        if (!d.objectStoreNames.contains('profiles')) d.createObjectStore('profiles', { keyPath: 'id' });
        if (!d.objectStoreNames.contains('creations')) d.createObjectStore('creations', { keyPath: 'id' });
        if (!d.objectStoreNames.contains('quarantine')) d.createObjectStore('quarantine', { keyPath: 'id', autoIncrement: true });
      };
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
      r.onblocked = () => reject(new Error('IndexedDB blocked'));
    });
    return new IdbBackend(db);
  }

  private tx(store: string, mode: IDBTransactionMode) {
    return this.db.transaction(store, mode).objectStore(store);
  }

  private done(t: IDBTransaction): Promise<void> {
    return new Promise((resolve, reject) => {
      t.oncomplete = () => resolve();
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error ?? new Error('transaction aborted'));
    });
  }

  async getRoot() {
    return req(this.tx('meta', 'readonly').get('root'));
  }
  async putRoot(v: unknown) {
    const t = this.db.transaction('meta', 'readwrite');
    t.objectStore('meta').put(v, 'root');
    await this.done(t);
  }
  async getAll(store: StoreName) {
    return req(this.tx(store, 'readonly').getAll());
  }
  async put(store: StoreName, v: { id: string }) {
    const t = this.db.transaction(store, 'readwrite');
    t.objectStore(store).put(v);
    await this.done(t);
  }
  async remove(store: StoreName, id: string) {
    const t = this.db.transaction(store, 'readwrite');
    t.objectStore(store).delete(id);
    await this.done(t);
  }
  async addQuarantine(e: QuarantineEntry) {
    const t = this.db.transaction('quarantine', 'readwrite');
    const { id: _ignored, ...rest } = e;
    void _ignored;
    t.objectStore('quarantine').add(rest);
    await this.done(t);
  }
  async listQuarantine() {
    return (await req(this.tx('quarantine', 'readonly').getAll())) as QuarantineEntry[];
  }
  async clearQuarantine() {
    const t = this.db.transaction('quarantine', 'readwrite');
    t.objectStore('quarantine').clear();
    await this.done(t);
  }
}

export class LocalStorageBackend implements Backend {
  readonly kind = 'localstorage' as const;
  constructor(private ls: Storage = localStorage) {}
  private read(k: string): unknown {
    const s = this.ls.getItem(k);
    if (s == null) return undefined;
    try {
      return JSON.parse(s);
    } catch {
      return { __unparseable: s };
    }
  }
  async getRoot() {
    return this.read('ww:root');
  }
  async putRoot(v: unknown) {
    this.ls.setItem('ww:root', JSON.stringify(v));
  }
  async getAll(store: StoreName) {
    const out: unknown[] = [];
    const prefix = `ww:${store}:`;
    for (let i = 0; i < this.ls.length; i++) {
      const k = this.ls.key(i);
      if (k && k.startsWith(prefix)) out.push(this.read(k));
    }
    return out;
  }
  async put(store: StoreName, v: { id: string }) {
    this.ls.setItem(`ww:${store}:${v.id}`, JSON.stringify(v));
  }
  async remove(store: StoreName, id: string) {
    this.ls.removeItem(`ww:${store}:${id}`);
  }
  async addQuarantine(e: QuarantineEntry) {
    const list = await this.listQuarantine();
    list.push({ ...e, id: Date.now() });
    this.ls.setItem('ww:quarantine', JSON.stringify(list.slice(-20)));
  }
  async listQuarantine() {
    const v = this.read('ww:quarantine');
    return Array.isArray(v) ? (v as QuarantineEntry[]) : [];
  }
  async clearQuarantine() {
    this.ls.removeItem('ww:quarantine');
  }
}

export class MemoryBackend implements Backend {
  readonly kind = 'memory' as const;
  private root: unknown;
  private stores: Record<StoreName, Map<string, unknown>> = { profiles: new Map(), creations: new Map() };
  private q: QuarantineEntry[] = [];
  /** test hook: make writes throw like a full disk */
  failWrites: Error | null = null;
  private check() {
    if (this.failWrites) throw this.failWrites;
  }
  async getRoot() {
    return structuredClone(this.root);
  }
  async putRoot(v: unknown) {
    this.check();
    this.root = structuredClone(v);
  }
  async getAll(store: StoreName) {
    return [...this.stores[store].values()].map((v) => structuredClone(v));
  }
  async put(store: StoreName, v: { id: string }) {
    this.check();
    this.stores[store].set(v.id, structuredClone(v));
  }
  async remove(store: StoreName, id: string) {
    this.check();
    this.stores[store].delete(id);
  }
  async addQuarantine(e: QuarantineEntry) {
    this.q.push(structuredClone({ ...e, id: this.q.length + 1 }));
  }
  async listQuarantine() {
    return structuredClone(this.q);
  }
  async clearQuarantine() {
    this.q = [];
  }
}

/** Pick the best available backend. */
export async function openBestBackend(): Promise<Backend> {
  try {
    if (typeof indexedDB !== 'undefined') return await IdbBackend.open();
  } catch {
    /* fall through */
  }
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('ww:probe', '1');
      localStorage.removeItem('ww:probe');
      return new LocalStorageBackend();
    }
  } catch {
    /* fall through */
  }
  return new MemoryBackend();
}

export function isQuotaError(e: unknown): boolean {
  if (!e || typeof e !== 'object') return false;
  const name = (e as { name?: string }).name;
  return name === 'QuotaExceededError' || name === 'NS_ERROR_DOM_QUOTA_REACHED' || (e as { code?: number }).code === 22;
}
