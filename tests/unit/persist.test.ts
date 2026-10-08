import { afterEach, describe, expect, it, vi } from 'vitest';
import { requestPersistentStorage } from '../../src/save/persist';

const withStorage = (storage: unknown) => vi.stubGlobal('navigator', { storage });

describe('asking the browser to keep saves', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('does not ask again when saves are already kept', async () => {
    const persist = vi.fn(async () => true);
    withStorage({ persisted: async () => true, persist });
    expect(await requestPersistentStorage()).toBe(true);
    expect(persist).not.toHaveBeenCalled();
  });

  it('asks once and reports the answer', async () => {
    const persist = vi.fn(async () => false);
    withStorage({ persisted: async () => false, persist });
    expect(await requestPersistentStorage()).toBe(false);
    expect(persist).toHaveBeenCalledTimes(1);
  });

  it('reports "can’t say" when the browser has no storage API or it fails', async () => {
    withStorage(undefined);
    expect(await requestPersistentStorage()).toBeNull();
    withStorage({ persisted: async () => { throw new Error('nope'); }, persist: async () => true });
    expect(await requestPersistentStorage()).toBeNull();
  });
});
