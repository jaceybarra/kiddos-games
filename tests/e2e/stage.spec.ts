import { type Page } from '@playwright/test';
import { test, chooseProfile, clickTarget, collectErrors, expect, flush, profile, setupFamily, smallButtons, state, waitScene, waitState } from './helpers';

async function enterStage(page: Page, player: number) {
  await setupFamily(page);
  await chooseProfile(page, player);
  await page.click('[data-avatar-done]');
  await waitScene(page, 'windmill-kite');
  await page.click('[data-hud="home"]');
  await page.click('[data-dialog="map"]');
  await waitScene(page, 'map');
  await page.click('[data-jump="stage"]');
  await waitScene(page, 'stage');
  await page.waitForSelector('[data-template]');
}

async function tapStage(page: Page, x: number, y: number) {
  const pt = await page.evaluate(([sx, sy]) => (window as any).__ww.worldToClient(260 + sx, 100 + sy), [x, y]);
  await page.mouse.click(pt.x, pt.y);
}

test.describe('Story Stage', () => {
  test('More help: three-scene strip, act it out, watch the show, save it, find it after a refresh and as a clubhouse poster', async ({ page }) => {
    const errors = collectErrors(page);
    await enterStage(page, 1);
    await page.click('[data-template="blank"]');
    let s = await waitState(page, (x) => x.template === 'blank', 'blank stage');
    expect(s.mode).toBe('simple');
    expect(s.scenes).toBe(3);

    // put yourself and Moss on the stage
    await page.click('[data-tool-puppets]');
    await page.click('[data-puppet="me"]');
    await page.click('[data-deselect]');
    await page.click('[data-tool-puppets]');
    await page.click('[data-puppet="moss"]');
    s = await state(page);
    expect(s.actors).toHaveLength(2);
    expect(await smallButtons(page)).toEqual([]);

    // act: Moss jumps, says hello, and walks somewhere (tap the floor; no dragging needed)
    await page.click('[data-record]');
    await waitState(page, (x) => x.recording === true, 'recording');
    await page.click('[data-act="jump"]');
    await page.click('[data-say]');
    await page.click('[data-line="hello"]');
    await tapStage(page, 1000, 640);
    await page.waitForTimeout(600);
    await page.click('[data-record]');
    s = await waitState(page, (x) => x.recording === false, 'cut');
    expect(s.eventKinds).toEqual(['act', 'say', 'move']);

    // the next scene starts with the same cast where they ended up
    await page.click('[data-deselect]');
    await page.click('[data-scene="1"]');
    s = await state(page);
    const moss = (s.actors as string[]).find((a) => a.startsWith('puppet:moss'))!;
    const [mx, my] = moss.split('@')[1].split(',').map(Number);
    expect(Math.abs(mx - 1000)).toBeLessThanOrEqual(3);
    expect(Math.abs(my - 640)).toBeLessThanOrEqual(3);

    // watch the whole show (curtains, every scene, a bow)
    await page.click('[data-show]');
    await waitState(page, (x) => x.showing === true, 'show started');
    await waitState(page, (x) => x.showing === false, 'show finished', 120_000);

    await page.click('[data-save]');
    await page.waitForFunction(() => !!(window as any).__ww.app.profile()?.progress.display.story, null, { timeout: 30_000 });
    await flush(page);
    const prof = await profile(page);
    expect(prof.progress.log.some((l: { text: string }) => /puppet story/.test(l.text))).toBe(true);

    // refresh: the story is still there, with its recording
    await page.reload();
    await chooseProfile(page, 1);
    await waitScene(page, 'stage');
    s = await state(page);
    expect(s.scenes).toBe(3);
    await page.click('[data-scene="0"]');
    expect((await state(page)).eventKinds).toEqual(['act', 'say', 'move']);

    // the poster is up in the clubhouse
    await page.click('[data-hud="home"]');
    await page.click('[data-dialog="map"]');
    await waitScene(page, 'map');
    await page.click('[data-jump="clubhouse"]');
    await waitScene(page, 'clubhouse');
    expect((await state(page)).hasPoster).toBe(true);
    await clickTarget(page, 'frame-story');
    expect(errors).toEqual([]);
  });

  test('More exploring: a story start plays its opening, then more scenes, an alternate ending, intentions, and the simpler strip on request', async ({ page }) => {
    await enterStage(page, 0);
    await page.click('[data-template="two-explorers"]');
    let s = await waitState(page, (x) => x.template === 'two-explorers', 'template chosen');
    expect(s.mode).toBe('full');
    await waitState(page, (x) => x.showing === false && x.playing === false, 'opening played', 90_000);
    s = await state(page);
    expect(s.eventKinds).toEqual(['say', 'say']);

    await page.click('[data-add-scene]');
    await page.click('[data-add-ending]');
    s = await state(page);
    expect(s.scenes).toBe(2);
    expect(s.endings).toBe(1);
    expect(s.ending).toBe(0);

    // give Fizz an intention in the ending
    await clickTarget(page, 'actor-a1');
    await page.click('[data-intents]');
    await page.click('[data-intent="snack"]');
    await page.click('[data-deselect]');
    await flush(page);
    const draft = JSON.parse((await profile(page)).progress.quests['stage-draft'].flags.draft);
    expect(draft.story.endings[0].actors.find((a: { ref: string }) => a.ref === 'fizz').intent).toBe('snack');

    // either child can choose the simpler controls
    await page.click('[data-mode]');
    s = await state(page);
    expect(s.mode).toBe('simple');
    expect(s.scenes).toBe(3);
    expect(s.endings).toBe(0);
    expect(await page.locator('[data-add-scene]').count()).toBe(0);
  });

  test('throwing a story away asks first, and "keep it" keeps it', async ({ page }) => {
    await enterStage(page, 0);
    await page.click('[data-template="invention"]');
    await waitState(page, (x) => x.showing === false && x.playing === false && x.template === 'invention', 'opening played', 90_000);
    await page.click('[data-save]');
    await page.waitForFunction(() => !!(window as any).__ww.app.profile()?.progress.display.story, null, { timeout: 30_000 });
    await page.click('[data-stories]');
    await expect(page.locator('[data-creation]')).toHaveCount(1);
    await page.click('[data-creation] [data-delete]');
    await page.click('[data-dialog="keep"]');
    await expect(page.locator('[data-creation]')).toHaveCount(1);
    await page.click('[data-creation] [data-delete]');
    await page.click('[data-dialog="delete"]');
    await expect(page.locator('[data-creation]')).toHaveCount(0);
  });
});
