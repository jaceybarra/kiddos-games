import { expect, test, type Page } from '@playwright/test';
import { drag, driveToLessonLog, noProblems, openAll, openGame, save, startDriver, startFirstMission, state, stopDriver, tap, tapTarget, waitScene, waitState } from './play';

/**
 * The three missions, played for real: every solution and route variant,
 * with both wheel types (acceptance 2–5). Screenshots of the key moments
 * go to garage/docs/screenshots when SHOTS=1.
 */
const SHOTS = process.env.SHOTS === '1';
async function shot(page: Page, name: string): Promise<void> {
  if (SHOTS) await page.screenshot({ path: `garage/docs/screenshots/${name}.png` });
}

async function finishMission(page: Page, end: 'garage' | 'replay' | 'done' = 'garage', shotName?: string): Promise<void> {
  await waitScene(page, 'result', 90_000);
  if (shotName) {
    await page.waitForTimeout(700);
    await shot(page, `${shotName}-celebration`);
  }
  await waitState(page, "s.stage === 'choices'", 30_000);
  if (shotName) {
    await page.waitForTimeout(500);
    await shot(page, shotName);
  }
  await tap(page, `end-${end}`);
}

async function pickWheels(page: Page, wheel: 'chunky' | 'spring'): Promise<void> {
  await tap(page, 'tab-wheel');
  await tap(page, `opt-wheel-${wheel}`);
  await page.waitForFunction((w) => window.__garage!.save().truck.wheel === w, wheel);
  await tap(page, 'tab-wheel');
}

async function buildAndTest(page: Page, moves: { piece: string; socket: string; how?: 'drag' | 'tap' }[]): Promise<void> {
  await waitState(page, "s.phase === 'building' && s.build && s.build.open", 60_000);
  for (const m of moves) {
    if (m.how === 'tap') {
      await tapTarget(page, `tray-${m.piece}`);
      await tapTarget(page, `socket-${m.socket}`);
    } else await drag(page, `tray-${m.piece}`, `socket-${m.socket}`);
    await waitState(page, `s.build.placed.includes('${m.socket}:${m.piece}')`, 10_000);
  }
  await tap(page, 'hud-test');
}

test('mission 1, first launch: one Play, jump lesson, bridge build, wagon crosses, pennant, end choices (chunky)', async ({ browser }) => {
  const s = await openGame(browser);
  const { page } = s;
  await waitScene(page, 'garage');
  await shot(page, 'garage-door');
  await startFirstMission(page);
  // the gas lesson: a hand rests on the gas pedal until it's pressed
  await waitState(page, 's.gasLesson && !s.held', 30_000);
  await shot(page, 'gas-lesson');
  // the jump lesson: the gas held with a real pointer, then the first jump is a real tap on the big DOM button
  await driveToLessonLog(page);
  expect((await state(page)).gasLesson).toBe(false);
  await shot(page, 'driving-log');
  await tap(page, 'jump');
  await waitState(page, 's.x > 1300', 10_000);
  await startDriver(page);
  await waitState(page, "s.phase === 'building'", 90_000);
  await stopDriver(page);
  await waitState(page, 's.build && s.build.open', 20_000);
  await shot(page, 'build-stream');
  await buildAndTest(page, [{ piece: 'bridge', socket: 'span' }]);
  await waitState(page, "s.phase === 'resolving'", 30_000);
  await waitState(page, "s.phase === 'driving'", 30_000);
  await startDriver(page);
  await finishMission(page, 'garage', 'ending');
  await waitScene(page, 'garage');
  await page.waitForTimeout(1200);
  await shot(page, 'garage-inside');
  const sv = await save(page);
  expect(sv.progress.completed).toEqual(['wobbly-bridge']);
  expect(sv.progress.rewards).toEqual(['pennant']);
  noProblems(s);
  await s.context.close();
});

test('mission 1 with a ramp-and-landing route, placed by tap-then-target, with spring wheels', async ({ browser }) => {
  const s = await openGame(browser);
  const { page } = s;
  await startFirstMission(page);
  // leave straight away and come back with spring wheels from the garage
  await tap(page, 'hud-pause');
  await tap(page, 'pause-garage');
  await waitScene(page, 'garage');
  await pickWheels(page, 'spring');
  await tap(page, 'mission-wobbly-bridge');
  await waitScene(page, 'mission');
  await startDriver(page);
  await waitState(page, "s.phase === 'building'", 120_000);
  await stopDriver(page);
  expect((await state(page)).wheel).toBe('spring');
  await buildAndTest(page, [{ piece: 'ramp', socket: 'launch', how: 'tap' }]);
  await waitState(page, "s.phase === 'driving'", 60_000);
  await startDriver(page);
  await finishMission(page, 'done');
  await waitScene(page, 'garage');
  expect((await save(page)).progress.completed).toEqual(['wobbly-bridge']);
  noProblems(s);
  await s.context.close();
});

for (const wheel of ['chunky', 'spring'] as const) {
  test(`mission 2, take turns, then replay with another path (${wheel})`, async ({ browser }) => {
    // two whole drives at the software renderer's ~8 fps
    test.setTimeout(600_000);
    const s = await openGame(browser);
    const { page } = s;
    await openAll(page);
    await pickWheels(page, wheel);
    await tap(page, 'mission-ramp-we-share');
    await waitScene(page, 'mission');
    await startDriver(page);
    await page.locator('[data-testid="choice-turns"]').waitFor({ timeout: 90_000 });
    await shot(page, `choice-ramp-${wheel}`);
    await tap(page, 'choice-turns');
    await finishMission(page, 'replay');
    await waitScene(page, 'mission');
    await startDriver(page);
    await page.locator('[data-testid="choice-path"]').waitFor({ timeout: 90_000 });
    await tap(page, 'choice-path');
    await stopDriver(page);
    await buildAndTest(page, [{ piece: 'bridge', socket: 'front-span' }]);
    await waitState(page, "s.phase === 'driving' && s.lane === 'front'", 60_000);
    await startDriver(page);
    await finishMission(page, 'garage');
    const sv = await save(page);
    expect(sv.progress.rewards).toContain('twin-ramp');
    noProblems(s);
    await s.context.close();
  });

  test(`mission 3, gentle route then the jump route, final bridge + ramp build (${wheel})`, async ({ browser }) => {
    // two whole drives at the software renderer's ~8 fps
    test.setTimeout(600_000);
    const s = await openGame(browser);
    const { page } = s;
    await openAll(page);
    await pickWheels(page, wheel);
    for (const route of ['gentle', 'jump'] as const) {
      await tap(page, 'mission-everyone-rally');
      await waitScene(page, 'mission');
      await startDriver(page);
      await page.locator(`[data-testid="route-${route}"]`).waitFor({ timeout: 90_000 });
      await tap(page, `route-${route}`);
      await waitState(page, `s.lane === '${route === 'jump' ? 'back' : 'front'}'`, 10_000);
      await waitState(page, "s.phase === 'building'", 120_000);
      await stopDriver(page);
      await buildAndTest(page, [
        { piece: 'bridge', socket: 'span' },
        { piece: route === 'jump' ? 'pad' : 'ramp', socket: 'climb' },
      ]);
      await waitState(page, "s.phase === 'driving'", 60_000);
      await startDriver(page);
      await finishMission(page, 'garage');
      await waitScene(page, 'garage');
    }
    expect((await save(page)).progress.rewards).toContain('crew-banner');
    noProblems(s);
    await s.context.close();
  });
}
