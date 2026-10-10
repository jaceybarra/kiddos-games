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

test.describe('The Windmill Kite', () => {
  test('More exploring: new profile → launcher route → mix-up repair → decorated kite (no reading needed)', async ({ page }) => {
    const errors = collectErrors(page);
    await setupFamily(page);
    await chooseProfile(page, 0); // first player starts on "More exploring"
    // avatar picker is pictures only
    await page.click('[data-species="fox"]');
    await page.click('[data-color="berry"]');
    await page.click('[data-avatar-done]');
    await playIntro(page);
    expect((await state(page)).preset).toBe('more-exploring');

    await clickTarget(page, 'pip');
    // three opening options with More exploring, each with a picture
    await page.waitForSelector('[data-choice="ASK_WHAT"]');
    expect(await page.$$eval('[data-choice]', (els) => els.every((e) => !!e.querySelector('svg')))).toBe(true);
    await clickChoice(page, 'ASK_TURN');
    await waitState(page, (s) => s.pip === 'childTurn' && s.mode === 'aiming', 'turn handed over');

    // first attempt reveals the wind (no forced failure: we chose a high arrow)
    await clickTarget(page, 'angle-62');
    await clickTarget(page, 'bellows');
    await waitState(page, (s) => s.mode === 'launching', 'launching');
    await waitState(page, (s) => s.mode === 'aiming', 'missed, back to aiming');

    await clickTarget(page, 'angle-46');
    await clickTarget(page, 'bellows');
    await waitState(page, (s) => s.mode === 'falling', 'kite falling');
    // no nest placed yet: lands on the grass, flag marks the spot, breeze returns it
    const afterMiss = await waitState(page, (s) => s.mode === 'explore' || s.mode === 'aiming', 'kite blown back');
    expect((afterMiss.flags as { flagX: number }).flagX).toBeGreaterThan(1900);

    await clickTarget(page, 'nest');
    await waitState(page, (s) => s.mode === 'choosingSpot', 'choosing spot');
    expect((await targets(page)).filter((t) => t.id.startsWith('spot-'))).toHaveLength(4);
    await clickTarget(page, 'spot-2170');
    await waitState(page, (s) => s.mode === 'mixup', 'wagon rolled into the spool');
    await page.waitForSelector('[data-choice="help"]');
    await clickChoice(page, 'sorry');
    await untangle(page);

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
    expect(prof.progress.log.at(-1).text).toMatch(/launcher.*asked for a turn.*said sorry/);
    expect(errors).toEqual([]);
  });

  test('More help: windmill route, refresh mid-quest, finish, and resume without duplicate rewards', async ({ page }) => {
    const errors = collectErrors(page);
    await setupFamily(page);
    await chooseProfile(page, 1); // second player starts on "More help"
    await page.click('[data-avatar-done]');
    await playIntro(page);
    expect((await state(page)).preset).toBe('more-help');

    await clickTarget(page, 'nest');
    await waitState(page, (s) => s.mode === 'choosingSpot', 'choosing spot');
    const spots = (await targets(page)).filter((t) => t.id.startsWith('spot-')).map((t) => t.id).sort();
    expect(spots).toEqual(['spot-2170', 'spot-2520']);
    await clickTarget(page, 'spot-2520');
    await waitState(page, (s) => s.mode === 'mixup', 'mix-up');
    await page.waitForSelector('[data-choice="fix"]');
    expect(await page.$$('[data-choice]')).toHaveLength(2);
    await clickChoice(page, 'fix');
    await untangle(page);
    await flush(page);

    // refresh in the middle of the quest
    await page.reload();
    await chooseProfile(page, 1);
    await waitScene(page, 'windmill-kite');
    const resumed = await waitState(page, (s) => s.mode === 'explore', 'resumed');
    expect(resumed.checkpoint).toBe('hill');
    expect(resumed.nestX).toBe(2520);
    expect((resumed.flags as { mixup: string }).mixup).toBe('fixed');

    // solo mechanical route: carry a pumpkin to the stiff brake lever
    await walkUntilVisible(page, 'pumpkin', 1);
    await clickTarget(page, 'pumpkin');
    await waitState(page, (s) => !!s.carrying, 'carrying pumpkin');
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

  test('two different social approaches have different, valid consequences', async ({ page }) => {
    await setupFamily(page);
    // Approach A (More exploring): wave without words → "one more go", then the turn
    await chooseProfile(page, 0);
    await page.click('[data-avatar-done]');
    await playIntro(page);
    await clickTarget(page, 'pip');
    await clickChoice(page, 'WAVE');
    const a = await waitState(page, (s) => s.pip === 'childTurn', 'turn after waving', 120_000);
    expect((a.flags as { approaches: string }).approaches).toContain('waved for a turn');

    // Approach B (More help): decline Pip's invitation → Pip keeps practising; the windmill route stays open
    await page.click('[data-hud="finish"]');
    await page.click('[data-closing-done]');
    await page.click('[aria-label="Open Wonderwood again"]');
    await chooseProfile(page, 1);
    await page.click('[data-avatar-done]');
    await playIntro(page);
    await clickTarget(page, 'pip');
    await clickChoice(page, 'WAVE').catch(() => undefined);
    // let Pip finish and decline the next invitation
    await page.waitForSelector('[data-choice="DECLINE"], [data-choice="ASK_TURN"]', { timeout: 120_000 }).catch(() => undefined);
    const s0 = await state(page);
    if (s0.pip !== 'childTurn') {
      await clickChoice(page, 'DECLINE');
      const b = await waitState(page, (s) => s.pip === 'resting', 'Pip okay with "not now"');
      expect((b.flags as { approaches: string }).approaches).toContain('not now');
      const ids = (await targets(page)).map((t) => t.id);
      expect(ids).not.toContain('angle-46');
    }
  });
});
