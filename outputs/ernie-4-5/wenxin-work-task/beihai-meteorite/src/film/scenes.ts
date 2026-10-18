import * as THREE from 'three'
import {
  createVoxelCharacter, createVoxelGun, createMeteorBullet, createVoxelWorkshop,
  createVoxelSpaceStation, createVoxelToilet, createEarth, createStarfield,
  createGlassCrack, createSparkSystem, emitSparks, updateSparks, materials
} from './voxel'
import { audio } from './audio'

export type SceneStage = {
  root: THREE.Group
  update: (t: number, dt: number, ctx: StageCtx) => void
  onEnter?: (t: number) => void
  onLeave?: (t: number) => void
}

export type StageCtx = {
  camera: THREE.PerspectiveCamera
  fireEvent: (name: string, t: number) => void
}

// ============================================================
// Workshop Scene 1 (0-12)
// ============================================================
export function buildWorkshopScene(): SceneStage {
  const root = new THREE.Group()
  const workshop = createVoxelWorkshop()
  root.add(workshop)

  const beihai = createVoxelCharacter('beihai')
  beihai.position.set(-0.4, 0, 0.8)
  beihai.rotation.y = Math.PI
  root.add(beihai)

  // sparks at lathe
  const sparks = createSparkSystem(120)
  root.add(sparks)

  // warm key light
  const key = new THREE.PointLight(0xffc888, 1.6, 8, 1.8)
  key.position.set(-1.0, 2.0, 0.5)
  key.castShadow = true
  root.add(key)
  const amb = new THREE.AmbientLight(0x2a241c, 0.5)
  root.add(amb)

  let lastSpark = 0
  let fired = { lathe: false }

  return {
    root,
    onEnter: (t) => {
      audio.setDroneIntensity(0.15)
    },
    update: (t, dt) => {
      // arm sway grinding
      const ud = beihai.userData as any
      ud.rArm.rotation.x = Math.sin(t * 6) * 0.2
      ud.rArm.position.z = 0.15 + Math.sin(t * 8) * 0.03
      // intermittent grinding sound + sparks
      if (t - lastSpark > 0.6 && t < 11) {
        lastSpark = t
        audio.playLathe(0.7)
        emitSparks(sparks, new THREE.Vector3(-0.2, 1.1, 0), 12, 2.0)
      }
      updateSparks(sparks, dt)
      // lathe subtle rotation
      const chuck = (workshop.userData.lathe as THREE.Group).children[2]
      if (chuck) chuck.rotation.x += dt * 8
    }
  }
}

// ============================================================
// Loading bullets Scene 2 (12-25)
// ============================================================
export function buildLoadingScene(): SceneStage {
  const root = new THREE.Group()
  const workshop = createVoxelWorkshop()
  root.add(workshop)

  const benchY = 1.15
  const magGroup = new THREE.Group()
  // three meteor bullets in a box (mag)
  for (let i = 0; i < 3; i++) {
    const b = createMeteorBullet(i)
    b.position.set(0, 0.15, -0.2 + i * 0.2)
    magGroup.add(b)
  }
  const magBox = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.3, 0.7), materials.metal)
  magBox.position.y = -0.02
  magGroup.add(magBox)
  magGroup.position.set(-0.2, benchY, -0.1)
  root.add(magGroup)

  const gun = createVoxelGun()
  gun.position.set(0.5, benchY, 0.3)
  gun.rotation.y = -0.4
  gun.visible = false
  root.add(gun)

  const beihai = createVoxelCharacter('beihai')
  beihai.position.set(0.2, 0, 0.8)
  beihai.rotation.y = Math.PI + 0.2
  root.add(beihai)

  const key = new THREE.PointLight(0xffd099, 1.4, 6, 2)
  key.position.set(0, 2, 0.5)
  root.add(key)
  root.add(new THREE.AmbientLight(0x221e18, 0.55))

  let loadFired = false

  return {
    root,
    onEnter: (t) => {
      audio.setDroneIntensity(0.22)
    },
    update: (t, dt) => {
      // bullets lower into mag
      const progress = Math.min(1, (t - 12) / 6)
      magGroup.position.y = benchY + (1 - progress) * 0.6
      magGroup.rotation.x = (1 - progress) * 0.3
      if (t > 18 && !gun.visible) {
        gun.visible = true
      }
      if (t > 20 && !loadFired) {
        loadFired = true
        audio.playLoad()
      }
    }
  }
}

// ============================================================
// Space station scene 3+4+5+6 (25-100)
// ============================================================
export function buildStationScene(): SceneStage {
  const root = new THREE.Group()
  const station = createVoxelSpaceStation()
  root.add(station)

  // starfield + earth (outside deck window at -z side)
  const stars = createStarfield(1800)
  root.add(stars)
  const earth = createEarth()
  earth.position.set(2, 2, -22)
  earth.scale.set(2.0, 2.0, 2.0)
  root.add(earth)

  // 3 old astronauts by the window (deck interior spans z ≈ -3.5 to -8.5 at deck.position z=-6)
  const oldA = createVoxelCharacter('old_white')
  oldA.position.set(-1.2, 0, -7.9)
  oldA.rotation.y = Math.PI * 0.1
  const oldB = createVoxelCharacter('old_grey')
  oldB.position.set(0.2, 0, -8.1)
  oldB.rotation.y = -Math.PI * 0.05
  const oldC = createVoxelCharacter('old_crew')
  oldC.position.set(1.5, 0, -7.9)
  oldC.rotation.y = -Math.PI * 0.2
  root.add(oldA, oldB, oldC)

  // beihai starts in toilet (side of corridor) then marches down to deck entry
  const toilet = createVoxelToilet()
  toilet.position.set(1.0, 0, 5.0)
  root.add(toilet)

  const beihai = createVoxelCharacter('beihai')
  beihai.position.set(1.0, 0, 5.0)
  beihai.visible = false
  root.add(beihai)

  const gun = createVoxelGun()
  gun.position.set(0, 0, 0)
  gun.scale.set(0.001, 0.001, 0.001) // hidden until drawn
  root.add(gun)

  // glass crack overlay (added to inside of glass, which faces +z)
  const deck = station.children[1] as THREE.Group
  const glass = deck.userData.glass as THREE.Mesh
  const crack = createGlassCrack()
  crack.position.copy(glass.position)
  crack.position.z += 0.06
  crack.rotation.y = 0
  deck.add(crack)

  // floating debris after impact
  const debrisGroup = new THREE.Group()
  for (let i = 0; i < 25; i++) {
    const s = 0.05 + Math.random() * 0.08
    const m = new THREE.Mesh(new THREE.BoxGeometry(s, s, s), Math.random() < 0.5 ? materials.meteorite : materials.red)
    m.position.set(0, 1.4, -8.0)
    m.userData.v = new THREE.Vector3(
      (Math.random() - 0.5) * 0.8,
      (Math.random() - 0.5) * 0.6,
      -Math.random() * 1.2
    )
    debrisGroup.add(m)
  }
  debrisGroup.visible = false
  root.add(debrisGroup)

  // station lights (cool)
  const amb = new THREE.AmbientLight(0x324056, 0.45)
  root.add(amb)
  const sun = new THREE.DirectionalLight(0xffffff, 0.9)
  sun.position.set(5, 8, -15)
  sun.castShadow = true
  sun.shadow.mapSize.set(1024, 1024)
  root.add(sun)
  const earthGlow = new THREE.PointLight(0x4a78b5, 0.9, 30, 2)
  earthGlow.position.set(2, 2, -20)
  root.add(earthGlow)

  // red alarm light
  const alarm = new THREE.PointLight(0xff3030, 0, 12, 2)
  alarm.position.set(0, 3, -7)
  root.add(alarm)

  const state = {
    phase: 'idle' as 'idle' | 'exiting' | 'marching' | 'aiming' | 'fired' | 'fleeing' | 'alarm',
    marched: false,
    drawn: false,
    firedShot: false,
    hitTime: -1,
    bulletActive: false,
    bulletStart: 0,
    bullet: createMeteorBullet(9),
    breathingTimer: 0,
    heartbeatTimer: 0,
    alarmOn: false,
    debris: false,
    gunDismantled: false
  }
  root.add(state.bullet)
  state.bullet.visible = false

  return {
    root,
    onEnter: (t) => {
      audio.setDroneIntensity(0.18)
    },
    update: (t, dt, ctx) => {
      // earth slow rotation
      earth.rotation.y += dt * 0.02
      ;(earth.userData.clouds as THREE.Mesh).rotation.y += dt * 0.025

      // Phase logic
      if (t >= 25 && state.phase === 'idle') {
        state.phase = 'exiting'
        beihai.visible = true
        audio.playClick()
      }
      if (t >= 40 && state.phase === 'exiting') {
        state.phase = 'marching'
        beihai.rotation.y = Math.PI
      }
      if (t >= 54 && !state.drawn) {
        state.drawn = true
        // place gun in hand
        gun.scale.set(1, 1, 1)
        gun.position.set(0, 0, 0)
        const ra = (beihai.userData as any).rArm
        gun.position.set(0, -0.15, -0.3)
        gun.rotation.set(0, 0, 0)
        ra.add(gun)
        audio.playLoad()
      }
      if (t >= 58 && state.phase === 'marching') state.phase = 'aiming'
      if (t >= 70.5 && !state.firedShot) {
        state.firedShot = true
        state.bulletActive = true
        state.bulletStart = t
        state.bullet.visible = true
        // Spawn bullet just in front of Beihai's torso
        state.bullet.position.copy(beihai.position)
        state.bullet.position.y += 1.4
        state.bullet.position.z -= 0.5
        state.bullet.userData.dir = new THREE.Vector3(0, 0, 0)
        audio.playVacuumShot()
      }
      if (t >= 75 && state.hitTime < 0) {
        state.hitTime = t
        audio.playHit()
        audio.playCrack()
        crack.visible = true
        debrisGroup.visible = true
        state.debris = true
        // old men fall over
        ;[oldA, oldB, oldC].forEach((c, i) => {
          c.userData.fallStart = t + i * 0.2
        })
      }
      if (t >= 84 && !state.alarmOn) {
        state.alarmOn = true
        state.phase = 'alarm'
        audio.playAlarm()
      }

      // breathing
      state.breathingTimer += dt
      if (state.breathingTimer > 3.2 && t > 40 && t < 70) {
        state.breathingTimer = 0
        audio.playBreathing(0.7)
      }
      state.heartbeatTimer += dt
      if (state.heartbeatTimer > 1.1 && t > 55 && t < 72) {
        state.heartbeatTimer = 0
        audio.playHeartbeat()
      }

      // beihai movement
      if (state.phase === 'exiting') {
        // step out of toilet
        const k = Math.min(1, (t - 40) / 3)
        beihai.position.x = 1.0 - k * 1.0
        beihai.position.z = 5.0 - k * 1.5
      }
      if (state.phase === 'marching' || state.phase === 'aiming') {
        if (beihai.position.z > -5.6) beihai.position.z -= dt * 0.8
        beihai.position.x = 0
        beihai.rotation.y = Math.PI
        // slight arm raise while aiming
        const aim = state.phase === 'aiming' ? 1 : Math.min(1, (t - 54) / 4)
        ;(beihai.userData as any).rArm.rotation.x = -0.9 * aim
        ;(beihai.userData as any).lArm.rotation.x = -0.7 * aim
      }

      // bullet flight
      if (state.bulletActive) {
        const speed = 22
        // Aim vector toward middle of the trio
        const target = new THREE.Vector3(0, 1.45, -8.0)
        const dir = target.clone().sub(state.bullet.position).normalize()
        state.bullet.position.add(dir.multiplyScalar(speed * dt))
        state.bullet.rotation.x += dt * 8
        state.bullet.rotation.y += dt * 6
        if (state.bullet.position.distanceTo(target) < 0.4) {
          state.bulletActive = false
          state.bullet.visible = false
        }
        // expose bullet for camera follow
        ;(ctx as any).projectile = state.bullet
      }

      // old men falling
      ;[oldA, oldB, oldC].forEach(c => {
        if (c.userData.fallStart && t > c.userData.fallStart) {
          const k = Math.min(1, (t - c.userData.fallStart) / 1.2)
          c.rotation.z = k * Math.PI * 0.5
          c.position.y = -k * 0.3
          c.userData.rArm.rotation.x = -k * 1.0
        }
      })

      // debris drift
      if (state.debris) {
        debrisGroup.children.forEach(m => {
          const mm = m as THREE.Mesh
          mm.position.add((mm.userData.v as THREE.Vector3).clone().multiplyScalar(dt))
          mm.rotation.x += dt * 2
          mm.rotation.y += dt * 1.5
        })
      }

      // alarm flicker
      if (state.alarmOn) {
        alarm.intensity = 0.9 + Math.sin(t * 6) * 0.6
        if (Math.random() < 0.004) audio.playRadio()
      } else {
        alarm.intensity = 0
      }

      // after 80s: beihai retreats, drops gun
      if (t >= 80 && !state.gunDismantled) {
        state.gunDismantled = true
        // remove gun
        const ra = (beihai.userData as any).rArm
        ra.remove(gun)
        audio.playMetalDrop()
      }
      if (t >= 80 && t < 95) {
        // walk back towards camera, turn, leave
        if (beihai.position.z < 6) {
          beihai.position.z += dt * 0.9
          beihai.rotation.y = 0
        }
      }
    }
  }
}

// ============================================================
// End card Scene 7 (100-115)
// ============================================================
export function buildEndScene(): SceneStage {
  const root = new THREE.Group()
  const black = new THREE.Mesh(
    new THREE.PlaneGeometry(40, 30),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0 })
  )
  black.position.set(0, 1.5, -5)
  root.add(black)

  return {
    root,
    onEnter: (t) => {
      audio.setDroneIntensity(0.05)
    },
    update: (t, dt) => {
      const k = Math.min(1, (t - 100) / 5)
      ;(black.material as THREE.MeshBasicMaterial).opacity = k
    }
  }
}
