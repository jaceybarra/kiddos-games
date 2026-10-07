/**
 * Caregiver session reminders (pure logic, unit-tested).
 *
 * Counts only active play time (pauses and hidden tabs don't count). When the
 * limit is reached a reminder appears with an immediate stop option. If the
 * caregiver allowed a grace period, the child can finish the current part —
 * once, for a fixed number of minutes. There is no snooze and no chaining.
 */
export type SessionPhase = 'off' | 'running' | 'reminded' | 'grace' | 'over';

export interface SessionOpts {
  minutes: number;
  grace: 0 | 2 | 5;
  now?: () => number;
}

export class SessionTimer {
  phase: SessionPhase;
  private activeMs = 0;
  private lastTick: number | null = null;
  private paused = false;
  private graceEndsAt = 0;
  private readonly now: () => number;

  constructor(private opts: SessionOpts) {
    this.now = opts.now ?? (() => Date.now());
    this.phase = opts.minutes > 0 ? 'running' : 'off';
    this.lastTick = this.now();
  }

  get limitMs(): number {
    return this.opts.minutes * 60_000;
  }

  get elapsedMs(): number {
    return this.activeMs;
  }

  get graceAllowed(): boolean {
    return this.opts.grace > 0;
  }

  get graceRemainingMs(): number {
    return this.phase === 'grace' ? Math.max(0, this.graceEndsAt - this.activeMs) : 0;
  }

  pause(): void {
    this.accumulate();
    this.paused = true;
  }

  resume(): void {
    this.lastTick = this.now();
    this.paused = false;
  }

  private accumulate(): void {
    const t = this.now();
    if (!this.paused && this.lastTick !== null) this.activeMs += Math.max(0, Math.min(t - this.lastTick, 5_000));
    this.lastTick = t;
  }

  /** Advance time; returns an event when something should be shown. */
  tick(): 'remind' | 'graceOver' | null {
    this.accumulate();
    if (this.phase === 'running' && this.activeMs >= this.limitMs) {
      this.phase = 'reminded';
      return 'remind';
    }
    if (this.phase === 'grace' && this.activeMs >= this.graceEndsAt) {
      this.phase = 'over';
      return 'graceOver';
    }
    return null;
  }

  /** "Finish this part" — only once, only if allowed. */
  startGrace(): boolean {
    if (this.phase !== 'reminded' || !this.graceAllowed) return false;
    this.phase = 'grace';
    this.graceEndsAt = this.activeMs + this.opts.grace * 60_000;
    return true;
  }

  /** Child chose to stop. */
  end(): void {
    this.phase = 'over';
  }
}
