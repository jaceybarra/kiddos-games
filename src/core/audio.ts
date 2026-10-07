/**
 * All game audio is synthesised here with Web Audio — no audio files, no network.
 * Buses: master → { music, sfx, voice }. The context is created on the first
 * user gesture (autoplay rules) and suspended when the game is paused/hidden.
 */
import { mulberry32 } from './rng';

export type Sfx =
  | 'tap'
  | 'back'
  | 'confirm'
  | 'open'
  | 'close'
  | 'pickup'
  | 'place'
  | 'snap'
  | 'thud'
  | 'boing'
  | 'whoosh'
  | 'splash'
  | 'croak'
  | 'chirp'
  | 'squeak'
  | 'rustle'
  | 'creak'
  | 'whirr'
  | 'pop'
  | 'sparkle'
  | 'zip'
  | 'bonk'
  | 'step'
  | 'squish'
  | 'crunch'
  | 'pour'
  | 'flutter'
  | 'chime'
  | 'success'
  | 'oops'
  | 'swish'
  | 'clack'
  | 'ding'
  | 'tick'
  | 'puff'
  | 'wobble'
  | 'glow'
  | 'bellows'
  | 'stretch'
  | 'hint'
  | 'flap'
  | 'drum'
  | 'bell'
  | 'paper';

export type Theme = 'hub' | 'windmill' | 'tinker' | 'picnic' | 'stage' | 'festival' | 'stream' | 'calm';

export interface VoiceLike {
  pitch: number;
  spread: number;
  len: number;
  wave: OscillatorType;
}

interface PlayOpts {
  pitch?: number;
  vol?: number;
  pan?: number;
  /** semitone offset for tonal sounds (chime, bell) */
  note?: number;
  delay?: number;
}

const PENTA = [0, 2, 4, 7, 9];
const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

interface ThemeDef {
  bpm: number;
  beats: number;
  chords: number[][];
  root: number;
  arp: number[];
  inst: 'pluck' | 'bell' | 'uke';
  bell?: boolean;
  shaker?: boolean;
}

const THEMES: Record<Theme, ThemeDef> = {
  hub: { bpm: 80, beats: 4, root: 60, chords: [[0, 4, 7], [-3, 0, 4], [-7, -3, 0], [-5, -1, 2]], arp: [0, 1, 2, 1, 2, 1, 0, 2], inst: 'pluck' },
  windmill: { bpm: 92, beats: 4, root: 62, chords: [[0, 4, 7], [5, 9, 12], [7, 11, 14], [5, 9, 12]], arp: [0, 2, 1, 2, 0, 2, 1, 2], inst: 'pluck', bell: true },
  tinker: { bpm: 100, beats: 4, root: 60, chords: [[0, 4, 7], [2, 5, 9], [-1, 2, 7], [0, 4, 7]], arp: [0, 1, 2, 1, 0, 1, 2, 1], inst: 'pluck', shaker: true },
  picnic: { bpm: 108, beats: 4, root: 65, chords: [[0, 4, 7], [-3, 0, 4], [2, 5, 9], [-5, -1, 2]], arp: [0, 2, 1, 2, 0, 2, 1, 2], inst: 'uke', shaker: true },
  stage: { bpm: 96, beats: 3, root: 62, chords: [[0, 3, 7], [5, 8, 12], [-2, 2, 5], [-5, -1, 2]], arp: [0, 1, 2, 2, 1, 0], inst: 'bell' },
  festival: { bpm: 72, beats: 4, root: 60, chords: [[0, 4, 7], [-3, 0, 4], [5, 9, 12], [7, 11, 14]], arp: [0, 1, 2, 1, 0, 1, 2, 1], inst: 'pluck', bell: true },
  stream: { bpm: 84, beats: 4, root: 64, chords: [[0, 4, 7], [5, 9, 12], [-3, 0, 4], [7, 11, 14]], arp: [0, 2, 1, 2, 0, 1, 2, 1], inst: 'pluck' },
  calm: { bpm: 60, beats: 4, root: 60, chords: [[0, 4, 7], [-3, 0, 4], [-7, -3, 0], [-5, 0, 2]], arp: [0, 1, 2, 1], inst: 'bell' },
};

export class AudioEngine {
  ctx: AudioContext | null = null;
  private master!: GainNode;
  private musicBus!: GainNode;
  private sfxBus!: GainNode;
  private voiceBus!: GainNode;
  private duckGain!: GainNode;
  private noise!: AudioBuffer;
  private vols = { music: 0.5, sfx: 0.8, voice: 0.9 };
  private muted = false;
  quiet = false;
  private musicTheme: Theme | null = null;
  private musicTimer: ReturnType<typeof setInterval> | null = null;
  private nextNoteTime = 0;
  private step = 0;
  private wind: { src: AudioBufferSourceNode; gain: GainNode; filter: BiquadFilterNode; lfo: OscillatorNode } | null = null;
  private windLevel = 0;
  private pausedByGame = false;
  private hidden = false;
  private rng = mulberry32(7);
  private unlockHandler = () => this.unlock();

  /** Install the first-gesture unlock and visibility handling. */
  install(): void {
    for (const ev of ['pointerdown', 'keydown', 'touchend']) document.addEventListener(ev, this.unlockHandler, { capture: true, passive: true });
    document.addEventListener('visibilitychange', () => {
      this.hidden = document.visibilityState === 'hidden';
      this.applySuspend();
    });
  }

  get unlocked(): boolean {
    return !!this.ctx && this.ctx.state === 'running';
  }

  unlock(): void {
    try {
      if (!this.ctx) {
        const Ctor: typeof AudioContext | undefined = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctor) return;
        this.ctx = new Ctor({ latencyHint: 'interactive' });
        this.build();
      }
      if (this.ctx.state === 'suspended' && !this.pausedByGame && !this.hidden) void this.ctx.resume();
    } catch {
      /* audio unavailable: the game remains fully playable silently */
    }
  }

  private build(): void {
    const c = this.ctx!;
    this.master = c.createGain();
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    this.master.connect(comp).connect(c.destination);
    this.musicBus = c.createGain();
    this.duckGain = c.createGain();
    this.musicBus.connect(this.duckGain).connect(this.master);
    this.sfxBus = c.createGain();
    this.sfxBus.connect(this.master);
    this.voiceBus = c.createGain();
    this.voiceBus.connect(this.master);
    const len = c.sampleRate * 2;
    this.noise = c.createBuffer(1, len, c.sampleRate);
    const d = this.noise.getChannelData(0);
    const r = mulberry32(99);
    for (let i = 0; i < len; i++) d[i] = r() * 2 - 1;
    this.applyVolumes();
    if (this.musicTheme) this.startScheduler();
    if (this.windLevel > 0) this.setWind(this.windLevel);
  }

  setVolumes(v: { music: number; sfx: number; voice: number }, muted: boolean, quiet: boolean): void {
    this.vols = { ...v };
    this.muted = muted;
    this.quiet = quiet;
    this.applyVolumes();
  }

  private applyVolumes(): void {
    if (!this.ctx) return;
    const q = this.quiet ? 0.55 : 1;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.muted ? 0 : 0.9 * q, t, 0.05);
    this.musicBus.gain.setTargetAtTime(this.vols.music * 0.32 * (this.quiet ? 0.6 : 1), t, 0.1);
    this.sfxBus.gain.setTargetAtTime(this.vols.sfx * 0.8, t, 0.05);
    this.voiceBus.gain.setTargetAtTime(this.vols.voice * 0.7, t, 0.05);
  }

  /** Game pause / finish: silence everything until resumed. */
  setPaused(p: boolean): void {
    this.pausedByGame = p;
    this.applySuspend();
  }

  private applySuspend(): void {
    if (!this.ctx) return;
    if (this.pausedByGame || this.hidden) void this.ctx.suspend();
    else void this.ctx.resume();
  }

  /** Lower music while someone speaks. */
  duck(on: boolean): void {
    if (!this.ctx) return;
    this.duckGain.gain.setTargetAtTime(on ? 0.35 : 1, this.ctx.currentTime, 0.12);
  }

  // ---------------------------------------------------------------- primitives

  private env(g: GainNode, t: number, a: number, peak: number, dec: number): void {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec);
  }

  private tone(freq: number, t: number, dur: number, vol: number, wave: OscillatorType, out: AudioNode, opts: { a?: number; slide?: number; pan?: number } = {}): void {
    const c = this.ctx!;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = wave;
    o.frequency.setValueAtTime(freq, t);
    if (opts.slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * opts.slide), t + dur);
    this.env(g, t, opts.a ?? 0.005, vol, dur);
    let node: AudioNode = g;
    if (opts.pan) {
      const p = c.createStereoPanner();
      p.pan.value = opts.pan;
      g.connect(p);
      node = p;
    }
    o.connect(g);
    node.connect(out);
    o.start(t);
    o.stop(t + (opts.a ?? 0.005) + dur + 0.05);
  }

  private noiseBurst(t: number, dur: number, vol: number, type: BiquadFilterType, freq: number, q: number, out: AudioNode, opts: { a?: number; sweep?: number; pan?: number } = {}): void {
    const c = this.ctx!;
    const src = c.createBufferSource();
    src.buffer = this.noise;
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t);
    if (opts.sweep) f.frequency.exponentialRampToValueAtTime(Math.max(40, freq * opts.sweep), t + dur);
    f.Q.value = q;
    const g = c.createGain();
    this.env(g, t, opts.a ?? 0.003, vol, dur);
    src.connect(f).connect(g);
    let node: AudioNode = g;
    if (opts.pan) {
      const p = c.createStereoPanner();
      p.pan.value = opts.pan;
      g.connect(p);
      node = p;
    }
    node.connect(out);
    const off = this.rng() * 1.5;
    src.start(t, off, dur + 0.1);
  }

  // ---------------------------------------------------------------- sound effects

  play(name: Sfx, o: PlayOpts = {}): void {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const t = this.ctx.currentTime + 0.005 + (o.delay ?? 0);
    const p = o.pitch ?? 1;
    const v = (o.vol ?? 1) * (this.quiet ? 0.7 : 1);
    const out = this.sfxBus;
    const pan = o.pan;
    switch (name) {
      case 'tap':
        this.tone(900 * p, t, 0.06, 0.22 * v, 'triangle', out, { pan });
        this.noiseBurst(t, 0.03, 0.12 * v, 'bandpass', 2400 * p, 3, out, { pan });
        break;
      case 'back':
        this.tone(620 * p, t, 0.08, 0.2 * v, 'triangle', out, { slide: 0.7 });
        break;
      case 'confirm':
        this.tone(mtof(72) * p, t, 0.16, 0.2 * v, 'triangle', out);
        this.tone(mtof(79) * p, t + 0.08, 0.22, 0.2 * v, 'triangle', out);
        break;
      case 'open':
        this.tone(500 * p, t, 0.12, 0.16 * v, 'sine', out, { slide: 1.6 });
        break;
      case 'close':
        this.tone(700 * p, t, 0.12, 0.16 * v, 'sine', out, { slide: 0.6 });
        break;
      case 'pickup':
        this.tone(420 * p, t, 0.1, 0.22 * v, 'sine', out, { slide: 1.8, pan });
        break;
      case 'place':
      case 'clack':
        // wooden thunk: resonant body + click
        this.tone(220 * p, t, 0.12, 0.3 * v, 'sine', out, { slide: 0.8, pan });
        this.noiseBurst(t, 0.04, 0.25 * v, 'bandpass', 1800 * p, 4, out, { pan });
        break;
      case 'snap':
        this.noiseBurst(t, 0.035, 0.3 * v, 'highpass', 2500 * p, 1, out, { pan });
        this.tone(1200 * p, t, 0.04, 0.12 * v, 'square', out, { pan });
        break;
      case 'thud':
        this.tone(110 * p, t, 0.18, 0.4 * v, 'sine', out, { slide: 0.6, pan });
        this.noiseBurst(t, 0.08, 0.16 * v, 'lowpass', 600, 1, out, { pan });
        break;
      case 'boing':
        this.tone(180 * p, t, 0.35, 0.3 * v, 'sine', out, { slide: 2.6, pan });
        this.tone(360 * p, t + 0.02, 0.25, 0.08 * v, 'triangle', out, { slide: 2.2, pan });
        break;
      case 'whoosh':
        this.noiseBurst(t, 0.45, 0.22 * v, 'bandpass', 500 * p, 1.4, out, { a: 0.12, sweep: 4, pan });
        break;
      case 'swish':
        this.noiseBurst(t, 0.2, 0.16 * v, 'bandpass', 1500 * p, 2, out, { a: 0.04, sweep: 2.5, pan });
        break;
      case 'splash':
        this.noiseBurst(t, 0.35, 0.3 * v, 'lowpass', 2400 * p, 0.8, out, { sweep: 0.3, pan });
        for (let i = 0; i < 4; i++) this.tone((700 + this.rng() * 900) * p, t + 0.04 + i * 0.05, 0.06, 0.06 * v, 'sine', out, { slide: 1.6, pan });
        break;
      case 'croak':
        for (let i = 0; i < 2; i++) this.tone(140 * p, t + i * 0.16, 0.12, 0.22 * v, 'sawtooth', out, { slide: 0.85, pan });
        break;
      case 'chirp':
        for (let i = 0; i < 3; i++) this.tone((2200 + i * 300) * p, t + i * 0.09, 0.06, 0.08 * v, 'sine', out, { slide: 1.5, pan });
        break;
      case 'squeak':
        this.tone(1400 * p, t, 0.09, 0.12 * v, 'sine', out, { slide: 1.4, pan });
        break;
      case 'rustle':
        for (let i = 0; i < 4; i++) this.noiseBurst(t + i * 0.05, 0.08, 0.12 * v, 'bandpass', (3000 + this.rng() * 2000) * p, 1.5, out, { pan });
        break;
      case 'creak':
        this.tone(160 * p, t, 0.45, 0.12 * v, 'sawtooth', out, { slide: 1.3, a: 0.08, pan });
        break;
      case 'whirr':
        this.tone(90 * p, t, 0.6, 0.12 * v, 'sawtooth', out, { slide: 1.8, a: 0.1, pan });
        this.noiseBurst(t, 0.6, 0.08 * v, 'bandpass', 900 * p, 3, out, { a: 0.1, pan });
        break;
      case 'pop':
        this.tone(600 * p, t, 0.07, 0.25 * v, 'sine', out, { slide: 2.2, pan });
        break;
      case 'sparkle':
        [0, 4, 7, 12].forEach((s, i) => this.tone(mtof(84 + s) * p, t + i * 0.06, 0.25, 0.07 * v, 'sine', out, { pan }));
        break;
      case 'zip':
        this.tone(300 * p, t, 0.18, 0.12 * v, 'triangle', out, { slide: 3, pan });
        break;
      case 'bonk':
        this.tone(300 * p, t, 0.12, 0.25 * v, 'triangle', out, { slide: 0.6, pan });
        break;
      case 'step':
        this.noiseBurst(t, 0.05, 0.08 * v, 'lowpass', 900 * p, 1, out, { pan });
        break;
      case 'squish':
        this.noiseBurst(t, 0.18, 0.2 * v, 'bandpass', 700 * p, 4, out, { sweep: 0.5, pan });
        this.tone(200 * p, t, 0.14, 0.12 * v, 'sine', out, { slide: 0.6, pan });
        break;
      case 'crunch':
        for (let i = 0; i < 3; i++) this.noiseBurst(t + i * 0.035, 0.04, 0.2 * v, 'highpass', 1800 * p, 1, out, { pan });
        break;
      case 'pour':
        this.noiseBurst(t, 0.6, 0.12 * v, 'bandpass', 900 * p, 6, out, { a: 0.05, sweep: 1.6, pan });
        break;
      case 'flutter':
      case 'paper':
        for (let i = 0; i < 5; i++) this.noiseBurst(t + i * 0.045, 0.04, 0.1 * v, 'bandpass', 2200 * p, 2, out, { pan });
        break;
      case 'flap':
        this.noiseBurst(t, 0.12, 0.14 * v, 'bandpass', 700 * p, 1.5, out, { pan });
        break;
      case 'chime': {
        const n = o.note ?? 0;
        const deg = PENTA[((n % 5) + 5) % 5] + 12 * Math.floor(n / 5);
        const f = mtof(76 + deg) * p;
        this.tone(f, t, 1.2, 0.18 * v, 'sine', out, { pan });
        this.tone(f * 2.76, t, 0.4, 0.04 * v, 'sine', out, { pan });
        break;
      }
      case 'bell': {
        const f = mtof(72 + (o.note ?? 0)) * p;
        this.tone(f, t, 0.9, 0.14 * v, 'sine', out, { pan });
        this.tone(f * 2.4, t, 0.3, 0.05 * v, 'sine', out, { pan });
        break;
      }
      case 'drum':
        this.tone(140 * p, t, 0.2, 0.3 * v, 'sine', out, { slide: 0.5, pan });
        break;
      case 'success':
        [0, 4, 7, 12].forEach((s, i) => this.tone(mtof(67 + s) * p, t + i * 0.1, 0.35, 0.14 * v, 'triangle', out));
        this.tone(mtof(91) * p, t + 0.42, 0.6, 0.05 * v, 'sine', out);
        break;
      case 'oops':
        // gentle, not a buzzer
        this.tone(mtof(67) * p, t, 0.14, 0.14 * v, 'triangle', out, { slide: 0.94 });
        this.tone(mtof(64) * p, t + 0.13, 0.22, 0.14 * v, 'triangle', out, { slide: 0.96 });
        break;
      case 'ding':
        this.tone(mtof(88) * p, t, 0.6, 0.12 * v, 'sine', out);
        break;
      case 'tick':
        this.noiseBurst(t, 0.015, 0.12 * v, 'highpass', 4000, 1, out, { pan });
        break;
      case 'puff':
        this.noiseBurst(t, 0.25, 0.22 * v, 'lowpass', 1200 * p, 1, out, { a: 0.02, sweep: 0.4, pan });
        break;
      case 'wobble':
        for (let i = 0; i < 3; i++) this.tone((260 + (i % 2) * 40) * p, t + i * 0.07, 0.08, 0.1 * v, 'sine', out, { pan });
        break;
      case 'glow':
        this.tone(mtof(64) * p, t, 1.4, 0.06 * v, 'triangle', out, { a: 0.4 });
        this.tone(mtof(71) * p, t + 0.1, 1.4, 0.05 * v, 'triangle', out, { a: 0.4 });
        break;
      case 'bellows':
        this.noiseBurst(t, 0.35, 0.22 * v, 'lowpass', 700 * p, 1, out, { a: 0.1, sweep: 1.8, pan });
        break;
      case 'stretch':
        this.tone(200 * p, t, 0.3, 0.12 * v, 'triangle', out, { slide: 1.5, a: 0.05, pan });
        break;
      case 'hint':
        this.tone(mtof(79) * p, t, 0.3, 0.08 * v, 'sine', out);
        this.tone(mtof(86) * p, t + 0.12, 0.4, 0.06 * v, 'sine', out);
        break;
    }
  }

  /** Character babble: a few pitched syllables matched to a caption. */
  babble(voice: VoiceLike, syllables: number, seed: number): number {
    if (!this.ctx || this.ctx.state !== 'running') return syllables * 0.11;
    const r = mulberry32(seed);
    const c = this.ctx;
    let t = c.currentTime + 0.02;
    const n = Math.min(14, Math.max(2, syllables));
    for (let i = 0; i < n; i++) {
      const f = voice.pitch + (r() - 0.5) * voice.spread * 2;
      const len = voice.len * (0.8 + r() * 0.6);
      const o = c.createOscillator();
      const g = c.createGain();
      const bp = c.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = f * 2.2;
      bp.Q.value = 1.2;
      o.type = voice.wave;
      o.frequency.setValueAtTime(f, t);
      o.frequency.exponentialRampToValueAtTime(f * (r() > 0.5 ? 1.12 : 0.9), t + len);
      this.env(g, t, 0.012, 0.22, len);
      o.connect(bp).connect(g).connect(this.voiceBus);
      o.start(t);
      o.stop(t + len + 0.05);
      t += len + 0.03 + r() * 0.03;
    }
    return t - c.currentTime;
  }

  // ---------------------------------------------------------------- music

  startMusic(theme: Theme): void {
    if (this.musicTheme === theme) return;
    this.musicTheme = theme;
    this.step = 0;
    if (this.ctx) this.startScheduler();
  }

  stopMusic(): void {
    this.musicTheme = null;
    if (this.musicTimer) clearInterval(this.musicTimer);
    this.musicTimer = null;
  }

  private startScheduler(): void {
    if (this.musicTimer) clearInterval(this.musicTimer);
    this.nextNoteTime = this.ctx!.currentTime + 0.1;
    this.musicTimer = setInterval(() => this.schedule(), 90);
  }

  private schedule(): void {
    if (!this.ctx || !this.musicTheme || this.ctx.state !== 'running') return;
    const th = THEMES[this.musicTheme];
    const eighth = 60 / th.bpm / 2;
    const barSteps = th.beats * 2;
    while (this.nextNoteTime < this.ctx.currentTime + 0.35) {
      const t = this.nextNoteTime;
      const bar = Math.floor(this.step / barSteps) % th.chords.length;
      const inBar = this.step % barSteps;
      const chord = th.chords[bar];
      const out = this.musicBus;
      // arpeggio
      const idx = th.arp[inBar % th.arp.length];
      const note = th.root + chord[idx % chord.length] + (inBar >= barSteps / 2 && th.inst !== 'bell' ? 12 : 0);
      const f = mtof(note);
      if (th.inst === 'bell') {
        if (inBar % 2 === 0) {
          this.tone(f, t, 1.1, 0.1, 'sine', out);
          this.tone(f * 2.76, t, 0.3, 0.02, 'sine', out);
        }
      } else if (th.inst === 'uke') {
        this.tone(f, t, 0.35, 0.09, 'triangle', out);
        this.tone(f * 2, t, 0.15, 0.03, 'sine', out);
      } else {
        this.tone(f, t, 0.7, 0.1, 'sine', out);
        this.tone(f * 2, t, 0.2, 0.025, 'triangle', out);
      }
      // bass on the bar's first beat
      if (inBar === 0) this.tone(mtof(th.root - 24 + chord[0]), t, eighth * barSteps * 0.9, 0.12, 'sine', out, { a: 0.02 });
      // soft pad
      if (inBar === 0) {
        for (const s of chord) this.tone(mtof(th.root - 12 + s), t, eighth * barSteps, 0.018, 'triangle', out, { a: 0.4 });
      }
      if (th.bell && inBar === barSteps - 2 && bar % 2 === 1) this.tone(mtof(th.root + 24 + chord[2]), t, 1.2, 0.035, 'sine', out);
      if (th.shaker && !this.quiet && inBar % 2 === 1) this.noiseBurst(t, 0.04, 0.025, 'highpass', 6000, 1, out);
      this.nextNoteTime += eighth;
      this.step++;
    }
  }

  // ---------------------------------------------------------------- ambience

  /** Continuous wind bed; level 0 turns it off. */
  setWind(level: number): void {
    this.windLevel = level;
    if (!this.ctx) return;
    const c = this.ctx;
    if (level <= 0) {
      if (this.wind) {
        const w = this.wind;
        w.gain.gain.setTargetAtTime(0.0001, c.currentTime, 0.4);
        setTimeout(() => {
          try {
            w.src.stop();
            w.lfo.stop();
          } catch {
            /* already stopped */
          }
        }, 1600);
        this.wind = null;
      }
      return;
    }
    if (!this.wind) {
      const src = c.createBufferSource();
      src.buffer = this.noise;
      src.loop = true;
      const filter = c.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 500;
      filter.Q.value = 0.7;
      const gain = c.createGain();
      gain.gain.value = 0.0001;
      const lfo = c.createOscillator();
      lfo.frequency.value = 0.13;
      const lfoGain = c.createGain();
      lfoGain.gain.value = 260;
      lfo.connect(lfoGain).connect(filter.frequency);
      src.connect(filter).connect(gain).connect(this.sfxBus);
      src.start();
      lfo.start();
      this.wind = { src, gain, filter, lfo };
    }
    this.wind.gain.gain.setTargetAtTime(0.05 * level * (this.quiet ? 0.5 : 1), c.currentTime, 0.6);
  }

  /** Stop music/ambience (used on scene changes and finishing). */
  stopAll(): void {
    this.stopMusic();
    this.setWind(0);
  }
}

export const audio = new AudioEngine();
