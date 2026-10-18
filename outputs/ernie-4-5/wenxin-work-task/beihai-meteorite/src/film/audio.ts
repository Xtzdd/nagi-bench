// Programmatic audio synthesis via Web Audio API
// No external assets; respects space/basement acoustics.

export class AudioEngine {
  ctx: AudioContext | null = null
  master!: GainNode
  droneGain!: GainNode
  reverbNode!: DelayNode
  reverbFB!: GainNode
  started = false

  async init() {
    if (this.started) return
    const AC = (window.AudioContext || (window as any).webkitAudioContext)
    this.ctx = new AC()
    await this.ctx.resume()
    this.master = this.ctx.createGain()
    this.master.gain.value = 0.8
    this.master.connect(this.ctx.destination)

    // basement reverb (simple delay feedback)
    this.reverbNode = this.ctx.createDelay(1.0)
    this.reverbNode.delayTime.value = 0.18
    this.reverbFB = this.ctx.createGain()
    this.reverbFB.gain.value = 0.32
    this.reverbNode.connect(this.reverbFB)
    this.reverbFB.connect(this.reverbNode)
    this.reverbNode.connect(this.master)

    // ambient drone
    this.droneGain = this.ctx.createGain()
    this.droneGain.gain.value = 0.0
    this.droneGain.connect(this.master)
    this.spawnDrone()
    this.started = true
  }

  private spawnDrone() {
    if (!this.ctx) return
    const freqs = [55, 82.4, 110]
    freqs.forEach(f => {
      const o = this.ctx!.createOscillator()
      o.type = 'sine'
      o.frequency.value = f
      const g = this.ctx!.createGain()
      g.gain.value = 0.05 / freqs.length
      const lfo = this.ctx!.createOscillator()
      lfo.frequency.value = 0.08 + Math.random() * 0.1
      const lfoG = this.ctx!.createGain()
      lfoG.gain.value = 0.03
      lfo.connect(lfoG).connect(g.gain)
      o.connect(g).connect(this.droneGain)
      o.start()
      lfo.start()
    })
  }

  setDroneIntensity(v: number) {
    if (!this.ctx) return
    this.droneGain.gain.setTargetAtTime(Math.min(0.35, v), this.ctx.currentTime, 0.8)
  }

  // Lathe / grinding for workshop
  playLathe(intensity = 1) {
    if (!this.ctx) return
    const t = this.ctx.currentTime
    const noise = this.makeNoise(2.0)
    const bp = this.ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = 1200
    bp.Q.value = 3
    const saw = this.ctx.createOscillator()
    saw.type = 'sawtooth'
    saw.frequency.value = 140
    const sawG = this.ctx.createGain()
    sawG.gain.value = 0.08 * intensity
    const nG = this.ctx.createGain()
    nG.gain.value = 0.15 * intensity
    nG.gain.setTargetAtTime(0, t + 1.8, 0.2)
    sawG.gain.setTargetAtTime(0, t + 1.8, 0.2)
    noise.connect(bp).connect(nG)
    // send to reverb + master
    nG.connect(this.master)
    nG.connect(this.reverbNode)
    saw.connect(sawG)
    sawG.connect(this.master)
    sawG.connect(this.reverbNode)
    noise.start(t); noise.stop(t + 2.2)
    saw.start(t); saw.stop(t + 2.2)
    this.spawnSparks(t, intensity)
  }

  private spawnSparks(t: number, intensity: number) {
    if (!this.ctx) return
    for (let i = 0; i < 8; i++) {
      const o = this.ctx.createOscillator()
      o.type = 'square'
      o.frequency.value = 3000 + Math.random() * 3000
      const g = this.ctx.createGain()
      const when = t + Math.random() * 1.8
      g.gain.setValueAtTime(0.0, when)
      g.gain.linearRampToValueAtTime(0.04 * intensity, when + 0.005)
      g.gain.exponentialRampToValueAtTime(0.0001, when + 0.06)
      o.connect(g).connect(this.master)
      o.start(when); o.stop(when + 0.08)
    }
  }

  playClick() {
    if (!this.ctx) return
    const t = this.ctx.currentTime
    const o = this.ctx.createOscillator()
    o.type = 'square'
    o.frequency.value = 220
    const g = this.ctx.createGain()
    g.gain.setValueAtTime(0.18, t)
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.05)
    o.connect(g).connect(this.master)
    o.start(t); o.stop(t + 0.08)
  }

  playLoad() {
    if (!this.ctx) return
    const t = this.ctx.currentTime
    for (let i = 0; i < 3; i++) {
      const o = this.ctx.createOscillator()
      o.type = 'square'
      o.frequency.value = 600 + i * 120
      const g = this.ctx.createGain()
      const when = t + i * 0.12
      g.gain.setValueAtTime(0.12, when)
      g.gain.exponentialRampToValueAtTime(0.001, when + 0.06)
      o.connect(g).connect(this.master)
      o.start(when); o.stop(when + 0.08)
    }
  }

  playBreathing(level = 0.5) {
    if (!this.ctx) return
    const t = this.ctx.currentTime
    const dur = 3.2
    const noise = this.makeNoise(dur)
    const lp = this.ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 400
    const g = this.ctx.createGain()
    // inhale + exhale envelope
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(0.12 * level, t + 1.1)
    g.gain.linearRampToValueAtTime(0.03 * level, t + 1.5)
    g.gain.linearRampToValueAtTime(0.14 * level, t + 2.6)
    g.gain.linearRampToValueAtTime(0.0, t + 3.1)
    noise.connect(lp).connect(g).connect(this.master)
    noise.start(t); noise.stop(t + dur + 0.1)
  }

  // heartbeat thump
  playHeartbeat() {
    if (!this.ctx) return
    const t = this.ctx.currentTime
    this.thump(t, 70, 0.25)
    this.thump(t + 0.22, 65, 0.22)
  }
  private thump(t: number, f: number, vol: number) {
    if (!this.ctx) return
    const o = this.ctx.createOscillator()
    o.type = 'sine'
    o.frequency.setValueAtTime(f, t)
    o.frequency.exponentialRampToValueAtTime(30, t + 0.2)
    const g = this.ctx.createGain()
    g.gain.setValueAtTime(vol, t)
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.3)
    o.connect(g).connect(this.master)
    o.start(t); o.stop(t + 0.35)
  }

  // Vacuum shot: transmitted thump only, no bang
  playVacuumShot() {
    if (!this.ctx) return
    const t = this.ctx.currentTime
    // sub thump
    const o = this.ctx.createOscillator()
    o.type = 'sine'
    o.frequency.setValueAtTime(90, t)
    o.frequency.exponentialRampToValueAtTime(24, t + 0.4)
    const g = this.ctx.createGain()
    g.gain.setValueAtTime(0.55, t)
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.7)
    o.connect(g).connect(this.master)
    o.start(t); o.stop(t + 0.8)
    // suit noise click
    const n = this.makeNoise(0.25)
    const bp = this.ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = 300
    const nG = this.ctx.createGain()
    nG.gain.setValueAtTime(0.25, t)
    nG.gain.exponentialRampToValueAtTime(0.001, t + 0.2)
    n.connect(bp).connect(nG).connect(this.master)
    n.start(t); n.stop(t + 0.3)
    // brief duck drone for subjective silence
    this.droneGain.gain.setValueAtTime(0.05, t)
    this.droneGain.gain.setTargetAtTime(0.2, t + 0.5, 1.2)
  }

  playHit() {
    if (!this.ctx) return
    const t = this.ctx.currentTime
    const o = this.ctx.createOscillator()
    o.type = 'sine'
    o.frequency.setValueAtTime(120, t)
    o.frequency.exponentialRampToValueAtTime(35, t + 0.35)
    const g = this.ctx.createGain()
    g.gain.setValueAtTime(0.5, t)
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.6)
    o.connect(g).connect(this.master)
    o.start(t); o.stop(t + 0.7)
    const n = this.makeNoise(0.35)
    const lp = this.ctx.createBiquadFilter()
    lp.type = 'lowpass'; lp.frequency.value = 600
    const nG = this.ctx.createGain()
    nG.gain.setValueAtTime(0.2, t)
    nG.gain.exponentialRampToValueAtTime(0.001, t + 0.3)
    n.connect(lp).connect(nG).connect(this.master)
    n.start(t); n.stop(t + 0.4)
  }

  playCrack() {
    if (!this.ctx) return
    const t = this.ctx.currentTime
    const n = this.makeNoise(0.6)
    const bp = this.ctx.createBiquadFilter()
    bp.type = 'highpass'; bp.frequency.value = 2000
    const g = this.ctx.createGain()
    g.gain.setValueAtTime(0.18, t)
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.5)
    n.connect(bp).connect(g).connect(this.master)
    n.start(t); n.stop(t + 0.6)
  }

  playAlarm() {
    if (!this.ctx) return
    const t = this.ctx.currentTime
    for (let i = 0; i < 6; i++) {
      const when = t + i * 0.5
      const o = this.ctx.createOscillator()
      o.type = 'square'
      o.frequency.value = 880
      const g = this.ctx.createGain()
      g.gain.setValueAtTime(0, when)
      g.gain.linearRampToValueAtTime(0.12, when + 0.05)
      g.gain.linearRampToValueAtTime(0, when + 0.3)
      o.connect(g).connect(this.master)
      o.start(when); o.stop(when + 0.35)
    }
  }

  playRadio(text_cue?: string) {
    if (!this.ctx) return
    const t = this.ctx.currentTime
    const dur = 2.5
    const n = this.makeNoise(dur)
    const bp = this.ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = 1500
    bp.Q.value = 5
    const g = this.ctx.createGain()
    g.gain.setValueAtTime(0.04, t)
    g.gain.linearRampToValueAtTime(0.0, t + dur)
    // distorted carrier beeps
    n.connect(bp).connect(g).connect(this.master)
    n.start(t); n.stop(t + dur)
    for (let i = 0; i < 4; i++) {
      const when = t + 0.2 + i * 0.5
      const o = this.ctx.createOscillator()
      o.type = 'sawtooth'
      o.frequency.value = 900
      const og = this.ctx.createGain()
      og.gain.setValueAtTime(0.03, when)
      og.gain.exponentialRampToValueAtTime(0.001, when + 0.12)
      o.connect(og).connect(this.master)
      o.start(when); o.stop(when + 0.15)
    }
  }

  playDecompression() {
    if (!this.ctx) return
    const t = this.ctx.currentTime
    const dur = 1.5
    const n = this.makeNoise(dur)
    const bp = this.ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.setValueAtTime(2000, t)
    bp.frequency.exponentialRampToValueAtTime(200, t + dur)
    const g = this.ctx.createGain()
    g.gain.setValueAtTime(0.2, t)
    g.gain.exponentialRampToValueAtTime(0.001, t + dur)
    n.connect(bp).connect(g).connect(this.master)
    n.start(t); n.stop(t + dur)
  }

  playMetalDrop() {
    if (!this.ctx) return
    const t = this.ctx.currentTime
    for (let i = 0; i < 3; i++) {
      const when = t + i * 0.15
      const o = this.ctx.createOscillator()
      o.type = 'triangle'
      o.frequency.value = 1200 - i * 150
      const g = this.ctx.createGain()
      g.gain.setValueAtTime(0.1, when)
      g.gain.exponentialRampToValueAtTime(0.001, when + 0.25)
      o.connect(g).connect(this.master)
      o.start(when); o.stop(when + 0.3)
    }
  }

  private makeNoise(dur: number): AudioBufferSourceNode {
    if (!this.ctx) return null as any
    const sr = this.ctx.sampleRate
    const buf = this.ctx.createBuffer(1, sr * dur, sr)
    const d = buf.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
    const src = this.ctx.createBufferSource()
    src.buffer = buf
    return src
  }
}

export const audio = new AudioEngine()
