// 体素构建工具: 方块人 / 方块道具, 全部程序化生成
import * as THREE from 'three'

export interface VoxelPalette {
  skin: number
  suit: number
  suitDark: number
  visor: number
}

export const PALETTES: Record<string, VoxelPalette> = {
  beihai: { skin: 0xd8a878, suit: 0x3a4658, suitDark: 0x28303e, visor: 0x9adfff },
  father: { skin: 0xd8a878, suit: 0x5a5248, suitDark: 0x403a32, visor: 0x9adfff },
  colleagueA: { skin: 0xc89868, suit: 0x586a48, suitDark: 0x3e4c34, visor: 0x9adfff },
  colleagueB: { skin: 0xe0b088, suit: 0x6a5848, suitDark: 0x4c4034, visor: 0x9adfff },
}

export function box(w: number, h: number, d: number, color: number, emissive = 0x000000, ei = 0): THREE.Mesh {
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({ color, roughness: 0.85, emissive, emissiveIntensity: ei })
  )
  m.castShadow = true
  return m
}

// 方块人: 头/躯干/双臂/双腿, 返回分组便于动画
export interface BlockFigure {
  root: THREE.Group
  head: THREE.Mesh
  armL: THREE.Group
  armR: THREE.Group
  legL: THREE.Group
  legR: THREE.Group
}

export function makeFigure(p: VoxelPalette, spacesuit = false): BlockFigure {
  const root = new THREE.Group()
  const suit = spacesuit ? 0xc8ccd4 : p.suit
  const suitDark = spacesuit ? 0x9098a4 : p.suitDark

  const head = box(0.5, 0.5, 0.5, spacesuit ? 0xdadde2 : p.skin)
  head.position.y = 1.62
  root.add(head)
  if (spacesuit) {
    const visor = box(0.42, 0.2, 0.06, 0x101820, 0x1a3a4a, 0.6)
    visor.position.set(0, 1.66, 0.26)
    root.add(visor)
    const backpack = box(0.5, 0.6, 0.24, suitDark)
    backpack.position.set(0, 1.3, -0.36)
    root.add(backpack)
  }
  const torso = box(0.62, 0.72, 0.36, suit)
  torso.position.y = 1.0
  root.add(torso)
  const belt = box(0.64, 0.12, 0.38, suitDark)
  belt.position.y = 0.66
  root.add(belt)

  function limb(x: number, y: number, len: number, upper: number): THREE.Group {
    const g = new THREE.Group()
    g.position.set(x, y, 0)
    const m = box(0.18, len, 0.2, upper)
    m.position.y = -len / 2
    g.add(m)
    return g
  }
  const armL = limb(-0.42, 1.28, 0.62, suit)
  const armR = limb(0.42, 1.28, 0.62, suit)
  const legL = limb(-0.16, 0.6, 0.6, suitDark)
  const legR = limb(0.16, 0.6, 0.6, suitDark)
  root.add(armL, armR, legL, legR)
  return { root, head, armL, armR, legL, legR }
}

// 方块手枪(陨石子弹枪): 深灰金属 + 暗红细节
export function makePistol(): THREE.Group {
  const g = new THREE.Group()
  const body = box(0.3, 0.12, 0.1, 0x384048)
  const barrel = box(0.22, 0.1, 0.1, 0x2a3038)
  barrel.position.set(0.24, 0.03, 0)
  const grip = box(0.1, 0.22, 0.09, 0x242a30)
  grip.position.set(-0.1, -0.15, 0)
  const accent = box(0.08, 0.05, 0.1, 0x6a1a12, 0x400a06, 0.4)
  accent.position.set(0.08, -0.05, 0)
  g.add(body, barrel, grip, accent)
  return g
}

// 陨石块: 不规则色块聚合
export function makeMeteor(seed: number): THREE.Group {
  const g = new THREE.Group()
  let s = seed
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647
  for (let i = 0; i < 8; i++) {
    const sz = 0.2 + rnd() * 0.35
    const m = box(sz, sz * (0.7 + rnd() * 0.5), sz * (0.7 + rnd() * 0.5), i % 3 === 0 ? 0x4a4038 : 0x3a342e)
    m.position.set((rnd() - 0.5) * 0.5, (rnd() - 0.5) * 0.4, (rnd() - 0.5) * 0.5)
    m.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3)
    g.add(m)
  }
  return g
}

export function addStars(scene: THREE.Scene, count = 900) {
  const geo = new THREE.BufferGeometry()
  const pos = new Float32Array(count * 3)
  for (let i = 0; i < count; i++) {
    const v = new THREE.Vector3().randomDirection().multiplyScalar(180)
    pos[i * 3] = v.x; pos[i * 3 + 1] = Math.abs(v.y) * 0.5 + 4; pos[i * 3 + 2] = v.z
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  scene.add(new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xcdd8e8, size: 0.5, sizeAttenuation: true })))
}

// 地球: 体素感大球(低多边形)
export function makeEarth(): THREE.Mesh {
  const earth = new THREE.Mesh(
    new THREE.IcosahedronGeometry(26, 2),
    new THREE.MeshStandardMaterial({ color: 0x2a5a9a, roughness: 0.7, flatShading: true, emissive: 0x0a1a3a, emissiveIntensity: 0.4 })
  )
  return earth
}
