/** Developer-only art lab: renders every piece and the puppet rigs. Not part of the child build. */
import Phaser from 'phaser';
import { registerAllArt } from '../art';
import { allPieceKeys, ensureArt, pieceSvg, svgDataUrl } from '../art/rasterize';
import { CAST_IDS, CAST_RIGS, avatarRig, rigArtKeys } from '../art/cast';
import { Puppet } from '../game/rig/Puppet';
import { EXPRESSIONS } from '../art/cast/face';
import { HATS } from '../art/cast/hats';
import { registerPieces } from '../art/registry';
import { WINDMILL_PIECES } from '../art/scenes/windmill';
import { MAP_PIECES } from '../art/scenes/map';
import { TINKER_PIECES } from '../art/scenes/tinker';
import { CLUBHOUSE_PIECES } from '../art/scenes/clubhouse';
import { PICNIC_PIECES } from '../art/scenes/picnic';
import { STAGE_PIECES } from '../art/scenes/stage';

registerAllArt();
for (const set of [WINDMILL_PIECES, MAP_PIECES, TINKER_PIECES, CLUBHOUSE_PIECES, PICNIC_PIECES, STAGE_PIECES]) registerPieces(set);
const params = new URLSearchParams(location.search);
const mode = params.get('mode') ?? 'rigs';

if (mode === 'sheet') {
  const sheet = document.getElementById('sheet')!;
  document.getElementById('game')!.style.display = 'none';
  const filter = params.get('filter') ?? '';
  for (const key of allPieceKeys().filter((k) => k.includes(filter))) {
    const fig = document.createElement('figure');
    const img = document.createElement('img');
    img.src = svgDataUrl(pieceSvg(key));
    fig.append(img, key);
    sheet.append(fig);
  }
} else {
  class Lab extends Phaser.Scene {
    async create() {
      const rigs = [...CAST_IDS.map((id) => CAST_RIGS[id]), avatarRig('fox', 'berry'), avatarRig('hedgehog', 'sea'), avatarRig('mouse', 'leaf'), avatarRig('frog', 'sun')];
      const keys = new Set<string>(HATS.map((h) => h.id));
      for (const r of rigs) for (const k of rigArtKeys(r)) keys.add(k);
      await ensureArt(this.textures, keys);
      this.add.rectangle(0, 0, 4000, 4000, 0xe9e1cf).setOrigin(0);
      this.add.rectangle(0, 720, 4000, 600, 0xb5d67a).setOrigin(0);
      const expr = params.get('expr');
      const hat = params.get('hat');
      rigs.forEach((r, i) => {
        const x = 130 + (i % 9) * 205;
        const p = new Puppet(this, x, 720, r, { seed: i, hat: hat ?? null });
        if (expr) p.setExpression(expr as never, true);
        else p.setExpression(EXPRESSIONS[i % EXPRESSIONS.length], true);
        this.add.text(x - 60, 760, r.id + '\n' + p.expression, { color: '#3b2a20', fontSize: '22px' });
        if (params.get('anim')) this.time.delayedCall(300, () => p.play(params.get('anim') as never));
        if (params.get('walk')) p.startGait();
      });
      (window as unknown as { __ok: string }).__ok = 'lab-ready';
    }
  }
  new Phaser.Game({
    type: Phaser.WEBGL,
    parent: 'game',
    backgroundColor: '#e9e1cf',
    scale: { mode: Phaser.Scale.FIT, width: 1920, height: 1080 },
    scene: [Lab],
    audio: { noAudio: true },
    render: { maxTextures: params.get('mt') ? Number(params.get('mt')) : 1 },
  });
}
