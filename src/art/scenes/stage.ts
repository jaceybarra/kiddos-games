import { P, mix } from '../palette';
import { type ArtPiece, artRng, blobPath, circle, ellipse, g, grain, hillPath, line, path, piece, rgrad, rrect, shadow, shine, vgrad } from '../svg';
import { roundTree } from './windmill';
import { PROP_TOGGLES, type BackdropId, type IntentId, type PropId } from '../../content/stage/stageModel';

/**
 * Story Stage: a tiny theatre in a tree stump. Backdrops are 1400 × 720 with
 * their pivot at the top-left (the stage floor is the lower part); props have
 * their pivot at the base. Ids are prefixed per piece because backdrops and
 * props are also shown inline in the page (scene strip, drawers).
 */

const id = (k: string) => (n: string) => `${k.replace(/\./g, '-')}-${n}`;

// ------------------------------------------------------------------ theatre (world coordinates)

const frame = (() => {
  const k = id('st.frame');
  // outer stump-wood frame with a window for the stage (even-odd hole)
  const outer = 'M180 30 L1740 30 L1740 900 L180 900 Z';
  const inner = 'M260 100 L1660 100 L1660 820 L260 820 Z';
  let body = path(`${outer} ${inner}`, `url(#${k('w')})`, 6, 'fill-rule="evenodd"');
  body += grain(190, 40, 1540, 50, 3, 6, P.barkDark) + grain(190, 830, 1540, 60, 5, 6, P.barkDark);
  // gold trim around the window
  body += path(inner, 'none', 0, `stroke="${P.lantern}" stroke-width="12"`) + path(inner, 'none', 6);
  // apron: the front lip of the stage, with footlights
  body += path('M240 820 L1680 820 L1720 880 L200 880 Z', `url(#${k('a')})`, 6);
  for (let i = 0; i < 12; i++) body += ellipse(330 + i * 115, 852, 22, 10, P.glow, 4) + ellipse(330 + i * 115, 850, 10, 4, '#fff', 0, 'opacity="0.8"');
  // a little sign on top
  body += rrect(820, 0, 280, 64, 24, P.berry, 6) + [0, 1, 2].map((i) => path(`M${905 + i * 55} 32 l8 -14 l8 14 l-8 14 z`, P.lantern, 3)).join('');
  return piece('st.frame', [170, -10, 1580, 920], body, vgrad(k('w'), P.bark, P.barkDark) + vgrad(k('a'), P.woodLight, P.wood), true);
})();

const curtainBody = (k: (n: string) => string) => {
  let b = path('M0 0 L760 0 Q720 360 760 740 L0 740 Z', `url(#${k('c')})`, 6);
  for (let i = 1; i < 7; i++) b += line(`M${i * 105} 6 Q${i * 105 + (i % 2 ? 18 : -18)} 370 ${i * 105} 734`, 6, mix(P.berry, P.ink, 0.35), 'opacity="0.55"');
  b += path('M0 640 Q380 600 760 650 L760 740 L0 740 Z', mix(P.berry, P.ink, 0.25), 0, 'opacity="0.35"');
  b += rrect(-6, 300, 40, 70, 16, P.lantern, 5);
  return b;
};
const curtain = (() => {
  const k = id('st.curtain');
  return piece('st.curtain', [-10, -6, 780, 752], curtainBody(k), vgrad(k('c'), '#e0605a', '#a8383a'), true);
})();
const valance = (() => {
  const k = id('st.valance');
  let sc = 'M0 0 L1400 0 L1400 70';
  for (let i = 0; i < 10; i++) sc += ` Q${1400 - i * 140 - 70} 130 ${1400 - (i + 1) * 140} 70`;
  return piece('st.valance', [-6, -6, 1412, 140], path(sc + ' Z', `url(#${k('v')})`, 6) + line('M0 30 L1400 30', 6, P.lantern), vgrad(k('v'), '#d4504c', '#9a3236'), true);
})();

/** The room around the theatre (a cosy stump interior). */
const room = (() => {
  const k = id('st.room');
  const r = artRng(71);
  let b = `<rect x="-240" y="-180" width="2400" height="1440" fill="url(#${k('w')})"/>`;
  for (let i = 0; i < 24; i++) {
    const x = -240 + i * 100 + r() * 30;
    b += line(`M${x} -180 Q${x + (r() - 0.5) * 50} 400 ${x + (r() - 0.5) * 40} 1260`, 4 + r() * 3, P.barkDark, 'opacity="0.3"');
  }
  b += `<rect x="-240" y="900" width="2400" height="360" fill="url(#${k('f')})"/>` + line('M-240 900 L2160 900', 6, P.ink, 'opacity="0.7"');
  // little audience cushions in front of the stage
  for (let i = 0; i < 6; i++) b += ellipse(330 + i * 250, 1010, 90, 26, [P.sea, P.sun, P.leaf, P.plum, P.pumpkin, P.berry][i], 5, 'opacity="0.9"');
  return piece('st.room', [-240, -180, 2400, 1440], b, vgrad(k('w'), '#7d5638', '#5a3c27') + vgrad(k('f'), '#c48c5c', '#946039'), true);
})();

// ------------------------------------------------------------------ backdrops (local 1400 × 720, pivot top-left)

function backdrop(bid: BackdropId): ArtPiece {
  const key = `st.bg.${bid}`;
  const k = id(key);
  const r = artRng(bid.length * 17 + 3);
  let b = '';
  let defs = '';
  if (bid === 'forest') {
    defs = vgrad(k('s'), '#bfe3ef', '#eef7e4') + vgrad(k('g'), P.grassLight, P.grass);
    b += `<rect width="1400" height="720" fill="url(#${k('s')})"/>`;
    b += path(hillPath(0, 1400, 330, 720, 5, 40, 2), P.farForest);
    for (let i = 0; i < 9; i++) b += roundTree(60 + i * 160 + r() * 40, 420 + r() * 20, 0.9 + r() * 0.4, mix(P.midForest, P.leaf, 0.3), P.deepForest, P.bark, 900 + i, 4);
    b += path(hillPath(0, 1400, 430, 720, 4, 20, 5), `url(#${k('g')})`, 5);
    for (let i = 0; i < 18; i++) b += circle(40 + r() * 1320, 480 + r() * 220, 6, [P.rose, P.cream, P.sun][i % 3], 2);
  } else if (bid === 'pond') {
    defs = vgrad(k('s'), '#a9d8ea', '#e8f5ea') + vgrad(k('w'), P.water, P.waterDark) + vgrad(k('g'), P.grassLight, P.grass);
    b += `<rect width="1400" height="720" fill="url(#${k('s')})"/>`;
    b += path(hillPath(0, 1400, 300, 720, 6, 30, 7), P.farHill);
    b += path('M-10 380 Q700 330 1410 380 L1410 560 Q700 600 -10 560 Z', `url(#${k('w')})`, 5);
    for (let i = 0; i < 6; i++) b += ellipse(120 + i * 230 + r() * 40, 440 + r() * 80, 60, 16, '#6fae5a', 4) + line(`M${100 + i * 230} 450 l40 -6`, 2.5, P.grassDark);
    for (let i = 0; i < 10; i++) b += line(`M${30 + i * 140} 400 q${10} -90 ${-6} -150`, 6, P.grassDark) + ellipse(24 + i * 140, 256, 8, 22, P.woodDark, 3);
    b += path('M-10 540 Q700 500 1410 540 L1410 720 L-10 720 Z', `url(#${k('g')})`, 5);
  } else if (bid === 'moonsky') {
    defs = vgrad(k('s'), P.nightTop, P.nightLow) + rgrad(k('m'), '#fff8d0', '#fff2b0', 1, 0);
    b += `<rect width="1400" height="720" fill="url(#${k('s')})"/>`;
    for (let i = 0; i < 70; i++) b += circle(r() * 1400, r() * 420, 2 + r() * 3, '#fff8d8', 0, `opacity="${(0.4 + r() * 0.6).toFixed(2)}"`);
    b += circle(1080, 160, 150, `url(#${k('m')})`) + circle(1080, 160, 90, '#fff4c4', 5) + circle(1050, 140, 14, '#efe1a0') + circle(1110, 190, 10, '#efe1a0');
    for (const [x, y, s] of [[260, 230, 1], [620, 120, 0.8], [880, 330, 0.9]]) b += path(blobPath([[x - 90 * s, y + 20 * s], [x - 40 * s, y - 24 * s], [x + 20 * s, y - 34 * s], [x + 80 * s, y - 10 * s], [x + 100 * s, y + 20 * s]]), mix(P.lilac, P.nightLow, 0.3), 4, 'opacity="0.9"');
    b += path(blobPath([[-40, 520], [200, 440], [500, 470], [800, 430], [1100, 460], [1440, 430], [1440, 760], [-40, 760]]), '#f4f0ff', 5) + path('M-10 600 Q700 560 1410 600 L1410 720 L-10 720 Z', '#e4defa', 0);
  } else if (bid === 'oak') {
    defs = vgrad(k('s'), P.duskTop, P.duskLow) + vgrad(k('t'), P.bark, P.barkDark) + vgrad(k('g'), P.grass, P.grassDark);
    b += `<rect width="1400" height="720" fill="url(#${k('s')})"/>`;
    b += path(blobPath([[180, 260], [300, 80], [560, 0], [900, 10], [1160, 90], [1260, 260], [1100, 340], [700, 360], [300, 340]]), mix(P.grassDark, P.duskTop, 0.25), 5);
    b += path('M560 600 Q580 420 540 300 L860 300 Q820 420 840 600 Z', `url(#${k('t')})`, 5);
    b += path('M640 600 L640 470 Q640 410 700 410 Q760 410 760 470 L760 600 Z', P.woodDark, 5) + circle(742, 510, 8, P.lantern, 3) + rrect(660, 430, 80, 30, 14, P.lantern, 3, 'opacity="0.8"');
    for (let i = 0; i < 9; i++) {
      const x = 260 + i * 110;
      const y = 300 + Math.sin(i * 0.9) * 24;
      b += line(`M${x} ${y - 40} L${x} ${y}`, 2.5, P.ink) + rrect(x - 14, y, 28, 36, 10, [P.lantern, P.berry, P.sea, P.leaf][i % 4], 3.5) + circle(x, y + 18, 6, P.glow);
    }
    b += path(hillPath(0, 1400, 560, 720, 6, 20, 9), `url(#${k('g')})`, 5);
  } else {
    defs = vgrad(k('w'), '#8d6a4c', '#6e4f37') + rgrad(k('l'), '#fff6d8', '#fff6d8', 0.45, 0) + vgrad(k('f'), '#c99560', '#a06c45');
    b += `<rect width="1400" height="720" fill="url(#${k('w')})"/>`;
    for (let i = 0; i < 14; i++) b += line(`M${i * 100 + 50} 0 L${i * 100 + 50} 720`, 4, P.barkDark, 'opacity="0.25"');
    b += ellipse(700, 400, 520, 300, `url(#${k('l')})`);
    b += `<rect y="520" width="1400" height="200" fill="url(#${k('f')})"/>` + line('M0 520 L1400 520', 5, P.ink, 'opacity="0.7"');
    for (let i = 0; i < 4; i++) b += line(`M0 ${560 + i * 40} L1400 ${560 + i * 40}`, 3, P.woodDark, 'opacity="0.3"');
  }
  return piece(key, [0, 0, 1400, 720], b, defs, true);
}
const backdrops = (['forest', 'pond', 'moonsky', 'oak', 'plain'] as BackdropId[]).map(backdrop);

// ------------------------------------------------------------------ props (pivot at the base)

function propBody(p: PropId, on: boolean): { box: [number, number, number, number]; body: string } {
  switch (p) {
    case 'invitation':
      return on
        ? { box: [-80, -150, 160, 156], body: shadow(0, 0, 60, 8) + rrect(-60, -140, 120, 140, 10, P.cream, 5) + path('M0 -60 Q-26 -84 -26 -96 Q-26 -110 -12 -110 Q0 -110 0 -98 Q0 -110 12 -110 Q26 -110 26 -96 Q26 -84 0 -60 Z', P.berry, 3.5) + line('M-36 -36 L36 -36 M-36 -20 L20 -20', 4, P.inkSoft, 'opacity="0.6"') }
        : { box: [-80, -100, 160, 106], body: shadow(0, 0, 70, 8) + rrect(-70, -90, 140, 90, 10, P.cream, 5) + path('M-70 -90 L0 -40 L70 -90', 'none', 5) + circle(0, -44, 14, P.berry, 4) };
    case 'cake':
      return {
        box: [-90, -200, 180, 206],
        body:
          shadow(0, 0, 80, 9) + rrect(-80, -80, 160, 80, 16, P.rose, 5) + rrect(-62, -140, 124, 66, 14, P.cream, 5) + path('M-80 -74 Q-60 -54 -40 -74 Q-20 -54 0 -74 Q20 -54 40 -74 Q60 -54 80 -74', 'none', 0, `stroke="${P.white}" stroke-width="10" stroke-linecap="round"`) +
          [-30, 0, 30].map((x) => rrect(x - 6, -176, 12, 38, 4, [P.sea, P.sun, P.leaf][(x / 30 + 1) | 0], 3) + (on ? path(`M${x} -200 Q${x + 10} -186 ${x} -178 Q${x - 10} -186 ${x} -200 Z`, P.lantern, 2.5) : '')).join(''),
      };
    case 'ball':
      return { box: [-50, -100, 100, 104], body: shadow(0, 0, 40, 7) + circle(0, -48, 44, P.sea, 5) + path('M-44 -48 Q0 -10 44 -48', 'none', 0, `stroke="${P.sun}" stroke-width="12"`) + path('M-30 -80 Q0 -60 30 -80', 'none', 0, `stroke="${P.berry}" stroke-width="10"`) + circle(0, -48, 44, 'none', 5) + shine(-16, -68, 12, 7, -30, 0.45) };
    case 'crown':
      return { box: [-70, -110, 140, 116], body: shadow(0, 0, 60, 7) + path('M-60 -10 L-60 -90 L-30 -54 L0 -100 L30 -54 L60 -90 L60 -10 Z', P.lantern, 5) + [-30, 0, 30].map((x, i) => circle(x, -30, 9, [P.berry, P.sea, P.leaf][i], 3)).join('') + shine(-34, -60, 8, 16, 0, 0.5) };
    case 'chest':
      return on
        ? { box: [-100, -190, 200, 196], body: shadow(0, 0, 90, 9) + path('M-84 -90 L-70 -180 L70 -180 L84 -90 Z', P.wood, 5) + rrect(-90, -90, 180, 90, 12, P.woodLight, 5) + [[-30, -100], [10, -112], [44, -98], [-4, -96]].map(([x, y]) => circle(x, y, 18, P.lantern, 4)).join('') + rrect(-14, -62, 28, 30, 6, P.stone, 4) }
        : { box: [-100, -150, 200, 156], body: shadow(0, 0, 90, 9) + rrect(-90, -90, 180, 90, 12, P.woodLight, 5) + path('M-90 -90 Q-90 -146 0 -146 Q90 -146 90 -90 Z', P.wood, 5) + line('M-60 -144 L-60 0 M60 -144 L60 0', 8, P.stoneDark) + rrect(-16, -104, 32, 34, 6, P.lantern, 4) };
    case 'umbrella':
      return on
        ? { box: [-130, -260, 260, 266], body: line('M0 0 L0 -230', 8, P.ink) + line('M0 0 Q0 14 -16 14', 8, P.ink) + path('M-120 -170 Q-110 -250 0 -256 Q110 -250 120 -170 Q90 -188 60 -170 Q30 -190 0 -170 Q-30 -190 -60 -170 Q-90 -188 -120 -170 Z', P.plum, 6) + path('M-60 -170 Q-40 -240 0 -256 Q-20 -220 -30 -172 Z', P.lilac, 0, 'opacity="0.8"') }
        : { box: [-40, -230, 80, 236], body: line('M0 0 L0 -220', 8, P.ink) + path('M-18 -200 Q0 -240 18 -200 L10 -60 L-10 -60 Z', P.plum, 5) + line('M0 0 Q0 14 -16 14', 8, P.ink) };
    case 'invention':
      return {
        box: [-110, -270, 220, 276],
        body:
          shadow(0, 0, 100, 10) + rrect(-90, -130, 180, 130, 18, P.sea, 6) + circle(-40, -70, 26, P.lantern, 5) + circle(-40, -70, 8, P.ink) + circle(30, -60, 18, P.stone, 5) + line('M30 -78 L30 -42 M12 -60 L48 -60', 4, P.ink) +
          rrect(50, -200, 22, 74, 6, P.stoneDark, 4) + path('M40 -200 L82 -200 L76 -220 L46 -220 Z', P.berry, 4) + (on ? circle(61, -232, 18, '#fff', 4, 'opacity="0.95"') + circle(80, -250, 12, '#fff', 3, 'opacity="0.9"') : '') + line('M-70 -110 L-20 -110', 6, P.berry),
      };
    case 'drum':
      return { box: [-80, -150, 160, 156], body: shadow(0, 0, 70, 9) + path('M-66 -110 L-66 -10 Q0 16 66 -10 L66 -110 Z', P.berry, 5) + line('M-66 -100 L-34 -16 L0 -100 L34 -16 L66 -100', 4, P.cream) + ellipse(0, -110, 66, 20, P.cream, 5) };
    case 'lantern':
      return {
        box: [-60, -190, 120, 196],
        body: (on ? circle(0, -90, 60, P.glow, 0, 'opacity="0.55"') : '') + line('M0 -186 L0 -160', 4, P.ink) + rrect(-24, -160, 48, 14, 5, P.woodDark, 3.5) + path('M-32 -146 Q-58 -80 -32 -20 L32 -20 Q58 -80 32 -146 Z', on ? P.lantern : mix(P.lantern, P.stone, 0.5), 5) + rrect(-20, -20, 40, 14, 5, P.woodDark, 3.5) + (on ? shine(-10, -100, 10, 22, 0, 0.5) : ''),
      };
    case 'map':
      return on
        ? { box: [-110, -120, 220, 126], body: shadow(0, 0, 100, 8) + path('M-100 -110 L-34 -96 L34 -110 L100 -96 L100 -6 L34 -20 L-34 -6 L-100 -20 Z', P.cream, 5) + line('M-80 -40 Q-40 -90 0 -60 Q40 -30 70 -80', 5, P.berry, 'stroke-dasharray="10 10"') + path('M62 -92 L78 -76 M78 -92 L62 -76', 'none', 0, `stroke="${P.berry}" stroke-width="6" stroke-linecap="round"`) }
        : { box: [-80, -60, 160, 66], body: shadow(0, 0, 70, 7) + rrect(-70, -46, 140, 40, 18, P.cream, 5) + ellipse(-70, -26, 10, 20, P.woodLight, 4) + ellipse(70, -26, 10, 20, P.woodLight, 4) + line('M-40 -30 L40 -30', 3, P.berry, 'opacity="0.6"') };
    case 'boat':
      return { box: [-120, -210, 240, 216], body: shadow(0, 0, 100, 8) + path('M-110 -60 L110 -60 L80 0 L-80 0 Z', P.wood, 5) + line('M-90 -36 L90 -36', 4, P.woodDark, 'opacity="0.5"') + line('M0 -60 L0 -200', 7, P.woodDark) + path('M6 -196 L90 -80 L6 -80 Z', P.cream, 5) + path('M-6 -170 L-70 -80 L-6 -80 Z', P.sun, 5) };
    case 'telescope':
      return on
        ? { box: [-110, -200, 220, 206], body: line('M-40 0 L0 -90 L40 0 M0 -90 L0 0', 6, P.woodDark) + g(rrect(-100, -16, 70, 32, 8, P.sea, 5) + rrect(-34, -14, 70, 28, 8, P.stone, 5) + rrect(32, -12, 70, 24, 8, P.lantern, 5), 'translate(0 -120) rotate(-25)') }
        : { box: [-70, -170, 140, 176], body: line('M-40 0 L0 -90 L40 0 M0 -90 L0 0', 6, P.woodDark) + g(rrect(-60, -16, 80, 32, 8, P.sea, 5) + rrect(14, -12, 34, 24, 8, P.lantern, 5), 'translate(0 -120) rotate(-25)') };
    case 'kite':
      return { box: [-90, -260, 180, 266], body: path('M0 -250 L60 -180 L0 -100 L-60 -180 Z', P.sun, 5) + path('M0 -250 L0 -100 M-60 -180 L60 -180', 'none', 4) + path('M0 -100 Q-30 -60 10 -30 Q40 0 0 0', 'none', 0, `stroke="${P.berry}" stroke-width="6" stroke-linecap="round"`) + [[-14, -64], [16, -28]].map(([x, y]) => path(`M${x - 10} ${y} l10 -8 l10 8 l-10 8 z`, P.sea, 3)).join('') };
    case 'flower':
      return on
        ? { box: [-60, -170, 120, 176], body: line('M0 0 Q6 -60 0 -110', 6, P.grassDark) + path('M0 -50 Q-30 -64 -34 -40 Q-14 -34 0 -50 Z', P.leaf, 3) + [0, 60, 120, 180, 240, 300].map((a) => circle(Math.cos((a * Math.PI) / 180) * 26, -130 + Math.sin((a * Math.PI) / 180) * 26, 20, P.rose, 4)).join('') + circle(0, -130, 16, P.sun, 4) }
        : { box: [-40, -150, 80, 156], body: line('M0 0 Q6 -60 0 -110', 6, P.grassDark) + path('M0 -50 Q-30 -64 -34 -40 Q-14 -34 0 -50 Z', P.leaf, 3) + path('M0 -146 Q22 -126 0 -106 Q-22 -126 0 -146 Z', P.rose, 4) };
  }
}

const PROP_LIST: PropId[] = ['invitation', 'cake', 'ball', 'crown', 'chest', 'umbrella', 'invention', 'drum', 'lantern', 'map', 'boat', 'telescope', 'kite', 'flower'];
/** Props with a second look when used: the toggles, plus the invention's puff. */
export const PROP_HAS_ON: PropId[] = [...PROP_TOGGLES, 'invention'];
const props: ArtPiece[] = PROP_LIST.flatMap((p) => {
  const off = propBody(p, false);
  const list = [piece(`st.p.${p}`, off.box, off.body)];
  if (PROP_HAS_ON.includes(p)) {
    const on = propBody(p, true);
    list.push(piece(`st.p.${p}.on`, on.box, on.body));
  }
  return list;
});

// ------------------------------------------------------------------ thought bubbles (what a character wants)

const INTENT_BODY: Record<IntentId, string> = {
  play: circle(0, 0, 22, P.sea, 4) + path('M-22 0 Q0 18 22 0', 'none', 0, `stroke="${P.sun}" stroke-width="6"`),
  find: circle(-6, -6, 16, P.waterLight, 4) + line('M6 6 L22 22', 7, P.ink),
  help: path('M-14 22 L-14 -4 Q-14 -10 -8 -10 L-8 -22 Q-8 -28 -2 -28 Q4 -28 4 -22 L4 -8 Q16 -10 16 2 L16 22 Z', P.cream, 4),
  quiet: path('M8 -22 A22 22 0 1 0 22 8 A16 16 0 1 1 8 -22 Z', P.lantern, 4),
  explore: path('M-24 -16 L-8 -22 L8 -16 L24 -22 L24 18 L8 24 L-8 18 L-24 24 Z', P.cream, 4) + line('M-14 6 Q0 -14 14 2', 4, P.berry, 'stroke-dasharray="6 6"'),
  snack: circle(0, 0, 22, '#e6a95c', 4) + [[-8, -6], [8, 4], [-2, 10]].map(([x, y]) => circle(x, y, 3.5, '#7a4520')).join(''),
};
const thought = piece('st.thought', [-70, -70, 140, 140], circle(0, -10, 56, P.white, 5) + circle(-30, 52, 12, P.white, 4) + circle(-46, 66, 6, P.white, 3));
const intents: ArtPiece[] = (Object.keys(INTENT_BODY) as IntentId[]).map((i) => piece(`st.i.${i}`, [-32, -32, 64, 64], INTENT_BODY[i]));

/** A spotlight pool and a "recording" tape light. */
const spot = piece('st.spot', [-260, -80, 520, 160], ellipse(0, 0, 250, 70, 'url(#st-spot-g)'), rgrad('st-spot-g', '#fff6d0', '#fff6d0', 0.55, 0));
const rec = piece('st.rec', [-60, -30, 120, 60], rrect(-56, -26, 112, 52, 26, P.ink, 0, 'opacity="0.8"') + circle(-26, 0, 14, P.berry, 3) + rrect(-4, -8, 44, 16, 6, '#fff', 0));

export const STAGE_PIECES: ArtPiece[] = [frame, curtain, valance, room, ...backdrops, ...props, thought, ...intents, spot, rec];

/** Pieces the clubhouse poster needs. */
export const STAGE_POSTER_KEYS: string[] = STAGE_PIECES.filter((p) => /^st\.(bg\.|p\.)/.test(p.key)).map((p) => p.key);
