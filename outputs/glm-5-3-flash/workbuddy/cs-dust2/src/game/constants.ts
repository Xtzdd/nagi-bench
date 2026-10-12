// 共享常量与类型
export type Team = 'CT' | 'T'

export interface Character {
  id: number
  team: Team
  name: string
  pos: { x: number; y: number; z: number }
  yaw: number
  hp: number
  armor: number
  alive: boolean
  isPlayer: boolean
  weapon: string
  money: number
  kills: number
  deaths: number
  hasC4: boolean
  respawnGuard: number
}

export const PLAYER_HEIGHT = 1.75
export const PLAYER_RADIUS = 0.4
export const EYE_HEIGHT = 1.62
export const GRAVITY = 20
export const JUMP_SPEED = 7.2
export const MOVE_SPEED = 6.2
export const WALK_SPEED = 3.0
export const ROUND_TIME = 115
export const BOMB_TIME = 40
export const DEFUSE_TIME = 5
export const PLANT_TIME = 3
export const FREEZE_TIME = 5
export const WIN_ROUND = 12
export const MAX_ROUNDS = 24
