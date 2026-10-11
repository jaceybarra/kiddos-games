import { type Page } from '@playwright/test';
import { test, chooseProfile, clickTarget, collectErrors, expect, flush, profile, setupFamily, state, waitScene, waitState } from './helpers';

const BX = 300;
const BY = 70;
const BS = 0.925;

async function boardPoint(page: Page, bx: number, by: number) {
  return page.evaluate(([x, y]) => (window as any).__ww.worldToClient(x, y), [BX + bx * BS, BY + by * BS]) as Promise<{ x: number; y: number }>;
}

async function boardClick(page: Page, bx: number, by: number) {
  const pt = await boardPoint(page, bx, by);
  await page.mouse.click(pt.x, pt.y);
}

async function boardDrag(page: Page, from: [number, number], to: [number, number]) {
  const a = await boardPoint(page, ...from);
  const b = await boardPoint(page, ...to);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) await page.mouse.move(a.x + ((b.x - a.x) * i) / 8, a.y + ((b.y - a.y) * i) / 8);
  await page.mouse.up();
}

async function enterTinker(page: Page, player: number) {
  await setupFamily(page);
  await chooseProfile(page, player);
  await page.click('[data-avatar-done]');
  await waitScene(page, 'windmill-kite');
  await page.click('[data-hud="home"]');
  await page.click('[data-dialog="map"]');
  await waitScene(page, 'map');
  await page.click('[data-jump="tinker"]');
  await waitScene(page, 'tinker');
}

/** The next step is ready to do (the goal has been shown and nobody is mid-result). */
const ready = (page: Page, step: string, label = step) => waitState(page, (s) => !s.busy && s.step === step, label);

/** Press the green button and wait for the try to be talked through. */
async function test_it(page: Page) {
  await page.click('[data-test]');
  await waitState(page, (s) => !!s.running, 'running', 20_000).catch(() => undefined);
  return waitState(page, (s) => !s.running && !!s.outcome, 'try finished', 90_000);
}

async function openProject(page: Page, id: string) {
  await page.click('[data-projects]');
  await page.click(`[data-challenge="${id}"]`);
  await waitState(page, (s) => s.challenge === id && !s.busy, `${id} started`);
}

test.describe('Tinker Grove', () => {
  test('a first visit goes straight to Cloud Mail and guides every step until all three friends have a lantern', async ({ page }) => {
    const errors = collectErrors(page);
    await enterTinker(page, 1); // More help (the youngest)
    let s = await ready(page, 'pick', 'first step: pick the fan');
    expect(s.challenge).toBe('cloud-mail');
    expect(s.picker).toBe(false);
    expect(s.slots).toEqual(['fan@80,440']);
    // the arrow points at the leaf fan in the tray
    expect(s.pointing).toBe('fan');

    // Pip: tap the fan, then the dotted spot, then the green button
    await page.click('[data-part="fan"]');
    s = await ready(page, 'place');
    await clickTarget(page, 'slot-0');
    s = await ready(page, 'play');
    expect(s.parts).toEqual(['fan@80,440,0']);
    expect(s.pointing).toBe('test');
    s = await test_it(page);
    expect((s.outcome as { line: string }).line).toBe('luma.mailDelivered');

    // Rowan: the same fan is dragged up to the new dotted spot
    s = await waitState(page, (x) => (x.options as { pad?: string }).pad === 'rowan' && !x.busy && x.step === 'move', 'Rowan round');
    expect(s.slots).toEqual(['fan@80,200']);
    // a part dropped off the spot stays where it was put…
    await boardDrag(page, [80, 440], [600, 280]);
    s = await ready(page, 'move', 'still to move');
    expect(s.parts).toEqual(['fan@600,280,0']);
    // …and one dropped near the spot clicks into it
    await boardDrag(page, [600, 280], [100, 220]);
    s = await ready(page, 'play', 'Rowan built');
    expect(s.parts).toEqual(['fan@80,200,0']);
    await test_it(page);

    // Fizz: add a second fan
    s = await waitState(page, (x) => (x.options as { pad?: string }).pad === 'fizz' && !x.busy && x.step === 'pick', 'Fizz round');
    expect(s.slots).toEqual(['fan@80,200:filled', 'fan@480,400']);
    await page.click('[data-part="fan"]');
    await ready(page, 'place');
    await clickTarget(page, 'slot-1');
    await ready(page, 'play', 'Fizz built');
    await test_it(page);

    // all delivered: the projects open with the next one glowing
    s = await waitState(page, (x) => !!x.picker, 'projects after the last delivery', 90_000);
    expect(s.pointing).toBe('snail-express');
    expect((s.options as { delivered: string[] }).delivered).toEqual(['pip', 'rowan', 'fizz']);
    await flush(page);
    expect((await profile(page)).progress.done['tinker:cloud-mail']).toBe(1);
    expect(errors).toEqual([]);
  });

  test('a try that does not work shows where it went and suggests one part; copying it works', async ({ page }) => {
    const errors = collectErrors(page);
    await enterTinker(page, 1);
    await ready(page, 'pick');
    await openProject(page, 'acorn-crossing');
    // press the green button with nothing built: splash
    let s = await test_it(page);
    expect((s.outcome as { line: string }).line).toBe('pip.acornSplash');
    // the tip is about the spring, and the next step points at it
    s = await ready(page, 'pick', 'suggested part');
    expect(s.pointing).toBe('spring');
    await page.click('[data-part="spring"]');
    await ready(page, 'place');
    await clickTarget(page, 'slot-0');
    await ready(page, 'play');
    s = await test_it(page);
    expect((s.outcome as { status: string }).status).toBe('success');
    await waitState(page, (x) => !!x.picker, 'projects after success');
    expect(errors).toEqual([]);
  });

  test('More exploring builds its own way, gets a clue after a try that does not work, and the build is kept', async ({ page }) => {
    const errors = collectErrors(page);
    await enterTinker(page, 0); // More exploring
    await ready(page, 'pick');
    await openProject(page, 'acorn-crossing');
    let s = await ready(page, 'free', 'build your own way');
    expect(s.slots).toEqual([]);
    await page.click('[data-part="plank"]');
    await boardClick(page, 700, 600);
    await page.click('[data-part="plank"]');
    await boardClick(page, 940, 600);
    expect((await state(page)).parts).toEqual(['plank@700,600,0', 'plank@940,600,0']);
    await page.click('[data-save]');
    await page.waitForFunction(() => !!(window as any).__ww.app.profile()?.progress.display.invention, null, { timeout: 30_000 });
    s = await test_it(page);
    expect((s.outcome as { status: string }).status).toBe('success');
    await waitState(page, (x) => !!x.picker, 'projects after success');
    await flush(page);
    const prof = await profile(page);
    expect(prof.progress.done['tinker:acorn-crossing']).toBe(1);
    expect(prof.progress.display.invention).toBeTruthy();

    // refresh: the project and its build come back where we left them
    await page.reload();
    await chooseProfile(page, 0);
    await waitScene(page, 'tinker');
    s = await waitState(page, (x) => x.challenge === 'acorn-crossing', 'resumed');
    expect(s.parts).toEqual(['plank@700,600,0', 'plank@940,600,0']);
    await page.click('[data-shelf]');
    await expect(page.locator('[data-creation]')).toHaveCount(1);
    await page.click('[aria-label="Close"]');

    // an empty Snail Express board: Dot stops halfway, and a clue appears (a dotted spot for the suggested part)
    await openProject(page, 'snail-express');
    s = await test_it(page);
    expect((s.outcome as { status: string }).status).not.toBe('success');
    s = await waitState(page, (x) => !x.busy && (x.slots as string[]).length > 0, 'clue shown');
    expect(['pick', 'move']).toContain(s.step);

    // the clubhouse shows the real invention
    await page.click('[data-hud="home"]');
    await page.click('[data-dialog="map"]');
    await waitScene(page, 'map');
    await page.click('[data-jump="clubhouse"]');
    await waitScene(page, 'clubhouse');
    expect((await state(page)).hasInvention).toBe(true);
    expect(errors).toEqual([]);
  });

  test('keyboard: nudge a selected part; undo brings it back', async ({ page }) => {
    await enterTinker(page, 0);
    await ready(page, 'pick');
    await openProject(page, 'free');
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
    await enterTinker(page, 0);
    await ready(page, 'pick');
    await openProject(page, 'free');
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
