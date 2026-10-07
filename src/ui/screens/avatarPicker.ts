import { h } from '../dom';
import { icon } from '../icons';
import { rigSvg } from '../../art/portrait';
import { avatarRig } from '../../art/cast';
import { AVATAR_SPECIES, type AvatarSpecies } from '../../art/cast/avatars';
import { CHOICE_COLORS } from '../../art/palette';
import type { AvatarLook } from '../../save/schema';
import { audio } from '../../core/audio';

/**
 * The child picks an explorer, then an outfit colour. Pictures only; every tap
 * gives immediate feedback (sound + the character reacting).
 */
export function avatarPicker(layer: HTMLElement, start: AvatarLook, onDone: (look: AvatarLook) => void, onSpeak: (text: string) => void): HTMLElement {
  let species: AvatarSpecies = start.species;
  let color = start.color;
  const preview = h('div', { class: 'art', style: 'width:min(300px,40vw);aspect-ratio:1;display:grid;place-items:center' });
  const draw = (expr: 'happy' | 'excited' = 'happy') => {
    preview.innerHTML = rigSvg(avatarRig(species, color), { expression: expr, hat: start.hat });
    preview.animate?.([{ transform: 'scale(1)' }, { transform: 'scale(1.08) translateY(-10px)' }, { transform: 'scale(1)' }], { duration: 320, easing: 'ease-out' });
  };
  const speciesTiles = AVATAR_SPECIES.map((s) =>
    h(
      'button',
      {
        class: 'tile',
        type: 'button',
        'aria-label': s.name,
        'aria-pressed': String(s.id === species),
        'data-species': s.id,
        on: {
          click: () => {
            species = s.id;
            audio.play('pop', { pitch: 0.9 + AVATAR_SPECIES.indexOf(s) * 0.1 });
            speciesTiles.forEach((t) => t.setAttribute('aria-pressed', String(t.dataset.species === species)));
            colorTiles.forEach((t) => (t.innerHTML = rigSvg(avatarRig(species, t.dataset.color!), { crop: 'head' })));
            draw('excited');
          },
        },
      },
      h('span', { html: rigSvg(avatarRig(s.id, color), { crop: 'full' }), style: 'width:120px;height:120px;display:block' }),
    ),
  );
  const colorTiles = CHOICE_COLORS.map((c) =>
    h('button', {
      class: 'swatch',
      type: 'button',
      'aria-label': c.name,
      'aria-pressed': String(c.id === color),
      'data-color': c.id,
      style: `background:${c.hex}`,
      html: rigSvg(avatarRig(species, c.id), { crop: 'head' }),
      on: {
        click: () => {
          color = c.id;
          audio.play('tap', { pitch: 1 + CHOICE_COLORS.indexOf(c) * 0.08 });
          colorTiles.forEach((t) => t.setAttribute('aria-pressed', String(t.dataset.color === color)));
          speciesTiles.forEach((t) => {
            const sp = t.dataset.species as AvatarSpecies;
            (t.firstElementChild as HTMLElement).innerHTML = rigSvg(avatarRig(sp, color), { crop: 'full' });
          });
          draw('excited');
        },
      },
    }),
  );
  const go = h(
    'button',
    {
      class: 'btn primary',
      type: 'button',
      'aria-label': 'Ready!',
      'data-avatar-done': true,
      style: 'min-width:140px;min-height:84px',
      on: {
        click: () => {
          audio.play('success');
          onDone({ species, color, hat: start.hat });
        },
      },
    },
    h('span', { html: icon('check') }),
  );
  const el = h(
    'div',
    { class: 'screen paper', role: 'main', 'aria-label': 'Pick your explorer' },
    h('div', { style: 'display:flex;gap:28px;align-items:center;flex-wrap:wrap;justify-content:center' }, preview, h('div', { style: 'display:flex;flex-direction:column;gap:18px;align-items:center' }, h('div', { class: 'picker-grid' }, ...speciesTiles), h('div', { class: 'swatches' }, ...colorTiles))),
    go,
  );
  layer.append(el);
  draw();
  setTimeout(() => onSpeak('Pick your explorer, then a colour!'), 400);
  speciesTiles[0].focus();
  return el;
}
