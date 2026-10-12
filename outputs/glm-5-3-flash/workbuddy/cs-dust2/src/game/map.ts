// Dust2 核心区域重建：墙体盒 + 区域标记 + 出生点 + 包点
import type { Team } from './constants'

export interface WallBox { x: number; z: number; w: number; d: number; h: number }

// 地图约 96 x 72 米。x 向东, z 向南。
export const MAP_W = 96
export const MAP_D = 72

// 区域: [x0, z0, x1, z1]
export const ZONES = {
  tspawn:   { x0: 72, z0: 54, x1: 92, z1: 68 },
  ctspawn:  { x0: 30, z0: 4,  x1: 46, z1: 14 },
  longA:    { x0: 74, z0: 12, x1: 84, z1: 54 },
  asite:    { x0: 56, z0: 6,  x1: 74, z1: 20 },
  mid:      { x0: 42, z0: 16, x1: 54, z1: 52 },
  catwalk:  { x0: 54, z0: 12, x1: 66, z1: 18 },
  btunn:    { x0: 8,  z0: 36, x1: 18, z1: 62 },
  bsite:    { x0: 6,  z0: 8,  x1: 26, z1: 30 },
  doors:    { x0: 44, z0: 30, x1: 52, z1: 36 },
} as const

export const A_SITE = { x: 65, z: 13, r: 8 }
export const B_SITE = { x: 16, z: 19, r: 8 }
export const MID_DOOR_GAP = { x0: 46.5, x1: 49.5, z0: 31, z1: 35 } // 可穿过的门洞

export const T_SPAWNS: Array<[number, number]> = [
  [76, 62], [80, 64], [84, 62], [88, 64], [78, 66],
]
export const CT_SPAWNS: Array<[number, number]> = [
  [34, 8], [38, 6], [42, 8], [36, 12], [40, 12],
]

// 分隔墙。构建 Dust2 风格的连通结构：所有墙不可穿越。
export function buildWalls(): WallBox[] {
  const w: WallBox[] = []
  const H = 4.5
  const add = (x: number, z: number, ww: number, dd: number, h = H) =>
    w.push({ x, z, w: ww, d: dd, h })

  // 外围墙
  add(48, -0.5, 97, 1)      // 北
  add(48, 72.5, 97, 1)      // 南
  add(-0.5, 36, 1, 73)      // 西
  add(96.5, 36, 1, 73)      // 东

  // A 区与 Long A 结构
  add(79, 33, 1, 40)        // long A 东墙(内部段)
  add(74, 12, 10, 1)        // A 大门北端墙
  add(60, 20.5, 12, 1)      // A site 南墙(与 long A 分隔)
  add(56, 13, 1, 15)        // A site 西墙(与 catwalk 分隔)

  // 中门结构: 双墙 + 门体, 门洞可穿过
  add(48, 30.5, 12, 1)      // 中门北墙
  add(48, 35.5, 12, 1)      // 中门南墙
  add(45.5, 33, 1, 6)       // 门洞西侧门体(薄, 不可穿)
  add(50.5, 33, 1, 6)       // 门洞东侧门体(薄, 不可穿)
  // 注: 46.5-49.5 之间为可穿行门洞
  add(48, 16.5, 13, 1)      // mid 北端(连 catwalk 分流)

  // catwalk 走廊
  add(60, 11.5, 14, 1)

  // B 通道
  add(7.5, 49, 12, 1)       // B tun 上墙
  add(19.5, 49, 1, 14)      // B tun 东墙(下半段)
  add(7.5, 33, 14, 1)       // B site 南墙东段
  add(27.5, 19, 1, 22)      // B site 东墙

  // T 半场结构
  add(70, 54, 6, 1)         // T spawn 北缘(留缺口走 mid/long)
  add(60, 54, 1, 15)        // mid 南段东墙
  add(42, 53, 22, 1)        // T 到 mid 西的南墙

  // CT 半场结构
  add(48, 8, 1, 12)         // CT 与 A site 间分隔(留缺口)
  add(52, 4, 8, 1)          // CT 北缘

  // 场地内掩体箱
  const crates: Array<[number, number, number]> = [
    [62, 10, 2], [68, 16, 2], [58, 17, 1.6],          // A site
    [12, 14, 2], [20, 22, 2], [16, 26, 1.6],          // B site
    [47, 44, 1.8], [50, 22, 1.8],                     // mid
    [79, 44, 2], [81, 22, 1.8],                       // long
    [13, 55, 1.8], [16, 45, 1.8],                     // b tun
  ]
  for (const [x, z, s] of crates) w.push({ x, z, w: s, d: s, h: s })
  return w
}

export function zoneOf(x: number, z: number): string {
  for (const [name, r] of Object.entries(ZONES)) {
    if (x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1) return name
  }
  return 'unknown'
}

export function spawnFor(team: Team, idx: number): { x: number; z: number } {
  const list = team === 'T' ? T_SPAWNS : CT_SPAWNS
  const [x, z] = list[idx % list.length]
  return { x, z }
}

// 供 minimap 绘制的俯视轮廓
export function minimapWalls(): WallBox[] {
  return buildWalls().filter(b => b.h > 3)
}
