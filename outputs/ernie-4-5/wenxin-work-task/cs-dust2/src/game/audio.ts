// Web Audio API procedural sound synthesis.
// Each factory returns { start(), stop?() }.

let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;

export function initAudio() {
  if (ctx) return;
  const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
  ctx = new AC();
  masterGain = ctx.createGain();
  masterGain.gain.value = 0.4;
  masterGain.connect(ctx.destination);
}

export function resumeAudio() {
  if (ctx && ctx.state === 'suspended') ctx.resume();
}

function makeNoiseBuffer(dur: number): AudioBuffer {
  if (!ctx) throw new Error('audio not initialized');
  const sr = ctx.sampleRate;
  const len = Math.floor(sr * dur);
  const buf = ctx.createBuffer(1, len, sr);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

// Generic gunshot: noise burst through a lowpass with ADSR envelope.
function gunshotSound(opts: {
  noiseGain: number;
  lpFreq: number;
  lpQ: number;
  dur: number;
  attack: number;
  release: number;
  toneFreq?: number;
  toneGain?: number;
}) {
  if (!ctx || !masterGain) return { start() {} };
  const src = ctx.createBufferSource();
  src.buffer = makeNoiseBuffer(opts.dur);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = opts.lpFreq;
  lp.Q.value = opts.lpQ;
  const gain = ctx.createGain();
  gain.gain.value = 0;
  src.connect(lp).connect(gain).connect(masterGain);

  let toneOsc: OscillatorNode | null = null;
  let toneGain: GainNode | null = null;
  if (opts.toneFreq && opts.toneGain) {
    toneOsc = ctx.createOscillator();
    toneOsc.type = 'sawtooth';
    toneOsc.frequency.value = opts.toneFreq;
    toneGain = ctx.createGain();
    toneGain.gain.value = 0;
    toneOsc.connect(toneGain).connect(masterGain);
  }

  const now = ctx.currentTime;
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(opts.noiseGain, now + opts.attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + opts.dur);
  if (toneOsc && toneGain) {
    toneGain.gain.setValueAtTime(0, now);
    toneGain.gain.linearRampToValueAtTime(opts.toneGain!, now + opts.attack);
    toneGain.gain.exponentialRampToValueAtTime(0.0001, now + opts.dur);
  }
  return {
    start() {
      if (!ctx) return;
      src.start();
      src.stop(ctx.currentTime + opts.dur + 0.05);
      if (toneOsc) {
        toneOsc.start();
        toneOsc.stop(ctx.currentTime + opts.dur + 0.05);
      }
    },
  };
}

export function fireAK47() {
  return gunshotSound({
    noiseGain: 0.8,
    lpFreq: 2200,
    lpQ: 2,
    dur: 0.12,
    attack: 0.002,
    release: 0.1,
    toneFreq: 180,
    toneGain: 0.4,
  });
}
export function fireM4A4() {
  return gunshotSound({
    noiseGain: 0.7,
    lpFreq: 3000,
    lpQ: 1,
    dur: 0.09,
    attack: 0.001,
    release: 0.08,
    toneFreq: 260,
    toneGain: 0.3,
  });
}
export function fireAWP() {
  return gunshotSound({
    noiseGain: 1.4,
    lpFreq: 1200,
    lpQ: 4,
    dur: 0.35,
    attack: 0.001,
    release: 0.3,
    toneFreq: 80,
    toneGain: 0.9,
  });
}
export function firePistol() {
  return gunshotSound({
    noiseGain: 0.6,
    lpFreq: 3500,
    lpQ: 1,
    dur: 0.08,
    attack: 0.002,
    release: 0.06,
    toneFreq: 400,
    toneGain: 0.35,
  });
}
export function fireDeagle() {
  return gunshotSound({
    noiseGain: 0.9,
    lpFreq: 1800,
    lpQ: 3,
    dur: 0.18,
    attack: 0.001,
    release: 0.15,
    toneFreq: 120,
    toneGain: 0.7,
  });
}

export function reloadSound() {
  if (!ctx || !masterGain) return { start() {} };
  const t0 = ctx.currentTime;
  const osc = ctx.createOscillator();
  osc.type = 'square';
  osc.frequency.setValueAtTime(400, t0);
  osc.frequency.exponentialRampToValueAtTime(200, t0 + 0.15);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.2, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.3);
  osc.connect(g).connect(masterGain);
  return {
    start() {
      if (!ctx) return;
      osc.start(t0);
      osc.stop(t0 + 0.35);
      // click at end
      setTimeout(() => {
        if (!ctx || !masterGain) return;
        const o2 = ctx.createOscillator();
        o2.type = 'square';
        o2.frequency.value = 800;
        const g2 = ctx.createGain();
        const t = ctx.currentTime;
        g2.gain.setValueAtTime(0.2, t);
        g2.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
        o2.connect(g2).connect(masterGain);
        o2.start();
        o2.stop(t + 0.08);
      }, 600);
    },
  };
}

export function footstepSound(material: 'sand' | 'concrete' | 'wood' = 'sand') {
  if (!ctx || !masterGain) return { start() {} };
  const src = ctx.createBufferSource();
  src.buffer = makeNoiseBuffer(0.12);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = material === 'wood' ? 1500 : material === 'concrete' ? 2200 : 800;
  const g = ctx.createGain();
  const now = ctx.currentTime;
  g.gain.setValueAtTime(0, now);
  g.gain.linearRampToValueAtTime(0.25, now + 0.01);
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
  src.connect(lp).connect(g).connect(masterGain);
  return {
    start() {
      if (!ctx) return;
      src.start();
      src.stop(ctx.currentTime + 0.15);
    },
  };
}

export function scopeSound() {
  if (!ctx || !masterGain) return { start() {} };
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(1200, now);
  osc.frequency.exponentialRampToValueAtTime(400, now + 0.08);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.15, now);
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
  osc.connect(g).connect(masterGain);
  return {
    start() {
      if (!ctx) return;
      osc.start(now);
      osc.stop(now + 0.12);
    },
  };
}

export function hitSound() {
  if (!ctx || !masterGain) return { start() {} };
  const now = ctx.currentTime;
  const src = ctx.createBufferSource();
  src.buffer = makeNoiseBuffer(0.08);
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 800;
  bp.Q.value = 2;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.3, now);
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
  src.connect(bp).connect(g).connect(masterGain);
  return {
    start() {
      if (!ctx) return;
      src.start(now);
      src.stop(now + 0.1);
    },
  };
}

let beepInterval: number | null = null;
export function startC4Beep(getTimer: () => number) {
  if (!ctx || !masterGain) return;
  stopC4Beep();
  const beep = () => {
    if (!ctx || !masterGain) return;
    const t = getTimer();
    if (t <= 0) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    // Frequency increases as timer approaches zero
    const freq = 600 + (40 - t) * 40;
    osc.frequency.value = Math.min(freq, 2000);
    const g = ctx.createGain();
    const dur = t < 5 ? 0.08 : 0.12;
    g.gain.setValueAtTime(t < 5 ? 0.5 : 0.3, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + dur);
    osc.connect(g).connect(masterGain);
    osc.start(now);
    osc.stop(now + dur + 0.02);
    const interval = t < 5 ? 250 : t < 10 ? 500 : 1000;
    beepInterval = window.setTimeout(beep, interval);
  };
  beep();
}
export function stopC4Beep() {
  if (beepInterval !== null) {
    clearTimeout(beepInterval);
    beepInterval = null;
  }
}

export function explosionSound() {
  if (!ctx || !masterGain) return { start() {} };
  const now = ctx.currentTime;
  // low rumble
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(80, now);
  osc.frequency.exponentialRampToValueAtTime(30, now + 1.2);
  const og = ctx.createGain();
  og.gain.setValueAtTime(1.5, now);
  og.gain.exponentialRampToValueAtTime(0.001, now + 1.5);
  osc.connect(og).connect(masterGain);
  // noise burst
  const src = ctx.createBufferSource();
  src.buffer = makeNoiseBuffer(1.2);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(600, now);
  lp.frequency.exponentialRampToValueAtTime(200, now + 1);
  const ng = ctx.createGain();
  ng.gain.setValueAtTime(1.0, now);
  ng.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
  src.connect(lp).connect(ng).connect(masterGain);
  return {
    start() {
      if (!ctx) return;
      osc.start(now);
      osc.stop(now + 1.6);
      src.start(now);
      src.stop(now + 1.3);
    },
  };
}

export function killSound() {
  if (!ctx || !masterGain) return { start() {} };
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(900, now);
  osc.frequency.linearRampToValueAtTime(1500, now + 0.08);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.2, now);
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
  osc.connect(g).connect(masterGain);
  return {
    start() {
      if (!ctx) return;
      osc.start(now);
      osc.stop(now + 0.2);
    },
  };
}
