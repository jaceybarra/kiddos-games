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

/** The next-thing marker sits on this page button. */
async function markerOn(page: Page, selector: string) {
  await page.waitForFunction(
    (sel) => {
      const m = document.querySelector('.st-marker') as HTMLElement | null;
      const el = document.querySelector(sel);
      if (!m || m.hidden || !el) return false;
      const r = m.querySelector('.st-ring')!.getBoundingClientRect();
      const b = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      return Math.abs(cx - (b.left + b.width / 2)) < 4 && Math.abs(cy - (b.top + b.height / 2)) < 4;
    },
    selector,
    { timeout: 30_000 },
  );
}

/** What Rowan has asked to be said so far (every line goes through the voice player). */
async function heard(page: Page): Promise<string[]> {
  return page.evaluate(() => ((window as any).__ww.voiceLog() as { text: string }[]).map((l) => l.text));
}

test.describe('Story Stage', () => {
  test.setTimeout(600_000);

  test('More help: a short guided path — friend on, red button, wave, stop, watch with applause, next picture, the whole show, keep it — and it is still there after a refresh and as a clubhouse poster', async ({ page }) => {
    const errors = collectErrors(page);
    await enterStage(page, 1);
    // fewer story starts, and Rowan says what to do with the marker on the first one
    await expect(page.locator('[data-template]')).toHaveCount(3);
    await markerOn(page, '[data-template]');
    expect((await state(page)).step).toBe('pick');

    await page.click('[data-template="blank"]');
    let s = await waitState(page, (x) => x.template === 'blank' && x.step === 'add-s0', 'blank stage');
    expect(s.mode).toBe('simple');
    expect(s.scenes).toBe(3);
    // fewer tools at once
    for (const sel of ['[data-tool-backdrop]', '[data-stories]', '[data-mode]', '[data-show]']) await expect(page.locator(sel)).toBeHidden();
    await markerOn(page, '[data-tool-puppets]');

    // put yourself and Moss on the stage
    await page.click('[data-tool-puppets]');
    await waitState(page, (x) => x.step === 'pickPuppet', 'puppet drawer');
    await page.click('[data-puppet="me"]');
    await page.click('[data-deselect]');
    await page.click('[data-tool-puppets]');
    await page.click('[data-puppet="moss"]');
    s = await waitState(page, (x) => x.step === 'record-s0', 'red button next');
    expect(s.actors).toHaveLength(2);
    await markerOn(page, '[data-record]');
    expect(await smallButtons(page)).toEqual([]);

    // act: Moss jumps, says hello, and walks somewhere (tap the floor; no dragging needed)
    await page.click('[data-record]');
    await waitState(page, (x) => x.recording === true && x.step === 'wave-s0', 'recording, Moss picked');
    await markerOn(page, '[data-act="wave"]');
    // putting things on the stage waits while acting, and says so
    await page.click('[data-tool-props]', { force: true });
    expect((await state(page)).drawer).toBeNull();
    await page.click('[data-act="jump"]');
    await waitState(page, (x) => x.step === 'stop-s0', 'stop next');
    await page.click('[data-say]');
    await page.click('[data-line="hello"]');
    await tapStage(page, 1000, 640);
    await page.waitForTimeout(600);
    await page.click('[data-record]');
    s = await waitState(page, (x) => x.recording === false && x.step === 'watch-s0', 'cut');
    expect(s.eventKinds).toEqual(['act', 'say', 'move']);
    await markerOn(page, '[data-play]');

    // watch it: curtains, the acting, applause and a bow; then the next picture is marked
    await page.click('[data-play]');
    await waitState(page, (x) => x.showing === true, 'watching');
    s = await waitState(page, (x) => x.showing === false && x.step === 'next-1', 'watched', 180_000);
    await markerOn(page, '[data-scene="1"]');

    // the next scene starts with the same cast where they ended up
    await page.click('[data-scene="1"]');
    s = await waitState(page, (x) => x.scene === 1 && x.step === 'record-s1', 'scene 2');
    const moss = (s.actors as string[]).find((a) => a.startsWith('puppet:moss'))!;
    const [mx, my] = moss.split('@')[1].split(',').map(Number);
    expect(Math.abs(mx - 1000)).toBeLessThanOrEqual(3);
    expect(Math.abs(my - 640)).toBeLessThanOrEqual(3);

    // second picture: the red button, then the first friend (marked on the stage), then a move
    await page.click('[data-record]');
    s = await waitState(page, (x) => x.recording === true && String(x.step).startsWith('tap-s1-'), 'tap a friend');
    await clickTarget(page, `actor-${String(s.step).split('-').pop()}`);
    await waitState(page, (x) => x.step === 'wave-s1', 'friend picked');
    await page.click('[data-act="wave"]');
    await page.click('[data-record]');
    await waitState(page, (x) => x.recording === false && x.events === 1, 'second picture acted');

    // two pictures make a show: the whole-show button appears; watch it (curtains, every picture, a curtain call)
    await expect(page.locator('[data-show]')).toBeVisible();
    await page.click('[data-show]');
    await waitState(page, (x) => x.showing === true, 'show started');
    s = await waitState(page, (x) => x.showing === false && x.step === 'keep', 'show finished', 240_000);
    expect(s.showSeen).toBe(true);
    await markerOn(page, '[data-save]');

    await page.click('[data-save]');
    await page.waitForFunction(() => !!(window as any).__ww.app.profile()?.progress.display.story, null, { timeout: 30_000 });
    await waitState(page, (x) => x.saved === true && x.step === 'free', 'saved');
    await flush(page);
    const prof = await profile(page);
    expect(prof.progress.log.some((l: { text: string }) => /puppet story/.test(l.text))).toBe(true);
    const lines = await heard(page);
    for (const l of ['Tap the orange puppet button to pick a friend.', 'Tap the big red button and act it out!', 'Cut! Tap the green play button to watch it.', 'Bravo! Everyone, take a bow!', 'Your story is on your shelf!']) expect(lines).toContain(l);

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

  test('More exploring: a story start plays, then "your turn" on the next picture; a spoken question before acting a picture again; more scenes, an alternate ending, intentions, and the simpler strip on request', async ({ page }) => {
    await enterStage(page, 0);
    await expect(page.locator('[data-template]')).toHaveCount(5);
    await page.click('[data-template="two-explorers"]');
    let s = await waitState(page, (x) => x.template === 'two-explorers', 'template chosen');
    expect(s.mode).toBe('full');
    // the story start plays as a little show, then it's the child's turn on picture two, naming who to tap
    s = await waitState(page, (x) => x.showing === false && x.step === 'record-s1', 'your turn', 180_000);
    expect(s.scenes).toBe(2);
    expect(s.scene).toBe(1);
    expect(await heard(page)).toContain('Your turn! Tap the big red button, then tap Fizz to make Fizz wave!');
    await markerOn(page, '[data-record]');

    // the story start is kept; acting it again asks first (out loud), and "keep it" keeps it
    await page.click('[data-scene="0"]');
    expect((await state(page)).eventKinds).toEqual(['say', 'say']);
    await page.click('[data-record]');
    await waitState(page, (x) => x.asking === true, 'asked');
    await page.click('[data-choice="keep"]', { timeout: 60_000 });
    s = await waitState(page, (x) => x.asking === false, 'answered');
    expect(s.recording).toBe(false);
    expect(s.eventKinds).toEqual(['say', 'say']);
    expect(await heard(page)).toContain('Act this picture again? The old one goes away.');

    await page.click('[data-scene="1"]');
    await page.click('[data-add-scene]');
    await page.click('[data-add-ending]');
    s = await state(page);
    expect(s.scenes).toBe(3);
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
    await waitState(page, (x) => x.showing === false && x.template === 'invention' && x.step === 'record-s1', 'opening played', 180_000);
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

  test('a saved story can be swapped for a new story start (the old one waits on the shelf)', async ({ page }) => {
    await enterStage(page, 0);
    await page.click('[data-template="join-game"]');
    await waitState(page, (x) => x.showing === false && x.step === 'record-s1', 'opening played', 180_000);
    await page.click('[data-save]');
    await waitState(page, (x) => x.saved === true, 'saved');
    await page.click('[data-new]');
    await expect(page.locator('[data-mystories]')).toHaveCount(1);
    await page.click('[data-template="blank"]');
    const s = await waitState(page, (x) => x.template === 'blank' && x.step === 'add-s0', 'new blank story');
    expect(s.saved).toBe(false);
    expect(s.editing).toBeNull();
  });
});
