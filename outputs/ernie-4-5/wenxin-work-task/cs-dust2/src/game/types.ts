// Type definitions for CS Dust2 5v5

export type Team = 'T' | 'CT';

export type HitZone = 'head' | 'chest' | 'stomach' | 'arm' | 'leg';

export type WeaponId =
  | 'ak47'
  | 'm4a4'
  | 'awp'
  | 'glock'
  | 'usp'
  | 'deagle'
  | 'knife';

export type GameStateType =
  | 'menu'
  | 'playing'
  | 'round_end'
  | 'spectating';

export interface WeaponConfig {
  id: WeaponId;
  name: string;
  damage: number; // base chest damage
  fireRate: number; // rounds per minute
  magSize: number;
  reserveAmmo: number;
  reloadTime: number; // seconds
  recoilVertical: number; // degrees per shot at start
  recoilHorizontal: number;
  spread: number; // radians base spread
  range: number; // meters
  scope: boolean; // has scope (awp)
  automatic: boolean;
  melee: boolean;
  price?: number;
}

export interface WeaponState {
  config: WeaponConfig;
  ammoInMag: number;
  reserveAmmo: number;
  reloading: boolean;
  reloadTimer: number;
  lastShotTime: number;
  recoilAccum: number; // accumulated recoil for current spray
  scoped: boolean;
}

export interface Box {
  x: number;
  y: number;
  z: number;
  w: number;
  h: number;
  d: number;
  type: 'wall' | 'ground' | 'crate_metal' | 'crate_wood' | 'door';
}

export interface NavNode {
  id: number;
  x: number;
  z: number;
  connections: number[];
}

export interface Bullet {
  pos: { x: number; y: number; z: number };
  vel: { x: number; y: number; z: number };
  ownerId: number;
  team: Team;
  weapon: WeaponId;
  damage: number;
  life: number; // seconds remaining
  tracer?: THREE.Mesh;
}

export interface KillEvent {
  killer: string;
  victim: string;
  weapon: WeaponId | 'c4';
  killerTeam: Team;
  victimTeam: Team;
  headshot: boolean;
  time: number;
}

export type C4State =
  | 'carried'
  | 'dropped'
  | 'planting'
  | 'active'
  | 'defusing'
  | 'exploded'
  | 'defused';

export interface C4 {
  state: C4State;
  carrierId: number | null;
  pos: { x: number; y: number; z: number };
  plantTimer: number; // 0..plantDuration
  plantDuration: number;
  fuseTimer: number; // 0..40 when active
  defuseTimer: number;
  defuseDuration: number;
  defuserId: number | null;
  bombSite: 'A' | 'B' | null;
}

export interface PlayerInit {
  id: number;
  name: string;
  team: Team;
  isLocal: boolean;
  isAI: boolean;
  spawn: { x: number; y: number; z: number };
}

export interface Hitbox {
  zone: HitZone;
  mesh: THREE.Object3D;
  radius?: number; // simple sphere/box check
  size?: { w: number; h: number; d: number };
  offset?: { x: number; y: number; z: number };
}

export interface HUDSnapshot {
  hp: number;
  armor: number;
  hasHelmet: boolean;
  weaponName: string;
  ammoInMag: number;
  reserveAmmo: number;
  reloading: boolean;
  scoped: boolean;
  money: number;
  team: Team;
  alive: boolean;
  roundState: string;
  roundTimer: number;
  tScore: number;
  ctScore: number;
  bombState: string;
  bombTimer: number;
  bombCarrier: string | null;
  kills: KillEvent[];
  spectatorIndex: number;
  spectatorList: { id: number; name: string; alive: boolean }[];
  playerPositions: { x: number; z: number; team: Team; alive: boolean; isLocal: boolean; isBombCarrier: boolean }[];
  bombPos: { x: number; z: number } | null;
  aSite: { x: number; z: number };
  bSite: { x: number; z: number };
  roundNumber: number;
}
