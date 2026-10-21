import { expect, test, type Page } from '@playwright/test';
import { noProblems, openAll, openGame, openSettings, startDriver, state, stopDriver, tap, waitScene, waitState } from './play';

/**
 * Driving with the pedals (the default), the free-play Test Track, and the
 * easier "drives itself" grown-up setting, played with real pointer presses
 * on the on-screen pedals.
 */
const SHOTS = process.env.SHOTS === '1';
async function shot(page: Page, name: string): Promise<void> {
  if (SHOTS) await page.screenshot({ path: `garage/docs/screenshots/${name}.png` });
}

/** Press and hold an on-screen control with a real pointer until the state matches. */
async function holdButton(page: Page, testid: string, until: string, timeout = 30_000): Promise<Record<string, any>> {
  const b = (await page.locator(`[data-testid="${testid}"]`).boundingBox())!;
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  try {
    return await waitState(page, until, timeout);
  } finally {
    await page.mouse.up();
  }
}

test('Test Track with the pedals: gas drives, letting go rolls on, the brake stops then backs up, crates smash, jump, finish, replay', async ({ browser }) => {
  const s = await openGame(browser);
  const { page } = s;
  await openAll(page);
  await tap(page, 'playground');
  await waitScene(page, 'mission');
  const start = await waitState(page, "s.mission === 'playground' && !s.held && s.controlsOn", 30_000);
  expect(start.driving).toBe('pedals');
  expect(start.x).toBe(260);
  // big, separate buttons (at least 64 CSS px)
  for (const id of ['gas', 'brake', 'jump']) {
    const b = (await page.locator(`[data-testid="${id}"]`).boundingBox())!;
    expect(Math.min(b.width, b.height), id).toBeGreaterThanOrEqual(64);
  }
  // nothing pressed: it stays put
  await page.waitForTimeout(500);
  expect((await state(page)).x).toBe(260);
  // the gas, held with a finger
  const fast = await holdButton(page, 'gas', 's.vx > 400');
  expect(fast.gasHeld).toBe(true);
  // let go: it rolls on, slowing gently
  await page.waitForTimeout(300);
  const rolling = await state(page);
  expect(rolling.gasHeld).toBe(false);
  expect(rolling.vx).toBeGreaterThan(150);
  // the brake: stops, then (kept held) backs up
  const back = await holdButton(page, 'brake', 's.vx < -50', 20_000);
  expect(back.vx).toBeLessThan(0);
  await waitState(page, 's.vx === 0', 10_000);
  // drive into the first crates
  await holdButton(page, 'gas', 's.smashed >= 3', 30_000);
  await shot(page, 'test-track-crates');
  // a jump tap
  await waitState(page, 's.grounded', 5_000);
  await tap(page, 'jump');
  await waitState(page, '!s.grounded', 5_000);
  // the rest of the track: boost, the big jump, hills, mud, a log, the pad to the deck, the kicker
  await startDriver(page);
  await waitState(page, 's.boosting', 60_000);
  await shot(page, 'test-track-boost');
  await waitState(page, "s.patch === 'mud'", 120_000);
  await shot(page, 'test-track-mud');
  await waitState(page, 's.endChoices', 180_000);
  await stopDriver(page);
  const end = await state(page);
  expect(end.smashed).toBeGreaterThanOrEqual(8);
  // nothing saved from free play (no coins, no rewards), and no misses on the way
  expect(end.coinsShown).toBe(false);
  await tap(page, 'end-replay');
  await waitState(page, "s.mission === 'playground' && s.x === 260 && s.smashed === 0", 30_000);
  await tap(page, 'hud-pause');
  await tap(page, 'pause-garage');
  await waitScene(page, 'garage');
  const sv = await page.evaluate(() => window.__garage!.save());
  expect(sv.progress.coins).toEqual([]);
  expect(sv.resume).toBeNull();
  noProblems(s);
  await s.context.close();
});

test('drives itself (grown-up setting): no gas pedal, the truck drives on its own, the jump lesson works', async ({ browser }) => {
  const s = await openGame(browser);
  const { page } = s;
  await waitScene(page, 'garage');
  await openSettings(page);
  await page.locator('[data-testid="set-driving"]').selectOption('auto');
  await page.waitForFunction(() => window.__garage!.save().settings.driving === 'auto');
  await tap(page, 'settings-close');
  await tap(page, 'play');
  await waitScene(page, 'mission');
  const st = await waitState(page, '!s.held && s.controlsOn', 30_000);
  expect(st.driving).toBe('auto');
  expect(st.gasLesson).toBe(false);
  await expect(page.locator('[data-testid="gas"]')).toBeHidden();
  // it rolls to the lesson log by itself and waits there
  await waitState(page, 's.x > 900 && !s.example && !s.held && s.vx === 0 && s.hazard && s.hazard.kind === "wall"', 60_000);
  await tap(page, 'jump');
  await waitState(page, 's.x > 1300', 10_000);
  // and back to pedals from the grown-up settings
  await tap(page, 'hud-pause');
  await tap(page, 'pause-garage');
  await waitScene(page, 'garage');
  await openSettings(page);
  await page.locator('[data-testid="set-driving"]').selectOption('pedals');
  await page.waitForFunction(() => window.__garage!.save().settings.driving === 'pedals');
  await tap(page, 'settings-close');
  noProblems(s);
  await s.context.close();
});
