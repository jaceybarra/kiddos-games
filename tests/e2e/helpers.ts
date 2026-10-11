import { test as base, expect, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';

/**
 * Every journey also checks the voices: each line the game asked to speak must
 * have a recording (tools/voices). The lines heard are saved under
 * test-results/voice-lines/ so tools/voices/merge-captured.mjs can add them
 * to the recording list. VOICE_STRICT=1 fails a journey that hears an unrecorded line.
 */
export const test = base.extend<{ voiceCheck: void }>({
  voiceCheck: [
    async ({ page }, use, testInfo) => {
      await use();
      const log = (await page.evaluate(() => (window as unknown as { __ww?: { voiceLog?(): { voice: string; text: string; recorded: boolean }[] } }).__ww?.voiceLog?.() ?? []).catch(() => [])) as { voice: string; text: string; recorded: boolean }[];
      mkdirSync('test-results/voice-lines', { recursive: true });
      writeFileSync(`test-results/voice-lines/${testInfo.testId}.json`, JSON.stringify(log));
      if (process.env.VOICE_STRICT === '1') {
        const missing = [...new Set(log.filter((l) => !l.recorded).map((l) => `${l.voice}: ${l.text}`))];
        expect(missing, 'lines spoken without a recording (run tools/voices)').toEqual([]);
      }
    },
    { auto: true },
  ],
});

export type GameState = Record<string, unknown> & {
  mode?: string;
  checkpoint?: string;
  preset?: string;
  pip?: string;
  flags?: Record<string, unknown>;
  carrying?: boolean;
};

export const state = (p: Page) => p.evaluate(() => (window as unknown as { __ww: { state(): GameState } }).__ww.state());
export const sceneKey = (p: Page) => p.evaluate(() => (window as unknown as { __ww: { scene(): string } }).__ww.scene());

export async function waitState(p: Page, fn: (s: GameState) => boolean, label: string, timeout = 90_000): Promise<GameState> {
  const t0 = Date.now();
  let last: GameState | null = null;
  while (Date.now() - t0 < timeout) {
    last = await state(p).catch(() => null);
    if (last && fn(last)) return last;
    await p.waitForTimeout(250);
  }
  throw new Error(`timeout waiting for ${label}; last=${JSON.stringify(last)}`);
}

export async function waitScene(p: Page, key: string, timeout = 60_000): Promise<void> {
  await p.waitForFunction(
    (k) => {
      const w = (window as unknown as { __ww?: { scene?: () => string; ready?: () => boolean } }).__ww;
      return !!w && typeof w.scene === 'function' && w.scene() === k && !!w.ready?.();
    },
    key,
    { timeout },
  );
}

interface Target {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export async function targets(p: Page): Promise<Target[]> {
  return p.evaluate(() => (window as unknown as { __ww: { targets(): Target[] } }).__ww.targets());
}

/** Click a canvas target at its real on-screen position (waits until visible). */
export async function clickTarget(p: Page, id: string, timeout = 60_000): Promise<void> {
  const vp = p.viewportSize()!;
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    const t = (await targets(p)).find((x) => x.id === id);
    if (t && t.x > 0 && t.x < vp.width && t.y > 0 && t.y < vp.height) {
      await p.mouse.click(t.x, t.y);
      return;
    }
    await p.waitForTimeout(250);
  }
  throw new Error(`target not clickable: ${id}; state=${JSON.stringify(await state(p))}`);
}

/** Hold an arrow key until a target comes into view (exercises keyboard walking). */
export async function walkUntilVisible(p: Page, id: string, dir: 1 | -1, timeout = 60_000): Promise<void> {
  const vp = p.viewportSize()!;
  await p.focus('canvas');
  const key = dir > 0 ? 'ArrowRight' : 'ArrowLeft';
  await p.keyboard.down(key);
  try {
    const t0 = Date.now();
    while (Date.now() - t0 < timeout) {
      const t = (await targets(p)).find((x) => x.id === id);
      if (t && t.x > 150 && t.x < vp.width - 150) return;
      await p.waitForTimeout(150);
    }
    throw new Error('never saw ' + id);
  } finally {
    await p.keyboard.up(key);
  }
}

export async function clickChoice(p: Page, id: string): Promise<void> {
  await p.waitForSelector(`[data-choice="${id}"]`, { timeout: 60_000 });
  await p.click(`[data-choice="${id}"]`);
}

/** Fresh device: first-run grown-up setup with the default two players. */
export async function setupFamily(p: Page): Promise<void> {
  await p.goto('/');
  await p.waitForSelector('[data-setup-done]', { timeout: 60_000 });
  await p.click('[data-setup-done]');
  await p.waitForSelector('[data-profile]');
}

export async function chooseProfile(p: Page, index: number): Promise<void> {
  await p.waitForSelector('[data-profile]');
  const cards = await p.$$('[data-profile]');
  await cards[index].click();
}

export async function profile(p: Page) {
  return p.evaluate(() => (window as unknown as { __ww: { app: { profile(): Record<string, any> } } }).__ww.app.profile());
}

export async function flush(p: Page) {
  await p.evaluate(() => (window as unknown as { __ww: { app: { flush(): Promise<void> } } }).__ww.app.flush());
}

/** Play the intro glider and arrive on the hill. */
export async function playIntro(p: Page): Promise<void> {
  await waitScene(p, 'windmill-kite');
  await clickTarget(p, 'glider');
  await waitState(p, (s) => s.mode === 'glider', 'glider flight');
  await waitState(p, (s) => s.mode === 'explore', 'arrive on hill', 120_000);
}

export async function untangle(p: Page): Promise<void> {
  await waitState(p, (s) => s.mode === 'repair', 'repair');
  for (const i of [0, 1, 2]) {
    await clickTarget(p, `loop-${i}`);
    await p.waitForTimeout(700);
  }
  await waitState(p, (s) => (s.flags as { mixup: string }).mixup === 'fixed' && s.mode === 'explore', 'repaired', 90_000);
}

export async function tieAndDecorate(p: Page, pattern: string, color: string): Promise<void> {
  await waitState(p, (s) => s.mode === 'knots', 'knots', 120_000);
  for (const i of [0, 1, 2]) {
    await clickTarget(p, `knot-${i}`);
    await p.waitForTimeout(400);
  }
  await p.click(`[data-decor="${pattern}"]`, { timeout: 60_000 });
  await p.click('[data-decor-done]');
  await p.click(`[data-decor="${color}"]`, { timeout: 60_000 });
  await p.click('[data-decor-done]');
  await waitState(p, (s) => s.mode === 'flying', 'flying', 60_000);
  // the end choice follows a few seconds of free flying (slow under heavy load)
  await p.waitForSelector('[data-choice="explore"]', { timeout: 150_000 });
}

export function collectErrors(p: Page): string[] {
  const errs: string[] = [];
  p.on('pageerror', (e) => errs.push(`pageerror: ${e.message}`));
  p.on('console', (m) => {
    if (m.type() === 'error') errs.push(`console: ${m.text()}`);
  });
  return errs;
}

export { expect };

/** Visible child-facing buttons smaller than 56 CSS px (should be none). */
export async function smallButtons(p: Page): Promise<string[]> {
  return p.$$eval('.btn-round, .choice, .tile, .card, .swatch, .scene-card, [data-profile]', (els) =>
    els
      .filter((e) => (e as HTMLElement).offsetParent !== null)
      .map((e) => ({ r: e.getBoundingClientRect(), id: (e as HTMLElement).getAttribute('aria-label') ?? e.className }))
      .filter(({ r }) => r.width < 56 || r.height < 56)
      .map(({ r, id }) => `${id}: ${Math.round(r.width)}x${Math.round(r.height)}`),
  );
}
