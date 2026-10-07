import { EXPRESSION_SPECS, type Expression, eyeKey, mouthKey } from './cast/face';
import type { RigDef } from './cast/rig';
import { getPiece } from './registry';

/**
 * Flattens a puppet rig into one static inline SVG for the DOM UI (profile
 * cards, captions, lists). Uses exactly the same art pieces as the game.
 */

let uidCounter = 0;

function inlinePiece(key: string, defsOut: string[], extraTransform = ''): string {
  const p = getPiece(key);
  const prefix = `p${uidCounter++}_`;
  let body = p.body;
  let defs = p.defs ?? '';
  // make gradient/clip ids unique within the combined document
  const ids = new Set<string>();
  for (const m of (defs + body).matchAll(/id="([^"]+)"/g)) ids.add(m[1]);
  for (const id of ids) {
    const re1 = new RegExp(`id="${id}"`, 'g');
    const re2 = new RegExp(`url\\(#${id}\\)`, 'g');
    defs = defs.replace(re1, `id="${prefix}${id}"`).replace(re2, `url(#${prefix}${id})`);
    body = body.replace(re1, `id="${prefix}${id}"`).replace(re2, `url(#${prefix}${id})`);
  }
  if (defs) defsOut.push(defs);
  return extraTransform ? `<g transform="${extraTransform}">${body}</g>` : body;
}

export interface RigSvgOpts {
  expression?: Expression;
  hat?: string | null;
  /** 'full' body or just the 'head' subtree */
  crop?: 'full' | 'head';
  size?: number;
  shadow?: boolean;
  title?: string;
}

export function rigSvg(rig: RigDef, opts: RigSvgOpts = {}): string {
  const defs: string[] = [];
  const expr = EXPRESSION_SPECS[opts.expression ?? 'happy'];
  const byParent = new Map<string | null, RigDef['parts']>();
  for (const p of rig.parts) {
    const list = byParent.get(p.parent) ?? [];
    list.push(p);
    byParent.set(p.parent, list);
  }
  const faceZ = rig.face.z ?? 5;
  const face = () => {
    const f = rig.face;
    let s = '';
    for (const [x, y] of f.blush) if (expr.blush > 0.05) s += `<g transform="translate(${x} ${y})" opacity="${expr.blush}">${inlinePiece('face.blush', defs)}</g>`;
    for (const [x, y] of f.eyes) s += `<g transform="translate(${x} ${y}) scale(${f.eyeScale})">${inlinePiece(eyeKey(expr.eye), defs)}</g>`;
    f.brows.forEach(([x, y], i) => {
      const a = (i === 0 ? -1 : 1) * expr.browTilt;
      s += `<g transform="translate(${x} ${y + expr.browY}) rotate(${a}) scale(${f.eyeScale})">${inlinePiece('face.brow', defs)}</g>`;
    });
    s += `<g transform="translate(${f.mouth[0]} ${f.mouth[1]})">${inlinePiece(mouthKey(expr.mouth), defs)}</g>`;
    return s;
  };
  const build = (parentId: string | null, ownArt: string | null, ownSx: number): string => {
    const entries: { z: number; s: string }[] = [];
    if (ownArt) entries.push({ z: 0, s: inlinePiece(ownArt, defs, ownSx !== 1 ? `scale(${ownSx} 1)` : '') });
    if (parentId === rig.face.head) entries.push({ z: faceZ, s: face() });
    if (parentId && opts.hat && rig.anchors.hat && rig.anchors.hat.part === parentId) {
      const a = rig.anchors.hat;
      entries.push({ z: 50, s: `<g transform="translate(${a.x} ${a.y}) scale(${a.scale ?? 1})">${inlinePiece(opts.hat, defs)}</g>` });
    }
    for (const k of byParent.get(parentId) ?? []) {
      const inner = build(k.id, k.art || null, k.sx ?? 1);
      entries.push({ z: k.z, s: `<g transform="translate(${k.x} ${k.y}) rotate(${k.rot ?? 0})">${inner}</g>` });
    }
    entries.sort((a, b) => a.z - b.z);
    return entries.map((e) => e.s).join('');
  };

  let content: string;
  let vb: [number, number, number, number];
  if (opts.crop === 'head') {
    // find head pivot in root space (head chains have no rest rotation)
    let hx = 0;
    let hy = 0;
    let cur: string | null = rig.face.head;
    while (cur) {
      const part = rig.parts.find((p) => p.id === cur);
      if (!part) break;
      hx += part.x;
      hy += part.y;
      cur = part.parent;
    }
    const head = rig.parts.find((p) => p.id === rig.face.head)!;
    content = `<g transform="translate(${hx} ${hy})">${build(head.id, head.art, 1)}</g>`;
    vb = [hx - 78, hy - 140, 156, 156];
  } else {
    content = (opts.shadow !== false ? `<ellipse cx="0" cy="0" rx="${rig.width * 0.52}" ry="10" fill="#3b2a20" opacity="0.18"/>` : '') + build(null, null, 1);
    const top = rig.height + 60;
    vb = [-rig.width - 20, -top, rig.width * 2 + 40, top + 20];
  }
  const size = opts.size ? `width="${opts.size}" height="${opts.size}"` : '';
  const title = opts.title ? `<title>${escapeXml(opts.title)}</title>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb.join(' ')}" ${size} role="img" ${opts.title ? '' : 'aria-hidden="true"'}>${title}<defs>${defs.join('')}</defs>${content}</svg>`;
}

export function escapeXml(s: string): string {
  return s.replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[c]!);
}
