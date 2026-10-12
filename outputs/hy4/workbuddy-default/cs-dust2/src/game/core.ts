// Shared types, tuning constants and the weapon data table.

export type Team = 'T' | 'CT';

export const TEAM_COLOR: Record<Team, number> = { T: 0xc98a3a, CT: 0x4a72b8 };

export interface WeaponDef {
  id: string;
  name: string;
  slot: 'primary' | 'secondary' | 'melee';
  team?: Team;                 // default sidearms are team-locked
  damage: number;              // base chest damage
  headMultiplier: number;      // spec: headshot is twice body damage
  armorRatio: number;          // fraction of damage absorbed by armor
  rpm: number;                 // rounds per minute
  mag: number;
  reserve: number;
  reloadTime: number;
  spread: number;              // base spread in radians
  spreadPerShot: number;       // added per shot, decays back
  recoilPitch: number;         // vertical view kick per shot (radians)
  recoilYaw: number;
  range: number;
  falloff: number;             // damage multiplier at max range
  scoped?: { fov: number; zoomTime: number };
  melee?: boolean;
  sound: 'rifle' | 'rifleLight' | 'sniper' | 'pistol' | 'deagle' | 'knife';
  model: {
    bodyLen: number; bodyH: number; bodyW: number;
    barrelLen: number; barrelR: number;
    stockLen: number;
    magLen: number;
    color: number;
    accent: number;
  };
}

export const WEAPONS: Record<string, WeaponDef> = {
  ak47: {
    id: 'ak47', name: 'AK-47', slot: 'primary',
    damage: 36, headMultiplier: 2, armorRatio: 0.55,
    rpm: 600, mag: 30, reserve: 90, reloadTime: 2.45,
    spread: 0.010, spreadPerShot: 0.0075, recoilPitch: 0.019, recoilYaw: 0.006,
    range: 78, falloff: 0.72, sound: 'rifle',
    model: { bodyLen: .62, bodyH: .12, bodyW: .07, barrelLen: .44, barrelR: .022, stockLen: .3, magLen: .26, color: 0x6b4a2c, accent: 0x3d3f45 }
  },
  m4a4: {
    id: 'm4a4', name: 'M4A4', slot: 'primary',
    damage: 30, headMultiplier: 2, armorRatio: 0.6,
    rpm: 666, mag: 30, reserve: 90, reloadTime: 3.0,
    spread: 0.007, spreadPerShot: 0.0038, recoilPitch: 0.010, recoilYaw: 0.0032,
    range: 82, falloff: 0.78, sound: 'rifleLight',
    model: { bodyLen: .6, bodyH: .12, bodyW: .07, barrelLen: .40, barrelR: .021, stockLen: .32, magLen: .24, color: 0x33383f, accent: 0x5b626b }
  },
  awp: {
    id: 'awp', name: 'AWP', slot: 'primary',
    damage: 115, headMultiplier: 2, armorRatio: 0.9,
    rpm: 41, mag: 5, reserve: 30, reloadTime: 3.6,
    spread: 0.0012, spreadPerShot: 0.05, recoilPitch: 0.045, recoilYaw: 0.004,
    range: 140, falloff: 0.99, scoped: { fov: 22, zoomTime: 0.28 }, sound: 'sniper',
    model: { bodyLen: .78, bodyH: .12, bodyW: .07, barrelLen: .62, barrelR: .024, stockLen: .38, magLen: .2, color: 0x2c3238, accent: 0x6d5a3c }
  },
  glock: {
    id: 'glock', name: 'Glock-18', slot: 'secondary', team: 'T',
    damage: 24, headMultiplier: 2, armorRatio: 0.47,
    rpm: 400, mag: 20, reserve: 120, reloadTime: 2.2,
    spread: 0.014, spreadPerShot: 0.0055, recoilPitch: 0.010, recoilYaw: 0.0035,
    range: 42, falloff: 0.6, sound: 'pistol',
    model: { bodyLen: .26, bodyH: .1, bodyW: .05, barrelLen: .14, barrelR: .017, stockLen: .06, magLen: .16, color: 0x2b2f35, accent: 0x4a5058 }
  },
  usp: {
    id: 'usp', name: 'USP-S', slot: 'secondary', team: 'CT',
    damage: 26, headMultiplier: 2, armorRatio: 0.5,
    rpm: 352, mag: 12, reserve: 96, reloadTime: 2.25,
    spread: 0.012, spreadPerShot: 0.005, recoilPitch: 0.009, recoilYaw: 0.003,
    range: 46, falloff: 0.64, sound: 'pistol',
    model: { bodyLen: .27, bodyH: .1, bodyW: .05, barrelLen: .15, barrelR: .017, stockLen: .07, magLen: .15, color: 0x30353c, accent: 0x5a626c }
  },
  deagle: {
    id: 'deagle', name: 'Desert Eagle', slot: 'secondary',
    damage: 53, headMultiplier: 2, armorRatio: 0.75,
    rpm: 267, mag: 7, reserve: 35, reloadTime: 2.6,
    spread: 0.008, spreadPerShot: 0.020, recoilPitch: 0.026, recoilYaw: 0.005,
    range: 62, falloff: 0.82, sound: 'deagle',
    model: { bodyLen: .32, bodyH: .11, bodyW: .055, barrelLen: .18, barrelR: .019, stockLen: .08, magLen: .14, color: 0x4a4a4e, accent: 0x8a8f96 }
  },
  knife: {
    id: 'knife', name: 'Knife', slot: 'melee',
    damage: 45, headMultiplier: 2, armorRatio: 0.4,
    rpm: 150, mag: 0, reserve: 0, reloadTime: 0,
    spread: 0, spreadPerShot: 0, recoilPitch: 0, recoilYaw: 0,
    range: 2.2, falloff: 1, melee: true, sound: 'knife',
    model: { bodyLen: .3, bodyH: .05, bodyW: .02, barrelLen: .22, barrelR: .012, stockLen: .1, magLen: 0, color: 0xb8bfc7, accent: 0x2b2f35 }
  }
};

export const PRIMARY_ORDER = ['ak47', 'm4a4', 'awp'];
export const SECONDARY_ORDER = ['deagle', 'glock', 'usp'];

export type HitboxName = 'head' | 'chest' | 'stomach' | 'arm' | 'leg';

export const HITBOX_MULT: Record<HitboxName, number> = {
  head: 1.0,      // head damage = 2x body, applied via headMultiplier on the weapon
  chest: 1.0,
  stomach: 1.25,
  arm: 0.78,
  leg: 0.72
};

export const TUNE = {
  playerHeight: 1.78,
  eyeHeight: 1.62,
  radius: 0.42,
  walkSpeed: 4.7,
  runSpeed: 6.05,
  crouchSpeed: 2.6,
  accel: 46,
  airAccel: 12,
  friction: 11,
  gravity: 22,
  jumpVel: 7.1,
  stepHeight: 0.55,
  maxPitch: 1.45,
  roundTime: 115,
  freezeTime: 3,
  buyTime: 0,           // no economy in this prototype: rounds are fixed loadouts
  bombTimer: 40,
  plantTime: 3.0,
  defuseTime: 7.0,
  defuseKitTime: 4.5,
  roundEndDelay: 4,
  respawnDelay: 0,
  botCount: 4,
  enemyCount: 5,
  headArmorHelmet: true
};

export interface KillFeedItem {
  id: number;
  killer: string;
  victim: string;
  weapon: string;
  headshot: boolean;
  killerTeam: Team;
  victimTeam: Team;
  at: number;
}
