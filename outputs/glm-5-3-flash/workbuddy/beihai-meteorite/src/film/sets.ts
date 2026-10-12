// 四个场景的体素搭建: 书房 / 气闸舱 / 舱外 / 尾声
import * as THREE from 'three'
import { box, makeFigure, makeMeteor, makeEarth, addStars, PALETTES, BlockFigure } from './voxel'

export interface StudySet { scene: THREE.Scene; beihai: BlockFigure; father: BlockFigure }
export interface AirlockSet { scene: THREE.Scene; beihai: BlockFigure; liu: BlockFigure; zhao: BlockFigure }
export interface EvaSet { scene: THREE.Scene; beihai: BlockFigure; liu: BlockFigure; zhao: BlockFigure; bodies: THREE.Group; gun: THREE.Group; meteors: THREE.Group }
export interface EndingSet { scene: THREE.Scene; beihai: BlockFigure; earth: THREE.Mesh }

function bookshelf(x: number, z: number, rotY = 0): THREE.Group {
  const g = new THREE.Group()
  for (let i = 0; i < 4; i++) {
    const shelf = box(2.2, 0.08, 0.4, 0x5a4630)
    shelf.position.y = 0.5 + i * 0.62
    g.add(shelf)
    for (let b = 0; b < 6; b++) {
      const book = box(0.16, 0.4, 0.3, [0x8a3a2a, 0x2a5a6a, 0x6a6a3a, 0x4a3a6a, 0x7a5a2a, 0x3a4a3a][(i + b) % 6])
      book.position.set(-0.9 + b * 0.34, 0.74 + i * 0.62, 0)
      g.add(book)
    }
  }
  const back = box(2.3, 2.9, 0.08, 0x3a2e20)
  back.position.set(0, 1.45, -0.2)
  g.add(back)
  g.position.set(x, 0, z)
  g.rotation.y = rotY
  return g
}

export function buildStudy(): StudySet {
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x100e14)
  scene.fog = new THREE.Fog(0x100e14, 9, 22)
  scene.add(new THREE.AmbientLight(0x887898, 0.5))
  const lamp = new THREE.PointLight(0xffd9a0, 30, 14)
  lamp.position.set(0.6, 2.6, 0.4)
  scene.add(lamp)
  const moon = new THREE.DirectionalLight(0x9ab0d8, 0.5)
  moon.position.set(-6, 8, -4)
  scene.add(moon)

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(12, 12), new THREE.MeshStandardMaterial({ color: 0x4a3828, roughness: 0.95 }))
  floor.rotation.x = -Math.PI / 2
  scene.add(floor)
  scene.add(bookshelf(-3.4, -1.4))
  scene.add(bookshelf(3.2, -1.8, 0.35))

  // 书桌
  const desk = box(2.4, 0.12, 1.1, 0x5a4630)
  desk.position.set(0.6, 0.86, -0.6)
  scene.add(desk)
  for (const [dx, dz] of [[-1, -0.4], [1, -0.4], [-1, 0.4], [1, 0.4]]) {
    const leg = box(0.12, 0.84, 0.12, 0x443424)
    leg.position.set(0.6 + dx, 0.42, -0.6 + dz)
    scene.add(leg)
  }
  // 台灯
  const lampBase = box(0.2, 0.06, 0.2, 0x2a2a2a)
  lampBase.position.set(1.3, 0.95, -0.6)
  const lampShade = box(0.26, 0.24, 0.26, 0x3a5a3a, 0xffd9a0, 0.9)
  lampShade.position.set(1.3, 1.16, -0.6)
  scene.add(lampBase, lampShade)
  // 舰队模型(小方块)
  const ship = box(0.3, 0.12, 0.12, 0x8a8a92)
  ship.position.set(0.2, 0.99, -0.5)
  ship.rotation.y = 0.5
  scene.add(ship)

  const beihai = makeFigure(PALETTES.beihai)
  beihai.root.position.set(-1.2, 0, -0.4)
  beihai.root.rotation.y = 0.6
  const father = makeFigure(PALETTES.father)
  father.root.position.set(1.4, 0, -1.2)
  father.root.rotation.y = -2.6
  father.legL.visible = false; father.legR.visible = false
  father.root.position.y = 0.55
  scene.add(beihai.root, father.root)

  return { scene, beihai, father }
}

export function buildAirlock(): AirlockSet {
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x141a20)
  scene.fog = new THREE.Fog(0x141a20, 8, 20)
  scene.add(new THREE.AmbientLight(0x9ab0c8, 0.55))
  for (const x of [-3, 3]) {
    const l = new THREE.PointLight(0xdfe8f2, 14, 12)
    l.position.set(x, 2.8, 1)
    scene.add(l)
  }
  // 走廊: 金属壁板
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x4a545e, roughness: 0.6, metalness: 0.5 })
  for (const s of [-1, 1]) {
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(14, 3.6), wallMat)
    wall.position.set(s * 4, 1.8, 0)
    wall.rotation.y = s * -Math.PI / 2
    scene.add(wall)
  }
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(14, 12), wallMat)
  ceil.rotation.x = Math.PI / 2; ceil.position.set(0, 3.6, 0)
  scene.add(ceil)
  const flr = new THREE.Mesh(new THREE.PlaneGeometry(14, 12), new THREE.MeshStandardMaterial({ color: 0x39424c, roughness: 0.8, metalness: 0.4 }))
  flr.rotation.x = -Math.PI / 2
  scene.add(flr)
  // 警示条纹与气闸门
  const gate = box(3.4, 2.8, 0.3, 0x6a4a2a)
  gate.position.set(0, 1.4, -4)
  scene.add(gate)
  const stripe = box(3.4, 0.18, 0.34, 0xd8a020, 0xd8a020, 0.5)
  stripe.position.set(0, 2.6, -4)
  scene.add(stripe)
  // 舷窗
  for (const s of [-1, 1]) {
    const win = box(1.2, 0.9, 0.1, 0x0a1420, 0x123a5a, 0.8)
    win.position.set(s * 3.95, 1.9, 2)
    scene.add(win)
  }
  const beihai = makeFigure(PALETTES.beihai, true)
  beihai.root.position.set(-1.2, 0, -1)
  const liu = makeFigure(PALETTES.colleagueA, true)
  liu.root.position.set(1.4, 0, -0.2)
  liu.root.rotation.y = -0.7
  const zhao = makeFigure(PALETTES.colleagueB, true)
  zhao.root.position.set(0.2, 0, 1.6)
  zhao.root.rotation.y = Math.PI
  scene.add(beihai.root, liu.root, zhao.root)
  return { scene, beihai, liu, zhao }
}

export function buildEva(): EvaSet {
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x020408)
  scene.add(new THREE.AmbientLight(0x334455, 0.5))
  const sun = new THREE.DirectionalLight(0xfff4e0, 2.2)
  sun.position.set(8, 10, 6)
  scene.add(sun)
  addStars(scene)
  const earth = makeEarth()
  earth.position.set(-34, -30, -50)
  scene.add(earth)
  // 舱体
  const hull = box(8, 4, 4, 0x9aa2ac)
  hull.position.set(0, 2.4, -8)
  scene.add(hull)
  const hatch = box(2, 2.4, 0.2, 0x6a747e)
  hatch.position.set(0, 1.4, -5.9)
  scene.add(hatch)
  const rail = box(10, 0.14, 0.14, 0xb8b0a0)
  rail.position.set(0, 2.2, -5.6)
  scene.add(rail)

  const beihai = makeFigure(PALETTES.beihai, true)
  beihai.root.position.set(-0.9, 0.2, -3.4)
  const liu = makeFigure(PALETTES.colleagueA, true)
  liu.root.position.set(0.8, 0.5, -3.0)
  liu.root.rotation.y = -0.5
  const zhao = makeFigure(PALETTES.colleagueB, true)
  zhao.root.position.set(2.2, 0.8, -3.8)
  scene.add(beihai.root, liu.root, zhao.root)

  // 陨石采样群
  const meteors = makeMeteor(97)
  meteors.position.set(1.8, 1.4, -2.6)
  scene.add(meteors)

  // 陨石子弹枪
  const gun = new THREE.Group()
  const gbody = box(0.34, 0.14, 0.12, 0x3c4046)
  const grip = box(0.12, 0.24, 0.1, 0x282c30)
  grip.position.set(-0.1, -0.16, 0)
  gun.add(gbody, grip)
  gun.position.set(-0.9, 1.28, -3.1)
  gun.rotation.y = -0.4
  scene.add(gun)

  // 中弹漂离的躯体容器
  const bodies = new THREE.Group()
  scene.add(bodies)

  return { scene, beihai, liu, zhao, bodies, gun, meteors }
}

export function buildEnding(): EndingSet {
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x020408)
  scene.add(new THREE.AmbientLight(0x445566, 0.7))
  const sun = new THREE.DirectionalLight(0xfff4e0, 2.0)
  sun.position.set(10, 8, 6)
  scene.add(sun)
  addStars(scene, 1200)
  const earth = makeEarth()
  earth.position.set(-16, -18, -30)
  scene.add(earth)
  const beihai = makeFigure(PALETTES.beihai, true)
  beihai.root.position.set(0, 0, 0)
  beihai.root.rotation.y = Math.PI
  scene.add(beihai.root)
  return { scene, beihai, earth }
}
