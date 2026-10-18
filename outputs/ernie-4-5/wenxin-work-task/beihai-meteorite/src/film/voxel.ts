import * as THREE from 'three'

// Reusable materials
const matCache = new Map<string, THREE.Material>()
function M(color: number | string, opts: Partial<THREE.MeshStandardMaterialParameters> = {}) {
  const key = `${color}-${JSON.stringify(opts)}`
  if (matCache.has(key)) return matCache.get(key) as THREE.MeshStandardMaterial
  const m = new THREE.MeshStandardMaterial({
    color: new THREE.Color(color as any),
    roughness: 0.75,
    metalness: 0.1,
    ...opts
  })
  matCache.set(key, m)
  return m
}

export const materials = {
  skinHead: M(0xe8c095),
  black: M(0x1a1a1a),
  dark: M(0x2a2d33),
  white: M(0xe6e8ec),
  grey: M(0x6c7078),
  beige: M(0xd7c6a6),
  brown: M(0x6b4a2b),
  blue: M(0x3a6fa8),
  red: M(0x9c2f2a),
  darkSuit: M(0x181a20, { roughness: 0.6, metalness: 0.3 }),
  whiteSuit: M(0xe0e4ea, { roughness: 0.4, metalness: 0.4 }),
  greySuit: M(0x98a0ab, { roughness: 0.4, metalness: 0.4 }),
  crewSuit: M(0xf2d08b, { roughness: 0.5, metalness: 0.2 }),
  metal: M(0x444852, { roughness: 0.35, metalness: 0.85 }),
  meteorite: M(0x2b2622, { roughness: 0.9, metalness: 0.2 }),
  meteoriteLight: M(0x4a3a2e, { roughness: 0.85, metalness: 0.25 }),
  glass: new THREE.MeshStandardMaterial({
    color: 0x5a7fa8, transparent: true, opacity: 0.28,
    roughness: 0.05, metalness: 0.2, side: THREE.DoubleSide
  }),
  glow: (color: number) => new THREE.MeshBasicMaterial({ color }),
  earth: null as any, // filled later
  space: null as any
}

// voxel unit = 1
export function createVoxelCharacter(outfit: 'beihai' | 'old_white' | 'old_grey' | 'old_crew' = 'beihai') {
  const g = new THREE.Group()

  const suitColor =
    outfit === 'beihai' ? materials.darkSuit :
    outfit === 'old_white' ? materials.whiteSuit :
    outfit === 'old_grey' ? materials.greySuit :
    materials.crewSuit

  // head
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.55, 0.55), materials.skinHead)
  head.position.y = 1.68
  head.castShadow = true
  g.add(head)
  // hair / cap
  const hair = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.2, 0.58),
    outfit === 'beihai' ? materials.black : materials.dark)
  hair.position.y = 1.88
  g.add(hair)
  // torso
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.9, 0.45), suitColor)
  torso.position.y = 1.0
  torso.castShadow = true
  g.add(torso)
  // backpack / life support
  if (outfit === 'beihai') {
    const pack = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.6, 0.25), materials.metal)
    pack.position.set(0, 1.05, -0.35)
    g.add(pack)
  } else {
    const pack = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.65, 0.3), materials.whiteSuit)
    pack.position.set(0, 1.05, -0.38)
    g.add(pack)
  }
  // arms
  const armGeom = new THREE.BoxGeometry(0.22, 0.8, 0.22)
  const lArm = new THREE.Mesh(armGeom, suitColor)
  lArm.position.set(-0.48, 1.05, 0)
  lArm.castShadow = true
  g.add(lArm)
  const rArm = new THREE.Mesh(armGeom, suitColor)
  rArm.position.set(0.48, 1.05, 0)
  rArm.castShadow = true
  g.add(rArm)
  // legs
  const legGeom = new THREE.BoxGeometry(0.26, 0.75, 0.28)
  const lLeg = new THREE.Mesh(legGeom, materials.black)
  lLeg.position.set(-0.18, 0.38, 0)
  lLeg.castShadow = true
  g.add(lLeg)
  const rLeg = new THREE.Mesh(legGeom, materials.black)
  rLeg.position.set(0.18, 0.38, 0)
  rLeg.castShadow = true
  g.add(rLeg)

  // visor highlight for suits
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.16, 0.04),
    new THREE.MeshStandardMaterial({ color: 0x3b5e8c, emissive: 0x15273a, roughness: 0.2, metalness: 0.6 }))
  visor.position.set(0, 1.68, 0.3)
  g.add(visor)

  g.userData = { head, torso, lArm, rArm, lLeg, rLeg, visor }
  return g
}

export function createVoxelGun() {
  const g = new THREE.Group()
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.18, 0.9), materials.metal)
  body.position.z = 0
  g.add(body)
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.3, 0.16), materials.black)
  grip.position.set(0, -0.22, 0.1)
  g.add(grip)
  const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.4), materials.dark)
  barrel.position.set(0, 0.02, -0.55)
  g.add(barrel)
  const scope = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.09, 0.25), materials.black)
  scope.position.set(0, 0.14, -0.05)
  g.add(scope)
  const mag = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.2, 0.12), materials.metal)
  mag.position.set(0, -0.25, -0.1)
  g.add(mag)
  g.traverse(o => { if ((o as THREE.Mesh).isMesh) { (o as THREE.Mesh).castShadow = true } })
  return g
}

export function createMeteorBullet(seed = 0) {
  const g = new THREE.Group()
  const size = 0.14 + (seed % 3) * 0.01
  const core = new THREE.Mesh(new THREE.BoxGeometry(size, size, size * 1.6), materials.meteorite)
  g.add(core)
  // lumpy bits
  for (let i = 0; i < 5; i++) {
    const s = size * (0.35 + Math.random() * 0.4)
    const m = new THREE.Mesh(new THREE.BoxGeometry(s, s, s),
      Math.random() < 0.5 ? materials.meteorite : materials.meteoriteLight)
    m.position.set(
      (Math.random() - 0.5) * size * 1.3,
      (Math.random() - 0.5) * size * 1.3,
      (Math.random() - 0.5) * size * 2.2
    )
    m.rotation.set(Math.random(), Math.random(), Math.random())
    g.add(m)
  }
  g.traverse(o => { if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).castShadow = true })
  return g
}

export function createMeteoriteRaw() {
  const g = new THREE.Group()
  for (let i = 0; i < 12; i++) {
    const s = 0.15 + Math.random() * 0.25
    const m = new THREE.Mesh(new THREE.BoxGeometry(s, s, s), Math.random() < 0.5 ? materials.meteorite : materials.meteoriteLight)
    m.position.set((Math.random() - 0.5) * 0.8, (Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 0.8)
    m.rotation.set(Math.random(), Math.random(), Math.random())
    g.add(m)
  }
  return g
}

export function createVoxelRoom(w: number, h: number, d: number, wallMat: THREE.Material) {
  const g = new THREE.Group()
  const floor = new THREE.Mesh(new THREE.BoxGeometry(w, 0.2, d), materials.dark)
  floor.position.y = -0.1
  floor.receiveShadow = true
  g.add(floor)
  // walls: left/right/back
  const makeWall = (x: number, y: number, z: number, pw: number, ph: number, pd: number) => {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(pw, ph, pd), wallMat)
    wall.position.set(x, y, z); wall.receiveShadow = true
    return wall
  }
  g.add(makeWall(0, h / 2, -d / 2, w, h, 0.2))
  g.add(makeWall(-w / 2, h / 2, 0, 0.2, h, d))
  g.add(makeWall(w / 2, h / 2, 0, 0.2, h, d))
  return g
}

export function createVoxelWorkshop() {
  const g = new THREE.Group()
  // concrete room
  const room = createVoxelRoom(10, 4, 10, materials.grey)
  g.add(room)
  // workbench
  const bench = new THREE.Mesh(new THREE.BoxGeometry(3, 0.15, 1.4), materials.metal)
  bench.position.set(0, 1.0, 0)
  bench.castShadow = true
  bench.receiveShadow = true
  g.add(bench)
  const leg1 = new THREE.Mesh(new THREE.BoxGeometry(0.15, 1.0, 0.15), materials.metal)
  leg1.position.set(-1.4, 0.5, -0.6)
  const leg2 = leg1.clone(); leg2.position.x = 1.4
  const leg3 = leg1.clone(); leg3.position.z = 0.6
  const leg4 = leg2.clone(); leg4.position.z = 0.6
  g.add(leg1, leg2, leg3, leg4)

  // lathe machine
  const lathe = new THREE.Group()
  const base = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.5, 0.8), materials.metal)
  base.position.y = 0.25
  lathe.add(base)
  const headstock = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.6, 0.5), materials.dark)
  headstock.position.set(-0.3, 0.75, 0)
  lathe.add(headstock)
  const chuck = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.3, 0.3), materials.metal)
  chuck.position.set(-0.05, 0.78, 0)
  lathe.add(chuck)
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), materials.metal)
  tail.position.set(0.4, 0.7, 0)
  lathe.add(tail)
  lathe.position.set(-1.0, 1.08, 0)
  g.add(lathe)
  g.userData.lathe = lathe

  // desk lamp
  const lamp = new THREE.Group()
  const lp = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.8, 0.2), materials.black)
  lp.position.y = 0.4
  lamp.add(lp)
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.15, 0.3), materials.black)
  head.position.set(0.2, 0.85, 0)
  head.rotation.z = -0.4
  lamp.add(head)
  const bulb = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.05, 0.2), materials.glow(0xfff0b0))
  bulb.position.set(0.4, 0.78, 0)
  bulb.rotation.z = -0.4
  lamp.add(bulb)
  const lampLight = new THREE.PointLight(0xffe0a0, 1.4, 6, 1.5)
  lampLight.position.set(0.4, 0.8, 0)
  lamp.add(lampLight)
  lamp.position.set(1.2, 1.08, 0.3)
  g.add(lamp)
  g.userData.lamp = lamp

  // raw meteorite on bench
  const rock = createMeteoriteRaw()
  rock.position.set(0.4, 1.2, -0.1)
  rock.scale.set(0.9, 0.9, 0.9)
  g.add(rock)
  g.userData.rock = rock

  return g
}

export function createVoxelSpaceStation() {
  // corridor + observation deck in one group
  const g = new THREE.Group()
  const corridor = createVoxelCorridor()
  g.add(corridor)
  const deck = createVoxelObservationDeck()
  deck.position.z = -6
  g.add(deck)
  return g
}

export function createVoxelCorridor() {
  const g = new THREE.Group()
  const w = 3.2, h = 3.2, d = 12
  const floor = new THREE.Mesh(new THREE.BoxGeometry(w, 0.1, d), materials.dark)
  floor.position.y = -0.05
  floor.receiveShadow = true
  g.add(floor)
  // ceiling
  const ceil = new THREE.Mesh(new THREE.BoxGeometry(w, 0.1, d), materials.grey)
  ceil.position.y = h + 0.05
  g.add(ceil)
  // walls
  const wallL = new THREE.Mesh(new THREE.BoxGeometry(0.1, h, d), materials.grey)
  wallL.position.set(-w / 2, h / 2, 0)
  g.add(wallL)
  const wallR = wallL.clone()
  wallR.position.x = w / 2
  g.add(wallR)
  // light strips on ceiling
  for (let i = -1; i <= 1; i++) {
    const strip = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.05, 2.0), materials.glow(0xbfd4ff))
    strip.position.set(0, h, i * 3.5)
    g.add(strip)
    const pl = new THREE.PointLight(0xbfd4ff, 0.45, 7, 2)
    pl.position.set(0, h - 0.2, i * 3.5)
    g.add(pl)
  }
  // panels on walls
  for (let z = -4; z <= 4; z += 2) {
    const p1 = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.6, 0.8), materials.metal)
    p1.position.set(-w / 2 - 0.02, 1.3, z)
    g.add(p1)
    const p2 = p1.clone(); p2.position.x = w / 2 + 0.02
    g.add(p2)
  }
  return g
}

export function createVoxelObservationDeck() {
  const g = new THREE.Group()
  const w = 9, h = 3.2, d = 5
  // Deck connects to corridor at +z face; window faces -z (deep space).
  const floor = new THREE.Mesh(new THREE.BoxGeometry(w, 0.1, d), materials.dark)
  floor.position.y = -0.05
  floor.receiveShadow = true
  g.add(floor)
  const ceil = new THREE.Mesh(new THREE.BoxGeometry(w, 0.1, d), materials.grey)
  ceil.position.y = h + 0.05
  g.add(ceil)
  const wallL = new THREE.Mesh(new THREE.BoxGeometry(0.1, h, d), materials.grey)
  wallL.position.set(-w / 2, h / 2, 0)
  g.add(wallL)
  const wallR = wallL.clone()
  wallR.position.x = w / 2
  g.add(wallR)
  // opening facing corridor (+z side) has top beam + side columns
  const entryTop = new THREE.Mesh(new THREE.BoxGeometry(w, 0.6, 0.1), materials.grey)
  entryTop.position.set(0, h - 0.3, d / 2)
  g.add(entryTop)
  const entryL = new THREE.Mesh(new THREE.BoxGeometry(1.2, h, 0.1), materials.grey)
  entryL.position.set(-(w / 2 - 0.6), h / 2, d / 2)
  g.add(entryL)
  const entryR = entryL.clone(); entryR.position.x = (w / 2 - 0.6)
  g.add(entryR)

  // huge view window on -z face (deep space)
  const glassPane = new THREE.Mesh(new THREE.BoxGeometry(6.4, 2.4, 0.08), materials.glass)
  glassPane.position.set(0, 1.5, -d / 2 + 0.05)
  g.add(glassPane)
  g.userData.glass = glassPane

  // window frame
  const f1 = new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.15, 0.2), materials.metal)
  f1.position.set(0, 2.7, -d / 2)
  const f2 = f1.clone(); f2.position.y = 0.3
  const f3 = new THREE.Mesh(new THREE.BoxGeometry(0.15, 2.6, 0.2), materials.metal)
  f3.position.set(-3.2, 1.5, -d / 2)
  const f4 = f3.clone(); f4.position.x = 3.2
  g.add(f1, f2, f3, f4)

  // console / railing inside, in front of window
  const rail = new THREE.Mesh(new THREE.BoxGeometry(6.0, 0.1, 0.2), materials.metal)
  rail.position.set(0, 1.0, -d / 2 + 0.6)
  g.add(rail)
  const railPostGeom = new THREE.BoxGeometry(0.1, 1.0, 0.1)
  for (let x = -2.5; x <= 2.5; x += 1.25) {
    const p = new THREE.Mesh(railPostGeom, materials.metal)
    p.position.set(x, 0.5, -d / 2 + 0.6)
    g.add(p)
  }

  return g
}

export function createVoxelToilet() {
  const g = new THREE.Group()
  const room = createVoxelRoom(2.4, 2.6, 2.4, materials.white)
  g.add(room)
  const stall = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.6, 1.2), materials.grey)
  stall.position.set(-0.4, 0.8, -0.6)
  g.add(stall)
  const toilet = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.4, 0.7), materials.white)
  toilet.position.set(-0.7, 0.2, -0.8)
  g.add(toilet)
  return g
}

export function createEarth() {
  // cube-ish earth (voxel style) but smooth shading through many blocks? keep it as single sphere with flat bands.
  const group = new THREE.Group()
  const geo = new THREE.SphereGeometry(2.0, 24, 18)
  const mat = new THREE.MeshStandardMaterial({ color: 0x2a5fa8, roughness: 0.85, metalness: 0.0, flatShading: true })
  const body = new THREE.Mesh(geo, mat)
  group.add(body)
  // rough continents via small boxes
  const contMat = new THREE.MeshStandardMaterial({ color: 0x3a8a4a, roughness: 0.9, flatShading: true })
  const contData = [
    [0.4, 1.0, 0.9], [-0.8, 0.4, -1.3], [-1.2, 0.8, 0.6],
    [1.2, 0.6, -0.8], [0.2, -0.6, 1.4], [-0.3, -1.0, -0.8], [1.5, -0.2, 0.5]
  ]
  contData.forEach(([x, y, z]) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.5, 0.5), contMat)
    // position on sphere surface
    const len = Math.sqrt(x * x + y * y + z * z)
    b.position.set(x / len * 2.05, y / len * 2.05, z / len * 2.05)
    b.lookAt(0, 0, 0)
    group.add(b)
  })
  // cloud band
  const clouds = new THREE.Mesh(new THREE.SphereGeometry(2.12, 16, 12),
    new THREE.MeshStandardMaterial({ color: 0xdde6ef, transparent: true, opacity: 0.35, flatShading: true }))
  group.add(clouds)
  group.userData.clouds = clouds
  return group
}

export function createStarfield(count = 1500) {
  const positions = new Float32Array(count * 3)
  for (let i = 0; i < count; i++) {
    const r = 120 + Math.random() * 40
    const theta = Math.random() * Math.PI * 2
    const phi = Math.acos(2 * Math.random() - 1)
    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta)
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta)
    positions[i * 3 + 2] = r * Math.cos(phi)
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  const mat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.6, sizeAttenuation: true })
  return new THREE.Points(geo, mat)
}

// Crack decal on glass (simple overlay plane with generated texture)
export function createGlassCrack() {
  const c = document.createElement('canvas')
  c.width = 256; c.height = 256
  const ctx = c.getContext('2d')!
  ctx.clearRect(0, 0, 256, 256)
  ctx.strokeStyle = 'rgba(220,230,240,0.85)'
  ctx.lineWidth = 1
  const drawLine = (x1: number, y1: number, x2: number, y2: number) => {
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke()
  }
  const center = [128, 128]
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2 + Math.random() * 0.3
    const len = 40 + Math.random() * 90
    const x = center[0] + Math.cos(a) * len
    const y = center[1] + Math.sin(a) * len
    drawLine(center[0], center[1], x, y)
    // branches
    for (let j = 0; j < 2; j++) {
      const tt = 0.4 + Math.random() * 0.5
      const bx = center[0] + (x - center[0]) * tt
      const by = center[1] + (y - center[1]) * tt
      const a2 = a + (Math.random() - 0.5) * 1.2
      const bl = 15 + Math.random() * 30
      drawLine(bx, by, bx + Math.cos(a2) * bl, by + Math.sin(a2) * bl)
    }
  }
  const tex = new THREE.CanvasTexture(c)
  tex.anisotropy = 4
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false })
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 2.4), mat)
  mesh.visible = false
  return mesh
}

// spark particles system
export function createSparkSystem(max = 80) {
  const positions = new Float32Array(max * 3)
  const velocities = new Float32Array(max * 3)
  const life = new Float32Array(max)
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  const mat = new THREE.PointsMaterial({ color: 0xffcc55, size: 0.08, transparent: true, opacity: 0.9 })
  const pts = new THREE.Points(geo, mat)
  pts.userData = { velocities, life, max, active: 0 }
  return pts
}

export function emitSparks(sys: THREE.Points, origin: THREE.Vector3, count: number, spread = 1.0) {
  const ud = sys.userData as any
  const posAttr = (sys.geometry.getAttribute('position') as THREE.BufferAttribute)
  const positions = posAttr.array as Float32Array
  for (let i = 0; i < count; i++) {
    const idx = ud.active % ud.max
    ud.active++
    positions[idx * 3] = origin.x
    positions[idx * 3 + 1] = origin.y
    positions[idx * 3 + 2] = origin.z
    ud.velocities[idx * 3] = (Math.random() - 0.5) * spread * 2
    ud.velocities[idx * 3 + 1] = (Math.random() - 0.2) * spread * 2
    ud.velocities[idx * 3 + 2] = (Math.random() - 0.5) * spread * 2
    ud.life[idx] = 0.6 + Math.random() * 0.4
  }
  posAttr.needsUpdate = true
}

export function updateSparks(sys: THREE.Points, dt: number) {
  const ud = sys.userData as any
  const posAttr = (sys.geometry.getAttribute('position') as THREE.BufferAttribute)
  const positions = posAttr.array as Float32Array
  for (let i = 0; i < ud.max; i++) {
    if (ud.life[i] <= 0) continue
    ud.life[i] -= dt
    positions[i * 3] += ud.velocities[i * 3] * dt
    positions[i * 3 + 1] += ud.velocities[i * 3 + 1] * dt
    positions[i * 3 + 2] += ud.velocities[i * 3 + 2] * dt
    ud.velocities[i * 3 + 1] -= 3.0 * dt // gravity-ish
  }
  posAttr.needsUpdate = true
}
