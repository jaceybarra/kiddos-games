import { test, chooseProfile, clickTarget, expect, playIntro, setupFamily, targets, waitScene, waitState } from './helpers';

test.describe('runtime behaviour', () => {
  test('no network requests leave the device during play', async ({ page, baseURL }) => {
    const external: string[] = [];
    page.on('request', (r) => {
      const u = r.url();
      if (!u.startsWith(baseURL!) && !u.startsWith('data:') && !u.startsWith('blob:')) external.push(u);
    });
    await setupFamily(page);
    await chooseProfile(page, 0);
    await page.click('[data-avatar-done]');
    await playIntro(page);
    await clickTarget(page, 'pip');
    await page.waitForTimeout(2000);
    await page.click('[data-hud="home"]');
    await page.click('[data-dialog="map"]');
    await waitScene(page, 'map');
    expect(external).toEqual([]);
  });

  test('pause stops gameplay and audio; resume continues', async ({ page }) => {
    await setupFamily(page);
    await chooseProfile(page, 0);
    await page.click('[data-avatar-done]');
    await waitScene(page, 'windmill-kite');
    await page.click('[data-hud="pause"]');
    await page.waitForSelector('[data-pause="resume"]');
    expect(await page.evaluate(() => (window as any).__ww.app.paused())).toBe(true);
    expect(['suspended', 'none', 'closed']).toContain(await page.evaluate(() => (window as any).__ww.app.audioState()));
    await page.click('[data-pause="resume"]');
    expect(await page.evaluate(() => (window as any).__ww.app.paused())).toBe(false);
  });

  test('scene changes do not pile up listeners or textures', async ({ page }) => {
    await page.addInitScript(() => {
      const counts: Record<string, number> = {};
      const add = window.addEventListener.bind(window);
      const rem = window.removeEventListener.bind(window);
      window.addEventListener = ((t: string, l: EventListenerOrEventListenerObject, o?: boolean | AddEventListenerOptions) => {
        counts[t] = (counts[t] ?? 0) + 1;
        add(t, l, o);
      }) as typeof window.addEventListener;
      window.removeEventListener = ((t: string, l: EventListenerOrEventListenerObject, o?: boolean | EventListenerOptions) => {
        counts[t] = (counts[t] ?? 0) - 1;
        rem(t, l, o);
      }) as typeof window.removeEventListener;
      (window as any).__listenerCounts = counts;
    });
    await setupFamily(page);
    await chooseProfile(page, 0);
    await page.click('[data-avatar-done]');
    await waitScene(page, 'windmill-kite');
    const go = async (scene: string) => {
      await page.evaluate((s) => (window as any).__ww.app && (window as any).__wwNav?.(s), scene);
    };
    void go;
    const cycle = async () => {
      await page.click('[data-hud="home"]');
      await page.click('[data-dialog="map"]');
      await waitScene(page, 'map');
      await page.click('[data-jump="clubhouse"]');
      await waitScene(page, 'clubhouse');
      await page.click('[data-hud="home"]');
      await page.click('[data-dialog="map"]');
      await waitScene(page, 'map');
      await page.click('[data-jump="windmill-kite"]');
      await waitScene(page, 'windmill-kite');
    };
    await cycle();
    const first = await page.evaluate(() => ({ keydown: (window as any).__listenerCounts.keydown, tex: (window as any).__ww.app.textureCount() }));
    await cycle();
    await cycle();
    const third = await page.evaluate(() => ({ keydown: (window as any).__listenerCounts.keydown, tex: (window as any).__ww.app.textureCount() }));
    expect(third.keydown).toBe(first.keydown);
    expect(third.tex).toBe(first.tex);
  });

  test('keyboard only: choose a profile and launch the glider', async ({ page }) => {
    await setupFamily(page);
    await page.focus('[data-profile]');
    await page.keyboard.press('Enter');
    await page.waitForSelector('[data-avatar-done]');
    await page.focus('[data-avatar-done]');
    await page.keyboard.press('Enter');
    await waitScene(page, 'windmill-kite');
    await page.focus('canvas');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');
    await waitState(page, (s) => s.mode === 'cutscene' || s.mode === 'glider', 'glider thrown by keyboard');
  });

  test('reduced motion is honoured and captions still carry the words', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await setupFamily(page);
    expect(await page.evaluate(() => document.documentElement.classList.contains('reduced-motion'))).toBe(true);
    await chooseProfile(page, 0);
    await page.click('[data-avatar-done]');
    await waitScene(page, 'windmill-kite');
    await expect(page.locator('.captions .text')).toContainText(/glider/i, { timeout: 15_000 });
  });

  test('reminder offers an immediate stop and a single bounded grace period', async ({ page }) => {
    await setupFamily(page);
    await chooseProfile(page, 0);
    await page.click('[data-avatar-done]');
    await waitScene(page, 'windmill-kite');
    await page.evaluate(() => (window as any).__ww.app.testReminder(2, 2));
    await page.waitForSelector('[data-dialog="grace"]', { timeout: 20_000 });
    await expect(page.locator('[data-dialog="finish"]')).toBeVisible();
    await page.click('[data-dialog="grace"]');
    // the grace period ends on its own; then only "finish" is offered — no new task, no snooze
    await page.waitForSelector('[data-dialog="finish"]', { timeout: 20_000 });
    await expect(page.locator('[data-dialog="grace"]')).toHaveCount(0);
    await page.click('[data-dialog="finish"]');
    await page.waitForSelector('[data-closing-done]');
  });

  test('child-facing buttons are at least 56 CSS px', async ({ page }) => {
    await setupFamily(page);
    const small = async () =>
      page.$$eval('.btn-round, .choice, .tile, .card, .swatch, [data-profile]', (els) =>
        els.filter((e) => (e as HTMLElement).offsetParent !== null).map((e) => e.getBoundingClientRect()).filter((r) => r.width < 56 || r.height < 56).map((r) => `${r.width}x${r.height}`),
      );
    expect(await small()).toEqual([]);
    await chooseProfile(page, 0);
    await page.waitForSelector('[data-avatar-done]');
    expect(await small()).toEqual([]);
    await page.click('[data-avatar-done]');
    await waitScene(page, 'windmill-kite');
    expect(await small()).toEqual([]);
  });

  test('things to tap in every scene are at least 56 CSS px', async ({ page }) => {
    await setupFamily(page);
    await chooseProfile(page, 0);
    await page.click('[data-avatar-done]');
    await waitScene(page, 'windmill-kite');
    const vp = page.viewportSize()!;
    const small = async (scene: string) =>
      (await targets(page))
        .filter((t) => t.x > 0 && t.x < vp.width && t.y > 0 && t.y < vp.height)
        .filter((t) => t.w < 56 || t.h < 56)
        .map((t) => `${scene} ${t.id}: ${Math.round(t.w)}x${Math.round(t.h)}`);
    const bad = await small('windmill-kite');
    for (const scene of ['map', 'clubhouse', 'tinker', 'picnic', 'stage', 'picnic-bridge', 'waterwheel', 'lantern-launch']) {
      await page.evaluate((k) => (window as any).__ww.app.goTo(k), scene);
      await waitScene(page, scene);
      await page.waitForTimeout(1500);
      bad.push(...(await small(scene)));
    }
    expect(bad).toEqual([]);
  });
});
