// 武器数据系统: 主武器 / 副武器 / 近战, 含 hitbox 分区伤害与护甲减伤
export type WeaponSlot = 'primary' | 'secondary' | 'melee'

export interface WeaponDef {
  id: string
  name: string
  slot: WeaponSlot
  price: number
  damage: number          // 基础躯干伤害
  headMult: number        // 爆头倍率
  rpm: number             // 射速(发/分)
  mag: number
  reserve: number
  reloadTime: number
  spread: number          // 基础散布(度)
  spreadPerShot: number   // 连发扩散增量
  recoilPitch: number     // 视角上扬(度/发)
  recoilSpread: number    // 准星扩散(UI 显示系数)
  moveSpread: number      // 移动附加散布
  armorPen: number        // 护甲穿透 0-1
  auto: boolean
  scope?: boolean         // AWP 开镜
}

export const WEAPONS: Record<string, WeaponDef> = {
  knife: { id: 'knife', name: '匕首', slot: 'melee', price: 0, damage: 55, headMult: 2, rpm: 120, mag: -1, reserve: -1, reloadTime: 0, spread: 0, spreadPerShot: 0, recoilPitch: 0, recoilSpread: 0, moveSpread: 0, armorPen: 0.85, auto: false },
  glock: { id: 'glock', name: 'Glock-18', slot: 'secondary', price: 200, damage: 28, headMult: 2, rpm: 400, mag: 20, reserve: 80, reloadTime: 2.2, spread: 1.2, spreadPerShot: 0.5, recoilPitch: 0.35, recoilSpread: 3, moveSpread: 2.2, armorPen: 0.47, auto: false },
  usp: { id: 'usp', name: 'USP-S', slot: 'secondary', price: 200, damage: 33, headMult: 2, rpm: 350, mag: 12, reserve: 60, reloadTime: 2.2, spread: 1.0, spreadPerShot: 0.5, recoilPitch: 0.4, recoilSpread: 3, moveSpread: 2.0, armorPen: 0.5, auto: false },
  deagle: { id: 'deagle', name: '沙漠之鹰', slot: 'secondary', price: 700, damage: 58, headMult: 2, rpm: 267, mag: 7, reserve: 28, reloadTime: 2.4, spread: 1.4, spreadPerShot: 1.2, recoilPitch: 1.6, recoilSpread: 9, moveSpread: 3.5, armorPen: 0.62, auto: false },
  ak47: { id: 'ak47', name: 'AK-47', slot: 'primary', price: 2700, damage: 36, headMult: 2, rpm: 600, mag: 30, reserve: 90, reloadTime: 2.5, spread: 0.7, spreadPerShot: 0.42, recoilPitch: 1.35, recoilSpread: 8, moveSpread: 7, armorPen: 0.775, auto: true },
  m4a4: { id: 'm4a4', name: 'M4A4', slot: 'primary', price: 3100, damage: 30, headMult: 2, rpm: 666, mag: 30, reserve: 90, reloadTime: 3.1, spread: 0.6, spreadPerShot: 0.3, recoilPitch: 0.85, recoilSpread: 5.5, moveSpread: 6, armorPen: 0.7, auto: true },
  awp: { id: 'awp', name: 'AWP', slot: 'primary', price: 4750, damage: 115, headMult: 2, rpm: 41, mag: 10, reserve: 30, reloadTime: 3.7, spread: 4.0, spreadPerShot: 0, recoilPitch: 2.2, recoilSpread: 4, moveSpread: 12, armorPen: 0.975, auto: false, scope: true },
}

export const T_DEFAULT = 'glock'
export const CT_DEFAULT = 'usp'

export type HitPart = 'head' | 'chest' | 'stomach' | 'arm' | 'leg'
const PART_MULT: Record<HitPart, number> = { head: 1, chest: 1, stomach: 1.25, arm: 0.75, leg: 0.55 }

// 距离衰减(每米)
const RANGE_MOD: Record<string, number> = { knife: 0, glock: 0.004, usp: 0.004, deagle: 0.003, ak47: 0.002, m4a4: 0.002, awp: 0.001 }

export function applyDamage(
  weaponId: string, part: HitPart, dist: number, armor: number
): { hp: number; armor: number } {
  const w = WEAPONS[weaponId]
  let dmg = w.damage * PART_MULT[part] * (part === 'head' ? w.headMult : 1)
  dmg *= Math.max(0.5, 1 - dist * (RANGE_MOD[weaponId] ?? 0.003))
  if (armor > 0 && part !== 'head') {
    const absorbed = dmg * (1 - w.armorPen) * 0.5
    dmg -= absorbed
    armor = Math.max(0, armor - absorbed * 0.5)
  } else if (armor > 0 && part === 'head') {
    dmg *= 1 - (1 - w.armorPen) * 0.25
  }
  return { hp: Math.round(dmg), armor: Math.round(armor) }
}

// 第一回合购买清单(手枪局): 只带默认手枪, 无主武器, 护甲按手枪局配置
export function pistolLoadout(team: 'CT' | 'T') {
  return { primary: null, secondary: team === 'CT' ? CT_DEFAULT : T_DEFAULT, armor: 0 }
}
