import type { Profile } from '../save/schema';
import type { MapPlace } from '../art/scenes/map';

/** Where each map destination leads and whether it is open. */
export interface PlaceInfo {
  id: MapPlace;
  scene: string;
  label: string;
  /** built in this version? (honest: unbuilt places show a "being built" sign) */
  built: boolean;
  /** story order for the Lantern Trail; other games are always open */
  requires?: string;
}

export const PLACES: PlaceInfo[] = [
  { id: 'clubhouse', scene: 'clubhouse', label: 'Clubhouse', built: true },
  { id: 'windmill-kite', scene: 'windmill-kite', label: 'Windmill Hill', built: true },
  { id: 'picnic-bridge', scene: 'picnic-bridge', label: 'Picnic Bridge', built: false, requires: 'windmill-kite' },
  { id: 'waterwheel', scene: 'waterwheel', label: 'Waterwheel', built: false, requires: 'picnic-bridge' },
  { id: 'lantern-launch', scene: 'lantern-launch', label: 'Festival Glade', built: false, requires: 'waterwheel' },
  { id: 'tinker', scene: 'tinker', label: 'Tinker Grove', built: true },
  { id: 'picnic', scene: 'picnic', label: 'Picnic Meadow', built: false },
  { id: 'stage', scene: 'stage', label: 'Puppet Theatre', built: false },
];

export function placeState(p: Profile, place: PlaceInfo): 'open' | 'building' | 'later' {
  if (!place.built) return 'building';
  if (place.requires && p.progress.quests[place.requires]?.status !== 'done') return 'later';
  return 'open';
}
