import { crewFace } from '../art/pictures';
import type { CrewId } from '../content/missions';
import { button, h, icon, layer } from './dom';

/**
 * The child's on-screen buttons other than jump/brake (those are
 * DriveControls). Only what fits the moment is shown.
 *  drive:     pause (top-left), help (top-right), coin tally (top-centre)
 *  build:     pause, help, invite (if a friend can help), undo + clear (bottom-left), test (bottom-right, big)
 *  encounter: pause only
 *  creator:   back-to-garage (top-left), help, undo + clear (bottom-left), test (bottom-right), save (top-right row)
 *  hidden:    nothing
 */
export type HudMode = 'drive' | 'build' | 'encounter' | 'creator' | 'hidden';

export interface HudHandlers {
  onPause: () => void;
  onHelp: () => void;
  onUndo?: () => void;
  onClear?: () => void;
  onTest?: () => void;
  onInvite?: () => void;
  onSave?: () => void;
  onBack?: () => void;
}

type Key = 'pause' | 'help' | 'invite' | 'undo' | 'clear' | 'test' | 'save' | 'back' | 'coins';

const SHOWN: Record<HudMode, Key[]> = {
  drive: ['pause', 'help', 'coins'],
  build: ['pause', 'help', 'invite', 'undo', 'clear', 'test'],
  encounter: ['pause'],
  creator: ['back', 'help', 'save', 'undo', 'clear', 'test'],
  hidden: [],
};

export class Hud {
  private root: HTMLElement;
  private els = {} as Record<Key, HTMLElement>;
  private mode: HudMode = 'hidden';
  private inviteFace: CrewId | null = null;
  private coinNum: HTMLElement;
  private found = 0;

  constructor(handlers: HudHandlers) {
    this.root = h('div', { class: 'hud', 'data-testid': 'hud' });
    const b = (key: Key, iconName: Parameters<typeof icon>[0], label: string, size: 'md' | 'xl', variant: 'soft' | 'primary' | 'plain', fn?: () => void) => {
      const el = button({ icon: iconName, label, size, variant, testid: `hud-${key}`, extraClass: `hud-${key}`, onTap: () => fn?.() });
      this.els[key] = el;
      this.root.append(el);
    };
    b('pause', 'pause', 'Pause', 'md', 'soft', handlers.onPause);
    b('back', 'garage', 'Back', 'md', 'soft', handlers.onBack);
    b('help', 'help', 'Show me how', 'md', 'soft', handlers.onHelp);
    b('save', 'save', 'Keep this track', 'md', 'soft', handlers.onSave);
    b('undo', 'undo', 'Undo', 'md', 'soft', handlers.onUndo);
    b('clear', 'clear', 'Clear all pieces', 'md', 'soft', handlers.onClear);
    b('test', 'test', 'Try it', 'xl', 'primary', handlers.onTest);
    const invite = button({ icon: 'invite', label: 'Invite a friend to help', size: 'md', variant: 'soft', testid: 'hud-invite', extraClass: 'hud-invite', onTap: () => handlers.onInvite?.() });
    this.els.invite = invite;
    this.root.append(invite);
    this.coinNum = h('span', { class: 'coin-num' }, '0');
    const coins = h('div', { class: 'hud-coins', 'data-testid': 'hud-coins', role: 'status', 'aria-label': 'Coins found' }, h('span', { class: 'coin-icon', html: icon('coin') }), this.coinNum);
    this.els.coins = coins;
    this.root.append(coins);
    layer('hud').append(this.root);
    this.setMode('hidden');
  }

  setMode(mode: HudMode): void {
    this.mode = mode;
    const shown = SHOWN[mode];
    for (const [k, el] of Object.entries(this.els) as [Key, HTMLElement][]) {
      const on = shown.includes(k) && (k !== 'invite' || this.inviteFace !== null);
      el.classList.toggle('hidden', !on);
    }
    this.root.classList.toggle('mode-creator', mode === 'creator');
  }

  setInvite(face: CrewId | null, invited: boolean): void {
    this.inviteFace = face;
    const el = this.els.invite as HTMLButtonElement;
    if (face) {
      el.innerHTML = crewFace(face) + (invited ? `<span class="badge">${icon('check')}</span>` : '');
      el.setAttribute('aria-label', invited ? 'Your friend is helping' : 'Invite your friend to help');
      el.classList.toggle('on', invited);
      el.disabled = invited;
    }
    this.setMode(this.mode);
  }

  setEnabled(which: 'undo' | 'clear' | 'test' | 'save', on: boolean): void {
    (this.els[which] as HTMLButtonElement).disabled = !on;
  }

  hint(which: 'test' | 'help' | 'save' | null): void {
    for (const k of ['test', 'help', 'save'] as const) this.els[k].classList.toggle('hint', k === which);
  }

  setCoins(found: number, _total: number): void {
    const more = found > this.found;
    this.found = found;
    this.coinNum.textContent = String(found);
    if (more) {
      const c = this.els.coins;
      c.classList.remove('bump');
      void c.offsetWidth;
      c.classList.add('bump');
    }
  }

  coinTarget(): { x: number; y: number } {
    const r = this.els.coins.getBoundingClientRect();
    if (r.width === 0) return { x: window.innerWidth / 2, y: 40 };
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }

  destroy(): void {
    this.root.remove();
  }
}
