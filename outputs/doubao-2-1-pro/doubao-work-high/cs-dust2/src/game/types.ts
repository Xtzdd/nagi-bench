export type Team = 'CT' | 'T';
export type WeaponId = 'rifle' | 'pistol' | 'knife';
export type SiteId = 'A' | 'B';
export type RoundPhase = '准备' | '进行中' | '炸弹已安放' | '回合结束';

export interface WeaponSpec {
  id: WeaponId;
  name: string;
  damage: number;
  magazine: number;
  fireRate: number;
  range: number;
  spread: number;
}

export interface SoldierSnapshot {
  id: number;
  name: string;
  team: Team;
  x: number;
  z: number;
  hp: number;
  alive: boolean;
  isPlayer: boolean;
}

export interface HudState {
  phase: RoundPhase;
  timer: number;
  playerHp: number;
  weapon: WeaponId;
  ammo: number;
  reserve: number;
  scoreT: number;
  scoreCT: number;
  bombPlanted: boolean;
  bombTimer: number;
  bombSite: SiteId | null;
  canPlant: boolean;
  canDefuse: boolean;
  feed: string[];
  soldiers: SoldierSnapshot[];
  message: string;
}
