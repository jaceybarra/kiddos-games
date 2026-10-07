import { P } from './palette';

/**
 * An original vector art piece. The SVG body is authored in a local frame whose
 * (0,0) is the piece's pivot; `box` is the viewBox [minX, minY, width, height].
 */
export interface ArtPiece {
  key: string;
  box: [number, number, number, number];
  body: string;
  defs?: string;
  /** Background/scene layers are released when a scene shuts down. */
  transient?: boolean;
}

export function piece(
  key: string,
  box: [number, number, number, number],
  body: string,
  defs = '',
  transient = false,
): ArtPiece {
  return { key, box, body, defs, transient };
}

export function svgDocument(p: ArtPiece, scale = 1): string {
  const [x, y, w, h] = p.box;
  const pw = Math.max(1, Math.round(w * scale));
  const ph = Math.max(1, Math.round(h * scale));
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${pw}" height="${ph}" viewBox="${x} ${y} ${w} ${h}">` +
    (p.defs ? `<defs>${p.defs}</defs>` : '') +
    p.body +
    `</svg>`
  );
}

/** Origin fractions so the pivot (0,0) lands at the game object's position. */
export function originOf(p: ArtPiece): { ox: number; oy: number } {
  const [x, y, w, h] = p.box;
  return { ox: -x / w, oy: -y / h };
}

// ---------- authoring helpers ----------

export const ink = (w: number = 5) =>
  `stroke="${P.ink}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"`;

/** Vertical shading gradient: lighter top, base mid, darker bottom. */
export function vgrad(id: string, top: string, bottom: string): string {
  return `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${top}"/><stop offset="1" stop-color="${bottom}"/></linearGradient>`;
}

export function hgrad(id: string, left: string, right: string): string {
  return `<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${left}"/><stop offset="1" stop-color="${right}"/></linearGradient>`;
}

/** Diagonal toy-light gradient (light from upper-left). */
export function dgrad(id: string, light: string, dark: string): string {
  return `<linearGradient id="${id}" x1="0.15" y1="0.05" x2="0.85" y2="1"><stop offset="0" stop-color="${light}"/><stop offset="1" stop-color="${dark}"/></linearGradient>`;
}

export function rgrad(id: string, inner: string, outer: string, innerOpacity = 1, outerOpacity = 1): string {
  return `<radialGradient id="${id}" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="${inner}" stop-opacity="${innerOpacity}"/><stop offset="1" stop-color="${outer}" stop-opacity="${outerOpacity}"/></radialGradient>`;
}

/** Soft white highlight blob. */
export function shine(cx: number, cy: number, rx: number, ry: number, rot = -20, op = 0.32): string {
  return `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" transform="rotate(${rot} ${cx} ${cy})" fill="#fff" opacity="${op}"/>`;
}

/** Ground contact shadow. */
export function shadow(cx: number, cy: number, rx: number, ry: number, op = 0.18): string {
  return `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${P.ink}" opacity="${op}"/>`;
}

export function circle(cx: number, cy: number, r: number, fill: string, strokeW = 0, extra = ''): string {
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" ${strokeW ? ink(strokeW) : ''} ${extra}/>`;
}

export function ellipse(cx: number, cy: number, rx: number, ry: number, fill: string, strokeW = 0, extra = ''): string {
  return `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${fill}" ${strokeW ? ink(strokeW) : ''} ${extra}/>`;
}

export function path(d: string, fill: string, strokeW = 0, extra = ''): string {
  return `<path d="${d}" fill="${fill}" ${strokeW ? ink(strokeW) : ''} ${extra}/>`;
}

export function line(d: string, w: number, color: string = P.ink, extra = ''): string {
  return `<path d="${d}" fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" ${extra}/>`;
}

export function rrect(x: number, y: number, w: number, h: number, r: number, fill: string, strokeW = 0, extra = ''): string {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" ry="${r}" fill="${fill}" ${strokeW ? ink(strokeW) : ''} ${extra}/>`;
}

export function g(content: string, transform = '', extra = ''): string {
  return `<g ${transform ? `transform="${transform}"` : ''} ${extra}>${content}</g>`;
}

/** Seeded pseudo-random for decorative scatter inside art (stable across runs). */
export function artRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Wood grain strokes inside a rect region. */
export function grain(x: number, y: number, w: number, h: number, seed: number, count = 3, color: string = P.woodDark): string {
  const r = artRng(seed);
  let out = '';
  for (let i = 0; i < count; i++) {
    const yy = y + h * (0.2 + 0.6 * ((i + r() * 0.6) / count));
    const x1 = x + w * (0.08 + r() * 0.2);
    const x2 = x + w * (0.55 + r() * 0.35);
    const bend = (r() - 0.5) * h * 0.25;
    out += line(`M${x1} ${yy} Q${(x1 + x2) / 2} ${yy + bend} ${x2} ${yy}`, 2.5, color, 'opacity="0.45"');
  }
  return out;
}

/** Smooth closed blob through points using Catmull-Rom → cubic Bézier. */
export function blobPath(pts: [number, number][], tension = 1): string {
  const n = pts.length;
  let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const p3 = pts[(i + 2) % n];
    const c1x = p1[0] + ((p2[0] - p0[0]) / 6) * tension;
    const c1y = p1[1] + ((p2[1] - p0[1]) / 6) * tension;
    const c2x = p2[0] - ((p3[0] - p1[0]) / 6) * tension;
    const c2y = p2[1] - ((p3[1] - p1[1]) / 6) * tension;
    d += ` C${c1x.toFixed(1)} ${c1y.toFixed(1)} ${c2x.toFixed(1)} ${c2y.toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return d + ' Z';
}

/** Open smooth curve through points. */
export function smoothPath(pts: [number, number][]): string {
  const n = pts.length;
  let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < n - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(n - 1, i + 2)];
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C${c1x.toFixed(1)} ${c1y.toFixed(1)} ${c2x.toFixed(1)} ${c2y.toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return d;
}

/** A wobbly hand-cut edge along a horizontal line (paper-scenery look). */
export function hillPath(
  x0: number,
  x1: number,
  baseY: number,
  bottomY: number,
  bumps: number,
  amp: number,
  seed: number,
): string {
  const r = artRng(seed);
  const pts: [number, number][] = [];
  const steps = bumps * 2;
  for (let i = 0; i <= steps; i++) {
    const x = x0 + ((x1 - x0) * i) / steps;
    const y = baseY - (i % 2 === 0 ? 0 : amp * (0.5 + r() * 0.7)) + (r() - 0.5) * amp * 0.25;
    pts.push([x, y]);
  }
  return smoothPath(pts) + ` L${x1} ${bottomY} L${x0} ${bottomY} Z`;
}
