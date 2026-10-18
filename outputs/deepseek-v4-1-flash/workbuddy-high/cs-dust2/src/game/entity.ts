import type * as THREE from 'three';
import type { Character } from './character';
import { WEAPONS } from '../engine/types';
import type { Slot, Team, WeaponDef } from '../engine/types';

export interface AmmoState {
  mag: number;
  reserve: number;
}

export interface Entity {
  id: number;
  name: string;
  team: Team;
  isPlayer: boolean;
  alive: boolean;
  /** 脚底位置。 */
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  yaw: number;
  pitch: number;
  health: number;
  armor: number;
  helmet: boolean;
  char: Character;
  weapons: Record<Slot, string | null>;
  activeSlot: Slot;
  ammo: Record<string, AmmoState>;
  scoped: boolean;
  reloadLeft: number;
  deployLeft: number;
  nextFireAt: number;
  recoilPitch: number;
  recoilSpread: number;
  hasC4: boolean;
  kills: number;
  deaths: number;
  /** 本 tick 是否开火（用于曳光弹与音效）。 */
  firedThisTick: boolean;
  plantedOrDefused?: 'plant' | 'defuse';
}

export function weaponOf(e: Entity): WeaponDef | null {
  const id = e.weapons[e.activeSlot];
  return id ? WEAPONS[id] ?? null : null;
}

export interface SightTarget {
  id: number;
  x: number;
  y: number;
  z: number;
  headY: number;
  alive: boolean;
  team: Team;
}

export interface AiWorld {
  now(): number;
  byId(id: number): Entity | null;
  enemiesOf(team: Team): SightTarget[];
  alliesOf(team: Team): SightTarget[];
  hasLineOfSight(from: { x: number; y: number; z: number }, to: { x: number; y: number; z: number }): boolean;
  /** 该阵营当前应当推进/防守的目标世界坐标。 */
  objectiveFor(team: Team): { x: number; z: number };
  /** 出生点（用于回防落位）。 */
  spawnOf(team: Team): { x: number; z: number };
  walkable(x: number, z: number): boolean;
  /** 沿 bot 当前朝向开火（瞄准误差已烘进 yaw/pitch）。 */
  fire(bot: Entity): void;
  meleeAttack(bot: Entity): void;
  /** 巡逻路径点（覆盖地图主要区域）。 */
  patrolPoints(): { x: number; z: number }[];
  /** 已安放的 C4 位置；未下包时为 null。 */
  c4Target(): { x: number; z: number } | null;
}
