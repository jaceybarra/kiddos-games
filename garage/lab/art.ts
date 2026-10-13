/**
 * Dev-only contact sheet for every art piece, icon and DOM picture.
 * Served by the dev server at /lab/art.html; never part of the production build.
 *
 * Query options:
 *   only=pieces|big|icons|pictures   show one section
 *   key=<prefix>                     only pieces whose key starts with the prefix
 *   still                            stop the CSS animations (for screenshots)
 *   gray                             greyscale every panel (shape check)
 */
import '../src/ui/styles.css';
import { ALL_PIECES } from '../src/art/index';
import { type ArtPiece, svgDocument } from '../src/art/svg';
import { svgDataUrl } from '../src/art/registry';
import { ICONS } from '../src/art/icons';
import { ICON_NAMES } from '../src/art/iconNames';
import * as PIC from '../src/art/pictures';
import { MISSION_ORDER, type MissionId } from '../src/content/missions';
import { PAINT_IDS, PATTERN_IDS, DECAL_IDS, REWARD_IDS, DISCOVERY_IDS, type TruckLook } from '../src/save/schema';
import type { Choice } from '../src/core/missionState';
import type { Slots } from '../src/core/track';

const q = new URLSearchParams(location.search);
const only = q.get('only');
const keyPrefix = q.get('key');
if (q.has('still')) document.documentElement.classList.add('motion-reduced');
if (q.has('gray')) document.body.classList.add('gray');

const root = document.getElementById('root')!;
let uid = 0;

/** Make ids unique per embedded copy (the same piece appears on two backgrounds). */
function uniq(markup: string): string {
  const ids = new Set<string>();
  markup.replace(/\sid="([^"]+)"/g, (_m, id: string) => {
    ids.add(id);
    return '';
  });
  const suffix = `-lab${uid++}`;
  let out = markup;
  for (const id of ids) {
    const esc = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    out = out.replace(new RegExp(`id="${esc}"`, 'g'), `id="${id}${suffix}"`).replace(new RegExp(`#${esc}([)"])`, 'g'), `#${id}${suffix}$1`);
  }
  return out;
}

function pieceSvg(p: ArtPiece, maxW: number, maxH: number): string {
  const [x, y, w, h] = p.box;
  const pad = Math.max(w, h) * 0.06;
  const vb = [x - pad, y - pad, w + pad * 2, h + pad * 2];
  const s = Math.min(maxW / vb[2], maxH / vb[3], 1.6 * Number(q.get('zoom') ?? 1));
  // overlay sizes in screen pixels, whatever the piece's scale
  const cw = 9 / s;
  const sw = 1.2 / s;
  const overlay =
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="#2a6fdb" stroke-opacity="0.55" stroke-width="${sw}" stroke-dasharray="${sw * 4} ${sw * 3}"/>` +
    `<path d="M${-cw} 0 L${cw} 0 M0 ${-cw} L0 ${cw}" stroke="#e0007a" stroke-width="${sw * 1.6}"/>` +
    `<circle cx="0" cy="0" r="${cw * 0.35}" fill="none" stroke="#e0007a" stroke-width="${sw * 1.2}"/>`;
  return uniq(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.round(vb[2] * s)}" height="${Math.round(vb[3] * s)}" viewBox="${vb.join(' ')}">` +
      (p.defs ? `<defs>${p.defs}</defs>` : '') +
      p.body +
      overlay +
      `</svg>`,
  );
}

function section(title: string, cls = ''): HTMLElement {
  const h = document.createElement('h2');
  h.textContent = title;
  root.appendChild(h);
  const grid = document.createElement('div');
  grid.className = 'grid ' + cls;
  root.appendChild(grid);
  return grid;
}

function card(grid: HTMLElement, caption: string, inner: string): void {
  const c = document.createElement('div');
  c.className = 'card';
  c.innerHTML = inner + `<div class="cap"></div>`;
  (c.querySelector('.cap') as HTMLElement).textContent = caption;
  grid.appendChild(c);
}

// ---------------------------------------------------------------- pieces

const want = (p: ArtPiece) => !keyPrefix || p.key.startsWith(keyPrefix);
const small = ALL_PIECES.filter((p) => want(p) && p.box[2] <= 900 && p.box[3] <= 900);
const big = ALL_PIECES.filter((p) => want(p) && (p.box[2] > 900 || p.box[3] > 900));

if (!only || only === 'pieces') {
  const grid = section(`Pieces (${small.length}) — box outlined in blue, pivot crosshair in magenta`);
  for (const p of small) {
    const size = (p.box[2] > 400 ? 300 : 190) * Number(q.get('zoom') ?? 1);
    card(
      grid,
      `${p.key}  [${p.box.join(', ')}]`,
      `<div class="pair"><div class="panel cream">${pieceSvg(p, size, size)}</div><div class="panel grey">${pieceSvg(p, size, size)}</div></div>`,
    );
  }
}

if (!only || only === 'big') {
  const grid = section(`Backdrops (${big.length})`);
  for (const p of big) {
    const wide = Number(q.get('bigw') ?? 900);
    card(grid, `${p.key}  [${p.box.join(', ')}]${p.transient ? '  transient' : ''}`, `<div class="panel cream">${pieceSvg(p, wide, wide * 0.6)}</div>`);
  }
}

// ---------------------------------------------------------------- icons

if (!only || only === 'icons') {
  const grid = section(`Icons (${ICON_NAMES.length}) — on picture buttons at 56 and 104 px`, 'icons');
  for (const name of ICON_NAMES) {
    const c = document.createElement('div');
    c.className = 'card ib';
    c.innerHTML =
      `<div class="row"><button class="gbtn" style="--size:56px">${ICONS[name]}</button><button class="gbtn gbtn-lg">${ICONS[name]}</button></div>` +
      `<div class="cap"></div>`;
    (c.querySelector('.cap') as HTMLElement).textContent = name;
    grid.appendChild(c);
  }
}

// ---------------------------------------------------------------- pictures

if (!only || only === 'pictures') {
  const grid = section('Pictures (pictures.ts, every valid argument)');
  const look = (o: Partial<TruckLook>): TruckLook => ({ paint: 'red', pattern: 'plain', decal: 'none', wheel: 'chunky', ...o });
  const S = (placed: [string, string][], choice: Choice) => ({ placed: placed.map(([socket, piece]) => ({ socket, piece })), choice });
  const items: [string, string, number][] = [];
  const pz = Number(q.get('pzoom') ?? 1);
  const pf = q.get('pic');
  const add = (label: string, svg: string, w = 240) => {
    if (!pf || label.includes(pf)) items.push([label, svg, w * pz]);
  };

  for (const c of ['turns', 'path', 'gentle', 'jump'] as const) add(`choicePicture('${c}')`, PIC.choicePicture(c));
  for (const m of MISSION_ORDER) add(`missionCardPicture('${m}')`, PIC.missionCardPicture(m));
  add('trackCardPicture()', PIC.trackCardPicture());
  const recapCases: [MissionId | 'track', ReturnType<typeof S>, string][] = [
    ['wobbly-bridge', S([['span', 'bridge']], null), 'bridge'],
    ['wobbly-bridge', S([['launch', 'ramp']], null), 'ramp'],
    ['wobbly-bridge', S([['launch', 'pad']], null), 'pad'],
    ['wobbly-bridge', S([['span', 'bridge'], ['launch', 'ramp']], null), 'bridge+ramp'],
    ['ramp-we-share', S([], 'turns'), 'turns'],
    ['ramp-we-share', S([['front-span', 'bridge']], 'path'), 'path+bridge'],
    ['ramp-we-share', S([], 'path'), 'path (nothing placed)'],
    ['everyone-rally', S([['span', 'bridge'], ['climb', 'ramp']], 'gentle'), 'gentle+bridge+ramp'],
    ['everyone-rally', S([['climb', 'pad']], 'jump'), 'jump+pad'],
    ['track', S([], null), 'track'],
  ];
  for (const [m, s, label] of recapCases) {
    for (const i of [0, 1, 2] as const) {
      if (i !== 1 && label !== recapCases.find(([mm]) => mm === m)![2]) continue;
      add(`recapPanel('${m}', ${i}) ${i === 1 ? label : ''}`, PIC.recapPanel(m, i, s));
    }
  }
  for (const r of REWARD_IDS) add(`rewardPicture('${r}')`, PIC.rewardPicture(r), 160);
  for (const d of DISCOVERY_IDS) add(`discoveryPicture('${d}')`, PIC.discoveryPicture(d), 120);
  add('rotatePicture()', PIC.rotatePicture());
  add('restPicture()', PIC.restPicture());
  add(`wheelPreview('chunky')`, PIC.wheelPreview('chunky'), 160);
  add(`wheelPreview('spring')`, PIC.wheelPreview('spring'), 160);
  for (const p of PAINT_IDS) add(`paintSwatch('${p}')`, PIC.paintSwatch(p), 90);
  for (const pt of PATTERN_IDS) add(`patternSwatch('${pt}','blue')`, PIC.patternSwatch(pt, 'blue'), 110);
  for (const pt of PATTERN_IDS) add(`patternSwatch('${pt}','yellow')`, PIC.patternSwatch(pt, 'yellow'), 110);
  for (const d of DECAL_IDS) add(`decalSwatch('${d}')`, PIC.decalSwatch(d), 90);
  const slotsCases: Slots[] = [
    [null, null, null, null, null, null],
    ['log', 'ramp', 'pond', null, 'log', null],
    ['ramp', 'log', null, 'pond', 'ramp', 'log'],
  ];
  for (const sl of slotsCases) add(`trackThumb([${sl.map((x) => x ?? '-').join(',')}])`, PIC.trackThumb(sl), 300);
  for (const tp of [null, 'log', 'ramp', 'pond'] as const) add(`trackPieceIcon(${tp ? `'${tp}'` : 'null'})`, PIC.trackPieceIcon(tp), 90);
  for (const l of [
    look({}),
    look({ paint: 'blue', pattern: 'stripes', decal: 'star', wheel: 'spring' }),
    look({ paint: 'yellow', pattern: 'checks', decal: 'b' }),
    look({ paint: 'green', pattern: 'dots', decal: 'leaf', wheel: 'spring' }),
    look({ paint: 'purple', pattern: 'stars', decal: 'paw' }),
    look({ paint: 'orange', pattern: 'zigzag', decal: 'bolt', wheel: 'spring' }),
  ])
    add(`truckPicture(${l.paint},${l.pattern},${l.decal},${l.wheel})`, PIC.truckPicture(l), 220);
  for (const g of ['star', 'moon', 'heart', 'triangle'] as const) add(`gatePicture('${g}')`, PIC.gatePicture(g), 110);
  for (const c of ['milo', 'pip', 'nori'] as const) add(`crewFace('${c}')`, PIC.crewFace(c), 100);

  for (const [label, svg, w] of items) {
    const markup = uniq(svg);
    card(
      grid,
      label,
      `<div class="pair"><div class="panel cream pic" style="width:${w}px">${markup}</div><div class="panel grey pic" style="width:${w}px">${uniq(svg)}</div></div>`,
    );
  }
}

// ---------------------------------------------------------------- decode check (what the rasteriser does: svg → data URL → <img>)

if (!only || only === 'raster') {
  const h = document.createElement('h2');
  h.textContent = 'Image decode check (every piece as a data-URL <img>, like rasterize.ts)';
  root.appendChild(h);
  const p = document.createElement('p');
  p.id = 'raster-result';
  p.textContent = 'checking…';
  root.appendChild(p);
  const load = (piece: ArtPiece) =>
    new Promise<string | null>((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img.naturalWidth > 0 ? null : `${piece.key}: zero size`);
      img.onerror = () => resolve(`${piece.key}: failed to decode`);
      img.src = svgDataUrl(svgDocument(piece));
    });
  void Promise.all(ALL_PIECES.map(load)).then((res) => {
    const bad = res.filter((r): r is string => !!r);
    p.textContent = bad.length ? `FAILED (${bad.length}): ${bad.join('; ')}` : `all ${ALL_PIECES.length} pieces decoded as images`;
    p.dataset.done = bad.length ? 'fail' : 'ok';
  });
}
