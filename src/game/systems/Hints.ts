import type Phaser from 'phaser';
import type { PresetId } from '../../save/schema';
import { services } from '../../app/services';

/**
 * Idle hints. "More help" offers a demonstration sooner and runs it
 * automatically; "More exploring" waits longer and only lights the help
 * button. Hints back off so they never nag.
 */
export class Hints {
  private timer?: Phaser.Time.TimerEvent;
  private waitMs: number;
  private auto: boolean;
  private shown = 0;
  enabled = true;

  constructor(
    private scene: Phaser.Scene,
    preset: PresetId,
    private demo: () => void,
  ) {
    this.waitMs = preset === 'more-help' ? 12000 : 30000;
    this.auto = preset === 'more-help';
    this.poke();
  }

  /** Call on any meaningful child action. */
  poke(): void {
    services.hud?.glow('help', false);
    this.timer?.remove();
    if (!this.enabled) return;
    const wait = this.waitMs * Math.min(4, 1 + this.shown * 0.75);
    this.timer = this.scene.time.delayedCall(wait, () => this.fire());
  }

  private fire(): void {
    if (!this.enabled) return;
    this.shown++;
    services.hud?.glow('help', true);
    if (this.auto && this.shown <= 3) this.demo();
    this.poke();
    services.hud?.glow('help', true);
  }

  /** The child pressed help: show the demo now. */
  request(): void {
    services.hud?.glow('help', false);
    this.demo();
    this.timer?.remove();
    this.poke();
  }

  stop(): void {
    this.enabled = false;
    this.timer?.remove();
    services.hud?.glow('help', false);
  }
}
