import {
  test,
  chooseProfile,
  clickChoice,
  clickTarget,
  collectErrors,
  expect,
  flush,
  playIntro,
  profile,
  sceneKey,
  setupFamily,
  state,
  targets,
  tieAndDecorate,
  untangle,
  waitScene,
  waitState,
  walkUntilVisible,
} from './helpers';
import type { Page } from '@playwright/test';

/** The "next thing" marker the scene is showing (exposed by the scene's inspect()). */
const next = async (p: Page) => (await state(p)).next as string | null;
const visibleChoices = (p: Page) => p.$$eval('[data-choice]', (els) => els.filter((e) => (e as HTMLElement).offsetParent !== null).map((e) => e.getAttribute('data-choice')));

test.describe('The Windmill Kite', () => {
  test('More exploring: Pip asks → launcher first → miss → no-nest landing → flag → nest → mix-up → caught → decorated kite', async ({ page }) => {
    const errors = collectErrors(page);
    await setupFamily(page);
    await chooseProfile(page, 0); // first player starts on "More exploring"
    // avatar picker is pictures only
    await page.click('[data-species="fox"]');
    await page.click('[data-color="berry"]');
    await page.click('[data-avatar-done]');
    await playIntro(page);
    expect((await state(page)).preset).toBe('more-exploring');

    // Pip asks for help straight away: three answers, each with a picture
    await page.waitForSelector('[data-choice="ASK_TOGETHER"]');
    expect(await page.$$eval('[data-choice]', (els) => els.every((e) => !!e.querySelector('svg')))).toBe(true);
    expect(await visibleChoices(page)).toEqual(['ACCEPT', 'ASK_TOGETHER', 'DECLINE']);
    await clickChoice(page, 'ACCEPT');
    // the nest is taught first: it's the next thing marked
    await waitState(page, (s) => s.pip === 'childTurn' && s.next === 'nest', 'turn handed over, nest first');

    // a six-year-old may still go straight to the launcher
    await clickTarget(page, 'launcher');
    await waitState(page, (s) => s.mode === 'aiming', 'aiming');
    // first attempt reveals the wind (no forced failure: we chose a high arrow)
    await clickTarget(page, 'angle-62');
    await waitState(page, (s) => s.next === 'bellows', 'red pump marked');
    await clickTarget(page, 'bellows');
    await waitState(page, (s) => s.mode === 'launching', 'launching');
    await waitState(page, (s) => s.mode === 'aiming' && s.aimAngle === null, 'missed, pick another arrow');

    await clickTarget(page, 'angle-46');
    await clickTarget(page, 'bellows');
    await waitState(page, (s) => s.mode === 'falling', 'kite falling');
    // no nest yet: it lands on the grass, a flag marks the spot, the breeze returns it,
    // and the next step is the nest (never straight back to aiming)
    const afterMiss = await waitState(page, (s) => s.mode === 'explore' && !s.kiteFree, 'kite blown back');
    expect((afterMiss.flags as { flagX: number }).flagX).toBeGreaterThan(1900);
    await waitState(page, (s) => s.next === 'nest', 'nest marked after the landing');
    await page.waitForTimeout(2500);
    expect((await state(page)).mode).toBe('explore');

    await clickTarget(page, 'nest');
    await waitState(page, (s) => s.mode === 'choosingSpot', 'choosing spot');
    expect((await targets(page)).filter((t) => t.id.startsWith('spot-'))).toHaveLength(4);
    // the spot by the flag is the one marked
    expect(await next(page)).toBe('spot-2170');
    await clickTarget(page, 'spot-2170');
    await waitState(page, (s) => s.mode === 'mixup', 'wagon rolled into the spool');
    await page.waitForSelector('[data-choice="help"]');
    await clickChoice(page, 'sorry');
    await untangle(page);
    // after the repair: a clear next step
    await waitState(page, (s) => s.next === 'launcher', 'launcher marked after the repair');

    await clickTarget(page, 'launcher');
    await waitState(page, (s) => s.mode === 'aiming', 'aiming again');
    await clickTarget(page, 'angle-46');
    await clickTarget(page, 'bellows');
    await tieAndDecorate(page, 'dots', 'plum');

    await flush(page);
    const prof = await profile(page);
    expect(prof.progress.quests['windmill-kite'].status).toBe('done');
    expect(prof.progress.quests['windmill-kite'].completions).toBe(1);
    expect(prof.progress.souvenirs['kite-tail'].data).toEqual({ pattern: 'dots', color: 'plum' });
    expect(prof.progress.log.at(-1).text).toMatch(/launcher.*accepted Pip.s invitation.*said sorry/);
    expect(errors).toEqual([]);
  });

  test('More help: one obvious path (nest first, no mix-up tray), windmill route, refresh mid-quest, no duplicate rewards', async ({ page }) => {
    const errors = collectErrors(page);
    await setupFamily(page);
    await chooseProfile(page, 1); // second player starts on "More help"
    await page.click('[data-avatar-done]');
    await playIntro(page);
    expect((await state(page)).preset).toBe('more-help');

    // two answers with More help
    await page.waitForSelector('[data-choice="ACCEPT"]');
    expect(await visibleChoices(page)).toEqual(['ACCEPT', 'DECLINE']);
    await clickChoice(page, 'ACCEPT');
    await waitState(page, (s) => s.pip === 'childTurn' && s.next === 'nest', 'nest first');
    // tapping the launcher first: Pip points back to the nest (one path for four-year-olds)
    await clickTarget(page, 'launcher');
    await page.waitForTimeout(2000);
    expect((await state(page)).mode).toBe('explore');
    expect(await next(page)).toBe('nest');

    await clickTarget(page, 'nest');
    await waitState(page, (s) => s.mode === 'choosingSpot', 'choosing spot');
    const spots = (await targets(page)).filter((t) => t.id.startsWith('spot-')).map((t) => t.id).sort();
    expect(spots).toEqual(['spot-2170', 'spot-2520']);
    // the marker sits where the dotted path ends (launcher route)
    expect(await next(page)).toBe('spot-2170');
    await clickTarget(page, 'spot-2520');
    await waitState(page, (s) => s.mode === 'mixup' || s.mode === 'repair', 'mix-up');
    // no choice tray for four-year-olds: straight to tapping the red loops
    await untangle(page);
    expect(await visibleChoices(page)).toEqual([]);
    await flush(page);

    // refresh in the middle of the quest
    await page.reload();
    await chooseProfile(page, 1);
    await waitScene(page, 'windmill-kite');
    const resumed = await waitState(page, (s) => s.mode === 'explore', 'resumed');
    expect(resumed.checkpoint).toBe('hill');
    expect(resumed.nestX).toBe(2520);
    expect((resumed.flags as { mixup: string }).mixup).toBe('fixed');
    await waitState(page, (s) => s.next === 'launcher', 'resumed with a next step');

    // solo mechanical route: carry a pumpkin to the stiff brake lever
    await walkUntilVisible(page, 'pumpkin', 1);
    await clickTarget(page, 'pumpkin');
    await waitState(page, (s) => !!s.carrying && s.next === 'lever', 'carrying pumpkin, lever marked');
    await clickTarget(page, 'lever');
    await waitState(page, (s) => s.mode === 'falling', 'kite slips off the turning sail');
    await tieAndDecorate(page, 'leaves', 'sun');
    expect(((await state(page)).flags as { route: string }).route).toBe('windmill');

    await clickChoice(page, 'map');
    await waitScene(page, 'map');
    await page.click('[data-hud="finish"]');
    await page.waitForSelector('[data-closing-done]');
    await page.click('[data-closing-done]');

    await page.reload();
    await chooseProfile(page, 1);
    await waitScene(page, 'map');
    expect(await sceneKey(page)).toBe('map');
    const prof = await profile(page);
    expect(prof.progress.quests['windmill-kite'].completions).toBe(1);
    expect(Object.keys(prof.progress.souvenirs)).toEqual(['kite-tail']);
    expect(prof.progress.log.filter((l: { text: string }) => l.text.includes('Windmill Kite'))).toHaveLength(1);
    expect(errors).toEqual([]);
  });

  test('saying "not now" is fine, Pip never pops a tray over another step, and a wave works later', async ({ page }) => {
    const errors = collectErrors(page);
    await setupFamily(page);
    await chooseProfile(page, 0);
    await page.click('[data-avatar-done]');
    await playIntro(page);
    await clickChoice(page, 'DECLINE');
    const b = await waitState(page, (s) => s.pip === 'resting', 'Pip okay with "not now"');
    expect((b.flags as { approaches: string }).approaches).toContain('not now');
    expect((await targets(page)).map((t) => t.id)).not.toContain('angle-46');

    // choosing a nest spot right next to Pip: Pip waits (no practice shot, no invitation on top of the spots)
    await clickTarget(page, 'nest');
    await waitState(page, (s) => s.mode === 'choosingSpot', 'choosing spot');
    await page.waitForTimeout(25_000);
    expect((await state(page)).mode).toBe('choosingSpot');
    expect(await visibleChoices(page)).toEqual([]);
    await clickTarget(page, 'spot-2340');
    await page.waitForSelector('[data-choice="fix"]');
    await clickChoice(page, 'fix');
    await untangle(page);

    // later, a nonverbal wave: "one more go", then the turn
    await clickTarget(page, 'pip');
    await clickChoice(page, 'WAVE');
    const a = await waitState(page, (s) => s.pip === 'childTurn', 'turn after waving', 120_000);
    expect((a.flags as { approaches: string }).approaches).toContain('waved for a turn');
    await waitState(page, (s) => s.next === 'launcher' || s.next === 'nest', 'a next step after the turn');
    expect(errors).toEqual([]);
  });
});
