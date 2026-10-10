import { P } from '../art/palette';

/**
 * UI icons (48×48). Shapes are distinct so choices never rely on colour alone.
 */
const S = `stroke="${P.ink}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"`;

const ICONS: Record<string, string> = {
  home: `<path d="M8 24 L24 9 L40 24 L40 40 L8 40 Z" fill="${P.woodLight}" ${S}/><path d="M19 40 V29 H29 V40" fill="${P.berry}" ${S}/><path d="M33 14 V9 H38 V19" fill="${P.wood}" ${S}/>`,
  map: `<path d="M6 11 L17 7 L31 11 L42 7 V37 L31 41 L17 37 L6 41 Z" fill="${P.cream}" ${S}/><path d="M17 7 V37 M31 11 V41" fill="none" ${S}/><path d="M10 30 Q16 22 22 26 T36 18" fill="none" stroke="${P.berry}" stroke-width="3" stroke-dasharray="3 4" stroke-linecap="round"/><circle cx="36" cy="17" r="3.5" fill="${P.berry}" ${S}/>`,
  pause: `<rect x="12" y="10" width="9" height="28" rx="3" fill="${P.sea}" ${S}/><rect x="27" y="10" width="9" height="28" rx="3" fill="${P.sea}" ${S}/>`,
  play: `<path d="M15 9 L39 24 L15 39 Z" fill="${P.leaf}" ${S}/>`,
  moon: `<path d="M30 7 A17 17 0 1 0 41 30 A13 13 0 1 1 30 7 Z" fill="${P.sun}" ${S}/><circle cx="17" cy="20" r="1.8" fill="${P.ink}"/><circle cx="25" cy="20" r="1.8" fill="${P.ink}"/><path d="M17 27 Q21 30 25 27" fill="none" ${S}/>`,
  help: `<path d="M24 6 C14 6 9 13 9 20 C9 27 15 30 16 35 H32 C33 30 39 27 39 20 C39 13 34 6 24 6 Z" fill="${P.glow}" ${S}/><path d="M17 39 H31 M19 43 H29" fill="none" ${S}/><path d="M20 22 L24 26 L28 22" fill="none" stroke="${P.lantern}" stroke-width="3" stroke-linecap="round"/>`,
  // the same white pointing hand that demonstrates what to do in the game
  pointer: `<g transform="translate(23 5) scale(0.355)"><path d="M-9 8 Q-9 -9 0 -9 Q9 -9 9 8 L9 38 Q16 30 24 34 Q31 38 29 46 Q36 42 41 49 Q45 56 39 61 Q44 66 41 74 Q36 86 24 90 L24 100 L-20 100 L-20 90 Q-30 84 -33 72 L-40 52 Q-42 41 -33 39 Q-25 38 -21 48 L-9 60 Z" fill="#fff" stroke="${P.ink}" stroke-width="9" stroke-linejoin="round"/><rect x="-24" y="92" width="52" height="12" rx="5" fill="${P.lantern}" stroke="${P.ink}" stroke-width="7"/></g>`,
  replay: `<path d="M8 12 Q8 7 13 7 H35 Q40 7 40 12 V28 Q40 33 35 33 H22 L13 41 L15 33 H13 Q8 33 8 28 Z" fill="${P.white}" ${S}/><path d="M16 20 Q16 14 24 14 Q31 14 31 20" fill="none" stroke="${P.sea}" stroke-width="3.5" stroke-linecap="round"/><path d="M27 16 L31 21 L35 16" fill="none" stroke="${P.sea}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M15 25 H30" fill="none" stroke="${P.inkSoft}" stroke-width="3" stroke-linecap="round"/>`,
  gear: `<circle cx="24" cy="24" r="13" fill="${P.stone}" ${S}/><circle cx="24" cy="24" r="5" fill="${P.cream}" ${S}/><path d="M24 5 V11 M24 37 V43 M5 24 H11 M37 24 H43 M10.5 10.5 L14.8 14.8 M33.2 33.2 L37.5 37.5 M10.5 37.5 L14.8 33.2 M33.2 14.8 L37.5 10.5" fill="none" ${S}/>`,
  close: `<path d="M13 13 L35 35 M35 13 L13 35" fill="none" stroke="${P.ink}" stroke-width="5" stroke-linecap="round"/>`,
  check: `<path d="M10 25 L20 35 L39 13" fill="none" stroke="${P.ink}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/><path d="M10 25 L20 35 L39 13" fill="none" stroke="${P.leaf}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>`,
  undo: `<path d="M17 12 L8 21 L17 30" fill="none" stroke="${P.ink}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M9 21 H29 Q40 21 40 31 Q40 40 29 40 H20" fill="none" stroke="${P.ink}" stroke-width="4" stroke-linecap="round"/>`,
  reset: `<path d="M38 24 A14 14 0 1 1 33 13" fill="none" stroke="${P.ink}" stroke-width="4" stroke-linecap="round"/><path d="M26 9 L35 12 L32 21" fill="none" stroke="${P.ink}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`,
  trash: `<path d="M12 15 H36 L33 41 H15 Z" fill="${P.stone}" ${S}/><path d="M9 15 H39 M19 9 H29 M20 21 V35 M28 21 V35" fill="none" ${S}/>`,
  rotate: `<path d="M12 30 A13 13 0 1 0 14 15" fill="none" stroke="${P.ink}" stroke-width="4" stroke-linecap="round"/><path d="M8 9 L14 16 L21 11" fill="none" stroke="${P.ink}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`,
  swap: `<path d="M8 17 H36 M28 9 L36 17 L28 25" fill="none" stroke="${P.ink}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M40 31 H12 M20 23 L12 31 L20 39" fill="none" stroke="${P.ink}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`,
  speaker: `<path d="M8 19 H16 L26 10 V38 L16 29 H8 Z" fill="${P.cream}" ${S}/><path d="M31 18 Q35 24 31 30 M35 13 Q42 24 35 35" fill="none" ${S}/>`,
  mute: `<path d="M8 19 H16 L26 10 V38 L16 29 H8 Z" fill="${P.cream}" ${S}/><path d="M32 18 L42 30 M42 18 L32 30" fill="none" ${S}/>`,
  star: `<path d="M24 6 L29 18 L42 19 L32 27 L35 40 L24 33 L13 40 L16 27 L6 19 L19 18 Z" fill="${P.sun}" ${S}/>`,
  back: `<path d="M28 10 L14 24 L28 38" fill="none" stroke="${P.ink}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>`,
  next: `<path d="M20 10 L34 24 L20 38" fill="none" stroke="${P.ink}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>`,
  eye: `<path d="M5 24 Q24 6 43 24 Q24 42 5 24 Z" fill="${P.white}" ${S}/><circle cx="24" cy="24" r="7" fill="${P.sea}" ${S}/><circle cx="22" cy="22" r="2" fill="#fff"/>`,
  wave: `<path d="M14 26 L14 14 Q14 11 17 11 Q20 11 20 14 L20 23 L20 10 Q20 7 23 7 Q26 7 26 10 L26 23 L26 12 Q26 9 29 9 Q32 9 32 12 L32 25 L32 17 Q32 14 35 14 Q38 14 38 17 L38 30 Q38 42 26 42 Q18 42 14 36 L8 27 Q6 24 9 22 Q12 21 14 26 Z" fill="${P.cream}" ${S}/><path d="M6 10 Q4 14 6 18 M41 6 Q44 10 42 14" fill="none" stroke="${P.lantern}" stroke-width="3" stroke-linecap="round"/>`,
  ask: `<path d="M6 12 Q6 7 11 7 H37 Q42 7 42 12 V28 Q42 33 37 33 H20 L11 41 L13 33 H11 Q6 33 6 28 Z" fill="${P.white}" ${S}/><path d="M19 16 Q19 11 24 11 Q29 11 29 16 Q29 20 24 21 V24" fill="none" stroke="${P.sea}" stroke-width="4" stroke-linecap="round"/><circle cx="24" cy="29" r="2.4" fill="${P.sea}"/>`,
  together: `<circle cx="16" cy="15" r="6" fill="${P.pumpkin}" ${S}/><circle cx="32" cy="15" r="6" fill="${P.leaf}" ${S}/><path d="M6 40 Q6 25 16 25 Q24 25 24 33 Q24 25 32 25 Q42 25 42 40 Z" fill="${P.cream}" ${S}/><path d="M20 31 L28 31" stroke="${P.berry}" stroke-width="4" stroke-linecap="round"/>`,
  explore: `<circle cx="20" cy="20" r="12" fill="${P.waterLight}" ${S}/><path d="M29 29 L41 41" fill="none" stroke="${P.ink}" stroke-width="6" stroke-linecap="round"/><path d="M14 16 Q16 12 20 12" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"/>`,
  wait: `<path d="M13 7 H35 V11 Q35 20 26 24 Q35 28 35 37 V41 H13 V37 Q13 28 22 24 Q13 20 13 11 Z" fill="${P.white}" ${S}/><path d="M18 13 H30 Q28 19 24 21 Q20 19 18 13 Z M18 38 Q24 30 30 38 Z" fill="${P.lantern}"/>`,
  sorry: `<path d="M24 41 Q5 28 9 16 Q13 7 22 11 Q24 12 24 15 Q24 12 26 11 Q35 7 39 16 Q43 28 24 41 Z" fill="${P.rose}" ${S}/><rect x="15" y="20" width="18" height="8" rx="3" transform="rotate(-30 24 24)" fill="${P.cream}" ${S}/>`,
  fix: `<path d="M30 8 Q38 6 41 12 L35 18 L30 18 L30 13 Z" fill="${P.stone}" ${S}/><path d="M30 18 L12 36 Q9 40 12 42 Q15 44 18 40 L36 22" fill="${P.stone}" ${S}/>`,
  raisehand: `<path d="M18 40 L18 14 Q18 10 21.5 10 Q25 10 25 14 L25 26 L25 8 Q25 5 28 5 Q31 5 31 8 L31 26 L31 11 Q31 8 34 8 Q37 8 37 11 L37 30 Q37 43 26 43 Q20 43 18 40 Z" fill="${P.cream}" ${S}/><path d="M18 30 L11 23 Q8 21 7 24 Q6 27 9 30 L18 40" fill="${P.cream}" ${S}/>`,
  notnow: `<path d="M12 24 Q12 12 24 12 Q36 12 36 24 Q36 36 24 36 Q12 36 12 24 Z" fill="${P.cream}" ${S}/><path d="M18 24 H30" stroke="${P.ink}" stroke-width="4" stroke-linecap="round"/><path d="M6 10 L10 14 M42 10 L38 14" stroke="${P.inkSoft}" stroke-width="3" stroke-linecap="round"/>`,
  yes: `<circle cx="24" cy="24" r="17" fill="${P.leaf}" ${S}/><path d="M15 25 L21 31 L33 17" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>`,
  no: `<circle cx="24" cy="24" r="17" fill="${P.stone}" ${S}/><path d="M17 17 L31 31 M31 17 L17 31" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round"/>`,
  pencil: `<path d="M10 38 L12 29 L32 9 L39 16 L19 36 Z" fill="${P.sun}" ${S}/><path d="M28 13 L35 20 M10 38 L18 36" fill="none" ${S}/>`,
  music: `<path d="M18 34 V12 L38 8 V30" fill="none" ${S}/><ellipse cx="13" cy="35" rx="6" ry="5" fill="${P.plum}" ${S}/><ellipse cx="33" cy="31" rx="6" ry="5" fill="${P.plum}" ${S}/>`,
  save: `<path d="M24 6 V28 M15 20 L24 29 L33 20" fill="none" stroke="${P.ink}" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M8 30 V40 H40 V30" fill="none" stroke="${P.ink}" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>`,
  shelf: `<rect x="6" y="8" width="36" height="34" rx="3" fill="${P.woodLight}" ${S}/><path d="M6 25 H42" ${S}/><circle cx="16" cy="18" r="4.5" fill="${P.berry}" ${S}/><rect x="25" y="13" width="10" height="10" rx="2" fill="${P.sea}" ${S}/><path d="M14 36 L19 30 L24 36 Z" fill="${P.leaf}" ${S}/>`,
  hanger: `<path d="M24 14 Q24 8 28 9 Q32 10 30 14 Q28 17 24 18 L6 32 Q4 35 8 35 H40 Q44 35 42 32 L24 18" fill="${P.cream}" ${S}/>`,
  heart: `<path d="M24 41 Q5 28 9 16 Q13 7 22 11 Q24 12 24 15 Q24 12 26 11 Q35 7 39 16 Q43 28 24 41 Z" fill="${P.berry}" ${S}/>`,
  hand: `<path d="M24 6 Q24 3 27 3 Q30 3 30 6 L30 24 L30 16 Q30 13 33 13 Q36 13 36 16 L36 30 Q36 44 24 44 Q16 44 13 38 L8 29 Q6 25 10 24 Q13 23 15 27 L18 31 L18 6 Q18 3 21 3 Q24 3 24 6 Z" fill="${P.white}" ${S}/>`,
  turn: `<circle cx="24" cy="24" r="17" fill="${P.lantern}" ${S}/><path d="M24 14 V24 L31 29" fill="none" stroke="${P.ink}" stroke-width="4" stroke-linecap="round"/>`,
  film: `<rect x="6" y="11" width="36" height="26" rx="4" fill="${P.plum}" ${S}/><path d="M20 18 L30 24 L20 30 Z" fill="#fff" ${S}/>`,
  plus: `<path d="M24 10 V38 M10 24 H38" fill="none" stroke="${P.ink}" stroke-width="6" stroke-linecap="round"/>`,
  copy: `<rect x="14" y="14" width="24" height="26" rx="3" fill="${P.cream}" ${S}/><path d="M10 33 V10 Q10 8 12 8 H30" fill="none" ${S}/>`,
  ear: `<path d="M16 20 Q16 8 26 8 Q36 8 36 19 Q36 26 30 30 Q26 33 26 38 Q26 43 20 42" fill="${P.rose}" ${S}/><path d="M22 20 Q22 14 27 14 Q31 14 31 19" fill="none" ${S}/>`,
  quiet: `<path d="M10 30 Q10 14 24 14 Q38 14 38 30" fill="none" ${S}/><rect x="6" y="28" width="10" height="13" rx="4" fill="${P.lilac}" ${S}/><rect x="32" y="28" width="10" height="13" rx="4" fill="${P.lilac}" ${S}/>`,
  record: `<circle cx="24" cy="24" r="17" fill="${P.berry}" ${S}/><circle cx="24" cy="24" r="7" fill="#fff" opacity="0.85"/>`,
  stop: `<rect x="11" y="11" width="26" height="26" rx="5" fill="${P.inkSoft}" ${S}/>`,
  puppet: `<path d="M12 42 L14 24 Q14 12 24 12 Q34 12 34 24 L36 42 Z" fill="${P.pumpkin}" ${S}/><circle cx="19" cy="10" r="5" fill="${P.pumpkin}" ${S}/><circle cx="29" cy="10" r="5" fill="${P.pumpkin}" ${S}/><circle cx="20" cy="23" r="2.5" fill="${P.ink}"/><circle cx="28" cy="23" r="2.5" fill="${P.ink}"/><path d="M20 30 Q24 33 28 30" fill="none" ${S}/>`,
  picture: `<rect x="6" y="9" width="36" height="30" rx="4" fill="${P.waterLight}" ${S}/><path d="M6 33 L18 21 L27 30 L33 24 L42 33 V35 Q42 39 38 39 H10 Q6 39 6 35 Z" fill="${P.leaf}" ${S}/><circle cx="33" cy="17" r="4" fill="${P.sun}" ${S}/>`,
  smile: `<circle cx="24" cy="24" r="17" fill="${P.sun}" ${S}/><circle cx="18" cy="20" r="2.5" fill="${P.ink}"/><circle cx="30" cy="20" r="2.5" fill="${P.ink}"/><path d="M16 28 Q24 36 32 28" fill="none" ${S}/>`,
  flip: `<path d="M24 8 V40" fill="none" ${S} stroke-dasharray="4 5"/><path d="M19 14 L6 24 L19 34 Z" fill="${P.sea}" ${S}/><path d="M29 14 L42 24 L29 34 Z" fill="${P.cream}" ${S}/>`,
  thought: `<path d="M8 20 Q8 8 20 9 Q24 4 31 6 Q42 8 40 19 Q44 28 34 30 Q28 36 20 31 Q8 32 8 20 Z" fill="${P.white}" ${S}/><circle cx="12" cy="38" r="3.5" fill="${P.white}" ${S}/><circle cx="7" cy="44" r="2" fill="${P.white}" ${S}/>`,
  chest: `<rect x="7" y="22" width="34" height="18" rx="3" fill="${P.woodLight}" ${S}/><path d="M7 22 Q7 9 24 9 Q41 9 41 22 Z" fill="${P.wood}" ${S}/><rect x="20" y="18" width="8" height="9" rx="2" fill="${P.lantern}" ${S}/>`,
  scenes3: `<rect x="4" y="16" width="12" height="16" rx="3" fill="${P.sea}" ${S}/><rect x="18" y="16" width="12" height="16" rx="3" fill="${P.sun}" ${S}/><rect x="32" y="16" width="12" height="16" rx="3" fill="${P.leaf}" ${S}/>`,
  scenes6: `<rect x="4" y="8" width="12" height="14" rx="3" fill="${P.sea}" ${S}/><rect x="18" y="8" width="12" height="14" rx="3" fill="${P.sun}" ${S}/><rect x="32" y="8" width="12" height="14" rx="3" fill="${P.leaf}" ${S}/><rect x="4" y="26" width="12" height="14" rx="3" fill="${P.berry}" ${S}/><rect x="18" y="26" width="12" height="14" rx="3" fill="${P.plum}" ${S}/><rect x="32" y="26" width="12" height="14" rx="3" fill="${P.pumpkin}" ${S}/>`,
  jump: `<path d="M24 34 V8 M14 18 L24 8 L34 18" fill="none" stroke="${P.ink}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/><path d="M8 42 H40" stroke="${P.ink}" stroke-width="4" stroke-linecap="round"/>`,
  hide: `<circle cx="24" cy="24" r="17" fill="${P.sun}" ${S}/><ellipse cx="16" cy="21" rx="9" ry="7" fill="${P.pumpkin}" ${S}/><ellipse cx="32" cy="21" rx="9" ry="7" fill="${P.pumpkin}" ${S}/><path d="M18 33 Q24 37 30 33" fill="none" ${S}/>`,
  zzz: `<path d="M10 14 H22 L10 28 H22 M26 22 H36 L26 34 H36" fill="none" stroke="${P.sea}" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>`,
  bow: `<circle cx="34" cy="14" r="6" fill="${P.cream}" ${S}/><path d="M28 18 Q18 22 14 32 M20 26 L18 42 M24 28 L30 42" fill="none" stroke="${P.ink}" stroke-width="4" stroke-linecap="round"/>`,
  foot: `<path d="M14 40 Q10 26 16 14 Q22 6 28 12 Q32 18 30 28 Q36 34 34 40 Z" fill="${P.woodLight}" ${S}/><circle cx="36" cy="10" r="3" fill="${P.woodLight}" ${S}/><circle cx="40" cy="17" r="2.5" fill="${P.woodLight}" ${S}/>`,
  branch: `<path d="M24 42 V26 Q24 18 14 14 M24 26 Q24 18 34 14" fill="none" stroke="${P.ink}" stroke-width="4" stroke-linecap="round"/><circle cx="12" cy="12" r="6" fill="${P.sun}" ${S}/><circle cx="36" cy="12" r="6" fill="${P.sea}" ${S}/>`,
};

export function icon(name: keyof typeof ICONS | string, size = 48): string {
  const body = ICONS[name] ?? ICONS.star;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="${size}" height="${size}" aria-hidden="true" focusable="false">${body}</svg>`;
}

export function hasIcon(name: string): boolean {
  return name in ICONS;
}
