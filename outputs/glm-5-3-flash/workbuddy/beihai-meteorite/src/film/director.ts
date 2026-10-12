// 导演: 时间轴驱动镜头调度 / 表演动画 / 声音与字幕事件
import * as THREE from 'three'
import { SHOTS, VOICE_CUES, SFX_CUES, FILM_DURATION, Shot, VoiceCue } from './timeline'
import { buildStudy, buildAirlock, buildEva, buildEnding, StudySet, AirlockSet, EvaSet, EndingSet } from './sets'
import { FilmSFX } from './sound'

export interface FrameState {
  time: number
  cue: VoiceCue | null
  shot: Shot | null
  playing: boolean
}

export class Director {
  renderer: THREE.WebGLRenderer
  camera: THREE.PerspectiveCamera
  t = 0
  playing = true
  private study: StudySet
  private airlock: AirlockSet
  private eva: EvaSet
  private ending: EndingSet
  private activeScene: THREE.Scene | null = null
  private humStop: (() => void) | null = null
  private padStop: (() => void) | null = null
  private firedCues = new Set<string>()
  private firedSfx = new Set<string>()
  private onState: (s: FrameState) => void
  private last = performance.now()
  private raf = 0

  constructor(container: HTMLElement, onState: (s: FrameState) => void) {
    this.onState = onState
    this.renderer = new THREE.WebGLRenderer({ antialias: true })
    this.renderer.setSize(innerWidth, innerHeight)
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
    this.renderer.shadowMap.enabled = true
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    container.appendChild(this.renderer.domElement)
    this.camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.05, 400)

    this.study = buildStudy()
    this.airlock = buildAirlock()
    this.eva = buildEva()
    this.ending = buildEnding()

    addEventListener('resize', () => {
      this.camera.aspect = innerWidth / innerHeight
      this.camera.updateProjectionMatrix()
      this.renderer.setSize(innerWidth, innerHeight)
    })
    this.loop()
  }

  toggle() { this.playing = !this.playing }
  seek(t: number) {
    this.t = Math.max(0, Math.min(FILM_DURATION - 0.1, t))
    this.firedCues.clear(); this.firedSfx.clear()
    this.stopLoops()
  }

  private stopLoops() {
    this.humStop?.(); this.humStop = null
    this.padStop?.(); this.padStop = null
  }

  private switchScene(s: Shot) {
    const map: Record<Shot['scene'], THREE.Scene> = {
      study: this.study.scene, airlock: this.airlock.scene, eva: this.eva.scene, ending: this.ending.scene,
    }
    const next = map[s.scene]
    if (this.activeScene !== next) {
      this.stopLoops()
      this.activeScene = next
    }
  }

  private animate(t: number, dt: number) {
    // 书房: 两人对坐微动
    if (t < 62) {
      const { beihai, father } = this.study
      beihai.root.rotation.y = 0.6 + Math.sin(t * 0.8) * 0.04
      beihai.head.rotation.y = Math.sin(t * 0.5) * 0.15
      father.head.rotation.y = -0.2 + Math.sin(t * 0.4 + 1) * 0.1
      beihai.armR.rotation.x = Math.sin(t * 0.9) * 0.06
    }
    // 气闸: 缓慢漂浮步伐
    else if (t < 98) {
      const { beihai, liu, zhao } = this.airlock
      const w = Math.sin(t * 2)
      beihai.legL.rotation.x = w * 0.3; beihai.legR.rotation.x = -w * 0.3
      liu.root.position.y = Math.sin(t * 1.4) * 0.03
      zhao.head.rotation.y = Math.sin(t * 0.6) * 0.2
      beihai.root.rotation.y = t < 86 ? -0.3 : 0.2
    }
    // 舱外: 漂浮 + 关键动作
    else if (t < 166) {
      const { beihai, liu, zhao, bodies, gun } = this.eva
      liu.root.position.y = 0.5 + Math.sin(t * 0.9) * 0.08
      liu.root.rotation.z = Math.sin(t * 0.7) * 0.05
      zhao.root.position.y = 0.8 + Math.sin(t * 1.1) * 0.1
      beihai.root.position.y = 0.2 + Math.sin(t * 0.8) * 0.04
      // 拔枪(122s) 指向同事
      if (t >= 122 && t < 129) {
        gun.position.lerp(new THREE.Vector3(-0.4, 1.34, -3.2), Math.min(1, dt * 3))
        beihai.armR.rotation.x = -1.3
      }
      // 开枪(129s 起): 受害者漂离
      if (t >= 129) {
        gun.rotation.z = -0.35 + Math.sin(t * 30) * 0.02
        const dt1 = Math.max(0, t - 129)
        liu.root.position.x += dt1 * 0.004
        liu.root.position.y += dt1 * 0.006
        liu.root.rotation.z += dt1 * 0.01
        const dt2 = Math.max(0, t - 134)
        zhao.root.position.x += dt2 * 0.005
        zhao.root.position.y += dt2 * 0.004
        zhao.root.rotation.x += dt2 * 0.012
        bodies.add(liu.root); bodies.add(zhao.root)
      }
      if (t >= 158) {
        beihai.root.rotation.y = Math.PI + Math.sin(t * 0.3) * 0.1
      }
    }
    // 尾声: 缓慢转身面向地球
    else {
      const { beihai } = this.ending
      beihai.root.rotation.y = Math.PI + Math.min(1, (t - 166) / 14) * 2.4
      beihai.root.position.y = Math.sin(t * 0.5) * 0.06
    }
  }

  private loop = () => {
    this.raf = requestAnimationFrame(this.loop)
    const now = performance.now()
    const dt = Math.min((now - this.last) / 1000, 0.05)
    this.last = now
    if (this.playing) {
      this.t += dt
      if (this.t >= FILM_DURATION) { this.t = FILM_DURATION - 0.1; this.playing = false }
    }
    const t = this.t

    const shot = SHOTS.find(s => t >= s.start && t < s.end) ?? SHOTS[SHOTS.length - 1]
    this.switchScene(shot)

    // 镜头运动: from -> to 插值, look 可选 lookTo
    const k = Math.min(1, (t - shot.start) / (shot.end - shot.start))
    const ease = k * k * (3 - 2 * k)
    const from = new THREE.Vector3(...shot.from)
    const to = new THREE.Vector3(...shot.to)
    this.camera.position.lerpVectors(from, to, ease)
    const look = shot.lookTo
      ? new THREE.Vector3().lerpVectors(new THREE.Vector3(...shot.look), new THREE.Vector3(...shot.lookTo), ease)
      : new THREE.Vector3(...shot.look)
    this.camera.lookAt(look)

    // 声音事件(一次性触发)
    if (this.playing) {
      for (const c of SFX_CUES) {
        if (t >= c.start && t < c.end && !this.firedSfx.has(c.id)) {
          this.firedSfx.add(c.id)
          if (c.sfx === 'stationHum') this.humStop = FilmSFX.stationHum().stop
          else if (c.sfx === 'spacePad') this.padStop = FilmSFX.spacePad().stop
          else FilmSFX.cue(c.sfx)
        }
      }
    }

    this.animate(t, dt)
    if (this.activeScene) this.renderer.render(this.activeScene, this.camera)

    const cue = VOICE_CUES.find(c => t >= c.start && t < c.end) ?? null
    this.onState({ time: t, cue, shot, playing: this.playing })
  }

  dispose() {
    cancelAnimationFrame(this.raf)
    this.stopLoops()
    this.renderer.dispose()
    this.renderer.domElement.remove()
  }
}
