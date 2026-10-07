import { services } from '../app/services';
import type { App } from '../app/App';
import { SCENES, activeSceneKey } from '../game/createGame';
import { h } from '../ui/dom';
import type { WWScene } from '../game/WWScene';

/**
 * Developer-only scene picker and state inspector (dev server with ?dev).
 * Never included in production builds and never shown to children.
 */
export function installDevTools(app: App): void {
  const pre = h('pre', { style: 'max-height:40vh;overflow:auto;font:11px monospace;margin:4px 0;white-space:pre-wrap' });
  const panel = h(
    'div',
    { style: 'position:fixed;left:8px;top:90px;z-index:999;background:#fffdf0ee;border:2px solid #333;border-radius:8px;padding:6px;width:320px;font:12px system-ui;display:none' },
    h('strong', {}, 'Dev tools (` to toggle)'),
    h('div', { style: 'display:flex;flex-wrap:wrap;gap:4px;margin:4px 0' }, ...Object.keys(SCENES).map((k) => h('button', { type: 'button', on: { click: () => services.nav.goTo(k) } }, k))),
    h('div', { style: 'display:flex;flex-wrap:wrap;gap:4px' },
      h('button', { type: 'button', on: { click: () => app.pause() } }, 'pause'),
      h('button', { type: 'button', on: { click: () => app.resume() } }, 'resume'),
      h('button', { type: 'button', on: { click: () => void services.save.flush() } }, 'flush save'),
      h('button', { type: 'button', on: { click: () => app.openAdult() } }, 'adult area'),
    ),
    pre,
  );
  document.body.append(panel);
  window.addEventListener('keydown', (e) => {
    if (e.key === '`') panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
  });
  setInterval(() => {
    if (panel.style.display === 'none') return;
    const key = activeSceneKey(services.game);
    const scene = key ? (services.game.scene.getScene(key) as WWScene) : null;
    pre.textContent = JSON.stringify({ scene: key, state: scene?.inspect?.(), save: services.save.status, profile: services.profileId }, null, 1);
  }, 500);
}
