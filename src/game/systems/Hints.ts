import type Phaser from 'phaser';
import type { PresetId } from '../../save/schema';
import { services } from '../../app/services';
import { isSpeaking, onInstruction, replayInstruction } from '../../app/speech';

/**
 * Idle hints: when nothing has been tapped for a while, the instruction is
 * said again and the hand shows where to tap. "More help" waits 8 s,
 * "More exploring" 15 s. They back off (and stop after three) so they never
 * nag, and never talk over someone who is already speaking.
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
    /** e.g. not during a cutscene */
    private canHint: () => boolean = () => true,
  ) {
    this.waitMs = preset === 'more-help' ? 8000 : 15000;
    this.auto = true;
    // every new step starts with a fresh set of hints
    const off = onInstruction(() => this.step());
    scene.events.once('shutdown', off);
    this.poke();
  }

  /** A new step began: hints count from zero again. */
  step(): void {
    this.shown = 0;
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
    if (isSpeaking() || services.choices?.open || !this.canHint()) {
      // someone is talking or a choice is open: check again shortly, without counting it
      this.timer = this.scene.time.delayedCall(2500, () => this.fire());
      return;
    }
    this.shown++;
    if (this.auto && this.shown <= 3) replayInstruction(this.demo);
    this.poke();
    services.hud?.glow('help', true);
  }

  /** The child pressed help: say it again and show it now. */
  request(): void {
    services.hud?.glow('help', false);
    replayInstruction(this.demo);
    this.timer?.remove();
    this.poke();
  }

  stop(): void {
    this.enabled = false;
    this.timer?.remove();
    services.hud?.glow('help', false);
  }
}
