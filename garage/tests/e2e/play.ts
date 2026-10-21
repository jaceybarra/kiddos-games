import { expect, type Browser, type BrowserContext, type Page } from '@playwright/test';

/**
 * Playing the real game from tests: real pointer events on real buttons and
 * canvas coordinates, real key presses for jumping. The e2e build exposes
 * window.__garage (dev/testHooks.ts) to read state and find things on the
 * canvas; it never changes game state by itself.
 */
type Target = { id: string; x: number; y: number; w: number; h: number };
type GarageHooks = {
  ready(): boolean;
  scene(): string | null;
  state(): Record<string, any>;
  targets(): Target[];
  save(): any;
  saveStatus(): any;
  offline(): any;
  interrupt(why: string): void;
};
declare global {
  interface Window {
    __garage?: GarageHooks;
    __driver?: { stop(): void; jumps: number; mode: string };
  }
}

export interface Session {
  context: BrowserContext;
  page: Page;
  errors: string[];
  foreign: string[];
}

/** A fresh profile (empty storage) with error and network watchers. */
export async function openGame(browser: Browser, opts: { viewport?: { width: number; height: number }; reducedMotion?: 'reduce' | 'no-preference'; hasTouch?: boolean } = {}): Promise<Session> {
  const context = await browser.newContext({ viewport: opts.viewport ?? { width: 1024, height: 768 }, reducedMotion: opts.reducedMotion ?? 'no-preference', hasTouch: opts.hasTouch ?? false });
  const page = await context.newPage();
  const errors: string[] = [];
  const foreign: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(String(e)));
  context.on('request', (r) => {
    const u = new URL(r.url());
    if (u.protocol.startsWith('http') && !['127.0.0.1', 'localhost'].includes(u.hostname)) foreign.push(r.url());
  });
  await page.goto('/');
  return { context, page, errors, foreign };
}

export async function waitScene(page: Page, scene: string, timeout = 60_000): Promise<void> {
  await page.waitForFunction((s) => window.__garage?.scene() === s && window.__garage?.ready(), scene, { timeout });
}

export async function state(page: Page): Promise<Record<string, any>> {
  return page.evaluate(() => window.__garage!.state());
}

export async function waitState(page: Page, pred: string, timeout = 60_000): Promise<Record<string, any>> {
  // pred is a JS expression over `s` (the scene state), e.g. "s.phase === 'building'".
  // It's checked here in the test runner: the page's security policy (rightly) forbids eval.
  // eslint-disable-next-line no-new-func
  const fn = new Function('s', `try { return !!(${pred}); } catch (e) { return false; }`) as (s: Record<string, any>) => boolean;
  const t0 = Date.now();
  for (;;) {
    const s = await state(page).catch(() => ({}) as Record<string, any>);
    if (fn(s)) return s;
    if (Date.now() - t0 > timeout) throw new Error(`waitState timed out: ${pred}\nlast state: ${JSON.stringify(s).slice(0, 600)}`);
    await page.waitForTimeout(60);
  }
}

export async function targets(page: Page): Promise<Target[]> {
  return page.evaluate(() => window.__garage!.targets());
}

export async function target(page: Page, id: string, timeout = 15_000): Promise<Target> {
  const t0 = Date.now();
  for (;;) {
    const t = (await targets(page)).find((x) => x.id === id);
    if (t) return t;
    if (Date.now() - t0 > timeout) throw new Error(`target ${id} not found; have ${(await targets(page)).map((x) => x.id).join(', ')}`);
    await page.waitForTimeout(100);
  }
}

/** Tap a DOM control by test id with a real pointer press at its centre. */
export async function tap(page: Page, testid: string, timeout = 30_000): Promise<void> {
  const el = page.locator(`[data-testid="${testid}"]`).first();
  await el.waitFor({ state: 'visible', timeout });
  await expect(el).toBeEnabled();
  // (inside a scrolled panel, scroll to it first, as a person would)
  await el.scrollIntoViewIfNeeded();
  const b = (await el.boundingBox())!;
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(40);
  await page.mouse.up();
}

/** Tap something on the canvas by test target id. */
export async function tapTarget(page: Page, id: string): Promise<void> {
  const t = await target(page, id);
  await page.mouse.move(t.x, t.y);
  await page.mouse.down();
  await page.waitForTimeout(40);
  await page.mouse.up();
}

/** Drag from one canvas target to another with a real pointer, in small steps. */
export async function drag(page: Page, fromId: string, toId: string): Promise<void> {
  const a = await target(page, fromId);
  const b = await target(page, toId);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  const steps = 14;
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(a.x + ((b.x - a.x) * i) / steps, a.y + ((b.y - a.y) * i) / steps);
    await page.waitForTimeout(16);
  }
  await page.waitForTimeout(60);
  await page.mouse.up();
}

/**
 * Start an in-page driver that plays with real keyboard events the controls
 * listen to, like a careful player: with the pedals it holds the gas (→),
 * eases off with the brake (←) to about cruising speed before a gap or a log,
 * and presses Space just before it. When the truck drives itself it only
 * presses Space. mode 'miss' never jumps (to test misses and help).
 */
export async function startDriver(page: Page, mode: 'jump' | 'miss' = 'jump'): Promise<void> {
  await page.evaluate((m) => {
    window.__driver?.stop();
    let on = true;
    let held = 0;
    let gas = false;
    let brake = false;
    const d = { stop: () => {
      on = false;
      if (gas) key('keyup', 'ArrowRight');
      if (brake) key('keyup', 'ArrowLeft');
    }, jumps: 0, mode: m };
    window.__driver = d;
    function key(type: 'keydown' | 'keyup', k: string) {
      window.dispatchEvent(new KeyboardEvent(type, { key: k, code: k === ' ' ? 'Space' : k, bubbles: true }));
    }
    const setGas = (v: boolean) => {
      if (v !== gas) key(v ? 'keydown' : 'keyup', 'ArrowRight');
      gas = v;
    };
    const setBrake = (v: boolean) => {
      if (v !== brake) key(v ? 'keydown' : 'keyup', 'ArrowLeft');
      brake = v;
    };
    const tick = () => {
      if (!on) return;
      const s = window.__garage?.state() as Record<string, any> | undefined;
      const drives = !!s && s.phase === 'driving' && !s.held && !s.scripted && !s.restoring && s.controlsOn;
      if (s && s.driving === 'pedals') {
        // a hidden/re-shown control set forgets held keys: press again
        if (!drives) {
          gas = false;
          brake = false;
        } else {
          const h = s.hazard as { kind: string; x0: number; x1: number } | null;
          const ahead = h ? h.x0 - s.x : Infinity;
          const near = ahead < 520 && ahead > -40;
          const tooFast = near && s.vx > 360;
          setBrake(tooFast && s.grounded);
          setGas(!tooFast || !s.grounded);
          if (!s.gasHeld && gas) key('keydown', 'ArrowRight');
        }
      }
      if (held > 0) {
        held--;
        if (held === 0) key('keyup', ' ');
      } else if (d.mode === 'jump' && drives && s!.grounded && s!.hazard) {
        const h = s!.hazard as { kind: string; x0: number; x1: number };
        const nose = s!.x + 150;
        const near = h.kind === 'wall' ? h.x0 - nose < 70 && h.x0 - nose > -5 : h.x0 - s!.x < 70 && h.x0 - s!.x > -20;
        if (near) {
          key('keydown', ' ');
          d.jumps++;
          held = 6;
        }
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, mode);
}

export async function stopDriver(page: Page): Promise<void> {
  await page.evaluate(() => window.__driver?.stop());
}

/**
 * Mission 1's first lesson with the pedals: hold the gas button with a real
 * pointer until the see-through truck shows the jump at the log, then let go;
 * the truck waits in front of the log.
 */
export async function driveToLessonLog(page: Page): Promise<Record<string, any>> {
  await waitState(page, '!s.held && s.controlsOn', 30_000);
  const b = (await page.locator('[data-testid="gas"]').boundingBox())!;
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  await waitState(page, 's.example || s.x > 1000', 60_000);
  await page.mouse.up();
  return waitState(page, 's.x > 900 && !s.example && !s.held && s.vx === 0 && s.hazard && s.hazard.kind === "wall"', 60_000);
}

/** Hold a key (a pedal) until the state matches, then let go. */
export async function holdKey(page: Page, key: string, until: string, timeout = 30_000): Promise<Record<string, any>> {
  await page.keyboard.down(key);
  try {
    return await waitState(page, until, timeout);
  } finally {
    await page.keyboard.up(key);
  }
}

/** First launch: garage door → Play → mission 1 starts. */
export async function startFirstMission(page: Page): Promise<void> {
  await waitScene(page, 'garage');
  await tap(page, 'play');
  await waitScene(page, 'mission');
}

export async function save(page: Page): Promise<any> {
  return page.evaluate(() => window.__garage!.save());
}

export function noProblems(s: Session): void {
  expect(s.errors, 'console errors').toEqual([]);
  expect(s.foreign, 'third-party requests').toEqual([]);
}

/** Grown-up gate + "open all missions" so later missions can be tested on a fresh profile. */
export async function openAll(page: Page, enter = true): Promise<void> {
  await waitScene(page, 'garage');
  await tap(page, 'parent');
  await page.locator('[data-testid="gate"]').waitFor({ timeout: 10_000 });
  const asked = await page.locator('[data-testid="gate"]').getAttribute('data-asked');
  const btn = page.locator(`[data-testid="gate-${asked}"]`);
  const b = (await btn.boundingBox())!;
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(2300);
  await page.mouse.up();
  await page.locator('[data-testid="settings"]').waitFor({ timeout: 10_000 });
  await page.locator('[data-testid="set-openAll"]').check();
  await page.waitForFunction(() => window.__garage!.save().settings.openAll === true);
  await tap(page, 'settings-close');
  if (!enter) return;
  // with everything open, Play opens the door into the garage instead of starting mission 1
  await tap(page, 'play');
  await waitState(page, "s.mode === 'interior'", 20_000);
}

/** Pass the grown-up gate (hold the asked shape) and open the settings panel. */
export async function openSettings(page: Page): Promise<void> {
  await tap(page, 'parent');
  await page.locator('[data-testid="gate"]').waitFor({ timeout: 10_000 });
  const asked = await page.locator('[data-testid="gate"]').getAttribute('data-asked');
  const b = (await page.locator(`[data-testid="gate-${asked}"]`).boundingBox())!;
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(2300);
  await page.mouse.up();
  await page.locator('[data-testid="settings"]').waitFor({ timeout: 10_000 });
}
