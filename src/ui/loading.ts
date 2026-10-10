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

/** The storyteller's face in captions: a friendly lantern (it's the Lantern Club). */
export const guideFaceSvg = `<svg viewBox="0 0 120 120" aria-hidden="true">
<rect width="120" height="120" fill="#2f3b2a"/>
<circle cx="60" cy="66" r="50" fill="${P.glow}" opacity="0.35"/>
<rect x="44" y="6" width="32" height="12" rx="4" fill="${P.woodDark}" stroke="${P.ink}" stroke-width="4"/>
<rect x="22" y="16" width="76" height="90" rx="30" fill="${P.lantern}" stroke="${P.ink}" stroke-width="5"/>
<ellipse cx="60" cy="62" rx="27" ry="33" fill="${P.glow}"/>
<circle cx="49" cy="56" r="5.5" fill="${P.ink}"/><circle cx="71" cy="56" r="5.5" fill="${P.ink}"/>
<circle cx="51" cy="54" r="1.8" fill="#fff"/><circle cx="73" cy="54" r="1.8" fill="#fff"/>
<ellipse cx="41" cy="68" rx="6" ry="4" fill="${P.berry}" opacity="0.45"/><ellipse cx="79" cy="68" rx="6" ry="4" fill="${P.berry}" opacity="0.45"/>
<path d="M50 70 Q60 80 70 70" fill="none" stroke="${P.ink}" stroke-width="4.5" stroke-linecap="round"/>
</svg>`;
