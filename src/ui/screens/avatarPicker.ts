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
  // talk the child through it: animal, then colour, then the green tick
  let pickedAnimal = false;
  let pickedColour = false;
  let nudge: ReturnType<typeof setTimeout> | null = null;
  const readyNow = () => {
    go.classList.add('glow');
    if (nudge) clearTimeout(nudge);
    nudge = setTimeout(() => el.isConnected && onSpeak('Tap the big green tick when you’re ready!'), 9000);
  };
  const SOUND: Record<AvatarSpecies, Parameters<typeof audio.play>[0]> = { fox: 'chirp', hedgehog: 'rustle', mouse: 'squeak', frog: 'croak' };
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
            audio.play(SOUND[s.id]);
            if (!pickedAnimal) {
              pickedAnimal = true;
              onSpeak('Now tap a colour!');
            } else if (pickedColour) readyNow();
            speciesTiles.forEach((t) => t.setAttribute('aria-pressed', String(t.dataset.species === species)));
            colorTiles.forEach((t) => (t.innerHTML = rigSvg(avatarRig(species, t.dataset.color!), { crop: 'head' })));
            draw('excited');
          },
        },
      },
      h('span', { html: rigSvg(avatarRig(s.id, color), { crop: 'head' }), style: 'width:120px;height:120px;display:block' }),
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
            (t.firstElementChild as HTMLElement).innerHTML = rigSvg(avatarRig(sp, color), { crop: 'head' });
          });
          draw('excited');
          if (!pickedColour) {
            pickedColour = true;
            onSpeak('Tap the big green tick when you’re ready!');
          }
          readyNow();
        },
      },
    }),
  );
  const go = h(
    'button',
    {
      class: 'btn go',
      type: 'button',
      'aria-label': 'Ready!',
      'data-avatar-done': true,
      style: 'min-width:150px;min-height:96px',
      on: {
        click: () => {
          if (nudge) clearTimeout(nudge);
          audio.play('success');
          onDone({ species, color, hat: start.hat });
        },
      },
    },
    h('span', { html: icon('yes', 72) }),
  );
  const el = h(
    'div',
    { class: 'screen paper', role: 'main', 'aria-label': 'Pick your explorer' },
    h('div', { style: 'display:flex;gap:28px;align-items:center;flex-wrap:wrap;justify-content:center' }, preview, h('div', { style: 'display:flex;flex-direction:column;gap:18px;align-items:center' }, h('div', { class: 'picker-grid' }, ...speciesTiles), h('div', { class: 'swatches' }, ...colorTiles))),
    go,
  );
  layer.append(el);
  draw();
  setTimeout(() => onSpeak('Who do you want to be? Tap an animal!'), 400);
  speciesTiles[0].focus();
  return el;
}
