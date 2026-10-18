// All sound is synthesized with the Web Audio API. No audio files.
// Each weapon gets its own recipe so AK / M4 / AWP / pistols are distinguishable.

export type Sfx =
  | 'ak47' | 'm4a4' | 'awp' | 'glock' | 'usp' | 'deagle' | 'knife'
  | 'reload' | 'reloadEnd' | 'step' | 'scopeIn' | 'scopeOut'
  | 'hit' | 'hitHead' | 'kill' | 'plant' | 'defuse' | 'beep' | 'explode'
  | 'roundWinT' | 'roundWinCT' | 'dryFire';

export class GameAudio {
  ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;

  private ensure(): boolean {
    if (this.ctx) return true;
    const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AC) return false;
    const ctx: AudioContext = new AC();
    this.ctx = ctx;
    const m = ctx.createGain();
    m.gain.value = 0.7;
    m.connect(ctx.destination);
    this.master = m;
    const len = Math.floor(ctx.sampleRate * 2);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noise = buf;
    return true;
  }

  unlock() {
    if (!this.ensure()) return;
    if (this.ctx!.state === 'suspended') this.ctx!.resume();
  }
  setVolume(v: number) { if (this.master && this.ctx) this.master.gain.value = v; }

  private burst(dur: number, gain: number, type: BiquadFilterType, freq: number, q: number, delay = 0, sweepTo?: number) {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise!; src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = type; f.Q.value = q;
    const g = ctx.createGain();
    const t0 = ctx.currentTime + delay;
    f.frequency.setValueAtTime(freq, t0);
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(Math.max(40, sweepTo), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t0 + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f); f.connect(g); g.connect(this.master!);
    src.start(t0); src.stop(t0 + dur + 0.05);
  }

  private tone(freq: number, dur: number, gain: number, type: OscillatorType = 'sine', delay = 0, slideTo?: number) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    const t0 = ctx.currentTime + delay;
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t0 + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(this.master!);
    o.start(t0); o.stop(t0 + dur + 0.05);
  }

  play(name: Sfx, vol = 1) {
    if (!this.ensure() || !this.ctx) return;
    if (this.ctx.state === 'suspended') return;
    switch (name) {
      // --- rifles: a crack plus a body plus a tail ---
      case 'ak47':
        this.burst(0.09, 0.55 * vol, 'highpass', 900, 0.7, 0, 2600);
        this.burst(0.24, 0.34 * vol, 'bandpass', 420, 1.1, 0.005);
        this.tone(96, 0.20, 0.34 * vol, 'sawtooth', 0, 44);
        this.burst(0.42, 0.09 * vol, 'lowpass', 300, 0.6, 0.03);
        break;
      case 'm4a4':
        this.burst(0.07, 0.46 * vol, 'highpass', 1500, 0.8, 0, 3400);
        this.burst(0.17, 0.24 * vol, 'bandpass', 700, 1.3, 0.004);
        this.tone(148, 0.14, 0.24 * vol, 'square', 0, 70);
        this.burst(0.30, 0.06 * vol, 'lowpass', 340, 0.6, 0.02);
        break;
      case 'awp':
        this.burst(0.12, 0.62 * vol, 'highpass', 1100, 0.6, 0, 2200);
        this.burst(0.5, 0.36 * vol, 'bandpass', 300, 0.9, 0.01);
        this.tone(62, 0.42, 0.42 * vol, 'sawtooth', 0, 30);
        this.burst(0.85, 0.16 * vol, 'lowpass', 260, 0.5, 0.05);
        this.tone(190, 0.30, 0.10 * vol, 'sine', 0.06, 60);
        break;
      case 'glock':
        this.burst(0.055, 0.34 * vol, 'highpass', 1700, 0.9, 0, 3600);
        this.tone(210, 0.09, 0.20 * vol, 'square', 0, 90);
        this.burst(0.16, 0.08 * vol, 'bandpass', 800, 1.2, 0.01);
        break;
      case 'usp':
        this.burst(0.05, 0.30 * vol, 'highpass', 2000, 1.0, 0, 4200);
        this.tone(260, 0.08, 0.17 * vol, 'triangle', 0, 120);
        this.burst(0.13, 0.06 * vol, 'bandpass', 950, 1.3, 0.008);
        break;
      case 'deagle':
        this.burst(0.10, 0.52 * vol, 'highpass', 900, 0.7, 0, 2400);
        this.burst(0.30, 0.28 * vol, 'bandpass', 380, 1.0, 0.006);
        this.tone(84, 0.26, 0.36 * vol, 'sawtooth', 0, 38);
        this.burst(0.55, 0.10 * vol, 'lowpass', 280, 0.6, 0.04);
        break;
      case 'knife':
        this.burst(0.09, 0.16 * vol, 'bandpass', 2600, 2.4, 0, 900);
        this.tone(520, 0.07, 0.07 * vol, 'triangle', 0, 240);
        break;

      // --- actions ---
      case 'reload':
        this.burst(0.05, 0.16 * vol, 'bandpass', 1500, 3, 0);
        this.tone(300, 0.05, 0.09 * vol, 'square', 0.02);
        this.burst(0.04, 0.12 * vol, 'bandpass', 900, 3, 0.18);
        break;
      case 'reloadEnd':
        this.burst(0.05, 0.20 * vol, 'bandpass', 2200, 4, 0);
        this.tone(720, 0.05, 0.10 * vol, 'square', 0.01);
        break;
      case 'step':
        this.burst(0.055, 0.075 * vol, 'bandpass', 420 + Math.random() * 260, 1.1);
        break;
      case 'scopeIn':
        this.tone(420, 0.09, 0.11 * vol, 'sine', 0, 900);
        this.burst(0.05, 0.07 * vol, 'bandpass', 1800, 3, 0.02);
        break;
      case 'scopeOut':
        this.tone(900, 0.08, 0.09 * vol, 'sine', 0, 380);
        break;
      case 'hit':
        this.tone(1500, 0.05, 0.16 * vol, 'square');
        this.burst(0.03, 0.09 * vol, 'highpass', 3000, 1);
        break;
      case 'hitHead':
        this.tone(2100, 0.06, 0.20 * vol, 'square');
        this.tone(1400, 0.09, 0.14 * vol, 'sine', 0.03);
        break;
      case 'kill':
        this.tone(880, 0.09, 0.16 * vol, 'square');
        this.tone(1320, 0.10, 0.14 * vol, 'square', 0.07);
        this.tone(1760, 0.14, 0.12 * vol, 'sine', 0.14);
        break;
      case 'dryFire':
        this.burst(0.03, 0.14 * vol, 'bandpass', 2600, 5);
        this.tone(240, 0.03, 0.08 * vol, 'square');
        break;

      // --- bomb ---
      case 'beep':
        this.tone(1046, 0.09, 0.13 * vol, 'square');
        break;
      case 'plant':
        this.burst(0.06, 0.18 * vol, 'bandpass', 1200, 3);
        this.tone(520, 0.10, 0.12 * vol, 'square', 0.05);
        this.burst(0.05, 0.14 * vol, 'bandpass', 700, 3, 0.22);
        break;
      case 'defuse':
        this.tone(660, 0.07, 0.10 * vol, 'sine');
        this.tone(880, 0.07, 0.10 * vol, 'sine', 0.12);
        this.tone(660, 0.07, 0.10 * vol, 'sine', 0.24);
        break;
      case 'explode':
        this.burst(1.4, 0.62 * vol, 'lowpass', 900, 0.5, 0, 60);
        this.tone(44, 1.5, 0.5 * vol, 'sawtooth', 0, 20);
        this.tone(70, 0.9, 0.28 * vol, 'square', 0.02, 26);
        this.burst(0.7, 0.20 * vol, 'highpass', 1800, 0.6, 0.01);
        break;
      case 'roundWinT':
        this.tone(392, 0.16, 0.14 * vol, 'square');
        this.tone(523, 0.16, 0.14 * vol, 'square', 0.14);
        this.tone(659, 0.30, 0.14 * vol, 'square', 0.28);
        break;
      case 'roundWinCT':
        this.tone(523, 0.16, 0.14 * vol, 'square');
        this.tone(659, 0.16, 0.14 * vol, 'square', 0.14);
        this.tone(784, 0.32, 0.14 * vol, 'square', 0.28);
        break;
    }
  }
}

export const WEAPON_SFX: Record<string, Sfx> = {
  ak47: 'ak47', m4a4: 'm4a4', awp: 'awp',
  glock: 'glock', usp: 'usp', deagle: 'deagle', knife: 'knife'
};
