import * as THREE from 'three'

export type Shot = {
  name: string
  start: number
  end: number
  from: THREE.Vector3
  to: THREE.Vector3
  lookAt: THREE.Vector3
  lookAtTo?: THREE.Vector3
  fovFrom?: number
  fovTo?: number
  up?: THREE.Vector3
  easing?: (t: number) => number
}

// easing helpers
export const easeInOut = (t: number) => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
export const easeOut = (t: number) => 1 - Math.pow(1 - t, 3)
export const easeIn = (t: number) => t * t * t
export const linear = (t: number) => t

// Quaternion slerp helper
function slerpQuat(qA: THREE.Quaternion, qB: THREE.Quaternion, t: number) {
  const q = new THREE.Quaternion()
  q.slerpQuaternions(qA, qB, t)
  return q
}

export function composeShotCamera(
  cam: THREE.PerspectiveCamera,
  shot: Shot,
  t: number, // global time
  projectile?: { position: THREE.Vector3 }
) {
  const dur = shot.end - shot.start
  let lt = Math.max(0, Math.min(1, (t - shot.start) / dur))
  const e = shot.easing || easeInOut
  const k = e(lt)

  const from = shot.from.clone()
  const to = shot.to.clone()
  const pos = from.lerp(to, k)

  let lookTarget: THREE.Vector3
  if (projectile && shot.name.startsWith('bullet_follow')) {
    lookTarget = projectile.position
    // camera follows slightly behind
    const back = new THREE.Vector3(0, 0, 1).applyQuaternion(cam.quaternion)
    pos.copy(projectile.position).add(back.multiplyScalar(0.8))
  } else if (shot.lookAtTo) {
    lookTarget = shot.lookAt.clone().lerp(shot.lookAtTo, k)
  } else {
    lookTarget = shot.lookAt
  }

  cam.position.copy(pos)
  const up = shot.up || new THREE.Vector3(0, 1, 0)
  cam.up.copy(up)

  // rotation via quaternions
  const qFrom = new THREE.Quaternion().setFromRotationMatrix(
    new THREE.Matrix4().lookAt(shot.from, shot.lookAt, up)
  )
  const qTo = new THREE.Quaternion().setFromRotationMatrix(
    new THREE.Matrix4().lookAt(shot.to, shot.lookAtTo || shot.lookAt, up)
  )
  const q = slerpQuat(qFrom, qTo, k)
  cam.quaternion.copy(q)
  cam.lookAt(lookTarget)

  if (shot.fovFrom !== undefined && shot.fovTo !== undefined) {
    cam.fov = shot.fovFrom + (shot.fovTo - shot.fovFrom) * k
    cam.updateProjectionMatrix()
  }
}

export const allShots: Shot[] = [
  // Scene 1: workshop (0-12)
  {
    name: 'ws_ext_close',
    start: 0, end: 5,
    from: new THREE.Vector3(1.2, 1.8, 2.0),
    to: new THREE.Vector3(0.6, 1.6, 1.3),
    lookAt: new THREE.Vector3(0.2, 1.2, 0),
    lookAtTo: new THREE.Vector3(0.4, 1.15, 0),
    fovFrom: 45, fovTo: 40,
    easing: easeOut
  },
  {
    name: 'ws_hands',
    start: 5, end: 12,
    from: new THREE.Vector3(0.6, 1.6, 1.3),
    to: new THREE.Vector3(-0.3, 1.25, 1.2),
    lookAt: new THREE.Vector3(-0.3, 1.0, 0),
    lookAtTo: new THREE.Vector3(-0.3, 1.0, 0),
    fovFrom: 40, fovTo: 38,
    easing: easeInOut
  },
  // Scene 2: table cutting / loading (12-25)
  {
    name: 'table_loading',
    start: 12, end: 20,
    from: new THREE.Vector3(0.0, 2.2, 1.6),
    to: new THREE.Vector3(0.0, 1.5, 0.8),
    lookAt: new THREE.Vector3(0, 1.0, 0),
    fovFrom: 42, fovTo: 38,
    easing: easeInOut
  },
  {
    name: 'mag_close',
    start: 20, end: 25,
    from: new THREE.Vector3(-0.4, 1.2, 0.6),
    to: new THREE.Vector3(0.1, 1.0, 0.7),
    lookAt: new THREE.Vector3(0, 0.95, 0),
    fovFrom: 35, fovTo: 28,
    easing: easeOut
  },
  // Scene 3: space station corridor / deck (25-40)
  {
    name: 'deck_wide',
    start: 25, end: 32,
    from: new THREE.Vector3(0, 1.8, 0.5),
    to: new THREE.Vector3(0, 2.0, -3.5),
    lookAt: new THREE.Vector3(0, 1.4, -5),
    lookAtTo: new THREE.Vector3(0, 1.4, -7.5),
    fovFrom: 55, fovTo: 50,
    easing: easeOut
  },
  {
    name: 'old_men_talking',
    start: 32, end: 40,
    from: new THREE.Vector3(0, 2.0, -3.5),
    to: new THREE.Vector3(-2.2, 1.8, -7.0),
    lookAt: new THREE.Vector3(0, 1.5, -8),
    fovFrom: 50, fovTo: 45,
    easing: easeInOut
  },
  // Scene 4: Beihai exits toilet, advances (40-60)
  {
    name: 'toilet_door',
    start: 40, end: 47,
    from: new THREE.Vector3(2.5, 1.7, 5.0),
    to: new THREE.Vector3(2.0, 1.6, 4.0),
    lookAt: new THREE.Vector3(1.0, 1.4, 5.5),
    lookAtTo: new THREE.Vector3(0.5, 1.5, 3.0),
    fovFrom: 48, fovTo: 46,
    easing: easeInOut
  },
  {
    name: 'beihai_walk',
    start: 47, end: 60,
    from: new THREE.Vector3(0.0, 1.7, 3.0),
    to: new THREE.Vector3(0.0, 1.8, -4.0),
    lookAt: new THREE.Vector3(0, 1.5, -2),
    lookAtTo: new THREE.Vector3(0, 1.5, -7),
    fovFrom: 50, fovTo: 55,
    easing: linear
  },
  // Scene 5: aim + fire + follow (60-80)
  {
    name: 'over_shoulder',
    start: 60, end: 66,
    from: new THREE.Vector3(0.3, 1.75, -5.0),
    to: new THREE.Vector3(0.25, 1.7, -5.4),
    lookAt: new THREE.Vector3(0, 1.5, -8.0),
    fovFrom: 42, fovTo: 38,
    easing: easeOut
  },
  {
    name: 'crosshair',
    start: 66, end: 70,
    from: new THREE.Vector3(0.0, 1.7, -6.0),
    to: new THREE.Vector3(0.0, 1.65, -7.0),
    lookAt: new THREE.Vector3(0, 1.5, -8.0),
    fovFrom: 35, fovTo: 28,
    easing: easeIn
  },
  {
    name: 'bullet_follow',
    start: 70, end: 75,
    from: new THREE.Vector3(0, 1.7, -7.0),
    to: new THREE.Vector3(0, 1.65, -8.0),
    lookAt: new THREE.Vector3(0, 1.5, -8.0),
    fovFrom: 50, fovTo: 60,
    easing: linear
  },
  {
    name: 'impact_side',
    start: 75, end: 80,
    from: new THREE.Vector3(-3.0, 1.8, -7.5),
    to: new THREE.Vector3(-2.5, 2.2, -5.0),
    lookAt: new THREE.Vector3(0, 1.4, -8.0),
    lookAtTo: new THREE.Vector3(0, 1.0, -6),
    fovFrom: 50, fovTo: 45,
    easing: easeOut
  },
  // Scene 6: disengage, alarm, pull back (80-100)
  {
    name: 'disarm',
    start: 80, end: 88,
    from: new THREE.Vector3(0.6, 1.9, -6.0),
    to: new THREE.Vector3(0.2, 1.7, -4.5),
    lookAt: new THREE.Vector3(0, 1.3, -7),
    lookAtTo: new THREE.Vector3(0.2, 1.2, -3),
    fovFrom: 45, fovTo: 50,
    easing: easeInOut
  },
  {
    name: 'pull_back_earth',
    start: 88, end: 100,
    from: new THREE.Vector3(0, 1.7, -4.5),
    to: new THREE.Vector3(0, 5.0, -8),
    lookAt: new THREE.Vector3(0, 1.0, -8),
    lookAtTo: new THREE.Vector3(2, 2, -22),
    fovFrom: 50, fovTo: 75,
    easing: easeInOut
  },
  // Scene 7: end card black (100-115)
  {
    name: 'fade_black',
    start: 100, end: 115,
    from: new THREE.Vector3(0, 2, -2.5),
    to: new THREE.Vector3(0, 2, -2.5),
    lookAt: new THREE.Vector3(0, 0, -10),
    fovFrom: 70, fovTo: 70,
    easing: linear
  }
]
