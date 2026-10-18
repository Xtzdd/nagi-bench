export type Team = 'CT' | 'T';

export type Slot = 'primary' | 'secondary' | 'melee';

export type HitZone = 'head' | 'chest' | 'stomach' | 'arm' | 'leg';

/** 伤害倍率：爆头为身体的两倍。 */
export const ZONE_MULTIPLIER: Record<HitZone, number> = {
  head: 2.0,
  chest: 1.0,
  stomach: 1.25,
  arm: 0.75,
  leg: 0.65
};

export interface Trace {
  distance: number;
  zone: HitZone;
}

export interface WeaponDef {
  id: string;
  name: string;
  slot: Exclude<Slot, 'melee'> | 'melee';
  /** 基础伤害（胸部）。 */
  damage: number;
  /** 每分钟发射数。 */
  rpm: number;
  auto: boolean;
  /** 弹匣容量。 */
  mag: number;
  reserve: number;
  /** 命中判定所用单发弹丸数。 */
  pellets: number;
  /** 基础散布（弧度）。 */
  spread: number;
  /** 移动时散布增量。 */
  moveSpread: number;
  /** 每发后坐：视角上抬（弧度）与准星扩散增量（弧度）。 */
  recoilKick: number;
  recoilSpread: number;
  recoilRecover: number;
  /** 有效射程内线性伤害衰减区间。 */
  rangeFalloff: [number, number];
  minDamageRatio: number;
  /** 穿甲系数（对护甲的伤害效率）。 */
  armorPenetration: number;
  canScope: boolean;
  /** 切枪耗时（秒）。 */
  deployTime: number;
  reloadTime: number;
  price: number;
  /** 近战判定距离。 */
  meleeRange?: number;
}

export const WEAPONS: Record<string, WeaponDef> = {
  ak47: {
    id: 'ak47', name: 'AK-47', slot: 'primary', damage: 36, rpm: 600, auto: true,
    mag: 30, reserve: 90, pellets: 1, spread: 0.0035, moveSpread: 0.055,
    recoilKick: 0.021, recoilSpread: 0.0075, recoilRecover: 0.9,
    rangeFalloff: [28, 96], minDamageRatio: 0.72, armorPenetration: 0.775,
    canScope: false, deployTime: 0.7, reloadTime: 2.5, price: 2700
  },
  m4a4: {
    id: 'm4a4', name: 'M4A4', slot: 'primary', damage: 33, rpm: 666, auto: true,
    mag: 30, reserve: 90, pellets: 1, spread: 0.0026, moveSpread: 0.05,
    recoilKick: 0.0105, recoilSpread: 0.0042, recoilRecover: 1.15,
    rangeFalloff: [30, 100], minDamageRatio: 0.76, armorPenetration: 0.7,
    canScope: false, deployTime: 0.65, reloadTime: 2.4, price: 3100
  },
  awp: {
    id: 'awp', name: 'AWP', slot: 'primary', damage: 115, rpm: 41, auto: false,
    mag: 10, reserve: 30, pellets: 1, spread: 0.0006, moveSpread: 0.12,
    recoilKick: 0.055, recoilSpread: 0.02, recoilRecover: 0.45,
    rangeFalloff: [200, 200], minDamageRatio: 1, armorPenetration: 0.975,
    canScope: true, deployTime: 1.2, reloadTime: 3.6, price: 4750
  },
  glock: {
    id: 'glock', name: 'Glock-18', slot: 'secondary', damage: 28, rpm: 400, auto: false,
    mag: 20, reserve: 120, pellets: 1, spread: 0.005, moveSpread: 0.05,
    recoilKick: 0.009, recoilSpread: 0.005, recoilRecover: 1.3,
    rangeFalloff: [20, 60], minDamageRatio: 0.6, armorPenetration: 0.47,
    canScope: false, deployTime: 0.4, reloadTime: 2.0, price: 200
  },
  usp: {
    id: 'usp', name: 'USP-S', slot: 'secondary', damage: 35, rpm: 352, auto: false,
    mag: 12, reserve: 24, pellets: 1, spread: 0.0035, moveSpread: 0.05,
    recoilKick: 0.012, recoilSpread: 0.0055, recoilRecover: 1.25,
    rangeFalloff: [22, 68], minDamageRatio: 0.62, armorPenetration: 0.505,
    canScope: false, deployTime: 0.4, reloadTime: 2.2, price: 200
  },
  deagle: {
    id: 'deagle', name: 'Desert Eagle', slot: 'secondary', damage: 53, rpm: 267, auto: false,
    mag: 7, reserve: 35, pellets: 1, spread: 0.006, moveSpread: 0.07,
    recoilKick: 0.03, recoilSpread: 0.012, recoilRecover: 0.85,
    rangeFalloff: [26, 80], minDamageRatio: 0.7, armorPenetration: 0.93,
    canScope: false, deployTime: 0.5, reloadTime: 2.2, price: 700
  },
  knife: {
    id: 'knife', name: 'Knife', slot: 'melee', damage: 55, rpm: 78, auto: false,
    mag: 0, reserve: 0, pellets: 1, spread: 0, moveSpread: 0,
    recoilKick: 0.004, recoilSpread: 0, recoilRecover: 1,
    rangeFalloff: [2.2, 2.2], minDamageRatio: 1, armorPenetration: 0.9,
    canScope: false, deployTime: 0.3, reloadTime: 0, price: 0, meleeRange: 2.2
  }
};

export const DEFAULT_LOADOUT: Record<Team, { primary: string; secondary: string }> = {
  T: { primary: 'ak47', secondary: 'glock' },
  CT: { primary: 'm4a4', secondary: 'usp' }
};

/** 手枪局：全员只带默认手枪、无主武器。 */
export const PISTOL_ROUND_LOADOUT: Record<Team, { primary: string | null; secondary: string }> = {
  T: { primary: null, secondary: 'glock' },
  CT: { primary: null, secondary: 'usp' }
};

export interface HudWeaponState {
  id: string;
  name: string;
  mag: number;
  reserve: number;
  slot: Slot;
}

export interface KillFeedEntry {
  id: number;
  killer: string;
  victim: string;
  killerTeam: Team;
  victimTeam: Team;
  weapon: string;
  headshot: boolean;
}

export interface MinimapBlip {
  x: number;
  z: number;
  kind: 'self' | 'mate' | 'enemy' | 'c4';
}

export interface ScoreBoard {
  CT: number;
  T: number;
}

export type RoundPhase = 'freeze' | 'live' | 'planted' | 'over';

export interface HudState {
  phase: RoundPhase;
  round: number;
  timeLeft: number;
  score: ScoreBoard;
  aliveCT: number;
  aliveT: number;
  health: number;
  armor: number;
  hasHelmet: boolean;
  isPistolRound: boolean;
  weapons: HudWeaponState[];
  activeSlot: Slot;
  scoped: boolean;
  reloading: boolean;
  killFeed: KillFeedEntry[];
  message: string;
  playerAlive: boolean;
  spectating: boolean;
  blips: MinimapBlip[];
  c4: { state: 'carried' | 'dropped' | 'planted' | 'none'; x: number; z: number; timer: number };
  bombSite: string | null;
  plantProgress: number;
  defuseProgress: number;
}
