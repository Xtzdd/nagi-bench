import * as THREE from 'three'
import { allShots, composeShotCamera, Shot } from './camera'
import { subtitles, TOTAL_DURATION, VoiceCue } from './subtitles'
import { audio } from './audio'
import { SceneStage } from './scenes'

export type FilmState = {
  playing: boolean
  time: number
  currentSubtitle: VoiceCue | null
  ended: boolean
}

/**
 * FilmEngine — time-line controller.
 * Owns the global clock (starting from 0), active scene stage,
 * shot sequence, subtitle on/off, audio triggers, and prop/particle
 * events (shots, hits, sparks, floating debris).
 * Provides play()/pause()/seek(t).
 */
export class FilmEngine {
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  clock = new THREE.Clock()
  state: FilmState = { playing: false, time: 0, currentSubtitle: null, ended: false }

  stages: { start: number; end: number; stage: SceneStage }[] = []
  activeStage: SceneStage | null = null
  shots: Shot[] = allShots
  eventLog = new Set<string>()
  rafId = 0

  onUpdate?: (s: FilmState) => void

  constructor(scene: THREE.Scene, camera: THREE.PerspectiveCamera) {
    this.scene = scene
    this.camera = camera
  }

  registerStages(stages: { start: number; end: number; stage: SceneStage }[]) {
    this.stages = stages.sort((a, b) => a.start - b.start)
    if (this.stages.length) this.activateStage(this.stages[0], 0)
  }

  private activateStage(entry: { start: number; end: number; stage: SceneStage }, t: number) {
    if (this.activeStage === entry.stage) return
    if (this.activeStage) {
      this.scene.remove(this.activeStage.root)
      this.activeStage.onLeave?.(t)
    }
    this.activeStage = entry.stage
    this.scene.add(entry.stage.root)
    entry.stage.onEnter?.(t)
  }

  async play() {
    if (this.state.ended) {
      this.seek(0)
      this.state.ended = false
    }
    this.state.playing = true
    this.clock.start()
    if (!audio.started) await audio.init()
    audio.setDroneIntensity(0.15)
    this.loop()
  }

  pause() {
    this.state.playing = false
    this.clock.stop()
    if (this.rafId) cancelAnimationFrame(this.rafId)
  }

  seek(t: number) {
    this.state.time = Math.max(0, Math.min(TOTAL_DURATION, t))
    this.eventLog.clear()
    const entry = this.stages.find(s => this.state.time >= s.start && this.state.time < s.end)
      || this.stages[this.stages.length - 1]
    if (entry) this.activateStage(entry, this.state.time)
    this.updateSubtitles()
  }

  private loop = () => {
    if (!this.state.playing) return
    const dt = Math.min(0.05, this.clock.getDelta())
    this.state.time += dt
    if (this.state.time >= TOTAL_DURATION) {
      this.state.time = TOTAL_DURATION
      this.state.ended = true
      this.state.playing = false
    }
    this.tick(dt)
    if (this.state.playing) this.rafId = requestAnimationFrame(this.loop)
  }

  tick(dt: number) {
    const t = this.state.time

    const entry = this.stages.find(s => t >= s.start && t < s.end) || this.stages[this.stages.length - 1]
    if (entry) this.activateStage(entry, t)

    let activeShot: Shot | null = null
    for (const s of this.shots) {
      if (t >= s.start && t < s.end) { activeShot = s; break }
    }
    let projectile: THREE.Object3D | undefined
    if (activeShot) {
      const ud = this.activeStage?.root.userData as any
      projectile = activeShot.name.startsWith('bullet_follow') ? ud?.projectile : undefined
      composeShotCamera(this.camera, activeShot, t, projectile as any)
    }

    if (this.activeStage) {
      const ctx: any = { camera: this.camera, fireEvent: () => {} }
      this.activeStage.update(t, dt, ctx)
      if (ctx.projectile && this.activeStage.root.userData !== undefined) {
        (this.activeStage.root.userData as any).projectile = ctx.projectile
      }
    }

    this.checkEvents(t)
    this.updateSubtitles()
    this.onUpdate?.(this.state)
  }

  private checkEvents(t: number) {
    const fire = (key: string, when: number, fn: () => void) => {
      if (!this.eventLog.has(key) && t >= when) {
        this.eventLog.add(key)
        fn()
      }
    }
    fire('radio@28', 28, () => { if (t < 40) audio.playRadio() })
    fire('decomp@42', 42, () => audio.playDecompression())
    fire('breath@44', 44, () => audio.playBreathing(0.7))
  }

  private updateSubtitles() {
    const t = this.state.time
    const cur = subtitles.find(s => t >= s.start && t < s.end) || null
    this.state.currentSubtitle = cur
  }

  get totalDuration() { return TOTAL_DURATION }
}

export { TOTAL_DURATION, subtitles }
export type { VoiceCue } from './subtitles'
