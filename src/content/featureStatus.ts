/**
 * Honest feature status shown in the grown-up area. Keep in sync with BUILD_STATUS.md.
 */
export interface FeatureStatus {
  name: string;
  status: 'ready' | 'partial' | 'not yet';
  note?: string;
}

export const FEATURES: FeatureStatus[] = [
  { name: 'Profiles, avatars, saving & resuming', status: 'ready' },
  { name: 'Lantern Trail: The Windmill Kite', status: 'ready' },
  { name: 'Lantern Trail: The Picnic Bridge', status: 'not yet' },
  { name: 'Lantern Trail: The Waterwheel Mix-Up', status: 'not yet' },
  { name: 'Lantern Trail: The Lantern Launch', status: 'not yet' },
  { name: 'Tinker Grove (building)', status: 'not yet' },
  { name: 'Picnic Parade (cooking & serving)', status: 'not yet' },
  { name: 'Story Stage (puppet theatre)', status: 'not yet' },
  { name: 'Clubhouse displays', status: 'partial', note: 'Shows souvenirs from finished adventures; more displays arrive with each game.' },
  { name: 'Narration', status: 'partial', note: 'Uses an on-device computer voice only if your browser has one; otherwise captions and demonstrations. No recorded voice acting yet.' },
  { name: 'Offline play', status: 'not yet', note: 'Saves are local, but the game files themselves are not cached for offline use.' },
];
