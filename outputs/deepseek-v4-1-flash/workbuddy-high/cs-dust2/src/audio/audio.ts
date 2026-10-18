/**
 * 全部音效由 Web Audio API 程序化合成，不使用任何音频文件。
 * 每件武器有独立的声音性格：AK 低沉有力、M4 明亮紧凑、AWP 轰鸣带长尾、手枪干脆。
 */

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noiseBuffer: AudioBuffer | null = null;

export function initAudio(): void {
  if (ctx) return;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  ctx = new Ctor();
  master = ctx.createGain();
  master.gain.value = 0.5;
  master.connect(ctx.destination);
  const len = Math.floor(ctx.sampleRate * 1.6);
  noiseBuffer = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
}

export function resumeAudio(): void {
  if (ctx && ctx.state === 'suspended') void ctx.resume();
}

export function setVolume(v: number): void {
  if (master) master.gain.value = v;
}

function now(): number {
  return ctx ? ctx.currentTime : 0;
}

function noise(dur: number, gain: number, filter: BiquadFilterType, f0: number, f1: number, q = 1): void {
  if (!ctx || !master || !noiseBuffer) return;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer;
  const flt = ctx.createBiquadFilter();
  flt.type = filter;
  flt.Q.value = q;
  const t = now();
  flt.frequency.setValueAtTime(f0, t);
  flt.frequency.exponentialRampToValueAtTime(Math.max(40, f1), t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(flt).connect(g).connect(master);
  src.start(t);
  src.stop(t + dur + 0.02);
}

function tone(freq: number, dur: number, type: OscillatorType, gain: number, freqEnd?: number): void {
  if (!ctx || !master) return;
  const osc = ctx.createOscillator();
  osc.type = type;
  const t = now();
  osc.frequency.setValueAtTime(freq, t);
  if (freqEnd) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(master);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

function clickGain(pan: number): StereoPannerNode | GainNode {
  if (!ctx || !master) return master as GainNode;
  if (typeof ctx.createStereoPanner === 'function') {
    const p = ctx.createStereoPanner();
    p.pan.value = pan;
    p.connect(master);
    return p;
  }
  return master;
}

export function playShoot(weaponId: string): void {
  const dest = clickGain(0);
  switch (weaponId) {
    case 'ak47':
      noise(0.19, 0.95, 'lowpass', 3200, 260, 1.4);
      tone(150, 0.13, 'square', 0.3, 60);
      break;
    case 'm4a4':
      noise(0.15, 0.8, 'bandpass', 4200, 700, 1.1);
      tone(220, 0.09, 'square', 0.22, 90);
      break;
    case 'awp':
      noise(0.55, 1.1, 'lowpass', 2400, 120, 2.2);
      tone(95, 0.42, 'sawtooth', 0.42, 38);
      break;
    case 'deagle':
      noise(0.26, 1.0, 'lowpass', 3600, 200, 1.8);
      tone(130, 0.2, 'square', 0.34, 50);
      break;
    case 'usp':
    case 'glock':
      noise(0.11, 0.62, 'highpass', 900, 2600, 0.9);
      tone(320, 0.07, 'square', 0.18, 130);
      break;
    case 'knife':
      noise(0.09, 0.35, 'bandpass', 2600, 900, 3);
      break;
    default:
      noise(0.12, 0.6, 'bandpass', 2400, 800, 1.2);
  }
  if (dest !== master) (dest as StereoPannerNode).disconnect();
}

export function playReload(): void {
  noise(0.05, 0.4, 'bandpass', 1800, 900, 3);
  window.setTimeout(() => noise(0.06, 0.34, 'bandpass', 1200, 600, 3), 220);
  window.setTimeout(() => noise(0.07, 0.4, 'bandpass', 900, 500, 2.5), 620);
}

export function playFootstep(pan: number): void {
  const dest = clickGain(pan);
  const t = now();
  if (ctx && noiseBuffer) {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer;
    const flt = ctx.createBiquadFilter();
    flt.type = 'bandpass';
    flt.frequency.value = 700 + Math.random() * 500;
    flt.Q.value = 1.2;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.24, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.11);
    src.connect(flt).connect(g).connect(dest as AudioNode);
    src.start(t);
    src.stop(t + 0.14);
  }
  if (dest !== master) (dest as StereoPannerNode).disconnect();
}

export function playZoom(): void {
  tone(1400, 0.05, 'sine', 0.2, 900);
  noise(0.05, 0.2, 'highpass', 2000, 3500, 1);
}

export function playHitMarker(headshot: boolean): void {
  tone(headshot ? 1600 : 1150, 0.07, 'square', 0.22, headshot ? 900 : 700);
}

export function playHurt(): void {
  noise(0.2, 0.5, 'lowpass', 900, 200, 1.5);
  tone(180, 0.16, 'sawtooth', 0.2, 90);
}

export function playKill(): void {
  tone(880, 0.09, 'square', 0.24);
  window.setTimeout(() => tone(1320, 0.12, 'square', 0.22), 90);
}

export function playPlantTick(): void {
  tone(1800, 0.05, 'square', 0.16);
}

export function playPlant(): void {
  tone(420, 0.3, 'sawtooth', 0.24, 180);
  noise(0.3, 0.4, 'bandpass', 700, 300, 2);
}

export function playDefuseStart(): void {
  tone(700, 0.16, 'triangle', 0.2);
}

export function playExplode(): void {
  noise(1.5, 1.3, 'lowpass', 1400, 60, 2.6);
  tone(58, 1.1, 'sawtooth', 0.5, 26);
  window.setTimeout(() => noise(0.9, 0.5, 'lowpass', 500, 80, 2), 260);
}

export function playBeep(kind: 'roundStart' | 'buy' | 'win' | 'lose'): void {
  if (kind === 'roundStart') {
    tone(520, 0.12, 'triangle', 0.2);
    window.setTimeout(() => tone(780, 0.16, 'triangle', 0.2), 130);
  } else if (kind === 'buy') {
    tone(1000, 0.06, 'square', 0.16);
  } else if (kind === 'win') {
    tone(660, 0.14, 'triangle', 0.2);
    window.setTimeout(() => tone(990, 0.2, 'triangle', 0.2), 150);
  } else {
    tone(300, 0.2, 'triangle', 0.2, 180);
  }
}

export function disposeAudio(): void {
  void ctx?.close();
  ctx = null;
  master = null;
  noiseBuffer = null;
}
