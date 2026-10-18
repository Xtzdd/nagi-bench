import * as THREE from 'three'
import { FilmEngine } from './timeline'
import {
  buildWorkshopScene, buildLoadingScene, buildStationScene, buildEndScene
} from './scenes'
import { createStarfield } from './voxel'

export * from './timeline'
export * from './subtitles'
export * from './audio'
export * from './voxel'
export * from './scenes'
export * from './camera'

/**
 * engine — main entry: initializes three.js (WebGLRenderer, ACES tone mapping,
 * shadows on), builds the starfield background, registers all scene stages,
 * and boots the FilmEngine loop. Exposes the canvas element to the React host.
 */
export function createFilm(container: HTMLElement) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setSize(container.clientWidth, container.clientHeight)
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.05
  container.appendChild(renderer.domElement)
  renderer.domElement.className = 'film-canvas'

  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x05060a)
  scene.fog = new THREE.Fog(0x05060a, 25, 120)

  const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 500)
  camera.position.set(0, 2, 5)

  // global ambient light (supplemented per-scene)
  scene.add(new THREE.AmbientLight(0x202838, 0.25))
  // universal starfield (workshop scenes are interior + fog hides it)
  scene.add(createStarfield(2000))

  const engine = new FilmEngine(scene, camera)
  engine.registerStages([
    { start: 0, end: 12, stage: buildWorkshopScene() },
    { start: 12, end: 25, stage: buildLoadingScene() },
    { start: 25, end: 100, stage: buildStationScene() },
    { start: 100, end: engine.totalDuration, stage: buildEndScene() }
  ])

  // main render loop — the FilmEngine.tick updates scene state/camera
  let running = true
  const loop = () => {
    if (!running) return
    requestAnimationFrame(loop)
    if (!engine.state.playing) {
      // When paused/ended we still need to render the current frame
      renderer.render(scene, camera)
      return
    }
    renderer.render(scene, camera)
  }
  loop()

  const onResize = () => {
    const w = container.clientWidth
    const h = container.clientHeight
    renderer.setSize(w, h)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
  }
  window.addEventListener('resize', onResize)

  const dispose = () => {
    running = false
    window.removeEventListener('resize', onResize)
    engine.pause()
    renderer.dispose()
    if (renderer.domElement.parentElement === container) {
      container.removeChild(renderer.domElement)
    }
  }

  return { engine, renderer, dispose }
}
