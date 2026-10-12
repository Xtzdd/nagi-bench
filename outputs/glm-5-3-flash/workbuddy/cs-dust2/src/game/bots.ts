// Bot AI: waypoint 寻路 + 视线索敌 + 交战 + 下包/拆包
import type { Character, Team } from './constants'
import { A_SITE, B_SITE, MID_DOOR_GAP } from './map'

export interface Waypoint { x: number; z: number; links: number[]; zone: string }

// Dust2 路径图(手工布点): 覆盖 T spawn / long A / A site / mid+中门 / catwalk / B tun / B site / CT spawn
export const WAYPOINTS: Waypoint[] = [
  /* 0 */ { x: 82, z: 62, links: [1, 3], zone: 'tspawn' },
  /* 1 */ { x: 79, z: 52, links: [0, 2], zone: 'longA' },
  /* 2 */ { x: 79, z: 26, links: [1, 4], zone: 'longA' },
  /* 3 */ { x: 72, z: 58, links: [0, 6], zone: 'tspawn' },
  /* 4 */ { x: 66, z: 14, links: [2, 5, 8], zone: 'asite' },
  /* 5 */ { x: 62, z: 15, links: [4, 8], zone: 'asite' },
  /* 6 */ { x: 62, z: 56, links: [3, 7], zone: 'mid' },
  /* 7 */ { x: 48, z: 48, links: [6, 9], zone: 'mid' },
  /* 8 */ { x: 60, z: 15, links: [4, 5, 10], zone: 'catwalk' },
  /* 9 */ { x: 48, z: 38, links: [7, 10], zone: 'doors' },   // 中门门洞处
  /* 10 */ { x: 48, z: 20, links: [9, 11, 8], zone: 'mid' },
  /* 11 */ { x: 38, z: 12, links: [10, 12], zone: 'ctspawn' },
  /* 12 */ { x: 34, z: 10, links: [11, 13], zone: 'ctspawn' },
  /* 13 */ { x: 26, z: 14, links: [12, 14], zone: 'bsite' },
  /* 14 */ { x: 16, z: 19, links: [13, 15, 16], zone: 'bsite' },
  /* 15 */ { x: 10, z: 30, links: [14, 17], zone: 'bsite' },
  /* 16 */ { x: 14, z: 40, links: [14, 17], zone: 'btunn' },
  /* 17 */ { x: 13, z: 56, links: [16, 18], zone: 'btunn' },
  /* 18 */ { x: 40, z: 60, links: [17, 6, 19], zone: 'tspawn' },
  /* 19 */ { x: 56, z: 58, links: [18, 7], zone: 'mid' },
]

const T_OBJECTIVES = [A_SITE, B_SITE]
const CT_HOLD = [
  { x: 65, z: 11 }, { x: 68, z: 15 }, { x: 14, z: 16 }, { x: 20, z: 22 },
]

export interface BotMind {
  path: number[]
  target: number | null
  enemy: number | null
  reactT: number
  fireT: number
  strafe: number
  goal: 'attack' | 'hold' | 'plant' | 'defuse' | 'retake'
  holdSpot: { x: number; z: number } | null
}

const minds = new Map<number, BotMind>()

function nearestWp(x: number, z: number): number {
  let best = 0, bd = Infinity
  for (let i = 0; i < WAYPOINTS.length; i++) {
    const wp = WAYPOINTS[i]
    const d = (wp.x - x) ** 2 + (wp.z - z) ** 2
    if (d < bd) { bd = d; best = i }
  }
  return best
}

// BFS 寻路
export function route(from: number, to: number): number[] {
  if (from === to) return [to]
  const prev = new Array(WAYPOINTS.length).fill(-1)
  prev[from] = from
  const q = [from]
  while (q.length) {
    const cur = q.shift()!
    for (const nb of WAYPOINTS[cur].links) {
      if (prev[nb] !== -1) continue
      prev[nb] = cur
      if (nb === to) {
        const path: number[] = [to]
        let p = to
        while (p !== from) { p = prev[p]; path.unshift(p) }
        path.shift()
        return path
      }
      q.push(nb)
    }
  }
  return []
}

export function initBot(id: number, team: Team) {
  const hold = CT_HOLD[id % CT_HOLD.length]
  minds.set(id, {
    path: [], target: null, enemy: null, reactT: 0, fireT: 0,
    strafe: Math.random() < 0.5 ? 1 : -1,
    goal: team === 'T' ? 'attack' : 'hold',
    holdSpot: team === 'CT' ? hold : null,
  })
}

export function mindOf(id: number): BotMind {
  let m = minds.get(id)
  if (!m) { initBot(id, 'T'); m = minds.get(id)! }
  return m
}

export function decideObjective(self: Character, bombPlanted: boolean, bombPos: { x: number; z: number } | null) {
  const m = mindOf(self.id)
  if (bombPlanted) {
    m.goal = self.team === 'CT' ? 'defuse' : 'hold'
    if (self.team === 'CT' && bombPos) {
      m.path = route(nearestWp(self.pos.x, self.pos.z), nearestWp(bombPos.x, bombPos.z))
      m.target = m.path[0] ?? null
    }
    return
  }
  if (self.team === 'T' && self.hasC4) {
    const site = Math.random() < 0.5 ? A_SITE : B_SITE
    m.goal = 'plant'
    m.path = route(nearestWp(self.pos.x, self.pos.z), nearestWp(site.x, site.z))
    m.target = m.path[0] ?? null
    return
  }
  if (self.team === 'T') {
    // 跟随包点进攻: 随机 A/B, 由 mind 固化
    if (m.goal !== 'attack' || !m.target) {
      const site = T_OBJECTIVES[Math.floor(Math.random() * 2)]
      m.goal = 'attack'
      m.path = route(nearestWp(self.pos.x, self.pos.z), nearestWp(site.x, site.z))
      m.target = m.path[0] ?? null
    }
    return
  }
  // CT: 前压或守点
  if (m.goal === 'hold' && m.holdSpot) {
    m.path = route(nearestWp(self.pos.x, self.pos.z), nearestWp(m.holdSpot.x, m.holdSpot.z))
    m.target = m.path[0] ?? null
  } else {
    m.path = route(nearestWp(self.pos.x, self.pos.z), nearestWp(A_SITE.x, A_SITE.z))
    m.target = m.path[0] ?? null
  }
}

export function advancePath(self: Character) {
  const m = mindOf(self.id)
  if (m.path.length && m.target !== null) {
    const wp = WAYPOINTS[m.target]
    const dx = wp.x - self.pos.x, dz = wp.z - self.pos.z
    if (dx * dx + dz * dz < 4) {
      m.path.shift()
      m.target = m.path[0] ?? null
    }
    return { mx: dx, mz: dz }
  }
  return null
}

// 门洞约束: 经过中门区域时朝门洞中心偏移
export function doorwayAdjust(x: number, z: number): { x: number; z: number } {
  const inDoorZone = z > 28 && z < 38 && x > 43 && x < 53
  if (inDoorZone) {
    const cx = (MID_DOOR_GAP.x0 + MID_DOOR_GAP.x1) / 2
    return { x: x + (cx - x) * 0.5, z }
  }
  return { x, z }
}
