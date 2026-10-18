import type { WeaponId } from './types';

export class AudioEngine {
  private ctx: AudioContext | null = null;

  unlock() {
    if (!this.ctx) this.ctx = new AudioContext();
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  private tone(freq: number, duration: number, type: OscillatorType, gainValue: number, slide = 0) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), now + duration);
    gain.gain.setValueAtTime(gainValue, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.connect(gain).connect(this.ctx.destination);
    osc.start(now); osc.stop(now + duration);
  }

  private noise(duration: number, gainValue: number, filterFreq: number) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const buffer = this.ctx.createBuffer(1, this.ctx.sampleRate * duration, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const source = this.ctx.createBufferSource();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();
    source.buffer = buffer;
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    gain.gain.setValueAtTime(gainValue, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    source.connect(filter).connect(gain).connect(this.ctx.destination);
    source.start(now);
  }

  shot(weapon: WeaponId) {
    if (weapon === 'rifle') { this.noise(.13, .28, 1800); this.tone(95, .08, 'square', .12, -50); }
    if (weapon === 'pistol') { this.noise(.09, .2, 1300); this.tone(120, .06, 'square', .08, -60); }
    if (weapon === 'knife') this.tone(260, .07, 'triangle', .06, -120);
  }

  reload() { this.tone(220, .06, 'square', .05); setTimeout(() => this.tone(320, .06, 'square', .05), 120); }
  hit() { this.tone(180, .07, 'triangle', .08, -90); }
  footstep() { this.noise(.04, .035, 350); }
  beep() { this.tone(880, .06, 'sine', .08); }
  plant() { this.tone(440, .08, 'sine', .08); setTimeout(() => this.tone(660, .08, 'sine', .08), 120); }
  explosion() { this.noise(1.2, .55, 500); this.tone(45, .8, 'sine', .25, -25); }
}
