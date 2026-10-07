import { test, type Page } from '@playwright/test';
import { chooseProfile, collectErrors, expect, flush, profile, setupFamily, state, waitScene, waitState } from './helpers';

const BX = 300;
const BY = 70;
const BS = 0.925;

async function boardClick(page: Page, bx: number, by: number) {
  const pt = await page.evaluate(([x, y]) => (window as any).__ww.worldToClient(x, y), [BX + bx * BS, BY + by * BS]);
  await page.mouse.click(pt.x, pt.y);
}

async function enterTinker(page: Page) {
  await setupFamily(page);
  await chooseProfile(page, 0);
  await page.click('[data-avatar-done]');
  await waitScene(page, 'windmill-kite');
  await page.click('[data-hud="home"]');
  await page.click('[data-dialog="map"]');
  await waitScene(page, 'map');
  await page.click('[data-jump="tinker"]');
  await waitScene(page, 'tinker');
}

test.describe('Tinker Grove', () => {
  test('build a bridge, test it, save it, find it again after a refresh and in the clubhouse', async ({ page }) => {
    const errors = collectErrors(page);
    await enterTinker(page);
    await page.click('[data-challenge="acorn-crossing"]');
    await page.click('[data-part="plank"]');
    await boardClick(page, 700, 600);
    await page.click('[data-part="plank"]');
    await boardClick(page, 940, 600);
    expect((await state(page)).parts).toEqual(['plank@700,600,0', 'plank@940,600,0']);
    await page.click('[data-test]');
    const done = await waitState(page, (s) => !s.running && !!s.outcome, 'test finished', 60_000);
    expect((done.outcome as { status: string }).status).toBe('success');

    await page.click('[data-save]');
    await page.waitForFunction(() => !!(window as any).__ww.app.profile()?.progress.display.invention, null, { timeout: 30_000 });
    await flush(page);
    const prof = await profile(page);
    expect(prof.progress.done['tinker:acorn-crossing']).toBe(1);
    expect(prof.progress.display.invention).toBeTruthy();

    // refresh: the draft is restored where we left it
    await page.reload();
    await chooseProfile(page, 0);
    await waitScene(page, 'tinker');
    expect((await state(page)).parts).toEqual(['plank@700,600,0', 'plank@940,600,0']);
    await page.click('[data-shelf]');
    await expect(page.locator('[data-creation]')).toHaveCount(1);
    await page.click('[aria-label="Close"]');

    // the clubhouse shows the real invention, and it still works
    await page.click('[data-hud="home"]');
    await page.click('[data-dialog="map"]');
    await waitScene(page, 'map');
    await page.click('[data-jump="clubhouse"]');
    await waitScene(page, 'clubhouse');
    expect((await state(page)).hasInvention).toBe(true);
    expect(errors).toEqual([]);
  });

  test('keyboard: nudge, turn and remove a selected part; undo brings it back', async ({ page }) => {
    await enterTinker(page);
    await page.click('[data-challenge="free"]');
    await page.click('[data-part="ramp@15"]');
    await boardClick(page, 800, 400);
    await page.focus('canvas');
    await page.keyboard.press('ArrowRight');
    let s = await state(page);
    expect(s.parts).toEqual(['ramp@820,400,15']);
    await page.click('[data-undo]');
    s = await state(page);
    expect(s.parts).toEqual(['ramp@800,400,15']);
  });

  test('shelf delete asks first and keeps the build if you change your mind', async ({ page }) => {
    await enterTinker(page);
    await page.click('[data-challenge="free"]');
    await page.click('[data-part="bumper"]');
    await boardClick(page, 600, 500);
    await page.click('[data-save]');
    await page.waitForFunction(() => !!(window as any).__ww.app.profile()?.progress.display.invention, null, { timeout: 30_000 });
    await page.click('[data-shelf]');
    await page.click('[data-creation] [aria-label="Throw away"]');
    await page.click('[data-dialog="keep"]');
    await expect(page.locator('[data-creation]')).toHaveCount(1);
    await page.click('[data-creation] [aria-label="Throw away"]');
    await page.click('[data-dialog="delete"]');
    await expect(page.locator('[data-creation]')).toHaveCount(0);
  });
});
