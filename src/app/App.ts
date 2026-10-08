import { services, currentProfile } from './services';
import { SessionTimer } from './session';
import { say, replayInstruction, stopSpeech, portraitFor } from './speech';
import { createLayers } from '../ui/shell';
import { Hud } from '../ui/hud';
import { Captions } from '../ui/captions';
import { Choices } from '../ui/choices';
import { iconDialog, toast } from '../ui/overlays';
import { h, clear, trapFocus } from '../ui/dom';
import { icon } from '../ui/icons';
import { showLoading, hideLoading, lanternSvg } from '../ui/loading';
import { profileScreen } from '../ui/screens/profiles';
import { setupScreen } from '../ui/screens/setup';
import { avatarPicker } from '../ui/screens/avatarPicker';
import { closingScreen, restScreen } from '../ui/screens/closing';
import { openAdultArea } from '../ui/adult/AdultArea';
import { askGate } from '../ui/adult/gate';
import { openBestBackend } from '../save/backends';
import { SaveManager } from '../save/SaveManager';
import { requestPersistentStorage } from '../save/persist';
import type { DeviceSettings, Profile } from '../save/schema';
import { audio } from '../core/audio';
import { narration } from '../core/narration';
import { motion } from '../core/motion';
import { registerAllArt } from '../art';
import { createGame, startScene, activeSceneKey } from '../game/createGame';
import type { WWScene } from '../game/WWScene';
import { SPECIES } from '../save/schema';
import { exposeForTests } from '../dev/testHooks';

/**
 * The app shell: boot, profile choice, routing between scenes, HUD actions,
 * pause, the finish flow, reminders, and the grown-up area.
 */
export class App {
  private timer: SessionTimer | null = null;
  private ticker: ReturnType<typeof setInterval> | null = null;
  private paused = false;
  private pauseOverlay: HTMLElement | null = null;
  private reminderOpen = false;

  async boot(): Promise<void> {
    registerAllArt();
    const uiRoot = document.getElementById('ui-root')!;
    const layers = createLayers(uiRoot);
    showLoading();
    const backend = await openBestBackend();
    const save = new SaveManager(backend);
    await save.init();
    audio.install();
    narration.init();
    const hud = new Hud(layers.hud, {
      home: () => void this.homePressed(),
      finish: () => void this.finish(),
      pause: () => this.pause(),
      replay: () => replayInstruction(),
      help: () => this.activeScene()?.hint(),
    });
    const captions = new Captions(layers.captions);
    captions.onReplay = () => replayInstruction();
    const choices = new Choices(layers.choices);
    const game = createGame(document.getElementById('game-root')!);
    Object.assign(services, {
      save,
      layers,
      hud,
      captions,
      choices,
      game,
      profileId: null,
      nav: {
        goTo: (scene: string, data?: Record<string, unknown>) => void this.goTo(scene, data),
        finish: () => void this.finish(),
        openMap: () => void this.goTo('map'),
      },
      session: { made: [], startedAt: Date.now() },
    });
    this.applyDevice(save.device);
    save.onStatus((s) => {
      if (s.quotaFull) toast(layers.toast, 'gear', 'Saving needs a grown-up (see the gear).', 4000);
    });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        void save.flush();
        this.timer?.pause();
        narration.cancel();
      } else if (!this.paused) this.timer?.resume();
    });
    window.addEventListener('pagehide', () => void save.flush());
    await new Promise<void>((r) => (game.isBooted ? r() : game.events.once('ready', () => r())));
    hideLoading();
    exposeForTests('app', {
      profile: () => (services.profileId ? currentProfile() : null),
      flush: () => save.flush(),
      status: () => save.status,
      activeScene: () => activeSceneKey(game),
      paused: () => {
        const k = activeSceneKey(game);
        return k ? game.scene.getScene(k).sys.isPaused() : null;
      },
      audioState: () => audio.ctx?.state ?? 'none',
      textureCount: () => game.textures.getTextureKeys().length,
      // e2e-only: jump straight to a place (skips story order so each adventure can be tested on its own)
      goTo: (key: string) => services.nav.goTo(key),
      // e2e-only: a reminder measured in seconds instead of minutes
      testReminder: (seconds: number, grace: 0 | 2 | 5) => {
        this.endSession();
        this.timer = new SessionTimer({ minutes: seconds / 60, grace: grace ? 0.05 : 0 });
        this.ticker = setInterval(() => {
          const ev = this.timer?.tick();
          if (ev === 'remind') void this.showReminder(false);
          if (ev === 'graceOver') void this.showReminder(true);
        }, 250);
      },
    });
    this.showStart();
  }

  // ---------------------------------------------------------------- device settings

  applyDevice(d: DeviceSettings): void {
    audio.setVolumes(d.volume, d.muted, d.quiet);
    motion.set(d.motion);
    document.documentElement.classList.toggle('motion-full', d.motion === 'full');
    services.captions.showText = d.captions;
    narration.enabled = d.narration === 'auto';
  }

  private activeScene(): WWScene | null {
    const key = activeSceneKey(services.game);
    return key ? (services.game.scene.getScene(key) as WWScene) : null;
  }

  // ---------------------------------------------------------------- start / profiles

  private clearScreens(): void {
    clear(services.layers.screens);
  }

  private async stopGame(): Promise<void> {
    const key = activeSceneKey(services.game);
    if (key) services.game.scene.stop(key);
    services.hud.show([]);
    services.choices.cancel();
    stopSpeech();
    audio.stopAll();
  }

  showStart(): void {
    void this.stopGame();
    this.endSession();
    this.clearScreens();
    services.profileId = null;
    const save = services.save;
    const profiles = save.listProfiles();
    if (!profiles.length && !save.device.setupDone) {
      setupScreen(
        services.layers.screens,
        (r) => {
          r.players.forEach((pl, i) =>
            save.createProfile({ nickname: pl.nickname, preset: pl.preset, avatar: { species: SPECIES[i % SPECIES.length], color: ['sun', 'sea', 'leaf', 'plum'][i % 4], hat: null } }),
          );
          save.updateDevice((d) => (d.setupDone = true));
          void save.flush();
          // a grown-up is here, so it's fine if the browser asks
          void requestPersistentStorage();
          this.showStart();
        },
        () => this.openAdult(),
      );
      return;
    }
    if (!profiles.length) {
      save.createProfile({ nickname: '', preset: 'more-help', avatar: { species: 'fox', color: 'sun', hat: null } });
      this.showStart();
      return;
    }
    audio.startMusic('hub');
    profileScreen(services.layers.screens, profiles, (id) => void this.pickProfile(id), () => this.openAdult());
  }

  private async pickProfile(id: string): Promise<void> {
    const save = services.save;
    services.profileId = id;
    save.updateDevice((d) => (d.lastProfileId = id));
    services.session = { made: [], startedAt: Date.now() };
    const p = currentProfile();
    this.startSession(p);
    this.clearScreens();
    if (!p.progress.done.avatar) {
      avatarPicker(
        services.layers.screens,
        p.avatar,
        (look) => {
          save.updateProfile(id, (x) => {
            x.avatar = look;
            x.progress.done.avatar = 1;
          });
          void save.flush();
          this.clearScreens();
          void this.enterWorld();
        },
        (text) => void say('narrator', text),
      );
      return;
    }
    await this.enterWorld();
  }

  private async enterWorld(): Promise<void> {
    const p = currentProfile();
    if (!p.progress.onboarded) return this.goTo('windmill-kite');
    const loc = p.progress.location.scene;
    return this.goTo(loc && loc !== 'idle' ? loc : 'map');
  }

  async goTo(scene: string, data: Record<string, unknown> = {}): Promise<void> {
    if (!services.profileId) return;
    this.closePause();
    this.clearScreens();
    services.choices.cancel();
    stopSpeech();
    audio.setPaused(false);
    audio.setWind(0);
    services.hud.setExtras([], []);
    services.hud.setTurnBadge(null);
    this.paused = false;
    try {
      await startScene(services.game, scene, data);
    } catch (e) {
      console.error(e);
      if (scene !== 'map') await startScene(services.game, 'map');
    }
  }

  private async homePressed(): Promise<void> {
    const key = activeSceneKey(services.game);
    if (key === 'map') return;
    this.activeScenePause(true);
    const pick = await iconDialog(services.layers.overlay, {
      buttons: [
        { id: 'stay', icon: 'play', label: 'Keep playing', kind: 'go' },
        { id: 'map', icon: 'map', label: 'Go to the map', kind: 'primary' },
      ],
      safeId: 'stay',
    });
    this.activeScenePause(false);
    if (pick === 'map') {
      await services.save.flush();
      void this.goTo('map');
    }
  }

  private activeScenePause(on: boolean): void {
    const key = activeSceneKey(services.game);
    if (!key) return;
    if (on) {
      services.game.scene.pause(key);
      this.activeScene()?.onPause();
    } else {
      services.game.scene.resume(key);
      this.activeScene()?.onResume();
    }
  }

  // ---------------------------------------------------------------- pause

  pause(): void {
    if (this.paused) return;
    this.paused = true;
    this.activeScenePause(true);
    audio.setPaused(true);
    narration.cancel();
    this.timer?.pause();
    void services.save.flush();
    const muted = services.save.device.muted;
    const tile = (id: string, ic: string, label: string, fn: () => void, extra = '') =>
      h('button', { class: `tile ${extra}`, type: 'button', 'data-pause': id, on: { click: fn } }, h('span', { html: icon(ic, 96) }), h('span', {}, label));
    const panel = h(
      'div',
      { class: 'panel', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Paused' },
      h('div', { html: lanternSvg, style: 'width:70px;height:86px;margin:0 auto 8px' }),
      h(
        'div',
        { class: 'big-choices' },
        tile('resume', 'play', 'Keep playing', () => this.resume(), 'go'),
        tile('map', 'map', 'Map', () => {
          this.closePause();
          void this.goTo('map');
        }),
        tile('finish', 'moon', 'Save and finish', () => {
          this.closePause();
          void this.finish();
        }),
      ),
      h(
        'div',
        { class: 'row', style: 'margin-top:18px' },
        h('button', {
          class: 'btn small',
          type: 'button',
          'aria-label': muted ? 'Sound on' : 'Sound off',
          html: icon(muted ? 'mute' : 'speaker'),
          on: {
            click: (e) => {
              services.save.updateDevice((d) => (d.muted = !d.muted));
              this.applyDevice(services.save.device);
              (e.currentTarget as HTMLElement).innerHTML = icon(services.save.device.muted ? 'mute' : 'speaker');
            },
          },
        }),
        h('button', {
          class: 'btn small',
          type: 'button',
          'aria-label': 'Grown-ups',
          html: icon('gear'),
          on: { click: () => void askGate().then((ok) => ok && this.openAdult()) },
        }),
      ),
    );
    const overlay = h('div', { class: 'overlay', on: { keydown: (e) => (e as KeyboardEvent).key === 'Escape' && this.resume() } }, panel);
    services.layers.overlay.append(overlay);
    this.pauseOverlay = overlay;
    const release = trapFocus(panel);
    overlay.addEventListener('remove-trap', release);
  }

  private closePause(): void {
    if (this.pauseOverlay) {
      this.pauseOverlay.dispatchEvent(new Event('remove-trap'));
      this.pauseOverlay.remove();
      this.pauseOverlay = null;
    }
  }

  resume(): void {
    this.closePause();
    if (!this.paused) return;
    this.paused = false;
    audio.setPaused(false);
    this.activeScenePause(false);
    this.timer?.resume();
  }

  // ---------------------------------------------------------------- finish

  async finish(): Promise<void> {
    if (!services.profileId) return;
    const key = activeSceneKey(services.game);
    if (key) services.game.scene.pause(key);
    services.choices.cancel();
    stopSpeech();
    this.closePause();
    this.reminderOpen = false;
    clear(services.layers.overlay);
    await services.save.flush();
    services.hud.show([]);
    audio.stopAll();
    audio.setPaused(false);
    audio.play('glow');
    this.endSession();
    const made = services.session.made;
    this.clearScreens();
    closingScreen(services.layers.screens, made, portraitFor('avatar', 'happy'), () => {
      this.clearScreens();
      void this.stopGame();
      services.profileId = null;
      restScreen(services.layers.screens, () => this.showStart());
    });
    void say('narrator', made.length ? 'Look what you made today! It’s all saved.' : 'Good playing today. It’s all saved.');
  }

  // ---------------------------------------------------------------- reminders

  private startSession(p: Profile): void {
    this.endSession();
    const r = p.settings.reminder;
    if (r.minutes <= 0) return;
    this.timer = new SessionTimer({ minutes: r.minutes, grace: r.grace });
    this.ticker = setInterval(() => {
      if (!this.timer) return;
      const ev = this.timer.tick();
      if (ev === 'remind') void this.showReminder(false);
      if (ev === 'graceOver') void this.showReminder(true);
    }, 1000);
  }

  private endSession(): void {
    if (this.ticker) clearInterval(this.ticker);
    this.ticker = null;
    this.timer = null;
  }

  private async showReminder(final: boolean): Promise<void> {
    if (this.reminderOpen) return;
    this.reminderOpen = true;
    this.activeScenePause(true);
    audio.play('glow');
    void say('narrator', final ? 'Time to finish now. Your things are saved.' : 'It’s nearly time to finish.');
    const buttons = [{ id: 'finish', icon: 'moon', label: 'Save and finish', kind: 'primary' as const }];
    if (!final && this.timer?.graceAllowed) buttons.push({ id: 'grace', icon: 'turn', label: 'Finish this part', kind: 'primary' as const });
    const pick = await iconDialog(services.layers.overlay, { art: lanternSvg, buttons, safeId: 'finish' });
    this.reminderOpen = false;
    if (pick === 'grace' && this.timer?.startGrace()) {
      this.activeScenePause(false);
      toast(services.layers.toast, 'turn', 'A few more minutes', 3000);
      return;
    }
    void this.finish();
  }

  // ---------------------------------------------------------------- grown-ups

  openAdult(): void {
    const key = activeSceneKey(services.game);
    if (key) services.game.scene.pause(key);
    this.timer?.pause();
    openAdultArea(services.layers.overlay, {
      onClose: () => {
        this.applyDevice(services.save.device);
        if (!services.profileId) this.showStart();
        else if (!this.paused && key) {
          services.game.scene.resume(key);
          this.timer?.resume();
        }
      },
      onDataReplaced: () => {
        services.profileId = null;
      },
      onSettingsChanged: () => this.applyDevice(services.save.device),
      onAddPlayer: () => {
        const n = services.save.listProfiles().length;
        services.save.createProfile({ nickname: '', preset: 'more-help', avatar: { species: SPECIES[n % SPECIES.length], color: 'berry', hat: null } });
        void services.save.flush();
      },
    });
  }
}
