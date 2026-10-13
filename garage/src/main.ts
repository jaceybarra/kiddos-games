import './ui/styles.css';
import { App } from './app/App';
import { h } from './ui/dom';

/** Boot the game. A failure shows a calm grown-up panel instead of a blank screen. */
function showBootError(err: unknown): void {
  const msg = err instanceof Error ? err.message : String(err);
  const panel = h(
    'div',
    { class: 'boot-error', role: 'alert' },
    h('p', {}, 'Wonder Garage could not start.'),
    h('p', { class: 'small' }, msg),
    h('button', { type: 'button', class: 'boot-reload', on: { click: () => location.reload() } }, 'Reload'),
  );
  document.body.append(panel);
}

const app = new App();
app.boot().catch((e) => {
  console.error(e);
  showBootError(e);
});
