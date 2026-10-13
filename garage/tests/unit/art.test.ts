// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { ALL_PIECES, BOOT_KEYS, GARAGE_KEYS, MISSION_KEYS, registerAll } from '../../src/art/index';
import { svgDocument } from '../../src/art/svg';
import { hasPiece } from '../../src/art/registry';
import { ICONS } from '../../src/art/icons';
import { ICON_NAMES } from '../../src/art/iconNames';
import * as PIC from '../../src/art/pictures';
import { MISSION_ORDER, type CrewId, type MissionId } from '../../src/content/missions';
import { DECAL_IDS, DISCOVERY_IDS, PAINT_IDS, PATTERN_IDS, REWARD_IDS } from '../../src/save/schema';
import type { Choice } from '../../src/core/missionState';
import { TRACK_PIECES, type Slots } from '../../src/core/track';

const SVG_NS = 'http://www.w3.org/2000/svg';

function parse(markup: string): Document {
  return new DOMParser().parseFromString(markup, 'image/svg+xml');
}

function parseErrors(markup: string): string | null {
  const doc = parse(markup);
  const err = doc.getElementsByTagName('parsererror')[0];
  if (err) return err.textContent ?? 'parsererror';
  if (doc.documentElement.nodeName !== 'svg') return `root is <${doc.documentElement.nodeName}>`;
  return null;
}

/** Child-facing art never needs reading, never reaches the network and never runs code. */
function safetyProblems(markup: string): string[] {
  const out: string[] = [];
  const withoutNs = markup.split(SVG_NS).join('');
  if (/http/i.test(withoutNs)) out.push('mentions http');
  if (/<image[\s>]/i.test(markup)) out.push('<image>');
  if (/<text[\s>]/i.test(markup)) out.push('<text>');
  if (/<tspan[\s>]/i.test(markup)) out.push('<tspan>');
  if (/<script[\s>]/i.test(markup)) out.push('<script>');
  if (/<foreignObject[\s>]/i.test(markup)) out.push('<foreignObject>');
  if (/\son[a-z]+\s*=/i.test(markup)) out.push('event handler attribute');
  if (/javascript:/i.test(markup)) out.push('javascript: url');
  if (/@import/i.test(markup)) out.push('@import');
  for (const m of markup.matchAll(/(?:xlink:)?href\s*=\s*"([^"]*)"/g)) if (!m[1].startsWith('#')) out.push(`external href ${m[1]}`);
  for (const m of markup.matchAll(/url\(\s*['"]?([^)'"]*)/g)) if (!m[1].startsWith('#')) out.push(`external url(${m[1]})`);
  return out;
}

// ---------------------------------------------------------------- every valid picture call

type Summary = { placed: { socket: string; piece: string }[]; choice: Choice };
const S = (placed: [string, string][], choice: Choice): Summary => ({ placed: placed.map(([socket, piece]) => ({ socket, piece })), choice });

function allPictures(): [string, string][] {
  const out: [string, string][] = [];
  for (const c of ['turns', 'path', 'gentle', 'jump'] as const) out.push([`choicePicture(${c})`, PIC.choicePicture(c)]);
  for (const m of MISSION_ORDER) out.push([`missionCardPicture(${m})`, PIC.missionCardPicture(m)]);
  out.push(['trackCardPicture()', PIC.trackCardPicture()]);
  const summaries: Summary[] = [
    S([], null),
    S([['span', 'bridge']], null),
    S([['launch', 'ramp']], null),
    S([['launch', 'pad']], null),
    S([['span', 'bridge'], ['launch', 'ramp'], ['x', 'pad']], null),
    S([], 'turns'),
    S([], 'path'),
    S([['front-span', 'bridge']], 'path'),
    S([], 'gentle'),
    S([], 'jump'),
    S([['span', 'bridge'], ['climb', 'ramp']], 'gentle'),
    S([['climb', 'pad']], 'jump'),
  ];
  for (const m of [...MISSION_ORDER, 'track'] as (MissionId | 'track')[])
    for (const i of [0, 1, 2] as const) for (const [k, s] of summaries.entries()) out.push([`recapPanel(${m},${i},#${k})`, PIC.recapPanel(m, i, s)]);
  for (const r of REWARD_IDS) out.push([`rewardPicture(${r})`, PIC.rewardPicture(r)]);
  for (const d of DISCOVERY_IDS) out.push([`discoveryPicture(${d})`, PIC.discoveryPicture(d)]);
  out.push(['rotatePicture()', PIC.rotatePicture()]);
  out.push(['restPicture()', PIC.restPicture()]);
  for (const w of ['chunky', 'spring'] as const) out.push([`wheelPreview(${w})`, PIC.wheelPreview(w)]);
  for (const p of PAINT_IDS) out.push([`paintSwatch(${p})`, PIC.paintSwatch(p)]);
  for (const pt of PATTERN_IDS) for (const p of PAINT_IDS) out.push([`patternSwatch(${pt},${p})`, PIC.patternSwatch(pt, p)]);
  for (const d of DECAL_IDS) out.push([`decalSwatch(${d})`, PIC.decalSwatch(d)]);
  const slots: Slots[] = [
    [null, null, null, null, null, null],
    ['log', 'ramp', 'pond', null, 'log', null],
    ['ramp', 'log', null, 'pond', 'ramp', 'log'],
    ['log', 'log', 'log', 'log', 'log', 'log'],
  ];
  for (const sl of slots) out.push([`trackThumb(${sl.join(',')})`, PIC.trackThumb(sl)]);
  for (const tp of [null, ...TRACK_PIECES]) out.push([`trackPieceIcon(${tp})`, PIC.trackPieceIcon(tp)]);
  for (const paint of PAINT_IDS)
    for (const wheel of ['chunky', 'spring'] as const) out.push([`truckPicture(${paint},${wheel})`, PIC.truckPicture({ paint, pattern: 'stripes', decal: 'star', wheel })]);
  for (const pattern of PATTERN_IDS) for (const decal of DECAL_IDS) out.push([`truckPicture(${pattern},${decal})`, PIC.truckPicture({ paint: 'blue', pattern, decal, wheel: 'chunky' })]);
  for (const g of ['star', 'moon', 'heart', 'triangle'] as const) out.push([`gatePicture(${g})`, PIC.gatePicture(g)]);
  for (const c of ['milo', 'pip', 'nori'] as CrewId[]) out.push([`crewFace(${c})`, PIC.crewFace(c)]);
  return out;
}

// ---------------------------------------------------------------- pieces

describe('art pieces', () => {
  it('every key is unique and well formed', () => {
    const keys = ALL_PIECES.map((p) => p.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const k of keys) expect(k, k).toMatch(/^[a-z0-9.-]+$/);
  });

  it('every piece has a sane box and parses as SVG', () => {
    for (const p of ALL_PIECES) {
      const [, , w, h] = p.box;
      expect(w > 0 && h > 0, `${p.key} box`).toBe(true);
      expect(parseErrors(svgDocument(p)), p.key).toBeNull();
    }
  });

  it('clipPath and gradient ids are unique across all pieces', () => {
    const seen = new Map<string, string>();
    for (const p of ALL_PIECES) {
      const doc = parse(svgDocument(p));
      for (const el of Array.from(doc.querySelectorAll('[id]'))) {
        const id = el.getAttribute('id')!;
        expect(seen.has(id), `id "${id}" in ${p.key} also in ${seen.get(id)}`).toBe(false);
        seen.set(id, p.key);
      }
    }
  });

  it('every url(#id) inside a piece points at a definition of that piece', () => {
    for (const p of ALL_PIECES) {
      const markup = svgDocument(p);
      const ids = new Set(Array.from(markup.matchAll(/\sid="([^"]+)"/g), (m) => m[1]));
      for (const m of markup.matchAll(/url\(#([^)]+)\)/g)) expect(ids.has(m[1]), `${p.key} uses #${m[1]}`).toBe(true);
    }
  });

  it('no piece needs reading, reaches out or runs code', () => {
    for (const p of ALL_PIECES) expect(safetyProblems(svgDocument(p)), p.key).toEqual([]);
  });

  it('the garage pieces keep their agreed boxes and pivots', () => {
    const box = (k: string) => ALL_PIECES.find((p) => p.key === k)?.box;
    expect(box('garage.interior')).toEqual([0, 0, 1920, 1080]);
    expect(box('garage.exterior')).toEqual([0, 0, 1920, 1080]);
    expect(box('garage.door')).toEqual([0, 0, 700, 550]);
    expect(box('garage.lift')).toEqual([-280, -30, 560, 90]);
    expect(box('garage.shelf')).toEqual([-320, -12, 640, 70]);
    expect(box('garage.spot')).toEqual([-70, -150, 140, 152]);
    expect(box('garage.jar')).toEqual([-60, -150, 120, 152]);
    expect(box('garage.jar.fill')).toEqual([-60, -150, 120, 152]);
    expect(box('garage.signboard')).toEqual([-300, -60, 600, 120]);
    expect(ALL_PIECES.find((p) => p.key === 'garage.interior')?.transient).toBe(true);
    expect(ALL_PIECES.find((p) => p.key === 'garage.exterior')?.transient).toBe(true);
    for (const k of ['garage.toolbox', 'garage.tires', 'reward.pennant', 'reward.twin-ramp', 'reward.crew-banner']) {
      const b = box(k)!;
      expect(b, k).toBeTruthy();
      // pivot at the bottom centre: the box is centred on x = 0 and ends just below y = 0
      expect(b[0] + b[2] / 2, k).toBe(0);
      expect(b[1] + b[3], k).toBeGreaterThanOrEqual(0);
      expect(b[1] + b[3], k).toBeLessThanOrEqual(4);
    }
  });

  it('the existing truck, crew and world keys and boxes are unchanged', () => {
    const box = (k: string) => ALL_PIECES.find((p) => p.key === k)?.box;
    expect(box('truck.body')).toEqual([-140, -132, 296, 132]);
    expect(box('truck.trim')).toEqual([-140, -132, 296, 132]);
    expect(box('wheel.chunky')).toEqual([-72, -72, 144, 144]);
    expect(box('wheel.spring')).toEqual([-64, -64, 128, 128]);
    expect(box('crew.milo.idle')).toEqual([-110, -220, 220, 236]);
    expect(box('obj.acorn')).toEqual([-40, -50, 80, 96]);
    expect(box('obj.log')).toEqual([-8, -84, 96, 86]);
    expect(box('bg.far')).toEqual([0, 0, 2048, 420]);
  });
});

describe('art key sets', () => {
  it('registerAll is idempotent and registers every piece', () => {
    registerAll();
    registerAll();
    for (const p of ALL_PIECES) expect(hasPiece(p.key), p.key).toBe(true);
  });

  it('every listed key exists, and BOOT_KEYS is the union of the scene sets', () => {
    const keys = new Set(ALL_PIECES.map((p) => p.key));
    for (const k of [...GARAGE_KEYS, ...MISSION_KEYS]) expect(keys.has(k), k).toBe(true);
    expect(new Set(BOOT_KEYS)).toEqual(new Set([...GARAGE_KEYS, ...MISSION_KEYS]));
    expect(BOOT_KEYS.length).toBe(new Set(BOOT_KEYS).size);
  });

  it('the garage and missions get what they draw', () => {
    for (const k of ['garage.interior', 'garage.lift', 'garage.jar.fill', 'reward.pennant', 'truck.body', 'wheel.spring', 'crew.pip.cheer', 'obj.acorn', 'obj.pinwheel.head', 'obj.coin', 'fx.confetti.a', 'fx.hand', 'fx.arrow'])
      expect(GARAGE_KEYS, k).toContain(k);
    for (const k of ['truck.trim', 'crew.nori.help', 'prop.kart', 'bg.mid', 'obj.finish', 'fx.bubble', 'reward.crew-banner']) expect(MISSION_KEYS, k).toContain(k);
  });
});

// ---------------------------------------------------------------- icons

describe('icons', () => {
  it('every icon name has a parseable, safe, CSS-sized svg', () => {
    for (const name of ICON_NAMES) {
      const svg = ICONS[name];
      expect(svg, name).toBeTruthy();
      expect(parseErrors(svg), name).toBeNull();
      expect(safetyProblems(svg), name).toEqual([]);
      const root = parse(svg).documentElement;
      expect(root.getAttribute('viewBox'), name).toBe('0 0 100 100');
      expect(root.getAttribute('aria-hidden'), name).toBe('true');
      expect(root.getAttribute('focusable'), name).toBe('false');
      expect(root.hasAttribute('width') || root.hasAttribute('height'), name).toBe(false);
      // an icon can appear many times on a page: no ids to collide
      expect(svg.includes(' id="'), name).toBe(false);
    }
  });

  it('icons are all different', () => {
    const bodies = ICON_NAMES.map((n) => ICONS[n]);
    expect(new Set(bodies).size).toBe(bodies.length);
  });
});

// ---------------------------------------------------------------- pictures

describe('pictures', () => {
  const pictures = allPictures();

  it('every picture parses as a scalable, hidden-from-readers svg', () => {
    for (const [label, svg] of pictures) {
      expect(parseErrors(svg), label).toBeNull();
      const root = parse(svg).documentElement;
      expect(root.getAttribute('viewBox'), label).toMatch(/^-?[\d.]+ -?[\d.]+ [\d.]+ [\d.]+$/);
      expect(root.hasAttribute('width') || root.hasAttribute('height'), label).toBe(false);
      expect(root.getAttribute('aria-hidden'), label).toBe('true');
      expect(root.getAttribute('focusable'), label).toBe('false');
    }
  });

  it('no picture needs reading, reaches out or runs code', () => {
    for (const [label, svg] of pictures) expect(safetyProblems(svg), label).toEqual([]);
  });

  it('ids inside one picture are unique and every reference resolves; two copies never share ids', () => {
    for (const [label, svg] of pictures) {
      const ids = Array.from(svg.matchAll(/\sid="([^"]+)"/g), (m) => m[1]);
      expect(new Set(ids).size, label).toBe(ids.length);
      for (const m of svg.matchAll(/url\(#([^)]+)\)/g)) expect(ids.includes(m[1]), `${label} uses #${m[1]}`).toBe(true);
    }
    const a = PIC.truckPicture({ paint: 'red', pattern: 'stripes', decal: 'b', wheel: 'spring' });
    const b = PIC.truckPicture({ paint: 'red', pattern: 'stripes', decal: 'b', wheel: 'spring' });
    const idsA = new Set(Array.from(a.matchAll(/\sid="([^"]+)"/g), (m) => m[1]));
    for (const m of b.matchAll(/\sid="([^"]+)"/g)) expect(idsA.has(m[1])).toBe(false);
  });

  it('animated parts sit on their own group so the transform animation never fights a transform attribute', () => {
    for (const [label, svg] of pictures) {
      const doc = parse(svg);
      for (const el of Array.from(doc.querySelectorAll('[class]'))) {
        const cls = el.getAttribute('class') ?? '';
        if (!/\banim-/.test(cls)) continue;
        expect(el.nodeName, `${label}: ${cls}`).toBe('g');
        expect(el.hasAttribute('transform'), `${label}: ${cls} has a transform attribute`).toBe(false);
      }
    }
  });

  it('the four choice pictures and the three mission cards are all different', () => {
    const choices = (['turns', 'path', 'gentle', 'jump'] as const).map((c) => PIC.choicePicture(c).replace(/-wp[0-9a-z]+/g, ''));
    expect(new Set(choices).size).toBe(4);
    const cards = MISSION_ORDER.map((m) => PIC.missionCardPicture(m).replace(/-wp[0-9a-z]+/g, ''));
    expect(new Set(cards).size).toBe(3);
  });

  it('the recap shows what the child actually built or chose', () => {
    const strip = (s: string) => s.replace(/-wp[0-9a-z]+/g, '');
    const bridge = strip(PIC.recapPanel('wobbly-bridge', 1, S([['span', 'bridge']], null)));
    const ramp = strip(PIC.recapPanel('wobbly-bridge', 1, S([['launch', 'ramp']], null)));
    const both = strip(PIC.recapPanel('wobbly-bridge', 1, S([['span', 'bridge'], ['launch', 'ramp']], null)));
    expect(new Set([bridge, ramp, both]).size).toBe(3);
    const turns = strip(PIC.recapPanel('ramp-we-share', 1, S([], 'turns')));
    const path = strip(PIC.recapPanel('ramp-we-share', 1, S([], 'path')));
    expect(turns).not.toBe(path);
  });

  it('the truck picture follows the look', () => {
    const strip = (s: string) => s.replace(/-wp[0-9a-z]+/g, '');
    const base = { paint: 'red', pattern: 'plain', decal: 'none', wheel: 'chunky' } as const;
    const variants = [
      base,
      { ...base, paint: 'blue' as const },
      { ...base, pattern: 'dots' as const },
      { ...base, decal: 'paw' as const },
      { ...base, wheel: 'spring' as const },
    ].map((l) => strip(PIC.truckPicture(l)));
    expect(new Set(variants).size).toBe(variants.length);
  });
});
