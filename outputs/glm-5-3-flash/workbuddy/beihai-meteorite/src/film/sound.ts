// Web Audio 程序化合成音效: 机械加工 / 舱内低鸣 / 枪械操作 / 真空闷震 / 警报 / 推进器
// 真空物理: 舱外枪声不直接传播, 只有通过宇航服与人体传导的闷震与主观化低频
let ctx: AudioContext | null = null
let master: GainNode | null = null

function ac(): AudioContext {
  if (!ctx) {
    ctx = new AudioContext()
    master = ctx.createGain()
    master.gain.value = 0.6
    master.connect(ctx.destination)
  }
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

function noise(dur: number): AudioBufferSourceNode {
  const c = ac()
  const buf = c.createBuffer(1, c.sampleRate * dur, c.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  const src = c.createBufferSource()
  src.buffer = buf
  return src
}

function env(vol: number, dur: number, attack = 0.01): GainNode {
  const c = ac()
  const g = c.createGain()
  const t = c.currentTime
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(vol, t + attack)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  return g
}

export const FilmSFX = {
  mechanic() {                                   // 挂钟/纸张翻动
    const c = ac()
    const src = noise(0.12)
    const f = c.createBiquadFilter()
    f.type = 'bandpass'; f.frequency.value = 2600; f.Q.value = 2
    src.connect(f); f.connect(env(0.08, 0.12)); f.connect(master!)
    src.start()
  },
  doorClose() {
    const c = ac()
    const src = noise(0.3)
    const f = c.createBiquadFilter()
    f.type = 'lowpass'; f.frequency.value = 380
    src.connect(f)
    f.connect(env(0.5, 0.32))
    f.connect(master!)
    src.start()
    const o = c.createOscillator()
    o.frequency.value = 70
    o.connect(env(0.4, 0.25))
    o.connect(master!)
    o.start(); o.stop(c.currentTime + 0.3)
  },
  stationHum(): { stop: () => void } {           // 站内低鸣循环
    const c = ac()
    const o1 = c.createOscillator(); o1.frequency.value = 55; o1.type = 'sine'
    const o2 = c.createOscillator(); o2.frequency.value = 82.5; o2.type = 'triangle'
    const g = c.createGain(); g.gain.value = 0.05
    o1.connect(g); o2.connect(g); g.connect(master!)
    o1.start(); o2.start()
    return { stop: () => { o1.stop(); o2.stop() } }
  },
  airlock() {                                    // 泄压: 长嘶声
    const c = ac()
    const src = noise(2.2)
    const f = c.createBiquadFilter()
    f.type = 'bandpass'; f.frequency.setValueAtTime(1800, c.currentTime)
    f.frequency.exponentialRampToValueAtTime(500, c.currentTime + 2)
    f.Q.value = 0.8
    const g = env(0.25, 2.2, 0.3)
    src.connect(f); f.connect(g); g.connect(master!)
    src.start()
  },
  gunHandling() {                                // 真空拔枪: 只有手套与枪身接触的闷响
    const c = ac()
    for (const dt of [0, 0.35, 0.7]) {
      const src = noise(0.05)
      const f = c.createBiquadFilter()
      f.type = 'lowpass'; f.frequency.value = 300
      const g = env(0.18, 0.06)
      src.connect(f); f.connect(g); g.connect(master!)
      src.start(c.currentTime + dt)
    }
  },
  vacuumShot() {                                 // 真空射击: 无空气传播, 低频身体传导闷震
    const c = ac()
    const o = c.createOscillator()
    o.type = 'sine'
    o.frequency.setValueAtTime(95, c.currentTime)
    o.frequency.exponentialRampToValueAtTime(30, c.currentTime + 0.4)
    const g = env(0.7, 0.5, 0.005)
    o.connect(g); g.connect(master!)
    o.start(); o.stop(c.currentTime + 0.55)
    const sub = noise(0.08)
    const f = c.createBiquadFilter()
    f.type = 'lowpass'; f.frequency.value = 120
    sub.connect(f); f.connect(env(0.3, 0.09)); f.connect(master!)
    sub.start()
  },
  radioStatic() {                                // 通讯静电噪声
    const c = ac()
    const src = noise(0.8)
    const f = c.createBiquadFilter()
    f.type = 'bandpass'; f.frequency.value = 1200; f.Q.value = 0.6
    const g = env(0.12, 0.8, 0.05)
    src.connect(f); f.connect(g); g.connect(master!)
    src.start()
  },
  alarm() {                                      // 远处舱内警报(经舱壁传导, 沉闷)
    const c = ac()
    for (let i = 0; i < 3; i++) {
      const o = c.createOscillator()
      o.type = 'square'
      o.frequency.value = 440
      const g = c.createGain()
      const t = c.currentTime + i * 0.7
      g.gain.setValueAtTime(0.0001, t)
      g.gain.exponentialRampToValueAtTime(0.05, t + 0.05)
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4)
      o.connect(g); g.connect(master!)
      o.start(t); o.stop(t + 0.45)
    }
  },
  thruster() {                                   // 推进器远去
    const c = ac()
    const src = noise(3.5)
    const f = c.createBiquadFilter()
    f.type = 'lowpass'
    f.frequency.setValueAtTime(900, c.currentTime)
    f.frequency.exponentialRampToValueAtTime(120, c.currentTime + 3.4)
    const g = env(0.2, 3.5, 0.4)
    src.connect(f); f.connect(g); g.connect(master!)
    src.start()
  },
  spacePad(): { stop: () => void } {             // 尾声星空铺底
    const c = ac()
    const o1 = c.createOscillator(); o1.frequency.value = 110; o1.type = 'sine'
    const o2 = c.createOscillator(); o2.frequency.value = 165; o2.type = 'sine'
    const o3 = c.createOscillator(); o3.frequency.value = 220.6; o3.type = 'sine'
    const g = c.createGain(); g.gain.value = 0.045
    o1.connect(g); o2.connect(g); o3.connect(g); g.connect(master!)
    o1.start(); o2.start(); o3.start()
    return { stop: () => { o1.stop(); o2.stop(); o3.stop() } }
  },
  cue(sfx: string) {
    switch (sfx) {
      case 'mechanic': this.mechanic(); break
      case 'doorClose': this.doorClose(); break
      case 'airlock': this.airlock(); break
      case 'gunHandling': this.gunHandling(); break
      case 'vacuumShot': this.vacuumShot(); break
      case 'radioStatic': this.radioStatic(); break
      case 'alarm': this.alarm(); break
      case 'thruster': this.thruster(); break
      default: break
    }
  },
}
