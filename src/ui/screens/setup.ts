import { h } from '../dom';
import { SPECIES, type PresetId } from '../../save/schema';
import { rigSvg } from '../../art/portrait';
import { avatarRig } from '../../art/cast';
import { AVATAR_SPECIES } from '../../art/cast/avatars';

/** Same starting animal and colour App gives each new player, so the grown-up can say "you're the fox". */
const COLORS = ['sun', 'sea', 'leaf', 'plum'];

export interface SetupResult {
  players: { nickname: string; preset: PresetId }[];
}

/**
 * First-run grown-up setup. Nicknames are optional and stay on this device.
 * Starting help levels are just a starting point and can be changed any time.
 */
export function setupScreen(layer: HTMLElement, onDone: (r: SetupResult) => void, onImport: () => void): HTMLElement {
  const rows: { name: HTMLInputElement; preset: HTMLSelectElement; row: HTMLElement; title: HTMLElement; pic: HTMLElement }[] = [];
  const list = h('div');
  // label rows "Player 1, 2…" and show each one's animal (re-done when a row is removed)
  const refresh = () =>
    rows.forEach((r, i) => {
      const sp = SPECIES[i % SPECIES.length];
      r.title.textContent = `Player ${i + 1}`;
      r.pic.innerHTML = rigSvg(avatarRig(sp, COLORS[i % 4]), { crop: 'head' });
      r.pic.title = AVATAR_SPECIES.find((x) => x.id === sp)?.name ?? '';
    });
  const addRow = (preset: PresetId) => {
    if (rows.length >= 4) return;
    const name = h('input', { type: 'text', maxlength: '24', placeholder: 'Nickname (optional)', 'aria-label': `Player ${rows.length + 1} nickname`, autocomplete: 'off' });
    const sel = h(
      'select',
      { 'aria-label': `Player ${rows.length + 1} starting help` },
      h('option', { value: 'more-help', ...(preset === 'more-help' ? { selected: true } : {}) }, 'More help'),
      h('option', { value: 'more-exploring', ...(preset === 'more-exploring' ? { selected: true } : {}) }, 'More exploring'),
    );
    const remove = h('button', { type: 'button', on: { click: () => {
      if (rows.length <= 1) return;
      const i = rows.findIndex((r) => r.row === row);
      rows.splice(i, 1);
      row.remove();
      refresh();
    } } }, 'Remove');
    const title = h('strong', {}, 'Player');
    const pic = h('span', { style: 'width:56px;height:56px;display:inline-block;vertical-align:middle' });
    const row = h('label', {}, pic, title, name, sel, remove);
    rows.push({ name, preset: sel, row, title, pic });
    list.append(row);
    refresh();
  };
  addRow('more-exploring');
  addRow('more-help');
  const el = h(
    'div',
    { class: 'adult', role: 'main', 'aria-label': 'Grown-up setup' },
    h('header', {}, h('h1', {}, 'Wonderwood — grown-up setup (about a minute)')),
    h(
      'main',
      {},
      h(
        'section',
        {},
        h('h2', {}, 'Players'),
        h('p', { class: 'note' }, 'Each player starts as the animal shown, and your child taps that animal to play (they can change it next). Each child gets their own profile and saves. Nicknames are optional and are stored only in this browser on this device. “More help” and “More exploring” are starting points — you can change them per child and per game later in the grown-up area.'),
        list,
        h('button', { type: 'button', on: { click: () => addRow('more-help') } }, 'Add another player'),
      ),
      h(
        'section',
        {},
        h('h2', {}, 'Good to know'),
        h(
          'ul',
          {},
          h('li', {}, 'Everything is saved locally in this browser. Nothing is sent anywhere; there are no accounts, ads, or purchases.'),
          h('li', {}, 'The grown-up area is behind the gear button: press and hold it, then answer a short reading question. It keeps little fingers out but is not real security.'),
          h('li', {}, 'You can set gentle play-time reminders for each child in the grown-up area (off by default).'),
        ),
      ),
      h(
        'section',
        {},
        h('button', {
          class: 'primary',
          type: 'button',
          'data-setup-done': true,
          on: {
            click: () => onDone({ players: rows.map((r) => ({ nickname: r.name.value.trim(), preset: r.preset.value as PresetId })) }),
          },
        }, 'Done — ready to play'),
        ' ',
        h('button', { type: 'button', on: { click: onImport } }, 'Restore from a save file instead…'),
      ),
    ),
  );
  layer.append(el);
  return el;
}
