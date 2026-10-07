import { WWScene } from '../WWScene';
import { services } from '../../app/services';

/** Temporary minimal clubhouse (full version below in this milestone). */
export default class ClubhouseScene extends WWScene {
  readonly artGroup = 'clubhouse';
  constructor() {
    super('clubhouse');
  }
  artKeys(): string[] {
    return [];
  }
  build(): void {
    services.hud.show(['home', 'finish', 'pause']);
  }
}
