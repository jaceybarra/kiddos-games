import { describe, expect, it } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { IdbBackend, LocalStorageBackend, MemoryBackend } from '../../src/save/backends';
import { SaveManager } from '../../src/save/SaveManager';
import { MAX_CREATIONS_PER_KIND, SAVE_VERSION } from '../../src/save/schema';

const fox = { species: 'fox' as const, color: 'sun', hat: null };
const frog = { species: 'frog' as const, color: 'sea', hat: null };

async function fresh(backend = new MemoryBackend()) {
  const m = new SaveManager(backend);
  m.debounceMs = 1;
  await m.init();
  return { m, backend };
}

class FakeStorage implements Storage {
  private map = new Map<string, string>();
  get length() {
    return this.map.size;
  }
  clear() {
    this.map.clear();
  }
  getItem(k: string) {
    return this.map.has(k) ? this.map.get(k)! : null;
  }
  key(i: number) {
    return [...this.map.keys()][i] ?? null;
  }
  removeItem(k: string) {
    this.map.delete(k);
  }
  setItem(k: string, v: string) {
    this.map.set(k, v);
  }
}

describe('SaveManager', () => {
  it('persists profiles and keeps creations separate per profile', async () => {
    const { m, backend } = await fresh();
    const a = m.createProfile({ nickname: 'Older', preset: 'more-exploring', avatar: fox });
    const b = m.createProfile({ nickname: 'Younger', preset: 'more-help', avatar: frog });
    m.updateProfile(a.id, (p) => (p.progress.quests['windmill-kite'] = { status: 'done', checkpoint: 'end', flags: { route: 'launcher' }, completions: 1 }));
    await m.saveCreation({ profileId: a.id, kind: 'invention', name: 'Ramp', data: { parts: [1] } });
    await m.saveCreation({ profileId: b.id, kind: 'invention', name: 'Fan', data: { parts: [2] } });
    await m.flush();

    const m2 = new SaveManager(backend);
    await m2.init();
    expect(m2.listProfiles().map((p) => p.nickname)).toEqual(['Older', 'Younger']);
    expect(m2.getProfile(a.id)!.progress.quests['windmill-kite'].status).toBe('done');
    expect(m2.getProfile(b.id)!.progress.quests['windmill-kite']).toBeUndefined();
    expect(m2.listCreations(a.id).map((c) => c.name)).toEqual(['Ramp']);
    expect(m2.listCreations(b.id).map((c) => c.name)).toEqual(['Fan']);
    expect(m2.status.notices.join(' ')).not.toMatch(/repaired|set aside|updated/);
  });

  it('refuses to let one profile overwrite another profile’s creation', async () => {
    const { m } = await fresh();
    const a = m.createProfile({ nickname: 'A', preset: 'more-help', avatar: fox });
    const b = m.createProfile({ nickname: 'B', preset: 'more-help', avatar: fox });
    const r = await m.saveCreation({ profileId: a.id, kind: 'story', name: 'Mine', data: {} });
    const steal = await m.saveCreation({ id: r.id, profileId: b.id, kind: 'story', name: 'Theirs', data: {} });
    expect(steal.ok).toBe(false);
    expect(m.getCreation(r.id!)!.name).toBe('Mine');
    expect((await m.deleteCreation(r.id!, b.id)).ok).toBe(false);
  });

  it('limits each shelf and reports it instead of dropping work', async () => {
    const { m } = await fresh();
    const a = m.createProfile({ nickname: 'A', preset: 'more-help', avatar: fox });
    for (let i = 0; i < MAX_CREATIONS_PER_KIND; i++) {
      expect((await m.saveCreation({ profileId: a.id, kind: 'story', name: `S${i}`, data: { i } })).ok).toBe(true);
    }
    const r = await m.saveCreation({ profileId: a.id, kind: 'story', name: 'one too many', data: {} });
    expect(r).toMatchObject({ ok: false, reason: 'full' });
    expect(m.listCreations(a.id, 'story')).toHaveLength(MAX_CREATIONS_PER_KIND);
    // other kinds unaffected
    expect((await m.saveCreation({ profileId: a.id, kind: 'invention', name: 'ok', data: {} })).ok).toBe(true);
  });

  it('repairs a damaged profile without discarding it, and keeps the original', async () => {
    const backend = new MemoryBackend();
    await backend.putRoot({ version: SAVE_VERSION, device: { volume: { music: 7 } }, profileIds: ['p1'] });
    await backend.put('profiles', { id: 'p1', nickname: 'Kid', avatar: { species: 'dragon' }, progress: { quests: { 'windmill-kite': { status: 'done' } } } } as never);
    const { m } = await fresh(backend);
    const p = m.getProfile('p1')!;
    expect(p.nickname).toBe('Kid');
    expect(p.avatar.species).toBe('fox');
    expect(p.progress.quests['windmill-kite'].status).toBe('done');
    expect(m.device.volume.music).toBe(0.5);
    expect(m.status.notices.join(' ')).toMatch(/repaired/);
    const q = await backend.listQuarantine();
    expect(q.some((e) => e.key === 'p1' && (e.raw as { avatar: { species: string } }).avatar.species === 'dragon')).toBe(true);
  });

  it('sets aside an unreadable record and still loads the rest', async () => {
    const backend = new MemoryBackend();
    await backend.putRoot({ version: SAVE_VERSION, device: {}, profileIds: ['ok'] });
    await backend.put('profiles', { id: 'ok', nickname: 'Fine', avatar: fox, settings: { preset: 'more-help' }, progress: {} } as never);
    await backend.put('profiles', { id: '' } as never);
    await backend.put('creations', { id: 'c1', profileId: 'ghost', kind: 'story', data: {} } as never);
    const { m } = await fresh(backend);
    expect(m.listProfiles().map((p) => p.nickname)).toEqual(['Fine']);
    expect((await backend.listQuarantine()).length).toBeGreaterThanOrEqual(2);
    expect(m.status.notices.length).toBeGreaterThan(0);
  });

  it('migrates an old-format save and backs up the original', async () => {
    const backend = new MemoryBackend();
    await backend.putRoot({ version: 0, device: {}, profileIds: ['old'] });
    await backend.put('profiles', { id: 'old', name: 'Legacy', preset: 'more-exploring', quests: { 'windmill-kite': { status: 'done' } }, avatar: fox } as never);
    const { m } = await fresh(backend);
    await m.flush();
    const p = m.getProfile('old')!;
    expect(p.nickname).toBe('Legacy');
    expect(p.settings.preset).toBe('more-exploring');
    expect(p.progress.quests['windmill-kite'].status).toBe('done');
    expect((await backend.getRoot()) as { version: number }).toMatchObject({ version: SAVE_VERSION });
    expect((await backend.listQuarantine()).some((e) => e.key === 'pre-migration')).toBe(true);
  });

  it('never overwrites a save written by a newer version', async () => {
    const backend = new MemoryBackend();
    await backend.putRoot({ version: SAVE_VERSION + 5, device: {}, profileIds: ['x'] });
    await backend.put('profiles', { id: 'x', nickname: 'Future', avatar: fox, settings: { preset: 'more-help' }, progress: {} } as never);
    const { m } = await fresh(backend);
    expect(m.status.readOnly).toBe(true);
    m.updateProfile('x', (p) => (p.nickname = 'Changed'));
    await m.flush();
    const stored = (await backend.getAll('profiles'))[0] as { nickname: string };
    expect(stored.nickname).toBe('Future');
    expect((await m.saveCreation({ profileId: 'x', kind: 'story', name: 'n', data: {} })).ok).toBe(false);
  });

  it('reports a full disk, keeps changes pending, and recovers', async () => {
    const { m, backend } = await fresh();
    const a = m.createProfile({ nickname: 'A', preset: 'more-help', avatar: fox });
    await m.flush();
    const quota = Object.assign(new Error('full'), { name: 'QuotaExceededError' });
    backend.failWrites = quota;
    m.updateProfile(a.id, (p) => (p.nickname = 'B'));
    await m.flush();
    expect(m.status.quotaFull).toBe(true);
    expect(m.status.pendingWrites).toBeGreaterThan(0);
    backend.failWrites = null;
    await m.flush();
    expect(m.status.quotaFull).toBe(false);
    expect(((await backend.getAll('profiles'))[0] as { nickname: string }).nickname).toBe('B');
  });

  it('rejects broken imports without touching current saves', async () => {
    const { m } = await fresh();
    const a = m.createProfile({ nickname: 'Keep', preset: 'more-help', avatar: fox });
    await m.flush();
    expect(m.parseImport('not json').ok).toBe(false);
    expect(m.parseImport(JSON.stringify({ hello: 1 })).ok).toBe(false);
    expect(m.parseImport(JSON.stringify({ format: 'wonderwood-save', version: 1, profiles: [], creations: [] })).ok).toBe(false);
    expect(m.parseImport(JSON.stringify({ format: 'wonderwood-save', version: 99, profiles: [{ id: 'z' }] })).ok).toBe(false);
    expect(m.getProfile(a.id)!.nickname).toBe('Keep');
  });

  it('round-trips export → import and backs up before replacing', async () => {
    const { m: src } = await fresh();
    const a = src.createProfile({ nickname: 'Exported', preset: 'more-help', avatar: fox });
    await src.saveCreation({ profileId: a.id, kind: 'picnic', name: 'Cake', data: { layers: 3 } });
    const json = src.exportJSON();

    const { m: dst, backend } = await fresh();
    dst.createProfile({ nickname: 'Before', preset: 'more-help', avatar: frog });
    await dst.flush();
    const prev = dst.parseImport(json);
    expect(prev.ok).toBe(true);
    if (!prev.ok) return;
    expect(prev.summary.profiles).toEqual([{ nickname: 'Exported', creations: 1 }]);
    expect((await dst.applyImport(prev.file)).ok).toBe(true);
    expect(dst.listProfiles().map((p) => p.nickname)).toEqual(['Exported']);
    expect(dst.listCreations(a.id)[0].data).toEqual({ layers: 3 });
    const backup = (await backend.listQuarantine()).find((e) => e.key === 'pre-import');
    expect(JSON.stringify(backup?.raw)).toContain('Before');
  });

  it('reset clears one profile only, with a backup', async () => {
    const { m, backend } = await fresh();
    const a = m.createProfile({ nickname: 'A', preset: 'more-help', avatar: fox });
    const b = m.createProfile({ nickname: 'B', preset: 'more-help', avatar: fox });
    m.updateProfile(a.id, (p) => (p.progress.onboarded = true));
    m.updateProfile(b.id, (p) => (p.progress.onboarded = true));
    await m.saveCreation({ profileId: a.id, kind: 'story', name: 'x', data: {} });
    await m.saveCreation({ profileId: b.id, kind: 'story', name: 'y', data: {} });
    await m.resetProfile(a.id);
    expect(m.getProfile(a.id)!.progress.onboarded).toBe(false);
    expect(m.getProfile(a.id)!.nickname).toBe('A');
    expect(m.listCreations(a.id)).toHaveLength(0);
    expect(m.getProfile(b.id)!.progress.onboarded).toBe(true);
    expect(m.listCreations(b.id)).toHaveLength(1);
    expect((await backend.listQuarantine()).some((e) => e.reason.includes('reset'))).toBe(true);
  });
});

describe('backends', () => {
  it('IndexedDB backend round-trips', async () => {
    const be = await IdbBackend.open(new IDBFactory());
    await be.putRoot({ version: 1, device: {}, profileIds: ['a'] });
    await be.put('profiles', { id: 'a' });
    await be.put('creations', { id: 'c' });
    await be.addQuarantine({ at: 1, store: 's', key: 'k', reason: 'r', raw: { x: 1 } });
    expect(await be.getRoot()).toEqual({ version: 1, device: {}, profileIds: ['a'] });
    expect(await be.getAll('profiles')).toEqual([{ id: 'a' }]);
    await be.remove('creations', 'c');
    expect(await be.getAll('creations')).toEqual([]);
    expect((await be.listQuarantine())[0].raw).toEqual({ x: 1 });
  });

  it('localStorage backend survives corrupted JSON', async () => {
    const ls = new FakeStorage();
    ls.setItem('ww:root', '{"version":1,"profileIds":["a"]}');
    ls.setItem('ww:profiles:a', '{broken');
    const m = new SaveManager(new LocalStorageBackend(ls));
    await m.init();
    expect(m.listProfiles()).toEqual([]);
    expect(m.status.notices.length).toBeGreaterThan(0);
    expect(ls.getItem('ww:profiles:a')).toBe('{broken');
  });
});
