import { test, type Page } from '@playwright/test';
import { chooseProfile, clickChoice, clickTarget, collectErrors, expect, flush, profile, setupFamily, state, waitScene, waitState } from './helpers';

async function enterPicnic(page: Page, player: number) {
  await setupFamily(page);
  await chooseProfile(page, player);
  await page.click('[data-avatar-done]');
  await waitScene(page, 'windmill-kite');
  await page.click('[data-hud="home"]');
  await page.click('[data-dialog="map"]');
  await waitScene(page, 'map');
  await page.click('[data-jump="picnic"]');
  await waitScene(page, 'picnic');
  await page.waitForSelector('[data-scenario]');
}

const notBusy = (page: Page) => waitState(page, (s) => !s.busy, 'not busy');

async function knead(page: Page) {
  for (let i = 0; i < 8; i++) {
    const ids = await page.evaluate(() => (window as any).__ww.targets().map((t: { id: string }) => t.id));
    if (!ids.includes('dough')) {
      if ((await state(page)).step === 'cut') return;
      await page.waitForTimeout(300);
      continue;
    }
    await clickTarget(page, 'dough');
    await page.waitForTimeout(300);
  }
  await waitState(page, (s) => s.step === 'cut', 'dough rolled');
}

async function serveFirstTo(page: Page, guest: string) {
  await notBusy(page);
  await clickTarget(page, 'tray-0');
  await clickTarget(page, `guest-${guest}`);
}

test.describe('Picnic Parade', () => {
  test('More help, music picnic: seat friends, talk about the loud drum, cook, serve, parade, and see the snacks in the clubhouse', async ({ page }) => {
    const errors = collectErrors(page);
    await enterPicnic(page, 1);
    await page.click('[data-scenario="music"]');
    await waitState(page, (s) => s.phase === 'setup', 'setup');
    expect((await state(page)).preset).toBe('more-help');
    // Luma asked for a quiet seat; put her by the drum anyway and see what happens
    await clickTarget(page, 'guest-luma');
    await clickTarget(page, 'cushion-2');
    await notBusy(page);
    await clickTarget(page, 'guest-rowan');
    await clickTarget(page, 'cushion-0');
    // two clear options on More help, and moving her works
    await page.waitForSelector('[data-choice="move"]', { timeout: 90_000 });
    await expect(page.locator('[data-choice]')).toHaveCount(2);
    await clickChoice(page, 'move');
    await waitState(page, (s) => (s.seats as Record<string, number>).luma === 0, 'Luma moved to the quiet cushion');

    // a soft cookie for Luma
    await page.click('[data-station="dough"]');
    await knead(page);
    await clickTarget(page, 'cutter-round');
    await clickChoice(page, 'soft');
    await waitState(page, (s) => (s.tray as string[]).length === 1, 'cookie on the tray');
    await serveFirstTo(page, 'luma');
    await waitState(page, (s) => !!(s.happy as Record<string, string>).luma, 'Luma happy');

    // berry juice for Rowan
    await page.click('[data-station="juice"]');
    await clickTarget(page, 'fruit-berry');
    await notBusy(page);
    await clickTarget(page, 'blend');
    await waitState(page, (s) => s.step === 'cup', 'blended');
    await clickTarget(page, 'cup-small');
    await waitState(page, (s) => s.step === 'pour', 'cup chosen');
    await clickTarget(page, 'jug');
    await page.waitForTimeout(1200);
    await clickTarget(page, 'cup');
    await waitState(page, (s) => (s.tray as string[]).length === 1, 'juice on the tray');
    await serveFirstTo(page, 'rowan');
    await waitState(page, (s) => !!(s.happy as Record<string, string>).rowan, 'Rowan happy');

    await notBusy(page);
    await clickTarget(page, 'bell');
    await waitState(page, (s) => s.phase === 'done', 'parade finished', 180_000);
    await flush(page);
    const prof = await profile(page);
    expect(prof.progress.done['picnic:music']).toBe(1);
    expect(prof.progress.display.picnic).toBeTruthy();
    expect(prof.progress.log.some((l: { text: string }) => /Music Picnic/.test(l.text))).toBe(true);

    await clickChoice(page, 'map');
    await waitScene(page, 'map');
    await page.click('[data-jump="clubhouse"]');
    await waitScene(page, 'clubhouse');
    expect((await state(page)).hasPicnic).toBe(true);
    expect(errors).toEqual([]);
  });

  test('More exploring, windy picnic: light things blow away, a not-quite cookie can be kept, and a refresh resumes the picnic', async ({ page }) => {
    await enterPicnic(page, 0);
    await page.click('[data-scenario="windy"]');
    await waitState(page, (s) => s.phase === 'setup', 'setup');
    await clickTarget(page, 'weight-feather');
    await clickTarget(page, 'corner-0');
    await page.waitForTimeout(800);
    await notBusy(page);
    expect((await state(page)).weights).toEqual([null, null, null, null]);
    for (const [w, c] of [['stone', 0], ['teapot', 1], ['book', 2], ['pumpkin', 3]] as const) {
      await notBusy(page);
      await clickTarget(page, `weight-${w}`);
      await clickTarget(page, `corner-${c}`);
    }
    await page.waitForSelector('[data-choice="moss"]', { timeout: 90_000 });
    await expect(page.locator('[data-choice]')).toHaveCount(3);
    await clickChoice(page, 'cushions');
    await waitState(page, (s) => s.phase === 'cook', 'cooking');

    // Pip wants crunchy; make a soft one and keep it for yourself
    await page.click('[data-station="dough"]');
    await knead(page);
    await clickTarget(page, 'cutter-star');
    await clickChoice(page, 'soft');
    await waitState(page, (s) => (s.tray as string[]).length === 1, 'cookie on the tray');
    await serveFirstTo(page, 'pip');
    await page.waitForSelector('[data-choice="keep"]', { timeout: 60_000 });
    expect(await page.locator('[data-choice="try"]').count()).toBe(1);
    await clickChoice(page, 'keep');
    // Pip asks for a bite; "no thanks" is a fine answer
    await clickChoice(page, 'no');
    await waitState(page, (s) => !!s.mine && !s.busy, 'kept');
    let s = await state(page);
    expect(s.mine).toBe('soft star cookie');
    expect(s.happy).toEqual({});

    await flush(page);
    await page.reload();
    await chooseProfile(page, 0);
    await waitScene(page, 'picnic');
    s = await waitState(page, (x) => x.phase === 'cook', 'resumed');
    expect(s.mine).toBe('soft star cookie');
    expect(s.windbreak).toBe('cushions');
    expect(s.weights).toEqual(['stone', 'teapot', 'book', 'pumpkin']);

    // now the crunchy one Pip asked for
    await page.click('[data-station="dough"]');
    await knead(page);
    await clickTarget(page, 'cutter-star');
    await clickChoice(page, 'crunchy');
    await waitState(page, (x) => (x.tray as string[]).length === 1, 'crunchy cookie');
    await serveFirstTo(page, 'pip');
    await waitState(page, (x) => (x.happy as Record<string, string>).pip === 'yum', 'Pip happy');

    // a big cucumber sandwich: tap a filling, then where to drop it
    await page.click('[data-station="stack"]');
    for (const f of ['cucumber', 'cheese', 'tomato']) {
      await notBusy(page);
      await clickTarget(page, `filling-${f}`);
      await clickTarget(page, 'stackzone');
    }
    await notBusy(page);
    await clickTarget(page, 'topbread');
    await waitState(page, (x) => (x.tray as string[]).length === 1, 'sandwich on the tray');
    // Rowan chases his napkin and bumps the tray; saying it's okay is one fine answer
    await clickChoice(page, 'fine');
    await waitState(page, (x) => x.mixup === 'done' && !x.busy, 'mix-up resolved');

    // decorate the (slightly squished) sandwich, then serve it
    await page.click('[data-station="decorate"]');
    await clickTarget(page, 'tray-0');
    await clickTarget(page, 'tool-dots');
    await clickTarget(page, 'decozone');
    await clickTarget(page, 'decozone');
    await clickTarget(page, 'deco-done');
    await waitState(page, (x) => (x.tray as string[])[0]?.includes('big sandwich'), 'decorated');
    await serveFirstTo(page, 'rowan');
    await waitState(page, (x) => !!(x.happy as Record<string, string>).rowan, 'Rowan happy');
    await flush(page);
    const prof = await profile(page);
    const saved = JSON.parse(prof.progress.quests['picnic:windy'].flags.state);
    expect(saved.eaten.rowan.deco.length).toBeGreaterThanOrEqual(2);
    expect(saved.eaten.rowan.squished).toBe(true);
  });

  test('playing together: turns pass between chef and server, and a helper takes over when one player stops', async ({ page }) => {
    await enterPicnic(page, 1);
    await page.click('[data-scenario="lantern"]');
    await waitState(page, (s) => s.phase === 'setup', 'setup');
    for (let i = 0; i < 3; i++) {
      await notBusy(page);
      await clickTarget(page, `lantern-${i}`);
    }
    await waitState(page, (s) => s.phase === 'cook', 'cooking');
    await page.click('[data-together]');
    await page.click('[data-dialog="friend"]');
    await waitState(page, (s) => (s.together as { turn: string } | null)?.turn === 'chef', 'together, chef first');
    await expect(page.locator('.turn-badge')).toBeVisible();

    // the chef makes a lantern cookie; the friends both want the cutter
    await page.click('[data-station="dough"]');
    await knead(page);
    await clickTarget(page, 'cutter-lantern');
    await clickChoice(page, 'turns');
    await clickChoice(page, 'soft');
    await waitState(page, (s) => (s.tray as string[]).length === 1, 'cookie on the tray');
    await waitState(page, (s) => (s.together as { turn: string }).turn === 'server', 'server’s turn');

    // the server wanders off: the chef stays, a helper takes the serving job and carries it over
    await page.click('[data-left]');
    await page.click('[data-dialog="chef"]');
    await waitState(page, (s) => !!(s.happy as Record<string, string>).luma, 'helper served Luma', 120_000);
    await waitState(page, (s) => (s.together as { turn: string }).turn === 'chef', 'back to the chef');
    expect((await state(page)).cutterQueue).toEqual(['fizz']);
  });
});
