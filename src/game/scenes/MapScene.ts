import Phaser from 'phaser';
import { WWScene } from '../WWScene';
import { Puppet } from '../rig/Puppet';
import { GhostHand } from '../systems/GhostHand';
import { Hints } from '../systems/Hints';
import { sparkle } from '../systems/fx';
import { addArt, addImage } from '../../art/rasterize';
import { registerPieces, pieceSvg } from '../../art/registry';
import { MAP_PIECES, MAP_PLACES, MAP_ICON, type MapPlace } from '../../art/scenes/map';
import { avatarRig, rigArtKeys } from '../../art/cast';
import { HATS } from '../../art/cast/hats';
import { PLACES, placeState, type PlaceInfo } from '../../content/places';
import { services, currentProfile, updateProfile } from '../../app/services';
import { say, instruct, stopSpeech } from '../../app/speech';
import { audio } from '../../core/audio';
import { motion } from '../../core/motion';
import { h } from '../../ui/dom';

registerPieces(MAP_PIECES);

/** The scenic map: one tap travels anywhere. Also offers an accessible quick-jump row. */
export default class MapScene extends WWScene {
  readonly artGroup = 'map';
  private token!: Puppet;
  private hand!: GhostHand;
  private hints!: Hints;
  private marks = new Map<MapPlace, Phaser.GameObjects.Image>();
  private travelling = false;
  private tray?: HTMLElement;

  constructor() {
    super('map');
  }

  artKeys(): string[] {
    const p = currentProfile();
    const keys = new Set<string>(MAP_PIECES.map((x) => x.key));
    for (const k of rigArtKeys(avatarRig(p.avatar.species, p.avatar.color))) keys.add(k);
    for (const h of HATS) keys.add(h.id);
    for (const k of ['fx.hand', 'fx.tapring', 'fx.spark', 'emote.zzz', 'emote.sparkle']) keys.add(k);
    return [...keys];
  }

  build(): void {
    this.travelling = false;
    const prof = currentProfile();
    addArt(this, 0, 0, 'map.bg').setDepth(0);
    for (const place of PLACES) {
      const pos = MAP_PLACES[place.id];
      const state = placeState(prof, place);
      const img = addImage(this, pos.x, pos.y + 60, MAP_ICON[place.id]).setDepth(10 + pos.y / 100);
      if (state !== 'open') img.setAlpha(state === 'later' ? 0.55 : 0.8);
      if (state === 'building') addImage(this, pos.x + 70, pos.y + 70, 'map.building').setDepth(11 + pos.y / 100).setScale(0.8);
      if (state === 'open' && !motion.reduced) this.tweens.add({ targets: img, y: img.y - 6, duration: 1400 + (pos.x % 400), yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      const q = prof.progress.quests[place.id];
      if (q?.status === 'done') addImage(this, pos.x - 70, pos.y - 110, 'map.star').setDepth(20);
      this.marks.set(place.id, img);
      this.addTarget({
        id: `place-${place.id}`,
        label: place.label,
        bounds: () => this.rectAround(pos.x, pos.y - 30, 230, 200, 10),
        activate: () => void this.travel(place),
      });
    }
    const loc = (prof.progress.location.data?.place as MapPlace | undefined) ?? 'clubhouse';
    const start = MAP_PLACES[loc] ?? MAP_PLACES.clubhouse;
    this.token = new Puppet(this, start.x + 40, start.y + 90, avatarRig(prof.avatar.species, prof.avatar.color), { hat: prof.avatar.hat, seed: 5 });
    this.token.setScale(0.62).setDepth(40);
    this.hand = new GhostHand(this);
    this.hints = new Hints(this, prof.settings.preset, () => this.demo());
    services.hud.show(['finish', 'pause', 'replay', 'help']);
    audio.startMusic('hub');
    updateProfile((p) => (p.progress.location = { scene: 'map', data: { place: loc } }));
    this.buildTray(prof);
    this.onCleanup(() => {
      this.tray?.remove();
      stopSpeech();
    });
    this.time.delayedCall(500, () => void instruct('narrator', 'Where shall we go? Tap a place on the map.', () => this.demo()));
  }

  private buildTray(prof: ReturnType<typeof currentProfile>): void {
    // accessible quick-jump: real buttons with pictures for every place
    this.tray = h(
      'nav',
      { class: 'choices quickjump', 'aria-label': 'Quick jump', style: 'gap:8px;top:max(16px, env(safe-area-inset-top));bottom:auto;width:auto;flex-wrap:nowrap;max-width:calc(100vw - 2 * var(--btn) - 120px)' },
      ...PLACES.map((pl) => {
        const st = placeState(prof, pl);
        return h(
          'button',
          {
            class: 'tile',
            type: 'button',
            'aria-label': `${pl.label}${st === 'building' ? ' (being built)' : st === 'later' ? ' (opens later in the story)' : ''}`,
            title: pl.label,
            'data-jump': pl.id,
            style: `width:72px;min-height:72px;padding:3px;border-radius:20px;${st !== 'open' ? 'opacity:.55' : ''}`,
            on: { click: () => void this.travel(pl) },
          },
          h('span', { html: pieceSvg(MAP_ICON[pl.id]), style: 'width:58px;height:58px;display:block' }),
        );
      }),
    );
    services.layers.choices.append(this.tray);
  }

  private async travel(place: PlaceInfo): Promise<void> {
    if (this.travelling) return;
    this.hints.poke();
    const state = placeState(currentProfile(), place);
    const pos = MAP_PLACES[place.id];
    const mark = this.marks.get(place.id);
    if (mark) this.tweens.add({ targets: mark, scale: 1.12, duration: 120, yoyo: true });
    if (state === 'building') {
      audio.play('bonk', { pitch: 1.4 });
      this.token.emote('question', 1600);
      void say('narrator', `Rowan is still building ${place.label}. It isn’t ready yet.`);
      return;
    }
    if (state === 'later') {
      audio.play('bonk', { pitch: 1.2 });
      this.token.emote('zzz', 1600);
      void say('narrator', 'This path opens later in the story.');
      return;
    }
    this.travelling = true;
    audio.play('confirm');
    sparkle(this, pos.x, pos.y, 10, 50);
    this.token.faceToward(pos.x);
    this.token.startGait(1.4);
    await new Promise<void>((r) =>
      this.tweens.add({ targets: this.token, x: pos.x + 40, y: pos.y + 90, duration: motion.reduced ? 150 : 650, ease: 'Sine.easeInOut', onComplete: () => r() }),
    );
    this.token.stopGait();
    updateProfile((p) => (p.progress.location = { scene: 'map', data: { place: place.id } }));
    services.nav.goTo(place.scene);
  }

  private demo(): void {
    const prof = currentProfile();
    const next =
      PLACES.find((p) => p.requires !== undefined || p.id === 'windmill-kite' ? placeState(prof, p) === 'open' && prof.progress.quests[p.id]?.status !== 'done' : false) ??
      PLACES.find((p) => p.id === 'clubhouse')!;
    const pos = MAP_PLACES[next.id];
    void this.hand.tapAt(pos.x, pos.y, 2);
  }

  override hint(): void {
    this.hints.request();
  }

  override inspect(): Record<string, unknown> {
    return { travelling: this.travelling };
  }
}
