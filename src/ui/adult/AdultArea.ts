import { h } from '../dom';
import { services } from '../../app/services';
import { GAME_IDS, type GameId, type PresetId, type Profile, MAX_CREATIONS_PER_KIND } from '../../save/schema';
import { narration } from '../../core/narration';
import { OFFSCREEN } from '../../content/offscreen';
import { FEATURES } from '../../content/featureStatus';
import { displayName } from '../screens/profiles';
import { requestPersistentStorage } from '../../save/persist';

const GAME_NAMES: Record<GameId, string> = { trail: 'Lantern Trail', tinker: 'Tinker Grove', picnic: 'Picnic Parade', stage: 'Story Stage' };
const QUEST_NAMES: Record<string, string> = {
  'windmill-kite': 'The Windmill Kite',
  'picnic-bridge': 'The Picnic Bridge',
  waterwheel: 'The Waterwheel Mix-Up',
  'lantern-launch': 'The Lantern Launch',
};

export interface AdultHandlers {
  onClose(): void;
  onDataReplaced(): void;
  onSettingsChanged(): void;
  onAddPlayer(): void;
}

/**
 * Grown-up area: calm, readable, factual. Reports what was played and made
 * from saved game state — never inferred feelings or traits.
 */
export function openAdultArea(layer: HTMLElement, handlers: AdultHandlers): HTMLElement {
  const save = services.save;
  const main = h('main');
  const el = h(
    'div',
    { class: 'adult', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Grown-up area' },
    h('header', {}, h('h1', {}, 'Wonderwood — grown-up area'), h('button', { type: 'button', 'data-adult-close': true, on: { click: () => close() } }, 'Back to the game')),
    main,
  );
  const close = () => {
    void save.flush();
    el.remove();
    handlers.onClose();
  };
  el.addEventListener('keydown', (e) => e.key === 'Escape' && close());
  layer.append(el);

  let flash: { kind: 'notice' | 'error'; text: string } | null = null;
  // ask the browser to keep saves when space runs low (a grown-up is present, so a permission question is fine)
  const keepNote = h('p', { 'data-persist': 'unknown' }, 'Checking whether this browser will keep saves if space runs low…');
  void requestPersistentStorage().then((kept) => {
    keepNote.dataset.persist = String(kept);
    keepNote.textContent = kept
      ? 'This browser will keep these saves even if the device runs low on space.'
      : 'This browser may clear saves if the device runs very low on space. Use “Export saves” below now and then to keep a copy.';
  });
  const render = () => {
    main.replaceChildren(statusSection(), ...save.listProfiles().map(playerSection), addPlayerSection(), senseSection(), ideasSection(), savesSection(), aboutSection());
  };

  // ------------------------------------------------------------ status
  const statusSection = () => {
    const s = save.status;
    const items: HTMLElement[] = [];
    if (flash) items.push(h('div', { class: flash.kind, role: 'status' }, flash.text));
    if (s.readOnly) items.push(h('div', { class: 'error' }, 'Saving is paused to protect your existing saves. ', ...s.notices.filter((n) => /newer|protect|could not be read/i.test(n)).map((n) => h('div', {}, n))));
    if (s.quotaFull) items.push(h('div', { class: 'error' }, s.lastError ?? 'Storage is full.', ' Use “Export saves” below to keep a copy.'));
    else if (s.lastError) items.push(h('div', { class: 'error' }, s.lastError));
    for (const n of s.notices) items.push(h('div', { class: 'notice' }, n));
    const last = s.lastSavedAt ? new Date(s.lastSavedAt).toLocaleTimeString() : 'not yet this session';
    return h(
      'section',
      {},
      h('h2', {}, 'Saving'),
      h('p', {}, `Saved in: ${s.backend === 'indexeddb' ? 'this browser’s storage (IndexedDB)' : s.backend === 'localstorage' ? 'this browser’s small storage (localStorage)' : 'memory only — will be lost when the page closes'}. Last saved: ${last}.`),
      s.backend === 'memory' ? null : keepNote,
      ...items,
    );
  };

  // ------------------------------------------------------------ players
  const presetSelect = (value: PresetId | undefined, includeDefault: boolean, onChange: (v: PresetId | undefined) => void, label: string) => {
    const sel = h(
      'select',
      { 'aria-label': label, on: { change: () => onChange(sel.value === '' ? undefined : (sel.value as PresetId)) } },
      includeDefault ? h('option', { value: '' }, 'Same as player') : null,
      h('option', { value: 'more-help' }, 'More help'),
      h('option', { value: 'more-exploring' }, 'More exploring'),
    );
    sel.value = value ?? '';
    return sel;
  };

  const playerSection = (p: Profile) => {
    const upd = (fn: (x: Profile) => void) => {
      save.updateProfile(p.id, fn);
      handlers.onSettingsChanged();
    };
    const name = h('input', { type: 'text', value: p.nickname, maxlength: '24', 'aria-label': 'Nickname', on: { change: () => upd((x) => (x.nickname = name.value.trim())) } });
    const minutes = h(
      'select',
      { 'aria-label': 'Reminder', on: { change: () => upd((x) => (x.settings.reminder.minutes = Number(minutes.value))) } },
      ...[0, 10, 15, 20, 30, 45, 60].map((m) => h('option', { value: String(m) }, m === 0 ? 'Off' : `After ${m} minutes of play`)),
    );
    minutes.value = String(p.settings.reminder.minutes);
    const grace = h(
      'select',
      { 'aria-label': 'When the reminder appears', on: { change: () => upd((x) => (x.settings.reminder.grace = Number(grace.value) as 0 | 2 | 5)) } },
      h('option', { value: '0' }, 'Offer “Save and finish” only'),
      h('option', { value: '2' }, 'Also allow finishing the current part (2 min, once)'),
      h('option', { value: '5' }, 'Also allow finishing the current part (5 min, once)'),
    );
    grace.value = String(p.settings.reminder.grace);
    const perGame = GAME_IDS.map((g) =>
      h('label', {}, `${GAME_NAMES[g]}:`, presetSelect(p.settings.perGame[g], true, (v) => upd((x) => (v ? (x.settings.perGame[g] = v) : delete x.settings.perGame[g])), `${GAME_NAMES[g]} help level`)),
    );
    const quests = Object.entries(p.progress.quests)
      .filter(([, q]) => q.status === 'done')
      .map(([id, q]) => `${QUEST_NAMES[id] ?? id}${q.completions > 1 ? ` (${q.completions} times)` : ''}`);
    const counts = (['invention', 'story', 'picnic'] as const).map((k) => `${save.listCreations(p.id, k).length}/${MAX_CREATIONS_PER_KIND} ${k === 'invention' ? 'inventions' : k === 'story' ? 'stories' : 'picnic creations'}`);
    const log = p.progress.log.slice(-15).reverse();
    // optional free text: a grown-up can type a story title; children never need to read or type to make one
    const stories = save.listCreations(p.id, 'story');
    const titles = stories.length
      ? h(
          'details',
          {},
          h('summary', {}, 'Story titles (optional, for a grown-up to type)'),
          h('p', { class: 'note' }, 'Making a story never needs reading or typing. If your child would like a title, type it here; it’s read out before their show.'),
          ...stories.map((c) => {
            const input = h('input', { type: 'text', maxlength: 40, value: c.name, 'aria-label': 'Story title', 'data-story-title': c.id }) as HTMLInputElement;
            input.addEventListener('change', async () => {
              const v = input.value.trim().slice(0, 40);
              if (!v) return;
              const data = { ...(c.data as Record<string, unknown>), title: v };
              await save.saveCreation({ id: c.id, profileId: p.id, kind: 'story', name: v, data, preview: c.preview });
            });
            return h('label', { style: 'display:flex;align-items:center;gap:10px' }, c.preview ? h('img', { src: c.preview, alt: '', style: 'width:96px;border-radius:8px' }) : null, input);
          }),
        )
      : null;
    return h(
      'section',
      { 'data-adult-player': p.id },
      h('h2', {}, `Player: ${displayName(p)}`),
      h('label', {}, 'Nickname (stays on this device):', name),
      h('label', {}, 'Starting help level:', presetSelect(p.settings.preset, false, (v) => v && upd((x) => (x.settings.preset = v)), 'Starting help level')),
      h('details', {}, h('summary', {}, 'Different help level for a particular game'), ...perGame),
      h('h3', {}, 'Play-time reminder'),
      h('label', {}, minutes),
      h('label', {}, grace),
      h('p', { class: 'note' }, 'Reminders count only active play (pauses don’t count). Choose a length that suits your family — it isn’t a medical recommendation. Work is always saved; nothing is erased to enforce a timer.'),
      h('h3', {}, 'What has been played and made'),
      h('p', {}, quests.length ? `Finished: ${quests.join(', ')}.` : 'No adventures finished yet.'),
      h('p', {}, `Shelves: ${counts.join(' · ')}. Souvenirs: ${Object.keys(p.progress.souvenirs).length}.`),
      titles,
      log.length
        ? h('ul', { class: 'log' }, ...log.map((e) => h('li', {}, `${new Date(e.at).toLocaleDateString()} — ${e.text}`)))
        : h('p', { class: 'note' }, 'Nothing recorded yet.'),
      h('p', { class: 'note' }, 'These notes describe game events only. They are not a measure of confidence, empathy, or any personal trait.'),
      h(
        'p',
        {},
        h('button', { type: 'button', on: { click: () => upd((x) => delete x.progress.done.avatar) } }, 'Let them choose a new explorer next time'),
        ' ',
        h('button', {
          type: 'button',
          class: 'warn',
          'data-reset-profile': p.id,
          on: {
            click: async () => {
              const ok = window.confirm(`Reset ${displayName(p)}'s progress and creations? Their nickname and settings stay. A backup copy is kept and can be exported.`);
              if (!ok) return;
              await save.resetProfile(p.id);
              render();
            },
          },
        }, 'Reset this player…'),
      ),
    );
  };

  const addPlayerSection = () =>
    h('section', {}, h('h2', {}, 'Add a player'), h('button', { type: 'button', on: { click: () => { handlers.onAddPlayer(); render(); } } }, 'Add another player'));

  // ------------------------------------------------------------ senses
  const senseSection = () => {
    const d = save.device;
    const set = (fn: (x: typeof d) => void) => {
      save.updateDevice(fn);
      handlers.onSettingsChanged();
    };
    const slider = (label: string, key: 'music' | 'sfx' | 'voice') => {
      const inp = h('input', { type: 'range', min: '0', max: '1', step: '0.05', value: String(d.volume[key]), 'aria-label': label, on: { input: () => set((x) => (x.volume[key] = Number(inp.value))) } });
      return h('label', {}, `${label}:`, inp);
    };
    const check = (label: string, get: () => boolean, put: (v: boolean) => void) => {
      const c = h('input', { type: 'checkbox', checked: get(), on: { change: () => put(c.checked) } });
      return h('label', {}, c, label);
    };
    const motionSel = h(
      'select',
      { 'aria-label': 'Motion', on: { change: () => set((x) => (x.motion = motionSel.value as typeof x.motion)) } },
      h('option', { value: 'system' }, 'Follow this device’s setting'),
      h('option', { value: 'reduced' }, 'Reduced motion'),
      h('option', { value: 'full' }, 'Full motion'),
    );
    motionSel.value = d.motion;
    const voice = narration.voiceName;
    return h(
      'section',
      {},
      h('h2', {}, 'Sound, voice and motion (this device)'),
      slider('Music', 'music'),
      slider('Sound effects', 'sfx'),
      slider('Character voices & narration', 'voice'),
      check('Mute everything', () => d.muted, (v) => set((x) => (x.muted = v))),
      check('Quieter presentation (softer sounds, no music percussion, fewer effects)', () => d.quiet, (v) => set((x) => (x.quiet = v))),
      check('Show captions', () => d.captions, (v) => set((x) => (x.captions = v))),
      h('label', {}, 'Motion:', motionSel),
      check('Read instructions aloud with an on-device voice (when available)', () => d.narration === 'auto', (v) => set((x) => (x.narration = v ? 'auto' : 'off'))),
      h(
        'p',
        { class: 'note' },
        voice
          ? `On-device voice found: “${voice}”. This is a temporary computer voice, not voice acting. Only voices your browser marks as on-device are used, so no text is sent to an online speech service.`
          : 'No on-device voice was found in this browser, so narration is off. Characters speak with playful sounds and captions, and every instruction is also shown with a demonstration hand.',
      ),
    );
  };

  // ------------------------------------------------------------ ideas
  const ideasSection = () => {
    const played = new Set<string>();
    for (const p of save.listProfiles()) {
      for (const [id, q] of Object.entries(p.progress.quests)) if (q.status !== 'new') played.add(id);
      for (const k of Object.keys(p.progress.done)) played.add(k);
    }
    const ideas = OFFSCREEN.filter((o) => played.has(o.when)).concat(OFFSCREEN.filter((o) => o.when === 'any')).slice(0, 4);
    return h(
      'section',
      {},
      h('h2', {}, 'Ideas for together, away from the screen (optional)'),
      h('ul', {}, ...ideas.map((i) => h('li', {}, i.idea))),
      h('p', { class: 'note' }, 'Just invitations — skip them freely. Nothing in the game depends on them.'),
    );
  };

  // ------------------------------------------------------------ saves
  const savesSection = () => {
    const out = h('div');
    const file = h('input', { type: 'file', accept: 'application/json,.json', 'aria-label': 'Choose a save file' });
    file.addEventListener('change', async () => {
      const f = file.files?.[0];
      if (!f) return;
      const text = await f.text();
      const res = save.parseImport(text);
      if (!res.ok) {
        out.replaceChildren(h('div', { class: 'error' }, 'This file can’t be imported. Your current saves are unchanged.', h('ul', {}, ...res.errors.map((e) => h('li', {}, e)))));
        return;
      }
      const sum = res.summary;
      const confirmBtn = h('button', { type: 'button', class: 'primary', on: { click: async () => {
        const r = await save.applyImport(res.file);
        if (r.ok) {
          flash = { kind: 'notice', text: 'Imported. Your previous saves were backed up first.' };
          handlers.onDataReplaced();
          render();
          main.scrollTop = 0;
          el.scrollTop = 0;
        } else out.replaceChildren(h('div', { class: 'error' }, `Import failed: ${r.message ?? r.reason}. Your saves were backed up before trying.`));
      } } }, 'Replace current saves with this file');
      out.replaceChildren(
        h('div', { class: 'notice' }, `This file (exported ${sum.exportedAt ? new Date(sum.exportedAt).toLocaleString() : 'at an unknown time'}) contains: `, sum.profiles.map((p) => `${p.nickname || 'unnamed player'} (${p.creations} creations)`).join(', '), '.'),
        confirmBtn,
      );
    });
    const estimate = h('p', { class: 'note' }, 'Checking storage…');
    void navigator.storage?.estimate?.().then((e) => {
      if (e && e.quota) estimate.textContent = `This browser reports about ${(((e.usage ?? 0) / 1024 / 1024) || 0).toFixed(1)} MB used of roughly ${(e.quota / 1024 / 1024).toFixed(0)} MB available for this site.`;
      else estimate.textContent = '';
    }).catch(() => (estimate.textContent = ''));
    const backupsInfo = h('p', { class: 'note' });
    void save.listBackups().then((b) => (backupsInfo.textContent = b.length ? `${b.length} safety backup(s) are kept (made before imports, resets, migrations, or repairs). They are included when you export.` : 'No safety backups yet.'));
    return h(
      'section',
      {},
      h('h2', {}, 'Save files'),
      h('p', {}, 'Saves live only in this browser on this device. Clearing browser data, using a private window, or switching browsers or devices means starting fresh — export a save file to keep a copy or move it.'),
      h('button', { type: 'button', 'data-export': true, on: { click: () => void exportSaves() } }, 'Export saves (download a file)'),
      h('h3', {}, 'Restore from a file'),
      file,
      out,
      estimate,
      backupsInfo,
    );
  };

  const exportSaves = async () => {
    await save.flush();
    const backups = await save.listBackups();
    const data = { ...save.exportFile(), backups };
    const blob = new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' });
    const a = h('a', { href: URL.createObjectURL(blob), download: `wonderwood-save-${new Date().toISOString().slice(0, 10)}.json` });
    document.body.append(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 1000);
  };

  // ------------------------------------------------------------ about
  const aboutSection = () =>
    h(
      'section',
      {},
      h('h2', {}, 'About, privacy and what’s not finished'),
      h(
        'ul',
        {},
        h('li', {}, 'No accounts, ads, purchases, analytics, chat, camera or microphone. The game makes no network requests while playing.'),
        h('li', {}, 'Characters are scripted; no AI talks to your children.'),
        h('li', {}, 'This is a family game with chances to practise things like taking turns and asking for help. It does not treat anxiety, change personality, measure empathy, or guarantee friendships.'),
      ),
      h('h3', {}, 'Feature status'),
      h('table', {}, h('tbody', {}, ...FEATURES.map((f) => h('tr', {}, h('td', {}, f.name), h('td', {}, f.status === 'ready' ? 'Ready' : f.status === 'partial' ? 'Partly ready' : 'Not built yet'), h('td', { class: 'note' }, f.note ?? ''))))),
    );

  render();
  (el.querySelector('[data-adult-close]') as HTMLElement | null)?.focus();
  return el;
}
