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
  // pred is a JS expression over `s` (the scene state), e.g. "s.phase === 'building'"
  await page.waitForFunction((p) => {
    const s = window.__garage?.state() ?? {};
    // eslint-disable-next-line no-new-func
    return new Function('s', `return (${p});`)(s);
  }, pred, { timeout, polling: 50 });
  return state(page);
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
 * Start an in-page driver that presses Space (a real keyboard event the
 * controls listen to) just before each gap or log, like a careful player.
 * mode 'miss' never jumps (to test misses and help).
 */
export async function startDriver(page: Page, mode: 'jump' | 'miss' = 'jump'): Promise<void> {
  await page.evaluate((m) => {
    window.__driver?.stop();
    let on = true;
    let held = 0;
    const d = { stop: () => (on = false), jumps: 0, mode: m };
    window.__driver = d;
    const key = (type: 'keydown' | 'keyup') => window.dispatchEvent(new KeyboardEvent(type, { key: ' ', code: 'Space', bubbles: true }));
    const tick = () => {
      if (!on) return;
      const s = window.__garage?.state() as Record<string, any> | undefined;
      if (held > 0) {
        held--;
        if (held === 0) key('keyup');
      } else if (d.mode === 'jump' && s && s.phase === 'driving' && !s.held && !s.scripted && !s.restoring && s.grounded && s.hazard) {
        const h = s.hazard as { kind: string; x0: number; x1: number };
        const nose = s.x + 110;
        const near = h.kind === 'wall' ? h.x0 - nose < 60 && h.x0 - nose > -5 : h.x0 - s.x < 70 && h.x0 - s.x > -20;
        if (near) {
          key('keydown');
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
