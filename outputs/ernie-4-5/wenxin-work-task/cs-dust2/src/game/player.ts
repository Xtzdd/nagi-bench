import * as THREE from 'three';
import { Team, Hitbox, HitZone, WeaponState, PlayerInit } from './types';
import { createWeaponState, WEAPONS } from './weapons';
import { Box } from './types';

// Player class: handles AABB collision, movement, jumping, rendering, hitboxes.

export const PLAYER_HEIGHT = 1.7;
export const PLAYER_WIDTH = 0.6;
export const PLAYER_EYE_HEIGHT = 1.6;
export const WALK_SPEED = 4.5;
export const RUN_SPEED = 6.5;
export const CROUCH_SPEED = 2.5;
export const JUMP_SPEED = 5.5;
export const GRAVITY = 18;

export interface PlayerLike {
  id: number;
  name: string;
  team: Team;
  isLocal: boolean;
  isAI: boolean;
  alive: boolean;
  hp: number;
  armor: number;
  hasHelmet: boolean;
  money: number;
  pos: { x: number; y: number; z: number };
  vel: { x: number; y: number; z: number };
  yaw: number; // radians
  pitch: number;
  onGround: boolean;
  crouching: boolean;
  group: THREE.Group;
  headNode: THREE.Object3D;
  chestNode: THREE.Object3D;
  stomachNode: THREE.Object3D;
  armNodes: THREE.Object3D[];
  legNodes: THREE.Object3D[];
  hitboxes: Hitbox[];
  weapons: WeaponState[];
  currentWeaponIdx: number;
  inventory: WeaponState[];
  aimTarget: { x: number; y: number; z: number } | null;
  moveDir: { x: number; z: number };
  viewTarget: number | null; // for AI: enemy id currently targeted
  fireCooldown: number;
  shootInput: boolean;
  reloadInput: boolean;
  lastDamageTime: number;
  lastAttackerId: number | null;
  flashTimer: number;
  // Spectator
  spectatingPlayerId: number | null;
}

// Build humanoid block model and attach hitboxes.
function buildHumanoid(team: Team): {
  group: THREE.Group;
  headNode: THREE.Object3D;
  chestNode: THREE.Object3D;
  stomachNode: THREE.Object3D;
  armNodes: THREE.Object3D[];
  legNodes: THREE.Object3D[];
  hitboxes: Hitbox[];
} {
  const group = new THREE.Group();
  const bodyColor = team === 'CT' ? 0x2a4d8f : 0xb58863; // CT blue / T desert
  const pantsColor = team === 'CT' ? 0x1b335f : 0x6e5034;
  const skinColor = 0xd9a98a;

  const bodyMat = new THREE.MeshLambertMaterial({ color: bodyColor });
  const pantsMat = new THREE.MeshLambertMaterial({ color: pantsColor });
  const skinMat = new THREE.MeshLambertMaterial({ color: skinColor });

  // Head
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.32, 0.32), skinMat);
  head.position.set(0, PLAYER_EYE_HEIGHT - 0.16, 0);
  group.add(head);

  // Chest
  const chest = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.45, 0.3), bodyMat);
  chest.position.set(0, PLAYER_EYE_HEIGHT - 0.55, 0);
  group.add(chest);

  // Stomach
  const stomach = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.3, 0.28), bodyMat);
  stomach.position.set(0, PLAYER_EYE_HEIGHT - 0.9, 0);
  group.add(stomach);

  // Arms (left and right) - held forward in firing pose
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.5, 0.15), bodyMat);
  armL.position.set(-0.3, PLAYER_EYE_HEIGHT - 0.55, 0.1);
  armL.rotation.x = -0.8;
  group.add(armL);
  const armR = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.5, 0.15), bodyMat);
  armR.position.set(0.3, PLAYER_EYE_HEIGHT - 0.55, 0.1);
  armR.rotation.x = -0.8;
  group.add(armR);

  // Legs
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.75, 0.25), pantsMat);
  legL.position.set(-0.15, 0.4, 0);
  group.add(legL);
  const legR = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.75, 0.25), pantsMat);
  legR.position.set(0.15, 0.4, 0);
  group.add(legR);

  const hitboxes: Hitbox[] = [
    { zone: 'head', mesh: head, size: { w: 0.32, h: 0.32, d: 0.32 } },
    { zone: 'chest', mesh: chest, size: { w: 0.5, h: 0.45, d: 0.3 } },
    { zone: 'stomach', mesh: stomach, size: { w: 0.46, h: 0.3, d: 0.28 } },
    { zone: 'arm', mesh: armL, size: { w: 0.2, h: 0.5, d: 0.2 } },
    { zone: 'arm', mesh: armR, size: { w: 0.2, h: 0.5, d: 0.2 } },
    { zone: 'leg', mesh: legL, size: { w: 0.25, h: 0.75, d: 0.3 } },
    { zone: 'leg', mesh: legR, size: { w: 0.25, h: 0.75, d: 0.3 } },
  ];

  return {
    group,
    headNode: head,
    chestNode: chest,
    stomachNode: stomach,
    armNodes: [armL, armR],
    legNodes: [legL, legR],
    hitboxes,
  };
}

export function createPlayer(init: PlayerInit, scene: THREE.Scene): PlayerLike {
  const human = buildHumanoid(init.team);
  scene.add(human.group);
  human.group.position.set(init.spawn.x, init.spawn.y, init.spawn.z);

  // Default weapons
  const pistolId = init.team === 'T' ? 'glock' : 'usp';
  const weapons = [createWeaponState('knife'), createWeaponState(pistolId)];

  const p: PlayerLike = {
    id: init.id,
    name: init.name,
    team: init.team,
    isLocal: init.isLocal,
    isAI: init.isAI,
    alive: true,
    hp: 100,
    armor: 0,
    hasHelmet: false,
    money: 800,
    pos: { x: init.spawn.x, y: init.spawn.y, z: init.spawn.z },
    vel: { x: 0, y: 0, z: 0 },
    yaw: init.team === 'CT' ? Math.PI / 2 : -Math.PI / 2,
    pitch: 0,
    onGround: true,
    crouching: false,
    group: human.group,
    headNode: human.headNode,
    chestNode: human.chestNode,
    stomachNode: human.stomachNode,
    armNodes: human.armNodes,
    legNodes: human.legNodes,
    hitboxes: human.hitboxes,
    weapons,
    currentWeaponIdx: 1, // pistol start
    inventory: weapons,
    aimTarget: null,
    moveDir: { x: 0, z: 0 },
    viewTarget: null,
    fireCooldown: 0,
    shootInput: false,
    reloadInput: false,
    lastDamageTime: -100,
    lastAttackerId: null,
    flashTimer: 0,
    spectatingPlayerId: null,
  };
  return p;
}

export function resetPlayerForRound(
  p: PlayerLike,
  spawn: { x: number; y: number; z: number },
  pistolRound: boolean
) {
  p.pos.x = spawn.x;
  p.pos.y = spawn.y;
  p.pos.z = spawn.z;
  p.vel = { x: 0, y: 0, z: 0 };
  p.alive = true;
  p.hp = 100;
  p.onGround = true;
  p.crouching = false;
  p.group.visible = true;
  p.group.position.set(spawn.x, spawn.y, spawn.z);
  p.fireCooldown = 0;
  p.shootInput = false;
  p.reloadInput = false;
  p.viewTarget = null;
  p.aimTarget = null;
  p.moveDir = { x: 0, z: 0 };
  p.spectatingPlayerId = null;
  p.yaw = p.team === 'CT' ? Math.PI / 2 : -Math.PI / 2;
  p.pitch = 0;

  // Reset weapons: default pistol only in pistol round; keep bought weapons otherwise
  if (pistolRound) {
    const pistolId = p.team === 'T' ? 'glock' : 'usp';
    p.weapons = [createWeaponState('knife'), createWeaponState(pistolId)];
    p.armor = 0;
    p.hasHelmet = false;
  } else {
    // keep bought weapons but refill mags
    for (const w of p.weapons) {
      const cfg = w.config;
      w.ammoInMag = cfg.magSize;
      w.reserveAmmo = cfg.reserveAmmo;
      w.reloading = false;
      w.reloadTimer = 0;
      w.recoilAccum = 0;
      w.scoped = false;
    }
  }
  p.currentWeaponIdx = 1;
}

export function currentWeapon(p: PlayerLike): WeaponState {
  return p.weapons[p.currentWeaponIdx];
}

export function switchWeapon(p: PlayerLike, idx: number) {
  if (idx < 0 || idx >= p.weapons.length) return;
  const w = p.weapons[idx];
  if (!w) return;
  p.currentWeaponIdx = idx;
  w.reloading = false;
  w.reloadTimer = 0;
  w.recoilAccum = 0;
}

// AABB collision with map boxes (excluding doors and ground for horizontal check)
export function collideAndMove(p: PlayerLike, boxes: Box[], dt: number) {
  // Horizontal movement uses player radius ~0.3m. Vertical uses height.
  const radius = PLAYER_WIDTH / 2;
  const eyeH = PLAYER_EYE_HEIGHT;

  // Apply gravity to vertical velocity
  p.vel.y -= GRAVITY * dt;

  // Move X axis
  p.pos.x += p.vel.x * dt;
  for (const b of boxes) {
    if (b.type === 'ground' || b.type === 'door') continue;
    const minX = b.x - b.w / 2 - radius;
    const maxX = b.x + b.w / 2 + radius;
    const minZ = b.z - b.d / 2 - radius;
    const maxZ = b.z + b.d / 2 + radius;
    const minY = b.y - b.h / 2;
    const maxY = b.y + b.h / 2;
    if (
      p.pos.x > minX && p.pos.x < maxX &&
      p.pos.z > minZ && p.pos.z < maxZ &&
      p.pos.y < maxY && p.pos.y + eyeH > minY
    ) {
      if (p.vel.x > 0) p.pos.x = minX;
      else if (p.vel.x < 0) p.pos.x = maxX;
      p.vel.x = 0;
    }
  }

  // Move Z axis
  p.pos.z += p.vel.z * dt;
  for (const b of boxes) {
    if (b.type === 'ground' || b.type === 'door') continue;
    const minX = b.x - b.w / 2 - radius;
    const maxX = b.x + b.w / 2 + radius;
    const minZ = b.z - b.d / 2 - radius;
    const maxZ = b.z + b.d / 2 + radius;
    const minY = b.y - b.h / 2;
    const maxY = b.y + b.h / 2;
    if (
      p.pos.x > minX && p.pos.x < maxX &&
      p.pos.z > minZ && p.pos.z < maxZ &&
      p.pos.y < maxY && p.pos.y + eyeH > minY
    ) {
      if (p.vel.z > 0) p.pos.z = minZ;
      else if (p.vel.z < 0) p.pos.z = maxZ;
      p.vel.z = 0;
    }
  }

  // Move Y axis
  p.pos.y += p.vel.y * dt;
  p.onGround = false;
  for (const b of boxes) {
    if (b.type === 'door') continue;
    const minX = b.x - b.w / 2 - radius;
    const maxX = b.x + b.w / 2 + radius;
    const minZ = b.z - b.d / 2 - radius;
    const maxZ = b.z + b.d / 2 + radius;
    const minY = b.y - b.h / 2;
    const maxY = b.y + b.h / 2;
    if (
      p.pos.x > minX && p.pos.x < maxX &&
      p.pos.z > minZ && p.pos.z < maxZ &&
      p.pos.y < maxY && p.pos.y + eyeH > minY
    ) {
      if (p.vel.y <= 0) {
        // Landing on top
        if (p.pos.y >= maxY - 0.05) {
          p.pos.y = maxY;
          p.vel.y = 0;
          p.onGround = true;
        } else {
          // hit side vertically (head bump)
          if (p.vel.y > 0) {
            p.pos.y = minY - eyeH;
          }
          p.vel.y = 0;
        }
      } else {
        p.pos.y = minY - eyeH;
        p.vel.y = 0;
      }
    }
  }

  if (p.pos.y < 0) {
    p.pos.y = 0;
    p.vel.y = 0;
    p.onGround = true;
  }

  // Sync group position
  p.group.position.set(p.pos.x, p.pos.y, p.pos.z);
  p.group.rotation.y = p.yaw;
}

// Give damage; returns true if killed.
export function applyDamage(
  p: PlayerLike,
  dmg: number,
  zone: HitZone,
  hasHelmetProtects: boolean
): { killed: boolean; effectiveDmg: number; headshot: boolean } {
  let effectiveDmg = dmg;
  const headshot = zone === 'head';
  if (p.armor > 0) {
    if (headshot && p.hasHelmet && hasHelmetProtects) {
      effectiveDmg = dmg * 0.5;
    } else {
      effectiveDmg = dmg * 0.5;
    }
    p.armor = Math.max(0, p.armor - dmg * 0.5);
  }
  p.hp -= effectiveDmg;
  if (p.hp <= 0) {
    p.hp = 0;
    p.alive = false;
    p.group.visible = false;
    return { killed: true, effectiveDmg, headshot };
  }
  return { killed: false, effectiveDmg, headshot };
}
