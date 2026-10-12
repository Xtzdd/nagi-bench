// 游戏引擎: three.js 场景 + 物理 + 回合状态机 + AI 驱动, 通过 snapshot 桥接 React HUD
import * as THREE from 'three'
import {
  Character, Team, PLAYER_HEIGHT, PLAYER_RADIUS, EYE_HEIGHT, GRAVITY, JUMP_SPEED,
  MOVE_SPEED, ROUND_TIME, BOMB_TIME, DEFUSE_TIME, PLANT_TIME, FREEZE_TIME,
} from './constants'
import { buildWalls, A_SITE, B_SITE, spawnFor, MID_DOOR_GAP } from './map'
import { WEAPONS, T_DEFAULT, CT_DEFAULT } from './weapons'
import { SFX } from './audio'
import { WAYPOINTS, mindOf, decideObjective, advancePath, doorwayAdjust, initBot } from './bots'

export interface KillEvent { id: number; killer: string; victim: string; weapon: string; head: boolean; t: number }
export interface Snapshot {
  phase: 'freeze' | 'live' | 'end'
  phaseEnd: number
  roundNo: number
  pistolRound: boolean
  scoreCT: number
  scoreT: number
  hp: number; armor: number
  weapon: string
  mag: number; reserve: number
  spreadUI: number
  scoped: boolean
  aliveCT: number; aliveT: number
  killfeed: KillEvent[]
  spectators: string[]
  spectating: number | null
  c4Planted: boolean
  c4Timer: number
  hasC4: boolean
  bombA: boolean; bombB: boolean
  roundMsg: string
  playerAlive: boolean
  canPlant: boolean
  canDefuse: boolean
  dots: Array<{ x: number; z: number; team: 'CT' | 'T'; you: boolean }>
}

const NAMES = ['Nova', 'Rex', 'Falcon', 'Ghost', 'Viper', 'Dagger', 'Storm', 'Echo', 'Blaze', 'Frost']

export class Engine {
  scene = new THREE.Scene()
  camera: THREE.PerspectiveCamera
  renderer: THREE.WebGLRenderer
  chars: Character[] = []
  meshes = new Map<number, THREE.Group>()
  wallMeshes: THREE.Mesh[] = []
  keys: Record<string, boolean> = {}
  yaw = 0; pitch = 0
  velY = 0
  onGround = true
  scoped = false
  fireHeld = false
  lastShot = 0
  shotSpread = 0
  reloadUntil = 0
  magAmmo: Record<number, number> = {}
  reserveAmmo: Record<number, number> = {}
  slotPrimary: Record<number, string | null> = {}
  kills: KillEvent[] = []
  killId = 0
  phase: Snapshot['phase'] = 'freeze'
  roundNo = 1
  scoreCT = 0; scoreT = 0
  phaseEnd = 0
  roundMsg = ''
  c4Planted = false
  c4Timer = 0
  c4Pos: { x: number; z: number } | null = null
  c4Mesh: THREE.Mesh | null = null
  plantProgress = 0
  defuseProgress = 0
  spectating: number | null = null
  running = true
  footT = 0
  onSnapshot: (s: Snapshot) => void
  characterRoot = new THREE.Group()

  constructor(container: HTMLElement, onSnapshot: (s: Snapshot) => void) {
    this.onSnapshot = onSnapshot
    this.renderer = new THREE.WebGLRenderer({ antialias: true })
    this.renderer.setSize(innerWidth, innerHeight)
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
    this.renderer.shadowMap.enabled = true
    container.appendChild(this.renderer.domElement)
    this.camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.05, 300)

    this.scene.background = new THREE.Color(0xb8a98a)
    this.scene.fog = new THREE.Fog(0xb8a98a, 60, 180)
    const hemi = new THREE.HemisphereLight(0xfff4e0, 0x8a7a5a, 1.1)
    this.scene.add(hemi)
    const sun = new THREE.DirectionalLight(0xfff0d0, 1.7)
    sun.position.set(40, 70, -30)
    sun.castShadow = true
    sun.shadow.mapSize.set(2048, 2048)
    this.scene.add(sun)
    this.scene.add(this.characterRoot)

    this.buildMap()
    this.initRound(true)

    addEventListener('keydown', e => {
      this.keys[e.code] = true
      if (e.code === 'KeyR') this.tryReload()
      if (e.code === 'Digit1' || e.code === 'Digit2') this.switchSlot(e.code === 'Digit1' ? 'primary' : 'secondary')
      if (e.code === 'Digit3') this.switchSlot('melee')
      if (e.code === 'KeyE') this.use()
    })
    addEventListener('keyup', e => this.keys[e.code] = false)
    addEventListener('mousedown', e => {
      if (document.pointerLockElement !== this.renderer.domElement) return
      if (e.button === 0) this.fireHeld = true
      if (e.button === 2 && this.currentWeapon()?.scope) {
        this.scoped = !this.scoped
        SFX.scope()
      }
    })
    addEventListener('mouseup', e => { if (e.button === 0) this.fireHeld = false })
    addEventListener('contextmenu', e => e.preventDefault())
    this.renderer.domElement.addEventListener('click', () => this.renderer.domElement.requestPointerLock())
    document.addEventListener('mousemove', e => {
      if (document.pointerLockElement !== this.renderer.domElement) return
      const sens = this.scoped ? 0.0006 : 0.0022
      this.yaw -= e.movementX * sens
      this.pitch = Math.max(-1.5, Math.min(1.5, this.pitch - e.movementY * sens))
    })
    addEventListener('resize', () => {
      this.camera.aspect = innerWidth / innerHeight
      this.camera.updateProjectionMatrix()
      this.renderer.setSize(innerWidth, innerHeight)
    })
    this.loop()
  }

  /* ---------- map ---------- */
  buildMap() {
    const mat = new THREE.MeshStandardMaterial({ color: 0xc9b28a, roughness: 0.9 })
    const crateMat = new THREE.MeshStandardMaterial({ color: 0x8a6a42, roughness: 0.85 })
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(96, 72), new THREE.MeshStandardMaterial({ color: 0xa89571, roughness: 0.95 }))
    floor.rotation.x = -Math.PI / 2
    floor.position.set(48, 0, 36)
    floor.receiveShadow = true
    this.scene.add(floor)
    for (const b of buildWalls()) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(b.w, b.h, b.d), b.h < 3 ? crateMat : mat)
      m.position.set(b.x, b.h / 2, b.z)
      m.castShadow = true; m.receiveShadow = true
      this.scene.add(m)
      this.wallMeshes.push(m)
    }
    // 包点标记
    for (const site of [A_SITE, B_SITE]) {
      const ring = new THREE.Mesh(new THREE.RingGeometry(site.r - 0.4, site.r, 40), new THREE.MeshBasicMaterial({ color: 0xff5533, side: THREE.DoubleSide, transparent: true, opacity: 0.55 }))
      ring.rotation.x = -Math.PI / 2
      ring.position.set(site.x, 0.05, site.z)
      this.scene.add(ring)
    }
  }

  /* ---------- characters ---------- */
  buildHuman(team: Team): THREE.Group {
    const g = new THREE.Group()
    const skin = new THREE.MeshStandardMaterial({ color: 0xd8b08c, roughness: 0.8 })
    const cloth = new THREE.MeshStandardMaterial({ color: team === 'CT' ? 0x3a5a9a : 0xb09a3a, roughness: 0.85 })
    const dark = new THREE.MeshStandardMaterial({ color: 0x2a2a2e, roughness: 0.8 })
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.28, 0.26), skin)
    head.position.y = 1.62; head.name = 'head'; g.add(head)
    const helmet = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.1, 0.3), cloth)
    helmet.position.y = 1.74; g.add(helmet)
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.56, 0.26), cloth)
    torso.position.y = 1.18; torso.name = 'chest'; g.add(torso)
    const stomach = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.24, 0.24), dark)
    stomach.position.y = 0.82; stomach.name = 'stomach'; g.add(stomach)
    for (const s of [-1, 1]) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.5, 0.14), cloth)
      arm.position.set(s * 0.3, 1.2, 0); arm.name = 'arm'; g.add(arm)
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.7, 0.18), dark)
      leg.position.set(s * 0.12, 0.35, 0); leg.name = 'leg'; g.add(leg)
    }
    // 持枪姿态: 双臂前伸 + 枪随朝向
    const gun = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, 0.62), dark)
    gun.position.set(0.16, 1.3, 0.4); gun.name = 'gun'; g.add(gun)
    const armR = g.children.find(c => c.name === 'arm') as THREE.Mesh
    void armR
    g.traverse(o => { if (o instanceof THREE.Mesh) { o.castShadow = true } })
    return g
  }

  /* ---------- rounds ---------- */
  pistolRound() { return this.roundNo === 1 || this.roundNo === 13 }

  initRound(first = false) {
    this.phase = 'freeze'
    this.phaseEnd = FREEZE_TIME
    this.c4Planted = false
    this.plantProgress = 0; this.defuseProgress = 0
    if (this.c4Mesh) { this.scene.remove(this.c4Mesh); this.c4Mesh = null }
    this.c4Pos = null
    this.roundMsg = ''

    const playerTeam: Team = this.chars.length ? this.chars.find(c => c.isPlayer)!.team : 'T'
    this.chars = []
    for (const m of this.meshes.values()) this.characterRoot.remove(m)
    this.meshes.clear()

    for (let i = 0; i < 10; i++) {
      const team: Team = i < 5 ? 'T' : 'CT'
      const isPlayer = team === playerTeam && i === 0
      const sp = spawnFor(team, i % 5)
      const c: Character = {
        id: i, team, name: isPlayer ? 'You' : `${NAMES[i]}`,
        pos: { x: sp.x, y: 0, z: sp.z }, yaw: team === 'T' ? Math.PI : 0,
        hp: 100, armor: 0, alive: true, isPlayer,
        weapon: isPlayer ? (team === 'T' ? T_DEFAULT : CT_DEFAULT) : 'ak47',
        money: 800, kills: 0, deaths: 0, hasC4: false, respawnGuard: 0,
      }
      if (isPlayer) {
        this.yaw = c.yaw; this.pitch = 0
        this.magAmmo[i] = WEAPONS[c.weapon].mag
        this.reserveAmmo[i] = WEAPONS[c.weapon].reserve
        this.slotPrimary[i] = null
        this.scoped = false
      }
      this.chars.push(c)
      const mesh = this.buildHuman(team)
      this.characterRoot.add(mesh)
      this.meshes.set(i, mesh)
    }
    // C4 交给随机 T
    const ts = this.chars.filter(c => c.team === 'T')
    ts[Math.floor(Math.random() * ts.length)].hasC4 = true

    for (const c of this.chars) if (!c.isPlayer) { initBot(c.id, c.team); decideObjective(c, false, null) }
    SFX.roundStart()
    void first
  }

  endRound(winner: Team, msg: string) {
    if (this.phase === 'end') return
    this.phase = 'end'
    this.phaseEnd = 5
    this.roundMsg = msg
    if (winner === 'CT') this.scoreCT++; else this.scoreT++
    winner === 'CT' ? SFX.win() : SFX.lose()
    for (const c of this.chars) c.money = Math.min(16000, c.money + 3250)
  }

  /* ---------- collision ---------- */
  moveWithCollision(pos: { x: number; y: number; z: number }, dx: number, dz: number) {
    const r = PLAYER_RADIUS
    pos.x += dx
    for (const b of this.wallBoxes()) {
      if (pos.y >= b.h) continue
      if (pos.x + r > b.minX && pos.x - r < b.maxX && pos.z + r > b.minZ && pos.z - r < b.maxZ) {
        pos.x = dx > 0 ? b.minX - r : b.maxX + r
      }
    }
    pos.z += dz
    for (const b of this.wallBoxes()) {
      if (pos.y >= b.h) continue
      if (pos.x + r > b.minX && pos.x - r < b.maxX && pos.z + r > b.minZ && pos.z - r < b.maxZ) {
        pos.z = dz > 0 ? b.minZ - r : b.maxZ + r
      }
    }
    pos.x = Math.max(1, Math.min(95, pos.x))
    pos.z = Math.max(1, Math.min(71, pos.z))
  }

  private _boxes: Array<{ minX: number; maxX: number; minZ: number; maxZ: number; h: number }> | null = null
  wallBoxes() {
    if (!this._boxes) {
      this._boxes = buildWalls().map(b => ({
        minX: b.x - b.w / 2, maxX: b.x + b.w / 2, minZ: b.z - b.d / 2, maxZ: b.z + b.d / 2, h: b.h,
      }))
    }
    return this._boxes
  }

  /* ---------- shooting ---------- */
  currentWeapon() { return WEAPONS[this.chars[0]?.weapon ?? 'usp'] }

  switchSlot(slot: 'primary' | 'secondary' | 'melee') {
    const p = this.chars[0]
    if (!p?.alive) return
    if (slot === 'primary' && !this.slotPrimary[p.id]) return
    const id = slot === 'primary' ? this.slotPrimary[p.id]! : slot === 'secondary' ? (p.team === 'T' ? T_DEFAULT : CT_DEFAULT) : 'knife'
    if (p.weapon === id) return
    p.weapon = id
    this.magAmmo[p.id] = this.magAmmo[p.id] ?? WEAPONS[id].mag
    this.scoped = false
  }

  tryReload() {
    const p = this.chars[0]
    if (!p?.alive) return
    const w = WEAPONS[p.weapon]
    if (w.mag < 0 || (this.reloadUntil ?? 0) > performance.now()) return
    if ((this.magAmmo[p.id] ?? 0) >= w.mag || (this.reserveAmmo[p.id] ?? 0) <= 0) return
    this.reloadUntil = performance.now() + w.reloadTime * 1000
    SFX.reload()
    setTimeout(() => {
      const need = w.mag - (this.magAmmo[p.id] ?? 0)
      const take = Math.min(need, this.reserveAmmo[p.id] ?? 0)
      this.magAmmo[p.id] = (this.magAmmo[p.id] ?? 0) + take
      this.reserveAmmo[p.id] = (this.reserveAmmo[p.id] ?? 0) - take
    }, w.reloadTime * 1000)
  }

  fire(now: number) {
    const shooter = this.chars[0]
    if (!shooter?.alive || this.phase !== 'live') return
    const w = WEAPONS[shooter.weapon]
    if (now - this.lastShot < 60000 / w.rpm) return
    if ((this.reloadUntil ?? 0) > now) return
    if (w.mag > 0 && (this.magAmmo[shooter.id] ?? 0) <= 0) { this.tryReload(); return }
    this.lastShot = now
    if (w.mag > 0) this.magAmmo[shooter.id]!--
    SFX.shot(shooter.weapon)
    this.shotSpread = Math.min(w.recoilSpread, this.shotSpread + w.spreadPerShot * 6)
    this.pitch += w.recoilPitch * (Math.PI / 180)

    const origin = new THREE.Vector3(shooter.pos.x, shooter.pos.y + EYE_HEIGHT, shooter.pos.z)
    const spread = (w.spread + this.shotSpread * 0.14 + (this.moving() ? w.moveSpread : 0) * (this.scoped ? 0.3 : 1)) * Math.PI / 180 * (this.scoped ? 0.05 : 1)
    const dir = new THREE.Vector3(0, 0, -1).applyEuler(new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ'))
    dir.x += (Math.random() - 0.5) * spread * 2
    dir.y += (Math.random() - 0.5) * spread * 2
    dir.z += (Math.random() - 0.5) * spread * 2
    dir.normalize()
    this.hitscan(origin, dir, shooter, w.damage > 100 ? 200 : 100)
  }

  moving() {
    return Object.keys(this.keys).some(k => ['KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(k) && this.keys[k])
  }

  hitscan(origin: THREE.Vector3, dir: THREE.Vector3, shooter: Character, maxDist: number) {
    // 与墙体求交
    const ray = new THREE.Ray(origin, dir)
    let wallDist = maxDist
    const tmpBox = new THREE.Box3()
    const hitPoint = new THREE.Vector3()
    for (const b of this.wallBoxes()) {
      if (b.h < 1.4) continue // 低箱可越过头部射击, 简化: 低于站位箱视为半掩体
      tmpBox.min.set(b.minX, 0, b.minZ); tmpBox.max.set(b.maxX, b.h, b.maxZ)
      const p = new THREE.Vector3()
      if (ray.intersectBox(tmpBox, p)) {
        const d = p.distanceTo(origin)
        if (d < wallDist) { wallDist = d; hitPoint.copy(p) }
      }
    }
    // 与角色 hitbox 分区求交
    let bestHit: { c: Character; part: string; dist: number } | null = null
    for (const c of this.chars) {
      if (!c.alive || c.team === shooter.team) continue
      const parts: Array<[string, number, number]> = [
        ['head', 1.48, 1.78], ['chest', 0.95, 1.48], ['stomach', 0.7, 0.95], ['leg', 0, 0.7],
      ]
      for (const [part, y0, y1] of parts) {
        tmpBox.min.set(c.pos.x - 0.26, y0, c.pos.z - 0.26)
        tmpBox.max.set(c.pos.x + 0.26, y1, c.pos.z + 0.26)
        const p = new THREE.Vector3()
        if (ray.intersectBox(tmpBox, p)) {
          const d = p.distanceTo(origin)
          if (d < wallDist && (!bestHit || d < bestHit.dist)) bestHit = { c, part, dist: d }
        }
      }
    }
    if (bestHit) {
      const w = WEAPONS[shooter.weapon]
      const part = bestHit.part as 'head' | 'chest' | 'stomach' | 'leg'
      const dmg = applyWeaponDamage(shooter.weapon, part, bestHit.dist)
      bestHit.c.hp -= dmg.hp
      bestHit.c.armor = Math.max(0, bestHit.c.armor - dmg.armorDrain)
      if (shooter.isPlayer) { part === 'head' ? SFX.headshot() : SFX.hit() }
      if (bestHit.c.hp <= 0) this.kill(shooter, bestHit.c, w.id, part === 'head')
    }
  }

  kill(killer: Character, victim: Character, weapon: string, head: boolean) {
    victim.alive = false
    victim.hp = 0
    victim.deaths++
    killer.kills++
    killer.money = Math.min(16000, killer.money + 300)
    if (victim.hasC4) {
      victim.hasC4 = false
      // 炸弹掉落, 可被其他 T 拾取
      const other = this.chars.find(c => c.team === 'T' && c.alive)
      if (other) other.hasC4 = true
    }
    if (victim.isPlayer) {
      const mate = this.chars.find(c => c.team === victim.team && c.alive)
      this.spectating = mate?.id ?? null
    }
    this.kills.unshift({ id: this.killId++, killer: killer.name, victim: victim.name, weapon, head, t: Date.now() })
    this.kills = this.kills.slice(0, 6)
    SFX.kill()
    this.checkRoundEnd()
  }

  checkRoundEnd() {
    if (this.phase !== 'live') return
    const aliveT = this.chars.filter(c => c.team === 'T' && c.alive).length
    const aliveCT = this.chars.filter(c => c.team === 'CT' && c.alive).length
    if (aliveT === 0 && !this.c4Planted) this.endRound('CT', '反恐精英获胜 — 全歼恐怖分子')
    else if (aliveCT === 0) this.endRound('T', '恐怖分子获胜 — 全歼反恐精英')
  }

  /* ---------- use: plant / defuse ---------- */
  use() {
    const p = this.chars[0]
    if (!p?.alive || this.phase !== 'live') return
    if (p.team === 'T' && p.hasC4 && !this.c4Planted) {
      const inA = Math.hypot(p.pos.x - A_SITE.x, p.pos.z - A_SITE.z) < A_SITE.r
      const inB = Math.hypot(p.pos.x - B_SITE.x, p.pos.z - B_SITE.z) < B_SITE.r
      if (inA || inB) {
        this.c4Planted = true
        this.c4Timer = BOMB_TIME
        this.c4Pos = { x: p.pos.x, z: p.pos.z }
        p.hasC4 = false
        this.c4Mesh = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.25, 0.3), new THREE.MeshStandardMaterial({ color: 0x333, emissive: 0xff2200, emissiveIntensity: 0.8 }))
        this.c4Mesh.position.set(p.pos.x, 0.15, p.pos.z)
        this.scene.add(this.c4Mesh)
        SFX.plant()
        this.roundMsg = 'C4 已安放'
        setTimeout(() => { if (this.roundMsg === 'C4 已安放') this.roundMsg = '' }, 2000)
      }
    }
  }

  explode() {
    SFX.explosion()
    this.endRound('T', 'C4 爆炸 — 恐怖分子获胜')
  }

  /* ---------- bots ---------- */
  botLOS(a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }): boolean {
    const o = new THREE.Vector3(a.x, a.y + 1.4, a.z)
    const dir = new THREE.Vector3(b.x - a.x, (b.y + 1.3) - (a.y + 1.4), b.z - a.z)
    const dist = dir.length(); dir.normalize()
    const ray = new THREE.Ray(o, dir)
    const box = new THREE.Box3(); const p = new THREE.Vector3()
    for (const w of this.wallBoxes()) {
      if (w.h < 1.3) continue
      box.min.set(w.minX, 0, w.minZ); box.max.set(w.maxX, w.h, w.maxZ)
      if (ray.intersectBox(box, p) && p.distanceTo(o) < dist) return false
    }
    return true
  }

  updateBots(dt: number, now: number) {
    for (const c of this.chars) {
      if (c.isPlayer || !c.alive || this.phase !== 'live') continue
      const m = mindOf(c.id)
      // 索敌
      let enemy: Character | null = null
      let bd = Infinity
      for (const e of this.chars) {
        if (!e.alive || e.team === c.team) continue
        const d = Math.hypot(e.pos.x - c.pos.x, e.pos.z - c.pos.z)
        if (d < 46 && d < bd && this.botLOS(c.pos, e.pos)) { enemy = e; bd = d }
      }
      if (enemy) {
        m.enemy = enemy.id
        m.reactT = m.reactT || now + 180 + Math.random() * 260
        // 面向敌人
        const dy = Math.atan2(enemy.pos.x - c.pos.x, enemy.pos.z - c.pos.z)
        c.yaw = dy + Math.PI
        if (now > m.reactT) {
          const w = WEAPONS[c.weapon]
          if (now - (m.fireT ?? 0) > 60000 / w.rpm * (1 + Math.random() * 0.4)) {
            m.fireT = now
            SFX.shot(c.weapon, bd)
            // 命中判定: 距离衰减 + 随机
            const acc = Math.max(0.18, 0.62 - bd / 90 - (this.moving() ? 0 : 0))
            if (Math.random() < acc) {
              const roll = Math.random()
              const part = roll < 0.14 ? 'head' : roll < 0.62 ? 'chest' : roll < 0.78 ? 'stomach' : 'leg'
              const dmg = applyWeaponDamage(c.weapon, part as 'head', bd)
              enemy.hp -= dmg.hp
              if (enemy.isPlayer) SFX.hit()
              if (enemy.hp <= 0) this.kill(c, enemy, c.weapon, part === 'head')
            }
          }
        }
        // 交战走位
        const strafeDir = m.strafe
        this.moveWithCollision(c.pos, Math.cos(c.yaw) * strafeDir * 2.4 * dt, -Math.sin(c.yaw) * strafeDir * 2.4 * dt)
        if (Math.random() < 0.008) m.strafe *= -1
        continue
      }
      m.enemy = null; m.reactT = 0
      // 无敌人: 推进目标
      if (!m.target) { decideObjective(c, this.c4Planted, this.c4Pos); continue }
      const wp = WAYPOINTS[m.target]
      let dirX = wp.x - c.pos.x, dirZ = wp.z - c.pos.z
      const adj = doorwayAdjust(c.pos.x, c.pos.z)
      dirX += (adj.x - c.pos.x) * 0.5; dirZ += (adj.z - c.pos.z) * 0.5
      const len = Math.hypot(dirX, dirZ) || 1
      const sp = 5.2
      this.moveWithCollision(c.pos, dirX / len * sp * dt, dirZ / len * sp * dt)
      c.yaw = Math.atan2(dirX, dirZ)
      // 脚步声(距离玩家近时)
      const pd = Math.hypot(c.pos.x - this.chars[0].pos.x, c.pos.z - this.chars[0].pos.z)
      if (pd < 14 && Math.random() < 0.06) SFX.footstep()
      // 下包
      if (m.goal === 'plant' && c.hasC4 && this.phase === 'live') {
        const inA = Math.hypot(c.pos.x - A_SITE.x, c.pos.z - A_SITE.z) < A_SITE.r
        const inB = Math.hypot(c.pos.x - B_SITE.x, c.pos.z - B_SITE.z) < B_SITE.r
        if (inA || inB) {
          this.plantProgress += dt
          if (this.plantProgress >= PLANT_TIME / 2) {
            this.c4Planted = true; this.c4Timer = BOMB_TIME
            this.c4Pos = { x: c.pos.x, z: c.pos.z }
            c.hasC4 = false
            this.c4Mesh = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.25, 0.3), new THREE.MeshStandardMaterial({ color: 0x333, emissive: 0xff2200, emissiveIntensity: 0.8 }))
            this.c4Mesh.position.set(c.pos.x, 0.15, c.pos.z)
            this.scene.add(this.c4Mesh)
            SFX.plant()
          }
        }
      }
      // 拆包
      if (this.c4Planted && c.team === 'CT' && this.c4Pos) {
        const d = Math.hypot(c.pos.x - this.c4Pos.x, c.pos.z - this.c4Pos.z)
        if (d < 1.6) {
          this.defuseProgress += dt
          if (Math.random() < 0.1) SFX.defuseTick()
          if (this.defuseProgress >= DEFUSE_TIME) {
            SFX.defused()
            this.endRound('CT', 'C4 已拆除 — 反恐精英获胜')
          }
        }
      }
    }
  }

  /* ---------- main loop ---------- */
  private last = performance.now()
  loop = () => {
    if (!this.running) return
    requestAnimationFrame(this.loop)
    const now = performance.now()
    const dt = Math.min((now - this.last) / 1000, 0.05)
    this.last = now

    // 阶段推进
    if (this.phase === 'freeze') {
      this.phaseEnd -= dt
      if (this.phaseEnd <= 0) { this.phase = 'live'; this.phaseEnd = ROUND_TIME; this.roundMsg = '' }
    } else if (this.phase === 'live') {
      this.phaseEnd -= dt
      if (this.c4Planted) {
        this.c4Timer -= dt
        const urgent = this.c4Timer < 10
        if (Math.floor(this.c4Timer * 2) !== Math.floor((this.c4Timer + dt) * 2)) SFX.bombBeep(urgent)
        if (this.c4Timer <= 0) this.explode()
      } else if (this.phaseEnd <= 0) {
        this.endRound('CT', '时间耗尽 — 反恐精英获胜')
      }
    } else if (this.phase === 'end') {
      this.phaseEnd -= dt
      if (this.phaseEnd <= 0) { this.roundNo++; this.initRound() }
    }

    // 玩家控制(存活或观战接管)
    const p = this.chars[0]
    const ctrl = p.alive ? p : (this.spectating !== null ? this.chars[this.spectating] : null)
    if (this.phase === 'live' && ctrl) {
      const speed = (this.keys['ShiftLeft'] ? MOVE_SPEED * 0.48 : MOVE_SPEED) * (this.scoped ? 0.4 : 1)
      const f = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw))
      const r = new THREE.Vector3(-f.z, 0, f.x)
      let mx = 0, mz = 0
      if (this.keys['KeyW']) { mx += f.x; mz += f.z }
      if (this.keys['KeyS']) { mx -= f.x; mz -= f.z }
      if (this.keys['KeyD']) { mx += r.x; mz += r.z }
      if (this.keys['KeyA']) { mx -= r.x; mz -= r.z }
      const len = Math.hypot(mx, mz)
      if (len > 0) {
        this.moveWithCollision(ctrl.pos, mx / len * speed * dt, mz / len * speed * dt)
        ctrl.yaw = this.yaw
        this.footT += dt * speed
        if (this.footT > 2.2) { this.footT = 0; SFX.footstep() }
      }
      if (this.keys['Space'] && this.onGround) { this.velY = JUMP_SPEED; this.onGround = false }
      this.velY -= GRAVITY * dt
      ctrl.pos.y += this.velY * dt
      if (ctrl.pos.y <= 0) { ctrl.pos.y = 0; this.velY = 0; this.onGround = true }
      if (this.fireHeld) {
        const w = WEAPONS[ctrl.weapon]
        if (w.auto || !this._semiLatch) { this.fire(now); this._semiLatch = true }
      } else this._semiLatch = false
      this.shotSpread = Math.max(0, this.shotSpread - dt * 18)
    }

    this.updateBots(dt, now)

    // 同步网格
    for (const c of this.chars) {
      const g = this.meshes.get(c.id)
      if (!g) continue
      g.visible = c.alive
      if (c.alive) {
        g.position.set(c.pos.x, c.pos.y, c.pos.z)
        g.rotation.y = c.yaw
      }
    }

    // 相机: 第一人称 / 观战
    if (ctrl) {
      const eyeY = ctrl.pos.y + (ctrl.isPlayer ? EYE_HEIGHT : 1.6)
      if (ctrl.isPlayer) {
        this.camera.position.set(ctrl.pos.x, eyeY, ctrl.pos.z)
        this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ')
        const baseFov = 75
        this.camera.fov += ((this.scoped ? 22 : baseFov) - this.camera.fov) * Math.min(1, dt * 14)
        this.camera.updateProjectionMatrix()
      } else {
        const t = new THREE.Vector3(ctrl.pos.x, eyeY, ctrl.pos.z)
        this.camera.position.lerp(t, Math.min(1, dt * 6))
        this.camera.lookAt(ctrl.pos.x + -Math.sin(ctrl.yaw) * 4, eyeY, ctrl.pos.z + -Math.cos(ctrl.yaw) * 4)
      }
    }

    this.onSnapshot(this.snapshot())
    this.renderer.render(this.scene, this.camera)
  }
  private _semiLatch = false

  snapshot(): Snapshot {
    const p = this.chars[0]
    const w = p ? WEAPONS[p.weapon] : WEAPONS.usp
    const ctrlAlive = p?.alive
    return {
      phase: this.phase,
      phaseEnd: this.phaseEnd,
      roundNo: this.roundNo,
      pistolRound: this.pistolRound(),
      scoreCT: this.scoreCT, scoreT: this.scoreT,
      hp: Math.max(0, p?.hp ?? 0), armor: p?.armor ?? 0,
      weapon: p?.weapon ?? 'usp',
      mag: this.magAmmo[p?.id ?? 0] ?? 0,
      reserve: this.reserveAmmo[p?.id ?? 0] ?? 0,
      spreadUI: w.recoilSpread ? this.shotSpread / w.recoilSpread : 0,
      scoped: this.scoped,
      aliveCT: this.chars.filter(c => c.team === 'CT' && c.alive).length,
      aliveT: this.chars.filter(c => c.team === 'T' && c.alive).length,
      killfeed: this.kills,
      spectators: this.chars.filter(c => c.team === p?.team && c.alive && !c.isPlayer).map(c => c.name),
      spectating: !ctrlAlive ? this.spectating : null,
      c4Planted: this.c4Planted,
      c4Timer: Math.max(0, this.c4Timer),
      hasC4: p?.hasC4 ?? false,
      bombA: !!this.c4Pos && Math.hypot(this.c4Pos.x - A_SITE.x, this.c4Pos.z - A_SITE.z) < A_SITE.r,
      bombB: !!this.c4Pos && Math.hypot(this.c4Pos.x - B_SITE.x, this.c4Pos.z - B_SITE.z) < B_SITE.r,
      roundMsg: this.roundMsg,
      playerAlive: !!ctrlAlive,
      canPlant: !!(p?.alive && p.team === 'T' && p.hasC4 && !this.c4Planted &&
        (Math.hypot(p.pos.x - A_SITE.x, p.pos.z - A_SITE.z) < A_SITE.r || Math.hypot(p.pos.x - B_SITE.x, p.pos.z - B_SITE.z) < B_SITE.r)),
      canDefuse: !!(p?.alive && p.team === 'CT' && this.c4Planted && this.c4Pos &&
        Math.hypot(p.pos.x - this.c4Pos.x, p.pos.z - this.c4Pos.z) < 1.6),
      dots: this.chars.filter(c => c.alive).map(c => ({ x: c.pos.x, z: c.pos.z, team: c.team, you: c.isPlayer })),
    }
  }

  dispose() {
    this.running = false
    this.renderer.dispose()
    this.renderer.domElement.remove()
  }
}

// 独立的伤害计算(避免与 weapons.ts 的 applyDamage 双份护甲逻辑)
function applyWeaponDamage(weaponId: string, part: 'head' | 'chest' | 'stomach' | 'arm' | 'leg', dist: number) {
  const w = WEAPONS[weaponId]
  const partMult = { head: w.headMult, chest: 1, stomach: 1.25, arm: 0.75, leg: 0.55 }[part]
  let dmg = w.damage * partMult
  dmg *= Math.max(0.55, 1 - dist * 0.0025)
  let armorDrain = 0
  if (part === 'head') dmg *= 1 // 爆头统一 2 倍已在 headMult
  return { hp: Math.round(dmg), armorDrain: Math.round(dmg * (1 - w.armorPen) * 0.4) }
}
