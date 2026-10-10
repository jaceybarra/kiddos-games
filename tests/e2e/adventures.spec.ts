import { type Page } from '@playwright/test';
import { test, chooseProfile, clickChoice, clickTarget, collectErrors, expect, flush, profile, setupFamily, state, targets, waitScene, waitState, walkUntilVisible } from './helpers';

/** Story order opens these one by one; tests jump straight in with the e2e-only hook. */
async function enter(page: Page, player: number, scene: string) {
  await setupFamily(page);
  await chooseProfile(page, player);
  await page.click('[data-avatar-done]');
  await waitScene(page, 'windmill-kite');
  // visit the map first (as a child would), then skip ahead in story order
  await page.click('[data-hud="home"]');
  await page.click('[data-dialog="map"]');
  await waitScene(page, 'map');
  await page.evaluate((k) => (window as any).__ww.app.goTo(k), scene);
  await waitScene(page, scene);
}

const notBusy = (page: Page) => waitState(page, (s) => !s.busy, 'not busy');

test.describe('Lantern Trail adventures', () => {
  test('The Picnic Bridge: a plank floats away, Moss’s idea fixes it, a refresh keeps the bridge, and everyone crosses', async ({ page }) => {
    const errors = collectErrors(page);
    await enter(page, 0, 'picnic-bridge');
    await waitState(page, (s) => s.checkpoint === 'build' && !s.busy, 'building', 120_000);
    await clickTarget(page, 'plank-shed');
    await waitState(page, (s) => !!s.carrying, 'carrying a plank');
    await clickTarget(page, 'plankspot-0');
    await waitState(page, (s) => s.floated === 'away' && !s.busy, 'the plank floats away', 90_000);
    await clickTarget(page, 'stick');
    await waitState(page, (s) => s.floated === 'back' && !s.busy, 'fished back', 60_000);
    await clickTarget(page, 'rope');
    await waitState(page, (s) => s.tied === true && !s.busy, 'tied', 60_000);
    await clickTarget(page, 'plank-fished');
    await waitState(page, (s) => !!s.carrying, 'carrying again');
    await clickTarget(page, 'plankspot-0');
    await waitState(page, (s) => (s.planks as boolean[])[0] && !s.busy, 'first plank stays', 60_000);

    // refresh: the bridge-in-progress is still there
    await flush(page);
    await page.reload();
    await chooseProfile(page, 0);
    await waitScene(page, 'picnic-bridge');
    let s = await state(page);
    expect(s.planks).toEqual([true, false, false]);
    expect(s.tied).toBe(true);

    // Moss can't do steps: stones alone won't help Moss
    await clickTarget(page, 'leafpile');
    await waitState(page, (x) => x.revealed === true && !x.busy, 'found a plank under the leaves');
    await clickTarget(page, 'plank-leaves');
    await waitState(page, (x) => !!x.carrying, 'carrying');
    await clickTarget(page, 'plankspot-1');
    await waitState(page, (x) => (x.planks as boolean[])[1] && !x.busy, 'second plank', 60_000);
    await clickTarget(page, 'plank-bank');
    await waitState(page, (x) => !!x.carrying, 'carrying');
    await clickTarget(page, 'plankspot-2');
    await waitState(page, (x) => (x.planks as boolean[])[2] && !x.busy, 'third plank', 60_000);
    for (const f of ['moss', 'fizz', 'rowan']) {
      await notBusy(page);
      await clickTarget(page, `friend-${f}`);
      await waitState(page, (x) => (x.crossed as string[]).includes(f) && !x.busy, `${f} crossed`, 120_000);
    }
    await waitState(page, (x) => x.done === true && !x.busy, 'finished', 120_000);
    await flush(page);
    const prof = await profile(page);
    expect(prof.progress.souvenirs['bridge-flag']).toBeTruthy();
    expect(prof.progress.quests['picnic-bridge'].status).toBe('done');
    expect(errors).toEqual([]);
  });

  test('The Waterwheel Mix-Up (More help): follow the clues, Fizz owns the mistake, clear the dam alone, the lanterns light', async ({ page }) => {
    await enter(page, 1, 'waterwheel');
    await waitState(page, (s) => s.checkpoint === 'explore' && !s.busy, 'exploring', 120_000);
    await clickTarget(page, 'clue-leaf');
    await waitState(page, (s) => (s.clues as string[]).includes('leaf') && !s.busy, 'clue found');
    // walking up to the pool is enough to find out what happened
    await page.focus('canvas');
    await page.keyboard.down('ArrowRight');
    await page.waitForSelector('[data-choice="solo"]', { timeout: 120_000 });
    await page.keyboard.up('ArrowRight');
    // two clear options on More help
    await expect(page.locator('[data-choice]')).toHaveCount(2);
    await clickChoice(page, 'solo');
    await waitState(page, (s) => s.route === 'solo' && !s.busy, 'solo route', 60_000);
    for (let i = 0; i < 8; i++) {
      const leaf = (await targets(page)).find((t) => t.id.startsWith('damleaf'));
      if (!leaf) break;
      await clickTarget(page, leaf.id);
      await page.waitForTimeout(500);
    }
    const s = await waitState(page, (x) => x.done === true && !x.busy, 'wheel turning', 120_000);
    expect(s.wheel).toBe(true);
    expect(s.pool).toBe(false);
    await flush(page);
    expect((await profile(page)).progress.souvenirs['mill-wheel']).toBeTruthy();
  });

  test('The Lantern Launch (More exploring): the quiet job counts, the first launch wobbles, a fix lets it rise, and souvenirs show in the clubhouse', async ({ page }) => {
    await enter(page, 0, 'lantern-launch');
    await page.waitForSelector('[data-choice="path"]', { timeout: 120_000 });
    await clickChoice(page, 'path');
    await waitState(page, (s) => s.role === 'path' && !s.busy, 'quiet job chosen', 60_000);
    for (let i = 0; i < 4; i++) {
      if (i >= 2) await walkUntilVisible(page, `path-${i}`, 1);
      await clickTarget(page, `path-${i}`);
      await waitState(page, (s) => (s.pathLit as number) > i, `path lantern ${i + 1}`, 60_000);
    }
    await page.waitForSelector('[data-choice="trim"]', { timeout: 180_000 });
    expect((await state(page)).attempts).toBe(1);
    await clickChoice(page, 'trim');
    await waitState(page, (s) => s.done === true && !s.busy, 'launched and celebrated', 180_000);
    await flush(page);
    expect((await profile(page)).progress.souvenirs['festival-lantern']).toBeTruthy();

    await page.evaluate(() => (window as any).__ww.app.goTo('clubhouse'));
    await waitScene(page, 'clubhouse');
    expect((await targets(page)).some((t) => t.id === 'souvenir-festival-lantern')).toBe(true);
  });
});
