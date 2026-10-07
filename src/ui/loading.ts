import { h } from './dom';
import { P } from '../art/palette';

let el: HTMLElement | null = null;
let goneTimer: ReturnType<typeof setTimeout> | null = null;

const LANTERN = `<svg class="lantern lantern-swing" viewBox="0 0 120 150" aria-hidden="true">
<path d="M60 4 L60 22" stroke="${P.ink}" stroke-width="5" stroke-linecap="round"/>
<rect x="38" y="18" width="44" height="14" rx="5" fill="${P.woodDark}" stroke="${P.ink}" stroke-width="5"/>
<rect x="24" y="30" width="72" height="92" rx="26" fill="${P.lantern}" stroke="${P.ink}" stroke-width="6"/>
<ellipse cx="60" cy="78" rx="22" ry="30" fill="${P.glow}"/>
<rect x="38" y="120" width="44" height="14" rx="5" fill="${P.woodDark}" stroke="${P.ink}" stroke-width="5"/>
</svg>`;

export function showLoading(): void {
  if (!el) {
    el = h('div', { class: 'loading', role: 'status', 'aria-label': 'Loading', html: LANTERN });
    document.getElementById('ui-root')?.append(el);
  }
  if (goneTimer) clearTimeout(goneTimer);
  el.classList.remove('done', 'gone');
}

export function hideLoading(): void {
  if (!el) return;
  el.classList.add('done');
  if (goneTimer) clearTimeout(goneTimer);
  goneTimer = setTimeout(() => el?.classList.add('gone'), 350);
}

export const lanternSvg = LANTERN;
