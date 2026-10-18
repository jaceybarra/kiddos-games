import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { defaultSave, readSave, SAVE_VERSION } from '../../src/save/schema';
import { MemoryBackend, SaveStore, IdbBackend } from '../../src/save/store';
import { applyMissionResult, addCoins, unlockedMissions, creatorUnlocked } from '../../src/save/progress';
import type { MissionSummary } from '../../src/core/missionState';

const result = (over: Partial<MissionSummary> = {}): MissionSummary => ({
  missionId: 'wobbly-bridge',
  coins: ['m1-c1', 'm1-c2'],
  discovery: 'golden-acorn',
  placed: [{ socket: 'span', piece: 'bridge' }],
  choice: null,
  usedHelp: false,
  ...over,
});

describe('rewards are idempotent', () => {
  it('applying the same result twice gives the same save and nothing new the second time', () => {
    const a = applyMissionResult(defaultSave(), result());
    expect(a.earned).toEqual({ newMission: true, newReward: 'pennant', newDiscovery: 'golden-acorn', newCoins: ['m1-c1', 'm1-c2'] });
    const b = applyMissionResult(a.save, result());
    expect(b.earned).toEqual({ newMission: false, newReward: null, newDiscovery: null, newCoins: [] });
    expect(b.save).toEqual(a.save);
  });

  it('replaying with help gives the same reward; coins never duplicate; unknown coins are ignored', () => {
    const a = applyMissionResult(defaultSave(), result({ usedHelp: true }));
    expect(a.save.progress.rewards).toEqual(['pennant']);
    const c = addCoins(a.save, ['m1-c2', 'm1-c3', 'not-a-coin', 'm1-c3']);
    expect(c.added).toEqual(['m1-c3']);
    expect(c.save.progress.coins).toEqual(['m1-c1', 'm1-c2', 'm1-c3']);
  });

  it('missions open in order; My Tiny Track opens after the chapter (or with "open all")', () => {
    let s = defaultSave();
    expect(unlockedMissions(s)).toEqual(['wobbly-bridge']);
    s = applyMissionResult(s, result()).save;
    expect(unlockedMissions(s)).toEqual(['wobbly-bridge', 'ramp-we-share']);
    expect(creatorUnlocked(s)).toBe(false);
    s = applyMissionResult(s, result({ missionId: 'ramp-we-share', coins: [], discovery: null })).save;
    s = applyMissionResult(s, result({ missionId: 'everyone-rally', coins: [], discovery: null })).save;
    expect(creatorUnlocked(s)).toBe(true);
    expect(s.progress.rewards).toEqual(['pennant', 'twin-ramp', 'crew-banner']);
    const open = defaultSave();
    open.settings.openAll = true;
    expect(creatorUnlocked(open)).toBe(true);
  });
});

describe('save format', () => {
  it('migrates the unversioned format to the current version', () => {
    const r = readSave({ completed: ['wobbly-bridge'], rewards: ['pennant'], coins: ['m1-c1', 'm1-c1'], truck: { paint: 'blue', pattern: 'dots', decal: 'paw', wheel: 'spring' }, childName: 'Bentley' });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.version).toBe(SAVE_VERSION);
    expect(r.data.progress.completed).toEqual(['wobbly-bridge']);
    expect(r.data.progress.coins).toEqual(['m1-c1']);
    expect(r.data.progress.started).toBe(true);
    expect(r.data.truck).toEqual({ paint: 'blue', pattern: 'dots', decal: 'paw', wheel: 'spring' });
  });

  it('repairs bad values and refuses things that are not saves', () => {
    const raw = defaultSave() as unknown as Record<string, any>;
    raw.progress.coins = ['m1-c1', 42, 'fake'];
    raw.progress.rewards = ['pennant']; // without the mission: dropped
    raw.truck.paint = 'chrome';
    raw.settings.childName = '  Bent<ley>!! ';
    raw.tracks = [{ slots: ['pond', 'ramp'] }, 'junk', null];
    const r = readSave(raw);
    expect(r.ok && r.repaired).toBe(true);
    if (!r.ok) return;
    expect(r.data.progress.coins).toEqual(['m1-c1']);
    expect(r.data.progress.rewards).toEqual([]);
    expect(r.data.truck.paint).toBe('red');
    expect(r.data.settings.childName).toBe('Bentley');
    expect(r.data.tracks[0]?.slots).toEqual([null, 'ramp', null, null, null, null]);
    expect(r.data.tracks[1]).toBeNull();
    expect(readSave('hello').ok).toBe(false);
    expect(readSave(null)).toEqual({ ok: false, reason: 'empty' });
    expect(readSave({ version: 99, progress: {}, truck: {} })).toEqual({ ok: false, reason: 'newer-version' });
  });
});

describe('save store', () => {
  it('writes to IndexedDB, keeps the previous record, and reloads it', async () => {
    const backend = await IdbBackend.open();
    const store = await SaveStore.open(backend);
    expect(store.status.loaded).toBe('fresh');
    const s1 = applyMissionResult(store.data, result()).save;
    expect(await store.save(s1)).toBe(true);
    const s2 = { ...s1, truck: { ...s1.truck, paint: 'blue' as const } };
    expect(await store.save(s2)).toBe(true);
    const again = await SaveStore.open(backend);
    expect(again.status.loaded).toBe('current');
    expect(again.data.truck.paint).toBe('blue');
    expect(readSave(await backend.get('previous')).ok).toBe(true);
  });

  it('a corrupted current record falls back to the previous one, and is set aside, not deleted', async () => {
    const backend = new MemoryBackend();
    const store = await SaveStore.open(backend);
    await store.save(applyMissionResult(store.data, result()).save);
    await store.save({ ...store.data, truck: { ...store.data.truck, paint: 'green' } });
    backend.map.set('current', '{{{ not json');
    const again = await SaveStore.open(backend);
    expect(again.status.loaded).toBe('previous');
    expect(again.status.setAside).toBe(true);
    expect(again.data.progress.completed).toEqual(['wobbly-bridge']);
    expect((backend.map.get('set-aside') as { raw: unknown }).raw).toBe('{{{ not json');
  });

  it('a failed write is reported as failed, never as saved', async () => {
    const backend = new MemoryBackend();
    const store = await SaveStore.open(backend);
    backend.failWrites = true;
    const ok = await store.save(applyMissionResult(store.data, result()).save);
    expect(ok).toBe(false);
    expect(store.status.lastWrite).toBe('failed');
    expect(store.status.lastError).toBe('Storage is full');
    backend.failWrites = false;
    expect(await store.save(store.data)).toBe(true);
    expect(store.status.lastWrite).toBe('ok');
  });

  it('import accepts a real export, refuses anything else without changing the save', async () => {
    const store = await SaveStore.open(new MemoryBackend());
    await store.save(applyMissionResult(store.data, result()).save);
    const exported = store.exportJson();
    const other = await SaveStore.open(new MemoryBackend());
    expect(await other.importJson('not json')).toEqual({ ok: false, reason: 'This file is not a Wonder Garage save.' });
    expect(await other.importJson(JSON.stringify({ app: 'something-else', save: {} }))).toEqual({ ok: false, reason: 'This file is from a different app.' });
    expect(other.data.progress.completed).toEqual([]);
    expect((await other.importJson(exported)).ok).toBe(true);
    expect(other.data.progress.completed).toEqual(['wobbly-bridge']);
  });

  it('reset starts over but keeps the grown-up settings', async () => {
    const store = await SaveStore.open(new MemoryBackend());
    const s = applyMissionResult(store.data, result()).save;
    s.settings.jumpSide = 'left';
    await store.save(s);
    expect(await store.reset()).toBe(true);
    expect(store.data.progress.completed).toEqual([]);
    expect(store.data.settings.jumpSide).toBe('left');
  });
});

describe('resume points (continue a mission from its last checkpoint)', () => {
  const good = { missionId: 'wobbly-bridge', checkpoint: 'cp-across', x: 3420, y: 860, beat: 3, choice: null, placed: [{ zone: 'stream', socket: 'span', piece: 'bridge' }], lane: 'back' };

  it('a valid resume point survives a save round trip', () => {
    const raw = { ...defaultSave(), resume: good };
    const r = readSave(JSON.parse(JSON.stringify(raw)));
    expect(r.ok && r.data.resume).toEqual(good);
  });

  it('anything that does not match the mission data is dropped, not trusted', () => {
    for (const bad of [
      { ...good, missionId: 'moon-base' },
      { ...good, checkpoint: 'cp-nowhere' },
      { ...good, x: 99999 },
      { ...good, beat: 42 },
      { ...good, choice: 'fly' },
      { ...good, placed: [{ zone: 'stream', socket: 'span', piece: 'ramp' }] },
      { ...good, placed: [{ zone: 'stream', socket: 'span', piece: 'bridge' }, { zone: 'stream', socket: 'span', piece: 'bridge' }] },
      'junk',
    ]) {
      const r = readSave({ ...defaultSave(), resume: bad });
      expect(r.ok && r.data.resume, JSON.stringify(bad)).toBeNull();
      expect(r.ok && r.repaired).toBe(true);
    }
  });

  it('finishing the mission clears its resume point', () => {
    const s = { ...defaultSave(), resume: good as any };
    expect(applyMissionResult(s, result()).save.resume).toBeNull();
  });
});

describe('a save that cannot be read is never overwritten', () => {
  it('reads failing at start: play continues, writes are refused honestly, a grown-up reset may replace it', async () => {
    const backend = new MemoryBackend();
    backend.map.set('current', { precious: true });
    const failing = { ...backend, kind: 'memory' as const, get: async () => { throw new Error('IndexedDB read failed'); }, putAll: backend.putAll.bind(backend), clear: backend.clear.bind(backend) };
    const store = await SaveStore.open(failing);
    expect(store.status.readFailed).toBe(true);
    expect(await store.save(applyMissionResult(store.data, result()).save)).toBe(false);
    expect(store.status.lastWrite).toBe('failed');
    expect(backend.map.get('current')).toEqual({ precious: true });
  });
});
