import { test } from '@playwright/test';
import { chooseProfile, clickTarget, collectErrors, expect, flush, playIntro, profile, setupFamily, waitScene, waitState } from './helpers';

async function openAdult(page: import('@playwright/test').Page) {
  // keyboard activation of the gear opens the reading question directly (adults on keyboards)
  await page.focus('[data-adult-gear] ');
  await page.keyboard.press('Enter');
  for (let i = 0; i < 2; i++) {
    const q = await page.textContent('.gate .q');
    const word = /“(.+)”/.exec(q ?? '')![1];
    const map: Record<string, number> = { eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, 'twenty-one': 21, 'twenty-three': 23, 'thirty-two': 32, 'forty-five': 45 };
    await page.click(`[data-gate="${map[word]}"]`);
  }
  await page.waitForSelector('[data-adult-close]');
}

test.describe('profiles and saves', () => {
  test('switching profiles keeps progress and creations separate', async ({ page }) => {
    const errors = collectErrors(page);
    await setupFamily(page);
    await chooseProfile(page, 0);
    await page.click('[data-avatar-done]');
    await playIntro(page);
    await clickTarget(page, 'nest');
    await waitState(page, (s) => s.mode === 'choosingSpot', 'spots');
    await clickTarget(page, 'spot-2000');
    await waitState(page, (s) => s.mode === 'mixup', 'mixup');
    await flush(page);
    const a = await profile(page);
    expect(a.progress.quests['windmill-kite'].flags.nestMoved).toBe(true);

    await page.click('[data-hud="finish"]');
    await page.click('[data-closing-done]');
    await page.click('[aria-label="Open Wonderwood again"]');
    await chooseProfile(page, 1);
    await page.click('[data-species="mouse"]');
    await page.click('[data-avatar-done]');
    await waitScene(page, 'windmill-kite');
    const b = await profile(page);
    expect(b.id).not.toBe(a.id);
    expect(b.progress.quests['windmill-kite']?.flags?.nestMoved ?? false).toBe(false);
    expect(b.avatar.species).toBe('mouse');

    await page.click('[data-hud="finish"]');
    await page.click('[data-closing-done]');
    await page.click('[aria-label="Open Wonderwood again"]');
    await chooseProfile(page, 0);
    await waitScene(page, 'windmill-kite');
    const st = await waitState(page, (s) => s.mode === 'explore' || s.mode === 'repair', 'resume A');
    expect((st.flags as { mixup: string }).mixup).toBe('tangled');
    const a2 = await profile(page);
    expect(a2.avatar.species).not.toBe('mouse');
    expect(errors).toEqual([]);
  });

  test('a corrupted saved profile is repaired, kept as a backup, and reported to the adult', async ({ page }) => {
    await setupFamily(page);
    await page.waitForTimeout(800);
    // damage one stored profile directly in IndexedDB
    await page.evaluate(async () => {
      const db: IDBDatabase = await new Promise((res, rej) => {
        const r = indexedDB.open('wonderwood');
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
      });
      const all: { id: string }[] = await new Promise((res) => {
        const r = db.transaction('profiles').objectStore('profiles').getAll();
        r.onsuccess = () => res(r.result);
      });
      const t = db.transaction('profiles', 'readwrite');
      t.objectStore('profiles').put({ ...all[0], avatar: { species: 'dragon' }, settings: 'oops', progress: 42 });
      await new Promise((res) => (t.oncomplete = res));
      db.close();
    });
    await page.reload();
    await page.waitForSelector('[data-profile]');
    expect(await page.$$('[data-profile]')).toHaveLength(2);
    await openAdult(page);
    await expect(page.locator('.adult .notice').first()).toContainText(/repaired/i);
  });

  test('unavailable storage falls back to memory and says so', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, 'indexedDB', { get: () => { throw new Error('blocked'); } });
      Storage.prototype.setItem = () => { throw new Error('blocked'); };
    });
    await setupFamily(page);
    await openAdult(page);
    await expect(page.locator('.adult')).toContainText(/memory only/i);
  });

  test('a broken import file changes nothing; an old-format save imports', async ({ page }) => {
    await setupFamily(page);
    await openAdult(page);
    const input = page.locator('.adult input[type="file"]');
    await input.setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{"format":"nope"}') });
    await expect(page.locator('.adult .error')).toContainText(/not a Wonderwood save/);
    const old = { format: 'wonderwood-save', version: 0, exportedAt: 1, root: { version: 0, profileIds: ['old1'] }, profiles: [{ id: 'old1', name: 'Legacy', preset: 'more-help', avatar: { species: 'frog', color: 'sea', hat: null } }], creations: [] };
    await input.setInputFiles({ name: 'old.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(old)) });
    await page.click('text=Replace current saves with this file');
    await expect(page.locator('.adult .notice').first()).toContainText(/Imported/);
    await page.click('[data-adult-close]');
    await page.waitForSelector('[data-profile]');
    await expect(page.locator('[data-profile]')).toHaveCount(1);
    await expect(page.locator('[data-profile]')).toContainText('Legacy');
  });
});
