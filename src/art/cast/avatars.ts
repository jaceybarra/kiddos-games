import { CHOICE_COLORS, P, mix } from '../palette';
import { type ArtPiece, blobPath, circle, dgrad, ellipse, line, path, piece, shine } from '../svg';
import type { RigDef, RigPart } from './rig';

/** The player's avatars: four original woodland kids with a chosen outfit colour. */

export type AvatarSpecies = 'fox' | 'hedgehog' | 'mouse' | 'frog';
export const AVATAR_SPECIES: { id: AvatarSpecies; name: string }[] = [
  { id: 'fox', name: 'Fox' },
  { id: 'hedgehog', name: 'Hedgehog' },
  { id: 'mouse', name: 'Mouse' },
  { id: 'frog', name: 'Frog' },
];

interface SpeciesLook {
  fur: string;
  furDark: string;
  belly: string;
}

const LOOK: Record<AvatarSpecies, SpeciesLook> = {
  fox: { fur: '#eea34b', furDark: '#c47530', belly: '#fff1dc' },
  hedgehog: { fur: '#f0d2a8', furDark: '#c9a175', belly: '#fbe8cf' },
  mouse: { fur: '#bdb3b8', furDark: '#8f858b', belly: '#efe7ea' },
  frog: { fur: '#82c46c', furDark: '#4f9a4a', belly: '#eaf3b6' },
};

function bodyPiece(sp: AvatarSpecies, colorId: string, color: string): ArtPiece {
  const L = LOOK[sp];
  const outfitDark = mix(color, P.ink, 0.3);
  const outfitLight = mix(color, '#ffffff', 0.25);
  const shape = blobPath([
    [0, 2],
    [30, -2],
    [42, -22],
    [40, -52],
    [30, -76],
    [0, -86],
    [-30, -76],
    [-40, -52],
    [-42, -22],
    [-30, -2],
  ]);
  return piece(
    `av.${sp}.body.${colorId}`,
    [-52, -96, 104, 104],
    path(shape, L.fur, 5) +
      // tunic with a round collar and two buttons
      `<clipPath id="cl"><path d="${shape}"/></clipPath>` +
      `<g clip-path="url(#cl)">` +
      path('M-60 -66 Q0 -50 60 -66 L60 20 L-60 20 Z', 'url(#ot)') +
      path('M-22 -62 Q0 -44 22 -62', 'none', 0, `stroke="${L.belly}" stroke-width="9" stroke-linecap="round"`) +
      line('M-48 -12 Q0 0 48 -12', 4, outfitDark, 'opacity="0.6"') +
      `</g>` +
      path(shape, 'none', 5) +
      circle(0, -38, 4.5, P.cream, 2.5) +
      circle(0, -22, 4.5, P.cream, 2.5) +
      shine(-20, -64, 8, 12, -25, 0.28),
    dgrad('ot', outfitLight, outfitDark),
  );
}

function headPiece(sp: AvatarSpecies): ArtPiece {
  const L = LOOK[sp];
  const id = `av.${sp}.head`;
  switch (sp) {
    case 'fox':
      return piece(
        id,
        [-62, -96, 124, 102],
        path(
          blobPath([[0, 2], [26, -4], [54, -24], [52, -48], [40, -72], [18, -86], [0, -88], [-18, -86], [-40, -72], [-52, -48], [-54, -24], [-26, -4]]),
          'url(#hd)',
          5,
        ) +
          path('M-50 -26 Q-30 -40 0 -32 Q30 -40 50 -26 Q30 -4 0 -2 Q-30 -4 -50 -26 Z', L.belly) +
          path('M-7 -30 Q0 -35 7 -30 Q5 -23 0 -22 Q-5 -23 -7 -30 Z', P.ink) +
          shine(-22, -66, 12, 7, -25, 0.3),
        dgrad('hd', mix(L.fur, '#fff', 0.15), L.furDark),
      );
    case 'hedgehog':
      return piece(
        id,
        [-56, -92, 112, 98],
        path(blobPath([[0, 2], [28, -2], [46, -20], [50, -44], [40, -68], [20, -82], [0, -84], [-20, -82], [-40, -68], [-50, -44], [-46, -20], [-28, -2]]), 'url(#hd)', 5) +
          ellipse(0, -26, 22, 15, L.belly) +
          ellipse(0, -30, 7, 5.5, P.ink) +
          circle(-2, -31, 1.8, '#fff', 0, 'opacity="0.7"') +
          shine(-20, -64, 12, 7, -25, 0.3),
        dgrad('hd', mix(L.fur, '#fff', 0.2), L.furDark),
      );
    case 'mouse':
      return piece(
        id,
        [-56, -92, 112, 98],
        path(blobPath([[0, 2], [28, -2], [46, -20], [50, -44], [40, -68], [20, -82], [0, -84], [-20, -82], [-40, -68], [-50, -44], [-46, -20], [-28, -2]]), 'url(#hd)', 5) +
          ellipse(0, -22, 20, 13, L.belly) +
          circle(0, -30, 6, P.rose, 3.5) +
          line('M-14 -22 L-40 -26 M-14 -18 L-40 -14 M14 -22 L40 -26 M14 -18 L40 -14', 2.5, P.inkSoft, 'opacity="0.7"') +
          shine(-20, -64, 12, 7, -25, 0.3),
        dgrad('hd', mix(L.fur, '#fff', 0.2), L.furDark),
      );
    case 'frog':
      return piece(
        id,
        [-66, -100, 132, 106],
        // wide head with two eye bumps on top
        path(
          'M-56 -16 Q-62 -50 -42 -64 Q-50 -92 -24 -94 Q-6 -94 -6 -70 Q0 -72 6 -70 Q6 -94 24 -94 Q50 -92 42 -64 Q62 -50 56 -16 Q40 4 0 4 Q-40 4 -56 -16 Z',
          'url(#hd)',
          5,
        ) +
          ellipse(0, -18, 34, 12, L.belly, 0, 'opacity="0.9"') +
          circle(-6, -38, 2.2, P.ink) +
          circle(6, -38, 2.2, P.ink) +
          ellipse(-24, -78, 15, 13, '#fff', 3.5) +
          ellipse(24, -78, 15, 13, '#fff', 3.5) +
          shine(-34, -54, 10, 6, -20, 0.3),
        dgrad('hd', mix(L.fur, '#fff', 0.15), L.furDark),
      );
  }
}

function earPiece(sp: AvatarSpecies): ArtPiece | null {
  const L = LOOK[sp];
  const id = `av.${sp}.ear`;
  switch (sp) {
    case 'fox':
      return piece(
        id,
        [-24, -60, 46, 66],
        path('M-16 4 Q-18 -30 -6 -54 Q4 -40 16 4 Z', L.fur, 5) + path('M-9 -4 Q-10 -26 -4 -40 Q2 -26 8 -4 Z', L.belly) + path('M-12 -34 Q-6 -54 -6 -54 Q0 -46 2 -38 Q-4 -36 -12 -34 Z', P.ink),
      );
    case 'hedgehog':
      return piece(id, [-14, -18, 28, 24], ellipse(0, -6, 10, 9, L.fur, 4) + ellipse(0, -5, 5, 4, P.rose, 0, 'opacity="0.7"'));
    case 'mouse':
      return piece(id, [-36, -64, 70, 70], circle(0, -28, 30, L.fur, 5) + circle(0, -28, 19, P.rose, 0, 'opacity="0.85"'));
    case 'frog':
      return null;
  }
}

function extraPiece(sp: AvatarSpecies): ArtPiece | null {
  const L = LOOK[sp];
  switch (sp) {
    case 'fox':
      return piece(
        'av.fox.tail',
        [-104, -110, 118, 118],
        path(blobPath([[10, 2], [-20, -10], [-60, -40], [-90, -76], [-96, -100], [-72, -102], [-40, -80], [-6, -50], [14, -20]]), L.fur, 5) +
          path('M-84 -70 Q-96 -92 -94 -100 Q-74 -104 -62 -90 Q-70 -76 -84 -70 Z', '#fff8ec', 4) +
          line('M-10 -20 Q-40 -40 -60 -64', 4, L.furDark, 'opacity="0.5"'),
      );
    case 'hedgehog': {
      // a ring of soft spines behind the head and body
      let spikes = '';
      const n = 13;
      for (let i = 0; i < n; i++) {
        const a = Math.PI * (1.05 + (0.9 * i) / (n - 1));
        const r1 = 52;
        const r2 = 84;
        const a1 = a - 0.16;
        const a2 = a + 0.16;
        spikes += `L${(Math.cos(a1) * r1).toFixed(1)} ${(Math.sin(a1) * r1 - 40).toFixed(1)} L${(Math.cos(a) * r2).toFixed(1)} ${(Math.sin(a) * r2 - 40).toFixed(1)} L${(Math.cos(a2) * r1).toFixed(1)} ${(Math.sin(a2) * r1 - 40).toFixed(1)} `;
      }
      return piece(
        'av.hedgehog.spines',
        [-92, -132, 184, 140],
        path(`M-50 -20 ${spikes} L50 -20 Q0 0 -50 -20 Z`, 'url(#sp)', 5) +
          line('M-40 -70 L-58 -96 M-12 -86 L-14 -116 M18 -84 L24 -114 M44 -64 L64 -88', 3, '#4f3324', 'opacity="0.5"'),
        dgrad('sp', '#a56f4b', '#5c3a26'),
      );
    }
    case 'mouse':
      return piece('av.mouse.tail', [-90, -70, 100, 80], line('M4 0 Q-30 4 -50 -18 Q-66 -40 -48 -54 Q-30 -62 -36 -40', 7, P.ink) + line('M4 0 Q-30 4 -50 -18 Q-66 -40 -48 -54 Q-30 -62 -36 -40', 3.5, P.rose));
    case 'frog':
      return null;
  }
}

function armPiece(sp: AvatarSpecies): ArtPiece {
  const L = LOOK[sp];
  return piece(
    `av.${sp}.arm`,
    [-13, -10, 26, 52],
    path('M-7 -4 Q0 -8 7 -4 L7 28 Q7 37 0 37 Q-7 37 -7 28 Z', L.fur, 4.5) + ellipse(0, 36, 8.5, 8, sp === 'fox' ? P.ink : L.furDark, 3.5),
  );
}

function footPiece(sp: AvatarSpecies): ArtPiece {
  const L = LOOK[sp];
  if (sp === 'frog') {
    return piece('av.frog.foot', [-24, -6, 52, 24], path('M-14 0 Q0 -4 14 0 L24 10 Q16 12 14 8 Q10 14 4 10 Q0 15 -6 10 Q-12 14 -14 8 Q-20 12 -22 10 Z', L.furDark, 4));
  }
  return piece(`av.${sp}.foot`, [-20, -6, 44, 22], ellipse(3, 6, 15, 8.5, sp === 'fox' ? P.ink : L.furDark, 4.5) + shine(-1, 3, 6, 3, 0, 0.25));
}

export function avatarPieces(): ArtPiece[] {
  const out: ArtPiece[] = [];
  for (const { id: sp } of AVATAR_SPECIES) {
    for (const c of CHOICE_COLORS) out.push(bodyPiece(sp, c.id, c.hex));
    out.push(headPiece(sp), armPiece(sp), footPiece(sp));
    const e = earPiece(sp);
    if (e) out.push(e);
    const x = extraPiece(sp);
    if (x) out.push(x);
  }
  return out;
}

export function avatarRig(sp: AvatarSpecies, colorId: string): RigDef {
  const parts: RigPart[] = [
    { id: 'footBack', art: `av.${sp}.foot`, parent: null, x: -17, y: -8, z: 1 },
    { id: 'footFront', art: `av.${sp}.foot`, parent: null, x: 17, y: -8, z: 1 },
    { id: 'body', art: `av.${sp}.body.${colorId}`, parent: null, x: 0, y: -10, z: 2 },
    { id: 'head', art: `av.${sp}.head`, parent: 'body', x: 0, y: -80, z: 2 },
    { id: 'armBack', art: `av.${sp}.arm`, parent: 'body', x: -34, y: -62, z: 3, rot: 14 },
    { id: 'armFront', art: `av.${sp}.arm`, parent: 'body', x: 34, y: -62, z: 3, rot: -14 },
  ];
  const ears: string[] = [];
  let tail: string | undefined;
  let eyes: [number, number][] = [
    [-17, -50],
    [17, -50],
  ];
  let brows: [number, number][] = [
    [-18, -66],
    [18, -66],
  ];
  let mouth: [number, number] = [0, -14];
  let hatY = -82;
  if (sp === 'fox') {
    parts.push({ id: 'earL', art: 'av.fox.ear', parent: 'head', x: -28, y: -72, z: -1, rot: -12 });
    parts.push({ id: 'earR', art: 'av.fox.ear', parent: 'head', x: 28, y: -72, z: -1, rot: 12, sx: -1 });
    parts.push({ id: 'tail', art: 'av.fox.tail', parent: 'body', x: -26, y: -14, z: -1 });
    ears.push('earL', 'earR');
    tail = 'tail';
    mouth = [0, -12];
  } else if (sp === 'hedgehog') {
    parts.push({ id: 'spines', art: 'av.hedgehog.spines', parent: 'body', x: 0, y: -40, z: -1 });
    parts.push({ id: 'earL', art: 'av.hedgehog.ear', parent: 'head', x: -32, y: -68, z: -1 });
    parts.push({ id: 'earR', art: 'av.hedgehog.ear', parent: 'head', x: 32, y: -68, z: -1 });
    ears.push('earL', 'earR');
    mouth = [0, -12];
  } else if (sp === 'mouse') {
    parts.push({ id: 'earL', art: 'av.mouse.ear', parent: 'head', x: -36, y: -62, z: -1, rot: -14 });
    parts.push({ id: 'earR', art: 'av.mouse.ear', parent: 'head', x: 36, y: -62, z: -1, rot: 14 });
    parts.push({ id: 'tail', art: 'av.mouse.tail', parent: 'body', x: -30, y: -10, z: -1 });
    ears.push('earL', 'earR');
    tail = 'tail';
    mouth = [0, -11];
  } else {
    eyes = [
      [-24, -78],
      [24, -78],
    ];
    brows = [
      [-24, -98],
      [24, -98],
    ];
    mouth = [0, -22];
    hatY = -92;
  }
  return {
    id: `avatar-${sp}`,
    parts,
    face: {
      head: 'head',
      eyes,
      eyeScale: sp === 'frog' ? 0.95 : 1,
      brows,
      mouth,
      blush: [
        [-30, -26],
        [30, -26],
      ],
    },
    anchors: { hat: { part: 'head', x: 0, y: hatY, scale: 0.95 }, hand: { part: 'armFront', x: 0, y: 37 }, emote: [46, -220] },
    limbs: { armFront: 'armFront', armBack: 'armBack', footFront: 'footFront', footBack: 'footBack', tail, ears },
    height: 195,
    width: 104,
    gait: 'walk',
    voice: { pitch: 360, spread: 120, len: 0.075, wave: 'triangle' },
  };
}
