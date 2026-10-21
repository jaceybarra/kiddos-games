import { createServer, type Server } from 'node:http';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { extname, join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { drag, driveToLessonLog, holdKey, noProblems, openAll, openGame, openSettings, save, startDriver, startFirstMission, state, stopDriver, tap, target, waitScene, waitState } from './play';

/**
 * Acceptance checks beyond the mission journeys: help and recovery, pause /
 * retry / exit, refresh without duplicates, offline and an honest failed
 * cache, My Tiny Track, viewports and portrait, interruptions, damaged
 * saves and imports, reduced motion.
 */
const SHOTS = process.env.SHOTS === '1';
async function shot(page: Page, name: string): Promise<void> {
  if (SHOTS) await page.screenshot({ path: `garage/docs/screenshots/${name}.png` });
}

test('help and recovery: a miss restores the checkpoint in about a second; two misses bring the example and wider timing; manual help; pause, retry, garage', async ({ browser }) => {
  const s = await openGame(browser);
  const { page } = s;
  await startFirstMission(page);
  // get past the lesson log
  const before = await driveToLessonLog(page);
  await tap(page, 'jump');
  await waitState(page, `s.presses > ${before.presses} && s.jumps > ${before.jumps}`, 3_000);
  const over = await waitState(page, 's.x > 1300', 10_000).catch(() => null);
  if (!over) throw new Error(`one tap at the lesson log did not get over it: ${JSON.stringify((await state(page)).trace)}`);
  // drive into the practice gap without jumping, twice
  await startDriver(page, 'miss');
  const first = await waitState(page, 's.restoring', 30_000);
  expect(first.restoring).toBe(true);
  const back = await waitState(page, '!s.restoring', 5_000);
  // the soft puff and the return to the checkpoint are scheduled for 0.8 s (TUNING.recovery.restoreMs);
  // the software renderer used here runs well below 60 fps, so allow for frame overhead
  console.log(`restore took ${back.lastRestoreMs} ms of scene time at ~${back.fps} fps`);
  expect(back.lastRestoreMs).toBeGreaterThan(500);
  expect(back.lastRestoreMs).toBeLessThan(back.fps >= 50 ? 1300 : 2200);
  expect(back.checkpoint).toBe('cp-gap');
  expect(back.coins.length).toBeGreaterThan(0); // coins kept
  expect(back.assist).toBe(1);
  await waitState(page, 's.restoring', 30_000);
  const second = await waitState(page, '!s.restoring', 5_000);
  expect(second.misses['gap@1900']).toBe(2);
  expect(second.assist).toBe(2);
  await waitState(page, 's.example', 5_000);
  await shot(page, 'help-example');
  await waitState(page, '!s.example', 15_000);
  await stopDriver(page);
  // manual help near the gap
  await waitState(page, 's.hazard && s.hazard.kind === "gap"', 5_000);
  await tap(page, 'hud-help');
  await waitState(page, 's.example && s.usedHelp', 5_000);
  await waitState(page, '!s.example', 15_000);
  // pause freezes the truck, resume continues
  await tap(page, 'hud-pause');
  const p1 = await waitState(page, 's.paused', 5_000);
  await page.waitForTimeout(600);
  expect((await state(page)).x).toBe(p1.x);
  await tap(page, 'pause-resume');
  await waitState(page, '!s.paused', 5_000);
  // retry starts the drive again from the start
  await tap(page, 'hud-pause');
  await tap(page, 'pause-retry');
  await waitScene(page, 'mission');
  expect((await state(page)).x).toBeLessThan(400);
  // garage
  await tap(page, 'hud-pause');
  await tap(page, 'pause-garage');
  await waitScene(page, 'garage');
  noProblems(s);
  await s.context.close();
});

test('building: undo, clear, a test that does not work points at the socket that would help, help shows the placement', async ({ browser }) => {
  const s = await openGame(browser);
  const { page } = s;
  await openAll(page);
  await tap(page, 'mission-everyone-rally');
  await waitScene(page, 'mission');
  await startDriver(page);
  await page.locator('[data-testid="route-gentle"]').waitFor({ timeout: 90_000 });
  await tap(page, 'route-gentle');
  await waitState(page, "s.phase === 'building' && s.build && s.build.open", 120_000);
  await stopDriver(page);
  await drag(page, 'tray-bridge', 'socket-span');
  await waitState(page, "s.build.placed.includes('span:bridge')", 5_000);
  await tap(page, 'hud-undo');
  await waitState(page, 's.build.placed.length === 0', 5_000);
  await drag(page, 'tray-bridge', 'socket-span');
  await drag(page, 'tray-pad', 'socket-climb');
  await waitState(page, 's.build.placed.length === 2', 5_000);
  await tap(page, 'hud-clear');
  await waitState(page, 's.build.placed.length === 0', 5_000);
  // a piece dropped where it doesn't fit glides back (nothing placed)
  const tray = await target(page, 'tray-ramp');
  await page.mouse.move(tray.x, tray.y);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) await page.mouse.move(tray.x - i * 30, tray.y - i * 40);
  await page.mouse.up();
  await page.waitForTimeout(400);
  expect((await state(page)).build.placed).toEqual([]);
  // bridge only: the test drive can't climb the step; the climb socket is pointed at
  await drag(page, 'tray-bridge', 'socket-span');
  await tap(page, 'hud-test');
  await waitState(page, "s.build && s.build.open && s.build.hintSocket === 'climb'", 40_000);
  await shot(page, 'build-hint');
  await tap(page, 'hud-help');
  await waitState(page, 's.build.demoing', 5_000);
  await waitState(page, '!s.build.demoing', 10_000);
  await drag(page, 'tray-ramp', 'socket-climb');
  await tap(page, 'hud-test');
  await waitState(page, "s.phase === 'driving'", 60_000);
  noProblems(s);
  await s.context.close();
});

test('refreshing after progress continues from the last checkpoint without duplicating coins or rewards; a replay keeps the truck in view', async ({ browser }) => {
  // two whole drives at the software renderer's ~8 fps
  test.setTimeout(600_000);
  const s = await openGame(browser);
  const { page } = s;
  await startFirstMission(page);
  await driveToLessonLog(page);
  await tap(page, 'jump');
  await waitState(page, 's.x > 1250', 10_000);
  // the first coins and the place itself are saved at the next checkpoint (then brake before the gap)
  await holdKey(page, 'ArrowRight', "s.checkpoint === 'cp-gap'", 30_000);
  await holdKey(page, 'ArrowLeft', 's.vx <= 0', 10_000);
  await page.waitForFunction(() => window.__garage!.save().resume?.checkpoint === 'cp-gap' && window.__garage!.save().progress.coins.length >= 3);
  const coins1 = (await save(page)).progress.coins.slice().sort();
  await page.reload();
  await waitScene(page, 'garage');
  expect((await save(page)).progress.coins.slice().sort()).toEqual(coins1);
  // one Play: straight back to that checkpoint
  await tap(page, 'play');
  await waitScene(page, 'mission');
  const back = await state(page);
  expect(back.checkpoint).toBe('cp-gap');
  expect(Math.abs(back.x - 1640)).toBeLessThan(5);
  expect(back.coins).toEqual([]); // nothing new yet: the earlier coins are already in the garage
  for (let run = 0; run < 2; run++) {
    await startDriver(page);
    if (run === 1) {
      // a replay after a finished mission: the camera still follows the truck
      await waitState(page, 's.x > 1500', 60_000);
      const t = (await page.evaluate(() => window.__garage!.targets())).find((x) => x.id === 'truck')!;
      expect(t.x).toBeGreaterThan(0);
      expect(t.x).toBeLessThan(1024);
    }
    await waitState(page, "s.phase === 'building' && s.build && s.build.open", 120_000);
    await stopDriver(page);
    await drag(page, 'tray-bridge', 'socket-span');
    await tap(page, 'hud-test');
    await waitState(page, "s.phase === 'driving'", 60_000);
    await startDriver(page);
    await waitScene(page, 'result', 90_000);
    const r = await state(page);
    if (run === 0) expect(r.earned.newReward).toBe('pennant');
    else expect(r.earned).toMatchObject({ newMission: false, newReward: null, newCoins: [] });
    await waitState(page, "s.stage === 'choices'", 30_000);
    await tap(page, run === 0 ? 'end-replay' : 'end-garage');
    await waitScene(page, run === 0 ? 'mission' : 'garage');
  }
  const sv = await save(page);
  expect(sv.progress.rewards).toEqual(['pennant']);
  expect(sv.resume).toBeNull();
  expect(new Set(sv.progress.coins).size).toBe(sv.progress.coins.length);
  await page.reload();
  await waitScene(page, 'garage');
  expect((await save(page)).progress).toEqual(sv.progress);
  noProblems(s);
  await s.context.close();
});

test('offline: the cached app reopens without a network', async ({ browser }) => {
  const s = await openGame(browser);
  const { page, context } = s;
  await waitScene(page, 'garage');
  await page.waitForFunction(() => window.__garage!.offline().state === 'ready', null, { timeout: 60_000 });
  const o = await page.evaluate(() => window.__garage!.offline());
  expect(o.files).toBeGreaterThan(10);
  await context.setOffline(true);
  await page.reload();
  await waitScene(page, 'garage', 60_000);
  await tap(page, 'play');
  await waitScene(page, 'mission');
  await context.setOffline(false);
  noProblems(s);
  await context.close();
});

test('offline: a failed cache download shows an honest "not ready" state', async ({ browser }) => {
  // serve the build from a tiny server where one listed file fails to download (500), like a broken connection
  const port = 4179;
  const types: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.json': 'application/json', '.svg': 'image/svg+xml' };
  const server: Server = createServer((req, res) => {
    const path = decodeURIComponent((req.url ?? '/').split('?')[0]);
    if (path.endsWith('icon-maskable-512.png')) {
      res.writeHead(500);
      res.end('broken');
      return;
    }
    const file = join('dist-garage-e2e', path === '/' ? 'index.html' : path);
    try {
      const body = readFileSync(file);
      res.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream' });
      res.end(body);
    } catch {
      res.writeHead(404);
      res.end();
    }
  });
  await new Promise<void>((r) => server.listen(port, '127.0.0.1', () => r()));
  try {
    const context = await browser.newContext({ viewport: { width: 1024, height: 768 } });
    const page = await context.newPage();
    for (let i = 0; i < 60; i++) {
      try {
        await page.goto(`http://127.0.0.1:${port}/`);
        break;
      } catch {
        await page.waitForTimeout(500);
      }
    }
    await waitScene(page, 'garage', 60_000);
    await page.waitForFunction(() => window.__garage!.offline().state !== 'installing', null, { timeout: 60_000 });
    const o = await page.evaluate(() => window.__garage!.offline());
    expect(o.state).toBe('failed');
    await page.waitForTimeout(1500);
    expect((await page.evaluate(() => window.__garage!.offline())).state).not.toBe('ready');
    await openSettings(page);
    await expect(page.locator('[data-testid="offline-state"]')).toContainText('Not ready for offline play');
    await context.close();
  } finally {
    server.close();
  }
});

test('My Tiny Track: legal pieces only, an unplayable layout gets a fix, a track saves, reloads and drives', async ({ browser }) => {
  const s = await openGame(browser);
  const { page } = s;
  await openAll(page);
  await tap(page, 'creator');
  await waitScene(page, 'creator');
  await tap(page, 'slot-0');
  await waitState(page, "s.mode === 'edit'", 10_000);
  // a pond can't go right after the start: dropping it there changes nothing
  await drag(page, 'ttray-pond', 'tslot-0');
  expect((await state(page)).slots[0]).toBeNull();
  await drag(page, 'ttray-pond', 'tslot-1');
  await drag(page, 'ttray-log', 'tslot-3');
  await waitState(page, "s.slots[1] === 'pond' && s.slots[3] === 'log'", 5_000);
  await tap(page, 'hud-test');
  const c = await waitState(page, 's.check && s.check.playable === false', 10_000);
  expect(c.check).toMatchObject({ problemSlot: 1, fixSlot: 0, fixPiece: 'ramp' });
  await shot(page, 'creator-fix');
  await drag(page, 'ttray-ramp', 'tslot-0');
  await tap(page, 'hud-test');
  await waitScene(page, 'mission');
  await startDriver(page);
  await waitScene(page, 'creator', 90_000);
  await waitState(page, "s.mode === 'edit'", 10_000);
  await tap(page, 'hud-save');
  await page.waitForFunction(() => JSON.stringify(window.__garage!.save().tracks[0]?.slots) === JSON.stringify(['ramp', 'pond', null, 'log', null, null]));
  await page.reload();
  await waitScene(page, 'garage');
  await tap(page, 'play');
  await waitState(page, "s.mode === 'interior'", 20_000);
  await tap(page, 'creator');
  await waitScene(page, 'creator');
  await shot(page, 'creator-slots');
  await tap(page, 'slot-0');
  const back = await waitState(page, "s.mode === 'edit'", 10_000);
  expect(back.slots).toEqual(['ramp', 'pond', null, 'log', null, null]);
  await tap(page, 'hud-test');
  await waitScene(page, 'mission');
  // a second drive in the same visit: the camera follows the truck (the scene is reused)
  await startDriver(page);
  await waitState(page, 's.x > 1500', 60_000);
  const t = (await page.evaluate(() => window.__garage!.targets())).find((x) => x.id === 'truck')!;
  expect(t.x).toBeGreaterThan(0);
  expect(t.x).toBeLessThan(1024);
  expect((await state(page)).coinsShown).toBe(false);
  await waitScene(page, 'creator', 90_000);
  noProblems(s);
  await s.context.close();
});

for (const viewport of [
  { width: 1366, height: 768 },
  { width: 1920, height: 1080 },
]) {
  test(`drag coordinates stay right on a wider screen (${viewport.width}×${viewport.height})`, async ({ browser }) => {
    const s = await openGame(browser, { viewport });
    const { page } = s;
    await openAll(page);
    await tap(page, 'mission-wobbly-bridge');
    await waitScene(page, 'mission');
    await startDriver(page);
    await waitState(page, "s.phase === 'building' && s.build && s.build.open", 120_000);
    await stopDriver(page);
    await drag(page, 'tray-pad', 'socket-launch');
    await waitState(page, "s.build.placed.includes('launch:pad')", 5_000);
    await tap(page, 'hud-test');
    await waitState(page, "s.phase === 'driving'", 60_000);
    noProblems(s);
    await s.context.close();
  });
}

test('portrait pauses and shows the rotate picture; landscape again keeps the drive', async ({ browser }) => {
  const s = await openGame(browser);
  const { page } = s;
  await startFirstMission(page);
  await waitState(page, '!s.held && s.controlsOn', 30_000);
  await page.keyboard.down('ArrowRight');
  await waitState(page, 's.x > 500', 30_000);
  await page.setViewportSize({ width: 600, height: 900 });
  await page.locator('[data-testid="rotate"]').waitFor({ timeout: 5_000 });
  const p = await waitState(page, 's.paused', 5_000);
  await shot(page, 'rotate');
  await page.setViewportSize({ width: 1024, height: 768 });
  await expect(page.locator('[data-testid="rotate"]')).toHaveCount(0);
  const still = await state(page);
  expect(still.paused).toBe(true);
  expect(still.x).toBe(p.x);
  // the gas let go when it paused, even though the key is still down
  expect(still.gasHeld).toBe(false);
  await page.keyboard.up('ArrowRight');
  await tap(page, 'pause-resume');
  await waitState(page, '!s.paused', 5_000);
  noProblems(s);
  await s.context.close();
});

test('backgrounding, focus loss and a cancelled touch never leave the truck jumping or stuck', async ({ browser }) => {
  const s = await openGame(browser);
  const { page } = s;
  await startFirstMission(page);
  await waitState(page, '!s.held && s.controlsOn', 30_000);
  await page.keyboard.down('ArrowRight');
  await waitState(page, '!s.example && !s.held && s.x > 400 && s.gasHeld', 60_000);
  // the gas held, then focus lost: the pause menu appears and the gas is let go
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await waitState(page, 's.paused && !s.gasHeld', 3_000);
  await page.keyboard.up('ArrowRight');
  await tap(page, 'pause-resume');
  await waitState(page, '!s.paused && !s.gasHeld', 3_000);
  // hold the jump key, then lose focus: the pause menu appears and the held input is released
  await page.keyboard.down('Space');
  await waitState(page, 's.jumpHeld', 3_000);
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await waitState(page, 's.paused && !s.jumpHeld', 3_000);
  await page.keyboard.up('Space');
  await tap(page, 'pause-resume');
  await waitState(page, '!s.paused && !s.jumpHeld', 3_000);
  // Esc pauses (keyboard), Esc again resumes
  await page.keyboard.press('Escape');
  await waitState(page, 's.paused', 3_000);
  await page.waitForTimeout(300);
  await page.keyboard.press('Escape');
  await waitState(page, '!s.paused', 3_000);
  // tab hidden
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await waitState(page, 's.paused', 3_000);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
  });
  await tap(page, 'pause-resume');
  await waitState(page, '!s.paused', 3_000);
  // a touch on the jump button that the system cancels (e.g. a notification): released
  const b = (await page.locator('[data-testid="jump"]').boundingBox())!;
  await page.evaluate(
    ({ x, y }) => {
      const el = document.querySelector('[data-testid="jump"]')!;
      el.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 7, clientX: x, clientY: y, bubbles: true, button: 0 }));
      el.dispatchEvent(new PointerEvent('pointercancel', { pointerId: 7, clientX: x, clientY: y, bubbles: true }));
    },
    { x: b.x + b.width / 2, y: b.y + b.height / 2 },
  );
  await page.waitForTimeout(200);
  expect((await state(page)).jumpHeld).toBe(false);
  // the pause menu is the only thing on top: the jump button can't be pressed under it
  await tap(page, 'hud-pause');
  await waitState(page, 's.paused', 3_000);
  const before = await state(page);
  await page.keyboard.press('Space');
  await page.waitForTimeout(500);
  const after = await state(page);
  expect([after.x, after.y, after.jumpHeld]).toEqual([before.x, before.y, false]);
  noProblems(s);
  await s.context.close();
});

test('a corrupted save falls back to the previous good one; a failed write is reported, never claimed; an invalid import changes nothing', async ({ browser }) => {
  const s = await openGame(browser);
  const { page } = s;
  await openAll(page);
  // two good saves: open-all (above), then a paint change
  await tap(page, 'tab-paint');
  await tap(page, 'opt-paint-blue');
  await page.waitForFunction(() => window.__garage!.save().truck.paint === 'blue' && window.__garage!.saveStatus().lastWrite === 'ok');
  await page.waitForTimeout(800);
  // damage the newest record directly in IndexedDB, then reload
  await page.evaluate(
    () =>
      new Promise<void>((res, rej) => {
        const r = indexedDB.open('wonder-garage', 1);
        r.onsuccess = () => {
          const tx = r.result.transaction('save', 'readwrite');
          tx.objectStore('save').put('{{{ not a save', 'current');
          tx.oncomplete = () => res();
          tx.onerror = () => rej(tx.error);
        };
      }),
  );
  await page.reload();
  await waitScene(page, 'garage');
  const st = await page.evaluate(() => window.__garage!.saveStatus());
  expect(st.loaded).toBe('previous');
  expect(st.setAside).toBe(true);
  expect((await save(page)).settings.openAll).toBe(true);
  // make writes fail like a full disk
  await page.evaluate(() => {
    IDBObjectStore.prototype.put = function () {
      throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
    };
  });
  await tap(page, 'play');
  await waitState(page, "s.mode === 'interior'", 20_000);
  await tap(page, 'tab-paint');
  await tap(page, 'opt-paint-green');
  await page.waitForFunction(() => window.__garage!.saveStatus().lastWrite === 'failed', null, { timeout: 5_000 });
  await openSettings(page);
  await expect(page.locator('[data-testid="save-last"]')).toContainText('The last save failed');
  // an invalid import: nothing changes
  const before = await save(page);
  const bad = join(mkdtempSync(join(tmpdir(), 'garage-import-')), 'bad.json');
  writeFileSync(bad, '{"app":"wonder-garage","save":{"version":1,"progress":"oops"}}');
  await page.locator('[data-testid="import-file"]').setInputFiles(bad);
  await expect(page.locator('.set-status')).toContainText('Nothing was changed');
  expect(await save(page)).toEqual(before);
  await tap(page, 'settings-close');
  noProblems({ ...s, errors: s.errors.filter((e) => !/quota/i.test(e)) });
  await s.context.close();
});

test('export makes a backup file that imports back', async ({ browser }) => {
  const s = await openGame(browser);
  const { page } = s;
  await openAll(page, false);
  await openSettings(page);
  const [download] = await Promise.all([page.waitForEvent('download'), page.locator('[data-testid="export"]').click()]);
  const path = await download.path();
  const text = readFileSync(path!, 'utf8');
  expect(JSON.parse(text).app).toBe('wonder-garage');
  await page.locator('[data-testid="import-file"]').setInputFiles(path!);
  await expect(page.locator('.set-status')).toContainText('Backup restored');
  noProblems(s);
  await s.context.close();
});

test('reduced motion follows the device and stops decorative animation; grown-up settings can switch it', async ({ browser }) => {
  const s = await openGame(browser, { reducedMotion: 'reduce' });
  const { page } = s;
  await waitScene(page, 'garage');
  expect(await page.evaluate(() => document.documentElement.classList.contains('motion-reduced'))).toBe(true);
  const anim = await page.evaluate(() => getComputedStyle(document.querySelector('[data-testid="play"]')!, '::after').animationName);
  expect(anim).toBe('none');
  await openSettings(page);
  await page.locator('[data-testid="set-motion"]').selectOption('full');
  await page.waitForFunction(() => !document.documentElement.classList.contains('motion-reduced'));
  await tap(page, 'settings-close');
  noProblems(s);
  await s.context.close();
});
