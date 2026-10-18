// Sound design: everything is synthesized with the Web Audio API.
//
// No sample files, no external libraries. The acoustic rules in the brief are
// respected: indoor gunfire gets a hard early-reflection reverb, while the
// vacuum sequence carries no airborne sound at all — only a suit-conducted
// thump and a subjective low tone.

export type SfxName =
  | 'hum' | 'tick' | 'blip' | 'machining' | 'breath' | 'thruster'
  | 'metalClick' | 'servo' | 'thump' | 'impact' | 'alarm' | 'beep'
  | 'whoosh' | 'pressureLeak' | 'radioStatic' | 'pulse' | 'sting';

export interface SfxCue { t: number; name: SfxName; gain?: number; }

export class AudioEngine {
  ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private wet: GainNode | null = null;
  private dry: GainNode | null = null;
  private ambBus: GainNode | null = null;
  private ambNodes: AudioNode[] = [];
  private noiseBuf: AudioBuffer | null = null;
  enabled = false;
  private fired = new Set<number>();

  private ensure(): boolean {
    if (this.ctx) return true;
    const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AC) return false;
    const ctx: AudioContext = new AC();
    this.ctx = ctx;

    const master = ctx.createGain();
    master.gain.value = 0.0;
    master.connect(ctx.destination);
    this.master = master;

    const conv = ctx.createConvolver();
    conv.buffer = this.makeImpulse(1.9, 3.2);
    const wet = ctx.createGain();
    wet.gain.value = 0.5;
    conv.connect(wet);
    wet.connect(master);

    const dry = ctx.createGain();
    dry.gain.value = 1.0;
    dry.connect(master);

    this.wet = wet;
    this.dry = dry;
    this.noiseBuf = this.makeNoise(3.0);

    const amb = ctx.createGain();
    amb.gain.value = 0.55;
    amb.connect(dry);
    this.ambBus = amb;

    // expose the convolver input as the "reverb send"
    (this as any).conv = conv;
    return true;
  }

  private makeNoise(seconds: number): AudioBuffer {
    const ctx = this.ctx!;
    const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  private makeImpulse(seconds: number, decay: number): AudioBuffer {
    const ctx = this.ctx!;
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        const t = i / len;
        const env = Math.pow(1 - t, decay);
        // a few bright early reflections then a diffuse tail
        const early = (i < ctx.sampleRate * 0.09 && Math.random() < 0.02) ? 3 : 1;
        d[i] = (Math.random() * 2 - 1) * env * early;
      }
    }
    return buf;
  }

  /** Must be called from a user gesture. */
  unlock() {
    if (!this.ensure()) return;
    if (this.ctx!.state === 'suspended') this.ctx!.resume();
    if (this.master) {
      this.master.gain.cancelScheduledValues(this.ctx!.currentTime);
      this.master.gain.setTargetAtTime(0.85, this.ctx!.currentTime, 0.6);
    }
    this.enabled = true;
  }

  setVolume(v: number) {
    if (!this.ctx || !this.master) return;
    this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.15);
  }

  private now() { return this.ctx!.currentTime; }

  private noise(dest: AudioNode, dur: number, gain: number, type: BiquadFilterType, freq: number, q = 1, when = 0) {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf!;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain();
    const t0 = this.now() + when;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t0 + Math.min(0.02, dur * 0.2));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f); f.connect(g); g.connect(dest);
    src.start(t0); src.stop(t0 + dur + 0.05);
    return { src, f, g };
  }

  private tone(freq: number, dur: number, gain: number, type: OscillatorType = 'sine', when = 0, slideTo?: number, dest?: AudioNode) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = type;
    const g = ctx.createGain();
    const t0 = this.now() + when;
    o.frequency.setValueAtTime(freq, t0);
    if (slideTo !== undefined) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t0 + Math.min(0.03, dur * 0.2));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g);
    g.connect(dest ?? this.dry!);
    o.start(t0); o.stop(t0 + dur + 0.05);
    return { o, g };
  }

  /** Fire one named effect. `wet` routes through the convolution reverb. */
  sfx(name: SfxName, gain = 1, useReverb = false) {
    if (!this.ctx || !this.enabled) return;
    const dest = useReverb ? (this as any).conv as AudioNode : this.dry!;
    const g = gain;
    switch (name) {
      case 'tick':
        this.noise(dest, 0.05, 0.10 * g, 'bandpass', 3200, 6);
        break;
      case 'blip':
        this.tone(1180, 0.07, 0.10 * g, 'square');
        this.tone(1560, 0.05, 0.06 * g, 'square', 0.08);
        break;
      case 'beep':
        this.tone(880, 0.14, 0.11 * g, 'sine');
        break;
      case 'radioStatic':
        this.noise(dest, 0.42, 0.075 * g, 'bandpass', 1500, 1.2);
        this.tone(420, 0.05, 0.05 * g, 'square');
        break;
      case 'machining':
        for (let i = 0; i < 4; i++)
          this.noise(dest, 0.16, 0.13 * g, 'bandpass', 2400 + Math.random() * 2600, 7, i * 0.14);
        this.tone(190, 0.55, 0.05 * g, 'sawtooth', 0, 150);
        break;
      case 'metalClick':
        this.noise(dest, 0.06, 0.14 * g, 'highpass', 3800, 1);
        this.tone(2400, 0.05, 0.05 * g, 'triangle');
        break;
      case 'servo':
        this.tone(160, 0.35, 0.07 * g, 'sawtooth', 0, 320);
        this.noise(dest, 0.34, 0.05 * g, 'bandpass', 900, 3);
        break;
      case 'breath':
        this.noise(dest, 0.62, 0.075 * g, 'bandpass', 620, 0.9);
        this.noise(dest, 0.5, 0.05 * g, 'lowpass', 300, 0.8, 0.72);
        break;
      case 'thruster':
        this.noise(dest, 1.5, 0.20 * g, 'lowpass', 420, 0.7);
        this.tone(58, 1.4, 0.13 * g, 'sawtooth', 0, 40);
        break;
      case 'whoosh':
        this.noise(dest, 1.1, 0.12 * g, 'bandpass', 500, 0.7);
        break;
      case 'hum':
        this.tone(52, 2.4, 0.10 * g, 'sine');
        this.tone(78, 2.4, 0.05 * g, 'sine');
        break;
      case 'pulse':
        this.tone(94, 0.34, 0.15 * g, 'sine', 0, 68);
        break;
      case 'pressureLeak':
        this.noise(dest, 1.2, 0.12 * g, 'highpass', 2600, 0.8);
        break;
      // --- vacuum: no airborne sound, only structure-conducted ---
      case 'thump':
        this.tone(46, 0.42, 0.34 * g, 'sine', 0, 28);
        this.noise(this.dry!, 0.16, 0.09 * g, 'lowpass', 220, 0.8);
        break;
      case 'impact':
        this.tone(34, 1.5, 0.42 * g, 'sine', 0, 20);
        this.noise(this.dry!, 0.9, 0.20 * g, 'lowpass', 640, 0.6);
        this.noise(this.dry!, 1.4, 0.09 * g, 'highpass', 2200, 0.5, 0.05);
        break;
      case 'alarm':
        for (let i = 0; i < 4; i++) {
          this.tone(740, 0.20, 0.13 * g, 'square', i * 0.44);
          this.tone(560, 0.20, 0.13 * g, 'square', i * 0.44 + 0.22);
        }
        break;
      case 'sting':
        this.tone(120, 2.2, 0.13 * g, 'sine', 0, 44);
        this.tone(121.5, 2.2, 0.09 * g, 'sine', 0, 44);
        break;
    }
  }

  /** Continuous ambience, swapped per set. */
  setAmbience(kind: 'none' | 'station' | 'workshop' | 'vacuum' | 'bay') {
    if (!this.ctx || !this.enabled || !this.ambBus) return;
    for (const n of this.ambNodes) { try { (n as any).stop?.(); } catch { /* noop */ } }
    this.ambNodes = [];
    const ctx = this.ctx;
    if (kind === 'none' || kind === 'vacuum') {
      if (kind === 'vacuum') {
        // near-silence with a barely-there sub rumble: the body hears itself
        const o = ctx.createOscillator();
        o.type = 'sine'; o.frequency.value = 27;
        const g = ctx.createGain(); g.gain.value = 0.055;
        o.connect(g); g.connect(this.ambBus); o.start();
        this.ambNodes.push(o, g);
      }
      return;
    }
    const base = kind === 'workshop' ? 96 : kind === 'bay' ? 70 : 58;
    for (const [mult, vol, type] of [[1, 0.10, 'sine'], [2, 0.045, 'sine'], [3.01, 0.022, 'triangle']] as [number, number, OscillatorType][]) {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = base * mult;
      const g = ctx.createGain();
      g.gain.value = vol;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.07 + Math.random() * 0.11;
      const lg = ctx.createGain();
      lg.gain.value = vol * 0.35;
      lfo.connect(lg); lg.connect(g.gain);
      o.connect(g); g.connect(this.ambBus);
      o.start(); lfo.start();
      this.ambNodes.push(o, g, lfo, lg);
    }
    // air-handling hiss
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf!; src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = kind === 'workshop' ? 1800 : 900; f.Q.value = 0.7;
    const g = ctx.createGain(); g.gain.value = 0.028;
    src.connect(f); f.connect(g); g.connect(this.ambBus);
    src.start();
    this.ambNodes.push(src, f, g);
  }

  private _amb = '';
  /** Swap ambience only when the target actually changed. */
  setAmbienceIfNeeded(kind: 'none' | 'station' | 'workshop' | 'vacuum' | 'bay') {
    if (this._amb === kind) return;
    this._amb = kind;
    this.setAmbience(kind);
  }

  /** Fire any cue whose time lies in (prev, t]. */
  pump(cues: SfxCue[], prev: number, t: number) {
    for (let i = 0; i < cues.length; i++) {
      const c = cues[i];
      if (this.fired.has(i)) continue;
      if (c.t > prev && c.t <= t) {
        this.fired.add(i);
        this.sfx(c.name, c.gain ?? 1, false);
      }
      if (t < prev - 0.5) this.fired.delete(i);   // rewound
    }
  }

  resetFired() { this.fired.clear(); }
}

// The SFX score, aligned to the shot list.
export const SFX_CUES: SfxCue[] = [
  { t: 0.5, name: 'sting', gain: 0.7 },
  { t: 18.5, name: 'whoosh', gain: 0.5 },
  { t: 20.5, name: 'radioStatic' },
  { t: 21.2, name: 'blip' },
  { t: 24.0, name: 'hum', gain: 0.6 },
  { t: 46.0, name: 'beep' },
  { t: 52.0, name: 'servo', gain: 0.8 },
  { t: 55.5, name: 'tick' },
  { t: 66.0, name: 'tick', gain: 0.6 },
  { t: 79.0, name: 'tick', gain: 0.6 },
  { t: 92.5, name: 'servo' },
  { t: 96.0, name: 'breath' },
  { t: 104.0, name: 'beep', gain: 0.6 },
  { t: 112.0, name: 'breath', gain: 0.8 },
  { t: 122.0, name: 'pulse', gain: 0.9 },
  { t: 128.5, name: 'servo', gain: 0.9 },
  { t: 132.0, name: 'machining' },
  { t: 137.0, name: 'metalClick' },
  { t: 142.0, name: 'machining', gain: 0.85 },
  { t: 149.0, name: 'metalClick', gain: 0.7 },
  { t: 151.5, name: 'radioStatic', gain: 0.8 },
  { t: 152.0, name: 'blip' },
  { t: 157.0, name: 'metalClick' },
  { t: 163.0, name: 'machining', gain: 0.7 },
  { t: 170.5, name: 'metalClick', gain: 0.9 },
  { t: 173.0, name: 'breath' },
  { t: 176.5, name: 'servo', gain: 0.9 },
  { t: 179.5, name: 'radioStatic' },
  { t: 180.0, name: 'blip' },
  { t: 188.0, name: 'tick', gain: 0.5 },
  { t: 198.5, name: 'radioStatic' },
  { t: 199.0, name: 'blip' },
  { t: 204.0, name: 'pulse', gain: 0.8 },
  { t: 207.0, name: 'breath' },
  { t: 214.5, name: 'thruster', gain: 0.8 },
  { t: 216.5, name: 'radioStatic' },
  { t: 217.0, name: 'blip' },
  { t: 223.0, name: 'breath' },
  { t: 232.0, name: 'metalClick', gain: 0.5 },
  { t: 238.0, name: 'breath', gain: 0.7 },
  { t: 243.0, name: 'pulse', gain: 1.0 },
  { t: 246.0, name: 'breath', gain: 0.5 },
  { t: 250.0, name: 'metalClick', gain: 0.35 },
  // --- vacuum: no airborne gunshot ---
  { t: 251.2, name: 'thump', gain: 1.0 },
  { t: 252.0, name: 'pulse', gain: 0.5 },
  { t: 263.8, name: 'impact', gain: 1.0 },
  { t: 264.2, name: 'pressureLeak', gain: 0.9 },
  { t: 266.0, name: 'sting', gain: 0.9 },
  { t: 272.0, name: 'alarm', gain: 0.9 },
  { t: 277.0, name: 'alarm', gain: 0.7 },
  { t: 286.5, name: 'alarm', gain: 0.6 },
  { t: 290.0, name: 'radioStatic' },
  { t: 298.0, name: 'beep', gain: 0.5 },
  { t: 305.0, name: 'breath' },
  { t: 312.0, name: 'sting', gain: 0.8 },
  { t: 326.0, name: 'pulse', gain: 0.5 }
];

export const AMBIENCE_BY_SET: Record<string, 'none' | 'station' | 'workshop' | 'vacuum' | 'bay'> = {
  titles: 'none',
  orbit: 'station',
  chamber: 'station',
  quarters: 'station',
  workshop: 'workshop',
  bay: 'bay',
  pod: 'vacuum',
  theshot: 'vacuum',
  aftermath: 'station',
  credits: 'none'
};
