import { h } from '../dom';
import { icon } from '../icons';
import { rigSvg } from '../../art/portrait';
import { avatarRig } from '../../art/cast';
import { AVATAR_SPECIES } from '../../art/cast/avatars';
import type { Profile } from '../../save/schema';
import { audio } from '../../core/audio';
import { lanternSvg } from '../loading';
import { adultGateButton } from '../adult/gate';

export function displayName(p: Profile): string {
  return p.nickname || AVATAR_SPECIES.find((s) => s.id === p.avatar.species)?.name || 'Explorer';
}

/**
 * "Who's playing?" — big picture cards. Names are local labels only; the
 * pictures carry the meaning for children who don't read yet.
 */
export function profileScreen(layer: HTMLElement, profiles: Profile[], onPick: (id: string) => void, onAdult: () => void): HTMLElement {
  const cards = profiles.map((p) =>
    h(
      'button',
      {
        class: 'card',
        type: 'button',
        'data-profile': p.id,
        'aria-label': `Play as ${displayName(p)}`,
        on: {
          click: () => {
            audio.play('confirm');
            onPick(p.id);
          },
        },
      },
      h('div', { class: 'art', html: rigSvg(avatarRig(p.avatar.species, p.avatar.color), { hat: p.avatar.hat, expression: 'happy' }) }),
      h('span', {}, displayName(p)),
    ),
  );
  const el = h(
    'div',
    { class: 'screen', role: 'main', 'aria-label': 'Who is playing?' },
    h('div', { class: 'title-mark' }, h('div', { html: lanternSvg, style: 'width:90px;height:110px;margin:0 auto 6px' }), h('h1', {}, 'Wonderwood'), h('p', {}, 'The Lantern Club')),
    h('div', { class: 'profiles' }, ...cards),
    h('div', { class: 'corner-gear' }, adultGateButton(onAdult)),
  );
  layer.append(el);
  return el;
}

export { icon };
