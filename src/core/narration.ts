/**
 * Narration and spoken lines.
 *
 * Privacy rule: browser speech is used ONLY when the browser reports a voice
 * with `localService === true` (on-device). Cloud voices are never selected, so
 * narration can't quietly send text to a server. Without a local voice, lines
 * play as character babble + captions, and instructions rely on demonstrations.
 */

export interface SpeakOpts {
  pitch?: number;
  rate?: number;
}

class Narration {
  voice: SpeechSynthesisVoice | null = null;
  enabled = true;
  private ready = false;

  init(): void {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const pick = () => {
      const voices = window.speechSynthesis.getVoices();
      const local = voices.filter((v) => v.localService);
      const en = local.filter((v) => v.lang?.toLowerCase().startsWith('en'));
      const preferred = ['samantha', 'karen', 'moira', 'tessa', 'daniel', 'serena', 'martha', 'microsoft aria', 'microsoft jenny', 'microsoft zira'];
      const byName = en.find((v) => preferred.some((p) => v.name.toLowerCase().includes(p)));
      this.voice = byName ?? en.find((v) => v.lang === 'en-US') ?? en[0] ?? null;
      this.ready = true;
    };
    pick();
    window.speechSynthesis.addEventListener?.('voiceschanged', pick);
  }

  /** True when a local on-device voice is available and narration is switched on. */
  get available(): boolean {
    return this.enabled && !!this.voice;
  }

  get voiceName(): string | null {
    return this.ready ? (this.voice?.name ?? null) : null;
  }

  /** Speak text with the local voice. Resolves when finished (or immediately if unavailable). */
  speak(text: string, opts: SpeakOpts = {}): Promise<void> {
    if (!this.available || !this.voice) return Promise.resolve();
    this.cancel();
    return new Promise((resolve) => {
      const u = new SpeechSynthesisUtterance(text);
      u.voice = this.voice;
      u.lang = this.voice!.lang;
      u.pitch = Math.max(0.1, Math.min(2, opts.pitch ?? 1.1));
      u.rate = Math.max(0.5, Math.min(1.5, (opts.rate ?? 1) * 0.95));
      u.volume = 1;
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        clearTimeout(guard);
        resolve();
      };
      // some browsers drop the end event; never hang the game on it
      const guard = setTimeout(finish, 2500 + text.length * 90);
      u.onend = finish;
      u.onerror = finish;
      window.speechSynthesis.speak(u);
    });
  }

  cancel(): void {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel();
  }

  pause(): void {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel();
  }
}

export const narration = new Narration();
