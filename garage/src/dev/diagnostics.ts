import type Phaser from 'phaser';

/**
 * A tiny frame-rate meter for grown-ups (a parent setting, or ?diag in the
 * address). It shows numbers on screen only; nothing is stored or sent.
 */
let el: HTMLElement | null = null;
let timer: ReturnType<typeof setInterval> | null = null;

export function startDiagnostics(game: Phaser.Game): void {
  if (el) return;
  el = document.createElement('div');
  el.className = 'diag';
  el.setAttribute('aria-hidden', 'true');
  document.body.append(el);
  timer = setInterval(() => {
    if (!el) return;
    const scenes = game.scene.getScenes(true).map((s) => s.scene.key).join(',');
    el.textContent = `${Math.round(game.loop.actualFps)} fps · ${scenes}`;
  }, 500);
}

export function stopDiagnostics(): void {
  if (timer) clearInterval(timer);
  timer = null;
  el?.remove();
  el = null;
}
