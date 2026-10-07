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
  { name: 'Tinker Grove (building)', status: 'ready', note: 'Four challenges plus free build; 12 saved inventions per player.' },
  { name: 'Picnic Parade (cooking & serving)', status: 'ready', note: 'Three picnics (windy, music, lantern), four food stations, optional play-together mode; 12 saved picnic photos per player.' },
  { name: 'Story Stage (puppet theatre)', status: 'partial', note: 'Being built: backdrops, puppets, props, acting it out and replaying work; the clubhouse poster is not done yet. Recordings store stage events only (no microphone or camera).' },
  { name: 'Clubhouse displays', status: 'partial', note: 'Shows the kite tail, secret souvenirs, a working invention, and the snacks from a saved picnic; the story poster arrives with Story Stage.' },
  { name: 'Narration', status: 'partial', note: 'Uses an on-device computer voice only if your browser has one; otherwise captions and demonstrations. No recorded voice acting yet.' },
  { name: 'Offline play', status: 'not yet', note: 'Saves are local, but the game files themselves are not cached for offline use.' },
];
