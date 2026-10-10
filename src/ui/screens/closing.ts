import { h } from '../dom';
import { icon } from '../icons';
import { lanternSvg } from '../loading';
import { audio } from '../../core/audio';

/**
 * The gentle finish: acknowledges what was made, confirms it's saved, and then
 * rests. No teaser, no new mission, nothing asking the child to stay.
 */
export function closingScreen(layer: HTMLElement, made: { kind: string; label: string; art?: string }[], portrait: string, onRest: () => void, onKeepPlaying: (() => void) | null = null): HTMLElement {
  const stars = h('div', { class: 'stars' });
  for (let i = 0; i < 40; i++) {
    const s = h('i', { style: `left:${(i * 37) % 100}%;top:${(i * 53) % 70}%;animation-delay:${(i % 7) * 0.4}s` });
    stars.append(s);
  }
  const items = made.slice(-6).map((m, i) =>
    h('figure', { style: `animation-delay:${0.2 + i * 0.15}s` }, h('div', { html: m.art ?? icon('star', 96), style: 'height:120px;display:grid;place-items:center' }), h('figcaption', {}, m.label)),
  );
  const rest = h(
    'button',
    {
      class: 'btn primary',
      type: 'button',
      'aria-label': 'All done',
      'data-closing-done': true,
      on: {
        click: () => {
          audio.play('confirm');
          onRest();
        },
      },
    },
    h('span', { html: icon('moon', 64) }),
  );
  // tapped the moon by mistake? one big tap goes straight back
  const back = onKeepPlaying
    ? h(
        'button',
        {
          class: 'btn go',
          type: 'button',
          'aria-label': 'Keep playing',
          'data-closing-back': true,
          on: {
            click: () => {
              audio.play('confirm');
              onKeepPlaying();
            },
          },
        },
        h('span', { html: icon('play', 64) }),
      )
    : null;
  const el = h(
    'div',
    { class: 'closing', role: 'main', 'aria-label': 'Saved. See you next time.' },
    stars,
    h('div', { html: lanternSvg, style: 'width:110px;height:140px' }),
    h('div', { style: 'width:120px;height:120px;border-radius:50%;background:#fbf3e4;border:4px solid #3b2a20;overflow:hidden', html: portrait }),
    h('h2', {}, made.length ? 'Look what you made today!' : 'Good playing today!'),
    items.length ? h('div', { class: 'made' }, ...items) : null,
    h('p', { style: 'font:700 22px var(--font);opacity:.9;margin:0' }, 'Everything is saved. The lanterns will be here next time.'),
    h('div', { class: 'row', style: 'gap:28px' }, back, rest),
  );
  layer.append(el);
  return el;
}

export function restScreen(layer: HTMLElement, onWake: () => void): HTMLElement {
  const el = h(
    'div',
    { class: 'closing', role: 'main', 'aria-label': 'Resting' },
    h('div', { html: lanternSvg, style: 'width:90px;height:110px;opacity:.85' }),
    h('p', { style: 'font:700 22px var(--font);opacity:.85' }, 'Saved. Sleep well, Wonderwood.'),
    h('button', { class: 'btn small', type: 'button', 'aria-label': 'Open Wonderwood again', on: { click: onWake } }, h('span', { html: icon('play') })),
  );
  layer.append(el);
  return el;
}
