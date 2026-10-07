// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { registerAllArt } from '../../src/art';
import { registerPieces } from '../../src/art/registry';
import { WINDMILL_PIECES } from '../../src/art/scenes/windmill';
import { MAP_PIECES } from '../../src/art/scenes/map';
import { TINKER_PIECES } from '../../src/art/scenes/tinker';
import { CLUBHOUSE_PIECES } from '../../src/art/scenes/clubhouse';
import { PICNIC_PIECES } from '../../src/art/scenes/picnic';
import { STAGE_PIECES } from '../../src/art/scenes/stage';
import { TRAIL_ADVENTURE_PIECES } from '../../src/art/scenes/trailAdventures';
import { allPieceKeys, getPiece, pieceSvg } from '../../src/art/registry';
import { CAST_RIGS, CAST_IDS, avatarRig, rigArtKeys } from '../../src/art/cast';
import { AVATAR_SPECIES } from '../../src/art/cast/avatars';
import { CHOICE_COLORS } from '../../src/art/palette';
import { ART_SOURCES, LIBRARIES, OTHER_SOURCES, artManifest } from '../../src/art/manifest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';

registerAllArt();
registerPieces(WINDMILL_PIECES);
registerPieces(MAP_PIECES);
registerPieces(TINKER_PIECES);
registerPieces(CLUBHOUSE_PIECES);
registerPieces(PICNIC_PIECES);
registerPieces(STAGE_PIECES);
registerPieces(TRAIL_ADVENTURE_PIECES);

describe('authored art', () => {
  it('every piece is well-formed SVG', () => {
    const bad: string[] = [];
    for (const key of allPieceKeys()) {
      const doc = new DOMParser().parseFromString(pieceSvg(key), 'image/svg+xml');
      const err = doc.getElementsByTagName('parsererror')[0];
      if (err) bad.push(`${key}: ${err.textContent?.slice(0, 160)}`);
      const [, , w, h] = getPiece(key).box;
      if (!(w > 0 && h > 0)) bad.push(`${key}: empty box`);
    }
    expect(bad).toEqual([]);
  });

  it('every rig part refers to registered art', () => {
    const rigs = [...CAST_IDS.map((id) => CAST_RIGS[id])];
    for (const s of AVATAR_SPECIES) for (const c of CHOICE_COLORS) rigs.push(avatarRig(s.id, c.id));
    const missing: string[] = [];
    for (const r of rigs) for (const k of rigArtKeys(r)) if (!allPieceKeys().includes(k)) missing.push(`${r.id}: ${k}`);
    expect(missing).toEqual([]);
  });

  it('every gradient or clip a piece uses is defined inside that piece', () => {
    const bad: string[] = [];
    for (const key of allPieceKeys()) {
      const p = getPiece(key);
      const defined = new Set([...((p.defs ?? '') + p.body).matchAll(/id="([^"]+)"/g)].map((m) => m[1]));
      for (const m of p.body.matchAll(/url\(#([^)]+)\)/g)) if (!defined.has(m[1])) bad.push(`${key}: ${m[1]}`);
    }
    expect(bad).toEqual([]);
  });

  it('picnic pieces never share ids (they are also shown inline in the page)', () => {
    const seen = new Map<string, string>();
    const dup: string[] = [];
    for (const p of [...PICNIC_PIECES, ...STAGE_PIECES])
      for (const m of (p.defs ?? '').matchAll(/id="([^"]+)"/g)) {
        if (seen.has(m[1])) dup.push(`${m[1]} in ${seen.get(m[1])} and ${p.key}`);
        seen.set(m[1], p.key);
      }
    expect(dup).toEqual([]);
  });

  it('the asset manifest lists every art key exactly once, with a source file and licence', () => {
    const rows = artManifest();
    const counts = new Map<string, number>();
    for (const r of rows) counts.set(r.key, (counts.get(r.key) ?? 0) + 1);
    expect([...counts].filter(([, n]) => n > 1).map(([k]) => k)).toEqual([]);
    expect(allPieceKeys().filter((k) => !counts.has(k))).toEqual([]);
    for (const s of [...ART_SOURCES, ...OTHER_SOURCES]) {
      expect(existsSync(s.file), s.file).toBe(true);
      expect(s.licence.length).toBeGreaterThan(0);
    }
  });

  it('every art module and every shipped library is in the manifest', () => {
    const listed = new Set(ART_SOURCES.map((s) => s.file));
    for (const dir of ['src/art/scenes', 'src/art/cast'])
      for (const f of readdirSync(dir)) {
        const src = readFileSync(`${dir}/${f}`, 'utf8');
        if (/piece\(/.test(src) && !/^index\.ts$/.test(f)) expect(listed.has(`${dir}/${f}`), `${dir}/${f}`).toBe(true);
      }
    const deps = JSON.parse(readFileSync('package.json', 'utf8')).dependencies as Record<string, string>;
    expect(LIBRARIES.map((l) => `${l.name}@${l.version}`).sort()).toEqual(Object.entries(deps).map(([n, v]) => `${n}@${v}`).sort());
  });
});
