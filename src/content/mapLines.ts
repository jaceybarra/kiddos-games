import type { Line } from './lineTypes';
import type { MapPlace } from '../art/scenes/map';

/** On arriving at the map: name the next place to go, and why it's fun. */
export const MAP_INVITE: Partial<Record<MapPlace, Line>> = {
  'windmill-kite': { speaker: 'narrator', text: 'Tap the windmill! Let’s fly a kite!' },
  'picnic-bridge': { speaker: 'narrator', text: 'Tap the bridge! Let’s help everyone get across!' },
  waterwheel: { speaker: 'narrator', text: 'Tap the waterwheel! It has stopped turning!' },
  'lantern-launch': { speaker: 'narrator', text: 'Tap the festival! Let’s send up the big lantern!' },
};

export const MAP_LINES = {
  choose: { speaker: 'narrator', text: 'Where shall we go? Tap a place!' },
  asleep: { speaker: 'narrator', text: 'That one’s still asleep!' },
  building: { speaker: 'narrator', text: 'Rowan is still building that one!' },
} satisfies Record<string, Line>;
