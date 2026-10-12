// Web Audio 程序化合成音效: 无外部音频文件
let ctx: AudioContext | null = null
let master: GainNode | null = null

function ac(): AudioContext {
  if (!ctx) {
    ctx = new AudioContext()
    master = ctx.createGain()
    master.gain.value = 0.5
    master.connect(ctx.destination)
  }
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

function noiseBuffer(seconds: number): AudioBuffer {
  const c = ac()
  const buf = c.createBuffer(1, c.sampleRate * seconds, c.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  return buf
}

function burst(freq: number, q: number, dur: number, vol: number, punchHz = 90) {
  const c = ac()
  const src = c.createBufferSource()
  src.buffer = noiseBuffer(dur)
  const filt = c.createBiquadFilter()
  filt.type = 'bandpass'; filt.frequency.value = freq; filt.Q.value = q
  const g = c.createGain()
  const t = c.currentTime
  g.gain.setValueAtTime(vol, t)
  g.gain.exponentialRampToValueAtTime(0.001, t + dur)
  src.connect(filt); filt.connect(g); g.connect(master!)
  src.start(); src.stop(t + dur)
  // 低频冲击
  const osc = c.createOscillator()
  const og = c.createGain()
  osc.frequency.setValueAtTime(punchHz, t)
  osc.frequency.exponentialRampToValueAtTime(40, t + 0.08)
  og.gain.setValueAtTime(vol * 0.9, t)
  og.gain.exponentialRampToValueAtTime(0.001, t + 0.1)
  osc.connect(og); og.connect(master!)
  osc.start(); osc.stop(t + 0.12)
}

function beep(freq: number, dur: number, vol = 0.2, type: OscillatorType = 'square') {
  const c = ac()
  const osc = c.createOscillator()
  const g = c.createGain()
  osc.type = type; osc.frequency.value = freq
  const t = c.currentTime
  g.gain.setValueAtTime(vol, t)
  g.gain.exponentialRampToValueAtTime(0.001, t + dur)
  osc.connect(g); g.connect(master!)
  osc.start(); osc.stop(t + dur)
}

export const SFX = {
  shot(weapon: string, dist = 0) {
    const att = Math.max(0.15, 1 - dist / 60)
    switch (weapon) {
      case 'ak47': burst(1400, 0.8, 0.14, 0.55 * att, 110); break      // 低沉厚重
      case 'm4a4': burst(2100, 1.1, 0.10, 0.42 * att, 130); break      // 清脆高频
      case 'awp':  burst(700, 0.6, 0.30, 0.75 * att, 70); break        // 巨响长尾
      case 'deagle': burst(1000, 0.8, 0.18, 0.6 * att, 95); break
      default: burst(1800, 1.2, 0.08, 0.35 * att, 140)                 // 手枪
    }
  },
  reload() { beep(520, 0.06, 0.12); setTimeout(() => beep(390, 0.08, 0.12), 160); setTimeout(() => beep(640, 0.05, 0.1), 420) },
  footstep() { burst(320, 1.4, 0.05, 0.06, 60) },
  scope() { beep(880, 0.12, 0.15, 'sine') },
  hit() { beep(1180, 0.05, 0.2, 'triangle') },
  headshot() { beep(1560, 0.07, 0.25, 'triangle'); setTimeout(() => beep(2080, 0.06, 0.2, 'triangle'), 40) },
  kill() { beep(660, 0.1, 0.2); setTimeout(() => beep(880, 0.14, 0.2), 90) },
  plant() { beep(980, 0.08, 0.18); setTimeout(() => beep(980, 0.08, 0.18), 150); setTimeout(() => beep(1320, 0.1, 0.2), 300) },
  defuseTick() { beep(740, 0.05, 0.15) },
  defused() { beep(520, 0.12, 0.2); setTimeout(() => beep(780, 0.2, 0.22), 130) },
  explosion() {
    burst(220, 0.4, 0.9, 0.95, 55)
    burst(90, 0.3, 1.3, 0.9, 38)
  },
  bombBeep(urgent: boolean) { beep(urgent ? 1480 : 1040, 0.07, 0.24, 'sine') },
  roundStart() { beep(440, 0.12, 0.18); setTimeout(() => beep(660, 0.2, 0.2), 140) },
  win() { [523, 659, 784].forEach((f, i) => setTimeout(() => beep(f, 0.18, 0.2), i * 130)) },
  lose() { [392, 330, 262].forEach((f, i) => setTimeout(() => beep(f, 0.22, 0.2), i * 150)) },
}
