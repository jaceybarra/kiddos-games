import { app } from '../app/context';
import { gatePicture, type GateShape } from '../art/pictures';
import { cleanName, type Settings } from '../save/schema';
import { h, icon, layer, trapFocus } from './dom';
import './parent.css';

/**
 * The grown-up area. A gate (press and hold the shape the instruction names;
 * the shape changes every time) keeps small fingers out. It is friction,
 * not security. Then a plain settings panel with honest save and offline
 * status, backup, and start-over.
 */
const SHAPES: GateShape[] = ['star', 'moon', 'heart', 'triangle'];
const NAMES: Record<GateShape, string> = { star: 'star', moon: 'moon', heart: 'heart', triangle: 'triangle' };
const HOLD_MS = 2000;

function shuffle<T>(a: T[]): T[] {
  const b = a.slice();
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}

let lastAsked: GateShape | null = null;

export function openParentGate(): Promise<boolean> {
  return new Promise((resolve) => {
    let done = false;
    let release = () => undefined as void;
    const finish = (ok: boolean) => {
      if (done) return;
      done = true;
      release();
      window.removeEventListener('keydown', onKey);
      wrap.remove();
      resolve(ok);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') finish(false);
    };
    const prompt = h('p', { class: 'gate-prompt' });
    const row = h('div', { class: 'gate-row' });
    const card = h('div', { class: 'grownup gate-card', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'For grown-ups' });
    const wrap = h('div', { class: 'grownup-backdrop', 'data-testid': 'gate' }, card);
    let asked: GateShape = 'star';

    const setup = () => {
      const pool = SHAPES.filter((s) => s !== lastAsked);
      asked = pool[Math.floor(Math.random() * pool.length)];
      lastAsked = asked;
      const shown = shuffle([asked, ...shuffle(SHAPES.filter((s) => s !== asked)).slice(0, 2)]);
      wrap.setAttribute('data-asked', asked);
      prompt.textContent = `For grown-ups: press and hold the ${NAMES[asked]} for 2 seconds.`;
      row.replaceChildren(...shown.map((s) => shapeButton(s)));
    };

    const shapeButton = (shape: GateShape): HTMLElement => {
      const ring = h('span', { class: 'gate-ring' });
      const b = h('button', { type: 'button', class: 'gate-shape', 'data-testid': `gate-${shape}`, 'aria-label': `Hold the ${NAMES[shape]}`, html: gatePicture(shape) }, ring);
      let timer: ReturnType<typeof setTimeout> | null = null;
      const start = () => {
        if (timer || done) return;
        if (shape !== asked) {
          // a wrong shape: a new instruction (and a new order)
          b.classList.add('nope');
          setTimeout(setup, 250);
          return;
        }
        ring.classList.add('filling');
        timer = setTimeout(() => finish(true), HOLD_MS);
      };
      const stop = () => {
        if (timer) clearTimeout(timer);
        timer = null;
        ring.classList.remove('filling');
      };
      b.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        b.setPointerCapture?.(e.pointerId);
        start();
      });
      b.addEventListener('pointerup', stop);
      b.addEventListener('pointercancel', stop);
      b.addEventListener('lostpointercapture', stop);
      b.addEventListener('keydown', (e) => {
        if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) {
          e.preventDefault();
          start();
        }
      });
      b.addEventListener('keyup', (e) => {
        if (e.key === ' ' || e.key === 'Enter') stop();
      });
      return b;
    };

    const close = h('button', { type: 'button', class: 'grownup-close', 'aria-label': 'Close', 'data-testid': 'gate-close', html: icon('close'), on: { click: () => finish(false) } });
    card.append(close, prompt, row);
    setup();
    layer('gate').append(wrap);
    release = trapFocus(card);
    window.addEventListener('keydown', onKey);
  });
}

// ---------------------------------------------------------------- settings panel

let openPanel: HTMLElement | null = null;

export function openParentSettings(): void {
  if (openPanel) return;
  const a = app();
  let release = () => undefined as void;
  const body = h('div', { class: 'grownup-body' });
  const status = h('p', { class: 'set-status', role: 'status', 'aria-live': 'polite' });
  const panel = h('div', { class: 'grownup settings-panel', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Grown-up settings', 'data-testid': 'settings' });
  const wrap = h('div', { class: 'grownup-backdrop' }, panel);
  const close = () => {
    release();
    window.removeEventListener('keydown', onKey);
    wrap.remove();
    openPanel = null;
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') close();
  };
  const say = (msg: string) => {
    status.textContent = msg;
  };
  const change = async (patch: Partial<Settings>) => {
    const s = a.save;
    const ok = await a.commit({ ...s, settings: { ...s.settings, ...patch } });
    say(ok ? 'Saved.' : `Could not save: ${a.store.status.lastError ?? 'unknown problem'}. The change applies until the game is closed.`);
    render();
  };

  const toggle = (key: keyof Settings, label: string, hint?: string) => {
    const input = h('input', { type: 'checkbox', 'data-testid': `set-${key}`, id: `set-${key}` }) as HTMLInputElement;
    input.checked = !!a.settings[key];
    input.addEventListener('change', () => void change({ [key]: input.checked } as Partial<Settings>));
    return h('div', { class: 'set-row' }, h('label', { for: `set-${key}` }, input, h('span', {}, label)), hint ? h('p', { class: 'set-hint' }, hint) : null);
  };
  const choice = <T extends string | number>(key: keyof Settings, label: string, options: [T, string][]) => {
    const sel = h('select', { 'data-testid': `set-${key}`, id: `set-${key}` }) as HTMLSelectElement;
    for (const [v, text] of options) {
      const o = h('option', { value: String(v) }, text) as HTMLOptionElement;
      if (String(a.settings[key]) === String(v)) o.selected = true;
      sel.append(o);
    }
    sel.addEventListener('change', () => {
      const raw = sel.value;
      const v = typeof options[0][0] === 'number' ? Number(raw) : raw;
      void change({ [key]: v } as Partial<Settings>);
    });
    return h('div', { class: 'set-row' }, h('label', { for: `set-${key}` }, h('span', {}, label), sel));
  };

  const render = () => {
    const st = a.store.status;
    const off_ = a.offline;
    const nameInput = h('input', { type: 'text', maxlength: '16', value: a.settings.childName, 'data-testid': 'set-childName', id: 'set-childName', autocomplete: 'off' }) as HTMLInputElement;
    nameInput.addEventListener('change', () => {
      const v = cleanName(nameInput.value);
      nameInput.value = v;
      void change({ childName: v });
    });
    const where = st.where === 'device' ? 'On this device (browser storage).' : 'Only until this page closes: browser storage is not available here (private browsing or blocked).';
    const last = st.lastWrite === 'ok' ? 'The last save worked.' : st.lastWrite === 'failed' ? `The last save failed: ${st.lastError}.` : 'Nothing saved yet in this visit.';
    const loaded =
      st.loaded === 'previous'
        ? 'The newest save was damaged, so progress was restored from the previous good copy.'
        : st.loaded === 'repaired'
          ? 'Some saved values were invalid and were repaired.'
          : st.loaded === 'fresh'
            ? 'No earlier save was found.'
            : 'Progress was restored from the last save.';
    const offlineText =
      off_.state === 'ready'
        ? `Ready to play without internet (version ${off_.version}, ${off_.files} files).`
        : off_.state === 'installing'
          ? 'Getting ready for offline play…'
          : off_.state === 'failed'
            ? `Not ready for offline play: ${off_.reason}`
            : off_.reason === 'insecure-address'
              ? 'Offline play needs a secure address (https) or this computer itself (localhost). Over plain http on the home network the game works only while the computer is serving it.'
              : off_.reason === 'dev-build'
                ? 'Development build: offline caching is off.'
                : "This browser can't keep the game for offline play.";
    const persistOut = h('p', { class: 'set-hint', 'data-testid': 'persist-state' });
    const usage = h('p', { class: 'set-hint' });
    void refreshStorage(persistOut, usage);

    body.replaceChildren(
      h('h2', {}, 'Grown-up settings'),
      h('section', {}, h('h3', {}, 'Name on the garage sign'), h('div', { class: 'set-row' }, h('label', { for: 'set-childName' }, h('span', {}, 'Name'), nameInput)), h('p', { class: 'set-hint' }, 'This name stays on this device. Letters only, up to 16.')),
      h(
        'section',
        {},
        h('h3', {}, 'Help & comfort'),
        choice('motion', 'Motion', [
          ['system', 'Follow this device (Reduce Motion)'],
          ['reduced', 'Less motion'],
          ['full', 'Full motion'],
        ]),
        toggle('lowIntensity', 'Lower intensity (calmer celebrations, fewer sparkles)'),
        choice('jumpSide', 'Jump button', [
          ['right', 'Right corner'],
          ['left', 'Left corner'],
        ]),
        toggle('slowDriving', 'Slower driving'),
        toggle('moreHelp', 'More help from the start', 'Wider jump timing from the first try, and the helper example after one miss instead of two.'),
        choice('reminderMinutes', 'Session reminder', [
          [0, 'Off'],
          [10, '10 minutes'],
          [15, '15 minutes'],
          [20, '20 minutes'],
          [30, '30 minutes'],
          [45, '45 minutes'],
        ]),
        h('p', { class: 'set-hint' }, 'A calm picture appears at the end of a mission once the time has passed — never in the middle of one.'),
        toggle('openAll', 'Open all missions and My Tiny Track', 'For trying things out. Normally they open one after another.'),
      ),
      h(
        'section',
        {},
        h('h3', {}, 'Saving'),
        h('p', { 'data-testid': 'save-where' }, where),
        h('p', { 'data-testid': 'save-last' }, last),
        h('p', {}, loaded),
        st.setAside ? h('p', {}, 'A damaged save was set aside (kept, not deleted). Exporting a backup includes the current save only.') : null,
        h('button', { type: 'button', class: 'set-btn', 'data-testid': 'persist', on: { click: () => void askPersist(persistOut, usage) } }, 'Keep saves safe'),
        persistOut,
        usage,
        h(
          'p',
          { class: 'set-hint' },
          'Browsers can clear website storage when the device runs low on space, and Safari may clear it for sites not used for a few weeks that were not added to the Home Screen. Adding the game to the Home Screen and exporting a backup now and then protect progress. The Home Screen app keeps its own storage, separate from Safari.',
        ),
      ),
      h(
        'section',
        {},
        h('h3', {}, 'Backup'),
        h('div', { class: 'set-buttons' }, h('button', { type: 'button', class: 'set-btn', 'data-testid': 'export', on: { click: () => exportSave(say) } }, 'Export a backup file'), importButton(say, render), resetButton(say, render)),
      ),
      h('section', {}, h('h3', {}, 'Offline'), h('p', { 'data-testid': 'offline-state' }, offlineText), a.updateReady ? h('p', {}, 'An update is ready; it will be used the next time the garage opens.') : null),
      h(
        'section',
        {},
        h('h3', {}, 'About'),
        h('p', {}, 'No ads, no accounts, no purchases, no tracking. After setup it needs no internet, and nothing leaves this device.'),
        toggle('diagnostics', 'Show a frame-rate meter for grown-ups (local only)'),
      ),
      status,
    );
  };

  const closeBtn = h('button', { type: 'button', class: 'grownup-close', 'aria-label': 'Close settings', 'data-testid': 'settings-close', html: icon('close'), on: { click: close } });
  panel.append(closeBtn, body);
  render();
  layer('panel').append(wrap);
  openPanel = wrap;
  release = trapFocus(panel);
  window.addEventListener('keydown', onKey);
}

async function refreshStorage(persistOut: HTMLElement, usage: HTMLElement): Promise<void> {
  const st = navigator.storage;
  if (!st) {
    persistOut.textContent = 'This browser does not report storage protection.';
    return;
  }
  try {
    const p = st.persisted ? await st.persisted() : false;
    persistOut.textContent = p ? 'Protected from automatic clean-up.' : 'The browser may clear it if the device runs low on space.';
    if (st.estimate) {
      const e = await st.estimate();
      if (e.usage !== undefined) usage.textContent = `Using about ${Math.max(1, Math.round(e.usage / 1024))} KB of storage.`;
    }
  } catch {
    persistOut.textContent = 'Storage protection could not be checked.';
  }
}

async function askPersist(out: HTMLElement, usage: HTMLElement): Promise<void> {
  if (!navigator.storage?.persist) {
    out.textContent = 'This browser does not offer storage protection.';
    return;
  }
  try {
    await navigator.storage.persist();
  } catch {
    /* reported below */
  }
  await refreshStorage(out, usage);
}

function exportSave(say: (m: string) => void): void {
  const text = app().store.exportJson();
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const d = new Date();
  const name = `wonder-garage-save-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}.json`;
  const link = h('a', { href: url, download: name });
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  say(`Backup file made: ${name}.`);
}

function importButton(say: (m: string) => void, rerender: () => void): HTMLElement {
  const input = h('input', { type: 'file', accept: 'application/json,.json', class: 'sr-only', 'data-testid': 'import-file', id: 'import-file' }) as HTMLInputElement;
  input.addEventListener('change', async () => {
    const f = input.files?.[0];
    input.value = '';
    if (!f) return;
    if (f.size > 1_000_000) {
      say('That file is too big to be a Wonder Garage backup. Nothing was changed.');
      return;
    }
    const r = await app().store.importJson(await f.text());
    if (r.ok) {
      await app().commit(app().store.data);
      say(r.repaired ? 'Backup restored (a few invalid values were repaired).' : 'Backup restored.');
    } else say(`${r.reason} Nothing was changed.`);
    rerender();
  });
  const label = h('label', { for: 'import-file', class: 'set-btn', role: 'button', tabindex: '0', 'data-testid': 'import' }, 'Import a backup file');
  label.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      input.click();
    }
  });
  return h('span', {}, label, input);
}

function resetButton(say: (m: string) => void, rerender: () => void): HTMLElement {
  const box = h('span', { class: 'reset-box' });
  const first = h('button', { type: 'button', class: 'set-btn danger', 'data-testid': 'reset' }, 'Start over…');
  first.addEventListener('click', () => {
    const ring = h('span', { class: 'gate-ring' });
    const hold = h('button', { type: 'button', class: 'set-btn danger hold', 'data-testid': 'reset-hold' }, ring, 'Hold for 2 seconds to clear progress');
    const cancel = h('button', { type: 'button', class: 'set-btn', 'data-testid': 'reset-cancel', on: { click: () => box.replaceChildren(first) } }, 'Cancel');
    let t: ReturnType<typeof setTimeout> | null = null;
    const stop = () => {
      if (t) clearTimeout(t);
      t = null;
      ring.classList.remove('filling');
    };
    hold.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      hold.setPointerCapture?.(e.pointerId);
      ring.classList.add('filling');
      t = setTimeout(async () => {
        t = null;
        const ok = await app().store.reset();
        await app().commit(app().store.data);
        say(ok ? 'Progress, coins, rewards and saved tracks were cleared. These grown-up settings were kept.' : `Could not clear the save: ${app().store.status.lastError}.`);
        rerender();
      }, HOLD_MS);
    });
    hold.addEventListener('pointerup', stop);
    hold.addEventListener('pointercancel', stop);
    box.replaceChildren(h('span', { class: 'set-hint' }, 'This clears progress, coins, rewards and saved tracks. Grown-up settings stay.'), hold, cancel);
  });
  box.append(first);
  return box;
}
